// Theme detection for YouTube Transcript Extractor
// Detects YouTube's light/dark mode for modal styling

class ThemeDetector {
  /**
   * Detect if YouTube is in dark mode
   * Uses multiple detection methods with fallbacks
   * @returns {boolean} - True if dark mode, false if light mode
   */
  static isDarkMode() {
    // Method 1: Check YouTube's html attribute (most reliable)
    const htmlEl = document.documentElement;
    if (htmlEl.hasAttribute('dark')) {
      const darkAttr = htmlEl.getAttribute('dark');
      return darkAttr === 'true' || darkAttr === '';
    }

    // Method 2: Check for dark class on body
    if (document.body.classList.contains('dark')) {
      return true;
    }

    // Method 3: Check YouTube's theme meta tag
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      const content = themeMeta.getAttribute('content');
      // Dark theme uses #212121 or #0f0f0f, light uses #ffffff
      return content === '#212121' || content === '#0f0f0f';
    }

    // Method 4: Check computed background color of page
    const bgColor = window.getComputedStyle(document.body).backgroundColor;
    if (bgColor) {
      const rgb = bgColor.match(/\d+/g);
      if (rgb && rgb.length >= 3) {
        // Calculate brightness (0-255 average)
        const brightness = (parseInt(rgb[0]) + parseInt(rgb[1]) + parseInt(rgb[2])) / 3;
        return brightness < 128; // Dark if average RGB < 128
      }
    }

    // Method 5: Check for YouTube's CSS custom properties
    const rootStyles = window.getComputedStyle(document.documentElement);
    const ytBg = rootStyles.getPropertyValue('--yt-spec-base-background');
    if (ytBg) {
      // Dark mode typically uses #0f0f0f or #212121
      return ytBg.includes('0f0f0f') || ytBg.includes('212121');
    }

    // Default to light mode if all methods fail
    return false;
  }

  /**
   * Observe theme changes and call callback when theme switches
   * @param {Function} callback - Callback function (receives isDark boolean)
   * @returns {MutationObserver} - Observer instance (can be disconnected)
   */
  static observeThemeChanges(callback) {
    const observer = new MutationObserver(() => {
      callback(this.isDarkMode());
    });

    // Watch for changes to dark attribute on html element
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['dark', 'class']
    });

    // Also watch body class changes
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });

    return observer;
  }

  /**
   * Get theme-specific color values
   * @returns {Object} - Color scheme object
   */
  static getColors() {
    const isDark = this.isDarkMode();

    return {
      isDark: isDark,
      background: isDark ? '#212121' : '#ffffff',
      text: isDark ? '#f1f1f1' : '#030303',
      accent: isDark ? '#3ea6ff' : '#065fd4',
      border: isDark ? '#3a3a3a' : '#e0e0e0',
      hover: isDark ? '#2a2a2a' : '#f8f8f8',
      shadow: isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.3)'
    };
  }

  /**
   * Apply theme class to element
   * @param {HTMLElement} element - Element to apply theme class
   */
  static applyThemeClass(element) {
    const isDark = this.isDarkMode();

    if (isDark) {
      element.classList.remove('yte-light');
      element.classList.add('yte-dark');
    } else {
      element.classList.remove('yte-dark');
      element.classList.add('yte-light');
    }
  }

  /**
   * Get YouTube's native CSS variable value
   * @param {string} varName - CSS variable name (without --)
   * @returns {string} - CSS variable value
   */
  static getYouTubeVar(varName) {
    const rootStyles = window.getComputedStyle(document.documentElement);
    return rootStyles.getPropertyValue(`--${varName}`).trim();
  }
}

// Export to window for global access
window.ThemeDetector = ThemeDetector;
