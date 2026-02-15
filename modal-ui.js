// Modal UI for YouTube Transcript Extractor
// Handles modal creation, display, and interactions

class ModalUI {
  static MODAL_ID = 'yte-transcript-modal';
  static OVERLAY_ID = 'yte-modal-overlay';
  static isOpen = false;
  static currentData = null;
  static currentVideoId = null; // Track which video the modal is showing
  static escapeHandler = null;
  static isRegenerating = false; // Prevent double-click during regeneration
  static isMinimized = false;
  static minimizedState = null;

  /**
   * Create and display modal with transcript/summary data
   * @param {Object} data - Data to display
   * @param {string} data.videoId - Video ID
   * @param {string} data.videoTitle - Video title
   * @param {Object} data.transcript - Transcript data {raw, segments}
   * @param {Object|null} data.summary - AI summary data {provider, model, result}
   * @param {boolean} isDark - Dark mode flag
   */
  static createModal(data, isDark) {
    // Close existing modal if open
    if (this.isOpen) {
      this.close();
    }

    this.currentData = data;
    this.currentVideoId = data.videoId; // Store the videoId

    // Create modal container
    const modal = document.createElement('div');
    modal.id = this.MODAL_ID;
    modal.className = `yte-modal ${isDark ? 'yte-dark' : 'yte-light'}`;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-labelledby', 'yte-modal-title');
    modal.setAttribute('aria-modal', 'true');

    // Build modal structure
    modal.innerHTML = this._buildModalHTML(data);

    document.body.appendChild(modal);

    this._attachEventListeners(modal, data);
    this.isOpen = true;

    // Hide FAB when modal is open
    if (window.ytExtensionInjector) {
      window.ytExtensionInjector._hideButton();
    }

    // Focus on close button for keyboard accessibility
    setTimeout(() => {
      const closeBtn = modal.querySelector('.yte-modal-close');
      if (closeBtn) closeBtn.focus();
    }, 100);

    console.log('[ModalUI] Modal opened for video:', data.videoId);
  }

  /**
   * Build modal HTML structure
   * @private
   * @param {Object} data - Data to display
   * @returns {string} - HTML string
   */
  static _buildModalHTML(data) {
    const hasSummary = data.summary && data.summary.result;
    const summaryLabel = hasSummary ? this._getSummaryLabel(data.summary) : '';

    return `
      <div class="yte-modal-header">
        <h2 id="yte-modal-title">Transcript${hasSummary ? ' & Summary' : ''}</h2>
        <div class="yte-modal-header-actions">
          <button class="yte-modal-settings" aria-label="Open settings"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z"/></svg></button>
          <button class="yte-modal-minimize" aria-label="Minimize modal">&minus;</button>
          <button class="yte-modal-close" aria-label="Close transcript modal">&times;</button>
        </div>
      </div>

      <div class="yte-modal-tabs">
        <div class="yte-modal-tabs-container" role="tablist">
          <button class="yte-tab-btn ${hasSummary ? '' : 'yte-active'}" data-tab="transcript" role="tab" aria-selected="${hasSummary ? 'false' : 'true'}" aria-controls="yte-tab-transcript">
            Transcript
          </button>
          ${hasSummary ? `
            <button class="yte-tab-btn yte-active" data-tab="summary" role="tab" aria-selected="true" aria-controls="yte-tab-summary">
              Summary ${summaryLabel ? '(' + summaryLabel + ')' : ''}
            </button>
          ` : ''}
        </div>
      </div>

      <div class="yte-modal-content">
        <div class="yte-tab-content ${hasSummary ? '' : 'yte-active'}" id="yte-tab-transcript" role="tabpanel" aria-labelledby="tab-transcript">
          <pre class="yte-transcript-text">${Utils.escapeHtml(data.transcript.raw)}</pre>
        </div>
        ${hasSummary ? `
          <div class="yte-tab-content yte-active" id="yte-tab-summary" role="tabpanel" aria-labelledby="tab-summary">
            <div class="yte-summary-text">${Utils.markdownToHtml(data.summary.result)}</div>
            <div class="yte-chat-separator"></div>
            ${this._buildChatHTML(data)}
          </div>
        ` : ''}
      </div>

      <div class="yte-modal-footer">
        <button class="yte-btn yte-btn-regenerate" data-action="regenerate">
          ${hasSummary ? 'Regenerate' : 'Generate Summary'}
        </button>
        <button class="yte-btn yte-btn-primary" data-action="copy-transcript">Copy Transcript</button>
        ${hasSummary ? `
          <button class="yte-btn yte-btn-secondary" data-action="copy-summary">Copy Summary</button>
        ` : ''}
      </div>
    `;
  }

  /**
   * Get summary label for tab
   * @private
   * @param {Object} summary - Summary object
   * @returns {string} - Label text
   */
  static _getSummaryLabel(summary) {
    if (summary.model) {
      const modelLower = summary.model.toLowerCase();

      // GPT-5 models (frontier)
      if (modelLower.startsWith('gpt-5')) {
        if (modelLower.includes('nano')) return 'GPT-5 Nano';
        if (modelLower.includes('mini')) return 'GPT-5 Mini';
        return 'GPT-5';
      }

      // ChatGPT-4o models
      if (modelLower.startsWith('chatgpt-4o')) {
        return 'ChatGPT-4o';
      }

      // GPT-4o models
      if (modelLower.includes('4o')) {
        if (modelLower.includes('mini')) return 'GPT-4o Mini';
        return 'GPT-4o';
      }

      // O1 models
      if (modelLower.includes('o1')) {
        if (modelLower.includes('mini')) return 'O1 Mini';
        if (modelLower.includes('preview')) return 'O1 Preview';
        return 'O1';
      }

      // GPT-4 models (legacy)
      if (modelLower.startsWith('gpt-4')) {
        if (modelLower.includes('turbo')) return 'GPT-4 Turbo';
        return 'GPT-4';
      }

      // GPT-3.5 models (legacy)
      if (modelLower.startsWith('gpt-3.5')) {
        return 'GPT-3.5';
      }

      // Claude models
      if (modelLower.includes('claude')) {
        if (modelLower.includes('opus')) return 'Claude Opus';
        if (modelLower.includes('sonnet')) return 'Claude Sonnet';
        if (modelLower.includes('haiku')) return 'Claude Haiku';
        return 'Claude';
      }

      // Fallback: capitalize first word
      return summary.model.split('-')[0].toUpperCase();
    }

    // Fallback to provider name
    return summary.provider ? summary.provider.toUpperCase() : 'AI';
  }

  /**
   * Attach event listeners to modal elements
   * @private
   * @param {HTMLElement} modal - Modal element
   * @param {Object} data - Data object
   */
  static _attachEventListeners(modal, data) {
    // Close button
    const closeBtn = modal.querySelector('.yte-modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    // Settings button
    const settingsBtn = modal.querySelector('.yte-modal-settings');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'openSettings' }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('[ModalUI] Failed to open settings:', chrome.runtime.lastError);
          } else {
            console.log('[ModalUI] Settings page opened in new tab');
          }
        });
      });
    }

    // Minimize button
    const minimizeBtn = modal.querySelector('.yte-modal-minimize');
    if (minimizeBtn) {
      minimizeBtn.addEventListener('click', () => this.minimize());
    }

    // Escape key to close
    this.escapeHandler = (e) => {
      if (e.key === 'Escape') {
        this.close();
      }
    };
    document.addEventListener('keydown', this.escapeHandler);

    // Tab switching
    const tabButtons = modal.querySelectorAll('.yte-tab-btn');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => this._switchTab(btn.dataset.tab));
    });

    // Copy buttons
    const copyTranscriptBtn = modal.querySelector('[data-action="copy-transcript"]');
    if (copyTranscriptBtn) {
      copyTranscriptBtn.addEventListener('click', () => {
        this._copyToClipboard(data.transcript.raw, 'Transcript copied!', 'transcript');
      });
    }

    const copySummaryBtn = modal.querySelector('[data-action="copy-summary"]');
    if (copySummaryBtn) {
      copySummaryBtn.addEventListener('click', () => {
        this._copyToClipboard(data.summary.result, 'Summary copied!', 'summary');
      });
    }

    // Regenerate button
    const regenerateBtn = modal.querySelector('[data-action="regenerate"]');
    if (regenerateBtn) {
      regenerateBtn.addEventListener('click', () => this._handleRegenerate(data));
      this._checkAIConfigAndUpdateButton(modal);
    }

    // Chat listeners
    this._attachChatListeners(modal, data);
  }

  /**
   * Switch active tab
   * @private
   * @param {string} tabName - Tab identifier ('transcript' or 'summary')
   */
  static _switchTab(tabName) {
    const modal = document.getElementById(this.MODAL_ID);
    if (!modal) return;

    // Update button states
    const buttons = modal.querySelectorAll('.yte-tab-btn');
    buttons.forEach(btn => {
      const isActive = btn.dataset.tab === tabName;
      btn.classList.toggle('yte-active', isActive);
      btn.setAttribute('aria-selected', isActive.toString());
    });

    // Update content visibility
    const contents = modal.querySelectorAll('.yte-tab-content');
    contents.forEach(content => {
      const isActive = content.id === `yte-tab-${tabName}`;
      content.classList.toggle('yte-active', isActive);
    });

    console.log(`[ModalUI] Switched to tab: ${tabName}`);
  }

  /**
   * Copy text to clipboard with rich text support
   * @private
   * @param {string} text - Text to copy
   * @param {string} message - Success message
   * @param {string} type - Content type ('transcript' or 'summary')
   */
  static async _copyToClipboard(text, message, type = 'transcript') {
    try {
      if (type === 'summary') {
        // Convert markdown to HTML for rich text support
        const html = Utils.markdownToHtml(text);
        await Utils.copyRichText(text, html);
      } else {
        // Transcript: copy as plain text only
        await Utils.copyRichText(text);
      }

      this._showToast(message, 'success');
      console.log(`[ModalUI] Copied ${type} to clipboard: ${text.length} chars`);
    } catch (err) {
      Utils.logError('ModalUI._copyToClipboard', err);
      this._showToast('Copy failed. Please try again.', 'error');
    }
  }

  /**
   * Handle regenerate button click
   * @private
   * @param {Object} data - Current modal data
   */
  static async _handleRegenerate(data) {
    // Prevent double-click
    if (this.isRegenerating) {
      console.log('[ModalUI] Already regenerating, ignoring click');
      return;
    }

    // Check Chrome API availability
    if (!Utils.isChromeAPIAvailable()) {
      this._showToast('Extension was reloaded. Please refresh the page.', 'error');
      return;
    }

    // Check AI configuration
    try {
      const settings = await chrome.storage.sync.get(['apiProvider', 'apiKey', 'customPrompt', 'model']);
      if (!settings.apiProvider || !settings.apiKey || !settings.customPrompt) {
        this._showToast('Please configure AI settings first.', 'info');
        return;
      }

      // Set regenerating state
      this.isRegenerating = true;
      this._updateRegenerateButton(true);

      console.log('[ModalUI] Starting regeneration...');

      // Call regenerateSummary
      const newSummary = await TranscriptOrchestrator.regenerateSummary(
        data.videoId,
        data.transcript.raw
      );

      if (newSummary) {
        // Update current data - clear chat history (stale context)
        this.currentData.summary = newSummary;
        this.currentData.chatHistory = [];
        if (this.currentData.videoId) {
          ChatManager.clearHistory(this.currentData.videoId);
        }

        // Update modal content
        const modal = document.getElementById(this.MODAL_ID);
        const isDark = modal.classList.contains('yte-dark');

        if (modal) {
          modal.innerHTML = this._buildModalHTML(this.currentData);
          this._attachEventListeners(modal, this.currentData);

          // Switch to summary tab
          this._switchTab('summary');
        }

        this._showToast('Summary regenerated!', 'success');
        console.log('[ModalUI] Summary regenerated successfully');
      } else {
        this._showToast('Failed to regenerate summary.', 'error');
        console.error('[ModalUI] Regeneration failed');
      }
    } catch (error) {
      Utils.logError('ModalUI._handleRegenerate', error);
      this._showToast('Failed to regenerate summary.', 'error');
    } finally {
      this.isRegenerating = false;
      this._updateRegenerateButton(false);
    }
  }

  /**
   * Update regenerate button state
   * @private
   * @param {boolean} isLoading - Whether regeneration is in progress
   */
  static _updateRegenerateButton(isLoading) {
    const modal = document.getElementById(this.MODAL_ID);
    if (!modal) return;

    const regenerateBtn = modal.querySelector('[data-action="regenerate"]');
    if (!regenerateBtn) return;

    if (isLoading) {
      regenerateBtn.disabled = true;
      regenerateBtn.classList.add('yte-regenerating');
      regenerateBtn.innerHTML = 'Regenerating...';
    } else {
      regenerateBtn.disabled = false;
      regenerateBtn.classList.remove('yte-regenerating');
      const hasSummary = this.currentData && this.currentData.summary && this.currentData.summary.result;
      regenerateBtn.innerHTML = hasSummary ? 'Regenerate' : 'Generate Summary';
    }
  }

  /**
   * Check AI configuration and update button visibility/state
   * @private
   * @param {HTMLElement} modal - Modal element
   */
  static async _checkAIConfigAndUpdateButton(modal) {
    const regenerateBtn = modal.querySelector('[data-action="regenerate"]');
    if (!regenerateBtn) return;

    // Check if Chrome APIs are available
    if (!Utils.isChromeAPIAvailable()) {
      regenerateBtn.style.display = 'none';
      return;
    }

    try {
      const settings = await chrome.storage.sync.get(['apiProvider', 'apiKey', 'customPrompt']);
      const isAIConfigured = settings.apiProvider && settings.apiKey && settings.customPrompt;
      const hasSummary = this.currentData && this.currentData.summary && this.currentData.summary.result;

      if (!isAIConfigured && !hasSummary) {
        // No AI config and no summary - hide button
        regenerateBtn.style.display = 'none';
      } else if (!isAIConfigured && hasSummary) {
        // Has summary but no AI config - disable with tooltip
        regenerateBtn.disabled = true;
        regenerateBtn.title = 'Configure AI settings to regenerate';
      } else {
        // AI configured - enable button
        regenerateBtn.disabled = false;
        regenerateBtn.style.display = '';
        regenerateBtn.title = '';
      }
    } catch (error) {
      // If we can't check settings, hide the button
      regenerateBtn.style.display = 'none';
    }
  }

  /**
   * Build chat HTML for the summary tab
   * @private
   * @param {Object} data - Modal data
   * @returns {string} - Chat HTML string
   */
  static _buildChatHTML(data) {
    const hasSummary = data.summary && data.summary.result;
    const chatHistory = data.chatHistory || [];

    // Load chat history into ChatManager if available
    if (data.videoId && chatHistory.length > 0) {
      ChatManager.loadHistory(data.videoId, chatHistory);
    }

    if (!hasSummary) {
      return `
        <div class="yte-chat-area">
          <div class="yte-chat-input-row">
            <input type="text" class="yte-chat-input" placeholder="Generate a summary first to start chatting" disabled>
            <button class="yte-chat-send" disabled aria-label="Send message">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
            </button>
          </div>
        </div>
      `;
    }

    // Build message bubbles from history
    let bubblesHTML = '';
    for (const msg of chatHistory) {
      const isUser = msg.role === 'user';
      const bubbleClass = isUser ? 'yte-chat-bubble-user' : 'yte-chat-bubble-assistant';
      const content = isUser ? Utils.escapeHtml(msg.content) : Utils.markdownToHtml(msg.content);
      bubblesHTML += `<div class="yte-chat-bubble ${bubbleClass}">${content}</div>`;
    }

    const hasMessages = chatHistory.length > 0;

    return `
      <div class="yte-chat-area">
        ${hasMessages ? `<button class="yte-chat-clear">Clear chat</button>` : ''}
        <div class="yte-chat-messages">${bubblesHTML}</div>
        <div class="yte-chat-input-row">
          <input type="text" class="yte-chat-input" placeholder="Ask about this video...">
          <button class="yte-chat-send" aria-label="Send message">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Append a single chat message bubble without full re-render
   * @private
   * @param {string} role - Message role ('user' or 'assistant')
   * @param {string} content - Message content
   */
  static _appendChatMessage(role, content) {
    const modal = document.getElementById(this.MODAL_ID);
    if (!modal) return;

    const messagesContainer = modal.querySelector('.yte-chat-messages');
    if (!messagesContainer) return;

    const bubble = document.createElement('div');
    const isUser = role === 'user';
    bubble.className = `yte-chat-bubble ${isUser ? 'yte-chat-bubble-user' : 'yte-chat-bubble-assistant'}`;
    bubble.innerHTML = isUser ? Utils.escapeHtml(content) : Utils.markdownToHtml(content);
    messagesContainer.appendChild(bubble);

    // Auto-scroll to newest message
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Show clear button if not already visible
    const chatArea = modal.querySelector('.yte-chat-area');
    if (chatArea && !chatArea.querySelector('.yte-chat-clear')) {
      const clearBtn = document.createElement('button');
      clearBtn.className = 'yte-chat-clear';
      clearBtn.textContent = 'Clear chat';
      clearBtn.addEventListener('click', () => this._handleChatClear());
      chatArea.insertBefore(clearBtn, chatArea.firstChild);
    }
  }

  /**
   * Show typing indicator in chat
   * @private
   */
  static _showTypingIndicator() {
    const modal = document.getElementById(this.MODAL_ID);
    if (!modal) return;

    const messagesContainer = modal.querySelector('.yte-chat-messages');
    if (!messagesContainer) return;

    // Remove existing indicator
    const existing = messagesContainer.querySelector('.yte-chat-typing');
    if (existing) existing.remove();

    const indicator = document.createElement('div');
    indicator.className = 'yte-chat-bubble yte-chat-bubble-assistant yte-chat-typing';
    indicator.innerHTML = '<span class="yte-typing-dot"></span><span class="yte-typing-dot"></span><span class="yte-typing-dot"></span>';
    messagesContainer.appendChild(indicator);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  /**
   * Remove typing indicator
   * @private
   */
  static _removeTypingIndicator() {
    const modal = document.getElementById(this.MODAL_ID);
    if (!modal) return;

    const indicator = modal.querySelector('.yte-chat-typing');
    if (indicator) indicator.remove();
  }

  /**
   * Handle sending a chat message
   * @private
   * @param {Object} data - Current modal data
   */
  static async _handleChatSend(data) {
    const modal = document.getElementById(this.MODAL_ID);
    if (!modal || !data.videoId) return;

    const input = modal.querySelector('.yte-chat-input');
    if (!input || !input.value.trim()) return;

    const message = input.value.trim();
    input.value = '';
    input.disabled = true;

    // Append user message
    this._appendChatMessage('user', message);

    // Show typing indicator
    this._showTypingIndicator();

    try {
      const response = await TranscriptOrchestrator.sendChatMessage(data.videoId, message);

      this._removeTypingIndicator();

      if (response) {
        this._appendChatMessage('assistant', response);
      } else {
        this._appendChatMessage('assistant', 'Sorry, I could not generate a response.');
      }
    } catch (error) {
      this._removeTypingIndicator();
      this._showToast('Chat failed: ' + error.message, 'error');
    } finally {
      input.disabled = false;
      input.focus();
    }
  }

  /**
   * Handle clearing chat history
   * @private
   */
  static async _handleChatClear() {
    if (!this.currentData?.videoId) return;

    ChatManager.clearHistory(this.currentData.videoId);

    // Update cache
    try {
      const cachedData = await CacheManager.getCachedData(this.currentData.videoId);
      if (cachedData) {
        cachedData.chatHistory = [];
        await CacheManager.setCachedData(this.currentData.videoId, cachedData);
      }
    } catch (e) {
      // Silently handle
    }

    // Update current data
    this.currentData.chatHistory = [];

    // Re-render chat area
    const modal = document.getElementById(this.MODAL_ID);
    if (modal) {
      const chatArea = modal.querySelector('.yte-chat-area');
      if (chatArea) {
        const summaryTab = modal.querySelector('#yte-tab-summary');
        if (summaryTab) {
          // Remove old chat area and separator, rebuild
          const separator = summaryTab.querySelector('.yte-chat-separator');
          if (separator) separator.remove();
          chatArea.remove();

          const newSeparator = document.createElement('div');
          newSeparator.className = 'yte-chat-separator';
          summaryTab.appendChild(newSeparator);

          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = this._buildChatHTML(this.currentData);
          const newChatArea = tempDiv.firstElementChild;
          summaryTab.appendChild(newChatArea);

          // Re-attach chat listeners
          this._attachChatListeners(modal, this.currentData);
        }
      }
    }

    this._showToast('Chat cleared', 'success');
  }

  /**
   * Attach chat-specific event listeners
   * @private
   * @param {HTMLElement} modal - Modal element
   * @param {Object} data - Data object
   */
  static _attachChatListeners(modal, data) {
    // Send button
    const sendBtn = modal.querySelector('.yte-chat-send');
    if (sendBtn && !sendBtn.disabled) {
      sendBtn.addEventListener('click', () => this._handleChatSend(data));
    }

    // Enter key on input
    const chatInput = modal.querySelector('.yte-chat-input');
    if (chatInput && !chatInput.disabled) {
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this._handleChatSend(data);
        }
      });
    }

    // Clear button
    const clearBtn = modal.querySelector('.yte-chat-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this._handleChatClear());
    }
  }

  /**
   * Show toast notification
   * @private
   * @param {string} message - Toast message
   * @param {string} type - Toast type ('success', 'error', 'info')
   */
  static _showToast(message, type = 'success') {
    // Remove existing toast if present
    const existingToast = document.querySelector('.yte-toast');
    if (existingToast) {
      existingToast.remove();
    }

    // Create new toast
    const toast = document.createElement('div');
    toast.className = `yte-toast yte-toast-${type}`;
    toast.textContent = message;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add('yte-show'), 10);

    // Auto-remove after toast duration
    const duration = typeof YTE_CONSTANTS !== 'undefined' ? YTE_CONSTANTS.TOAST_DURATION : 2000;
    setTimeout(() => {
      toast.classList.remove('yte-show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /**
   * Update streaming content in the summary tab progressively
   * @param {string} partialText - Current accumulated text
   * @param {boolean} isFinal - Whether this is the final render
   */
  static updateStreamingContent(partialText, isFinal = false) {
    const modal = document.getElementById(this.MODAL_ID);
    if (!modal) return;

    // Find or create summary tab content
    let summaryTab = modal.querySelector('#yte-tab-summary');
    if (!summaryTab) {
      // If no summary tab yet (e.g. loading state), create the full modal structure
      // This happens when streaming starts before initial modal is built
      const content = modal.querySelector('.yte-modal-content');
      if (!content) return;

      // Check if we're in loading state
      const loading = content.querySelector('.yte-loading');
      if (loading) {
        // Replace loading with streaming content
        content.innerHTML = `
          <div class="yte-tab-content yte-active" id="yte-tab-summary" role="tabpanel">
            <div class="yte-summary-text yte-streaming"></div>
          </div>
        `;
        summaryTab = content.querySelector('#yte-tab-summary');
      }
    }

    if (!summaryTab) return;

    const summaryText = summaryTab.querySelector('.yte-summary-text');
    if (!summaryText) return;

    if (isFinal) {
      // Final render: full markdown conversion
      summaryText.innerHTML = Utils.markdownToHtml(partialText);
      summaryText.classList.remove('yte-streaming');
    } else {
      // Progressive render: escaped text with blinking cursor
      summaryText.innerHTML = Utils.escapeHtml(partialText) + '<span class="yte-stream-cursor">|</span>';
      summaryText.classList.add('yte-streaming');
    }

    // Auto-scroll to bottom
    const contentArea = modal.querySelector('.yte-modal-content');
    if (contentArea) {
      contentArea.scrollTop = contentArea.scrollHeight;
    }
  }

  /**
   * Update modal content with new data
   * @param {Object} data - New data
   * @param {boolean} isDark - Dark mode flag
   */
  static updateContent(data, isDark) {
    if (!this.isOpen) {
      this.createModal(data, isDark);
      return;
    }

    // Check if this is for a different video
    if (this.currentVideoId && data.videoId && this.currentVideoId !== data.videoId) {
      console.log(`[ModalUI] VideoId changed from ${this.currentVideoId} to ${data.videoId}, recreating modal`);
      this.close(); // Close old modal
      this.createModal(data, isDark); // Create new modal for new video
      return;
    }

    const modal = document.getElementById(this.MODAL_ID);
    if (!modal) {
      this.createModal(data, isDark);
      return;
    }

    // Update modal HTML (same video, just refresh content)
    modal.innerHTML = this._buildModalHTML(data);

    // Re-attach event listeners
    this._attachEventListeners(modal, data);

    this.currentData = data;
    this.currentVideoId = data.videoId; // Update tracked videoId
    console.log('[ModalUI] Modal content updated');
  }

  /**
   * Minimize modal to a small pill
   */
  static minimize() {
    const modal = document.getElementById(this.MODAL_ID);
    if (!modal || this.isMinimized) return;

    // Save current state
    const activeTab = modal.querySelector('.yte-tab-btn.yte-active');
    const content = modal.querySelector('.yte-modal-content');
    this.minimizedState = {
      activeTab: activeTab ? activeTab.dataset.tab : 'transcript',
      scrollTop: content ? content.scrollTop : 0
    };

    // Build minimized pill content
    const title = this.currentData?.videoTitle || 'Transcript';
    const truncatedTitle = title.length > 25 ? title.substring(0, 25) + '...' : title;

    modal.classList.add('yte-minimized');
    modal.innerHTML = `
      <div class="yte-minimized-content">
        <span class="yte-minimized-title">${Utils.escapeHtml(truncatedTitle)}</span>
        <div class="yte-minimized-actions">
          <button class="yte-minimized-expand" aria-label="Expand modal">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
          </button>
          <button class="yte-minimized-close" aria-label="Close">&times;</button>
        </div>
      </div>
    `;

    // Attach minimized event listeners
    modal.querySelector('.yte-minimized-expand').addEventListener('click', () => this.expand());
    modal.querySelector('.yte-minimized-close').addEventListener('click', () => this.close());

    this.isMinimized = true;
    console.log('[ModalUI] Modal minimized');
  }

  /**
   * Expand modal from minimized state
   */
  static expand() {
    const modal = document.getElementById(this.MODAL_ID);
    if (!modal || !this.isMinimized || !this.currentData) return;

    modal.classList.remove('yte-minimized');

    // Rebuild full modal content
    modal.innerHTML = this._buildModalHTML(this.currentData);
    this._attachEventListeners(modal, this.currentData);

    // Restore saved state
    if (this.minimizedState) {
      this._switchTab(this.minimizedState.activeTab);
      const content = modal.querySelector('.yte-modal-content');
      if (content && this.minimizedState.scrollTop) {
        content.scrollTop = this.minimizedState.scrollTop;
      }
    }

    this.isMinimized = false;
    this.minimizedState = null;
    console.log('[ModalUI] Modal expanded');
  }

  /**
   * Close modal and cleanup
   */
  static close() {
    const modal = document.getElementById(this.MODAL_ID);
    if (modal) {
      modal.remove();
    }

    // Remove escape key listener
    if (this.escapeHandler) {
      document.removeEventListener('keydown', this.escapeHandler);
      this.escapeHandler = null;
    }

    this.isOpen = false;
    this.currentData = null;
    this.currentVideoId = null;
    this.isRegenerating = false;
    this.isMinimized = false;
    this.minimizedState = null;

    // Show FAB again when modal closes
    if (window.ytExtensionInjector) {
      window.ytExtensionInjector.showButton();
    }

    console.log('[ModalUI] Modal closed');
  }

  /**
   * Show error modal
   * @param {string} errorMessage - Error message to display
   * @param {boolean} isDark - Dark mode flag
   */
  static showError(errorMessage, isDark) {
    const errorData = {
      videoId: null,
      videoTitle: 'Error',
      transcript: {
        raw: `Error: ${errorMessage}\n\nPlease try again or check that the video has captions available.`,
        segments: []
      },
      summary: null
    };

    this.createModal(errorData, isDark);
  }

  /**
   * Show loading modal
   * @param {boolean} isDark - Dark mode flag
   */
  static showLoading(isDark) {
    // Create modal with loading spinner
    const modal = document.createElement('div');
    modal.id = this.MODAL_ID;
    modal.className = `yte-modal ${isDark ? 'yte-dark' : 'yte-light'}`;

    modal.innerHTML = `
      <div class="yte-modal-header">
        <h2>Extracting Transcript...</h2>
        <button class="yte-modal-close" aria-label="Close">&times;</button>
      </div>
      <div class="yte-modal-content">
        <div class="yte-loading">
          <div class="yte-spinner"></div>
          <span>Loading transcript data...</span>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Close button
    const closeBtn = modal.querySelector('.yte-modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    this.isOpen = true;
  }
}

// Export to window for global access
window.ModalUI = ModalUI;
