document.addEventListener('DOMContentLoaded', function() {
  const extractBtn = document.getElementById('extractBtn');
  const statusDiv = document.getElementById('status');
  const transcriptPreview = document.getElementById('transcriptPreview');

  extractBtn.addEventListener('click', async function() {
    // Clear previous status and preview
    statusDiv.textContent = 'Extracting transcript...';
    statusDiv.className = 'status info';
    transcriptPreview.textContent = '';
    extractBtn.disabled = true;

    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // Check if we're on a YouTube page
      if (!tab.url.includes('youtube.com/watch')) {
        statusDiv.textContent = 'Please open a YouTube video page.';
        statusDiv.className = 'status error';
        extractBtn.disabled = false;
        return;
      }

      // Inject content script if not already loaded
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
      } catch (injectionError) {
        // Content script might already be injected, that's okay
        console.log('Content script injection:', injectionError.message);
      }

      // Wait a moment for script to be ready
      await new Promise(resolve => setTimeout(resolve, 100));

      // Send message to content script to extract transcript
      chrome.tabs.sendMessage(tab.id, { action: 'getTranscript' }, async function(response) {
        if (chrome.runtime.lastError) {
          statusDiv.textContent = 'Error: ' + chrome.runtime.lastError.message;
          statusDiv.className = 'status error';
          extractBtn.disabled = false;
          return;
        }

        if (!response) {
          statusDiv.textContent = 'Error: No response from content script. Please refresh the page and try again.';
          statusDiv.className = 'status error';
          extractBtn.disabled = false;
          return;
        }

        if (response.error) {
          statusDiv.textContent = response.error;
          statusDiv.className = 'status error';
          extractBtn.disabled = false;
          return;
        }

        if (response.success && response.transcript) {
          // Copy to clipboard
          try {
            await navigator.clipboard.writeText(response.transcript);
            statusDiv.textContent = 'Transcript copied to clipboard!';
            statusDiv.className = 'status success';

            // Show preview (first 300 characters)
            const preview = response.transcript.substring(0, 300) +
                          (response.transcript.length > 300 ? '...' : '');
            transcriptPreview.textContent = preview;
          } catch (clipboardError) {
            statusDiv.textContent = 'Failed to copy to clipboard: ' + clipboardError.message;
            statusDiv.className = 'status error';
            transcriptPreview.textContent = response.transcript;
          }
        }

        extractBtn.disabled = false;
      });

    } catch (error) {
      statusDiv.textContent = 'Error: ' + error.message;
      statusDiv.className = 'status error';
      extractBtn.disabled = false;
    }
  });
});
