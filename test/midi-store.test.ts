/**
 * MidiStore (Pinia) 单元测试
 *
 * 组合方案:
 * - Proxy 注入: setup.ts 提供 AudioContext
 * - WASM loader mock: 拦截 loader.js 及其依赖的 WASM 模块
 * - AudioEngine mock: 模拟 getAudioEngine 返回的对象
 * - Pinia 隔离测试: createPinia() + setActivePinia()
 *
 * 被测试文件: src/stores/midi.ts
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// ========== Mock WASM 模块 (实际 WASM 二进制文件的 JS wrapper) ==========
// loader.js 导入的是 wasm_rust/pkg/wasmusicorelectron.js, 这个模块会 fetch WASM
// 使用 resolve.alias 匹配的路径格式

vi.mock('/root/src/wascore/wasm_rust/pkg/wasmusicorelectron.js', () => ({
  default: vi.fn().mockResolvedValue({
    load_midi_from_bytes: vi.fn().mockResolvedValue({
      name: 'test.mid',
      format: 'MIDI Format 1',
      track_count: 1,
      note_count: 1,
      duration_ms: 1000,
      tracks: [],
    }),
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    seek_to: vi.fn().mockResolvedValue(undefined),
    get_playback_status: vi.fn().mockResolvedValue({
      is_playing: false,
      is_paused: false,
      current_time_ms: 0,
      total_duration_ms: 0,
      percentage: 0,
      is_finished: false,
    }),
    get_active_notes: vi.fn().mockResolvedValue([]),
    get_all_notes: vi.fn().mockResolvedValue([]),
    add: vi.fn().mockResolvedValue(3),
  }),
}))

// ========== Mock WASM Loader (上层封装) ==========
// 使用与 vite.config.ts 中 resolve.alias 一致的别名路径

const mockLoadMidiFromFile = vi.fn().mockResolvedValue({
  name: 'test.mid',
  format: 'MIDI Format 1',
  track_count: 1,
  note_count: 1,
  duration_ms: 1000,
  tracks: [],
})
const mockGetAllNotes = vi.fn().mockResolvedValue([])
const mockPlay = vi.fn().mockResolvedValue(undefined)
const mockPause = vi.fn().mockResolvedValue(undefined)
const mockStop = vi.fn().mockResolvedValue(undefined)
const mockSeekTo = vi.fn().mockResolvedValue(undefined)
const mockGetPlaybackStatus = vi.fn().mockResolvedValue({
  is_playing: false,
  is_paused: false,
  current_time_ms: 0,
  total_duration_ms: 0,
  percentage: 0,
  is_finished: false,
})
const mockGetActiveNotes = vi.fn().mockResolvedValue([])

// 同时用 alias 和绝对路径 mock, 确保动态 import 被拦截
vi.mock('/root/src/wasmuscore/src/utils/wasmuscore/loader', () => ({
  loadMidiFromFile: (...args: any[]) => mockLoadMidiFromFile(...args),
  getAllNotes: () => mockGetAllNotes(),
  play: () => mockPlay(),
  pause: () => mockPause(),
  stop: () => mockStop(),
  seekTo: (...args: any[]) => mockSeekTo(...args),
  getPlaybackStatus: () => mockGetPlaybackStatus(),
  getActiveNotes: (...args: any[]) => mockGetActiveNotes(...args),
}))

vi.mock('~/utils/wasmuscore/loader', () => ({
  loadMidiFromFile: (...args: any[]) => mockLoadMidiFromFile(...args),
  getAllNotes: () => mockGetAllNotes(),
  play: () => mockPlay(),
  pause: () => mockPause(),
  stop: () => mockStop(),
  seekTo: (...args: any[]) => mockSeekTo(...args),
  getPlaybackStatus: () => mockGetPlaybackStatus(),
  getActiveNotes: (...args: any[]) => mockGetActiveNotes(...args),
}))

// ========== Mock AudioEngine ==========

const mockAudioEngine = {
  init: vi.fn().mockResolvedValue(undefined),
  resume: vi.fn().mockResolvedValue(undefined),
  noteOn: vi.fn().mockResolvedValue(undefined),
  noteOff: vi.fn().mockResolvedValue(undefined),
  stopAll: vi.fn().mockResolvedValue(undefined),
  setVolume: vi.fn(),
  isReady: vi.fn().mockReturnValue(false),
  isLoadingState: vi.fn().mockReturnValue(false),
  getLoadProgress: vi.fn().mockReturnValue(0),
  dispose: vi.fn().mockResolvedValue(undefined),
}

vi.mock('~/utils/audio/AudioEngine', () => ({
  getAudioEngine: () => mockAudioEngine,
}))

// ========== 在 mock 之后导入 store ==========
import { useMidiStore } from '~/stores/midi'

describe('MidiStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // 重置所有 mock 的默认返回值
    mockLoadMidiFromFile.mockResolvedValue({
      name: 'test.mid',
      format: 'MIDI Format 1',
      track_count: 1,
      note_count: 1,
      duration_ms: 1000,
      tracks: [],
    })
    mockGetAllNotes.mockResolvedValue([])
    mockPlay.mockResolvedValue(undefined)
    mockPause.mockResolvedValue(undefined)
    mockStop.mockResolvedValue(undefined)
    mockSeekTo.mockResolvedValue(undefined)
    mockGetPlaybackStatus.mockResolvedValue({
      is_playing: false,
      is_paused: false,
      current_time_ms: 0,
      total_duration_ms: 0,
      percentage: 0,
      is_finished: false,
    })
    mockGetActiveNotes.mockResolvedValue([])
    mockAudioEngine.isReady.mockReturnValue(false)

    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ========== 初始状态测试 ==========

  describe('初始状态', () => {
    it('midiFile 应为 null', () => {
      const store = useMidiStore()
      expect(store.midiFile).toBeNull()
    })

    it('allNotes 应为空数组', () => {
      const store = useMidiStore()
      expect(store.allNotes).toEqual([])
    })

    it('activeNotes 应为空数组', () => {
      const store = useMidiStore()
      expect(store.activeNotes).toEqual([])
    })

    it('playbackStatus 应为初始值', () => {
      const store = useMidiStore()
      expect(store.playbackStatus.is_playing).toBe(false)
      expect(store.playbackStatus.is_paused).toBe(false)
      expect(store.playbackStatus.current_time_ms).toBe(0)
      expect(store.playbackStatus.total_duration_ms).toBe(0)
      expect(store.playbackStatus.percentage).toBe(0)
      expect(store.playbackStatus.is_finished).toBe(false)
    })

    it('isLoading 应为 false', () => {
      const store = useMidiStore()
      expect(store.isLoading).toBe(false)
    })

    it('error 应为 null', () => {
      const store = useMidiStore()
      expect(store.error).toBeNull()
    })

    it('audioLoaded 应为 false', () => {
      const store = useMidiStore()
      expect(store.audioLoaded).toBe(false)
    })

    it('audioLoading 应为 false', () => {
      const store = useMidiStore()
      expect(store.audioLoading).toBe(false)
    })

    it('volume 默认应为 80', () => {
      const store = useMidiStore()
      expect(store.volume).toBe(80)
    })
  })

  // ========== formatTime 测试 ==========

  describe('formatTime', () => {
    it('0ms 应格式化为 "0:00"', () => {
      const store = useMidiStore()
      expect(store.formatTime(0)).toBe('0:00')
    })

    it('1000ms 应格式化为 "0:01"', () => {
      const store = useMidiStore()
      expect(store.formatTime(1000)).toBe('0:01')
    })

    it('60000ms 应格式化为 "1:00"', () => {
      const store = useMidiStore()
      expect(store.formatTime(60000)).toBe('1:00')
    })

    it('61500ms 应格式化为 "1:01"', () => {
      const store = useMidiStore()
      expect(store.formatTime(61500)).toBe('1:01')
    })

    it('125000ms 应格式化为 "2:05"', () => {
      const store = useMidiStore()
      expect(store.formatTime(125000)).toBe('2:05')
    })

    it('秒数应补前导零', () => {
      const store = useMidiStore()
      expect(store.formatTime(65000)).toBe('1:05')
    })
  })

  // ========== loadMidiFile 测试 ==========

  describe('loadMidiFile', () => {
    it('加载成功应返回 true', async () => {
      const store = useMidiStore()
      const mockFile = new File([''], 'test.mid', { type: 'audio/midi' })
      mockFile.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(0))

      const result = await store.loadMidiFile(mockFile)
      expect(result).toBe(true)
    })

    it('加载成功应设置 midiFile', async () => {
      const store = useMidiStore()
      const mockFile = new File([''], 'test.mid', { type: 'audio/midi' })
      mockFile.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(0))

      await store.loadMidiFile(mockFile)
      expect(store.midiFile).not.toBeNull()
      expect(store.midiFile!.name).toBe('test.mid')
      expect(store.midiFile!.track_count).toBe(1)
    })

    it('加载成功应设置 allNotes', async () => {
      const store = useMidiStore()
      const mockFile = new File([''], 'test.mid', { type: 'audio/midi' })
      mockFile.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(0))

      const mockNotes = [
        { note: 60, velocity: 80, channel: 0, track_id: 0, track_color_id: 0, start_ms: 0, end_ms: 500, duration_ms: 500 },
        { note: 64, velocity: 90, channel: 0, track_id: 0, track_color_id: 0, start_ms: 500, end_ms: 1000, duration_ms: 500 },
      ]
      mockGetAllNotes.mockResolvedValue(mockNotes)

      await store.loadMidiFile(mockFile)
      expect(store.allNotes).toHaveLength(2)
      expect(store.allNotes[0].note).toBe(60)
      expect(store.allNotes[1].note).toBe(64)
    })

    it('加载失败应返回 false', async () => {
      const store = useMidiStore()
      const mockFile = new File([''], 'test.mid', { type: 'audio/midi' })
      mockFile.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(0))
      mockLoadMidiFromFile.mockRejectedValueOnce(new Error('Invalid MIDI file'))

      const result = await store.loadMidiFile(mockFile)
      expect(result).toBe(false)
    })

    it('加载失败应设置 error 信息', async () => {
      const store = useMidiStore()
      const mockFile = new File([''], 'test.mid', { type: 'audio/midi' })
      mockFile.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(0))
      mockLoadMidiFromFile.mockRejectedValueOnce(new Error('Invalid MIDI file'))

      await store.loadMidiFile(mockFile)
      expect(store.error).toContain('Invalid MIDI file')
    })

    it('加载中时应设置 isLoading 为 true', async () => {
      const store = useMidiStore()
      const mockFile = new File([''], 'test.mid', { type: 'audio/midi' })
      mockFile.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(0))

      // 使用 never-resolving promise 让 isLoading 保持 true
      mockLoadMidiFromFile.mockImplementationOnce(() => new Promise(() => {}))

      const loadingPromise = store.loadMidiFile(mockFile)
      // 给 Vue 响应式更新一些时间
      await new Promise(r => setTimeout(r, 10))
      expect(store.isLoading).toBe(true)
    })

    it('加载完成后 playbackStatus 应有 total_duration_ms', async () => {
      const store = useMidiStore()
      const mockFile = new File([''], 'test.mid', { type: 'audio/midi' })
      mockFile.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(0))

      await store.loadMidiFile(mockFile)
      // loadMidiFile 内部调用 updatePlaybackStatus, 更新 playbackStatus
      expect(store.playbackStatus.total_duration_ms).toBeGreaterThanOrEqual(0)
    })

    it('加载失败不应调用 getPlaybackStatus', async () => {
      const store = useMidiStore()
      const mockFile = new File([''], 'test.mid', { type: 'audio/midi' })
      mockFile.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(0))
      mockLoadMidiFromFile.mockRejectedValueOnce(new Error('Invalid'))

      await store.loadMidiFile(mockFile)
      expect(mockGetPlaybackStatus).not.toHaveBeenCalled()
    })
  })

  // ========== play 测试 ==========

  describe('play', () => {
    it('播放应调用 WASM play()', async () => {
      const store = useMidiStore()
      await store.play()
      expect(mockPlay).toHaveBeenCalledTimes(1)
    })

    it('播放应设置 is_playing 为 true', async () => {
      const store = useMidiStore()
      await store.play()
      expect(store.playbackStatus.is_playing).toBe(true)
    })

    it('播放应设置 is_paused 为 false', async () => {
      const store = useMidiStore()
      store.playbackStatus.is_paused = true
      await store.play()
      expect(store.playbackStatus.is_paused).toBe(false)
    })

    it('播放应调用 audioEngine.resume()', async () => {
      const store = useMidiStore()
      await store.play()
      expect(mockAudioEngine.resume).toHaveBeenCalled()
    })

    it('播放失败应设置 error', async () => {
      const store = useMidiStore()
      mockPlay.mockRejectedValueOnce(new Error('Playback error'))
      await store.play()
      expect(store.error).toBe('Playback error')
    })
  })

  // ========== pause 测试 ==========

  describe('pause', () => {
    it('暂停应调用 WASM pause()', async () => {
      const store = useMidiStore()
      await store.pause()
      expect(mockPause).toHaveBeenCalledTimes(1)
    })

    it('暂停应设置 is_playing 为 false', async () => {
      const store = useMidiStore()
      store.playbackStatus.is_playing = true
      await store.pause()
      expect(store.playbackStatus.is_playing).toBe(false)
    })

    it('暂停应设置 is_paused 为 true', async () => {
      const store = useMidiStore()
      await store.pause()
      expect(store.playbackStatus.is_paused).toBe(true)
    })

    it('暂停失败应设置 error', async () => {
      const store = useMidiStore()
      mockPause.mockRejectedValueOnce(new Error('Pause error'))
      await store.pause()
      expect(store.error).toBe('Pause error')
    })
  })

  // ========== stop 测试 ==========

  describe('stop', () => {
    it('停止应调用 WASM stop()', async () => {
      const store = useMidiStore()
      await store.stop()
      expect(mockStop).toHaveBeenCalledTimes(1)
    })

    it('停止应调用 audioEngine.stopAll()', async () => {
      const store = useMidiStore()
      mockAudioEngine.isReady.mockReturnValue(true)
      await store.stop()
      expect(mockAudioEngine.stopAll).toHaveBeenCalled()
    })

    it('停止应重置播放状态', async () => {
      const store = useMidiStore()
      store.playbackStatus.is_playing = true
      store.playbackStatus.current_time_ms = 5000
      store.playbackStatus.percentage = 50
      await store.stop()
      expect(store.playbackStatus.is_playing).toBe(false)
      expect(store.playbackStatus.current_time_ms).toBe(0)
      expect(store.playbackStatus.percentage).toBe(0)
    })

    it('停止应清空 activeNotes', async () => {
      const store = useMidiStore()
      store.activeNotes = [
        { note: 60, velocity: 80, channel: 0, track_id: 0, track_color_id: 0, timestamp_ms: 0 },
      ]
      await store.stop()
      expect(store.activeNotes).toEqual([])
    })
  })

  // ========== seekTo 测试 ==========

  describe('seekTo', () => {
    it('seekTo 应调用 WASM seekTo()', async () => {
      const store = useMidiStore()
      await store.seekTo(5000)
      expect(mockSeekTo).toHaveBeenCalledWith(5000)
    })

    it('seekTo 后 playbackStatus 应有更新', async () => {
      const store = useMidiStore()
      await store.seekTo(5000)
      // seekTo 内部调用 updatePlaybackStatus
      expect(store.playbackStatus.current_time_ms).toBeGreaterThanOrEqual(0)
    })

    it('seekTo 失败应设置 error', async () => {
      const store = useMidiStore()
      mockSeekTo.mockRejectedValueOnce(new Error('Seek error'))
      await store.seekTo(5000)
      expect(store.error).toBe('Seek error')
    })
  })

  // ========== updateActiveNotes 测试 ==========

  describe('updateActiveNotes', () => {
    it('应调用 WASM getActiveNotes()', async () => {
      const store = useMidiStore()
      await store.updateActiveNotes(16)
      expect(mockGetActiveNotes).toHaveBeenCalledWith(16)
    })

    it('应更新 activeNotes', async () => {
      const store = useMidiStore()
      const mockActiveNotes = [
        { note: 60, velocity: 80, channel: 0, track_id: 0, track_color_id: 0, timestamp_ms: 0 },
        { note: 64, velocity: 90, channel: 0, track_id: 0, track_color_id: 0, timestamp_ms: 0 },
      ]
      mockGetActiveNotes.mockResolvedValue(mockActiveNotes)

      await store.updateActiveNotes(16)
      expect(store.activeNotes).toHaveLength(2)
    })

    it('audioEngine 就绪时应调用 noteOn 播放新音符', async () => {
      const store = useMidiStore()
      mockAudioEngine.isReady.mockReturnValue(true)
      mockGetActiveNotes.mockResolvedValue([
        { note: 60, velocity: 80, channel: 0, track_id: 0, track_color_id: 0, timestamp_ms: 0 },
      ])

      await store.updateActiveNotes(16)
      expect(mockAudioEngine.noteOn).toHaveBeenCalledWith(60, 80, 0)
    })

    it('audioEngine 就绪时应调用 noteOff 停止已结束的音符', async () => {
      const store = useMidiStore()
      mockAudioEngine.isReady.mockReturnValue(true)

      // 先设置一个活跃音符
      store.activeNotes = [
        { note: 60, velocity: 80, channel: 0, track_id: 0, track_color_id: 0, timestamp_ms: 0 },
        { note: 64, velocity: 90, channel: 0, track_id: 0, track_color_id: 0, timestamp_ms: 0 },
      ]

      // 新的活跃音符只有 60
      mockGetActiveNotes.mockResolvedValue([
        { note: 60, velocity: 80, channel: 0, track_id: 0, track_color_id: 0, timestamp_ms: 16 },
      ])

      await store.updateActiveNotes(16)
      // note 64 应被停止
      expect(mockAudioEngine.noteOff).toHaveBeenCalledWith(64, 0)
      // note 60 不应被停止 (仍然活跃)
      expect(mockAudioEngine.noteOff).not.toHaveBeenCalledWith(60, 0)
    })

    it('audioEngine 未就绪时不应调用 noteOn/noteOff', async () => {
      const store = useMidiStore()
      mockAudioEngine.isReady.mockReturnValue(false)
      mockGetActiveNotes.mockResolvedValue([
        { note: 60, velocity: 80, channel: 0, track_id: 0, track_color_id: 0, timestamp_ms: 0 },
      ])

      await store.updateActiveNotes(16)
      expect(mockAudioEngine.noteOn).not.toHaveBeenCalled()
      expect(mockAudioEngine.noteOff).not.toHaveBeenCalled()
    })
  })

  // ========== updatePlaybackStatus 测试 ==========

  describe('updatePlaybackStatus', () => {
    it('应调用 WASM getPlaybackStatus()', async () => {
      const store = useMidiStore()
      await store.updatePlaybackStatus()
      expect(mockGetPlaybackStatus).toHaveBeenCalled()
    })

    it('应更新 playbackStatus', async () => {
      const store = useMidiStore()
      mockGetPlaybackStatus.mockResolvedValue({
        is_playing: true,
        is_paused: false,
        current_time_ms: 5000,
        total_duration_ms: 10000,
        percentage: 50,
        is_finished: false,
      })

      await store.updatePlaybackStatus()
      expect(store.playbackStatus.is_playing).toBe(true)
      expect(store.playbackStatus.current_time_ms).toBe(5000)
      expect(store.playbackStatus.percentage).toBe(50)
    })
  })

  // ========== reset 测试 ==========

  describe('reset', () => {
    it('应重置所有状态', () => {
      const store = useMidiStore()
      // 先设置一些状态
      store.midiFile = { name: 'test.mid', format: '', track_count: 1, note_count: 0, duration_ms: 0, tracks: [] }
      store.allNotes = [{ note: 60, velocity: 80, channel: 0, track_id: 0, track_color_id: 0, start_ms: 0, end_ms: 500, duration_ms: 500 }]
      store.activeNotes = [{ note: 60, velocity: 80, channel: 0, track_id: 0, track_color_id: 0, timestamp_ms: 0 }]
      store.playbackStatus.is_playing = true
      store.playbackStatus.current_time_ms = 5000
      store.error = 'Some error'
      store.isLoading = true

      store.reset()

      expect(store.midiFile).toBeNull()
      expect(store.allNotes).toEqual([])
      expect(store.activeNotes).toEqual([])
      expect(store.playbackStatus.is_playing).toBe(false)
      expect(store.playbackStatus.current_time_ms).toBe(0)
      expect(store.error).toBeNull()
      expect(store.isLoading).toBe(false)
    })

    it('audioEngine 就绪时应调用 stopAll', () => {
      const store = useMidiStore()
      mockAudioEngine.isReady.mockReturnValue(true)
      store.reset()
      expect(mockAudioEngine.stopAll).toHaveBeenCalled()
    })

    it('audioEngine 未就绪时不应调用 stopAll', () => {
      const store = useMidiStore()
      mockAudioEngine.isReady.mockReturnValue(false)
      store.reset()
      expect(mockAudioEngine.stopAll).not.toHaveBeenCalled()
    })
  })

  // ========== initAudio 测试 ==========

  describe('initAudio', () => {
    it('初始化成功应设置 audioLoaded 为 true', async () => {
      const store = useMidiStore()
      await store.initAudio()
      expect(store.audioLoaded).toBe(true)
    })

    it('初始化中应设置 audioLoading 为 true', async () => {
      const store = useMidiStore()
      mockAudioEngine.init.mockImplementationOnce(() => new Promise(() => {}))

      store.initAudio()
      await new Promise(r => setTimeout(r, 10))
      expect(store.audioLoading).toBe(true)
    })

    it('重复初始化应被阻止 (audioLoaded 时)', async () => {
      const store = useMidiStore()
      store.audioLoaded = true
      await store.initAudio()
      expect(mockAudioEngine.init).not.toHaveBeenCalled()
    })

    it('重复初始化应被阻止 (audioLoading 时)', async () => {
      const store = useMidiStore()
      store.audioLoading = true
      await store.initAudio()
      expect(mockAudioEngine.init).not.toHaveBeenCalled()
    })

    it('初始化失败应设置 error', async () => {
      const store = useMidiStore()
      mockAudioEngine.init.mockRejectedValueOnce(new Error('Load failed'))
      await store.initAudio()
      expect(store.error).toContain('Load failed')
    })

    it('初始化失败后 audioLoaded 应为 false', async () => {
      const store = useMidiStore()
      mockAudioEngine.init.mockRejectedValueOnce(new Error('Load failed'))
      await store.initAudio()
      expect(store.audioLoaded).toBe(false)
    })

    it('初始化失败后 audioLoading 应重置为 false', async () => {
      const store = useMidiStore()
      mockAudioEngine.init.mockRejectedValueOnce(new Error('Load failed'))
      await store.initAudio()
      expect(store.audioLoading).toBe(false)
    })
  })

  // ========== setVolume 测试 ==========

  describe('setVolume', () => {
    it('应更新 store.volume', () => {
      const store = useMidiStore()
      store.setVolume(50)
      expect(store.volume).toBe(50)
    })

    it('应调用 audioEngine.setVolume()', () => {
      const store = useMidiStore()
      store.setVolume(50)
      expect(mockAudioEngine.setVolume).toHaveBeenCalledWith(50)
    })

    it('应支持音量 0', () => {
      const store = useMidiStore()
      store.setVolume(0)
      expect(store.volume).toBe(0)
    })

    it('应支持音量 100', () => {
      const store = useMidiStore()
      store.setVolume(100)
      expect(store.volume).toBe(100)
    })
  })

  // ========== 完整播放流程测试 ==========

  describe('完整播放流程', () => {
    it('加载 → 播放 → 暂停 → 停止 状态转换应正确', async () => {
      const store = useMidiStore()
      const mockFile = new File([''], 'test.mid', { type: 'audio/midi' })
      mockFile.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(0))

      // 1. Load
      await store.loadMidiFile(mockFile)
      expect(store.midiFile).not.toBeNull()

      // 2. Play
      await store.play()
      expect(store.playbackStatus.is_playing).toBe(true)

      // 3. Pause
      await store.pause()
      expect(store.playbackStatus.is_paused).toBe(true)

      // 4. Stop
      await store.stop()
      expect(store.playbackStatus.is_playing).toBe(false)
      expect(store.playbackStatus.current_time_ms).toBe(0)
    })
  })
})
