// Content Injector for YouTube Transcript Extractor
// Injects "Get Transcript" button into YouTube sidebar

class ContentInjector {
  constructor() {
    this.button = null;
    this.observer = null;
    this.lastVideoId = null; // Track last videoId
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

      // Close any open modal when navigating away
      if (window.ModalUI && ModalUI.isOpen) {
        console.log('[ContentInjector] Closing modal due to navigation');
        ModalUI.close();
      }

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

        // Close modal on URL change
        if (window.ModalUI && ModalUI.isOpen) {
          console.log('[ContentInjector] Closing modal due to URL change');
          ModalUI.close();
        }

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

    // If button exists for different video, remove and recreate
    if (this.button && this.lastVideoId && this.lastVideoId !== videoId) {
      console.log(`[ContentInjector] Video changed from ${this.lastVideoId} to ${videoId}, recreating button`);
      this.removeButton();
    }

    // Store current videoId
    this.lastVideoId = videoId;

    // Don't inject if button already exists for this video
    if (this.button && document.body.contains(this.button)) {
      console.log('[ContentInjector] Button already injected');
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
    this.button.innerHTML = isCached ? '✨ View TL;DR' : '🎬 TL;DR This Video';
    this.button.setAttribute('aria-label', isCached ? 'View cached AI summary' : 'Get AI summary of video');

    // Style button
    this._styleButton();

    // Attach click handler (no videoId parameter - will be extracted on click)
    this.button.addEventListener('click', () => this._handleButtonClick());

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
      border: '1px solid #dc143c',
      borderRadius: '8px',
      background: '#dc143c',
      color: '#ffffff',
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
      this.button.style.background = '#b8112d';
      this.button.style.borderColor = '#b8112d';
    });

    this.button.addEventListener('mouseleave', () => {
      this.button.style.background = '#dc143c';
      this.button.style.borderColor = '#dc143c';
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
   */
  async _handleButtonClick() {
    // Get current videoId from URL instead of using captured value
    const currentUrl = new URL(window.location.href);
    const videoId = currentUrl.searchParams.get('v');

    if (!videoId) {
      Utils.logError('ContentInjector', 'No videoId found in current URL');
      return;
    }

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
      default: '🎬 TL;DR This Video',
      loading: '🤖 Teaching AI to Watch...',
      cached: '✨ View TL;DR',
      error: '😵 Oops, Try Again'
    };

    this.button.innerHTML = states[state] || states.default;
    this.button.disabled = state === 'loading';

    // Update aria-label
    const labels = {
      default: 'Get AI summary of video',
      loading: 'AI is analyzing the video',
      cached: 'View cached AI summary',
      error: 'Summary extraction failed'
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
