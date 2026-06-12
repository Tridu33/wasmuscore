<script setup lang="ts">
import type { UploadFile } from 'element-plus'
import { CircleClose, UploadFilled, VideoPause, VideoPlay } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { onUnmounted } from 'vue'
import { useMidiStore } from '~/stores/midi'

const midiStore = useMidiStore()

// 初始化音频
async function handleInitAudio() {
  try {
    await midiStore.initAudio()
    if (midiStore.audioLoaded) {
      ElMessage.success('音频引擎初始化成功!')
    }
  }
  catch (e: any) {
    ElMessage.warning('音频初始化失败,但 MIDI 文件仍可加载')
  }
}

// 播放控制
async function handlePlay() {
  if (!midiStore.midiFile) {
    ElMessage.warning('Please load a MIDI file first')
    return
  }
  await midiStore.play()
  startPlaybackUpdate()
}

async function handlePause() {
  await midiStore.pause()
  stopPlaybackUpdate()
}

async function handleStop() {
  await midiStore.stop()
  stopPlaybackUpdate()
}

// 进度条控制
let isSeeking = false

function handleProgressStart() {
  isSeeking = true
}

async function handleProgressChange(value: number) {
  if (midiStore.midiFile) {
    const targetTime = (value / 100) * midiStore.midiFile.duration_ms
    await midiStore.seekTo(targetTime)
  }
}

function handleProgressEnd() {
  isSeeking = false
}

// 文件上传
async function handleFileUpload(uploadFile: UploadFile) {
  const file = uploadFile.raw
  if (!file) {
    return
  }

  if (!file.name.toLowerCase().endsWith('.mid') && !file.name.toLowerCase().endsWith('.midi')) {
    ElMessage.error('Please upload a valid MIDI file')
    return
  }

  const success = await midiStore.loadMidiFile(file)
  if (success) {
    ElMessage.success(`Loaded: ${file.name}`)
  }
}

// 定时更新播放状态
let updateInterval: number | null = null

function startPlaybackUpdate() {
  if (updateInterval) {
    return
  }

  updateInterval = window.setInterval(async () => {
    if (midiStore.playbackStatus.is_playing && !isSeeking) {
      await midiStore.updatePlaybackStatus()
      await midiStore.updateActiveNotes()

      // 检查是否播放完成
      if (midiStore.playbackStatus.is_finished) {
        stopPlaybackUpdate()
      }
    }
  }, 16) // ~60fps
}

function stopPlaybackUpdate() {
  if (updateInterval) {
    clearInterval(updateInterval)
    updateInterval = null
  }
}

// 组件卸载时清理
onUnmounted(() => {
  stopPlaybackUpdate()
})
</script>

<template>
  <div class="midi-player">
    <!-- 音频控制区 -->
    <el-card class="audio-control-card">
      <template #header>
        <div class="audio-header">
          <span>🎵 音频控制</span>
          <div class="audio-actions">
            <el-button
              size="small"
              :type="midiStore.audioLoaded ? 'success' : 'primary'"
              :loading="midiStore.audioLoading"
              :disabled="midiStore.audioLoaded"
              @click="handleInitAudio"
            >
              {{ midiStore.audioLoaded ? '✓ 已加载' : '初始化音频' }}
            </el-button>
            <div v-if="midiStore.audioLoaded" class="volume-control">
              <span class="volume-label">音量:</span>
              <el-slider
                v-model="midiStore.volume"
                :min="0"
                :max="100"
                :step="5"
                style="width: 120px"
                @change="(val: number) => midiStore.setVolume(val)"
              />
              <span class="volume-value">{{ midiStore.volume }}%</span>
            </div>
          </div>
        </div>
      </template>
      <el-alert
        v-if="!midiStore.audioLoaded && !midiStore.audioLoading"
        title="音频未初始化"
        description="点击“初始化音频”按钮加载 SoundFont,播放 MIDI 时将听到真实乐器声音"
        type="info"
        :closable="false"
        show-icon
      />
    </el-card>

    <!-- 钢琴卷帘可视化 -->
    <PianoRollVisualizer
      v-if="midiStore.midiFile"
      :notes="midiStore.allNotes"
      :active-notes="midiStore.activeNotes"
      :current-time="midiStore.playbackStatus.current_time_ms"
      :is-playing="midiStore.playbackStatus.is_playing"
    />

    <!-- 文件上传区域 -->
    <div class="upload-section">
      <el-upload
        class="upload-demo"
        drag
        :auto-upload="false"
        :on-change="handleFileUpload"
        accept=".mid,.midi"
        :limit="1"
      >
        <el-icon class="el-icon--upload">
          <UploadFilled />
        </el-icon>
        <div class="el-upload__text">
          Drop MIDI file here or <em>click to upload</em>
        </div>
      </el-upload>
    </div>

    <!-- 播放器控制区 -->
    <div v-if="midiStore.midiFile" class="player-controls">
      <!-- 文件信息 -->
      <div class="file-info">
        <h3>{{ midiStore.midiFile.name }}</h3>
        <p>
          {{ midiStore.midiFile.track_count }} tracks ·
          {{ midiStore.midiFile.note_count }} notes ·
          {{ midiStore.formatTime(midiStore.midiFile.duration_ms) }}
        </p>
      </div>

      <!-- 播放进度 -->
      <div class="progress-section">
        <span class="time-label">{{ midiStore.formatTime(midiStore.playbackStatus.current_time_ms) }}</span>
        <el-slider
          v-model="midiStore.playbackStatus.percentage"
          :min="0"
          :max="100"
          :format-tooltip="(val: number) => `${Math.round(val)}%`"
          @input="handleProgressChange"
          @dragging="handleProgressStart"
        />
        <span class="time-label">{{ midiStore.formatTime(midiStore.playbackStatus.total_duration_ms) }}</span>
      </div>

      <!-- 播放控制按钮 -->
      <div class="control-buttons">
        <el-button-group>
          <el-button type="primary" :icon="VideoPlay" @click="handlePlay">
            Play
          </el-button>
          <el-button type="warning" :icon="VideoPause" @click="handlePause">
            Pause
          </el-button>
          <el-button type="danger" :icon="CircleClose" @click="handleStop">
            Stop
          </el-button>
        </el-button-group>

        <div class="status-info">
          <el-tag v-if="midiStore.playbackStatus.is_playing" type="success">
            Playing
          </el-tag>
          <el-tag v-else-if="midiStore.playbackStatus.is_paused" type="warning">
            Paused
          </el-tag>
          <el-tag v-else type="info">
            Stopped
          </el-tag>
        </div>
      </div>

      <!-- 活动音符显示 -->
      <div v-if="midiStore.activeNotes.length > 0" class="active-notes">
        <h4>Active Notes</h4>
        <div class="notes-grid">
          <el-tag
            v-for="(note, index) in midiStore.activeNotes.slice(0, 20)"
            :key="index"
            :type="note.track_color_id % 2 === 0 ? 'primary' : 'success'"
            size="small"
          >
            Note {{ note.note }} (Vel: {{ note.velocity }})
          </el-tag>
        </div>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="midiStore.isLoading" class="loading-overlay">
      <el-progress type="circle" :percentage="50" :indeterminate="true" />
      <p>Loading MIDI file...</p>
    </div>

    <!-- 错误提示 -->
    <el-alert
      v-if="midiStore.error"
      :title="midiStore.error"
      type="error"
      :closable="true"
      show-icon
      class="error-alert"
    />
  </div>
</template>

<style scoped>
.midi-player {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
}

.audio-control-card {
  margin-bottom: 20px;
}

.audio-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  font-size: 16px;
}

.audio-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.volume-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.volume-label,
.volume-value {
  font-size: 13px;
  color: #666;
  white-space: nowrap;
}

.upload-section {
  margin-bottom: 30px;
}

.player-controls {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.file-info {
  margin-bottom: 20px;
  text-align: center;
}

.file-info h3 {
  margin: 0 0 8px 0;
  font-size: 20px;
  font-weight: 600;
}

.file-info p {
  margin: 0;
  color: #666;
  font-size: 14px;
}

.progress-section {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}

.time-label {
  min-width: 50px;
  font-size: 13px;
  font-family: monospace;
  color: #666;
}

.control-buttons {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.status-info {
  display: flex;
  gap: 8px;
}

.active-notes {
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  padding-top: 16px;
}

.active-notes h4 {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
}

.notes-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  color: white;
}

.loading-overlay p {
  margin-top: 16px;
  font-size: 16px;
}

.error-alert {
  margin-top: 20px;
}
</style>
