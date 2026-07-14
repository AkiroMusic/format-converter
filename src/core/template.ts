/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 */

/**
 * Output filename template helpers.
 * Extracted from convert.ts IPC handler for testability.
 */

export function sanitizeFileName(s: string): string {
  return s.replace(/[<>:"/\\|?*]/g, '_')
}

export interface TemplateVars {
  artist: string
  title: string
  album: string
}

/** Default fallback template when none is configured. */
export const DEFAULT_TEMPLATE = '{artist} - {title}'

/**
 * Render a filename template with the given variables.
 *
 * Supported placeholders: {artist}, {title}, {album}
 * Invalid chars are replaced with underscores.
 */
export function renderFilenameTemplate(
  template: string,
  vars: TemplateVars
): string {
  const safe = {
    artist: sanitizeFileName(vars.artist || 'Unknown Artist'),
    title: sanitizeFileName(vars.title || 'Unknown Title'),
    album: sanitizeFileName(vars.album || 'Unknown Album')
  }

  let result = template
    .replace(/\{artist\}/g, safe.artist)
    .replace(/\{title\}/g, safe.title)
    .replace(/\{album\}/g, safe.album)

  if (!result || result.trim() === '') {
    result = `${safe.artist} - ${safe.title}`
  }

  return result
}
