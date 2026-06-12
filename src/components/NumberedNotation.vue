<script setup lang="ts">
import type { ActiveNote, MidiNote } from '~/stores/midi'
import { computed, watch } from 'vue'

interface Props {
  notes: MidiNote[]
  activeNotes: ActiveNote[]
  currentTime: number
  isPlaying: boolean
}

const props = defineProps<Props>()

// 简谱配置
const BEATS_PER_MEASURE = 4
const BPM = 120
const MS_PER_BEAT = 60000 / BPM
const MS_PER_MEASURE = MS_PER_BEAT * BEATS_PER_MEASURE

// 音高到简谱数字的映射
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

// 将音符分组到小节
const measures = computed(() => {
  if (props.notes.length === 0) {
    return []
  }

  const measureMap: Map<number, any[]> = new Map()

  props.notes.forEach((note) => {
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
})

// 判断音符是否正在播放
function isNoteActive(note: MidiNote): boolean {
  return props.activeNotes.some(n => n.note === note.note)
}

// 获取音符时值类型
function getNoteDurationType(durationMs: number): string {
  const beats = durationMs / MS_PER_BEAT

  if (beats >= 3.5) {
    return 'whole'
  }
  if (beats >= 1.5) {
    return 'half'
  }
  if (beats >= 0.75) {
    return 'quarter'
  }
  if (beats >= 0.375) {
    return 'eighth'
  }
  return 'sixteenth'
}

// 渲染时值下划线
function renderDurationLines(note: MidiNote): string {
  const durationType = getNoteDurationType(note.duration_ms)

  if (durationType === 'whole') {
    return '— — —'
  }
  if (durationType === 'half') {
    return '— —'
  }
  if (durationType === 'quarter') {
    return ''
  }
  if (durationType === 'eighth') {
    return '—'
  }
  return '═'
}

// 渲染八度点
function renderOctaveDots(octave: number) {
  if (octave > 0) {
    return { high: octave, low: 0 }
  }
  if (octave < 0) {
    return { high: 0, low: Math.abs(octave) }
  }
  return { high: 0, low: 0 }
}

watch(
  () => props.notes,
  () => {
    // 音符变化时重新渲染
  },
  { deep: true },
)
</script>

<template>
  <div class="numbered-notation">
    <div v-if="notes.length === 0" class="empty-state">
      <p>🎵 上传 MIDI 文件后显示简谱</p>
    </div>

    <div v-else class="notation-content">
      <!-- 乐谱信息 -->
      <div class="score-info">
        <div class="info-item">
          <span class="label">调号:</span>
          <span class="value">C 大调</span>
        </div>
        <div class="info-item">
          <span class="label">拍号:</span>
          <span class="value">{{ BEATS_PER_MEASURE }}/4</span>
        </div>
        <div class="info-item">
          <span class="label">速度:</span>
          <span class="value">{{ BPM }} BPM</span>
        </div>
      </div>

      <!-- 简谱内容 -->
      <div class="measures-container">
        <div
          v-for="measure in measures"
          :key="measure.index"
          class="measure"
          :class="{ 'current-measure': isPlaying && Math.floor(currentTime / MS_PER_MEASURE) === measure.index }"
        >
          <!-- 小节号 -->
          <div class="measure-number">
            {{ measure.index + 1 }}
          </div>

          <!-- 音符 -->
          <div class="notes-row">
            <div
              v-for="note in measure.notes"
              :key="`${note.note}-${note.start_ms}`"
              class="note-item"
              :class="{ active: isNoteActive(note) }"
            >
              <div class="note-content">
                <!-- 高音点 -->
                <div
                  v-for="i in renderOctaveDots(midiToNumberedNote(note.note).octave).high"
                  :key="`high-${i}`"
                  class="dot high-dot"
                />

                <!-- 简谱数字 -->
                <span class="note-number">
                  {{ midiToNumberedNote(note.note).number }}
                  <span v-if="midiToNumberedNote(note.note).isSharp" class="accidental">#</span>
                </span>

                <!-- 低音点 -->
                <div
                  v-for="i in renderOctaveDots(midiToNumberedNote(note.note).octave).low"
                  :key="`low-${i}`"
                  class="dot low-dot"
                />

                <!-- 时值下划线 -->
                <div class="duration-lines">
                  {{ renderDurationLines(note) }}
                </div>
              </div>
            </div>

            <!-- 小节线 -->
            <div class="bar-line" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.numbered-notation {
  position: relative;
  width: 100%;
  min-height: 300px;
  background: #ffffff;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  overflow-x: auto;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  color: rgba(0, 0, 0, 0.3);
  font-size: 18px;
}

.notation-content {
  width: 100%;
}

.score-info {
  display: flex;
  gap: 30px;
  margin-bottom: 20px;
  padding: 15px;
  background: #f5f7fa;
  border-radius: 6px;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.info-item .label {
  color: #606266;
  font-weight: 500;
}

.info-item .value {
  color: #303133;
  font-weight: 600;
}

.measures-container {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
}

.measure {
  display: flex;
  gap: 10px;
  padding: 15px;
  background: #fafafa;
  border-radius: 6px;
  border: 2px solid transparent;
  transition: all 0.3s ease;
}

.measure.current-measure {
  background: #e6f7ff;
  border-color: #409eff;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.3);
}

.measure-number {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  min-width: 30px;
  font-size: 12px;
  color: #909399;
  font-weight: 600;
  padding-top: 10px;
}

.notes-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.note-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px;
  border-radius: 4px;
  transition: all 0.2s ease;
  min-width: 40px;
}

.note-item.active {
  background: #fef0f0;
  transform: scale(1.1);
  box-shadow: 0 2px 8px rgba(255, 0, 0, 0.2);
}

.note-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.note-number {
  font-size: 24px;
  font-weight: bold;
  color: #303133;
  line-height: 1;
  position: relative;
}

.note-item.active .note-number {
  color: #f56c6c;
}

.accidental {
  font-size: 14px;
  vertical-align: super;
  color: #606266;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #303133;
}

.high-dot {
  align-self: center;
  margin-bottom: 2px;
}

.low-dot {
  align-self: center;
  margin-top: 2px;
}

.duration-lines {
  font-size: 20px;
  color: #303133;
  font-weight: bold;
  line-height: 1;
  margin-top: 4px;
}

.bar-line {
  width: 2px;
  height: 60px;
  background: #303133;
  margin: 0 5px;
}
</style>
