<script setup lang="ts">
import type { RecordedEvent } from '~/utils/midi/MidiRecorder'
import { Download, Loading, Microphone } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, ref } from 'vue'
import { MidiRecorder } from '~/utils/midi/MidiRecorder'

interface Props {
  midiInput: WebMidi.MIDIInput | null
}

interface EmitEvents {
  recordingStart: []
  recordingStop: [notes: Array<{ note: number, velocity: number, channel: number, startMs: number, endMs: number }>]
}

const props = defineProps<Props>()
const emit = defineEmits<EmitEvents>()

const recorder = new MidiRecorder()
const isRecording = ref(false)
const recordingDuration = ref(0)
const recordedNoteCount = ref(0)
let durationInterval: number | null = null

// 格式化时长
const formattedDuration = computed(() => {
  const seconds = Math.floor(recordingDuration.value / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
})

// 开始录音
function startRecording() {
  if (!props.midiInput) {
    ElMessage.error('请先连接 MIDI 输入设备')
    return
  }

  try {
    recorder.start()
    isRecording.value = true
    recordingDuration.value = 0
    recordedNoteCount.value = 0

    // 设置 MIDI 输入监听
    props.midiInput.onmidimessage = handleMidiMessage

    // 更新时长
    durationInterval = window.setInterval(() => {
      recordingDuration.value = recorder.getDuration()
    }, 100)

    emit('recordingStart')
    ElMessage.success('开始录音')
  }
  catch {
    ElMessage.error('录音启动失败')
  }
}

// 停止录音
function stopRecording() {
  try {
    const notes = recorder.stop()
    isRecording.value = false
    recordedNoteCount.value = notes.length

    if (durationInterval) {
      clearInterval(durationInterval)
      durationInterval = null
    }

    emit('recordingStop', notes)
    ElMessage.success(`录音完成，共录制 ${notes.length} 个音符`)
  }
  catch {
    ElMessage.error('停止录音失败')
  }
}

// 处理 MIDI 消息
function handleMidiMessage(event: WebMidi.MIDIMessageEvent) {
  const data = new Uint8Array(event.data)
  recorder.handleMidiEvent(data)

  // 更新音符计数
  const eventType = data[0] & 0xF0
  if (eventType === 0x90 && data[2] > 0) {
    recordedNoteCount.value++
  }
}

// 导出为 MIDI 文件
function exportMidiFile() {
  try {
    const midiData = recorder.exportToMidiFile()
    const blob = new Blob([midiData], { type: 'audio/midi' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `recording_${Date.now()}.mid`
    link.click()
    URL.revokeObjectURL(url)

    ElMessage.success('MIDI 文件已导出')
  }
  catch {
    ElMessage.error('导出失败：没有录音数据')
  }
}

// 导出为 JSON
function exportJson() {
  try {
    const jsonData = recorder.exportToJson()
    const blob = new Blob([jsonData], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `recording_${Date.now()}.json`
    link.click()
    URL.revokeObjectURL(url)

    ElMessage.success('JSON 文件已导出')
  }
  catch {
    ElMessage.error('导出失败：没有录音数据')
  }
}

// 清除录音
function clearRecording() {
  recorder.clear()
  recordingDuration.value = 0
  recordedNoteCount.value = 0
  ElMessage.info('录音已清除')
}
</script>

<template>
  <div class="midi-recorder">
    <!-- 录音控制面板 -->
    <div class="recorder-controls">
      <div class="recorder-header">
        <h3>🎙️ MIDI 录音</h3>
        <el-tag v-if="isRecording" type="danger" effect="dark">
          <el-icon class="is-loading">
            <Loading />
          </el-icon>
          录音中
        </el-tag>
        <el-tag v-else type="info">
          未录音
        </el-tag>
      </div>

      <!-- 录音状态 -->
      <div class="recorder-status">
        <div class="status-item">
          <span class="label">时长:</span>
          <span class="value">{{ formattedDuration }}</span>
        </div>
        <div class="status-item">
          <span class="label">音符数:</span>
          <span class="value">{{ recordedNoteCount }}</span>
        </div>
        <div class="status-item">
          <span class="label">MIDI 输入:</span>
          <el-tag :type="midiInput ? 'success' : 'danger'" size="small">
            {{ midiInput ? '已连接' : '未连接' }}
          </el-tag>
        </div>
      </div>

      <!-- 控制按钮 -->
      <div class="recorder-buttons">
        <el-button
          v-if="!isRecording"
          type="danger"
          size="large"
          :icon="Microphone"
          :disabled="!midiInput"
          @click="startRecording"
        >
          开始录音
        </el-button>

        <el-button
          v-else
          type="warning"
          size="large"
          :icon="Loading"
          @click="stopRecording"
        >
          停止录音
        </el-button>

        <el-button
          :icon="Download"
          :disabled="recordedNoteCount === 0"
          @click="exportMidiFile"
        >
          导出 MIDI
        </el-button>

        <el-button
          :disabled="recordedNoteCount === 0"
          @click="exportJson"
        >
          导出 JSON
        </el-button>

        <el-button
          :disabled="recordedNoteCount === 0"
          @click="clearRecording"
        >
          清除
        </el-button>
      </div>
    </div>

    <!-- 录音提示 -->
    <div v-if="isRecording" class="recording-indicator">
      <div class="pulse-dot" />
      <span>正在录制 MIDI 输入...</span>
    </div>
  </div>
</template>

<style scoped>
.midi-recorder {
  background: #ffffff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.recorder-controls {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.recorder-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 15px;
  border-bottom: 2px solid #e4e7ed;
}

.recorder-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.recorder-status {
  display: flex;
  gap: 30px;
  padding: 15px;
  background: #f5f7fa;
  border-radius: 6px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.status-item .label {
  color: #606266;
  font-weight: 500;
}

.status-item .value {
  color: #303133;
  font-weight: 600;
  font-family: monospace;
  font-size: 16px;
}

.recorder-buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.recording-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 20px;
  padding: 15px;
  background: #fef0f0;
  border-radius: 6px;
  color: #f56c6c;
  font-weight: 600;
  animation: pulse 2s infinite;
}

.pulse-dot {
  width: 12px;
  height: 12px;
  background: #f56c6c;
  border-radius: 50%;
  animation: pulse-dot 1.5s infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

@keyframes pulse-dot {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.3);
  }
}
</style>
