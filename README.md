# NCM Format Converter

网易云音乐 `.ncm` 文件解密与格式转换工具，基于 Electron 构建。

## 功能

- **解密** — 将 `.ncm` 文件还原为 MP3 / FLAC
- **批量转换** — 多文件并行处理，实时进度显示
- **元数据保留** — 自动写入封面、标题、艺术家、专辑等 ID3 标签
- **文件名模板** — 自定义输出文件名格式（支持 `{title}`、`{artist}`、`{album}` 等变量）
- **音频预览** — 内置播放器，支持上一首 / 下一首、音量调节
- **双主题** — 深色 / 浅色模式一键切换
- **国际化** — 简体中文 / English

## 下载

从 [Releases](https://github.com/AkiroMusic/ncm-format-converter/releases) 获取最新版本：

| 平台 | 文件 |
|------|------|
| Windows | `NCM-Format-Converter-Setup-1.0.0.exe` |
| macOS (Intel + Apple Silicon) | `NCM-Format-Converter-1.0.0.dmg` |

## 使用

1. 打开应用，将 `.ncm` 文件拖入窗口或点击选择
2. 在设置面板中选择输出格式（MP3 / FLAC）和并发数量
3. 点击转换按钮开始处理
4. 完成后可在输出目录中找到转换后的文件

### 快捷键

| 操作 | 快捷键 |
|------|--------|
| 粘贴文件 | `Ctrl + V` |
| 删除选中 | `Delete` |
| 全选 | `Ctrl + A` |

## 开发

```bash
# 安装依赖
npm install

# 启动开发模式
npm run dev

# 运行测试
npm test

# 构建安装包
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
```

## 技术栈

| 层 | 技术 |
|----|------|
| 框架 | Electron 33 + electron-vite |
| 前端 | React 18 + TypeScript + Tailwind CSS |
| 状态管理 | Zustand |
| 国际化 | i18next + react-i18next |
| 加密 | Node.js crypto (AES-128-ECB / RC4) |
| 标签写入 | 原生 ID3v2 实现 |
| 构建 | electron-builder (NSIS / DMG) |

## 许可证

[GPL-3.0-only](LICENSE)
