/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 */

/**
 * KWM decoder (Kuwo Music, 酷我) — pure JS/TS, no native deps.
 *
 * Algorithm: 32-byte circular XOR cipher. Ported from the OpenConverter
 * reference implementation (Apache 2.0).
 *
 * File layout:
 *   0x000..0x00A  Magic "yeelion-kuwo" (10 bytes)
 *   0x00A..0x010  6 bytes padding
 *   0x010..0x014  4-byte uint32 LE seed
 *   0x014..0x400  Reserved / padding
 *   0x400..end   Encrypted audio (XOR with derived 32-byte mask)
 *
 * Decryption:
 *   1. seed_decimal = uint32_to_decimal_string(seed)
 *   2. mask[0..len(seed_decimal)] = ASCII bytes of seed_decimal
 *   3. mask[len..32] = 0
 *   4. for i in 0..32: mask[i] ^= ROOT[i]
 *   5. for i in 0..audio_len: audio[i] ^= mask[(i + audio_offset) % 32]
 */

import { type DecoderResult, type AudioFormat, type DecoderModule, detectAudioFormat, readUint32LE } from './types'

const MAGIC = new Uint8Array([0x79, 0x65, 0x65, 0x6C, 0x69, 0x6F, 0x6E, 0x2D, 0x6B, 0x75, 0x77, 0x6F]) // "yeelion-kuwo"
const MAGIC_LEN = 10
const ROOT_STR = 'MoOtOiTvINGwd2E6n0E1i7L5t2IoOoNk'
const MASK_SIZE = 32
const AUDIO_OFFSET = 0x400 // 1024
const SEED_OFFSET = 0x10

/**
 * Build the 32-byte XOR mask from a seed uint32.
 */
function buildMask(seed: number): Uint8Array {
  const decimal = seed.toString(10)
  const mask = new Uint8Array(MASK_SIZE)
  const len = Math.min(decimal.length, MASK_SIZE)
  for (let i = 0; i < len; i++) {
    mask[i] = decimal.charCodeAt(i)
  }
  // mask[len..32] is already 0 from Uint8Array
  for (let i = 0; i < MASK_SIZE; i++) {
    mask[i] ^= ROOT_STR.charCodeAt(i)
  }
  return mask
}

/**
 * Decrypt a KWM buffer. Returns the decrypted audio bytes.
 */
export function decryptKWM(encryptedData: Uint8Array): Uint8Array {
  if (encryptedData.length < AUDIO_OFFSET) {
    throw new Error(`KWM: file too small (${encryptedData.length} < ${AUDIO_OFFSET})`)
  }

  // Check magic
  for (let i = 0; i < MAGIC_LEN; i++) {
    if (encryptedData[i] !== MAGIC[i]) {
      throw new Error('KWM: bad magic, expected "yeelion-kuwo" at offset 0')
    }
  }

  const seed = readUint32LE(encryptedData, SEED_OFFSET)
  const mask = buildMask(seed)

  const audio = new Uint8Array(encryptedData.length - AUDIO_OFFSET)
  for (let i = 0; i < audio.length; i++) {
    audio[i] = encryptedData[AUDIO_OFFSET + i] ^ mask[i % MASK_SIZE]
  }

  return audio
}

/**
 * Parse and decrypt a KWM file from ArrayBuffer.
 * Returns the decrypted audio data with detected format.
 */
export async function parseKWM(
  arrayBuffer: ArrayBuffer,
  options?: { onProgress?: (progress: number) => void; onWarning?: (message: string) => void }
): Promise<DecoderResult> {
  const data = new Uint8Array(arrayBuffer)

  options?.onProgress?.(0.1)

  const audioData = decryptKWM(data)

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

export const kwmDecoder: DecoderModule = {
  name: 'KWM Decoder',
  extensions: ['.kwm'],
  requiresKey: false,
  decode: parseKWM,
}

export const kwmExtensions = ['.kwm']
