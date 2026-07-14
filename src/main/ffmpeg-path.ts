/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 *
 * Cross-platform bundled FFmpeg binary path resolver.
 * Binaries are stored in resources/ffmpeg/{platform}/ and copied
 * into the app resources during build (electron-builder extraResources).
 *
 * Dev mode:  {projectRoot}/resources/ffmpeg/{platform}/
 * Packaged:  {process.resourcesPath}/ffmpeg/{platform}/
 */

import { existsSync } from 'fs'
import { join } from 'path'

export interface ResolveOptions {
  isPackaged: boolean
  platform: NodeJS.Platform
  resourcesPath?: string
  customFfmpegPath?: string
  customFfprobePath?: string
}

// ---------------------------------------------------------------------------
// Platform helpers
// ---------------------------------------------------------------------------

/** Electron platform directory name under resources/ffmpeg/ */
function platformDir(platform: NodeJS.Platform): string {
  if (platform === 'win32') return 'win32'
  if (platform === 'darwin') return 'darwin'
  return 'linux'
}

function binExt(platform: NodeJS.Platform): string {
  return platform === 'win32' ? '.exe' : ''
}

// ---------------------------------------------------------------------------
// Resolve bundled directory
// ---------------------------------------------------------------------------

function bundledDir(): string {
  const pDir = platformDir(process.platform)
  // Use process.resourcesPath if available and packaged
  // (test env won't have Electron's app, so we use the env-agnostic check)
  if (process.resourcesPath) {
    return join(process.resourcesPath, 'ffmpeg', pDir)
  }
  // Dev mode: this file compiles to out/main/, resources is ../../resources/
  return join(__dirname, '..', '..', 'resources', 'ffmpeg', pDir)
}

// ---------------------------------------------------------------------------
// Public resolvers
// ---------------------------------------------------------------------------

function resolveBinary(
  name: 'ffmpeg' | 'ffprobe',
  opts: ResolveOptions
): string {
  const ext = binExt(opts.platform)
  const binName = `${name}${ext}`

  // 1) Custom path override
  if (opts.customFfmpegPath && name === 'ffmpeg') return opts.customFfmpegPath
  if (opts.customFfprobePath && name === 'ffprobe') return opts.customFfprobePath

  // 2) Bundled path (dev or packaged) — uses app.isPackaged internally
  const bundle = join(bundledDir(), binName)
  if (existsSync(bundle)) return bundle

  // 3) Fallback — just return the bare command name (will work if on PATH)
  return binName
}

export function resolveFfmpegPath(opts: ResolveOptions): string {
  return resolveBinary('ffmpeg', opts)
}

export function resolveFfprobePath(opts: ResolveOptions): string {
  return resolveBinary('ffprobe', opts)
}
