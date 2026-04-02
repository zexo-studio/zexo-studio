use crate::chat::types::ModelInfo;
use std::fs;
use std::path::Path;

/// Scan a directory for .gguf model files
pub fn scan_models_directory(dir: &str) -> Result<Vec<ModelInfo>, String> {
    let path = Path::new(dir);
    if !path.exists() {
        fs::create_dir_all(path).map_err(|e| e.to_string())?;
        return Ok(Vec::new());
    }

    let mut models = Vec::new();

    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let file_path = entry.path();
            if file_path
                .extension()
                .map_or(false, |e| e == "gguf")
            {
                if let Ok(metadata) = fs::metadata(&file_path) {
                    let size = metadata.len();
                    let modified = metadata
                        .modified()
                        .ok()
                        .and_then(|t| {
                            let datetime: chrono::DateTime<chrono::Local> = t.into();
                            Some(datetime.format("%Y-%m-%d %H:%M").to_string())
                        })
                        .unwrap_or_default();

                    let name = file_path
                        .file_stem()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();

                    models.push(ModelInfo {
                        name,
                        path: file_path.to_string_lossy().to_string(),
                        size_bytes: size,
                        size_display: format_size(size),
                        modified_at: modified,
                    });
                }
            }
        }
    }

    // Sort by name
    models.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(models)
}

/// Delete a model file
pub fn delete_model_file(path: &str) -> Result<(), String> {
    let p = Path::new(path);
    if p.exists() {
        fs::remove_file(p).map_err(|e| format!("Failed to delete model: {}", e))?;
    }
    Ok(())
}

fn format_size(bytes: u64) -> String {
    const KB: f64 = 1024.0;
    const MB: f64 = KB * 1024.0;
    const GB: f64 = MB * 1024.0;

    let size = bytes as f64;
    if size >= GB {
        format!("{:.1} GB", size / GB)
    } else if size >= MB {
        format!("{:.1} MB", size / MB)
    } else if size >= KB {
        format!("{:.1} KB", size / KB)
    } else {
        format!("{} B", bytes)
    }
}
