/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 */

import { useCallback, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store/useAppStore'
import LanguageSwitcher from './LanguageSwitcher'

function InfoTooltip({ text }: { text: string }): JSX.Element {
  const [show, setShow] = useState(false)
  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: '6px', cursor: 'pointer', verticalAlign: 'middle' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
      {show && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(100% + 8px)',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '8px 12px',
          borderRadius: 'var(--radius-sm)',
          backgroundColor: 'var(--surface-2)',
          border: '1px solid var(--border)',
          color: 'var(--text-primary)',
          fontSize: '12px',
          lineHeight: 1.4,
          whiteSpace: 'normal',
          width: '260px',
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          pointerEvents: 'none',
          textAlign: 'left',
          fontWeight: 400,
          fontFamily: 'inherit'
        }}>
          {text}
        </div>
      )}
    </span>
  )
}

function SettingsPanel(): JSX.Element {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const setSettings = useAppStore((s) => s.setSettings)
  const setOutputDir = useAppStore((s) => s.setOutputDir)
  const setOutputFormat = useAppStore((s) => s.setOutputFormat)
  const setConcurrentLimit = useAppStore((s) => s.setConcurrentLimit)
  const setDuplicateAction = useAppStore((s) => s.setDuplicateAction)
  const setBitrate = useAppStore((s) => s.setBitrate)
  const setVbrEnabled = useAppStore((s) => s.setVbrEnabled)
  const setVbrQuality = useAppStore((s) => s.setVbrQuality)
  const setCompressionLevel = useAppStore((s) => s.setCompressionLevel)
  const setSampleRate = useAppStore((s) => s.setSampleRate)
  const setBitDepth = useAppStore((s) => s.setBitDepth)
  const setQmcEkey = useAppStore((s) => s.setQmcEkey)
  const setAutoConcurrent = useAppStore((s) => s.setAutoConcurrent)
  const ffmpegAvailable = useAppStore((s) => s.ffmpegAvailable)

  const handleBrowseOutputDir = useCallback(async () => {
    const dir = await window.formatConverter.selectFolder()
    if (dir) {
      setOutputDir(dir)
      setSettings({ outputDir: dir })
      window.formatConverter.setSettings({ outputDir: dir })
    }
  }, [setOutputDir, setSettings])

  const handleTemplateChange = useCallback(
    (value: string) => {
      setSettings({ filenameTemplate: value })
      window.formatConverter.setSettings({ filenameTemplate: value })
    },
    [setSettings]
  )

  const templatePresets = [
    { label: '{artist} - {title}', value: '{artist} - {title}' },
    { label: '{title}', value: '{title}' },
    { label: '{album}/{artist} - {title}', value: '{album}/{artist} - {title}' }
  ]

  const lossyFormats = ['mp3', 'm4a', 'aac', 'ogg', 'opus']
  const pcmFormats = ['wav', 'aiff', 'alac', 'flac']
  const isLossy = lossyFormats.includes(settings.outputFormat)
  const isPcm = pcmFormats.includes(settings.outputFormat)

  const [kggKeyCount, setKggKeyCount] = useState(0)
  const [kggMessage, setKggMessage] = useState('')
  const [kggScanning, setKggScanning] = useState(false)

  useEffect(() => {
    window.formatConverter.getKggKeyCount().then(setKggKeyCount).catch(() => {})
  }, [])

  const handleImportKgg = useCallback(async () => {
    const dbPath = await window.formatConverter.selectKggDatabase()
    if (!dbPath) return
    setKggScanning(true)
    try {
      const result = await window.formatConverter.importKggKeys(dbPath)
      if (result.success) {
        setKggMessage(t('kgg.importSuccess', { added: result.added, total: result.total }))
        setKggKeyCount(result.total)
        setSettings({ kggKeyImportPath: dbPath })
      } else {
        setKggMessage(t('kgg.importFailed') + (result.error ? ': ' + result.error : ''))
      }
    } catch {
      setKggMessage(t('kgg.importFailed'))
    }
    setKggScanning(false)
  }, [setSettings, t])

  const handleScanKgg = useCallback(async () => {
    setKggScanning(true)
    setKggMessage(t('settings.scanning'))
    try {
      const result = await window.formatConverter.scanKggKeys()
      setKggMessage(t('kgg.scanSuccess', { added: result.added, total: result.total }))
      setKggKeyCount(result.total)
    } catch {
      setKggMessage(t('kgg.scanFailed'))
    }
    setKggScanning(false)
  }, [t])

  const [settingsMessage, setSettingsMessage] = useState('')

  const handleExportSettings = useCallback(async () => {
    const result = await window.formatConverter.exportSettings()
    if (result.success) {
      setSettingsMessage(t('settings.exportSuccess'))
    } else {
      setSettingsMessage(t('settings.exportError', { error: result.error || 'Unknown' }))
    }
    setTimeout(() => setSettingsMessage(''), 3000)
  }, [t])

  const handleImportSettings = useCallback(async () => {
    const result = await window.formatConverter.importSettings()
    if (result.success) {
      setSettingsMessage(t('settings.importSuccess'))
    } else {
      setSettingsMessage(t('settings.importError', { error: result.error || 'Unknown' }))
    }
    setTimeout(() => setSettingsMessage(''), 3000)
  }, [t])

  const handleThemeChange = useCallback(
    (theme: string) => {
      setSettings({ theme })
      document.documentElement.dataset.theme = theme
      window.formatConverter?.setSettings({ theme })
    },
    [setSettings]
  )

  const handleNotifToggle = useCallback(() => {
    const next = !settings.notificationsEnabled
    setSettings({ notificationsEnabled: next })
    window.formatConverter?.setSettings({ notificationsEnabled: next })
  }, [settings.notificationsEnabled, setSettings])

  // Presets UI
  const presets = useAppStore((s) => s.settings.presets)
  const selectedPreset = useAppStore((s) => s.settings.selectedPreset)
  const [presetNameInput, setPresetNameInput] = useState('')

  const handleSelectPreset = useCallback((id: string) => {
    const preset = presets?.find((p) => p.id === id)
    if (!preset) return
    setSettings({
      selectedPreset: id,
      outputFormat: preset.outputFormat,
      bitrate: preset.bitrate,
      vbrEnabled: preset.vbrEnabled,
      vbrQuality: preset.vbrQuality,
      sampleRate: preset.sampleRate,
      bitDepth: preset.bitDepth,
      compressionLevel: preset.compressionLevel
    })
    window.formatConverter?.setSettings({
      selectedPreset: id,
      outputFormat: preset.outputFormat,
      bitrate: preset.bitrate,
      vbrEnabled: preset.vbrEnabled,
      vbrQuality: preset.vbrQuality,
      sampleRate: preset.sampleRate,
      bitDepth: preset.bitDepth,
      compressionLevel: preset.compressionLevel
    })
  }, [presets, setSettings])

  const handleSavePreset = useCallback(() => {
    if (!presetNameInput.trim()) return
    const newPreset = {
      id: crypto.randomUUID(),
      name: presetNameInput.trim(),
      outputFormat: settings.outputFormat,
      bitrate: settings.bitrate,
      vbrEnabled: settings.vbrEnabled,
      vbrQuality: settings.vbrQuality,
      sampleRate: settings.sampleRate,
      bitDepth: settings.bitDepth,
      compressionLevel: settings.compressionLevel
    }
    const updated = [...(presets || []), newPreset]
    setSettings({ presets: updated })
    window.formatConverter?.setSettings({ presets: updated })
    setPresetNameInput('')
  }, [presetNameInput, settings, presets, setSettings])

  // FFmpeg — bundled binary check
  const setFfmpegAvailable = useAppStore((s) => s.setFfmpegAvailable)
  const [ffmpegMessage, setFfmpegMessage] = useState<{ text: string; type: 'ok' | 'error' | 'info' } | null>(null)

  const showFfmpegMsg = useCallback((text: string, type: 'ok' | 'error' | 'info') => {
    setFfmpegMessage({ text, type })
    setTimeout(() => setFfmpegMessage(null), 6000)
  }, [])

  const handleSelectFfmpeg = useCallback(async () => {
    const binPath = await window.formatConverter.selectFfmpegBinary()
    if (!binPath) return
    setSettings({ customFfmpegPath: binPath })
    await window.formatConverter.setSettings({ customFfmpegPath: binPath })
    const status = await window.formatConverter.recheckFfmpeg()
    setFfmpegAvailable(status.available)
    if (status.available) {
      showFfmpegMsg(t('ffmpeg.selectSuccess', { path: status.ffmpegPath }), 'ok')
    } else {
      showFfmpegMsg(status.reason || t('ffmpeg.selectFailed'), 'error')
    }
  }, [setSettings, setFfmpegAvailable, showFfmpegMsg, t])

  return (
    <div style={{ padding: 'var(--space-4) 0' }}>
      <h2
        style={{
          fontFamily: "'Fraunces', serif",
          fontSize: '20px',
          color: 'var(--text-primary)',
          marginBottom: 'var(--space-6)',
          fontWeight: 600
        }}
      >
        {t('settings.title')}
      </h2>

      {/* Settings Import / Export */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={handleExportSettings}
            style={{
              padding: '8px 16px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--surface-2)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '13px',
              fontFamily: 'inherit'
            }}
          >
            {t('settings.exportSettings')}
          </button>
          <button
            onClick={handleImportSettings}
            style={{
              padding: '8px 16px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--surface-2)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '13px',
              fontFamily: 'inherit'
            }}
          >
            {t('settings.importSettings')}
          </button>
        </div>
        {settingsMessage && (
          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: 'var(--space-2)' }}>
            {settingsMessage}
          </div>
        )}
      </div>

      {/* Theme */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
          {t('settings.theme')}
        </label>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          {[
            { value: 'system', label: t('theme.system') },
            { value: 'dark', label: t('theme.dark') },
            { value: 'light', label: t('theme.light') },
            { value: 'sepia', label: t('theme.sepia') },
            { value: 'forest', label: t('theme.forest') },
            { value: 'ocean', label: t('theme.ocean') },
            { value: 'lavender', label: t('theme.lavender') }
          ].map((opt) => {
            const isActive = settings.theme === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => handleThemeChange(opt.value)}
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

      {/* Language */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
          {t('settings.language')}
        </label>
        <LanguageSwitcher />
      </div>

      {/* Desktop Notifications */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '14px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={!!settings.notificationsEnabled}
            onChange={handleNotifToggle}
            style={{ accentColor: 'var(--accent)' }}
          />
          {t('notification.settingsToggle')}
        </label>
      </div>

      {/* FFmpeg Status & Path Selection */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
          FFmpeg
        </label>
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: ffmpegAvailable ? 'rgba(79, 174, 138, 0.05)' : 'rgba(255, 193, 7, 0.08)',
            border: `1px solid ${ffmpegAvailable ? 'rgba(79, 174, 138, 0.3)' : 'rgba(255, 193, 7, 0.3)'}`,
            color: 'var(--text-secondary)',
            fontSize: '13px',
            lineHeight: 1.5
          }}
        >
          {/* Status row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <span
              style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: ffmpegAvailable ? 'var(--success)' : 'var(--error)',
                flexShrink: 0
              }}
            />
            <span style={{ fontWeight: 500, color: ffmpegAvailable ? 'var(--success)' : 'var(--error)' }}>
              {ffmpegAvailable ? t('ffmpeg.statusAvailable') : t('ffmpeg.statusUnavailable')}
            </span>
            {!ffmpegAvailable && (
              <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                — {t('conv.disabled.noFfmpeg')}
              </span>
            )}
          </div>
          {/* Path display */}
          <div style={{ marginBottom: '8px', fontSize: '12px', color: 'var(--text-tertiary)', wordBreak: 'break-all' }}>
            {ffmpegAvailable
              ? (settings.customFfmpegPath
                  ? t('ffmpeg.customPath', { path: settings.customFfmpegPath })
                  : t('ffmpeg.bundled'))
              : (settings.customFfmpegPath
                  ? t('ffmpeg.customPathLabel', { path: settings.customFfmpegPath })
                  : t('ffmpeg.notFound'))}
          </div>
          {/* Feedback message */}
          {ffmpegMessage && (
            <div style={{
              marginBottom: '8px',
              fontSize: '12px',
              color: ffmpegMessage.type === 'ok' ? 'var(--success)' : ffmpegMessage.type === 'error' ? 'var(--error)' : 'var(--text-tertiary)'
            }}>
              {ffmpegMessage.text}
            </div>
          )}
          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <button
              onClick={handleSelectFfmpeg}
              title={t('ffmpeg.selectBinaryTitle')}
              style={{
                padding: '5px 12px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--surface-2)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: '12px',
                fontFamily: 'inherit'
              }}
            >
              {t('ffmpeg.selectBinary')}
            </button>
          </div>
        </div>
      </div>

      {/* Conversion Presets */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
          {t('settings.presets')}
        </label>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-2)' }}>
          {presets?.map((p) => {
            const isActive = selectedPreset === p.id
            const disabled = !ffmpegAvailable && p.outputFormat !== 'source'
            return (
              <button
                key={p.id}
                disabled={disabled}
                onClick={() => handleSelectPreset(p.id)}
                style={{
                  padding: '4px 10px',
                  border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: isActive ? 'rgba(201, 162, 75, 0.1)' : 'transparent',
                  color: disabled ? 'var(--text-tertiary)' : isActive ? 'var(--accent)' : 'var(--text-secondary)',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.4 : 1,
                  fontSize: '12px',
                  fontFamily: 'inherit'
                }}
              >
                {p.name}
              </button>
            )
          })}
        </div>
        {/* Save current settings as preset */}
        {ffmpegAvailable && (
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            <input
              type="text"
              value={presetNameInput}
              onChange={(e) => setPresetNameInput(e.target.value)}
              placeholder={t('preset.saveAsName')}
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--surface-1)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontFamily: 'inherit',
                outline: 'none'
              }}
            />
            <button
              onClick={handleSavePreset}
              disabled={!presetNameInput.trim()}
              style={{
                padding: '6px 14px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--surface-2)',
                color: presetNameInput.trim() ? 'var(--text-primary)' : 'var(--text-tertiary)',
                cursor: presetNameInput.trim() ? 'pointer' : 'not-allowed',
                fontSize: '12px',
                fontFamily: 'inherit'
              }}
            >
              {t('preset.saveAs')}
            </button>
          </div>
        )}
      </div>

      {/* Output Directory */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
          {t('settings.outputDir')}
        </label>
        <div className="flex items-center" style={{ gap: 'var(--space-2)' }}>
          <div
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--surface-1)',
              border: '1px solid var(--border)',
              color: settings.outputDir ? 'var(--text-primary)' : 'var(--text-tertiary)',
              fontSize: '13px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {settings.outputDir || t('settings.placeholder')}
          </div>
          <button
            onClick={handleBrowseOutputDir}
            style={{
              padding: '8px 16px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--surface-2)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '13px',
              fontFamily: 'inherit'
            }}
          >
            {t('actions.browse')}
          </button>
        </div>
      </div>

      {/* Filename Template */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
          {t('settings.filenameTemplate')}
        </label>
        <input
          type="text"
          value={settings.filenameTemplate}
          onChange={(e) => handleTemplateChange(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--surface-1)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            fontSize: '13px',
            fontFamily: "'IBM Plex Mono', monospace",
            outline: 'none',
            marginBottom: 'var(--space-2)'
          }}
        />
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          {templatePresets.map((preset) => (
            <button
              key={preset.value}
              onClick={() => handleTemplateChange(preset.value)}
              style={{
                padding: '4px 10px',
                border: `1px solid ${settings.filenameTemplate === preset.value ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-sm)',
                backgroundColor: settings.filenameTemplate === preset.value ? 'rgba(201, 162, 75, 0.1)' : 'transparent',
                color: settings.filenameTemplate === preset.value ? 'var(--accent)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '12px',
                fontFamily: "'IBM Plex Mono', monospace"
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: 'var(--space-2)' }}>
          {t('settings.filenameHint')}
        </div>
      </div>

      {/* Output Format */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
          {t('settings.outputFormat')}
        </label>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          {[
            { value: 'source', label: t('format.source'), needsFfmpeg: false },
            { value: 'mp3', label: t('format.mp3'), needsFfmpeg: true },
            { value: 'flac', label: t('format.flac'), needsFfmpeg: true },
            { value: 'wav', label: t('format.wav'), needsFfmpeg: true },
            { value: 'ogg', label: t('format.ogg'), needsFfmpeg: true },
            { value: 'm4a', label: t('format.m4a'), needsFfmpeg: true },
            { value: 'aac', label: t('format.aac'), needsFfmpeg: true },
            { value: 'aiff', label: t('format.aiff'), needsFfmpeg: true },
            { value: 'alac', label: t('format.alac'), needsFfmpeg: true },
            { value: 'opus', label: t('format.opus'), needsFfmpeg: true }
          ].map((opt) => {
            const isActive = settings.outputFormat === opt.value
            const disabled = opt.needsFfmpeg && !ffmpegAvailable
            return (
              <button
                key={opt.value}
                disabled={disabled}
                onClick={() => {
                  setOutputFormat(opt.value)
                  window.formatConverter.setSettings({ outputFormat: opt.value })
                }}
                style={{
                  padding: '4px 10px',
                  border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: isActive ? 'rgba(201, 162, 75, 0.1)' : 'transparent',
                  color: disabled ? 'var(--text-tertiary)' : isActive ? 'var(--accent)' : 'var(--text-secondary)',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.4 : 1,
                  fontSize: '12px',
                  fontFamily: 'inherit'
                }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>

        {/* Format Info Card */}
        {settings.outputFormat !== 'source' && (
          <div
            style={{
              marginTop: 'var(--space-3)',
              padding: '12px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--surface-1)',
              border: '1px solid var(--border)',
              fontSize: '13px',
              lineHeight: 1.5,
              color: 'var(--text-primary)'
            }}
          >
            <div style={{ marginBottom: 'var(--space-2)' }}>
              {t(`formatDesc.${settings.outputFormat}`)}
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              {(() => {
                const params: string[] = []
                const f = settings.outputFormat
                if (['mp3', 'm4a', 'aac', 'ogg', 'opus'].includes(f)) {
                  params.push(t('settings.bitrate'))
                  params.push(t('settings.sampleRate'))
                }
                if (f === 'flac') {
                  params.push(t('settings.compressionLevel'))
                  params.push(t('settings.sampleRate'))
                  params.push(t('settings.bitDepth'))
                }
                if (['wav', 'aiff', 'alac'].includes(f)) {
                  params.push(t('settings.sampleRate'))
                  params.push(t('settings.bitDepth'))
                }
                return params.map((p) => (
                  <span
                    key={p}
                    style={{
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-secondary)',
                      fontSize: '11px',
                      lineHeight: '20px'
                    }}
                  >
                    {p}
                  </span>
                ))
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Quality Settings */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h3
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: '16px',
            color: 'var(--text-primary)',
            marginBottom: 'var(--space-6)',
            fontWeight: 600
          }}
        >
          {t('settings.qualitySection')}
        </h3>

        {/* Bitrate (lossy only) */}
        {isLossy && (
          <div style={{ marginBottom: 'var(--space-5)' }}>
            <label style={{ display: 'flex', alignItems: 'center', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
              {t('settings.bitrate')}
              <InfoTooltip text={t('tooltip.bitrate')} />
            </label>
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              {['128k', '192k', '256k', '320k'].map((rate) => {
                const isActive = settings.bitrate === rate
                return (
                  <button
                    key={rate}
                    onClick={() => {
                      setBitrate(rate)
                      window.formatConverter.setSettings({ bitrate: rate })
                    }}
                    style={{
                      padding: '4px 10px',
                      border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: isActive ? 'rgba(201, 162, 75, 0.1)' : 'transparent',
                      color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontFamily: "'IBM Plex Mono', monospace"
                    }}
                  >
                    {rate}
                  </button>
                )
              })}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: 'var(--space-2)' }}>
              {t('settings.bitrateHint')}
            </div>
          </div>
        )}

        {/* VBR (lossy only) */}
        {isLossy && (
          <div style={{ marginBottom: 'var(--space-5)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.vbrEnabled}
                onChange={(e) => {
                  setVbrEnabled(e.target.checked)
                  window.formatConverter.setSettings({ vbrEnabled: e.target.checked })
                }}
                style={{ accentColor: 'var(--accent)' }}
              />
              {t('settings.vbrEnabled')}
              <InfoTooltip text={t('tooltip.vbr')} />
            </label>
            {settings.vbrEnabled && (
              <div>
                <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
                  {t('settings.vbrQuality')}: <strong>{settings.vbrQuality}</strong>
                </label>
                <input
                  type="range"
                  min={0}
                  max={9}
                  step={1}
                  value={settings.vbrQuality}
                  onChange={(e) => {
                    const val = Number(e.target.value)
                    setVbrQuality(val)
                    window.formatConverter.setSettings({ vbrQuality: val })
                  }}
                  style={{
                    width: '100%',
                    accentColor: 'var(--accent)',
                    height: '6px',
                    cursor: 'pointer'
                  }}
                />
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: 'var(--space-2)' }}>
                  {t('settings.vbrQualityHint')}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Compression Level (FLAC only) */}
        {settings.outputFormat === 'flac' && (
          <div style={{ marginBottom: 'var(--space-5)' }}>
            <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
              {t('settings.compressionLevel')}: <strong>{settings.compressionLevel}</strong>
            </label>
            <input
              type="range"
              min={0}
              max={12}
              step={1}
              value={settings.compressionLevel}
              onChange={(e) => {
                const val = Number(e.target.value)
                setCompressionLevel(val)
                window.formatConverter.setSettings({ compressionLevel: val })
              }}
              style={{
                width: '100%',
                accentColor: 'var(--accent)',
                height: '6px',
                cursor: 'pointer'
              }}
            />
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: 'var(--space-2)' }}>
              {t('settings.compressionHint')}
            </div>
          </div>
        )}

        {/* Sample Rate */}
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <label style={{ display: 'flex', alignItems: 'center', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
            {t('settings.sampleRate')}
            <InfoTooltip text={t('tooltip.sampleRate')} />
          </label>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {['original', '44100', '48000', '96000', '192000'].map((rate) => {
              const isActive = settings.sampleRate === rate
              return (
                <button
                  key={rate}
                  onClick={() => {
                    setSampleRate(rate)
                    window.formatConverter.setSettings({ sampleRate: rate })
                  }}
                  style={{
                    padding: '4px 10px',
                    border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: isActive ? 'rgba(201, 162, 75, 0.1)' : 'transparent',
                    color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontFamily: "'IBM Plex Mono', monospace"
                  }}
                >
                  {rate}
                </button>
              )
            })}
          </div>
        </div>

        {/* Bit Depth (PCM-based only) */}
        {isPcm && (
          <div style={{ marginBottom: 'var(--space-5)' }}>
            <label style={{ display: 'flex', alignItems: 'center', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
              {t('settings.bitDepth')}
              <InfoTooltip text={t('tooltip.bitDepth')} />
            </label>
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              {['original', '16', '24', '32'].map((depth) => {
                const isActive = settings.bitDepth === depth
                return (
                  <button
                    key={depth}
                    onClick={() => {
                      setBitDepth(depth)
                      window.formatConverter.setSettings({ bitDepth: depth })
                    }}
                    style={{
                      padding: '4px 10px',
                      border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: isActive ? 'rgba(201, 162, 75, 0.1)' : 'transparent',
                      color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontFamily: "'IBM Plex Mono', monospace"
                    }}
                  >
                    {depth}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Max Concurrent Conversions + Auto */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
          {t('settings.concurrentLimit')}: <strong>{settings.concurrentLimit}</strong>
        </label>
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={settings.concurrentLimit}
          onChange={(e) => {
            const val = Number(e.target.value)
            setConcurrentLimit(val)
            window.formatConverter.setSettings({ concurrentLimit: val })
          }}
          style={{
            width: '100%',
            accentColor: 'var(--accent)',
            height: '6px',
            cursor: 'pointer',
            marginBottom: 'var(--space-3)'
          }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '14px', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: 'var(--space-1)' }}>
          <input
            type="checkbox"
            checked={settings.autoConcurrent}
            onChange={(e) => {
              setAutoConcurrent(e.target.checked)
              window.formatConverter.setSettings({ autoConcurrent: e.target.checked })
            }}
            style={{ accentColor: 'var(--accent)' }}
          />
          {t('settings.autoConcurrent')}
        </label>
        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
          {t('settings.autoConcurrentHint')}
        </div>
      </div>

      {/* When File Exists */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
          {t('settings.duplicateAction')}
        </label>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          {[
            { value: 'overwrite', label: t('settings.duplicateOverwrite') },
            { value: 'skip', label: t('settings.duplicateSkip') },
            { value: 'rename', label: t('settings.duplicateRename') }
          ].map((opt) => {
            const isActive = settings.duplicateAction === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => {
                  setDuplicateAction(opt.value)
                  window.formatConverter.setSettings({ duplicateAction: opt.value })
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

      {/* Key Management */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h3
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: '16px',
            color: 'var(--text-primary)',
            marginBottom: 'var(--space-6)',
            fontWeight: 600
          }}
        >
          {t('settings.keyManagement')}
        </h3>

        {/* QMCv2 Ekey */}
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
            {t('settings.qmcEkey')}
          </label>
          <input
            type="text"
            value={settings.qmcEkey}
            onChange={(e) => {
              setQmcEkey(e.target.value)
              window.formatConverter.setSettings({ qmcEkey: e.target.value })
            }}
            placeholder={t('settings.qmcEkeyHint')}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--surface-1)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              fontSize: '13px',
              fontFamily: "'IBM Plex Mono', monospace",
              outline: 'none'
            }}
          />
        </div>

        {/* KGG Keys */}
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
            {t('settings.kggKeys')}
          </label>
          <div style={{ fontSize: '14px', color: 'var(--text-primary)', marginBottom: 'var(--space-3)' }}>
            {t('settings.kggKeysCount', { count: kggKeyCount })}
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <button
              onClick={handleImportKgg}
              disabled={kggScanning}
              style={{
                padding: '8px 16px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--surface-2)',
                color: kggScanning ? 'var(--text-tertiary)' : 'var(--text-primary)',
                cursor: kggScanning ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontFamily: 'inherit'
              }}
            >
              {kggScanning ? t('settings.scanning') : t('settings.importKggKeys')}
            </button>
            <button
              onClick={handleScanKgg}
              disabled={kggScanning}
              style={{
                padding: '8px 16px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--surface-2)',
                color: kggScanning ? 'var(--text-tertiary)' : 'var(--text-primary)',
                cursor: kggScanning ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontFamily: 'inherit'
              }}
            >
              {kggScanning ? t('settings.scanning') : t('settings.scanKggKeys')}
            </button>
          </div>
          {kggMessage && (
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: 'var(--space-2)' }}>
              {kggMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SettingsPanel
