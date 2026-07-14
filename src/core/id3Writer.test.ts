/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 */

/**
 * Unit tests for id3Writer.ts — ID3v2.3 tag writer.
 *
 * Covers:
 *   - ID3v2.3 header structure ('ID3', version 0x0300)
 *   - Text frames (TIT2, TPE1, TALB, TYER, TCON)
 *   - APIC frame (cover art)
 *   - Edge cases (empty tags, long strings)
 */

import { describe, it, expect } from 'vitest'
import { writeID3Tags } from './id3Writer'

describe('writeID3Tags', () => {
  const dummyAudio = new Uint8Array([0xff, 0xfb, 0x90, 0x00]) // MPEG sync frame

  // -----------------------------------------------------------------------
  // Header
  // -----------------------------------------------------------------------
  describe('ID3v2.3 header', () => {
    it('should prepend "ID3" magic bytes with version 0x0300', () => {
      const result = writeID3Tags({}, dummyAudio)
      expect(result[0]).toBe(0x49) // 'I'
      expect(result[1]).toBe(0x44) // 'D'
      expect(result[2]).toBe(0x33) // '3'
      expect(result[3]).toBe(0x03) // version 2.3
      expect(result[4]).toBe(0x00) // revision
      expect(result[5]).toBe(0x00) // flags
    })

    it('should use sync-safe integer for tag size', () => {
      const result = writeID3Tags({ title: 'A' }, dummyAudio)
      // bytes 6-9 are the sync-safe size of frames data
      // For just TIT2 frame (~20 bytes + overhead), size should be small
      const size =
        (result[6] << 21) |
        (result[7] << 14) |
        (result[8] << 7) |
        result[9]
      expect(size).toBeGreaterThan(0)
      // Verify sync-safe: top bit of each byte must be 0
      expect(result[6] & 0x80).toBe(0)
      expect(result[7] & 0x80).toBe(0)
      expect(result[8] & 0x80).toBe(0)
      expect(result[9] & 0x80).toBe(0)
    })
  })

  // -----------------------------------------------------------------------
  // Text frames
  // -----------------------------------------------------------------------
  describe('text frames', () => {
    it('should embed TIT2 frame for title', () => {
      const result = writeID3Tags({ title: 'Test Song' }, dummyAudio)
      const headerStr = new TextDecoder('latin1').decode(result.slice(0, 3))
      expect(headerStr).toBe('ID3')
      // Find TIT2 frame in the tag data (starts at offset 10)
      const tagData = result.slice(10)
      const tit2Offset = findFrame(tagData, 'TIT2')
      expect(tit2Offset).not.toBe(-1)
    })

    it('should embed TPE1 frame for artist', () => {
      const result = writeID3Tags({ artist: 'Test Artist' }, dummyAudio)
      const tagData = result.slice(10)
      expect(findFrame(tagData, 'TPE1')).not.toBe(-1)
    })

    it('should embed TALB frame for album', () => {
      const result = writeID3Tags({ album: 'Test Album' }, dummyAudio)
      const tagData = result.slice(10)
      expect(findFrame(tagData, 'TALB')).not.toBe(-1)
    })

    it('should embed TYER frame for year', () => {
      const result = writeID3Tags({ year: 2024 }, dummyAudio)
      const tagData = result.slice(10)
      expect(findFrame(tagData, 'TYER')).not.toBe(-1)
    })

    it('should embed TCON frame for genre', () => {
      const result = writeID3Tags({ genre: 'Pop' }, dummyAudio)
      const tagData = result.slice(10)
      expect(findFrame(tagData, 'TCON')).not.toBe(-1)
    })

    it('should embed all text frames when all tags are provided', () => {
      const result = writeID3Tags({
        title: 'T',
        artist: 'A',
        album: 'Al',
        year: 2024,
        genre: 'G'
      }, dummyAudio)
      const tagData = result.slice(10)
      expect(findFrame(tagData, 'TIT2')).not.toBe(-1)
      expect(findFrame(tagData, 'TPE1')).not.toBe(-1)
      expect(findFrame(tagData, 'TALB')).not.toBe(-1)
      expect(findFrame(tagData, 'TYER')).not.toBe(-1)
      expect(findFrame(tagData, 'TCON')).not.toBe(-1)
    })
  })

  // -----------------------------------------------------------------------
  // APIC (cover art) frame
  // -----------------------------------------------------------------------
  describe('APIC frame', () => {
    it('should embed APIC frame with JPEG image', () => {
      // Minimal JPEG-like data (just the SOI marker)
      const jpegData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
      const result = writeID3Tags({
        image: {
          imageBuffer: jpegData,
          mime: 'image/jpeg'
        }
      }, dummyAudio)
      const tagData = result.slice(10)
      expect(findFrame(tagData, 'APIC')).not.toBe(-1)
    })

    it('should detect MIME type from image buffer', () => {
      const jpegData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])
      const pngData = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      const resultJpeg = writeID3Tags({
        image: { imageBuffer: jpegData }
      }, dummyAudio)
      const resultPng = writeID3Tags({
        image: { imageBuffer: pngData, mime: 'image/png' }
      }, dummyAudio)
      expect(findFrame(resultJpeg.slice(10), 'APIC')).not.toBe(-1)
      expect(findFrame(resultPng.slice(10), 'APIC')).not.toBe(-1)
    })
  })

  // -----------------------------------------------------------------------
  // Audio data preservation
  // -----------------------------------------------------------------------
  describe('audio data preservation', () => {
    it('should append original audio after the ID3 header', () => {
      const result = writeID3Tags({ title: 'T' }, dummyAudio)
      // The audio should be at the end of the result
      const audioStart = result.length - dummyAudio.length
      expect(result.slice(audioStart)).toEqual(dummyAudio)
    })
  })

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------
  describe('edge cases', () => {
    it('should handle empty tags gracefully', () => {
      const result = writeID3Tags({}, dummyAudio)
      // Should still have ID3 header with size 0 + audio data
      expect(result.length).toBe(10 + dummyAudio.length) // header only, no frames
      expect(result.slice(10)).toEqual(dummyAudio)
    })

    it('should handle long strings', () => {
      const longTitle = 'A'.repeat(500)
      const result = writeID3Tags({ title: longTitle }, dummyAudio)
      expect(result.length).toBeGreaterThan(dummyAudio.length)
      const tagData = result.slice(10)
      expect(findFrame(tagData, 'TIT2')).not.toBe(-1)
    })

    it('should handle unicode characters in tags', () => {
      const result = writeID3Tags({
        title: '你好世界',       // Chinese
        artist: '歌手名',        // Japanese-adjacent
        album: 'Album アルバム'
      }, dummyAudio)
      const tagData = result.slice(10)
      expect(findFrame(tagData, 'TIT2')).not.toBe(-1)
      expect(findFrame(tagData, 'TPE1')).not.toBe(-1)
      expect(findFrame(tagData, 'TALB')).not.toBe(-1)
    })
  })
})

/**
 * Find a frame by its 4-byte identifier within tag data.
 * @returns offset of frame identifier within tagData, or -1 if not found
 */
function findFrame(tagData: Uint8Array, frameId: string): number {
  const idBytes = new TextEncoder().encode(frameId)
  if (idBytes.length !== 4) return -1

  let offset = 0
  while (offset + 10 <= tagData.length) {
    // Check frame identifier
    let match = true
    for (let i = 0; i < 4; i++) {
      if (tagData[offset + i] !== idBytes[i]) {
        match = false
        break
      }
    }
    if (match) return offset

    // Read frame size to advance to next frame
    const frameSize =
      (tagData[offset + 4] << 24) |
      (tagData[offset + 5] << 16) |
      (tagData[offset + 6] << 8) |
      tagData[offset + 7]
    offset += 10 + frameSize // 10 bytes header + frame data
  }
  return -1
}
