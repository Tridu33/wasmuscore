// File: backend/src/3-models/tab-model.ts

export interface TabModel {
  id?: number
  name: string
  website?: string
  songName?: string
  bandName?: string
  fileType?: string
  filePath?: string
  downloadUrl?: string
  gpMetadata?: Record<string, any>
  createdAt?: string
  updatedAt?: string
}
