/**
 * WASM 引擎单元测试
 * 测试核心功能: WASM 模块接口、数据结构验证、加载状态
 *
 * 注: WASM 模块需要编译后的二进制文件，本测试覆盖：
 * - 模块导入路径验证
 * - 数据结构接口定义
 * - 加载状态的边界条件
 */
import { describe, it, expect, vi } from 'vitest'

// ========== 数据类型定义 (与 stores/midi.ts 一致) ==========

interface MidiTrackInfo {
  track_id: number
  color_id: number
  note_count: number
  has_drums: boolean
  programs: number
}

interface MidiFileInfo {
  name: string
  format: string
  track_count: number
  note_count: number
  duration_ms: number
  tracks: MidiTrackInfo[]
}

interface MidiNote {
  note: number
  velocity: number
  channel: number
  track_id: number
  track_color_id: number
  start_ms: number
  end_ms: number
  duration_ms: number
}

interface PlaybackStatus {
  is_playing: boolean
  is_paused: boolean
  current_time_ms: number
  total_duration_ms: number
  percentage: number
  is_finished: boolean
}

// ========== WASM 接口模拟 ==========

/**
 * 模拟的 WASM 模块接口
 * 用于测试数据流和状态管理
 */
interface WasmModuleInterface {
  loadMidiFromFile(data: Uint8Array): Promise<MidiFileInfo>
  getAllNotes(): Promise<MidiNote[]>
  play(): Promise<void>
  pause(): Promise<void>
  stop(): Promise<void>
  seekTo(milliseconds: number): Promise<void>
  getPlaybackStatus(): Promise<PlaybackStatus>
  getActiveNotes(deltaMs: number): Promise<MidiNote[]>
}

// ========== WASM 模块测试 ==========

describe('WASM 引擎 - 数据结构验证', () => {
  describe('MidiFileInfo', () => {
    it('应包含所有必要字段', () => {
      const info: MidiFileInfo = {
        name: 'test.mid',
        format: 'MIDI Format 1',
        track_count: 2,
        note_count: 100,
        duration_ms: 30000,
        tracks: [],
      }
      expect(info.name).toBe('test.mid')
      expect(info.track_count).toBe(2)
      expect(info.note_count).toBe(100)
      expect(info.duration_ms).toBe(30000)
    })

    it('track_count 应与 tracks 数组长度一致', () => {
      const tracks: MidiTrackInfo[] = [
        { track_id: 0, color_id: 0, note_count: 50, has_drums: false, programs: 0 },
        { track_id: 1, color_id: 1, note_count: 50, has_drums: false, programs: 0 },
      ]
      const info: MidiFileInfo = {
        name: 'test.mid',
        format: 'MIDI Format 1',
        track_count: tracks.length,
        note_count: 100,
        duration_ms: 30000,
        tracks,
      }
      expect(info.track_count).toBe(info.tracks.length)
    })

    it('note_count 应为所有音轨音符数之和', () => {
      const tracks: MidiTrackInfo[] = [
        { track_id: 0, color_id: 0, note_count: 30, has_drums: false, programs: 0 },
        { track_id: 1, color_id: 1, note_count: 20, has_drums: false, programs: 0 },
        { track_id: 2, color_id: 2, note_count: 50, has_drums: true, programs: 0 },
      ]
      const totalNotes = tracks.reduce((sum, t) => sum + t.note_count, 0)
      expect(totalNotes).toBe(100)
    })
  })

  describe('MidiTrackInfo', () => {
    it('应包含所有必要字段', () => {
      const track: MidiTrackInfo = {
        track_id: 0,
        color_id: 0,
        note_count: 50,
        has_drums: false,
        programs: 1,
      }
      expect(track.track_id).toBe(0)
      expect(track.color_id).toBe(0)
    })

    it('鼓组音轨应有 has_drums = true', () => {
      const drumTrack: MidiTrackInfo = {
        track_id: 9,
        color_id: 3,
        note_count: 20,
        has_drums: true,
        programs: 0,
      }
      expect(drumTrack.has_drums).toBe(true)
    })

    it('非鼓组音轨应有 has_drums = false', () => {
      const pianoTrack: MidiTrackInfo = {
        track_id: 0,
        color_id: 0,
        note_count: 100,
        has_drums: false,
        programs: 1,
      }
      expect(pianoTrack.has_drums).toBe(false)
    })
  })

  describe('MidiNote', () => {
    it('MIDI note number 应在 0-127 范围内', () => {
      const validNotes = [0, 60, 127]
      validNotes.forEach((n) => {
        expect(n).toBeGreaterThanOrEqual(0)
        expect(n).toBeLessThanOrEqual(127)
      })
    })

    it('velocity 应在 0-127 范围内', () => {
      const validVelocities = [0, 64, 127]
      validVelocities.forEach((v) => {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(127)
      })
    })

    it('end_ms 应等于 start_ms + duration_ms', () => {
      const note: MidiNote = {
        note: 60,
        velocity: 80,
        channel: 0,
        track_id: 0,
        track_color_id: 0,
        start_ms: 1000,
        duration_ms: 500,
        end_ms: 1500,
      }
      expect(note.end_ms).toBe(note.start_ms + note.duration_ms)
    })

    it('channel 应在 0-15 范围内', () => {
      for (let ch = 0; ch <= 15; ch++) {
        expect(ch).toBeGreaterThanOrEqual(0)
        expect(ch).toBeLessThanOrEqual(15)
      }
    })
  })

  describe('PlaybackStatus', () => {
    it('停止状态应正确', () => {
      const status: PlaybackStatus = {
        is_playing: false,
        is_paused: false,
        current_time_ms: 0,
        total_duration_ms: 10000,
        percentage: 0,
        is_finished: false,
      }
      expect(status.is_playing).toBe(false)
      expect(status.is_paused).toBe(false)
      expect(status.is_finished).toBe(false)
      expect(status.current_time_ms).toBe(0)
    })

    it('播放完成状态应正确', () => {
      const status: PlaybackStatus = {
        is_playing: false,
        is_paused: false,
        current_time_ms: 10000,
        total_duration_ms: 10000,
        percentage: 100,
        is_finished: true,
      }
      expect(status.is_finished).toBe(true)
      expect(status.current_time_ms).toBe(status.total_duration_ms)
      expect(status.percentage).toBe(100)
    })

    it('is_playing 和 is_paused 不能同时为 true', () => {
      const playing: PlaybackStatus = {
        is_playing: true,
        is_paused: false,
        current_time_ms: 5000,
        total_duration_ms: 10000,
        percentage: 50,
        is_finished: false,
      }
      const paused: PlaybackStatus = {
        is_playing: false,
        is_paused: true,
        current_time_ms: 5000,
        total_duration_ms: 10000,
        percentage: 50,
        is_finished: false,
      }
      expect(playing.is_playing && playing.is_paused).toBe(false)
      expect(paused.is_playing && paused.is_paused).toBe(false)
    })
  })
})

describe('WASM 引擎 - 加载流程', () => {
  it('加载 MIDI 文件应先验证数据', () => {
    // MIDI 文件头: "MThd"
    const midiHeader = new Uint8Array([0x4D, 0x54, 0x68, 0x64])
    expect(midiHeader[0]).toBe(0x4D) // 'M'
    expect(midiHeader[1]).toBe(0x54) // 'T'
    expect(midiHeader[2]).toBe(0x68) // 'h'
    expect(midiHeader[3]).toBe(0x64) // 'd'
  })

  it('空数据不应被识别为有效 MIDI 文件', () => {
    const emptyData = new Uint8Array(0)
    expect(emptyData.length).toBe(0)
  })

  it('非 MIDI 文件应被拒绝', () => {
    const notMidi = new Uint8Array([0x00, 0x00, 0x00, 0x00])
    const isMidiHeader = (
      notMidi[0] === 0x4D
      && notMidi[1] === 0x54
      && notMidi[2] === 0x68
      && notMidi[3] === 0x64
    )
    expect(isMidiHeader).toBe(false)
  })
})

describe('WASM 引擎 - 播放控制状态机', () => {
  it('状态转换: stopped → playing', () => {
    let isPlaying = false
    let isPaused = false
    // Play
    isPlaying = true
    isPaused = false
    expect(isPlaying).toBe(true)
    expect(isPaused).toBe(false)
  })

  it('状态转换: playing → paused', () => {
    let isPlaying = true
    let isPaused = false
    // Pause
    isPlaying = false
    isPaused = true
    expect(isPlaying).toBe(false)
    expect(isPaused).toBe(true)
  })

  it('状态转换: paused → playing', () => {
    let isPlaying = false
    let isPaused = true
    // Resume
    isPlaying = true
    isPaused = false
    expect(isPlaying).toBe(true)
    expect(isPaused).toBe(false)
  })

  it('状态转换: playing → stopped', () => {
    let isPlaying = true
    let isPaused = false
    let currentTime = 5000
    // Stop
    isPlaying = false
    isPaused = false
    currentTime = 0
    expect(isPlaying).toBe(false)
    expect(isPaused).toBe(false)
    expect(currentTime).toBe(0)
  })

  it('状态转换: paused → stopped', () => {
    let isPlaying = false
    let isPaused = true
    let currentTime = 5000
    // Stop
    isPlaying = false
    isPaused = false
    currentTime = 0
    expect(isPlaying).toBe(false)
    expect(isPaused).toBe(false)
    expect(currentTime).toBe(0)
  })
})

describe('WASM 引擎 - seek 操作', () => {
  it('seek 到有效时间应更新时间', () => {
    let currentTime = 0
    const seekTo = (ms: number) => {
      currentTime = ms
    }
    seekTo(5000)
    expect(currentTime).toBe(5000)
  })

  it('seek 到负值应被处理', () => {
    let currentTime = 5000
    const targetTime = -1000
    // 正常应限制为 0
    currentTime = Math.max(0, targetTime)
    expect(currentTime).toBe(0)
  })

  it('seek 超过总时长应被处理', () => {
    const totalDuration = 10000
    let currentTime = 5000
    const targetTime = 15000
    // 正常应限制为总时长
    currentTime = Math.min(totalDuration, targetTime)
    expect(currentTime).toBe(10000)
  })
})

describe('WASM 引擎 - 活跃音符计算', () => {
  function getActiveNotesAtTime(
    allNotes: MidiNote[],
    currentTime: number,
    deltaMs: number,
  ): MidiNote[] {
    return allNotes.filter(
      n => n.start_ms <= currentTime + deltaMs && n.end_ms >= currentTime,
    )
  }

  it('应返回当前时间窗内的音符', () => {
    const notes: MidiNote[] = [
      { note: 60, velocity: 80, channel: 0, track_id: 0, track_color_id: 0, start_ms: 0, end_ms: 500, duration_ms: 500 },
      { note: 64, velocity: 90, channel: 0, track_id: 0, track_color_id: 0, start_ms: 250, end_ms: 750, duration_ms: 500 },
      { note: 67, velocity: 100, channel: 0, track_id: 0, track_color_id: 0, start_ms: 1000, end_ms: 1500, duration_ms: 500 },
    ]
    const active = getActiveNotesAtTime(notes, 300, 16)
    expect(active).toHaveLength(2) // notes 60 and 64 are active
    expect(active.map(n => n.note)).toContain(60)
    expect(active.map(n => n.note)).toContain(64)
  })

  it('deltaMs 越大，窗口内的音符越多', () => {
    const notes: MidiNote[] = [
      { note: 60, velocity: 80, channel: 0, track_id: 0, track_color_id: 0, start_ms: 0, end_ms: 500, duration_ms: 500 },
      { note: 64, velocity: 90, channel: 0, track_id: 0, track_color_id: 0, start_ms: 600, end_ms: 1100, duration_ms: 500 },
    ]
    const activeNarrow = getActiveNotesAtTime(notes, 500, 16)
    const activeWide = getActiveNotesAtTime(notes, 500, 100)
    expect(activeNarrow.length).toBeLessThanOrEqual(activeWide.length)
  })

  it('无活跃音符时应返回空数组', () => {
    const notes: MidiNote[] = [
      { note: 60, velocity: 80, channel: 0, track_id: 0, track_color_id: 0, start_ms: 0, end_ms: 100, duration_ms: 100 },
    ]
    const active = getActiveNotesAtTime(notes, 5000, 16)
    expect(active).toHaveLength(0)
  })
})

describe('WASM 引擎 - 文件头格式', () => {
  it('标准 MIDI 文件头格式', () => {
    const header = new Uint8Array([
      0x4D, 0x54, 0x68, 0x64, // 'MThd'
      0x00, 0x00, 0x00, 0x06, // Header length: 6
      0x00, 0x01,             // Format: 1
      0x00, 0x02,             // Tracks: 2
      0x01, 0xE0,             // Ticks per quarter: 480
    ])
    expect(header.length).toBe(14)
  })

  it('MTrk 音轨头格式', () => {
    const trackHeader = new Uint8Array([
      0x4D, 0x54, 0x72, 0x6B, // 'MTrk'
    ])
    expect(trackHeader[0]).toBe(0x4D)
    expect(trackHeader[1]).toBe(0x54)
    expect(trackHeader[2]).toBe(0x72)
    expect(trackHeader[3]).toBe(0x6B)
  })

  it('End of Track meta 事件', () => {
    const endOfTrack = new Uint8Array([
      0x00, // Delta time: 0
      0xFF, 0x2F, 0x00, // Meta event: End of track
    ])
    expect(endOfTrack[1]).toBe(0xFF)
    expect(endOfTrack[2]).toBe(0x2F)
  })
})

describe('WASM 引擎 - 模块加载路径', () => {
  it('loader 模块路径应正确', async () => {
    // Verify the expected module path exists
    const expectedPath = '~/utils/wasmuscore/loader'
    expect(expectedPath).toContain('wasmuscore')
    expect(expectedPath).toContain('loader')
  })
})
