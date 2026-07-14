/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 */

/**
 * Tests for output filename template rendering.
 */

import { describe, it, expect } from 'vitest'
import { renderFilenameTemplate, sanitizeFileName, DEFAULT_TEMPLATE } from './template'

describe('sanitizeFileName', () => {
  it('should replace illegal Windows chars with underscores', () => {
    expect(sanitizeFileName('a<b>c:d"e/f\\g|h?i*j')).toBe('a_b_c_d_e_f_g_h_i_j')
  })

  it('should keep valid characters unchanged', () => {
    expect(sanitizeFileName('Hello World - 2024')).toBe('Hello World - 2024')
  })

  it('should handle unicode characters', () => {
    expect(sanitizeFileName('歌手名')).toBe('歌手名')
  })

  it('should handle empty string', () => {
    expect(sanitizeFileName('')).toBe('')
  })
})

describe('renderFilenameTemplate', () => {
  const vars = {
    artist: 'Test Artist',
    title: 'Test Song',
    album: 'Test Album'
  }

  it('should render {artist} - {title} template', () => {
    const result = renderFilenameTemplate('{artist} - {title}', vars)
    expect(result).toBe('Test Artist - Test Song')
  })

  it('should render {title} template only', () => {
    const result = renderFilenameTemplate('{title}', vars)
    expect(result).toBe('Test Song')
  })

  it('should render with album', () => {
    const result = renderFilenameTemplate('{album}/{artist} - {title}', vars)
    expect(result).toBe('Test Album/Test Artist - Test Song')
  })

  it('should sanitize illegal characters', () => {
    const bad = { artist: 'A/B:C', title: 'D<E', album: 'F?G' }
    const result = renderFilenameTemplate('{artist} - {title}', bad)
    expect(result).toBe('A_B_C - D_E')
  })

  it('should fall back to default when template is empty', () => {
    const result = renderFilenameTemplate('', vars)
    expect(result).toBe('Test Artist - Test Song')
  })

  it('should fall back to default when template is whitespace', () => {
    const result = renderFilenameTemplate('   ', vars)
    expect(result).toBe('Test Artist - Test Song')
  })

  it('should handle missing optional vars gracefully', () => {
    const minimal = { artist: '', title: '', album: '' }
    const result = renderFilenameTemplate('{artist} - {title}', minimal)
    expect(result).toBe('Unknown Artist - Unknown Title')
  })

  it('should keep literal text without placeholders', () => {
    const result = renderFilenameTemplate('my-filename', vars)
    expect(result).toBe('my-filename')
  })

  it('should use DEFAULT_TEMPLATE', () => {
    expect(DEFAULT_TEMPLATE).toBe('{artist} - {title}')
  })
})
