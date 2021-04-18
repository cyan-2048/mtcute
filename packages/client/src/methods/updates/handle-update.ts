import { tl } from '@mtcute/tl'
import { TelegramClient } from '../../client'
import {
    createUsersChatsIndex,
    normalizeToInputChannel,
    normalizeToInputUser,
    peerToInputPeer,
} from '../../utils/peer-utils'
import { extractChannelIdFromUpdate } from '../../utils/misc-utils'
import { Lock } from '../../utils/lock'
import bigInt from 'big-integer'
import { MAX_CHANNEL_ID } from '../../../../core'

const debug = require('debug')('mtcute:upds')

// i tried to implement updates seq, but that thing seems to be
// broken on the server side, lol (see https://t.me/teispam/1199, ru)
// tldr server sends multiple `updates` with the same seq, and that seq
// is also larger than the seq in the initial updates.getState response

// @extension
interface UpdatesState {
    _updLock: Lock

    // accessing storage every time might be expensive,
    // so store everything here, and load & save
    // every time session is loaded & saved.
    _pts: number
    _date: number
    // _seq: number
    _cpts: Record<number, number>
}

// @initialize
function _initializeUpdates(this: TelegramClient) {
    this._updLock = new Lock()
    // we dont need to initialize state fields since
    // they are always loaded either from the server, or from storage.

    // channel PTS are not loaded immediately, and instead are cached here
    // after the first time they were retrieved from the storage.
    // they are later pushed into the storage.
    this._cpts = {}
}

/**
 * Fetch updates state from the server.
 * Meant to be used right after authorization,
 * but before force-saving the session.
 * @internal
 */
export async function _fetchUpdatesState(this: TelegramClient): Promise<void> {
    const state = await this.call({ _: 'updates.getState' })
    this._pts = state.pts
    this._date = state.date
    // this._seq = state.seq
    debug(
        'loaded initial state: pts=%d, date=%d', // , seq=%d',
        state.pts,
        state.date
        // state.seq
    )
}

/**
 * @internal
 */
export async function _loadStorage(this: TelegramClient): Promise<void> {
    // load updates state from the session
    await this.storage.load?.()
    const state = await this.storage.getCommonPts()
    if (state) {
        this._pts = state[0]
        this._date = state[1]
        // this._seq = state[2]
    }
    // if no state, don't bother initializing properties
    // since that means that there is no authorization,
    // and thus _fetchUpdatesState will be called

    const self = await this.storage.getSelf()
    if (self) {
        this._userId = self.userId
        this._isBot = self.isBot
    }
}

/**
 * @internal
 */
export async function _saveStorage(this: TelegramClient): Promise<void> {
    // save updates state to the session

    // before any authorization pts will be undefined
    if (this._pts !== undefined) {
        await this.storage.setCommonPts([this._pts, this._date]) // , this._seq])
        await this.storage.setManyChannelPts(this._cpts)
    }
    if (this._userId !== null) {
        await this.storage.setSelf({
            userId: this._userId,
            isBot: this._isBot,
        })
    }

    await this.storage.save?.()
}

async function _loadDifference(this: TelegramClient): Promise<void> {
    for (;;) {
        const diff = await this.call({
            _: 'updates.getDifference',
            pts: this._pts,
            date: this._date,
            qts: 0,
        })

        if (
            diff._ === 'updates.differenceEmpty' ||
            diff._ === 'updates.differenceTooLong'
        )
            return

        const state =
            diff._ === 'updates.difference'
                ? diff.state
                : diff.intermediateState

        await this._cachePeersFrom(diff)

        const { users, chats } = createUsersChatsIndex(diff)

        diff.newMessages.forEach((message) =>
            this._dispatchUpdate(message, users, chats)
        )
        diff.otherUpdates.forEach((upd) =>
            this._dispatchUpdate(upd, users, chats)
        )

        this._pts = state.pts
        this._date = state.date

        if (diff._ === 'updates.difference') return
    }
}

async function _loadChannelDifference(
    this: TelegramClient,
    channelId: number
): Promise<void> {
    let channel
    try {
        channel = normalizeToInputChannel(
            await this.resolvePeer(MAX_CHANNEL_ID - channelId)
        )!
    } catch (e) {
        return
    }

    let pts = this._cpts[channelId]
    if (!pts) {
        pts = (await this.storage.getChannelPts(channelId)) ?? 0
    }

    for (;;) {
        const diff = await this.call({
            _: 'updates.getChannelDifference',
            channel,
            pts,
            limit: this._isBot ? 1000 : 100,
            filter: { _: 'channelMessagesFilterEmpty' },
        })

        if (
            diff._ === 'updates.channelDifferenceEmpty' ||
            diff._ === 'updates.channelDifferenceTooLong'
        )
            return

        await this._cachePeersFrom(diff)

        const { users, chats } = createUsersChatsIndex(diff)

        diff.newMessages.forEach((message) =>
            this._dispatchUpdate(message, users, chats)
        )
        diff.otherUpdates.forEach((upd) =>
            this._dispatchUpdate(upd, users, chats)
        )

        pts = diff.pts

        if (diff.final) break
    }
}

/**
 * @internal
 */
export function _handleUpdate(
    this: TelegramClient,
    update: tl.TypeUpdates
): void {
    // just in case, check that updates state is available
    if (this._pts === undefined) {
        debug('received an update before updates state is available')
        return
    }

    // we want to process updates in order, so we use a lock
    // it is *very* important that the lock is released, otherwise
    // the incoming updates will be stuck forever, eventually killing the process with OOM
    // thus, we wrap everything in what basically is a try..finally

    // additionally, locking here blocks updates handling while we are
    // loading difference inside update handler.

    this._updLock
        .acquire()
        .then(async () => {
            debug('received %s', update._)

            // i tried my best to follow the documentation, but i still may have missed something.
            // feel free to contribute!
            // reference: https://core.telegram.org/api/updates
            if (update._ === 'updatesTooLong') {
                // "there are too many events pending to be pushed to the client", we need to fetch them manually
                await _loadDifference.call(this)
            } else if (
                update._ === 'updates' ||
                update._ === 'updatesCombined'
            ) {
                // const seqStart =
                //     update._ === 'updatesCombined'
                //         ? update.seqStart
                //         : update.seq
                // const nextLocalSeq = this._seq + 1
                //
                // debug('received %s (seq_start=%d, seq_end=%d)', update._, seqStart, update.seq)
                //
                // if (nextLocalSeq > seqStart)
                //     // "the updates were already applied, and must be ignored"
                //     return
                // if (nextLocalSeq < seqStart)
                //     // "there's an updates gap that must be filled"
                //     // loading difference will also load any updates contained
                //     // in this update, so we discard it
                //     return await _loadDifference.call(this)

                await this._cachePeersFrom(update)
                const { users, chats } = createUsersChatsIndex(update)

                for (const upd of update.updates) {
                    if (upd._ === 'updateChannelTooLong') {
                        if (upd.pts) {
                            this._cpts[upd.channelId] = upd.pts
                        }
                        return await _loadChannelDifference.call(this, upd.channelId)
                    }

                    const channelId = extractChannelIdFromUpdate(upd)
                    const pts = 'pts' in upd ? upd.pts : undefined
                    const ptsCount =
                        'ptsCount' in upd ? upd.ptsCount : undefined

                    if (pts !== undefined && ptsCount !== undefined) {
                        let nextLocalPts
                        if (channelId === undefined)
                            nextLocalPts = this._pts + ptsCount
                        else if (channelId in this._cpts)
                            nextLocalPts = this._cpts[channelId] + ptsCount
                        else {
                            const saved = await this.storage.getChannelPts(
                                channelId
                            )
                            if (saved) {
                                this._cpts[channelId] = saved
                                nextLocalPts = saved + ptsCount
                            } else {
                                nextLocalPts = null
                            }
                        }

                        if (nextLocalPts) {
                            if (nextLocalPts > pts)
                                // "the update was already applied, and must be ignored"
                                return
                            if (nextLocalPts < pts)
                                // "there's an update gap that must be filled"
                                // same as before, loading diff will also load
                                // any of the pending updates, so we don't need
                                // to bother handling them further.
                                if (channelId) {
                                    return await _loadChannelDifference.call(this, channelId)
                                } else {
                                    return await _loadDifference.call(this)
                                }
                        }

                        this._dispatchUpdate(upd, users, chats)

                        if (channelId) {
                            this._cpts[channelId] = pts
                        } else {
                            this._pts = pts
                        }
                    } else {
                        this._dispatchUpdate(upd, users, chats)
                    }
                }

                // this._seq = update.seq
                this._date = update.date
            } else if (update._ === 'updateShort') {
                const upd = update.update
                if (upd._ === 'updateDcOptions' && this._config) {
                    ;(this._config as tl.Mutable<tl.TypeConfig>).dcOptions =
                        upd.dcOptions
                } else if (upd._ === 'updateConfig') {
                    this._config = await this.call({ _: 'help.getConfig' })
                } else {
                    this._dispatchUpdate(upd, {}, {})
                }

                this._date = update.date
            } else if (update._ === 'updateShortMessage') {
                const message: tl.RawMessage = {
                    _: 'message',
                    out: update.out,
                    mentioned: update.mentioned,
                    mediaUnread: update.mediaUnread,
                    silent: update.silent,
                    id: update.id,
                    fromId: {
                        _: 'peerUser',
                        userId: update.out ? this._userId! : update.userId,
                    },
                    peerId: {
                        _: 'peerUser',
                        userId: update.userId,
                    },
                    fwdFrom: update.fwdFrom,
                    viaBotId: update.viaBotId,
                    replyTo: update.replyTo,
                    date: update.date,
                    message: update.message,
                    entities: update.entities,
                    ttlPeriod: update.ttlPeriod,
                }

                // now we need to fetch info about users involved.
                // since this update is only used for PM, we can just
                // fetch the current user and the other user.
                // additionally, we need to handle "forwarded from"
                // field, as it may contain a user OR a channel
                const fwdFrom = update.fwdFrom?.fromId
                    ? peerToInputPeer(update.fwdFrom.fromId)
                    : undefined

                let rawUsers: tl.TypeUser[]
                {
                    const id: tl.TypeInputUser[] = [
                        { _: 'inputUserSelf' },
                        {
                            _: 'inputUser',
                            userId: update.userId,
                            accessHash: bigInt.zero,
                        },
                    ]

                    if (fwdFrom) {
                        const inputUser = normalizeToInputUser(fwdFrom)
                        if (inputUser) id.push(inputUser)
                    }

                    rawUsers = await this.call({
                        _: 'users.getUsers',
                        id,
                    })
                }
                let rawChats: tl.TypeChat[] = []
                if (fwdFrom) {
                    const inputChannel = normalizeToInputChannel(fwdFrom)
                    if (inputChannel)
                        rawChats = await this.call({
                            _: 'channels.getChannels',
                            id: [inputChannel],
                        }).then((res) => res.chats)
                }

                this._date = update.date

                const { users, chats } = createUsersChatsIndex({
                    users: rawUsers,
                    chats: rawChats,
                })
                this._dispatchUpdate(message, users, chats)
            } else if (update._ === 'updateShortChatMessage') {
                const message: tl.RawMessage = {
                    _: 'message',
                    out: update.out,
                    mentioned: update.mentioned,
                    mediaUnread: update.mediaUnread,
                    silent: update.silent,
                    id: update.id,
                    fromId: {
                        _: 'peerUser',
                        userId: update.fromId,
                    },
                    peerId: {
                        _: 'peerChat',
                        chatId: update.chatId,
                    },
                    fwdFrom: update.fwdFrom,
                    viaBotId: update.viaBotId,
                    replyTo: update.replyTo,
                    date: update.date,
                    message: update.message,
                    entities: update.entities,
                    ttlPeriod: update.ttlPeriod,
                }

                // similarly to updateShortMessage, we need to fetch the sender
                // user and the chat, and also handle "forwarded from" info.
                const fwdFrom = update.fwdFrom?.fromId
                    ? peerToInputPeer(update.fwdFrom.fromId)
                    : undefined

                let rawUsers: tl.TypeUser[]
                {
                    const id: tl.TypeInputUser[] = [
                        { _: 'inputUserSelf' },
                        {
                            _: 'inputUser',
                            userId: update.fromId,
                            accessHash: bigInt.zero,
                        },
                    ]

                    if (fwdFrom) {
                        const inputUser = normalizeToInputUser(fwdFrom)
                        if (inputUser) id.push(inputUser)
                    }

                    rawUsers = await this.call({
                        _: 'users.getUsers',
                        id,
                    })
                }
                const rawChats = await this.call({
                    _: 'messages.getChats',
                    id: [update.chatId],
                }).then((res) => res.chats)

                if (fwdFrom) {
                    const inputChannel = normalizeToInputChannel(fwdFrom)
                    if (inputChannel) {
                        const res = await this.call({
                            _: 'channels.getChannels',
                            id: [inputChannel],
                        })
                        rawChats.push(...res.chats)
                    }
                }

                this._date = update.date
                const { users, chats } = createUsersChatsIndex({
                    users: rawUsers,
                    chats: rawChats,
                })
                this._dispatchUpdate(message, users, chats)
            }
        })
        .catch((err) => this._emitError(err))
        .then(() => this._updLock.release())
}


/**
 * Catch up with the server by loading missed updates.
 *
 * @internal
 */
export function catchUp(this: TelegramClient): Promise<void> {
    return _loadDifference.call(this)
}

