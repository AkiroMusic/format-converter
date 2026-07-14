/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 *
 * Shared types for all decoders.
 */

/** Result of decrypting an encrypted audio file. */
export interface DecoderResult {
  /** Decrypted audio bytes */
  audio: Uint8Array
  /** Detected format extension (e.g. "mp3", "flac") */
  format: string
  /** Optional cover image bytes */
  imageData?: Uint8Array | null
  /** Optional metadata parsed from the file */
  metadata?: Record<string, unknown> | null
  /** Optional song name extracted from metadata */
  songName?: string
  /** Optional artist extracted from metadata */
  artist?: string
  /** Optional album extracted from metadata */
  album?: string
}

/** Options passed to a decoder. */
export interface DecoderOptions {
  /** Path to a key file (used by KGG decoder) */
  keyPath?: string
  /** Base64-encoded ekey (used by QMCv2 decoder) */
  ekey?: string
  /** Key provider for KGG decryption */
  keyProvider?: KeyProvider
}

/**
 * A key provider interface for KGG decryption.
 */
export interface KeyProvider {
  find(id: string): string | null
  count(): number
}

/**
 * Type for a decoder module.
 */
export interface DecoderModule {
  decryptBuffer(buffer: Uint8Array, options?: DecoderOptions): DecoderResult
  detectFormat?(audio: Uint8Array): string
}

/**
 * Metadata about an encrypted format.
 */
export interface FormatMetadata {
  /** Short platform label */
  platform: string
  /** Human-readable version */
  version: string
  /** Whether the format requires an external key */
  requiresKey: boolean
  /** Where the key comes from */
  keySource?: "ekey" | "keyfile" | "database" | "none"
}

/**
 * Format extension metadata map.
 */
export const FORMAT_METADATA: Record<string, FormatMetadata> = {
  ".ncm":      { platform: "网易云",      version: "all", requiresKey: false, keySource: "none" },
  ".kwm":      { platform: "酷我",        version: "all", requiresKey: false, keySource: "none" },
  ".kgm":      { platform: "酷狗",        version: "v1-v4", requiresKey: false, keySource: "none" },
  ".kgma":     { platform: "酷狗",        version: "v3-v4", requiresKey: false, keySource: "none" },
  ".vpr":      { platform: "酷狗",        version: "v1-v4", requiresKey: false, keySource: "none" },
  ".qmc0":     { platform: "QQ 音乐",     version: "v1", requiresKey: false, keySource: "none" },
  ".qmc3":     { platform: "QQ 音乐",     version: "v1", requiresKey: false, keySource: "none" },
  ".qmcflac":  { platform: "QQ 音乐",     version: "v1", requiresKey: false, keySource: "none" },
  ".qmcogg":   { platform: "QQ 音乐",     version: "v1", requiresKey: false, keySource: "none" },
  ".tkm":      { platform: "QQ 音乐",     version: "v1", requiresKey: false, keySource: "none" },
  ".mflac":    { platform: "QQ 音乐",     version: "v2", requiresKey: true, keySource: "ekey" },
  ".mflac0":   { platform: "QQ 音乐",     version: "v2", requiresKey: true, keySource: "ekey" },
  ".mgg":      { platform: "QQ 音乐",     version: "v2", requiresKey: true, keySource: "ekey" },
  ".bkc":      { platform: "QQ 音乐",     version: "v2", requiresKey: true, keySource: "ekey" },
  ".kgg":      { platform: "酷狗",        version: "v5", requiresKey: true, keySource: "keyfile" },
  ".kgg.flac": { platform: "酷狗",        version: "v5", requiresKey: true, keySource: "keyfile" },
}
