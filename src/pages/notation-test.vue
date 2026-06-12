<script setup lang="ts">
import type { ActiveNote, MidiNote } from '~/stores/midi'
import { UploadFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { ref } from 'vue'
import StaffNotation from '~/components/StaffNotation.vue'

// 模拟 MIDI 数据用于测试
const testNotes = ref<MidiNote[]>([])
const testActiveNotes = ref<ActiveNote[]>([])
const currentTime = ref(0)
const isPlaying = ref(false)

// 生成测试音符
function generateTestNotes() {
  const notes: MidiNote[] = []
  const startTime = 0

  // 生成简单的旋律 (C大调音阶)
  const melody = [60, 62, 64, 65, 67, 69, 71, 72] // C4 D4 E4 F4 G4 A4 B5 C5

  melody.forEach((note, index) => {
    notes.push({
      note,
      start_ms: startTime + index * 500,
      duration_ms: 400,
      end_ms: startTime + index * 500 + 400,
      velocity: 80,
      track_color_id: 0,
    })
  })

  testNotes.value = notes
  ElMessage.success('已生成测试音符数据')
}

// 模拟播放
function togglePlay() {
  isPlaying.value = !isPlaying.value

  if (isPlaying.value) {
    ElMessage.info('开始播放')
    simulatePlayback()
  }
  else {
    ElMessage.info('暂停播放')
  }
}

// 模拟播放进度
function simulatePlayback() {
  if (!isPlaying.value || testNotes.value.length === 0) {
    return
  }

  const interval = setInterval(() => {
    if (!isPlaying.value) {
      clearInterval(interval)
      return
    }

    currentTime.value += 100

    // 更新活动音符
    testActiveNotes.value = testNotes.value.filter(
      n => currentTime.value >= n.start_ms && currentTime.value <= n.end_ms,
    ).map(n => ({
      note: n.note,
      velocity: n.velocity,
      channel: 0,
    }))

    // 循环播放
    if (currentTime.value > testNotes.value[testNotes.value.length - 1].end_ms + 1000) {
      currentTime.value = 0
    }
  }, 100)
}
</script>

<template>
  <div class="notation-test-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <h2>🎼 乐谱显示测试</h2>
          <div class="actions">
            <el-button type="primary" @click="generateTestNotes">
              生成测试数据
            </el-button>
            <el-button
              :type="isPlaying ? 'danger' : 'success'"
              @click="togglePlay"
            >
              {{ isPlaying ? '暂停' : '播放' }}
            </el-button>
          </div>
        </div>
      </template>

      <!-- 五线谱 -->
      <el-card class="notation-card" shadow="hover">
        <template #header>
          <h3>🎵 五线谱 (Staff Notation)</h3>
        </template>

        <StaffNotation
          :notes="testNotes"
          :active-notes="testActiveNotes"
          :current-time="currentTime"
          :is-playing="isPlaying"
        />
      </el-card>

      <!-- 简谱 -->
      <el-card class="notation-card" shadow="hover">
        <template #header>
          <h3>🎶 简谱 (Numbered Notation)</h3>
        </template>

        <NumberedNotation
          :notes="testNotes"
          :active-notes="testActiveNotes"
          :current-time="currentTime"
          :is-playing="isPlaying"
        />
      </el-card>

      <!-- 播放状态 -->
      <el-card v-if="testNotes.length > 0" class="status-card" shadow="hover">
        <template #header>
          <h3>📊 播放状态</h3>
        </template>

        <el-descriptions :column="3" border>
          <el-descriptions-item label="总音符数">
            {{ testNotes.length }}
          </el-descriptions-item>
          <el-descriptions-item label="当前时间">
            {{ (currentTime / 1000).toFixed(2) }}s
          </el-descriptions-item>
          <el-descriptions-item label="活动音符">
            {{ testActiveNotes.length }}
          </el-descriptions-item>
        </el-descriptions>
      </el-card>
    </el-card>
  </div>
</template>

<style scoped>
.notation-test-page {
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

.actions {
  display: flex;
  gap: 10px;
}

.notation-card,
.status-card {
  margin-top: 20px;
}
</style>
