# Format Converter

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/AkiroMusic/format-converter)](https://github.com/AkiroMusic/format-converter/releases)

A cross-platform desktop audio format converter built with Electron. Decrypts proprietary music formats (NCM, KWM, KGM, QMC) and converts between standard audio formats — all processing is done **entirely offline** on your local machine.

> **Developer**: [Akiro](https://akiromusic.com) (AkiroMusic) · Contact: [akiromusic@qq.com](mailto:akiromusic@qq.com)

---

## Features

| Category | Capabilities |
|----------|-------------|
| **Format Support** | Decrypt `.ncm` (NetEase), `.kwm`/`.kgm` (Kuwo/Kugou), `.qmc` (QQ Music); convert to MP3, FLAC, WAV, OGG, M4A, AAC, AIFF, ALAC, Opus |
| **Batch Processing** | Queue hundreds of files, configurable concurrency (auto or manual 1–10), real-time progress bars |
| **Metadata Preservation** | Automatically writes title, artist, album, cover art, track number, genre, and year as ID3v2 tags |
| **Audio Preview** | Built-in player with play queue, previous/next, volume control, seek, and lyrics display |
| **Custom File Naming** | Flexible template system using `{title}`, `{artist}`, `{album}`, `{track}`, `{year}` variables |
| **Conversion History** | Persistent history with status filtering, clear, and retry capabilities |
| **Loudness Normalization** | EBU R128 standard (−23 to −6 LUFS), with presets matched to streaming platform targets |
| **Lyrics** | Extract embedded lyrics from source files; embed companion `.lrc` files during conversion |
| **Themes** | 7 themes: System, Dark, Light, Sepia, Forest, Ocean, Lavender |
| **i18n** | English & 简体中文, auto-detected or user-selected |
| **Encrypted Key Management** | QMCv2 ekey and KGG key database import for decryption of key-protected formats |
| **Conversion Presets** | Save and load preset configurations (format, bitrate, sample rate, etc.) |
| **Settings Sync** | Export/import settings across machines |
| **Zero Configuration** | FFmpeg is bundled in the installer — no manual setup needed |

---

## Downloads

Grab the latest installer from the [Releases](https://github.com/AkiroMusic/format-converter/releases) page.

| Platform | Architecture | File |
|----------|-------------|------|
| Windows | x64 | `Format-Converter-Setup-*.exe` |
| macOS | Universal (Intel + Apple Silicon) | `Format-Converter-*.dmg` |

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Paste file(s) from clipboard | `Ctrl+V` |
| Remove selected files | `Delete` |
| Select all / Deselect all | `Ctrl+A` (toggles) |
| Toggle fullscreen | `F11` |

---

## Tips

- **Drag & drop**: You can drag files or entire folders directly onto the drop zone.
- **Encrypted formats**: NCM, KWM, KGM, QMC files are decrypted automatically during conversion. Some formats (QMCv2, KGG) may require importing additional keys.
- **FFmpeg fallback**: If the bundled FFmpeg is not found, you can manually locate an existing FFmpeg binary in Settings.
- **No data leaves your computer**: All decryption and conversion is done locally. Your files never leave your machine.

---

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) 22+
- npm 10+

### Setup

```bash
git clone https://github.com/AkiroMusic/format-converter.git
cd format-converter
npm install
```

### Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Launch development mode (Vite HMR + Electron) |
| `npm run build` | Build production bundles (main + preload + renderer) |
| `npm test` | Run test suite (Vitest) |
| `npm run download:ffmpeg` | Download FFmpeg for the current platform |
| `npm run download:ffmpeg:all` | Download FFmpeg for all platforms |
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
│       ├── components/ # React components
│       ├── store/      # Zustand stores
│       ├── locales/    # i18n JSON files
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

---

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE).

---

<br>

<h2 align="center">格式转换器</h2>

<p align="center">基于 Electron 的跨平台桌面音频格式转换工具。解密专有音乐格式（NCM、KWM、KGM、QMC）并在标准音频格式之间进行转换——<strong>所有处理完全在本地离线完成</strong>。</p>

<h3>功能特点</h3>

| 类别 | 能力 |
|------|------|
| **格式支持** | 解密 `.ncm`（网易云）、`.kwm`/`.kgm`（酷我/酷狗）、`.qmc`（QQ 音乐）；输出 MP3、FLAC、WAV、OGG、M4A、AAC、AIFF、ALAC、Opus |
| **批量处理** | 队列容纳数百文件，可调节并发数（自动或手动 1–10），实时进度条 |
| **元数据保留** | 自动写入标题、艺术家、专辑、封面图、音轨号、流派、年份等 ID3v2 标签 |
| **音频预览** | 内置播放器，支持播放队列、上下曲、音量控制、进度拖拽和歌词显示 |
| **自定义文件名** | 灵活的模板系统，支持 `{title}`、`{artist}`、`{album}`、`{track}`、`{year}` 变量 |
| **转换历史** | 持久化历史记录，支持状态过滤、清除和重试 |
| **响度标准化** | EBU R128 标准（−23 ~ −6 LUFS），提供流媒体平台目标预设 |
| **歌词** | 提取源文件内嵌歌词；转换时嵌入同目录 `.lrc` 歌词文件 |
| **主题** | 7 种主题：跟随系统、深色、浅色、暖棕、森林、海洋、薰衣草 |
| **多语言** | 简体中文 & English，自动检测或手动选择 |
| **密钥管理** | 导入 QMCv2 ekey 和 KGG 密钥数据库，解密受密钥保护的音乐格式 |
| **转换预设** | 保存和加载预设配置（格式、比特率、采样率等） |
| **设置同步** | 跨设备导出/导入设置 |
| **零配置** | FFmpeg 已内置在安装包中，无需手动配置 |

### 下载

从 [Releases 页面](https://github.com/AkiroMusic/format-converter/releases) 获取最新安装包。

### 提示

- **拖放操作**：可以直接将文件或整个文件夹拖入拖放区域。
- **加密格式**：NCM、KWM、KGM、QMC 文件在转换时自动解密。部分格式（QMCv2、KGG）可能需要导入额外密钥。
- **FFmpeg 回溯**：如果内置 FFmpeg 未找到，可在设置中手动指定已有的 FFmpeg 二进制文件路径。
- **数据安全**：所有解密和转换均在本地完成，您的文件不会离开本机。
