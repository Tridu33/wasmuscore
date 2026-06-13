<script setup lang="ts">
import type { ActiveNote, MidiNote } from '~/stores/midi'
import { onMounted, onUnmounted, ref, watch } from 'vue'

interface Props {
  notes: MidiNote[]
  activeNotes: ActiveNote[]
  currentTime: number
  isPlaying: boolean
}

const props = defineProps<Props>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
let animationId: number | null = null
let canvasWidth = 0
let canvasHeight = 0

// 钢琴键配置
const KEYBOARD_HEIGHT = 120
const FIRST_NOTE = 21 // A0
const LAST_NOTE = 108 // C8

// 音符显示配置
const NOTE_SCROLL_OFFSET = 2000 // 毫秒,显示当前时间前后范围
const NOTE_HEIGHT_MIN = 3 // 最小音符高度

// 颜色调色板
const TRACK_COLORS = [
  '#4285f4', // 蓝色
  '#34a853', // 绿色
  '#ea4335', // 红色
  '#fbbc05', // 黄色
  '#8e44ad', // 紫色
  '#16a085', // 青色
  '#e67e22', // 橙色
  '#e84393', // 粉色
]

// 判断是否为黑键
function isBlackKey(note: number): boolean {
  const noteInOctave = note % 12
  return [1, 3, 6, 8, 10].includes(noteInOctave)
}

// 获取音符颜色
function getTrackColor(trackColorId: number): string {
  return TRACK_COLORS[trackColorId % TRACK_COLORS.length]
}

// 计算钢琴键位置
function getKeyPosition(note: number): { x: number, width: number, isBlack: boolean } {
  const whiteKeyWidth = (canvasWidth - 100) / 52 // 52个白键
  const blackKeyWidth = whiteKeyWidth * 0.65

  // 计算白键索引
  let whiteKeyIndex = 0
  for (let n = FIRST_NOTE; n < note; n++) {
    if (!isBlackKey(n)) {
      whiteKeyIndex++
    }
  }

  const isBlack = isBlackKey(note)
  const x = isBlack
    ? 80 + (whiteKeyIndex - 1) * whiteKeyWidth + whiteKeyWidth * 0.6
    : 80 + whiteKeyIndex * whiteKeyWidth
  const width = isBlack ? blackKeyWidth : whiteKeyWidth

  return { x, width, isBlack }
}

// 绘制钢琴键盘
function drawKeyboard(ctx: CanvasRenderingContext2D) {
  const y = canvasHeight - KEYBOARD_HEIGHT

  // 绘制白键
  for (let note = FIRST_NOTE; note <= LAST_NOTE; note++) {
    if (isBlackKey(note))
      continue

    const { x, width } = getKeyPosition(note)
    const isActive = props.activeNotes.some(n => n.note === note)

    // 按键背景
    ctx.fillStyle = isActive ? '#4285f4' : '#ffffff'
    ctx.fillRect(x, y, width - 1, KEYBOARD_HEIGHT)

    // 边框
    ctx.strokeStyle = '#ddd'
    ctx.lineWidth = 1
    ctx.strokeRect(x, y, width - 1, KEYBOARD_HEIGHT)
  }

  // 绘制黑键
  for (let note = FIRST_NOTE; note <= LAST_NOTE; note++) {
    if (!isBlackKey(note))
      continue

    const { x, width } = getKeyPosition(note)
    const isActive = props.activeNotes.some(n => n.note === note)

    ctx.fillStyle = isActive ? '#4285f4' : '#333333'
    ctx.fillRect(x, y, width, KEYBOARD_HEIGHT * 0.6)

    // 黑键阴影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'
    ctx.fillRect(x, y + KEYBOARD_HEIGHT * 0.6, width, KEYBOARD_HEIGHT * 0.4)
  }
}

// 绘制音符条
function drawNotes(ctx: CanvasRenderingContext2D) {
  const keyboardY = canvasHeight - KEYBOARD_HEIGHT
  const timeWindow = NOTE_SCROLL_OFFSET
  const visibleStart = props.currentTime - 500
  const visibleEnd = props.currentTime + timeWindow

  for (const note of props.notes) {
    // 只绘制可见范围内的音符
    if (note.end_ms < visibleStart || note.start_ms > visibleEnd)
      continue

    const { x, width } = getKeyPosition(note.note)

    // 计算音符位置 (下落动画)
    const timeDiff = note.start_ms - props.currentTime
    const y = keyboardY - (timeDiff / timeWindow) * (keyboardY - 50)

    // 音符高度基于持续时间
    const duration = note.duration_ms
    const height = Math.max(NOTE_HEIGHT_MIN, (duration / timeWindow) * (keyboardY - 50))

    const isActive = props.activeNotes.some(n => n.note === note.note)
    const color = getTrackColor(note.track_color_id)

    // 绘制音符条
    ctx.fillStyle = isActive ? '#ffeb3b' : color
    ctx.globalAlpha = isActive ? 1.0 : 0.8
    ctx.fillRect(x + 1, y - height, width - 2, height)

    // 音符高光
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
    ctx.fillRect(x + 1, y - height, width - 2, 2)

    ctx.globalAlpha = 1.0
  }
}

// 绘制当前时间线
function drawTimeline(ctx: CanvasRenderingContext2D) {
  const keyboardY = canvasHeight - KEYBOARD_HEIGHT

  ctx.strokeStyle = '#ff0000'
  ctx.lineWidth = 2
  ctx.setLineDash([5, 5])
  ctx.beginPath()
  ctx.moveTo(0, keyboardY)
  ctx.lineTo(canvasWidth, keyboardY)
  ctx.stroke()
  ctx.setLineDash([])
}

// 渲染循环
function render() {
  if (!canvasRef.value)
    return

  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')
  if (!ctx)
    return

  // 清空画布
  ctx.clearRect(0, 0, canvasWidth, canvasHeight)

  // 背景渐变
  const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight)
  gradient.addColorStop(0, '#1a1a2e')
  gradient.addColorStop(1, '#16213e')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)

  // 绘制元素
  drawNotes(ctx)
  drawTimeline(ctx)
  drawKeyboard(ctx)

  // 继续动画循环
  if (props.isPlaying) {
    animationId = requestAnimationFrame(render)
  }
}

// 初始化 Canvas
function initCanvas() {
  if (!canvasRef.value)
    return

  const canvas = canvasRef.value
  const rect = canvas.getBoundingClientRect()
  if (!rect || rect.width === 0 || rect.height === 0)
    return

  const dpr = window.devicePixelRatio || 1

  // 设置 Canvas 尺寸
  canvasWidth = rect.width
  canvasHeight = rect.height

  canvas.width = canvasWidth * dpr
  canvas.height = canvasHeight * dpr

  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.scale(dpr, dpr)
  }

  // 开始渲染
  render()
}

// 监听窗口大小变化
function handleResize() {
  initCanvas()
}

// 监听数据变化
watch(
  () => [props.notes, props.currentTime, props.activeNotes],
  () => {
    if (!props.isPlaying) {
      render()
    }
  },
  { deep: true },
)

onMounted(() => {
  initCanvas()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
  window.removeEventListener('resize', handleResize)
})
</script>

<template>
  <div class="piano-roll-container">
    <canvas ref="canvasRef" class="piano-roll-canvas" />
    <div v-if="notes.length === 0" class="empty-state">
      <p>🎹 上传 MIDI 文件后显示钢琴卷帘</p>
    </div>
  </div>
</template>

<style scoped>
.piano-roll-container {
  position: relative;
  width: 100%;
  height: 500px;
  background: #1a1a2e;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 20px;
}

.piano-roll-canvas {
  width: 100%;
  height: 100%;
  display: block;
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
