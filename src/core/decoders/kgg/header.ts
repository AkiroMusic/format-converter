/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 *
 * KGG v5 file header parser.
 */

import { readUint32LE } from '../utils'

const MAGIC = new Uint8Array([
  0x7c, 0xd5, 0x32, 0xeb, 0x86, 0x02, 0x7f, 0x4b,
  0xa8, 0xaf, 0xa6, 0x8e, 0x0f, 0xff, 0x99, 0x14,
])

const PREFIX_SIZE = 1024
const ID_LENGTH_OFFSET = 0x44
const ID_OFFSET = 0x48
const MAX_ID_LENGTH = 256

export interface KggHeader {
  headerLength: number
  cryptoVersion: number
  encryptionKeyId: string
}

function buffersEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

export function parse(prefix: Uint8Array): KggHeader {
  if (prefix.length < ID_OFFSET) {
    throw new Error("KGG header is truncated: " + prefix.length + " < " + ID_OFFSET)
  }
  if (!buffersEqual(prefix.subarray(0, MAGIC.length), MAGIC)) {
    throw new Error("KGG magic is invalid")
  }
  const headerLength = readUint32LE(prefix, 0x10)
  if (headerLength < ID_OFFSET || headerLength > prefix.length) {
    throw new Error("KGG header length is invalid: " + headerLength)
  }
  const version = readUint32LE(prefix, 0x14)
  if (version !== 3 && version !== 5) {
    throw new Error("Unsupported KGG crypto version: " + version)
  }
  const idLength = readUint32LE(prefix, ID_LENGTH_OFFSET)
  if (idLength < 1 || idLength > MAX_ID_LENGTH) {
    throw new Error("KGG key id length is invalid: " + idLength)
  }
  if (ID_OFFSET + idLength > headerLength) {
    throw new Error("KGG key id exceeds header length")
  }
  if (ID_OFFSET + idLength > prefix.length) {
    throw new Error("KGG key id is truncated")
  }
  const idBytes = prefix.subarray(ID_OFFSET, ID_OFFSET + idLength)
  const id = new TextDecoder("utf-8", { fatal: true }).decode(idBytes)
  if (id.trim().length === 0) {
    throw new Error("KGG key id is empty")
  }
  return { headerLength, cryptoVersion: version, encryptionKeyId: id }
}

export { MAGIC, PREFIX_SIZE, ID_OFFSET, MAX_ID_LENGTH }
