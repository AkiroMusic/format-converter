/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 *
 * Encrypted SQLite DB cipher for KGG key databases (KGMusicV3.db).
 *
 * KGMusicV3.db is an AES-128-CBC encrypted SQLite database. Each
 * 1024-byte page is encrypted with a per-page key + IV derived from
 * the page number:
 *
 *   pageKey(pageN) = MD5(masterKey || pageN_LE_4B || 0x546c4173_LE_4B)
 *   pageIv(pageN)  = MD5(LE_4B(PRNG(pageN + 1)) x 4)
 *
 * The first page also carries a small integrity check.
 */

import { createHash, createDecipheriv } from 'crypto'

const PAGE_SIZE = 1024
const SQLITE_HEADER = new Uint8Array([0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00])

// Public master key for KGMusicV3.db
const MASTER_KEY = Buffer.from([
  0x1d, 0x61, 0x31, 0x45, 0xb2, 0x47, 0xbf, 0x7f,
  0x3d, 0x18, 0x96, 0x72, 0x14, 0x4f, 0xe4, 0xbf,
])

const PAGE_KEY_SALT = 0x546c4173

function pageKey(masterKey: Buffer, pageNumber: number): Buffer {
  const material = Buffer.alloc(24)
  masterKey.copy(material, 0)
  material.writeUInt32LE(pageNumber >>> 0, 16)
  material.writeUInt32LE(PAGE_KEY_SALT >>> 0, 20)
  return createHash('md5').update(material).digest()
}

function pageIv(pageNumber: number): Buffer {
  const PRNG_MUL = 0x9ef4n
  const PRNG_DEC = 0xce26n
  const PRNG_MOD = 0x7fffff07n
  const MASK32 = 0xffffffffn
  let seed = BigInt(pageNumber) + 1n
  const material = Buffer.alloc(16)
  for (let i = 0; i < 4; i++) {
    const value = (seed * PRNG_MUL - (seed / PRNG_DEC) * PRNG_MOD) & MASK32
    let next: bigint
    if ((value & 0x80000000n) === 0n) {
      next = value
    } else {
      next = (value + PRNG_MOD) & MASK32
    }
    seed = next
    material.writeUInt32LE(Number(next & MASK32), i * 4)
  }
  return createHash('md5').update(material).digest()
}

function isPlaintextHeader(page: Uint8Array): boolean {
  if (page.length < SQLITE_HEADER.length) return false
  for (let i = 0; i < SQLITE_HEADER.length; i++) {
    if (page[i] !== SQLITE_HEADER[i]) return false
  }
  return true
}

function isEncryptedHeader(page: Uint8Array): boolean {
  if (page.length < 24) return false
  const magic = (page[20] | (page[21] << 8) | (page[22] << 16) | (page[23] << 24)) >>> 0
  if (magic !== 0x20204000) return false
  const pageSizeLow = page[16] & 0xff
  const pageSizeHigh = page[17] & 0xff
  const pageSize = (pageSizeLow << 8) | (pageSizeHigh << 16)
  const diff = pageSize - 0x200
  if (diff < 0 || diff > 0xfe00) return false
  return ((pageSize - 1) & pageSize) === 0
}

function decryptFirstPage(page: Uint8Array, masterKey: Buffer): void {
  if (!isEncryptedHeader(page)) {
    throw new Error('Invalid encrypted KGG database header')
  }
  const expectedHeader = Buffer.from(page.subarray(16, 24))
  // Swap bytes 8..16 to 16..24
  for (let i = 0; i < 8; i++) {
    page[16 + i] = page[8 + i]
  }
  const decrypted = decryptBlocks(Buffer.from(page.subarray(16, PAGE_SIZE)), 1, masterKey)
  for (let i = 0; i < decrypted.length; i++) {
    page[16 + i] = decrypted[i]
  }
  // Verify integrity
  for (let i = 0; i < 8; i++) {
    if (page[16 + i] !== expectedHeader[i]) {
      throw new Error('KGG database page 1 integrity check failed (wrong master key?)')
    }
  }
  // Write real SQLite header
  for (let i = 0; i < SQLITE_HEADER.length; i++) {
    page[i] = SQLITE_HEADER[i]
  }
}

function decryptBlocks(ciphertext: Buffer, pageNumber: number, masterKey: Buffer): Buffer {
  const decipher = createDecipheriv(
    'aes-128-cbc',
    pageKey(masterKey, pageNumber),
    pageIv(pageNumber),
  )
  decipher.setAutoPadding(false)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}

function decryptPage(page: Uint8Array, pageNumber: number, masterKey: Buffer): void {
  const decrypted = decryptBlocks(Buffer.from(page), pageNumber, masterKey)
  for (let i = 0; i < decrypted.length && i < page.length; i++) {
    page[i] = decrypted[i]
  }
}

export {
  PAGE_SIZE,
  MASTER_KEY,
  pageKey,
  pageIv,
  isPlaintextHeader,
  isEncryptedHeader,
  decryptFirstPage,
  decryptPage,
  decryptBlocks,
}
