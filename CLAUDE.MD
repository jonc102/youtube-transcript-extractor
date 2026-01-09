# YouTube Transcript Extractor - Technical Documentation

## Project Overview

YouTube Transcript Extractor is a Chrome browser extension that extracts transcripts from YouTube videos and copies them to the clipboard with timestamps. It automates the process of accessing YouTube's transcript panel and formatting the content for easy use.

**Current Version:** 1.0.0
**Platform:** Chrome Extension (Manifest V3)
**Current Branch:** v1.1-timestamp

## Architecture

### Extension Type
- **Manifest Version:** 3 (Chrome's latest extension format)
- **Architecture Pattern:** Popup + Content Script
- **Communication:** Message passing between popup and content script

### Key Components

#### 1. Manifest (manifest.json:1-34)
Defines the extension configuration, permissions, and metadata.

**Permissions:**
- `activeTab` - Access to the currently active tab
- `scripting` - Dynamic script injection capability
- `clipboardWrite` - Write access to clipboard
- `host_permissions` - Limited to youtube.com domain

**Icons:** 16px, 48px, and 128px PNG files

#### 2. Popup Interface
**Files:** `popup.html`, `popup.css`, `popup.js`

The popup provides the user interface when clicking the extension icon. Features:
- Single "Extract & Copy Transcript" button
- Status messages (info/error/success states)
- Preview area showing first 300 characters of extracted transcript

**Key Functions (popup.js):**
- Validates user is on a YouTube video page (popup.js:18)
- Injects content script dynamically (popup.js:27-30)
- Sends messages to content script to trigger extraction (popup.js:40)
- Handles clipboard operations (popup.js:65)
- Displays preview and status feedback

#### 3. Content Script (content.js:1-121)
Runs on all YouTube pages and handles the actual transcript extraction.

**Main Function:** `getTranscript()` (content.js:4-110)

**Extraction Process:**
1. Extracts video ID from URL parameters (content.js:7-8)
2. Checks if transcript panel is already open (content.js:15)
3. If not open, attempts to open it automatically:
   - Clicks "More actions" button (content.js:27-31)
   - Finds and clicks "Show transcript" menu item (content.js:38-51)
4. Locates transcript segment elements (content.js:65)
5. Extracts timestamp and text from each segment (content.js:74-95)
6. Formats as `[timestamp] text` per line (content.js:90)

**Selectors Used:**
- Transcript segments: `ytd-transcript-segment-renderer`
- Timestamps: `.segment-timestamp`
- Text content: `.segment-text` or `yt-formatted-string.segment-text`

**Message Listener:** (content.js:113-120)
Listens for `getTranscript` action from popup and responds with transcript data or error.

## Data Flow

```
User clicks extension icon
    → popup.html opens
    → User clicks "Extract & Copy Transcript"
    → popup.js validates YouTube video page
    → popup.js injects content.js (if needed)
    → popup.js sends message: { action: 'getTranscript' }
    → content.js receives message
    → content.js opens transcript panel (if needed)
    → content.js extracts segments
    → content.js formats transcript text
    → content.js responds with { success: true, transcript: "...", videoId: "..." }
    → popup.js copies to clipboard
    → popup.js shows preview and success message
```

## File Structure

```
youtube-transcript-extractor/
├── manifest.json          # Extension configuration
├── popup.html            # Popup UI structure
├── popup.css             # Popup styling
├── popup.js              # Popup logic and clipboard handling
├── content.js            # YouTube page script for extraction
├── icon.svg              # Source icon (SVG)
├── icon16.png            # 16x16 icon
├── icon48.png            # 48x48 icon
├── icon128.png           # 128x128 icon
├── create_icons.py       # Python script to generate PNG icons
├── README.md             # User-facing documentation
└── CLAUDE.MD             # This file (technical documentation)
```

## Current Features

1. **Automatic Transcript Panel Opening**
   - Detects if transcript is closed
   - Automatically opens "More actions" menu
   - Clicks "Show transcript" option

2. **Timestamp Preservation**
   - Extracts both timestamp and text from each segment
   - Formats as `[timestamp] text` (e.g., `[0:00] First line`)

3. **One-Click Copy**
   - Automatic clipboard copy on successful extraction
   - No manual selection needed

4. **Preview Display**
   - Shows first 300 characters in popup
   - Full transcript available in clipboard

5. **Error Handling**
   - Validates YouTube video page
   - Checks for transcript availability
   - Provides user-friendly error messages

## Known Limitations

1. **YouTube UI Dependency**
   - Relies on YouTube's DOM structure
   - Selector changes in YouTube updates may break functionality
   - Multiple fallback selectors implemented to improve resilience

2. **Transcript Availability**
   - Only works if video has captions/subtitles
   - Creator-disabled transcripts cannot be extracted

3. **Timing Delays**
   - Uses fixed delays (800ms, 1500ms) for UI interactions
   - May not work on slow connections or devices

4. **YouTube Video Pages Only**
   - Only activates on `/watch?v=` URLs
   - Doesn't work on playlists, channels, or homepage

## Development Notes

### Branch Strategy
- **main** - Initial development branch
- **stable** - Stable release branch (main branch for PRs)
- **v1.1-timestamp** - Current feature branch (adds timestamp support)
- **v2** - Future version (separate worktree)

### Recent Changes (v1.1-timestamp)
- Added timestamp extraction to transcript output
- Updated icons
- Enhanced error handling

### Testing Checklist
When making changes, test:
- [ ] Extension loads without errors
- [ ] Popup opens on YouTube video pages
- [ ] Extract button triggers transcript extraction
- [ ] Transcript panel opens automatically if closed
- [ ] Timestamps are correctly extracted and formatted
- [ ] Text is copied to clipboard successfully
- [ ] Preview displays in popup
- [ ] Error messages show for videos without transcripts
- [ ] Works on various YouTube video types (different caption sources)

### Common Development Tasks

**Reload Extension:**
1. Navigate to `chrome://extensions/`
2. Click reload icon on extension card

**Debug Content Script:**
- Open DevTools on YouTube page (F12)
- Check Console tab for errors
- Use `console.log()` in content.js

**Debug Popup:**
- Right-click extension icon → "Inspect popup"
- Use popup's separate DevTools instance

**Test Transcript Extraction:**
Use YouTube videos with known good transcripts:
- TED Talks (usually have high-quality captions)
- Official music videos
- Educational content

## Potential Improvements

### Robustness
- [ ] Add MutationObserver to wait for transcript elements instead of fixed delays
- [ ] Implement retry logic with exponential backoff
- [ ] Add more fallback selectors for YouTube UI variations
- [ ] Support for auto-generated vs manual captions detection

### Features
- [ ] Language selection for multi-language transcripts
- [ ] Option to exclude/include timestamps
- [ ] Download transcript as .txt file
- [ ] Support for timestamp formats (HH:MM:SS vs seconds)
- [ ] Batch extraction for playlists
- [ ] Search/filter within transcript

### UX Improvements
- [ ] Progress indicator during extraction
- [ ] Transcript word count display
- [ ] Copy confirmation animation
- [ ] Dark mode support for popup
- [ ] Keyboard shortcuts

### Code Quality
- [ ] Add JSDoc comments
- [ ] Implement unit tests
- [ ] Add error logging/telemetry (privacy-respecting)
- [ ] Modularize code into separate utility files

## Security Considerations

- Minimal permissions (only `activeTab`, `scripting`, `clipboardWrite`)
- No external network requests
- No data storage or persistence
- No user tracking or analytics
- Content script only runs on youtube.com domain
- No eval() or unsafe code execution

## Browser Compatibility

- **Supported:** Chrome, Edge, Brave (Chromium-based browsers with Manifest V3)
- **Not Supported:** Firefox (uses different manifest), Safari (different extension system)

## Troubleshooting Guide

### Extension Not Appearing
- Verify all icon files exist (icon16.png, icon48.png, icon128.png)
- Check manifest.json syntax
- Reload extension from chrome://extensions/

### "No transcript found" Error
- Video may lack captions
- YouTube UI may have changed (check selectors)
- Try manually opening transcript first
- Wait longer after page load

### "Could not establish connection" Error
- Content script not loaded
- Reload extension and refresh YouTube page
- Check for JavaScript errors in console

### Clipboard Copy Fails
- Browser clipboard permission denied
- Try manual copy from preview area
- Check browser clipboard settings

## Performance Notes

- Content script is loaded on all YouTube pages (`document_idle`)
- Minimal performance impact when idle
- Main processing only on button click
- No continuous background processes
- No service worker running (not needed for this extension)

## Resources

- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [YouTube DOM Structure](https://www.youtube.com/) (inspect elements)

---

**Last Updated:** 2026-01-09
**For Questions or Contributions:** See README.md
