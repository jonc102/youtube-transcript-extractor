let cachedModels = {
  openai: null,
  claude: null
};

async function fetchOpenAIModels(apiKey) {
  if (!apiKey || apiKey.trim() === '') {
    return null;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'fetchOpenAIModels',
      apiKey: apiKey
    });

    if (response.error) {
      console.error('Error fetching OpenAI models:', response.error);
      return null;
    }

    if (response.success && response.models) {
      return response.models;
    }

    return null;
  } catch (error) {
    console.error('Error communicating with background service:', error);
    return null;
  }
}

async function fetchClaudeModels(apiKey) {
  // Always delegate to background.js - no duplicate model list
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'fetchClaudeModels',
      apiKey: apiKey || '' // Pass empty string if no API key
    });

    if (response.error) {
      console.error('Error validating Claude API key:', response.error);
      if (response.error === 'Invalid API key') {
        return null;
      }
      // Return empty array on other errors - background should handle fallback
      return [];
    }

    if (response.success && response.models) {
      return response.models;
    }

    // Return empty array if unexpected response
    return [];
  } catch (error) {
    console.error('Error communicating with background service:', error);
    return [];
  }
}

document.addEventListener('DOMContentLoaded', async function() {
  const backBtn = document.getElementById('backBtn');
  const apiProviderSelect = document.getElementById('apiProvider');
  const apiKeyInput = document.getElementById('apiKey');
  const toggleApiKeyBtn = document.getElementById('toggleApiKey');
  const customPromptInput = document.getElementById('customPrompt');
  const modelSelect = document.getElementById('model');
  const refreshModelsBtn = document.getElementById('refreshModelsBtn');
  const saveBtn = document.getElementById('saveBtn');
  const clearBtn = document.getElementById('clearBtn');
  const statusDiv = document.getElementById('status');

  const apiKeySection = document.getElementById('apiKeySection');
  const promptSection = document.getElementById('promptSection');
  const modelSection = document.getElementById('modelSection');

  // Initialize theme on page load
  async function initializeTheme() {
    const { themePreference } = await chrome.storage.sync.get(['themePreference']);
    const preference = themePreference || 'auto';

    let isDark = false;
    if (preference === 'auto') {
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    } else {
      isDark = preference === 'dark';
    }

    document.body.classList.toggle('settings-dark', isDark);
    document.body.classList.toggle('settings-light', !isDark);
  }

  // Call immediately
  await initializeTheme();

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async (e) => {
    const { themePreference } = await chrome.storage.sync.get(['themePreference']);
    if (themePreference === 'auto' || !themePreference) {
      document.body.classList.toggle('settings-dark', e.matches);
      document.body.classList.toggle('settings-light', !e.matches);
    }
  });

  backBtn.addEventListener('click', function() {
    window.location.href = 'popup.html';
  });

  toggleApiKeyBtn.addEventListener('click', function() {
    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
      toggleApiKeyBtn.textContent = '🙈';
      toggleApiKeyBtn.setAttribute('aria-label', 'Hide API key');
    } else {
      apiKeyInput.type = 'password';
      toggleApiKeyBtn.textContent = '👁️';
      toggleApiKeyBtn.setAttribute('aria-label', 'Show API key');
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
    }
  });

  apiKeyInput.addEventListener('blur', async function() {
    const apiKey = apiKeyInput.value.trim();
    const provider = apiProviderSelect.value;

    if (apiKey && provider && apiKey.length > 10) {
      await fetchAndPopulateModels(provider, apiKey);
    }
  });

  refreshModelsBtn.addEventListener('click', async function() {
    const apiKey = apiKeyInput.value.trim();
    const provider = apiProviderSelect.value;

    if (!apiKey) {
      showStatus('Please enter an API key first', 'error');
      return;
    }

    if (!provider) {
      showStatus('Please select an API provider first', 'error');
      return;
    }

    refreshModelsBtn.disabled = true;
    await fetchAndPopulateModels(provider, apiKey, true);
    refreshModelsBtn.disabled = false;
  });

  async function fetchAndPopulateModels(provider, apiKey, forceRefresh = false) {
    if (!forceRefresh && cachedModels[provider]) {
      populateModelSelect(cachedModels[provider]);
      return;
    }

    modelSelect.innerHTML = '<option>Loading models...</option>';
    modelSelect.disabled = true;

    let models = null;
    let errorMessage = '';

    try {
      if (provider === 'openai') {
        models = await fetchOpenAIModels(apiKey);
        if (!models) {
          errorMessage = 'Failed to load OpenAI models. Please verify your API key is valid and has access to the models endpoint.';
        }
      } else if (provider === 'claude') {
        models = await fetchClaudeModels(apiKey);
        if (!models) {
          errorMessage = 'Failed to validate Claude API key. Please verify your API key is correct.';
        }
      }
    } catch (error) {
      console.error('Error in fetchAndPopulateModels:', error);
      errorMessage = `Error: ${error.message}`;
    }

    modelSelect.disabled = false;

    if (models && models.length > 0) {
      cachedModels[provider] = models;
      populateModelSelect(models);
      showStatus('Models loaded successfully', 'success');
      setTimeout(() => {
        statusDiv.textContent = '';
        statusDiv.className = 'status';
      }, 2000);
    } else {
      modelSelect.innerHTML = '<option>Failed to load models</option>';
      showStatus(errorMessage || 'Failed to load models. Please check your API key.', 'error');
    }
  }

  function populateModelSelect(models) {
    modelSelect.innerHTML = '';
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

        if (settings.apiProvider) {
          await fetchAndPopulateModels(settings.apiProvider, settings.apiKey);
        }
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
