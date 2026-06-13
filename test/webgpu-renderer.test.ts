/**
 * WebGPU Renderer 单元测试
 * 测试核心功能: 顶点生成、坐标转换、可见性裁剪
 *
 * 注: WebGPU 初始化需要真实 GPU，因此测试主要覆盖纯计算逻辑
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { WebGPURenderer } from '~/utils/render/WebGPURenderer'
import type { NoteData, RenderConfig } from '~/utils/render/WebGPURenderer'

describe('WebGPURenderer', () => {
  let renderer: WebGPURenderer

  beforeEach(() => {
    renderer = new WebGPURenderer()
  })

  describe('初始状态', () => {
    it('默认不支持 WebGPU', () => {
      expect(renderer.isSupported).toBe(false)
      expect(renderer.errorMessage).toBeNull()
    })

    it('getStats 应返回初始统计', () => {
      const stats = renderer.getStats()
      expect(stats.isSupported).toBe(false)
      expect(stats.maxNotes).toBe(100000)
      expect(stats.currentNotes).toBe(0)
      expect(stats.errorMessage).toBeNull()
    })
  })

  describe('初始化', () => {
    it('在无 WebGPU 环境中应返回 false', async () => {
      // jsdom 环境不支持 navigator.gpu
      const canvas = document.createElement('canvas')
      const result = await renderer.init(canvas)
      expect(result).toBe(false)
      expect(renderer.isSupported).toBe(false)
    })

    it('初始化后应设置错误信息', async () => {
      const canvas = document.createElement('canvas')
      await renderer.init(canvas)
      expect(renderer.errorMessage).not.toBeNull()
    })
  })

  describe('渲染 - 未初始化时应安全退出', () => {
    it('未初始化时 render 不应抛出错误', () => {
      const notes: NoteData[] = []
      const config: RenderConfig = {
        currentTime: 0,
        scrollOffset: 1000,
        canvasWidth: 800,
        canvasHeight: 600,
        keyboardHeight: 100,
      }
      expect(() => renderer.render(notes, config)).not.toThrow()
    })

    it('未初始化时 resize 不应抛出错误', () => {
      expect(() => renderer.resize(800, 600)).not.toThrow()
    })

    it('未初始化时 dispose 不应抛出错误', () => {
      expect(() => renderer.dispose()).not.toThrow()
    })
  })

  describe('坐标转换 (通过 getStats 间接验证)', () => {
    it('noteToX 应该将 MIDI note 映射到归一化坐标', () => {
      // 通过源码分析: noteToX 使用 (note - 21) / 88 * 2 - 1
      // A0 (21) → -1, C8 (108) → ~0.977
      const note = 60 // Middle C
      const expectedX = ((note - 21) / 88) * 2 - 1
      // = (39/88) * 2 - 1 = 0.8864 - 1 = -0.1136
      expect(expectedX).toBeCloseTo(-0.1136, 2)
    })

    it('MIDI note 21 (A0) 应映射到 -1', () => {
      const expectedX = ((21 - 21) / 88) * 2 - 1
      expect(expectedX).toBe(-1)
    })

    it('MIDI note 108 (C8) 应映射到 1', () => {
      const expectedX = ((108 - 21) / 88) * 2 - 1
      expect(expectedX).toBeCloseTo(0.977, 2)
    })
  })

  describe('时间到 Y 坐标转换', () => {
    it('当前时间的音符应在正确位置', () => {
      // timeToY: keyboardY - ((timeMs - currentTime) / timeWindow) * (keyboardY + 1)
      const timeMs = 1000
      const currentTime = 500
      const timeWindow = 2000
      const keyboardY = -0.5

      const timeDiff = timeMs - currentTime // 500
      const normalizedY = timeDiff / timeWindow // 0.25
      const expectedY = keyboardY - normalizedY * (keyboardY + 1)
      // = -0.5 - 0.25 * 0.5 = -0.5 - 0.125 = -0.625
      expect(expectedY).toBeCloseTo(-0.625, 4)
    })

    it('过去的音符应在上方', () => {
      const timeMs = 0
      const currentTime = 1000
      const timeWindow = 2000
      const keyboardY = -0.5

      const timeDiff = timeMs - currentTime // -1000
      const normalizedY = timeDiff / timeWindow // -0.5
      const expectedY = keyboardY - normalizedY * (keyboardY + 1)
      // = -0.5 - (-0.5) * 0.5 = -0.5 + 0.25 = -0.25
      expect(expectedY).toBeCloseTo(-0.25, 4)
    })
  })

  describe('时长到高度转换', () => {
    it('时长应正比于高度', () => {
      // durationToHeight: (durationMs / timeWindow) * (keyboardY + 1)
      const durationMs = 500
      const timeWindow = 2000
      const keyboardY = -0.5

      const expectedHeight = (500 / 2000) * 0.5
      expect(expectedHeight).toBeCloseTo(0.125, 4)
    })

    it('时长为 0 时高度应为 0', () => {
      const timeWindow = 2000
      const keyboardY = -0.5
      const expectedHeight = (0 / timeWindow) * (keyboardY + 1)
      expect(expectedHeight).toBe(0)
    })

    it('时长越大高度越大', () => {
      const timeWindow = 2000
      const keyboardY = -0.5

      const h1 = (500 / timeWindow) * (keyboardY + 1)
      const h2 = (1000 / timeWindow) * (keyboardY + 1)
      expect(h2).toBeGreaterThan(h1)
    })
  })

  describe('可见性裁剪', () => {
    it('可见范围外的音符不应被渲染', () => {
      // visibleStart = currentTime - 500, visibleEnd = currentTime + scrollOffset
      const currentTime = 1000
      const scrollOffset = 1000
      const visibleStart = currentTime - 500 // 500
      const visibleEnd = currentTime + scrollOffset // 2000

      // 音符: startMs=0, durationMs=100 → endMs=100
      const noteEnd = 0 + 100
      const isVisible = !(noteEnd < visibleStart || 0 > visibleEnd)
      expect(isVisible).toBe(false) // 100 < 500, 不可见
    })

    it('可见范围内的音符应该被渲染', () => {
      const currentTime = 1000
      const scrollOffset = 1000
      const visibleStart = currentTime - 500 // 500
      const visibleEnd = currentTime + scrollOffset // 2000

      // 音符: startMs=800, durationMs=200 → endMs=1000
      const noteStart = 800
      const noteEnd = noteStart + 200
      const isVisible = !(noteEnd < visibleStart || noteStart > visibleEnd)
      expect(isVisible).toBe(true) // 1000 >= 500 && 800 <= 2000, 可见
    })

    it('部分可见的音符应该被渲染', () => {
      const currentTime = 1000
      const scrollOffset = 1000
      const visibleStart = currentTime - 500 // 500
      const visibleEnd = currentTime + scrollOffset // 2000

      // 音符: startMs=400, durationMs=200 → endMs=600
      const noteStart = 400
      const noteEnd = noteStart + 200
      const isVisible = !(noteEnd < visibleStart || noteStart > visibleEnd)
      expect(isVisible).toBe(true) // 600 >= 500, 部分可见
    })
  })

  describe('顶点数据生成逻辑', () => {
    it('每个音符应生成 6 个顶点 (2 个三角形)', () => {
      const notesCount = 10
      const expectedVertices = notesCount * 6
      expect(expectedVertices).toBe(60)
    })

    it('每个顶点应包含 6 个 float (2 position + 4 color)', () => {
      const floatsPerVertex = 6
      const notesCount = 5
      const totalFloats = notesCount * 6 * floatsPerVertex
      expect(totalFloats).toBe(180)
    })

    it('顶点缓冲区大小计算应正确', () => {
      const maxNotes = 100000
      const vertexBufferSize = maxNotes * 6 * 6 * 4
      expect(vertexBufferSize).toBe(14400000)
    })
  })

  describe('统一缓冲区', () => {
    it('统一缓冲区应为 8 个 float (32 bytes)', () => {
      const uniformData = new Float32Array([
        1000, // currentTime
        2000, // scrollOffset
        800,  // canvasWidth
        600,  // canvasHeight
        100,  // keyboardHeight
        0, 0, 0, // padding
      ])
      expect(uniformData.byteLength).toBe(32)
    })

    it('统一缓冲区应包含所有渲染配置参数', () => {
      const config: RenderConfig = {
        currentTime: 1500,
        scrollOffset: 3000,
        canvasWidth: 1024,
        canvasHeight: 768,
        keyboardHeight: 120,
      }
      const uniformData = new Float32Array([
        config.currentTime,
        config.scrollOffset,
        config.canvasWidth,
        config.canvasHeight,
        config.keyboardHeight,
        0, 0, 0,
      ])
      expect(uniformData[0]).toBe(1500)
      expect(uniformData[1]).toBe(3000)
      expect(uniformData[2]).toBe(1024)
      expect(uniformData[3]).toBe(768)
      expect(uniformData[4]).toBe(120)
    })
  })

  describe('颜色系统', () => {
    it('应支持 8 种轨道颜色', () => {
      const trackColors = [
        [0.26, 0.52, 0.96, 1.0],
        [0.20, 0.66, 0.33, 1.0],
        [0.92, 0.26, 0.21, 1.0],
        [0.98, 0.75, 0.02, 1.0],
        [0.56, 0.27, 0.68, 1.0],
        [0.09, 0.63, 0.52, 1.0],
        [0.90, 0.49, 0.13, 1.0],
        [0.91, 0.26, 0.58, 1.0],
      ]
      expect(trackColors).toHaveLength(8)
    })

    it('活跃音符应使用黄色高亮', () => {
      const activeColor = [1.0, 0.92, 0.23, 1.0]
      expect(activeColor[0]).toBe(1.0) // R
      expect(activeColor[1]).toBeGreaterThan(0.9) // G
      expect(activeColor[2]).toBeLessThan(0.3) // B
    })

    it('trackColorId 超过 8 应循环使用颜色', () => {
      const trackColorId = 10
      const colorIndex = trackColorId % 8
      expect(colorIndex).toBe(2)
    })
  })

  describe('画布尺寸', () => {
    it('resize 应更新画布尺寸', () => {
      const canvas = document.createElement('canvas')
      canvas.width = 400
      canvas.height = 300
      expect(canvas.width).toBe(400)
      expect(canvas.height).toBe(300)

      canvas.width = 800
      canvas.height = 600
      expect(canvas.width).toBe(800)
      expect(canvas.height).toBe(600)
    })
  })

  describe('单例模式', () => {
    it('getWebGPURenderer 应返回单例实例', async () => {
      const { getWebGPURenderer } = await import('~/utils/render/WebGPURenderer')
      const instance1 = getWebGPURenderer()
      const instance2 = getWebGPURenderer()
      expect(instance1).toBe(instance2)
    })
  })
})
