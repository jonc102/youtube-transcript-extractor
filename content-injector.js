// Content Injector for YouTube Transcript Extractor
// Injects floating FAB (Floating Action Button) on YouTube video pages

class ContentInjector {
  constructor() {
    this.button = null;
    this.lastVideoId = null;
    this.isDesktop = Utils.isDesktop();

    // Only inject on desktop
    if (this.isDesktop) {
      this.init();
    } else {
      console.log('[ContentInjector] Mobile detected, skipping FAB injection');
    }
  }

  /**
   * Initialize injector
   */
  init() {
    this.injectButton();

    // Watch for YouTube SPA navigation
    this.observeNavigation();

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => this.destroy());

    console.log('[ContentInjector] Initialized');
  }

  /**
   * Observe YouTube SPA navigation events
   */
  observeNavigation() {
    window.addEventListener('yt-navigate-finish', () => {
      console.log('[ContentInjector] YouTube navigation detected');

      // Close any open or minimized modal when navigating away
      if (window.ModalUI && (ModalUI.isOpen || ModalUI.isMinimized)) {
        console.log('[ContentInjector] Closing modal due to navigation');
        ModalUI.close();
      }

      if (Utils.isVideoPage()) {
        this.injectButton();
      } else {
        this.removeButton();
      }
    });
  }

  /**
   * Inject floating FAB button
   */
  async injectButton() {
    if (!Utils.isVideoPage()) {
      return;
    }

    const videoId = Utils.getCurrentVideoId();
    if (!videoId) {
      return;
    }

    // If button exists for different video, remove and recreate
    if (this.button && this.lastVideoId && this.lastVideoId !== videoId) {
      this.removeButton();
    }

    this.lastVideoId = videoId;

    // Don't inject if button already exists for this video
    if (this.button && document.body.contains(this.button)) {
      return;
    }

    // Check if cached
    let isCached = false;
    try {
      isCached = await CacheManager.isCacheValid(videoId);
    } catch (error) {
      if (Utils.isContextInvalidatedError(error)) {
        console.warn('[ContentInjector] Extension context invalidated.');
      }
    }

    // Remove old button if it exists
    this.removeButton();

    // Create FAB
    this.button = document.createElement('button');
    this.button.id = 'yte-transcript-button';
    this.button.className = 'yte-fab';
    this.button.setAttribute('aria-label', isCached ? 'View cached transcript' : 'Get transcript of video');

    // Build inner HTML with extension icon + text
    const iconUrl = typeof chrome !== 'undefined' && chrome.runtime ? chrome.runtime.getURL('icon16.png') : '';
    const labelText = isCached ? 'View Transcript' : 'Get Transcript';
    this.button.innerHTML = `${iconUrl ? `<img src="${iconUrl}" alt="" width="16" height="16" class="yte-fab-icon">` : ''}<span class="yte-fab-label">${labelText}</span>`;

    // Apply inline styles for FAB
    this._styleFAB();

    // Attach click handler
    this.button.addEventListener('click', () => this._handleButtonClick());

    // Append to body (fixed position)
    document.body.appendChild(this.button);

    console.log(`[ContentInjector] FAB injected for video: ${videoId} (cached: ${isCached})`);
  }

  /**
   * Style FAB as floating purple pill
   * @private
   */
  _styleFAB() {
    Object.assign(this.button.style, {
      position: 'fixed',
      bottom: '90px',
      right: '24px',
      zIndex: '999998',
      padding: '10px 18px',
      fontSize: '14px',
      fontWeight: '600',
      border: 'none',
      borderRadius: '100px',
      background: '#6C5CE7',
      color: '#ffffff',
      cursor: 'pointer',
      transition: 'transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      boxShadow: '0 4px 16px rgba(108, 92, 231, 0.35)',
      whiteSpace: 'nowrap'
    });

    // Hover: scale up + enhanced shadow
    this.button.addEventListener('mouseenter', () => {
      this.button.style.transform = 'scale(1.05)';
      this.button.style.boxShadow = '0 6px 24px rgba(108, 92, 231, 0.5)';
    });

    this.button.addEventListener('mouseleave', () => {
      this.button.style.transform = 'scale(1)';
      this.button.style.boxShadow = '0 4px 16px rgba(108, 92, 231, 0.35)';
    });
  }

  /**
   * Handle FAB click
   * @private
   */
  async _handleButtonClick() {
    const currentUrl = new URL(window.location.href);
    const videoId = currentUrl.searchParams.get('v');

    if (!videoId) {
      Utils.logError('ContentInjector', 'No videoId found in current URL');
      return;
    }

    console.log(`[ContentInjector] FAB clicked for video: ${videoId}`);

    // Hide FAB when modal opens
    this._setButtonState('loading');

    try {
      await TranscriptOrchestrator.extractAndDisplay(videoId, 'in-page-button');
      this._setButtonState('cached');
      // Hide FAB while modal is open
      this._hideButton();
    } catch (error) {
      Utils.logError('ContentInjector._handleButtonClick', error, { videoId });
      this._setButtonState('error');

      setTimeout(() => {
        this._setButtonState('default');
      }, YTE_CONSTANTS.ERROR_RESET_DELAY);
    }
  }

  /**
   * Set button state
   * @private
   * @param {string} state - State ('default', 'loading', 'cached', 'error')
   */
  _setButtonState(state) {
    if (!this.button) return;

    const states = {
      default: 'Get Transcript',
      loading: 'Loading...',
      cached: 'View Transcript',
      error: 'Try Again'
    };

    const label = this.button.querySelector('.yte-fab-label');
    if (label) {
      label.textContent = states[state] || states.default;
    }

    this.button.disabled = state === 'loading';
    this.button.style.opacity = state === 'loading' ? '0.7' : '1';

    const labels = {
      default: 'Get transcript of video',
      loading: 'Extracting transcript',
      cached: 'View cached transcript',
      error: 'Extraction failed, try again'
    };

    this.button.setAttribute('aria-label', labels[state] || labels.default);
  }

  /**
   * Hide FAB (when modal is open)
   * @private
   */
  _hideButton() {
    if (this.button) {
      this.button.style.display = 'none';
    }
  }

  /**
   * Show FAB
   */
  showButton() {
    if (this.button) {
      this.button.style.display = 'flex';
    }
  }

  /**
   * Remove button from DOM
   */
  removeButton() {
    if (this.button && document.body.contains(this.button)) {
      this.button.remove();
      this.button = null;
      console.log('[ContentInjector] FAB removed');
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    this.removeButton();
    console.log('[ContentInjector] Destroyed');
  }
}

// Auto-initialize when script loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.ytExtensionInjector = new ContentInjector();
  });
} else {
  window.ytExtensionInjector = new ContentInjector();
}

window.ContentInjector = ContentInjector;
