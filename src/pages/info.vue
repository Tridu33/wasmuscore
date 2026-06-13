<template>
  <div class="info-page">
    <div class="info-header">
      <h1>Wascore</h1>
      <p class="subtitle">基于 Rust/WASM + Vue 3 的音乐可视化桌面应用</p>
    </div>

    <el-divider />

    <div class="info-content">
      <section class="section">
        <h2>🎯 项目概述</h2>
        <p>
          Wascore 是一个高性能的音乐可视化桌面应用程序，采用 Rust 编译为 WebAssembly (WASM) 作为核心引擎，
          结合 Vue 3 前端框架，实现 MIDI 文件解析、播放、录音以及多种乐谱格式的渲染展示。
        </p>
      </section>

      <section class="section">
        <h2>🏗️ 技术架构</h2>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="前端框架">Vue 3.5 + TypeScript + Vite 6</el-descriptions-item>
          <el-descriptions-item label="UI 组件库">Element Plus 2.9</el-descriptions-item>
          <el-descriptions-item label="桌面环境">Electron 35 + Electron Builder</el-descriptions-item>
          <el-descriptions-item label="WASM 引擎">Rust + wasm-bindgen + wasm-pack</el-descriptions-item>
          <el-descriptions-item label="状态管理">Pinia 3.0</el-descriptions-item>
          <el-descriptions-item label="路由系统">Vue Router 4 + unplugin-vue-router (文件系统路由)</el-descriptions-item>
          <el-descriptions-item label="样式方案">UnoCSS + Tailwind CSS + Sass</el-descriptions-item>
          <el-descriptions-item label="GPU 加速">WebGPU 钢琴卷帘可视化渲染</el-descriptions-item>
        </el-descriptions>
      </section>

      <section class="section">
        <h2>🎵 核心功能</h2>

        <h3>🎹 MIDI 播放器</h3>
        <ul>
          <li>加载并解析 MIDI 文件，支持多音轨显示</li>
          <li>播放/暂停/停止/跳转控制</li>
          <li>SoundFont 2 音频引擎，高质量 MIDI 回放</li>
          <li>钢琴卷帘动画，可视化展示当前播放音符</li>
          <li>WebGPU 加速渲染，流畅的图形性能</li>
          <li>音量调节与音轨颜色自定义</li>
        </ul>

        <h3>🎼 MusicXML 解析与乐谱显示</h3>
        <ul>
          <li>上传 MusicXML 文件并解析</li>
          <li>使用 OpenSheetMusicDisplay 渲染专业乐谱</li>
          <li>显示曲目信息：标题、作曲家、节拍等</li>
          <li>多音轨列表展示</li>
          <li>乐谱缩放与导航</li>
        </ul>

        <h3>🎵 五线谱 / 简谱展示</h3>
        <ul>
          <li>自定义五线谱（Staff Notation）渲染引擎</li>
          <li>简谱（Numbered Notation / 简谱）显示</li>
          <li>支持多种音符类型、休止符、节拍标记</li>
        </ul>

        <h3>🎙️ MIDI 录音</h3>
        <ul>
          <li>基于 Web MIDI API 的 MIDI 设备接入</li>
          <li>MIDI 键盘实时录音</li>
          <li>设备选择与状态监控</li>
          <li>录音回放与 PianoRoll 可视化</li>
        </ul>

        <h3>🎸 吉他 TAB</h3>
        <ul>
          <li>吉他六线谱（Tablature）显示</li>
          <li>品丝标记与弦线对应</li>
        </ul>

        <h3>⚙️ WASM 引擎</h3>
        <ul>
          <li>Rust 编译为 WASM，接近原生性能</li>
          <li>MIDI 文件解析、音符提取、播放控制</li>
          <li>serde-wasm-bindgen 数据序列化</li>
        </ul>

        <h3>🖥️ WebGPU 可视化</h3>
        <ul>
          <li>GPU 加速的钢琴卷帘渲染</li>
          <li>大量音符场景下保持流畅帧率</li>
        </ul>
      </section>

      <section class="section">
        <h2>📁 项目结构</h2>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="src/">Vue 3 前端源码（组件、页面、Store、路由）</el-descriptions-item>
          <el-descriptions-item label="wasm_rust/">Rust WASM 核心引擎（forked from neothesia）</el-descriptions-item>
          <el-descriptions-item label="wascore/">基础 WASM 示例模块</el-descriptions-item>
          <el-descriptions-item label="asset/">静态资源（图片、字体等）</el-descriptions-item>
          <el-descriptions-item label="public/">公共静态文件</el-descriptions-item>
          <el-descriptions-item label="dist-electron/">Electron 构建产物</el-descriptions-item>
        </el-descriptions>
      </section>

      <section class="section">
        <h2>📦 构建与运行</h2>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="开发模式"><code>pnpm dev</code></el-descriptions-item>
          <el-descriptions-item label="WASM 构建"><code>bash build.sh</code></el-descriptions-item>
          <el-descriptions-item label="Electron 构建"><code>pnpm build</code></el-descriptions-item>
        </el-descriptions>
      </section>

      <section class="section">
        <h2>🔗 相关链接</h2>
        <ul>
          <li><a href="https://gitee.com/slamkuntech/wascore" target="_blank">Gitee 仓库</a></li>
          <li><a href="https://vuejs.org/" target="_blank">Vue 3 官方文档</a></li>
          <li><a href="https://element-plus.org/" target="_blank">Element Plus 官方文档</a></li>
          <li><a href="https://rustwasm.github.io/" target="_blank">Rust & WASM 官方指南</a></li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.info-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 32px 24px 60px;
}

.info-header {
  text-align: center;
}

.info-header h1 {
  font-size: 42px;
  font-weight: 800;
  margin: 0;
  background: linear-gradient(135deg, #148eb4, #ff40dc, #42b883, #409eff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.subtitle {
  font-size: 16px;
  color: var(--ep-text-color-secondary);
  margin-top: 8px;
}

.section {
  margin-bottom: 36px;
}

.section h2 {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 16px;
  color: var(--ep-text-color-primary);
}

.section h3 {
  font-size: 17px;
  font-weight: 600;
  margin-top: 20px;
  margin-bottom: 10px;
  color: var(--ep-text-color-primary);
}

.section ul {
  padding-left: 20px;
  margin: 8px 0;
}

.section ul li {
  line-height: 1.8;
  color: var(--ep-text-color-regular);
}

.section a {
  color: var(--ep-color-primary);
  text-decoration: none;
}

.section a:hover {
  text-decoration: underline;
}
</style>
