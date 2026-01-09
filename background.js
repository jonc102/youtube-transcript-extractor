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
});

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

    const chatModels = data.data
      .filter(model =>
        model.id.includes('gpt-4') ||
        model.id.includes('gpt-3.5') ||
        model.id.includes('o1')
      )
      .sort((a, b) => {
        const priority = {
          'gpt-4o': 1,
          'gpt-4o-mini': 2,
          'o1': 3,
          'gpt-4-turbo': 4,
          'gpt-4': 5,
          'gpt-3.5-turbo': 6
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
        label: model.id
      }));

    if (chatModels.length === 0) {
      return { success: false, models: null, error: 'No chat models found' };
    }

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

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      temperature: 0.7,
      max_tokens: 4000
    })
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
