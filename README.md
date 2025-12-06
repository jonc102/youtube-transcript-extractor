# YouTube Transcript Extractor

A simple Chrome extension that extracts transcripts from YouTube videos and copies them to your clipboard.

## Features

- Extract transcripts from any YouTube video with captions
- Includes timestamps with each transcript line
- Copy transcript text to clipboard with one click
- Preview the extracted transcript
- Clean and simple interface
- Automatically opens transcript panel if not already open

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

1. Navigate to any YouTube video
2. Click on the extension icon in your Chrome toolbar
3. Click "Extract & Copy Transcript" button
4. The transcript will be automatically copied to your clipboard with timestamps
5. A preview of the transcript will appear in the popup

## Output Format

The transcript will be formatted with timestamps like this:
```
[0:00] First line of the transcript
[0:05] Second line of the transcript
[0:12] Third line continues here
```

## How It Works

The extension:
1. Detects when you're on a YouTube video page
2. Automatically opens the transcript panel (if not already open)
3. Extracts all transcript segments with their timestamps
4. Formats them as `[timestamp] text` on each line
5. Copies the complete transcript to your clipboard

## Troubleshooting

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

## Files

- `manifest.json` - Extension configuration and permissions
- `popup.html` - Extension popup interface
- `popup.js` - Popup logic, content script injection, and clipboard handling
- `popup.css` - Popup styling
- `content.js` - Script that runs on YouTube pages to extract transcripts with timestamps
- `icon.svg` - Icon source file (for customization)
- `icon16.png`, `icon48.png`, `icon128.png` - Extension icons (included)

## Privacy

This extension:
- Only runs on YouTube pages
- Does not collect or transmit any data
- Does not require account access
- Only accesses the current tab when you click the extract button

## License

Free to use and modify as needed.
