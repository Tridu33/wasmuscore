<script lang="ts" setup>
import * as alphaTab from '@coderline/alphatab'
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { useTabsStore } from '~/stores/tabs'
import { parseGpFile } from '~/utils/guitarpro/parser'
import type { GpSong, GpTabRecord } from '~/utils/guitarpro/types'

// --- GBK/UTF-8 decoder for GP file metadata ---
// Guitar Pro files store text in various encodings:
// - GP3/GP4: GBK (system default on Chinese Windows)
// - GP5: may be UTF-8 in some files
// alphaTab reads raw bytes as Latin-1/ISO-8859-1, producing mojibake.
// This detects the original encoding and fixes it.
function decodeGbk(raw: string): string {
  if (!raw) return raw
  // Convert the mis-decoded string back to raw bytes
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i) & 0xFF
  const blen = bytes.length

  // Heuristic: UTF-8 CJK = 3 bytes per char, GBK CJK = 2 bytes per char
  // If decoding as UTF-8 gives a ratio of ~3.0 with CJK chars, it's UTF-8
  try {
    const utf8 = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    const ratio = blen / utf8.length
    const hasCJK = /[一-鿿]/.test(utf8)
    if (hasCJK && Math.abs(ratio - 3.0) < 0.1) return utf8
  }
  catch { /* not valid UTF-8 */ }

  // Try GBK
  try {
    return new TextDecoder('gbk', { fatal: false }).decode(bytes)
  }
  catch { /* gbk not available */ }

  return raw
}

// --- Tabs store ---
const tabsStore = useTabsStore()
const showTabLibrary = ref(true) // toggle between tab library and track list
const gpMetadata = ref<GpSong | null>(null)
const tabSearchInput = ref('')
const showSamples = ref(false) // sample tabs dropdown
const isDarkTheme = ref(false) // theme toggle

// Sample Guitar Pro tabs (local files from public/samples/)
interface SampleTab {
  name: string
  artist: string
  emoji: string
  tip: string
  file: string // local path in public/
}
const sampleTabs: SampleTab[] = [
  { name: '两只老虎', artist: '经典儿歌', emoji: '🐯', tip: '默认示例乐谱', file: '/samples/两只老虎.gp5' },
  { name: '那些花儿', artist: '朴树', emoji: '🌸', tip: '经典民谣', file: '/samples/那些花儿.gp3' },
  { name: 'Bends', artist: 'Guitar Pro Demo', emoji: '🎸', tip: '推弦技巧示例', file: '/samples/bends.gp5' },
  { name: 'Slides', artist: 'Guitar Pro Demo', emoji: '🎵', tip: '滑音技巧示例', file: '/samples/slides.gp5' },
  { name: 'Vibrato', artist: 'Guitar Pro Demo', emoji: '〰️', tip: '揉弦技巧示例', file: '/samples/vibrato.gp5' },
]

// --- Sample tabs ---
async function loadSampleTab(sample: SampleTab) {
  showSamples.value = false
  if (!api) return

  try {
    // Pass URL directly - alphaTab handles it natively
    isLoading.value = true
    loadError.value = ''
    const success = api.load(sample.file)
    if (!success) {
      isLoading.value = false
      loadError.value = `无法加载示例: ${sample.name}`
      console.error('Failed to load sample:', sample.name)
      return
    }

    // Also try to pre-parse metadata
    try {
      const response = await fetch(sample.file)
      const blob = await response.blob()
      const file = new File([blob], sample.file.split('/').pop() || `${sample.name}.gp5`, { type: blob.type })
      const parsed = await parseGpFile(file)
      gpMetadata.value = parsed
      songTitle.value = parsed.title || sample.name
      songArtist.value = parsed.artist || sample.artist
    }
    catch (e) {
      // Metadata parse failed, but rendering may still work
      songTitle.value = sample.name
      songArtist.value = sample.artist
    }
  }
  catch (e) {
    console.warn('Failed to load sample:', e)
    isLoading.value = false
    loadError.value = `无法加载示例: ${sample.name}`
  }
}

// --- State ---
const canvasRef = ref<HTMLElement | null>(null)
const viewportRef = ref<HTMLElement | null>(null)
let api: alphaTab.AlphaTabApi | null = null

const isLoaded = ref(false)
const isPlaying = ref(false)
const isLoading = ref(false)
const loadError = ref('')
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
const FONT_DIR = '/font/'
const SOUND_FONT = '/soundfont/sonivox.sf2'

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
      soundFont: SOUND_FONT,
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
    name: decodeGbk(t.name) || `Track ${t.index + 1}`,
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
async function handleFile(file: File) {
  if (!api) return

  loadError.value = ''
  isLoading.value = true

  // Pre-parse with guitarpro-parser for fast metadata
  try {
    const parsed = await parseGpFile(file)
    gpMetadata.value = parsed
    songTitle.value = parsed.title || file.name.replace(/\.[^.]+$/, '')
    songArtist.value = parsed.artist || ''
  }
  catch (e) {
    console.warn('GP pre-parse failed:', e)
  }

  // Load into alphaTab for rendering
  // alphaTab's load() only accepts Score, ArrayBuffer, Uint8Array, or URL string.
  // File/Blob is NOT supported directly, so we convert to ArrayBuffer.
  try {
    const buffer = await file.arrayBuffer()
    const success = api.load(buffer)
    if (!success) {
      isLoading.value = false
      loadError.value = `无法解析文件格式: ${file.name}`
      console.error('alphaTab failed to load file:', file.name)
      return
    }
  }
  catch (e) {
    isLoading.value = false
    loadError.value = `读取文件失败: ${file.name}`
    console.error('Failed to read file as ArrayBuffer:', e)
    return
  }

  // Also upload to backend for library storage
  tabsStore.uploadTab(file).catch(() => {
    // Silently fail - don't block rendering if backend is unavailable
  })
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

// --- Tab Library ---
async function handleSearch() {
  if (tabSearchInput.value.trim()) {
    await tabsStore.searchTabs(tabSearchInput.value)
  }
  else {
    await tabsStore.loadTabs()
  }
}

async function loadTabFromLibrary(tab: GpTabRecord) {
  if (!api || !tab.downloadUrl) return
  try {
    const blob = await tabsStore.downloadTabFile(tab.downloadUrl.split('/').pop()!)
    const file = new File([blob], tab.downloadUrl.split('/').pop()!, { type: blob.type })
    await handleFile(file)
    tabsStore.selectTab(tab)
  }
  catch (e) {
    console.error('Failed to load tab from library:', e)
  }
}

function toggleSidebar() {
  showTabLibrary.value = !showTabLibrary.value
  if (showTabLibrary.value) {
    tabsStore.loadTabs().catch(() => {})
  }
}

// --- Theme toggle ---
function toggleTheme() {
  isDarkTheme.value = !isDarkTheme.value
  const root = document.documentElement
  if (isDarkTheme.value) {
    root.style.setProperty('--at-bg', '#1a1a2e')
    root.style.setProperty('--at-surface', '#2a2a3e')
    root.style.setProperty('--at-border', '#3a3a4e')
    root.style.setProperty('--at-text', '#e0e0e0')
    root.style.setProperty('--at-text-secondary', '#a0a0b0')
  }
  else {
    root.style.setProperty('--at-bg', '#ffffff')
    root.style.setProperty('--at-surface', '#f5f5f5')
    root.style.setProperty('--at-border', '#e0e0e0')
    root.style.setProperty('--at-text', '#333333')
    root.style.setProperty('--at-text-secondary', '#666666')
  }
}

// --- Load default score ---
async function loadDefaultScore() {
  if (!api) return
  isLoading.value = true
  // Pass URL directly - alphaTab's load() supports string URLs
  const success = api.load('/samples/两只老虎.gp5')
  if (!success) {
    isLoading.value = false
    loadError.value = '无法加载默认乐谱'
    console.error('Failed to load default score')
  }
}

// Derived metadata display
const trackCount = computed(() => gpMetadata.value?.tracks?.length ?? 0)
const tempo = computed(() => gpMetadata.value?.tempo ?? 0)
const selectedTrackTuning = computed(() => {
  if (!gpMetadata.value?.tracks?.[0]) return ''
  const t = gpMetadata.value.tracks[0]
  return t.tuning.join(', ')
})

// --- Lifecycle ---
onMounted(() => {
  if (!canvasRef.value) return

  // Initialize theme CSS variables on mount (default is light theme now)
  const root = document.documentElement
  root.style.setProperty('--at-bg', '#ffffff')
  root.style.setProperty('--at-surface', '#f5f5f5')
  root.style.setProperty('--at-border', '#e0e0e0')
  root.style.setProperty('--at-text', '#333333')
  root.style.setProperty('--at-text-secondary', '#666666')

  const settings = buildSettings()
  api = new alphaTab.AlphaTabApi(canvasRef.value, settings)

  // Load saved tabs from backend
  tabsStore.loadTabs().catch(() => {})

  // Load default score (两只老虎)
  loadDefaultScore()

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
      loadError.value = ''
      renderPendingCount = 0
      // Decode all metadata fields that may contain GBK-encoded Chinese text
      songTitle.value = decodeGbk(score.title) || 'Untitled'
      songArtist.value = decodeGbk(score.artist) || ''
      // Also decode other metadata fields that alphaTab exposes
      // (album, music, words, copyright, instructions, notices, subTitle)
      // These are used by alphaTab internally and may appear in tooltips/rendered content
      if ((score as any).album) (score as any).album = decodeGbk((score as any).album)
      if ((score as any).music) (score as any).music = decodeGbk((score as any).music)
      if ((score as any).words) (score as any).words = decodeGbk((score as any).words)
      if ((score as any).copyright) (score as any).copyright = decodeGbk((score as any).copyright)
      if ((score as any).instructions) (score as any).instructions = decodeGbk((score as any).instructions)
      if ((score as any).notices) (score as any).notices = decodeGbk((score as any).notices)
      if ((score as any).subTitle) (score as any).subTitle = decodeGbk((score as any).subTitle)
      if ((score as any).musicians) (score as any).musicians = (score as any).musicians.map((s: string) => decodeGbk(s))
      // Decode track names that alphaTab may use in its internal rendering
      score.tracks?.forEach(t => {
        if (t.name) t.name = decodeGbk(t.name)
      })
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
      loadError.value = e instanceof Error ? e.message : String(e)
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
    @click="showSamples = false"
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

        <!-- Sidebar buttons -->
        <button class="at-btn" :class="{ active: showTabLibrary }" @click="showTabLibrary = true; tabsStore.loadTabs().catch(() => {})" title="乐谱库">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
          乐谱库
        </button>
        <button class="at-btn" :class="{ active: !showTabLibrary }" @click="showTabLibrary = false" title="音轨">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/>
          </svg>
          音轨
        </button>

        <!-- Song info -->
        <span v-if="isLoaded" class="at-song-info">
          <span class="at-song-title">{{ songTitle }}</span>
          <span v-if="songArtist" class="at-song-artist">- {{ songArtist }}</span>
        </span>
        <span v-else-if="isLoading" class="at-song-info at-hint">正在加载乐谱...</span>
        <span v-else-if="loadError" class="at-song-info at-error">❌ {{ loadError }}</span>
        <span v-else class="at-song-info at-hint">点击"打开乐谱"或拖放 GP 文件到此处</span>
      </div>

      <div class="at-toolbar-right">
        <!-- Sample tabs -->
        <div class="at-dropdown">
          <button class="at-btn" @click.stop="showSamples = !showSamples" title="示例乐谱">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
            </svg>
            示例
          </button>
          <div v-if="showSamples" class="at-dropdown-menu">
            <div
              v-for="sample in sampleTabs"
              :key="sample.name"
              class="at-dropdown-item"
              @click="loadSampleTab(sample)"
            >
              <span class="at-dropdown-emoji">{{ sample.emoji }}</span>
              <div class="at-dropdown-info">
                <span class="at-dropdown-name">{{ sample.name }}</span>
                <span class="at-dropdown-artist">{{ sample.artist }}</span>
              </div>
            </div>
            <div class="at-dropdown-divider" />
            <div class="at-dropdown-hint">
              以上为内置示例，点击即可加载
            </div>
          </div>
        </div>

        <!-- Theme toggle -->
        <button class="at-btn" @click="toggleTheme" :title="isDarkTheme ? '切换亮色主题' : '切换暗色主题'">
          <svg v-if="isDarkTheme" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
          <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        </button>
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
      <!-- Sidebar -->
      <div v-if="isLoaded" class="at-sidebar">
        <!-- Tab Library Panel -->
        <template v-if="showTabLibrary">
          <div class="at-sidebar-header">
            🎸 乐谱库
          </div>
          <div class="at-tab-library">
            <input
              v-model="tabSearchInput"
              class="at-search-input"
              placeholder="搜索乐谱..."
              @input="handleSearch"
            >
            <div v-if="tabsStore.isLoading" class="at-loading-sm">
              <div class="at-spinner-sm" />
            </div>
            <div v-else class="at-saved-tabs">
              <div
                v-for="tab in tabsStore.tabs"
                :key="tab.id"
                class="at-saved-tab"
                :class="{ active: tabsStore.currentTab?.id === tab.id }"
                @click="loadTabFromLibrary(tab)"
              >
                <div class="at-saved-tab-name">
                  <span class="at-saved-tab-title">{{ tab.name || 'Untitled' }}</span>
                  <span v-if="tab.songName" class="at-saved-tab-artist">{{ tab.songName }}</span>
                </div>
                <span class="at-saved-tab-type">{{ tab.fileType }}</span>
              </div>
              <div v-if="tabsStore.tabs.length === 0" class="at-empty-hint">
                暂无已保存的乐谱<br>上传 GP 文件即可自动保存
              </div>
            </div>
          </div>
        </template>

        <!-- Track List Panel -->
        <template v-else>
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
        </template>
      </div>

      <!-- Metadata Info Panel (shown above tracks when GP parsed) -->
      <div v-if="isLoaded && gpMetadata && showTabLibrary === false" class="at-meta-panel">
        <div class="at-meta-row">
          <span class="at-meta-label">BPM</span>
          <span class="at-meta-value">{{ tempo || '—' }}</span>
        </div>
        <div class="at-meta-row">
          <span class="at-meta-label">音轨</span>
          <span class="at-meta-value">{{ trackCount }}</span>
        </div>
        <div class="at-meta-row">
          <span class="at-meta-label">调弦</span>
          <span class="at-meta-value">{{ selectedTrackTuning || '—' }}</span>
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
        <!-- Empty state hint -->
        <div v-if="!isLoaded && !isLoading && !loadError" class="at-empty-overlay">
          <div class="at-empty-icon">🎸</div>
          <span class="at-empty-text">打开 GP 文件或拖放到此处开始演奏</span>
          <span class="at-empty-hint">支持 .gp3 .gp4 .gp5 .gpx .gp 格式</span>
        </div>
        <!-- Error overlay -->
        <div v-if="loadError" class="at-error-overlay">
          <div class="at-error-icon">❌</div>
          <span>{{ loadError }}</span>
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
  background: var(--at-bg, var(--ep-bg-container, #1a1a2e));
  color: var(--at-text, var(--ep-text-color-primary, #e0e0e0));
  overflow: hidden;
  position: relative;
}

/* Top Toolbar */
.at-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  background: var(--at-surface, var(--ep-fill-color-blank, #2a2a3e));
  border-bottom: 1px solid var(--at-border, var(--ep-border-color-light, #3a3a4e));
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

.at-error {
  color: #f56c6c;
  font-weight: 500;
}

/* Buttons */
.at-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: 1px solid var(--at-border, var(--ep-border-color-light, #3a3a4e));
  border-radius: 4px;
  background: var(--at-surface, var(--ep-fill-color-blank, #2a2a3e));
  color: var(--at-text, var(--ep-text-color-regular, #c0c0d0));
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
  transition: all 0.15s;
}

.at-btn:hover {
  background: var(--at-border, var(--ep-fill-color-light, #3a3a4e));
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

/* Dropdown */
.at-dropdown {
  position: relative;
}

.at-dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  min-width: 200px;
  background: var(--at-surface, var(--ep-fill-color-blank, #2a2a3e));
  border: 1px solid var(--at-border, var(--ep-border-color-light, #3a3a4e));
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 1000;
  padding: 4px 0;
}

.at-dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.at-dropdown-item:hover {
  background: var(--at-border, rgba(255, 255, 255, 0.08));
}

.at-dropdown-emoji {
  font-size: 18px;
  flex-shrink: 0;
}

.at-dropdown-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.at-dropdown-name {
  font-weight: 500;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.at-dropdown-artist {
  font-size: 11px;
  color: var(--at-text-secondary, var(--ep-text-color-secondary, #a0a0b0));
}

.at-dropdown-divider {
  height: 1px;
  background: var(--at-border, var(--ep-border-color-light, #3a3a4e));
  margin: 4px 0;
}

.at-dropdown-hint {
  padding: 8px 12px;
  font-size: 11px;
  color: var(--at-text-secondary, var(--ep-text-color-secondary, #a0a0b0));
  line-height: 1.5;
  text-align: center;
}

.at-dropdown-link {
  color: var(--ep-color-primary, #409eff);
  text-decoration: none;
}

.at-dropdown-link:hover {
  text-decoration: underline;
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
  width: 220px;
  background: var(--at-surface, var(--ep-fill-color-blank, #2a2a3e));
  border-right: 1px solid var(--at-border, var(--ep-border-color-light, #3a3a4e));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;
}

.at-sidebar-header {
  padding: 8px 12px;
  font-weight: 600;
  font-size: 13px;
  border-bottom: 1px solid var(--at-border, var(--ep-border-color-light, #3a3a4e));
  flex-shrink: 0;
}

/* Tab Library */
.at-tab-library {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.at-search-input {
  margin: 6px 8px;
  padding: 5px 8px;
  border: 1px solid var(--ep-border-color-light, #3a3a4e);
  border-radius: 4px;
  background: var(--ep-fill-color, #1e1e30);
  color: var(--ep-text-color-regular, #c0c0d0);
  font-size: 12px;
  outline: none;
}

.at-search-input:focus {
  border-color: var(--ep-color-primary, #409eff);
}

.at-saved-tabs {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.at-saved-tab {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  cursor: pointer;
  transition: background 0.15s;
  font-size: 12px;
  gap: 6px;
}

.at-saved-tab:hover {
  background: rgba(255, 255, 255, 0.05);
}

.at-saved-tab.active {
  background: rgba(64, 158, 255, 0.15);
  border-left: 3px solid var(--ep-color-primary, #409eff);
}

.at-saved-tab-name {
  flex: 1;
  overflow: hidden;
  min-width: 0;
}

.at-saved-tab-title {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}

.at-saved-tab-artist {
  display: block;
  color: var(--ep-text-color-secondary, #a0a0b0);
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.at-saved-tab-type {
  color: var(--ep-text-color-secondary, #a0a0b0);
  font-size: 10px;
  text-transform: uppercase;
  flex-shrink: 0;
}

.at-empty-hint {
  padding: 16px 12px;
  text-align: center;
  color: var(--ep-text-color-secondary, #a0a0b0);
  font-size: 12px;
  line-height: 1.5;
}

.at-loading-sm {
  display: flex;
  justify-content: center;
  padding: 12px;
}

.at-spinner-sm {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.15);
  border-top-color: var(--ep-color-primary, #409eff);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

/* Metadata Panel */
.at-meta-panel {
  width: 220px;
  background: var(--at-surface, var(--ep-fill-color-blank, #2a2a3e));
  border-right: 1px solid var(--at-border, var(--ep-border-color-light, #3a3a4e));
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
}

.at-meta-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.at-meta-label {
  color: var(--ep-text-color-secondary, #a0a0b0);
}

.at-meta-value {
  font-weight: 600;
  font-family: monospace;
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

/* Empty state overlay */
.at-empty-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  z-index: 50;
  color: var(--ep-text-color-secondary, #a0a0b0);
}

.at-empty-icon {
  font-size: 64px;
  opacity: 0.5;
}

.at-empty-text {
  font-size: 16px;
  font-weight: 500;
}

.at-empty-hint {
  font-size: 12px;
  opacity: 0.7;
}

/* Error overlay */
.at-error-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(245, 108, 108, 0.08);
  gap: 8px;
  z-index: 100;
  color: #f56c6c;
  font-size: 14px;
}

.at-error-icon {
  font-size: 48px;
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
  background: var(--at-surface, var(--ep-fill-color-blank, #2a2a3e));
  border-top: 1px solid var(--at-border, var(--ep-border-color-light, #3a3a4e));
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
