import { MtArgumentError } from '@mtcute/core'
import { getPlatform } from '@mtcute/core/platform.js'
import { dataViewFromBuffer } from '@mtcute/core/utils.js'

import { serializeIpv4ToBytes, serializeIpv6ToBytes } from '../utils/ip.js'

import type { TelethonSession } from './types.js'

export function serializeTelethonSession(session: TelethonSession): string {
    if (session.authKey.length !== 256) {
        throw new MtArgumentError('authKey must be 256 bytes long')
    }

    const ipSize = session.ipv6 ? 16 : 4
    const u8 = new Uint8Array(259 + ipSize)
    const dv = dataViewFromBuffer(u8)

    dv.setUint8(0, session.dcId)

    let pos

    if (session.ipv6) {
        serializeIpv6ToBytes(session.ipAddress, u8.subarray(1, 17))
        pos = 17
    } else {
        serializeIpv4ToBytes(session.ipAddress, u8.subarray(1, 5))
        pos = 5
    }

    dv.setUint16(pos, session.port)
    pos += 2
    u8.set(session.authKey, pos)

    let b64 = getPlatform().base64Encode(u8, true)
    while (b64.length % 4 !== 0) b64 += '=' // for some reason telethon uses padding

    return `1${b64}`
}
