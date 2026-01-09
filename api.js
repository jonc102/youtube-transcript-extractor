async function callOpenAI(apiKey, model, prompt, transcript) {
  const response = await chrome.runtime.sendMessage({
    action: 'callOpenAI',
    apiKey: apiKey,
    model: model,
    prompt: prompt,
    transcript: transcript
  });

  if (!response.success) {
    throw new Error(response.error || 'OpenAI API call failed');
  }

  return response.result;
}

async function callClaude(apiKey, model, prompt, transcript) {
  const response = await chrome.runtime.sendMessage({
    action: 'callClaude',
    apiKey: apiKey,
    model: model,
    prompt: prompt,
    transcript: transcript
  });

  if (!response.success) {
    throw new Error(response.error || 'Claude API call failed');
  }

  return response.result;
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
