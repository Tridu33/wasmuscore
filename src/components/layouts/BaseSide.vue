<script lang="ts" setup>
import {
  Location,
  Menu,
  Document,
  Microphone,
  Cpu,
  Headset,
  Notebook,
  Edit,
  Fold,
  Expand,
} from '@element-plus/icons-vue'
import { ref } from 'vue'

const isCollapsed = ref(false)

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value
}

function handleOpen(key: string, keyPath: string[]) {
  console.log(key, keyPath)
}
function handleClose(key: string, keyPath: string[]) {
  console.log(key, keyPath)
}
</script>

<template>
  <div class="side-wrapper">
    <el-button
      class="collapse-btn"
      :icon="isCollapsed ? Expand : Fold"
      text
      @click="toggleCollapse"
    />
    <el-menu
      router
      default-active="/"
      class="el-menu-vertical-demo"
      :collapse="isCollapsed"
      @open="handleOpen"
      @close="handleClose"
    >
      <el-menu-item index="/">
        <el-icon><Location /></el-icon>
        <template #title>首页</template>
      </el-menu-item>

      <el-menu-item index="/midiPlayer">
        <el-icon><Headset /></el-icon>
        <template #title>MIDI 播放器</template>
      </el-menu-item>

      <el-menu-item index="/musicxml-parse">
        <el-icon><Notebook /></el-icon>
        <template #title>MusicXML 解析</template>
      </el-menu-item>

      <el-menu-item index="/notation-test">
        <el-icon><Document /></el-icon>
        <template #title>五线谱/简谱</template>
      </el-menu-item>

      <el-menu-item index="/recording-test">
        <el-icon><Microphone /></el-icon>
        <template #title>MIDI 录音</template>
      </el-menu-item>

      <el-menu-item index="/note-digger">
        <el-icon><Cpu /></el-icon>
        <template #title>频谱分析扒谱</template>
      </el-menu-item>

      <el-menu-item index="/alpha-tab">
        <el-icon><Headset /></el-icon>
        <template #title>六线谱 (alphaTab)</template>
      </el-menu-item>

      <el-menu-item index="/abc-notes">
        <el-icon><Edit /></el-icon>
        <template #title>ABC 记谱</template>
      </el-menu-item>

    </el-menu>
  </div>
</template>

<style scoped>
.side-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--ep-border-color-light);
  min-height: 100%;
}

.collapse-btn {
  align-self: flex-end;
  padding: 8px;
  font-size: 16px;
  color: var(--ep-text-color-regular);
  transition: color 0.2s;
}

.collapse-btn:hover {
  color: var(--ep-text-color-primary);
}
</style>
