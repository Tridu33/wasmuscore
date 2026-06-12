<script setup lang="ts">
import type { MidiNote } from '~/stores/midi'
import { ElMessage } from 'element-plus'
import { ref } from 'vue'
import MidiRecorder from '~/components/MidiRecorder.vue'
import PianoRoll from '~/components/PianoRoll.vue'

// MIDI 输入状态
const midiInput = ref<MIDIInput | null>(null)
const midiInputs = ref<MIDIInput[]>([])
const selectedInputIndex = ref(-1)

// 录音结果
const recordedNotes = ref<MidiNote[]>([])

// Web MIDI API
async function initWebMidi() {
  try {
    if (!navigator.requestMIDIAccess) {
      ElMessage.error('浏览器不支持 Web MIDI API')
      return
    }

    const midiAccess = await navigator.requestMIDIAccess({ sysex: false })

    const inputs: MIDIInput[] = []
    midiAccess.inputs.forEach((input) => {
      inputs.push(input)
    })

    midiInputs.value = inputs

    if (inputs.length > 0) {
      selectedInputIndex.value = 0
      midiInput.value = inputs[0]
      ElMessage.success(`找到 ${inputs.length} 个 MIDI 输入设备`)
    }
    else {
      ElMessage.warning('未找到 MIDI 输入设备')
    }

    // 监听设备变化
    midiAccess.onstatechange = () => {
      const newInputs: MIDIInput[] = []
      midiAccess.inputs.forEach((input) => {
        newInputs.push(input)
      })
      midiInputs.value = newInputs
    }
  }
  catch {
    ElMessage.error('无法访问 MIDI 设备')
  }
}

// 选择 MIDI 输入
function selectMidiInput(index: number) {
  selectedInputIndex.value = index
  midiInput.value = midiInputs.value[index]
  ElMessage.success(`已选择: ${midiInput.value.name}`)
}

// 处理录音停止
function handleRecordingStop(notes: Array<{ note: number, velocity: number, channel: number, startMs: number, endMs: number }>) {
  // 转换为 MidiNote 格式
  recordedNotes.value = notes.map(note => ({
    note: note.note,
    velocity: note.velocity,
    channel: note.channel,
    track_id: 0,
    track_color_id: 0,
    start_ms: note.startMs,
    end_ms: note.endMs,
    duration_ms: note.endMs - note.startMs,
  }))

  ElMessage.success(`录制了 ${notes.length} 个音符`)
}

// 初始化
initWebMidi()
</script>

<template>
  <div class="recording-test-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <h2>🎙️ MIDI 录音测试</h2>
          <el-button type="primary" @click="initWebMidi">
            刷新 MIDI 设备
          </el-button>
        </div>
      </template>

      <!-- MIDI 输入选择 -->
      <el-card class="section-card" shadow="hover">
        <template #header>
          <h3>🎹 MIDI 输入设备</h3>
        </template>

        <el-radio-group v-model="selectedInputIndex" @change="selectMidiInput">
          <el-radio
            v-for="(input, index) in midiInputs"
            :key="index"
            :label="index"
            :value="index"
          >
            {{ input.name }} ({{ input.manufacturer || 'Unknown' }})
          </el-radio>
        </el-radio-group>

        <el-empty v-if="midiInputs.length === 0" description="未找到 MIDI 输入设备">
          <el-button type="primary" @click="initWebMidi">
            重新扫描
          </el-button>
        </el-empty>
      </el-card>

      <!-- 录音控制 -->
      <el-card class="section-card" shadow="hover">
        <MidiRecorder
          :midi-input="midiInput"
          @recording-stop="handleRecordingStop"
        />
      </el-card>

      <!-- 录音结果显示 -->
      <el-card v-if="recordedNotes.length > 0" class="section-card" shadow="hover">
        <template #header>
          <h3>📊 录音结果 ({{ recordedNotes.length }} 个音符)</h3>
        </template>

        <PianoRoll
          :notes="recordedNotes"
          :active-notes="[]"
          :current-time="0"
          :is-playing="false"
        />
      </el-card>

      <!-- 使用说明 -->
      <el-card class="section-card" shadow="hover">
        <template #header>
          <h3>📖 使用说明</h3>
        </template>

        <el-steps :active="0" align-center>
          <el-step title="连接设备" description="选择 MIDI 输入设备" />
          <el-step title="开始录音" description="点击开始录音按钮" />
          <el-step title="演奏" description="在 MIDI 键盘上演奏" />
          <el-step title="停止" description="点击停止录音" />
          <el-step title="导出" description="导出为 MIDI 或 JSON" />
        </el-steps>

        <el-alert
          style="margin-top: 20px"
          title="提示"
          type="info"
          :closable="false"
        >
          <template #default>
            <p>• 支持录制所有 MIDI 通道</p>
            <p>• 自动记录音符的开始和结束时间</p>
            <p>• 可导出为标准 MIDI 文件 (.mid)</p>
            <p>• 可导出为 JSON 格式用于进一步处理</p>
          </template>
        </el-alert>
      </el-card>
    </el-card>
  </div>
</template>

<style scoped>
.recording-test-page {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}

.section-card {
  margin-top: 20px;
}
</style>
