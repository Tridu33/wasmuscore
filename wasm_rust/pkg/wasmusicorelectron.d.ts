/* tslint:disable */
/* eslint-disable */

/**
 * 简单的加法函数 (用于测试)
 */
export function add(a: number, b: number): number;

/**
 * 获取当前时间点的所有音符事件
 */
export function get_active_notes(delta_ms: bigint): any;

/**
 * 获取所有音符数据 (用于可视化)
 */
export function get_all_notes(): any;

/**
 * 获取当前播放状态
 */
export function get_playback_status(): any;

/**
 * 从字节数组加载 MIDI 文件
 */
export function load_midi_from_bytes(data: Uint8Array): any;

export function main(): void;

/**
 * 暂停播放
 */
export function pause(): void;

/**
 * 开始播放
 */
export function play(): void;

/**
 * 设置播放位置 (毫秒)
 */
export function seek_to(milliseconds: bigint): void;

/**
 * 停止播放
 */
export function stop(): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly add: (a: number, b: number) => number;
    readonly get_active_notes: (a: bigint) => [number, number, number];
    readonly get_all_notes: () => [number, number, number];
    readonly get_playback_status: () => [number, number, number];
    readonly load_midi_from_bytes: (a: number, b: number) => [number, number, number];
    readonly main: () => void;
    readonly pause: () => [number, number];
    readonly play: () => [number, number];
    readonly seek_to: (a: bigint) => [number, number];
    readonly stop: () => [number, number];
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
