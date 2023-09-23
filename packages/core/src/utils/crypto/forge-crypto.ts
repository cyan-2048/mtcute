import type * as forgeNs from 'node-forge'

import { MaybeAsync } from '../../types'
import { BaseCryptoProvider, ICryptoProvider, IEncryptionScheme } from './abstract'

type forge = typeof forgeNs
let forge: forge | null = null

try {
    forge = require('node-forge') as forge
} catch (e) {}

export class ForgeCryptoProvider extends BaseCryptoProvider implements ICryptoProvider {
    constructor() {
        super()

        if (!forge) {
            throw new Error('For ForgeCryptoProvider you must have node-forge installed!')
        }
    }

    createAesCtr(key: Buffer, iv: Buffer, encrypt: boolean): IEncryptionScheme {
        const cipher = forge!.cipher[encrypt ? 'createCipher' : 'createDecipher']('AES-CTR', key.toString('binary'))
        cipher.start({ iv: iv.toString('binary') })

        const update = (data: Buffer): Buffer => {
            cipher.output.data = ''
            cipher.update(forge!.util.createBuffer(data.toString('binary')))

            return Buffer.from(cipher.output.data, 'binary')
        }

        return {
            encrypt: update,
            decrypt: update,
        }
    }

    createAesEcb(key: Buffer): IEncryptionScheme {
        const keyBuffer = key.toString('binary')

        return {
            encrypt(data: Buffer) {
                const cipher = forge!.cipher.createCipher('AES-ECB', keyBuffer)
                cipher.start({})
                // @ts-expect-error  wrong types
                cipher.mode.pad = cipher.mode.unpad = false
                cipher.update(forge!.util.createBuffer(data.toString('binary')))
                cipher.finish()

                return Buffer.from(cipher.output.data, 'binary')
            },
            decrypt(data: Buffer) {
                const cipher = forge!.cipher.createDecipher('AES-ECB', keyBuffer)
                cipher.start({})
                // @ts-expect-error  wrong types
                cipher.mode.pad = cipher.mode.unpad = false
                cipher.update(forge!.util.createBuffer(data.toString('binary')))
                cipher.finish()

                return Buffer.from(cipher.output.data, 'binary')
            },
        }
    }

    pbkdf2(password: Buffer, salt: Buffer, iterations: number, keylen = 64, algo = 'sha512'): MaybeAsync<Buffer> {
        return new Promise((resolve, reject) =>
            forge!.pkcs5.pbkdf2(
                password.toString('binary'),
                salt.toString('binary'),
                iterations,
                keylen,
                // eslint-disable-next-line
                (forge!.md as any)[algo].create(),
                (err: Error | null, buf: string) => (err !== null ? reject(err) : resolve(Buffer.from(buf, 'binary'))),
            ),
        )
    }

    sha1(data: Buffer): MaybeAsync<Buffer> {
        return Buffer.from(forge!.md.sha1.create().update(data.toString('binary')).digest().data, 'binary')
    }

    sha256(data: Buffer): MaybeAsync<Buffer> {
        return Buffer.from(forge!.md.sha256.create().update(data.toString('binary')).digest().data, 'binary')
    }

    hmacSha256(data: Buffer, key: Buffer): MaybeAsync<Buffer> {
        const hmac = forge!.hmac.create()
        hmac.start('sha256', key.toString('binary'))
        hmac.update(data.toString('binary'))

        return Buffer.from(hmac.digest().data, 'binary')
    }
}
