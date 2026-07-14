/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 *
 * KGG key management — loading/saving key files, importing from KuGou
 * KGMusicV3.db (encrypted SQLite), and auto-scanning known installation
 * paths on Windows and macOS.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'
import * as dbCipher from '../core/decoders/kgg/db-cipher'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KggScanResult {
  added: number
  total: number
}

export interface ScanOptions {
  mockPlatform?: NodeJS.Platform
  mockEnv?: Record<string, string | undefined>
  mockPaths?: string[]
}

// ---------------------------------------------------------------------------
// Key file I/O
// ---------------------------------------------------------------------------

/**
 * Loads the keys mapping from a kgg.keys text file.
 * Format is "id$ekey" per line.
 */
export function loadKeysMap(keysPath: string): Map<string, string> {
  const map = new Map<string, string>()
  if (!existsSync(keysPath)) return map

  const text = readFileSync(keysPath, 'utf-8')
  const lines = text.split(/\r?\n/)

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (line.length === 0) continue
    // Skip comment lines
    if (line.startsWith('#')) continue

    const sep = line.indexOf('$')
    if (sep <= 0) continue

    const id = line.slice(0, sep)
    const key = line.slice(sep + 1)
    if (id.length > 0 && key.length > 0) {
      map.set(id, key)
    }
  }

  return map
}

/**
 * Saves the keys mapping to a kgg.keys text file.
 * Sorted by key ID for consistency.
 */
export function saveKeysMap(keysPath: string, map: Map<string, string>): void {
  const sorted = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  const text = sorted.map(([id, key]) => `${id}$${key}`).join('\n') + '\n'
  writeFileSync(keysPath, text, 'utf-8')
}

// ---------------------------------------------------------------------------
// Database decryption helper
// ---------------------------------------------------------------------------

const PAGE_SIZE = 1024

/**
 * Decrypts an encrypted KGMusicV3.db buffer in-place on a copy.
 * Returns a plaintext SQLite buffer.
 */
function decryptDatabaseBuffer(buffer: Buffer): Buffer {
  if (buffer.length < PAGE_SIZE) {
    throw new Error('Database buffer is too small')
  }

  // Work on a copy
  const decrypted = Buffer.alloc(buffer.length, buffer)

  if (dbCipher.isPlaintextHeader(decrypted)) {
    return decrypted
  }

  dbCipher.decryptFirstPage(decrypted.subarray(0, PAGE_SIZE), dbCipher.MASTER_KEY)

  for (let offset = PAGE_SIZE, pageNum = 2; offset < decrypted.length; offset += PAGE_SIZE, pageNum++) {
    const page = decrypted.subarray(offset, offset + PAGE_SIZE)
    if (page.length < PAGE_SIZE) break
    dbCipher.decryptPage(page, pageNum, dbCipher.MASTER_KEY)
  }

  return decrypted
}

// ---------------------------------------------------------------------------
// Key import from SQLite
// ---------------------------------------------------------------------------

/**
 * Imports key maps from an encrypted (or plaintext) KGMusicV3.db buffer.
 * Handles both encrypted and already-decrypted databases.
 */
export async function importFromDb(dbBuffer: Buffer): Promise<Map<string, string>> {
  const sqlJsModule = await import('sql.js')
  const initSqlJs = (sqlJsModule.default || sqlJsModule) as (config?: unknown) => Promise<{
    Database: new (data?: ArrayLike<number> | Buffer | null) => {
      run: (sql: string) => void
      prepare: (sql: string) => {
        step: () => boolean
        getAsObject: () => Record<string, unknown>
        free: () => void
      }
      close: () => void
    }
  }>

  const decrypted = decryptDatabaseBuffer(dbBuffer)
  const SQL = await initSqlJs()
  const db = new SQL.Database(new Uint8Array(decrypted))
  const result = new Map<string, string>()

  try {
    const stmt = db.prepare(`
      SELECT EncryptionKeyId, EncryptionKey FROM ShareFileItems
      WHERE EncryptionKeyId IS NOT NULL AND EncryptionKeyId != ''
        AND EncryptionKey IS NOT NULL AND EncryptionKey != ''
    `)
    while (stmt.step()) {
      const row = stmt.getAsObject()
      result.set(String(row.EncryptionKeyId), String(row.EncryptionKey))
    }
    stmt.free()
  } catch (err) {
    db.close()
    throw new Error(`Failed to query KGG keys from database: ${(err as Error).message}`)
  }

  db.close()
  return result
}

// ---------------------------------------------------------------------------
// Auto-scan known KuGou installation paths
// ---------------------------------------------------------------------------

/**
 * Automatically scans known KuGou installation directories for KGMusicV3.db,
 * extracts decryption keys, and merges them into the local kgg.keys file.
 *
 * On Windows this also attempts a WMI-based full-drive scan as a fallback.
 *
 * @param userDataPath - Directory where kgg.keys is stored (e.g. app userData)
 * @param opts - Optional mock platform/env/paths for testing
 */
export async function autoScanKeys(
  userDataPath: string,
  opts?: ScanOptions,
): Promise<KggScanResult> {
  const platform = opts?.mockPlatform ?? process.platform
  const env = opts?.mockEnv ?? process.env
  const targetKeysPath = join(userDataPath, 'kgg.keys')
  const currentMap = loadKeysMap(targetKeysPath)
  const initialSize = currentMap.size

  // Build list of paths to scan
  const pathsToScan: string[] = opts?.mockPaths ?? buildScanPaths(platform, env)

  for (const dbPath of pathsToScan) {
    if (existsSync(dbPath)) {
      try {
        const buf = readFileSync(dbPath)
        const incoming = await importFromDb(buf)
        for (const [id, val] of incoming.entries()) {
          currentMap.set(id, val)
        }
      } catch {
        // Suppress per-file errors — continue scanning other locations
      }
    }
  }

  const newSize = currentMap.size
  if (newSize > initialSize) {
    saveKeysMap(targetKeysPath, currentMap)
  }

  return { added: newSize - initialSize, total: newSize }
}

// ---------------------------------------------------------------------------
// Path discovery helpers
// ---------------------------------------------------------------------------

/**
 * Builds a list of known KuGou KGMusicV3.db paths for the current platform.
 */
function buildScanPaths(
  platform: NodeJS.Platform,
  env: Record<string, string | undefined>,
): string[] {
  const paths: string[] = []

  if (platform === 'win32') {
    const allUsers = env.ALLUSERSPROFILE || 'C:\\ProgramData'
    const appData = env.APPDATA || ''

    paths.push(
      join(allUsers, 'KuGou', 'KGMusic', 'KGMusicV3.db'),
      join(allUsers, 'KuGou', 'KGMusicV3.db'),
      'C:\\Users\\Public\\KuGou\\KGMusic\\KGMusicV3.db',
    )

    if (appData) {
      paths.push(join(appData, 'KuGou', 'KGMusicV3.db'))
      paths.push(join(appData, 'KuGou8', 'KGMusicV3.db'))
    }

    // Aggressive fallback: check all local drives via WMI
    paths.push(...scanWindowsDrives())
  } else if (platform === 'darwin') {
    const home = env.HOME || ''
    if (home) {
      paths.push(
        join(home, 'Library', 'Application Support', 'KuGou', 'KGMusicV3.db'),
        join(
          home,
          'Library',
          'Containers',
          'com.kugou.mac',
          'Data',
          'Documents',
          'KuGou',
          'KGMusicV3.db',
        ),
      )
    }
  }

  return paths
}

/**
 * Uses WMI to enumerate local drives and builds KuGou DB paths for each.
 */
function scanWindowsDrives(): string[] {
  const paths: string[] = []
  try {
    const output = execSync('wmic logicaldisk get name', {
      encoding: 'utf-8',
      windowsHide: true,
    })
    const drives = output
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => /^[A-Z]:$/.test(l))

    for (const drive of drives) {
      const root = drive + '\\'
      paths.push(
        join(root, 'KuGou', 'KGMusicV3.db'),
        join(root, 'KuGou', 'KGMusic', 'KGMusicV3.db'),
        join(root, 'Program Files', 'KuGou', 'KGMusic', 'KGMusicV3.db'),
        join(root, 'Program Files (x86)', 'KuGou', 'KGMusic', 'KGMusicV3.db'),
      )
    }
  } catch {
    // WMI may not be available on all systems — ignore
  }
  return paths
}
