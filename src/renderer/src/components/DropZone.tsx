/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 */

import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore, FileEntry } from '../store/useAppStore'

/**
 * Rough estimate of output file size based on input format and target output format.
 * Returns estimated bytes, or undefined when hard to estimate (e.g. dynamic bitrate from source).
 */
function estimateOutputSize(
  inputSize: number,
  outputFormat: string,
  bitrate: string,
  vbrEnabled: boolean,
  vbrQuality: number
): number | undefined {
  if (inputSize <= 0) return undefined

  const lossyFormats = ['mp3', 'm4a', 'aac', 'ogg', 'opus']
  const pcmFormats = ['wav', 'aiff']
  const loselessFormats = ['flac', 'alac']

  if (outputFormat === 'source') return inputSize

  const lossyRatioByBitrate: Record<string, number> = {
    '128k': 0.12,
    '192k': 0.15,
    '256k': 0.20,
    '320k': 0.25
  }

  if (lossyFormats.includes(outputFormat)) {
    const ratio = lossyRatioByBitrate[bitrate] ?? 0.15
    // VBR is usually ~20% smaller than CBR at equivalent quality
    const vbrAdjust = vbrEnabled ? 0.8 : 1.0
    return Math.round(inputSize * ratio * vbrAdjust)
  }

  if (loselessFormats.includes(outputFormat)) {
    // FLAC/ALAC typically compress to 50-70% of PCM/WAV
    return Math.round(inputSize * 0.6)
  }

  if (pcmFormats.includes(outputFormat)) {
    // PCM is usually 2-3x of compressed input. We estimate high since we don't know duration.
    return Math.round(inputSize * 2)
  }

  return undefined
}

function DropZone(): JSX.Element {
  const { t } = useTranslation()
  const addFiles = useAppStore((s) => s.addFiles)
  const setOutputDir = useAppStore((s) => s.setOutputDir)
  const outputDir = useAppStore((s) => s.outputDir)
  const settings = useAppStore((s) => s.settings)
  const setOutputFormat = useAppStore((s) => s.setOutputFormat)
  const isConverting = useAppStore((s) => s.isConverting)
  const [isDragOver, setIsDragOver] = useState(false)
  const dragCounter = useRef(0)

  const handleFilesAdded = useCallback(
    (paths: string[]) => {
      const entries: FileEntry[] = paths.map((path) => {
        const parts = path.replace(/\\/g, '/').split('/')
        const fileName = parts[parts.length - 1]
        return {
          id: crypto.randomUUID(),
          filePath: path,
          fileName,
          fileSize: 0,
          status: 'pending',
          progress: 0
        }
      })
      addFiles(entries)
    },
    [addFiles]
  )

  const handleFilesAddedWithEstimate = useCallback(
    (paths: string[]) => {
      const outputFormat = settings.outputFormat
      const bitrate = settings.bitrate || '192k'
      const vbrEnabled = settings.vbrEnabled || false
      const vbrQuality = settings.vbrQuality ?? 5

      const entries: FileEntry[] = paths.map((path) => {
        const parts = path.replace(/\\/g, '/').split('/')
        const fileName = parts[parts.length - 1]
        return {
          id: crypto.randomUUID(),
          filePath: path,
          fileName,
          fileSize: 0,
          status: 'pending',
          progress: 0,
          estimatedOutputSize: estimateOutputSize(0, outputFormat, bitrate, vbrEnabled, vbrQuality)
        }
      })
      addFiles(entries)
    },
    [addFiles, settings.outputFormat, settings.bitrate, settings.vbrEnabled, settings.vbrQuality]
  )

  const handleClick = useCallback(async () => {
    if (isConverting) return
    const paths = await window.formatConverter.selectFiles()
    if (paths.length > 0) {
      handleFilesAddedWithEstimate(paths)
    }
  }, [handleFilesAddedWithEstimate, isConverting])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current++
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current--
    if (dragCounter.current === 0) {
      setIsDragOver(false)
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)
      dragCounter.current = 0

      if (isConverting) return

      const files = Array.from(e.dataTransfer.files)
      const paths: string[] = []

      const supportedExtensions = [
        '.ncm', '.kwm', '.kgm', '.kgma', '.vpr',
        '.qmc0', '.qmc3', '.qmcflac', '.qmcogg', '.qmc1', '.qmc2', '.tkm',
        '.mp3', '.flac', '.wav', '.m4a', '.aac', '.ogg', '.opus'
      ]

      for (const file of files) {
        const ext = '.' + file.name.split('.').pop()?.toLowerCase()
        if (supportedExtensions.includes(ext)) {
          const path = window.formatConverter.getPathForFile(file)
          if (path) paths.push(path)
        }
      }

      if (paths.length > 0) {
        // Ensure output directory is selected
        if (!outputDir) {
          window.formatConverter.selectFolder().then((dir) => {
            if (dir) {
              setOutputDir(dir)
              handleFilesAddedWithEstimate(paths)
            }
          })
        } else {
          handleFilesAddedWithEstimate(paths)
        }
      }
    },
    [handleFilesAddedWithEstimate, isConverting, outputDir, setOutputDir]
  )

  const handleSelectOutputDir = useCallback(async () => {
    const dir = await window.formatConverter.selectFolder()
    if (dir) {
      setOutputDir(dir)
    }
  }, [setOutputDir])

  return (
    <div style={{ marginBottom: 'var(--space-4)' }}>
      {/* Output directory selector */}
      <div
        className="flex items-center"
        style={{
          marginBottom: 'var(--space-3)',
          gap: 'var(--space-2)',
          fontSize: '13px',
          color: 'var(--text-secondary)'
        }}
      >
        <span>{t('settings.outputDir')}:</span>
        <span
          style={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: outputDir ? 'var(--text-primary)' : 'var(--text-tertiary)'
          }}
        >
          {outputDir || t('settings.placeholder')}
        </span>
        <button
          onClick={handleSelectOutputDir}
          style={{
            padding: '4px 12px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--surface-2)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          {t('actions.browse')}
        </button>
      </div>

      {/* Output format selector */}
      <div style={{ marginBottom: 'var(--space-3)', fontSize: '13px', color: 'var(--text-secondary)' }}>
        <span style={{ marginBottom: 'var(--space-1)', display: 'block' }}>{t('settings.outputFormat')}:</span>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          {[
            { value: 'source', label: t('format.source') },
            { value: 'mp3', label: t('format.mp3') },
            { value: 'flac', label: t('format.flac') },
            { value: 'wav', label: t('format.wav') },
            { value: 'ogg', label: t('format.ogg') }
          ].map((opt) => {
            const isActive = settings.outputFormat === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => {
                  setOutputFormat(opt.value)
                  window.formatConverter.setSettings({ outputFormat: opt.value })
                }}
                style={{
                  padding: '4px 10px',
                  border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: isActive ? 'rgba(201, 162, 75, 0.1)' : 'transparent',
                  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontFamily: 'inherit'
                }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Drop zone */}
      <div
        onClick={handleClick}
        onDragEnter={handleDragEnter}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${isDragOver ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-lg)',
          padding: '40px 24px',
          textAlign: 'center',
          cursor: isConverting ? 'default' : 'pointer',
          transition: 'all 150ms ease',
          backgroundColor: isDragOver ? 'var(--surface-2)' : 'transparent',
          opacity: isConverting ? 0.5 : 1
        }}
      >
        {/* Upload icon */}
        <div
          style={{
            width: '48px',
            height: '48px',
            margin: '0 auto 12px',
            color: isDragOver ? 'var(--accent)' : 'var(--text-tertiary)'
          }}
        >
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>
          {t('dropzone.title')}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          {t('dropzone.hint')}
        </div>
      </div>

      {/* Supported formats info */}
      <div
        style={{
          marginTop: 'var(--space-4)',
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--surface-1)',
          border: '1px solid var(--border)',
          fontSize: '12px',
          lineHeight: 1.6
        }}
      >
        <div style={{ color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '8px' }}>
          {t('dropzone.supportedFormats')}:
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
          <FormatBadge ext=".ncm" label="NCM" desc={t('format.ncm')} />
          <FormatBadge ext=".kwm" label="KWM" desc={t('format.kwm')} />
          <FormatBadge ext=".kgm" label="KGM/KGMA/VPR" desc={t('format.kgm')} />
          <FormatBadge ext=".qmc" label="QMC v1" desc={t('format.qmc')} />
          <FormatBadge ext=".mflac" label="MFLAC/MGG/KGG" desc={t('format.phase2')} dimmed />
          <FormatBadge ext=".mp3/.flac/.wav" label="MP3/FLAC/WAV" desc={t('format.plainAudio')} />
          <FormatBadge ext=".m4a/.aac/.ogg/.opus" label="M4A/AAC/OGG/Opus" desc={t('format.plainAudio')} />
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '10px', lineHeight: 1.5, borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
          {t('dropzone.tip')}
        </div>
      </div>
    </div>
  )
}

function FormatBadge({ ext, label, desc, dimmed }: { ext: string; label: string; desc: string; dimmed?: boolean }): JSX.Element {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        opacity: dimmed ? 0.5 : 1
      }}
    >
      <code
        style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '11px',
          padding: '1px 5px',
          borderRadius: '3px',
          backgroundColor: 'var(--surface-2)',
          color: dimmed ? 'var(--text-tertiary)' : 'var(--accent)'
        }}
      >
        {ext}
      </code>
      <span style={{ color: 'var(--text-tertiary)' }}>{desc}</span>
    </div>
  )
}

export default DropZone
