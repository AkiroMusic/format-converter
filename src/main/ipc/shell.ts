/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 */

import { ipcMain, shell, app } from 'electron'

export function registerShellHandlers(): void {
  ipcMain.handle('fs:revealInFolder', async (_event, filePath: string) => {
    shell.showItemInFolder(filePath)
  })

  ipcMain.handle('fs:openFile', async (_event, filePath: string) => {
    await shell.openPath(filePath)
  })

  ipcMain.handle('shell:openUrl', async (_event, url: string) => {
    await shell.openExternal(url)
  })
}
