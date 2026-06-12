use std::sync::Mutex;
use std::time::Duration;

use midi_file::{MidiFile, PlaybackState};
use wasm_bindgen::prelude::*;
use web_sys::console;

// 全局 MIDI 播放器状态
struct MidiPlayerState {
    midi_file: Option<MidiFile>,
    playback: Option<PlaybackState>,
    is_playing: bool,
}

impl MidiPlayerState {
    fn new() -> Self {
        Self {
            midi_file: None,
            playback: None,
            is_playing: false,
        }
    }
}

use std::sync::LazyLock;

static PLAYER_STATE: LazyLock<Mutex<MidiPlayerState>> = LazyLock::new(|| {
    Mutex::new(MidiPlayerState::new())
});

// 初始化时设置 panic hook
#[wasm_bindgen(start)]
pub fn main() -> Result<(), JsValue> {
    console_error_panic_hook::set_once();
    console::log_1(&"WASM Midi Module Initialized".into());
    Ok(())
}

/// 从字节数组加载 MIDI 文件
#[wasm_bindgen]
pub fn load_midi_from_bytes(data: Vec<u8>) -> Result<JsValue, JsValue> {
    let mut state = PLAYER_STATE.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;

    // 将字节数组写入临时文件
    let temp_path = "/tmp/uploaded_midi.mid";
    std::fs::write(temp_path, &data)
        .map_err(|e| JsValue::from_str(&format!("Failed to write temp file: {}", e)))?;

    // 加载 MIDI 文件
    let midi_file = MidiFile::new(temp_path)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse MIDI: {}", e)))?;

    // 创建播放状态
    let leed_in = Duration::from_millis(500);
    let playback = PlaybackState::new(leed_in, midi_file.tracks.clone());

    // 提取 MIDI 信息
    let info = serde_json::json!({
        "name": midi_file.name,
        "format": format!("{:?}", midi_file.format),
        "track_count": midi_file.tracks.len(),
        "note_count": midi_file.tracks.iter().map(|t| t.notes.len()).sum::<usize>(),
        "duration_ms": midi_file.tracks.iter()
            .filter_map(|t| t.notes.last())
            .map(|n| (n.start + n.duration).as_millis() as u64)
            .max()
            .unwrap_or(0),
        "tracks": midi_file.tracks.iter().map(|t| {
            serde_json::json!({
                "track_id": t.track_id,
                "color_id": t.track_color_id,
                "note_count": t.notes.len(),
                "has_drums": t.has_drums,
                "programs": t.programs.len()
            })
        }).collect::<Vec<_>>()
    });

    state.midi_file = Some(midi_file);
    state.playback = Some(playback);
    state.is_playing = false;

    Ok(serde_wasm_bindgen::to_value(&info).map_err(|e| JsValue::from_str(&e.to_string()))?)
}

/// 开始播放
#[wasm_bindgen]
pub fn play() -> Result<(), JsValue> {
    let mut state = PLAYER_STATE.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;
    
    if let Some(ref mut playback) = state.playback {
        playback.resume();
        state.is_playing = true;
        Ok(())
    } else {
        Err(JsValue::from_str("No MIDI loaded"))
    }
}

/// 暂停播放
#[wasm_bindgen]
pub fn pause() -> Result<(), JsValue> {
    let mut state = PLAYER_STATE.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;
    
    if let Some(ref mut playback) = state.playback {
        playback.pause();
        state.is_playing = false;
        Ok(())
    } else {
        Err(JsValue::from_str("No MIDI loaded"))
    }
}

/// 停止播放
#[wasm_bindgen]
pub fn stop() -> Result<(), JsValue> {
    let mut state = PLAYER_STATE.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;
    
    if let Some(ref mut playback) = state.playback {
        playback.reset();
        state.is_playing = false;
        Ok(())
    } else {
        Err(JsValue::from_str("No MIDI loaded"))
    }
}

/// 设置播放位置 (毫秒)
#[wasm_bindgen]
pub fn seek_to(milliseconds: u64) -> Result<(), JsValue> {
    let mut state = PLAYER_STATE.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;
    
    if let Some(ref mut playback) = state.playback {
        let duration = Duration::from_millis(milliseconds);
        playback.set_time(duration);
        Ok(())
    } else {
        Err(JsValue::from_str("No MIDI loaded"))
    }
}

/// 获取当前播放状态
#[wasm_bindgen]
pub fn get_playback_status() -> Result<JsValue, JsValue> {
    let state = PLAYER_STATE.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;
    
    if let Some(ref playback) = state.playback {
        let status = serde_json::json!({
            "is_playing": state.is_playing,
            "is_paused": playback.is_paused(),
            "current_time_ms": playback.time().as_millis() as u64,
            "total_duration_ms": playback.length().as_millis() as u64,
            "percentage": playback.percentage(),
            "is_finished": playback.is_finished()
        });
        Ok(serde_wasm_bindgen::to_value(&status).map_err(|e| JsValue::from_str(&e.to_string()))?)
    } else {
        Err(JsValue::from_str("No MIDI loaded"))
    }
}

/// 获取当前时间点的所有音符事件
#[wasm_bindgen]
pub fn get_active_notes(delta_ms: u64) -> Result<JsValue, JsValue> {
    let mut state = PLAYER_STATE.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;
    
    if let Some(ref mut playback) = state.playback {
        let delta = Duration::from_millis(delta_ms);
        let events = playback.update(delta);
        
        // 提取 NoteOn 事件
        let notes: Vec<_> = events
            .iter()
            .filter(|e| matches!(e.message, midly::MidiMessage::NoteOn { .. }))
            .map(|e| {
                if let midly::MidiMessage::NoteOn { key, vel } = e.message {
                    serde_json::json!({
                        "note": key.as_int(),
                        "velocity": vel.as_int(),
                        "channel": e.channel,
                        "track_id": e.track_id,
                        "track_color_id": e.track_color_id,
                        "timestamp_ms": e.timestamp.as_millis() as u64
                    })
                } else {
                    serde_json::json!({})
                }
            })
            .collect();
        
        Ok(serde_wasm_bindgen::to_value(&notes).map_err(|e| JsValue::from_str(&e.to_string()))?)
    } else {
        Err(JsValue::from_str("No MIDI loaded"))
    }
}

/// 获取所有音符数据 (用于可视化)
#[wasm_bindgen]
pub fn get_all_notes() -> Result<JsValue, JsValue> {
    let state = PLAYER_STATE.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;
    
    if let Some(ref midi_file) = state.midi_file {
        let notes: Vec<_> = midi_file
            .tracks
            .iter()
            .flat_map(|track| {
                track.notes.iter().map(|note| {
                    serde_json::json!({
                        "note": note.note,
                        "velocity": note.velocity,
                        "channel": note.channel,
                        "track_id": note.track_id,
                        "track_color_id": note.track_color_id,
                        "start_ms": note.start.as_millis() as u64,
                        "end_ms": note.end.as_millis() as u64,
                        "duration_ms": note.duration.as_millis() as u64
                    })
                })
            })
            .collect();
        
        Ok(serde_wasm_bindgen::to_value(&notes).map_err(|e| JsValue::from_str(&e.to_string()))?)
    } else {
        Err(JsValue::from_str("No MIDI loaded"))
    }
}

/// 简单的加法函数 (用于测试)
#[wasm_bindgen]
pub fn add(a: u32, b: u32) -> u32 {
    a + b
}
