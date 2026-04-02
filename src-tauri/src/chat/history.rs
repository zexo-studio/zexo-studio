use crate::chat::types::Conversation;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

pub fn conversations_dir(app: &tauri::AppHandle) -> PathBuf {
    let dir = app
        .path()
        .app_data_dir()
        .expect("failed to get app data dir")
        .join("conversations");
    fs::create_dir_all(&dir).ok();
    dir
}

pub fn list_all(app: &tauri::AppHandle) -> Result<Vec<Conversation>, String> {
    let dir = conversations_dir(app);
    let mut conversations = Vec::new();

    if let Ok(entries) = fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map_or(false, |e| e == "json") {
                if let Ok(data) = fs::read_to_string(&path) {
                    if let Ok(conv) = serde_json::from_str::<Conversation>(&data) {
                        conversations.push(conv);
                    }
                }
            }
        }
    }

    // Sort by updated_at descending (newest first)
    conversations.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(conversations)
}

pub fn load(app: &tauri::AppHandle, id: &str) -> Result<Conversation, String> {
    let path = conversations_dir(app).join(format!("{}.json", id));
    if !path.exists() {
        return Err("Conversation not found".to_string());
    }
    let data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&data).map_err(|e| e.to_string())
}

pub fn save(app: &tauri::AppHandle, conversation: &Conversation) -> Result<(), String> {
    let path = conversations_dir(app).join(format!("{}.json", conversation.id));
    let data = serde_json::to_string_pretty(conversation).map_err(|e| e.to_string())?;
    fs::write(&path, data).map_err(|e| e.to_string())
}

pub fn delete(app: &tauri::AppHandle, id: &str) -> Result<(), String> {
    let path = conversations_dir(app).join(format!("{}.json", id));
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}
