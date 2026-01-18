# YouTube Transcript Extractor

A Chrome extension that extracts transcripts from YouTube videos and optionally processes them using AI (OpenAI or Claude).

**Current Version:** 3.0.1

## What's New in v3.0.1

🎨 **Modal UI Refinements:**

- **AI Summary First** - When AI summary exists, it now shows as the default active tab
- **Settings Gear Icon** - Quick access to settings directly from the modal header (⚙️)
- **Floating Corner Modal** - Modal now appears in bottom-right corner without backdrop overlay, keeping video accessible

## What's New in v3.0.0

🎉 **Major Update!** YouTube Transcript Extractor now features:

- **📄 In-Page Button** - Get transcripts directly from the YouTube sidebar (no need to open the extension!)
- **💾 Smart Caching** - Transcripts and AI summaries are cached locally for instant access
- **🎨 Floating Modal UI** - Bottom-right corner modal with auto-detected light/dark theme
- **🚀 Dual Entry Points** - Use the in-page button OR the extension icon - both work seamlessly
- **⚡ Lightning Fast** - Cached transcripts load instantly
- **🌙 Theme Detection** - Automatically matches YouTube's current theme
- **⚙️ Quick Settings Access** - Settings gear icon in modal for easy configuration

## Features

- **Two ways to access:** In-page button (desktop only) or extension icon
- **Smart caching:** Transcripts and AI summaries cached for the 10 most recent videos
- **Floating modal interface:** Bottom-right corner modal that keeps video accessible
- **Quick settings access:** Settings gear icon (⚙️) in modal header
- **AI Summary prioritized:** When AI summary exists, it shows as the default tab
- **Extract transcripts** from any YouTube video with captions
- **Timestamps included** with each transcript line
- **AI Processing** - Process transcripts with custom prompts using OpenAI or Claude APIs
- **Custom Prompts** - Define your own prompts for AI processing (summarization, translation, analysis, etc.)
- **Dynamic Model Selection** - Automatically fetches available models from your API account
- **Settings Panel** - Easy-to-use interface for API configuration
- **Theme-aware** - Automatically matches YouTube's light/dark mode
- **Copy to clipboard** with one click for both transcript and AI summary
- **Clean interface** with automatic transcript panel opening

## Installation

### Step 1: Download the Extension

Clone or download this repository to your local machine. All necessary files including icons are included.

### Step 2: Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" using the toggle in the top-right corner
3. Click "Load unpacked"
4. Select the `youtube-transcript-extension` folder
5. The extension should now appear in your extensions list

## Usage

### Quick Access (In-Page Button - Desktop Only)

1. Navigate to any YouTube video (desktop only, not mobile)
2. Look for the **"📄 Get Transcript"** button in the sidebar (above related videos)
3. Click the button
4. A modal will appear in the bottom-right corner with the transcript
   - **First time:** Button shows "📄 Get Transcript" and extracts the transcript
   - **Cached:** Button shows "📄 View Transcript" and loads instantly
   - **AI Summary tab:** Shown first when AI summary exists
5. Use the tabs to switch between "Transcript" and "AI Summary" (if configured)
6. Click the **gear icon (⚙️)** in the modal header to access Settings
7. Click "Copy Transcript" or "Copy Summary" to copy to clipboard
8. Video remains playable while modal is open

### Extension Icon Method (Works Everywhere)

1. Navigate to any YouTube video
2. Click on the extension icon in your Chrome toolbar
3. Click "Extract & Copy Transcript" button
4. A modal will appear in the bottom-right corner of the YouTube page with the transcript
5. The popup will automatically close after opening the modal
6. Click the **gear icon (⚙️)** in the modal header to access Settings (or use the gear icon in the popup)

### Advanced Usage (AI Processing)

1. Click the **gear icon (⚙️)** to open Settings (available in extension popup OR modal header)
2. Select your **API Provider** (OpenAI or Claude)
3. Enter your **API Key**
   - For OpenAI: Get your key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   - For Claude: Get your key from [console.anthropic.com](https://console.anthropic.com/)
4. Models will **automatically load** when you enter your API key
5. Enter your **Custom Prompt** (e.g., "Summarize the following transcript in bullet points:")
6. Select your preferred **Model**
7. Click **Save Settings**
8. Now when you extract a transcript:
   - Transcript is extracted from the video
   - Sent to the AI with your custom prompt
   - The AI summary appears in a separate "AI Summary" tab (shown first by default)
   - Both transcript and summary are displayed in the modal

## Output Format

### Basic Mode (No AI)
The transcript will be formatted with timestamps like this:
```
[0:00] First line of the transcript
[0:05] Second line of the transcript
[0:12] Third line continues here
```

### AI Mode (With Custom Prompt)
The output will be whatever your AI model generates based on your custom prompt. For example:
- Summarization: Bullet-point summary of the video
- Translation: Translated transcript in another language
- Analysis: Key insights and takeaways
- Custom formatting: Any format you specify in your prompt

## How It Works

### Basic Extraction
1. Detects when you're on a YouTube video page
2. Checks local cache first (instant if cached!)
3. If not cached: Automatically opens the transcript panel (if not already open)
4. Extracts all transcript segments with their timestamps
5. Formats them as `[timestamp] text` on each line
6. Opens a floating modal in the bottom-right corner
7. Displays the transcript in the modal with copy buttons (video remains accessible)

### AI Processing (Optional)
1. Extracts the transcript (steps 1-5 above)
2. Sends the transcript to your selected API (OpenAI or Claude)
3. Applies your custom prompt to the transcript
4. Returns the AI-processed result
5. Displays both transcript and AI summary in separate tabs
6. Both transcript and summary are cached together

### Caching System
- **10 most recent videos** are cached locally in your browser
- Cached data includes: transcript, AI summary (if processed), video title, timestamp
- Cache persists across browser sessions (doesn't expire)
- When you revisit a video, the modal opens instantly with cached data
- Oldest videos are automatically removed when the cache reaches 10 videos (LRU eviction)
- Cache is private to your browser (not synced across devices)

## Troubleshooting

### Transcript Extraction Issues

**"No transcript found"**
- The video may not have captions/subtitles enabled
- Try manually opening the transcript on YouTube first (click ⋯ below video → "Show transcript")
- Wait a moment after the page loads, then try the extension again
- Some videos may have transcripts disabled by the creator

**"Please open a YouTube video page"**
- Make sure you're on a video page (URL contains `/watch?v=`)
- The extension only works on video pages, not the homepage or other YouTube pages

**"Could not establish connection" error**
- Reload the extension: Go to `chrome://extensions/` and click the refresh icon 🔄
- Refresh the YouTube page
- Try clicking the extension button again

**Extension doesn't appear or won't load**
- Check that all files are in the `youtube-transcript-extension` folder
- Verify icon files (icon16.png, icon48.png, icon128.png) exist
- Try reloading the extension from `chrome://extensions/`

### AI Processing Issues

**"Failed to load models"**
- Check that your API key is correct
- Verify your API key has permissions to list/use models
- For OpenAI: Ensure your account has credits
- For Claude: Ensure your API key is active
- Click the refresh button (🔄) to retry

**"AI processing failed"**
- Check your API key is valid and not expired
- Verify you have sufficient API credits
- Check the selected model is available in your account
- If the error persists, the original transcript will be copied instead

**Models not loading automatically**
- After entering your API key, click outside the input field (blur event)
- Or click the refresh button (🔄) next to the model dropdown
- Check browser console for any error messages

## Files

### Core Files
- `manifest.json` - Extension configuration and permissions
- `popup.html/js/css` - Extension popup interface
- `settings.html/js/css` - Settings page interface
- `api.js` - OpenAI and Claude API integration
- `background.js` - Service worker for API calls (CORS bypass)
- `CLAUDE.md` - Technical documentation for developers

### Content Scripts (run on YouTube pages)
- `utils.js` - Shared utility functions
- `theme-detector.js` - YouTube theme detection (light/dark mode)
- `cache-manager.js` - Local cache management with LRU eviction
- `modal-ui.js` - Modal interface creation and interactions
- `modal-styles.css` - Modal styling with theme support
- `transcript-orchestrator.js` - Unified extraction and caching flow
- `content.js` - YouTube transcript extraction logic
- `content-injector.js` - In-page button injection with MutationObserver

### Assets
- `icon.svg` - Icon source file (for customization)
- `icon16.png`, `icon48.png`, `icon128.png` - Extension icons (included)

## Privacy & Security

This extension:
- Only runs on YouTube pages
- **API keys are stored locally** in Chrome's sync storage (encrypted by Chrome)
- API keys are **never sent anywhere** except to the selected API provider (OpenAI or Claude)
- Does not collect or transmit any data to third parties
- Does not require YouTube account access
- Only accesses the current tab when you click the extract button
- All API calls are made directly from your browser to the API provider

**Important:** Your API keys are stored securely in your browser using Chrome's storage API. They sync across your Chrome browsers if you're signed in, but remain encrypted and private to your Chrome profile.

## License

Free to use and modify as needed.
