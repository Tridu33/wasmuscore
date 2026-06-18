import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'
import { getAudioEngine } from '~/utils/audio/AudioEngine'

// Type definitions (shared across components)
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

  function reset() {
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

    // Getters
    formatTime,

    // Actions
    reset,
    initAudio,
    setVolume,
  }
})
