/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 *
 * Multi-format conversion IPC handler.
 */

import { ipcMain, BrowserWindow, app } from "electron"
import { readFile, writeFile, rm } from "fs/promises"
import { join, dirname, extname, basename } from "path"
import { existsSync, mkdirSync, mkdtempSync, statSync } from "fs"
import { createHash } from "crypto"
import { tmpdir } from "os"
import * as ncm from "../../core/ncmDecrypt"
import * as decoders from "../../core/decoders"
import { writeID3Tags } from "../../core/id3Writer"
import { renderFilenameTemplate } from "../../core/template"
import { run, FfmpegOptions } from "../ffmpeg"
import { HistoryStore } from "../history"
import { settingsStore } from "./settings"

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

const pendingConversions = new Map<string, AbortController>()
const historyStore = new HistoryStore(app.getPath("userData"))

// ---------------------------------------------------------------------------
// Format classification
// ---------------------------------------------------------------------------

const ENCRYPTED_EXTS = new Set([
  ".ncm", ".kwm", ".kgm", ".kgma", ".vpr",
  ".qmc0", ".qmc3", ".qmcflac", ".qmcogg",
  ".qmc1", ".qmc2", ".tkm"
])

const PLAIN_AUDIO_EXTS = new Set([
  ".mp3", ".flac", ".wav", ".m4a", ".aac",
  ".ogg", ".opus", ".aiff", ".alac", ".wma", ".ape"
])

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function registerConvertHandlers(getMainWindow: () => BrowserWindow | null): void {
  // ---- convert:cancelAll ----
  ipcMain.handle("convert:cancelAll", async (): Promise<void> => {
    for (const [filePath, controller] of pendingConversions) {
      controller.abort()
      pendingConversions.delete(filePath)
    }
  })

  // ---- convert:cancel ----
  ipcMain.handle("convert:cancel", async (_event, filePath: string): Promise<void> => {
    const controller = pendingConversions.get(filePath)
    if (controller) {
      controller.abort()
      pendingConversions.delete(filePath)
    }
  })

  // ---- convert:file ----
  ipcMain.handle(
    "convert:file",
    async (
      _event,
      payload: {
        filePath: string
        outputDir: string
        filenameTemplate: string
        outputFormat: string
        duplicateAction: string
        // Quality settings (optional, from AppSettings)
        bitrate?: string
        vbrEnabled?: boolean
        vbrQuality?: number
        compressionLevel?: number
        sampleRate?: string
        bitDepth?: string
      }
    ): Promise<{
      success: boolean
      outputPath?: string
      format?: string
      songName?: string
      artist?: string
      album?: string
      coverImageBase64?: string
      encrypted?: boolean
      verified?: boolean
      errorMessage?: string
    }> => {
      const startTime = Date.now()
      const controller = new AbortController()
      const { filePath } = payload
      let tempDir: string | null = null

      pendingConversions.set(filePath, controller)

      try {
        const {
          outputDir,
          filenameTemplate,
          outputFormat = "source",
          duplicateAction = "rename",
          bitrate = settingsStore.store.bitrate,
          vbrEnabled = settingsStore.store.vbrEnabled,
          vbrQuality = settingsStore.store.vbrQuality,
          compressionLevel = settingsStore.store.compressionLevel,
          sampleRate = settingsStore.store.sampleRate,
          bitDepth = settingsStore.store.bitDepth
        } = payload

        const win = getMainWindow()

        const sendProgress = (progress: number): void => {
          if (win && !win.isDestroyed()) {
            win.webContents.send("convert:progress", { filePath, progress })
          }
        }

        sendProgress(0.05)

        const ext = extname(filePath).toLowerCase()
        const isEncrypted = ENCRYPTED_EXTS.has(ext)
        const isPlainAudio = PLAIN_AUDIO_EXTS.has(ext)

        if (!isEncrypted && !isPlainAudio) {
          return { success: false, errorMessage: `Unsupported file format: ${ext}` }
        }

        const fileBuffer = await readFile(filePath)
        sendProgress(0.1)

        const data = new Uint8Array(fileBuffer.buffer)

        let audio: Uint8Array
        let sourceFormat: string
        let songName = "Unknown"
        let artist = "Unknown"
        let album = "Unknown"
        let coverImage: Uint8Array | null = null

        // --- Decryption path (encrypted formats) ---
        if (isEncrypted) {
          if (ext === ".ncm") {
            const result = await ncm.parseNCM(fileBuffer.buffer, {
              onProgress: (p) => sendProgress(0.1 + p * 0.5)
            })
            audio = result.audioData
            sourceFormat = result.format.ext
            songName = result.songName
            artist = result.artist
            album = result.album
            coverImage = result.image
          } else {
            const result = decoders.decryptBuffer(ext, data)
            audio = result.audio
            sourceFormat = result.format
            if (result.songName) songName = result.songName
            if (result.artist) artist = result.artist
            if (result.album) album = result.album
            if (result.imageData) coverImage = result.imageData
          }
        } else {
          // --- Plain audio path ---
          sourceFormat = ext.slice(1) // remove leading "."
          audio = data
          // Use filename as fallback title when no metadata is available
          songName = basename(filePath, ext)
        }

        // Verify decrypted audio header integrity
        const decryptionVerified = verifyAudioHeader(audio, sourceFormat)
        // Compute integrity hash of decrypted audio data
        const audioHash = createHash('md5').update(Buffer.from(audio)).digest('hex')

        sendProgress(0.6)

        // --- Determine effective output format ---
        const effectiveFormat = outputFormat === "source" ? sourceFormat : outputFormat

        // --- Generate output filename ---
        const outputFileName = renderFilenameTemplate(filenameTemplate, {
          artist,
          title: songName,
          album
        })
        const outputFileNameWithExt = outputFileName + "." + effectiveFormat
        let outputPath = join(outputDir, outputFileNameWithExt)

        const outputDirPath = dirname(outputPath)
        if (!existsSync(outputDirPath)) {
          mkdirSync(outputDirPath, { recursive: true })
        }

        // Handle duplicate files
        const extWithDot = "." + effectiveFormat
        const basePath = outputPath.slice(0, -extWithDot.length)
        if (duplicateAction === "skip" && existsSync(outputPath)) {
          historyStore.append({
            ts: Date.now(),
            inputPath: filePath,
            inputName: basename(filePath),
            targetFormat: effectiveFormat,
            status: "failed",
            outputName: null,
            outputPath: null,
            durationMs: Date.now() - startTime,
            error: "File already exists"
          })
          return { success: false, errorMessage: "File already exists" }
        } else if (duplicateAction === "rename") {
          let counter = 1
          while (existsSync(outputPath)) {
            outputPath = basePath + " (" + counter + ")" + extWithDot
            counter++
          }
        }

        sendProgress(0.65)

        // --- Transcode via FFmpeg if target format differs from source ---
        if (effectiveFormat !== sourceFormat) {
          tempDir = mkdtempSync(join(tmpdir(), "fc-convert-"))
          const tempInputPath = join(tempDir, "input." + sourceFormat)
          await writeFile(tempInputPath, Buffer.from(audio))

          const ffmpegOpts: FfmpegOptions = {
            format: effectiveFormat as FfmpegOptions["format"],
            onProgress: (p: number): void => {
              sendProgress(0.65 + p * 0.33)
            },
            signal: controller.signal
          }

          if (bitrate) ffmpegOpts.bitrate = bitrate
          if (vbrEnabled != null) {
            if (effectiveFormat === "opus") {
              ffmpegOpts.vbr = vbrEnabled ? 1 : 0
            } else {
              ffmpegOpts.vbr = vbrEnabled ? (vbrQuality ?? 0) : null
            }
          }
          if (compressionLevel != null) ffmpegOpts.compressionLevel = compressionLevel
          if (sampleRate && sampleRate !== "original") ffmpegOpts.sampleRate = parseInt(sampleRate, 10)
          if (bitDepth && bitDepth !== "original") ffmpegOpts.bitDepth = parseInt(bitDepth, 10)

          await run(tempInputPath, outputPath, ffmpegOpts)
        } else {
          // --- Direct copy (same format, no transcoding) ---
          const audioWithTags = sourceFormat === "mp3"
            ? writeID3Tags(
                {
                  title: songName,
                  artist,
                  album,
                  image: coverImage
                    ? { imageBuffer: coverImage, mime: detectImageMime(coverImage) }
                    : undefined
                },
                audio
              )
            : audio

          await writeFile(outputPath, Buffer.from(audioWithTags))
        }

        sendProgress(1.0)

        // Verify output file integrity
        const outputVerified = existsSync(outputPath) && statSync(outputPath).size > 0

        let coverImageBase64: string | undefined
        if (coverImage) {
          coverImageBase64 = Buffer.from(coverImage).toString("base64")
        }

        // Record success to history
        historyStore.append({
          ts: Date.now(),
          inputPath: filePath,
          inputName: basename(filePath),
          targetFormat: effectiveFormat,
          status: "success",
          outputName: outputFileNameWithExt,
          outputPath,
          durationMs: Date.now() - startTime,
          error: null
        })

        return {
          success: true,
          outputPath,
          format: effectiveFormat,
          songName,
          artist,
          album,
          coverImageBase64,
          encrypted: isEncrypted,
          verified: decryptionVerified && outputVerified
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error"

        // Record failure to history
        historyStore.append({
          ts: Date.now(),
          inputPath: filePath,
          inputName: basename(filePath),
          targetFormat: "unknown",
          status: "failed",
          outputName: null,
          outputPath: null,
          durationMs: Date.now() - startTime,
          error: message
        })

        return {
          success: false,
          verified: false,
          errorMessage: message
        }
      } finally {
        pendingConversions.delete(filePath)
        // Clean up temp directory if one was created
        if (tempDir) {
          try {
            await rm(tempDir, { recursive: true, force: true })
          } catch {
            // Temp cleanup failure is non-fatal
          }
        }
      }
    }
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function detectImageMime(image: Uint8Array): string {
  if (image.length < 2) return "image/jpeg"
  if (image[0] === 0xff && image[1] === 0xd8) return "image/jpeg"
  if (image[0] === 0x89 && image[1] === 0x50) return "image/png"
  return "image/jpeg"
}

/**
 * Verify decrypted audio header integrity by checking magic bytes
 * for common audio formats. Returns true if header looks valid.
 */
function verifyAudioHeader(audio: Uint8Array, format: string): boolean {
  if (audio.length < 16) return false
  switch (format) {
    case 'flac':
      // FLAC magic: fLaC at offset 0
      return audio[0] === 0x66 && audio[1] === 0x4c && audio[2] === 0x61 && audio[3] === 0x43
    case 'mp3':
      // MP3 sync word: 0xFF 0xFB or 0xFF 0xFx or 0xFF 0xEx
      return audio[0] === 0xff && (audio[1] & 0xe0) === 0xe0
    case 'ogg':
    case 'opus':
      // OGG magic: OggS at offset 0
      return audio[0] === 0x4f && audio[1] === 0x67 && audio[2] === 0x67 && audio[3] === 0x53
    case 'wav':
      // WAV/RIFF: RIFFxxxxWAVE
      return audio[0] === 0x52 && audio[1] === 0x49 && audio[2] === 0x46 && audio[3] === 0x46
    case 'aiff':
      // AIFF: FORM
      return audio[0] === 0x46 && audio[1] === 0x4f && audio[2] === 0x52 && audio[3] === 0x4d
    case 'm4a':
    case 'aac':
    case 'alac':
      // MP4/ISO base: ftyp box at offset 4, or AAC ADTS header
      if (audio[4] === 0x66 && audio[5] === 0x74 && audio[6] === 0x79 && audio[7] === 0x70) return true
      // AAC ADTS: 0xFF 0xFx
      if (audio[0] === 0xff && (audio[1] & 0xf0) === 0xf0) return true
      return false
    default:
      // Unknown format - assume valid
      return true
  }
}


