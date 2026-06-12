<script setup lang="ts">
import type { ActiveNote, MidiNote } from '~/stores/midi'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { getWebGPURenderer, type NoteData } from '~/utils/render/WebGPURenderer'

interface Props {
  notes: MidiNote[]
  activeNotes: ActiveNote[]
  currentTime: number
  isPlaying: boolean
}

const props = defineProps<Props>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const renderer = getWebGPURenderer()
const isWebGPUSupported = ref(false)
const errorMessage = ref<string | null>(null)
const performanceStats = ref<any>(null)
let animationId: number | null = null

// 配置
const SCROLL_OFFSET = 2000 // 毫秒
const KEYBOARD_HEIGHT = 120

// 初始化 WebGPU
async function initWebGPU() {
  if (!canvasRef.value) {
    return
  }

  const success = await renderer.init(canvasRef.value)
  isWebGPUSupported.value = success

  if (!success) {
    errorMessage.value = renderer.errorMessage
    console.warn('WebGPU not available:', renderer.errorMessage)
  }
}

// 渲染循环
function render() {
  if (!canvasRef.value || !renderer.isSupported) {
    return
  }

  // 准备音符数据
  const noteData: NoteData[] = props.notes.map(note => ({
    note: note.note,
    startMs: note.start_ms,
    durationMs: note.duration_ms,
    velocity: note.velocity,
    trackColorId: note.track_color_id,
    isActive: props.activeNotes.some(n => n.note === note.note),
  }))

  // 渲染配置
  const config = {
    currentTime: props.currentTime,
    scrollOffset: SCROLL_OFFSET,
    canvasWidth: canvasRef.value.width,
    canvasHeight: canvasRef.value.height,
    keyboardHeight: KEYBOARD_HEIGHT,
  }

  // 执行渲染
  renderer.render(noteData, config)

  // 更新性能统计
  performanceStats.value = renderer.getStats()

  // 继续动画循环
  if (props.isPlaying) {
    animationId = requestAnimationFrame(render)
  }
}

// 初始化 Canvas 尺寸
function initCanvasSize() {
  if (!canvasRef.value) {
    return
  }

  const dpr = window.devicePixelRatio || 1
  const rect = canvasRef.value.getBoundingClientRect()

  canvasRef.value.width = rect.width * dpr
  canvasRef.value.height = rect.height * dpr

  // 调整 WebGPU 渲染器
  if (renderer.isSupported) {
    renderer.resize(canvasRef.value.width, canvasRef.value.height)
  }
}

// 监听窗口大小变化
function handleResize() {
  initCanvasSize()
  if (!props.isPlaying) {
    render()
  }
}

// 监听数据变化
watch(
  () => [props.notes, props.currentTime, props.activeNotes],
  () => {
    if (!props.isPlaying && renderer.isSupported) {
      render()
    }
  },
  { deep: true },
)

onMounted(async () => {
  initCanvasSize()
  await initWebGPU()

  if (renderer.isSupported) {
    render()
  }

  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
  window.removeEventListener('resize', handleResize)
  renderer.dispose()
})
</script>

<template>
  <div class="piano-roll-webgpu">
    <canvas ref="canvasRef" class="webgpu-canvas" />

    <!-- 不支持 WebGPU 的提示 -->
    <div v-if="!isWebGPUSupported" class="fallback-message">
      <el-alert
        :title="errorMessage || 'WebGPU 不可用'"
        type="warning"
        :closable="false"
        show-icon
      />
      <p class="hint">
        请使用 Chrome 113+ 或 Edge 113+ 以获得最佳性能
      </p>
    </div>

    <!-- 性能统计 -->
    <div v-if="performanceStats && isWebGPUSupported" class="performance-stats">
      <el-tag size="small" type="success">
        WebGPU ✓
      </el-tag>
      <el-tag size="small">
        音符: {{ performanceStats.currentNotes }}
      </el-tag>
      <el-tag size="small">
        最大: {{ performanceStats.maxNotes }}
      </el-tag>
    </div>

    <!-- 空状态 -->
    <div v-if="notes.length === 0 && isWebGPUSupported" class="empty-state">
      <p>🎹 上传 MIDI 文件后显示钢琴卷帘 (WebGPU 加速)</p>
    </div>
  </div>
</template>

<style scoped>
.piano-roll-webgpu {
  position: relative;
  width: 100%;
  height: 500px;
  background: #1a1a2e;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 20px;
}

.webgpu-canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.fallback-message {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 80%;
  text-align: center;
}

.hint {
  margin-top: 10px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
}

.performance-stats {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  gap: 8px;
  z-index: 10;
}

.empty-state {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: rgba(255, 255, 255, 0.5);
  font-size: 18px;
  text-align: center;
  pointer-events: none;
}
</style>
