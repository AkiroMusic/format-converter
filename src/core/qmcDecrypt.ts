/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 */

/**
 * QMC v1 decoder (QQ Music, QMC0/QMC3/QMCflac/QMCogg etc.) — pure TS.
 *
 * Ported from OpenConverter reference implementation (Apache 2.0).
 *
 * QMC v1 uses a static 256-byte S-box to construct a 32768-byte mask,
 * then XORs the audio data with that mask. No key required.
 *
 * QMC v2 (MFLAC, MGG, BKC variants — needs ekey) is deferred to Phase 2.
 */

import { type DecoderResult, type DecoderModule, detectAudioFormat } from './types'

// =====================================================================
// QMC v1 Constants
// =====================================================================

const V1_OFFSET_BOUNDARY = 0x7fff

const EXT_MAP_V1: Record<string, string> = {
  '.qmc0': 'mp3',
  '.qmc3': 'mp3',
  '.qmcflac': 'flac',
  '.qmcogg': 'ogg',
  '.qmc1': 'mp3',
  '.qmc2': 'mp3',
  '.tkm': 'mp3',
}

// 256-byte static S-box
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

// 32768-byte mask constructed at module load
const V1_MASK = buildV1Mask()

function buildV1Mask(): Uint8Array {
  const mask = new Uint8Array(32768)
  for (let i = 0; i < 32768; i++) {
    mask[i] = QMC1_STATIC_BOX[(i * i + 27) & 0xff]
  }
  return mask
}

/**
 * XOR audio buffer with V1 mask.
 */
function applyMask(buf: Uint8Array, mask: Uint8Array): void {
  const len = buf.length
  const limit1 = Math.min(len, 32768)
  for (let i = 0; i < limit1; i++) {
    buf[i] ^= mask[i]
  }
  for (let i = 32768; i < len; i++) {
    buf[i] ^= mask[i % 32767]
  }
}

/**
 * Decrypt a QMC v1 buffer (no key needed).
 */
function decryptV1Buffer(qmcBuf: Uint8Array): Uint8Array {
  const out = new Uint8Array(qmcBuf)
  applyMask(out, V1_MASK)
  return out
}

/**
 * Detect embedded ekey in QMC v2 files (STag, QTag, raw ekey).
 * For v1 files, this returns null.
 * For v2 files without a key source, this throws a helpful error.
 */
function detectKey(buf: Uint8Array): { ekey: string; audioLen: number } | null {
  const len = buf.length

  // musicex marker — newer QQ Music client, no embedded key
  if (len >= 8) {
    const sliceEnd = buf.slice(len - 8)
    // Check "musicex\x00"
    let match = true
    const expected = [0x6D, 0x75, 0x73, 0x69, 0x63, 0x65, 0x78, 0x00] // "musicex\0"
    for (let i = 0; i < 8; i++) {
      if (sliceEnd[i] !== expected[i]) { match = false; break }
    }
    if (match) {
      throw new Error('This file was encrypted with a newer QQ Music client (musicex) without an embedded key. Please downgrade your client or provide a key database.')
    }
  }

  // STag at tail
  if (len >= 4) {
    const tail4 = String.fromCharCode(buf[len - 4], buf[len - 3], buf[len - 2], buf[len - 1])
    if (tail4 === 'STag') {
      throw new Error('This file contains an STag but no embedded key. Please downgrade your QQ Music client or provide a key database.')
    }
  }

  // STag at the head
  if (len >= 0x18) {
    let isSTag = true
    for (let i = 0; i < 4; i++) {
      if (buf[i] !== 0x53 + i * 0) break // "S", "T", "a", "g"
    }
    // Actually let's check properly:
    isSTag = buf[0] === 0x53 && buf[1] === 0x54 && buf[2] === 0x61 && buf[3] === 0x67 // "STag"
    if (isSTag) {
      const ekeyLen = (buf[0x14] | (buf[0x15] << 8) | (buf[0x16] << 16) | (buf[0x17] << 24)) >>> 0
      if (ekeyLen > 0 && ekeyLen < len - 0x18) {
        const ekeyChars: string[] = []
        for (let i = 0; i < ekeyLen; i++) {
          ekeyChars.push(String.fromCharCode(buf[0x18 + i]))
        }
        return { ekey: ekeyChars.join(''), audioLen: len - (0x18 + ekeyLen) }
      }
    }
  }

  // QTag at the tail
  if (len >= 4) {
    const tailQ = String.fromCharCode(buf[len - 4], buf[len - 3], buf[len - 2], buf[len - 1])
    if (tailQ === 'QTag') {
      const metaLen = ((buf[len - 8] << 24) | (buf[len - 7] << 16) | (buf[len - 6] << 8) | buf[len - 5]) >>> 0
      if (metaLen > 0 && metaLen < len - 8) {
        let rawMeta = ''
        for (let i = len - 8 - metaLen; i < len - 8; i++) {
          rawMeta += String.fromCharCode(buf[i])
        }
        const parts = rawMeta.split(',')
        if (parts.length > 0 && parts[0]) {
          return { ekey: parts[0], audioLen: len - 8 - metaLen }
        }
      }
    }
  }

  // Raw ekey at tail (length-prefixed)
  if (len >= 4) {
    const rawLen = (buf[len - 4] | (buf[len - 3] << 8) | (buf[len - 2] << 16) | (buf[len - 1] << 24)) >>> 0
    if (rawLen > 0 && rawLen < len - 4) {
      let rawMeta = ''
      for (let i = len - 4 - rawLen; i < len - 4; i++) {
        rawMeta += String.fromCharCode(buf[i])
      }
      return { ekey: rawMeta, audioLen: len - 4 - rawLen }
    }
  }

  return null
}

/**
 * Decode (parse + decrypt) a QMC v1 file from ArrayBuffer.
 */
async function parseQMC(
  arrayBuffer: ArrayBuffer,
  options?: { onProgress?: (progress: number) => void; onWarning?: (message: string) => void }
): Promise<DecoderResult> {
  const data = new Uint8Array(arrayBuffer)

  // Check for v2 key markers — if present, this is a v2 file that needs an ekey
  const detected = detectKey(data)
  if (detected) {
    throw new Error(
      'This appears to be a QMC v2 file (requires an ekey). ' +
      'Phase 2 QMC v2 support is not yet implemented. ' +
      'Found embedded ekey; if you see this error, the app needs the v2 decoder.'
    )
  }

  options?.onProgress?.(0.1)

  const audioData = decryptV1Buffer(data)

  options?.onProgress?.(0.8)

  const format = detectAudioFormat(audioData)

  options?.onProgress?.(1.0)

  return {
    audioData,
    format,
    metadata: null,
    image: null,
    imageMime: null,
    songName: 'Unknown',
    artist: 'Unknown',
    album: 'Unknown'
  }
}

export const qmcDecoder: DecoderModule = {
  name: 'QMC v1 Decoder',
  extensions: ['.qmc0', '.qmc3', '.qmcflac', '.qmcogg', '.qmc1', '.qmc2', '.tkm'],
  requiresKey: false,
  decode: parseQMC,
}

export const qmcExtensions = ['.qmc0', '.qmc3', '.qmcflac', '.qmcogg', '.qmc1', '.qmc2', '.tkm']
export { EXT_MAP_V1, applyMask, decryptV1Buffer, detectKey }
