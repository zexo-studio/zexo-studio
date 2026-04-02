// ── Models Module ───────────────────────────────────────────
// Handles model selector dropdown, model management modal,
// HuggingFace search and downloads

import * as api from './api.js';

let currentModel = null;
let modelsList = [];
let onModelLoaded = null;

export function initModels({ onLoaded }) {
  onModelLoaded = onLoaded;

  // Model selector dropdown
  const selectorBtn = document.getElementById('model-selector-btn');
  const dropdown = document.getElementById('model-dropdown');

  selectorBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('hidden');
    if (!dropdown.classList.contains('hidden')) {
      refreshModelsList();
    }
  });

  document.addEventListener('click', () => {
    dropdown?.classList.add('hidden');
  });

  dropdown?.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  // Models modal
  document.getElementById('models-btn')?.addEventListener('click', () => {
    openModelsModal();
  });

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${tab}`)?.classList.add('active');
    });
  });

  // HuggingFace search
  document.getElementById('hf-search-btn')?.addEventListener('click', performSearch);
  document.getElementById('hf-search-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') performSearch();
  });

  // Direct URL download
  document.getElementById('hf-url-download-btn')?.addEventListener('click', downloadFromUrl);

  // Download progress events
  api.onDownloadProgress(handleDownloadProgress);
  api.onDownloadComplete(handleDownloadComplete);
}

export function getCurrentModel() {
  return currentModel;
}

export async function refreshModelsList() {
  try {
    modelsList = await api.listLocalModels();
    renderDropdown();
    renderInstalledModels();
  } catch (e) {
    console.error('Failed to list models:', e);
    modelsList = [];
  }
}

export async function loadInitialModel() {
  try {
    const loaded = await api.getLoadedModel();
    if (loaded) {
      currentModel = loaded;
      updateSelectorLabel(loaded);
    }
  } catch (_) {}
}

// ── Dropdown Rendering ──────────────────────────────────────

function renderDropdown() {
  const list = document.getElementById('model-dropdown-list');
  if (!list) return;

  if (modelsList.length === 0) {
    list.innerHTML = '<div class="model-dropdown-empty">No models found.<br>Add .gguf files to your models directory.</div>';
    return;
  }

  list.innerHTML = modelsList.map(m => `
    <div class="model-dropdown-item ${m.name === currentModel ? 'selected' : ''}" data-path="${escapeAttr(m.path)}">
      <div>
        <div class="model-dropdown-name">${escapeHtml(m.name)}</div>
      </div>
      <div class="model-dropdown-size">${m.size_display}</div>
    </div>
  `).join('');

  list.querySelectorAll('.model-dropdown-item').forEach(item => {
    item.addEventListener('click', async () => {
      const path = item.dataset.path;
      await selectModel(path);
      document.getElementById('model-dropdown')?.classList.add('hidden');
    });
  });
}

async function selectModel(path) {
  const statusDot = document.querySelector('.status-dot');
  const statusText = document.getElementById('status-text');

  try {
    // Show loading state
    statusDot.className = 'status-dot status-loading';
    statusText.textContent = 'Loading model...';
    updateSelectorLabel('Loading...');

    const name = await api.loadModel(path);
    currentModel = name;
    updateSelectorLabel(name);

    statusDot.className = 'status-dot status-ready';
    statusText.textContent = 'Ready';

    if (onModelLoaded) onModelLoaded(name);
  } catch (e) {
    console.error('Failed to load model:', e);
    statusDot.className = 'status-dot status-error';
    statusText.textContent = 'Error';
    updateSelectorLabel('Select Model');
    currentModel = null;
  }
}

function updateSelectorLabel(text) {
  const label = document.getElementById('model-selector-label');
  if (label) label.textContent = text;
}

// ── Models Modal ────────────────────────────────────────────

function openModelsModal() {
  document.getElementById('models-modal')?.classList.remove('hidden');
  refreshModelsList();
}

function renderInstalledModels() {
  const list = document.getElementById('installed-models-list');
  const noModels = document.getElementById('no-models-msg');
  if (!list) return;

  if (modelsList.length === 0) {
    list.classList.add('hidden');
    noModels?.classList.remove('hidden');
    return;
  }

  list.classList.remove('hidden');
  noModels?.classList.add('hidden');

  list.innerHTML = modelsList.map(m => `
    <div class="model-card" data-path="${escapeAttr(m.path)}">
      <div class="model-card-info">
        <div class="model-card-name">${escapeHtml(m.name)}</div>
        <div class="model-card-meta">${m.size_display} · ${m.modified_at}</div>
      </div>
      <div class="model-card-actions">
        <button class="btn btn-ghost btn-sm load-model-btn" data-path="${escapeAttr(m.path)}">Load</button>
        <button class="btn btn-danger btn-sm delete-model-btn" data-path="${escapeAttr(m.path)}" data-name="${escapeAttr(m.name)}">Delete</button>
      </div>
    </div>
  `).join('');

  // Bind load buttons
  list.querySelectorAll('.load-model-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await selectModel(btn.dataset.path);
    });
  });

  // Bind delete buttons
  list.querySelectorAll('.delete-model-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const name = btn.dataset.name;
      if (confirm(`Delete model "${name}"? This cannot be undone.`)) {
        try {
          await api.deleteModel(btn.dataset.path);
          await refreshModelsList();
        } catch (e) {
          alert('Failed to delete: ' + e);
        }
      }
    });
  });
}

// ── HuggingFace Search ──────────────────────────────────────

async function performSearch() {
  const input = document.getElementById('hf-search-input');
  const query = input?.value.trim();
  if (!query) return;

  const results = document.getElementById('hf-results');
  if (!results) return;

  results.innerHTML = '<div style="text-align: center; padding: 20px;"><div class="spinner" style="margin: 0 auto;"></div></div>';

  try {
    const data = await api.searchHuggingface(query);

    if (data.length === 0) {
      results.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">No GGUF models found</div>';
      return;
    }

    results.innerHTML = data.map((model, idx) => `
      <div class="hf-card" id="hf-card-${idx}">
        <div class="hf-card-header" onclick="document.getElementById('hf-card-${idx}').classList.toggle('expanded')">
          <div>
            <div class="hf-card-title">${escapeHtml(model.name)}</div>
            <div style="font-size: 11px; color: var(--text-muted);">${escapeHtml(model.author)}</div>
          </div>
          <div class="hf-card-stats">
            <span>↓ ${formatNumber(model.downloads)}</span>
            <span>♥ ${formatNumber(model.likes)}</span>
            <span>${model.files.length} files</span>
          </div>
        </div>
        <div class="hf-card-files">
          ${model.files.length === 0
            ? '<div style="padding: 8px; color: var(--text-muted); font-size: 12px;">No GGUF files listed — try the model page directly</div>'
            : model.files.map(f => `
              <div class="hf-file-item">
                <div>
                  <span class="hf-file-name">${escapeHtml(f.filename)}</span>
                  <span class="hf-file-size">${f.size_display}</span>
                </div>
                <button class="btn btn-primary btn-sm" onclick="window._downloadHfFile('${escapeAttr(f.download_url)}', '${escapeAttr(f.filename)}')">
                  Download
                </button>
              </div>
            `).join('')
          }
        </div>
      </div>
    `).join('');
  } catch (e) {
    results.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--error);">Search failed: ${escapeHtml(String(e))}</div>`;
  }
}

// Global download trigger for inline onclick handlers
window._downloadHfFile = async function(url, filename) {
  startDownload(url, filename);
};

async function downloadFromUrl() {
  const input = document.getElementById('hf-url-input');
  const url = input?.value.trim();
  if (!url) return;

  // Extract filename from URL
  const parts = url.split('/');
  let filename = parts[parts.length - 1];
  if (!filename.endsWith('.gguf')) {
    filename = filename + '.gguf';
  }

  startDownload(url, filename);
}

async function startDownload(url, filename) {
  const area = document.getElementById('download-progress-area');
  area?.classList.remove('hidden');

  document.getElementById('download-filename').textContent = filename;
  document.getElementById('download-speed').textContent = '';
  document.getElementById('download-progress-bar').style.width = '0%';
  document.getElementById('download-percent').textContent = '0%';

  try {
    await api.downloadModel(url, filename);
  } catch (e) {
    alert('Download failed: ' + e);
    area?.classList.add('hidden');
  }
}

function handleDownloadProgress(data) {
  document.getElementById('download-progress-bar').style.width = `${data.percent}%`;
  document.getElementById('download-percent').textContent = `${data.percent.toFixed(1)}%`;
  document.getElementById('download-speed').textContent = `${data.speed_mbps.toFixed(1)} MB/s`;
}

function handleDownloadComplete(filename) {
  const area = document.getElementById('download-progress-area');
  document.getElementById('download-percent').textContent = '100% — Complete!';
  setTimeout(() => {
    area?.classList.add('hidden');
    refreshModelsList();
  }, 2000);
}

// ── Helpers ─────────────────────────────────────────────────

function formatNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

function escapeHtml(text) {
  const el = document.createElement('span');
  el.textContent = text;
  return el.innerHTML;
}

function escapeAttr(text) {
  return text.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}
