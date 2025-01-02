/* eslint-disable style/max-len */
import type { ICryptoProvider } from './crypto/abstract.js'
import { u8 } from '@fuman/utils'

import { BigInteger } from '@modern-dev/jsbn'

/**
 * a < b
 */
export function lt(a: BigInteger, b: BigInteger): boolean {
    return a.compareTo(b) < 0
}

/**
 * a > b
 */
export function gt(a: BigInteger, b: BigInteger): boolean {
    return a.compareTo(b) > 0
}

/**
 * a <= b
 */
export function leq(a: BigInteger, b: BigInteger): boolean {
    return a.compareTo(b) <= 0
}

/**
 * a >= b
 */
export function geq(a: BigInteger, b: BigInteger): boolean {
    return a.compareTo(b) >= 0
}

/**
 * Helper function to quickly create a BigInteger from an int
 * @param n
 */
export function fromInt(n: number): BigInteger {
    const bi = new BigInteger(null)
    bi.fromInt(n)
    return bi
}

/**
 * Helper function to quickly create a BigInteger from a radix string
 */
export function fromRadix(n: string, radix: number): BigInteger {
    const bi = new BigInteger(null)
    bi.fromRadix(n, radix)
    return bi
}

/**
 * Compute the multiplicity of 2 in the prime factorization of n
 */
export function twoMultiplicity(n: BigInteger): BigInteger {
    if (n.equals(BigInteger.ZERO)) return fromInt(0)

    // we don't use the static values because we want to mutate it
    const m = fromInt(0)
    const pow = fromInt(1)

    while (true) {
        if (!n.and(pow).equals(BigInteger.ZERO)) return m
        // m = m + ONE
        m.addTo(BigInteger.ONE, m)
        // pow = pow << 1
        pow.lShiftTo(1, pow)
    }
}

export function fromBytes(buffer: Uint8Array, le = false): BigInteger {
    if (le) buffer = u8.toReversed(buffer)

    // empty
    const bn = new BigInteger(null)

    // yes you read that right
    // in the source code
    // when b is set to 256
    // it will loop through an array of numbers
    // it doesn't use any Array methods
    // therefore, TypedArrays should work fine
    bn.fromString(buffer as any, 256, false)

    return bn
}

/**
 * Convert a big integer to a buffer
 *
 * @param value  Value to convert
 * @param length  Length of the resulting buffer (by default it's computed automatically)
 * @param le  Whether to use little-endian encoding
 */
export function toBytes(value: BigInteger, length = 0, le = false): Uint8Array {
    const array = value.toByteArray(false)

    if (length !== 0 && array.length > length) {
        throw new Error('Value out of bounds')
    }

    if (length !== 0) {
        // padding
        while (array.length !== length) array.unshift(0)
    }

    if (le) array.reverse()

    const buffer = new Uint8Array(length || array.length)
    buffer.set(array, 0)

    return buffer
}

/**
 * Generate a cryptographically safe random big integer of the given size (in bytes)
 * @param size  Size in bytes
 */
export function randomBigInt(crypto: ICryptoProvider, size: number): BigInteger {
    return fromBytes(crypto.randomBytes(size))
}

/**
 * Generate a random big integer of the given size (in bits)
 * @param bits
 */
export function randomBigIntBits(crypto: ICryptoProvider, bits: number): BigInteger {
    const num = randomBigInt(crypto, Math.ceil(bits / 8))

    const _bitLength = num.bitLength()

    if (_bitLength > bits) {
        const toTrim = _bitLength - bits
        // num >>= BigInt(toTrim)
        // r = r >> n
        num.rShiftTo(toTrim, num)
    }

    return num
}

/**
 * Generate a random big integer in the range [min, max)
 *
 * @param max  Maximum value (exclusive)
 * @param min  Minimum value (inclusive)
 */
export function randomBigIntInRange(
    crypto: ICryptoProvider,
    max: BigInteger,
    min: BigInteger = fromInt(0),
): BigInteger {
    const interval = max.subtract(min)
    // if (interval < 0n) throw new Error('expected min < max')
    if (lt(interval, BigInteger.ZERO)) throw new Error('expected min < max')

    const byteSize = Math.ceil(interval.bitLength() / 8)

    const result = randomBigInt(crypto, byteSize)

    while (gt(result, interval)) {
        // result = result - interval
        result.subTo(interval, result)
    }

    return min.add(result)
}
