/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 *
 * Application icon component. Uses single transparent icon.
 */

import iconSrc from '../assets/icon.png'

interface AppIconProps {
  size?: number
}

function AppIcon({ size = 22 }: AppIconProps): JSX.Element {
  return (
    <img
      src={iconSrc}
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
