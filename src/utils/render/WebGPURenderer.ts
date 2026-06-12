/**
 * WebGPU 钢琴卷帘渲染器
 * 使用 GPU 并行渲染大量音符,支持 10万+ 音符实时渲染
 */

export interface NoteData {
  note: number // MIDI note (0-127)
  startMs: number
  durationMs: number
  velocity: number
  trackColorId: number
  isActive: boolean
}

export interface RenderConfig {
  currentTime: number
  scrollOffset: number // 毫秒,可视范围
  canvasWidth: number
  canvasHeight: number
  keyboardHeight: number
}

export class WebGPURenderer {
  private device: GPUDevice | null = null
  private context: GPUCanvasContext | null = null
  private canvas: HTMLCanvasElement | null = null

  // 渲染管线
  private pipeline: GPURenderPipeline | null = null
  private uniformBuffer: GPUBuffer | null = null
  private noteBuffer: GPUBuffer | null = null
  private bindGroup: GPUBindGroup | null = null

  // 容量
  private maxNotes = 100000
  private noteCount = 0

  // 是否支持 WebGPU
  public isSupported = false
  public errorMessage: string | null = null

  /**
   * 初始化 WebGPU
   */
  async init(canvas: HTMLCanvasElement): Promise<boolean> {
    this.canvas = canvas

    try {
      // 检查 WebGPU 支持
      if (!navigator.gpu) {
        this.isSupported = false
        this.errorMessage = 'WebGPU not supported in this browser'
        return false
      }

      // 请求适配器
      const adapter = await navigator.gpu.requestAdapter()
      if (!adapter) {
        this.isSupported = false
        this.errorMessage = 'Failed to get GPU adapter'
        return false
      }

      // 请求设备
      this.device = await adapter.requestDevice()

      // 获取 Canvas 上下文
      this.context = canvas.getContext('webgpu')
      if (!this.context) {
        this.isSupported = false
        this.errorMessage = 'Failed to get WebGPU context'
        return false
      }

      // 配置上下文
      const canvasFormat = navigator.gpu.getPreferredCanvasFormat()
      this.context.configure({
        device: this.device,
        format: canvasFormat,
        alphaMode: 'premultiplied',
      })

      // 创建渲染管线
      await this.createPipeline(canvasFormat)

      // 创建缓冲区
      this.createBuffers()

      this.isSupported = true
      return true
    }
    catch (error: any) {
      this.isSupported = false
      this.errorMessage = `WebGPU initialization failed: ${error.message}`
      console.error(this.errorMessage)
      return false
    }
  }

  /**
   * 创建渲染管线和着色器
   */
  private async createPipeline(canvasFormat: GPUTextureFormat): Promise<void> {
    if (!this.device) {
      return
    }

    // WGSL 顶点着色器
    const vertexShaderCode = `
      struct VertexInput {
        @location(0) position: vec2f,
        @location(1) color: vec4f,
      }

      struct VertexOutput {
        @builtin(position) position: vec4f,
        @location(0) color: vec4f,
      }

      @vertex
      fn vs_main(input: VertexInput) -> VertexOutput {
        var output: VertexOutput;
        output.position = vec4f(input.position, 0.0, 1.0);
        output.color = input.color;
        return output;
      }
    `

    // WGSL 片段着色器
    const fragmentShaderCode = `
      @fragment
      fn fs_main(input: VertexOutput) -> @location(0) vec4f {
        return input.color;
      }
    `

    // 创建着色器模块
    const vertexModule = this.device.createShaderModule({ code: vertexShaderCode })
    const fragmentModule = this.device.createShaderModule({ code: fragmentShaderCode })

    // 创建渲染管线
    this.pipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: vertexModule,
        entryPoint: 'vs_main',
        buffers: [
          {
            // 顶点缓冲区: position (2 floats) + color (4 floats)
            arrayStride: 6 * 4, // 6 floats * 4 bytes
            attributes: [
              {
                // position
                shaderLocation: 0,
                offset: 0,
                format: 'float32x2',
              },
              {
                // color
                shaderLocation: 1,
                offset: 2 * 4,
                format: 'float32x4',
              },
            ],
          },
        ],
      },
      fragment: {
        module: fragmentModule,
        entryPoint: 'fs_main',
        targets: [{ format: canvasFormat }],
      },
      primitive: {
        topology: 'triangle-list',
      },
    })
  }

  /**
   * 创建缓冲区
   */
  private createBuffers(): void {
    if (!this.device) {
      return
    }

    // 统一缓冲区 (渲染配置)
    this.uniformBuffer = this.device.createBuffer({
      size: 32, // 8 floats * 4 bytes
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    // 音符顶点缓冲区
    // 每个音符 = 2 个三角形 = 6 个顶点
    // 每个顶点 = 6 floats (position + color) = 24 bytes
    const vertexBufferSize = this.maxNotes * 6 * 6 * 4
    this.noteBuffer = this.device.createBuffer({
      size: vertexBufferSize,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    })
  }

  /**
   * 渲染音符
   */
  render(notes: NoteData[], config: RenderConfig): void {
    if (!this.device || !this.context || !this.pipeline || !this.canvas) {
      return
    }

    this.noteCount = notes.length

    // 更新统一缓冲区
    this.updateUniformBuffer(config)

    // 生成顶点数据
    const vertices = this.generateVertices(notes, config)

    // 更新顶点缓冲区
    this.device.queue.writeBuffer(this.noteBuffer!, 0, vertices)

    // 创建命令编码器
    const commandEncoder = this.device.createCommandEncoder()

    // 创建渲染通道
    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [
        {
          view: this.context.getCurrentTexture().createView(),
          clearValue: { r: 0.1, g: 0.1, b: 0.18, a: 1.0 }, // 深色背景
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    }

    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor)

    // 设置渲染管线
    passEncoder.setPipeline(this.pipeline)

    // 设置顶点缓冲区
    passEncoder.setVertexBuffer(0, this.noteBuffer!)

    // 绘制
    const vertexCount = notes.length * 6 // 每个音符 6 个顶点
    passEncoder.draw(vertexCount)

    // 结束渲染通道
    passEncoder.end()

    // 提交命令
    this.device.queue.submit([commandEncoder.finish()])
  }

  /**
   * 更新统一缓冲区
   */
  private updateUniformBuffer(config: RenderConfig): void {
    if (!this.device || !this.uniformBuffer) {
      return
    }

    const uniformData = new Float32Array([
      config.currentTime,
      config.scrollOffset,
      config.canvasWidth,
      config.canvasHeight,
      config.keyboardHeight,
      0, // padding
      0, // padding
      0, // padding
    ])

    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData)
  }

  /**
   * 生成顶点数据
   * 每个音符生成 2 个三角形 (6 个顶点)
   */
  private generateVertices(notes: NoteData[], config: RenderConfig): Float32Array {
    const vertices = new Float32Array(notes.length * 6 * 6) // 6 vertices * 6 floats
    let vertexIndex = 0

    const { currentTime, scrollOffset, canvasWidth, canvasHeight, keyboardHeight } = config
    const visibleStart = currentTime - 500
    const visibleEnd = currentTime + scrollOffset
    const timeWindow = scrollOffset + 500

    const keyboardY = (keyboardHeight / canvasHeight) * 2 - 1 // -1 to 1

    // 颜色调色板
    const trackColors = [
      [0.26, 0.52, 0.96, 1.0], // 蓝色
      [0.20, 0.66, 0.33, 1.0], // 绿色
      [0.92, 0.26, 0.21, 1.0], // 红色
      [0.98, 0.75, 0.02, 1.0], // 黄色
      [0.56, 0.27, 0.68, 1.0], // 紫色
      [0.09, 0.63, 0.52, 1.0], // 青色
      [0.90, 0.49, 0.13, 1.0], // 橙色
      [0.91, 0.26, 0.58, 1.0], // 粉色
    ]

    for (let i = 0; i < notes.length; i++) {
      const note = notes[i]

      // 只渲染可见范围内的音符
      if (note.startMs + note.durationMs < visibleStart || note.startMs > visibleEnd) {
        continue
      }

      // 计算音符位置
      const noteX = this.noteToX(note.note, canvasWidth)
      const noteY = this.timeToY(note.startMs, currentTime, timeWindow, keyboardY)
      const noteHeight = this.durationToHeight(note.durationMs, timeWindow, keyboardY)
      const noteWidth = 8 / canvasWidth // 8px width

      // 颜色
      const color = note.isActive
        ? [1.0, 0.92, 0.23, 1.0] // 黄色高亮
        : trackColors[note.trackColorId % trackColors.length]

      // 生成 2 个三角形 (矩形)
      // 三角形 1: 左上、右上、左下
      this.addVertex(vertices, vertexIndex++, noteX, noteY, ...color)
      this.addVertex(vertices, vertexIndex++, noteX + noteWidth, noteY, ...color)
      this.addVertex(vertices, vertexIndex++, noteX, noteY - noteHeight, ...color)

      // 三角形 2: 右上、右下、左下
      this.addVertex(vertices, vertexIndex++, noteX + noteWidth, noteY, ...color)
      this.addVertex(vertices, vertexIndex++, noteX + noteWidth, noteY - noteHeight, ...color)
      this.addVertex(vertices, vertexIndex++, noteX, noteY - noteHeight, ...color)
    }

    return vertices
  }

  /**
   * 添加顶点
   */
  private addVertex(
    vertices: Float32Array,
    index: number,
    x: number,
    y: number,
    r: number,
    g: number,
    b: number,
    a: number,
  ): void {
    const offset = index * 6
    vertices[offset] = x
    vertices[offset + 1] = y
    vertices[offset + 2] = r
    vertices[offset + 3] = g
    vertices[offset + 4] = b
    vertices[offset + 5] = a
  }

  /**
   * MIDI note 转 X 坐标
   */
  private noteToX(note: number, _canvasWidth: number): number {
    // 简化的映射,实际应该考虑黑白键布局
    const normalizedX = (note - 21) / 88 // A0-C8
    return normalizedX * 2 - 1 // -1 to 1
  }

  /**
   * 时间转 Y 坐标
   */
  private timeToY(
    timeMs: number,
    currentTime: number,
    timeWindow: number,
    keyboardY: number,
  ): number {
    const timeDiff = timeMs - currentTime
    const normalizedY = timeDiff / timeWindow
    return keyboardY - normalizedY * (keyboardY + 1)
  }

  /**
   * 时长转高度
   */
  private durationToHeight(
    durationMs: number,
    timeWindow: number,
    keyboardY: number,
  ): number {
    const normalizedHeight = durationMs / timeWindow
    return normalizedHeight * (keyboardY + 1)
  }

  /**
   * 调整画布大小
   */
  resize(width: number, height: number): void {
    if (!this.canvas) {
      return
    }

    this.canvas.width = width
    this.canvas.height = height

    if (this.context && this.device) {
      this.context.configure({
        device: this.device,
        format: navigator.gpu.getPreferredCanvasFormat(),
        alphaMode: 'premultiplied',
      })
    }
  }

  /**
   * 清理资源
   */
  dispose(): void {
    if (this.uniformBuffer) {
      this.uniformBuffer.destroy()
    }
    if (this.noteBuffer) {
      this.noteBuffer.destroy()
    }
    if (this.pipeline) {
      this.pipeline = null
    }
    if (this.device) {
      this.device = null
    }
    if (this.context) {
      this.context = null
    }
  }

  /**
   * 获取性能统计
   */
  getStats() {
    return {
      isSupported: this.isSupported,
      maxNotes: this.maxNotes,
      currentNotes: this.noteCount,
      errorMessage: this.errorMessage,
    }
  }
}

/**
 * 创建 WebGPU 渲染器实例 (单例)
 */
let instance: WebGPURenderer | null = null

export function getWebGPURenderer(): WebGPURenderer {
  if (!instance) {
    instance = new WebGPURenderer()
  }
  return instance
}
