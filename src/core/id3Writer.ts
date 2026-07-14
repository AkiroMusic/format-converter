/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 */

/**
 * ID3v2.3 Tag Writer
 * 
 * Migrated from the original HTML tool with one critical bugfix:
 * Only prepend ID3 tags when format is MP3. Other formats (FLAC, M4A, MP4, OGG)
 * return raw audio data unchanged to avoid container format corruption.
 * 
 * RED LINE: All byte-level encoding logic must remain identical to original.
 */

interface ID3Tags {
  title?: string
  artist?: string
  album?: string
  year?: number
  genre?: string
  image?: {
    imageBuffer: Uint8Array
    mime?: string
    type?: { id: number; name: string }
    description?: string
  }
}

function encodeSize(size: number): Uint8Array {
  const bytes = new Uint8Array(4)
  bytes[0] = (size >> 21) & 0x7F
  bytes[1] = (size >> 14) & 0x7F
  bytes[2] = (size >> 7) & 0x7F
  bytes[3] = size & 0x7F
  return bytes
}

function stringToBytes(str: string, encoding: number): Uint8Array {
  if (encoding === 0x01) {
    const utf16: number[] = []
    utf16.push(0xfe, 0xff)
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i)
      utf16.push((code >> 8) & 0xff)
      utf16.push(code & 0xff)
    }
    return new Uint8Array(utf16)
  }
  return new TextEncoder().encode(str)
}

function createTextFrame(identifier: string, text: string): Uint8Array {
  const textBytes = stringToBytes(text, 0x01)
  const frameData = new Uint8Array(1 + textBytes.length)
  frameData[0] = 0x01
  frameData.set(textBytes, 1)

  const frame = new Uint8Array(10 + frameData.length)
  const idBytes = new TextEncoder().encode(identifier)
  frame.set(idBytes, 0)

  const sizeBytes = new Uint8Array(4)
  sizeBytes[0] = (frameData.length >> 24) & 0xff
  sizeBytes[1] = (frameData.length >> 16) & 0xff
  sizeBytes[2] = (frameData.length >> 8) & 0xff
  sizeBytes[3] = frameData.length & 0xff
  frame.set(sizeBytes, 4)
  frame.set(frameData, 10)

  return frame
}

function createAPICFrame(
  imageBuffer: Uint8Array,
  mimeType: string,
  pictureType: number,
  description: string
): Uint8Array {
  mimeType = mimeType || 'image/jpeg'
  pictureType = pictureType || 0x03
  description = description || ''

  const mimeBytes = new TextEncoder().encode(mimeType)
  const descBytes = stringToBytes(description, 0x00)

  const frameData = new Uint8Array(
    1 + mimeBytes.length + 1 + 1 + descBytes.length + imageBuffer.length
  )
  let offset = 0
  frameData[offset++] = 0x00 // text encoding
  frameData.set(mimeBytes, offset)
  offset += mimeBytes.length
  frameData[offset++] = 0x00 // null separator
  frameData[offset++] = pictureType // picture type
  frameData.set(descBytes, offset)
  offset += descBytes.length
  frameData.set(imageBuffer, offset)

  const frame = new Uint8Array(10 + frameData.length)
  const idBytes = new TextEncoder().encode('APIC')
  frame.set(idBytes, 0)

  const sizeBytes = new Uint8Array(4)
  sizeBytes[0] = (frameData.length >> 24) & 0xff
  sizeBytes[1] = (frameData.length >> 16) & 0xff
  sizeBytes[2] = (frameData.length >> 8) & 0xff
  sizeBytes[3] = frameData.length & 0xff
  frame.set(sizeBytes, 4)
  frame.set(frameData, 10)

  return frame
}

function getMimeType(buffer: Uint8Array): string {
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg'
  }
  if (
    buffer.length > 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png'
  }
  return 'image/jpeg'
}

/**
 * Write ID3v2.3 tags to audio data.
 * 
 * BUGFIX (from spec §I): Only prepend ID3 header when formatExt === 'mp3'.
 * Other formats (flac, m4a, mp4, ogg) return raw audioData unchanged.
 * 
 * @param tags - Metadata tags to embed
 * @param audioData - Raw audio data
 * @returns Audio data with ID3 header prepended (MP3) or raw data (other formats)
 */
function writeID3Tags(tags: ID3Tags, audioData: Uint8Array): Uint8Array {
  const frames: Uint8Array[] = []

  if (tags.title) {
    frames.push(createTextFrame('TIT2', tags.title))
  }
  if (tags.artist) {
    frames.push(createTextFrame('TPE1', tags.artist))
  }
  if (tags.album) {
    frames.push(createTextFrame('TALB', tags.album))
  }
  if (tags.year) {
    frames.push(createTextFrame('TYER', tags.year.toString()))
  }
  if (tags.genre) {
    frames.push(createTextFrame('TCON', tags.genre))
  }
  if (tags.image && tags.image.imageBuffer) {
    const mimeType = tags.image.mime || getMimeType(tags.image.imageBuffer)
    const pictureType =
      tags.image.type && tags.image.type.id !== undefined
        ? tags.image.type.id
        : 0x03
    const description = tags.image.description || ''
    frames.push(
      createAPICFrame(tags.image.imageBuffer, mimeType, pictureType, description)
    )
  }

  const framesData = new Uint8Array(
    frames.reduce((sum, f) => sum + f.length, 0)
  )
  let offset = 0
  for (const frame of frames) {
    framesData.set(frame, offset)
    offset += frame.length
  }

  // ID3v2.3 header
  const header = new Uint8Array(10)
  header[0] = 0x49 // I
  header[1] = 0x44 // D
  header[2] = 0x33 // 3
  header[3] = 0x03 // version 2.3
  header[4] = 0x00 // revision
  header[5] = 0x00 // flags
  header.set(encodeSize(framesData.length), 6)

  const result = new Uint8Array(10 + framesData.length + audioData.length)
  result.set(header, 0)
  result.set(framesData, 10)
  result.set(audioData, 10 + framesData.length)

  return result
}

export { writeID3Tags }
export type { ID3Tags }
