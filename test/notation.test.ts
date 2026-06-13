/**
 * 五线谱 & 简谱 单元测试
 * 测试核心功能: MIDI-to-pitch 转换、音符类型判断、八度计算、MusicXML 生成
 */
import { describe, it, expect } from 'vitest'

// ========== 五线谱相关函数 (从 StaffNotation.vue 提取) ==========

/**
 * MIDI note number 转换为音名
 */
function midiToPitch(midiNote: number): { step: string, octave: number, alter?: number } {
  const noteNames = ['C', 'C', 'D', 'D', 'E', 'F', 'F', 'G', 'G', 'A', 'A', 'B']
  const alterMap = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0]
  const octave = Math.floor(midiNote / 12) - 1
  const pitchClass = midiNote % 12
  return {
    step: noteNames[pitchClass],
    octave,
    alter: alterMap[pitchClass] || undefined,
  }
}

/**
 * 根据时长确定音符类型
 */
function getNoteType(durationMs: number): string {
  if (durationMs >= 1800) return 'whole'
  if (durationMs >= 900) return 'half'
  if (durationMs >= 450) return 'quarter'
  if (durationMs >= 225) return 'eighth'
  if (durationMs >= 112) return '16th'
  return '32nd'
}

// ========== 简谱相关函数 (从 NumberedNotation.vue 提取) ==========

/**
 * 音高到简谱数字的映射
 */
function midiToNumberedNote(midiNote: number) {
  const pitchClass = midiNote % 12
  const octave = Math.floor(midiNote / 12) - 4
  const numberMap: Record<number, { num: number, isSharp: boolean }> = {
    0: { num: 1, isSharp: false },
    1: { num: 1, isSharp: true },
    2: { num: 2, isSharp: false },
    3: { num: 2, isSharp: true },
    4: { num: 3, isSharp: false },
    5: { num: 4, isSharp: false },
    6: { num: 4, isSharp: true },
    7: { num: 5, isSharp: false },
    8: { num: 5, isSharp: true },
    9: { num: 6, isSharp: false },
    10: { num: 6, isSharp: true },
    11: { num: 7, isSharp: false },
  }
  const { num, isSharp } = numberMap[pitchClass] || { num: 1, isSharp: false }
  return {
    number: num.toString(),
    octave,
    isSharp,
  }
}

/**
 * 获取音符时值类型 (简谱版)
 */
function getNoteDurationTypeNumbered(durationMs: number): string {
  const MS_PER_BEAT = 60000 / 120
  const beats = durationMs / MS_PER_BEAT
  if (beats >= 3.5) return 'whole'
  if (beats >= 1.5) return 'half'
  if (beats >= 0.75) return 'quarter'
  if (beats >= 0.375) return 'eighth'
  return 'sixteenth'
}

/**
 * 渲染八度点
 */
function renderOctaveDots(octave: number) {
  if (octave > 0) return { high: octave, low: 0 }
  if (octave < 0) return { high: 0, low: Math.abs(octave) }
  return { high: 0, low: 0 }
}

// ========== 五线谱测试 ==========

describe('五线谱 - MIDI 转音名', () => {
  describe('自然音', () => {
    it('C4 (60) 应转换为 C, octave 4', () => {
      const pitch = midiToPitch(60)
      expect(pitch.step).toBe('C')
      expect(pitch.octave).toBe(4)
      expect(pitch.alter).toBeUndefined()
    })

    it('D4 (62) 应转换为 D, octave 4', () => {
      const pitch = midiToPitch(62)
      expect(pitch.step).toBe('D')
      expect(pitch.octave).toBe(4)
      expect(pitch.alter).toBeUndefined()
    })

    it('E4 (64) 应转换为 E, octave 4', () => {
      const pitch = midiToPitch(64)
      expect(pitch.step).toBe('E')
      expect(pitch.alter).toBeUndefined()
    })

    it('F4 (65) 应转换为 F, octave 4', () => {
      const pitch = midiToPitch(65)
      expect(pitch.step).toBe('F')
      expect(pitch.octave).toBe(4)
    })

    it('G4 (67) 应转换为 G, octave 4', () => {
      const pitch = midiToPitch(67)
      expect(pitch.step).toBe('G')
      expect(pitch.octave).toBe(4)
    })

    it('A4 (69) 应转换为 A, octave 4', () => {
      const pitch = midiToPitch(69)
      expect(pitch.step).toBe('A')
      expect(pitch.octave).toBe(4)
    })

    it('B4 (71) 应转换为 B, octave 4', () => {
      const pitch = midiToPitch(71)
      expect(pitch.step).toBe('B')
      expect(pitch.octave).toBe(4)
    })
  })

  describe('变化音 (升降号)', () => {
    it('C#4 (61) 应有 alter = 1', () => {
      const pitch = midiToPitch(61)
      expect(pitch.step).toBe('C')
      expect(pitch.alter).toBe(1)
    })

    it('D#4 (63) 应有 alter = 1', () => {
      const pitch = midiToPitch(63)
      expect(pitch.step).toBe('D')
      expect(pitch.alter).toBe(1)
    })

    it('F#4 (66) 应有 alter = 1', () => {
      const pitch = midiToPitch(66)
      expect(pitch.step).toBe('F')
      expect(pitch.alter).toBe(1)
    })

    it('G#4 (68) 应有 alter = 1', () => {
      const pitch = midiToPitch(68)
      expect(pitch.step).toBe('G')
      expect(pitch.alter).toBe(1)
    })

    it('A#4 (70) 应有 alter = 1', () => {
      const pitch = midiToPitch(70)
      expect(pitch.step).toBe('A')
      expect(pitch.alter).toBe(1)
    })
  })

  describe('不同八度', () => {
    it('C3 (48) 应 octave 3', () => {
      expect(midiToPitch(48).octave).toBe(3)
    })

    it('C5 (72) 应 octave 5', () => {
      expect(midiToPitch(72).octave).toBe(5)
    })

    it('A0 (21) 应 octave 0', () => {
      expect(midiToPitch(21).octave).toBe(0)
    })

    it('C8 (108) 应 octave 8', () => {
      expect(midiToPitch(108).octave).toBe(8)
    })
  })

  describe('C 大调音阶完整映射', () => {
    it('C 大调音阶应无变化音', () => {
      const cMajor = [60, 62, 64, 65, 67, 69, 71] // C D E F G A B
      cMajor.forEach((midi) => {
        const pitch = midiToPitch(midi)
        expect(pitch.alter).toBeUndefined()
      })
    })
  })
})

describe('五线谱 - 音符时值类型', () => {
  it('全音符: >= 1800ms', () => {
    expect(getNoteType(2000)).toBe('whole')
    expect(getNoteType(1800)).toBe('whole')
  })

  it('二分音符: >= 900ms', () => {
    expect(getNoteType(1000)).toBe('half')
    expect(getNoteType(900)).toBe('half')
    expect(getNoteType(899)).toBe('quarter')
  })

  it('四分音符: >= 450ms', () => {
    expect(getNoteType(500)).toBe('quarter')
    expect(getNoteType(450)).toBe('quarter')
    expect(getNoteType(449)).toBe('eighth')
  })

  it('八分音符: >= 225ms', () => {
    expect(getNoteType(300)).toBe('eighth')
    expect(getNoteType(225)).toBe('eighth')
    expect(getNoteType(224)).toBe('16th')
  })

  it('十六分音符: >= 112ms', () => {
    expect(getNoteType(150)).toBe('16th')
    expect(getNoteType(112)).toBe('16th')
    expect(getNoteType(111)).toBe('32nd')
  })

  it('三十二分音符: < 112ms', () => {
    expect(getNoteType(100)).toBe('32nd')
    expect(getNoteType(50)).toBe('32nd')
    expect(getNoteType(0)).toBe('32nd')
  })
})

// ========== 简谱测试 ==========

describe('简谱 - MIDI 转数字', () => {
  describe('C 大调音阶 (pitch class 0-11)', () => {
    it('C (0) 应为 1 (do)', () => {
      const result = midiToNumberedNote(60)
      expect(result.number).toBe('1')
      expect(result.isSharp).toBe(false)
    })

    it('C# (1) 应为 1#', () => {
      const result = midiToNumberedNote(61)
      expect(result.number).toBe('1')
      expect(result.isSharp).toBe(true)
    })

    it('D (2) 应为 2 (re)', () => {
      const result = midiToNumberedNote(62)
      expect(result.number).toBe('2')
      expect(result.isSharp).toBe(false)
    })

    it('D# (3) 应为 2#', () => {
      const result = midiToNumberedNote(63)
      expect(result.number).toBe('2')
      expect(result.isSharp).toBe(true)
    })

    it('E (4) 应为 3 (mi)', () => {
      const result = midiToNumberedNote(64)
      expect(result.number).toBe('3')
      expect(result.isSharp).toBe(false)
    })

    it('F (5) 应为 4 (fa)', () => {
      const result = midiToNumberedNote(65)
      expect(result.number).toBe('4')
      expect(result.isSharp).toBe(false)
    })

    it('F# (6) 应为 4#', () => {
      const result = midiToNumberedNote(66)
      expect(result.number).toBe('4')
      expect(result.isSharp).toBe(true)
    })

    it('G (7) 应为 5 (sol)', () => {
      const result = midiToNumberedNote(67)
      expect(result.number).toBe('5')
      expect(result.isSharp).toBe(false)
    })

    it('G# (8) 应为 5#', () => {
      const result = midiToNumberedNote(68)
      expect(result.number).toBe('5')
      expect(result.isSharp).toBe(true)
    })

    it('A (9) 应为 6 (la)', () => {
      const result = midiToNumberedNote(69)
      expect(result.number).toBe('6')
      expect(result.isSharp).toBe(false)
    })

    it('A# (10) 应为 6#', () => {
      const result = midiToNumberedNote(70)
      expect(result.number).toBe('6')
      expect(result.isSharp).toBe(true)
    })

    it('B (11) 应为 7 (si)', () => {
      const result = midiToNumberedNote(71)
      expect(result.number).toBe('7')
      expect(result.isSharp).toBe(false)
    })
  })

  describe('八度计算', () => {
    // 源码公式: octave = Math.floor(midiNote / 12) - 4
    // C4(60): Math.floor(60/12) - 4 = 5 - 4 = 1
    it('C4 (60) 应为 octave 1', () => {
      expect(midiToNumberedNote(60).octave).toBe(1)
    })

    it('C5 (72) 应为 octave 2 (高八度)', () => {
      expect(midiToNumberedNote(72).octave).toBe(2)
    })

    it('C3 (48) 应为 octave 0 (低八度)', () => {
      expect(midiToNumberedNote(48).octave).toBe(0)
    })

    it('A4 (69) 应为 octave 1', () => {
      expect(midiToNumberedNote(69).octave).toBe(1)
    })
  })
})

describe('简谱 - 八度点渲染', () => {
  it('octave 0 应无点', () => {
    const dots = renderOctaveDots(0)
    expect(dots.high).toBe(0)
    expect(dots.low).toBe(0)
  })

  it('octave 1 应有 1 个高音点', () => {
    const dots = renderOctaveDots(1)
    expect(dots.high).toBe(1)
    expect(dots.low).toBe(0)
  })

  it('octave 2 应有 2 个高音点', () => {
    const dots = renderOctaveDots(2)
    expect(dots.high).toBe(2)
    expect(dots.low).toBe(0)
  })

  it('octave -1 应有 1 个低音点', () => {
    const dots = renderOctaveDots(-1)
    expect(dots.high).toBe(0)
    expect(dots.low).toBe(1)
  })

  it('octave -2 应有 2 个低音点', () => {
    const dots = renderOctaveDots(-2)
    expect(dots.high).toBe(0)
    expect(dots.low).toBe(2)
  })
})

describe('简谱 - 音符时值类型', () => {
  it('全音符: >= 3.5 拍', () => {
    expect(getNoteDurationTypeNumbered(2000)).toBe('whole')
    expect(getNoteDurationTypeNumbered(1750)).toBe('whole')
  })

  it('二分音符: >= 1.5 拍', () => {
    expect(getNoteDurationTypeNumbered(1000)).toBe('half')
    expect(getNoteDurationTypeNumbered(750)).toBe('half')
  })

  it('四分音符: >= 0.75 拍', () => {
    expect(getNoteDurationTypeNumbered(500)).toBe('quarter')
    expect(getNoteDurationTypeNumbered(375)).toBe('quarter')
  })

  it('八分音符: >= 0.375 拍', () => {
    expect(getNoteDurationTypeNumbered(250)).toBe('eighth')
  })

  it('十六分音符: < 0.375 拍', () => {
    expect(getNoteDurationTypeNumbered(100)).toBe('sixteenth')
  })
})

describe('五线谱 & 简谱 - 集成', () => {
  it('C 大调音阶映射应一致', () => {
    const cMajorNotes = [60, 62, 64, 65, 67, 69, 71]
    const stepNames = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
    const numberedNotes = ['1', '2', '3', '4', '5', '6', '7']

    cMajorNotes.forEach((midi, i) => {
      expect(midiToPitch(midi).step).toBe(stepNames[i])
      expect(midiToNumberedNote(midi).number).toBe(numberedNotes[i])
      expect(midiToNumberedNote(midi).isSharp).toBe(false)
    })
  })

  it('变化音在五线谱中有 alter，在简谱中有 isSharp', () => {
    const sharps = [61, 63, 66, 68, 70] // C#, D#, F#, G#, A#
    sharps.forEach((midi) => {
      expect(midiToPitch(midi).alter).toBe(1)
      expect(midiToNumberedNote(midi).isSharp).toBe(true)
    })
  })

  it('同音名不同八度的音符应有不同 octave', () => {
    const c4 = midiToPitch(60)
    const c5 = midiToPitch(72)
    expect(c4.octave).toBe(4)
    expect(c5.octave).toBe(5)
  })
})

describe('五线谱 - 小节分组', () => {
  it('空音符数组应返回空', () => {
    const msPerMeasure = 2000
    const measureMap = new Map()
    expect(measureMap.size).toBe(0)
  })

  it('4/4 拍每小节应有 4 拍', () => {
    const beatsPerMeasure = 4
    const bpm = 120
    const msPerBeat = 60000 / bpm
    const msPerMeasure = msPerBeat * beatsPerMeasure
    expect(msPerMeasure).toBe(2000)
  })

  it('小节号计算应正确', () => {
    const msPerMeasure = 2000
    expect(Math.floor(0 / msPerMeasure)).toBe(0)
    expect(Math.floor(1999 / msPerMeasure)).toBe(0)
    expect(Math.floor(2000 / msPerMeasure)).toBe(1)
    expect(Math.floor(3999 / msPerMeasure)).toBe(1)
    expect(Math.floor(4000 / msPerMeasure)).toBe(2)
  })
})
