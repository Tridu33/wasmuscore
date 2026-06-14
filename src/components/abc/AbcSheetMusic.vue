<script setup lang="ts">
import { ref, shallowRef, watch, onMounted, onBeforeUnmount } from 'vue'
import { VideoPlay, VideoPause } from '@element-plus/icons-vue'

const props = defineProps<{
  abcText: string
  highlightElementIds?: string[] | null
}>()

const emit = defineEmits<{
  'note-click': [info: { elementId: string; textOffsetStart: number; textOffsetEnd: number }]
  'render-complete': [visualObj: any]
}>()

const containerRef = ref<HTMLDivElement>()
const abcjsModule = shallowRef<any>(null)
const visualObj = shallowRef<any>(null)
const isPlaying = ref(false)
const isLoading = ref(true)
const loadError = ref<string | null>(null)

// Audio playback state
let synthController: any = null
let audioContext: AudioContext | null = null

// Simple debounce
let renderTimer: ReturnType<typeof setTimeout> | null = null

function debouncedRender() {
  if (renderTimer) clearTimeout(renderTimer)
  renderTimer = setTimeout(() => doRender(), 300)
}

async function doRender() {
  if (!abcjsModule.value || !containerRef.value || !props.abcText.trim()) return

  try {
    const abcjs = abcjsModule.value
    // Clear previous content but preserve audio element
    const existingAudio = containerRef.value.querySelector('#abc-audio-wrapper')
    containerRef.value.innerHTML = ''
    if (existingAudio) containerRef.value.appendChild(existingAudio)

    const renderParams = {
      responsive: 'resize' as const,
      add_classes: true,
      clickListener: handleNoteClick,
      selectionColor: 'rgba(255, 235, 59, 0.4)',
      staffwidth: Math.max(600, (containerRef.value.clientWidth || 800) - 40),
    }

    const result = abcjs.renderAbc(containerRef.value, props.abcText, renderParams)

    if (result && result.length > 0) {
      visualObj.value = result
      emit('render-complete', result)
    }
  }
  catch (e: any) {
    console.error('abcjs render error:', e)
  }
}

/**
 * Handle click on a note in the rendered score.
 */
function handleNoteClick(
  _abcElem: any,
  _tuneNumber: number,
  _classes: string,
  analysis: { line: number; col: number },
  _drag: any,
) {
  const lines = props.abcText.split('\n')
  const lineIdx = analysis.line - 1
  if (lineIdx < 0 || lineIdx >= lines.length) return

  const lineStart = getLineStartOffset(lines, lineIdx)
  const col = Math.max(0, analysis.col - 1)

  // Find the end of the token at this position
  const lineText = lines[lineIdx]
  let endCol = col + 1
  while (endCol < lineText.length && !/[\s|%|()\[\]{}]/.test(lineText[endCol])) {
    endCol++
  }

  emit('note-click', {
    elementId: `${analysis.line}-${analysis.col}`,
    textOffsetStart: lineStart + col,
    textOffsetEnd: lineStart + endCol,
  })
}

function getLineStartOffset(lines: string[], lineIndex: number): number {
  let offset = 0
  for (let i = 0; i < lineIndex; i++) {
    offset += lines[i].length + 1
  }
  return offset
}

/**
 * Initialize audio synth and play the score.
 */
async function play() {
  if (!abcjsModule.value || !visualObj.value) return

  try {
    const abcjs = abcjsModule.value

    // Chrome autoplay policy: AudioContext may be suspended.
    // Resume it on user gesture (button click).
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      abcjs.synth.registerAudioContext(audioContext)
    }
    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }

    // Create audio wrapper element
    let audioWrapper = containerRef.value?.querySelector('#abc-audio-wrapper')
    if (!audioWrapper) {
      audioWrapper = document.createElement('div')
      audioWrapper.id = 'abc-audio-wrapper'
      ;(audioWrapper as HTMLElement).style.display = 'none'
      containerRef.value?.appendChild(audioWrapper)
    }

    // Create synth controller (original GitHub Pages CDN is down for soundfonts)
    synthController = new abcjs.synth.SynthController()
    synthController.load(audioWrapper, null, {
      displayRestart: false,
      displayProgress: false,
      displayLoop: false,
    })

    // Set the tune with audio params (soundFontUrl must point to a working CDN)
    // renderAbc returns an array; setTune needs a single tune object
    const tune = Array.isArray(visualObj.value) ? visualObj.value[0] : visualObj.value
    await synthController.setTune(tune, true, {
      soundFontUrl: 'https://cdn.jsdelivr.net/gh/paulrosen/midi-js-soundfonts@gh-pages/FluidR3_GM/',
    })

    // Start playback
    synthController.play()

    isPlaying.value = true

    // Listen for playback end
    const checkEnded = setInterval(() => {
      if (!synthController?.isStarted) {
        isPlaying.value = false
        clearInterval(checkEnded)
      }
    }, 500)
  }
  catch (e: any) {
    console.error('Playback failed:', e)
    isPlaying.value = false
  }
}

/**
 * Stop playback.
 */
function stop() {
  if (synthController) {
    synthController.pause()
    synthController = null
  }
  isPlaying.value = false
}

/**
 * Highlight visual elements by their IDs (editor cursor → score sync).
 */
watch(
  () => props.highlightElementIds,
  (ids) => {
    if (!containerRef.value) return

    // Clear all previous highlights
    containerRef.value.querySelectorAll('.abc-note-highlight').forEach((el) => {
      el.classList.remove('abc-note-highlight')
    })

    if (!ids || ids.length === 0) return

    // Find and highlight matching SVG elements
    for (const id of ids) {
      const el = containerRef.value.querySelector(`[data-abcjid="${id}"]`) ||
                 containerRef.value.querySelector(`[id*="${id}"]`) ||
                 containerRef.value.querySelector(`[id$="-${id}"]`)
      if (el) {
        el.classList.add('abc-note-highlight')
      }
    }
  },
)

// Watch for ABC text changes and re-render
watch(
  () => props.abcText,
  () => {
    if (abcjsModule.value) {
      debouncedRender()
    }
  },
)

// Load abcjs on mount
onMounted(async () => {
  try {
    abcjsModule.value = await import('abcjs')
    isLoading.value = false
    doRender()
  }
  catch (e: any) {
    loadError.value = 'Failed to load abcjs library'
    isLoading.value = false
    console.error('abcjs load error:', e)
  }
})

onBeforeUnmount(() => {
  if (renderTimer) clearTimeout(renderTimer)
  stop()
})

// Expose for parent control
defineExpose({ play, stop, isPlaying, visualObj })
</script>

<template>
  <div class="abc-sheet-music">
    <!-- Loading state -->
    <div v-if="isLoading" class="loading-state">
      <div class="spinner" />
      <p>正在加载 abcjs...</p>
    </div>

    <!-- Error state -->
    <div v-else-if="loadError" class="error-state">
      <p>{{ loadError }}</p>
      <el-button type="primary" @click="isLoading = true; abcjsModule = null; loadError = null">
        重试
      </el-button>
    </div>

    <!-- Score container -->
    <div v-else>
      <!-- Playback controls -->
      <div class="playback-controls">
        <el-button
          :type="isPlaying ? 'danger' : 'primary'"
          :icon="isPlaying ? VideoPause : VideoPlay"
          size="small"
          @click="isPlaying ? stop() : play()"
        >
          {{ isPlaying ? '暂停' : '播放' }}
        </el-button>
      </div>

      <!-- Score rendering area -->
      <div ref="containerRef" class="score-container" />
    </div>
  </div>
</template>

<style scoped>
.abc-sheet-music {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
  color: var(--ep-text-color-regular);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #409eff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.playback-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--ep-border-color-light);
}

.score-container {
  flex: 1;
  overflow: auto;
  padding: 12px;
  background: var(--ep-bg-color, #fff);
}

:deep(.abc-note-highlight) {
  filter: drop-shadow(0 0 4px rgba(255, 235, 59, 0.8));
  transition: filter 0.15s ease;
}

:deep(svg) {
  max-width: 100%;
  height: auto;
}
</style>
