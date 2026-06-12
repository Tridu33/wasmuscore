<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { onMounted } from 'vue'
import { useMidiStore } from '~/stores/midi'

const midiStore = useMidiStore()

onMounted(async () => {
  // 自动初始化音频
  try {
    await midiStore.initAudio()
    if (midiStore.audioLoaded) {
      ElMessage.success('音频引擎初始化成功!')
    }
  }
  catch {
    ElMessage.warning('音频初始化失败,但不影响 MIDI 文件加载')
  }
})

async function handleInitAudio() {
  try {
    await midiStore.initAudio()
    if (midiStore.audioLoaded) {
      ElMessage.success('音频引擎初始化成功!')
    }
  }
  catch (e: any) {
    ElMessage.error(`音频初始化失败: ${e.message}`)
  }
}
</script>

<template>
  <div class="audio-test-page">
    <h1>🎵 Audio Integration Test</h1>

    <!-- 音频状态 -->
    <el-card class="status-card">
      <template #header>
        <div class="card-header">
          <span>音频引擎状态</span>
        </div>
      </template>

      <div class="status-grid">
        <div class="status-item">
          <label>加载状态:</label>
          <el-tag v-if="midiStore.audioLoaded" type="success">
            ✓ 已加载
          </el-tag>
          <el-tag v-else-if="midiStore.audioLoading" type="warning">
            加载中...
          </el-tag>
          <el-tag v-else type="info">
            未加载
          </el-tag>
        </div>

        <div v-if="midiStore.audioLoading" class="status-item">
          <label>加载进度:</label>
          <el-progress :percentage="midiStore.audioLoadProgress" />
        </div>

        <div class="status-item">
          <label>音量:</label>
          <el-slider
            v-model="midiStore.volume"
            :min="0"
            :max="100"
            :step="5"
            style="width: 200px"
            @change="(val: number) => midiStore.setVolume(val)"
          />
          <span class="volume-label">{{ midiStore.volume }}%</span>
        </div>
      </div>

      <el-button
        type="primary"
        :loading="midiStore.audioLoading"
        :disabled="midiStore.audioLoaded"
        @click="handleInitAudio"
      >
        {{ midiStore.audioLoading ? '初始化中...' : '初始化音频引擎' }}
      </el-button>
    </el-card>

    <!-- 测试说明 -->
    <el-card class="info-card">
      <template #header>
        <div class="card-header">
          <span>测试步骤</span>
        </div>
      </template>

      <el-steps direction="vertical" :active="midiStore.audioLoaded ? 2 : 1">
        <el-step title="初始化音频引擎" description="点击按钮加载 SoundFont2 文件 (~16MB)" />
        <el-step title="上传 MIDI 文件" description="前往 MIDI Player 页面上传并播放 MIDI" />
        <el-step title="测试音频播放" description="播放 MIDI 时应该能听到真实乐器声音" />
      </el-steps>
    </el-card>

    <!-- 导航按钮 -->
    <div class="actions">
      <el-button type="success" size="large" @click="$router.push('/nav/midiPlayer')">
        前往 MIDI Player →
      </el-button>
      <el-button size="large" @click="$router.push('/')">
        返回首页
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.audio-test-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 40px 20px;
}

h1 {
  text-align: center;
  margin-bottom: 30px;
  font-size: 32px;
}

.status-card,
.info-card {
  margin-bottom: 20px;
}

.card-header {
  font-weight: 600;
  font-size: 18px;
}

.status-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 20px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-item label {
  min-width: 100px;
  font-weight: 500;
}

.volume-label {
  min-width: 50px;
  font-family: monospace;
  font-size: 14px;
}

.actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-top: 30px;
}
</style>
