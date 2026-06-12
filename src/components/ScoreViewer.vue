<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { MusicXMLVisualizer } from '~/utils/musicxml/MusicXMLToMidi'

interface Props {
  file: File | null
}

const props = defineProps<Props>()

const containerRef = ref<HTMLDivElement | null>(null)
const visualizer = new MusicXMLVisualizer()
const isLoading = ref(false)
const error = ref<string | null>(null)

async function renderScore() {
  if (!props.file || !containerRef.value) {
    return
  }

  isLoading.value = true
  error.value = null

  try {
    await visualizer.render(containerRef.value, props.file)
  }
  catch (err: any) {
    error.value = `Failed to render score: ${err.message}`
  }
  finally {
    isLoading.value = false
  }
}

onMounted(() => {
  if (props.file) {
    renderScore()
  }
})

onUnmounted(() => {
  visualizer.dispose()
})
</script>

<template>
  <div class="score-viewer">
    <div v-if="isLoading" class="loading-overlay">
      <el-icon class="is-loading">
        <Loading />
      </el-icon>
      <p>渲染乐谱中...</p>
    </div>

    <el-alert
      v-if="error"
      :title="error"
      type="error"
      :closable="true"
      show-icon
    />

    <div ref="containerRef" class="score-container" />

    <div v-if="!file && !isLoading" class="empty-state">
      <p>🎼 上传 MusicXML 文件后显示乐谱</p>
    </div>
  </div>
</template>

<style scoped>
.score-viewer {
  position: relative;
  width: 100%;
  min-height: 400px;
  background: #ffffff;
  border-radius: 8px;
  overflow: auto;
  margin-bottom: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.9);
  z-index: 10;
  color: #666;
}

.loading-overlay p {
  margin-top: 10px;
  font-size: 16px;
}

.score-container {
  padding: 20px;
  min-height: 400px;
}

.empty-state {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: rgba(0, 0, 0, 0.3);
  font-size: 18px;
  text-align: center;
  pointer-events: none;
}
</style>
