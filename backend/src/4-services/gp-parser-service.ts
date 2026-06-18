// File: backend/src/4-services/gp-parser-service.ts
import { readFileSync } from 'node:fs'
import { parseTabFile } from 'guitarpro-parser'

/**
 * Decode GBK/UTF-8-encoded string from Guitar Pro files.
 * GP files store text in GBK (system default on Chinese Windows) or UTF-8,
 * but guitarpro-parser reads raw bytes as Latin-1, producing mojibake.
 */
function decodeGbk(raw: string): string {
  if (!raw) return raw
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i) & 0xFF
  const blen = bytes.length

  // UTF-8 CJK = 3 bytes/char; GBK CJK = 2 bytes/char
  try {
    const utf8 = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    const ratio = blen / utf8.length
    const hasCJK = /[一-鿿]/.test(utf8)
    if (hasCJK && Math.abs(ratio - 3.0) < 0.1) return utf8
  }
  catch { /* not valid UTF-8 */ }

  try {
    return new TextDecoder('gbk', { fatal: false }).decode(bytes)
  }
  catch { /* gbk not available */ }

  return raw
}

/**
 * Recursively decode all string fields in the parsed object
 */
function decodeStrings(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(decodeStrings)
  const result: any = {}
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = decodeGbk(value)
    }
    else if (typeof value === 'object' && value !== null) {
      result[key] = decodeStrings(value)
    }
    else {
      result[key] = value
    }
  }
  return result
}

export class GpParserService {
  parseFromFile(filePath: string) {
    const data = new Uint8Array(readFileSync(filePath))
    const result = parseTabFile(data)
    return decodeStrings(result)
  }

  extractMetadata(song: any): Record<string, any> {
    return {
      title: song.title || '',
      artist: song.artist || '',
      album: song.album || '',
      tempo: song.tempo || 0,
      tracks: (song.tracks || []).map((t: any) => ({
        name: t.name || '',
        tuning: (t.tuning || []).map((n: any) => n.name || n),
        tuningMidi: t.tuningMidi || [],
        capoFret: t.capoFret || 0,
        barCount: t.bars?.length || 0,
      })),
    }
  }
}

export const gpParserService = new GpParserService()
