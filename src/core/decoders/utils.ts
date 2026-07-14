/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 *
 * Shared utilities for decoders.
 */

/**
 * Read a 32-bit unsigned little-endian integer from a Uint8Array.
 */
export function readUint32LE(data: Uint8Array, offset: number): number {
  return (
    (data[offset] |
      (data[offset + 1] << 8) |
      (data[offset + 2] << 16) |
      (data[offset + 3] << 24)) >>> 0
  )
}

/**
 * Detect audio format by sniffing the header bytes.
 * Returns extension string like "mp3", "flac", "ogg", "wav", "m4a".
 */
export function detectAudioFormat(data: Uint8Array): string {
  if (data.length < 4) return 'mp3'
  // ID3 (MP3 with metadata)
  if (data[0] === 0x49 && data[1] === 0x44 && data[2] === 0x33) return 'mp3'
  // fLaC
  if (data[0] === 0x66 && data[1] === 0x4c && data[2] === 0x61 && data[3] === 0x43) return 'flac'
  // OggS
  if (data[0] === 0x4f && data[1] === 0x67 && data[2] === 0x67 && data[3] === 0x53) return 'ogg'
  // RIFF (WAV)
  if (data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46) return 'wav'
  // MP3 frame sync (0xFF + 3 bits of ID)
  if (data[0] === 0xff && (data[1] & 0xe0) === 0xe0) return 'mp3'
  // ftyp at offset 4 (M4A/MP4)
  if (data.length >= 8 && data[4] === 0x66 && data[5] === 0x74 && data[6] === 0x79 && data[7] === 0x70) return 'm4a'
  return 'mp3'
}
