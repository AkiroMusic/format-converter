/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 *
 * Theme-aware application icon component.
 * Displays light-icon.png for light / sepia themes,
 * dark-icon.png for all other themes.
 */

import { useMemo } from 'react'
import { useAppStore } from '../store/useAppStore'
import lightIcon from '../assets/light-icon.png'
import darkIcon from '../assets/dark-icon.png'

interface AppIconProps {
  size?: number
}

function AppIcon({ size = 22 }: AppIconProps): JSX.Element {
  const theme = useAppStore((s) => s.settings.theme)

  const src = useMemo(() => {
    // "Warm brown counts as light" → light & sepia use light icon
    if (theme === 'light' || theme === 'sepia') return lightIcon
    // system theme is resolved at the App level; use dark as safe default
    return darkIcon
  }, [theme])

  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      style={{
        borderRadius: '4px',
        flexShrink: 0,
        display: 'block'
      }}
    />
  )
}

export default AppIcon
