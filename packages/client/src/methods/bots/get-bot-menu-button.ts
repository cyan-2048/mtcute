import { tl } from '@mtcute/tl'

import { TelegramClient } from '../../client'
import { InputPeerLike, MtInvalidPeerTypeError } from '../../types'
import { normalizeToInputUser } from '../../utils/peer-utils'

/**
 * Fetches the menu button set for the given user.
 *
 * @internal
 */
export async function getBotMenuButton(
    this: TelegramClient,
    user: InputPeerLike,
): Promise<tl.TypeBotMenuButton> {
    return await this.call({
        _: 'bots.getBotMenuButton',
        userId: normalizeToInputUser(await this.resolvePeer(user), user),
    })
}
