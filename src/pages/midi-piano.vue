<script setup lang="ts">
import { UploadFilled, VideoPlay, VideoPause, CircleClose, Headset, Plus, Minus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Midi } from '@tonejs/midi'
import type { Midi as MidiType } from '@tonejs/midi'
import * as Tone from 'tone'

// ===================== 常量 =====================
const FIRST_NOTE = 21     // A0
const LAST_NOTE = 108     // C8
const TOTAL_KEYS = LAST_NOTE - FIRST_NOTE + 1  // 88
const KEYBOARD_HEIGHT = 90
const FALL_ZONE_HEIGHT = 400  // 音符下落区域高度
const CANVAS_MIN_WIDTH = 800
const NOTE_HEIGHT_MIN = 2

// 调色板 - 每个轨道一个颜色
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
  trackColor: string
  name: string
}

interface ActiveKey {
  note: number
  color: string
}

// ===================== 响应式状态 =====================
const canvasRef = ref<HTMLCanvasElement | null>(null)
const canvasWidth = ref(CANVAS_MIN_WIDTH)
const canvasHeight = ref(FALL_ZONE_HEIGHT + KEYBOARD_HEIGHT)

const midiData = ref<MidiType | null>(null)
const notes = ref<PianoNote[]>([])
const isPlaying = ref(false)
const isPaused = ref(false)
const currentTime = ref(0)  // ms
const duration = ref(0)     // ms
const speed = ref(1.0)      // 播放速度
const activeKeys = ref<ActiveKey[]>([])
const fileName = ref('')
const loading = ref(false)
const midiConnected = ref(false)
const midiAccess = ref<MIDIAccess | null>(null)

let animationId: number | null = null
let startTime = 0         // AudioContext 时间，播放开始时刻
let pauseOffset = 0       // ms, 暂停时的时间偏移
let synth: Tone.PolySynth | null = null

// ===================== Computed =====================
const progressPercent = computed(() => {
  if (!duration.value) return 0
  return Math.min(100, (currentTime.value / duration.value) * 100)
})

// ===================== 工具函数 =====================
function isBlackKey(note: number): boolean {
  const n = note % 12
  return [1, 3, 6, 8, 10].includes(n)
}

function noteToName(note: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const octave = Math.floor(note / 12) - 1
  return names[note % 12] + octave
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return `${m}:${(s % 60).toString().padStart(2, '0')}`
}

function getTrackColor(trackId: number): string {
  return TRACK_COLORS[trackId % TRACK_COLORS.length]
}

// ===================== Canvas 尺寸 =====================
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
}

// ===================== 绘制函数 =====================
function getKeyX(note: number, totalWhiteKeys: number, whiteKeyWidth: number): number {
  // 计算 note 之前有多少个白键
  let whiteIndex = 0
  for (let n = FIRST_NOTE; n < note; n++) {
    if (!isBlackKey(n)) whiteIndex++
  }
  if (!isBlackKey(note)) {
    return whiteIndex * whiteKeyWidth
  }
  // 黑键放在相邻白键之间
  return whiteIndex * whiteKeyWidth - whiteKeyWidth * 0.15
}

function draw(ctx: CanvasRenderingContext2D, dpr: number) {
  const w = canvasWidth.value
  const h = canvasHeight.value
  const kbY = h - KEYBOARD_HEIGHT  // 键盘区顶部 Y

  ctx.save()
  ctx.scale(dpr, dpr)

  // -- 背景 --
  const bg = ctx.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, '#0d1117')
  bg.addColorStop(1, '#161b22')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  // 计算白键数量用于布局
  let whiteCount = 0
  for (let n = FIRST_NOTE; n <= LAST_NOTE; n++) {
    if (!isBlackKey(n)) whiteCount++
  }
  const whiteKeyWidth = w / whiteCount
  const blackKeyWidth = whiteKeyWidth * 0.65

  // -- 音符下落区网格线 --
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'
  ctx.lineWidth = 1
  for (let n = FIRST_NOTE; n <= LAST_NOTE; n++) {
    const x = getKeyX(n, whiteCount, whiteKeyWidth)
    const kw = isBlackKey(n) ? blackKeyWidth : whiteKeyWidth
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, kbY)
    ctx.stroke()
  }

  // -- 当前时间线 --
  ctx.strokeStyle = 'rgba(255, 50, 50, 0.7)'
  ctx.lineWidth = 2
  ctx.setLineDash([6, 4])
  ctx.beginPath()
  ctx.moveTo(0, kbY)
  ctx.lineTo(w, kbY)
  ctx.stroke()
  ctx.setLineDash([])

  // -- 绘制下落音符 --
  // 音符从顶部下落到键盘线, 音符 startMs == currentTime 时刚好碰到键盘线
  const visibleTimeWindow = 4000 / speed.value  // 可见时间窗口 (ms)

  for (const note of notes.value) {
    // 只绘制可见范围内的音符
    if (note.endMs < currentTime.value - 100 || note.startMs > currentTime.value + visibleTimeWindow) continue

    const x = getKeyX(note.noteNumber, whiteCount, whiteKeyWidth)
    const kw = isBlackKey(note.noteNumber) ? blackKeyWidth : whiteKeyWidth

    // 音符底部 Y: 当 startMs == currentTime 时 yBottom == kbY
    const timeToHit = note.startMs - currentTime.value
    const yBottom = kbY - (timeToHit / visibleTimeWindow) * kbY
    const noteHeight = Math.max(NOTE_HEIGHT_MIN, (note.durationMs / visibleTimeWindow) * kbY)
    const yTop = yBottom - noteHeight

    // 只绘制在屏幕内的部分
    if (yTop > kbY || yBottom < 0) continue

    ctx.fillStyle = note.trackColor
    ctx.globalAlpha = 0.85
    ctx.beginPath()
    ctx.roundRect(x + 1, Math.max(0, yTop), kw - 2, Math.min(yBottom, kbY) - Math.max(0, yTop), 2)
    ctx.fill()

    // 高光
    ctx.globalAlpha = 0.3
    ctx.fillStyle = '#fff'
    ctx.fillRect(x + 2, Math.max(0, yTop), kw - 4, 2)
    ctx.globalAlpha = 1
  }

  // -- 钢琴键盘 --
  // 白键
  for (let n = FIRST_NOTE; n <= LAST_NOTE; n++) {
    if (isBlackKey(n)) continue
    const x = getKeyX(n, whiteCount, whiteKeyWidth)
    const isActive = activeKeys.value.some(k => k.note === n)
    ctx.fillStyle = isActive ? '#4285f4' : '#f0f0f0'
    ctx.fillRect(x + 0.5, kbY, whiteKeyWidth - 1, KEYBOARD_HEIGHT)
    ctx.strokeStyle = '#ccc'
    ctx.lineWidth = 0.5
    ctx.strokeRect(x + 0.5, kbY, whiteKeyWidth - 1, KEYBOARD_HEIGHT)
  }
  // 黑键
  for (let n = FIRST_NOTE; n <= LAST_NOTE; n++) {
    if (!isBlackKey(n)) continue
    const x = getKeyX(n, whiteCount, whiteKeyWidth)
    const isActive = activeKeys.value.some(k => k.note === n)
    const activeColor = activeKeys.value.find(k => k.note === n)?.color || '#4285f4'
    ctx.fillStyle = isActive ? activeColor : '#222'
    ctx.fillRect(x, kbY, blackKeyWidth, KEYBOARD_HEIGHT * 0.6)
    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    ctx.fillRect(x, kbY + KEYBOARD_HEIGHT * 0.6, blackKeyWidth, KEYBOARD_HEIGHT * 0.4)
  }

  ctx.restore()
}

// ===================== 动画循环 =====================
function tick() {
  if (!isPlaying.value) return

  const now = Tone.now() * 1000  // ms
  const elapsed = (now - startTime) * speed.value
  currentTime.value = pauseOffset + elapsed

  if (currentTime.value >= duration.value) {
    stop()
    return
  }

  // 更新活动音符
  updateActiveKeys()

  // 绘制
  const canvas = canvasRef.value
  if (canvas) {
    const ctx = canvas.getContext('2d')
    if (ctx) draw(ctx, window.devicePixelRatio || 1)
  }

  animationId = requestAnimationFrame(tick)
}

function updateActiveKeys() {
  const current = currentTime.value
  const active: ActiveKey[] = []
  for (const note of notes.value) {
    if (current >= note.startMs && current <= note.endMs) {
      active.push({ note: note.noteNumber, color: note.trackColor })
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

  // 调度所有音符
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
  activeKeys.value = []
  // 重绘静态画面
  drawStatic()
}

function drawStatic() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  draw(ctx, window.devicePixelRatio || 1)
}

function changeSpeed(delta: number) {
  speed.value = Math.max(0.25, Math.min(4.0, speed.value + delta))
  ElMessage.success(`速度: ${speed.value.toFixed(2)}x`)

  // 如果正在播放, 重新调度
  if (isPlaying.value) {
    const current = currentTime.value
    stop()
    currentTime.value = current
    pauseOffset = current
    // 需要重新调度
    Tone.Transport.bpm.value = ((midiData.value?.header.tempos[0]?.bpm) || 120) * speed.value
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

    // 转换为内部格式
    const pianoNotes: PianoNote[] = []
    let trackIdx = 0
    for (const track of parsed.tracks) {
      for (const note of track.notes) {
        if (note.midi < FIRST_NOTE || note.midi > LAST_NOTE) continue
        pianoNotes.push({
          noteNumber: note.midi,
          startMs: note.time * 1000,
          endMs: (note.time + note.duration) * 1000,
          durationMs: note.duration * 1000,
          velocity: note.velocity,
          trackId: trackIdx,
          trackColor: getTrackColor(track.channel),
          name: note.name,
        })
      }
      trackIdx++
    }

    // 按开始时间排序
    pianoNotes.sort((a, b) => a.startMs - b.startMs)
    notes.value = pianoNotes

    duration.value = parsed.duration * 1000
    currentTime.value = 0
    activeKeys.value = []

    ElMessage.success(`已加载: ${file.name} (${parsed.tracks.length} 轨, ${pianoNotes.length} 音符)`)

    // 静态绘制
    await new Promise(r => setTimeout(r, 100))
    drawStatic()
  }
  catch (e: any) {
    ElMessage.error(`解析 MIDI 失败: ${e.message}`)
    console.error(e)
  }
  finally {
    loading.value = false
  }
}

// ===================== Web MIDI 键盘连接 =====================
async function connectMidi() {
  try {
    const access = await navigator.requestMIDIAccess({ sysex: false })
    midiAccess.value = access

    for (const input of (access.inputs as Map<string, MIDIInput>).values()) {
      input.onmidimessage = handleMidiMessage
    }

    access.onstatechange = (e) => {
      if (e.port && e.port.state === 'connected' && e.port.type === 'input') {
        ;(e.port as MIDIInput).onmidimessage = handleMidiMessage
      }
    }

    midiConnected.value = true
    const inputs = Array.from((access.inputs as Map<string, MIDIInput>).values()).map(i => i.name)
    ElMessage.success(`MIDI 已连接: ${inputs.join(', ') || '(无输入设备)'}`)
  }
  catch (e: any) {
    ElMessage.warning('Web MIDI 不可用或用户拒绝: ' + e.message)
  }
}

function handleMidiMessage(event: MIDIMessageEvent) {
  const data = event.data
  if (!data) return
  const cmd = data[0]
  const note = data[1]
  const vel = data[2]
  const cmdType = cmd & 0xf0

  if (cmdType === 0x90 && vel > 0) {
    // Note On
    if (note >= FIRST_NOTE && note <= LAST_NOTE) {
      activeKeys.value = [
        ...activeKeys.value,
        { note, color: '#4285f4' },
      ]
      // 播放声音
      if (synth) {
        const freq = Tone.Frequency(note, 'midi').toFrequency()
        synth.triggerAttack(freq, undefined, vel / 127)
      }
    }
  }
  else if ((cmdType === 0x80) || (cmdType === 0x90 && vel === 0)) {
    // Note Off
    activeKeys.value = activeKeys.value.filter(k => k.note !== note)
    if (synth) {
      const freq = Tone.Frequency(note, 'midi').toFrequency()
      synth.triggerRelease(freq)
    }
  }

  // 触发重绘
  drawStatic()
}

function disconnectMidi() {
  if (midiAccess.value) {
    for (const input of (midiAccess.value.inputs as Map<string, MIDIInput>).values()) {
      input.onmidimessage = null
    }
    midiAccess.value = null
  }
  midiConnected.value = false
  ElMessage.info('MIDI 已断开')
}

// ===================== 进度条拖动 =====================
function handleSeek(value: number) {
  if (!midiData.value) return
  const targetMs = (value / 100) * duration.value
  currentTime.value = targetMs
  pauseOffset = targetMs

  // 重新调度
  if (isPlaying.value) {
    Tone.Transport.stop()
    Tone.Transport.cancel()
    scheduleNotes()
    Tone.Transport.start()
    startTime = Tone.now() - targetMs / speed.value / 1000
  }

  drawStatic()
}

// ===================== 生命周期 =====================
onMounted(() => {
  resizeCanvas()
  window.addEventListener('resize', resizeCanvas)
  // 初始绘制
  setTimeout(drawStatic, 100)
})

onUnmounted(() => {
  if (animationId) cancelAnimationFrame(animationId)
  window.removeEventListener('resize', resizeCanvas)
  Tone.Transport.stop()
  Tone.Transport.dispose()
  disconnectMidi()
})
</script>

<template>
  <div class="midi-piano-page">
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

      <div class="toolbar-right">
        <el-button
          :type="midiConnected ? 'success' : 'default'"
          :icon="Headset"
          @click="midiConnected ? disconnectMidi() : connectMidi()"
        >
          {{ midiConnected ? 'MIDI 已连接' : '连接 MIDI 键盘' }}
        </el-button>
      </div>
    </div>

    <!-- 进度条 -->
    <div v-if="midiData" class="progress-bar">
      <span class="time">{{ formatTime(currentTime) }}</span>
      <el-slider
        :model-value="progressPercent"
        :min="0"
        :max="100"
        :show-tooltip="false"
        @input="handleSeek"
        @change="handleSeek"
        class="progress-slider"
      />
      <span class="time">{{ formatTime(duration) }}</span>
    </div>

    <!-- 可视化 Canvas -->
    <div class="canvas-wrapper">
      <canvas ref="canvasRef" />
      <div v-if="!midiData && !loading" class="empty-hint">
        <p>🎹 上传 MIDI 文件开始瀑布流演奏</p>
        <p class="sub">支持 .mid / .midi 文件 · 可连接 MIDI 键盘实时演奏</p>
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
.midi-piano-page {
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
