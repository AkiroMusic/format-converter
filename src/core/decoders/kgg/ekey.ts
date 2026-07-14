/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 *
 * KGG ekey unwrapper.
 *
 * Two layers of indirection:
 *   1. If base64-decoded ekey starts with \"QQMusic EncV2,Key:\" (V2),
 *      strip prefix, run TWO rounds of Tencent TEA with hard-coded V2 keys,
 *      then base64-decode the result.
 *   2. The \"real\" ekey goes through V1 derivation: first 8 bytes as prefix,
 *      build per-ekey 16-byte TEA key by interleaving simpleKey with those
 *      8 bytes, then run custom CBC-like TEA on remaining ciphertext.
 */

const V2_PREFIX = new TextEncoder().encode('QQMusic EncV2,Key:')

const SIMPLE_KEY = new Uint8Array([
  0x69, 0x56, 0x46, 0x38, 0x2b, 0x20, 0x15, 0x0b,
])

const V2_KEY_1 = new Uint8Array([
  0x33, 0x38, 0x36, 0x5a, 0x4a, 0x59, 0x21, 0x40,
  0x23, 0x2a, 0x24, 0x25, 0x5e, 0x26, 0x29, 0x28,
])

const V2_KEY_2 = new Uint8Array([
  0x2a, 0x2a, 0x23, 0x21, 0x28, 0x23, 0x24, 0x25,
  0x26, 0x5e, 0x61, 0x31, 0x63, 0x5a, 0x2c, 0x54,
])

const TEA_DELTA = 0x9e3779b9
const TEA_CYCLES = 16

// =====================================================================
// Base64 decode (strict)
// =====================================================================
const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const B64_TABLE = new Int8Array(256).fill(-1)
for (let i = 0; i < B64_ALPHABET.length; i++) B64_TABLE[B64_ALPHABET.charCodeAt(i)] = i
B64_TABLE['='.charCodeAt(0)] = 0

function decodeBase64(encoded: string): Uint8Array {
  if (!encoded || encoded.length === 0 || encoded.length % 4 !== 0) {
    throw new Error('Base64 length is invalid')
  }
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0
  const outLen = (encoded.length / 4) * 3 - padding
  const out = new Uint8Array(outLen)
  let outIdx = 0
  for (let i = 0; i < encoded.length; i += 4) {
    const a = B64_TABLE[encoded.charCodeAt(i)]
    const b = B64_TABLE[encoded.charCodeAt(i + 1)]
    const c = encoded.charCodeAt(i + 2) === '='.charCodeAt(0) ? -1 : B64_TABLE[encoded.charCodeAt(i + 2)]
    const d = encoded.charCodeAt(i + 3) === '='.charCodeAt(0) ? -1 : B64_TABLE[encoded.charCodeAt(i + 3)]
    if (a < 0 || b < 0) throw new Error('Base64 has invalid characters')
    const bits = (a << 18) | (b << 12) | ((c | 0) < 0 ? 0 : c << 6) | ((d | 0) < 0 ? 0 : d)
    if (outIdx < outLen) out[outIdx++] = (bits >>> 16) & 0xff
    if (outIdx < outLen) out[outIdx++] = (bits >>> 8) & 0xff
    if (outIdx < outLen) out[outIdx++] = bits & 0xff
  }
  return out
}

// =====================================================================
// TEA block decrypt (big-endian)
// =====================================================================
function readUint32BE(data: Uint8Array, offset: number): number {
  return ((data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3]) >>> 0
}

function writeUint32BE(data: Uint8Array, offset: number, value: number): void {
  data[offset] = (value >>> 24) & 0xff
  data[offset + 1] = (value >>> 16) & 0xff
  data[offset + 2] = (value >>> 8) & 0xff
  data[offset + 3] = value & 0xff
}

function teaDecryptBlock(block: Uint8Array, key: Uint8Array): Uint8Array {
  const k0 = readUint32BE(key, 0)
  const k1 = readUint32BE(key, 4)
  const k2 = readUint32BE(key, 8)
  const k3 = readUint32BE(key, 12)
  let v0 = readUint32BE(block, 0) >>> 0
  let v1 = readUint32BE(block, 4) >>> 0
  let sum = (TEA_DELTA * TEA_CYCLES) >>> 0
  for (let i = 0; i < TEA_CYCLES; i++) {
    v1 = ((v1 - (((v0 << 4) + k2) ^ (v0 + sum) ^ ((v0 >>> 5) + k3))) >>> 0) >>> 0
    v0 = ((v0 - (((v1 << 4) + k0) ^ (v1 + sum) ^ ((v1 >>> 5) + k1))) >>> 0) >>> 0
    sum = (sum - TEA_DELTA) >>> 0
  }
  const out = new Uint8Array(8)
  writeUint32BE(out, 0, v0)
  writeUint32BE(out, 4, v1)
  return out
}

// =====================================================================
// Custom CBC-like chained TEA
// =====================================================================
function decryptTencentTea(input: Uint8Array, key: Uint8Array): Uint8Array {
  if (input.length < 16) throw new Error('Tencent TEA ciphertext is too short')
  if (input.length % 8 !== 0) throw new Error('Tencent TEA ciphertext is not block aligned')
  if (key.length !== 16) throw new Error('Tencent TEA key must be 16 bytes')

  let decrypted = teaDecryptBlock(input.subarray(0, 8), key)
  const padding = decrypted[0] & 0x07
  const outputLength = input.length - 1 - padding - 2 - 7
  if (outputLength < 0) throw new Error('Tencent TEA padding is invalid')

  let previousCipher = new Uint8Array(8)
  let currentCipher = new Uint8Array(input.subarray(0, 8))
  let inputOffset = 8
  let decryptedOffset = 1 + padding

  const decryptNextBlock = () => {
    if (inputOffset + 8 > input.length) throw new Error('Tencent TEA ciphertext is truncated')
    previousCipher = currentCipher
    currentCipher = new Uint8Array(input.subarray(inputOffset, inputOffset + 8))
    const mixed = new Uint8Array(8)
    for (let i = 0; i < 8; i++) mixed[i] = decrypted[i] ^ currentCipher[i]
    decrypted = teaDecryptBlock(mixed, key)
    inputOffset += 8
    decryptedOffset = 0
  }

  // Skip 2 "header" bytes after padding
  for (let i = 0; i < 2; i++) {
    if (decryptedOffset === 8) decryptNextBlock()
    decryptedOffset++
  }

  // Output XOR'd with previous cipher (CBC-like)
  const out = new Uint8Array(outputLength)
  for (let i = 0; i < outputLength; i++) {
    if (decryptedOffset === 8) decryptNextBlock()
    out[i] = decrypted[decryptedOffset] ^ previousCipher[decryptedOffset]
    decryptedOffset++
  }

  // Verify 7 zero bytes
  for (let i = 0; i < 7; i++) {
    if (decryptedOffset === 8) decryptNextBlock()
    if ((decrypted[decryptedOffset] ^ previousCipher[decryptedOffset]) !== 0) {
      throw new Error('Tencent TEA zero padding is invalid')
    }
    decryptedOffset++
  }

  return out
}

// =====================================================================
// V1 derivation
// =====================================================================
function deriveV1(raw: Uint8Array): Uint8Array {
  if (raw.length < 16) throw new Error('KGG ekey is too short')
  const teaKey = new Uint8Array(16)
  for (let i = 0; i < 8; i++) {
    teaKey[i * 2] = SIMPLE_KEY[i]
    teaKey[i * 2 + 1] = raw[i]
  }
  const suffix = decryptTencentTea(raw.subarray(8), teaKey)
  const result = new Uint8Array(8 + suffix.length)
  result.set(raw.subarray(0, 8), 0)
  result.set(suffix, 8)
  return result
}

// =====================================================================
// Top-level: unwrap a base64 ekey string
// =====================================================================
function unwrap(encoded: string): Uint8Array {
  let raw = decodeBase64(encoded)
  if (raw.length >= V2_PREFIX.length && buffersEqual(raw.subarray(0, V2_PREFIX.length), V2_PREFIX)) {
    raw = raw.subarray(V2_PREFIX.length)
    raw = decryptTencentTea(raw, V2_KEY_1)
    raw = decryptTencentTea(raw, V2_KEY_2)
    const inner = new TextDecoder().decode(raw)
    raw = decodeBase64(inner)
  }
  return deriveV1(raw)
}

function buffersEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

export {
  unwrap,
  deriveV1,
  decryptTencentTea,
  teaDecryptBlock,
  decodeBase64,
  V2_PREFIX,
  SIMPLE_KEY,
  V2_KEY_1,
  V2_KEY_2,
}
