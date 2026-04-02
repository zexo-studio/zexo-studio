use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub models_directory: String,
    pub temperature: f32,
    pub top_p: f32,
    pub num_ctx: u32,
    pub system_prompt: String,
    pub n_gpu_layers: i32,
    pub hf_token: String,
}

impl Default for Settings {
    fn default() -> Self {
        let default_models_dir = dirs_default_models_dir();
        Self {
            models_directory: default_models_dir,
            temperature: 0.7,
            top_p: 0.9,
            num_ctx: 4096,
            system_prompt: String::new(),
            n_gpu_layers: 999, // offload all layers to GPU by default
            hf_token: String::new(),
        }
    }
}

fn dirs_default_models_dir() -> String {
    if let Some(home) = std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
    {
        let p = PathBuf::from(home).join("zexo-models");
        return p.to_string_lossy().to_string();
    }
    "zexo-models".to_string()
}

pub fn settings_path(app: &tauri::AppHandle) -> PathBuf {
    let dir = app
        .path()
        .app_data_dir()
        .expect("failed to get app data dir");
    fs::create_dir_all(&dir).ok();
    dir.join("settings.json")
}

pub fn load_settings(app: &tauri::AppHandle) -> Settings {
    let path = settings_path(app);
    if path.exists() {
        if let Ok(data) = fs::read_to_string(&path) {
            if let Ok(settings) = serde_json::from_str::<Settings>(&data) {
                return settings;
            }
        }
    }
    let defaults = Settings::default();
    save_settings_to_disk(app, &defaults).ok();
    defaults
}

pub fn save_settings_to_disk(
    app: &tauri::AppHandle,
    settings: &Settings,
) -> Result<(), String> {
    let path = settings_path(app);
    let data = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(&path, data).map_err(|e| e.to_string())?;

    // Ensure models directory exists
    fs::create_dir_all(&settings.models_directory).ok();

    Ok(())
}

use tauri::Manager;
