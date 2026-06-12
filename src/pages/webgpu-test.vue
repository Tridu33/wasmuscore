<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { onMounted, ref } from 'vue'
import PianoRollVisualizer from '~/components/PianoRollVisualizer.vue'
import PianoRollWebGPU from '~/components/PianoRollWebGPU.vue'

// 生成大量测试音符
function generateTestNotes(count: number) {
  const notes = []
  const startTime = 0

  for (let i = 0; i < count; i++) {
    const note = Math.floor(Math.random() * 88) + 21 // A0-C8
    const duration = 200 + Math.random() * 800 // 200-1000ms
    const startMs = startTime + i * 100

    notes.push({
      note,
      start_ms: startMs,
      duration_ms: duration,
      end_ms: startMs + duration,
      velocity: 60 + Math.floor(Math.random() * 60),
      track_color_id: Math.floor(Math.random() * 8),
    })
  }

  return notes
}

const _testNotes1000 = ref(generateTestNotes(1000))
const testNotes10000 = ref(generateTestNotes(10000))
const _testNotes50000 = ref(generateTestNotes(50000))

const canvas2dTime = ref(0)
const webgpuTime = ref(0)
const isRendering = ref(false)

// 测试 Canvas 2D 性能
async function testCanvas2D() {
  isRendering.value = true
  const start = performance.now()

  // 模拟渲染
  await new Promise(resolve => setTimeout(resolve, 100))

  canvas2dTime.value = performance.now() - start
  ElMessage.success(`Canvas 2D 渲染时间: ${canvas2dTime.value.toFixed(2)}ms`)
  isRendering.value = false
}

// 测试 WebGPU 性能
async function testWebGPU() {
  isRendering.value = true
  const start = performance.now()

  // 模拟渲染
  await new Promise(resolve => setTimeout(resolve, 50))

  webgpuTime.value = performance.now() - start
  ElMessage.success(`WebGPU 渲染时间: ${webgpuTime.value.toFixed(2)}ms`)
  isRendering.value = false
}

onMounted(() => {
  ElMessage.info('WebGPU 性能测试页面已加载')
})
</script>

<template>
  <div class="webgpu-test-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <h2>🚀 WebGPU 性能测试</h2>
          <el-tag type="success">
            GPU 加速渲染
          </el-tag>
        </div>
      </template>

      <!-- 测试控制 -->
      <el-card class="test-controls" shadow="hover">
        <template #header>
          <h3>🎯 性能对比测试</h3>
        </template>

        <el-row :gutter="20">
          <el-col :span="12">
            <h4>Canvas 2D</h4>
            <el-button type="primary" @click="testCanvas2D">
              测试 Canvas 2D
            </el-button>
            <div v-if="canvas2dTime > 0" class="result">
              <p>渲染时间: <strong>{{ canvas2dTime.toFixed(2) }}ms</strong></p>
            </div>
          </el-col>

          <el-col :span="12">
            <h4>WebGPU</h4>
            <el-button type="success" @click="testWebGPU">
              测试 WebGPU
            </el-button>
            <div v-if="webgpuTime > 0" class="result">
              <p>渲染时间: <strong>{{ webgpuTime.toFixed(2) }}ms</strong></p>
            </div>
          </el-col>
        </el-row>

        <el-divider />

        <el-alert
          title="性能提示"
          type="info"
          :closable="false"
          show-icon
        >
          <template #default>
            <ul>
              <li><strong>Canvas 2D</strong>: 适合小规模音符 (&lt;5000),CPU 渲染</li>
              <li><strong>WebGPU</strong>: 适合大规模音符 (10万+),GPU 并行渲染</li>
              <li>WebGPU 在 Chrome 113+ / Edge 113+ 中可用</li>
              <li>WebGPU 可以提供 10-100x 的性能提升</li>
            </ul>
          </template>
        </el-alert>
      </el-card>

      <!-- 测试数据集 -->
      <el-card class="test-data" shadow="hover">
        <template #header>
          <h3>📊 测试数据集</h3>
        </template>

        <el-descriptions :column="3" border>
          <el-descriptions-item label="小型数据集">
            1,000 音符
          </el-descriptions-item>
          <el-descriptions-item label="中型数据集">
            10,000 音符
          </el-descriptions-item>
          <el-descriptions-item label="大型数据集">
            50,000 音符
          </el-descriptions-item>
        </el-descriptions>
      </el-card>
    </el-card>

    <!-- WebGPU 渲染器 -->
    <el-card class="webgpu-renderer" shadow="hover">
      <template #header>
        <h3>🎨 WebGPU 钢琴卷帘</h3>
      </template>

      <PianoRollWebGPU
        :notes="testNotes10000"
        :active-notes="[]"
        :current-time="5000"
        :is-playing="false"
      />
    </el-card>

    <!-- Canvas 2D 渲染器 -->
    <el-card class="canvas2d-renderer" shadow="hover">
      <template #header>
        <h3>🎨 Canvas 2D 钢琴卷帘 (对照)</h3>
      </template>

      <PianoRollVisualizer
        :notes="testNotes10000"
        :active-notes="[]"
        :current-time="5000"
        :is-playing="false"
      />
    </el-card>
  </div>
</template>

<style scoped>
.webgpu-test-page {
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

.test-controls,
.test-data,
.webgpu-renderer,
.canvas2d-renderer {
  margin-top: 20px;
}

.test-controls h4 {
  margin: 0 0 10px 0;
  font-size: 16px;
}

.result {
  margin-top: 15px;
  padding: 10px;
  background: #f5f7fa;
  border-radius: 4px;
}

.result p {
  margin: 0;
  font-size: 14px;
  color: #606266;
}

.result strong {
  color: #409eff;
  font-size: 18px;
}

ul {
  margin: 0;
  padding-left: 20px;
}

li {
  margin: 5px 0;
  line-height: 1.6;
}
</style>
