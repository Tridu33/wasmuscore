<script setup lang="ts">
import type { UploadFile } from 'element-plus'
import { UploadFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useMidiStore } from '~/stores/midi'
import { MusicXMLToMidi } from '~/utils/musicxml/MusicXMLToMidi'

const midiStore = useMidiStore()

// 处理文件上传
async function handleFileUpload(uploadFile: UploadFile) {
  const file = uploadFile.raw
  if (!file) {
    ElMessage.error('No file selected')
    return
  }

  // 验证文件类型
  const fileName = file.name.toLowerCase()
  const isMidi = fileName.endsWith('.mid') || fileName.endsWith('.midi')
  const isMusicXML = fileName.endsWith('.xml') || fileName.endsWith('.musicxml')

  if (!isMidi && !isMusicXML) {
    ElMessage.error('Please upload a valid MIDI (.mid/.midi) or MusicXML (.xml/.musicxml) file')
    return
  }

  // 验证文件大小 (5MB)
  if (file.size > 5 * 1024 * 1024) {
    ElMessage.error('File size should be less than 5MB')
    return
  }

  ElMessage.info(`Loading: ${file.name}`)

  // 根据文件类型加载
  let success = false
  if (isMusicXML) {
    // 加载 MusicXML 文件
    success = await loadMusicXMLFile(file)
  }
  else {
    // 加载 MIDI 文件
    success = await midiStore.loadMidiFile(file)
  }

  if (success) {
    ElMessage.success(`Successfully loaded: ${file.name}`)
  }
  else {
    ElMessage.error('Failed to load MIDI file')
  }
}

// 加载 MusicXML 文件
async function loadMusicXMLFile(file: File): Promise<boolean> {
  try {
    const converter = new MusicXMLToMidi()
    const result = await converter.parseMusicXMLFile(file)

    // TODO: 将解析后的数据传递给 midiStore
    // 当前仅显示解析成功的信息
    ElMessage.success(
      `MusicXML parsed: ${result.info.title} - ${result.info.trackCount} tracks, ${result.info.totalNotes} notes`,
    )

    console.warn('MusicXML Info:', result.info)
    console.warn('Tracks:', result.tracks)

    return false // TODO: 集成到 MIDI store
  }
  catch (error: any) {
    ElMessage.error(`Failed to parse MusicXML: ${error.message}`)
    return false
  }
}
</script>

<template>
  <div class="upload-midi-container">
    <el-upload
      class="upload-demo"
      drag
      :auto-upload="false"
      :on-change="handleFileUpload"
      :show-file-list="true"
      accept=".mid,.midi,.xml,.musicxml"
      :limit="1"
    >
      <el-icon class="el-icon--upload">
        <UploadFilled />
      </el-icon>
      <div class="el-upload__text">
        Drop MIDI or MusicXML file here or <em>click to upload</em>
      </div>
      <template #tip>
        <div class="el-upload__tip">
          MIDI files (.mid, .midi) or MusicXML (.xml, .musicxml) with a size less than 5MB
        </div>
      </template>
    </el-upload>

    <!-- 加载状态 -->
    <div v-if="midiStore.isLoading" class="loading-status">
      <el-progress :percentage="50" :indeterminate="true" :stroke-width="10" />
      <p>Loading MIDI file...</p>
    </div>

    <!-- 错误信息 -->
    <el-alert
      v-if="midiStore.error"
      :title="midiStore.error"
      type="error"
      :closable="true"
      show-icon
      class="error-alert"
    />

    <!-- MIDI 文件信息 -->
    <div v-if="midiStore.midiFile" class="midi-info">
      <el-descriptions title="MIDI File Information" :column="2" border>
        <el-descriptions-item label="File Name">
          {{ midiStore.midiFile.name }}
        </el-descriptions-item>
        <el-descriptions-item label="Format">
          {{ midiStore.midiFile.format }}
        </el-descriptions-item>
        <el-descriptions-item label="Tracks">
          {{ midiStore.midiFile.track_count }}
        </el-descriptions-item>
        <el-descriptions-item label="Total Notes">
          {{ midiStore.midiFile.note_count }}
        </el-descriptions-item>
        <el-descriptions-item label="Duration">
          {{ midiStore.formatTime(midiStore.midiFile.duration_ms) }}
        </el-descriptions-item>
      </el-descriptions>

      <!-- Track 列表 -->
      <div class="track-list">
        <h3>Tracks</h3>
        <el-table :data="midiStore.midiFile.tracks" style="width: 100%" stripe>
          <el-table-column prop="track_id" label="Track ID" width="100" />
          <el-table-column prop="note_count" label="Notes" width="100" />
          <el-table-column prop="has_drums" label="Has Drums" width="120">
            <template #default="{ row }">
              <el-tag :type="row.has_drums ? 'success' : 'info'">
                {{ row.has_drums ? 'Yes' : 'No' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="programs" label="Programs" width="100" />
        </el-table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.upload-midi-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.loading-status {
  margin-top: 20px;
  text-align: center;
}

.error-alert {
  margin-top: 20px;
}

.midi-info {
  margin-top: 30px;
}

.track-list {
  margin-top: 20px;
}

.track-list h3 {
  margin-bottom: 10px;
  font-size: 18px;
  font-weight: 600;
}
</style>
