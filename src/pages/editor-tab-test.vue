<script setup lang="ts">
import type { ActiveNote, MidiNote } from '~/stores/midi'
import { ElMessage } from 'element-plus'
import { ref } from 'vue'
import GuitarTab from '~/components/GuitarTab.vue'
import StaffEditor from '~/components/StaffEditor.vue'
import StaffNotation from '~/components/StaffNotation.vue'

// 编辑状态
const editableNotes = ref<MidiNote[]>([])
const testActiveNotes = ref<ActiveNote[]>([])
const currentTime = ref(0)
const isPlaying = ref(false)

// 生成测试数据
function generateTestData() {
  const notes: MidiNote[] = []
  const startTime = 0

  // 生成吉他友好的音符 (E2-E5 范围)
  const melody = [
    64,
    67,
    69,
    71,
    72,
    71,
    69,
    67,
    64,
    60,
    57,
    55,
    52,
    55,
    57,
    60,
  ]

  melody.forEach((note, index) => {
    notes.push({
      note,
      start_ms: startTime + index * 500,
      duration_ms: 400,
      end_ms: startTime + index * 500 + 400,
      velocity: 60 + Math.floor(Math.random() * 40),
      track_color_id: 0,
      channel: 0,
      track_id: 0,
    })
  })

  editableNotes.value = notes
  ElMessage.success('已生成吉他测试音符数据')
}

// 处理音符更新
function handleNotesUpdate(notes: MidiNote[]) {
  editableNotes.value = notes
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
  if (!isPlaying.value || editableNotes.value.length === 0) {
    return
  }

  const interval = setInterval(() => {
    if (!isPlaying.value) {
      clearInterval(interval)
      return
    }

    currentTime.value += 100

    // 更新活动音符
    testActiveNotes.value = editableNotes.value.filter(
      n => currentTime.value >= n.start_ms && currentTime.value <= n.end_ms,
    ).map(n => ({
      note: n.note,
      velocity: n.velocity,
      channel: 0,
      track_id: n.track_id,
      track_color_id: n.track_color_id,
      timestamp_ms: currentTime.value,
    }))

    // 循环播放
    if (currentTime.value > editableNotes.value[editableNotes.value.length - 1].end_ms + 1000) {
      currentTime.value = 0
    }
  }, 100)
}
</script>

<template>
  <div class="editor-tab-test-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <h2>🎸 乐谱编辑与吉他 TAB 测试</h2>
          <div class="actions">
            <el-button type="primary" @click="generateTestData">
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

      <!-- 乐谱编辑器 -->
      <el-card class="section-card" shadow="hover">
        <template #header>
          <h3>✏️ 乐谱编辑器 (Staff Editor)</h3>
        </template>

        <StaffEditor
          :notes="editableNotes"
          :active-notes="testActiveNotes"
          :current-time="currentTime"
          :is-playing="isPlaying"
          @update:notes="handleNotesUpdate"
        />
      </el-card>

      <!-- 五线谱显示 -->
      <el-card class="section-card" shadow="hover">
        <template #header>
          <h3>🎵 五线谱预览 (Staff Notation Preview)</h3>
        </template>

        <StaffNotation
          :notes="editableNotes"
          :active-notes="testActiveNotes"
          :current-time="currentTime"
          :is-playing="isPlaying"
        />
      </el-card>

      <!-- 吉他 TAB 谱 -->
      <el-card class="section-card" shadow="hover">
        <template #header>
          <h3>🎸 吉他 TAB 谱 (Guitar Tablature)</h3>
        </template>

        <GuitarTab
          :notes="editableNotes"
          :active-notes="testActiveNotes"
          :current-time="currentTime"
          :is-playing="isPlaying"
        />
      </el-card>

      <!-- 状态信息 -->
      <el-card v-if="editableNotes.length > 0" class="status-card" shadow="hover">
        <template #header>
          <h3>📊 编辑状态</h3>
        </template>

        <el-descriptions :column="4" border>
          <el-descriptions-item label="音符总数">
            {{ editableNotes.length }}
          </el-descriptions-item>
          <el-descriptions-item label="当前时间">
            {{ (currentTime / 1000).toFixed(2) }}s
          </el-descriptions-item>
          <el-descriptions-item label="活动音符">
            {{ testActiveNotes.length }}
          </el-descriptions-item>
          <el-descriptions-item label="播放状态">
            <el-tag :type="isPlaying ? 'success' : 'info'">
              {{ isPlaying ? '播放中' : '已暂停' }}
            </el-tag>
          </el-descriptions-item>
        </el-descriptions>
      </el-card>
    </el-card>
  </div>
</template>

<style scoped>
.editor-tab-test-page {
  max-width: 1600px;
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

.section-card,
.status-card {
  margin-top: 20px;
}
</style>
