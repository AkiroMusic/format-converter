/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 *
 * ZIP download IPC handler.
 */

import { ipcMain, dialog } from 'electron'
import { readFile } from 'fs/promises'
import { extname } from 'path'
import JSZip from 'jszip'

export function registerZipHandlers(): void {
  ipcMain.handle(
    'convert:downloadAsZip',
    async (
      _event,
      payload: { filePaths: string[]; fileNames: string[] }
    ): Promise<{ success: boolean; outputPath?: string; error?: string }> => {
      try {
        const { filePaths, fileNames } = payload

        if (filePaths.length === 0) {
          return { success: false, error: 'No files to download' }
        }

        // Default filename
        const defaultName = `converted-${Date.now()}.zip`

        const result = await dialog.showSaveDialog({
          title: 'Save ZIP Archive',
          defaultPath: defaultName,
          filters: [{ name: 'ZIP Archive', extensions: ['zip'] }]
        })

        if (result.canceled || !result.filePath) {
          return { success: false, error: 'Save cancelled' }
        }

        const zip = new JSZip()

        for (let i = 0; i < filePaths.length; i++) {
          const filePath = filePaths[i]
          const fileName = fileNames[i] || `file_${i}${extname(filePath)}`
          const data = await readFile(filePath)
          zip.file(fileName, data)
        }

        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } })
        const { writeFile } = await import('fs/promises')
        await writeFile(result.filePath, zipBuffer)

        return { success: true, outputPath: result.filePath }
      } catch (err) {
        return { success: false, error: (err as Error).message }
      }
    }
  )
}