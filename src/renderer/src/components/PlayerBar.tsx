/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store/useAppStore'

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function PlayerBar(): JSX.Element {
  const { t } = useTranslation()
  const currentPreviewId = useAppStore((s) => s.currentPreviewId)
  const setCurrentPreview = useAppStore((s) => s.setCurrentPreview)
  const files = useAppStore((s) => s.files)
  const volume = useAppStore((s) => s.volume)
  const setVolume = useAppStore((s) => s.setVolume)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const currentFile = files.find((f) => f.id === currentPreviewId)

  const getPlaylist = useCallback((): FileEntry[] => {
    return files.filter((f) => f.status === 'success' && f.outputPath)
  }, [files])

  const playNext = useCallback((): void => {
    const playlist = getPlaylist()
    if (playlist.length === 0 || !currentPreviewId) return
    const currentIndex = playlist.findIndex((f) => f.id === currentPreviewId)
    const nextIndex = (currentIndex + 1) % playlist.length
    setCurrentPreview(playlist[nextIndex].id)
  }, [getPlaylist, currentPreviewId, setCurrentPreview])

  const playPrev = useCallback((): void => {
    const playlist = getPlaylist()
    if (playlist.length === 0 || !currentPreviewId) return
    const currentIndex = playlist.findIndex((f) => f.id === currentPreviewId)
    const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length
    setCurrentPreview(playlist[prevIndex].id)
  }, [getPlaylist, currentPreviewId, setCurrentPreview])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  // Load audio when file changes
  useEffect(() => {
    if (!currentFile?.outputPath) {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      setIsPlaying(false)
      setCurrentTime(0)
      setDuration(0)
      return
    }

    const audio = new Audio(`file://${currentFile.outputPath}`)
    audio.volume = volume
    audioRef.current = audio

    audio.addEventListener('loadedmetadata', () => {
      setDuration(audio.duration)
    })

    audio.addEventListener('timeupdate', () => {
      setCurrentTime(audio.currentTime)
    })

    audio.addEventListener('ended', () => {
      playNext()
    })

    audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))

    return () => {
      audio.pause()
      if (audioRef.current === audio) {
        audioRef.current = null
      }
    }
  }, [currentPreviewId, currentFile?.outputPath])

  // Sync volume changes to audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
    }
  }, [volume])

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return
    if (audioRef.current.paused) {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {})
    } else {
      audioRef.current.pause()
      setIsPlaying(false)
    }
  }, [])

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const percent = (e.clientX - rect.left) / rect.width
    const newTime = percent * duration
    audioRef.current.currentTime = newTime
    setCurrentTime(newTime)
  }, [duration])

  const handleClose = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setCurrentPreview(null)
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
  }, [setCurrentPreview])

  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newVolume = parseFloat(e.target.value)
      setVolume(newVolume)
    },
    [setVolume]
  )

  const toggleMute = useCallback(() => {
    setVolume(volume === 0 ? 0.7 : 0)
  }, [volume, setVolume])

  // Keyboard shortcut: Space to toggle play
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.code === 'Space' && currentPreviewId && !e.target) {
        e.preventDefault()
        togglePlay()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [currentPreviewId, togglePlay])

  if (!currentFile) return <div />

  const coverSrc = currentFile.coverImageBase64
    ? `data:image/jpeg;base64,${currentFile.coverImageBase64}`
    : undefined

  return (
    <div
      style={{
        backgroundColor: 'var(--surface-1)',
        borderTop: '1px solid var(--border)',
        padding: '12px 24px',
        flexShrink: 0
      }}
    >
      <div
        className="flex items-center"
        style={{ maxWidth: '720px', margin: '0 auto', gap: '12px' }}
      >
        {/* Cover */}
        <img
          src={coverSrc || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="%235B606E"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>'}
          alt={currentFile.songName || ''}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: 'var(--radius-sm)',
            objectFit: 'cover',
            backgroundColor: 'var(--surface-2)',
            flexShrink: 0
          }}
        />

        {/* Info + Progress */}
        <div className="flex-1" style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 500,
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {currentFile.songName || currentFile.fileName || t('player.noAudio')}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {currentFile.artist || t('player.placeholder')}
          </div>

          {/* Progress bar (clickable) */}
          <div
            onClick={handleSeek}
            style={{
              width: '100%',
              height: '4px',
              backgroundColor: 'var(--border)',
              borderRadius: '2px',
              marginTop: '6px',
              cursor: 'pointer',
              position: 'relative'
            }}
          >
            <div
              style={{
                width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                height: '100%',
                backgroundColor: 'var(--accent)',
                borderRadius: '2px',
                transition: 'width 0.1s linear'
              }}
            />
          </div>

          {/* Time display */}
          <div
            className="flex justify-between"
            style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}
          >
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Previous track */}
        <button
          onClick={playPrev}
          style={{
            width: '32px',
            height: '32px',
            border: 'none',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'transparent',
            color: 'var(--text-secondary)',
            flexShrink: 0,
            transition: 'all 150ms ease'
          }}
          title={t('player.previous')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="19 20 9 12 19 4 19 20" />
            <line x1="5" y1="4" x2="5" y2="20" stroke="currentColor" strokeWidth="2" />
          </svg>
        </button>

        {/* Play/Pause button */}
        <button
          onClick={togglePlay}
          style={{
            width: '40px',
            height: '40px',
            border: 'none',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--accent)',
            color: '#12141A',
            flexShrink: 0,
            transition: 'all 150ms ease'
          }}
          title={isPlaying ? t('player.pause') : t('player.play')}
        >
          {isPlaying ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          )}
        </button>

        {/* Next track */}
        <button
          onClick={playNext}
          style={{
            width: '32px',
            height: '32px',
            border: 'none',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'transparent',
            color: 'var(--text-secondary)',
            flexShrink: 0,
            transition: 'all 150ms ease'
          }}
          title={t('player.next')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 4 15 12 5 20 5 4" />
            <line x1="19" y1="4" x2="19" y2="20" stroke="currentColor" strokeWidth="2" />
          </svg>
        </button>

        {/* Volume control */}
        <div
          className="flex items-center"
          style={{ gap: '6px', flexShrink: 0 }}
        >
          <button
            onClick={toggleMute}
            style={{
              width: '28px',
              height: '28px',
              border: 'none',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              flexShrink: 0,
              transition: 'all 150ms ease'
            }}
            title={t('player.volume')}
          >
            {volume === 0 ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            ) : volume < 0.5 ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={handleVolumeChange}
            style={{
              width: '80px',
              height: '4px',
              cursor: 'pointer',
              accentColor: 'var(--accent)'
            }}
            title={t('player.volume')}
          />
        </div>

        {/* Close button */}
        <button
          onClick={handleClose}
          style={{
            width: '32px',
            height: '32px',
            border: 'none',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'transparent',
            color: 'var(--text-tertiary)',
            flexShrink: 0,
            transition: 'all 150ms ease'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default PlayerBar
