declare module 'sf2-player' {
  export interface Sf2PlayerOptions {
    audioContext?: AudioContext
    destination?: AudioNode
    onProgress?: (progress: number) => void
  }

  export interface PlayNoteOptions {
    gain?: number
    channel?: number
  }

  export class Sf2Player {
    constructor(url: string, options?: Sf2PlayerOptions)
    load(): Promise<void>
    playNote(note: number, options?: PlayNoteOptions): Promise<any>
    stop(releaseTime?: number): Promise<void>
    destroy(): void
  }
}
