<script setup lang="ts">
import type { UploadFile } from 'element-plus'
import type { MidiTrackInfo, MusicXMLInfo } from '~/utils/musicxml/MusicXMLToMidi'
import { Download, InfoFilled, UploadFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import ScoreViewer from '~/components/ScoreViewer.vue'
import { MusicXMLToMidiConverter } from '~/utils/musicxml/MusicXMLToMidi'

const converter = new MusicXMLToMidiConverter()

const uploadedFile = ref<File | null>(null)
const musicXMLInfo = ref<MusicXMLInfo | null>(null)
const trackList = ref<MidiTrackInfo[]>([])
const isParsing = ref(false)

// 处理文件上传
async function handleFileUpload(uploadFile: UploadFile) {
  const file = uploadFile.raw
  if (!file) {
    ElMessage.error('No file selected')
    return
  }

  // 验证文件类型
  const fileName = file.name.toLowerCase()
  if (!fileName.endsWith('.xml') && !fileName.endsWith('.musicxml') && !fileName.endsWith('.mxl')) {
    ElMessage.error('Please upload a valid MusicXML file (.xml, .musicxml, or .mxl)')
    return
  }

  // 验证文件大小 (10MB)
  if (file.size > 10 * 1024 * 1024) {
    ElMessage.error('File size should be less than 10MB')
    return
  }

  uploadedFile.value = file
  await parseMusicXML(file)
}

// 解析 MusicXML
async function parseMusicXML(file: File) {
  isParsing.value = true

  try {
    const result = await converter.parseMusicXMLFile(file)

    musicXMLInfo.value = result.info
    trackList.value = result.tracks

    ElMessage.success(`Successfully parsed: ${result.info.title}`)
  }
  catch (error: any) {
    ElMessage.error(`Failed to parse MusicXML: ${error.message}`)
  }
  finally {
    isParsing.value = false
  }
}

// 加载示例文件
function loadSampleFile() {
  ElMessage.info('Sample files coming soon...')
}
</script>

<template>
  <div class="musicxml-test-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <h2>🎼 MusicXML 测试页面</h2>
          <el-button type="primary" :icon="Download" @click="loadSampleFile">
            加载示例文件
          </el-button>
        </div>
      </template>

      <!-- 上传区域 -->
      <el-upload
        class="upload-area"
        drag
        :auto-upload="false"
        :on-change="handleFileUpload"
        :show-file-list="false"
        accept=".xml,.musicxml,.mxl"
        :limit="1"
      >
        <el-icon class="el-icon--upload">
          <UploadFilled />
        </el-icon>
        <div class="el-upload__text">
          拖拽 MusicXML 文件到这里或 <em>点击上传</em>
        </div>
        <template #tip>
          <div class="el-upload__tip">
            支持 .xml, .musicxml, .mxl 格式,大小不超过 10MB
          </div>
        </template>
      </el-upload>

      <!-- 解析状态 -->
      <div v-if="isParsing" class="parsing-status">
        <el-icon class="is-loading">
          <Loading />
        </el-icon>
        <p>正在解析 MusicXML 文件...</p>
      </div>

      <!-- 乐谱信息 -->
      <el-card v-if="musicXMLInfo" class="info-card" shadow="hover">
        <template #header>
          <div class="info-header">
            <el-icon>
              <InfoFilled />
            </el-icon>
            <span>乐谱信息</span>
          </div>
        </template>

        <el-descriptions :column="2" border>
          <el-descriptions-item label="标题">
            {{ musicXMLInfo.title }}
          </el-descriptions-item>
          <el-descriptions-item label="作曲家">
            {{ musicXMLInfo.composer }}
          </el-descriptions-item>
          <el-descriptions-item label="乐章">
            {{ musicXMLInfo.movement || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="拍号">
            {{ musicXMLInfo.timeSignature[0] }}/{{ musicXMLInfo.timeSignature[1] }}
          </el-descriptions-item>
          <el-descriptions-item label="调号">
            {{ musicXMLInfo.keySignature }}
          </el-descriptions-item>
          <el-descriptions-item label="速度">
            {{ musicXMLInfo.tempo }} BPM
          </el-descriptions-item>
          <el-descriptions-item label="音轨数">
            {{ musicXMLInfo.trackCount }}
          </el-descriptions-item>
          <el-descriptions-item label="总音符数">
            {{ musicXMLInfo.totalNotes }}
          </el-descriptions-item>
          <el-descriptions-item label="预估时长">
            {{ (musicXMLInfo.durationMs / 1000).toFixed(1) }} 秒
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- 音轨列表 -->
      <el-card v-if="trackList.length > 0" class="tracks-card" shadow="hover">
        <template #header>
          <h3>🎵 音轨列表</h3>
        </template>

        <el-table :data="trackList" stripe>
          <el-table-column prop="trackId" label="ID" width="80" />
          <el-table-column prop="name" label="音轨名称" />
          <el-table-column prop="instrument" label="乐器" width="150" />
          <el-table-column label="音符数" width="120">
            <template #default="{ row }">
              {{ row.notes.length }}
            </template>
          </el-table-column>
          <el-table-column label="鼓组" width="100">
            <template #default="{ row }">
              <el-tag :type="row.hasDrums ? 'success' : 'info'">
                {{ row.hasDrums ? '是' : '否' }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </el-card>

    <!-- 乐谱可视化 -->
    <ScoreViewer v-if="uploadedFile" :file="uploadedFile" />
  </div>
</template>

<style scoped>
.musicxml-test-page {
  max-width: 1200px;
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

.upload-area {
  margin-bottom: 20px;
}

.parsing-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #666;
}

.parsing-status p {
  margin-top: 10px;
  font-size: 16px;
}

.info-card,
.tracks-card {
  margin-top: 20px;
}

.info-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 600;
}
</style>
