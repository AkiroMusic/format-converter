/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 */

/**
 * Decoder router — maps file extensions to their corresponding decoder modules.
 * This is the single entry point for all format decryption.
 */

import { type DecoderModule } from './types'
import { ncmDecoder } from './ncmDecrypt'
import { kwmDecoder } from './kwmDecrypt'
import { kgmDecoder } from './kgmDecrypt'
import { qmcDecoder } from './qmcDecrypt'

/**
 * Complete extension → decoder mapping.
 * Phase 1 formats (no external key needed) are fully supported.
 * Phase 2 formats (key-required) are registered but will throw at runtime
 * until their decoders are fully implemented.
 */
const EXTENSION_MAP: Record<string, DecoderModule> = {}

function registerDecoder(decoder: DecoderModule): void {
  for (const ext of decoder.extensions) {
    EXTENSION_MAP[ext.toLowerCase()] = decoder
  }
}

registerDecoder(ncmDecoder)
registerDecoder(kwmDecoder)
registerDecoder(kgmDecoder)
registerDecoder(qmcDecoder)

// Phase 2 extensions (registered but decoders not yet implemented)
// These will produce a helpful error message when picked.
const PHASE2_EXTENSIONS = [
  '.mflac', '.mflac0', '.mgg', '.mgg1',
  '.kgg', '.bkc', '.bkcmp3', '.bkcflac', '.bkcogg',
  '.bkcm4a', '.bkcwav', '.bkcwma', '.bkcape',
]

/**
 * Pick a decoder for the given file path/extension.
 * Returns undefined if the extension is not supported.
 */
export function pickDecoder(filePath: string): DecoderModule | undefined {
  const ext = getExtension(filePath)
  const decoder = EXTENSION_MAP[ext]

  // Check if it's a known Phase 2 extension
  if (!decoder && PHASE2_EXTENSIONS.includes(ext)) {
    throw new Error(
      `Format "${ext}" requires an external key (Phase 2). ` +
      'This feature is not yet implemented. ' +
      'Please check future updates for key-based decoder support.'
    )
  }

  return decoder
}

/**
 * Get the lowercase extension from a file path.
 */
function getExtension(filePath: string): string {
  const dotIndex = filePath.lastIndexOf('.')
  if (dotIndex === -1) return ''
  return filePath.slice(dotIndex).toLowerCase()
}

/**
 * List all supported extensions (Phase 1 + Phase 2).
 */
export function listSupportedExtensions(): string[] {
  const exts = new Set<string>()
  for (const ext of Object.keys(EXTENSION_MAP)) {
    exts.add(ext)
  }
  for (const ext of PHASE2_EXTENSIONS) {
    exts.add(ext)
  }
  return Array.from(exts).sort()
}

/**
 * List Phase 1 extensions (no external key needed).
 */
export function listNoKeyExtensions(): string[] {
  const exts: string[] = []
  for (const ext of Object.keys(EXTENSION_MAP)) {
    exts.push(ext)
  }
  return exts.sort()
}

/**
 * List Phase 2 extensions (require external key).
 */
export function listKeyRequiredExtensions(): string[] {
  return [...PHASE2_EXTENSIONS]
}

/**
 * Get metadata about a format for UI display.
 */
export interface FormatInfo {
  ext: string
  label: string
  platform: string
  requiresKey: boolean
}

const FORMAT_METADATA: Record<string, FormatInfo> = {
  '.ncm': { ext: 'ncm', label: 'NCM', platform: '网易云音乐', requiresKey: false },
  '.kwm': { ext: 'kwm', label: 'KWM', platform: '酷我音乐', requiresKey: false },
  '.kgm': { ext: 'kgm', label: 'KGM', platform: '酷狗音乐', requiresKey: false },
  '.kgma': { ext: 'kgma', label: 'KGMA', platform: '酷狗音乐', requiresKey: false },
  '.vpr': { ext: 'vpr', label: 'VPR', platform: '酷狗音乐', requiresKey: false },
  '.qmc0': { ext: 'qmc0', label: 'QMC0', platform: 'QQ音乐', requiresKey: false },
  '.qmc3': { ext: 'qmc3', label: 'QMC3', platform: 'QQ音乐', requiresKey: false },
  '.qmcflac': { ext: 'qmcflac', label: 'QMC FLAC', platform: 'QQ音乐', requiresKey: false },
  '.qmcogg': { ext: 'qmcogg', label: 'QMC OGG', platform: 'QQ音乐', requiresKey: false },
  '.qmc1': { ext: 'qmc1', label: 'QMC1', platform: 'QQ音乐', requiresKey: false },
  '.qmc2': { ext: 'qmc2', label: 'QMC2', platform: 'QQ音乐', requiresKey: false },
  '.tkm': { ext: 'tkm', label: 'TKM', platform: 'QQ音乐', requiresKey: false },
  '.mflac': { ext: 'mflac', label: 'MFLAC', platform: 'QQ音乐', requiresKey: true },
  '.mflac0': { ext: 'mflac0', label: 'MFLAC0', platform: 'QQ音乐', requiresKey: true },
  '.mgg': { ext: 'mgg', label: 'MGG', platform: 'QQ音乐', requiresKey: true },
  '.kgg': { ext: 'kgg', label: 'KGG', platform: '酷狗音乐', requiresKey: true },
}

/**
 * Get display metadata for a given extension.
 */
export function getFormatInfo(ext: string): FormatInfo | undefined {
  return FORMAT_METADATA[ext.toLowerCase()]
}

/**
 * Get the high-level format label for a file (e.g., "NCM", "KWM", "KGM").
 */
export function getFormatLabel(ext: string): string {
  return FORMAT_METADATA[ext.toLowerCase()]?.label ?? ext.toUpperCase().replace('.', '')
}

export { FORMAT_METADATA }
