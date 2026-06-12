<script lang="ts" setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const loading = ref(true)
const iframeRef = ref<HTMLIFrameElement | null>(null)

onMounted(() => {
  // noteDigger scripts load inside the iframe; hide loading once ready
  if (iframeRef.value) {
    iframeRef.value.onload = () => {
      loading.value = false
    }
  }
})
</script>

<template>
  <div class="note-digger-page">
    <div v-if="loading" class="loading-overlay">
      <div class="loading-content">
        <div class="spinner" />
        <p>正在加载 noteDigger...</p>
      </div>
    </div>
    <iframe
      ref="iframeRef"
      src="/noteDigger/index.html"
      class="note-digger-iframe"
      frameborder="0"
    />
  </div>
</template>

<style scoped>
.note-digger-page {
  width: 100%;
  height: calc(100vh - 60px);
  position: relative;
  overflow: hidden;
}

.note-digger-iframe {
  width: 100%;
  height: 100%;
  border: none;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ep-bg-container, #1a1a2e);
  z-index: 10;
  transition: opacity 0.3s ease;
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #409eff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-content p {
  color: var(--ep-text-color-regular, #fff);
  font-size: 14px;
}
</style>
