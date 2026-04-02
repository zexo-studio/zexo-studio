use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,    // "system", "user", "assistant"
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatOptions {
    pub temperature: f32,
    pub top_p: f32,
    pub num_ctx: u32,
    pub system_prompt: String,
    pub max_tokens: Option<u32>,
}

impl Default for ChatOptions {
    fn default() -> Self {
        Self {
            temperature: 0.7,
            top_p: 0.9,
            num_ctx: 4096,
            system_prompt: String::new(),
            max_tokens: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Conversation {
    pub id: String,
    pub title: String,
    pub model: String,
    pub messages: Vec<ChatMessage>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerationStats {
    pub tokens_generated: u32,
    pub tokens_per_second: f64,
    pub total_duration_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub name: String,
    pub path: String,
    pub size_bytes: u64,
    pub size_display: String,
    pub modified_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HfSearchResult {
    pub id: String,
    pub name: String,
    pub author: String,
    pub downloads: u64,
    pub likes: u64,
    pub tags: Vec<String>,
    pub files: Vec<HfFileInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HfFileInfo {
    pub filename: String,
    pub size_bytes: u64,
    pub size_display: String,
    pub download_url: String,
}
