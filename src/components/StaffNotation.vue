<script setup lang="ts">
import type { ActiveNote, MidiNote } from '~/stores/midi'
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'
import { onMounted, onUnmounted, ref, watch } from 'vue'

interface Props {
  notes: MidiNote[]
  activeNotes: ActiveNote[]
  currentTime: number
  isPlaying: boolean
}

const props = defineProps<Props>()

const containerRef = ref<HTMLDivElement | null>(null)
const osmd = ref<OpenSheetMusicDisplay | null>(null)
const isLoading = ref(false)
const error = ref<string | null>(null)
const cursorPosition = ref(0)

// 将 MIDI 音符转换为 MusicXML 并渲染
async function renderStaffNotation() {
  if (!containerRef.value || props.notes.length === 0)
    return

  isLoading.value = true
  error.value = null

  try {
    // 生成 MusicXML 字符串
    const musicXML = generateMusicXML(props.notes)

    // 初始化 OSMD
    if (!osmd.value) {
      osmd.value = new OpenSheetMusicDisplay(containerRef.value, {
        autoResize: true,
        backend: 'svg',
        drawingParameters: 'default',
        drawPartNames: true,
        drawTitle: true,
        drawComposer: false,
        drawMeasureNumbers: true,
        drawFingerings: true,
        drawMetronomeMarks: true,
      })
    }

    // 加载 MusicXML
    await osmd.value.load(musicXML)

    // 渲染乐谱
    await osmd.value.render()

    // 设置光标
    if (osmd.value.Graphic) {
      osmd.value.Cursor?.hide()
    }
  }
  catch (err: any) {
    error.value = `Failed to render staff notation: ${err.message}`
    console.error(error.value)
  }
  finally {
    isLoading.value = false
  }
}

/**
 * 将 MIDI 音符转换为 MusicXML 格式
 */
function generateMusicXML(notes: MidiNote[]): string {
  if (notes.length === 0)
    return ''

  // 按时间排序音符
  const sortedNotes = [...notes].sort((a, b) => a.start_ms - b.start_ms)

  // 分组到小节 (每小节 4 拍，假设 4/4 拍)
  const measures: Map<number, any[]> = new Map()
  const msPerBeat = 60000 / 120 // 假设 120 BPM
  const msPerMeasure = msPerBeat * 4

  sortedNotes.forEach((note) => {
    const measureIndex = Math.floor(note.start_ms / msPerMeasure)
    if (!measures.has(measureIndex)) {
      measures.set(measureIndex, [])
    }
    measures.get(measureIndex)!.push(note)
  })

  // 生成 MusicXML
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN"
                                "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1">
      <part-name>Piano</part-name>
    </score-part>
  </part-list>
  <part id="P1">`

  // 生成每个小节
  let measureIndex = 0
  for (const [index, measureNotes] of measures) {
    // 填充空小节
    while (measureIndex < index) {
      xml += generateEmptyMeasure(measureIndex + 1)
      measureIndex++
    }

    xml += generateMeasure(measureIndex + 1, measureNotes, msPerMeasure)
    measureIndex++
  }

  xml += `
  </part>
</score-partwise>`

  return xml
}

/**
 * 生成空小节
 */
function generateEmptyMeasure(number: number): string {
  return `
    <measure number="${number}">
      <attributes>
        <divisions>1</divisions>
        <key>
          <fifths>0</fifths>
        </key>
        <time>
          <beats>4</beats>
          <beat-type>4</beat-type>
        </time>
        <clef>
          <sign>G</sign>
          <line>2</line>
        </clef>
      </attributes>
      <note>
        <rest/>
        <duration>4</duration>
        <type>whole</type>
      </note>
    </measure>`
}

/**
 * 生成包含音符的小节
 */
function generateMeasure(number: number, notes: any[], msPerMeasure: number): string {
  let xml = `
    <measure number="${number}">
      <attributes>
        <divisions>1</divisions>
        <key>
          <fifths>0</fifths>
        </key>
        <time>
          <beats>4</beats>
          <beat-type>4</beat-type>
        </time>
        <clef>
          <sign>G</sign>
          <line>2</line>
        </clef>
      </attributes>`

  // 将音符转换为 MusicXML note 元素
  notes.forEach((note) => {
    const noteElement = convertMidiToMusicXML(note)
    xml += noteElement
  })

  xml += `
    </measure>`

  return xml
}

/**
 * 将 MIDI 音符转换为 MusicXML note 元素
 */
function convertMidiToMusicXML(note: MidiNote): string {
  const pitch = midiToPitch(note.note)
  const noteType = getNoteType(note.duration_ms)

  return `
      <note>
        <pitch>
          <step>${pitch.step}</step>
          <octave>${pitch.octave}</octave>
          ${pitch.alter ? `<alter>${pitch.alter}</alter>` : ''}
        </pitch>
        <duration>1</duration>
        <type>${noteType}</type>
        <voice>1</voice>
      </note>`
}

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
  if (durationMs >= 1800)
    return 'whole'
  if (durationMs >= 900)
    return 'half'
  if (durationMs >= 450)
    return 'quarter'
  if (durationMs >= 225)
    return 'eighth'
  if (durationMs >= 112)
    return '16th'
  return '32nd'
}

/**
 * 高亮当前播放位置的音符
 */
function highlightCurrentNote() {
  if (!osmd.value || !osmd.value.Cursor)
    return

  // 简化处理：根据 currentTime 计算应该高亮的位置
  // 实际需要更复杂的光标逻辑
  const msPerBeat = 60000 / 120
  const currentBeat = props.currentTime / msPerBeat
  const currentMeasure = Math.floor(currentBeat / 4)

  // OSMD Cursor 可以定位到指定位置
  // 这里只是示意，完整实现需要遍历乐谱结构
  cursorPosition.value = currentMeasure
}

// 监听音符数据变化
watch(
  () => props.notes,
  () => {
    if (props.notes.length > 0) {
      renderStaffNotation()
    }
  },
  { deep: true },
)

// 监听播放进度，更新高亮
watch(
  () => props.currentTime,
  () => {
    if (props.isPlaying) {
      highlightCurrentNote()
    }
  },
)

onMounted(() => {
  if (props.notes.length > 0) {
    renderStaffNotation()
  }
})

onUnmounted(() => {
  if (osmd.value) {
    osmd.value = null
  }
})
</script>

<template>
  <div class="staff-notation">
    <div v-if="isLoading" class="loading-overlay">
      <el-icon class="is-loading">
        <Loading />
      </el-icon>
      <p>渲染五线谱中...</p>
    </div>

    <el-alert
      v-if="error"
      :title="error"
      type="error"
      :closable="true"
      show-icon
    />

    <div ref="containerRef" class="notation-container" />

    <div v-if="notes.length === 0 && !isLoading" class="empty-state">
      <p>🎼 上传 MIDI 文件后显示五线谱</p>
    </div>

    <!-- 播放位置指示器 -->
    <div v-if="isPlaying" class="playback-indicator">
      <el-tag type="success">
        播放中 - 小节 {{ cursorPosition + 1 }}
      </el-tag>
    </div>
  </div>
</template>

<style scoped>
.staff-notation {
  position: relative;
  width: 100%;
  min-height: 400px;
  background: #ffffff;
  border-radius: 8px;
  overflow: auto;
  margin-bottom: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.95);
  z-index: 10;
  color: #666;
}

.loading-overlay p {
  margin-top: 10px;
  font-size: 16px;
}

.notation-container {
  padding: 20px;
  min-height: 400px;
}

.empty-state {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: rgba(0, 0, 0, 0.3);
  font-size: 18px;
  text-align: center;
  pointer-events: none;
}

.playback-indicator {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 5;
}
</style>
