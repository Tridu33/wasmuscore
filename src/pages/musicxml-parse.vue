<script setup lang="ts">
import type { UploadFile } from 'element-plus'
import type { MidiTrackInfo, MusicXMLInfo } from '~/utils/musicxml/MusicXMLToMidi'
import { computed, ref } from 'vue'
import { Document, Download, InfoFilled, UploadFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import ScoreViewer from '~/components/ScoreViewer.vue'
import { MusicXMLToMidiConverter } from '~/utils/musicxml/MusicXMLToMidi'

const converter = new MusicXMLToMidiConverter()

const uploadedFile = ref<File | null>(null)
const musicXMLInfo = ref<MusicXMLInfo | null>(null)
const trackList = ref<MidiTrackInfo[]>([])
const isParsing = ref(false)

// 示例文件弹窗
const selectedSample = ref<string | null>(null)
const searchQuery = ref('')

// MusicXML 示例文件列表 (from public/musicxml-testsuite/)
const sampleFiles = [
  '01a-Pitches-Pitches.xml',
  '01b-Pitches-Intervals.xml',
  '01c-Pitches-NoVoiceElement.xml',
  '01d-Pitches-Microtones.xml',
  '01e-Pitches-ParenthesizedAccidentals.xml',
  '01f-Pitches-ParenthesizedMicrotoneAccidentals.xml',
  '02a-Rests-Durations.xml',
  '02b-Rests-PitchedRests.xml',
  '02c-Rests-MultiMeasureRests.xml',
  '02d-Rests-Multimeasure-TimeSignatures.xml',
  '02e-Rests-NoType.xml',
  '03a-Rhythm-Durations.xml',
  '03b-Rhythm-Backup.xml',
  '03c-Rhythm-DivisionChange.xml',
  '03d-Rhythm-DottedDurations-Factors.xml',
  '03e-Rhythm-No-Divisions.xml',
  '03f-Rhythm-Forward.xml',
  '11a-TimeSignatures.xml',
  '11b-TimeSignatures-NoTime.xml',
  '11c-TimeSignatures-CompoundSimple.xml',
  '11d-TimeSignatures-CompoundMultiple.xml',
  '11e-TimeSignatures-CompoundMixed.xml',
  '11f-TimeSignatures-SymbolMeaning.xml',
  '11g-TimeSignatures-SingleNumber.xml',
  '11h-TimeSignatures-SenzaMisura.xml',
  '12a-Clefs.xml',
  '12b-Clefs-NoKeyOrClef.xml',
  '13a-KeySignatures.xml',
  '13b-KeySignatures-ChurchModes.xml',
  '13c-KeySignatures-NonTraditional.xml',
  '13d-KeySignatures-Microtones.xml',
  '13e-KeySignatures-Cancel.xml',
  '13f-KeySignatures-Visible.xml',
  '14a-StaffDetails-LineChanges.xml',
  '21a-Chord-Basic.xml',
  '21b-Chords-TwoNotes.xml',
  '21c-Chords-ThreeNotesDuration.xml',
  '21d-Chords-SchubertStabatMater.xml',
  '21e-Chords-PickupMeasures.xml',
  '21f-Chord-ElementInBetween.xml',
  '21g-Chords-Tremolos.xml',
  '21h-Chord-Accidentals.xml',
  '22a-Noteheads.xml',
  '22b-Staff-Notestyles.xml',
  '22c-Noteheads-Chords.xml',
  '22d-Parenthesized-Noteheads.xml',
  '23a-Tuplets.xml',
  '23b-Tuplets-Styles.xml',
  '23c-Tuplet-Display-NonStandard.xml',
  '23d-Tuplets-Nested.xml',
  '23e-Tuplets-Tremolo.xml',
  '23f-Tuplets-DurationButNoBracket.xml',
  '24a-GraceNotes.xml',
  '24b-ChordAsGraceNote.xml',
  '24c-GraceNote-MeasureEnd.xml',
  '24d-AfterGrace.xml',
  '24e-GraceNote-StaffChange.xml',
  '24f-GraceNote-Slur.xml',
  '24g-GraceNote-Dynamics.xml',
  '24h-GraceNote-Simultaneous.xml',
  '31a-Directions.xml',
  '31b-Directions-Order.xml',
  '31c-MetronomeMarks.xml',
  '31d-Directions-Compounds.xml',
  '32a-Notations.xml',
  '32b-Articulations-Texts.xml',
  '32c-MultipleNotationChildren.xml',
  '32d-Arpeggio.xml',
  '33a-Spanners.xml',
  '33b-Spanners-Tie.xml',
  '33c-Spanners-Slurs.xml',
  '33da-Spanners-OctaveShifts-before.xml',
  '33db-Spanners-OctaveShifts-after.xml',
  '33e-Spanners-OctaveShifts-InvalidSize.xml',
  '33f-Trill-EndingOnGraceNote.xml',
  '33g-Slur-ChordedNotes.xml',
  '33h-Spanners-Glissando.xml',
  '33i-Ties-NotEnded.xml',
  '33j-Beams-Tremolos.xml',
  '34a-Print-Object-Spanners.xml',
  '34b-Colors.xml',
  '34c-Font-Size.xml',
  '41a-MultiParts-Partorder.xml',
  '41b-MultiParts-MoreThan10.xml',
  '41c-StaffGroups.xml',
  '41d-StaffGroups-Nested.xml',
  '41e-StaffGroups-InstrumentNames-Linebroken.xml',
  '41f-StaffGroups-Overlapping.xml',
  '41g-StaffGroups-NestingOrder.xml',
  '41h-TooManyParts.xml',
  '41i-PartNameDisplay-Override.xml',
  '41j-PartNameDisplay-Multiple-DisplayText-Children.xml',
  '41k-PartName-Print.xml',
  '41l-GroupNameDisplay-Override.xml',
  '42a-MultiVoice-TwoVoicesOnStaff-Lyrics.xml',
  '42b-MultiVoice-MidMeasureClefChange.xml',
  '43a-PianoStaff.xml',
  '43b-MultiStaff-DifferentKeys.xml',
  '43c-MultiStaff-DifferentKeysAfterBackup.xml',
  '43d-MultiStaff-StaffChange.xml',
  '43e-Multistaff-ClefDynamics.xml',
  '43f-MultiStaff-Lyrics.xml',
  '43g-MultiStaff-PartSymbol.xml',
  '45a-SimpleRepeat.xml',
  '45b-RepeatWithAlternatives.xml',
  '45c-SimpleRepeat-Nested.xml',
  '45d-Repeats-MultipleEndings.xml',
  '45e-Repeats-Combination.xml',
  '45f-Repeats-InvalidEndings.xml',
  '45g-Repeats-NotEnded.xml',
  '45h-Repeats-Partial.xml',
  '45i-Repeats-Nested.xml',
  '46a-Barlines.xml',
  '46b-MidmeasureBarline.xml',
  '46c-Midmeasure-Clef.xml',
  '46d-PickupMeasure-ImplicitMeasures.xml',
  '46e-PickupMeasure-SecondVoiceStartsLater.xml',
  '46f-IncompleteMeasures.xml',
  '46g-PickupMeasure-Chordnames-FiguredBass.xml',
  '51b-Header-Quotes.xml',
  '51c-MultipleRights.xml',
  '51d-EmptyTitle.xml',
  '52a-PageLayout.xml',
  '52b-Breaks.xml',
  '61a-Lyrics.xml',
  '61b-MultipleLyrics.xml',
  '61c-Lyrics-Pianostaff.xml',
  '61d-Lyrics-Melisma.xml',
  '61e-Lyrics-Chords.xml',
  '61f-Lyrics-GracedNotes.xml',
  '61g-Lyrics-NameNumber.xml',
  '61h-Lyrics-BeamsMelismata.xml',
  '61i-Lyrics-Chords.xml',
  '61j-Lyrics-Elisions.xml',
  '61k-Lyrics-SpannersExtenders.xml',
  '71a-Chordnames.xml',
  '71c-ChordsFrets.xml',
  '71d-ChordsFrets-Multistaff.xml',
  '71e-TabStaves.xml',
  '71f-AllChordTypes.xml',
  '71g-MultipleChordnames.xml',
  '72a-TransposingInstruments.xml',
  '72b-TransposingInstruments-Full.xml',
  '72c-TransposingInstruments-Change.xml',
  '73a-Percussion.xml',
  '74a-FiguredBass.xml',
  '75a-AccordionRegistrations.xml',
  '99a-Sibelius5-IgnoreBeaming.xml',
  '99b-Lyrics-BeamsMelismata-IgnoreBeams.xml',
]

const sampleDialogVisible = ref(false)
const filteredSampleFiles = computed(() => {
  if (!searchQuery.value) return sampleFiles
  const q = searchQuery.value.toLowerCase()
  return sampleFiles.filter(f => f.toLowerCase().includes(q))
})

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

// 打开示例文件弹窗
function loadSampleFile() {
  sampleDialogVisible.value = true
  selectedSample.value = null
}

// 加载选中的示例文件
async function loadSelectedSample() {
  if (!selectedSample.value) {
    ElMessage.warning('Please select a sample file')
    return
  }

  try {
    const response = await fetch(`/musicxml-testsuite/${selectedSample.value}`)
    if (!response.ok) {
      throw new Error(`Failed to fetch sample: ${response.statusText}`)
    }

    const xmlText = await response.text()
    const file = new File([xmlText], selectedSample.value, { type: 'application/xml' })

    sampleDialogVisible.value = false
    uploadedFile.value = file
    await parseMusicXML(file)
  }
  catch (error: any) {
    ElMessage.error(`Failed to load sample: ${error.message}`)
  }
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

    <!-- 示例文件选择弹窗 -->
    <el-dialog v-model="sampleDialogVisible" title="Sample Files" width="600px">
      <el-input
        v-model="searchQuery"
        placeholder="Search files..."
        prefix-icon="Search"
        clearable
        class="sample-search"
      />
      <div class="sample-file-list">
        <div
          v-for="file in filteredSampleFiles"
          :key="file"
          class="sample-file-item"
          :class="{ selected: selectedSample === file }"
          @click="selectedSample = file"
          @dblclick="selectedSample = file; loadSelectedSample()"
        >
          <el-icon><Document /></el-icon>
          <span class="file-name">{{ file }}</span>
        </div>
      </div>
      <template #footer>
        <el-button @click="sampleDialogVisible = false">
          Cancel
        </el-button>
        <el-button type="primary" :disabled="!selectedSample" @click="loadSelectedSample">
          Load Selected
        </el-button>
      </template>
    </el-dialog>
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

.sample-search {
  margin-bottom: 12px;
}

.sample-file-list {
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid var(--ep-border-color-light);
  border-radius: 4px;
}

.sample-file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.sample-file-item:hover {
  background-color: var(--ep-fill-color-light);
}

.sample-file-item.selected {
  background-color: var(--ep-color-primary-light-9);
  color: var(--ep-color-primary);
}

.sample-file-item .file-name {
  font-size: 14px;
  font-family: monospace;
}
</style>
