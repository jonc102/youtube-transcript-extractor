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
    callOpenAI(request.apiKey, request.model, request.prompt, request.transcript)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
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
 * @param {string} modelId - Raw model ID from OpenAI
 * @returns {string} - Formatted label
 */
function formatModelLabel(modelId) {
  // Map of model IDs to friendly names
  const labelMap = {
    'chatgpt-4o-latest': 'ChatGPT-4o (Latest)',
    'gpt-4o': 'GPT-4o',
    'gpt-4o-mini': 'GPT-4o Mini',
    'gpt-4o-2024-11-20': 'GPT-4o (Nov 2024)',
    'gpt-4o-2024-08-06': 'GPT-4o (Aug 2024)',
    'gpt-4o-2024-05-13': 'GPT-4o (May 2024)',
    'gpt-4o-mini-2024-07-18': 'GPT-4o Mini (Jul 2024)',
    'o1-preview': 'O1 Preview',
    'o1-preview-2024-09-12': 'O1 Preview (Sep 2024)',
    'o1-mini': 'O1 Mini',
    'o1-mini-2024-09-12': 'O1 Mini (Sep 2024)',
    'gpt-4-turbo': 'GPT-4 Turbo',
    'gpt-4-turbo-2024-04-09': 'GPT-4 Turbo (Apr 2024)',
    'gpt-4-turbo-preview': 'GPT-4 Turbo Preview',
    'gpt-4-0125-preview': 'GPT-4 Turbo (Jan 2024)',
    'gpt-4-1106-preview': 'GPT-4 Turbo (Nov 2023)',
    'gpt-4': 'GPT-4',
    'gpt-4-0613': 'GPT-4 (Jun 2023)',
    'gpt-3.5-turbo': 'GPT-3.5 Turbo',
    'gpt-3.5-turbo-0125': 'GPT-3.5 Turbo (Jan 2024)',
    'gpt-3.5-turbo-1106': 'GPT-3.5 Turbo (Nov 2023)'
  };

  // Return mapped label or clean up the ID
  if (labelMap[modelId]) {
    return labelMap[modelId];
  }

  // Fallback: clean up the model ID for display
  return modelId
    .replace('gpt-', 'GPT-')
    .replace('o1-', 'O1-')
    .replace('chatgpt-', 'ChatGPT-')
    .replace('-preview', ' Preview')
    .replace('-turbo', ' Turbo')
    .replace('-mini', ' Mini');
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

    // Filter for chat completion models by excluding known non-chat models
    const chatModels = data.data
      .filter(model => {
        const id = model.id.toLowerCase();
        // Exclude non-chat models
        if (id.includes('embedding')) return false; // text-embedding-*
        if (id.includes('whisper')) return false; // whisper-1
        if (id.includes('tts')) return false; // tts-1, tts-1-hd
        if (id.includes('dall-e')) return false; // dall-e-2, dall-e-3
        if (id.includes('davinci-002')) return false; // text-davinci-002 (legacy)
        if (id.includes('babbage')) return false; // babbage (legacy)
        if (id.includes('ada')) return false; // ada (legacy)
        if (id.includes('curie')) return false; // curie (legacy)

        // Include all GPT and O1 models (chat completion models)
        if (id.includes('gpt')) return true;
        if (id.includes('o1')) return true;
        if (id.includes('chatgpt')) return true;

        // Exclude everything else by default
        return false;
      })
      .sort((a, b) => {
        const priority = {
          'chatgpt-4o-latest': 1,
          'gpt-4o': 2,
          'gpt-4o-mini': 3,
          'o1-preview': 4,
          'o1-mini': 5,
          'o1': 6,
          'gpt-4-turbo': 7,
          'gpt-4': 8,
          'gpt-3.5-turbo': 9
        };

        const getPriority = (id) => {
          for (const [key, val] of Object.entries(priority)) {
            if (id.startsWith(key)) return val;
          }
          return 999;
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

  // Determine if model uses max_completion_tokens (newer models) or max_tokens (legacy models)
  // Legacy models: gpt-3.5-turbo, gpt-4 (base), gpt-4-turbo (all non-4o gpt-4 variants)
  // Newer models: o1, gpt-4o, gpt-5+, chatgpt-*, and future models
  const isLegacyModel =
    model.startsWith('gpt-3.5') ||
    (model.startsWith('gpt-4') && !model.includes('4o'));

  const usesMaxCompletionTokens = !isLegacyModel;

  // O1 models don't support temperature parameter
  const isO1Model = model.includes('o1');

  // Build request body with appropriate parameters
  const requestBody = {
    model: model,
    messages: messages
  };

  // Only add temperature for non-O1 models
  if (!isO1Model) {
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
