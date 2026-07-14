/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 *
 * JSONL-based conversion history store.
 * Persists to a JSONL file in the user's application data directory.
 * Keeps a maximum of 500 records, newest first on retrieval.
 */

import { appendFile, readFile, unlink, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'

export interface HistoryRecord {
  ts: number
  inputPath: string
  inputName: string
  targetFormat: string
  status: 'success' | 'failed'
  outputName: string | null
  outputPath: string | null
  durationMs: number | null
  error: string | null
}

export class HistoryStore {
  private readonly filePath: string
  private readonly maxEntries: number

  constructor(userDataDir: string, maxEntries: number = 500) {
    this.filePath = join(userDataDir, 'history.jsonl')
    this.maxEntries = maxEntries
  }

  /**
   * Append a record to the history file, then trim if needed.
   */
  async append(record: HistoryRecord): Promise<void> {
    try {
      const line = JSON.stringify(record) + '\n'
      await appendFile(this.filePath, line, 'utf-8')
      await this.trimIfNeeded()
    } catch (err) {
      console.error('HistoryStore.append failed:', err)
    }
  }

  /**
   * Read all history records, newest first.
   */
  async readAll(): Promise<HistoryRecord[]> {
    try {
      if (!existsSync(this.filePath)) {
        return []
      }

      const raw = await readFile(this.filePath, 'utf-8')
      const lines = raw.split('\n').filter((l) => l.trim().length > 0)

      const records: HistoryRecord[] = []
      for (const line of lines) {
        try {
          records.push(JSON.parse(line) as HistoryRecord)
        } catch {
          // Skip malformed lines
        }
      }

      return records.reverse()
    } catch (err) {
      console.error('HistoryStore.readAll failed:', err)
      return []
    }
  }

  /**
   * Clear all history by deleting the file.
   */
  async clear(): Promise<void> {
    try {
      if (existsSync(this.filePath)) {
        await unlink(this.filePath)
      }
    } catch (err) {
      console.error('HistoryStore.clear failed:', err)
    }
  }

  /**
   * Trim the file to keep only the last `maxEntries` lines.
   * Called automatically after append if file exceeds maxEntries.
   */
  private async trimIfNeeded(): Promise<void> {
    try {
      if (!existsSync(this.filePath)) {
        return
      }

      const raw = await readFile(this.filePath, 'utf-8')
      const lines = raw.split('\n').filter((l) => l.trim().length > 0)

      if (lines.length <= this.maxEntries) {
        return
      }

      const trimmed = lines.slice(lines.length - this.maxEntries)
      const content = trimmed.join('\n') + '\n'
      await writeFile(this.filePath, content, 'utf-8')
    } catch (err) {
      console.error('HistoryStore.trimIfNeeded failed:', err)
    }
  }
}
