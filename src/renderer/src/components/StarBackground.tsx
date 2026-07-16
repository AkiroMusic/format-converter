/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 *
 * Subtle star cluster in the bottom-right corner.
 * Stars form a small crown/dipper pattern, very low opacity —
 * atmospheric background, not distracting.
 */

import { useMemo } from 'react'

interface Star {
  id: number
  bottom: number  // px from bottom
  right: number   // px from right
  size: number    // px
  delay: number   // animation delay (s)
  duration: number // animation duration (s)
}

/** Five-point star SVG path */
const STAR_PATH =
  'M12 2l2.6 5.3L20 8l-4 3.9.9 5.5L12 14.5 7.1 17.4 8 11.9 4 8l5.4-.7z'

/** Stars arranged as a small constellation in the bottom-right corner.
 *  Positions are relative to bottom-right so they stay put on resize. */
const STARS: Star[] = [
  // Crown/dipper pattern — anchored at bottom-right
  { id: 0, bottom: 100, right: 100, size: 14, delay: 0,    duration: 4 },
  { id: 1, bottom: 140, right: 140, size: 10, delay: 1.5,  duration: 5 },
  { id: 2, bottom: 150, right: 70,  size: 9,  delay: 0.8,  duration: 3.5 },
  { id: 3, bottom: 80,  right: 160, size: 11, delay: 2.2,  duration: 4.5 },
  { id: 4, bottom: 50,  right: 120, size: 8,  delay: 1,    duration: 6 },
  { id: 5, bottom: 170, right: 110, size: 12, delay: 0.3,  duration: 4 },
  { id: 6, bottom: 120, right: 60,  size: 7,  delay: 1.8,  duration: 3 },
  { id: 7, bottom: 60,  right: 80,  size: 10, delay: 2.5,  duration: 5.5 },
]

function StarBackground(): JSX.Element {
  const stars = useMemo(() => STARS, [])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden',
      }}
    >
      <style>{`
        @keyframes starPulse {
          0%   { opacity: 0.08; transform: translate(50%, 50%) scale(0.85); }
          50%  { opacity: 0.20; transform: translate(50%, 50%) scale(1.15); }
          100% { opacity: 0.08; transform: translate(50%, 50%) scale(0.85); }
        }
      `}</style>

      {stars.map((star) => (
        <svg
          key={star.id}
          viewBox="0 0 24 24"
          width={star.size}
          height={star.size}
          style={{
            position: 'absolute',
            bottom: star.bottom,
            right: star.right,
            opacity: 0,
            animation: `starPulse ${star.duration}s ease-in-out ${star.delay}s infinite`,
            color: 'var(--accent-secondary)',
            transform: 'translate(50%, 50%)',
            filter: 'blur(0.3px)',
          }}
        >
          <path d={STAR_PATH} fill="currentColor" />
        </svg>
      ))}
    </div>
  )
}

export default StarBackground
