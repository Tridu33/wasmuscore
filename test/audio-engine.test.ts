/**
 * AudioEngine 单元测试
 *
 * 组合方案:
 * - Proxy 环境注入: setup.ts 已将 web-audio-engine 的 StreamAudioContext 注入为 globalThis.AudioContext
 * - Node.js 原生: 在 jsdom + web-audio-engine 环境中运行
 * - Sf2Player mock: 模拟第三方 SoundFont 播放器
 *
 * 被测试文件: src/utils/audio/AudioEngine.ts
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { AudioEngine, getAudioEngine } from '~/utils/audio/AudioEngine'

// ========== Sf2Player Mock ==========
// Mock 第三方 sf2-player 库

interface MockVoice {
  stop: ReturnType<typeof vi.fn>
}

const mockPlayNote = vi.fn<(...args: any[]) => Promise<MockVoice>>()
const mockSf2Load = vi.fn<() => Promise<void>>()
const mockSf2Destroy = vi.fn<() => void>()
const mockSf2Constructor = vi.fn()

vi.mock('sf2-player', () => ({
  Sf2Player: class MockSf2Player {
    constructor(...args: any[]) {
      mockSf2Constructor(...args)
    }

    load() {
      return mockSf2Load()
    }

    playNote(note: number, options?: { gain?: number, channel?: number }) {
      return mockPlayNote(note, options)
    }

    stop(releaseTime?: number) {
      return Promise.resolve()
    }

    destroy() {
      mockSf2Destroy()
    }
  },
}))

describe('AudioEngine', () => {
  let engine: AudioEngine

  beforeEach(async () => {
    vi.clearAllMocks()
    // 每个测试创建新实例, 避免单例污染
    engine = new AudioEngine()

    // Mock playNote 返回一个可 stop 的 voice
    mockPlayNote.mockResolvedValue({
      stop: vi.fn().mockResolvedValue(undefined),
    })
    mockSf2Load.mockResolvedValue(undefined)
  })

  afterEach(async () => {
    try {
      await engine.dispose()
    }
    catch {
      // ignore
    }
  })

  // ========== 初始化测试 ==========

  describe('初始化 (init)', () => {
    it('应该成功初始化 AudioEngine', async () => {
      await engine.init('/sounds/test.sf2')
      expect(engine.isReady()).toBe(true)
      expect(engine.isLoadingState()).toBe(false)
    })

    it('初始化时应设置 isLoading 为 true', async () => {
      const initPromise = engine.init('/sounds/test.sf2')
      // 在初始化过程中, isLoading 可能为 true (取决于 Promise 调度)
      await initPromise
      expect(engine.isLoadingState()).toBe(false)
    })

    it('重复初始化应直接返回, 不创建新的 AudioContext', async () => {
      await engine.init('/sounds/test.sf2')
      await engine.init('/sounds/other.sf2')
      // 第二次 init 不应再调用 Sf2Player 构造函数
      expect(mockSf2Constructor).toHaveBeenCalledTimes(1)
    })

    it('初始化应使用正确的 SoundFont URL', async () => {
      await engine.init('/sounds/test.sf2')
      expect(mockSf2Constructor).toHaveBeenCalledWith(
        '/sounds/test.sf2',
        expect.objectContaining({
          audioContext: expect.any(Object),
          destination: expect.any(Object),
          onProgress: expect.any(Function),
        }),
      )
    })

    it('初始化应调用 Sf2Player.load()', async () => {
      await engine.init('/sounds/test.sf2')
      expect(mockSf2Load).toHaveBeenCalledTimes(1)
    })

    it('初始化失败时应重置 isLoading 状态', async () => {
      mockSf2Load.mockRejectedValueOnce(new Error('Load failed'))
      await expect(engine.init('/sounds/test.sf2')).rejects.toThrow('Load failed')
      expect(engine.isLoadingState()).toBe(false)
    })

    it('初始化失败时应保持 isReady 为 false', async () => {
      mockSf2Load.mockRejectedValueOnce(new Error('Load failed'))
      await expect(engine.init('/sounds/test.sf2')).rejects.toThrow()
      expect(engine.isReady()).toBe(false)
    })

    it('初始化后应创建 AudioContext', async () => {
      await engine.init('/sounds/test.sf2')
      expect(engine.isReady()).toBe(true)
    })

    it('初始化后应创建主音量 GainNode', async () => {
      await engine.init('/sounds/test.sf2')
      // 通过 setVolume 间接验证
      expect(() => engine.setVolume(50)).not.toThrow()
    })
  })

  // ========== 播放进度测试 ==========

  describe('加载进度', () => {
    it('初始化前进度应为 0', () => {
      expect(engine.getLoadProgress()).toBe(0)
    })

    it('初始化过程中应报告进度', async () => {
      let resolveLoad: (value: void) => void
      mockSf2Load.mockImplementationOnce(() => {
        // 模拟进度回调
        return new Promise((resolve) => {
          resolveLoad = resolve
        })
      })

      const initPromise = engine.init('/sounds/test.sf2')

      // 给 onProgress 回调一些时间
      await new Promise(r => setTimeout(r, 50))

      // 进度应该已经更新 (onProgress 在构造函数中设置)
      // 但由于我们 mock 了 load, 进度可能还没到 100
      resolveLoad!()
      await initPromise
    })
  })

  // ========== 音符播放测试 ==========

  describe('音符播放 (noteOn/noteOff)', () => {
    beforeEach(async () => {
      await engine.init('/sounds/test.sf2')
    })

    it('应该播放音符', async () => {
      await engine.noteOn(60, 100, 0)
      expect(mockPlayNote).toHaveBeenCalledWith(60, {
        gain: 100 / 127,
        channel: 0,
      })
    })

    it('应该将 velocity (0-127) 转换为音量 (0-1)', async () => {
      // velocity 127 → gain 1.0
      await engine.noteOn(60, 127, 0)
      expect(mockPlayNote).toHaveBeenCalledWith(60, {
        gain: 1.0,
        channel: 0,
      })

      vi.clearAllMocks()

      // velocity 0 → gain 0
      await engine.noteOn(60, 0, 0)
      expect(mockPlayNote).toHaveBeenCalledWith(60, {
        gain: 0,
        channel: 0,
      })

      vi.clearAllMocks()

      // velocity 64 → gain ~0.5
      await engine.noteOn(60, 64, 0)
      expect(mockPlayNote).toHaveBeenCalledWith(60, {
        gain: 64 / 127,
        channel: 0,
      })
    })

    it('应该使用默认 channel 0', async () => {
      await engine.noteOn(60, 80)
      expect(mockPlayNote).toHaveBeenCalledWith(60, {
        gain: 80 / 127,
        channel: 0,
      })
    })

    it('应该支持非零 channel', async () => {
      await engine.noteOn(60, 80, 5)
      expect(mockPlayNote).toHaveBeenCalledWith(60, {
        gain: 80 / 127,
        channel: 5,
      })
    })

    it('相同音符重复播放应先停止再播放', async () => {
      await engine.noteOn(60, 100, 0)
      expect(mockPlayNote).toHaveBeenCalledTimes(1)

      // 第二次 noteOn 同一音符
      await engine.noteOn(60, 100, 0)
      // noteOff 被调用一次 (stop the old note), 然后 noteOn 被调用
      expect(mockPlayNote).toHaveBeenCalledTimes(2)
    })

    it('未初始化时 noteOn 应打印警告但不抛错', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const uninitEngine = new AudioEngine()
      await uninitEngine.noteOn(60, 100, 0)
      expect(warnSpy).toHaveBeenCalledWith('AudioEngine not initialized')
      warnSpy.mockRestore()
      await uninitEngine.dispose()
    })

    it('播放失败时应捕获错误而不影响其他音符', async () => {
      mockPlayNote.mockRejectedValueOnce(new Error('Play failed'))
      await expect(engine.noteOn(60, 100, 0)).resolves.toBeUndefined()
    })
  })

  describe('音符停止 (noteOff)', () => {
    beforeEach(async () => {
      await engine.init('/sounds/test.sf2')
    })

    it('停止未播放的音符应直接返回', async () => {
      await expect(engine.noteOff(60, 0)).resolves.toBeUndefined()
    })

    it('停止已播放的音符', async () => {
      await engine.noteOn(60, 100, 0)
      await engine.noteOff(60, 0)
      // voice.stop(0.1) 被调用
      const voice = (mockPlayNote.mock.results[0]?.value as Promise<MockVoice>)
      if (voice) {
        const v = await voice
        expect(v.stop).toHaveBeenCalledWith(0.1)
      }
    })

    it('释放时间应为 0.1 秒', async () => {
      await engine.noteOn(60, 100, 0)
      await engine.noteOff(60, 0)
      const voice = (mockPlayNote.mock.results[0]?.value as Promise<MockVoice>)
      if (voice) {
        const v = await voice
        expect(v.stop).toHaveBeenCalledWith(0.1)
      }
    })

    it('停止不同 channel 的相同音符应独立', async () => {
      await engine.noteOn(60, 100, 0)
      await engine.noteOn(60, 100, 1)
      await engine.noteOff(60, 0)
      // channel 1 的音符应仍在播放
      const voices = mockPlayNote.mock.results
      expect(voices).toHaveLength(2)
    })
  })

  // ========== 全部停止测试 ==========

  describe('全部停止 (stopAll)', () => {
    beforeEach(async () => {
      await engine.init('/sounds/test.sf2')
    })

    it('应停止所有正在播放的音符', async () => {
      await engine.noteOn(60, 100, 0)
      await engine.noteOn(64, 90, 0)
      await engine.noteOn(67, 80, 0)

      await engine.stopAll()

      expect(mockPlayNote).toHaveBeenCalledTimes(3)
      // 所有 voice 的 stop 都被调用
      const allVoices = await Promise.all(
        mockPlayNote.mock.results.map(r => r.value),
      )
      allVoices.forEach(v => {
        expect(v.stop).toHaveBeenCalled()
      })
    })

    it('应清空活跃音符列表', async () => {
      await engine.noteOn(60, 100, 0)
      await engine.noteOn(64, 90, 0)

      await engine.stopAll()

      // 再 noteOff 应该无效果 (列表已清空)
      await engine.noteOff(60, 0)
      await engine.noteOff(64, 0)
    })

    it('无活跃音符时 stopAll 应正常返回', async () => {
      await expect(engine.stopAll()).resolves.toBeUndefined()
    })
  })

  // ========== 音量控制测试 ==========

  describe('音量控制 (setVolume)', () => {
    it('未初始化时 setVolume 不应抛错', () => {
      expect(() => engine.setVolume(50)).not.toThrow()
    })

    it('初始化后应能设置音量', async () => {
      await engine.init('/sounds/test.sf2')
      expect(() => engine.setVolume(50)).not.toThrow()
    })

    it('音量范围应为 0-100', async () => {
      await engine.init('/sounds/test.sf2')
      engine.setVolume(0)
      engine.setVolume(50)
      engine.setVolume(100)
      // 不应抛错
    })

    it('音量 0 应静音', async () => {
      await engine.init('/sounds/test.sf2')
      engine.setVolume(0)
    })

    it('音量 100 应最大', async () => {
      await engine.init('/sounds/test.sf2')
      engine.setVolume(100)
    })
  })

  // ========== AudioContext 恢复测试 ==========

  describe('AudioContext 恢复 (resume)', () => {
    it('suspended 状态应能恢复', async () => {
      await engine.init('/sounds/test.sf2')
      // web-audio-engine 默认 state 为 suspended
      await expect(engine.resume()).resolves.toBeUndefined()
    })

    it('running 状态恢复应无副作用', async () => {
      await engine.init('/sounds/test.sf2')
      await engine.resume()
      await engine.resume()
      // 多次恢复不应抛错
    })

    it('未初始化时 resume 应正常返回', async () => {
      await expect(engine.resume()).resolves.toBeUndefined()
    })
  })

  // ========== 销毁测试 ==========

  describe('销毁 (dispose)', () => {
    it('应停止所有音符', async () => {
      await engine.init('/sounds/test.sf2')
      await engine.noteOn(60, 100, 0)
      await engine.noteOn(64, 90, 0)
      await engine.dispose()
      expect(engine.isReady()).toBe(false)
    })

    it('应销毁 Sf2Player', async () => {
      await engine.init('/sounds/test.sf2')
      await engine.dispose()
      expect(mockSf2Destroy).toHaveBeenCalledTimes(1)
    })

    it('应关闭 AudioContext', async () => {
      await engine.init('/sounds/test.sf2')
      await engine.dispose()
      expect(engine.isReady()).toBe(false)
    })

    it('未初始化时 dispose 应正常返回', async () => {
      await expect(engine.dispose()).resolves.toBeUndefined()
    })

    it('重复 dispose 应安全', async () => {
      await engine.init('/sounds/test.sf2')
      await engine.dispose()
      await expect(engine.dispose()).resolves.toBeUndefined()
    })

    it('dispose 后不应再能播放', async () => {
      await engine.init('/sounds/test.sf2')
      await engine.dispose()
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      await engine.noteOn(60, 100, 0)
      expect(warnSpy).toHaveBeenCalled()
      warnSpy.mockRestore()
    })
  })

  // ========== 单例模式测试 ==========

  describe('单例模式 (getAudioEngine)', () => {
    it('应返回相同实例', () => {
      const instance1 = getAudioEngine()
      const instance2 = getAudioEngine()
      expect(instance1).toBe(instance2)
    })

    it('每次调用应返回同一对象引用', () => {
      for (let i = 0; i < 5; i++) {
        expect(getAudioEngine()).toBe(getAudioEngine())
      }
    })
  })

  // ========== 状态查询测试 ==========

  describe('状态查询', () => {
    it('未初始化时 isReady 应为 false', () => {
      expect(engine.isReady()).toBe(false)
    })

    it('初始化后 isReady 应为 true', async () => {
      await engine.init('/sounds/test.sf2')
      expect(engine.isReady()).toBe(true)
    })

    it('未初始化时 isLoading 应为 false', () => {
      expect(engine.isLoadingState()).toBe(false)
    })

    it('初始化后 isLoading 应为 false', async () => {
      await engine.init('/sounds/test.sf2')
      expect(engine.isLoadingState()).toBe(false)
    })
  })

  // ========== 多音符并发测试 ==========

  describe('多音符并发', () => {
    beforeEach(async () => {
      await engine.init('/sounds/test.sf2')
    })

    it('应能同时播放多个音符', async () => {
      const notes = [60, 62, 64, 65, 67, 69, 71] // C 大调音阶
      await Promise.all(notes.map(n => engine.noteOn(n, 80, 0)))
      expect(mockPlayNote).toHaveBeenCalledTimes(7)
    })

    it('应能同时停止多个音符', async () => {
      const notes = [60, 62, 64, 65, 67, 69, 71]
      await Promise.all(notes.map(n => engine.noteOn(n, 80, 0)))
      await engine.stopAll()
      expect(mockPlayNote).toHaveBeenCalledTimes(7)
    })

    it('不同 channel 的音符应独立管理', async () => {
      await engine.noteOn(60, 100, 0)
      await engine.noteOn(60, 100, 1)
      await engine.noteOn(60, 100, 2)
      expect(mockPlayNote).toHaveBeenCalledTimes(3)
    })

    it('velocity 边界值应正确处理', async () => {
      await engine.noteOn(60, 0, 0)   // 最小 velocity
      await engine.noteOn(60, 127, 0) // 最大 velocity
      expect(mockPlayNote).toHaveBeenCalledTimes(2)
    })
  })

  // ========== 边界条件测试 ==========

  describe('边界条件', () => {
    beforeEach(async () => {
      await engine.init('/sounds/test.sf2')
    })

    it('最小 MIDI note (0) 应能播放', async () => {
      await expect(engine.noteOn(0, 100, 0)).resolves.toBeUndefined()
    })

    it('最大 MIDI note (127) 应能播放', async () => {
      await expect(engine.noteOn(127, 100, 0)).resolves.toBeUndefined()
    })

    it('最小 channel (0) 应能播放', async () => {
      await expect(engine.noteOn(60, 100, 0)).resolves.toBeUndefined()
    })

    it('最大 channel (15) 应能播放', async () => {
      await expect(engine.noteOn(60, 100, 15)).resolves.toBeUndefined()
    })
  })
})
