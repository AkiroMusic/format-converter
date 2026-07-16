/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 */

import { contextBridge, ipcRenderer, webUtils } from 'electron'

const formatConverterAPI = {
  selectNcmFiles: (): Promise<string[]> =>
    ipcRenderer.invoke('dialog:selectNcmFiles'),

  selectFiles: (): Promise<string[]> =>
    ipcRenderer.invoke('dialog:selectFiles'),

  selectFolder: (): Promise<string | null> =>
    ipcRenderer.invoke('dialog:selectFolder'),

  selectPlainAudio: (): Promise<string[]> =>
    ipcRenderer.invoke('dialog:selectPlainAudio'),

  selectKggDatabase: (): Promise<string | null> =>
    ipcRenderer.invoke('dialog:selectKggDatabase'),

  convertFile: (payload: {
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
  }> => ipcRenderer.invoke('convert:file', payload),

  onConvertProgress: (
    callback: (payload: { filePath: string; progress: number }) => void
  ): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: { filePath: string; progress: number }) =>
      callback(payload)
    ipcRenderer.on('convert:progress', handler)
    return () => ipcRenderer.removeListener('convert:progress', handler)
  },

  cancelConvert: (filePath: string): Promise<void> =>
    ipcRenderer.invoke('convert:cancel', filePath),

  cancelConversions: (): Promise<void> =>
    ipcRenderer.invoke('convert:cancelAll'),

  getHistory: (): Promise<{
    ts: number
    inputPath: string
    inputName: string
    targetFormat: string
    status: 'success' | 'failed'
    outputName: string | null
    outputPath: string | null
    durationMs: number | null
    error: string | null
  }[]> => ipcRenderer.invoke('history:getAll'),

  clearHistory: (): Promise<void> =>
    ipcRenderer.invoke('history:clear'),

  scanKggKeys: (): Promise<{ added: number; total: number }> =>
    ipcRenderer.invoke('kgg:scan'),

  importKggKeys: (dbPath: string): Promise<{ success: boolean; added: number; total: number; error?: string }> =>
    ipcRenderer.invoke('kgg:importFromFile', dbPath),

  getKggKeyCount: (): Promise<number> =>
    ipcRenderer.invoke('kgg:getKeyCount'),

  downloadAsZip: (payload: { filePaths: string[]; fileNames: string[] }): Promise<{ success: boolean; outputPath?: string; error?: string }> =>
    ipcRenderer.invoke('convert:downloadAsZip', payload),

  revealInFolder: (filePath: string): Promise<void> =>
    ipcRenderer.invoke('fs:revealInFolder', filePath),

  openFile: (filePath: string): Promise<void> =>
    ipcRenderer.invoke('fs:openFile', filePath),

  selectFfmpegBinary: (): Promise<string | null> =>
    ipcRenderer.invoke('dialog:selectFfmpegBinary'),

  getSettings: (): Promise<Record<string, unknown>> =>
    ipcRenderer.invoke('settings:get'),

  setSettings: (patch: Record<string, unknown>): Promise<void> =>
    ipcRenderer.invoke('settings:set', patch),

  exportSettings: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('settings:export'),

  importSettings: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('settings:import'),

  openUrl: (url: string): Promise<void> =>
    ipcRenderer.invoke('shell:openUrl', url),

  showNotification: (payload: { title: string; body: string }): Promise<void> =>
    ipcRenderer.invoke('notification:show', payload),

  minimizeWindow: (): Promise<void> =>
    ipcRenderer.invoke('window:minimize'),

  toggleMaximize: (): Promise<void> =>
    ipcRenderer.invoke('window:maximize'),

  isMaximized: (): Promise<boolean> =>
    ipcRenderer.invoke('window:isMaximized'),

  toggleFullscreen: (): Promise<void> =>
    ipcRenderer.invoke('window:fullscreen'),

  onMaximizeChange: (
    callback: (isMaximized: boolean) => void
  ): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, isMaximized: boolean) =>
      callback(isMaximized)
    ipcRenderer.on('window:maximizeChanged', handler)
    return () => ipcRenderer.removeListener('window:maximizeChanged', handler)
  },

  extractLyrics: (filePath: string): Promise<string | null> =>
    ipcRenderer.invoke('lyrics:extract', filePath),

  getPathForFile: (file: File): string => {
    return webUtils.getPathForFile(file)
  },

  // FFmpeg status
  getFfmpegStatus: (): Promise<{ available: boolean; ffmpegPath: string | null; ffprobePath: string | null; reason?: string }> =>
    ipcRenderer.invoke('ffmpeg:getStatus'),

  onFfmpegStatusChanged: (
    callback: (status: { available: boolean; ffmpegPath: string | null; ffprobePath: string | null; reason?: string }) => void
  ): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: { available: boolean; ffmpegPath: string | null; ffprobePath: string | null; reason?: string }) =>
      callback(status)
    ipcRenderer.on('ffmpeg:statusChanged', handler)
    return () => ipcRenderer.removeListener('ffmpeg:statusChanged', handler)
  },

  // Listen for files opened via OS file association
  onFilesOpenedFromOs: (
    callback: (filePaths: string[]) => void
  ): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, filePaths: string[]) =>
      callback(filePaths)
    ipcRenderer.on('files:openedFromOs', handler)
    return () => ipcRenderer.removeListener('files:openedFromOs', handler)
  },

  getSystemTheme: (): Promise<'dark' | 'light'> =>
    ipcRenderer.invoke('theme:getSystemTheme'),

  onSystemThemeChanged: (
    callback: (theme: 'dark' | 'light') => void
  ): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, theme: 'dark' | 'light') =>
      callback(theme)
    ipcRenderer.on('theme:systemChanged', handler)
    return () => ipcRenderer.removeListener('theme:systemChanged', handler)
  },

  setWindowTitle: (title: string): Promise<void> =>
    ipcRenderer.invoke('window:setTitle', title),

  setAppIcon: (theme: string): Promise<void> =>
    ipcRenderer.invoke('window:setAppIcon', theme)
}

contextBridge.exposeInMainWorld('formatConverter', formatConverterAPI)
