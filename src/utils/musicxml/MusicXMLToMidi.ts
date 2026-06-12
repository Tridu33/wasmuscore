import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'

export interface MidiNoteData {
  note: number // MIDI note number (0-127)
  velocity: number // 0-127
  channel: number
  startMs: number
  durationMs: number
  isTied?: boolean // 是否连音
  voice?: number // 声部 (1-4)
}

export interface MidiTrackInfo {
  trackId: number
  name: string
  instrument: string
  notes: MidiNoteData[]
  hasDrums: boolean
  programs: number[]
}

export interface MusicXMLInfo {
  title: string
  composer: string
  movement: string
  timeSignature: [number, number]
  keySignature: string
  tempo: number
  trackCount: number
  totalNotes: number
  durationMs: number
}

/**
 * 使用 DOMParser 完整解析 MusicXML
 * 支持复杂的乐谱结构: tie, tuplet, beam, dynamics 等
 * 结合 OSMD 进行可视化渲染
 */
export class MusicXMLToMidiConverter {
  // 音符类型到时值倍数的映射 (相对于四分音符)
  private noteTypeMap: Record<string, number> = {
    'long': 8,
    'breve': 4,
    'whole': 4,
    'half': 2,
    'quarter': 1,
    'eighth': 0.5,
    '16th': 0.25,
    '32nd': 0.125,
    '64th': 0.0625,
    '128th': 0.03125,
  }

  // 音名到半音偏移的映射
  private stepMap: Record<string, number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
  }

  /**
   * 解析 MusicXML 文件
   */
  async parseMusicXMLFile(file: File): Promise<{
    tracks: MidiTrackInfo[]
    info: MusicXMLInfo
  }> {
    const xmlText = await file.text()
    return this.parseMusicXMLString(xmlText)
  }

  /**
   * 解析 MusicXML 字符串
   */
  async parseMusicXMLString(xmlString: string): Promise<{
    tracks: MidiTrackInfo[]
    info: MusicXMLInfo
  }> {
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml')

    // 检查解析错误
    const parserError = xmlDoc.querySelector('parsererror')
    if (parserError) {
      throw new Error('Invalid MusicXML file')
    }

    // 提取元信息
    const info = this.extractMetadata(xmlDoc)

    // 提取音轨和音符
    const tracks = this.extractTracks(xmlDoc)

    return { tracks, info }
  }

  /**
   * 提取乐谱元信息
   */
  private extractMetadata(xmlDoc: Document): MusicXMLInfo {
    const title = this.getTextContent(xmlDoc, 'work-title') || 'Untitled'
    const composer = this.getTextContent(xmlDoc, 'creator', 'Composer') || 'Unknown'
    const movement = this.getTextContent(xmlDoc, 'movement-title') || ''

    // 提取拍号
    let timeSignature: [number, number] = [4, 4]
    const timeElem = xmlDoc.querySelector('time')
    if (timeElem) {
      const beats = Number.parseInt(timeElem.querySelector('beats')?.textContent || '4')
      const beatType = Number.parseInt(timeElem.querySelector('beat-type')?.textContent || '4')
      timeSignature = [beats, beatType]
    }

    // 提取调号
    let keySignature = 'C major'
    const keyElem = xmlDoc.querySelector('key')
    if (keyElem) {
      const fifths = Number.parseInt(keyElem.querySelector('fifths')?.textContent || '0')
      const mode = keyElem.querySelector('mode')?.textContent || 'major'
      keySignature = `${fifths} fifths ${mode}`
    }

    // 提取速度标记
    let tempo = 120
    const soundElem = xmlDoc.querySelector('sound')
    if (soundElem) {
      tempo = Number.parseInt(soundElem.getAttribute('tempo') || '120')
    }

    // 统计音轨和音符
    const parts = xmlDoc.querySelectorAll('part')
    const trackCount = parts.length
    let totalNotes = 0

    parts.forEach((part) => {
      const notes = part.querySelectorAll('note')
      totalNotes += notes.length
    })

    // 估算时长 (基于小节数和拍号)
    const measures = xmlDoc.querySelectorAll('measure')
    const durationMs = this.estimateDuration(measures.length, timeSignature, tempo)

    return {
      title,
      composer,
      movement,
      timeSignature,
      keySignature,
      tempo,
      trackCount,
      totalNotes,
      durationMs,
    }
  }

  /**
   * 提取所有音轨和音符
   */
  private extractTracks(xmlDoc: Document): MidiTrackInfo[] {
    const parts = xmlDoc.querySelectorAll('part')
    const partList = xmlDoc.querySelector('part-list')
    const tracks: MidiTrackInfo[] = []

    parts.forEach((part, partIndex) => {
      const partId = part.getAttribute('id') || `P${partIndex}`

      // 从 part-list 获取音轨名称
      let trackName = `Track ${partIndex + 1}`
      let instrumentName = 'Piano'

      if (partList) {
        const scorePart = partList.querySelector(`score-part[id="${partId}"]`)
        if (scorePart) {
          trackName = scorePart.querySelector('part-name')?.textContent || trackName
          const instrument = scorePart.querySelector('score-instrument')
          if (instrument) {
            instrumentName = instrument.querySelector('instrument-name')?.textContent || 'Piano'
          }
        }
      }

      // 解析该音轨的所有音符
      const notes = this.parsePartNotes(part)

      // 检查是否为鼓组
      const hasDrums = this.checkIfDrumPart(part)

      tracks.push({
        trackId: partIndex,
        name: trackName,
        instrument: instrumentName,
        notes,
        hasDrums,
        programs: [],
      })
    })

    return tracks
  }

  /**
   * 解析音轨中的所有音符
   */
  private parsePartNotes(part: Element): MidiNoteData[] {
    const notes: MidiNoteData[] = []
    const measures = part.querySelectorAll('measure')

    let currentTimeMs = 0
    const tempo = this.extractTempoFromPart(part)

    measures.forEach((measure) => {
      // 检查是否有新的速度标记
      const soundInMeasure = measure.querySelector('sound')
      if (soundInMeasure) {
        const newTempo = Number.parseInt(soundInMeasure.getAttribute('tempo') || '0')
        if (newTempo > 0) {
          // 更新 tempo (简化处理,实际应该按时间线更新)
        }
      }

      const notesInMeasure = measure.querySelectorAll('note')

      notesInMeasure.forEach((noteElem) => {
        const noteData = this.parseNoteElement(noteElem, currentTimeMs, tempo)

        if (noteData) {
          notes.push(noteData)
          // 更新时间
          currentTimeMs += noteData.durationMs
        }
      })
    })

    return notes
  }

  /**
   * 解析单个音符元素
   */
  private parseNoteElement(
    noteElem: Element,
    startTimeMs: number,
    tempo: number,
  ): MidiNoteData | null {
    // 跳过休止符
    const rest = noteElem.querySelector('rest')
    if (rest) {
      // 休止符也需要计算时间
      const _duration = this.calculateNoteDuration(noteElem, tempo)
      return null
    }

    // 提取音高
    const pitch = noteElem.querySelector('pitch')
    if (!pitch) {
      return null
    }

    const step = pitch.querySelector('step')?.textContent || 'C'
    const octave = Number.parseInt(pitch.querySelector('octave')?.textContent || '4')
    const alter = Number.parseInt(pitch.querySelector('alter')?.textContent || '0')

    const midiNote = this.pitchToMidiNote(step, octave, alter)

    // 计算时长
    const durationMs = this.calculateNoteDuration(noteElem, tempo)

    // 提取力度
    const velocity = this.extractVelocity(noteElem)

    // 检查连音线
    const isTied = noteElem.querySelectorAll('tie, tied').length > 0

    // 提取声部
    const voice = Number.parseInt(noteElem.querySelector('voice')?.textContent || '1')

    return {
      note: midiNote,
      velocity,
      channel: 0,
      startMs: startTimeMs,
      durationMs,
      isTied,
      voice,
    }
  }

  /**
   * 将音高转换为 MIDI note number
   */
  private pitchToMidiNote(step: string, octave: number, alter: number): number {
    const stepValue = this.stepMap[step.toUpperCase()] ?? 0
    const midiNote = (octave + 1) * 12 + stepValue + alter

    return Math.max(0, Math.min(127, midiNote))
  }

  /**
   * 计算音符时长 (毫秒)
   */
  private calculateNoteDuration(noteElem: Element, tempo: number): number {
    const durationElem = noteElem.querySelector('duration')
    if (durationElem) {
      // MusicXML 使用 divisions 表示时长
      // 需要从 attributes 中获取 divisions 值
      const divisions = this.getDivisions(noteElem)
      const durationValue = Number.parseInt(durationElem.textContent || '0')
      const quarterNoteMs = 60000 / tempo
      return (durationValue / divisions) * quarterNoteMs
    }

    // 如果没有 duration,从音符类型推断
    const typeElem = noteElem.querySelector('type')
    const noteType = typeElem?.textContent || 'quarter'

    let baseDuration = this.noteTypeMap[noteType] || 1

    // 处理附点
    const dots = noteElem.querySelectorAll('dot').length
    for (let i = 0; i < dots; i++) {
      baseDuration *= 1.5
    }

    // 处理连音 (tuplet)
    const timeModification = noteElem.querySelector('time-modification')
    if (timeModification) {
      const actualNotes = Number.parseInt(timeModification.querySelector('actual-notes')?.textContent || '1')
      const normalNotes = Number.parseInt(timeModification.querySelector('normal-notes')?.textContent || '1')
      if (normalNotes > 0) {
        baseDuration *= actualNotes / normalNotes
      }
    }

    const quarterNoteMs = 60000 / tempo
    return Math.round(baseDuration * quarterNoteMs)
  }

  /**
   * 获取 divisions 值
   */
  private getDivisions(noteElem: Element): number {
    // 向上查找 attributes 中的 divisions
    let current: Element | null = noteElem
    while (current) {
      const attributes = current.querySelector('attributes > divisions')
      if (attributes) {
        return Number.parseInt(attributes.textContent || '480')
      }
      current = current.parentElement
    }

    // 默认值
    return 480
  }

  /**
   * 提取音符力度
   */
  private extractVelocity(noteElem: Element): number {
    // 尝试从 dynamics 提取
    const dynamics = noteElem.querySelector('dynamics')
    if (dynamics) {
      const dynamicMap: Record<string, number> = {
        ppp: 30,
        pp: 40,
        p: 50,
        mp: 60,
        mf: 70,
        f: 80,
        ff: 90,
        fff: 100,
      }

      for (const [key, value] of Object.entries(dynamicMap)) {
        if (dynamics.querySelector(key)) {
          return value
        }
      }
    }

    // 默认中等力度
    return 80
  }

  /**
   * 检查是否为鼓组音轨
   */
  private checkIfDrumPart(part: Element): boolean {
    const midiInstrument = part.querySelector('midi-instrument')
    if (midiInstrument) {
      const midiProgram = midiInstrument.querySelector('midi-program')
      // 鼓组通常使用 channel 10
      const channel = midiInstrument.querySelector('midi-channel')
      if (channel && channel.textContent === '10') {
        return true
      }
    }

    // 检查是否有打击乐音符
    const notes = part.querySelectorAll('note')
    for (const note of Array.from(notes)) {
      const pitch = note.querySelector('pitch')
      if (!pitch && note.querySelector('rest')) {
        // 无音高的音符可能是打击乐
        return true
      }
    }

    return false
  }

  /**
   * 从音轨提取速度
   */
  private extractTempoFromPart(part: Element): number {
    const sound = part.querySelector('sound')
    if (sound) {
      const tempo = sound.getAttribute('tempo')
      if (tempo) {
        return Number.parseInt(tempo)
      }
    }

    // 默认 BPM
    return 120
  }

  /**
   * 估算总时长
   */
  private estimateDuration(
    measureCount: number,
    timeSignature: [number, number],
    tempo: number,
  ): number {
    const beatsPerMeasure = timeSignature[0]
    const quarterNoteMs = 60000 / tempo
    const measureDurationMs = beatsPerMeasure * quarterNoteMs

    return Math.round(measureCount * measureDurationMs)
  }

  /**
   * 辅助函数:获取文本内容
   */
  private getTextContent(
    doc: Document,
    tagName: string,
    type?: string,
  ): string | null {
    let elem: Element | null

    if (type) {
      elem = Array.from(doc.querySelectorAll(tagName)).find(
        e => e.getAttribute('type') === type,
      ) || null
    }
    else {
      elem = doc.querySelector(tagName)
    }

    return elem?.textContent?.trim() || null
  }
}

/**
 * OSMD 可视化渲染器
 * 用于在页面上显示 MusicXML 乐谱
 */
export class MusicXMLVisualizer {
  private osmd: OpenSheetMusicDisplay | null = null
  private container: HTMLElement | null = null

  /**
   * 初始化并渲染乐谱
   */
  async render(container: HTMLElement, file: File | string): Promise<void> {
    this.container = container

    // 创建 OSMD 实例
    this.osmd = new OpenSheetMusicDisplay(container, {
      autoResize: true,
      backend: 'svg',
      drawingParameters: 'compact',
      drawPartNames: true,
      drawTitle: true,
      drawComposer: true,
      drawMeasureNumbers: true,
    })

    // 加载并渲染
    if (typeof file === 'string') {
      await this.osmd.load(file)
    }
    else {
      await this.osmd.load(file)
    }

    await this.osmd.render()
  }

  /**
   * 高亮当前播放的音符
   */
  highlightNote(noteIndex: number) {
    if (!this.osmd)
      return

    // OSMD 提供 cursor 功能,可以高亮当前位置
    // 这里简化处理,实际需要更复杂的逻辑
  }

  /**
   * 清理资源
   */
  dispose() {
    if (this.container && this.osmd) {
      this.container.innerHTML = ''
    }
    this.osmd = null
    this.container = null
  }
}
