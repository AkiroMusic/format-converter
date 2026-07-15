/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 */

import { create } from 'zustand'

export interface FileEntry {
  id: string
  filePath: string
  fileName: string
  fileSize: number
  status: 'pending' | 'converting' | 'success' | 'error'
  progress: number
  format?: string
  songName?: string
  artist?: string
  album?: string
  coverImageBase64?: string
  outputPath?: string
  errorMessage?: string
  estimatedOutputSize?: number
}

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

export interface AppSettings {
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
  presets: Preset[]
  customFfmpegPath?: string
  embedCompanionLyrics: boolean
  loudnormEnabled: boolean
  loudnormTarget: number
}

interface AppState {
  files: FileEntry[]
  stats: { total: number; success: number; fail: number }
  settings: AppSettings
  isConverting: boolean
  currentPreviewId: string | null
  outputDir: string | null
  selectedIds: string[]
  volume: number
  cancellingFiles: string[]

  // Actions
  addFiles: (entries: FileEntry[]) => void
  removeFile: (id: string) => void
  moveFile: (fromIndex: number, toIndex: number) => void
  clearAll: () => void
  updateFileProgress: (filePath: string, progress: number) => void
  setFileSuccess: (filePath: string, result: Partial<FileEntry>) => void
  setFileError: (filePath: string, errorMessage: string) => void
  setConverting: (converting: boolean) => void
  setOutputDir: (dir: string | null) => void
  setSettings: (settings: Partial<AppSettings>) => void
  setCurrentPreview: (id: string | null) => void
  resetStats: () => void

  // Selection
  toggleSelect: (id: string) => void
  selectAll: () => void
  deselectAll: () => void
  removeSelected: () => void

  // Settings actions
  setOutputFormat: (format: string) => void
  setConcurrentLimit: (limit: number) => void
  setDuplicateAction: (action: string) => void

  // Retry
  retryFile: (id: string) => void
  retryAll: () => void

  // Player
  setVolume: (volume: number) => void

  // Cancel
  cancelFile: (filePath: string) => void

  // FFmpeg status
  ffmpegAvailable: boolean
  setFfmpegAvailable: (available: boolean) => void

  // Pause / Resume
  isPaused: boolean
  setPaused: (paused: boolean) => void

  // Quality settings
  setBitrate: (bitrate: string) => void
  setVbrEnabled: (enabled: boolean) => void
  setVbrQuality: (quality: number) => void
  setCompressionLevel: (level: number) => void
  setSampleRate: (rate: string) => void
  setBitDepth: (depth: string) => void
  setQmcEkey: (ekey: string) => void
  setAutoConcurrent: (enabled: boolean) => void
}

const DEFAULT_PRESETS: Preset[] = [
  { id: 'standard', name: 'Standard', outputFormat: 'source', bitrate: '320k', vbrEnabled: false, vbrQuality: 0, compressionLevel: 5, sampleRate: 'original', bitDepth: 'original' },
  { id: 'podcast', name: 'Podcast', outputFormat: 'mp3', bitrate: '128k', vbrEnabled: true, vbrQuality: 5, compressionLevel: 0, sampleRate: '44100', bitDepth: 'original' },
  { id: 'hifi', name: 'Hi-Fi', outputFormat: 'flac', bitrate: '320k', vbrEnabled: false, vbrQuality: 0, compressionLevel: 8, sampleRate: 'original', bitDepth: 'original' },
  { id: 'archive', name: 'Archive', outputFormat: 'flac', bitrate: '320k', vbrEnabled: false, vbrQuality: 0, compressionLevel: 12, sampleRate: 'original', bitDepth: '24' }
]

export const useAppStore = create<AppState>((set) => ({
  files: [],
  stats: { total: 0, success: 0, fail: 0 },
  settings: {
    language: 'en-US',
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
  },
  isConverting: false,
  currentPreviewId: null,
  outputDir: null,
  selectedIds: [],
  volume: 0.7,
  cancellingFiles: [],
  ffmpegAvailable: true,
  isPaused: false,

  addFiles: (entries) =>
    set((state) => ({
      files: [...state.files, ...entries],
      stats: {
        ...state.stats,
        total: state.stats.total + entries.length
      }
    })),

  removeFile: (id) =>
    set((state) => {
      const file = state.files.find((f) => f.id === id)
      const statsDiff = {
        total: file && file.status === 'pending' ? -1 : 0,
        success: file && file.status === 'success' ? -1 : 0,
        fail: file && file.status === 'error' ? -1 : 0
      }
      return {
        files: state.files.filter((f) => f.id !== id),
        selectedIds: state.selectedIds.filter((sid) => sid !== id),
        stats: {
          total: state.stats.total + statsDiff.total,
          success: state.stats.success + statsDiff.success,
          fail: state.stats.fail + statsDiff.fail
        }
      }
    }),

  moveFile: (fromIndex, toIndex) =>
    set((state) => {
      const newFiles = [...state.files]
      const [moved] = newFiles.splice(fromIndex, 1)
      newFiles.splice(toIndex, 0, moved)
      return { files: newFiles }
    }),

  clearAll: () =>
    set({
      files: [],
      stats: { total: 0, success: 0, fail: 0 },
      currentPreviewId: null,
      selectedIds: []
    }),

  updateFileProgress: (filePath, progress) =>
    set((state) => ({
      files: state.files.map((f) =>
        f.filePath === filePath ? { ...f, progress, status: 'converting' as const } : f
      )
    })),

  setFileSuccess: (filePath, result) =>
    set((state) => ({
      files: state.files.map((f) =>
        f.filePath === filePath
          ? { ...f, ...result, status: 'success' as const, progress: 1 }
          : f
      ),
      stats: {
        ...state.stats,
        success: state.stats.success + 1
      }
    })),

  setFileError: (filePath, errorMessage) =>
    set((state) => ({
      files: state.files.map((f) =>
        f.filePath === filePath
          ? { ...f, status: 'error' as const, errorMessage, progress: 0 }
          : f
      ),
      stats: {
        ...state.stats,
        fail: state.stats.fail + 1
      }
    })),

  setConverting: (converting) => set({ isConverting: converting }),

  setOutputDir: (dir) => set({ outputDir: dir }),

  setSettings: (settings) =>
    set((state) => ({
      settings: { ...state.settings, ...settings }
    })),

  setCurrentPreview: (id) => set({ currentPreviewId: id }),

  resetStats: () =>
    set({ stats: { total: 0, success: 0, fail: 0 } }),

  // === New: Selection ===
  toggleSelect: (id) =>
    set((state) => ({
      selectedIds: state.selectedIds.includes(id)
        ? state.selectedIds.filter((sid) => sid !== id)
        : [...state.selectedIds, id]
    })),

  selectAll: () =>
    set((state) => ({
      selectedIds: state.files.map((f) => f.id)
    })),

  deselectAll: () =>
    set({ selectedIds: [] }),

  removeSelected: () =>
    set((state) => {
      const selectedSet = new Set(state.selectedIds)
      const remaining = state.files.filter((f) => !selectedSet.has(f.id))
      const removedStats = { total: 0, success: 0, fail: 0 }
      for (const f of state.files) {
        if (selectedSet.has(f.id)) {
          if (f.status === 'pending') removedStats.total++
          else if (f.status === 'success') removedStats.success++
          else if (f.status === 'error') removedStats.fail++
        }
      }
      return {
        files: remaining,
        selectedIds: [],
        stats: {
          total: Math.max(0, state.stats.total - removedStats.total),
          success: Math.max(0, state.stats.success - removedStats.success),
          fail: Math.max(0, state.stats.fail - removedStats.fail)
        }
      }
    }),

  // === New: Format ===
  setOutputFormat: (format) =>
    set((state) => {
      const newSettings = { ...state.settings, outputFormat: format }
      return { settings: newSettings }
    }),

  setConcurrentLimit: (limit) =>
    set((state) => {
      const newSettings = { ...state.settings, concurrentLimit: limit }
      return { settings: newSettings }
    }),

  setDuplicateAction: (action) =>
    set((state) => {
      const newSettings = { ...state.settings, duplicateAction: action }
      return { settings: newSettings }
    }),

  // === New: Retry ===
  retryFile: (id) =>
    set((state) => ({
      files: state.files.map((f) =>
        f.id === id && (f.status === 'error' || f.status === 'success')
          ? { ...f, status: 'pending' as const, progress: 0, errorMessage: undefined }
          : f
      ),
      stats: {
        ...state.stats,
        success: Math.max(0, state.stats.success - (state.files.find((f) => f.id === id && f.status === 'success') ? 1 : 0)),
        fail: Math.max(0, state.stats.fail - (state.files.find((f) => f.id === id && f.status === 'error') ? 1 : 0))
      }
    })),

  retryAll: () =>
    set((state) => {
      let successDeduction = 0
      let failDeduction = 0
      const newFiles = state.files.map((f) => {
        if (f.status === 'error') {
          failDeduction++
          return { ...f, status: 'pending' as const, progress: 0, errorMessage: undefined }
        }
        if (f.status === 'success') {
          successDeduction++
          return { ...f, status: 'pending' as const, progress: 0, errorMessage: undefined }
        }
        return f
      })
      return {
        files: newFiles,
        stats: {
          ...state.stats,
          success: Math.max(0, state.stats.success - successDeduction),
          fail: Math.max(0, state.stats.fail - failDeduction)
        }
      }
    }),

  // === New: Player volume ===
  setVolume: (volume) => set({ volume }),

  // === FFmpeg status ===
  setFfmpegAvailable: (available) => set({ ffmpegAvailable: available }),

  // === Pause / Resume ===
  setPaused: (paused) => set({ isPaused: paused }),

  // === Cancel ===
  cancelFile: (filePath) =>
    set((state) => {
      window.formatConverter.cancelConvert(filePath).catch(() => {})
      return {
        cancellingFiles: [...state.cancellingFiles, filePath],
        files: state.files.map((f) =>
          f.filePath === filePath ? { ...f, status: 'pending' as const } : f
        )
      }
    }),

  // === Quality settings ===
  setBitrate: (bitrate) =>
    set((state) => {
      const newSettings = { ...state.settings, bitrate }
      window.formatConverter.setSettings({ bitrate }).catch(() => {})
      return { settings: newSettings }
    }),

  setVbrEnabled: (vbrEnabled) =>
    set((state) => {
      const newSettings = { ...state.settings, vbrEnabled }
      window.formatConverter.setSettings({ vbrEnabled }).catch(() => {})
      return { settings: newSettings }
    }),

  setVbrQuality: (vbrQuality) =>
    set((state) => {
      const newSettings = { ...state.settings, vbrQuality }
      window.formatConverter.setSettings({ vbrQuality }).catch(() => {})
      return { settings: newSettings }
    }),

  setCompressionLevel: (compressionLevel) =>
    set((state) => {
      const newSettings = { ...state.settings, compressionLevel }
      window.formatConverter.setSettings({ compressionLevel }).catch(() => {})
      return { settings: newSettings }
    }),

  setSampleRate: (sampleRate) =>
    set((state) => {
      const newSettings = { ...state.settings, sampleRate }
      window.formatConverter.setSettings({ sampleRate }).catch(() => {})
      return { settings: newSettings }
    }),

  setBitDepth: (bitDepth) =>
    set((state) => {
      const newSettings = { ...state.settings, bitDepth }
      window.formatConverter.setSettings({ bitDepth }).catch(() => {})
      return { settings: newSettings }
    }),

  setQmcEkey: (qmcEkey) =>
    set((state) => {
      const newSettings = { ...state.settings, qmcEkey }
      window.formatConverter.setSettings({ qmcEkey }).catch(() => {})
      return { settings: newSettings }
    }),

  setAutoConcurrent: (autoConcurrent) =>
    set((state) => {
      const newSettings = { ...state.settings, autoConcurrent }
      window.formatConverter.setSettings({ autoConcurrent }).catch(() => {})
      return { settings: newSettings }
    })
}))
