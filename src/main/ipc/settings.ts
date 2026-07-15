/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 */

import { ipcMain, dialog } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { SimpleStore } from '../simpleStore'

export interface Preset {
  id: string
  name: string
  outputFormat: string
  bitrate: string
  vbrEnabled: boolean
  vbrQuality: number
  compressionLevel: number
  sampleRate: string
  bitDepth: string
}

const DEFAULT_PRESETS: Preset[] = [
  {
    id: 'standard',
    name: 'Standard',
    outputFormat: 'source',
    bitrate: '320k',
    vbrEnabled: false,
    vbrQuality: 0,
    compressionLevel: 5,
    sampleRate: 'original',
    bitDepth: 'original'
  },
  {
    id: 'podcast',
    name: 'Podcast',
    outputFormat: 'mp3',
    bitrate: '128k',
    vbrEnabled: true,
    vbrQuality: 5,
    compressionLevel: 0,
    sampleRate: '44100',
    bitDepth: 'original'
  },
  {
    id: 'hifi',
    name: 'Hi-Fi',
    outputFormat: 'flac',
    bitrate: '320k',
    vbrEnabled: false,
    vbrQuality: 0,
    compressionLevel: 8,
    sampleRate: 'original',
    bitDepth: 'original'
  },
  {
    id: 'archive',
    name: 'Archive',
    outputFormat: 'flac',
    bitrate: '320k',
    vbrEnabled: false,
    vbrQuality: 0,
    compressionLevel: 12,
    sampleRate: 'original',
    bitDepth: '24'
  }
]

interface AppSettings {
  language: string
  outputDir: string
  filenameTemplate: string
  theme: string
  outputFormat: string
  bitrate: string
  vbrEnabled: boolean
  vbrQuality: number
  compressionLevel: number
  sampleRate: string
  bitDepth: string
  qmcEkey: string
  kggKeyImportPath: string
  autoConcurrent: boolean
  notificationsEnabled: boolean
  selectedPreset: string
  presets: Preset[]
  concurrentLimit: number
  duplicateAction: string
  embedCompanionLyrics: boolean
  loudnormEnabled: boolean
  loudnormTarget: number
}

const store = new SimpleStore<AppSettings>({
  name: 'settings',
  defaults: {
    language: 'zh-CN',
    outputDir: '',
    filenameTemplate: '{artist} - {title}',
    theme: 'dark',
    outputFormat: 'source',
    concurrentLimit: 3,
    duplicateAction: 'rename',
    bitrate: '320k',
    vbrEnabled: false,
    vbrQuality: 0,
    compressionLevel: 5,
    sampleRate: 'original',
    bitDepth: 'original',
    qmcEkey: '',
    kggKeyImportPath: '',
    autoConcurrent: true,
    notificationsEnabled: true,
    selectedPreset: 'standard',
    presets: DEFAULT_PRESETS,
    embedCompanionLyrics: true,
    loudnormEnabled: false,
    loudnormTarget: -14
  }
})

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', async (): Promise<AppSettings> => {
    return store.store
  })

  ipcMain.handle('settings:set', async (_event, patch: Partial<AppSettings>): Promise<void> => {
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) {
        store.set(key as keyof AppSettings, value)
      }
    }
  })

  ipcMain.handle('settings:export', async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await dialog.showSaveDialog({
        title: 'Export Settings',
        defaultPath: 'format-converter-settings.json',
        filters: [{ name: 'JSON Settings', extensions: ['json'] }]
      })
      if (result.canceled || !result.filePath) {
        return { success: false, error: 'Save cancelled' }
      }
      await writeFile(result.filePath, JSON.stringify(store.store, null, 2), 'utf-8')
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('settings:import', async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Import Settings',
        filters: [{ name: 'JSON Settings', extensions: ['json'] }],
        properties: ['openFile']
      })
      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: 'Open cancelled' }
      }
      const raw = await readFile(result.filePaths[0], 'utf-8')
      const imported = JSON.parse(raw)

      // Apply each key to the store
      for (const [key, value] of Object.entries(imported)) {
        if (value !== undefined && key !== 'language') {
          // Don't override language
          ;(store as any).set(key, value)
        }
      }
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })
}

export { store as settingsStore }
