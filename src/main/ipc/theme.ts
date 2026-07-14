/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 *
 * System theme IPC handler.
 * Listens for OS color scheme changes and forwards to the renderer.
 */

import { ipcMain, nativeTheme, BrowserWindow } from 'electron'

export function registerThemeHandlers(getMainWindow: () => BrowserWindow | null): void {
  // Renderer asks: is system dark mode?
  ipcMain.handle('theme:getSystemTheme', async (): Promise<'dark' | 'light'> => {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  })

  // Forward OS theme changes to renderer
  nativeTheme.on('updated', () => {
    const win = getMainWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('theme:systemChanged', nativeTheme.shouldUseDarkColors ? 'dark' : 'light')
    }
  })
}
