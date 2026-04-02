use crate::chat::{history, types::*};
use crate::llm::models;
use crate::settings;
use crate::AppState;
use serde::{Deserialize, Serialize};
use std::sync::atomic::Ordering;
use tauri::Emitter;

// ── Model Management ─────────────────────────────────────────

#[tauri::command]
pub async fn list_local_models(app: tauri::AppHandle) -> Result<Vec<ModelInfo>, String> {
    let s = settings::load_settings(&app);
    models::scan_models_directory(&s.models_directory)
}

#[tauri::command]
pub async fn load_model(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    path: String,
) -> Result<String, String> {
    let s = settings::load_settings(&app);
    let mut engine = state.engine.lock().await;
    engine.load_model(&path, s.n_gpu_layers)
}

#[tauri::command]
pub async fn unload_model(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let mut engine = state.engine.lock().await;
    engine.unload_model();
    Ok(())
}

#[tauri::command]
pub async fn get_loaded_model(
    state: tauri::State<'_, AppState>,
) -> Result<Option<String>, String> {
    let engine = state.engine.lock().await;
    Ok(engine.loaded_model_name())
}

#[tauri::command]
pub async fn delete_model(path: String) -> Result<(), String> {
    models::delete_model_file(&path)
}

// ── Chat ─────────────────────────────────────────────────────

#[tauri::command]
pub async fn chat_send(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    messages: Vec<ChatMessage>,
    options: ChatOptions,
) -> Result<(), String> {
    let engine_arc = state.engine.clone();
    let generating = state.generating.clone();

    // Set generating flag
    generating.store(true, Ordering::SeqCst);

    let app_clone = app.clone();
    let gen_flag = generating.clone();

    // Spawn blocking task for CPU/GPU-bound inference
    tokio::task::spawn_blocking(move || {
        let engine = engine_arc.blocking_lock();

        if !engine.is_loaded() {
            let _ = app_clone.emit("chat-error", "No model loaded");
            gen_flag.store(false, Ordering::SeqCst);
            return;
        }

        let should_stop = || !gen_flag.load(Ordering::SeqCst);

        let result = engine.generate(&messages, &options, &should_stop, |token| {
            let _ = app_clone.emit("chat-token", token);
        });

        match result {
            Ok(stats) => {
                let _ = app_clone.emit("chat-complete", stats);
            }
            Err(e) => {
                let _ = app_clone.emit("chat-error", e);
            }
        }

        gen_flag.store(false, Ordering::SeqCst);
    });

    Ok(())
}

#[tauri::command]
pub async fn stop_generation(state: tauri::State<'_, AppState>) -> Result<(), String> {
    state.generating.store(false, Ordering::SeqCst);
    Ok(())
}

// ── HuggingFace Downloads ────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
struct HfApiModel {
    #[serde(rename = "modelId")]
    model_id: Option<String>,
    id: Option<String>,
    author: Option<String>,
    downloads: Option<u64>,
    likes: Option<u64>,
    tags: Option<Vec<String>>,
    siblings: Option<Vec<HfSibling>>,
}

#[derive(Debug, Serialize, Deserialize)]
struct HfSibling {
    rfilename: String,
    size: Option<u64>,
}

#[tauri::command]
pub async fn search_huggingface(
    app: tauri::AppHandle,
    query: String,
) -> Result<Vec<HfSearchResult>, String> {
    let s = settings::load_settings(&app);
    let client = reqwest::Client::new();

    let search_query = if query.contains("gguf") {
        query.clone()
    } else {
        format!("{} gguf", query)
    };

    let mut request = client
        .get("https://huggingface.co/api/models")
        .query(&[
            ("search", search_query.as_str()),
            ("filter", "gguf"),
            ("sort", "downloads"),
            ("direction", "-1"),
            ("limit", "20"),
        ]);

    if !s.hf_token.is_empty() {
        request = request.header("Authorization", format!("Bearer {}", s.hf_token));
    }

    let resp = request
        .send()
        .await
        .map_err(|e| format!("Search failed: {}", e))?;

    let models: Vec<HfApiModel> = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let mut results = Vec::new();
    for m in models {
        let model_id = m.model_id.or(m.id).unwrap_or_default();
        let author = m.author.unwrap_or_default();
        let name = model_id.clone();

        // Filter for GGUF files from siblings
        let files: Vec<HfFileInfo> = m
            .siblings
            .unwrap_or_default()
            .iter()
            .filter(|s| s.rfilename.ends_with(".gguf"))
            .map(|s| {
                let size = s.size.unwrap_or(0);
                HfFileInfo {
                    filename: s.rfilename.clone(),
                    size_bytes: size,
                    size_display: format_size_hf(size),
                    download_url: format!(
                        "https://huggingface.co/{}/resolve/main/{}",
                        model_id, s.rfilename
                    ),
                }
            })
            .collect();

        results.push(HfSearchResult {
            id: model_id,
            name,
            author,
            downloads: m.downloads.unwrap_or(0),
            likes: m.likes.unwrap_or(0),
            tags: m.tags.unwrap_or_default(),
            files,
        });
    }

    Ok(results)
}

#[derive(Debug, Clone, Serialize)]
struct DownloadProgress {
    filename: String,
    downloaded: u64,
    total: u64,
    percent: f64,
    speed_mbps: f64,
}

#[tauri::command]
pub async fn download_model(
    app: tauri::AppHandle,
    url: String,
    filename: String,
) -> Result<String, String> {
    let s = settings::load_settings(&app);
    let dest = std::path::Path::new(&s.models_directory).join(&filename);

    let client = reqwest::Client::new();
    let mut request = client.get(&url);

    if !s.hf_token.is_empty() {
        request = request.header("Authorization", format!("Bearer {}", s.hf_token));
    }

    let resp = request
        .send()
        .await
        .map_err(|e| format!("Download failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!(
            "Download failed with status: {} — is the URL correct? Do you need an HF token?",
            resp.status()
        ));
    }

    let total_size = resp.content_length().unwrap_or(0);

    let mut file = tokio::fs::File::create(&dest)
        .await
        .map_err(|e| format!("Failed to create file: {}", e))?;

    use futures_util::StreamExt;
    use tokio::io::AsyncWriteExt;

    let mut stream = resp.bytes_stream();
    let mut downloaded: u64 = 0;
    let start = std::time::Instant::now();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Download error: {}", e))?;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Write error: {}", e))?;

        downloaded += chunk.len() as u64;

        let elapsed = start.elapsed().as_secs_f64();
        let speed = if elapsed > 0.0 {
            (downloaded as f64 / elapsed) / (1024.0 * 1024.0)
        } else {
            0.0
        };

        let percent = if total_size > 0 {
            (downloaded as f64 / total_size as f64) * 100.0
        } else {
            0.0
        };

        let _ = app.emit(
            "download-progress",
            DownloadProgress {
                filename: filename.clone(),
                downloaded,
                total: total_size,
                percent,
                speed_mbps: speed,
            },
        );
    }

    file.flush()
        .await
        .map_err(|e| format!("Flush error: {}", e))?;

    let _ = app.emit("download-complete", &filename);

    Ok(dest.to_string_lossy().to_string())
}

// ── Settings ─────────────────────────────────────────────────

#[tauri::command]
pub async fn get_settings(app: tauri::AppHandle) -> Result<settings::Settings, String> {
    Ok(settings::load_settings(&app))
}

#[tauri::command]
pub async fn save_settings(
    app: tauri::AppHandle,
    new_settings: settings::Settings,
) -> Result<(), String> {
    settings::save_settings_to_disk(&app, &new_settings)
}

#[tauri::command]
pub async fn pick_models_directory() -> Result<String, String> {
    // Return empty — frontend will use a text input for path
    // (native dialog requires tauri-plugin-dialog which adds bloat)
    Ok(String::new())
}

// ── Conversations ────────────────────────────────────────────

#[tauri::command]
pub async fn list_conversations(
    app: tauri::AppHandle,
) -> Result<Vec<Conversation>, String> {
    history::list_all(&app)
}

#[tauri::command]
pub async fn load_conversation(
    app: tauri::AppHandle,
    id: String,
) -> Result<Conversation, String> {
    history::load(&app, &id)
}

#[tauri::command]
pub async fn save_conversation(
    app: tauri::AppHandle,
    conversation: Conversation,
) -> Result<(), String> {
    history::save(&app, &conversation)
}

#[tauri::command]
pub async fn delete_conversation(
    app: tauri::AppHandle,
    id: String,
) -> Result<(), String> {
    history::delete(&app, &id)
}

// ── Helpers ──────────────────────────────────────────────────

fn format_size_hf(bytes: u64) -> String {
    const KB: f64 = 1024.0;
    const MB: f64 = KB * 1024.0;
    const GB: f64 = MB * 1024.0;
    let s = bytes as f64;
    if s >= GB {
        format!("{:.1} GB", s / GB)
    } else if s >= MB {
        format!("{:.0} MB", s / MB)
    } else if s >= KB {
        format!("{:.0} KB", s / KB)
    } else {
        format!("{} B", bytes)
    }
}
