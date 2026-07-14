#!/usr/bin/env node
/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 *
 * Download bundled FFmpeg/FFprobe binaries from ffbinaries.com.
 *
 * Usage:
 *   node scripts/download-ffmpeg.mjs          # current platform only
 *   node scripts/download-ffmpeg.mjs --all     # all platforms (win32, darwin, linux)
 *
 * Binaries are placed in resources/ffmpeg/{platform}/.
 */

import { existsSync, mkdirSync, chmodSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const FFBINARIES_API = 'https://ffbinaries.com/api/v1/version/latest'

// ---------------------------------------------------------------------------
// Platform mappings
// ---------------------------------------------------------------------------

const PLATFORM_MAP = {
  'windows-64': { dir: 'win32', ext: '.exe' },
  'osx-64':     { dir: 'darwin', ext: '' },
  'osx-arm64':  { dir: 'darwin', ext: '' },
  'linux-64':   { dir: 'linux',  ext: '' },
}

function currentPlatformCode() {
  const { platform, arch } = process
  if (platform === 'win32') return 'windows-64'
  if (platform === 'darwin') return arch === 'arm64' ? 'osx-arm64' : 'osx-64'
  return 'linux-64'
}

function platformsToDownload(all) {
  if (all) return Object.keys(PLATFORM_MAP)
  return [currentPlatformCode()]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchZipBuffer(url) {
  console.log(`[ffmpeg-download]   fetching ${url}...`)
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  return Buffer.from(await resp.arrayBuffer())
}

async function extractFromZip(zipBuf, name, outPath) {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(zipBuf)
  const entry = zip.file(name) || zip.file(name.replace('.exe', ''))
  if (!entry) return false
  const data = Buffer.from(await entry.async('uint8array'))
  writeFileSync(outPath, data)
  try { chmodSync(outPath, 0o755) } catch { /* best-effort */ }
  return true
}

// ---------------------------------------------------------------------------
// Download one platform
// ---------------------------------------------------------------------------

async function downloadPlatform(plat, versionInfo) {
  const platCfg = PLATFORM_MAP[plat]
  if (!platCfg) {
    console.warn(`[ffmpeg-download] ⚠ Unknown platform code: ${plat}, skipping`)
    return false
  }

  const { dir: targetDir, ext: suf } = platCfg
  const outDir = join(ROOT, 'resources', 'ffmpeg', targetDir)
  const binInfo = versionInfo?.bin?.[plat]
  if (!binInfo?.ffmpeg) {
    console.warn(`[ffmpeg-download] ⚠ No download URL for ${plat}, skipping`)
    return false
  }

  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

  const ffmpegName = `ffmpeg${suf}`
  const ffmpegOut = join(outDir, ffmpegName)
  let ffmpegZipBuf = null

  if (existsSync(ffmpegOut)) {
    console.log(`[ffmpeg-download] ✓ ${targetDir}/${ffmpegName} already exists, skipping`)
  } else {
    ffmpegZipBuf = await fetchZipBuffer(binInfo.ffmpeg)
    const ok = await extractFromZip(ffmpegZipBuf, ffmpegName, ffmpegOut)
    if (!ok) throw new Error(`Could not find ${ffmpegName} in archive`)
    console.log(`[ffmpeg-download] ✓ ${targetDir}/${ffmpegName} saved`)
  }

  const ffprobeName = `ffprobe${suf}`
  const ffprobeOut = join(outDir, ffprobeName)

  if (existsSync(ffprobeOut)) {
    console.log(`[ffmpeg-download] ✓ ${targetDir}/${ffprobeName} already exists, skipping`)
  } else {
    let found = false
    if (ffmpegZipBuf) {
      found = await extractFromZip(ffmpegZipBuf, ffprobeName, ffprobeOut)
    } else {
      const buf = await fetchZipBuffer(binInfo.ffmpeg)
      found = await extractFromZip(buf, ffprobeName, ffprobeOut)
    }
    if (!found && binInfo.ffprobe) {
      console.log(`[ffmpeg-download]   ffprobe not in ffmpeg archive, downloading separately...`)
      const buf = await fetchZipBuffer(binInfo.ffprobe)
      found = await extractFromZip(buf, ffprobeName, ffprobeOut)
    }
    if (found) {
      console.log(`[ffmpeg-download] ✓ ${targetDir}/${ffprobeName} saved`)
    } else {
      console.warn(`[ffmpeg-download] ⚠ Could not find ${targetDir}/${ffprobeName}`)
    }
  }

  // Verify
  const ffmpegOk = existsSync(ffmpegOut)
  const ffprobeOk = existsSync(ffprobeOut)
  if (!ffmpegOk || !ffprobeOk) {
    if (!ffmpegOk) console.error(`[ffmpeg-download] ❌ ${targetDir}/${ffmpegName} missing`)
    if (!ffprobeOk) console.error(`[ffmpeg-download] ❌ ${targetDir}/${ffprobeName} missing`)
    return false
  }
  return true
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const all = process.argv.includes('--all')
  const targets = platformsToDownload(all)

  console.log(`[ffmpeg-download] Targets: ${targets.join(', ')}`)
  console.log('[ffmpeg-download] Fetching version info from ffbinaries.com...')

  const resp = await fetch(FFBINARIES_API)
  if (!resp.ok) throw new Error(`API request failed: HTTP ${resp.status}`)
  const data = await resp.json()
  const version = data.version || 'latest'
  console.log(`[ffmpeg-download] Latest version: ${version}\n`)

  let allOk = true
  for (const plat of targets) {
    const ok = await downloadPlatform(plat, data)
    if (!ok) allOk = false
  }

  if (allOk) {
    console.log(`\n[ffmpeg-download] ✅ All platforms ready (version ${version})`)
  } else {
    console.error(`\n[ffmpeg-download] ❌ Some downloads failed`)
    // Don't exit with error — missing platform URLs (e.g. osx-arm64 on ffbinaries)
    // are just warnings. The build step will handle FFmpeg absence gracefully.
  }
}

main().catch((err) => {
  console.error(`[ffmpeg-download] ❌ ${err.message}`)
  process.exit(1)
})
