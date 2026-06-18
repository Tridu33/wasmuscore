<script lang="ts" setup>
import { ref } from 'vue'

const showFullInfo = ref(false)
</script>

<template>
  <div class="home-page">
    <h1 class="title">
      <span class="letter letter-w">W</span>
      <span class="letter letter-a1">a</span>
      <span class="letter letter-s">s</span>
      <span class="letter letter-m">M</span>
      <span class="letter letter-u">u</span>
      <span class="letter letter-s2">S</span>
      <span class="letter letter-c">c</span>
      <span class="letter letter-o">o</span>
      <span class="letter letter-r">r</span>
      <span class="letter letter-e">e</span>
    </h1>
    <p class="subtitle">基于 Rust/WASM + Vue 3 的高性能音乐可视化桌面应用</p>

    <div class="features">
      <div class="feature-card" @click="showFullInfo = !showFullInfo">
        <h3>🎹 MIDI 播放器</h3>
        <p>多音轨播放、钢琴卷帘动画、WebGPU 加速渲染</p>
      </div>
      <div class="feature-card">
        <router-link to="/midi-piano" class="card-link">
          <h3>🎹 MIDI 瀑布流</h3>
          <p>Synthesia 风格下落动画, 支持 MIDI 键盘实时演奏</p>
        </router-link>
      </div>
      <div class="feature-card">
        <h3>🎼 MusicXML 解析</h3>
        <p>上传 MusicXML 文件，专业乐谱渲染展示</p>
      </div>
      <div class="feature-card">
        <h3>🎵 五线谱 / 简谱</h3>
        <p>自定义五线谱与简谱渲染引擎</p>
      </div>
      <div class="feature-card">
        <h3>🎙️ MIDI 录音</h3>
        <p>Web MIDI API 实时录音与 PianoRoll 可视化</p>
      </div>
      <div class="feature-card">
        <h3>🎸 吉他 TAB</h3>
        <p>吉他六线谱（Tablature）显示</p>
      </div>
      <div class="feature-card">
        <h3>⚙️ WASM 引擎</h3>
        <p>Rust 编译为 WASM，接近原生性能</p>
      </div>
    </div>

    <div v-if="showFullInfo" class="full-info">
      <h2>🏗️ 技术架构</h2>
      <div class="tech-grid">
        <div class="tech-item"><strong>前端框架</strong> Vue 3.5 + TypeScript + Vite 6</div>
        <div class="tech-item"><strong>UI 组件库</strong> Element Plus 2.9</div>
        <div class="tech-item"><strong>桌面环境</strong> Electron 35 + Electron Builder</div>
        <div class="tech-item"><strong>核心引擎</strong> Rust + wasm-bindgen + wasm-pack</div>
        <div class="tech-item"><strong>状态管理</strong> Pinia 3.0</div>
        <div class="tech-item"><strong>GPU 加速</strong> WebGPU 钢琴卷帘可视化渲染</div>
      </div>

      <h2>📦 快速开始</h2>
      <div class="code-block">
        <pre><code>pnpm install          # 安装依赖
bash ./wasm_rust/build.sh  # 构建 WASM 模块
pnpm run dev          # 启动开发模式</code></pre>
      </div>

      <h2>🔗 相关链接</h2>
      <div class="links">
        <a href="https://vuejs.org/" target="_blank">Vue 3 官方文档</a>
        <a href="https://element-plus.org/" target="_blank">Element Plus 官方文档</a>
        <a href="https://rustwasm.github.io/" target="_blank">Rust & WASM 官方指南</a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  padding: 0 24px;
}

.title {
  font-size: 64px;
  font-weight: 800;
  letter-spacing: 4px;
  margin: 0;
  line-height: 1.2;
  background: linear-gradient(135deg, #148eb4, #ff40dc, #42b883, #409eff);
  background-size: 300% 300%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: gradient-shift 6s ease infinite;
}

@keyframes gradient-shift {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

.subtitle {
  font-size: 18px;
  color: var(--ep-text-color-secondary);
  margin-top: 12px;
  font-weight: 400;
}

.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  margin-top: 36px;
  max-width: 900px;
  width: 100%;
}

.feature-card {
  background: var(--ep-fill-color-light);
  border: 1px solid var(--ep-border-color-light);
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.feature-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.feature-card h3 {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 6px;
  color: var(--ep-text-color-primary);
}

.feature-card p {
  font-size: 13px;
  color: var(--ep-text-color-secondary);
  margin: 0;
}

.feature-card .card-link {
  text-decoration: none;
  display: block;
}

.feature-card .card-link h3,
.feature-card .card-link p {
  color: inherit;
}

.full-info {
  max-width: 900px;
  width: 100%;
  margin-top: 48px;
  text-align: left;
}

.full-info h2 {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 16px;
  color: var(--ep-text-color-primary);
}

.tech-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 12px;
  margin-bottom: 36px;
}

.tech-item {
  padding: 10px 14px;
  background: var(--ep-fill-color-light);
  border-radius: 6px;
  font-size: 14px;
  color: var(--ep-text-color-regular);
}

.tech-item strong {
  color: var(--ep-text-color-primary);
}

.code-block {
  background: #1e1e2e;
  color: #cdd6f4;
  border-radius: 8px;
  padding: 16px 20px;
  margin-bottom: 36px;
  overflow-x: auto;
}

.code-block code {
  font-family: 'Fira Code', 'JetBrains Mono', monospace;
  font-size: 14px;
  line-height: 1.6;
}

.links {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.links a {
  color: var(--ep-color-primary);
  text-decoration: none;
  font-size: 14px;
}

.links a:hover {
  text-decoration: underline;
}
</style>
