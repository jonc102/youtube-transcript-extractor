const OPENAI_MODELS = [
  { value: 'gpt-4o', label: 'GPT-4o (Recommended)' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' }
];

const CLAUDE_MODELS = [
  { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet (Recommended)' },
  { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
  { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' }
];

document.addEventListener('DOMContentLoaded', async function() {
  const backBtn = document.getElementById('backBtn');
  const apiProviderSelect = document.getElementById('apiProvider');
  const apiKeyInput = document.getElementById('apiKey');
  const toggleApiKeyBtn = document.getElementById('toggleApiKey');
  const customPromptInput = document.getElementById('customPrompt');
  const modelSelect = document.getElementById('model');
  const saveBtn = document.getElementById('saveBtn');
  const clearBtn = document.getElementById('clearBtn');
  const statusDiv = document.getElementById('status');

  const apiKeySection = document.getElementById('apiKeySection');
  const promptSection = document.getElementById('promptSection');
  const modelSection = document.getElementById('modelSection');

  backBtn.addEventListener('click', function() {
    window.location.href = 'popup.html';
  });

  toggleApiKeyBtn.addEventListener('click', function() {
    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
      toggleApiKeyBtn.textContent = 'Hide';
    } else {
      apiKeyInput.type = 'password';
      toggleApiKeyBtn.textContent = 'Show';
    }
  });

  apiProviderSelect.addEventListener('change', function() {
    const provider = apiProviderSelect.value;

    if (provider === '') {
      apiKeySection.style.display = 'none';
      promptSection.style.display = 'none';
      modelSection.style.display = 'none';
    } else {
      apiKeySection.style.display = 'block';
      promptSection.style.display = 'block';
      modelSection.style.display = 'block';
      updateModelOptions(provider);
    }
  });

  function updateModelOptions(provider) {
    modelSelect.innerHTML = '';
    const models = provider === 'openai' ? OPENAI_MODELS : CLAUDE_MODELS;

    models.forEach(model => {
      const option = document.createElement('option');
      option.value = model.value;
      option.textContent = model.label;
      modelSelect.appendChild(option);
    });
  }

  async function loadSettings() {
    try {
      const settings = await chrome.storage.sync.get([
        'apiProvider',
        'apiKey',
        'customPrompt',
        'model'
      ]);

      if (settings.apiProvider) {
        apiProviderSelect.value = settings.apiProvider;
        apiProviderSelect.dispatchEvent(new Event('change'));
      }

      if (settings.apiKey) {
        apiKeyInput.value = settings.apiKey;
      }

      if (settings.customPrompt) {
        customPromptInput.value = settings.customPrompt;
      }

      if (settings.model) {
        modelSelect.value = settings.model;
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      showStatus('Failed to load settings', 'error');
    }
  }

  saveBtn.addEventListener('click', async function() {
    const provider = apiProviderSelect.value;
    const apiKey = apiKeyInput.value.trim();
    const customPrompt = customPromptInput.value.trim();
    const model = modelSelect.value;

    if (provider && !apiKey) {
      showStatus('Please enter an API key', 'error');
      return;
    }

    if (provider && !customPrompt) {
      showStatus('Please enter a custom prompt', 'error');
      return;
    }

    try {
      const settings = {
        apiProvider: provider,
        apiKey: apiKey,
        customPrompt: customPrompt,
        model: model
      };

      await chrome.storage.sync.set(settings);
      showStatus('Settings saved successfully!', 'success');

      setTimeout(() => {
        statusDiv.textContent = '';
        statusDiv.className = 'status';
      }, 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      showStatus('Failed to save settings: ' + error.message, 'error');
    }
  });

  clearBtn.addEventListener('click', async function() {
    if (!confirm('Are you sure you want to clear all settings? This action cannot be undone.')) {
      return;
    }

    try {
      await chrome.storage.sync.clear();

      apiProviderSelect.value = '';
      apiKeyInput.value = '';
      customPromptInput.value = '';
      modelSelect.innerHTML = '';

      apiKeySection.style.display = 'none';
      promptSection.style.display = 'none';
      modelSection.style.display = 'none';

      showStatus('All settings cleared', 'success');

      setTimeout(() => {
        statusDiv.textContent = '';
        statusDiv.className = 'status';
      }, 3000);
    } catch (error) {
      console.error('Error clearing settings:', error);
      showStatus('Failed to clear settings: ' + error.message, 'error');
    }
  });

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = 'status ' + type;
  }

  await loadSettings();
});
