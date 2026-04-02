// ── Sidebar Module ──────────────────────────────────────────
// Handles conversation list, ephemeral toggle, sidebar collapse

let conversationListEl;
let onSelectConversation = null;
let onDeleteConversation = null;
let activeConversationId = null;

export function initSidebar({ onSelect, onDelete, onNewChat }) {
  conversationListEl = document.getElementById('conversation-list');
  onSelectConversation = onSelect;
  onDeleteConversation = onDelete;

  // Sidebar collapse
  const collapseBtn = document.getElementById('sidebar-collapse-btn');
  const toggleBtn = document.getElementById('sidebar-toggle-btn');
  const sidebar = document.getElementById('sidebar');

  collapseBtn?.addEventListener('click', () => {
    sidebar.classList.add('collapsed');
  });

  toggleBtn?.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
  });

  // New chat button
  document.getElementById('new-chat-btn')?.addEventListener('click', () => {
    if (onNewChat) onNewChat();
  });

  // Context menu handling
  setupContextMenu();
}

export function setActiveConversation(id) {
  activeConversationId = id;
  document.querySelectorAll('.conv-item').forEach(el => {
    el.classList.toggle('active', el.dataset.id === id);
  });
}

export function renderConversations(conversations) {
  if (!conversationListEl) return;
  conversationListEl.innerHTML = '';

  if (conversations.length === 0) {
    conversationListEl.innerHTML =
      '<div style="padding: 20px 12px; text-align: center; color: var(--text-muted); font-size: 12px;">No conversations yet</div>';
    return;
  }

  // Group by date
  const groups = groupByDate(conversations);

  for (const [label, convs] of Object.entries(groups)) {
    const groupLabel = document.createElement('div');
    groupLabel.className = 'conv-group-label';
    groupLabel.textContent = label;
    conversationListEl.appendChild(groupLabel);

    for (const conv of convs) {
      const item = document.createElement('div');
      item.className = 'conv-item';
      item.dataset.id = conv.id;
      if (conv.id === activeConversationId) {
        item.classList.add('active');
      }

      item.innerHTML = `
        <svg class="conv-item-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        <div class="conv-item-text">
          <div class="conv-item-title">${escapeHtml(conv.title || 'New Chat')}</div>
          <div class="conv-item-meta">${conv.model || 'unknown'}</div>
        </div>
      `;

      item.addEventListener('click', () => {
        if (onSelectConversation) onSelectConversation(conv.id);
      });

      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showContextMenu(e.clientX, e.clientY, conv.id);
      });

      conversationListEl.appendChild(item);
    }
  }
}

function groupByDate(conversations) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const lastWeek = new Date(today.getTime() - 7 * 86400000);

  const groups = {};

  for (const conv of conversations) {
    const date = new Date(conv.updated_at || conv.created_at);
    let label;

    if (date >= today) {
      label = 'Today';
    } else if (date >= yesterday) {
      label = 'Yesterday';
    } else if (date >= lastWeek) {
      label = 'Previous 7 Days';
    } else {
      label = 'Older';
    }

    if (!groups[label]) groups[label] = [];
    groups[label].push(conv);
  }

  return groups;
}

// ── Context Menu ────────────────────────────────────────────

let contextMenuEl;
let contextMenuTargetId = null;

function setupContextMenu() {
  contextMenuEl = document.getElementById('context-menu');

  document.addEventListener('click', () => {
    hideContextMenu();
  });

  contextMenuEl?.querySelectorAll('.context-menu-item').forEach(item => {
    item.addEventListener('click', () => {
      const action = item.dataset.action;
      if (action === 'delete' && contextMenuTargetId) {
        if (onDeleteConversation) onDeleteConversation(contextMenuTargetId);
      } else if (action === 'rename' && contextMenuTargetId) {
        // Simple rename via prompt
        const newTitle = prompt('Rename conversation:');
        if (newTitle && newTitle.trim()) {
          // Dispatch custom event
          window.dispatchEvent(new CustomEvent('rename-conversation', {
            detail: { id: contextMenuTargetId, title: newTitle.trim() }
          }));
        }
      }
      hideContextMenu();
    });
  });
}

function showContextMenu(x, y, convId) {
  if (!contextMenuEl) return;
  contextMenuTargetId = convId;
  contextMenuEl.classList.remove('hidden');
  contextMenuEl.style.left = `${x}px`;
  contextMenuEl.style.top = `${y}px`;
}

function hideContextMenu() {
  if (contextMenuEl) {
    contextMenuEl.classList.add('hidden');
    contextMenuTargetId = null;
  }
}

function escapeHtml(text) {
  const el = document.createElement('span');
  el.textContent = text;
  return el.innerHTML;
}
