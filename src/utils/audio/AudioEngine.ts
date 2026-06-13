import sf2synth from '@logue/sf2synth'

const { WebMidiLink } = sf2synth

// MIDI status bytes
const NOTE_ON = 0x90
const NOTE_OFF = 0x80

export interface ActiveVoice {
  note: number
  velocity: number
  channel: number
}

export class AudioEngine {
  private wml: InstanceType<typeof WebMidiLink> | null = null
  private activeVoices: Map<string, ActiveVoice> = new Map()
  private isInitialized = false
  private isLoading = false
  private loadProgress = 0
  private initPromise: Promise<void> | null = null

  /**
   * 初始化音频引擎
   * @param sf2Url SoundFont2 文件 URL
   */
  async init(sf2Url: string): Promise<void> {
    // Prevent concurrent init calls
    if (this.initPromise) {
      return this.initPromise
    }

    this.initPromise = this.doInit(sf2Url)
    return this.initPromise
  }

  private async doInit(sf2Url: string): Promise<void> {
    if (this.isInitialized) {
      return
    }

    try {
      this.isLoading = true
      this.loadProgress = 0

      // Polyfill caches API if unavailable (sf2synth calls caches.open internally)
      if (typeof window.caches === 'undefined') {
        (window as any).caches = {
          open: () => Promise.resolve({
            add: () => Promise.resolve(),
            put: () => Promise.resolve(),
            match: () => Promise.resolve(undefined),
            delete: () => Promise.resolve(false),
            keys: () => Promise.resolve([]),
          }),
          has: () => Promise.resolve(false),
          delete: () => Promise.resolve(false),
          match: () => Promise.resolve(undefined),
        }
      }

      // Ensure AudioContext can be created (user gesture may be required)
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) {
        throw new Error('Web Audio API is not supported in this browser')
      }

      // Create WebMidiLink instance with drawSynth disabled
      this.wml = new WebMidiLink({
        drawSynth: false,
        cache: false,
      })

      // Set load callback
      this.wml.setLoadCallback((buffer: Uint8Array) => {
        console.log('[AudioEngine] SoundFont buffer loaded, size:', buffer.length, 'bytes')
        this.loadProgress = 100
        this.isLoading = false
        this.isInitialized = true
      })

      // Load the SF2 file - wrap in try/catch for sf2synth internal errors
      console.log('[AudioEngine] Loading SoundFont from:', sf2Url)
      await this.wml.setup(sf2Url)

      // Mark initialized even if setup returns before callback fires
      if (this.loadProgress < 100) {
        this.loadProgress = 100
        this.isLoading = false
        this.isInitialized = true
      }
      console.log('[AudioEngine] SoundFont setup complete')
    }
    catch (error) {
      this.isLoading = false
      console.error('[AudioEngine] Failed to initialize AudioEngine:', error)
      if (error instanceof Error) {
        console.error('[AudioEngine] Error name:', error.name)
        console.error('[AudioEngine] Error message:', error.message)
        console.error('[AudioEngine] Error stack:', error.stack)
      }
      throw error
    }
    finally {
      this.initPromise = null
    }
  }

  /**
   * 播放音符
   */
  async noteOn(note: number, velocity: number, channel: number = 0): Promise<void> {
    if (!this.isInitialized || !this.wml) {
      console.warn('AudioEngine not initialized')
      return
    }

    // If this note is already playing, stop it first
    const key = `${note}-${channel}`
    if (this.activeVoices.has(key)) {
      await this.noteOff(note, channel)
    }

    try {
      // Note On MIDI message: [0x90 | channel, note, velocity]
      this.wml.processMidiMessage([NOTE_ON | channel, note, velocity])

      this.activeVoices.set(key, {
        note,
        velocity,
        channel,
      })
    }
    catch (error) {
      console.error(`Failed to play note ${note}:`, error)
    }
  }

  /**
   * 停止音符
   */
  async noteOff(note: number, channel: number = 0): Promise<void> {
    const key = `${note}-${channel}`
    const voiceData = this.activeVoices.get(key)

    if (!voiceData) {
      return
    }

    try {
      // Note Off MIDI message: [0x80 | channel, note, velocity]
      this.wml!.processMidiMessage([NOTE_OFF | channel, note, voiceData.velocity])
      this.activeVoices.delete(key)
    }
    catch (error) {
      console.error(`Failed to stop note ${note}:`, error)
      this.activeVoices.delete(key)
    }
  }

  /**
   * 停止所有音符
   */
  async stopAll(): Promise<void> {
    const promises = Array.from(this.activeVoices.keys()).map(async (key) => {
      const [note, channel] = key.split('-').map(Number)
      await this.noteOff(note, channel)
    })

    await Promise.all(promises)
    this.activeVoices.clear()
  }

  /**
   * 获取加载进度
   */
  getLoadProgress(): number {
    return this.loadProgress
  }

  /**
   * 是否已初始化
   */
  isReady(): boolean {
    return this.isInitialized
  }

  /**
   * 是否正在加载
   */
  isLoadingState(): boolean {
    return this.isLoading
  }

  /**
   * 恢复 AudioContext（浏览器自动播放策略）
   */
  async resume(): Promise<void> {
    // @logue/sf2synth manages its own AudioContext
    // No-op for compatibility
  }

  /**
   * 设置主音量
   */
  setVolume(volume: number): void {
    // Volume is controlled per-note via velocity
    // This is a no-op placeholder for compatibility
  }

  /**
   * 销毁音频引擎
   */
  async dispose(): Promise<void> {
    await this.stopAll()
    this.wml = null
    this.isInitialized = false
  }
}

// 单例实例
let audioEngineInstance: AudioEngine | null = null

export function getAudioEngine(): AudioEngine {
  if (!audioEngineInstance) {
    audioEngineInstance = new AudioEngine()
  }
  return audioEngineInstance
}
