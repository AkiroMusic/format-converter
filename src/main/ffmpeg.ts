/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 *
 * FFmpeg subprocess wrapper with progress parsing, cancellation support,
 * and professional-grade audio encoding parameters.
 *
 * Pure Node.js — no Electron APIs. Intended for use in the main process.
 */

import { spawn } from 'child_process'
import { resolveFfmpegPath, resolveFfprobePath } from './ffmpeg-path'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FfmpegOptions {
  format?: 'mp3' | 'flac' | 'wav' | 'm4a' | 'aac' | 'ogg' | 'opus' | 'aiff' | 'alac'
  /** CBR bitrate string, e.g. "320k", "192k", "128k" */
  bitrate?: string
  /** VBR quality:
   *  - MP3: 0-9 (0=best, 9=worst)
   *  - AAC: 0-3 (higher = better)
   *  - Opus: 0 or 1 (off/on) */
  vbr?: number | null
  /** FLAC compression level 0-8 (default 5) */
  compressionLevel?: number | null
  /** Sample rate in Hz: 44100, 48000, 96000, 192000 */
  sampleRate?: number | null
  /** Bit depth for PCM codecs: 16, 24, 32 (WAV/AIFF/ALAC) */
  bitDepth?: number | null
  /** MP3 joint stereo mode */
  jointStereo?: boolean | null
  /** Progress callback, receives 0-100 percent */
  onProgress?: (percent: number) => void
  /** AbortSignal for cancellation */
  signal?: AbortSignal
  /** Explicit ffmpeg binary path (overrides resolver) */
  ffmpegBin?: string
  /** Explicit ffprobe binary path (overrides resolver) */
  ffprobeBin?: string
}

export interface FfmpegResult {
  outputPath: string
}

// ---------------------------------------------------------------------------
// Low-level: runFfmpeg
// ---------------------------------------------------------------------------

/**
 * Spawn `ffmpeg` with the given arguments and return its stderr output.
 *
 * - Parses `time=HH:MM:SS.MS` from stderr for progress reporting when
 *   `totalDurationSec` is provided.
 * - Throttles `onProgress` callbacks to ~200 ms.
 * - On `signal.abort`: kills the subprocess and rejects.
 * - On non-zero exit: rejects with the last 500 characters of stderr.
 */
export async function runFfmpeg(
  args: string[],
  opts: {
    onProgress?: (percent: number) => void
    signal?: AbortSignal
    totalDurationSec?: number
    ffmpegBin?: string
  } = {}
): Promise<{ stderr: string }> {
  const bin = opts.ffmpegBin ?? 'ffmpeg'

  return new Promise<{ stderr: string }>((resolve, reject) => {
    const proc = spawn(bin, args, {
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stderr = ''
    let lastUpdate = 0
    let lastPct = -1

    // --- abort handling ---
    const onAbort = (): void => {
      try {
        proc.kill('SIGTERM')
      } catch {
        // subprocess may already have exited
      }
    }

    if (opts.signal) {
      if (opts.signal.aborted) {
        onAbort()
        reject(new Error('aborted'))
        return
      }
      opts.signal.addEventListener('abort', onAbort, { once: true })
    }

    // --- stderr parsing & progress ---
    proc.stderr.on('data', (chunk: Buffer) => {
      const s = chunk.toString()
      stderr += s

      const { onProgress, totalDurationSec, signal } = opts
      if (onProgress && totalDurationSec && totalDurationSec > 0 && !signal?.aborted) {
        const m = s.match(/time=(\d+):(\d+):(\d+\.\d+)/)
        if (m) {
          const cur = +m[1] * 3600 + +m[2] * 60 + +m[3]
          const pct = Math.min(100, (cur / totalDurationSec) * 100)
          const now = Date.now()
          if (now - lastUpdate >= 200 && Math.abs(pct - lastPct) >= 0.5) {
            lastUpdate = now
            lastPct = pct
            onProgress(pct)
          }
        }
      }
    })

    // --- lifetime events ---
    proc.on('error', (err: Error) => {
      reject(err)
    })

    proc.on('close', (code: number | null) => {
      // Clean up abort listener
      if (opts.signal) {
        opts.signal.removeEventListener('abort', onAbort)
      }

      if (opts.signal?.aborted) {
        reject(new Error('aborted'))
        return
      }

      if (code === 0) {
        resolve({ stderr })
      } else {
        reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-500)}`))
      }
    })
  })
}

// ---------------------------------------------------------------------------
// probeDuration
// ---------------------------------------------------------------------------

/**
 * Probe the duration (in seconds) of an audio file using ffprobe.
 *
 * Returns `0` on any error (file not found, not a valid media, ffprobe
 * not installed, etc.).
 */
export async function probeDuration(
  filePath: string,
  opts: { ffprobeBin?: string } = {}
): Promise<number> {
  const bin = opts.ffprobeBin ?? 'ffprobe'

  return new Promise<number>((resolve) => {
    const proc = spawn(bin, [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath
    ], {
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let out = ''
    proc.stdout.on('data', (chunk: Buffer) => {
      out += chunk.toString()
    })

    proc.on('close', () => {
      resolve(parseFloat(out) || 0)
    })

    proc.on('error', () => {
      resolve(0)
    })
  })
}

// ---------------------------------------------------------------------------
// High-level: run
// ---------------------------------------------------------------------------

/**
 * Full conversion pipeline: build ffmpeg arguments from options, probe
 * source duration for progress, execute the conversion.
 *
 * @param inputPath  Absolute path to the source audio file.
 * @param outputPath Absolute path for the converted output file.
 * @param options    Encoding options.
 */
export async function run(
  inputPath: string,
  outputPath: string,
  options: FfmpegOptions = {}
): Promise<FfmpegResult> {
  const {
    format = 'mp3',
    bitrate,
    vbr,
    compressionLevel,
    sampleRate,
    bitDepth,
    jointStereo,
    onProgress,
    signal,
    ffmpegBin,
    ffprobeBin
  } = options

  // Resolve binary paths
  const resolvedFfmpegBin = ffmpegBin ?? resolveFfmpegPath({ isPackaged: false, platform: process.platform })
  const resolvedFfprobeBin = ffprobeBin ?? resolveFfprobePath({ isPackaged: false, platform: process.platform })

  // --- Build ffmpeg argument list ---
  const args: string[] = [
    '-y',
    '-i', inputPath,
    '-vn',
    '-map_metadata', '-1',
    '-write_id3v2', '1'
  ]

  switch (format) {
    case 'mp3': {
      args.push('-codec:a', 'libmp3lame', '-b:a', bitrate ?? '320k')
      if (vbr != null) {
        args.push('-q:a', String(vbr))
      }
      if (jointStereo != null) {
        args.push('-joint_stereo', jointStereo ? '1' : '0')
      }
      if (sampleRate != null) {
        args.push('-ar', String(sampleRate))
      }
      break
    }

    case 'flac': {
      args.push('-codec:a', 'flac')
      if (compressionLevel != null) {
        args.push('-compression_level', String(compressionLevel))
      }
      if (bitDepth != null) {
        if (bitDepth === 16) args.push('-sample_fmt', 's16')
        else if (bitDepth === 24) args.push('-sample_fmt', 's32')  // FLAC stores 24-bit in s32
        else if (bitDepth === 32) args.push('-sample_fmt', 's32')
      }
      if (sampleRate != null) {
        args.push('-ar', String(sampleRate))
      }
      break
    }

    case 'wav': {
      if (bitDepth === 24) {
        args.push('-codec:a', 'pcm_s24le')
      } else if (bitDepth === 32) {
        args.push('-codec:a', 'pcm_f32le')
      } else {
        args.push('-codec:a', 'pcm_s16le')
      }
      if (sampleRate != null) {
        args.push('-ar', String(sampleRate))
      }
      break
    }

    case 'm4a':
    case 'aac': {
      args.push('-codec:a', 'aac', '-b:a', bitrate ?? '320k')
      if (vbr != null) {
        args.push('-q:a', String(vbr))
      }
      if (sampleRate != null) {
        args.push('-ar', String(sampleRate))
      }
      break
    }

    case 'ogg':
    case 'opus': {
      args.push('-codec:a', 'libopus', '-b:a', bitrate ?? '192k')
      if (vbr != null) {
        args.push('-vbr', vbr ? '1' : '0')
      }
      if (sampleRate != null) {
        args.push('-ar', String(sampleRate))
      }
      break
    }

    case 'aiff': {
      if (bitDepth === 24) {
        args.push('-codec:a', 'pcm_s24be')
      } else if (bitDepth === 32) {
        args.push('-codec:a', 'pcm_f32be')
      } else {
        args.push('-codec:a', 'pcm_s16be')
      }
      if (sampleRate != null) {
        args.push('-ar', String(sampleRate))
      }
      break
    }

    case 'alac': {
      args.push('-codec:a', 'alac')
      if (bitDepth != null) {
        if (bitDepth === 16) args.push('-sample_fmt', 's16')
        else if (bitDepth === 24 || bitDepth === 32) args.push('-sample_fmt', 's32')
      }
      if (sampleRate != null) {
        args.push('-ar', String(sampleRate))
      }
      break
    }

    default: {
      // Exhaustiveness guard — the union type should make this unreachable
      const _exhaustive: never = format
      throw new Error(`Unsupported output format: ${_exhaustive}`)
    }
  }

  args.push(outputPath)

  // --- Execute ---
  const totalDuration = await probeDuration(inputPath, { ffprobeBin: resolvedFfprobeBin })

  await runFfmpeg(args, {
    onProgress,
    signal,
    totalDurationSec: totalDuration,
    ffmpegBin: resolvedFfmpegBin
  })

  return { outputPath }
}
