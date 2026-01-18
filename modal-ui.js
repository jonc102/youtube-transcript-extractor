// Modal UI for YouTube Transcript Extractor
// Handles modal creation, display, and interactions

class ModalUI {
  static MODAL_ID = 'yte-transcript-modal';
  static OVERLAY_ID = 'yte-modal-overlay';
  static isOpen = false;
  static currentData = null;
  static escapeHandler = null;

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
      // Extract model name (e.g., "gpt-4o" from "gpt-4o-2024-08-06")
      const modelName = summary.model.split('-')[0] + (summary.model.includes('4') ? '-4' : '-3.5');
      return modelName.toUpperCase();
    }
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
        const settingsUrl = chrome.runtime.getURL('settings.html');
        window.open(settingsUrl, '_blank');
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
        this._copyToClipboard(data.transcript.raw, 'Transcript copied!');
      });
    }

    const copySummaryBtn = modal.querySelector('[data-action="copy-summary"]');
    if (copySummaryBtn) {
      copySummaryBtn.addEventListener('click', () => {
        this._copyToClipboard(data.summary.result, 'Summary copied!');
      });
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
   * Copy text to clipboard
   * @private
   * @param {string} text - Text to copy
   * @param {string} message - Success message
   */
  static async _copyToClipboard(text, message) {
    try {
      await navigator.clipboard.writeText(text);
      this._showToast(message, 'success');
      console.log(`[ModalUI] Copied to clipboard: ${text.length} chars`);
    } catch (err) {
      Utils.logError('ModalUI._copyToClipboard', err);
      this._showToast('Copy failed. Please try again.', 'error');
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

    const modal = document.getElementById(this.MODAL_ID);
    if (!modal) {
      this.createModal(data, isDark);
      return;
    }

    // Update modal HTML
    modal.innerHTML = this._buildModalHTML(data);

    // Re-attach event listeners
    this._attachEventListeners(modal, data);

    this.currentData = data;
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
        <h2>⏳ Extracting Transcript...</h2>
        <button class="yte-modal-close" aria-label="Close">&times;</button>
      </div>
      <div class="yte-modal-content">
        <div class="yte-loading">
          <div class="yte-spinner"></div>
          <span>Extracting transcript from YouTube...</span>
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
