/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 */

import { useTranslation } from 'react-i18next'

type ViewType = 'convert' | 'settings' | 'history'

interface SidebarProps {
  currentView: ViewType
  onNavigate: (view: ViewType) => void
}

const navItems: { id: ViewType; icon: string; labelKey: string }[] = [
  { id: 'convert', icon: 'convert', labelKey: 'sidebar.convert' },
  { id: 'history', icon: 'history', labelKey: 'sidebar.history' },
  { id: 'settings', icon: 'settings', labelKey: 'sidebar.settings' }
]

// Inline SVG icons
const icons: Record<string, JSX.Element> = {
  convert: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  history: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  settings: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function Sidebar({ currentView, onNavigate }: SidebarProps): JSX.Element {
  const { t } = useTranslation()

  return (
    <nav
      className="flex flex-col items-center py-4"
      style={{
        width: '60px',
        minWidth: '60px',
        backgroundColor: 'var(--surface-1)',
        borderRight: '1px solid var(--border)',
        flexShrink: 0
      }}
    >
      {navItems.map((item) => {
        const isActive = currentView === item.id
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            title={t(item.labelKey)}
            style={{
              width: '60px',
              height: '52px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              color: isActive ? 'var(--accent)' : 'var(--text-tertiary)',
              transition: 'color 150ms ease'
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.color = 'var(--text-secondary)'
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.color = 'var(--text-tertiary)'
            }}
          >
            {/* Active indicator bar */}
            {isActive && (
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: '8px',
                  bottom: '8px',
                  width: '2px',
                  backgroundColor: 'var(--accent)',
                  borderRadius: '0 2px 2px 0'
                }}
              />
            )}
            {icons[item.id]}
          </button>
        )
      })}
    </nav>
  )
}

export default Sidebar
