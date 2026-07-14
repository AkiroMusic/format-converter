/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store/useAppStore'
import FileItem from './FileItem'

interface Props {
  onConversionComplete?: (success: number, fail: number, total: number, durationMs: number) => void
}

function FileList({ onConversionComplete }: Props): JSX.Element {
  const { t } = useTranslation()
  const files = useAppStore((s) => s.files)
  const stats = useAppStore((s) => s.stats)
  const isConverting = useAppStore((s) => s.isConverting)
  const isPaused = useAppStore((s) => s.isPaused)
  const outputDir = useAppStore((s) => s.outputDir)
  const selectedIds = useAppStore((s) => s.selectedIds)
  const ffmpegAvailable = useAppStore((s) => s.ffmpegAvailable)
  const clearAll = useAppStore((s) => s.clearAll)
  const setConverting = useAppStore((s) => s.setConverting)
  const setPaused = useAppStore((s) => s.setPaused)
  const setFileSuccess = useAppStore((s) => s.setFileSuccess)
  const setFileError = useAppStore((s) => s.setFileError)
  const updateFileProgress = useAppStore((s) => s.updateFileProgress)
  const selectAll = useAppStore((s) => s.selectAll)
  const deselectAll = useAppStore((s) => s.deselectAll)
  const removeSelected = useAppStore((s) => s.removeSelected)
  const retryAll = useAppStore((s) => s.retryAll)
  const moveFile = useAppStore((s) => s.moveFile)

  const [draggedFileId, setDraggedFileId] = useState<string | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const checkboxRef = useRef<HTMLInputElement>(null)
  // ETA tracking
  const conversionStartTimes = useRef<Map<string, number>>(new Map())
  const totalDurationMs = useRef(0)
  const completedCount = useRef(0)
  const [avgDurationMs, setAvgDurationMs] = useState(0)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const pausedRef = useRef(false)
  const batchSuccessRef = useRef(0)
  const batchFailRef = useRef(0)
  const batchStartTimeRef = useRef(0)

  const allSelected = files.length > 0 && selectedIds.length === files.length
  const someSelected = selectedIds.length > 0 && !allSelected
  const hasErrors = files.some((f) => f.status === 'error')
  const hasSuccesses = files.some((f) => f.status === 'success')
  const hasPending = files.some((f) => f.status === 'pending')

  let etaLabel = ''
  if (isConverting && avgDurationMs > 0) {
    const pendingCount = files.filter((f) => f.status === 'pending' || f.status === 'converting').length
    const etaMs = avgDurationMs * pendingCount
    if (etaMs > 0) {
      const totalSeconds = Math.ceil(etaMs / 1000)
      const minutes = Math.floor(totalSeconds / 60)
      const seconds = totalSeconds % 60
      etaLabel = minutes > 0 ? `ETA: ~${minutes}m ${seconds}s` : `ETA: ~${seconds}s`
    }
  }

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = someSelected
    }
  }, [someSelected])

  const convertAll = useCallback(async () => {
    if (files.length === 0 || isConverting) return
    let dir = outputDir
    if (!dir) {
      dir = await window.formatConverter.selectFolder()
      if (!dir) return
      useAppStore.getState().setOutputDir(dir)
    }

    // Reset batch counters
    batchSuccessRef.current = 0
    batchFailRef.current = 0
    batchStartTimeRef.current = Date.now()
    pausedRef.current = false

    setConverting(true)

    const unsub = window.formatConverter.onConvertProgress(({ filePath, progress }) => {
      if (!pausedRef.current) {
        updateFileProgress(filePath, progress)
      }
    })

    const pendingFiles = files.filter((f) => f.status === 'pending')
    const limit = useAppStore.getState().settings.concurrentLimit || 3

    for (let i = 0; i < pendingFiles.length; i += limit) {
      // Check for pause — if paused, stop processing
      if (pausedRef.current) {
        break
      }

      const batch = pendingFiles.slice(i, i + limit)
      // Record start times for ETA estimate
      batch.forEach((f) => conversionStartTimes.current.set(f.filePath, Date.now()))
      const results = await Promise.all(
        batch.map((file) => {
          const settings = useAppStore.getState().settings
          return window.formatConverter
            .convertFile({
              filePath: file.filePath,
              outputDir: dir || '',
              filenameTemplate: settings.filenameTemplate,
              outputFormat: settings.outputFormat,
              duplicateAction: settings.duplicateAction,
              bitrate: settings.bitrate,
              vbrEnabled: settings.vbrEnabled,
              vbrQuality: settings.vbrQuality,
              compressionLevel: settings.compressionLevel,
              sampleRate: settings.sampleRate,
              bitDepth: settings.bitDepth
            })
            .then((result) => ({ file, result }))
        })
      )

      // Check again after batch
      if (pausedRef.current) break

      for (const { file, result } of results) {
        if (result.success) {
          setFileSuccess(file.filePath, {
            format: result.format,
            songName: result.songName,
            artist: result.artist,
            album: result.album,
            coverImageBase64: result.coverImageBase64,
            outputPath: result.outputPath
          })
          batchSuccessRef.current += 1
          // Track duration for ETA estimate
          const convStart = conversionStartTimes.current.get(file.filePath)
          if (convStart) {
            const convDuration = Date.now() - convStart
            totalDurationMs.current += convDuration
            completedCount.current += 1
            setAvgDurationMs(Math.round(totalDurationMs.current / completedCount.current))
          }
        } else {
          setFileError(file.filePath, result.errorMessage || t('error.convertFailed'))
          batchFailRef.current += 1
        }
      }
    }

    unsub()
    setConverting(false)

    // Fire completion callback if we weren't paused
    if (!pausedRef.current) {
      const totalBatch = batchSuccessRef.current + batchFailRef.current
      if (totalBatch > 0 && onConversionComplete) {
        onConversionComplete(
          batchSuccessRef.current,
          batchFailRef.current,
          totalBatch,
          Date.now() - batchStartTimeRef.current
        )
      }
    }
  }, [files, isConverting, outputDir, setConverting, setFileSuccess, setFileError, updateFileProgress, t, onConversionComplete])

  // Re-run convertAll when resumed
  const hasResumedRef = useRef(false)
  useEffect(() => {
    if (!isPaused && isConverting && hasResumedRef.current) {
      hasResumedRef.current = false
      // The convertAll was already re-triggered by the resume button handler
    }
    if (!isPaused && !isConverting && hasResumedRef.current) {
      hasResumedRef.current = false
    }
  }, [isPaused, isConverting])

  const handlePause = useCallback(() => {
    pausedRef.current = true
    setPaused(true)
    window.formatConverter.cancelConversions().catch(() => {})
  }, [setPaused])

  const handleResume = useCallback(() => {
    pausedRef.current = false
    setPaused(false)
    hasResumedRef.current = true
    // Reset isConverting so the convertAll guard check passes
    useAppStore.getState().setConverting(false)
    // Small delay to let React state settle, then re-run conversion
    setTimeout(() => convertAll(), 16)
  }, [setPaused, convertAll])

  const clearAllHandler = useCallback(() => {
    if (files.length === 0) return
    clearAll()
  }, [files, clearAll])

  const clearCompletedHandler = useCallback(() => {
    const state = useAppStore.getState()
    state.files.forEach((f) => {
      if (f.status === 'success' || f.status === 'error') {
        state.removeFile(f.id)
      }
    })
  }, [])

  const downloadAllHandler = useCallback(async () => {
    const successFiles = useAppStore.getState().files.filter((f) => f.status === 'success')
    if (successFiles.length === 0) return

    const result = await window.formatConverter.downloadAsZip({
      filePaths: successFiles.map((f) => f.outputPath || f.filePath),
      fileNames: successFiles.map((f) => f.fileName)
    })

    if (result.success) {
      setNotification({ type: 'success', message: `${t('actions.downloadAll')} — ${result.outputPath || 'OK'}` })
    } else {
      setNotification({ type: 'error', message: result.error || 'Download failed' })
    }

    setTimeout(() => setNotification(null), 3000)
  }, [t])

  const handleSelectAllToggle = useCallback(() => {
    if (allSelected) {
      deselectAll()
    } else {
      selectAll()
    }
  }, [allSelected, selectAll, deselectAll])

  // Drag-to-reorder handlers
  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>, fileId: string) => {
      setDraggedFileId(fileId)
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', fileId)
      const el = e.currentTarget
      requestAnimationFrame(() => {
        el.style.opacity = '0.4'
      })
    },
    []
  )

  const handleDragEnd = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    setDraggedFileId(null)
    setDragOverIndex(null)
    e.currentTarget.style.opacity = '1'
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const container = e.currentTarget
    const items = container.querySelectorAll<HTMLDivElement>('[data-file-index]')
    let insertIndex = items.length
    for (let i = 0; i < items.length; i++) {
      const rect = items[i].getBoundingClientRect()
      const midY = rect.top + rect.height / 2
      if (e.clientY < midY) {
        insertIndex = i
        break
      }
    }
    setDragOverIndex(insertIndex)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (e.currentTarget === e.target) {
      setDragOverIndex(null)
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      const fromId = e.dataTransfer.getData('text/plain')
      if (!fromId) return

      const fromIndex = files.findIndex((f) => f.id === fromId)
      if (fromIndex === -1) return

      let toIndex = dragOverIndex ?? files.length - 1
      if (fromIndex < toIndex) {
        toIndex = toIndex - 1
      }

      if (fromIndex !== toIndex) {
        moveFile(fromIndex, toIndex)
      }

      setDraggedFileId(null)
      setDragOverIndex(null)
    },
    [files, dragOverIndex, moveFile]
  )

  if (files.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center"
        style={{
          padding: 'var(--space-8)',
          color: 'var(--text-tertiary)',
          fontSize: '14px'
        }}
      >
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ marginBottom: '12px', opacity: 0.5 }}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        {t('status.noFiles')}
      </div>
    )
  }

  // Show FFmpeg warning banner if needed and there is a format conversion pending
  const needsFfmpeg = files.some((f) => {
    const settings = useAppStore.getState().settings
    return f.status === 'pending' && settings.outputFormat !== 'source'
  })

  return (
    <div className="flex flex-col flex-1">
      {/* FFmpeg unavailable warning */}
      {!ffmpegAvailable && needsFfmpeg && (
        <div
          style={{
            margin: '0 16px 8px',
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'rgba(255, 193, 7, 0.08)',
            border: '1px solid rgba(255, 193, 7, 0.3)',
            color: 'var(--text-secondary)',
            fontSize: '12px',
            lineHeight: 1.4
          }}
        >
          {t('conv.disabled.noFfmpeg')}
        </div>
      )}

      {/* Select All row */}
      <div
        className="flex items-center"
        style={{
          padding: '0 16px 8px',
          gap: '8px',
          minHeight: '32px'
        }}
      >
        <label
          className="flex items-center"
          style={{ gap: '6px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)', userSelect: 'none' }}
        >
          <input
            ref={checkboxRef}
            type="checkbox"
            checked={allSelected}
            onChange={handleSelectAllToggle}
          />
          {t('actions.selectAll')}
        </label>
        <div style={{ flex: 1 }} />
        <button
          onClick={removeSelected}
          disabled={selectedIds.length === 0}
          style={{
            height: '28px',
            padding: '0 12px',
            border: 'none',
            borderRadius: '14px',
            cursor: selectedIds.length === 0 ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            fontSize: '12px',
            fontWeight: 500,
            backgroundColor: 'var(--surface-2)',
            color: selectedIds.length === 0 ? 'var(--text-tertiary)' : 'var(--text-secondary)',
            opacity: selectedIds.length === 0 ? 0.5 : 1,
            transition: 'all 150ms ease'
          }}
        >
          {t('actions.removeSelected', { count: selectedIds.length })}
        </button>
        {hasErrors && (
          <button
            onClick={retryAll}
            style={{
              height: '28px',
              padding: '0 12px',
              border: 'none',
              borderRadius: '14px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: '12px',
              fontWeight: 500,
              backgroundColor: 'var(--surface-2)',
              color: 'var(--error)',
              transition: 'all 150ms ease'
            }}
          >
            {t('actions.retryAll')}
          </button>
        )}
      </div>

      {/* File list with drag-to-reorder */}
      <div
        style={{
          maxHeight: '360px',
          overflowY: 'auto',
          flex: 1
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {files.map((file, index) => (
          <div
            key={file.id}
            draggable={!isConverting}
            data-file-index={index}
            onDragStart={(e) => handleDragStart(e, file.id)}
            onDragEnd={handleDragEnd}
            style={{
              borderTop: dragOverIndex === index && draggedFileId !== file.id ? '2px solid var(--accent)' : '2px solid transparent',
              marginTop: dragOverIndex === index && draggedFileId !== file.id ? '-2px' : '0',
              transition: 'border-color 100ms ease, opacity 150ms ease'
            }}
          >
            <FileItem file={file} index={index} />
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div
        className="flex items-center justify-center"
        style={{
          gap: 'var(--space-3)',
          padding: 'var(--space-4) 0',
          flexWrap: 'wrap'
        }}
      >
        {/* Convert / Pause / Resume button */}
        {isConverting && !isPaused ? (
          <button
            onClick={handlePause}
            style={{
              height: '40px',
              padding: '0 24px',
              border: 'none',
              borderRadius: '20px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: '14px',
              fontWeight: 500,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'var(--surface-2)',
              color: 'var(--text-primary)',
              transition: 'all 150ms ease'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
            {t('pause.title')}
          </button>
        ) : isPaused ? (
          <button
            onClick={handleResume}
            style={{
              height: '40px',
              padding: '0 24px',
              border: 'none',
              borderRadius: '20px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: '14px',
              fontWeight: 500,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'var(--accent)',
              color: '#12141A',
              transition: 'all 150ms ease'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            {t('resume.title')}
          </button>
        ) : (
          <button
            onClick={convertAll}
            disabled={!hasPending}
            style={{
              height: '40px',
              padding: '0 24px',
              border: 'none',
              borderRadius: '20px',
              cursor: !hasPending ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              fontSize: '14px',
              fontWeight: 500,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'var(--accent)',
              color: '#12141A',
              opacity: !hasPending ? 0.6 : 1,
              transition: 'all 150ms ease'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            {t('actions.convertAll')}
          </button>
        )}
        <button
          onClick={clearAllHandler}
          disabled={files.length === 0}
          style={{
            height: '40px',
            padding: '0 24px',
            border: '1px solid var(--border)',
            borderRadius: '20px',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: '14px',
            fontWeight: 500,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'transparent',
            color: 'var(--text-secondary)',
            transition: 'all 150ms ease'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
          {t('actions.clear')}
        </button>
        <button
          onClick={clearCompletedHandler}
          disabled={!files.some((f) => f.status === 'success' || f.status === 'error')}
          style={{
            height: '40px',
            padding: '0 24px',
            border: '1px solid var(--border)',
            borderRadius: '20px',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: '14px',
            fontWeight: 500,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'transparent',
            color: 'var(--text-secondary)',
            transition: 'all 150ms ease'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          {t('actions.clearCompleted')}
        </button>
        {hasSuccesses && (
          <button
            onClick={downloadAllHandler}
            style={{
              height: '40px',
              padding: '0 24px',
              border: '1px solid var(--accent)',
              borderRadius: '20px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: '14px',
              fontWeight: 500,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'transparent',
              color: 'var(--accent)',
              transition: 'all 150ms ease'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {t('actions.downloadAll')}
          </button>
        )}
      </div>

      {/* Stats */}
      {(stats.total > 0 || stats.success > 0 || stats.fail > 0) && (
        <>
          <div
            className="flex justify-center"
            style={{
              gap: 'var(--space-8)',
              paddingTop: 'var(--space-4)',
              borderTop: '1px solid var(--border)'
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--accent)' }}>
                {stats.total}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {t('stats.total')}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--success)' }}>
                {stats.success}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {t('stats.success')}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--error)' }}>
                {stats.fail}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {t('stats.fail')}
              </div>
            </div>
          </div>
          {notification && (
            <div
              style={{
                textAlign: 'center',
                fontSize: '12px',
                color: notification.type === 'success' ? 'var(--success)' : 'var(--error)',
                paddingTop: '8px'
              }}
            >
              {notification.message}
            </div>
          )}
          {etaLabel && (
            <div
              style={{
                textAlign: 'center',
                fontSize: '11px',
                color: 'var(--text-tertiary)',
                paddingTop: '8px',
                letterSpacing: '0.3px'
              }}
            >
              {etaLabel}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default FileList
