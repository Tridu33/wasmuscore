import { Sf2Player } from 'sf2-player'

export interface ActiveVoice {
  note: number
  channel: number
  voice: any
}

export class AudioEngine {
  private context: AudioContext | null = null
  private sf2Player: Sf2Player | null = null
  private activeVoices: Map<string, ActiveVoice> = new Map()
  private masterGain: GainNode | null = null
  private isInitialized = false
  private isLoading = false
  private loadProgress = 0

  /**
   * 初始化音频引擎
   * @param sf2Url SoundFont2 文件 URL
   */
  async init(sf2Url: string): Promise<void> {
    if (this.isInitialized) {
      return
    }

    try {
      this.isLoading = true
      this.loadProgress = 0

      // 创建 AudioContext
      this.context = new AudioContext()

      // 创建主音量节点
      this.masterGain = this.context.createGain()
      this.masterGain.connect(this.context.destination)
      this.masterGain.gain.value = 0.8

      // 加载进度回调
      const onProgress = (progress: number) => {
        this.loadProgress = progress * 100
      }

      // 初始化 SF2 Player
      this.sf2Player = new Sf2Player(sf2Url, {
        audioContext: this.context,
        destination: this.masterGain,
        onProgress,
      })

      await this.sf2Player.load()

      this.isInitialized = true
      this.isLoading = false
    }
    catch (error) {
      this.isLoading = false
      console.error('Failed to initialize AudioEngine:', error)
      throw error
    }
  }

  /**
   * 播放音符
   */
  async noteOn(note: number, velocity: number, channel: number = 0): Promise<void> {
    if (!this.isInitialized || !this.sf2Player) {
      console.warn('AudioEngine not initialized')
      return
    }

    // 如果该音符已经在播放，先停止
    const key = `${note}-${channel}`
    if (this.activeVoices.has(key)) {
      await this.noteOff(note, channel)
    }

    try {
      // 将 velocity (0-127) 转换为音量 (0-1)
      const volume = velocity / 127

      // 播放音符
      const voice = await this.sf2Player.playNote(note, {
        gain: volume,
        channel,
      })

      this.activeVoices.set(key, {
        note,
        channel,
        voice,
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
      // 停止音符（带释放时间）
      await voiceData.voice.stop(0.1)
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
   * 设置主音量
   */
  setVolume(volume: number): void {
    if (this.masterGain) {
      // volume: 0-100
      this.masterGain.gain.value = volume / 100
    }
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
    if (this.context && this.context.state === 'suspended') {
      await this.context.resume()
    }
  }

  /**
   * 销毁音频引擎
   */
  async dispose(): Promise<void> {
    await this.stopAll()

    if (this.sf2Player) {
      this.sf2Player.destroy()
      this.sf2Player = null
    }

    if (this.context) {
      await this.context.close()
      this.context = null
    }

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
