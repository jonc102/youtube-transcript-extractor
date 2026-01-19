// Transcript Orchestrator for YouTube Transcript Extractor
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
        summary: null
      };

      // Step 6: Check if AI processing is configured
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
      // Call getTranscript from content.js
      // This function is defined in content.js and available globally
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
   * Process transcript with AI if configured
   * @private
   * @param {string} transcript - Raw transcript text
   * @param {boolean} isDark - Dark mode flag
   * @returns {Promise<Object|null>} - AI summary object or null
   */
  static async _processWithAI(transcript, isDark) {
    try {
      // Get AI settings from chrome.storage.sync
      const settings = await chrome.storage.sync.get([
        'apiProvider',
        'apiKey',
        'customPrompt',
        'model'
      ]);

      // Check if AI processing is configured
      if (!settings.apiProvider || !settings.apiKey || !settings.customPrompt) {
        console.log('[Orchestrator] AI processing not configured, skipping');
        return null;
      }

      console.log(`[Orchestrator] Processing with ${settings.apiProvider}...`);

      // Update modal to show processing status
      if (ModalUI.isOpen) {
        // Could add a processing indicator here in future
      }

      // Process transcript with AI using api.js
      let result;
      if (settings.apiProvider === 'openai') {
        const response = await chrome.runtime.sendMessage({
          action: 'callOpenAI',
          apiKey: settings.apiKey,
          model: settings.model,
          prompt: settings.customPrompt,
          transcript: transcript
        });

        if (response.success) {
          result = response.result;
        } else {
          throw new Error(response.error || 'OpenAI processing failed');
        }
      } else if (settings.apiProvider === 'claude') {
        const response = await chrome.runtime.sendMessage({
          action: 'callClaude',
          apiKey: settings.apiKey,
          model: settings.model,
          prompt: settings.customPrompt,
          transcript: transcript
        });

        if (response.success) {
          result = response.result;
        } else {
          throw new Error(response.error || 'Claude processing failed');
        }
      }

      if (result) {
        console.log('[Orchestrator] AI processing successful');
        return {
          provider: settings.apiProvider,
          model: settings.model,
          prompt: settings.customPrompt,
          result: result
        };
      }

      return null;

    } catch (error) {
      // Silently handle context invalidated errors
      if (Utils.isContextInvalidatedError(error)) {
        console.warn('[Orchestrator] Extension context invalidated. Skipping AI processing.');
        return null;
      }
      Utils.logError('Orchestrator._processWithAI', error);
      console.warn('[Orchestrator] AI processing failed, continuing without summary');
      // Silent fallback - don't show error to user
      return null;
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

    // Extract and display
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
