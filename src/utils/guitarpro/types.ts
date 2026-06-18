// File: src/utils/guitarpro/types.ts

export interface GpTrack {
  name: string
  tuning: string[]
  tuningMidi: number[]
  capoFret: number
  barCount: number
}

export interface GpSong {
  title: string
  artist: string
  album: string
  tempo: number
  tracks: GpTrack[]
}

export interface GpTabRecord {
  id: number
  name: string
  songName: string
  bandName: string
  fileType: string
  downloadUrl: string
  gpMetadata?: GpSong | null
  createdAt?: string
  updatedAt?: string
}
