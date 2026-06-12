<script lang="ts" setup>
import {
  Location,
  Menu,
  Document,
  Microphone,
  Cpu,
  Monitor,
  Headset,
  Setting,
  Notebook,
} from '@element-plus/icons-vue'

function handleOpen(key: string, keyPath: string[]) {
  console.log(key, keyPath)
}
function handleClose(key: string, keyPath: string[]) {
  console.log(key, keyPath)
}
</script>

<template>
  <el-menu
    router
    default-active="/"
    class="el-menu-vertical-demo"
    @open="handleOpen"
    @close="handleClose"
  >
    <el-menu-item index="/">
      <el-icon><Location /></el-icon>
      <template #title>首页</template>
    </el-menu-item>

    <el-menu-item index="/nav/midiPlayer">
      <el-icon><Headset /></el-icon>
      <template #title>MIDI 播放器</template>
    </el-menu-item>

    <el-menu-item index="/musicxml-test">
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
      <template #title>noteDigger</template>
    </el-menu-item>
  </el-menu>
</template>
