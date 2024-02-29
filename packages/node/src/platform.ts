import * as os from 'os'

import { ICorePlatform } from '@mtcute/core/platform.js'

import { beforeExit } from './utils/exit-hook.js'
import { defaultLoggingHandler } from './utils/logging.js'
import { normalizeFile } from './utils/normalize-file.js'

const BUFFER_BASE64_URL_AVAILABLE = typeof Buffer.isEncoding === 'function' && Buffer.isEncoding('base64url')

const toBuffer = (buf: Uint8Array): Buffer => Buffer.from(
    buf.buffer,
    buf.byteOffset,
    buf.byteLength,
)

export class NodePlatform implements ICorePlatform {
    // ICorePlatform
    log!: typeof defaultLoggingHandler
    beforeExit!: typeof beforeExit
    normalizeFile!: typeof normalizeFile

    getDeviceModel(): string {
        return `${os.type()} ${os.arch()} ${os.release()}`
    }

    getDefaultLogLevel(): number | null {
        const envLogLevel = parseInt(process.env.MTCUTE_LOG_LEVEL ?? '')

        if (!isNaN(envLogLevel)) {
            return envLogLevel
        }

        return null
    }

    // ITlPlatform
    utf8ByteLength(str: string): number {
        return Buffer.byteLength(str, 'utf8')
    }
    utf8Encode(str: string): Uint8Array {
        return Buffer.from(str, 'utf8')
    }
    utf8Decode(buf: Uint8Array): string {
        return toBuffer(buf).toString('utf8')
    }

    hexEncode(buf: Uint8Array): string {
        return toBuffer(buf).toString('hex')
    }
    hexDecode(str: string): Uint8Array {
        return Buffer.from(str, 'hex')
    }

    base64Encode(buf: Uint8Array, url = false): string {
        const nodeBuffer = toBuffer(buf)

        if (url && BUFFER_BASE64_URL_AVAILABLE) return nodeBuffer.toString('base64url')

        const str = nodeBuffer.toString('base64')
        if (url) return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

        return str
    }
    base64Decode(string: string, url = false): Uint8Array {
        if (url && BUFFER_BASE64_URL_AVAILABLE) {
            return Buffer.from(string, 'base64url')
        }

        if (url) {
            string = string.replace(/-/g, '+').replace(/_/g, '/')
            while (string.length % 4) string += '='
        }

        return Buffer.from(string, 'base64')
    }
}

NodePlatform.prototype.log = defaultLoggingHandler
NodePlatform.prototype.beforeExit = beforeExit
NodePlatform.prototype.normalizeFile = normalizeFile
