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
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
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

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Claude API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.content || !data.content[0] || !data.content[0].text) {
    throw new Error('Invalid response format from Claude API');
  }

  return data.content[0].text;
}

async function processTranscriptWithAI(transcript, settings) {
  if (!settings.apiProvider || !settings.apiKey || !settings.customPrompt) {
    throw new Error('API settings are not configured');
  }

  const { apiProvider, apiKey, model, customPrompt } = settings;

  try {
    let result;

    if (apiProvider === 'openai') {
      result = await callOpenAI(apiKey, model, customPrompt, transcript);
    } else if (apiProvider === 'claude') {
      result = await callClaude(apiKey, model, customPrompt, transcript);
    } else {
      throw new Error('Invalid API provider');
    }

    return result;
  } catch (error) {
    console.error('API call error:', error);
    throw error;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { processTranscriptWithAI, callOpenAI, callClaude };
}
