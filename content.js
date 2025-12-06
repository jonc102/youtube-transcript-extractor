// Content script that runs on YouTube pages
// This script extracts transcript data from the YouTube page

async function getTranscript() {
  try {
    // Get video ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get('v');

    if (!videoId) {
      return { error: 'No video ID found. Please open a YouTube video.' };
    }

    // First, check if transcript is already open
    let transcriptSegments = document.querySelectorAll('ytd-transcript-segment-renderer');

    if (transcriptSegments.length === 0) {
      // Try to open the transcript panel
      // Look for the "More actions" button or the three-dot menu
      const moreActionsSelectors = [
        'button[aria-label="More actions"]',
        'button[aria-label*="More"]',
        'ytd-menu-renderer button',
        '#button-shape > button[aria-label*="More"]'
      ];

      let moreActionsButton = null;
      for (const selector of moreActionsSelectors) {
        moreActionsButton = document.querySelector(selector);
        if (moreActionsButton) break;
      }

      if (moreActionsButton) {
        moreActionsButton.click();
        await new Promise(resolve => setTimeout(resolve, 800));

        // Look for transcript button in the menu
        const menuItems = document.querySelectorAll('ytd-menu-service-item-renderer, tp-yt-paper-listbox ytd-menu-service-item-renderer, ytd-menu-popup-renderer ytd-menu-service-item-renderer');

        let transcriptButton = null;
        for (const item of menuItems) {
          const text = item.textContent.toLowerCase();
          if (text.includes('transcript') || text.includes('show transcript')) {
            transcriptButton = item;
            break;
          }
        }

        if (transcriptButton) {
          transcriptButton.click();
          await new Promise(resolve => setTimeout(resolve, 1500));
        } else {
          // Try alternative: look for button directly
          const altTranscriptButton = Array.from(document.querySelectorAll('button, a')).find(
            el => el.textContent.toLowerCase().includes('show transcript')
          );
          if (altTranscriptButton) {
            altTranscriptButton.click();
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
        }
      }

      // Check again for transcript segments
      transcriptSegments = document.querySelectorAll('ytd-transcript-segment-renderer');
    }

    if (transcriptSegments.length === 0) {
      return { error: 'No transcript found. This video may not have captions available, or the transcript UI has changed. Try opening the transcript manually first.' };
    }

    let transcriptText = '';

    transcriptSegments.forEach(segment => {
      // Try multiple selectors for the text content
      const textElement = segment.querySelector('.segment-text') ||
                         segment.querySelector('yt-formatted-string.segment-text') ||
                         segment.querySelector('[class*="segment-text"]');

      if (textElement) {
        transcriptText += textElement.textContent.trim() + ' ';
      }
    });

    if (!transcriptText.trim()) {
      return { error: 'Transcript panel found but could not extract text. Please try again.' };
    }

    return {
      success: true,
      transcript: transcriptText.trim(),
      videoId: videoId
    };

  } catch (error) {
    return { error: `Error extracting transcript: ${error.message}` };
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getTranscript') {
    getTranscript().then(result => {
      sendResponse(result);
    });
    return true; // Keep the message channel open for async response
  }
});
