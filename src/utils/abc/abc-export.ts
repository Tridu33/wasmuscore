/**
 * Download a Blob as a file with the given filename.
 */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Extract the tune title from visualObj for use as filename.
 */
function getTuneTitle(visualObj: any): string {
  try {
    return visualObj[0]?.metaText?.title?.replace(/[^a-zA-Z0-9一-龥 ]/g, '').trim() || 'untitled'
  }
  catch {
    return 'untitled'
  }
}

/**
 * Export the rendered score as a MIDI file.
 * Passes ABC text directly to abcjs's MIDI generator,
 * which parses it and produces a standard .mid file.
 */
export async function exportMidi(abcText: string, visualObj: any): Promise<void> {
  try {
    const abcjs: any = await import('abcjs')
    // getMidiFile with midiOutputType: 'binary' returns a Uint8Array directly.
    // The "encoded" type returns a percent-encoded string (not base64),
    // which requires manual hex decoding.
    const result = abcjs.synth.getMidiFile(abcText, { midiOutputType: 'binary' })
    const midiBytes: Uint8Array = Array.isArray(result) ? result[0] : result
    const blob = new Blob([midiBytes], { type: 'audio/midi' })
    downloadBlob(blob, `${getTuneTitle(visualObj)}.mid`)
  }
  catch (e) {
    console.error('MIDI export failed:', e)
    throw new Error('MIDI export failed')
  }
}

/**
 * Export the rendered score as a PDF file via browser print.
 * This is the simplest and most reliable approach — opens the browser's
 * print dialog where the user can select "Save as PDF".
 */
export function exportPdf(visualObj: any, _container: HTMLElement): void {
  // Open a new window with just the score SVG for clean printing
  try {
    const svgData = getScoreSvg(visualObj)
    if (!svgData) {
      throw new Error('No SVG found')
    }

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      // Fallback: trigger browser print directly
      window.print()
      return
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${getTuneTitle(visualObj)} - Print</title>
        <style>
          body { margin: 0; padding: 20px; }
          svg { max-width: 100%; height: auto; }
          @media print {
            body { margin: 0; padding: 10mm; }
          }
        </style>
      </head>
      <body>${svgData}</body>
      </html>
    `)
    printWindow.document.close()

    // Auto-trigger print after SVG loads
    setTimeout(() => {
      printWindow.print()
    }, 500)
  }
  catch (e) {
    console.error('PDF export failed:', e)
    window.print()
  }
}

/**
 * Get the SVG string from the rendered score.
 */
function getScoreSvg(_visualObj: any): string | null {
  // Find the SVG in the active document (abcjs renders it inline)
  const svg = document.querySelector('.score-container svg') || document.querySelector('.abc-sheet-music svg')
  if (!svg) return null
  return new XMLSerializer().serializeToString(svg)
}

/**
 * Export ABC text to a simplified MusicXML string.
 * Parses the ABC text and builds a minimal MusicXML document.
 */
export function exportMusicXml(abcText: string): void {
  const lines = abcText.split('\n')
  const info: Record<string, string> = {}
  const musicLines: string[] = []

  for (const line of lines) {
    const match = line.match(/^([A-Za-z]):\s*(.*)/)
    if (match) {
      info[match[1].toUpperCase()] = match[2].trim()
    }
    else if (line.trim() && !line.startsWith('%') && !line.startsWith('w:')) {
      musicLines.push(line)
    }
  }

  const title = info['T'] || 'Untitled'
  const composer = info['C'] || ''
  const key = info['K'] || 'C'
  const meter = info['M'] || '4/4'

  const [beats, beatType] = meter.includes('/') ? meter.split('/') : [meter, '4']

  // Build MusicXML
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n'
  xml += '<score-partwise version="4.0">\n'
  xml += '  <work>\n'
  xml += `    <work-title>${escapeXml(title)}</work-title>\n`
  xml += '  </work>\n'
  if (composer) {
    xml += '  <identification>\n'
    xml += `    <creator type="composer">${escapeXml(composer)}</creator>\n`
    xml += '  </identification>\n'
  }
  xml += '  <part-list>\n'
  xml += '    <score-part id="P1">\n'
  xml += `      <part-name>${escapeXml(title)}</part-name>\n`
  xml += '    </score-part>\n'
  xml += '  </part-list>\n'
  xml += '  <part id="P1">\n'

  // Parse music lines into measures
  const fullMusic = musicLines.join(' ').trim()
  const measures = parseAbcMeasures(fullMusic)

  let measureNum = 1
  for (const measure of measures) {
    xml += `    <measure number="${measureNum}">\n`
    if (measureNum === 1) {
      xml += '      <attributes>\n'
      xml += '        <divisions>4</divisions>\n'
      xml += `        <key><fifths>${keyToFifths(key)}</fifths></key>\n`
      xml += `        <time><beats>${beats}</beats><beat-type>${beatType}</beat-type></time>\n`
      xml += '        <clef><sign>treble</sign><line>2</line></clef>\n'
      xml += '      </attributes>\n'
    }
    for (const note of measure.notes) {
      xml += noteToMusicXml(note)
    }
    xml += '      <barline location="right">\n'
    xml += '        <bar-style>light-light</bar-style>\n'
    xml += '      </barline>\n'
    xml += '    </measure>\n'
    measureNum++
  }

  xml += '  </part>\n'
  xml += '</score-partwise>\n'

  const blob = new Blob([xml], { type: 'application/vnd.recordare.musicxml+xml' })
  downloadBlob(blob, `${title}.xml`)
}

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function keyToFifths(key: string): string {
  const map: Record<string, string> = {
    'C': '0', 'G': '1', 'D': '2', 'A': '3', 'E': '4', 'B': '5', 'F#': '6', 'C#': '7',
    'F': '-1', 'Bb': '-2', 'Eb': '-3', 'Ab': '-4', 'Db': '-5', 'Gb': '-6', 'Cb': '-7',
    'Cm': '-3', 'Gm': '-2', 'Dm': '-1', 'Am': '0', 'Em': '1', 'Bm': '2', 'F#m': '3',
    'Fm': '-4', 'Bbm': '-5', 'Ebm': '-6', 'Abm': '-7',
  }
  return map[key] || '0'
}

interface ParsedNote {
  pitch: string
  accidental: string
  octave: number
  duration: string
  isRest: boolean
}

interface ParsedMeasure {
  notes: ParsedNote[]
}

function parseAbcMeasures(music: string): ParsedMeasure[] {
  // Basic parser — splits on bar lines and tokenizes notes
  const measures = music.split(/(?=\|)/).filter(m => m.trim().replace(/[|:\]]/g, ''))
  const result: ParsedMeasure[] = []

  for (const m of measures) {
    const notes: ParsedNote[] = []
    const tokens = m.match(/{[^}]*}|"[^"]*"|[A-Ga-gzX][,',]*\d*(?:\/\d+)?\/?\d*|[\]|:]+/g) || []
    for (const token of tokens) {
      if (token.startsWith('"') || token.startsWith('{') || /[\]|:]+/.test(token)) continue
      const note = parseAbcNote(token)
      if (note) notes.push(note)
    }
    result.push({ notes })
  }

  return result
}

function parseAbcNote(token: string): ParsedNote | null {
  const match = token.match(/^([=_^]*)([A-Ga-gzX])([',]*)(\d*(?:\/\d+)?\/?\d*)$/)
  if (!match) return null

  const [, accidental, pitch, octaveMarks, duration] = match
  const isRest = pitch.toLowerCase() === 'z'
  if (pitch === 'X') return null

  // Determine octave
  let octave = 4
  if (pitch >= 'a' && pitch <= 'g') octave = 5
  if (pitch >= 'A' && pitch <= 'G') octave = 4

  // Octave marks
  if (octaveMarks) {
    for (const ch of octaveMarks) {
      if (ch === "'") octave++
      else if (ch === ',') octave--
    }
  }

  return {
    pitch: pitch.toUpperCase(),
    accidental: accidental || '',
    octave,
    duration: duration || '1',
    isRest,
  }
}

function noteToMusicXml(note: ParsedNote): string {
  const type = durationToType(note.duration)
  let xml = '        <note>\n'
  if (note.isRest) {
    xml += '          <rest/>\n'
  }
  else {
    const step = note.pitch
    const alter = note.accidental.includes('^') ? 1 : note.accidental.includes('_') ? -1 : 0
    xml += '          <pitch>\n'
    xml += `            <step>${step}</step>\n`
    if (alter !== 0) {
      xml += `            <alter>${alter}</alter>\n`
    }
    xml += `            <octave>${note.octave}</octave>\n`
    xml += '          </pitch>\n'
  }
  xml += '          <duration>4</duration>\n'
  xml += `          <type>${type}</type>\n`
  xml += '        </note>\n'
  return xml
}

function durationToType(dur: string): string {
  if (dur.includes('/')) {
    const parts = dur.split('/')
    if (parts.length === 2) {
      const den = parseInt(parts[1])
      if (den === 2) return 'eighth'
      if (den === 4) return '16th'
      if (den === 8) return '32nd'
    }
  }
  const n = parseInt(dur)
  if (n >= 4) return 'whole'
  if (n >= 2) return 'half'
  return 'quarter'
}
