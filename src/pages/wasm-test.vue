<script setup lang="ts">
import { onMounted, ref } from 'vue'
import initWasm from '~/utils/wasmuscore/loader'

const testResult = ref<string>('')
const wasmLoaded = ref(false)

onMounted(async () => {
  try {
    // 初始化 WASM
    await initWasm.initWasm()
    wasmLoaded.value = true
    testResult.value = 'WASM module loaded successfully!'

    // 测试简单函数
    const sum = await initWasm.add(10, 20)
    testResult.value += `\nTest: add(10, 20) = ${sum}`
  }
  catch (error: any) {
    testResult.value = `Error: ${error.message}`
  }
})
</script>

<template>
  <div class="wasm-test">
    <h1>WASM Integration Test</h1>

    <div class="status">
      <el-tag v-if="wasmLoaded" type="success" size="large">
        ✓ WASM Loaded
      </el-tag>
      <el-tag v-else type="warning" size="large">
        Loading WASM...
      </el-tag>
    </div>

    <div class="result">
      <pre>{{ testResult }}</pre>
    </div>

    <el-divider />

    <div class="links">
      <el-button type="primary" @click="$router.push('/')">
        Home
      </el-button>
      <el-button type="success" @click="$router.push('/midi-piano')">
        MIDI 瀑布流
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.wasm-test {
  max-width: 800px;
  margin: 50px auto;
  padding: 40px;
  text-align: center;
}

h1 {
  margin-bottom: 30px;
}

.status {
  margin-bottom: 20px;
}

.result {
  background: #f5f5f5;
  padding: 20px;
  border-radius: 8px;
  text-align: left;
}

.result pre {
  margin: 0;
  white-space: pre-wrap;
  font-family: monospace;
  font-size: 14px;
}

.links {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-top: 20px;
}
</style>
