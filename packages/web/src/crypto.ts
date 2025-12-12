import type { MaybePromise } from '@mtcute/core'

import type { AsmCryptoProvider } from './asmjs/crypto.js'
import type { IAesCtr, ICryptoProvider, IEncryptionScheme } from './utils.js'
import type { WasmCryptoProvider } from './wasm/crypto.js'

// TODO: double check if this breaks

export class WebCryptoProvider implements ICryptoProvider {
    instance!: AsmCryptoProvider | WasmCryptoProvider

    async initialize(): Promise<void> {
        // eslint-disable-next-line eqeqeq
        const isKai3 = import.meta.env.KAIOS == 3

        if (isKai3) {
            const m = await import('./wasm/crypto.js')
            this.instance = new m.WasmCryptoProvider()
        } else {
            const m = await import('./asmjs/crypto.js')
            this.instance = new m.AsmCryptoProvider()
        }

        await this.instance.initialize()
    }

    pbkdf2(
        password: Uint8Array,
        salt: Uint8Array,
        iterations: number,
        keylen?: number,
        algo?: string,
    ): MaybePromise<Uint8Array> {
        return this.instance.pbkdf2(password, salt, iterations, keylen, algo)
    }

    createAesCtr(key: Uint8Array, iv: Uint8Array): IAesCtr {
        return this.instance.createAesCtr(key, iv)
    }

    createAesIge(key: Uint8Array, iv: Uint8Array): IEncryptionScheme {
        return this.instance.createAesIge(key, iv)
    }

    factorizePQ(pq: Uint8Array): MaybePromise<[Uint8Array, Uint8Array]> {
        return this.instance.factorizePQ(pq)
    }

    gzip(data: Uint8Array, maxSize: number): Uint8Array | null {
        return this.instance.gzip(data, maxSize)
    }

    gunzip(data: Uint8Array): Uint8Array {
        return this.instance.gunzip(data)
    }

    randomFill(buf: Uint8Array): void {
        return this.instance.randomFill(buf)
    }
  }

    randomBytes(size: number): Uint8Array {
        return this.instance.randomBytes(size)
    }
  }

    sha1(data: Uint8Array): Uint8Array {
        return this.instance.sha1(data)
    }

    sha256(data: Uint8Array): Uint8Array {
        return this.instance.sha256(data)
    }

    hmacSha256(data: Uint8Array, key: Uint8Array): MaybePromise<Uint8Array> {
        return this.instance.hmacSha256(data, key)
    }
    this.crypto = crypto
    this._wasmInput = params?.wasmInput
  }

  async initialize(): Promise<void> {
    initSync(await loadWasmBinary(this._wasmInput))
  }

  async pbkdf2(
    password: Uint8Array,
    salt: Uint8Array,
    iterations: number,
    keylen?: number | undefined,
    algo?: string | undefined,
  ): Promise<Uint8Array> {
    const keyMaterial = await this.crypto.subtle.importKey('raw', password as Uint8Array<ArrayBuffer>, 'PBKDF2', false, ['deriveBits'])

    return this.crypto.subtle
      .deriveBits(
        {
          name: 'PBKDF2',
          salt: salt as Uint8Array<ArrayBuffer>,
          iterations,
          hash: algo ? ALGO_TO_SUBTLE[algo] : 'SHA-512',
        },
        keyMaterial,
        (keylen || 64) * 8,
      )
      .then(result => new Uint8Array(result))
  }

  async hmacSha256(data: Uint8Array, key: Uint8Array): Promise<Uint8Array> {
    const keyMaterial = await this.crypto.subtle.importKey(
      'raw',
      key as Uint8Array<ArrayBuffer>,
      { name: 'HMAC', hash: { name: 'SHA-256' } },
      false,
      ['sign'],
    )

    const res = await this.crypto.subtle.sign({ name: 'HMAC' }, keyMaterial, data as Uint8Array<ArrayBuffer>)

    return new Uint8Array(res)
  }

  randomFill(buf: Uint8Array): void {
    this.crypto.getRandomValues(buf)
  }
}
