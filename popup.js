document.addEventListener('DOMContentLoaded', async function() {
  // Initialize theme on page load
  async function initializeTheme() {
    const { themePreference } = await chrome.storage.sync.get(['themePreference']);
    const preference = themePreference || 'auto';

    let isDark = false;
    if (preference === 'auto') {
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    } else {
      isDark = preference === 'dark';
    }

    document.body.classList.toggle('popup-dark', isDark);
    document.body.classList.toggle('popup-light', !isDark);
  }

  // Call immediately
  await initializeTheme();

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async (e) => {
    const { themePreference } = await chrome.storage.sync.get(['themePreference']);
    if (themePreference === 'auto' || !themePreference) {
      document.body.classList.toggle('popup-dark', e.matches);
      document.body.classList.toggle('popup-light', !e.matches);
    }
  });

  const extractBtn = document.getElementById('extractBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const statusDiv = document.getElementById('status');
  const statusText = document.getElementById('statusText');
  const copyTranscriptBtn = document.getElementById('copyTranscriptBtn');
  const transcriptPreview = document.getElementById('transcriptPreview');

  let originalTranscript = ''; // Store the original transcript

  settingsBtn.addEventListener('click', function() {
    window.location.href = 'settings.html';
  });

  // Handle copy transcript button click
  copyTranscriptBtn.addEventListener('click', async function() {
    if (originalTranscript) {
      try {
        await navigator.clipboard.writeText(originalTranscript);
        const originalText = statusText.textContent;
        statusText.textContent = 'Original transcript copied!';
        setTimeout(() => {
          statusText.textContent = originalText;
        }, 2000);
      } catch (error) {
        console.error('Failed to copy transcript:', error);
      }
    }
  });

  extractBtn.addEventListener('click', async function() {
    // Clear previous status and preview
    statusText.textContent = 'Opening modal...';
    statusDiv.className = 'status info';
    copyTranscriptBtn.style.display = 'none';
    transcriptPreview.textContent = '';
    extractBtn.disabled = true;
    originalTranscript = '';

    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // Check if we're on a YouTube video page
      if (!tab.url.includes('youtube.com/watch')) {
        statusText.textContent = 'Please open a YouTube video page.';
        statusDiv.className = 'status error';
        extractBtn.disabled = false;
        return;
      }

      // Extract video ID from URL
      const url = new URL(tab.url);
      const videoId = url.searchParams.get('v');

      if (!videoId) {
        statusText.textContent = 'Could not find video ID in URL.';
        statusDiv.className = 'status error';
        extractBtn.disabled = false;
        return;
      }

      // Inject content scripts if needed (manifest already loads most, but just in case)
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
      } catch (injectionError) {
        // Content scripts might already be injected via manifest, that's okay
        console.log('Content script injection:', injectionError.message);
      }

      // Wait a moment for scripts to be ready
      await new Promise(resolve => setTimeout(resolve, 100));

      // Send message to content script to open modal
      chrome.tabs.sendMessage(tab.id, {
        action: 'openTranscriptModal',
        videoId: videoId,
        source: 'extension-icon'
      }, function(response) {
        if (chrome.runtime.lastError) {
          statusText.textContent = 'Error: ' + chrome.runtime.lastError.message;
          statusDiv.className = 'status error';
          extractBtn.disabled = false;
          return;
        }

        if (!response) {
          statusText.textContent = 'Error: No response from content script. Please refresh the page and try again.';
          statusDiv.className = 'status error';
          extractBtn.disabled = false;
          return;
        }

        if (response.success) {
          // Success - modal opened on the page
          statusText.textContent = 'Modal opened on video page!';
          statusDiv.className = 'status success';

          // Close popup after short delay
          setTimeout(() => {
            window.close();
          }, 500);
        } else {
          statusText.textContent = 'Error: ' + (response.error || 'Failed to open modal');
          statusDiv.className = 'status error';
          extractBtn.disabled = false;
        }
      });

    } catch (error) {
      statusText.textContent = 'Error: ' + error.message;
      statusDiv.className = 'status error';
      extractBtn.disabled = false;
    }
  });
});
