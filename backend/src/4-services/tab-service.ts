// File: backend/src/4-services/tab-service.ts
import { dal } from '../2-utils/dal'
import type { TabModel } from '../3-models/tab-model'

/**
 * Decode GBK/UTF-8 mojibake in database text fields.
 * Existing records have garbled text because the parser didn't decode before.
 */
function decodeGbk(raw: string): string {
  if (!raw) return raw
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i) & 0xFF
  const blen = bytes.length

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

function sanitizeTab(tab: TabModel): TabModel {
  return {
    ...tab,
    name: decodeGbk(tab.name || ''),
    songName: decodeGbk(tab.songName || ''),
    bandName: decodeGbk(tab.bandName || ''),
  }
}

export class TabService {
  async getAllTabs(): Promise<TabModel[]> {
    const rows = await dal.execute(
      'SELECT * FROM tabs ORDER BY updated_at DESC',
    )
    return (rows as TabModel[]).map(sanitizeTab)
  }

  async getTabById(id: number): Promise<TabModel | null> {
    const rows = await dal.execute(
      'SELECT * FROM tabs WHERE id = ?',
      [id],
    )
    const arr = rows as any[]
    return arr.length > 0 ? sanitizeTab(arr[0] as TabModel) : null
  }

  async searchTabs(query: string): Promise<TabModel[]> {
    const pattern = `%${query}%`
    const rows = await dal.execute(
      'SELECT * FROM tabs WHERE song_name LIKE ? OR band_name LIKE ? OR name LIKE ? ORDER BY updated_at DESC LIMIT 50',
      [pattern, pattern, pattern],
    )
    return (rows as TabModel[]).map(sanitizeTab)
  }

  async createTab(tab: TabModel): Promise<number> {
    const result = await dal.execute(
      'INSERT INTO tabs (name, website, song_name, band_name, file_type, file_path, download_url, gp_metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        tab.name,
        tab.website || '',
        tab.songName || '',
        tab.bandName || '',
        tab.fileType || '',
        tab.filePath || '',
        tab.downloadUrl || '',
        tab.gpMetadata ? JSON.stringify(tab.gpMetadata) : null,
      ],
    )
    const arr = result as any[]
    return arr[0]?.insertId ?? 0
  }

  async updateTab(id: number, tab: Partial<TabModel>): Promise<void> {
    const fields: string[] = []
    const values: any[] = []

    if (tab.name !== undefined) { fields.push('name = ?'); values.push(tab.name) }
    if (tab.songName !== undefined) { fields.push('song_name = ?'); values.push(tab.songName) }
    if (tab.bandName !== undefined) { fields.push('band_name = ?'); values.push(tab.bandName) }
    if (tab.gpMetadata !== undefined) { fields.push('gp_metadata = ?'); values.push(JSON.stringify(tab.gpMetadata)) }
    if (tab.downloadUrl !== undefined) { fields.push('download_url = ?'); values.push(tab.downloadUrl) }

    if (fields.length === 0) return
    values.push(id)
    await dal.execute(
      `UPDATE tabs SET ${fields.join(', ')} WHERE id = ?`,
      values,
    )
  }

  async deleteTab(id: number): Promise<void> {
    await dal.execute('DELETE FROM tabs WHERE id = ?', [id])
  }
}

export const tabService = new TabService()
