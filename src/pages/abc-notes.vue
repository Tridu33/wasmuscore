<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AbcMonacoEditor from '~/components/abc/AbcMonacoEditor.vue'
import AbcSheetMusic from '~/components/abc/AbcSheetMusic.vue'
import AbcExportToolbar from '~/components/abc/AbcExportToolbar.vue'
import { useAbcSync } from '~/composables/useAbcSync'
import { ElMessage } from 'element-plus'

const {
  highlightElementIds,
  highlightRange,
  onEditorCursorChange,
  onNoteClick,
  setVisualObj,
  setText,
} = useAbcSync()

// Default ABC example
const DEFAULT_ABC = `X:1
T:小星星
C:传统
M:4/4
L:1/4
K:C
"C"C C "G"G G | "A"A A "G"G2 | "F"F F "C"E E | "G"D D "C"C2 |]
`

// Predefined list of ABC files in public/asset/abcNotes/
const ABC_FILES = [
  'asset/abcNotes/小星星.abc',
  'asset/abcNotes/欢乐颂.abc',
  'asset/abcNotes/茉莉花.abc',
  'asset/abcNotes/两只老虎.abc',
  'asset/abcNotes/康康舞曲.abc',
  'asset/abcNotes/月亮代表我的心.abc',
]

const abcText = ref(DEFAULT_ABC)
const visualObj = ref<any>(null)
const isResizing = ref(false)
const splitPosition = ref(50)

/**
 * Open a file picker to load an ABC file.
 */
async function openFile() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.abc,.txt'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      abcText.value = text
      ElMessage.success(`已加载: ${file.name}`)
    } catch (e: any) {
      ElMessage.error(`加载失败: ${e.message}`)
    }
  }
  input.click()
}

/**
 * Load a random ABC score from the predefined collection.
 */
async function loadRandomScore() {
  const path = ABC_FILES[Math.floor(Math.random() * ABC_FILES.length)]
  try {
    const resp = await fetch(path)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const text = await resp.text()
    abcText.value = text
    ElMessage.success(`已加载随机乐谱: ${path.split('/').pop()}`)
  } catch (e: any) {
    ElMessage.error(`加载乐谱失败: ${e.message}`)
  }
}

// Handle editor cursor changes → highlight score
function handleCursorChange(pos: { offset: number; line: number; column: number }) {
  setText(abcText.value)
  onEditorCursorChange(pos.offset, pos.line, pos.column)
}

// Handle score note clicks → highlight editor
function handleNoteClick(info: { elementId: string; textOffsetStart: number; textOffsetEnd: number }) {
  onNoteClick(info.textOffsetStart, info.textOffsetEnd)
}

// Handle render complete from abcjs
function handleRenderComplete(vo: any) {
  visualObj.value = vo
  if (vo) {
    setVisualObj(vo)
  }
}

// Resize logic for split pane
let startX = 0
let startWidth = 0

function startResize(event: MouseEvent) {
  isResizing.value = true
  startX = event.clientX
  startWidth = splitPosition.value

  const onMouseMove = (e: MouseEvent) => {
    const container = (e.target as HTMLElement).closest('.abc-notes-container')
    if (!container) return
    const containerWidth = container.clientWidth
    const delta = ((e.clientX - startX) / containerWidth) * 100
    splitPosition.value = Math.min(80, Math.max(20, startWidth + delta))
  }

  const onMouseUp = () => {
    isResizing.value = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}
</script>

<template>
  <div class="abc-notes-container">
    <!-- Top toolbar -->
    <div class="abc-toolbar">
      <div class="toolbar-left">
        <span class="toolbar-title">ABC 记谱编辑器</span>
        <el-button-group style="margin-left: 12px;">
          <el-button @click="openFile" size="small">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
            打开乐谱
          </el-button>
          <el-button @click="loadRandomScore" size="small">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="2" width="20" height="20" rx="2"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/>
            </svg>
            随机乐谱
          </el-button>
        </el-button-group>
      </div>
      <div class="toolbar-right">
        <AbcExportToolbar
          :visual-obj="visualObj"
          :abc-text="abcText"
        />
      </div>
    </div>

    <!-- Split pane: editor | score -->
    <div class="split-pane" :class="{ resizing: isResizing }">
      <!-- Left: Monaco Editor -->
      <div class="pane pane-editor" :style="{ width: `${splitPosition}%` }">
        <div class="pane-header">
          <span>ABC 记谱</span>
        </div>
        <AbcMonacoEditor
          v-model="abcText"
          :highlight-range="highlightRange"
          @cursor-change="handleCursorChange"
        />
      </div>

      <!-- Resize handle -->
      <div class="resize-handle" @mousedown="startResize">
        <div class="resize-line" />
      </div>

      <!-- Right: abcjs Score -->
      <div class="pane pane-score" :style="{ width: `${100 - splitPosition}%` }">
        <div class="pane-header">
          <span>五线谱预览</span>
        </div>
        <AbcSheetMusic
          :abc-text="abcText"
          :highlight-element-ids="highlightElementIds"
          @note-click="handleNoteClick"
          @render-complete="handleRenderComplete"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.abc-notes-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.abc-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid var(--ep-border-color-light);
  background: var(--ep-bg-color);
}

.toolbar-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--ep-text-color-primary);
}

.split-pane {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.split-pane.resizing {
  cursor: col-resize;
  user-select: none;
}

.pane {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 200px;
}

.pane-header {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 500;
  color: var(--ep-text-color-regular);
  background: var(--ep-bg-color);
  border-bottom: 1px solid var(--ep-border-color-light);
}

.resize-handle {
  width: 6px;
  background: var(--ep-border-color-light);
  cursor: col-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.resize-handle:hover {
  background: var(--ep-color-primary);
}

.resize-line {
  width: 2px;
  height: 24px;
  background: var(--ep-text-color-secondary);
  border-radius: 1px;
}
</style>
