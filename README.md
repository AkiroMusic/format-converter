# Format Converter

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)

A cross-platform desktop audio format converter built with Electron. Decrypts and converts proprietary music formats (NCM, KWM, KGM, QMC) to standard MP3/FLAC with full metadata preservation.

## Features

- **Multi-format Support** — Decrypt `.ncm` (NetEase Cloud Music), `.kwm`/`.kgm` (Kuwo/Kugou), `.qmc` (QQ Music) to MP3 or FLAC
- **Batch Processing** — Queue hundreds of files, process with configurable concurrency, real-time progress bars
- **Metadata Preservation** — Automatically writes title, artist, album, cover art, track number, genre, and year as ID3v2 tags
- **Audio Preview** — Built-in player with play queue, previous/next, volume control, and seek
- **Custom File Naming** — Flexible template system with `{title}`, `{artist}`, `{album}`, `{track}`, `{year}` variables
- **Conversion History** — Persistent history with filtering by status, clear, and retry
- **Dark & Light Themes** — System-following default, manual toggle
- **i18n** — English & 简体中文 (Chinese), auto-detected or user-selected
- **Zero Configuration** — FFmpeg is bundled in the installer, no manual setup needed

## Downloads

Grab the latest installer from the [Releases](https://github.com/AkiroMusic/format-converter/releases) page.

| Platform | File |
|----------|------|
| Windows (x64) | `Format-Converter-Setup-1.0.0.exe` |
| macOS (Intel + Apple Silicon) | `Format-Converter-1.0.0.dmg` |

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Paste file(s) from clipboard | `Ctrl+V` |
| Remove selected files | `Delete` |
| Select all | `Ctrl+A` |

## Screenshots

> _Coming soon_

## Development

### Prerequisites

- Node.js 22+
- npm 10+

### Setup

```bash
# Clone the repository
git clone https://github.com/AkiroMusic/format-converter.git
cd format-converter

# Install dependencies (FFmpeg binaries are downloaded automatically)
npm install
```

### Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Launch development mode (Vite HMR + Electron) |
| `npm run build` | Build production bundles (main + preload + renderer) |
| `npm test` | Run test suite (Vitest) |
| `npm run typecheck` | TypeScript type checking |
| `npm run lint` | Lint all source files (ESLint + oxlint) |
| `npm run download:ffmpeg` | Download FFmpeg for the current platform |
| `npm run download:ffmpeg:all` | Download FFmpeg for all platforms (win32, darwin, linux) |
| `npm run build:win` | Build Windows installer (NSIS) |
| `npm run build:mac` | Build macOS disk image (DMG) |
| `npm run build:linux` | Build Linux AppImage |

### Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Electron 33 + electron-vite |
| Frontend | React 18 + TypeScript + Tailwind CSS |
| State | Zustand |
| i18n | i18next + react-i18next |
| Encryption | Node.js crypto (AES-128-ECB, RC4) |
| Tag Writing | Native ID3v2 implementation |
| Testing | Vitest |
| Packaging | electron-builder (NSIS / DMG / AppImage) |

### Project Structure

```
src/
├── main/               # Electron main process
│   ├── ipc/            # IPC handlers (convert, dialog, settings, history, etc.)
│   ├── ffmpeg.ts       # FFmpeg/FFprobe wrapper
│   ├── ffmpeg-path.ts  # Platform-aware FFmpeg binary path resolution
│   ├── ffmpeg-check.ts # FFmpeg health check
│   ├── kggKeys.ts      # Kugou decryption key management
│   ├── history.ts      # Conversion history persistence
│   ├── simpleStore.ts  # JSON-backed key-value store
│   └── window.ts       # BrowserWindow creation & management
├── renderer/           # Electron renderer process (React app)
│   └── src/
│       ├── components/ # React components (FileList, SettingsPanel, PlayerBar, etc.)
│       ├── store/      # Zustand stores
│       ├── locales/    # i18n JSON files (en-US, zh-CN)
│       └── styles/     # CSS tokens + Tailwind utilities
├── core/               # Shared core logic
│   ├── decoders/       # Per-format decryption implementations
│   ├── ncmDecrypt.ts   # NetEase Cloud Music (.ncm) decryption
│   ├── kgmDecrypt.ts   # Kugou (.kgm) decryption
│   ├── kwmDecrypt.ts   # Kuwo (.kwm) decryption
│   ├── qmcDecrypt.ts   # QQ Music (.qmc) decryption
│   ├── decoderRouter.ts# Format detection & decoder dispatch
│   ├── id3Writer.ts    # ID3v2 tag writer
│   ├── template.ts     # File name template engine
│   ├── types.ts        # Shared type definitions
│   └── convertPipeline.ts # Conversion pipeline orchestration
└── preload/            # Electron preload scripts
```

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE).
