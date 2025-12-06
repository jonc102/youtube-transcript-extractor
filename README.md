
A simple Chrome extension that extracts transcripts from YouTube videos and copies them to your clipboard.

## Features

- Extract transcripts from any YouTube video with captions
- Copy transcript text to clipboard with one click
- Preview the extracted transcript
- Clean and simple interface

## Installation

### Step 1: Download the Extension

Clone or download this repository to your local machine.

### Step 2: Create Icon Files

The extension requires icon files. You can either:

**Option A: Use the provided SVG**
- Open `icon.svg` in a graphics editor
- Export as PNG at these sizes: 16x16, 48x48, 128x128
- Save as `icon16.png`, `icon48.png`, `icon128.png`

**Option B: Use ImageMagick (if installed)**
```bash
convert -background none icon.svg -resize 16x16 icon16.png
convert -background none icon.svg -resize 48x48 icon48.png
convert -background none icon.svg -resize 128x128 icon128.png
```

**Option C: Use any PNG images**
- Create or download any PNG images you like
- Resize to 16x16, 48x48, and 128x128 pixels
- Name them as above

### Step 3: Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" using the toggle in the top-right corner
3. Click "Load unpacked"
4. Select the `youtube-transcript-extension` folder
5. The extension should now appear in your extensions list

## Usage

1. Navigate to any YouTube video
2. Click on the extension icon in your Chrome toolbar
3. Click "Extract & Copy Transcript" button
4. The transcript will be automatically copied to your clipboard
5. A preview of the transcript will appear in the popup

## How It Works

The extension:
1. Detects when you're on a YouTube video page
2. Opens the transcript panel (if available)
3. Extracts all transcript segments
4. Combines them into clean text
5. Copies the result to your clipboard

## Troubleshooting

**"No transcript found"**
- The video may not have captions/subtitles enabled
- Try manually opening the transcript on YouTube first

**"Please open a YouTube video page"**
- Make sure you're on a video page (URL contains `/watch?v=`)
- The extension only works on video pages, not the homepage

**Extension doesn't appear**
- Make sure you have created the icon PNG files
- Check that all files are in the correct folder
- Try reloading the extension from `chrome://extensions/`

## Files

- `manifest.json` - Extension configuration
- `popup.html` - Extension popup interface
- `popup.js` - Popup logic and clipboard handling
- `popup.css` - Popup styling
- `content.js` - Script that runs on YouTube pages to extract transcripts
- `icon.svg` - Icon source file
- `icon16.png`, `icon48.png`, `icon128.png` - Extension icons (you need to create these)

## Privacy

This extension:
- Only runs on YouTube pages
- Does not collect or transmit any data
- Does not require account access
- Only accesses the current tab when you click the extract button

## License

Free to use and modify as needed.
