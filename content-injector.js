// Content Injector for YouTube Transcript Extractor
// Injects "Get Transcript" button into YouTube sidebar

class ContentInjector {
  constructor() {
    this.button = null;
    this.observer = null;
    this.isDesktop = Utils.isDesktop();

    // Only inject on desktop
    if (this.isDesktop) {
      this.init();
    } else {
      console.log('[ContentInjector] Mobile detected, skipping button injection');
    }
  }

  /**
   * Initialize injector
   */
  init() {
    // Inject immediately if sidebar already exists
    this.injectButton();

    // Watch for YouTube SPA navigation
    this.observeNavigation();

    // Watch for sidebar changes (delayed load)
    this.observeSidebar();

    console.log('[ContentInjector] Initialized');
  }

  /**
   * Observe YouTube SPA navigation events
   */
  observeNavigation() {
    // YouTube fires custom events on navigation
    window.addEventListener('yt-navigate-finish', () => {
      console.log('[ContentInjector] YouTube navigation detected');

      if (Utils.isVideoPage()) {
        this.injectButton();
      } else {
        this.removeButton();
      }
    });

    // Also watch for URL changes (fallback)
    let lastUrl = window.location.href;
    setInterval(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        console.log('[ContentInjector] URL changed');

        if (Utils.isVideoPage()) {
          this.injectButton();
        } else {
          this.removeButton();
        }
      }
    }, 1000);
  }

  /**
   * Observe sidebar changes with MutationObserver
   */
  observeSidebar() {
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          const sidebar = this._findSidebar();
          if (sidebar && !this.button && Utils.isVideoPage()) {
            console.log('[ContentInjector] Sidebar detected via MutationObserver');
            this.injectButton();
            break;
          }
        }
      }
    });

    // Watch entire body for sidebar appearance
    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Find YouTube sidebar element
   * @private
   * @returns {HTMLElement|null} - Sidebar element
   */
  _findSidebar() {
    // Multiple selectors for YouTube's sidebar
    const selectors = [
      '#secondary #related',
      'ytd-watch-flexy #secondary #related',
      '#secondary.ytd-watch-flexy'
    ];

    for (const selector of selectors) {
      const sidebar = document.querySelector(selector);
      if (sidebar) {
        return sidebar;
      }
    }

    return null;
  }

  /**
   * Inject button into sidebar
   */
  async injectButton() {
    // Don't inject if button already exists
    if (this.button && document.body.contains(this.button)) {
      console.log('[ContentInjector] Button already injected');
      return;
    }

    // Don't inject if not on video page
    if (!Utils.isVideoPage()) {
      console.log('[ContentInjector] Not on video page, skipping injection');
      return;
    }

    const sidebar = this._findSidebar();
    if (!sidebar) {
      console.log('[ContentInjector] Sidebar not found, waiting...');
      return;
    }

    const videoId = Utils.getCurrentVideoId();
    if (!videoId) {
      console.log('[ContentInjector] No video ID found');
      return;
    }

    // Check if cached
    const isCached = await CacheManager.isCacheValid(videoId);

    // Remove old button if it exists
    this.removeButton();

    // Create button
    this.button = document.createElement('button');
    this.button.id = 'yte-transcript-button';
    this.button.className = 'yte-inject-btn';
    this.button.innerHTML = isCached ? '📄 View Transcript' : '📄 Get Transcript';
    this.button.setAttribute('aria-label', isCached ? 'View cached transcript' : 'Get video transcript');

    // Style button
    this._styleButton();

    // Attach click handler
    this.button.addEventListener('click', () => this._handleButtonClick(videoId));

    // Insert before related videos
    sidebar.parentElement.insertBefore(this.button, sidebar);

    console.log(`[ContentInjector] Button injected for video: ${videoId} (cached: ${isCached})`);
  }

  /**
   * Style button to match YouTube's design
   * @private
   */
  _styleButton() {
    const isDark = ThemeDetector.isDarkMode();

    // Inline styles for button
    Object.assign(this.button.style, {
      width: '100%',
      padding: '12px 16px',
      marginBottom: '16px',
      fontSize: '14px',
      fontWeight: '600',
      border: isDark ? '1px solid #3a3a3a' : '1px solid #e0e0e0',
      borderRadius: '8px',
      background: isDark ? '#212121' : '#ffffff',
      color: isDark ? '#f1f1f1' : '#030303',
      cursor: 'pointer',
      transition: 'all 0.2s',
      fontFamily: 'Roboto, Arial, sans-serif',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px'
    });

    // Hover effect
    this.button.addEventListener('mouseenter', () => {
      this.button.style.background = isDark ? '#2a2a2a' : '#f8f8f8';
      this.button.style.borderColor = isDark ? '#3ea6ff' : '#065fd4';
    });

    this.button.addEventListener('mouseleave', () => {
      this.button.style.background = isDark ? '#212121' : '#ffffff';
      this.button.style.borderColor = isDark ? '#3a3a3a' : '#e0e0e0';
    });

    // Focus effect
    this.button.addEventListener('focus', () => {
      this.button.style.outline = '2px solid ' + (isDark ? '#3ea6ff' : '#065fd4');
      this.button.style.outlineOffset = '2px';
    });

    this.button.addEventListener('blur', () => {
      this.button.style.outline = 'none';
    });
  }

  /**
   * Handle button click
   * @private
   * @param {string} videoId - Video ID
   */
  async _handleButtonClick(videoId) {
    console.log(`[ContentInjector] Button clicked for video: ${videoId}`);

    // Set loading state
    this._setButtonState('loading');

    try {
      // Trigger orchestrator
      await TranscriptOrchestrator.extractAndDisplay(videoId, 'in-page-button');

      // Update button state to cached
      this._setButtonState('cached');
    } catch (error) {
      Utils.logError('ContentInjector._handleButtonClick', error, { videoId });
      this._setButtonState('error');

      // Reset to default after 2 seconds
      setTimeout(() => {
        this._setButtonState('default');
      }, 2000);
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
      default: '📄 Get Transcript',
      loading: '⏳ Extracting...',
      cached: '📄 View Transcript',
      error: '❌ Failed'
    };

    this.button.innerHTML = states[state] || states.default;
    this.button.disabled = state === 'loading';

    // Update aria-label
    const labels = {
      default: 'Get video transcript',
      loading: 'Extracting transcript',
      cached: 'View cached transcript',
      error: 'Extraction failed'
    };

    this.button.setAttribute('aria-label', labels[state] || labels.default);
  }

  /**
   * Remove button from DOM
   */
  removeButton() {
    if (this.button && document.body.contains(this.button)) {
      this.button.remove();
      this.button = null;
      console.log('[ContentInjector] Button removed');
    }
  }

  /**
   * Cleanup and disconnect observer
   */
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

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
  // DOM already loaded
  window.ytExtensionInjector = new ContentInjector();
}

// Export for debugging
window.ContentInjector = ContentInjector;
