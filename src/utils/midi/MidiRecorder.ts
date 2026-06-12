/**
 * MIDI 录音引擎
 * 支持录制 MIDI 输入并导出为 MIDI 文件
 */

interface RecordedNote {
  note: number
  velocity: number
  channel: number
  startMs: number
  endMs: number | null
}

interface RecordedEvent {
  type: 'noteOn' | 'noteOff' | 'controlChange' | 'programChange'
  timestamp: number
  data: Uint8Array
}

export class MidiRecorder {
  private isRecording = false
  private startTime = 0
  private recordedNotes: RecordedNote[] = []
  private recordedEvents: RecordedEvent[] = []
  private activeNotes: Map<string, RecordedNote> = new Map()
  private onEventCallback: ((event: RecordedEvent) => void) | null = null

  /**
   * 开始录音
   */
  start() {
    if (this.isRecording) {
      throw new Error('已经在录音中')
    }

    this.isRecording = true
    this.startTime = Date.now()
    this.recordedNotes = []
    this.recordedEvents = []
    this.activeNotes = new Map()
  }

  /**
   * 停止录音
   */
  stop() {
    if (!this.isRecording) {
      throw new Error('未开始录音')
    }

    this.isRecording = false

    // 关闭所有未关闭的音符
    this.activeNotes.forEach((note) => {
      if (note.endMs === null) {
        note.endMs = Date.now() - this.startTime
      }
    })

    this.activeNotes.clear()

    return this.getRecordedNotes()
  }

  /**
   * 处理 MIDI 输入事件
   */
  handleMidiEvent(data: Uint8Array) {
    if (!this.isRecording) {
      return
    }

    const timestamp = Date.now() - this.startTime
    const status = data[0]
    const eventType = status & 0xF0
    const channel = status & 0x0F

    const event: RecordedEvent = {
      type: this.getEventType(eventType),
      timestamp,
      data,
    }

    this.recordedEvents.push(event)

    // 触发回调
    if (this.onEventCallback) {
      this.onEventCallback(event)
    }

    // 处理音符事件
    if (eventType === 0x90 && data[2] > 0) {
      // Note On
      this.handleNoteOn(data[1], data[2], channel, timestamp)
    }
    else if (eventType === 0x80 || (eventType === 0x90 && data[2] === 0)) {
      // Note Off
      this.handleNoteOff(data[1], channel, timestamp)
    }
  }

  /**
   * 获取录音结果
   */
  getRecordedNotes(): RecordedNote[] {
    return [...this.recordedNotes]
  }

  /**
   * 获取录音事件
   */
  getRecordedEvents(): RecordedEvent[] {
    return [...this.recordedEvents]
  }

  /**
   * 获取录音时长
   */
  getDuration(): number {
    if (!this.isRecording && this.recordedEvents.length === 0) {
      return 0
    }

    if (this.isRecording) {
      return Date.now() - this.startTime
    }

    return this.recordedEvents[this.recordedEvents.length - 1]?.timestamp || 0
  }

  /**
   * 设置事件回调
   */
  setOnEventCallback(callback: (event: RecordedEvent) => void) {
    this.onEventCallback = callback
  }

  /**
   * 清除录音数据
   */
  clear() {
    this.isRecording = false
    this.recordedNotes = []
    this.recordedEvents = []
    this.activeNotes.clear()
  }

  /**
   * 导出为 MIDI 文件 (标准格式)
   */
  exportToMidiFile(): Uint8Array {
    if (this.recordedNotes.length === 0) {
      throw new Error('没有可导出的录音数据')
    }

    // 构建 MIDI 文件
    const chunks: number[] = []

    // MIDI 文件头
    chunks.push(...this.buildHeader())

    // 音轨数据
    chunks.push(...this.buildTrack())

    return new Uint8Array(chunks)
  }

  /**
   * 导出为 JSON 格式
   */
  exportToJson(): string {
    return JSON.stringify({
      notes: this.recordedNotes,
      events: this.recordedEvents.map(e => ({
        type: e.type,
        timestamp: e.timestamp,
        data: Array.from(e.data),
      })),
      duration: this.getDuration(),
    }, null, 2)
  }

  // ========== 私有方法 ==========

  private handleNoteOn(note: number, velocity: number, channel: number, timestamp: number) {
    const key = `${channel}-${note}`
    const recordedNote: RecordedNote = {
      note,
      velocity,
      channel,
      startMs: timestamp,
      endMs: null,
    }

    this.activeNotes.set(key, recordedNote)
  }

  private handleNoteOff(note: number, channel: number, timestamp: number) {
    const key = `${channel}-${note}`
    const activeNote = this.activeNotes.get(key)

    if (activeNote) {
      activeNote.endMs = timestamp
      this.recordedNotes.push({ ...activeNote })
      this.activeNotes.delete(key)
    }
  }

  private getEventType(eventType: number): RecordedEvent['type'] {
    switch (eventType) {
      case 0x90:
      case 0x80:
        return eventType === 0x90 ? 'noteOn' : 'noteOff'
      case 0xB0:
        return 'controlChange'
      case 0xC0:
        return 'programChange'
      default:
        return 'noteOn'
    }
  }

  // ========== MIDI 文件构建 ==========

  private buildHeader(): number[] {
    const header: number[] = []

    // 'MThd'
    header.push(0x4D, 0x54, 0x68, 0x64)
    // Header length: 6
    header.push(0x00, 0x00, 0x00, 0x06)
    // Format: 1 (多音轨)
    header.push(0x00, 0x01)
    // Number of tracks: 2 (tempo track + note track)
    header.push(0x00, 0x02)
    // Ticks per quarter note: 480
    header.push(0x01, 0xE0)

    return header
  }

  private buildTrack(): number[] {
    const track: number[] = []

    // 音轨 1: Tempo 和元数据
    track.push(...this.buildTempoTrack())

    // 音轨 2: 音符数据
    track.push(...this.buildNoteTrack())

    return track
  }

  private buildTempoTrack(): number[] {
    const track: number[] = []

    // 'MTrk'
    track.push(0x4D, 0x54, 0x72, 0x6B)

    const trackData: number[] = []

    // Set tempo: 120 BPM (500000 microseconds per quarter note)
    trackData.push(0x00) // Delta time: 0
    trackData.push(0xFF, 0x51, 0x03) // Meta event: Set tempo
    trackData.push(0x07, 0xA1, 0x20) // 500000 microseconds

    // Time signature: 4/4
    trackData.push(0x00) // Delta time: 0
    trackData.push(0xFF, 0x58, 0x04) // Meta event: Time signature
    trackData.push(0x04, 0x02, 0x18, 0x08) // 4/4, MIDI clocks, 32nd notes

    // End of track
    trackData.push(0x00) // Delta time: 0
    trackData.push(0xFF, 0x2F, 0x00) // Meta event: End of track

    // Track length
    const trackLength = trackData.length
    track.push(
      (trackLength >> 24) & 0xFF,
      (trackLength >> 16) & 0xFF,
      (trackLength >> 8) & 0xFF,
      trackLength & 0xFF,
    )

    track.push(...trackData)

    return track
  }

  private buildNoteTrack(): number[] {
    const track: number[] = []

    // 'MTrk'
    track.push(0x4D, 0x54, 0x72, 0x6B)

    const events: Array<{ tick: number, data: number[] }> = []

    // 将毫秒转换为 MIDI ticks (假设 120 BPM, 480 ticks per quarter note)
    const msPerTick = 500000 / 480 / 1000

    this.recordedNotes.forEach((note) => {
      const startTick = Math.round(note.startMs / msPerTick)
      const endTick = Math.round(note.endMs! / msPerTick)

      // Note On
      events.push({
        tick: startTick,
        data: [
          0x90 | note.channel, // Note On, channel
          note.note,
          note.velocity,
        ],
      })

      // Note Off
      events.push({
        tick: endTick,
        data: [
          0x80 | note.channel, // Note Off, channel
          note.note,
          0x00,
        ],
      })
    })

    // 按时间排序
    events.sort((a, b) => a.tick - b.tick)

    // 构建音轨数据
    const trackData: number[] = []
    let lastTick = 0

    events.forEach((event) => {
      const deltaTick = event.tick - lastTick
      trackData.push(...this.encodeVariableLengthQuantity(deltaTick))
      trackData.push(...event.data)
      lastTick = event.tick
    })

    // End of track
    trackData.push(0x00) // Delta time: 0
    trackData.push(0xFF, 0x2F, 0x00) // Meta event: End of track

    // Track length
    const trackLength = trackData.length
    track.push(
      (trackLength >> 24) & 0xFF,
      (trackLength >> 16) & 0xFF,
      (trackLength >> 8) & 0xFF,
      trackLength & 0xFF,
    )

    track.push(...trackData)

    return track
  }

  private encodeVariableLengthQuantity(value: number): number[] {
    if (value < 0) {
      return [0]
    }

    const bytes: number[] = []
    let temp = value

    bytes.push(temp & 0x7F)
    temp >>= 7

    while (temp > 0) {
      bytes.push((temp & 0x7F) | 0x80)
      temp >>= 7
    }

    return bytes.reverse()
  }
}

export type { RecordedEvent, RecordedNote }
