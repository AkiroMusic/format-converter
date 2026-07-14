/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 */

/**
 * Shared type definitions for the format converter decoders.
 * All decoders follow the same interface: they take an ArrayBuffer
 * and return a DecoderResult with the decrypted audio data and metadata.
 */

export interface AudioFormat {
  ext: string
  mime: string
}

export interface DecoderResult {
  audioData: Uint8Array
  format: AudioFormat
  metadata: Record<string, unknown> | null
  image: Uint8Array | null
  imageMime: string | null
  songName: string
  artist: string
  album: string
}

export interface DecoderOptions {
  onProgress?: (progress: number) => void
  onWarning?: (message: string) => void
  /** For QMCv2 — base64 ekey from QQ Music DB */
  ekey?: string
  /** For KGG v5 — path to kgg.key file or KGMusicV3.db */
  keyPath?: string
}

export interface DecoderModule {
  /** Human-readable decoder name */
  name: string
  /** File extensions this decoder handles (with leading dot) */
  extensions: string[]
  /** Whether this decoder requires an external key to function */
  requiresKey: boolean
  /** Key source description for UI hints */
  keySource?: string
  /** Main decode function */
  decode: (arrayBuffer: ArrayBuffer, options?: DecoderOptions) => Promise<DecoderResult>
  /** Synchronous format detection after decode (fast sniff) */
  detectAudioFormat?: (data: Uint8Array) => AudioFormat
}

/**
 * Detect audio container format from magic bytes.
 * Works for MP3, FLAC, OGG, WAV, M4A.
 */
export function detectAudioFormat(data: Uint8Array): AudioFormat {
  if (data.length < 4) return { ext: 'mp3', mime: 'audio/mpeg' }
  // ID3 (MP3 with metadata header)
  if (data[0] === 0x49 && data[1] === 0x44 && data[2] === 0x33) return { ext: 'mp3', mime: 'audio/mpeg' }
  // MPEG frame sync
  if (data[0] === 0xff && (data[1] & 0xe0) === 0xe0) return { ext: 'mp3', mime: 'audio/mpeg' }
  // fLaC (FLAC)
  if (data[0] === 0x66 && data[1] === 0x4c && data[2] === 0x61 && data[3] === 0x43) return { ext: 'flac', mime: 'audio/flac' }
  // OggS (OGG)
  if (data[0] === 0x4f && data[1] === 0x67 && data[2] === 0x67 && data[3] === 0x53) return { ext: 'ogg', mime: 'audio/ogg' }
  // RIFF (WAV)
  if (data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46) return { ext: 'wav', mime: 'audio/wav' }
  // ftyp at offset 4 (M4A/MP4)
  if (data.length >= 8 && data[4] === 0x66 && data[5] === 0x74 && data[6] === 0x79 && data[7] === 0x70) {
    if (data[8] === 0x4d && data[9] === 0x34 && data[10] === 0x41) return { ext: 'm4a', mime: 'audio/mp4' }
    return { ext: 'mp4', mime: 'audio/mp4' }
  }
  // Default fallback
  return { ext: 'mp3', mime: 'audio/mpeg' }
}

/**
 * Read a little-endian Uint32 from a Uint8Array.
 */
export function readUint32LE(data: Uint8Array, offset: number): number {
  return (data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24)) >>> 0
}

/**
 * Format extension metadata for UI display.
 */
export interface FormatMetadata {
  ext: string
  label: string
  platform: string
  requiresKey: boolean
  keySource?: string
}
