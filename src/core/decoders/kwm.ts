/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 *
 * KWM (Kuwo Music) decoder — pure TypeScript, no native deps.
 *
 * Algorithm: 32-byte circular XOR cipher.
 */

import { DecoderResult } from './types'
import { readUint32LE, detectAudioFormat } from './utils'

const MAGIC = new Uint8Array([0x79, 0x65, 0x65, 0x6c, 0x69, 0x6f, 0x6e, 0x2d, 0x6b, 0x75, 0x77, 0x6f])
const ROOT = new TextEncoder().encode('MoOtOiTvINGwd2E6n0E1i7L5t2IoOoNk')
const MASK_SIZE = 32
const AUDIO_OFFSET = 0x400
const SEED_OFFSET = 0x10
const MAGIC_LEN = 10

function buildMask(seed: number): Uint8Array {
  const decimal = seed.toString(10)
  const mask = new Uint8Array(MASK_SIZE)
  const len = Math.min(decimal.length, MASK_SIZE)
  for (let i = 0; i < len; i++) {
    mask[i] = decimal.charCodeAt(i)
  }
  for (let i = 0; i < MASK_SIZE; i++) {
    mask[i] ^= ROOT[i]
  }
  return mask
}

export function decryptBuffer(kwmBuf: Uint8Array): DecoderResult {
  if (kwmBuf.length < AUDIO_OFFSET) {
    throw new Error('KWM: file too small (' + kwmBuf.length + ' < ' + AUDIO_OFFSET + ')')
  }
  for (let i = 0; i < MAGIC_LEN; i++) {
    if (kwmBuf[i] !== MAGIC[i]) {
      throw new Error('KWM: bad magic, expected "yeelion-kuwo" at offset 0')
    }
  }

  const seed = readUint32LE(kwmBuf, SEED_OFFSET)
  const mask = buildMask(seed)

  const audio = new Uint8Array(kwmBuf.slice(AUDIO_OFFSET))
  for (let i = 0; i < audio.length; i++) {
    audio[i] ^= mask[i % MASK_SIZE]
  }

  const format = detectAudioFormat(audio)
  return { audio, format }
}

export { buildMask, MAGIC, ROOT, AUDIO_OFFSET, SEED_OFFSET }
