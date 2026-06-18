<script setup lang="ts">
import { UploadFilled, VideoPlay, VideoPause, CircleClose, Plus, Minus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Midi } from '@tonejs/midi'
import * as Tone from 'tone'

// ===================== 常量 =====================
const FIRST_NOTE = 21     // A0
const LAST_NOTE = 108     // C8
const KEYBOARD_HEIGHT = 90
const FALL_ZONE_HEIGHT = 400
const CANVAS_MIN_WIDTH = 800
const NOTE_HEIGHT_MIN = 2
const VISIBLE_WINDOW_MS = 4000

const TRACK_COLORS = [
  '#4285f4', '#34a853', '#ea4335', '#fbbc05',
  '#8e44ad', '#16a085', '#e67e22', '#e84393',
  '#00bcd4', '#ff5722', '#607d8b', '#795548',
]

// ===================== 类型 =====================
interface PianoNote {
  noteNumber: number
  startMs: number
  endMs: number
  durationMs: number
  velocity: number
  trackId: number
  r: number; g: number; b: number
}

// ===================== 状态 =====================
const canvasRef = ref<HTMLCanvasElement | null>(null)
const canvasWidth = ref(CANVAS_MIN_WIDTH)
const canvasHeight = ref(FALL_ZONE_HEIGHT + KEYBOARD_HEIGHT)

const midiData = ref<Midi | null>(null)
const notes = ref<PianoNote[]>([])
const isPlaying = ref(false)
const isPaused = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const speed = ref(1.0)
const activeKeys = ref<Set<number>>(new Set())
const fileName = ref('')
const loading = ref(false)

let animationId: number | null = null
let startTime = 0
let pauseOffset = 0
let synth: Tone.PolySynth | null = null

// WebGL
let gl: WebGLRenderingContext | null = null
let program: WebGLProgram | null = null
let positionBuffer: WebGLBuffer | null = null
let colorBuffer: WebGLBuffer | null = null
let positionLoc = 0
let colorLoc = 1

// ===================== Computed =====================
const progressPercent = computed(() => {
  if (!duration.value) return 0
  return Math.min(100, (currentTime.value / duration.value) * 100)
})

// ===================== 工具函数 =====================
function isBlackKey(note: number): boolean {
  return [1, 3, 6, 8, 10].includes(note % 12)
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return `${m}:${(s % 60).toString().padStart(2, '0')}`
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return [r, g, b]
}

function getTrackColor(trackId: number): [number, number, number] {
  return hexToRgb(TRACK_COLORS[trackId % TRACK_COLORS.length])
}

// ===================== WebGL 初始化 =====================
const VERT_SRC = `
  attribute vec2 a_position;
  attribute vec3 a_color;
  varying vec3 v_color;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_color = a_color;
  }
`

const FRAG_SRC = `
  precision mediump float;
  varying vec3 v_color;
  void main() {
    gl_FragColor = vec4(v_color, 1.0);
  }
`

function initWebGL(): boolean {
  const canvas = canvasRef.value
  if (!canvas) return false

  gl = canvas.getContext('webgl', { antialias: true, alpha: false })
  if (!gl) {
    console.warn('WebGL not available, falling back to 2d')
    return false
  }

  const vs = gl.createShader(gl.VERTEX_SHADER)!
  gl.shaderSource(vs, VERT_SRC)
  gl.compileShader(vs)
  if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
    console.error('VS compile:', gl.getShaderInfoLog(vs))
    return false
  }

  const fs = gl.createShader(gl.FRAGMENT_SHADER)!
  gl.shaderSource(fs, FRAG_SRC)
  gl.compileShader(fs)
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
    console.error('FS compile:', gl.getShaderInfoLog(fs))
    return false
  }

  program = gl.createProgram()!
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link:', gl.getProgramInfoLog(program))
    return false
  }

  positionLoc = gl.getAttribLocation(program, 'a_position')
  colorLoc = gl.getAttribLocation(program, 'a_color')

  positionBuffer = gl.createBuffer()
  colorBuffer = gl.createBuffer()

  gl.enable(gl.BLEND)
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
  gl.enable(gl.SCISSOR_TEST)

  return true
}

// ===================== 绘制函数 =====================
function resizeCanvas() {
  if (!canvasRef.value) return
  const container = canvasRef.value.parentElement
  if (!container) return
  const dpr = window.devicePixelRatio || 1
  const rect = container.getBoundingClientRect()
  const w = Math.max(rect.width, CANVAS_MIN_WIDTH)
  const h = FALL_ZONE_HEIGHT + KEYBOARD_HEIGHT
  canvasWidth.value = w
  canvasHeight.value = h
  canvasRef.value.width = w * dpr
  canvasRef.value.height = h * dpr
  canvasRef.value.style.width = `${w}px`
  canvasRef.value.style.height = `${h}px`
  if (gl) gl.viewport(0, 0, canvasRef.value.width, canvasRef.value.height)
}

function pushQuad(positions: number[], colors: number[], x: number, y: number, w: number, h: number, r: number, g: number, b: number) {
  const x1 = x, x2 = x + w, y1 = y, y2 = y + h
  // 2 triangles, 6 vertices
  positions.push(x1, y1, x2, y1, x1, y2, x1, y2, x2, y1, x2, y2)
  for (let i = 0; i < 6; i++) colors.push(r, g, b)
}

function draw() {
  if (!gl || !canvasRef.value) return

  const w = canvasWidth.value
  const h = canvasHeight.value
  const kbY = h - KEYBOARD_HEIGHT

  // 背景
  gl.scissor(0, 0, canvasRef.value.width, canvasRef.value.height)
  gl.clearColor(0.051, 0.067, 0.106, 1.0)
  gl.clear(gl.COLOR_BUFFER_BIT)

  // 白键数量
  let whiteCount = 0
  for (let n = FIRST_NOTE; n <= LAST_NOTE; n++) {
    if (!isBlackKey(n)) whiteCount++
  }
  const whiteKeyWidth = w / whiteCount
  const blackKeyWidth = whiteKeyWidth * 0.65

  // 计算白键索引
  function getWhiteIndex(note: number): number {
    let idx = 0
    for (let n = FIRST_NOTE; n < note; n++) {
      if (!isBlackKey(n)) idx++
    }
    return idx
  }

  function getKeyX(note: number): number {
    const idx = getWhiteIndex(note)
    if (!isBlackKey(note)) return idx * whiteKeyWidth
    return idx * whiteKeyWidth - whiteKeyWidth * 0.15
  }

  function toClip(px: number, py: number): [number, number] {
    return [(px / w) * 2 - 1, 1 - (py / h) * 2]
  }

  const positions: number[] = []
  const colors: number[] = []
  const timeWindow = VISIBLE_WINDOW_MS / speed.value

  // -- 网格线 (微弱竖线) --
  for (let n = FIRST_NOTE; n <= LAST_NOTE; n++) {
    const x = getKeyX(n)
    const [cx] = toClip(x, 0)
    // thin vertical lines
    const lw = 0.5
    const [cx1] = toClip(x - lw / 2, 0)
    const [cx2] = toClip(x + lw / 2, 0)
    const [, cyTop] = toClip(0, 0)
    const [, cyBot] = toClip(kbY, 0)
    pushQuad(positions, colors, cx1, cyBot, cx2 - cx1, cyTop - cyBot, 0.1, 0.1, 0.12)
  }

  // -- 时间线 (红色横线) --
  const [tX1, tY1] = toClip(0, kbY)
  const [tX2, tY2] = toClip(w, kbY + 2)
  pushQuad(positions, colors, tX1, tY1, tX2 - tX1, tY2 - tY1, 1.0, 0.2, 0.2)

  // -- 音符 --
  for (const note of notes.value) {
    if (note.endMs < currentTime.value - 100 || note.startMs > currentTime.value + timeWindow) continue

    const x = getKeyX(note.noteNumber)
    const kw = isBlackKey(note.noteNumber) ? blackKeyWidth : whiteKeyWidth

    const timeToHit = note.startMs - currentTime.value
    const yBottom = kbY - (timeToHit / timeWindow) * kbY
    const noteH = Math.max(NOTE_HEIGHT_MIN, (note.durationMs / timeWindow) * kbY)
    const yTop = yBottom - noteH

    if (yTop > kbY || yBottom < 0) continue

    const [cx, cyTop] = toClip(x + 1, Math.max(0, yTop))
    const [cw, ch] = toClip(kw - 2, Math.min(yBottom, kbY) - Math.max(0, yTop))

    const isActive = activeKeys.value.has(note.noteNumber)
    const [r, g, b] = isActive ? [1.0, 0.92, 0.23] : [note.r, note.g, note.b]

    pushQuad(positions, colors, cx, cyTop, cw, ch, r, g, b)

    // 高光条
    if (Math.abs(ch) > 0.01) {
      const highlightH = (2 / h) * 2  // 2px in clip space
      pushQuad(positions, colors, cx, cyTop, cw, highlightH, 1.0, 1.0, 1.0)
    }
  }

  // -- 钢琴键盘 --
  // 白键
  for (let n = FIRST_NOTE; n <= LAST_NOTE; n++) {
    if (isBlackKey(n)) continue
    const x = getKeyX(n)
    const isActive = activeKeys.value.has(n)
    const [r, g, b] = isActive ? [0.26, 0.52, 0.96] : [0.94, 0.94, 0.94]
    const [cx, cy] = toClip(x + 0.5, kbY)
    const [cw, ch] = toClip(whiteKeyWidth - 1, KEYBOARD_HEIGHT)
    pushQuad(positions, colors, cx, cy, cw, ch, r, g, b)
  }
  // 黑键
  for (let n = FIRST_NOTE; n <= LAST_NOTE; n++) {
    if (!isBlackKey(n)) continue
    const x = getKeyX(n)
    const isActive = activeKeys.value.has(n)
    const [r, g, b] = isActive ? [0.26, 0.52, 0.96] : [0.13, 0.13, 0.13]
    const [cx, cy] = toClip(x, kbY)
    const [cw, ch] = toClip(blackKeyWidth, KEYBOARD_HEIGHT * 0.6)
    pushQuad(positions, colors, cx, cy, cw, ch, r, g, b)
    // 阴影
    const [sx, sy] = toClip(x, kbY + KEYBOARD_HEIGHT * 0.6)
    const [sw, sh] = toClip(blackKeyWidth, KEYBOARD_HEIGHT * 0.4)
    pushQuad(positions, colors, sx, sy, sw, sh, 0.08, 0.08, 0.08)
  }

  // 绘制
  gl.useProgram(program!)
  gl.enableVertexAttribArray(positionLoc)
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW)
  gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0)

  gl.enableVertexAttribArray(colorLoc)
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.DYNAMIC_DRAW)
  gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, 0, 0)

  gl.drawArrays(gl.TRIANGLES, 0, positions.length / 2)
}

// ===================== 动画循环 =====================
function tick() {
  if (!isPlaying.value) return

  const now = Tone.now() * 1000
  const elapsed = (now - startTime) * speed.value
  currentTime.value = pauseOffset + elapsed

  if (currentTime.value >= duration.value) {
    stop()
    return
  }

  updateActiveKeys()
  draw()
  animationId = requestAnimationFrame(tick)
}

function updateActiveKeys() {
  const current = currentTime.value
  const active = new Set<number>()
  for (const note of notes.value) {
    if (current >= note.startMs && current <= note.endMs) {
      active.add(note.noteNumber)
    }
  }
  activeKeys.value = active
}

// ===================== 播放控制 =====================
async function play() {
  if (!midiData.value || notes.value.length === 0) {
    ElMessage.warning('请先上传 MIDI 文件')
    return
  }

  await Tone.start()

  if (!synth) {
    synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.5 },
    })
    synth.maxPolyphony = 1024
    synth.toDestination()
  }

  const bpm = midiData.value.header.tempos[0]?.bpm || 120
  Tone.Transport.bpm.value = bpm * speed.value

  scheduleNotes()

  Tone.Transport.start()
  startTime = Tone.now()
  isPlaying.value = true
  isPaused.value = false
}

function scheduleNotes() {
  if (!synth) return
  Tone.Transport.cancel()

  for (const note of notes.value) {
    const startTimeSec = note.startMs / 1000 / speed.value
    const durationSec = note.durationMs / 1000 / speed.value
    const freq = Tone.Frequency(note.noteNumber, 'midi').toFrequency()

    Tone.Transport.schedule((time) => {
      synth!.triggerAttack(freq, time, durationSec)
    }, startTimeSec)
  }
}

function pause() {
  if (!isPlaying.value) return
  Tone.Transport.pause()
  pauseOffset = currentTime.value
  isPlaying.value = false
  isPaused.value = true
  if (animationId) cancelAnimationFrame(animationId)
}

function resume() {
  if (!isPaused.value) return
  Tone.Transport.start()
  startTime = Tone.now()
  pauseOffset = currentTime.value
  isPlaying.value = true
  isPaused.value = false
  animationId = requestAnimationFrame(tick)
}

function stop() {
  Tone.Transport.stop()
  Tone.Transport.cancel()
  if (animationId) cancelAnimationFrame(animationId)
  isPlaying.value = false
  isPaused.value = false
  currentTime.value = 0
  pauseOffset = 0
  activeKeys.value = new Set()
  draw()
}

function changeSpeed(delta: number) {
  speed.value = Math.max(0.25, Math.min(4.0, speed.value + delta))
  ElMessage.success(`速度: ${speed.value.toFixed(2)}x`)

  if (isPlaying.value) {
    const current = currentTime.value
    stop()
    currentTime.value = current
    pauseOffset = current
    const bpm = (midiData.value?.header.tempos[0]?.bpm) || 120
    Tone.Transport.bpm.value = bpm * speed.value
    scheduleNotes()
    Tone.Transport.start()
    startTime = Tone.now() - current / speed.value / 1000
    isPlaying.value = true
    isPaused.value = false
    animationId = requestAnimationFrame(tick)
  }
}

// ===================== MIDI 文件加载 =====================
async function handleFileUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  if (!file.name.toLowerCase().endsWith('.mid') && !file.name.toLowerCase().endsWith('.midi')) {
    ElMessage.error('请上传 .mid 或 .midi 文件')
    return
  }

  loading.value = true
  fileName.value = file.name

  try {
    const arrayBuffer = await file.arrayBuffer()
    const parsed = new Midi(arrayBuffer)
    midiData.value = parsed

    const pianoNotes: PianoNote[] = []
    let trackIdx = 0
    for (const track of parsed.tracks) {
      const [tr, tg, tb] = getTrackColor(trackIdx)
      for (const note of track.notes) {
        if (note.midi < FIRST_NOTE || note.midi > LAST_NOTE) continue
        pianoNotes.push({
          noteNumber: note.midi,
          startMs: note.time * 1000,
          endMs: (note.time + note.duration) * 1000,
          durationMs: note.duration * 1000,
          velocity: note.velocity,
          trackId: trackIdx,
          r: tr, g: tg, b: tb,
        })
      }
      trackIdx++
    }

    pianoNotes.sort((a, b) => a.startMs - b.startMs)
    notes.value = pianoNotes

    duration.value = parsed.duration * 1000
    currentTime.value = 0
    activeKeys.value = new Set()

    ElMessage.success(`已加载: ${file.name} (${parsed.tracks.length} 轨, ${pianoNotes.length} 音符)`)

    await new Promise(r => setTimeout(r, 100))
    draw()
  }
  catch (e: any) {
    ElMessage.error(`解析 MIDI 失败: ${e.message}`)
    console.error(e)
  }
  finally {
    loading.value = false
  }
}

// ===================== 进度条拖动 =====================
function handleSeek(value: number) {
  if (!midiData.value) return
  const targetMs = (value / 100) * duration.value
  currentTime.value = targetMs
  pauseOffset = targetMs

  if (isPlaying.value) {
    Tone.Transport.stop()
    Tone.Transport.cancel()
    scheduleNotes()
    Tone.Transport.start()
    startTime = Tone.now() - targetMs / speed.value / 1000
  }

  draw()
}

// ===================== 生命周期 =====================
onMounted(() => {
  resizeCanvas()
  window.addEventListener('resize', resizeCanvas)
  const hasWebGL = initWebGL()
  if (!hasWebGL) {
    // Fallback: draw will be a no-op for WebGL, but that's ok
    console.warn('WebGL not available')
  }
  setTimeout(draw, 100)
})

onUnmounted(() => {
  if (animationId) cancelAnimationFrame(animationId)
  window.removeEventListener('resize', resizeCanvas)
  Tone.Transport.stop()
  Tone.Transport.dispose()
})
</script>

<template>
  <div class="midi-player-page">
    <!-- 顶部控制栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <label class="upload-btn" :class="{ disabled: loading }">
          <el-icon><UploadFilled /></el-icon>
          打开 MIDI 文件
          <input
            type="file"
            accept=".mid,.midi"
            @change="handleFileUpload"
            :disabled="loading"
          >
        </label>
        <span v-if="fileName" class="file-name">{{ fileName }}</span>
      </div>

      <div class="toolbar-center" v-if="midiData">
        <el-button
          :type="isPlaying ? 'warning' : 'primary'"
          :icon="isPlaying ? VideoPause : VideoPlay"
          @click="isPlaying ? pause() : (isPaused ? resume() : play())"
        >
          {{ isPlaying ? '暂停' : (isPaused ? '继续' : '播放') }}
        </el-button>
        <el-button type="danger" :icon="CircleClose" @click="stop">
          停止
        </el-button>

        <!-- 速度控制 -->
        <div class="speed-control">
          <span class="speed-label">速度</span>
          <el-button size="small" :icon="Minus" @click="changeSpeed(-0.1)" />
          <span class="speed-value">{{ speed.toFixed(1) }}x</span>
          <el-button size="small" :icon="Plus" @click="changeSpeed(0.1)" />
        </div>
      </div>

      <div class="toolbar-right" />
    </div>

    <!-- 进度条 -->
    <div v-if="midiData" class="progress-bar">
      <span class="time">{{ formatTime(currentTime) }}</span>
      <el-slider
        :model-value="progressPercent"
        :min="0"
        :max="100"
        :show-tooltip="false"
        @change="handleSeek"
        class="progress-slider"
      />
      <span class="time">{{ formatTime(duration) }}</span>
    </div>

    <!-- 可视化 Canvas -->
    <div class="canvas-wrapper">
      <canvas ref="canvasRef" />
      <div v-if="!midiData && !loading" class="empty-hint">
        <p>🎹 上传 MIDI 文件播放音乐</p>
        <p class="sub">支持 .mid / .midi 文件 · WebGL 加速渲染</p>
      </div>
      <div v-if="loading" class="loading-hint">
        <p>⏳ 正在解析 MIDI...</p>
      </div>
    </div>

    <!-- 文件信息 -->
    <div v-if="midiData" class="info-bar">
      <span>{{ midiData.tracks.length }} 个音轨</span>
      <span>·</span>
      <span>{{ notes.length }} 个音符</span>
      <span>·</span>
      <span>BPM: {{ Math.round(midiData.header.tempos[0]?.bpm || 120) }}</span>
      <span>·</span>
      <span>时长: {{ formatTime(duration) }}</span>
    </div>
  </div>
</template>

<style scoped>
.midi-player-page {
  width: 100%;
  height: calc(100vh - var(--ep-menu-item-height) - 8px);
  display: flex;
  flex-direction: column;
  background: #0d1117;
  overflow: hidden;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: #161b22;
  border-bottom: 1px solid #30363d;
  flex-wrap: wrap;
  gap: 8px;
}

.toolbar-left,
.toolbar-center,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.upload-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: #238636;
  color: #fff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: background 0.2s;
  user-select: none;
}

.upload-btn:hover {
  background: #2ea043;
}

.upload-btn.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.upload-btn input {
  display: none;
}

.file-name {
  color: #8b949e;
  font-size: 13px;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.speed-control {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #8b949e;
  font-size: 12px;
}

.speed-label {
  margin-right: 2px;
}

.speed-value {
  font-weight: 600;
  color: #58a6ff;
  min-width: 40px;
  text-align: center;
}

.progress-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 16px;
  background: #161b22;
  border-bottom: 1px solid #21262d;
}

.progress-slider {
  flex: 1;
  margin: 0;
}

.time {
  font-size: 12px;
  color: #8b949e;
  font-family: 'SF Mono', 'Fira Code', monospace;
  min-width: 42px;
}

.canvas-wrapper {
  flex: 1;
  position: relative;
  overflow: hidden;
  min-height: 300px;
}

.canvas-wrapper canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.empty-hint {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: rgba(255, 255, 255, 0.4);
  pointer-events: none;
}

.empty-hint p {
  margin: 6px 0;
  font-size: 18px;
}

.empty-hint .sub {
  font-size: 13px;
  opacity: 0.6;
}

.loading-hint {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: rgba(255, 255, 255, 0.5);
  pointer-events: none;
  font-size: 16px;
}

.info-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  background: #161b22;
  border-top: 1px solid #21262d;
  color: #8b949e;
  font-size: 12px;
}
</style>
