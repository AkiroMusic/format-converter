/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 *
 * QMC (QQ Music) decoder — QMCv1 (static mask) + QMCv2 (TEA + RC4/Map cipher).
 */

import { DecoderResult, DecoderOptions } from './types'
import { readUint32LE, detectAudioFormat } from './utils'

// =====================================================================
// Constants
// =====================================================================
const V1_OFFSET_BOUNDARY = 0x7fff
const V2_KEY_SIZE = 128
const KEY_COMPRESS_INDEX_OFFSET = 71214

const EXT_MAP_V1: Record<string, string> = {
  '.qmc0': 'mp3', '.qmc3': 'mp3', '.qmcflac': 'flac', '.qmcogg': 'ogg',
}

const SEED_MAP: number[][] = [
  [0x4a, 0xd6, 0xca, 0x90, 0x67, 0xf7, 0x52], [0x5e, 0x95, 0x23, 0x9f, 0x13, 0x11, 0x7e],
  [0x47, 0x74, 0x3d, 0x90, 0xaa, 0x3f, 0x51], [0xc6, 0x09, 0xd5, 0x9f, 0xfa, 0x66, 0xf9],
  [0xf3, 0xd6, 0xa1, 0x90, 0xa0, 0xf7, 0xf0], [0x1d, 0x95, 0xde, 0x9f, 0x84, 0x11, 0xf4],
  [0x0e, 0x74, 0xbb, 0x90, 0xbc, 0x3f, 0x92], [0x00, 0x09, 0x5b, 0x9f, 0x62, 0x66, 0xa1],
]

// =====================================================================
// QMCv1: Static Box Mask
// =====================================================================

const QMC1_STATIC_BOX = new Uint8Array([
  0x77, 0x48, 0x32, 0x73, 0xDE, 0xF2, 0xC0, 0xC8, 0x95, 0xEC, 0x30, 0xB2, 0x51, 0xC3, 0xE1, 0xA0,
  0x9E, 0xE6, 0x9D, 0xCF, 0xFA, 0x7F, 0x14, 0xD1, 0xCE, 0xB8, 0xDC, 0xC3, 0x4A, 0x67, 0x93, 0xD6,
  0x28, 0xC2, 0x91, 0x70, 0xCA, 0x8D, 0xA2, 0xA4, 0xF0, 0x08, 0x61, 0x90, 0x7E, 0x6F, 0xA2, 0xE0,
  0xEB, 0xAE, 0x3E, 0xB6, 0x67, 0xC7, 0x92, 0xF4, 0x91, 0xB5, 0xF6, 0x6C, 0x5E, 0x84, 0x40, 0xF7,
  0xF3, 0x1B, 0x02, 0x7F, 0xD5, 0xAB, 0x41, 0x89, 0x28, 0xF4, 0x25, 0xCC, 0x52, 0x11, 0xAD, 0x43,
  0x68, 0xA6, 0x41, 0x8B, 0x84, 0xB5, 0xFF, 0x2C, 0x92, 0x4A, 0x26, 0xD8, 0x47, 0x6A, 0x7C, 0x95,
  0x61, 0xCC, 0xE6, 0xCB, 0xBB, 0x3F, 0x47, 0x58, 0x89, 0x75, 0xC3, 0x75, 0xA1, 0xD9, 0xAF, 0xCC,
  0x08, 0x73, 0x17, 0xDC, 0xAA, 0x9A, 0xA2, 0x16, 0x41, 0xD8, 0xA2, 0x06, 0xC6, 0x8B, 0xFC, 0x66,
  0x34, 0x9F, 0xCF, 0x18, 0x23, 0xA0, 0x0A, 0x74, 0xE7, 0x2B, 0x27, 0x70, 0x92, 0xE9, 0xAF, 0x37,
  0xE6, 0x8C, 0xA7, 0xBC, 0x62, 0x65, 0x9C, 0xC2, 0x08, 0xC9, 0x88, 0xB3, 0xF3, 0x43, 0xAC, 0x74,
  0x2C, 0x0F, 0xD4, 0xAF, 0xA1, 0xC3, 0x01, 0x64, 0x95, 0x4E, 0x48, 0x9F, 0xF4, 0x35, 0x78, 0x95,
  0x7A, 0x39, 0xD6, 0x6A, 0xA0, 0x6D, 0x40, 0xE8, 0x4F, 0xA8, 0xEF, 0x11, 0x1D, 0xF3, 0x1B, 0x3F,
  0x3F, 0x07, 0xDD, 0x6F, 0x5B, 0x19, 0x30, 0x19, 0xFB, 0xEF, 0x0E, 0x37, 0xF0, 0x0E, 0xCD, 0x16,
  0x49, 0xFE, 0x53, 0x47, 0x13, 0x1A, 0xBD, 0xA4, 0xF1, 0x40, 0x19, 0x60, 0x0E, 0xED, 0x68, 0x09,
  0x06, 0x5F, 0x4D, 0xCF, 0x3D, 0x1A, 0xFE, 0x20, 0x77, 0xE4, 0xD9, 0xDA, 0xF9, 0xA4, 0x2B, 0x76,
  0x1C, 0x71, 0xDB, 0x00, 0xBC, 0xFD, 0x0C, 0x6C, 0xA5, 0x47, 0xF7, 0xF6, 0x00, 0x79, 0x4A, 0x11,
])

const V1_MASK = new Uint8Array(32768)
for (let i = 0; i < 32768; i++) {
  V1_MASK[i] = QMC1_STATIC_BOX[(i * i + 27) & 0xff]
}

class QmcSeed {
  x = -1
  y = 8
  dx = 1
  index = -1

  nextMask(): number {
    let ret: number
    this.index++
    if (this.x < 0) { this.dx = 1; this.y = (8 - this.y) % 8; ret = 0xc3 }
    else if (this.x > 6) { this.dx = -1; this.y = 7 - this.y; ret = 0xd8 }
    else { ret = SEED_MAP[this.y][this.x] }
    this.x += this.dx
    if (this.index === 0x8000 || (this.index > 0x8000 && (this.index + 1) % 0x8000 === 0)) return this.nextMask()
    return ret
  }
}

function shiftMix(byte: number, shift: number): number {
  shift &= 7
  if (shift === 0) return byte
  return ((byte << shift) | (byte >>> shift)) & 0xff
}

function keyCompress(ekey: Uint8Array): Uint8Array {
  if (ekey.length === 0) throw new Error('QMCv2: ekey is empty')
  const n = ekey.length
  const out = new Uint8Array(V2_KEY_SIZE)
  for (let i = 0; i < V2_KEY_SIZE; i++) {
    const idx = (i * i + KEY_COMPRESS_INDEX_OFFSET) % n
    const shift = (idx + 4) % 8
    out[i] = shiftMix(ekey[idx], shift)
  }
  return out
}

// =====================================================================
// Tencent TEA Cipher
// =====================================================================

class TeaCipher {
  static delta = 0x9e3779b9 >>> 0
  k0: number
  k1: number
  k2: number
  k3: number
  rounds: number

  constructor(key: Uint8Array, rounds = 64) {
    if (key.length !== 16) throw new Error('incorrect key size')
    if ((rounds & 1) !== 0) throw new Error('odd number of rounds')
    this.k0 = readUint32LE(key, 0)
    this.k1 = readUint32LE(key, 4)
    this.k2 = readUint32LE(key, 8)
    this.k3 = readUint32LE(key, 12)
    this.rounds = rounds
  }

  decryptBlock(dst: Uint8Array, dstOffset: number, src: Uint8Array, srcOffset: number): void {
    let v0 = readUint32LE(src, srcOffset) >>> 0
    let v1 = readUint32LE(src, srcOffset + 4) >>> 0
    let sum = (TeaCipher.delta * this.rounds / 2) >>> 0
    for (let i = 0; i < this.rounds / 2; i++) {
      v1 = ((v1 - (((v0 << 4) + this.k2) ^ (v0 + sum) ^ ((v0 >>> 5) + this.k3))) >>> 0) >>> 0
      v0 = ((v0 - (((v1 << 4) + this.k0) ^ (v1 + sum) ^ ((v1 >>> 5) + this.k1))) >>> 0) >>> 0
      sum = (sum - TeaCipher.delta) >>> 0
    }
    dst[dstOffset] = v0 & 0xff
    dst[dstOffset + 1] = (v0 >>> 8) & 0xff
    dst[dstOffset + 2] = (v0 >>> 16) & 0xff
    dst[dstOffset + 3] = (v0 >>> 24) & 0xff
    dst[dstOffset + 4] = v1 & 0xff
    dst[dstOffset + 5] = (v1 >>> 8) & 0xff
    dst[dstOffset + 6] = (v1 >>> 16) & 0xff
    dst[dstOffset + 7] = (v1 >>> 24) & 0xff
  }
}

function decryptTencentTea(inBuf: Uint8Array, key: Uint8Array): Uint8Array {
  if (inBuf.length % 8 !== 0) throw new Error('inBuf size not a multiple of the block size')
  if (inBuf.length < 16) throw new Error('inBuf size too small')
  const blk = new TeaCipher(key, 32)

  const tmpBuf = new Uint8Array(8)
  blk.decryptBlock(tmpBuf, 0, inBuf, 0)

  const nPadLen = tmpBuf[0] & 0x7
  const SALT_LEN = 2
  const ZERO_LEN = 7
  const outLen = inBuf.length - 1 - nPadLen - SALT_LEN - ZERO_LEN
  if (outLen < 0) throw new Error('invalid tea payload length')
  const outBuf = new Uint8Array(outLen)

  let ivPrev = new Uint8Array(8)
  let ivCur = inBuf.slice(0, 8)
  let inBufPos = 8
  let tmpIdx = 1 + nPadLen

  const cryptBlock = () => {
    ivPrev.set(ivCur)
    ivCur = inBuf.slice(inBufPos, inBufPos + 8)
    for (let j = 0; j < 8; j++) tmpBuf[j] ^= ivCur[j]
    blk.decryptBlock(tmpBuf, 0, tmpBuf, 0)
    inBufPos += 8
    tmpIdx = 0
  }

  for (let i = 1; i <= SALT_LEN;) {
    if (tmpIdx < 8) { tmpIdx++; i++ } else { cryptBlock() }
  }

  let outBufPos = 0
  while (outBufPos < outLen) {
    if (tmpIdx < 8) {
      outBuf[outBufPos++] = tmpBuf[tmpIdx] ^ ivPrev[tmpIdx]
      tmpIdx++
    } else {
      cryptBlock()
    }
  }

  for (let i = 1; i <= ZERO_LEN; i++) {
    if (tmpIdx >= 8) cryptBlock()
    if (tmpBuf[tmpIdx] !== ivPrev[tmpIdx]) throw new Error('zero check failed')
    tmpIdx++
  }
  return outBuf
}

// =====================================================================
// QMCv2 Key Derivation
// =====================================================================

const MIX_KEY_1 = new Uint8Array([0x33, 0x38, 0x36, 0x5A, 0x4A, 0x59, 0x21, 0x40, 0x23, 0x2A, 0x24, 0x25, 0x5E, 0x26, 0x29, 0x28])
const MIX_KEY_2 = new Uint8Array([0x2A, 0x2A, 0x23, 0x21, 0x28, 0x23, 0x24, 0x25, 0x26, 0x5E, 0x61, 0x31, 0x63, 0x5A, 0x2C, 0x54])

function decryptV2Key(keyBuf: Uint8Array): Uint8Array {
  const prefix = new TextEncoder().encode('QQMusic EncV2,Key:')
  if (keyBuf.length >= prefix.length && buffersEqual(keyBuf.slice(0, prefix.length), prefix)) {
    let out = decryptTencentTea(keyBuf.slice(prefix.length), MIX_KEY_1)
    out = decryptTencentTea(out, MIX_KEY_2)
    const keyStr = new TextDecoder().decode(out)
    const keyDec = base64ToBytes(keyStr)
    if (keyDec.length < 16) throw new Error('EncV2 key decode failed')
    return keyDec
  }
  return keyBuf
}

function simpleMakeKey(salt: number, length: number): Uint8Array {
  const keyBuf = new Uint8Array(length)
  for (let i = 0; i < length; i++) {
    const tmp = Math.tan(salt + i * 0.1)
    keyBuf[i] = (Math.abs(tmp) * 100.0) & 0xff
  }
  return keyBuf
}

function qmcDeriveKey(b64String: string): Uint8Array {
  let rawDec = base64ToBytes(b64String)
  if (rawDec.length < 16) return rawDec
  const originalRawDec = new Uint8Array(rawDec)
  try {
    rawDec = decryptV2Key(rawDec)

    const simpleKey = simpleMakeKey(106, 8)
    const teaKey = new Uint8Array(16)
    for (let i = 0; i < 8; i++) {
      teaKey[i << 1] = simpleKey[i]
      teaKey[(i << 1) + 1] = rawDec[i]
    }
    const sub = decryptTencentTea(rawDec.slice(8), teaKey)
    const finalKey = new Uint8Array(8 + sub.length)
    finalKey.set(rawDec.slice(0, 8), 0)
    finalKey.set(sub, 8)
    return finalKey
  } catch {
    return originalRawDec
  }
}

// =====================================================================
// QMC2 Cipher Implementations
// =====================================================================

function getMapMask(derivedKey: Uint8Array): Uint8Array {
  const wkey = keyCompress(derivedKey)
  const mask = new Uint8Array(32768)
  for (let i = 0; i < 32768; i++) {
    mask[i] = wkey[i % 128]
  }
  return mask
}

class QmcRC4Cipher {
  key: Uint8Array
  N: number
  S: Uint8Array
  hash: number

  constructor(key: Uint8Array) {
    this.key = key
    this.N = key.length
    this.S = new Uint8Array(this.N)
    for (let i = 0; i < this.N; i++) this.S[i] = i & 0xff
    let j = 0
    for (let i = 0; i < this.N; i++) {
      j = (this.S[i] + j + this.key[i % this.N]) % this.N
      const tmp = this.S[i]; this.S[i] = this.S[j]; this.S[j] = tmp
    }
    this.hash = 1
    for (let i = 0; i < this.N; i++) {
      const value = this.key[i]
      if (!value) continue
      const nextHash = (this.hash * value) >>> 0
      if (nextHash === 0 || nextHash <= this.hash) break
      this.hash = nextHash
    }
  }

  getSegmentKey(id: number): number {
    const seed = this.key[id % this.N]
    const idx = Math.floor((this.hash / ((id + 1) * seed)) * 100.0)
    return idx % this.N
  }

  decrypt(buf: Uint8Array, offset: number): void {
    const SEGMENT_SIZE = 5120
    let toProcess = buf.length
    let processed = 0

    const postProcess = (len: number): boolean => {
      toProcess -= len; processed += len; offset += len
      return toProcess === 0
    }

    if (offset < 128) {
      const len = Math.min(buf.length, 128 - offset)
      for (let i = 0; i < len; i++) {
        buf[processed + i] ^= this.key[this.getSegmentKey(offset + i)]
      }
      if (postProcess(len)) return
    }

    const encSegment = (subBuf: Uint8Array, off: number) => {
      const S = new Uint8Array(this.S)
      const skipLen = (off % SEGMENT_SIZE) + this.getSegmentKey(Math.floor(off / SEGMENT_SIZE))
      let j = 0, k = 0
      for (let i = -skipLen; i < subBuf.length; i++) {
        j = (j + 1) % this.N
        k = (S[j] + k) % this.N
        const tmp = S[j]; S[j] = S[k]; S[k] = tmp
        if (i >= 0) subBuf[i] ^= S[(S[j] + S[k]) % this.N]
      }
    }

    if (offset % SEGMENT_SIZE !== 0) {
      const len = Math.min(SEGMENT_SIZE - (offset % SEGMENT_SIZE), toProcess)
      encSegment(buf.subarray(processed, processed + len), offset)
      if (postProcess(len)) return
    }

    while (toProcess > SEGMENT_SIZE) {
      encSegment(buf.subarray(processed, processed + SEGMENT_SIZE), offset)
      postProcess(SEGMENT_SIZE)
    }
    if (toProcess > 0) encSegment(buf.subarray(processed), offset)
  }
}

// =====================================================================
// Ekey Detection
// =====================================================================

interface KeyInfo {
  ekey: string
  audioLen: number
}

function detectKey(buf: Uint8Array): KeyInfo | null {
  const len = buf.length

  // STag at the head
  if (len >= 0x18 && buf[0] === 0x53 && buf[1] === 0x54 && buf[2] === 0x61 && buf[3] === 0x67) {
    const ekeyLen = readUint32LE(buf, 0x14)
    if (ekeyLen > 0 && ekeyLen < len - 0x18) {
      const ekeyBuf = buf.slice(0x18, 0x18 + ekeyLen)
      return { ekey: new TextDecoder().decode(ekeyBuf), audioLen: len - (0x18 + ekeyLen) }
    }
  }

  // QTag at the tail
  if (len >= 4 && buf[len - 4] === 0x51 && buf[len - 3] === 0x54 && buf[len - 2] === 0x61 && buf[len - 1] === 0x67) {
    const metaLen = readUint32BE(buf, len - 8)
    if (metaLen > 0 && metaLen < len - 8) {
      const rawMeta = new TextDecoder().decode(buf.slice(len - 8 - metaLen, len - 8))
      const parts = rawMeta.split(',')
      if (parts.length > 0 && parts[0]) return { ekey: parts[0], audioLen: len - 8 - metaLen }
    }
  }

  // Raw ekey size at tail
  if (len >= 4) {
    const rawLen = readUint32LE(buf, len - 4)
    if (rawLen > 0 && rawLen < len - 4) {
      const rawMeta = new TextDecoder().decode(buf.slice(len - 4 - rawLen, len - 4))
      return { ekey: rawMeta, audioLen: len - 4 - rawLen }
    }
  }

  return null
}

// =====================================================================
// Decryption
// =====================================================================

function applyMask(buf: Uint8Array, mask: Uint8Array): void {
  const len = buf.length
  const limit1 = Math.min(len, 32768)
  for (let i = 0; i < limit1; i++) buf[i] ^= mask[i]
  for (let i = 32768; i < len; i++) buf[i] ^= mask[i % 32767]
}

function decryptV1Buffer(qmcBuf: Uint8Array): Uint8Array {
  const out = new Uint8Array(qmcBuf)
  applyMask(out, V1_MASK)
  return out
}

function decryptV2Buffer(qmcBuf: Uint8Array, ekeyB64: string): Uint8Array {
  if (!ekeyB64) throw new Error('QMCv2 requires an ekey string')
  const derivedKey = qmcDeriveKey(ekeyB64)
  const out = new Uint8Array(qmcBuf)

  if (derivedKey.length > 300) {
    const rc4 = new QmcRC4Cipher(derivedKey)
    rc4.decrypt(out, 0)
  } else {
    const mask = getMapMask(derivedKey)
    applyMask(out, mask)
  }
  return out
}

// =====================================================================
// Public API
// =====================================================================

/**
 * Decrypt a QMC buffer (v1 or v2).
 * For v2, the ekey must be provided via options.ekey.
 */
export function decryptBuffer(qmcBuf: Uint8Array, options?: DecoderOptions): DecoderResult {
  // Try v2 first (if ekey provided), fall back to v1
  if (options?.ekey) {
    const detected = detectKey(qmcBuf)
    let audio: Uint8Array
    if (detected) {
      const cipherText = qmcBuf.slice(0, detected.audioLen)
      audio = decryptV2Buffer(cipherText, detected.ekey)
    } else {
      audio = decryptV2Buffer(qmcBuf, options.ekey)
    }
    const format = detectAudioFormat(audio)
    return { audio, format }
  }

  // QMCv1 — static mask
  const audio = decryptV1Buffer(qmcBuf)
  const format = detectAudioFormat(audio)
  return { audio, format }
}

/**
 * Detect whether a QMC file is v1 (no ekey needed) or v2 (ekey required).
 */
export function detectVariant(qmcBuf: Uint8Array): 'v1' | 'v2' {
  const key = detectKey(qmcBuf)
  return key ? 'v2' : 'v1'
}

// =====================================================================
// Utilities
// =====================================================================

function readUint32BE(data: Uint8Array, offset: number): number {
  return (
    ((data[offset] << 24) |
      (data[offset + 1] << 16) |
      (data[offset + 2] << 8) |
      data[offset + 3]) >>> 0
  )
}

function buffersEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

function base64ToBytes(b64: string): Uint8Array {
  const binaryStr = atob(b64)
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
  return bytes
}

export {
  decryptV1Buffer,
  decryptV2Buffer,
  detectKey,
  QmcSeed,
  SEED_MAP,
  EXT_MAP_V1,
  keyCompress,
  shiftMix,
  V1_OFFSET_BOUNDARY,
  V2_KEY_SIZE,
  KEY_COMPRESS_INDEX_OFFSET,
}
