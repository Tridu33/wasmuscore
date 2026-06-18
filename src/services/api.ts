// File: src/services/api.ts
import axios from 'axios'
import type { GpTabRecord } from '~/utils/guitarpro/types'

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
})

export async function uploadGpFile(file: File): Promise<GpTabRecord> {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await api.post('/tabs/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function fetchAllTabs(): Promise<GpTabRecord[]> {
  const { data } = await api.get('/tabs')
  return data
}

export async function searchTabs(query: string): Promise<GpTabRecord[]> {
  const { data } = await api.get('/tabs/search', { params: { q: query } })
  return data
}

export async function fetchTabFile(fileName: string): Promise<Blob> {
  const { data } = await api.get(`/tabs/file/${fileName}`, {
    responseType: 'blob',
  })
  return data
}

export async function deleteTab(id: number): Promise<void> {
  await api.delete(`/tabs/${id}`)
}
