/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 *
 * FFmpeg bundled binary check.
 * Simply verifies that the bundled ffmpeg/ffprobe exist and are runnable.
 * No auto-detect, no PATH scan, no download — just bundled + optional custom path.
 */

import { execFile } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

export interface FfmpegStatus {
  available: boolean
  ffmpegPath: string | null
  ffprobePath: string | null
  reason?: string
}

// ---------------------------------------------------------------------------
// Platform helpers
// ---------------------------------------------------------------------------

function platformDir(): string {
  const p = process.platform
  if (p === 'win32') return 'win32'
  if (p === 'darwin') return 'darwin'
  return 'linux'
}

function binExt(): string {
  return process.platform === 'win32' ? '.exe' : ''
}

// ---------------------------------------------------------------------------
// Bundled directory resolver
// ---------------------------------------------------------------------------

function bundledDir(): string {
  if (process.resourcesPath) {
    // Packaged: binaries are at process.resourcesPath/ffmpeg/{platform}/
    return join(process.resourcesPath, 'ffmpeg', platformDir())
  }
  // Dev mode: this file compiles to out/main/, resources is ../../resources/
  return join(__dirname, '..', '..', 'resources', 'ffmpeg', platformDir())
}

export function getBundledDir(): string {
  return bundledDir()
}

// ---------------------------------------------------------------------------
// Probe
// ---------------------------------------------------------------------------

function probeBinary(binPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    // FFmpeg uses single-dash long options (-version, -h), not double-dash
    execFile(binPath, ['-version'], { timeout: 8000 }, (err) => {
      resolve(!err)
    })
  })
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check if FFmpeg is available (bundled or custom path).
 */
export async function ensureFfmpeg(customFfmpegPath?: string | null): Promise<FfmpegStatus> {
  const ext = binExt()
  const ffmpegName = `ffmpeg${ext}`
  const ffprobeName = `ffprobe${ext}`

  let ffmpegPath: string | null = null
  let ffprobePath: string | null = null

  // Try custom path first
  if (customFfmpegPath) {
    if (existsSync(customFfmpegPath) && (await probeBinary(customFfmpegPath))) {
      ffmpegPath = customFfmpegPath
      // Derive ffprobe from the same directory
      const probeCandidate = join(customFfmpegPath, '..', ffprobeName)
      if (existsSync(probeCandidate) && (await probeBinary(probeCandidate))) {
        ffprobePath = probeCandidate
      }
    }
  }

  // Fall back to bundled
  if (!ffmpegPath) {
    const bundle = join(bundledDir(), ffmpegName)
    if (existsSync(bundle) && (await probeBinary(bundle))) {
      ffmpegPath = bundle
      const probeCandidate = join(bundledDir(), ffprobeName)
      if (existsSync(probeCandidate) && (await probeBinary(probeCandidate))) {
        ffprobePath = probeCandidate
      }
    }
  }

  if (ffmpegPath && ffprobePath) {
    return { available: true, ffmpegPath, ffprobePath }
  }

  // Build helpful reason
  const missing: string[] = []
  if (!ffmpegPath) missing.push(ffmpegName)
  if (!ffprobePath) missing.push(ffprobeName)
  const reason = `${missing.join(' and ')} not found in bundled directory (${bundledDir()})`
  return { available: false, ffmpegPath: null, ffprobePath: null, reason }
}
