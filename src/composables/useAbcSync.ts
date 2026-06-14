import { ref, computed } from 'vue'

/**
 * Composable for bidirectional sync between Monaco editor and abcjs score.
 *
 * - Editor cursor → score highlight: Maps cursor offset to visual element IDs
 * - Score click → editor highlight: Maps click line/col to Monaco decoration range
 */
export function useAbcSync() {
  // Current editor cursor position
  const cursorOffset = ref<number>(-1)
  const cursorLine = ref(1)
  const cursorColumn = ref(1)

  // Highlight state flowing editor → score
  const highlightElementIds = ref<string[]>([])

  // Highlight state flowing score → editor (Monaco decoration range)
  const highlightRange = ref<{
    startLineNumber: number
    startColumn: number
    endLineNumber: number
    endColumn: number
  } | null>(null)

  // Parsed visualObj from abcjs for offset-to-element mapping
  const visualObj = ref<any>(null)

  // ABC text for offset calculations
  const abcText = ref('')

  // Debounce timers
  let editorToScoreTimer: ReturnType<typeof setTimeout> | null = null
  let scoreToEditorTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * Called when the editor cursor moves.
   * Finds the corresponding visual element in the score and highlights it.
   */
  function onEditorCursorChange(offset: number, line: number, column: number) {
    cursorOffset.value = offset
    cursorLine.value = line
    cursorColumn.value = column

    if (editorToScoreTimer) clearTimeout(editorToScoreTimer)
    editorToScoreTimer = setTimeout(() => {
      syncEditorToScore(offset)
    }, 100)
  }

  /**
   * Find visual elements near the given text offset and highlight them.
   */
  function syncEditorToScore(offset: number) {
    if (!visualObj.value) {
      highlightElementIds.value = []
      return
    }

    const elementIds: string[] = []
    const lines = abcText.value.split('\n')

    // Find the closest visual element to the cursor offset
    const currentLine = cursorLine.value
    try {
      for (const tune of visualObj.value) {
        if (!tune.lines) continue
        for (const line of tune.lines) {
          if (!line.staff) continue
          for (const staff of (Array.isArray(line.staff) ? line.staff : [line.staff])) {
            if (!staff?.voices) continue
            for (const voice of staff.voices) {
              if (!voice) continue
              for (const element of voice) {
                if (!element || typeof element !== 'object') continue
                const abcLine = element.abcLineNumber
                if (abcLine != null && Math.abs(abcLine - (currentLine - 1)) <= 1) {
                  const lineStart = getLineStartOffset(lines, abcLine)
                  const abcCol = element.abccolumn ?? 0
                  const elemOffset = lineStart + abcCol
                  // If the element is within ~20 chars of the cursor, highlight it
                  if (Math.abs(elemOffset - offset) < 20) {
                    const elementId = element.elementID || `${abcLine}-${abcCol}`
                    elementIds.push(elementId)
                  }
                }
              }
            }
          }
        }
      }
    }
    catch (e) {
      console.warn('syncEditorToScore error:', e)
    }

    highlightElementIds.value = elementIds
  }

  /**
   * Called when a note is clicked in the score.
   * Highlights the corresponding text in the Monaco editor.
   */
  function onNoteClick(textOffsetStart: number, textOffsetEnd: number) {
    if (scoreToEditorTimer) clearTimeout(scoreToEditorTimer)
    scoreToEditorTimer = setTimeout(() => {
      syncScoreToEditor(textOffsetStart, textOffsetEnd)
    }, 50)
  }

  /**
   * Convert text offsets to Monaco line/column positions and set highlight.
   */
  function syncScoreToEditor(offsetStart: number, offsetEnd: number) {
    const lines = abcText.value.split('\n')

    const startPos = offsetToLineColumn(lines, offsetStart)
    const endPos = offsetToLineColumn(lines, offsetEnd)

    highlightRange.value = {
      startLineNumber: startPos.line,
      startColumn: startPos.column,
      endLineNumber: endPos.line,
      endColumn: endPos.column,
    }
  }

  /**
   * Convert a character offset to { line, column } (1-indexed).
   */
  function offsetToLineColumn(lines: string[], offset: number) {
    let currentOffset = 0
    for (let i = 0; i < lines.length; i++) {
      const lineLength = lines[i].length
      if (currentOffset + lineLength >= offset) {
        return {
          line: i + 1,
          column: offset - currentOffset + 1,
        }
      }
      currentOffset += lineLength + 1 // +1 for \n
    }
    return { line: lines.length, column: 1 }
  }

  function getLineStartOffset(lines: string[], lineIndex: number): number {
    let offset = 0
    for (let i = 0; i < lineIndex; i++) {
      offset += lines[i].length + 1
    }
    return offset
  }

  /**
   * Set the visualObj from abcjs render.
   */
  function setVisualObj(obj: any) {
    visualObj.value = obj
  }

  /**
   * Set the current ABC text.
   */
  function setText(text: string) {
    abcText.value = text
  }

  /**
   * Clear all highlights.
   */
  function clearHighlights() {
    highlightElementIds.value = []
    highlightRange.value = null
  }

  return {
    highlightElementIds,
    highlightRange,
    cursorOffset,
    onEditorCursorChange,
    onNoteClick,
    setVisualObj,
    setText,
    clearHighlights,
  }
}
