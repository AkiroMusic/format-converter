/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 *
 * Conversion history IPC handlers.
 */

import { ipcMain, app } from 'electron'
import { HistoryStore, HistoryRecord } from '../history'

const historyStore = new HistoryStore(app.getPath('userData'))

function registerHistoryHandlers(): void {
  ipcMain.handle('history:getAll', async (): Promise<HistoryRecord[]> => {
    return historyStore.readAll()
  })

  ipcMain.handle('history:clear', async (): Promise<void> => {
    await historyStore.clear()
  })
}

export { registerHistoryHandlers, historyStore }
