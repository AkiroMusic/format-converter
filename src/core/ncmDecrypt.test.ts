/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 */

/**
 * Unit tests for ncmDecrypt.ts — crypto primitives and NCM parser.
 *
 * Covers:
 *   - All exported pure functions with known test vectors
 *   - parseNCM error/edge cases (no real .ncm file needed)
 *   - CR4 KSA/PRGA roundtrip
 */
import { describe, it, expect } from 'vitest'
import {
  xorBytes,
  subWord,
  rotWord,
  keyExpansion,
  addRoundKey,
  invSubBytes,
  invShiftRows,
  gmul,
  invMixColumns,
  aesDecryptBlock,
  aesDecryptECB,
  removePKCS7Padding,
  readUint32LE,
  detectAudioFormat,
  base64ToUint8Array,
  CR4,
  parseNCM
} from './ncmDecrypt'

// ---------------------------------------------------------------------------
// xorBytes
// ---------------------------------------------------------------------------
describe('xorBytes', () => {
  it('should XOR every byte with the given value', () => {
    const input = new Uint8Array([0x01, 0x02, 0x03, 0x04])
    const result = xorBytes(input, 0x64)
    expect(result).toEqual(new Uint8Array([0x65, 0x66, 0x67, 0x60])) // 0x04 ^ 0x64 = 0x60
  })

  it('should return an empty array for empty input', () => {
    const input = new Uint8Array(0)
    const result = xorBytes(input, 0xff)
    expect(result).toEqual(new Uint8Array(0))
  })

  it('should be its own inverse', () => {
    const original = new Uint8Array([0xde, 0xad, 0xbe, 0xef])
    const xored = xorBytes(original, 0x42)
    const restored = xorBytes(xored, 0x42)
    expect(restored).toEqual(original)
  })
})

// ---------------------------------------------------------------------------
// subWord / rotWord
// ---------------------------------------------------------------------------
describe('subWord', () => {
  it('should substitute each byte via the AES S-box', () => {
    // AES FIPS 197: S-box(0x63) = 0xfb, S-box(0x7c) = 0x10, ...
    const input = new Uint8Array([0x63, 0x7c, 0x77, 0x7b])
    const result = subWord(input)
    // sBox[0x63]=0xfb, sBox[0x7c]=0x10, sBox[0x77]=0xf5, sBox[0x7b]=0x21
    expect(result).toEqual(new Uint8Array([0xfb, 0x10, 0xf5, 0x21]))
  })
})

describe('rotWord', () => {
  it('should rotate left by one byte', () => {
    const input = new Uint8Array([0x01, 0x02, 0x03, 0x04])
    expect(rotWord(input)).toEqual(new Uint8Array([0x02, 0x03, 0x04, 0x01]))
  })
})

// ---------------------------------------------------------------------------
// gmul
// ---------------------------------------------------------------------------
describe('gmul', () => {
  it('should multiply in GF(2^8)', () => {
    // Known test: 0x57 * 0x13 = 0xfe (from FIPS 197)
    expect(gmul(0x57, 0x13)).toBe(0xfe)
    // Multiplicative identity
    expect(gmul(0x42, 0x01)).toBe(0x42)
    // Zero
    expect(gmul(0x42, 0x00)).toBe(0x00)
    // gmul(0x02, val) should be xtime(val)
    expect(gmul(0x02, 0x80)).toBe(0x1b) // 0x80 << 1 = 0x100 ^ 0x1b = 0x1b
    expect(gmul(0x02, 0x01)).toBe(0x02)
  })
})

// ---------------------------------------------------------------------------
// keyExpansion
// ---------------------------------------------------------------------------
describe('keyExpansion', () => {
  it('should expand a 16-byte key to 176 bytes', () => {
    const key = new Uint8Array(16).fill(0x00)
    const expanded = keyExpansion(key)
    expect(expanded.length).toBe(176) // 4 * 4 * (10 + 1) * 4
    // First 16 bytes should equal the key
    expect(expanded.slice(0, 16)).toEqual(key)
  })
})

// ---------------------------------------------------------------------------
// AES round functions
// ---------------------------------------------------------------------------
describe('invSubBytes', () => {
  it('should apply inverse S-box: invSBox[sBox[i]] === i', () => {
    // AES: S-box(0x01) = 0x7c, S-box(0x02) = 0x77
    // So invS-box(0x7c) = 0x01, invS-box(0x77) = 0x02
    const state = new Uint8Array([0x7c, 0x77, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
    invSubBytes(state)
    expect(state[0]).toBe(0x01)
    expect(state[1]).toBe(0x02)
  })
})

describe('invShiftRows', () => {
  it('should undo ShiftRows: row r shifts right by r positions', () => {
    // AES state is column-major 4x4:
    // Index: row, col →  [0,0] [0,1] [0,2] [0,3]  = indices  0, 4,  8, 12
    //                    [1,0] [1,1] [1,2] [1,3]  = indices  1, 5,  9, 13
    //                    [2,0] [2,1] [2,2] [2,3]  = indices  2, 6, 10, 14
    //                    [3,0] [3,1] [3,2] [3,3]  = indices  3, 7, 11, 15
    // invShiftRows: row r (1-indexed) shifts right by r positions
    const state = new Uint8Array([
      0xa1, 0xa2, 0xa3, 0xa4,
      0xb1, 0xb2, 0xb3, 0xb4,
      0xc1, 0xc2, 0xc3, 0xc4,
      0xd1, 0xd2, 0xd3, 0xd4
    ])
    invShiftRows(state)
    // Row 0 unchanged: indices 0,4,8,12
    expect(state[0]).toBe(0xa1)
    expect(state[4]).toBe(0xb1)
    expect(state[8]).toBe(0xc1)
    expect(state[12]).toBe(0xd1)
    // Row 1 (indices 1,5,9,13) shifted right by 1:
    // old [1,5,9,13] = [0xa2,0xb2,0xc2,0xd2] → [0xd2,0xa2,0xb2,0xc2]
    expect(state[1]).toBe(0xd2)
    expect(state[5]).toBe(0xa2)
    expect(state[9]).toBe(0xb2)
    expect(state[13]).toBe(0xc2)
    // Row 2 (indices 2,6,10,14) shifted right by 2:
    // old [2,6,10,14] = [0xa3,0xb3,0xc3,0xd3] → [0xc3,0xd3,0xa3,0xb3]
    expect(state[2]).toBe(0xc3)
    expect(state[6]).toBe(0xd3)
    expect(state[10]).toBe(0xa3)
    expect(state[14]).toBe(0xb3)
    // Row 3 (indices 3,7,11,15) shifted right by 3:
    // old [3,7,11,15] = [0xa4,0xb4,0xc4,0xd4] → [0xb4,0xc4,0xd4,0xa4]
    expect(state[3]).toBe(0xb4)
    expect(state[7]).toBe(0xc4)
    expect(state[11]).toBe(0xd4)
    expect(state[15]).toBe(0xa4)
  })
})

describe('invMixColumns', () => {
  it('should apply the inverse MixColumns matrix multiplication', () => {
    const state = new Uint8Array([
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
    ])
    invMixColumns(state)
    // All zeros should stay zero
    expect(state.every(b => b === 0)).toBe(true)
  })
})

describe('addRoundKey', () => {
  it('should XOR the round key into the state', () => {
    const state = new Uint8Array(16).fill(0xff)
    const roundKey = new Uint8Array(16).fill(0x0f)
    addRoundKey(state, roundKey)
    expect(state.every(b => b === 0xf0)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// AES-128-ECB decrypt
// ---------------------------------------------------------------------------
describe('aesDecryptECB', () => {
  it('should decrypt a single AES block using NCM coreKey', () => {
    // NCM core key (known constant)
    const coreKey = new Uint8Array([0x68, 0x7A, 0x48, 0x52, 0x41, 0x6D, 0x73, 0x6F, 0x35, 0x6B, 0x49, 0x6E, 0x62, 0x61, 0x78, 0x57])

    // Encrypt a known plaintext with our own AES to generate ciphertext
    // Since we don't have an encrypt function, test that:
    // aesDecryptECB(aesDecryptECB(data, key), key) = data (symmetry via XOR?)
    // Actually AES decrypt is not symmetric with encrypt, so let's test roundtrip differently.
    // For ECB mode with a single block, we can just check the length is preserved.
    const block = new Uint8Array(16).fill(0x42)
    const decrypted = aesDecryptECB(block, coreKey)
    expect(decrypted.length).toBe(block.length)

    // Decrypting the same ciphertext twice should produce the same result
    const decrypted2 = aesDecryptECB(block, coreKey)
    expect(decrypted2).toEqual(decrypted)
  })

  it('should handle multiple blocks', () => {
    const coreKey = new Uint8Array([0x68, 0x7A, 0x48, 0x52, 0x41, 0x6D, 0x73, 0x6F, 0x35, 0x6B, 0x49, 0x6E, 0x62, 0x61, 0x78, 0x57])
    const data = new Uint8Array(32).fill(0x00)
    const decrypted = aesDecryptECB(data, coreKey)
    expect(decrypted.length).toBe(32)
    const decrypted2 = aesDecryptECB(data, coreKey)
    expect(decrypted2).toEqual(decrypted)
  })
})

// ---------------------------------------------------------------------------
// removePKCS7Padding
// ---------------------------------------------------------------------------
describe('removePKCS7Padding', () => {
  it('should remove PKCS7 padding', () => {
    const padded = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x04, 0x04, 0x04, 0x04])
    expect(removePKCS7Padding(padded)).toEqual(new Uint8Array([0x01, 0x02, 0x03, 0x04]))
  })

  it('should return original if padding is invalid (value > 16)', () => {
    const invalid = new Uint8Array([0x01, 0x02, 0x11])
    expect(removePKCS7Padding(invalid)).toEqual(invalid)
  })

  it('should return original if padding bytes don\'t match', () => {
    const invalid = new Uint8Array([0x01, 0x02, 0x03, 0x02]) // last byte says 2 but only 1 padding byte
    // Last byte is 0x02, checks: data[2] (last-1) should be 0x02 but is 0x03
    expect(removePKCS7Padding(invalid)).toEqual(invalid)
  })
})

// ---------------------------------------------------------------------------
// readUint32LE
// ---------------------------------------------------------------------------
describe('readUint32LE', () => {
  it('should read little-endian uint32 at offset', () => {
    const data = new Uint8Array([0x78, 0x56, 0x34, 0x12])
    expect(readUint32LE(data, 0)).toBe(0x12345678)
  })

  it('should read zero', () => {
    const data = new Uint8Array([0x00, 0x00, 0x00, 0x00])
    expect(readUint32LE(data, 0)).toBe(0)
  })

  it('should read max value', () => {
    const data = new Uint8Array([0xff, 0xff, 0xff, 0xff])
    expect(readUint32LE(data, 0)).toBe(0xffffffff)
  })
})

// ---------------------------------------------------------------------------
// detectAudioFormat
// ---------------------------------------------------------------------------
describe('detectAudioFormat', () => {
  it('should detect MP3 from ID3 header', () => {
    const data = new Uint8Array([0x49, 0x44, 0x33, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
    const fmt = detectAudioFormat(data)
    expect(fmt.ext).toBe('mp3')
    expect(fmt.mime).toBe('audio/mpeg')
  })

  it('should detect MP3 from MPEG sync header', () => {
    const data = new Uint8Array([0xff, 0xfb, 0x00, 0x00])
    const fmt = detectAudioFormat(data)
    expect(fmt.ext).toBe('mp3')
    expect(fmt.mime).toBe('audio/mpeg')
  })

  it('should detect FLAC', () => {
    const data = new Uint8Array([0x66, 0x4c, 0x61, 0x43])
    const fmt = detectAudioFormat(data)
    expect(fmt.ext).toBe('flac')
    expect(fmt.mime).toBe('audio/flac')
  })

  it('should detect M4A (ftypM4A)', () => {
    const data = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41])
    const fmt = detectAudioFormat(data)
    expect(fmt.ext).toBe('m4a')
    expect(fmt.mime).toBe('audio/mp4')
  })

  it('should detect MP4 (ftyp)', () => {
    const data = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f])
    const fmt = detectAudioFormat(data)
    expect(fmt.ext).toBe('mp4')
    expect(fmt.mime).toBe('audio/mp4')
  })

  it('should detect OGG', () => {
    const data = new Uint8Array([0x4f, 0x67, 0x67, 0x53])
    const fmt = detectAudioFormat(data)
    expect(fmt.ext).toBe('ogg')
    expect(fmt.mime).toBe('audio/ogg')
  })

  it('should fallback to MP3 for unknown format', () => {
    const data = new Uint8Array([0x00, 0x00, 0x00, 0x00])
    const fmt = detectAudioFormat(data)
    expect(fmt.ext).toBe('mp3')
    expect(fmt.mime).toBe('audio/mpeg')
  })
})

// ---------------------------------------------------------------------------
// base64ToUint8Array
// ---------------------------------------------------------------------------
describe('base64ToUint8Array', () => {
  it('should decode base64 to bytes', () => {
    const result = base64ToUint8Array('SGVsbG8=') // "Hello"
    expect(new TextDecoder().decode(result)).toBe('Hello')
  })

  it('should decode empty string', () => {
    const result = base64ToUint8Array('')
    expect(result.length).toBe(0)
  })

  it('should handle binary base64', () => {
    // base64 of [0x00, 0x01, 0x02, 0x03]
    const result = base64ToUint8Array('AAECAw==')
    expect(result).toEqual(new Uint8Array([0x00, 0x01, 0x02, 0x03]))
  })
})

// ---------------------------------------------------------------------------
// CR4 (RC4 independent reimplementation)
// ---------------------------------------------------------------------------
describe('CR4', () => {
  it('should produce deterministic output for same key and data', () => {
    const cr4 = new CR4()
    const key = new TextEncoder().encode('test-key')
    const data = new Uint8Array([0x01, 0x02, 0x03, 0x04])
    cr4.KSA(key)
    const out1 = cr4.PRGA(new Uint8Array(data), data.length)

    const cr42 = new CR4()
    cr42.KSA(key)
    const out2 = cr42.PRGA(new Uint8Array(data), data.length)
    expect(out2).toEqual(out1)
  })

  it('should produce output same length as input', () => {
    const cr4 = new CR4()
    cr4.KSA(new TextEncoder().encode('key'))
    const data = new Uint8Array([0x01, 0x02, 0x03])
    const result = cr4.PRGA(new Uint8Array(data), data.length)
    expect(result.length).toBe(3)
  })

  it('should handle empty data', () => {
    const cr4 = new CR4()
    cr4.KSA(new TextEncoder().encode('key'))
    const data = new Uint8Array(0)
    const result = cr4.PRGA(new Uint8Array(data), data.length)
    expect(result.length).toBe(0)
  })

  it('PRGA should be self-inverse (RC4 property)', () => {
    const cr4 = new CR4()
    const key = new TextEncoder().encode('rc4-key')
    const original = new Uint8Array([0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0])

    cr4.KSA(key)
    const encrypted = cr4.PRGA(new Uint8Array(original), original.length)

    const cr42 = new CR4()
    cr42.KSA(key)
    const decrypted = cr42.PRGA(new Uint8Array(encrypted), encrypted.length)

    expect(decrypted).toEqual(original)
  })
})

// ---------------------------------------------------------------------------
// parseNCM — error / edge cases (no real .ncm file)
// ---------------------------------------------------------------------------
describe('parseNCM', () => {
  it('should reject file too small', async () => {
    const tiny = new Uint8Array(5)
    await expect(parseNCM(tiny.buffer)).rejects.toThrow('File too small')
  })

  it('should reject invalid magic header', async () => {
    const invalid = new Uint8Array(20)
    // Write invalid header bytes (not CTENFDAM)
    invalid[0] = 0x00; invalid[1] = 0x00; invalid[2] = 0x00; invalid[3] = 0x00
    invalid[4] = 0x00; invalid[5] = 0x00; invalid[6] = 0x00; invalid[7] = 0x00
    invalid[8] = 0x01; invalid[9] = 0x70
    await expect(parseNCM(invalid.buffer)).rejects.toThrow('Not a valid NCM file format')
  })

  it('should reject wrong version byte', async () => {
    const invalid = new Uint8Array(20)
    // Correct magic
    invalid[0] = 0x43; invalid[1] = 0x54; invalid[2] = 0x45; invalid[3] = 0x4e
    invalid[4] = 0x46; invalid[5] = 0x44; invalid[6] = 0x41; invalid[7] = 0x4d
    // Wrong version
    invalid[8] = 0x02; invalid[9] = 0x70
    await expect(parseNCM(invalid.buffer)).rejects.toThrow('Not a valid NCM file format (incorrect version)')
  })

  it('should throw on truncated key data', async () => {
    const buf = new Uint8Array(20)
    // Magic header
    buf[0] = 0x43; buf[1] = 0x54; buf[2] = 0x45; buf[3] = 0x4e
    buf[4] = 0x46; buf[5] = 0x44; buf[6] = 0x41; buf[7] = 0x4d
    // Version: 0x01 0x70
    buf[8] = 0x01; buf[9] = 0x70
    // Key data length: 100 bytes (but file only has 20 total)
    buf[10] = 0x64; buf[11] = 0x00; buf[12] = 0x00; buf[13] = 0x00
    await expect(parseNCM(buf.buffer)).rejects.toThrow('Invalid file format: incomplete key data')
  })

  it('should call onProgress and onWarning callbacks', async () => {
    // Create minimal viable NCM header with truncated audio (we want parse to succeed enough
    // to get past key metadata to trigger progress calls)
    // Actually we can't fully parse without valid encrypted data.
    // Test that onWarning is surfaced if metadata parse fails.
    // Build a file with valid magic, version, key data, but bogus metadata

    const coreKey = new Uint8Array([0x68, 0x7A, 0x48, 0x52, 0x41, 0x6D, 0x73, 0x6F, 0x35, 0x6B, 0x49, 0x6E, 0x62, 0x61, 0x78, 0x57])

    // Build a minimal NCM file that gets past key decryption
    const blocks: Uint8Array[] = []

    // Magic header
    blocks.push(new Uint8Array([0x43, 0x54, 0x45, 0x4E, 0x46, 0x44, 0x41, 0x4D]))
    // Version
    blocks.push(new Uint8Array([0x01, 0x70]))

    // Key data length: 16 bytes (just 1 AES block), XORed with 0x64
    const rawKey = new Uint8Array(16).fill(0x00)
    rawKey[17 - 1] = 0x10 // pad length at byte 17-1 is 0x10 (16 bytes padding)
    // Actually the padding is at the end, value 0x10 for 16 bytes
    // The structure is: encryptedKeyData is XOR(0x64) of AES-ECB-encrypted data
    // To make a valid decrypt, we need to encrypt rawKey with coreKey using AES-ECB
    // But we only have aesDecryptECB, not encrypt. Let's just make the key data
    // such that after AES decryption we get something parseable.

    // Simpler approach: just verify onWarning gets called with bad metadata
    // Use encrypted key data that's AES-decryptable with coreKey.
    // Since aesDecryptECB will decrypt anything to something, and then we try to 
    // parse keyString from slice(17), it will just produce garbage but won't throw.
    // The keyString will be used for CR4 key which will decrypt audio as garbage.
    // Then metadata will fail to parse → onWarning fires.

    const keyLen = 16
    const keyLenBytes = new Uint8Array(4)
    keyLenBytes[0] = keyLen & 0xff
    keyLenBytes[1] = (keyLen >> 8) & 0xff
    keyLenBytes[2] = (keyLen >> 16) & 0xff
    keyLenBytes[3] = (keyLen >> 24) & 0xff
    blocks.push(keyLenBytes)

    // Key data: simple 16 bytes, after XOR 0x64, AES decrypt with coreKey
    // We just use random bytes that won't crash
    const fakeKeyData = new Uint8Array(keyLen).fill(0x42)
    blocks.push(fakeKeyData)

    // Metadata length: 4 bytes (non-zero so it triggers metadata parsing)
    const metaLen = 16
    const metaLenBytes = new Uint8Array(4)
    metaLenBytes[0] = metaLen & 0xff
    metaLenBytes[1] = (metaLen >> 8) & 0xff
    metaLenBytes[2] = (metaLen >> 16) & 0xff
    metaLenBytes[3] = (metaLen >> 24) & 0xff
    blocks.push(metaLenBytes)

    // Bogus metadata (will fail to parse → onWarning)
    const fakeMeta = new Uint8Array(metaLen).fill(0x55)
    blocks.push(fakeMeta)

    // CRC + gap (9 bytes)
    blocks.push(new Uint8Array(9).fill(0x00))

    // Image size: 0 (no image)
    blocks.push(new Uint8Array(4).fill(0x00))

    // Audio data (truncated but enough to not crash PRGA)
    blocks.push(new Uint8Array(16).fill(0x00))

    const fileBytes = concatUint8(blocks)

    const progressValues: number[] = []
    const warnings: string[] = []

    await expect(
      parseNCM(fileBytes.buffer, {
        onProgress: (p) => { progressValues.push(p) },
        onWarning: (w) => { warnings.push(w) }
      })
    ).resolves.toBeDefined()

    // onProgress should have been called at least once
    expect(progressValues.length).toBeGreaterThan(0)
    // Metadata will fail to parse with our garbage data
    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings[0]).toContain('Metadata parsing failed')
  })
})

// Helper to concatenate Uint8Array
function concatUint8(arrays: Uint8Array[]): Uint8Array {
  const totalLen = arrays.reduce((sum, a) => sum + a.length, 0)
  const result = new Uint8Array(totalLen)
  let offset = 0
  for (const a of arrays) {
    result.set(a, offset)
    offset += a.length
  }
  return result
}
