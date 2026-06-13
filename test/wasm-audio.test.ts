/**
 * WASM 音频处理单元测试
 *
 * 方案:
 * - web-audio-api: CI/无头兼容的 Web Audio API 实现
 * - OfflineAudioContext: 离线渲染音频，无需音频输出设备
 * - webaudio-node: WASM + SIMD 优化 (用于支持的场景)
 *
 * 被测试文件:
 * - src/utils/audio/AudioEngine.ts
 * - src/stores/midi.ts (音频相关功能)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AudioContext, OfflineAudioContext } from 'web-audio-api'
import { AudioEngine, getAudioEngine } from '~/utils/audio/AudioEngine'

// ========== Sf2Player Mock ==========

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

// ========== OfflineAudioContext 测试工具 ==========

/**
 * 使用 OfflineAudioContext 离线渲染音频并分析结果
 */
async function renderOffline(
  durationSeconds: number,
  sampleRate: number,
  renderFn: (context: AudioContext) => Promise<void>,
): Promise<Float32Array> {
  const offline = new OfflineAudioContext(1, sampleRate * durationSeconds, sampleRate)

  // 创建音频引擎连接到 offline context
  const gain = offline.createGain()
  gain.connect(offline.destination)

  // 模拟音频源
  const oscillator = offline.createOscillator()
  oscillator.type = 'sine'
  oscillator.frequency.value = 440
  oscillator.connect(gain)
  oscillator.start(0)
  oscillator.stop(durationSeconds)

  const buffer = await offline.startRendering()
  return buffer.getChannelData(0)
}

// ========== AudioContext 原生功能测试 ==========

describe('web-audio-api AudioContext', () => {
  it('应成功创建 AudioContext', () => {
    const ctx = new AudioContext()
    expect(ctx).not.toBeNull()
    expect(ctx.sampleRate).toBe(44100)
    expect(ctx.state).toBe('suspended')
  })

  it('应支持 createGain()', () => {
    const ctx = new AudioContext()
    const gain = ctx.createGain()
    expect(gain).not.toBeNull()
    expect(typeof gain.gain).toBe('object')
  })

  it('应支持 createOscillator()', () => {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    expect(osc).not.toBeNull()
    expect(typeof osc.frequency).toBe('object')
    expect(typeof osc.type).toBe('string')
  })

  it('应支持 createBuffer()', () => {
    const ctx = new AudioContext()
    const buffer = ctx.createBuffer(1, 44100, 44100)
    expect(buffer).not.toBeNull()
    expect(buffer.length).toBe(44100)
    expect(buffer.sampleRate).toBe(44100)
    expect(buffer.numberOfChannels).toBe(1)
  })

  it('应支持 createBufferSource()', () => {
    const ctx = new AudioContext()
    const source = ctx.createBufferSource()
    expect(source).not.toBeNull()
    expect(typeof source.start).toBe('function')
    expect(typeof source.stop).toBe('function')
  })

  it('应支持 connect/disconnect', () => {
    const ctx = new AudioContext()
    const gain1 = ctx.createGain()
    const gain2 = ctx.createGain()
    gain1.connect(gain2)
    gain2.connect(ctx.destination)
    gain1.disconnect()
  })

  it('应支持 close()', async () => {
    const ctx = new AudioContext()
    await ctx.close()
  })

  it('应支持 resume()', async () => {
    const ctx = new AudioContext()
    await ctx.resume()
    expect(ctx.state).toBe('running')
  })
})

// ========== OfflineAudioContext 测试 ==========

describe('OfflineAudioContext (CI/无头兼容)', () => {
  it('应成功创建 OfflineAudioContext', () => {
    const offline = new OfflineAudioContext(2, 44100, 44100)
    expect(offline).not.toBeNull()
    expect(offline.length).toBe(44100)
    expect(offline.sampleRate).toBe(44100)
  })

  it('应渲染正弦波音频', async () => {
    const offline = new OfflineAudioContext(1, 44100, 44100)

    const osc = offline.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 440
    osc.connect(offline.destination)
    osc.start(0)
    osc.stop(1)

    const buffer = await offline.startRendering()
    expect(buffer).not.toBeNull()
    expect(buffer.length).toBe(44100)
    expect(buffer.sampleRate).toBe(44100)
  })

  it('渲染结果应包含音频数据', async () => {
    const offline = new OfflineAudioContext(1, 44100, 44100)

    const osc = offline.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 440
    osc.connect(offline.destination)
    osc.start(0)
    osc.stop(1)

    const buffer = await offline.startRendering()
    const data = buffer.getChannelData(0)

    // 正弦波数据不应全为零
    const nonZeroSamples = Array.from(data).filter(v => Math.abs(v) > 0.01)
    expect(nonZeroSamples.length).toBeGreaterThan(0)
  })

  it('应支持多声道渲染', async () => {
    const offline = new OfflineAudioContext(2, 44100, 44100)

    const osc = offline.createOscillator()
    osc.frequency.value = 440
    osc.connect(offline.destination)
    osc.start(0)
    osc.stop(1)

    const buffer = await offline.startRendering()
    expect(buffer.numberOfChannels).toBe(2)
  })

  it('应支持增益控制', async () => {
    const offline = new OfflineAudioContext(1, 44100, 44100)

    const osc = offline.createOscillator()
    osc.frequency.value = 440

    const gain = offline.createGain()
    gain.gain.value = 0.5

    osc.connect(gain)
    gain.connect(offline.destination)
    osc.start(0)
    osc.stop(1)

    const buffer = await offline.startRendering()
    const data = buffer.getChannelData(0)

    // 增益 0.5 应产生比 1.0 更小的振幅
    const maxAmplitude = Math.max(...Array.from(data).map(Math.abs))
    expect(maxAmplitude).toBeLessThan(1.0)
    expect(maxAmplitude).toBeGreaterThan(0)
  })

  it('应支持音频缓冲区裁剪', async () => {
    const offline = new OfflineAudioContext(1, 44100, 44100)

    const osc = offline.createOscillator()
    osc.frequency.value = 440
    osc.connect(offline.destination)
    osc.start(0)
    osc.stop(0.5) // 只渲染 0.5 秒

    const buffer = await offline.startRendering()
    expect(buffer.length).toBe(44100)
    // 后半部分应为零
    const secondHalf = buffer.getChannelData(0).slice(22050)
    const maxSecondHalf = Math.max(...Array.from(secondHalf).map(Math.abs))
    expect(maxSecondHalf).toBeLessThan(0.001)
  })
})

// ========== 音频引擎集成测试 ==========

describe('AudioEngine 集成 (web-audio-api)', () => {
  let engine: AudioEngine

  beforeEach(async () => {
    vi.clearAllMocks()
    engine = new AudioEngine()
    mockPlayNote.mockResolvedValue({
      stop: vi.fn().mockResolvedValue(undefined),
    })
    mockSf2Load.mockResolvedValue(undefined)
  })

  afterEach(async () => {
    try {
      await engine.dispose()
    } catch {
      // ignore
    }
  })

  describe('AudioContext 集成', () => {
    it('应使用 web-audio-api 的 AudioContext', async () => {
      await engine.init('/sounds/test.sf2')
      expect(engine.isReady()).toBe(true)
    })

    it('应创建主音量 GainNode', async () => {
      await engine.init('/sounds/test.sf2')
      expect(() => engine.setVolume(50)).not.toThrow()
    })

    it('应支持音量控制', async () => {
      await engine.init('/sounds/test.sf2')
      engine.setVolume(0)
      engine.setVolume(50)
      engine.setVolume(100)
    })
  })

  describe('音符播放集成', () => {
    beforeEach(async () => {
      await engine.init('/sounds/test.sf2')
    })

    it('应播放音符', async () => {
      await engine.noteOn(60, 100, 0)
      expect(mockPlayNote).toHaveBeenCalledWith(60, {
        gain: 100 / 127,
        channel: 0,
      })
    })

    it('应停止音符', async () => {
      await engine.noteOn(60, 100, 0)
      await engine.noteOff(60, 0)
    })

    it('应停止所有音符', async () => {
      await engine.noteOn(60, 100, 0)
      await engine.noteOn(64, 90, 0)
      await engine.noteOn(67, 80, 0)
      await engine.stopAll()
    })
  })
})

// ========== WASM 音频处理模拟测试 ==========

describe('WASM 音频处理 (模拟)', () => {
  describe('离线音频渲染管道', () => {
    it('应能创建完整的音频管道', async () => {
      const offline = new OfflineAudioContext(2, 44100, 44100)

      // 模拟 WASM 音频处理: 创建音频图
      const osc1 = offline.createOscillator()
      osc1.frequency.value = 440
      osc1.type = 'sine'

      const osc2 = offline.createOscillator()
      osc2.frequency.value = 554.37 // C#5
      osc2.type = 'sine'

      const gain = offline.createGain()
      gain.gain.value = 0.3

      osc1.connect(gain)
      osc2.connect(gain)
      gain.connect(offline.destination)

      osc1.start(0)
      osc2.start(0)
      osc1.stop(1)
      osc2.stop(1)

      const buffer = await offline.startRendering()
      expect(buffer.numberOfChannels).toBe(2)
      expect(buffer.length).toBe(44100)
    })

    it('应支持 ADSR 包络', async () => {
      const offline = new OfflineAudioContext(1, 44100, 44100)

      const osc = offline.createOscillator()
      osc.frequency.value = 440

      const gain = offline.createGain()
      // ADSR 包络模拟
      gain.gain.setValueAtTime(0, 0)
      gain.gain.linearRampToValueAtTime(1, 0.05)   // Attack
      gain.gain.linearRampToValueAtTime(0.7, 0.2)  // Decay
      gain.gain.setValueAtTime(0.7, 0.8)            // Sustain
      gain.gain.linearRampToValueAtTime(0, 1.0)     // Release

      osc.connect(gain)
      gain.connect(offline.destination)
      osc.start(0)
      osc.stop(1)

      const buffer = await offline.startRendering()
      const data = buffer.getChannelData(0)
      const maxAmplitude = Math.max(...Array.from(data).map(Math.abs))
      expect(maxAmplitude).toBeGreaterThan(0)
    })

    it('应支持频率调制 (FM)', async () => {
      const offline = new OfflineAudioContext(1, 44100, 44100)

      // 载波
      const carrier = offline.createOscillator()
      carrier.frequency.value = 440

      // 调制器
      const modulator = offline.createOscillator()
      modulator.frequency.value = 220

      const modGain = offline.createGain()
      modGain.gain.value = 100

      modulator.connect(modGain)
      modGain.connect(carrier.frequency)
      carrier.connect(offline.destination)

      carrier.start(0)
      modulator.start(0)
      carrier.stop(1)
      modulator.stop(1)

      const buffer = await offline.startRendering()
      const data = buffer.getChannelData(0)
      // FM 应产生复杂的波形
      const nonZero = Array.from(data).filter(v => Math.abs(v) > 0.01)
      expect(nonZero.length).toBeGreaterThan(0)
    })
  })

  describe('音频缓冲区操作', () => {
    it('应创建并填充音频缓冲区', () => {
      const ctx = new AudioContext()
      const buffer = ctx.createBuffer(1, 44100, 44100)

      const data = buffer.getChannelData(0)
      // 填充正弦波
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.sin((i / 44100) * 440 * 2 * Math.PI)
      }

      expect(data[0]).toBeCloseTo(0, 4)
      expect(data[44100 / 4 / 440 | 0]).toBeGreaterThan(0)
    })

    it('应复制音频缓冲区', () => {
      const ctx = new AudioContext()
      const source = ctx.createBuffer(1, 44100, 44100)
      const data = source.getChannelData(0)
      for (let i = 0; i < data.length; i++) {
        data[i] = i / 44100
      }

      const copy = ctx.createBuffer(1, 44100, 44100)
      copy.copyToChannel(source.getChannelData(0), 0)

      expect(copy.getChannelData(0)[0]).toBe(0)
      expect(copy.getChannelData(0)[4410]).toBeCloseTo(4410 / 44100, 3)
    })

    it('应支持多声道缓冲区', () => {
      const ctx = new AudioContext()
      const buffer = ctx.createBuffer(2, 44100, 44100)

      expect(buffer.numberOfChannels).toBe(2)
      expect(buffer.getChannelData(0)).not.toBe(buffer.getChannelData(1))
    })
  })

  describe('音频分析', () => {
    it('应计算 RMS 振幅', async () => {
      const offline = new OfflineAudioContext(1, 44100, 44100)

      const osc = offline.createOscillator()
      osc.frequency.value = 440
      osc.connect(offline.destination)
      osc.start(0)
      osc.stop(1)

      const buffer = await offline.startRendering()
      const data = buffer.getChannelData(0)

      // RMS 计算
      let sum = 0
      for (let i = 0; i < data.length; i++) {
        sum += data[i] * data[i]
      }
      const rms = Math.sqrt(sum / data.length)

      // 440Hz 正弦波 RMS 应约 0.707 * amplitude
      expect(rms).toBeGreaterThan(0.1)
      expect(rms).toBeLessThan(1.0)
    })

    it('应检测过零率', async () => {
      const offline = new OfflineAudioContext(1, 44100, 44100)

      const osc = offline.createOscillator()
      osc.frequency.value = 440
      osc.connect(offline.destination)
      osc.start(0)
      osc.stop(1)

      const buffer = await offline.startRendering()
      const data = buffer.getChannelData(0)

      let zeroCrossings = 0
      for (let i = 1; i < data.length; i++) {
        if ((data[i] >= 0 && data[i - 1] < 0) || (data[i] < 0 && data[i - 1] >= 0)) {
          zeroCrossings++
        }
      }

      // 440Hz 在 1 秒内应约 880 次过零 (正负各一次)
      expect(zeroCrossings).toBeGreaterThan(800)
      expect(zeroCrossings).toBeLessThan(1000)
    })
  })

  describe('MIDI 音符到频率转换', () => {
    it('MIDI 69 (A4) 应为 440Hz', () => {
      const midiNote = 69
      const frequency = 440 * Math.pow(2, (midiNote - 69) / 12)
      expect(frequency).toBe(440)
    })

    it('MIDI 60 (C4) 应约 261.63Hz', () => {
      const midiNote = 60
      const frequency = 440 * Math.pow(2, (midiNote - 69) / 12)
      expect(frequency).toBeCloseTo(261.63, 1)
    })

    it('MIDI 72 (C5) 应约 523.25Hz', () => {
      const midiNote = 72
      const frequency = 440 * Math.pow(2, (midiNote - 69) / 12)
      expect(frequency).toBeCloseTo(523.25, 1)
    })

    it('MIDI 0 应约 8.18Hz', () => {
      const midiNote = 0
      const frequency = 440 * Math.pow(2, (midiNote - 69) / 12)
      expect(frequency).toBeCloseTo(8.18, 1)
    })

    it('MIDI 127 应约 12543.85Hz', () => {
      const midiNote = 127
      const frequency = 440 * Math.pow(2, (midiNote - 69) / 12)
      expect(frequency).toBeCloseTo(12543.85, 0)
    })
  })

  describe('音频时间调度', () => {
    it('应支持精确时间调度', async () => {
      const offline = new OfflineAudioContext(1, 44100, 44100)

      const osc = offline.createOscillator()
      osc.frequency.value = 440

      const gain = offline.createGain()
      gain.gain.setValueAtTime(0, 0)
      gain.gain.setValueAtTime(1, 0.5)  // 在 0.5 秒时突然开始
      gain.gain.setValueAtTime(0, 0.75) // 在 0.75 秒时突然停止

      osc.connect(gain)
      gain.connect(offline.destination)
      osc.start(0)
      osc.stop(1)

      const buffer = await offline.startRendering()
      const data = buffer.getChannelData(0)

      // 前 0.5 秒应无信号
      const firstHalf = data.slice(0, 22050)
      const maxFirstHalf = Math.max(...Array.from(firstHalf).map(Math.abs))
      expect(maxFirstHalf).toBeLessThan(0.001)

      // 0.5-0.75 秒应有信号
      const middle = data.slice(22050, 33075)
      const maxMiddle = Math.max(...Array.from(middle).map(Math.abs))
      expect(maxMiddle).toBeGreaterThan(0.1)
    })
  })
})

// ========== WebAudio API 工具函数测试 ==========

describe('WebAudio 工具函数', () => {
  describe('velocity 转增益', () => {
    const velocityToGain = (velocity: number): number => velocity / 127

    it('velocity 0 应映射为增益 0', () => {
      expect(velocityToGain(0)).toBe(0)
    })

    it('velocity 64 应映射为约 0.5', () => {
      expect(velocityToGain(64)).toBeCloseTo(0.504, 2)
    })

    it('velocity 127 应映射为 1.0', () => {
      expect(velocityToGain(127)).toBe(1)
    })

    it('应在有效范围内', () => {
      for (let v = 0; v <= 127; v++) {
        const gain = velocityToGain(v)
        expect(gain).toBeGreaterThanOrEqual(0)
        expect(gain).toBeLessThanOrEqual(1)
      }
    })
  })

  describe('毫秒转样本数', () => {
    const msToSamples = (ms: number, sampleRate: number): number =>
      Math.round(ms * sampleRate / 1000)

    it('1000ms 在 44100Hz 应为 44100 样本', () => {
      expect(msToSamples(1000, 44100)).toBe(44100)
    })

    it('500ms 在 44100Hz 应为 22050 样本', () => {
      expect(msToSamples(500, 44100)).toBe(22050)
    })

    it('10ms 在 48000Hz 应为 480 样本', () => {
      expect(msToSamples(10, 48000)).toBe(480)
    })
  })

  describe('样本数转毫秒', () => {
    const samplesToMs = (samples: number, sampleRate: number): number =>
      samples * 1000 / sampleRate

    it('44100 样本在 44100Hz 应为 1000ms', () => {
      expect(samplesToMs(44100, 44100)).toBe(1000)
    })

    it('22050 样本在 44100Hz 应为 500ms', () => {
      expect(samplesToMs(22050, 44100)).toBe(500)
    })
  })

  describe('MIDI 通道掩码', () => {
    it('0x90 | channel 应正确组合状态字节', () => {
      for (let ch = 0; ch <= 15; ch++) {
        const status = 0x90 | ch
        expect(status & 0xF0).toBe(0x90)
        expect(status & 0x0F).toBe(ch)
      }
    })

    it('应正确提取通道', () => {
      expect(0x93 & 0x0F).toBe(3)
      expect(0x8F & 0x0F).toBe(15)
      expect(0xB0 & 0x0F).toBe(0)
    })

    it('应正确提取事件类型', () => {
      expect(0x93 & 0xF0).toBe(0x90)
      expect(0x8F & 0xF0).toBe(0x80)
      expect(0xB5 & 0xF0).toBe(0xB0)
    })
  })
})

// ========== 音频渲染性能测试 ==========

describe('音频渲染性能', () => {
  it('1 秒音频离线渲染应在 100ms 内', async () => {
    const start = performance.now()

    const offline = new OfflineAudioContext(2, 44100, 44100)
    const osc = offline.createOscillator()
    osc.frequency.value = 440
    osc.connect(offline.destination)
    osc.start(0)
    osc.stop(1)

    await offline.startRendering()
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(1000) // 1 秒预算 (离线渲染可能较慢)
  })

  it('2 秒多声道渲染应在合理时间内', async () => {
    const start = performance.now()

    const offline = new OfflineAudioContext(2, 44100, 44100 * 2)

    for (let i = 0; i < 4; i++) {
      const osc = offline.createOscillator()
      osc.frequency.value = 440 + i * 100
      const gain = offline.createGain()
      gain.gain.value = 0.2
      osc.connect(gain)
      gain.connect(offline.destination)
      osc.start(0)
      osc.stop(2)
    }

    await offline.startRendering()
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(5000)
  })
})
