// Background service worker for handling API calls
// This bypasses CORS restrictions that would occur in popup/settings pages

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchOpenAIModels') {
    fetchOpenAIModels(request.apiKey)
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }));
    return true; // Required for async response
  }

  if (request.action === 'fetchClaudeModels') {
    fetchClaudeModels(request.apiKey)
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }));
    return true; // Required for async response
  }

  if (request.action === 'callOpenAI') {
    console.log('[Background] callOpenAI message received:', {
      model: request.model,
      apiKeyLength: request.apiKey?.length,
      hasPrompt: !!request.prompt,
      hasTranscript: !!request.transcript
    });
    callOpenAI(request.apiKey, request.model, request.prompt, request.transcript)
      .then(result => {
        console.log('[Background] callOpenAI success');
        sendResponse({ success: true, result });
      })
      .catch(error => {
        console.error('[Background] callOpenAI error:', error.message);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Required for async response
  }

  if (request.action === 'callClaude') {
    console.log('callClaude message received:', {
      apiKeyLength: request.apiKey?.length,
      apiKeyPrefix: request.apiKey?.substring(0, 10),
      model: request.model,
      hasPrompt: !!request.prompt,
      hasTranscript: !!request.transcript
    });
    callClaude(request.apiKey, request.model, request.prompt, request.transcript)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Required for async response
  }

  if (request.action === 'openSettings') {
    chrome.tabs.create({
      url: chrome.runtime.getURL('settings.html')
    }, (tab) => {
      sendResponse({ success: true, tabId: tab.id });
    });
    return true; // Required for async response
  }
});

/**
 * Format OpenAI model ID into user-friendly label
 * Optimized for recommended models used in short text summaries
 * @param {string} modelId - Raw model ID from OpenAI
 * @returns {string} - Formatted label
 */
function formatModelLabel(modelId) {
  // Map of recommended model IDs to friendly names
  const labelMap = {
    // ChatGPT-4o family (best quality)
    'chatgpt-4o-latest': 'ChatGPT-4o Latest (Best Quality)',
    'gpt-4o': 'GPT-4o',
    'gpt-4o-mini': 'GPT-4o Mini',

    // GPT-5 family (frontier models, ultra-affordable)
    'gpt-5': 'GPT-5 (Frontier)',
    'gpt-5-nano': 'GPT-5 Nano (Ultra Cheap)',
    'gpt-5-mini': 'GPT-5 Mini'
  };

  // Return mapped label or clean up the ID
  if (labelMap[modelId]) {
    return labelMap[modelId];
  }

  // Fallback: clean up the model ID for display
  return modelId
    .replace(/^gpt-5-/i, 'GPT-5 ')
    .replace(/^gpt-4o-/i, 'GPT-4o ')
    .replace(/^gpt-/i, 'GPT-')
    .replace(/^chatgpt-/i, 'ChatGPT-')
    .replace(/-turbo/i, ' Turbo')
    .replace(/-mini/i, ' Mini')
    .replace(/-nano/i, ' Nano');
}

async function fetchOpenAIModels(apiKey) {
  if (!apiKey || apiKey.trim() === '') {
    return { success: false, models: null };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, models: null, error: 'Invalid API key' };
      }
      throw new Error(`Failed to fetch models: ${response.status}`);
    }

    const data = await response.json();

    if (!data.data || !Array.isArray(data.data)) {
      return { success: false, models: null, error: 'Unexpected response format' };
    }

    // Curated list of models optimized for short text summaries
    // Only the most relevant and cost-effective models
    const recommendedModels = [
      'chatgpt-4o-latest',    // Latest ChatGPT-4o (best quality)
      'gpt-4o',               // GPT-4o (fast, high quality)
      'gpt-4o-mini',          // GPT-4o Mini (balanced)
      'gpt-5',                // GPT-5 (base frontier model)
      'gpt-5-nano',           // GPT-5 Nano (frontier, ultra-cheap)
      'gpt-5-mini',           // GPT-5 Mini (frontier)
    ];

    // Filter for recommended models only
    const chatModels = data.data
      .filter(model => {
        const id = model.id.toLowerCase();

        // Only include exact matches from recommended list
        // This prevents snapshot models like gpt-4o-2024-11-20 from appearing
        return recommendedModels.some(recommended =>
          id === recommended.toLowerCase()
        );
      })
      .sort((a, b) => {
        // Sort by priority order in recommendedModels list
        const getPriority = (id) => {
          const index = recommendedModels.findIndex(recommended =>
            id.toLowerCase().startsWith(recommended.toLowerCase())
          );
          return index === -1 ? 999 : index;
        };

        return getPriority(a.id) - getPriority(b.id);
      })
      .map(model => ({
        value: model.id,
        label: formatModelLabel(model.id)
      }));

    if (chatModels.length === 0) {
      console.warn('[OpenAI Models] No chat models found. Total models fetched:', data.data.length);
      return { success: false, models: null, error: 'No chat models found' };
    }

    console.log('[OpenAI Models] Found', chatModels.length, 'chat models:', chatModels.map(m => m.value).join(', '));
    return { success: true, models: chatModels };
  } catch (error) {
    return { success: false, models: null, error: error.message };
  }
}

async function fetchClaudeModels(apiKey) {
  const defaultModels = [
    { value: 'claude-opus-4-5-20251101', label: 'Claude Opus 4.5 (Latest)' },
    { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5' },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
    { value: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet' },
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet v2' },
    { value: 'claude-3-5-sonnet-20240620', label: 'Claude 3.5 Sonnet v1' },
    { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
    { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
    { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' },
    { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' }
  ];

  if (!apiKey || apiKey.trim() === '') {
    return { success: true, models: defaultModels };
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }]
      })
    });

    if (response.ok || response.status === 400) {
      return { success: true, models: defaultModels };
    } else if (response.status === 401) {
      return { success: false, models: null, error: 'Invalid API key' };
    } else {
      return { success: true, models: defaultModels };
    }
  } catch (error) {
    return { success: true, models: defaultModels };
  }
}

async function callOpenAI(apiKey, model, prompt, transcript) {
  const messages = [
    {
      role: 'user',
      content: prompt + '\n\n' + transcript
    }
  ];

  // Determine model parameters based on model type
  const modelLower = model.toLowerCase();

  // Legacy models: gpt-3.5-turbo, gpt-4 (base), gpt-4-turbo (all non-4o gpt-4 variants)
  const isLegacyModel =
    modelLower.startsWith('gpt-3.5') ||
    (modelLower.startsWith('gpt-4') && !modelLower.includes('4o'));

  // Models that don't support temperature parameter
  const noTemperatureSupport =
    modelLower.includes('o1') ||      // O1 models
    modelLower.startsWith('gpt-5');   // GPT-5 models (only support default temperature)

  // Newer models use max_completion_tokens instead of max_tokens
  const usesMaxCompletionTokens = !isLegacyModel;

  console.log(`[OpenAI API] Model: ${model}, Legacy: ${isLegacyModel}, Temperature: ${!noTemperatureSupport}, max_completion_tokens: ${usesMaxCompletionTokens}`);

  // Build request body with appropriate parameters
  const requestBody = {
    model: model,
    messages: messages
  };

  // Only add temperature for models that support it
  if (!noTemperatureSupport) {
    requestBody.temperature = 0.7;
  }

  // Use appropriate token parameter name based on model
  if (usesMaxCompletionTokens) {
    requestBody.max_completion_tokens = 4000;
  } else {
    requestBody.max_tokens = 4000;
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `OpenAI API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error('Invalid response format from OpenAI API');
  }

  return data.choices[0].message.content;
}

async function callClaude(apiKey, model, prompt, transcript) {
  try {
    console.log('callClaude called with:', {
      apiKeyLength: apiKey?.length,
      apiKeyPrefix: apiKey?.substring(0, 10),
      model: model,
      promptLength: prompt?.length,
      transcriptLength: transcript?.length
    });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: prompt + '\n\n' + transcript
          }
        ]
      })
    });

    console.log('Claude API response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Claude API error response:', JSON.stringify(errorData, null, 2));

      if (errorData.error?.type) {
        throw new Error(`${errorData.error.type}: ${errorData.error.message || response.statusText}`);
      }

      throw new Error(errorData.error?.message || `Claude API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.content || !data.content[0] || !data.content[0].text) {
      throw new Error('Invalid response format from Claude API');
    }

    return data.content[0].text;
  } catch (error) {
    console.error('Error in callClaude:', error);
    throw error;
  }
}
