<script setup lang="ts">
import type { ActiveNote, MidiNote } from '~/stores/midi'
import { Delete, Edit, Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, ref } from 'vue'

interface Props {
  notes: MidiNote[]
  activeNotes: ActiveNote[]
  currentTime: number
  isPlaying: boolean
}

interface NoteFormData {
  note: number
  startMs: number
  durationMs: number
  velocity: number
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:notes': [notes: MidiNote[]]
  'note-added': [note: MidiNote]
  'note-deleted': [note: MidiNote]
  'note-updated': [oldNote: MidiNote, newNote: MidiNote]
}>()

const editingNotes = ref<MidiNote[]>([...props.notes])
const selectedNote = ref<MidiNote | null>(null)
const showAddDialog = ref(false)
const showEditDialog = ref(false)
const newNoteForm = ref<NoteFormData>({
  note: 60,
  startMs: 0,
  durationMs: 500,
  velocity: 80,
})
const editNoteForm = ref<NoteFormData>({
  note: 60,
  startMs: 0,
  durationMs: 500,
  velocity: 80,
})

// 排序后的音符列表
const sortedNotes = computed(() => {
  return [...editingNotes.value].sort((a, b) => a.start_ms - b.start_ms)
})

// MIDI note 转音符名
function midiToNoteName(midi: number): string {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const octave = Math.floor(midi / 12) - 1
  const noteName = noteNames[midi % 12]
  return `${noteName}${octave}`
}

// 选择音符
function selectNote(note: MidiNote) {
  selectedNote.value = note
}

// 添加音符
function openAddDialog() {
  newNoteForm.value = {
    note: 60,
    startMs: Math.floor(props.currentTime),
    durationMs: 500,
    velocity: 80,
  }
  showAddDialog.value = true
}

function addNote() {
  const newNote: MidiNote = {
    note: newNoteForm.value.note,
    start_ms: newNoteForm.value.startMs,
    duration_ms: newNoteForm.value.durationMs,
    end_ms: newNoteForm.value.startMs + newNoteForm.value.durationMs,
    velocity: newNoteForm.value.velocity,
    track_color_id: 0,
  }

  editingNotes.value.push(newNote)
  emit('update:notes', [...editingNotes.value])
  emit('note-added', newNote)

  showAddDialog.value = false
  ElMessage.success(`已添加音符: ${midiToNoteName(newNote.note)}`)
}

// 编辑音符
function openEditDialog(note: MidiNote) {
  selectedNote.value = note
  editNoteForm.value = {
    note: note.note,
    startMs: note.start_ms,
    durationMs: note.duration_ms,
    velocity: note.velocity,
  }
  showEditDialog.value = true
}

function updateNote() {
  if (!selectedNote.value)
    return

  const oldNote = { ...selectedNote.value }
  const updatedNote: MidiNote = {
    ...selectedNote.value,
    note: editNoteForm.value.note,
    start_ms: editNoteForm.value.startMs,
    duration_ms: editNoteForm.value.durationMs,
    end_ms: editNoteForm.value.startMs + editNoteForm.value.durationMs,
    velocity: editNoteForm.value.velocity,
  }

  const index = editingNotes.value.findIndex(n => n === selectedNote.value)
  if (index !== -1) {
    editingNotes.value[index] = updatedNote
    emit('update:notes', [...editingNotes.value])
    emit('note-updated', oldNote, updatedNote)
  }

  showEditDialog.value = false
  ElMessage.success('音符已更新')
}

// 删除音符
async function deleteNote(note: MidiNote) {
  try {
    await ElMessageBox.confirm(
      `确定要删除音符 ${midiToNoteName(note.note)} 吗？`,
      '删除音符',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )

    const index = editingNotes.value.findIndex(n => n === note)
    if (index !== -1) {
      editingNotes.value.splice(index, 1)
      emit('update:notes', [...editingNotes.value])
      emit('note-deleted', note)
      ElMessage.success('音符已删除')
    }

    if (selectedNote.value === note) {
      selectedNote.value = null
    }
  }
  catch {
    // 用户取消
  }
}

// 批量删除
async function deleteSelectedNote() {
  if (!selectedNote.value) {
    ElMessage.warning('请先选择一个音符')
    return
  }

  await deleteNote(selectedNote.value)
}

// 导出编辑结果
function exportNotes() {
  const dataStr = JSON.stringify(editingNotes.value, null, 2)
  const dataBlob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(dataBlob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'edited_notes.json'
  link.click()
  URL.revokeObjectURL(url)

  ElMessage.success('已导出音符数据')
}

// 导入音符数据
function importNotes(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file)
    return

  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target?.result as string) as MidiNote[]
      editingNotes.value = imported
      emit('update:notes', [...editingNotes.value])
      ElMessage.success(`已导入 ${imported.length} 个音符`)
    }
    catch (error) {
      ElMessage.error('导入失败：文件格式错误')
    }
  }
  reader.readAsText(file)
}
</script>

<template>
  <div class="staff-editor">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <h3>🎼 乐谱编辑器</h3>
        <el-tag>
          音符数: {{ editingNotes.length }}
        </el-tag>
      </div>

      <div class="toolbar-right">
        <el-button type="primary" :icon="Plus" @click="openAddDialog">
          添加音符
        </el-button>

        <el-button
          type="warning"
          :icon="Edit"
          :disabled="!selectedNote"
          @click="openEditDialog(selectedNote!)"
        >
          编辑
        </el-button>

        <el-button
          type="danger"
          :icon="Delete"
          :disabled="!selectedNote"
          @click="deleteSelectedNote"
        >
          删除
        </el-button>

        <el-button @click="exportNotes">
          导出
        </el-button>

        <el-button @click="$refs.importInput?.click()">
          导入
        </el-button>
        <input
          ref="importInput"
          type="file"
          accept=".json"
          style="display: none"
          @change="importNotes"
        >
      </div>
    </div>

    <!-- 音符列表表格 -->
    <el-table
      :data="sortedNotes"
      stripe
      border
      style="width: 100%"
      height="400"
      @row-click="selectNote"
    >
      <el-table-column type="index" label="#" width="60" />

      <el-table-column label="音符" width="100">
        <template #default="{ row }">
          <el-tag :type="selectedNote === row ? 'danger' : ''">
            {{ midiToNoteName(row.note) }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column label="开始时间 (ms)" width="120">
        <template #default="{ row }">
          {{ row.start_ms }}
        </template>
      </el-table-column>

      <el-table-column label="时长 (ms)" width="120">
        <template #default="{ row }">
          {{ row.duration_ms }}
        </template>
      </el-table-column>

      <el-table-column label="力度" width="100">
        <template #default="{ row }">
          <el-progress
            :percentage="Math.round((row.velocity / 127) * 100)"
            :stroke-width="12"
            :show-text="false"
          />
          <span class="velocity-text">{{ row.velocity }}</span>
        </template>
      </el-table-column>

      <el-table-column label="操作" width="150">
        <template #default="{ row }">
          <el-button size="small" @click.stop="openEditDialog(row)">
            编辑
          </el-button>
          <el-button size="small" type="danger" @click.stop="deleteNote(row)">
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 添加音符对话框 -->
    <el-dialog v-model="showAddDialog" title="添加音符" width="500px">
      <el-form :model="newNoteForm" label-width="100px">
        <el-form-item label="音符">
          <el-input-number
            v-model="newNoteForm.note"
            :min="0"
            :max="127"
            @change="() => {}"
          />
          <span class="note-preview">
            {{ midiToNoteName(newNoteForm.note) }}
          </span>
        </el-form-item>

        <el-form-item label="开始时间">
          <el-input-number
            v-model="newNoteForm.startMs"
            :min="0"
            :step="100"
          />
          <span class="unit">ms</span>
        </el-form-item>

        <el-form-item label="时长">
          <el-input-number
            v-model="newNoteForm.durationMs"
            :min="50"
            :step="50"
          />
          <span class="unit">ms</span>
        </el-form-item>

        <el-form-item label="力度">
          <el-slider
            v-model="newNoteForm.velocity"
            :min="0"
            :max="127"
          />
          <span class="velocity-value">{{ newNoteForm.velocity }}</span>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showAddDialog = false">
          取消
        </el-button>
        <el-button type="primary" @click="addNote">
          添加
        </el-button>
      </template>
    </el-dialog>

    <!-- 编辑音符对话框 -->
    <el-dialog v-model="showEditDialog" title="编辑音符" width="500px">
      <el-form :model="editNoteForm" label-width="100px">
        <el-form-item label="音符">
          <el-input-number
            v-model="editNoteForm.note"
            :min="0"
            :max="127"
          />
          <span class="note-preview">
            {{ midiToNoteName(editNoteForm.note) }}
          </span>
        </el-form-item>

        <el-form-item label="开始时间">
          <el-input-number
            v-model="editNoteForm.startMs"
            :min="0"
            :step="100"
          />
          <span class="unit">ms</span>
        </el-form-item>

        <el-form-item label="时长">
          <el-input-number
            v-model="editNoteForm.durationMs"
            :min="50"
            :step="50"
          />
          <span class="unit">ms</span>
        </el-form-item>

        <el-form-item label="力度">
          <el-slider
            v-model="editNoteForm.velocity"
            :min="0"
            :max="127"
          />
          <span class="velocity-value">{{ editNoteForm.velocity }}</span>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showEditDialog = false">
          取消
        </el-button>
        <el-button type="primary" @click="updateNote">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.staff-editor {
  background: #ffffff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 2px solid #e4e7ed;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 15px;
}

.toolbar-left h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.toolbar-right {
  display: flex;
  gap: 10px;
}

.velocity-text {
  display: block;
  font-size: 12px;
  color: #606266;
  margin-top: 4px;
}

.note-preview {
  margin-left: 10px;
  font-weight: 600;
  color: #409eff;
  font-size: 16px;
}

.unit {
  margin-left: 8px;
  color: #909399;
  font-size: 14px;
}

.velocity-value {
  margin-left: 10px;
  font-weight: 600;
  color: #67c23a;
  min-width: 30px;
  display: inline-block;
}
</style>
