/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 */

/**
 * Simple JSON file-based settings store.
 * Replaces electron-store which is ESM-only and incompatible with
 * the CJS main process bundle.
 */

import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'

interface StoredData {
  [key: string]: unknown
}

export class SimpleStore<T extends StoredData> {
  private data: T
  private filePath: string

  constructor(private readonly options: { defaults: T; name?: string }) {
    const userDataPath = app.getPath('userData')
    const fileName = options.name ? `${options.name}.json` : 'config.json'
    this.filePath = join(userDataPath, fileName)

    // Ensure userData directory exists
    if (!existsSync(userDataPath)) {
      mkdirSync(userDataPath, { recursive: true })
    }

    // Load existing data or use defaults
    this.data = this.load()
  }

  private load(): T {
    try {
      if (existsSync(this.filePath)) {
        const raw = readFileSync(this.filePath, 'utf-8')
        return { ...this.options.defaults, ...JSON.parse(raw) }
      }
    } catch {
      // If file is corrupted, fall back to defaults
    }
    return { ...this.options.defaults }
  }

  private save(): void {
    try {
      const dir = dirname(this.filePath)
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
      writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8')
    } catch (err) {
      console.error('SimpleStore: failed to save', err)
    }
  }

  get store(): T {
    return { ...this.data }
  }

  get<K extends keyof T>(key: K): T[K] {
    return this.data[key]
  }

  set<K extends keyof T>(key: K, value: T[K]): void {
    this.data[key] = value
    this.save()
  }
}
