/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 *
 * KGG key management IPC handlers.
 */

import { ipcMain } from 'electron'
import { app } from 'electron'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import {
  autoScanKeys,
  importFromDb,
  loadKeysMap,
  saveKeysMap,
  KggScanResult
} from '../kggKeys'
import { settingsStore } from './settings'

function getKeysPath(): string {
  return join(app.getPath('userData'), 'kgg.keys')
}

export function registerKggHandlers(): void {
  ipcMain.handle('kgg:scan', async (): Promise<KggScanResult> => {
    return autoScanKeys(app.getPath('userData'))
  })

  ipcMain.handle('kgg:importFromFile', async (_event, dbPath: string): Promise<{ success: boolean; added: number; total: number; error?: string }> => {
    try {
      if (!existsSync(dbPath)) {
        return { success: false, added: 0, total: 0, error: 'File not found' }
      }
      const buf = readFileSync(dbPath)
      const incoming = await importFromDb(buf)

      const keysPath = getKeysPath()
      const currentMap = loadKeysMap(keysPath)
      const initialSize = currentMap.size

      for (const [id, val] of incoming.entries()) {
        currentMap.set(id, val)
      }

      saveKeysMap(keysPath, currentMap)

      // Save the import path to settings
      settingsStore.set('kggKeyImportPath' as any, dbPath)

      return { success: true, added: currentMap.size - initialSize, total: currentMap.size }
    } catch (err) {
      return { success: false, added: 0, total: 0, error: (err as Error).message }
    }
  })

  ipcMain.handle('kgg:getKeyCount', async (): Promise<number> => {
    const map = loadKeysMap(getKeysPath())
    return map.size
  })
}
