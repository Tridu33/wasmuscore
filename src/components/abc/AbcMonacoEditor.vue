<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import type * as Monaco from 'monaco-editor'
import { abcLanguage, abcLanguageConfiguration } from '~/utils/abc/abc-monarch-grammar'

// Import Monaco workers via Vite's ?worker syntax for proper bundling
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'

// Configure Monaco workers for Vite
self.MonacoEnvironment = {
  getWorker(_: string, label: string) {
    if (label === 'typescript' || label === 'javascript') return new tsWorker()
    if (label === 'css') return new cssWorker()
    if (label === 'html') return new htmlWorker()
    if (label === 'json') return new jsonWorker()
    return new editorWorker()
  },
}

const props = defineProps<{
  modelValue: string
  highlightRange?: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number } | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'cursor-change': [position: { offset: number; line: number; column: number }]
}>()

const containerRef = ref<HTMLDivElement>()
let editor: Monaco.editor.IStandaloneCodeEditor | null = null
let highlightDecoration: string | null = null
let valueUpdateTimer: ReturnType<typeof setTimeout> | null = null

// Expose editor instance for parent access
defineExpose({
  getEditor: () => editor,
  setPosition: (line: number, column: number) => {
    if (editor) {
      editor.revealLineInCenter(line)
      editor.setPosition({ lineNumber: line, column })
      editor.focus()
    }
  },
})

onMounted(async () => {
  const monaco = await import('monaco-editor')

  // Register ABC language (skip if already registered)
  if (!monaco.languages.getLanguages().some(l => l.id === 'abc')) {
    monaco.languages.register({ id: 'abc' })
    monaco.languages.setMonarchTokensProvider('abc', abcLanguage)
    monaco.languages.setLanguageConfiguration('abc', abcLanguageConfiguration)
  }

  if (!containerRef.value) return

  const isDark = document.documentElement.classList.contains('dark')

  editor = monaco.editor.create(containerRef.value, {
    value: props.modelValue,
    language: 'abc',
    theme: isDark ? 'vs-dark' : 'vs',
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 14,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
    lineNumbers: 'on',
    scrollBeyondLastLine: true,
    wordWrap: 'off',
    tabSize: 2,
    padding: { top: 12, bottom: 12 },
  })

  // Emit value changes (debounced)
  editor.onDidChangeModelContent(() => {
    if (valueUpdateTimer) clearTimeout(valueUpdateTimer)
    valueUpdateTimer = setTimeout(() => {
      if (editor) {
        emit('update:modelValue', editor.getValue())
      }
    }, 200)
  })

  // Emit cursor position changes
  editor.onDidChangeCursorPosition((e) => {
    const model = editor!.getModel()
    if (!model) return
    const offset = model.getOffsetAt(e.position)
    emit('cursor-change', {
      offset,
      line: e.position.lineNumber,
      column: e.position.column,
    })
  })
})

// Watch for highlight range changes (score click → editor highlight)
watch(
  () => props.highlightRange,
  async (range) => {
    if (!editor) return

    // Clear previous decoration
    if (highlightDecoration) {
      editor.deltaDecorations([highlightDecoration], [])
      highlightDecoration = null
    }

    if (range) {
      const monaco = await import('monaco-editor')
      highlightDecoration = editor.deltaDecorations([], [
        {
          range: new monaco.Range(
            range.startLineNumber,
            range.startColumn,
            range.endLineNumber,
            range.endColumn,
          ),
          options: {
            isWholeLine: true,
            className: 'abc-highlight-decoration',
            overviewRuler: {
              color: '#ffeb3b80',
              position: monaco.editor.OverviewRulerLane.Full,
            },
          },
        },
      ])[0]
    }
  },
)

onBeforeUnmount(() => {
  editor?.dispose()
  if (valueUpdateTimer) clearTimeout(valueUpdateTimer)
})
</script>

<template>
  <div ref="containerRef" class="abc-monaco-container" />
</template>

<style scoped>
.abc-monaco-container {
  width: 100%;
  height: 100%;
  min-height: 400px;
}

:deep(.abc-highlight-decoration) {
  background-color: rgba(255, 235, 59, 0.3) !important;
}
</style>
