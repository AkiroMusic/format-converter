/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 *
 * KGG v5 decoder — entry point.
 */

import { DecoderResult, KeyProvider } from "../types"
import { detectAudioFormat } from "../utils"
import * as header from "./header"
import * as ekey from "./ekey"
import * as qmc2 from "./qmc2"

const PROBE_SIZE = 16

export function decrypt(input: Uint8Array, keyProvider: KeyProvider): DecoderResult {
  if (input.length < header.MAGIC.length) {
    throw new Error("Not a valid KGG v5 file (too small)")
  }
  for (let i = 0; i < header.MAGIC.length; i++) {
    if (input[i] !== header.MAGIC[i]) {
      throw new Error("Not a valid KGG v5 file (invalid magic)")
    }
  }

  const prefix = new Uint8Array(input.subarray(0, header.PREFIX_SIZE))
  const hdr = header.parse(prefix)
  if (hdr.cryptoVersion !== 5) {
    throw new Error("KGG crypto version " + hdr.cryptoVersion + " belongs to the legacy decoder")
  }

  const encoded = keyProvider.find(hdr.encryptionKeyId)
  if (!encoded) {
    const total = keyProvider.count()
    if (total === 0 || total === -1) {
      throw new Error("No KGG keys imported; import a kgg.key file or KGMusicV3.db in Settings")
    }
    throw new Error("Missing KGG key for " + hdr.encryptionKeyId)
  }

  const v1Key = ekey.unwrap(encoded)
  const cipher = qmc2.makeCipher(v1Key)

  const audioLen = input.length - hdr.headerLength
  if (audioLen <= 0) throw new Error("KGG audio data is empty")

  const audio = new Uint8Array(audioLen)
  audio.set(input.subarray(hdr.headerLength, input.length), 0)
  cipher.apply(audio, audio.length, 0n)

  const format = sniffFormat(audio.subarray(0, Math.min(PROBE_SIZE, audioLen)))
  return { audio, format }
}

function sniffFormat(probe: Uint8Array): string {
  if (probe.length < 4) return "mp3"
  if (probe[0] === 0x49 && probe[1] === 0x44 && probe[2] === 0x33) return "mp3"
  if (probe[0] === 0x66 && probe[1] === 0x4c && probe[2] === 0x61 && probe[3] === 0x43) return "flac"
  if (probe[0] === 0x4f && probe[1] === 0x67 && probe[2] === 0x67 && probe[3] === 0x53) return "ogg"
  if (probe[0] === 0x52 && probe[1] === 0x49 && probe[2] === 0x46 && probe[3] === 0x46) return "wav"
  if (probe[0] === 0xff && (probe[1] & 0xe0) === 0xe0) return "mp3"
  if (probe.length >= 8 && probe[4] === 0x66 && probe[5] === 0x74 && probe[6] === 0x79 && probe[7] === 0x70) return "m4a"
  return "mp3"
}

export function parseKeyMap(text: string): Map<string, string> {
  const map = new Map<string, string>()
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line.length === 0) continue
    const sep = line.indexOf("$")
    if (sep <= 0 || sep !== line.lastIndexOf("$")) {
      throw new Error("Invalid kgg.key line " + (i + 1) + ": " + line.slice(0, 40))
    }
    const id = line.slice(0, sep)
    const key = line.slice(sep + 1)
    if (id.length === 0 || key.length === 0) {
      throw new Error("Invalid kgg.key line " + (i + 1) + ": " + line.slice(0, 40))
    }
    map.set(id, key)
  }
  return map
}

export function serializeKeyMap(map: Map<string, string>): string {
  const sorted = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  return sorted.map(([id, key]) => id + "$" + key).join("\n") + "\n"
}

export function memoryKeyProvider(map: Map<string, string>): KeyProvider {
  return {
    find(id: string): string | null {
      return map.get(id) || null
    },
    count(): number {
      return map.size
    },
  }
}

export { header, ekey, qmc2, PROBE_SIZE }
