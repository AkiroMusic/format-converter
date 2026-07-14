/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 *
 * Notification IPC handler.
 */

import { ipcMain, Notification } from 'electron'

export function registerNotificationHandlers(): void {
  ipcMain.handle('notification:show', async (_event, payload: { title: string; body: string }): Promise<void> => {
    const notification = new Notification({
      title: payload.title,
      body: payload.body
    })
    notification.show()
  })
}
