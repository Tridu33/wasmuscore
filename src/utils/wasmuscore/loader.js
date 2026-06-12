// WASM 模块加载器
import init from '../../../wasm_rust/pkg/wasmusicorelectron.js'

let wasmInitialized = false
let wasmModule = null

// 初始化 WASM 模块
export async function initWasm() {
  if (wasmInitialized) {
    return wasmModule
  }

  try {
    wasmModule = await init()
    wasmInitialized = true
    return wasmModule
  }
  catch (error) {
    console.error('Failed to initialize WASM module:', error)
    throw error
  }
}

// 确保 WASM 已初始化
async function ensureInitialized() {
  if (!wasmInitialized) {
    await initWasm()
  }
  return wasmModule
}

// 从文件加载 MIDI
export async function loadMidiFromFile(uint8Array) {
  const wasm = await ensureInitialized()
  return await wasm.load_midi_from_bytes(uint8Array)
}

// 播放
export async function play() {
  const wasm = await ensureInitialized()
  return await wasm.play()
}

// 暂停
export async function pause() {
  const wasm = await ensureInitialized()
  return await wasm.pause()
}

// 停止
export async function stop() {
  const wasm = await ensureInitialized()
  return await wasm.stop()
}

// 跳转
export async function seekTo(milliseconds) {
  const wasm = await ensureInitialized()
  return await wasm.seek_to(milliseconds)
}

// 获取播放状态
export async function getPlaybackStatus() {
  const wasm = await ensureInitialized()
  return await wasm.get_playback_status()
}

// 获取活动音符
export async function getActiveNotes(deltaMs = 16) {
  const wasm = await ensureInitialized()
  return await wasm.get_active_notes(deltaMs)
}

// 获取所有音符
export async function getAllNotes() {
  const wasm = await ensureInitialized()
  return await wasm.get_all_notes()
}

// 测试函数
export async function add(a, b) {
  const wasm = await ensureInitialized()
  return await wasm.add(a, b)
}

// 默认导出
export default {
  initWasm,
  loadMidiFromFile,
  play,
  pause,
  stop,
  seekTo,
  getPlaybackStatus,
  getActiveNotes,
  getAllNotes,
  add,
}
