import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'
import { getAudioEngine } from '~/utils/audio/AudioEngine'

export interface MidiTrackInfo {
  track_id: number
  color_id: number
  note_count: number
  has_drums: boolean
  programs: number
}

export interface MidiFileInfo {
  name: string
  format: string
  track_count: number
  note_count: number
  duration_ms: number
  tracks: MidiTrackInfo[]
}

export interface MidiNote {
  note: number
  velocity: number
  channel: number
  track_id: number
  track_color_id: number
  start_ms: number
  end_ms: number
  duration_ms: number
}

export interface ActiveNote {
  note: number
  velocity: number
  channel: number
  track_id: number
  track_color_id: number
  timestamp_ms: number
}

export interface PlaybackStatus {
  is_playing: boolean
  is_paused: boolean
  current_time_ms: number
  total_duration_ms: number
  percentage: number
  is_finished: boolean
}

export const useMidiStore = defineStore('midi', () => {
  // State
  const midiFile = ref<MidiFileInfo | null>(null)
  const allNotes = ref<MidiNote[]>([])
  const activeNotes = ref<ActiveNote[]>([])
  const playbackStatus = reactive<PlaybackStatus>({
    is_playing: false,
    is_paused: false,
    current_time_ms: 0,
    total_duration_ms: 0,
    percentage: 0,
    is_finished: false,
  })
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // 音频状态
  const audioLoaded = ref(false)
  const audioLoading = ref(false)
  const audioLoadProgress = ref(0)
  const volume = ref(80)

  // 格式化时间
  function formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // Actions
  async function loadMidiFile(file: File) {
    isLoading.value = true
    error.value = null

    try {
      // 读取文件为字节数组
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)

      // 调用 WASM 模块
      const wasmModule = await import('~/utils/wasmuscore/loader')
      const midiInfo = await wasmModule.loadMidiFromFile(uint8Array)

      midiFile.value = midiInfo as MidiFileInfo

      // 获取所有音符数据
      const notes = await wasmModule.getAllNotes()
      allNotes.value = notes as MidiNote[]

      // 获取初始播放状态
      updatePlaybackStatus()

      return true
    }
    catch (e: any) {
      error.value = e.message || 'Failed to load MIDI file'
      console.error('Error loading MIDI file:', e)
      return false
    }
    finally {
      isLoading.value = false
    }
  }

  async function play() {
    try {
      // 恢复 AudioContext (浏览器自动播放策略)
      const audioEngine = getAudioEngine()
      await audioEngine.resume()

      const wasmModule = await import('~/utils/wasmuscore/loader')
      await wasmModule.play()
      playbackStatus.is_playing = true
      playbackStatus.is_paused = false
    }
    catch (e: any) {
      error.value = e.message
    }
  }

  async function pause() {
    try {
      const wasmModule = await import('~/utils/wasmuscore/loader')
      await wasmModule.pause()
      playbackStatus.is_playing = false
      playbackStatus.is_paused = true
    }
    catch (e: any) {
      error.value = e.message
      console.error('Error pausing:', e)
    }
  }

  async function stop() {
    try {
      const wasmModule = await import('~/utils/wasmuscore/loader')
      await wasmModule.stop()

      // 停止所有音频
      const audioEngine = getAudioEngine()
      await audioEngine.stopAll()

      playbackStatus.is_playing = false
      playbackStatus.is_paused = false
      playbackStatus.current_time_ms = 0
      playbackStatus.percentage = 0
      activeNotes.value = []
    }
    catch (e: any) {
      error.value = e.message
    }
  }

  async function seekTo(milliseconds: number) {
    if (Number.isNaN(milliseconds) || milliseconds < 0) {
      console.warn('[seekTo] Invalid milliseconds value:', milliseconds)
      return
    }

    try {
      const wasmModule = await import('~/utils/wasmuscore/loader')
      await wasmModule.seekTo(milliseconds)
      updatePlaybackStatus()
    }
    catch (e: any) {
      error.value = e.message
      console.error('Error seeking:', e)
    }
  }

  async function updatePlaybackStatus() {
    try {
      const wasmModule = await import('~/utils/wasmuscore/loader')
      const status = await wasmModule.getPlaybackStatus()
      Object.assign(playbackStatus, status)
    }
    catch (e: any) {
      console.error('Error updating playback status:', e)
    }
  }

  async function updateActiveNotes(deltaMs: number = 16) {
    try {
      const wasmModule = await import('~/utils/wasmuscore/loader')
      const notes = await wasmModule.getActiveNotes(deltaMs)
      const newNotes = notes as ActiveNote[]

      // 处理音频播放
      const audioEngine = getAudioEngine()
      if (audioEngine.isReady()) {
        // 停止不在新列表中的音符
        for (const oldNote of activeNotes.value) {
          const stillActive = newNotes.some(
            n => n.note === oldNote.note && n.channel === oldNote.channel,
          )
          if (!stillActive) {
            await audioEngine.noteOff(oldNote.note, oldNote.channel)
          }
        }

        // 播放新的音符
        for (const note of newNotes) {
          const wasActive = activeNotes.value.some(
            n => n.note === note.note && n.channel === note.channel,
          )
          if (!wasActive) {
            await audioEngine.noteOn(note.note, note.velocity, note.channel)
          }
        }
      }

      activeNotes.value = newNotes
    }
    catch {
      // Silently handle errors
    }
  }

  function reset() {
    // 停止所有音频
    const audioEngine = getAudioEngine()
    if (audioEngine.isReady()) {
      audioEngine.stopAll()
    }

    midiFile.value = null
    allNotes.value = []
    activeNotes.value = []
    Object.assign(playbackStatus, {
      is_playing: false,
      is_paused: false,
      current_time_ms: 0,
      total_duration_ms: 0,
      percentage: 0,
      is_finished: false,
    })
    isLoading.value = false
    error.value = null
  }

  // 初始化音频引擎
  async function initAudio() {
    if (audioLoaded.value || audioLoading.value) {
      return
    }

    audioLoading.value = true
    try {
      const audioEngine = getAudioEngine()
      await audioEngine.init('/sounds/default.sf2')
      audioLoaded.value = true
      audioLoadProgress.value = 100
    }
    catch (e: any) {
      error.value = `Failed to load audio: ${e.message}`
    }
    finally {
      audioLoading.value = false
    }
  }

  // 设置音量
  function setVolume(newVolume: number) {
    volume.value = newVolume
    const audioEngine = getAudioEngine()
    audioEngine.setVolume(newVolume)
  }

  return {
    // State
    midiFile,
    allNotes,
    activeNotes,
    playbackStatus,
    isLoading,
    error,
    audioLoaded,
    audioLoading,
    audioLoadProgress,
    volume,

    // Getters (computed)
    formatTime,

    // Actions
    loadMidiFile,
    play,
    pause,
    stop,
    seekTo,
    updatePlaybackStatus,
    updateActiveNotes,
    reset,
    initAudio,
    setVolume,
  }
})
