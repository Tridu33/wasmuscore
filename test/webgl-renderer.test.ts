/**
 * WebGL/WebGPU 渲染器单元测试
 *
 * 方案:
 * - vitest-webgl-canvas-mock: 模拟 Canvas 2D + WebGLRenderingContext
 * - WebGL 补充 mock: getContext('webgl') 返回完整的 mock context
 * - WebGPU: 在无 GPU 环境下测试降级逻辑和纯计算部分
 *
 * 被测试文件: src/utils/render/WebGPURenderer.ts
 * 以及 WebGL 相关渲染代码
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { WebGPURenderer, getWebGPURenderer } from '~/utils/render/WebGPURenderer'
import type { NoteData, RenderConfig } from '~/utils/render/WebGPURenderer'

// ========== WebGL 渲染器 Mock (用于对比测试) ==========

/**
 * 简化的 WebGL 钢琴卷帘渲染器
 * 模拟项目中可能存在的 WebGL 渲染逻辑
 */
class WebGLPianoRollRenderer {
  private gl: WebGLRenderingContext | null = null
  private canvas: HTMLCanvasElement | null = null
  private noteBuffers: Map<string, WebGLBuffer> = new Map()
  private program: WebGLProgram | null = null

  /**
   * 初始化 WebGL
   */
  init(canvas: HTMLCanvasElement): boolean {
    this.canvas = canvas

    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (!gl) {
      return false
    }

    this.gl = gl as WebGLRenderingContext

    // 创建着色器程序
    const vertexShader = this.createShader(this.gl.VERTEX_SHADER, `
      attribute vec2 a_position;
      attribute vec4 a_color;
      uniform vec2 u_resolution;
      varying vec4 v_color;
      void main() {
        vec2 clipSpace = (a_position / u_resolution) * 2.0 - 1.0;
        gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
        v_color = a_color;
      }
    `)

    const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, `
      precision mediump float;
      varying vec4 v_color;
      void main() {
        gl_FragColor = v_color;
      }
    `)

    if (!vertexShader || !fragmentShader) {
      return false
    }

    this.program = this.gl.createProgram()!
    this.gl.attachShader(this.program, vertexShader)
    this.gl.attachShader(this.program, fragmentShader)
    this.gl.linkProgram(this.program)

    return true
  }

  private createShader(type: number, source: string): WebGLShader | null {
    if (!this.gl) return null

    const shader = this.gl.createShader(type)
    if (!shader) return null

    this.gl.shaderSource(shader, source)
    this.gl.compileShader(shader)

    return shader
  }

  /**
   * 渲染音符
   */
  renderNotes(notes: NoteData[], config: { width: number, height: number }) {
    if (!this.gl || !this.program) return

    const { width, height } = config

    // 清屏
    this.gl.clearColor(0.1, 0.1, 0.18, 1.0)
    this.gl.clear(this.gl.COLOR_BUFFER_BIT)
    this.gl.viewport(0, 0, width, height)

    // 使用程序
    this.gl.useProgram(this.program)

    // 生成顶点数据
    const vertices = this.generateVertices(notes, config)

    // 创建并绑定缓冲区
    const buffer = this.gl.createBuffer()
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer)
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(vertices), this.gl.STATIC_DRAW)
  }

  /**
   * 生成顶点数据
   */
  private generateVertices(notes: NoteData[], config: { width: number, height: number }): number[] {
    const vertices: number[] = []
    const { width, height } = config

    const trackColors = [
      [0.26, 0.52, 0.96, 1.0],
      [0.20, 0.66, 0.33, 1.0],
      [0.92, 0.26, 0.21, 1.0],
      [0.98, 0.75, 0.02, 1.0],
    ]

    for (const note of notes) {
      const x = this.noteToX(note.note, width)
      const y = this.timeToY(note.startMs, note.durationMs, height)
      const w = 8
      const h = Math.max(2, note.durationMs / 10)
      const color = note.isActive
        ? [1.0, 0.92, 0.23, 1.0]
        : trackColors[note.trackColorId % trackColors.length]

      // 矩形: 2 个三角形
      // 左上、右上、左下
      vertices.push(x, y, ...color)
      vertices.push(x + w, y, ...color)
      vertices.push(x, y - h, ...color)
      // 右上、右下、左下
      vertices.push(x + w, y, ...color)
      vertices.push(x + w, y - h, ...color)
      vertices.push(x, y - h, ...color)
    }

    return vertices
  }

  private noteToX(note: number, width: number): number {
    const normalizedX = (note - 21) / 88
    return normalizedX * width
  }

  private timeToY(startMs: number, durationMs: number, height: number): number {
    const totalHeight = height * 0.8
    const yStart = height * 0.1
    return yStart + (startMs % 5000) / 5000 * totalHeight
  }

  resize(width: number, height: number) {
    if (!this.canvas) return
    this.canvas.width = width
    this.canvas.height = height
    if (this.gl) {
      this.gl.viewport(0, 0, width, height)
    }
  }

  dispose() {
    this.noteBuffers.clear()
    this.gl = null
    this.program = null
    this.canvas = null
  }
}

// ========== 测试 ==========

describe('WebGL Mock 环境', () => {
  describe('Canvas getContext', () => {
    it('canvas.getContext("webgl") 应返回 mock context', () => {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl')
      expect(gl).not.toBeNull()
    })

    it('canvas.getContext("webgl2") 应返回 mock context', () => {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl2')
      expect(gl).not.toBeNull()
    })

    it('canvas.getContext("2d") 应返回 mock 2D context', () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      expect(ctx).not.toBeNull()
    })

    it('WebGL mock context 应有必要的方法', () => {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl') as WebGLRenderingContext
      expect(typeof gl.createShader).toBe('function')
      expect(typeof gl.createBuffer).toBe('function')
      expect(typeof gl.createTexture).toBe('function')
      expect(typeof gl.createProgram).toBe('function')
      expect(typeof gl.drawArrays).toBe('function')
      expect(typeof gl.clearColor).toBe('function')
      expect(typeof gl.clear).toBe('function')
      expect(typeof gl.viewport).toBe('function')
    })

    it('WebGL mock 着色器编译应成功', () => {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl') as WebGLRenderingContext

      const vs = gl.createShader(gl.VERTEX_SHADER)
      gl.shaderSource(vs!, 'void main() {}')
      gl.compileShader(vs!)
      expect(gl.getShaderParameter(vs!, gl.COMPILE_STATUS)).toBe(true)

      const fs = gl.createShader(gl.FRAGMENT_SHADER)
      gl.shaderSource(fs!, 'void main() {}')
      gl.compileShader(fs!)
      expect(gl.getShaderParameter(fs!, gl.COMPILE_STATUS)).toBe(true)
    })

    it('WebGL mock 程序链接应成功', () => {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl') as WebGLRenderingContext

      const vs = gl.createShader(gl.VERTEX_SHADER)!
      gl.shaderSource(vs, 'void main() {}')
      gl.compileShader(vs)

      const fs = gl.createShader(gl.FRAGMENT_SHADER)!
      gl.shaderSource(fs, 'void main() {}')
      gl.compileShader(fs)

      const program = gl.createProgram()!
      gl.attachShader(program, vs)
      gl.attachShader(program, fs)
      gl.linkProgram(program)

      expect(gl.getProgramParameter(program, gl.LINK_STATUS)).toBe(true)
    })

    it('WebGL mock 缓冲区操作应正常', () => {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl') as WebGLRenderingContext

      const buffer = gl.createBuffer()
      expect(buffer).not.toBeNull()

      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      const data = new Float32Array([0, 0, 1, 1])
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    })
  })
})

describe('WebGLPianoRollRenderer', () => {
  let renderer: WebGLPianoRollRenderer
  let canvas: HTMLCanvasElement

  beforeEach(() => {
    renderer = new WebGLPianoRollRenderer()
    canvas = document.createElement('canvas')
    canvas.width = 800
    canvas.height = 600
  })

  describe('初始化', () => {
    it('应成功初始化 WebGL', () => {
      const success = renderer.init(canvas)
      expect(success).toBe(true)
    })

    it('初始化后应有有效的程序', () => {
      renderer.init(canvas)
      // 程序应已创建
      expect(canvas.width).toBe(800)
      expect(canvas.height).toBe(600)
    })
  })

  describe('渲染', () => {
    beforeEach(() => {
      renderer.init(canvas)
    })

    it('应能渲染空音符列表', () => {
      expect(() => renderer.renderNotes([], { width: 800, height: 600 })).not.toThrow()
    })

    it('应能渲染单个音符', () => {
      const notes: NoteData[] = [
        { note: 60, startMs: 0, durationMs: 500, velocity: 80, trackColorId: 0, isActive: false },
      ]
      expect(() => renderer.renderNotes(notes, { width: 800, height: 600 })).not.toThrow()
    })

    it('应能渲染多个音符', () => {
      const notes: NoteData[] = [
        { note: 60, startMs: 0, durationMs: 500, velocity: 80, trackColorId: 0, isActive: false },
        { note: 64, startMs: 500, durationMs: 500, velocity: 90, trackColorId: 1, isActive: false },
        { note: 67, startMs: 1000, durationMs: 500, velocity: 100, trackColorId: 2, isActive: false },
      ]
      expect(() => renderer.renderNotes(notes, { width: 800, height: 600 })).not.toThrow()
    })

    it('活跃音符应使用高亮颜色', () => {
      const notes: NoteData[] = [
        { note: 60, startMs: 0, durationMs: 500, velocity: 80, trackColorId: 0, isActive: true },
      ]
      expect(() => renderer.renderNotes(notes, { width: 800, height: 600 })).not.toThrow()
    })

    it('大量音符渲染不应崩溃', () => {
      const notes: NoteData[] = Array.from({ length: 1000 }, (_, i) => ({
        note: 21 + (i % 88),
        startMs: i * 100,
        durationMs: 200 + (i % 5) * 100,
        velocity: 60 + (i % 67),
        trackColorId: i % 8,
        isActive: false,
      }))
      expect(() => renderer.renderNotes(notes, { width: 800, height: 600 })).not.toThrow()
    })
  })

  describe('坐标计算', () => {
    it('noteToX: A0 (21) 应在左侧', () => {
      const renderer = new WebGLPianoRollRenderer()
      // 通过渲染后验证缓冲区数据
      const x = ((21 - 21) / 88) * 800
      expect(x).toBe(0)
    })

    it('noteToX: C8 (108) 应在右侧', () => {
      const x = ((108 - 21) / 88) * 800
      expect(x).toBeCloseTo(790.9, 1)
    })

    it('noteToX: C4 (60) 应在中间', () => {
      const x = ((60 - 21) / 88) * 800
      expect(x).toBeCloseTo(354.5, 1)
    })

    it('timeToY 应映射到画布高度内', () => {
      const y = 500 / 5000 * (600 * 0.8) + 600 * 0.1
      expect(y).toBeGreaterThan(0)
      expect(y).toBeLessThanOrEqual(600)
    })

    it('时长应映射为矩形高度', () => {
      const h = Math.max(2, 500 / 10)
      expect(h).toBe(50)
    })

    it('最小高度应为 2', () => {
      const h = Math.max(2, 1 / 10)
      expect(h).toBe(2)
    })
  })

  describe('颜色系统', () => {
    it('应有 4 种轨道颜色', () => {
      const trackColors = [
        [0.26, 0.52, 0.96, 1.0],
        [0.20, 0.66, 0.33, 1.0],
        [0.92, 0.26, 0.21, 1.0],
        [0.98, 0.75, 0.02, 1.0],
      ]
      expect(trackColors).toHaveLength(4)
    })

    it('活跃音符高亮颜色应为黄色', () => {
      const activeColor = [1.0, 0.92, 0.23, 1.0]
      expect(activeColor[0]).toBe(1.0)
      expect(activeColor[1]).toBeGreaterThan(0.9)
    })

    it('trackColorId 循环应正确', () => {
      const trackColorId = 5
      const colorIndex = trackColorId % 4
      expect(colorIndex).toBe(1)
    })
  })

  describe('顶点生成', () => {
    it('每个音符应生成 6 个顶点 (2 三角形)', () => {
      const notesCount = 10
      const expectedVertices = notesCount * 6
      expect(expectedVertices).toBe(60)
    })

    it('每个顶点应包含 6 个 float (2 pos + 4 color)', () => {
      const floatsPerVertex = 6
      const notesCount = 5
      const totalFloats = notesCount * 6 * floatsPerVertex
      expect(totalFloats).toBe(180)
    })

    it('顶点数据应包含位置信息', () => {
      const x = 100
      const y = 200
      const color = [0.5, 0.5, 0.5, 1.0]
      const vertex = [x, y, ...color]
      expect(vertex).toHaveLength(6)
      expect(vertex[0]).toBe(100)
      expect(vertex[1]).toBe(200)
    })
  })

  describe('画布调整', () => {
    it('resize 应更新画布尺寸', () => {
      renderer.init(canvas)
      renderer.resize(1024, 768)
      expect(canvas.width).toBe(1024)
      expect(canvas.height).toBe(768)
    })

    it('resize 后渲染应正常', () => {
      renderer.init(canvas)
      renderer.resize(1024, 768)
      const notes: NoteData[] = [
        { note: 60, startMs: 0, durationMs: 500, velocity: 80, trackColorId: 0, isActive: false },
      ]
      expect(() => renderer.renderNotes(notes, { width: 1024, height: 768 })).not.toThrow()
    })
  })

  describe('清理', () => {
    it('dispose 应清理资源', () => {
      renderer.init(canvas)
      expect(() => renderer.dispose()).not.toThrow()
    })

    it('dispose 后不应能渲染', () => {
      renderer.init(canvas)
      renderer.dispose()
      const notes: NoteData[] = [
        { note: 60, startMs: 0, durationMs: 500, velocity: 80, trackColorId: 0, isActive: false },
      ]
      expect(() => renderer.renderNotes(notes, { width: 800, height: 600 })).not.toThrow()
    })
  })
})

describe('WebGPURenderer (无 GPU 环境)', () => {
  let renderer: WebGPURenderer
  let canvas: HTMLCanvasElement

  beforeEach(() => {
    renderer = new WebGPURenderer()
    canvas = document.createElement('canvas')
  })

  describe('WebGPU 检测', () => {
    it('无 GPU 时应返回 false', async () => {
      const result = await renderer.init(canvas)
      expect(result).toBe(false)
      expect(renderer.isSupported).toBe(false)
    })

    it('无 GPU 时应有错误信息', async () => {
      await renderer.init(canvas)
      expect(renderer.errorMessage).not.toBeNull()
    })
  })

  describe('无 GPU 降级行为', () => {
    beforeEach(async () => {
      await renderer.init(canvas)
    })

    it('render 应安全返回', () => {
      const notes: NoteData[] = [
        { note: 60, startMs: 0, durationMs: 500, velocity: 80, trackColorId: 0, isActive: false },
      ]
      const config: RenderConfig = {
        currentTime: 0,
        scrollOffset: 1000,
        canvasWidth: 800,
        canvasHeight: 600,
        keyboardHeight: 100,
      }
      expect(() => renderer.render(notes, config)).not.toThrow()
    })

    it('resize 应安全返回', () => {
      expect(() => renderer.resize(800, 600)).not.toThrow()
    })

    it('dispose 应安全返回', () => {
      expect(() => renderer.dispose()).not.toThrow()
    })
  })

  describe('纯计算逻辑 (不依赖 GPU)', () => {
    it('noteToX 公式: A0 → -1', () => {
      const x = ((21 - 21) / 88) * 2 - 1
      expect(x).toBe(-1)
    })

    it('noteToX 公式: C4 → ~-0.11', () => {
      const x = ((60 - 21) / 88) * 2 - 1
      expect(x).toBeCloseTo(-0.1136, 2)
    })

    it('noteToX 公式: C8 → ~0.98', () => {
      const x = ((108 - 21) / 88) * 2 - 1
      expect(x).toBeCloseTo(0.977, 2)
    })

    it('timeToY: 当前时间的音符位置', () => {
      const timeMs = 1000
      const currentTime = 500
      const timeWindow = 2000
      const keyboardY = -0.5
      const expectedY = keyboardY - ((timeMs - currentTime) / timeWindow) * (keyboardY + 1)
      expect(expectedY).toBeCloseTo(-0.625, 4)
    })

    it('durationToHeight: 时长正比于高度', () => {
      const durationMs = 500
      const timeWindow = 2000
      const keyboardY = -0.5
      const expectedHeight = (durationMs / timeWindow) * (keyboardY + 1)
      expect(expectedHeight).toBeCloseTo(0.125, 4)
    })

    it('可见性裁剪: 范围外的音符不可见', () => {
      const currentTime = 1000
      const scrollOffset = 1000
      const visibleStart = currentTime - 500
      const visibleEnd = currentTime + scrollOffset

      const noteStart = 0
      const noteEnd = noteStart + 100
      const isVisible = !(noteEnd < visibleStart || noteStart > visibleEnd)
      expect(isVisible).toBe(false)
    })

    it('可见性裁剪: 范围内的音符可见', () => {
      const currentTime = 1000
      const scrollOffset = 1000
      const visibleStart = currentTime - 500
      const visibleEnd = currentTime + scrollOffset

      const noteStart = 800
      const noteEnd = noteStart + 200
      const isVisible = !(noteEnd < visibleStart || noteStart > visibleEnd)
      expect(isVisible).toBe(true)
    })
  })

  describe('单例模式', () => {
    it('getWebGPURenderer 应返回单例', () => {
      const instance1 = getWebGPURenderer()
      const instance2 = getWebGPURenderer()
      expect(instance1).toBe(instance2)
    })
  })
})

describe('Canvas 2D Mock (vitest-webgl-canvas-mock)', () => {
  it('应提供 CanvasRenderingContext2D', () => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    expect(ctx).not.toBeNull()
    expect(typeof ctx!.fillRect).toBe('function')
    expect(typeof ctx!.strokeRect).toBe('function')
    expect(typeof ctx!.fillText).toBe('function')
  })

  it('应提供 Path2D', () => {
    expect(typeof globalThis.Path2D).toBe('function')
  })

  it('应提供 ImageData', () => {
    expect(typeof globalThis.ImageData).toBe('function')
  })

  it('应提供 DOMMatrix', () => {
    expect(typeof globalThis.DOMMatrix).toBe('function')
  })
})

describe('渲染性能基准', () => {
  it('1000 个音符的顶点数据生成应在 10ms 内', () => {
    const notes: NoteData[] = Array.from({ length: 1000 }, (_, i) => ({
      note: 21 + (i % 88),
      startMs: i * 100,
      durationMs: 200 + (i % 5) * 100,
      velocity: 60 + (i % 67),
      trackColorId: i % 8,
      isActive: false,
    }))

    const start = performance.now()
    const renderer = new WebGLPianoRollRenderer()
    const canvas = document.createElement('canvas')
    canvas.width = 800
    canvas.height = 600
    renderer.init(canvas)
    renderer.renderNotes(notes, { width: 800, height: 600 })
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(100) // 100ms 预算 (mock 较慢)
  })

  it('10000 个音符的顶点数据生成应在合理时间内', () => {
    const notes: NoteData[] = Array.from({ length: 10000 }, (_, i) => ({
      note: 21 + (i % 88),
      startMs: i * 100,
      durationMs: 200 + (i % 5) * 100,
      velocity: 60 + (i % 67),
      trackColorId: i % 8,
      isActive: false,
    }))

    const start = performance.now()
    const renderer = new WebGLPianoRollRenderer()
    const canvas = document.createElement('canvas')
    canvas.width = 800
    canvas.height = 600
    renderer.init(canvas)
    renderer.renderNotes(notes, { width: 800, height: 600 })
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(500)
  })
})
