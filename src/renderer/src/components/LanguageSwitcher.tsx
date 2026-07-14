/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 */

import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store/useAppStore'

function LanguageSwitcher(): JSX.Element {
  const { i18n, t } = useTranslation()
  const setSettings = useAppStore((s) => s.setSettings)

  const currentLang = i18n.language || 'zh-CN'

  const toggleLanguage = useCallback(async () => {
    const newLang = currentLang === 'zh-CN' ? 'en-US' : 'zh-CN'
    await i18n.changeLanguage(newLang)
    setSettings({ language: newLang })
    window.formatConverter?.setSettings({ language: newLang }).catch(() => {})
  }, [currentLang, i18n, setSettings])

  return (
    <button
      onClick={toggleLanguage}
      style={{
        padding: '4px 10px',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        backgroundColor: 'transparent',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        fontSize: '12px',
        fontFamily: "'IBM Plex Mono', monospace",
        transition: 'all 150ms ease',
        marginRight: '8px'
      }}
      title={t('language.switch')}
    >
      {currentLang === 'zh-CN' ? 'EN' : 'CN'}
    </button>
  )
}

export default LanguageSwitcher
