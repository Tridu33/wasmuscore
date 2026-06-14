<script lang="ts" setup>
import * as alphaTab from '@coderline/alphatab'
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'

// --- State ---
const canvasRef = ref<HTMLElement | null>(null)
const viewportRef = ref<HTMLElement | null>(null)
let api: alphaTab.AlphaTabApi | null = null

const isLoaded = ref(false)
const isPlaying = ref(false)
const isLoading = ref(false)
const songTitle = ref('')
const songArtist = ref('')
const currentTime = ref('00:00')
const totalTime = ref('00:00')
const currentTimeMs = ref(0)
const endTimeMs = ref(0)

const playbackSpeed = ref(1)
const zoomLevel = ref(1)
const isLooping = ref(false)
const isMetronome = ref(false)
const isCountIn = ref(false)

const layoutMode = ref<alphaTab.LayoutMode>(alphaTab.LayoutMode.Page)
const scrollMode = ref<alphaTab.ScrollMode>(alphaTab.ScrollMode.Continuous)

interface TrackInfo {
  index: number
  name: string
  instrument: string
  isActive: boolean
  isMuted: boolean
  isSolo: boolean
}
const tracks = ref<TrackInfo[]>([])

// --- Unsubscribe functions ---
let unsubscribes: (() => void)[] = []
// Use a counter to track overlapping render operations
let renderPendingCount = 0

// --- Helpers ---
function formatDuration(milliseconds: number): string {
  const sec = (milliseconds / 1000) | 0
  const min = (sec / 60) | 0
  const s = sec % 60
  return `${String(min).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// Bravura font directory - serve directly from Vite's static file server.
// We use the public-accessible path via /@fs/ to serve from node_modules.
const FONT_DIR = '/node_modules/.pnpm/@coderline+alphatab@1.8.3/node_modules/@coderline/alphatab/dist/font/'

function buildSettings(): alphaTab.Settings {
  const settings = new alphaTab.Settings()
  settings.fillFromJson({
    core: {
      engine: 'default',
      logLevel: 'info',
      fontDirectory: FONT_DIR
    },
    display: {
      layoutMode: layoutMode.value,
      scale: zoomLevel.value
    },
    player: {
      playerMode: alphaTab.PlayerMode.EnabledAutomatic,
      scrollMode: scrollMode.value,
      scrollOffsetX: -10,
      scrollOffsetY: -20
    }
  } satisfies alphaTab.json.SettingsJson)
  return settings
}

function updateTrackList(score: alphaTab.model.Score) {
  tracks.value = score.tracks.map(t => ({
    index: t.index,
    name: t.name || `Track ${t.index + 1}`,
    instrument: t.playbackInfo?.program != null ? getProgramName(t.playbackInfo.program) : '',
    isActive: true,
    isMuted: t.playbackInfo?.isMute || false,
    isSolo: t.playbackInfo?.isSolo || false
  }))
}

function getProgramName(program: number): string {
  const programs = [
    'Acoustic Grand Piano', 'Bright Acoustic Piano', 'Electric Grand Piano', 'Honky-tonk Piano',
    'Electric Piano 1', 'Electric Piano 2', 'Harpsichord', 'Clavi',
    'Celesta', 'Glockenspiel', 'Music Box', 'Vibraphone',
    'Marimba', 'Xylophone', 'Tubular Bells', 'Dulcimer',
    'Drawbar Organ', 'Percussive Organ', 'Rock Organ', 'Church Organ',
    'Reed Organ', 'Accordion', 'Harmonica', 'Tango Accordion',
    'Acoustic Guitar (nylon)', 'Acoustic Guitar (steel)', 'Electric Guitar (jazz)', 'Electric Guitar (clean)',
    'Electric Guitar (muted)', 'Overdriven Guitar', 'Distortion Guitar', 'Guitar harmonics',
    'Acoustic Bass', 'Electric Bass (finger)', 'Electric Bass (pick)', 'Fretless Bass',
    'Slap Bass 1', 'Slap Bass 2', 'Synth Bass 1', 'Synth Bass 2',
    'Violin', 'Viola', 'Cello', 'Contrabass',
    'Tremolo Strings', 'Pizzicato Strings', 'Orchestral Harp', 'Timpani',
    'String Ensemble 1', 'String Ensemble 2', 'Synth Strings 1', 'Synth Strings 2',
    'Choir Aahs', 'Voice Oohs', 'Synth Voice', 'Orchestra Hit',
    'Trumpet', 'Trombone', 'Tuba', 'Muted Trumpet',
    'French Horn', 'Brass Section', 'Synth Brass 1', 'Synth Brass 2',
    'Soprano Sax', 'Alto Sax', 'Tenor Sax', 'Baritone Sax',
    'Oboe', 'English Horn', 'Bassoon', 'Clarinet',
    'Piccolo', 'Flute', 'Recorder', 'Pan Flute',
    'Blown Bottle', 'Shakuhachi', 'Whistle', 'Ocarina',
    'Lead 1 (square)', 'Lead 2 (sawtooth)', 'Lead 3 (calliope)', 'Lead 4 (chiff)',
    'Lead 5 (charang)', 'Lead 6 (voice)', 'Lead 7 (fifths)', 'Lead 8 (bass + lead)',
    'Pad 1 (new age)', 'Pad 2 (warm)', 'Pad 3 (polysynth)', 'Pad 4 (choir)',
    'Pad 5 (bowed)', 'Pad 6 (metallic)', 'Pad 7 (halo)', 'Pad 8 (sweep)',
    'FX 1 (rain)', 'FX 2 (soundtrack)', 'FX 3 (crystal)', 'FX 4 (atmosphere)',
    'FX 5 (brightness)', 'FX 6 (goblins)', 'FX 7 (echoes)', 'FX 8 (sci-fi)',
    'Sitar', 'Banjo', 'Shamisen', 'Koto',
    'Kalimba', 'Bag pipe', 'Fiddle', 'Shanai',
    'Tinkle Bell', 'Agogo', 'Steel Drums', 'Woodblock',
    'Taiko Drum', 'Melodic Tom', 'Synth Drum', 'Reverse Cymbal',
    'Guitar Fret Noise', 'Breath Noise', 'Seashore', 'Bird Tweet',
    'Telephone Ring', 'Helicopter', 'Applause', 'Gunshot'
  ]
  return programs[program] || `Program ${program}`
}

// --- File handling ---
function handleFile(file: File) {
  if (!api) return
  api.load(file)
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) handleFile(file)
  input.value = ''
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  const file = e.dataTransfer?.files[0]
  if (file) handleFile(file)
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
}

// --- Playback controls ---
function playPause() {
  api?.playPause()
}

function stop() {
  api?.stop()
}

function onSpeedChange(speed: number) {
  playbackSpeed.value = speed
  if (api) api.playbackSpeed = speed
}

function onZoomChange(zoom: number) {
  zoomLevel.value = zoom
  if (api) {
    api.settings.display.scale = zoom
    api.updateSettings()
    api.render()
  }
}

function onLayoutChange(mode: alphaTab.LayoutMode) {
  layoutMode.value = mode
  if (api) {
    api.settings.display.layoutMode = mode
    api.updateSettings()
    api.render()
  }
}

function onScrollChange(mode: alphaTab.ScrollMode) {
  scrollMode.value = mode
  if (api) {
    api.settings.player.scrollMode = mode
    switch (mode) {
      case alphaTab.ScrollMode.Continuous:
      case alphaTab.ScrollMode.OffScreen:
        api.settings.player.scrollOffsetX = -10
        api.settings.player.scrollOffsetY = -10
        break
      case alphaTab.ScrollMode.Smooth:
        api.settings.player.scrollOffsetX = -50
        api.settings.player.scrollOffsetY = -100
        break
    }
    api.updateSettings()
    api.render()
  }
}

function toggleLoop() {
  isLooping.value = !isLooping.value
  if (api) api.isLooping = isLooping.value
}

function toggleMetronome() {
  isMetronome.value = !isMetronome.value
  if (api) api.metronomeVolume = isMetronome.value ? 1 : 0
}

function toggleCountIn() {
  isCountIn.value = !isCountIn.value
  if (api) api.countInVolume = isCountIn.value ? 1 : 0
}

function onTimeSliderInput(e: Event) {
  const val = parseFloat((e.target as HTMLInputElement).value)
  if (api?.player && endTimeMs.value > 0) {
    api.player.timePosition = val
  }
}

function onTrackSelect(track: TrackInfo) {
  if (!api) return
  if (api.tracks.length === 1 && api.tracks[0].index === track.index) {
    return
  }
  const alphaTabTrack = api.score?.tracks[track.index]
  if (alphaTabTrack) {
    api.renderTracks([alphaTabTrack])
  }
}

function onTrackMute(track: TrackInfo) {
  if (!api?.score) return
  const t = api.score.tracks[track.index]
  if (t?.playbackInfo) {
    t.playbackInfo.isMute = !track.isMuted
    track.isMuted = t.playbackInfo.isMute
  }
}

function onTrackSolo(track: TrackInfo) {
  if (!api?.score) return
  track.isSolo = !track.isSolo
  // Solo this track, mute all others
  for (const t of api.score.tracks) {
    if (t.playbackInfo) {
      t.playbackInfo.isSolo = t.index === track.index && track.isSolo
      t.playbackInfo.isMute = track.isSolo && t.index !== track.index
      const info = tracks.value[t.index]
      if (info) {
        info.isSolo = t.playbackInfo.isSolo
        info.isMuted = t.playbackInfo.isMute
      }
    }
  }
}

function onPrint() {
  api?.print()
}

// --- Lifecycle ---
onMounted(() => {
  if (!canvasRef.value) return

  const settings = buildSettings()
  api = new alphaTab.AlphaTabApi(canvasRef.value, settings)

  unsubscribes = [
    api.renderStarted.on((isResize: boolean) => {
      if (!isResize) {
        renderPendingCount++
        isLoading.value = true
      }
    }),
    api.renderFinished.on(() => {
      renderPendingCount = Math.max(0, renderPendingCount - 1)
      if (renderPendingCount === 0) isLoading.value = false
    }),
    api.scoreLoaded.on((score: alphaTab.model.Score) => {
      isLoaded.value = true
      isLoading.value = false
      renderPendingCount = 0
      songTitle.value = score.title || 'Untitled'
      songArtist.value = score.artist || ''
      updateTrackList(score)
    }),
    api.playerReady.on(() => {
      isPlaying.value = false
    }),
    api.playerStateChanged.on((args: { state: alphaTab.synth.PlayerState }) => {
      isPlaying.value = args.state === alphaTab.synth.PlayerState.Playing
    }),
    api.playerPositionChanged.on((args: { currentTime: number; endTime: number }) => {
      currentTimeMs.value = args.currentTime
      endTimeMs.value = args.endTime
      currentTime.value = formatDuration(args.currentTime)
      totalTime.value = formatDuration(args.endTime)
    }),
    api.error.on((e: unknown) => {
      console.error('alphaTab error:', e)
      isLoading.value = false
    })
  ]
})

onBeforeUnmount(() => {
  for (const unsub of unsubscribes) unsub()
  unsubscribes = []
  api?.destroy()
  api = null
})
</script>

<template>
  <div
    class="alpha-tab-page"
    @drop="onDrop"
    @dragover="onDragOver"
  >
    <!-- Top Toolbar -->
    <div class="at-toolbar">
      <div class="at-toolbar-left">
        <!-- File open -->
        <label class="at-btn at-btn-primary" title="打开 Guitar Pro 文件 (.gp3/.gp4/.gp5/.gpx/.gp)">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
          </svg>
          打开乐谱
          <input type="file" accept=".gp3,.gp4,.gp5,.gpx,.gp" @change="onFileChange" hidden>
        </label>

        <!-- Song info -->
        <span v-if="isLoaded" class="at-song-info">
          <span class="at-song-title">{{ songTitle }}</span>
          <span v-if="songArtist" class="at-song-artist">- {{ songArtist }}</span>
        </span>
        <span v-else class="at-song-info at-hint">点击"打开乐谱"或拖放 GP 文件到此处</span>
      </div>

      <div class="at-toolbar-right">
        <!-- Layout mode -->
        <select
          v-if="isLoaded"
          class="at-select"
          :value="layoutMode"
          @change="onLayoutChange(Number(($event.target as HTMLSelectElement).value))"
          title="布局模式"
        >
          <option :value="alphaTab.LayoutMode.Horizontal">横向</option>
          <option :value="alphaTab.LayoutMode.Page">纵向</option>
          <option :value="alphaTab.LayoutMode.Parchment">羊皮纸</option>
        </select>

        <!-- Zoom -->
        <select
          v-if="isLoaded"
          class="at-select"
          :value="zoomLevel"
          @change="onZoomChange(Number(($event.target as HTMLSelectElement).value))"
          title="缩放"
        >
          <option :value="0.25">25%</option>
          <option :value="0.5">50%</option>
          <option :value="0.75">75%</option>
          <option :value="1">100%</option>
          <option :value="1.25">125%</option>
          <option :value="1.5">150%</option>
          <option :value="2">200%</option>
        </select>

        <!-- Scroll mode -->
        <select
          v-if="isLoaded"
          class="at-select"
          :value="scrollMode"
          @change="onScrollChange(Number(($event.target as HTMLSelectElement).value))"
          title="滚动模式"
        >
          <option :value="alphaTab.ScrollMode.Off">关闭</option>
          <option :value="alphaTab.ScrollMode.Continuous">连续</option>
          <option :value="alphaTab.ScrollMode.OffScreen">屏幕外</option>
          <option :value="alphaTab.ScrollMode.Smooth">平滑</option>
        </select>

        <!-- Print -->
        <button v-if="isLoaded" class="at-btn" @click="onPrint" title="打印">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Main Content -->
    <div class="at-content">
      <!-- Track sidebar -->
      <div v-if="isLoaded && tracks.length" class="at-sidebar">
        <div class="at-sidebar-header">音轨</div>
        <div class="at-track-list">
          <div
            v-for="track in tracks"
            :key="track.index"
            class="at-track-item"
            :class="{ active: api?.tracks.some(t => t.index === track.index) }"
            @click="onTrackSelect(track)"
          >
            <span class="at-track-name" :title="track.name">{{ track.name }}</span>
            <div class="at-track-actions">
              <button
                class="at-icon-btn"
                :class="{ active: track.isMuted }"
                @click.stop="onTrackMute(track)"
                :title="track.isMuted ? '取消静音' : '静音'"
              >
                {{ track.isMuted ? '🔇' : '🔊' }}
              </button>
              <button
                class="at-icon-btn"
                :class="{ active: track.isSolo }"
                @click.stop="onTrackSolo(track)"
                title="独奏"
              >
                S
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Canvas viewport -->
      <div ref="viewportRef" class="at-viewport">
        <div ref="canvasRef" class="at-canvas" />
        <!-- Loading overlay -->
        <div v-if="isLoading" class="at-loading-overlay">
          <div class="at-loading-spinner" />
          <span>加载中...</span>
        </div>
      </div>
    </div>

    <!-- Bottom control bar -->
    <div v-if="isLoaded" class="at-footer">
      <!-- Time slider -->
      <div class="at-time-bar">
        <span class="at-time-text">{{ currentTime }}</span>
        <input
          type="range"
          class="at-slider"
          :max="endTimeMs"
          :value="currentTimeMs"
          @input="onTimeSliderInput"
        >
        <span class="at-time-text">{{ totalTime }}</span>
      </div>

      <!-- Transport controls -->
      <div class="at-transport">
        <div class="at-transport-left">
          <!-- Stop -->
          <button class="at-btn" @click="stop" title="停止">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="1"/>
            </svg>
          </button>
          <!-- Play/Pause -->
          <button class="at-btn at-btn-play" @click="playPause" :title="isPlaying ? '暂停' : '播放'">
            <svg v-if="!isPlaying" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            <svg v-else viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
            </svg>
          </button>

          <!-- Speed -->
          <select
            class="at-select at-speed-select"
            :value="playbackSpeed"
            @change="onSpeedChange(Number(($event.target as HTMLSelectElement).value))"
            title="播放速度"
          >
            <option :value="0.25">0.25x</option>
            <option :value="0.5">0.5x</option>
            <option :value="0.75">0.75x</option>
            <option :value="0.9">0.9x</option>
            <option :value="1">1x</option>
            <option :value="1.1">1.1x</option>
            <option :value="1.25">1.25x</option>
            <option :value="1.5">1.5x</option>
            <option :value="2">2x</option>
          </select>
        </div>

        <div class="at-transport-right">
          <!-- Count-In -->
          <button
            class="at-btn"
            :class="{ active: isCountIn }"
            @click="toggleCountIn"
            title="预备拍"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </button>
          <!-- Metronome -->
          <button
            class="at-btn"
            :class="{ active: isMetronome }"
            @click="toggleMetronome"
            title="节拍器"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L8 22h8L12 2z"/><line x1="12" y1="8" x2="12" y2="16"/>
            </svg>
          </button>
          <!-- Loop -->
          <button
            class="at-btn"
            :class="{ active: isLooping }"
            @click="toggleLoop"
            title="循环播放"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
              <polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.alpha-tab-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 60px);
  background: var(--ep-bg-container, #1a1a2e);
  color: var(--ep-text-color-primary, #e0e0e0);
  overflow: hidden;
  position: relative;
}

/* Top Toolbar */
.at-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  background: var(--ep-fill-color-blank, #2a2a3e);
  border-bottom: 1px solid var(--ep-border-color-light, #3a3a4e);
  flex-shrink: 0;
  gap: 8px;
  flex-wrap: wrap;
}

.at-toolbar-left,
.at-toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.at-song-info {
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
}

.at-song-title {
  font-weight: 600;
}

.at-song-artist {
  color: var(--ep-text-color-secondary, #a0a0b0);
}

.at-hint {
  color: var(--ep-text-color-secondary, #a0a0b0);
  font-style: italic;
}

/* Buttons */
.at-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: 1px solid var(--ep-border-color-light, #3a3a4e);
  border-radius: 4px;
  background: var(--ep-fill-color-blank, #2a2a3e);
  color: var(--ep-text-color-regular, #c0c0d0);
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
  transition: all 0.15s;
}

.at-btn:hover {
  background: var(--ep-fill-color-light, #3a3a4e);
}

.at-btn-primary {
  background: var(--ep-color-primary, #409eff);
  border-color: var(--ep-color-primary, #409eff);
  color: #fff;
}

.at-btn-primary:hover {
  background: var(--ep-color-primary-light-3, #66b1ff);
}

.at-btn.active {
  background: var(--ep-color-primary, #409eff);
  border-color: var(--ep-color-primary, #409eff);
  color: #fff;
}

.at-btn-play {
  min-width: 40px;
  justify-content: center;
}

.at-icon-btn {
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  border-radius: 3px;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.at-icon-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.at-icon-btn.active {
  background: var(--ep-color-primary, #409eff);
  color: #fff;
}

/* Selects */
.at-select {
  padding: 4px 8px;
  border: 1px solid var(--ep-border-color-light, #3a3a4e);
  border-radius: 4px;
  background: var(--ep-fill-color-blank, #2a2a3e);
  color: var(--ep-text-color-regular, #c0c0d0);
  cursor: pointer;
  font-size: 13px;
}

.at-speed-select {
  min-width: 60px;
}

/* Main Content */
.at-content {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

/* Sidebar */
.at-sidebar {
  width: 200px;
  background: var(--ep-fill-color-blank, #2a2a3e);
  border-right: 1px solid var(--ep-border-color-light, #3a3a4e);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;
}

.at-sidebar-header {
  padding: 8px 12px;
  font-weight: 600;
  font-size: 13px;
  border-bottom: 1px solid var(--ep-border-color-light, #3a3a4e);
  flex-shrink: 0;
}

.at-track-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.at-track-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  cursor: pointer;
  transition: background 0.15s;
  font-size: 13px;
}

.at-track-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.at-track-item.active {
  background: rgba(64, 158, 255, 0.15);
  border-left: 3px solid var(--ep-color-primary, #409eff);
}

.at-track-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  margin-right: 8px;
}

.at-track-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

/* Viewport */
.at-viewport {
  flex: 1;
  overflow-y: auto;
  position: relative;
}

.at-canvas {
  min-height: 100%;
}

/* Loading overlay */
.at-loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(3px);
  gap: 12px;
  z-index: 100;
}

.at-loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-top-color: var(--ep-color-primary, #409eff);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Footer */
.at-footer {
  flex-shrink: 0;
  background: var(--ep-fill-color-blank, #2a2a3e);
  border-top: 1px solid var(--ep-border-color-light, #3a3a4e);
}

.at-time-bar {
  display: flex;
  align-items: center;
  padding: 4px 12px;
  gap: 8px;
}

.at-time-text {
  font-size: 12px;
  font-weight: 600;
  font-family: monospace;
  min-width: 48px;
}

.at-slider {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--ep-border-color-light, #3a3a4e);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

.at-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--ep-color-primary, #409eff);
  cursor: pointer;
}

.at-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--ep-color-primary, #409eff);
  border: none;
  cursor: pointer;
}

.at-transport {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 12px;
}

.at-transport-left,
.at-transport-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Responsive */
@media screen and (max-width: 768px) {
  .at-sidebar {
    width: 150px;
  }

  .at-toolbar-right .at-select:not(.at-speed-select) {
    display: none;
  }

  .at-song-info {
    max-width: 150px;
  }
}

@media screen and (max-width: 600px) {
  .at-sidebar {
    display: none;
  }
}
</style>
