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

// 吉他标准调弦 (E A D G B E)
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

// MIDI note 转换为吉他品格
function midiToFret(midiNote: number, stringMidi: number): number {
  return midiNote - stringMidi
}

// 查找音符在吉他上的最佳位置
function findBestFretPosition(midiNote: number): { stringIndex: number, fret: number } | null {
  // 从高音弦到低音弦查找
  for (let i = GUITAR_STRINGS.length - 1; i >= 0; i--) {
    const fret = midiToFret(midiNote, GUITAR_STRINGS[i].midi)
    // 品格必须在 0-24 范围内（吉他的有效品格）
    if (fret >= 0 && fret <= 24) {
      return { stringIndex: i, fret }
    }
  }
  return null
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

// 渲染品格数字
function renderFretNumber(fret: number): string {
  if (fret >= 10) {
    return fret.toString()
  }
  return fret.toString()
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
  <div class="guitar-tab">
    <div v-if="notes.length === 0" class="empty-state">
      <p>🎸 上传 MIDI 文件后显示吉他 TAB 谱</p>
    </div>

    <div v-else class="tab-content">
      <!-- 乐谱信息 -->
      <div class="tab-info">
        <div class="info-item">
          <span class="label">调弦:</span>
          <span class="value">Standard (E A D G B E)</span>
        </div>
        <div class="info-item">
          <span class="label">弦数:</span>
          <span class="value">6</span>
        </div>
        <div class="info-item">
          <span class="label">品格范围:</span>
          <span class="value">0-24</span>
        </div>
      </div>

      <!-- TAB 谱内容 -->
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

          <!-- 六线谱 -->
          <div class="tab-staff">
            <div
              v-for="(stringData, stringIndex) in GUITAR_STRINGS"
              :key="stringIndex"
              class="tab-line"
            >
              <!-- 弦名 -->
              <div class="string-name" :style="{ color: stringData.color }">
                {{ stringData.name }}
              </div>

              <!-- 谱线 -->
              <div class="staff-line" />

              <!-- 音符 -->
              <div class="tab-notes">
                <div
                  v-for="note in measure.notes"
                  :key="`${note.note}-${note.start_ms}`"
                  class="tab-note"
                  :class="{ active: isNoteActive(note) }"
                >
                  <template v-if="findBestFretPosition(note.note)">
                    <!-- 只显示在对应弦上的音符 -->
                    <template v-if="findBestFretPosition(note.note)!.stringIndex === stringIndex">
                      <span class="fret-number">
                        {{ renderFretNumber(findBestFretPosition(note.note)!.fret) }}
                      </span>
                    </template>
                  </template>
                </div>
              </div>
            </div>
          </div>

          <!-- 小节线 -->
          <div class="bar-line" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.guitar-tab {
  position: relative;
  width: 100%;
  min-height: 400px;
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
  min-height: 400px;
  color: rgba(0, 0, 0, 0.3);
  font-size: 18px;
}

.tab-content {
  width: 100%;
}

.tab-info {
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
  flex-direction: column;
  gap: 20px;
}

.measure {
  display: flex;
  gap: 15px;
  padding: 20px;
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
  min-width: 40px;
  font-size: 14px;
  color: #909399;
  font-weight: 600;
  padding-top: 10px;
}

.tab-staff {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
}

.tab-line {
  display: flex;
  align-items: center;
  gap: 10px;
  position: relative;
}

.string-name {
  min-width: 30px;
  font-weight: 600;
  font-size: 14px;
  text-align: center;
}

.staff-line {
  flex: 1;
  height: 2px;
  background: #303133;
  position: relative;
}

.tab-notes {
  position: absolute;
  left: 40px;
  right: 0;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.tab-note {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 30px;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.tab-note.active {
  background: #fef0f0;
  transform: scale(1.2);
  box-shadow: 0 2px 8px rgba(255, 0, 0, 0.3);
}

.fret-number {
  font-size: 18px;
  font-weight: bold;
  color: #303133;
  background: #ffffff;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid #dcdfe6;
}

.tab-note.active .fret-number {
  color: #f56c6c;
  border-color: #f56c6c;
  background: #fef0f0;
}

.bar-line {
  width: 3px;
  height: 200px;
  background: #303133;
  margin: 0 10px;
}
</style>
