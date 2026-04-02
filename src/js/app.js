// ── Zexo Studio — Main Application Controller ──────────────
// Orchestrates all modules: chat, sidebar, models, settings

import * as api from './api.js';
import * as chat from './chat.js';
import * as sidebar from './sidebar.js';
import * as models from './models.js';
import * as settings from './settings.js';

// ── Application State ───────────────────────────────────────

const state = {
  currentConversationId: null,
  messages: [],
  isEphemeral: false,
  isGenerating: false,
  conversations: [],
};

// ── Initialization ──────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize all modules
  chat.initChat();
  sidebar.initSidebar({
    onSelect: selectConversation,
    onDelete: handleDeleteConversation,
    onNewChat: handleNewChat,
  });
  models.initModels({
    onLoaded: handleModelLoaded,
  });
  settings.initSettings();

  // Load settings
  await settings.loadSettings();

  // Load existing model state
  await models.loadInitialModel();

  // Refresh models list
  await models.refreshModelsList();

  // Load conversation history
  await refreshConversations();

  // Setup chat input
  setupChatInput();

  // Setup ephemeral toggle
  setupEphemeralToggle();

  // Setup welcome hint cards
  setupHintCards();

  // Setup Tauri event listeners for streaming
  setupEventListeners();

  // Handle rename from sidebar
  window.addEventListener('rename-conversation', handleRenameConversation);

  console.log('[Zexo] Initialized');
});

// ── Chat Input ──────────────────────────────────────────────

function setupChatInput() {
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-btn');

  // Auto-resize textarea
  input?.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 200) + 'px';
  });

  // Send on Enter (Shift+Enter for newline)
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  // Send button
  sendBtn?.addEventListener('click', () => {
    if (state.isGenerating) {
      handleStop();
    } else {
      handleSend();
    }
  });
}

async function handleSend() {
  const input = document.getElementById('chat-input');
  const text = input?.value.trim();
  if (!text || state.isGenerating) return;

  // Check if a model is loaded
  if (!models.getCurrentModel()) {
    chat.showError('Please load a model first. Click the model selector in the toolbar or go to Models.');
    return;
  }

  // Clear input
  input.value = '';
  input.style.height = 'auto';

  // Create new conversation if needed
  if (!state.currentConversationId && !state.isEphemeral) {
    state.currentConversationId = generateId();
  }

  // Add user message
  const userMessage = { role: 'user', content: text };
  state.messages.push(userMessage);
  chat.appendMessage('user', text);

  // Set generating state
  setGenerating(true);

  // Start streaming response
  chat.startStreaming();

  // Build options from settings
  const s = settings.getSettings();
  const options = {
    temperature: s.temperature || 0.7,
    top_p: s.top_p || 0.9,
    num_ctx: s.num_ctx || 4096,
    system_prompt: s.system_prompt || '',
    max_tokens: null,
  };

  try {
    await api.chatSend(state.messages, options);
  } catch (e) {
    chat.endStreaming();
    chat.showError('Failed to send message: ' + e);
    setGenerating(false);
  }
}

async function handleStop() {
  try {
    await api.stopGeneration();
  } catch (e) {
    console.error('Failed to stop:', e);
  }
}

// ── Event Listeners (Streaming) ─────────────────────────────

function setupEventListeners() {
  api.onChatToken((token) => {
    chat.appendStreamToken(token);
  });

  api.onChatComplete((stats) => {
    const content = chat.endStreaming();

    // Add assistant message to state
    if (content) {
      state.messages.push({ role: 'assistant', content });
    }

    // Save conversation (if not ephemeral)
    if (!state.isEphemeral && state.currentConversationId) {
      saveCurrentConversation();
    }

    setGenerating(false);

    // Show stats
    if (stats) {
      showStats(stats);
    }
  });

  api.onChatError((error) => {
    chat.endStreaming();
    chat.showError(error);
    setGenerating(false);
  });
}

// ── Conversation Management ─────────────────────────────────

async function refreshConversations() {
  try {
    state.conversations = await api.listConversations();
    sidebar.renderConversations(state.conversations);
  } catch (e) {
    console.error('Failed to load conversations:', e);
    state.conversations = [];
  }
}

async function selectConversation(id) {
  try {
    const conv = await api.loadConversation(id);
    state.currentConversationId = conv.id;
    state.messages = conv.messages || [];
    sidebar.setActiveConversation(id);
    chat.renderMessages(state.messages);
  } catch (e) {
    console.error('Failed to load conversation:', e);
  }
}

function handleNewChat() {
  state.currentConversationId = null;
  state.messages = [];
  chat.clearMessages();
  sidebar.setActiveConversation(null);
}

async function handleDeleteConversation(id) {
  if (!confirm('Delete this conversation?')) return;

  try {
    await api.deleteConversation(id);
    if (state.currentConversationId === id) {
      handleNewChat();
    }
    await refreshConversations();
  } catch (e) {
    console.error('Failed to delete conversation:', e);
  }
}

async function handleRenameConversation(event) {
  const { id, title } = event.detail;
  try {
    const conv = await api.loadConversation(id);
    conv.title = title;
    await api.saveConversation(conv);
    await refreshConversations();
  } catch (e) {
    console.error('Failed to rename:', e);
  }
}

async function saveCurrentConversation() {
  if (!state.currentConversationId || state.isEphemeral) return;

  const title = generateTitle(state.messages);
  const now = new Date().toISOString();

  const existingConv = state.conversations.find(c => c.id === state.currentConversationId);

  const conversation = {
    id: state.currentConversationId,
    title: existingConv?.title || title,
    model: models.getCurrentModel() || 'unknown',
    messages: state.messages,
    created_at: existingConv?.created_at || now,
    updated_at: now,
  };

  try {
    await api.saveConversation(conversation);
    await refreshConversations();
    sidebar.setActiveConversation(state.currentConversationId);
  } catch (e) {
    console.error('Failed to save conversation:', e);
  }
}

// ── UI State ────────────────────────────────────────────────

function setGenerating(isGenerating) {
  state.isGenerating = isGenerating;

  const sendBtn = document.getElementById('send-btn');
  const sendIcon = document.getElementById('send-icon');
  const stopIcon = document.getElementById('stop-icon');
  const statusDot = document.querySelector('.status-dot');
  const statusText = document.getElementById('status-text');

  if (isGenerating) {
    sendBtn?.classList.add('generating');
    sendIcon?.classList.add('hidden');
    stopIcon?.classList.remove('hidden');
    statusDot.className = 'status-dot status-generating';
    statusText.textContent = 'Generating...';
  } else {
    sendBtn?.classList.remove('generating');
    sendIcon?.classList.remove('hidden');
    stopIcon?.classList.add('hidden');
    statusDot.className = 'status-dot status-ready';
    statusText.textContent = 'Ready';
  }
}

function showStats(stats) {
  const el = document.getElementById('generation-stats');
  const text = document.getElementById('stats-text');
  if (!el || !text) return;

  const tps = stats.tokens_per_second?.toFixed(1) || '0';
  const tokens = stats.tokens_generated || 0;
  const duration = ((stats.total_duration_ms || 0) / 1000).toFixed(1);

  text.textContent = `${tokens} tokens · ${tps} tok/s · ${duration}s`;
  el.classList.remove('hidden');

  // Hide after 5 seconds
  setTimeout(() => {
    el.classList.add('hidden');
  }, 5000);
}

// ── Ephemeral Toggle ────────────────────────────────────────

function setupEphemeralToggle() {
  const toggle = document.getElementById('ephemeral-toggle');
  toggle?.addEventListener('change', () => {
    state.isEphemeral = toggle.checked;
    if (state.isEphemeral) {
      // Start fresh ephemeral chat
      state.currentConversationId = null;
      state.messages = [];
      chat.clearMessages();
      sidebar.setActiveConversation(null);
    }
  });
}

// ── Hint Cards ──────────────────────────────────────────────

function setupHintCards() {
  document.querySelectorAll('.hint-card').forEach(card => {
    card.addEventListener('click', () => {
      const prompt = card.dataset.prompt;
      if (prompt) {
        const input = document.getElementById('chat-input');
        if (input) {
          input.value = prompt;
          input.focus();
        }
      }
    });
  });
}

// ── Model Loaded Callback ───────────────────────────────────

function handleModelLoaded(name) {
  console.log(`[Zexo] Model loaded: ${name}`);
}

// ── Helpers ─────────────────────────────────────────────────

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function generateTitle(messages) {
  const firstUser = messages.find(m => m.role === 'user');
  if (!firstUser) return 'New Chat';
  const text = firstUser.content.trim();
  if (text.length <= 50) return text;
  return text.substring(0, 47) + '...';
}
