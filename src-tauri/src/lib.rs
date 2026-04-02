mod commands;
mod llm;
mod chat;
mod settings;

use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct AppState {
    pub engine: Arc<Mutex<llm::engine::LlmEngine>>,
    pub generating: Arc<AtomicBool>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let state = AppState {
        engine: Arc::new(Mutex::new(llm::engine::LlmEngine::new())),
        generating: Arc::new(AtomicBool::new(false)),
    };

    tauri::Builder::default()
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            commands::list_local_models,
            commands::load_model,
            commands::unload_model,
            commands::get_loaded_model,
            commands::chat_send,
            commands::stop_generation,
            commands::delete_model,
            commands::download_model,
            commands::search_huggingface,
            commands::get_settings,
            commands::save_settings,
            commands::list_conversations,
            commands::load_conversation,
            commands::save_conversation,
            commands::delete_conversation,
            commands::pick_models_directory,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
