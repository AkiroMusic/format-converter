/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 *
 * Modal shown after a batch conversion completes: success/fail counts,
 * total duration, and a close button.
 */

import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store/useAppStore'

interface Props {
  success: number
  fail: number
  total: number
  durationMs: number
  onClose: () => void
}

function ConversionSummaryModal({ success, fail, total, durationMs, onClose }: Props): JSX.Element {
  const { t } = useTranslation()
  const notificationsEnabled = useAppStore((s) => s.settings.notificationsEnabled)

  // Also fire a system notification if enabled
  useEffect(() => {
    if (!notificationsEnabled) return
    const parts: string[] = []
    if (success > 0) parts.push(t('notification.successCount', { count: success }))
    if (fail > 0) parts.push(t('notification.failCount', { count: fail }))
    if (parts.length > 0) {
      window.formatConverter.showNotification({
        title: t('notification.complete'),
        body: parts.join(' · ')
      }).catch(() => {})
    }
  }, [success, fail, notificationsEnabled, t])

  const fmtDuration = (ms: number): string => {
    const sec = Math.floor(ms / 1000)
    if (sec < 60) return `${sec}s`
    const min = Math.floor(sec / 60)
    const s = sec % 60
    return s > 0 ? `${min}m ${s}s` : `${min}m`
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)'
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '360px',
          padding: 'var(--space-6)',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: 'var(--surface-1)',
          border: '1px solid var(--border)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
        }}
      >
        <h2
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: '20px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: 'var(--space-4)',
            textAlign: 'center'
          }}
        >
          {t('summary.title')}
        </h2>

        {/* Stats */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-6)', marginBottom: 'var(--space-4)' }}>
          {success > 0 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--success)' }}>{success}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{t('summary.success', { count: success })}</div>
            </div>
          )}
          {fail > 0 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--error)' }}>{fail}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{t('summary.fail', { count: fail })}</div>
            </div>
          )}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>{total}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{t('summary.total', { count: total })}</div>
          </div>
        </div>

        {/* Duration */}
        <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>
          {t('summary.duration', { time: fmtDuration(durationMs) })}
        </div>

        {/* Close button */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 32px',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--accent)',
              color: '#12141A',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit'
            }}
          >
            {t('summary.close')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConversionSummaryModal
