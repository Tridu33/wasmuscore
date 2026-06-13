/**
 * Vitest 测试环境 Setup 文件
 *
 * 组合方案:
 * 1. CI/无头测试: web-audio-api 提供 AudioContext + OfflineAudioContext
 * 2. WebGL Mock: 手动 mock Canvas WebGL context
 * 3. Proxy 注入: 将第三方 AudioContext 注入为 globalThis
 */

// ========== 1. Web Audio API (CI/无头兼容) ==========
import { AudioContext, OfflineAudioContext } from 'web-audio-api'

globalThis.AudioContext = AudioContext as unknown as typeof AudioContext
globalThis.OfflineAudioContext = OfflineAudioContext as unknown as typeof OfflineAudioContext

// ========== 2. WebGL Mock (手动) ==========
if (typeof globalThis.HTMLCanvasElement !== 'undefined') {
  const origGetContext = globalThis.HTMLCanvasElement.prototype.getContext
  globalThis.HTMLCanvasElement.prototype.getContext = function (contextId: string, ...args: any[]) {
    if (contextId === 'webgl' || contextId === 'webgl2' || contextId === 'experimental-webgl') {
      const gl = {
        createShader: () => ({}) as any,
        shaderSource: () => {},
        compileShader: () => {},
        getShaderParameter: () => true,
        createProgram: () => ({}) as any,
        attachShader: () => {},
        linkProgram: () => {},
        getProgramParameter: () => true,
        useProgram: () => {},
        createBuffer: () => ({}) as any,
        bindBuffer: () => {},
        bufferData: () => {},
        createTexture: () => ({}) as any,
        bindTexture: () => {},
        texImage2D: () => {},
        texParameteri: () => {},
        getUniformLocation: () => ({}),
        uniform1f: () => {},
        uniform1i: () => {},
        drawArrays: () => {},
        clearColor: () => {},
        clear: () => {},
        viewport: () => {},
        enable: () => {},
        blendFunc: () => {},
        getExtension: () => null,
        getProgramInfoLog: () => '',
        getShaderInfoLog: () => '',
        VERTEX_SHADER: 0x8B31,
        FRAGMENT_SHADER: 0x8B30,
        COMPILE_STATUS: 0x8B81,
        LINK_STATUS: 0x8B82,
        COLOR_BUFFER_BIT: 0x4000,
        ARRAY_BUFFER: 0x8892,
        STATIC_DRAW: 0x88E4,
      } as any
      return gl
    }
    if (contextId === '2d') {
      return {
        fillRect: () => {},
        strokeRect: () => {},
        fillText: () => {},
        fill: () => {},
        stroke: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        arc: () => {},
        closePath: () => {},
        clearRect: () => {},
        save: () => {},
        restore: () => {},
        setTransform: () => {},
        measureText: () => ({ width: 0 }),
      } as any
    }
    return origGetContext.call(this, contextId, ...args)
  }
}

// 补充 global 类
if (!globalThis.Path2D) {
  globalThis.Path2D = class Path2D {
    addPath() {}
    arc() {}
    arcTo() {}
    bezierCurveTo() {}
    closePath() {}
    ellipse() {}
    lineTo() {}
    moveTo() {}
    quadraticCurveTo() {}
    rect() {}
  } as any
}

if (!globalThis.ImageData) {
  globalThis.ImageData = class ImageData {
    width: number
    height: number
    data: Uint8ClampedArray
    constructor(w: number, h: number) {
      this.width = w
      this.height = h
      this.data = new Uint8ClampedArray(w * h * 4)
    }
  } as any
}

if (!globalThis.DOMMatrix) {
  globalThis.DOMMatrix = class DOMMatrix {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0
    constructor() {}
  } as any
}

// ========== 3. WebGPU Mock ==========
if (!globalThis.navigator) {
  globalThis.navigator = {} as Navigator
}

if (!(globalThis.navigator as any).gpu) {
  Object.defineProperty(globalThis.navigator, 'gpu', {
    value: undefined,
    writable: true,
    configurable: true,
  })
}

// ========== 4. 每测试前重置 ==========
import { beforeEach, vi } from 'vitest'

beforeEach(() => {
  vi.clearAllMocks()
})
