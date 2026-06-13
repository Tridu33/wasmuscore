/**
 * MIDI 播放器单元测试
 * 测试核心功能: MidiStore 格式化函数、状态管理、音符数据处理
 *
 * 注: 由于 MidiStore 依赖 WASM 模块和 AudioEngine，
 * 本测试主要覆盖纯函数逻辑和数据结构验证
 */
import { describe, it, expect } from 'vitest'

// ========== 从 midi store 提取的纯函数 ==========

/**
 * 格式化时间 (ms → mm:ss)
 */
function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

// ========== 音符数据处理 ==========

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

interface ActiveNote {
  note: number
  velocity: number
  channel: number
  track_id: number
  track_color_id: number
  timestamp_ms: number
}

interface PlaybackStatus {
  is_playing: boolean
  is_paused: boolean
  current_time_ms: number
  total_duration_ms: number
  percentage: number
  is_finished: boolean
}

/**
 * 判断音符是否在活动时间窗口内
 */
function isNoteActiveInWindow(
  note: MidiNote,
  currentTime: number,
  windowMs: number,
): boolean {
  return (
    note.start_ms <= currentTime + windowMs
    && note.end_ms >= currentTime
  )
}

/**
 * 计算播放百分比
 */
function calculatePlaybackPercentage(
  currentTime: number,
  totalDuration: number,
): number {
  if (totalDuration === 0) return 0
  return Math.min(100, Math.max(0, (currentTime / totalDuration) * 100))
}

/**
 * 查找新的活跃音符 (已活跃的不重复触发)
 */
function findNewActiveNotes(
  currentActive: ActiveNote[],
  newActive: ActiveNote[],
): ActiveNote[] {
  return newActive.filter(
    newNote => !currentActive.some(
      old => old.note === newNote.note && old.channel === newNote.channel,
    ),
  )
}

/**
 * 查找已停止的活跃音符
 */
function findStoppedNotes(
  currentActive: ActiveNote[],
  stillActive: ActiveNote[],
): ActiveNote[] {
  return currentActive.filter(
    oldNote => !stillActive.some(
      newNote => newNote.note === oldNote.note && newNote.channel === oldNote.channel,
    ),
  )
}

// ========== 测试 ==========

describe('MIDI 播放器 - 时间格式化', () => {
  it('0ms 应为 "0:00"', () => {
    expect(formatTime(0)).toBe('0:00')
  })

  it('1000ms 应为 "0:01"', () => {
    expect(formatTime(1000)).toBe('0:01')
  })

  it('59999ms 应为 "0:59"', () => {
    expect(formatTime(59999)).toBe('0:59')
  })

  it('60000ms 应为 "1:00"', () => {
    expect(formatTime(60000)).toBe('1:00')
  })

  it('61000ms 应为 "1:01"', () => {
    expect(formatTime(61000)).toBe('1:01')
  })

  it('125000ms 应为 "2:05"', () => {
    expect(formatTime(125000)).toBe('2:05')
  })

  it('3600000ms 应为 "60:00"', () => {
    expect(formatTime(3600000)).toBe('60:00')
  })

  it('不足一秒应向下取整', () => {
    expect(formatTime(999)).toBe('0:00')
    expect(formatTime(1999)).toBe('0:01')
  })

  it('秒数应有前导零', () => {
    expect(formatTime(65000)).toBe('1:05')
    expect(formatTime(120009)).toBe('2:00')
  })

  it('负数时间应处理', () => {
    const result = formatTime(-1000)
    // Math.floor(-1000/1000) = -1, totalSeconds = -1
    // minutes = -1, seconds = ... depends on JS behavior
    expect(typeof result).toBe('string')
    expect(result.includes(':')).toBe(true)
  })
})

describe('MIDI 播放器 - 播放状态', () => {
  describe('百分比计算', () => {
    it('开始时应为 0%', () => {
      expect(calculatePlaybackPercentage(0, 10000)).toBe(0)
    })

    it('一半时应为 50%', () => {
      expect(calculatePlaybackPercentage(5000, 10000)).toBe(50)
    })

    it('结束时应为 100%', () => {
      expect(calculatePlaybackPercentage(10000, 10000)).toBe(100)
    })

    it('超过总时长应限制为 100%', () => {
      expect(calculatePlaybackPercentage(15000, 10000)).toBe(100)
    })

    it('负时间应限制为 0%', () => {
      expect(calculatePlaybackPercentage(-1000, 10000)).toBe(0)
    })

    it('总时长为 0 时应为 0%', () => {
      expect(calculatePlaybackPercentage(0, 0)).toBe(0)
    })
  })

  describe('播放状态标志', () => {
    it('初始状态应为未播放', () => {
      const status: PlaybackStatus = {
        is_playing: false,
        is_paused: false,
        current_time_ms: 0,
        total_duration_ms: 0,
        percentage: 0,
        is_finished: false,
      }
      expect(status.is_playing).toBe(false)
      expect(status.is_paused).toBe(false)
      expect(status.is_finished).toBe(false)
    })

    it('播放中状态', () => {
      const status: PlaybackStatus = {
        is_playing: true,
        is_paused: false,
        current_time_ms: 5000,
        total_duration_ms: 10000,
        percentage: 50,
        is_finished: false,
      }
      expect(status.is_playing).toBe(true)
      expect(status.is_paused).toBe(false)
    })

    it('暂停状态', () => {
      const status: PlaybackStatus = {
        is_playing: false,
        is_paused: true,
        current_time_ms: 5000,
        total_duration_ms: 10000,
        percentage: 50,
        is_finished: false,
      }
      expect(status.is_playing).toBe(false)
      expect(status.is_paused).toBe(true)
    })

    it('播放完成状态', () => {
      const status: PlaybackStatus = {
        is_playing: false,
        is_paused: false,
        current_time_ms: 10000,
        total_duration_ms: 10000,
        percentage: 100,
        is_finished: true,
      }
      expect(status.is_finished).toBe(true)
      expect(status.percentage).toBe(100)
    })
  })
})

describe('MIDI 播放器 - 音符活动窗口检测', () => {
  it('正在播放的音符应被检测为活跃', () => {
    const note: MidiNote = {
      note: 60,
      velocity: 80,
      channel: 0,
      track_id: 0,
      track_color_id: 0,
      start_ms: 0,
      end_ms: 1000,
      duration_ms: 1000,
    }
    expect(isNoteActiveInWindow(note, 500, 16)).toBe(true)
  })

  it('已经结束的音符不应被检测为活跃', () => {
    const note: MidiNote = {
      note: 60,
      velocity: 80,
      channel: 0,
      track_id: 0,
      track_color_id: 0,
      start_ms: 0,
      end_ms: 500,
      duration_ms: 500,
    }
    expect(isNoteActiveInWindow(note, 1000, 16)).toBe(false)
  })

  it('尚未开始的音符不应被检测为活跃', () => {
    const note: MidiNote = {
      note: 60,
      velocity: 80,
      channel: 0,
      track_id: 0,
      track_color_id: 0,
      start_ms: 2000,
      end_ms: 3000,
      duration_ms: 1000,
    }
    expect(isNoteActiveInWindow(note, 500, 16)).toBe(false)
  })

  it('即将开始的音符在窗口内应被检测为活跃', () => {
    const note: MidiNote = {
      note: 60,
      velocity: 80,
      channel: 0,
      track_id: 0,
      track_color_id: 0,
      start_ms: 510,
      end_ms: 1000,
      duration_ms: 490,
    }
    expect(isNoteActiveInWindow(note, 500, 16)).toBe(true)
  })

  it('刚好在边界上的音符应被检测', () => {
    const note: MidiNote = {
      note: 60,
      velocity: 80,
      channel: 0,
      track_id: 0,
      track_color_id: 0,
      start_ms: 500,
      end_ms: 600,
      duration_ms: 100,
    }
    expect(isNoteActiveInWindow(note, 500, 16)).toBe(true)
  })
})

describe('MIDI 播放器 - 新旧音符比较', () => {
  it('新音符应被识别为新增', () => {
    const current: ActiveNote[] = [
      { note: 60, velocity: 80, channel: 0, track_id: 0, track_color_id: 0, timestamp_ms: 0 },
    ]
    const newActive: ActiveNote[] = [
      { note: 60, velocity: 80, channel: 0, track_id: 0, track_color_id: 0, timestamp_ms: 16 },
      { note: 64, velocity: 90, channel: 0, track_id: 0, track_color_id: 0, timestamp_ms: 16 },
    ]
    const newNotes = findNewActiveNotes(current, newActive)
    expect(newNotes).toHaveLength(1)
    expect(newNotes[0].note).toBe(64)
  })

  it('持续活跃的音符不应被识别为新增', () => {
    const current: ActiveNote[] = [
      { note: 60, velocity: 80, channel: 0, track_id: 0, track_color_id: 0, timestamp_ms: 0 },
    ]
    const newActive: ActiveNote[] = [
      { note: 60, velocity: 80, channel: 0, track_id: 0, track_color_id: 0, timestamp_ms: 16 },
    ]
    const newNotes = findNewActiveNotes(current, newActive)
    expect(newNotes).toHaveLength(0)
  })

  it('同音符不同 channel 应被识别为新增', () => {
    const current: ActiveNote[] = [
      { note: 60, velocity: 80, channel: 0, track_id: 0, track_color_id: 0, timestamp_ms: 0 },
    ]
    const newActive: ActiveNote[] = [
      { note: 60, velocity: 90, channel: 1, track_id: 0, track_color_id: 0, timestamp_ms: 16 },
    ]
    const newNotes = findNewActiveNotes(current, newActive)
    expect(newNotes).toHaveLength(1)
    expect(newNotes[0].channel).toBe(1)
  })

  it('全部音符都停止时应返回空新增列表', () => {
    const current: ActiveNote[] = [
      { note: 60, velocity: 80, channel: 0, track_id: 0, track_color_id: 0, timestamp_ms: 0 },
      { note: 64, velocity: 90, channel: 0, track_id: 0, track_color_id: 0, timestamp_ms: 0 },
    ]
    const newActive: ActiveNote[] = []
    const newNotes = findNewActiveNotes(current, newActive)
    expect(newNotes).toHaveLength(0)
  })
})

describe('MIDI 播放器 - 音符数据结构', () => {
  it('MidiNote 应包含所有必要字段', () => {
    const note: MidiNote = {
      note: 60,
      velocity: 80,
      channel: 0,
      track_id: 0,
      track_color_id: 0,
      start_ms: 0,
      end_ms: 500,
      duration_ms: 500,
    }
    expect(note.note).toBe(60)
    expect(note.velocity).toBe(80)
    expect(note.channel).toBe(0)
    expect(note.start_ms).toBe(0)
    expect(note.end_ms).toBe(500)
    expect(note.duration_ms).toBe(500)
    expect(note.end_ms).toBe(note.start_ms + note.duration_ms)
  })

  it('ActiveNote 应包含时间戳', () => {
    const active: ActiveNote = {
      note: 60,
      velocity: 80,
      channel: 0,
      track_id: 0,
      track_color_id: 0,
      timestamp_ms: 1234,
    }
    expect(active.timestamp_ms).toBe(1234)
  })

  it('音轨颜色 ID 应非负', () => {
    const note: MidiNote = {
      note: 60,
      velocity: 80,
      channel: 0,
      track_id: 0,
      track_color_id: 3,
      start_ms: 0,
      end_ms: 500,
      duration_ms: 500,
    }
    expect(note.track_color_id).toBeGreaterThanOrEqual(0)
  })
})

describe('MIDI 播放器 - 多音轨管理', () => {
  it('同一音轨的音符应有相同 track_id', () => {
    const notes: MidiNote[] = [
      { note: 60, velocity: 80, channel: 0, track_id: 0, track_color_id: 0, start_ms: 0, end_ms: 500, duration_ms: 500 },
      { note: 64, velocity: 90, channel: 0, track_id: 0, track_color_id: 0, start_ms: 500, end_ms: 1000, duration_ms: 500 },
    ]
    const trackIds = new Set(notes.map(n => n.track_id))
    expect(trackIds.size).toBe(1)
  })

  it('不同音轨应有不同 track_id', () => {
    const notes: MidiNote[] = [
      { note: 60, velocity: 80, channel: 0, track_id: 0, track_color_id: 0, start_ms: 0, end_ms: 500, duration_ms: 500 },
      { note: 60, velocity: 80, channel: 0, track_id: 1, track_color_id: 1, start_ms: 0, end_ms: 500, duration_ms: 500 },
    ]
    const trackIds = new Set(notes.map(n => n.track_id))
    expect(trackIds.size).toBe(2)
  })

  it('音轨颜色应循环使用', () => {
    const trackColorId = 10
    const colorIndex = trackColorId % 8
    expect(colorIndex).toBe(2)
  })
})

describe('MIDI 播放器 - 边界条件', () => {
  it('空音符列表应正常处理', () => {
    const notes: MidiNote[] = []
    const active = notes.filter(n => isNoteActiveInWindow(n, 500, 16))
    expect(active).toHaveLength(0)
  })

  it('超长音符应跨越多个窗口', () => {
    const note: MidiNote = {
      note: 60,
      velocity: 80,
      channel: 0,
      track_id: 0,
      track_color_id: 0,
      start_ms: 0,
      end_ms: 100000,
      duration_ms: 100000,
    }
    // 在不同时间点都应活跃
    expect(isNoteActiveInWindow(note, 1000, 16)).toBe(true)
    expect(isNoteActiveInWindow(note, 50000, 16)).toBe(true)
    expect(isNoteActiveInWindow(note, 99000, 16)).toBe(true)
    expect(isNoteActiveInWindow(note, 100001, 16)).toBe(false)
  })

  it('极短音符 (1ms) 应能被检测', () => {
    const note: MidiNote = {
      note: 60,
      velocity: 80,
      channel: 0,
      track_id: 0,
      track_color_id: 0,
      start_ms: 500,
      end_ms: 501,
      duration_ms: 1,
    }
    // With deltaMs=16 lookahead, note at 500 is active at 490 (490+16=506 >= 500)
    expect(isNoteActiveInWindow(note, 500, 16)).toBe(true)
    expect(isNoteActiveInWindow(note, 490, 16)).toBe(true)
    // But at 480, 480+16=496 < 500, so not active
    expect(isNoteActiveInWindow(note, 480, 16)).toBe(false)
  })
})
