/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 */

import { useEffect, useState } from 'react'

interface UnlockAnimationProps {
  status: 'converting' | 'success' | 'error' | 'idle'
  progress: number
}

function UnlockAnimation({ status, progress }: UnlockAnimationProps): JSX.Element {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent): void => setPrefersReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // If reduced motion, just show percentage
  if (prefersReducedMotion) {
    return (
      <div
        style={{
          width: '24px',
          height: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '10px',
          fontWeight: 600,
          color: status === 'success' ? 'var(--success)' : status === 'error' ? 'var(--error)' : 'var(--accent)'
        }}
      >
        {status === 'converting' ? Math.round(progress * 100) : status === 'success' ? '✓' : status === 'error' ? '✕' : '🔒'}
      </div>
    )
  }

  // Lock icon SVG
  const lockIcon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )

  // Waveform icon SVG
  const waveformIcon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="10" width="3" height="6" rx="0.5" style={{ transition: 'height 0.15s ease' }} />
      <rect x="8" y="6" width="3" height="14" rx="0.5" style={{ transition: 'height 0.15s ease' }} />
      <rect x="13" y="8" width="3" height="10" rx="0.5" style={{ transition: 'height 0.15s ease' }} />
      <rect x="18" y="4" width="3" height="18" rx="0.5" style={{ transition: 'height 0.15s ease' }} />
    </svg>
  )

  // Success check icon
  const checkIcon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )

  // Error X icon
  const errorIcon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )

  const getColor = (): string => {
    switch (status) {
      case 'converting': return 'var(--accent)'
      case 'success': return 'var(--success)'
      case 'error': return 'var(--error)'
      default: return 'var(--text-tertiary)'
    }
  }

  const animateBounce = status === 'success'
  const animateShake = status === 'error'

  // For converting state, show animated waveform bars
  if (status === 'converting') {
    const barCount = 4
    return (
      <div
        style={{
          width: '24px',
          height: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '2px',
          color: getColor()
        }}
      >
        {Array.from({ length: barCount }).map((_, i) => {
          const barHeight = 4 + (progress * 14 * (0.5 + (i / barCount) * 0.5))
          return (
            <div
              key={i}
              style={{
                width: '3px',
                height: `${Math.max(4, barHeight)}px`,
                backgroundColor: 'currentColor',
                borderRadius: '2px',
                transition: 'height 0.15s ease'
              }}
            />
          )
        })}
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div
        style={{
          width: '24px',
          height: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: animateBounce ? 'unlockBounce 0.2s ease' : 'none'
        }}
      >
        {checkIcon}
        <style>{`
          @keyframes unlockBounce {
            0% { transform: scale(1); }
            50% { transform: scale(1.3); }
            100% { transform: scale(1); }
          }
        `}</style>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div
        style={{
          width: '24px',
          height: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: getColor()
        }}
      >
        {errorIcon}
      </div>
    )
  }

  // Idle: lock icon
  return (
    <div
      style={{
        width: '24px',
        height: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: getColor()
      }}
    >
      {lockIcon}
    </div>
  )
}

export default UnlockAnimation
