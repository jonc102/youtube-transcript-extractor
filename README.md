# YouTube Transcript Extractor

A Chrome extension that extracts transcripts from YouTube videos and optionally processes them using AI (OpenAI or Claude).

**Current Version:** 2.0.0

## Features

- **Extract transcripts** from any YouTube video with captions
- **Timestamps included** with each transcript line
- **AI Processing** - Process transcripts with custom prompts using OpenAI or Claude APIs
- **Custom Prompts** - Define your own prompts for AI processing (summarization, translation, analysis, etc.)
- **Dynamic Model Selection** - Automatically fetches available models from your API account
- **Settings Panel** - Easy-to-use interface for API configuration
- **Copy to clipboard** with one click
- **Preview** the extracted or AI-processed transcript
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

### Basic Usage (Extract Only)

1. Navigate to any YouTube video
2. Click on the extension icon in your Chrome toolbar
3. Click "Extract & Copy Transcript" button
4. The transcript will be automatically copied to your clipboard with timestamps
5. A preview of the transcript will appear in the popup

### Advanced Usage (AI Processing)

1. Click the **gear icon (⚙)** in the extension popup to open Settings
2. Select your **API Provider** (OpenAI or Claude)
3. Enter your **API Key**
   - For OpenAI: Get your key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   - For Claude: Get your key from [console.anthropic.com](https://console.anthropic.com/)
4. Models will **automatically load** when you enter your API key
5. Enter your **Custom Prompt** (e.g., "Summarize the following transcript in bullet points:")
6. Select your preferred **Model**
7. Click **Save Settings**
8. Now when you click "Extract & Copy Transcript", the transcript will be:
   - Extracted from the video
   - Sent to the AI with your custom prompt
   - The AI-processed result will be copied to your clipboard

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
2. Automatically opens the transcript panel (if not already open)
3. Extracts all transcript segments with their timestamps
4. Formats them as `[timestamp] text` on each line
5. Copies the complete transcript to your clipboard

### AI Processing (Optional)
1. Extracts the transcript (steps 1-4 above)
2. Sends the transcript to your selected API (OpenAI or Claude)
3. Applies your custom prompt to the transcript
4. Returns the AI-processed result
5. Copies the result to your clipboard

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

- `manifest.json` - Extension configuration and permissions
- `popup.html` - Extension popup interface
- `popup.js` - Popup logic, content script injection, and clipboard handling
- `popup.css` - Popup styling
- `settings.html` - Settings page interface
- `settings.js` - Settings management and API key storage
- `settings.css` - Settings page styling
- `api.js` - OpenAI and Claude API integration
- `content.js` - Script that runs on YouTube pages to extract transcripts with timestamps
- `icon.svg` - Icon source file (for customization)
- `icon16.png`, `icon48.png`, `icon128.png` - Extension icons (included)
- `CLAUDE.md` - Technical documentation for developers

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
