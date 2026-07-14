/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 *
 * Decoder router — picks the right decoder by file extension.
 */

import { DecoderResult, DecoderOptions, FORMAT_METADATA, FormatMetadata } from './types'
import * as kwm from './kwm'
import * as kgm from './kgm'
import * as qmc from './qmc'
import * as kgg from './kgg'

const QMC_V1_EXTS = new Set(['.qmc0', '.qmc3', '.qmcflac', '.qmcogg', '.qmc1', '.qmc2', '.tkm'])
const QMC_V2_EXTS = new Set([
  '.mflac', '.mflac0', '.mflac2', '.mflac4',
  '.mgg', '.mgg1', '.mgg2', '.mgg4', '.mggl',
  '.bkc', '.bkcmp3', '.bkcflac', '.bkcogg', '.bkcm4a', '.bkcwav', '.bkcwma', '.bkcape',
])

export function decryptBuffer(ext: string, buffer: Uint8Array, options?: DecoderOptions): DecoderResult {
  switch (ext) {
    case '.kwm':
      return kwm.decryptBuffer(buffer)
    case '.kgm':
    case '.kgma':
    case '.vpr':
      return kgm.decryptBuffer(buffer)
    case '.kgg':
    case '.kgg.flac': {
      const keyProvider = options?.keyProvider
      if (!keyProvider) throw new Error('KGG decryption requires a keyProvider')
      return kgg.decrypt(buffer, keyProvider)
    }
    default:
      if (QMC_V1_EXTS.has(ext)) {
        return qmc.decryptBuffer(buffer)
      }
      if (QMC_V2_EXTS.has(ext)) {
        return qmc.decryptBuffer(buffer, options)
      }
      throw new Error('No decoder available for extension: ' + ext)
  }
}

export function pickDecoder(ext: string): string | null {
  const allExts = Object.keys(FORMAT_METADATA)
  const match = allExts.find((e) => ext.toLowerCase().endsWith(e))
  return match || null
}

export function listSupported(): string[] {
  return Object.keys(FORMAT_METADATA)
}

export function listRequiresKey(): string[] {
  return Object.entries(FORMAT_METADATA)
    .filter(([_, meta]) => meta.requiresKey)
    .map(([ext]) => ext)
}

export function listNoKeyRequired(): string[] {
  return Object.entries(FORMAT_METADATA)
    .filter(([_, meta]) => !meta.requiresKey)
    .map(([ext]) => ext)
}

export function getMetadata(ext: string): FormatMetadata | null {
  return FORMAT_METADATA[ext.toLowerCase()] || null
}

export function listByKeyRequirement(): { withKey: string[]; withoutKey: string[] } {
  const withKey: string[] = []
  const withoutKey: string[] = []
  for (const [ext, meta] of Object.entries(FORMAT_METADATA)) {
    ;(meta.requiresKey ? withKey : withoutKey).push(ext)
  }
  return { withKey, withoutKey }
}

export { QMC_V1_EXTS, QMC_V2_EXTS, FORMAT_METADATA }
