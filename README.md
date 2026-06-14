# Wascore

> 基于 Rust/WASM + Vue 3 的高性能音乐可视化桌面应用

[![Vue](https://img.shields.io/badge/Vue-3.5-42b883)](https://vuejs.org/)
[![Element Plus](https://img.shields.io/badge/Element_Plus-2.9-409eff)](https://element-plus.org/)
[![Rust](https://img.shields.io/badge/Rust-WASM-dea584)](https://www.rust-lang.org/)
[![Electron](https://img.shields.io/badge/Electron-35-47848f)](https://www.electronjs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646cff)](https://vitejs.dev/)

## 🎯 项目概述

Wascore 是一个高性能的音乐可视化桌面应用程序，采用 **Rust 编译为 WebAssembly (WASM)** 作为核心音频引擎，结合 **Vue 3** 前端框架与 **Electron** 跨平台桌面环境，实现 MIDI 文件解析、播放、录音以及多种乐谱格式的渲染展示。

## 🏗️ 技术架构

| 层级 | 技术 |
|------|------|
| 前端框架 | Vue 3.5 + TypeScript + Vite 6 |
| UI 组件库 | Element Plus 2.9 |
| 桌面环境 | Electron 35 + Electron Builder |
| 核心引擎 | Rust + wasm-bindgen + wasm-pack |
| 状态管理 | Pinia 3.0 |
| 路由系统 | Vue Router 4 + unplugin-vue-router (文件系统路由) |
| 样式方案 | UnoCSS + Tailwind CSS + Sass |
| GPU 加速 | WebGPU 钢琴卷帘可视化渲染 |

## 🎵 核心功能

### 🎹 MIDI 播放器
- 加载并解析 MIDI 文件，支持多音轨显示
- 播放/暂停/停止/跳转控制
- SoundFont 2 音频引擎，高质量 MIDI 回放
- 钢琴卷帘动画，可视化展示当前播放音符
- WebGPU 加速渲染，流畅的图形性能

### 🎼 MusicXML 解析与乐谱显示
- 上传 MusicXML 文件并解析
- 使用 OpenSheetMusicDisplay 渲染专业乐谱
- 显示曲目信息：标题、作曲家、节拍等

### 🎵 五线谱 / 简谱展示
- 自定义五线谱（Staff Notation）渲染引擎
- 简谱（Numbered Notation）显示
- 支持多种音符类型、休止符、节拍标记

### 🎙️ MIDI 录音
- 基于 Web MIDI API 的 MIDI 设备接入
- MIDI 键盘实时录音与回放
- PianoRoll 可视化展示

### 🎸 吉他 TAB
- 吉他六线谱（Tablature）显示

### ⚙️ WASM 引擎
- Rust 编译为 WASM，接近原生性能
- MIDI 文件解析、音符提取、播放控制

## 📁 项目结构

```
wascore/
├── src/                    # Vue 3 前端源码
│   ├── components/         # 通用组件
│   ├── pages/              # 页面（文件系统路由）
│   ├── composables/        # 组合式函数
│   ├── stores/             # Pinia 状态管理
│   └── styles/             # 全局样式
├── wasm_rust/              # Rust WASM 核心引擎
├── wascore/                # 基础 WASM 示例模块
└── src/submodules/         # 子模块（Neothesia, composing-studio 等）
```

## 📦 构建与运行

### 环境要求
- Node.js >= 18
- pnpm >= 9
- Rust toolchain（用于 WASM 构建）

### 安装依赖
```bash
pnpm install
```

### 开发模式
```bash
bash ./wasm_rust/build.sh   # 构建 WASM 模块
pnpm run dev                # 启动开发服务器
```

### 打包 Electron
```bash
pnpm run build              # 构建 WASM + 打包 Electron
```

### Web 预览
```bash
pnpm run serve              # 启动 Vite 开发服务器（纯 Web 模式）
```

## 🔗 相关链接

- [Vue 3 官方文档](https://vuejs.org/)
- [Element Plus 官方文档](https://element-plus.org/)
- [Rust & WASM 官方指南](https://rustwasm.github.io/)
- [Vite 官方文档](https://vitejs.dev/)
