<script setup lang="ts">
import { ref } from 'vue'
import { Download, Document, Headset } from '@element-plus/icons-vue'
import { exportMidi, exportPdf, exportMusicXml } from '~/utils/abc/abc-export'
import { ElMessage } from 'element-plus'

const props = defineProps<{
  visualObj: any | null
  abcText: string
}>()

const isExporting = ref(false)

async function handleExportMidi() {
  if (!props.visualObj) {
    ElMessage.warning('请先渲染乐谱')
    return
  }

  try {
    isExporting.value = true
    await exportMidi(props.abcText, props.visualObj)
    ElMessage.success('MIDI 导出成功')
  }
  catch (e: any) {
    ElMessage.error(`MIDI 导出失败: ${e.message}`)
  }
  finally {
    isExporting.value = false
  }
}

function handleExportPdf() {
  if (!props.visualObj) {
    ElMessage.warning('请先渲染乐谱')
    return
  }

  // Find the score container from the DOM
  const container = document.querySelector('.abc-sheet-music .score-container') as HTMLElement
  if (container) {
    exportPdf(props.visualObj, container)
    ElMessage.success('PDF 打印窗口已打开，请选择"另存为 PDF"')
  }
  else {
    ElMessage.error('PDF 导出失败：未找到乐谱容器')
  }
}

function handleExportMusicXml() {
  if (!props.abcText.trim()) {
    ElMessage.warning('请先输入 ABC 记谱')
    return
  }

  try {
    exportMusicXml(props.abcText)
    ElMessage.success('MusicXML 导出成功')
  }
  catch (e: any) {
    ElMessage.error(`MusicXML 导出失败: ${e.message}`)
  }
}
</script>

<template>
  <div class="abc-export-toolbar">
    <el-button-group>
      <el-button :icon="Download" size="small" :loading="isExporting" @click="handleExportMidi">
        MIDI
      </el-button>
      <el-button :icon="Document" size="small" @click="handleExportPdf">
        PDF
      </el-button>
      <el-button :icon="Headset" size="small" @click="handleExportMusicXml">
        MusicXML
      </el-button>
    </el-button-group>
  </div>
</template>

<style scoped>
.abc-export-toolbar {
  display: flex;
  align-items: center;
}
</style>
