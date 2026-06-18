// File: src/utils/guitarpro/parser.ts
import { parseTabFile } from 'guitarpro-parser'
import type { GpSong } from './types'

/**
 * Decode a GBK/UTF-8-encoded string (used by Guitar Pro for Chinese/Japanese/Korean text)
 * using the browser's built-in TextDecoder.
 * Guitar Pro files store metadata in the system's default encoding (GBK on Chinese Windows),
 * but some GP5 files use UTF-8. alphaTab reads raw bytes as Latin-1, producing mojibake.
 */
function decodeGbk(raw: string): string {
  if (!raw) return raw
  // Convert the mis-decoded string back to raw bytes
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i) & 0xFF
  const blen = bytes.length

  // Heuristic: UTF-8 CJK = 3 bytes per char, GBK CJK = 2 bytes per char
  // If decoding as UTF-8 gives a ratio of ~3.0 with CJK chars, it's UTF-8
  try {
    const utf8 = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    const ratio = blen / utf8.length
    const hasCJK = /[一-鿿]/.test(utf8)
    if (hasCJK && Math.abs(ratio - 3.0) < 0.1) return utf8
  }
  catch { /* not valid UTF-8 */ }

  // Try GBK
  try {
    return new TextDecoder('gbk', { fatal: false }).decode(bytes)
  }
  catch { /* gbk not available */ }

  return raw
}

/**
 * Recursively decode all string fields in the parsed GpSong object
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

/**
 * Parse a Guitar Pro file from a browser File object
 */
export async function parseGpFile(file: File): Promise<GpSong> {
  const data = new Uint8Array(await file.arrayBuffer())
  const result = parseTabFile(data, file.name)
  return decodeStrings(result) as GpSong
}

/**
 * Parse a Guitar Pro file from a URL (e.g. backend download URL)
 */
export async function parseGpFromUrl(url: string): Promise<GpSong> {
  const response = await fetch(url)
  const data = new Uint8Array(await response.arrayBuffer())
  const result = parseTabFile(data, url.split('/').pop() || '')
  return decodeStrings(result) as GpSong
}
