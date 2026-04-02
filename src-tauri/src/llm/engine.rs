use crate::chat::types::{ChatMessage, ChatOptions, GenerationStats};
use llama_cpp_2::context::params::LlamaContextParams;
use llama_cpp_2::llama_backend::LlamaBackend;
use llama_cpp_2::llama_batch::LlamaBatch;
use llama_cpp_2::model::params::LlamaModelParams;
use llama_cpp_2::model::{AddBos, LlamaModel};
use llama_cpp_2::sampling::LlamaSampler;
use std::num::NonZeroU32;
use std::time::Instant;

pub struct LlmEngine {
    backend: Option<LlamaBackend>,
    model: Option<LlamaModel>,
    model_path: Option<String>,
    model_name: Option<String>,
}

// Safety: LlamaModel and LlamaBackend are safe to send across threads
// as they manage their own internal synchronization
unsafe impl Send for LlmEngine {}

impl LlmEngine {
    pub fn new() -> Self {
        let backend = LlamaBackend::init().ok();
        Self {
            backend,
            model: None,
            model_path: None,
            model_name: None,
        }
    }

    pub fn is_loaded(&self) -> bool {
        self.model.is_some()
    }

    pub fn loaded_model_name(&self) -> Option<String> {
        self.model_name.clone()
    }

    pub fn loaded_model_path(&self) -> Option<String> {
        self.model_path.clone()
    }

    pub fn load_model(&mut self, path: &str, n_gpu_layers: i32) -> Result<String, String> {
        // Unload any existing model first
        self.unload_model();

        let backend = self
            .backend
            .as_ref()
            .ok_or("LLM backend not initialized")?;

        // Configure model parameters
        let model_params = LlamaModelParams::default().with_n_gpu_layers(n_gpu_layers as u32);

        // Load the model file
        let model = LlamaModel::load_from_file(backend, path, &model_params)
            .map_err(|e| format!("Failed to load model: {}", e))?;

        // Extract model name from filename
        let name = std::path::Path::new(path)
            .file_stem()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        self.model = Some(model);
        self.model_path = Some(path.to_string());
        self.model_name = Some(name.clone());

        Ok(name)
    }

    pub fn unload_model(&mut self) {
        self.model = None;
        self.model_path = None;
        self.model_name = None;
    }

    pub fn generate<F>(
        &self,
        messages: &[ChatMessage],
        options: &ChatOptions,
        should_stop: &dyn Fn() -> bool,
        token_callback: F,
    ) -> Result<GenerationStats, String>
    where
        F: Fn(&str),
    {
        let backend = self
            .backend
            .as_ref()
            .ok_or("LLM backend not initialized")?;
        let model = self.model.as_ref().ok_or("No model loaded")?;

        // Format messages into a prompt using ChatML template
        let prompt = format_chat_prompt(messages, &options.system_prompt);

        // Create a new context for this generation
        let ctx_params = LlamaContextParams::default()
            .with_n_ctx(NonZeroU32::new(options.num_ctx));

        let mut ctx = model
            .new_context(backend, ctx_params)
            .map_err(|e| format!("Failed to create context: {}", e))?;

        // Tokenize the prompt
        let tokens = model
            .str_to_token(&prompt, AddBos::Always)
            .map_err(|e| format!("Tokenization failed: {}", e))?;

        if tokens.is_empty() {
            return Err("Empty prompt after tokenization".to_string());
        }

        // Create batch and add prompt tokens
        let mut batch = LlamaBatch::new(tokens.len().max(512), 1);

        for (i, &token) in tokens.iter().enumerate() {
            let is_last = i == tokens.len() - 1;
            batch
                .add(token, i as i32, &[0], is_last)
                .map_err(|e| format!("Failed to add token to batch: {}", e))?;
        }

        // Evaluate the prompt
        ctx.decode(&mut batch)
            .map_err(|e| format!("Prompt evaluation failed: {}", e))?;

        // Set up sampling with temperature and top_p
        let sampler = LlamaSampler::chain_simple([
            LlamaSampler::temp(options.temperature),
            LlamaSampler::top_p(options.top_p, 1),
            LlamaSampler::dist(42),
        ]);

        // Generation loop
        let start = Instant::now();
        let mut n_generated: u32 = 0;
        let mut n_past = tokens.len() as i32;
        let max_tokens = options.max_tokens.unwrap_or(4096);

        loop {
            // Check if we should stop
            if should_stop() || n_generated >= max_tokens {
                break;
            }

            // Sample the next token
            let new_token = sampler.sample(&ctx, batch.n_tokens() - 1);

            // Check for end of generation
            if model.is_eog_token(new_token) {
                break;
            }

            // Decode token to text
            let text = model
                .token_to_str(new_token, Default::default())
                .map_err(|e| format!("Token decode failed: {}", e))?;

            // Send token to the callback
            token_callback(&text);

            n_generated += 1;

            // Prepare batch for next token
            batch.clear();
            batch
                .add(new_token, n_past, &[0], true)
                .map_err(|e| format!("Failed to add token: {}", e))?;

            ctx.decode(&mut batch)
                .map_err(|e| format!("Decode failed: {}", e))?;

            n_past += 1;
        }

        let duration = start.elapsed();
        let tokens_per_second = if duration.as_secs_f64() > 0.0 {
            n_generated as f64 / duration.as_secs_f64()
        } else {
            0.0
        };

        Ok(GenerationStats {
            tokens_generated: n_generated,
            tokens_per_second,
            total_duration_ms: duration.as_millis() as u64,
        })
    }
}

/// Format chat messages into a ChatML-style prompt
fn format_chat_prompt(messages: &[ChatMessage], system_prompt: &str) -> String {
    let mut prompt = String::new();

    // Add system prompt if provided
    if !system_prompt.is_empty() {
        prompt.push_str("<|im_start|>system\n");
        prompt.push_str(system_prompt);
        prompt.push_str("<|im_end|>\n");
    }

    // Add conversation messages
    for msg in messages {
        prompt.push_str("<|im_start|>");
        prompt.push_str(&msg.role);
        prompt.push('\n');
        prompt.push_str(&msg.content);
        prompt.push_str("<|im_end|>\n");
    }

    // Start assistant response
    prompt.push_str("<|im_start|>assistant\n");
    prompt
}
