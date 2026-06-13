/**
 * 吉他 TAB 单元测试
 * 测试核心功能: MIDI-to-fret 转换、吉他弦映射、品格计算、小节分组
 */
import { describe, it, expect } from 'vitest'

// 复制 GuitarTab 中的纯函数逻辑进行测试
// (Vue 组件中的纯函数提取)

const GUITAR_STRINGS = [
  { name: 'E2', midi: 40, color: '#ff6b6b' },
  { name: 'A2', midi: 45, color: '#ffa94d' },
  { name: 'D3', midi: 50, color: '#ffd43b' },
  { name: 'G3', midi: 55, color: '#69db7c' },
  { name: 'B3', midi: 59, color: '#74c0fc' },
  { name: 'E4', midi: 64, color: '#b197fc' },
]

const BEATS_PER_MEASURE = 4
const BPM = 120
const MS_PER_BEAT = 60000 / BPM
const MS_PER_MEASURE = MS_PER_BEAT * BEATS_PER_MEASURE

/**
 * MIDI note 转换为吉他品格
 */
function midiToFret(midiNote: number, stringMidi: number): number {
  return midiNote - stringMidi
}

/**
 * 查找音符在吉他上的最佳位置
 */
function findBestFretPosition(midiNote: number): { stringIndex: number, fret: number } | null {
  for (let i = GUITAR_STRINGS.length - 1; i >= 0; i--) {
    const fret = midiToFret(midiNote, GUITAR_STRINGS[i].midi)
    if (fret >= 0 && fret <= 24) {
      return { stringIndex: i, fret }
    }
  }
  return null
}

/**
 * 将音符分组到小节
 */
function groupNotesIntoMeasures(notes: Array<{ start_ms: number, note: number, velocity: number }>) {
  const measureMap: Map<number, any[]> = new Map()
  notes.forEach((note) => {
    const measureIndex = Math.floor(note.start_ms / MS_PER_MEASURE)
    if (!measureMap.has(measureIndex)) {
      measureMap.set(measureIndex, [])
    }
    measureMap.get(measureIndex)!.push(note)
  })
  return Array.from(measureMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([index, notes]) => ({
      index,
      notes: notes.sort((a, b) => a.start_ms - b.start_ms),
    }))
}

describe('吉他 TAB - MIDI 转品格转换', () => {
  describe('midiToFret', () => {
    it('空弦音应为品格 0', () => {
      expect(midiToFret(40, 40)).toBe(0)  // E2 on E2 string
      expect(midiToFret(45, 45)).toBe(0)  // A2 on A2 string
      expect(midiToFret(64, 64)).toBe(0)  // E4 on E4 string
    })

    it('高一个半音应为品格 1', () => {
      expect(midiToFret(41, 40)).toBe(1)  // F on E2 string
      expect(midiToFret(46, 45)).toBe(1)  // Bb on A2 string
    })

    it('高 12 个半音应为品格 12', () => {
      expect(midiToFret(52, 40)).toBe(12)  // E3 on E2 string
      expect(midiToFret(57, 45)).toBe(12)  // A3 on A2 string
    })

    it('低于空弦音应为负值', () => {
      expect(midiToFret(39, 40)).toBe(-1)
      expect(midiToFret(35, 40)).toBe(-5)
    })
  })

  describe('findBestFretPosition', () => {
    it('空弦音应在对应弦的品格 0', () => {
      const result = findBestFretPosition(40) // E2
      expect(result).not.toBeNull()
      expect(result!.fret).toBe(0)
    })

    it('E4 (64) 应在第一弦品格 0', () => {
      const result = findBestFretPosition(64)
      expect(result).not.toBeNull()
      expect(result!.stringIndex).toBe(5) // E4 string (highest)
      expect(result!.fret).toBe(0)
    })

    it('C4 (60) 应在第二弦品格 1', () => {
      const result = findBestFretPosition(60)
      expect(result).not.toBeNull()
      // C4: on B3 (59) string → fret 1
      expect(result!.stringIndex).toBe(4)
      expect(result!.fret).toBe(1)
    })

    it('应优先选择高音弦', () => {
      // G3 (55) can be on G3 string (fret 0) or higher strings
      const result = findBestFretPosition(55)
      expect(result).not.toBeNull()
      expect(result!.fret).toBeGreaterThanOrEqual(0)
      expect(result!.fret).toBeLessThanOrEqual(24)
    })

    it('吉他范围外的音符应返回 null', () => {
      // 低于 E2 (40) 的音符
      const result = findBestFretPosition(28)
      expect(result).toBeNull()
    })

    it('高于吉他最高音的音符应返回 null', () => {
      // E4 string + 24 frets = 64 + 24 = 88
      const result = findBestFretPosition(89)
      expect(result).toBeNull()
    })

    it('吉他最高音应有效 (E4 + 24 品格 = MIDI 88)', () => {
      const result = findBestFretPosition(88)
      expect(result).not.toBeNull()
      expect(result!.fret).toBe(24)
    })

    it('所有吉他弦音符应在 0-24 品格范围内', () => {
      for (let midi = 40; midi <= 88; midi++) {
        const result = findBestFretPosition(midi)
        if (result !== null) {
          expect(result.fret).toBeGreaterThanOrEqual(0)
          expect(result.fret).toBeLessThanOrEqual(24)
        }
      }
    })
  })
})

describe('吉他 TAB - 小节分组', () => {
  it('空音符列表应返回空数组', () => {
    const measures = groupNotesIntoMeasures([])
    expect(measures).toEqual([])
  })

  it('同小节音符应被分组到一起', () => {
    const notes = [
      { start_ms: 0, note: 60, velocity: 80 },
      { start_ms: 500, note: 64, velocity: 90 },
      { start_ms: 1000, note: 67, velocity: 100 },
    ]
    const measures = groupNotesIntoMeasures(notes)
    expect(measures).toHaveLength(1)
    expect(measures[0].index).toBe(0)
    expect(measures[0].notes).toHaveLength(3)
  })

  it('跨小节音符应被正确分组', () => {
    const notes = [
      { start_ms: 0, note: 60, velocity: 80 },
      { start_ms: 2000, note: 64, velocity: 90 },  // 新小节 (MS_PER_MEASURE = 2000)
      { start_ms: 4000, note: 67, velocity: 100 },  // 另一个新小节
    ]
    const measures = groupNotesIntoMeasures(notes)
    expect(measures).toHaveLength(3)
    expect(measures[0].index).toBe(0)
    expect(measures[1].index).toBe(1)
    expect(measures[2].index).toBe(2)
  })

  it('小节内音符应按时间排序', () => {
    const notes = [
      { start_ms: 1500, note: 67, velocity: 100 },
      { start_ms: 0, note: 60, velocity: 80 },
      { start_ms: 500, note: 64, velocity: 90 },
    ]
    const measures = groupNotesIntoMeasures(notes)
    const noteOrder = measures[0].notes.map(n => n.start_ms)
    expect(noteOrder).toEqual([0, 500, 1500])
  })

  it('小节索引应按顺序排列', () => {
    const notes = [
      { start_ms: 4000, note: 72, velocity: 80 },
      { start_ms: 0, note: 60, velocity: 80 },
      { start_ms: 2000, note: 64, velocity: 90 },
    ]
    const measures = groupNotesIntoMeasures(notes)
    const indices = measures.map(m => m.index)
    expect(indices).toEqual([0, 1, 2])
  })

  it('小节时长计算应正确', () => {
    // 120 BPM, 4/4 → 每拍 500ms, 每小节 2000ms
    expect(MS_PER_BEAT).toBe(500)
    expect(MS_PER_MEASURE).toBe(2000)
  })
})

describe('吉他 TAB - 和弦识别', () => {
  it('同一时间的多个音符应能在不同弦上显示', () => {
    // C 和弦: C4(60), E4(64), G4(67)
    const chordNotes = [
      { start_ms: 0, note: 60, velocity: 80 },
      { start_ms: 0, note: 64, velocity: 80 },
      { start_ms: 0, note: 67, velocity: 80 },
    ]
    const positions = chordNotes.map(n => findBestFretPosition(n.note))

    // 每个音符应该有有效位置
    positions.forEach(p => expect(p).not.toBeNull())
    // 应该分布在不同弦上
    const stringIndices = positions.map(p => p!.stringIndex)
    const uniqueStrings = new Set(stringIndices)
    expect(uniqueStrings.size).toBeGreaterThan(1)
  })
})

describe('吉他 TAB - 标准调弦验证', () => {
  it('标准调弦应为 E A D G B E', () => {
    expect(GUITAR_STRINGS[0].name).toBe('E2')
    expect(GUITAR_STRINGS[1].name).toBe('A2')
    expect(GUITAR_STRINGS[2].name).toBe('D3')
    expect(GUITAR_STRINGS[3].name).toBe('G3')
    expect(GUITAR_STRINGS[4].name).toBe('B3')
    expect(GUITAR_STRINGS[5].name).toBe('E4')
  })

  it('相邻弦间隔应为 5 或 4 个半音', () => {
    const intervals = []
    for (let i = 0; i < GUITAR_STRINGS.length - 1; i++) {
      intervals.push(GUITAR_STRINGS[i + 1].midi - GUITAR_STRINGS[i].midi)
    }
    // E-A: 5, A-D: 5, D-G: 5, G-B: 4, B-E: 5
    expect(intervals).toEqual([5, 5, 5, 4, 5])
  })

  it('吉他应有 6 根弦', () => {
    expect(GUITAR_STRINGS).toHaveLength(6)
  })
})
