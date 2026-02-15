// Transcript Orchestrator for Distill
// Coordinates unified extraction flow for both entry points (button + extension icon)

class TranscriptOrchestrator {
  /**
   * Extract transcript and display in modal
   * Main entry point for both in-page button and extension icon
   * @param {string} videoId - YouTube video ID
   * @param {string} source - Source of request ('in-page-button' or 'extension-icon')
   * @returns {Promise<boolean>} - True if successful
   */
  static async extractAndDisplay(videoId, source = 'unknown') {
    console.log(`[Orchestrator] Triggered from: ${source} for video: ${videoId}`);

    const isDark = ThemeDetector.isDarkMode();

    // Check if Chrome APIs are available
    if (!Utils.isChromeAPIAvailable()) {
      ModalUI.showError('Extension was reloaded. Please refresh this page (F5) to continue.', isDark);
      return false;
    }

    try {
      // Step 1: Check cache first
      const cachedData = await CacheManager.getCachedData(videoId);

      if (cachedData) {
        console.log('[Orchestrator] Using cached data');
        this._displayModal(cachedData, isDark);
        return true;
      }

      // Step 2: Show loading modal
      ModalUI.showLoading(isDark);

      // Step 3: Extract transcript from YouTube page
      console.log('[Orchestrator] Extracting transcript...');
      const extractResult = await this._extractTranscript();

      if (extractResult.error) {
        console.error('[Orchestrator] Extraction failed:', extractResult.error);
        ModalUI.showError(extractResult.error, isDark);
        return false;
      }

      // Step 4: Get video title
      const videoTitle = Utils.getVideoTitle();

      // Step 5: Prepare data object
      const data = {
        videoId: extractResult.videoId || videoId,
        videoTitle: videoTitle,
        timestamp: Date.now(),
        transcript: {
          raw: extractResult.transcript,
          segments: Utils.parseSegments(extractResult.transcript)
        },
        summary: null,
        chatHistory: []
      };

      // Step 6: Check if AI processing is configured - use streaming
      const aiResult = await this._processWithAI(extractResult.transcript, isDark);
      if (aiResult) {
        data.summary = aiResult;
      }

      // Step 7: Cache the result
      await CacheManager.setCachedData(videoId, data);

      // Step 8: Display modal
      this._displayModal(data, isDark);

      return true;

    } catch (error) {
      Utils.logError('Orchestrator.extractAndDisplay', error, { videoId, source });
      ModalUI.showError(`Failed to extract transcript: ${error.message}`, isDark);
      return false;
    }
  }

  /**
   * Extract transcript using existing content.js getTranscript function
   * @private
   * @returns {Promise<Object>} - Extraction result
   */
  static async _extractTranscript() {
    try {
      if (typeof getTranscript === 'function') {
        return await getTranscript();
      } else {
        throw new Error('getTranscript function not found. Ensure content.js is loaded.');
      }
    } catch (error) {
      Utils.logError('Orchestrator._extractTranscript', error);
      return { error: error.message };
    }
  }

  /**
   * Process transcript with AI using streaming if available
   * @private
   * @param {string} transcript - Raw transcript text
   * @param {boolean} isDark - Dark mode flag
   * @returns {Promise<Object|null>} - AI summary object or null
   */
  static async _processWithAI(transcript, isDark) {
    try {
      if (!Utils.isChromeAPIAvailable()) {
        return null;
      }

      const settings = await chrome.storage.sync.get([
        'apiProvider', 'apiKey', 'customPrompt', 'model'
      ]);

      if (!settings.apiProvider || !settings.apiKey || !settings.customPrompt) {
        console.log('[Orchestrator] AI processing not configured, skipping');
        return null;
      }

      console.log(`[Orchestrator] Processing with ${settings.apiProvider} (streaming)...`);

      // Try streaming first
      const portName = settings.apiProvider === 'openai' ? 'streamOpenAI' : 'streamClaude';

      try {
        const result = await this._streamFromPort(portName, {
          apiKey: settings.apiKey,
          model: settings.model,
          prompt: settings.customPrompt,
          transcript: transcript
        });

        if (result) {
          console.log('[Orchestrator] Streaming AI processing successful');
          return {
            provider: settings.apiProvider,
            model: settings.model,
            prompt: settings.customPrompt,
            result: result
          };
        }
      } catch (streamError) {
        console.warn('[Orchestrator] Streaming failed, falling back to non-streaming:', streamError.message);
      }

      // Fallback to non-streaming
      let result;
      if (settings.apiProvider === 'openai') {
        const response = await chrome.runtime.sendMessage({
          action: 'callOpenAI',
          apiKey: settings.apiKey,
          model: settings.model,
          prompt: settings.customPrompt,
          transcript: transcript
        });
        if (response.success) result = response.result;
        else throw new Error(response.error || 'OpenAI processing failed');
      } else if (settings.apiProvider === 'claude') {
        const response = await chrome.runtime.sendMessage({
          action: 'callClaude',
          apiKey: settings.apiKey,
          model: settings.model,
          prompt: settings.customPrompt,
          transcript: transcript
        });
        if (response.success) result = response.result;
        else throw new Error(response.error || 'Claude processing failed');
      }

      if (result) {
        return {
          provider: settings.apiProvider,
          model: settings.model,
          prompt: settings.customPrompt,
          result: result
        };
      }

      return null;

    } catch (error) {
      if (Utils.isContextInvalidatedError(error)) {
        return null;
      }
      Utils.logError('Orchestrator._processWithAI', error);
      return null;
    }
  }

  /**
   * Stream AI response from background port
   * @private
   * @param {string} portName - Port name ('streamOpenAI' or 'streamClaude')
   * @param {Object} request - Request payload
   * @returns {Promise<string>} - Full response text
   */
  static _streamFromPort(portName, request) {
    return new Promise((resolve, reject) => {
      const port = chrome.runtime.connect({ name: portName });
      let fullText = '';
      let rafPending = false;

      port.onMessage.addListener((msg) => {
        if (msg.type === 'chunk') {
          fullText += msg.content;

          // Throttle DOM updates with requestAnimationFrame
          if (!rafPending) {
            rafPending = true;
            requestAnimationFrame(() => {
              ModalUI.updateStreamingContent(fullText);
              rafPending = false;
            });
          }
        } else if (msg.type === 'done') {
          // Final render with full markdown
          ModalUI.updateStreamingContent(fullText, true);
          port.disconnect();
          resolve(fullText);
        } else if (msg.type === 'error') {
          port.disconnect();
          reject(new Error(msg.error));
        }
      });

      port.onDisconnect.addListener(() => {
        if (fullText) {
          resolve(fullText);
        } else {
          reject(new Error('Port disconnected before receiving any data'));
        }
      });

      port.postMessage(request);
    });
  }

  /**
   * Regenerate AI summary for a video
   * @param {string} videoId - YouTube video ID
   * @param {string} transcript - Raw transcript text
   * @returns {Promise<Object|null>} - New summary object or null on failure
   */
  static async regenerateSummary(videoId, transcript) {
    console.log(`[Orchestrator] Regenerating summary for video: ${videoId}`);

    if (!Utils.isChromeAPIAvailable()) {
      return null;
    }

    try {
      const isDark = ThemeDetector.isDarkMode();
      const aiResult = await this._processWithAI(transcript, isDark);

      if (aiResult) {
        // Update cache with new summary, clear chat history (stale context)
        const cachedData = await CacheManager.getCachedData(videoId);
        if (cachedData) {
          cachedData.summary = aiResult;
          cachedData.chatHistory = [];
          cachedData.timestamp = Date.now();
          await CacheManager.setCachedData(videoId, cachedData);
          console.log('[Orchestrator] Cache updated with regenerated summary');
        }

        return aiResult;
      }

      return null;
    } catch (error) {
      Utils.logError('Orchestrator.regenerateSummary', error, { videoId });
      return null;
    }
  }

  /**
   * Send a chat message about the video
   * @param {string} videoId - YouTube video ID
   * @param {string} userMessage - User's message
   * @returns {Promise<string|null>} - AI response or null on failure
   */
  static async sendChatMessage(videoId, userMessage) {
    console.log(`[Orchestrator] Sending chat message for video: ${videoId}`);

    if (!Utils.isChromeAPIAvailable()) {
      return null;
    }

    try {
      const settings = await chrome.storage.sync.get([
        'apiProvider', 'apiKey', 'model'
      ]);

      if (!settings.apiProvider || !settings.apiKey) {
        throw new Error('AI not configured');
      }

      // Get cached data for context
      const cachedData = await CacheManager.getCachedData(videoId);
      if (!cachedData) {
        throw new Error('No cached data for this video');
      }

      // Build context from summary or transcript
      const summaryText = cachedData.summary?.result || '';
      const contextText = summaryText || cachedData.transcript.raw.substring(0, YTE_CONSTANTS.CHAT_CONTEXT_CHAR_LIMIT);

      // Add user message to chat history
      ChatManager.addMessage(videoId, 'user', userMessage);

      // Build conversation payload
      const payload = ChatManager.getConversationPayload(videoId, contextText, settings.apiProvider);

      let response;
      if (settings.apiProvider === 'openai') {
        response = await chrome.runtime.sendMessage({
          action: 'chatOpenAI',
          apiKey: settings.apiKey,
          model: settings.model,
          messages: payload.messages
        });
      } else if (settings.apiProvider === 'claude') {
        response = await chrome.runtime.sendMessage({
          action: 'chatClaude',
          apiKey: settings.apiKey,
          model: settings.model,
          messages: payload.messages,
          system: payload.system
        });
      }

      if (response?.success) {
        // Add assistant response to history
        ChatManager.addMessage(videoId, 'assistant', response.result);

        // Update cache with chat history
        cachedData.chatHistory = ChatManager.getHistory(videoId);
        await CacheManager.setCachedData(videoId, cachedData);

        return response.result;
      } else {
        throw new Error(response?.error || 'Chat request failed');
      }
    } catch (error) {
      Utils.logError('Orchestrator.sendChatMessage', error, { videoId });
      throw error;
    }
  }

  /**
   * Display modal with data
   * @private
   * @param {Object} data - Data to display
   * @param {boolean} isDark - Dark mode flag
   */
  static _displayModal(data, isDark) {
    if (ModalUI.isOpen) {
      ModalUI.updateContent(data, isDark);
    } else {
      ModalUI.createModal(data, isDark);
    }
  }

  /**
   * Show error in modal
   * @param {string} message - Error message
   */
  static showError(message) {
    const isDark = ThemeDetector.isDarkMode();
    ModalUI.showError(message, isDark);
  }
}

// Export to window for global access
window.TranscriptOrchestrator = TranscriptOrchestrator;

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'openTranscriptModal') {
    console.log('[Orchestrator] Received openTranscriptModal message:', request);

    TranscriptOrchestrator.extractAndDisplay(request.videoId, request.source || 'extension-icon')
      .then(success => {
        sendResponse({ success: success });
      })
      .catch(error => {
        Utils.logError('Orchestrator.messageListener', error);
        sendResponse({ success: false, error: error.message });
      });

    return true; // Keep channel open for async response
  }
});
