/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from './store/useAppStore'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import DropZone from './components/DropZone'
import FileList from './components/FileList'
import PlayerBar from './components/PlayerBar'
import SettingsPanel from './components/SettingsPanel'
import HistoryView from './components/HistoryView'
import ConversionSummaryModal from './components/ConversionSummaryModal'
import './i18n'
import './styles/tokens.css'

type ViewType = 'convert' | 'settings' | 'history'

function App(): JSX.Element {
  const { t } = useTranslation()
  const [currentView, setCurrentView] = useState<ViewType>('convert')
  const { settings, setSettings, setFfmpegAvailable } = useAppStore()
  const files = useAppStore((s) => s.files)
  const isConverting = useAppStore((s) => s.isConverting)
  const [summaryModal, setSummaryModal] = useState<{
    success: number
    fail: number
    total: number
    durationMs: number
  } | null>(null)
  const ffmpegChecked = useRef(false)

  // ===== Load settings on mount =====
  useEffect(() => {
    window.formatConverter?.getSettings().then((s) => {
      setSettings(s)
      // Sync i18n language with stored setting
      if (s.language) {
        i18n.changeLanguage(s.language)
      }
    }).catch(() => {
      // Settings store may not be ready, use defaults
    })
  }, [])

  // ===== FFmpeg status check on mount =====
  useEffect(() => {
    if (ffmpegChecked.current) return
    ffmpegChecked.current = true

    window.formatConverter?.getFfmpegStatus().then((status) => {
      setFfmpegAvailable(status.available)
      if (!status.available && status.reason) {
        console.warn('FFmpeg:', status.reason)
      }
    }).catch(() => {})

    const unsub = window.formatConverter?.onFfmpegStatusChanged((status) => {
      setFfmpegAvailable(status.available)
    })
    return () => { unsub?.() }
  }, [])

  // ===== System theme support =====
  const resolveSystemTheme = useCallback(async (): Promise<'dark' | 'light'> => {
    try {
      return await window.formatConverter.getSystemTheme()
    } catch {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
  }, [])

  // Apply theme on settings change
  useEffect(() => {
    const apply = async (): Promise<void> => {
      let theme = settings.theme
      if (theme === 'system') {
        theme = await resolveSystemTheme()
      }
      document.documentElement.dataset.theme = theme
    }
    apply()
  }, [settings.theme, resolveSystemTheme])

  // Listen for OS theme changes
  useEffect(() => {
    if (settings.theme !== 'system') return

    const unsub = window.formatConverter?.onSystemThemeChanged((systemTheme) => {
      document.documentElement.dataset.theme = systemTheme
    })
    // Also listen via CSS media query as fallback
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (): void => {
      if (settings.theme === 'system') {
        document.documentElement.dataset.theme = mq.matches ? 'dark' : 'light'
      }
    }
    mq.addEventListener('change', handler)
    return () => {
      unsub?.()
      mq.removeEventListener('change', handler)
    }
  }, [settings.theme])

  // ===== Window title update (conversion progress) =====
  useEffect(() => {
    if (!isConverting) {
      window.formatConverter?.setWindowTitle('Format Converter')
      return
    }
    const total = files.length
    const done = files.filter((f) => f.status === 'success' || f.status === 'error').length
    if (total > 0) {
      const pct = Math.round((done / total) * 100)
      window.formatConverter?.setWindowTitle(`Format Converter (${pct}%)`)
    }
  }, [isConverting, files])

  // ===== Listen for files opened via OS file association =====
  useEffect(() => {
    const unsub = window.formatConverter?.onFilesOpenedFromOs((filePaths) => {
      const entries = filePaths.map((path) => {
        const parts = path.replace(/\\/g, '/').split('/')
        const fileName = parts[parts.length - 1]
        return {
          id: crypto.randomUUID(),
          filePath: path,
          fileName,
          fileSize: 0,
          status: 'pending' as const,
          progress: 0
        }
      })
      useAppStore.getState().addFiles(entries)
    })
    return () => { unsub?.() }
  }, [])

  // ===== Keyboard shortcuts =====
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault()
        if (isConverting) return
        window.formatConverter.selectFiles().then((paths: string[]) => {
          if (paths.length > 0) {
            const entries = paths.map((path: string) => {
              const parts = path.replace(/\\/g, '/').split('/')
              const fileName = parts[parts.length - 1]
              return {
                id: crypto.randomUUID(),
                filePath: path,
                fileName,
                fileSize: 0,
                status: 'pending' as const,
                progress: 0
              }
            })
            useAppStore.getState().addFiles(entries)
          }
        })
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const state = useAppStore.getState()
        if (state.selectedIds.length > 0) {
          e.preventDefault()
          state.removeSelected()
        }
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        const state = useAppStore.getState()
        if (state.files.length > 0) {
          e.preventDefault()
          if (state.selectedIds.length === state.files.length) {
            state.deselectAll()
          } else {
            state.selectAll()
          }
        }
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isConverting])

  const renderContent = (): JSX.Element => {
    switch (currentView) {
      case 'convert':
        return (
          <div className="flex flex-col flex-1 h-full">
            <DropZone />
            <FileList onConversionComplete={(s, f, d) => setSummaryModal({ success: s, fail: f, total: s + f, durationMs: d })} />
          </div>
        )
      case 'settings':
        return <SettingsPanel />
      case 'history':
        return <HistoryView />
      default:
        return null as unknown as JSX.Element
    }
  }

  return (
    <div className="flex flex-col w-full h-screen" style={{ backgroundColor: 'var(--bg-base)' }}>
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar currentView={currentView} onNavigate={setCurrentView} />
        <main className="flex-1 flex flex-col overflow-hidden" style={{ maxWidth: '960px', margin: '0 auto', width: '100%' }}>
          <div className="flex-1 overflow-y-auto" style={{ padding: 'var(--space-6)' }}>
            {renderContent()}
          </div>
        </main>
      </div>
      <PlayerBar />

      {/* Conversion Summary Modal */}
      {summaryModal && (
        <ConversionSummaryModal
          success={summaryModal.success}
          fail={summaryModal.fail}
          total={summaryModal.total}
          durationMs={summaryModal.durationMs}
          onClose={() => setSummaryModal(null)}
        />
      )}

      {/* Copyright footer */}
      <div
        style={{
          height: '22px',
          fontSize: '11px',
          color: 'var(--text-tertiary)',
          backgroundColor: 'var(--surface-1)',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          letterSpacing: '0.3px'
        }}
      >
        &copy; 2026 Akiro
      </div>
    </div>
  )
}

export default App
