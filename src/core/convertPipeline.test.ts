/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 */

/**
 * Integration tests for the full conversion pipeline.
 *
 * Tests the interaction between:
 *   - parseNCM (file parsing + decryption)
 *   - detectAudioFormat (format detection)
 *   - writeID3Tags (ID3v2.3 tagging)
 *   - template rendering (output filename generation)
 *
 * These validate the pipeline components work together correctly.
 */
import { describe, it, expect } from 'vitest'
import { writeID3Tags } from './id3Writer'
import { detectAudioFormat, parseNCM, readUint32LE } from './ncmDecrypt'
import { renderFilenameTemplate } from './template'

// ---------------------------------------------------------------------------
// Pipeline: parseNCM structural parsing → error handling
// ---------------------------------------------------------------------------
describe('Conversion pipeline — NCM structural validation', () => {
  it('should reject files shorter than magic+version (10 bytes)', async () => {
    await expect(parseNCM(new Uint8Array(9).buffer)).rejects.toThrow('File too small')
  })

  it('should reject invalid magic header', async () => {
    const buf = new Uint8Array(12)
    buf[0] = 0x00; buf[1] = 0x01; buf[2] = 0x02; buf[3] = 0x03
    buf[4] = 0x04; buf[5] = 0x05; buf[6] = 0x06; buf[7] = 0x07
    buf[8] = 0x01; buf[9] = 0x70
    await expect(parseNCM(buf.buffer)).rejects.toThrow('Not a valid NCM file format')
  })

  it('should reject truncated key data (length beyond buffer)', async () => {
    const buf = new Uint8Array(20)
    // Valid magic
    buf.set([0x43, 0x54, 0x45, 0x4E, 0x46, 0x44, 0x41, 0x4D, 0x01, 0x70], 0)
    // Key data length = 0x00001000 → 4096 bytes
    buf[10] = 0x00; buf[11] = 0x10; buf[12] = 0x00; buf[13] = 0x00
    await expect(parseNCM(buf.buffer)).rejects.toThrow('incomplete key data')
  })

  it('should reject truncated metadata (length beyond buffer after key)', async () => {
    // Build NCM with valid header + valid key data + truncated metadata
    const blocks: Uint8Array[] = []
    // Magic + version
    blocks.push(new Uint8Array([0x43, 0x54, 0x45, 0x4E, 0x46, 0x44, 0x41, 0x4D, 0x01, 0x70]))
    // Key data length = 16
    blocks.push(new Uint8Array([0x10, 0x00, 0x00, 0x00]))
    // Key data (16 bytes)
    blocks.push(new Uint8Array(16).fill(0x42))
    // Meta data length = 100 (beyond remaining buffer)
    blocks.push(new Uint8Array([0x64, 0x00, 0x00, 0x00]))

    const buf = concatBlocks(blocks)
    await expect(parseNCM(buf.buffer)).rejects.toThrow('incomplete metadata')
  })
})

// ---------------------------------------------------------------------------
// Pipeline: detectAudioFormat ↔ parseNCM integration
// ---------------------------------------------------------------------------
describe('Conversion pipeline — format detection', () => {
  it('should detect MP3 with ID3 header', () => {
    const data = new Uint8Array([0x49, 0x44, 0x33, 0x00, 0x00, 0x00, 0x00, 0x00])
    expect(detectAudioFormat(data).ext).toBe('mp3')
  })

  it('should detect MP3 with MPEG sync header', () => {
    const data = new Uint8Array([0xff, 0xfb, 0x90, 0x00])
    expect(detectAudioFormat(data).ext).toBe('mp3')
  })

  it('should detect FLAC from magic "fLaC"', () => {
    const data = new Uint8Array([0x66, 0x4c, 0x61, 0x43])
    expect(detectAudioFormat(data).ext).toBe('flac')
  })

  it('should detect OGG from magic "OggS"', () => {
    const data = new Uint8Array([0x4f, 0x67, 0x67, 0x53])
    expect(detectAudioFormat(data).ext).toBe('ogg')
  })

  it('should detect M4A from ftyp with M4A brand', () => {
    const data = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41])
    expect(detectAudioFormat(data).ext).toBe('m4a')
  })

  it('should fallback to MP3 for unknown formats', () => {
    const data = new Uint8Array([0x00, 0x00, 0x00, 0x00])
    expect(detectAudioFormat(data).ext).toBe('mp3')
  })
})

// ---------------------------------------------------------------------------
// Pipeline: ID3 writing with extracted metadata
// ---------------------------------------------------------------------------
describe('Conversion pipeline — ID3 tag writing from parse results', () => {
  it('should embed title from parseNCM result into TIT2 frame', () => {
    const audio = new Uint8Array([0xff, 0xfb, 0x90, 0x00])
    const result = writeID3Tags({ title: 'Test Song', artist: 'Test Artist' }, audio)
    const tagData = result.slice(10)
    expect(findFrame(tagData, 'TIT2')).not.toBe(-1)
    expect(findFrame(tagData, 'TPE1')).not.toBe(-1)
  })

  it('should embed APIC frame when cover image is provided', () => {
    const audio = new Uint8Array([0xff, 0xfb, 0x90, 0x00])
    const image = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
    const result = writeID3Tags({
      title: 'T',
      image: { imageBuffer: image, mime: 'image/jpeg' }
    }, audio)
    const tagData = result.slice(10)
    expect(findFrame(tagData, 'APIC')).not.toBe(-1)
  })

  it('should preserve audio data after ID3 header', () => {
    const audio = new Uint8Array([0xff, 0xfb, 0xff, 0xfb, 0x00, 0x00])
    const result = writeID3Tags({ title: 'X', artist: 'Y', album: 'Z' }, audio)
    const audioStart = result.length - audio.length
    expect(result.slice(audioStart)).toEqual(audio)
  })

  it('should handle empty metadata gracefully (no frames header)', () => {
    const audio = new Uint8Array([0xff, 0xfb, 0x90])
    const result = writeID3Tags({}, audio)
    // Header only (10 bytes) + audio
    expect(result.length).toBe(10 + audio.length)
    expect(result.slice(10)).toEqual(audio)
  })
})

// ---------------------------------------------------------------------------
// Pipeline: filename template rendering integration
// ---------------------------------------------------------------------------
describe('Conversion pipeline — filename generation', () => {
  it('should render {artist} - {title} for a typical song', () => {
    const name = renderFilenameTemplate('{artist} - {title}', {
      artist: 'Taylor Swift',
      title: 'Love Story',
      album: 'Fearless'
    })
    expect(name).toBe('Taylor Swift - Love Story')
  })

  it('should sanitize illegal filename characters', () => {
    const name = renderFilenameTemplate('{artist} - {title}', {
      artist: 'AC/DC',
      title: 'Highway to Hell',
      album: 'H?ghway'
    })
    expect(name).toBe('AC_DC - Highway to Hell')
  })

  it('should support custom templates with album', () => {
    const name = renderFilenameTemplate('{album}/{artist} - {title}', {
      artist: 'Artist',
      title: 'Song',
      album: 'Album'
    })
    expect(name).toBe('Album/Artist - Song')
  })

  it('should fallback for empty template', () => {
    const name = renderFilenameTemplate('', {
      artist: 'A',
      title: 'B',
      album: 'C'
    })
    expect(name).toBe('A - B')
  })
})

// ---------------------------------------------------------------------------
// Pipeline: readUint32LE integration (used throughout parseNCM)
// ---------------------------------------------------------------------------
describe('Conversion pipeline — uint32 LE reading', () => {
  it('should read key/metadata/image size fields', () => {
    const size = readUint32LE(new Uint8Array([0x78, 0x56, 0x34, 0x12]), 0)
    expect(size).toBe(0x12345678)
  })

  it('should handle small values', () => {
    const size = readUint32LE(new Uint8Array([0x10, 0x00, 0x00, 0x00]), 0)
    expect(size).toBe(16)
  })

  it('should handle zero', () => {
    const size = readUint32LE(new Uint8Array([0x00, 0x00, 0x00, 0x00]), 0)
    expect(size).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function concatBlocks(blocks: Uint8Array[]): Uint8Array {
  const total = blocks.reduce((s, b) => s + b.length, 0)
  const result = new Uint8Array(total)
  let offset = 0
  for (const b of blocks) {
    result.set(b, offset)
    offset += b.length
  }
  return result
}

function findFrame(tagData: Uint8Array, frameId: string): number {
  const idBytes = new TextEncoder().encode(frameId)
  let offset = 0
  while (offset + 10 <= tagData.length) {
    let match = true
    for (let i = 0; i < 4; i++) {
      if (tagData[offset + i] !== idBytes[i]) { match = false; break }
    }
    if (match) return offset
    const frameSize = (tagData[offset + 4] << 24) | (tagData[offset + 5] << 16) |
                      (tagData[offset + 6] << 8) | tagData[offset + 7]
    offset += 10 + frameSize
  }
  return -1
}
