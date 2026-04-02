// ── Tauri IPC Bridge ────────────────────────────────────────
// Wraps window.__TAURI__ for clean access from other modules

const { invoke } = window.__TAURI__?.core ?? {};
const { listen, emit } = window.__TAURI__?.event ?? {};

// ── Invoke Commands ─────────────────────────────────────────

export async function listLocalModels() {
  return invoke('list_local_models');
}

export async function loadModel(path) {
  return invoke('load_model', { path });
}

export async function unloadModel() {
  return invoke('unload_model');
}

export async function getLoadedModel() {
  return invoke('get_loaded_model');
}

export async function deleteModel(path) {
  return invoke('delete_model', { path });
}

export async function chatSend(messages, options) {
  return invoke('chat_send', { messages, options });
}

export async function stopGeneration() {
  return invoke('stop_generation');
}

export async function searchHuggingface(query) {
  return invoke('search_huggingface', { query });
}

export async function downloadModel(url, filename) {
  return invoke('download_model', { url, filename });
}

export async function getSettings() {
  return invoke('get_settings');
}

export async function saveSettings(newSettings) {
  return invoke('save_settings', { newSettings });
}

export async function listConversations() {
  return invoke('list_conversations');
}

export async function loadConversation(id) {
  return invoke('load_conversation', { id });
}

export async function saveConversation(conversation) {
  return invoke('save_conversation', { conversation });
}

export async function deleteConversation(id) {
  return invoke('delete_conversation', { id });
}

// ── Event Listeners ─────────────────────────────────────────

export function onChatToken(callback) {
  return listen('chat-token', (event) => callback(event.payload));
}

export function onChatComplete(callback) {
  return listen('chat-complete', (event) => callback(event.payload));
}

export function onChatError(callback) {
  return listen('chat-error', (event) => callback(event.payload));
}

export function onDownloadProgress(callback) {
  return listen('download-progress', (event) => callback(event.payload));
}

export function onDownloadComplete(callback) {
  return listen('download-complete', (event) => callback(event.payload));
}

// ── Dev Mode Fallback ───────────────────────────────────────
// When running outside Tauri (e.g. in a browser for UI dev),
// provide mock implementations so the UI still renders.

if (!invoke) {
  console.warn('[Zexo] Not running in Tauri — using mock API');

  const noop = async () => {};
  const mockModels = [
    { name: 'llama-3.2-3b-q4', path: 'C:/models/llama-3.2-3b.Q4_K_M.gguf', size_bytes: 2000000000, size_display: '2.0 GB', modified_at: '2025-01-15' },
    { name: 'mistral-7b-q5', path: 'C:/models/mistral-7b.Q5_K_M.gguf', size_bytes: 5000000000, size_display: '5.0 GB', modified_at: '2025-02-20' },
  ];

  // Re-export mocks
  window._zexoMock = true;
  const mockFns = {
    listLocalModels: async () => mockModels,
    loadModel: async (path) => path.split('/').pop().replace('.gguf', ''),
    unloadModel: noop,
    getLoadedModel: async () => null,
    deleteModel: noop,
    chatSend: noop,
    stopGeneration: noop,
    searchHuggingface: async () => [],
    downloadModel: noop,
    getSettings: async () => ({ models_directory: 'C:/zexo-models', temperature: 0.7, top_p: 0.9, num_ctx: 4096, system_prompt: '', n_gpu_layers: 999, hf_token: '' }),
    saveSettings: noop,
    listConversations: async () => [],
    loadConversation: async () => ({ id: '1', title: 'Test', model: 'test', messages: [], created_at: '', updated_at: '' }),
    saveConversation: noop,
    deleteConversation: noop,
    onChatToken: () => () => {},
    onChatComplete: () => () => {},
    onChatError: () => () => {},
    onDownloadProgress: () => () => {},
    onDownloadComplete: () => () => {},
  };

  Object.keys(mockFns).forEach(key => {
    module.exports = module.exports || {};
  });
}
