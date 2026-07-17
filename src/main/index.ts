/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 */

import { app, BrowserWindow, ipcMain, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createWindow } from './window'
import { registerDialogHandlers } from './ipc/dialog'
import { registerConvertHandlers } from './ipc/convert'
import { registerHistoryHandlers } from './ipc/history'
import { registerKggHandlers } from './ipc/kgg'
import { registerZipHandlers } from './ipc/zip'
import { registerSettingsHandlers, settingsStore } from './ipc/settings'
import { registerShellHandlers } from './ipc/shell'
import { registerNotificationHandlers } from './ipc/notification'
import { registerThemeHandlers } from './ipc/theme'
import { ensureFfmpeg, type FfmpegStatus } from './ffmpeg-check'
import { existsSync } from 'fs'

let mainWindow: BrowserWindow | null = null
/** Cached FFmpeg availability — shared with renderer via IPC. */
let ffmpegStatus: FfmpegStatus = { available: true, ffmpegPath: 'ffmpeg', ffprobePath: 'ffprobe' }

function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

/** Re-run FFmpeg check and broadcast to renderer */
async function refreshFfmpegStatus(): Promise<FfmpegStatus> {
  // Try custom path from settings, fall back to bundled
  const customPath = settingsStore.store.customFfmpegPath as string | undefined
  ffmpegStatus = await ensureFfmpeg(customPath)
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('ffmpeg:statusChanged', ffmpegStatus)
  }
  return ffmpegStatus
}

/** Extract supported file paths from command-line args (Windows file association) */
function extractFilePathsFromArgv(argv: string[]): string[] {
  // First arg is the app path, skip it
  // Subsequent args may be file paths from the shell
  const supportedExts = new Set([
    '.ncm', '.kwm', '.kgm', '.kgma', '.vpr',
    '.qmc0', '.qmc3', '.qmcflac', '.qmcogg', '.qmc1', '.qmc2', '.tkm',
    '.mflac', '.mflac0', '.mgg',
    '.kgg'
  ])
  return argv.slice(1).filter((arg) => {
    const ext = arg.toLowerCase().slice(arg.lastIndexOf('.'))
    return supportedExts.has(ext) && existsSync(arg)
  })
}

/** Push file paths to the renderer (if window is ready) */
function sendFilesToRenderer(filePaths: string[]): void {
  if (mainWindow && !mainWindow.isDestroyed() && filePaths.length > 0) {
    mainWindow.webContents.send('files:openedFromOs', filePaths)
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
}

// ---- Single-instance lock (Windows file association) ----
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  // Another instance is already running — that instance's
  // 'second-instance' handler will receive our argv.
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    const paths = extractFilePathsFromArgv(argv)
    if (paths.length > 0) sendFilesToRenderer(paths)
  })
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.akiro.format-converter')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

    // --- Register IPC handlers ---
    registerDialogHandlers()
    registerConvertHandlers(getMainWindow)
    registerSettingsHandlers()
    registerShellHandlers()
    registerHistoryHandlers()
    registerKggHandlers()
    registerZipHandlers()
    registerNotificationHandlers()
    registerThemeHandlers(getMainWindow)

    // Window title IPC
    ipcMain.handle('window:setTitle', (_event, title: string): void => {
      mainWindow?.setTitle(title || 'Format Converter')
    })

    // Dynamic app icon (taskbar / dock) — single transparent icon
    ipcMain.handle('window:setAppIcon', (_event): void => {
      if (!mainWindow) return
      // Dev: ../../build/  — Production: process.resourcesPath/extra/
      const iconPath = app.isPackaged
        ? join(process.resourcesPath, 'extra', 'icon.png')
        : join(__dirname, '../../build', 'icon.png')
      mainWindow.setIcon(nativeImage.createFromPath(iconPath))
    })

    // FFmpeg status IPC — return cached status (updated async below)
    ipcMain.handle('ffmpeg:getStatus', async (): Promise<FfmpegStatus> => {
      return ffmpegStatus
    })

    // Re-check FFmpeg (e.g. after user sets custom path via Select Binary)
    ipcMain.handle('ffmpeg:recheck', async (): Promise<FfmpegStatus> => {
      return await refreshFfmpegStatus()
    })

    // Window control IPC
    ipcMain.handle('window:minimize', () => {
      mainWindow?.minimize()
    })

    ipcMain.handle('window:maximize', () => {
      if (mainWindow?.isMaximized()) {
        mainWindow.unmaximize()
      } else {
        mainWindow?.maximize()
      }
    })

    ipcMain.handle('window:isMaximized', (): boolean => {
      return mainWindow?.isMaximized() ?? false
    })

    ipcMain.handle('window:fullscreen', () => {
      const isFullScreen = mainWindow?.isFullScreen() ?? false
      mainWindow?.setFullScreen(!isFullScreen)
    })

    // Create window first — show UI immediately without waiting for FFmpeg check
    mainWindow = createWindow()

    // Set initial app icon — single transparent icon
    {
      const iconPath = app.isPackaged
        ? join(process.resourcesPath, 'extra', 'icon.png')
        : join(__dirname, '../../build', 'icon.png')
      try { mainWindow.setIcon(nativeImage.createFromPath(iconPath)) } catch { /* best-effort */ }
    }

    // If launched via file association (first instance on Windows),
    // check process.argv for file paths
    const startupPaths = extractFilePathsFromArgv(process.argv)
    if (startupPaths.length > 0) {
      mainWindow.webContents.once('did-finish-load', () => {
        sendFilesToRenderer(startupPaths)
      })
    }

    // Run FFmpeg health check in the background — does NOT block the window
    // The renderer subscribes to 'ffmpeg:statusChanged' and will receive the
    // result as soon as the check completes.
    refreshFfmpegStatus()

  // Forward maximize/unmaximize events to renderer
  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window:maximizeChanged', true)
  })
  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window:maximizeChanged', false)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
    }
  })
})

// ---- macOS: open-file event (file association / drag to dock icon) ----
app.on('open-file', (event, filePath) => {
  event.preventDefault()
  sendFilesToRenderer([filePath])
})

app.on('window-all-closed', () => {
  // macOS convention: app stays open when all windows close
  // Windows convention: app quits when all windows close
  if (process.platform === 'win32') {
    app.quit()
  }
})

// ---- macOS app menu ----
if (process.platform === 'darwin') {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: app.name,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      },
      {
        label: 'File',
        submenu: [
          { role: 'close' }
        ]
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' }
        ]
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' }
        ]
      },
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'zoom' },
          { type: 'separator' },
          { role: 'front' }
        ]
      }
    ])
  )
}
