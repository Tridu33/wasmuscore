/* tslint:disable */
/* eslint-disable */
export const memory: WebAssembly.Memory;
export const add: (a: number, b: number) => number;
export const get_active_notes: (a: bigint) => [number, number, number];
export const get_all_notes: () => [number, number, number];
export const get_playback_status: () => [number, number, number];
export const load_midi_from_bytes: (a: number, b: number) => [number, number, number];
export const main: () => void;
export const pause: () => [number, number];
export const play: () => [number, number];
export const seek_to: (a: bigint) => [number, number];
export const stop: () => [number, number];
export const __wbindgen_malloc: (a: number, b: number) => number;
export const __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
export const __wbindgen_free: (a: number, b: number, c: number) => void;
export const __wbindgen_externrefs: WebAssembly.Table;
export const __externref_table_dealloc: (a: number) => void;
export const __wbindgen_start: () => void;
