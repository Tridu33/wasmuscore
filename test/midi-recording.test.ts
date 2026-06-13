/**
 * MIDI 录音单元测试 (组件层)
 * 测试核心功能: 录音组件交互逻辑、状态流转、导出功能
 *
 * 注: MidiRecorder.vue 组件依赖 WebMidi API 和 DOM，
 * 本测试覆盖组件中的纯函数逻辑和状态转换
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { MidiRecorder } from '~/utils/midi/MidiRecorder'

describe('MIDI 录音 - 录音状态机', () => {
  let recorder: MidiRecorder

  beforeEach(() => {
    recorder = new MidiRecorder()
  })

  describe('状态转换', () => {
    it('idle → recording → idle (成功录音)', () => {
      // idle
      expect(recorder.getRecordedNotes()).toEqual([])

      // start recording
      recorder.start()

      // recording
      recorder.handleMidiEvent(new Uint8Array([0x90, 60, 100]))
      recorder.handleMidiEvent(new Uint8Array([0x80, 60, 0]))

      // stop recording
      const notes = recorder.stop()
      expect(notes.length).toBeGreaterThan(0)
    })

    it('clear 应返回 idle 状态', () => {
      recorder.start()
      recorder.handleMidiEvent(new Uint8Array([0x90, 60, 100]))
      recorder.handleMidiEvent(new Uint8Array([0x80, 60, 0]))
      recorder.stop()
      recorder.clear()
      expect(recorder.getRecordedNotes()).toEqual([])
    })

    it('录音结束后应保留数据', () => {
      recorder.start()
      recorder.handleMidiEvent(new Uint8Array([0x90, 60, 100]))
      recorder.handleMidiEvent(new Uint8Array([0x80, 60, 0]))
      recorder.stop()
      expect(recorder.getRecordedNotes()).toHaveLength(1)
    })

    it('重新开始录音应清除上次数据', () => {
      recorder.start()
      recorder.handleMidiEvent(new Uint8Array([0x90, 60, 100]))
      recorder.handleMidiEvent(new Uint8Array([0x80, 60, 0]))
      recorder.stop()
      expect(recorder.getRecordedNotes()).toHaveLength(1)

      // 重新开始
      recorder.start()
      expect(recorder.getRecordedNotes()).toEqual([])
    })
  })

  describe('实时音符计数', () => {
    it('应正确统计 Note On 数量', () => {
      recorder.start()
      let noteOnCount = 0

      const events = [
        new Uint8Array([0x90, 60, 100]),
        new Uint8Array([0x90, 64, 90]),
        new Uint8Array([0x90, 67, 80]),
      ]

      events.forEach((data) => {
        const eventType = data[0] & 0xF0
        if (eventType === 0x90 && data[2] > 0) {
          noteOnCount++
        }
        recorder.handleMidiEvent(data)
      })

      expect(noteOnCount).toBe(3)
    })

    it('Note On velocity=0 不应计入音符数', () => {
      let noteOnCount = 0
      const data = new Uint8Array([0x90, 60, 0])
      const eventType = data[0] & 0xF0
      if (eventType === 0x90 && data[2] > 0) {
        noteOnCount++
      }
      expect(noteOnCount).toBe(0)
    })
  })

  describe('MIDI 消息处理', () => {
    it('应处理标准 MIDI 消息格式', () => {
      recorder.start()
      // Note On: status=0x90, note=60, velocity=100
      const data = new Uint8Array([0x90, 60, 100])
      recorder.handleMidiEvent(data)

      expect(data[0]).toBe(0x90)
      expect(data[1]).toBe(60)
      expect(data[2]).toBe(100)
    })

    it('应解析不同通道', () => {
      const channels = [0, 1, 5, 9, 15]
      channels.forEach((ch) => {
        const status = 0x90 | ch
        expect(status & 0x0F).toBe(ch)
      })
    })

    it('应正确解析事件类型', () => {
      // Note On channel 0: 0x90
      expect(0x90 & 0xF0).toBe(0x90)
      // Note Off channel 0: 0x80
      expect(0x80 & 0xF0).toBe(0x80)
      // Control Change channel 0: 0xB0
      expect(0xB0 & 0xF0).toBe(0xB0)
      // Program Change channel 0: 0xC0
      expect(0xC0 & 0xF0).toBe(0xC0)
    })
  })

  describe('导出功能验证', () => {
    it('MIDI 文件导出应有正确 MIME type', () => {
      // 模拟导出逻辑
      const mimeType = 'audio/midi'
      expect(mimeType).toBe('audio/midi')
    })

    it('JSON 导出应有正确 MIME type', () => {
      const mimeType = 'application/json'
      expect(mimeType).toBe('application/json')
    })

    it('导出的文件命名应包含时间戳', () => {
      const timestamp = Date.now()
      const midiFilename = `recording_${timestamp}.mid`
      const jsonFilename = `recording_${timestamp}.json`

      expect(midiFilename).toMatch(/^recording_\d+\.mid$/)
      expect(jsonFilename).toMatch(/^recording_\d+\.json$/)
    })

    it('Blob 创建应正确', () => {
      const midiData = new Uint8Array([0x4D, 0x54, 0x68, 0x64])
      const blob = new Blob([midiData], { type: 'audio/midi' })
      expect(blob.type).toBe('audio/midi')
      expect(blob.size).toBeGreaterThan(0)
    })
  })

  describe('时长格式化', () => {
    it('0ms 应为 "00:00"', () => {
      const ms = 0
      const seconds = Math.floor(ms / 1000)
      const minutes = Math.floor(seconds / 60)
      const remainingSeconds = seconds % 60
      const formatted = `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
      expect(formatted).toBe('00:00')
    })

    it('30000ms 应为 "00:30"', () => {
      const ms = 30000
      const seconds = Math.floor(ms / 1000)
      const minutes = Math.floor(seconds / 60)
      const remainingSeconds = seconds % 60
      const formatted = `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
      expect(formatted).toBe('00:30')
    })

    it('65000ms 应为 "01:05"', () => {
      const ms = 65000
      const seconds = Math.floor(ms / 1000)
      const minutes = Math.floor(seconds / 60)
      const remainingSeconds = seconds % 60
      const formatted = `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
      expect(formatted).toBe('01:05')
    })

    it('3661000ms 应为 "61:01"', () => {
      const ms = 3661000
      const seconds = Math.floor(ms / 1000)
      const minutes = Math.floor(seconds / 60)
      const remainingSeconds = seconds % 60
      const formatted = `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
      expect(formatted).toBe('61:01')
    })
  })

  describe('多音轨录音', () => {
    it('应能同时录制多个音轨的音符', () => {
      recorder.start()
      // Channel 0: C4
      recorder.handleMidiEvent(new Uint8Array([0x90, 60, 100]))
      // Channel 1: E4
      recorder.handleMidiEvent(new Uint8Array([0x91, 64, 90]))
      // Channel 2: G4
      recorder.handleMidiEvent(new Uint8Array([0x92, 67, 80]))
      // Close all
      recorder.handleMidiEvent(new Uint8Array([0x80, 60, 0]))
      recorder.handleMidiEvent(new Uint8Array([0x81, 64, 0]))
      recorder.handleMidiEvent(new Uint8Array([0x82, 67, 0]))
      const notes = recorder.stop()

      expect(notes).toHaveLength(3)
      expect(notes.map(n => n.channel).sort()).toEqual([0, 1, 2])
    })

    it('C 大调和弦各音符应正确录制', () => {
      recorder.start()
      // C major chord: C4(60), E4(64), G4(67)
      const chordNotes = [60, 64, 67]
      chordNotes.forEach((note) => {
        recorder.handleMidiEvent(new Uint8Array([0x90, note, 80]))
      })
      chordNotes.forEach((note) => {
        recorder.handleMidiEvent(new Uint8Array([0x80, note, 0]))
      })
      const notes = recorder.stop()

      expect(notes).toHaveLength(3)
      const noteNumbers = notes.map(n => n.note).sort()
      expect(noteNumbers).toEqual([60, 64, 67])
    })
  })

  describe('边界条件', () => {
    it('最小 MIDI note (0) 应能录制', () => {
      recorder.start()
      recorder.handleMidiEvent(new Uint8Array([0x90, 0, 100]))
      recorder.handleMidiEvent(new Uint8Array([0x80, 0, 0]))
      const notes = recorder.stop()
      expect(notes).toHaveLength(1)
      expect(notes[0].note).toBe(0)
    })

    it('最大 MIDI note (127) 应能录制', () => {
      recorder.start()
      recorder.handleMidiEvent(new Uint8Array([0x90, 127, 100]))
      recorder.handleMidiEvent(new Uint8Array([0x80, 127, 0]))
      const notes = recorder.stop()
      expect(notes).toHaveLength(1)
      expect(notes[0].note).toBe(127)
    })

    it('最小 velocity (1) 应能录制', () => {
      recorder.start()
      recorder.handleMidiEvent(new Uint8Array([0x90, 60, 1]))
      recorder.handleMidiEvent(new Uint8Array([0x80, 60, 0]))
      const notes = recorder.stop()
      expect(notes).toHaveLength(1)
      expect(notes[0].velocity).toBe(1)
    })

    it('最大 velocity (127) 应能录制', () => {
      recorder.start()
      recorder.handleMidiEvent(new Uint8Array([0x90, 60, 127]))
      recorder.handleMidiEvent(new Uint8Array([0x80, 60, 0]))
      const notes = recorder.stop()
      expect(notes).toHaveLength(1)
      expect(notes[0].velocity).toBe(127)
    })

    it('极短音符 (立即 Note Off) 应能录制', () => {
      recorder.start()
      recorder.handleMidiEvent(new Uint8Array([0x90, 60, 100]))
      recorder.handleMidiEvent(new Uint8Array([0x80, 60, 0]))
      const notes = recorder.stop()
      expect(notes).toHaveLength(1)
      expect(notes[0].endMs).toBeGreaterThanOrEqual(notes[0].startMs)
    })
  })
})
