declare module '@logue/sf2synth' {
  interface WebMidiLinkOptions {
    url?: string
    placeholder?: string
    drawSynth?: boolean
    cache?: boolean
  }

  interface WebMidiLink {
    ready: boolean
    setup(url?: string): Promise<void>
    setupByBuffer(buffer: ArrayBuffer): void
    processMidiMessage(message: [number, number, number]): void
    setLoadCallback(callback: () => void): void
  }

  interface Sf2SynthModule {
    version: string
    build: string
    WebMidiLink: {
      new (options?: WebMidiLinkOptions): WebMidiLink
    }
    WebMidiApi: any
    Parser: any
  }

  const sf2synth: Sf2SynthModule
  export default sf2synth
}
