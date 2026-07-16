/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 */

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store/useAppStore'
import LanguageSwitcher from './LanguageSwitcher'
import AppIcon from './AppIcon'

function TitleBar(): JSX.Element {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const setSettings = useAppStore((s) => s.setSettings)
  const [platform, setPlatform] = useState<'win32' | 'darwin' | 'other'>('other')
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    // Detect platform via userAgent
    const ua = navigator.userAgent.toLowerCase()
    if (ua.includes('win')) setPlatform('win32')
    else if (ua.includes('mac')) setPlatform('darwin')
    else setPlatform('other')
  }, [])

  // Track maximize state + F11 fullscreen
  useEffect(() => {
    window.formatConverter?.isMaximized().then(setIsMaximized)
    const unsub = window.formatConverter?.onMaximizeChange(setIsMaximized)

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'F11') {
        e.preventDefault()
        window.formatConverter?.toggleFullscreen()
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      unsub?.()
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  // Apply stored theme on mount
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme
  }, [])

  const handleToggleTheme = useCallback((): void => {
    const newTheme = settings.theme === 'dark' ? 'light' : 'dark'
    setSettings({ theme: newTheme })
    document.documentElement.dataset.theme = newTheme
    window.formatConverter?.setSettings({ theme: newTheme })
  }, [settings.theme, setSettings])

  const handleMinimize = (): void => {
    window.formatConverter?.minimizeWindow()
  }

  const handleClose = (): void => {
    window.close()
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: '36px',
        backgroundColor: 'var(--surface-1)',
        borderBottom: '1px solid var(--border)',
        WebkitAppRegion: 'drag',
        WebkitUserSelect: 'none',
        flexShrink: 0,
        position: 'relative'
      }}
    >
      {/* macOS traffic light spacing */}
      {platform === 'darwin' && <div style={{ width: '78px', flexShrink: 0 }} />}

      {/* Title + icon — centered via flex */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', gap: '8px' }}>
        <AppIcon size={20} />
        <span
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: '14px',
            color: 'var(--accent)',
            letterSpacing: '0.5px',
            whiteSpace: 'nowrap'
          }}
        >
          {t('app.title')}
        </span>
      </div>

      {/* Right-side controls (absolute, out of flex flow — keeps title centered) */}
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          WebkitAppRegion: 'no-drag'
        }}
      >
        <LanguageSwitcher />

        {/* Theme toggle */}
        <button
          onClick={handleToggleTheme}
          style={{
            width: '36px',
            height: '36px',
            border: 'none',
            background: 'transparent',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            transition: 'color 150ms ease'
          }}
          title={t(settings.theme === 'dark' ? 'theme.light' : 'theme.dark')}
        >
          {settings.theme === 'dark' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>

        {/* Windows window controls */}
        {platform === 'win32' && (
          <>
            <button
              onClick={handleMinimize}
              style={{
                width: '46px',
                height: '36px',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px'
              }}
              title={t('titlebar.minimize')}
            >
              ─
            </button>
            <button
              onClick={() => window.formatConverter?.toggleMaximize()}
              style={{
                width: '46px',
                height: '36px',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px'
              }}
              title={t(isMaximized ? 'titlebar.restore' : 'titlebar.maximize')}
            >
              {isMaximized ? (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="2" y="4" width="10" height="8" rx="1" />
                  <path d="M4 4V3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-1" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="1.5" y="1.5" width="11" height="11" rx="1.5" />
                </svg>
              )}
            </button>
            <button
              onClick={handleClose}
              style={{
                width: '46px',
                height: '36px',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                transition: 'background-color 100ms ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#e81123'; e.currentTarget.style.color = '#fff' }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}
              title={t('titlebar.close')}
            >
              ✕
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default TitleBar
