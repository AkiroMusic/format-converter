/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 */

import { ipcMain, dialog } from 'electron'

export function registerDialogHandlers(): void {
  // Legacy handler — kept for backward compatibility
  ipcMain.handle('dialog:selectNcmFiles', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'NCM Audio Files', extensions: ['ncm'] }]
    })
    return result.canceled ? [] : result.filePaths
  })

  // Multi-format file selection (Phase 1 — no external key needed)
  ipcMain.handle('dialog:selectFiles', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'All Supported Audio Files',
          extensions: [
            'ncm', 'kwm', 'kgm', 'kgma', 'vpr',
            'qmc0', 'qmc3', 'qmcflac', 'qmcogg', 'qmc1', 'qmc2', 'tkm'
          ]
        },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    return result.canceled ? [] : result.filePaths
  })

  ipcMain.handle('dialog:selectFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // Plain audio file selection (non-encrypted formats)
  ipcMain.handle('dialog:selectPlainAudio', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Audio Files',
          extensions: ['mp3', 'flac', 'wav', 'm4a', 'aac', 'ogg', 'opus', 'aiff', 'alac', 'wma', 'ape']
        },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    return result.canceled ? [] : result.filePaths
  })

  // KGG key database selection
  ipcMain.handle('dialog:selectKggDatabase', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'KGG Key Database', extensions: ['db'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // FFmpeg binary manual selection
  ipcMain.handle('dialog:selectFfmpegBinary', async () => {
    const isWin = process.platform === 'win32'
    const result = await dialog.showOpenDialog({
      title: 'Select FFmpeg Binary',
      message: isWin
        ? 'Please select the ffmpeg.exe file itself (not the folder). The matching ffprobe.exe will be auto-detected from the same directory.'
        : 'Please select the ffmpeg binary file itself. The matching ffprobe will be auto-detected from the same directory.',
      properties: ['openFile'],
      filters: [
        { name: 'FFmpeg Binary', extensions: isWin ? ['exe'] : ['*'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    return result.canceled ? null : result.filePaths[0]
  })
}
