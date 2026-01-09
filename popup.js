document.addEventListener('DOMContentLoaded', function() {
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

  // Simple markdown to HTML converter
  function markdownToHtml(text) {
    let html = text;

    // Escape HTML to prevent XSS
    html = html.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;');

    // Split into lines for better processing
    const lines = html.split('\n');
    const processed = [];
    let inList = false;
    let listType = null;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      // Check for list items
      const unorderedMatch = line.match(/^[\*\-]\s+(.+)$/);
      const orderedMatch = line.match(/^\d+\.\s+(.+)$/);

      if (unorderedMatch || orderedMatch) {
        const content = unorderedMatch ? unorderedMatch[1] : orderedMatch[1];
        const currentListType = unorderedMatch ? 'ul' : 'ol';

        if (!inList) {
          processed.push(`<${currentListType}>`);
          inList = true;
          listType = currentListType;
        } else if (listType !== currentListType) {
          processed.push(`</${listType}>`);
          processed.push(`<${currentListType}>`);
          listType = currentListType;
        }

        processed.push(`<li>${content}</li>`);
      } else {
        if (inList) {
          processed.push(`</${listType}>`);
          inList = false;
          listType = null;
        }

        // Headers
        if (line.match(/^###\s+(.+)$/)) {
          line = line.replace(/^###\s+(.+)$/, '<h3>$1</h3>');
        } else if (line.match(/^##\s+(.+)$/)) {
          line = line.replace(/^##\s+(.+)$/, '<h2>$1</h2>');
        } else if (line.match(/^#\s+(.+)$/)) {
          line = line.replace(/^#\s+(.+)$/, '<h1>$1</h1>');
        } else if (line.trim() === '') {
          line = '<br>';
        } else {
          line = '<p>' + line + '</p>';
        }

        processed.push(line);
      }
    }

    // Close any open list
    if (inList) {
      processed.push(`</${listType}>`);
    }

    html = processed.join('');

    // Bold (after list processing to avoid conflicts)
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');

    // Code blocks
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

    // Inline code
    html = html.replace(/`(.+?)`/g, '<code>$1</code>');

    // Remove empty paragraphs
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p><br><\/p>/g, '<br>');

    return html;
  }

  extractBtn.addEventListener('click', async function() {
    // Clear previous status and preview
    statusText.textContent = 'Extracting transcript...';
    statusDiv.className = 'status info';
    copyTranscriptBtn.style.display = 'none';
    transcriptPreview.textContent = '';
    extractBtn.disabled = true;
    originalTranscript = '';

    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // Check if we're on a YouTube page
      if (!tab.url.includes('youtube.com/watch')) {
        statusText.textContent = 'Please open a YouTube video page.';
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

        if (response.error) {
          statusText.textContent = response.error;
          statusDiv.className = 'status error';
          extractBtn.disabled = false;
          return;
        }

        if (response.success && response.transcript) {
          originalTranscript = response.transcript; // Store the original
          let finalText = response.transcript;

          try {
            const settings = await chrome.storage.sync.get([
              'apiProvider',
              'apiKey',
              'customPrompt',
              'model'
            ]);

            if (settings.apiProvider && settings.apiKey && settings.customPrompt) {
              statusText.textContent = 'Processing with AI...';
              statusDiv.className = 'status info';

              try {
                finalText = await processTranscriptWithAI(response.transcript, settings);
                statusText.textContent = 'AI processing complete! Result copied to clipboard.';
                copyTranscriptBtn.style.display = 'inline-block'; // Show the button
              } catch (apiError) {
                console.error('API error:', apiError);
                statusText.textContent = 'AI processing failed: ' + apiError.message + '. Original transcript copied instead.';
                statusDiv.className = 'status error';
              }
            } else {
              statusText.textContent = 'Transcript copied to clipboard!';
            }

            await navigator.clipboard.writeText(finalText);
            statusDiv.className = 'status success';

            // Show full text in preview with formatting
            transcriptPreview.innerHTML = markdownToHtml(finalText);
          } catch (clipboardError) {
            statusText.textContent = 'Failed to copy to clipboard: ' + clipboardError.message;
            statusDiv.className = 'status error';
            transcriptPreview.innerHTML = markdownToHtml(finalText);
          }
        }

        extractBtn.disabled = false;
      });

    } catch (error) {
      statusText.textContent = 'Error: ' + error.message;
      statusDiv.className = 'status error';
      extractBtn.disabled = false;
    }
  });
});
