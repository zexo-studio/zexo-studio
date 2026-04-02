// ── Chat Module ─────────────────────────────────────────────
// Handles message display, streaming, and chat interaction

import { renderMarkdown } from './markdown.js';

let chatMessagesEl;
let welcomeScreen;
let streamingMessageEl = null;
let streamingContent = '';

export function initChat() {
  chatMessagesEl = document.getElementById('chat-messages');
  welcomeScreen = document.getElementById('welcome-screen');
}

export function showWelcome() {
  if (welcomeScreen) welcomeScreen.classList.remove('hidden');
}

export function hideWelcome() {
  if (welcomeScreen) welcomeScreen.classList.add('hidden');
}

export function clearMessages() {
  chatMessagesEl.innerHTML = '';
  chatMessagesEl.appendChild(welcomeScreen);
  showWelcome();
  streamingMessageEl = null;
  streamingContent = '';
}

export function renderMessages(messages) {
  // Remove welcome screen reference but keep the element
  const welcome = welcomeScreen;
  chatMessagesEl.innerHTML = '';

  if (messages.length === 0) {
    chatMessagesEl.appendChild(welcome);
    showWelcome();
    return;
  }

  hideWelcome();

  messages.forEach(msg => {
    if (msg.role === 'system') return; // Don't display system messages
    appendMessage(msg.role, msg.content);
  });

  scrollToBottom();
}

export function appendMessage(role, content) {
  hideWelcome();

  const messageEl = document.createElement('div');
  messageEl.className = 'message';

  const headerEl = document.createElement('div');
  headerEl.className = 'message-header';

  const roleEl = document.createElement('span');
  roleEl.className = `message-role ${role}`;
  roleEl.textContent = role === 'user' ? 'You' : 'Assistant';
  headerEl.appendChild(roleEl);

  const contentEl = document.createElement('div');
  contentEl.className = 'message-content';

  if (role === 'user') {
    // User messages: escape HTML and convert newlines
    contentEl.innerHTML = `<p>${escapeHtml(content).replace(/\n/g, '<br>')}</p>`;
  } else {
    // Assistant messages: render markdown
    contentEl.innerHTML = renderMarkdown(content);
  }

  messageEl.appendChild(headerEl);
  messageEl.appendChild(contentEl);
  chatMessagesEl.appendChild(messageEl);

  scrollToBottom();
  return messageEl;
}

export function startStreaming() {
  hideWelcome();
  streamingContent = '';

  const messageEl = document.createElement('div');
  messageEl.className = 'message';

  const headerEl = document.createElement('div');
  headerEl.className = 'message-header';

  const roleEl = document.createElement('span');
  roleEl.className = 'message-role assistant';
  roleEl.textContent = 'Assistant';
  headerEl.appendChild(roleEl);

  const contentEl = document.createElement('div');
  contentEl.className = 'message-content';
  contentEl.innerHTML = '<span class="streaming-cursor"></span>';

  messageEl.appendChild(headerEl);
  messageEl.appendChild(contentEl);
  chatMessagesEl.appendChild(messageEl);

  streamingMessageEl = contentEl;
  scrollToBottom();
}

export function appendStreamToken(token) {
  if (!streamingMessageEl) return;

  streamingContent += token;

  // Re-render markdown with cursor
  streamingMessageEl.innerHTML =
    renderMarkdown(streamingContent) +
    '<span class="streaming-cursor"></span>';

  scrollToBottom();
}

export function endStreaming() {
  if (!streamingMessageEl) return;

  // Final render without cursor
  streamingMessageEl.innerHTML = renderMarkdown(streamingContent);

  const finalContent = streamingContent;
  streamingMessageEl = null;
  streamingContent = '';

  scrollToBottom();
  return finalContent;
}

export function showError(message) {
  const errorEl = document.createElement('div');
  errorEl.className = 'message';
  errorEl.innerHTML = `
    <div class="message-header">
      <span class="message-role" style="color: var(--error)">Error</span>
    </div>
    <div class="message-content" style="color: var(--error)">
      <p>${escapeHtml(message)}</p>
    </div>
  `;
  chatMessagesEl.appendChild(errorEl);
  scrollToBottom();
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  });
}

function escapeHtml(text) {
  const el = document.createElement('div');
  el.textContent = text;
  return el.innerHTML;
}
