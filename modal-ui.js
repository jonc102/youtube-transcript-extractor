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
        <h2 id="yte-modal-title">📄 Transcript${hasSummary ? ' & Summary' : ''}</h2>
        <div class="yte-modal-header-actions">
          <button class="yte-modal-settings" aria-label="Open settings">⚙️</button>
          <button class="yte-modal-close" aria-label="Close transcript modal">&times;</button>
        </div>
      </div>

      <div class="yte-modal-tabs">
        <button class="yte-tab-btn ${hasSummary ? '' : 'yte-active'}" data-tab="transcript" role="tab" aria-selected="${hasSummary ? 'false' : 'true'}" aria-controls="yte-tab-transcript">
          Transcript
        </button>
        ${hasSummary ? `
          <button class="yte-tab-btn yte-active" data-tab="summary" role="tab" aria-selected="true" aria-controls="yte-tab-summary">
            AI Summary ✨ ${summaryLabel}
          </button>
        ` : ''}
      </div>

      <div class="yte-modal-content">
        <div class="yte-tab-content ${hasSummary ? '' : 'yte-active'}" id="yte-tab-transcript" role="tabpanel" aria-labelledby="tab-transcript">
          <pre class="yte-transcript-text">${Utils.escapeHtml(data.transcript.raw)}</pre>
        </div>
        ${hasSummary ? `
          <div class="yte-tab-content yte-active" id="yte-tab-summary" role="tabpanel" aria-labelledby="tab-summary">
            <div class="yte-summary-text">${Utils.markdownToHtml(data.summary.result)}</div>
          </div>
        ` : ''}
      </div>

      <div class="yte-modal-footer">
        <button class="yte-btn yte-btn-regenerate" data-action="regenerate">
          ${hasSummary ? '🔄 Regenerate' : '✨ Generate Summary'}
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
        // Send message to background script to open settings
        // This avoids Arc Browser blocking window.open() for chrome-extension:// URLs
        chrome.runtime.sendMessage({ action: 'openSettings' }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('[ModalUI] Failed to open settings:', chrome.runtime.lastError);
          } else {
            console.log('[ModalUI] Settings page opened in new tab');
          }
        });
      });
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
      // Check AI config and update button state
      this._checkAIConfigAndUpdateButton(modal);
    }
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
        // Update current data
        this.currentData.summary = newSummary;

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
      regenerateBtn.innerHTML = '⏳ Regenerating...';
    } else {
      regenerateBtn.disabled = false;
      regenerateBtn.classList.remove('yte-regenerating');
      const hasSummary = this.currentData && this.currentData.summary && this.currentData.summary.result;
      regenerateBtn.innerHTML = hasSummary ? '🔄 Regenerate' : '✨ Generate Summary';
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

    // Auto-remove after 2 seconds
    setTimeout(() => {
      toast.classList.remove('yte-show');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
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
    this.currentVideoId = null; // Clear tracked videoId
    this.isRegenerating = false; // Reset regeneration state
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
        <h2>🤖 Teaching AI to Watch YouTube...</h2>
        <button class="yte-modal-close" aria-label="Close">&times;</button>
      </div>
      <div class="yte-modal-content">
        <div class="yte-loading">
          <div class="yte-spinner"></div>
          <span>Showing AI how to binge-watch (it learns fast, promise!)</span>
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
