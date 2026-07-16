/// <reference types="vite/client" />

/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 */

interface FfmpegStatusData {
  available: boolean
  ffmpegPath: string | null
  ffprobePath: string | null
  reason?: string
}

interface PresetData {
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

interface AppSettingsData {
  language: string
  outputDir: string
  filenameTemplate: string
  theme: string
  outputFormat: string
  concurrentLimit: number
  duplicateAction: string
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
  presets: PresetData[]
  customFfmpegPath?: string
  embedCompanionLyrics: boolean
  loudnormEnabled: boolean
  loudnormTarget: number
}

interface FormatConverterAPI {
  selectNcmFiles(): Promise<string[]>
  selectFiles(): Promise<string[]>
  selectFolder(): Promise<string | null>
  selectPlainAudio(): Promise<string[]>
  selectKggDatabase(): Promise<string | null>

  convertFile(payload: {
    filePath: string
    outputDir: string
    filenameTemplate: string
    outputFormat: string
    duplicateAction: string
    bitrate?: string
    vbrEnabled?: boolean
    vbrQuality?: number
    compressionLevel?: number
    sampleRate?: string
    bitDepth?: string
  }): Promise<{
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
  }>

  onConvertProgress(
    callback: (payload: { filePath: string; progress: number }) => void
  ): () => void

  cancelConvert(filePath: string): Promise<void>
  cancelConversions(): Promise<void>

  getHistory(): Promise<{
    ts: number
    inputPath: string
    inputName: string
    targetFormat: string
    status: 'success' | 'failed'
    outputName: string | null
    outputPath: string | null
    durationMs: number | null
    error: string | null
  }[]>

  clearHistory(): Promise<void>
  scanKggKeys(): Promise<{ added: number; total: number }>
  importKggKeys(dbPath: string): Promise<{ success: boolean; added: number; total: number; error?: string }>
  getKggKeyCount(): Promise<number>
  downloadAsZip(payload: { filePaths: string[]; fileNames: string[] }): Promise<{ success: boolean; outputPath?: string; error?: string }>
  revealInFolder(filePath: string): Promise<void>
  openFile(filePath: string): Promise<void>
  selectFfmpegBinary(): Promise<string | null>
  getSettings(): Promise<AppSettingsData>
  setSettings(patch: Record<string, unknown>): Promise<void>
  exportSettings(): Promise<{ success: boolean; error?: string }>
  importSettings(): Promise<{ success: boolean; error?: string }>
  openUrl(url: string): Promise<void>
  showNotification(payload: { title: string; body: string }): Promise<void>
  minimizeWindow(): Promise<void>
  toggleMaximize(): Promise<void>
  isMaximized(): Promise<boolean>
  toggleFullscreen(): Promise<void>
  onMaximizeChange(callback: (isMaximized: boolean) => void): () => void
  getPathForFile(file: File): string

  extractLyrics(filePath: string): Promise<string | null>
  getFfmpegStatus(): Promise<FfmpegStatusData>
  onFfmpegStatusChanged(callback: (status: FfmpegStatusData) => void): () => void
  onFilesOpenedFromOs(callback: (filePaths: string[]) => void): () => void
  getSystemTheme(): Promise<'dark' | 'light'>
  onSystemThemeChanged(callback: (theme: 'dark' | 'light') => void): () => void
  setWindowTitle(title: string): Promise<void>
  setAppIcon(theme: string): Promise<void>
}

declare global {
  interface Window {
    formatConverter: FormatConverterAPI
  }
}
