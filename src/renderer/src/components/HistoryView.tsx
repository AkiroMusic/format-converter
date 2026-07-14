/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 */

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface HistoryRecord {
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

function formatDuration(ms: number | null): string {
  if (ms === null || ms === 0) return '-'
  return `${(ms / 1000).toFixed(1)}s`
}

function HistoryView(): JSX.Element {
  const { t } = useTranslation()
  const [records, setRecords] = useState<HistoryRecord[]>([])
  const [loading, setLoading] = useState(true)

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    try {
      const data = await window.formatConverter.getHistory()
      setRecords(data)
    } catch {
      // ignore
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const handleClear = useCallback(async () => {
    await window.formatConverter.clearHistory()
    setRecords([])
  }, [])

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '200px',
          color: 'var(--text-secondary)',
          fontSize: '14px'
        }}
      >
        Loading...
      </div>
    )
  }

  if (records.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '200px',
          color: 'var(--text-secondary)',
          fontSize: '14px'
        }}
      >
        {t('history.empty')}
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-6)'
        }}
      >
        <h2
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: '20px',
            color: 'var(--text-primary)',
            fontWeight: 600,
            margin: 0
          }}
        >
          {t('history.title')}
        </h2>
        <button
          onClick={handleClear}
          style={{
            padding: '6px 14px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--surface-2)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: '13px',
            fontFamily: 'inherit',
            transition: 'all 150ms ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--error)'
            e.currentTarget.style.color = 'var(--error)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)'
            e.currentTarget.style.color = 'var(--text-secondary)'
          }}
        >
          {t('history.clear')}
        </button>
      </div>

      {/* Records list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {records.map((record, index) => (
          <div
            key={`${record.ts}-${index}`}
            style={{
              padding: 'var(--space-3) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--surface-1)',
              transition: 'all 150ms ease'
            }}
          >
            {/* Main row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              {/* Status indicator dot */}
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  flexShrink: 0,
                  backgroundColor:
                    record.status === 'success' ? 'var(--success)' : 'var(--error)'
                }}
              />

              {/* Filename */}
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
                title={record.inputName}
              >
                {record.inputName}
              </div>

              {/* Format badge */}
              <div
                style={{
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(108, 140, 255, 0.1)',
                  color: 'var(--accent)',
                  fontSize: '11px',
                  fontWeight: 500,
                  fontFamily: "'IBM Plex Mono', monospace",
                  flexShrink: 0,
                  textTransform: 'uppercase'
                }}
              >
                {record.targetFormat}
              </div>

              {/* Duration */}
              {record.durationMs !== null && record.durationMs > 0 && (
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-tertiary)',
                    fontFamily: "'IBM Plex Mono', monospace",
                    flexShrink: 0,
                    minWidth: '40px',
                    textAlign: 'right'
                  }}
                >
                  {formatDuration(record.durationMs)}
                </div>
              )}

              {/* Status label */}
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  flexShrink: 0,
                  minWidth: '60px',
                  textAlign: 'right',
                  color:
                    record.status === 'success' ? 'var(--success)' : 'var(--error)'
                }}
              >
                {record.status === 'success' ? t('status.success') : t('status.error')}
              </div>

              {/* Timestamp */}
              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--text-tertiary)',
                  flexShrink: 0,
                  minWidth: '80px',
                  textAlign: 'right'
                }}
              >
                {new Date(record.ts).toLocaleString()}
              </div>
            </div>

            {/* Error message or output path */}
            {record.status === 'failed' && record.error && (
              <div
                style={{
                  marginTop: 'var(--space-2)',
                  fontSize: '12px',
                  color: 'var(--error)',
                  lineHeight: 1.4,
                  paddingLeft: '20px'
                }}
              >
                {record.error}
              </div>
            )}
            {record.status === 'success' && record.outputPath && (
              <div
                style={{
                  marginTop: 'var(--space-2)',
                  fontSize: '11px',
                  color: 'var(--text-tertiary)',
                  fontFamily: "'IBM Plex Mono', monospace",
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  lineHeight: 1.4,
                  paddingLeft: '20px'
                }}
                title={record.outputPath}
              >
                {record.outputPath}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default HistoryView
