<script lang="ts" setup>
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
    <p class="subtitle">基于 Rust/WASM + Vue 3 的音乐可视化桌面应用</p>
  </div>
</template>

<style scoped>
.home-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
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
</style>
