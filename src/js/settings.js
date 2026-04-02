// ── Settings Module ─────────────────────────────────────────
// Handles settings modal and persistence

import * as api from './api.js';

let currentSettings = {};

export function initSettings() {
  // Open settings modal
  document.getElementById('settings-btn')?.addEventListener('click', openSettings);

  // Save button
  document.getElementById('settings-save-btn')?.addEventListener('click', saveCurrentSettings);

  // Slider value displays
  setupSlider('setting-temperature', 'temp-value', v => parseFloat(v).toFixed(1));
  setupSlider('setting-top-p', 'topp-value', v => parseFloat(v).toFixed(2));
  setupSlider('setting-num-ctx', 'ctx-value', v => parseInt(v).toLocaleString());
  setupSlider('setting-gpu-layers', 'gpu-value', v => v);

  // Modal close buttons
  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.dataset.close;
      document.getElementById(modalId)?.classList.add('hidden');
    });
  });

  // Close modal on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.add('hidden');
      }
    });
  });

  // Close modals on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
    }
  });
}

export async function loadSettings() {
  try {
    currentSettings = await api.getSettings();
    return currentSettings;
  } catch (e) {
    console.error('Failed to load settings:', e);
    currentSettings = {
      models_directory: '',
      temperature: 0.7,
      top_p: 0.9,
      num_ctx: 4096,
      system_prompt: '',
      n_gpu_layers: 999,
      hf_token: '',
    };
    return currentSettings;
  }
}

export function getSettings() {
  return currentSettings;
}

function openSettings() {
  const modal = document.getElementById('settings-modal');
  modal?.classList.remove('hidden');

  // Populate fields with current settings
  setVal('setting-models-dir', currentSettings.models_directory);
  setSlider('setting-temperature', currentSettings.temperature, 'temp-value', v => parseFloat(v).toFixed(1));
  setSlider('setting-top-p', currentSettings.top_p, 'topp-value', v => parseFloat(v).toFixed(2));
  setSlider('setting-num-ctx', currentSettings.num_ctx, 'ctx-value', v => parseInt(v).toLocaleString());
  setSlider('setting-gpu-layers', currentSettings.n_gpu_layers, 'gpu-value', v => v);
  setVal('setting-system-prompt', currentSettings.system_prompt);
  setVal('setting-hf-token', currentSettings.hf_token);
}

async function saveCurrentSettings() {
  const newSettings = {
    models_directory: getVal('setting-models-dir'),
    temperature: parseFloat(getVal('setting-temperature')) || 0.7,
    top_p: parseFloat(getVal('setting-top-p')) || 0.9,
    num_ctx: parseInt(getVal('setting-num-ctx')) || 4096,
    system_prompt: getVal('setting-system-prompt'),
    n_gpu_layers: parseInt(getVal('setting-gpu-layers')) || 999,
    hf_token: getVal('setting-hf-token'),
  };

  try {
    await api.saveSettings(newSettings);
    currentSettings = newSettings;
    document.getElementById('settings-modal')?.classList.add('hidden');
  } catch (e) {
    alert('Failed to save settings: ' + e);
  }
}

// ── Helpers ─────────────────────────────────────────────────

function setupSlider(sliderId, valueId, formatter) {
  const slider = document.getElementById(sliderId);
  const valueEl = document.getElementById(valueId);
  if (slider && valueEl) {
    slider.addEventListener('input', () => {
      valueEl.textContent = formatter(slider.value);
    });
  }
}

function setSlider(sliderId, value, valueId, formatter) {
  const slider = document.getElementById(sliderId);
  const valueEl = document.getElementById(valueId);
  if (slider) slider.value = value;
  if (valueEl) valueEl.textContent = formatter(value);
}

function setVal(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value || '';
}

function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}
