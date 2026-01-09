# YouTube Transcript Extractor - Technical Documentation

## Project Overview

YouTube Transcript Extractor is a Chrome browser extension that extracts transcripts from YouTube videos and optionally processes them using AI (OpenAI or Claude) with custom prompts. It automates the process of accessing YouTube's transcript panel, formatting the content, and applying AI transformations based on user-defined prompts.

**Current Version:** 2.0.0
**Platform:** Chrome Extension (Manifest V3)
**Current Branch:** v1.1-timestamp

## Architecture

### Extension Type
- **Manifest Version:** 3 (Chrome's latest extension format)
- **Architecture Pattern:** Popup + Settings Page + Content Script + API Integration
- **Communication:** Message passing between popup and content script
- **Storage:** Chrome sync storage for API keys and settings
- **External APIs:** OpenAI and Claude (Anthropic) REST APIs

### Key Components

#### 1. Manifest (manifest.json:1-34)
Defines the extension configuration, permissions, and metadata.

**Permissions:**
- `activeTab` - Access to the currently active tab
- `scripting` - Dynamic script injection capability
- `clipboardWrite` - Write access to clipboard
- `storage` - Persistent storage for API keys and settings
- `host_permissions` - Limited to youtube.com domain

**Icons:** 16px, 48px, and 128px PNG files

#### 2. Popup Interface
**Files:** `popup.html`, `popup.css`, `popup.js`

The popup provides the main user interface when clicking the extension icon. Features:
- "Extract & Copy Transcript" button
- Settings button (gear icon) to access configuration
- Status messages (info/error/success states)
- Preview area showing first 300 characters of extracted/processed transcript

**Key Functions (popup.js):**
- Validates user is on a YouTube video page (popup.js:18)
- Injects content script dynamically (popup.js:27-30)
- Sends messages to content script to trigger extraction (popup.js:40)
- Loads settings from Chrome storage (popup.js:66-71)
- Conditionally processes transcript with AI if configured (popup.js:73-84)
- Handles clipboard operations (popup.js:89)
- Displays preview and status feedback

#### 3. Settings Interface
**Files:** `settings.html`, `settings.css`, `settings.js`

Complete settings management interface for API configuration. Features:
- API provider selection (None, OpenAI, Claude)
- API key input with show/hide toggle
- Custom prompt textarea
- Dynamic model selection with refresh capability
- Save and clear settings functionality

**Key Functions (settings.js):**
- `fetchOpenAIModels()` (settings.js:6-54) - Fetches available models from OpenAI API
- `fetchClaudeModels()` (settings.js:56-90) - Validates Claude API key and returns model list
- `fetchAndPopulateModels()` (settings.js:144-175) - Fetches and populates model dropdown
- Auto-loads models when API key is entered (settings.js:136-142)
- Saves settings to Chrome sync storage (settings.js:222-260)
- Loads settings on page open (settings.js:187-220)

#### 4. API Integration Module
**File:** `api.js`

Handles communication with OpenAI and Claude APIs.

**Key Functions:**
- `callOpenAI()` (api.js:1-35) - Makes requests to OpenAI chat completions API
- `callClaude()` (api.js:37-69) - Makes requests to Claude messages API
- `processTranscriptWithAI()` (api.js:71-94) - Main function that routes to appropriate API

**API Parameters:**
- OpenAI: Uses `gpt-4o` and related models, temperature 0.7, max_tokens 4000
- Claude: Uses `claude-3-5-sonnet` and related models, max_tokens 4096

#### 5. Content Script (content.js:1-121)
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

### Basic Extraction Flow (No AI)
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

### AI Processing Flow (With Settings Configured)
```
User clicks extension icon
    → popup.html opens
    → User clicks "Extract & Copy Transcript"
    → popup.js validates YouTube video page
    → popup.js injects content.js (if needed)
    → popup.js sends message: { action: 'getTranscript' }
    → content.js extracts and returns transcript
    → popup.js checks Chrome storage for API settings
    → IF settings exist:
        → popup.js calls processTranscriptWithAI()
        → api.js sends request to OpenAI or Claude API
        → API processes transcript with custom prompt
        → api.js returns AI-generated result
        → popup.js copies AI result to clipboard
    → ELSE:
        → popup.js copies original transcript to clipboard
    → popup.js shows preview and success message
```

### Settings Configuration Flow
```
User clicks gear icon in popup
    → settings.html opens
    → User selects API provider
    → User enters API key
    → settings.js auto-fetches available models (on blur)
    → settings.js populates model dropdown
    → User enters custom prompt
    → User selects model
    → User clicks "Save Settings"
    → settings.js saves to Chrome sync storage
    → Settings persist across browser sessions
```

## File Structure

```
youtube-transcript-extractor/
├── manifest.json          # Extension configuration
├── popup.html            # Popup UI structure
├── popup.css             # Popup styling
├── popup.js              # Popup logic and clipboard handling
├── settings.html         # Settings page UI structure
├── settings.css          # Settings page styling
├── settings.js           # Settings management and model fetching
├── api.js                # OpenAI and Claude API integration
├── content.js            # YouTube page script for extraction
├── icon.svg              # Source icon (SVG)
├── icon16.png            # 16x16 icon
├── icon48.png            # 48x48 icon
├── icon128.png           # 128x128 icon
├── create_icons.py       # Python script to generate PNG icons
├── README.md             # User-facing documentation
└── CLAUDE.MD             # This file (technical documentation)
```

## Current Features (v2.0.0)

### Core Extraction Features
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
   - Full transcript or AI-processed result available in clipboard

5. **Error Handling**
   - Validates YouTube video page
   - Checks for transcript availability
   - Provides user-friendly error messages

### AI Processing Features (v2.0.0)
1. **Settings Panel**
   - Dedicated settings page accessible via gear icon
   - Clean, intuitive interface for configuration
   - Back button to return to main popup

2. **API Provider Support**
   - OpenAI (GPT models)
   - Claude (Anthropic models)
   - Option to use neither (extract only)

3. **API Key Management**
   - Secure storage in Chrome sync storage
   - Show/hide toggle for API key visibility
   - Keys sync across Chrome browsers (encrypted by Chrome)

4. **Dynamic Model Selection**
   - Automatically fetches available models from API
   - OpenAI: Queries `/v1/models` endpoint and filters for chat models
   - Claude: Validates API key and provides curated model list
   - Refresh button to reload models manually
   - Models cached to avoid repeated API calls

5. **Custom Prompts**
   - User-defined prompts for AI processing
   - Transcript automatically appended to prompt
   - Supports any use case: summarization, translation, analysis, etc.

6. **Conditional Processing**
   - Only processes with AI if settings are configured
   - Falls back to original transcript on API errors
   - Clear status messages for each stage

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

5. **API Limitations (v2.0.0)**
   - Requires user to have their own API keys
   - API costs are user's responsibility
   - Rate limits depend on user's API plan
   - Large transcripts may hit token limits (4000-4096 tokens)
   - Claude model list endpoint not public (uses hardcoded list)

## Development Notes

### Branch Strategy
- **main** - Initial development branch
- **stable** - Stable release branch (main branch for PRs)
- **v1.1-timestamp** - Current feature branch (adds timestamp support)
- **v2** - Future version (separate worktree)

### Version History
**v2.0.0** (2026-01-09) - Major Feature Release
- Added settings panel with gear icon
- Implemented OpenAI and Claude API integration
- Added custom prompt functionality
- Dynamic model fetching from API endpoints
- Secure API key storage in Chrome sync storage
- Conditional AI processing based on settings
- Model caching and refresh capability
- Comprehensive error handling for API calls

**v1.1-timestamp**
- Added timestamp extraction to transcript output
- Updated icons
- Enhanced error handling

**v1.0.0** - Initial Release
- Basic transcript extraction
- One-click copy to clipboard
- Preview functionality

### Testing Checklist
When making changes, test:
- [ ] Extension loads without errors
- [ ] Popup opens on YouTube video pages
- [ ] Settings button opens settings page
- [ ] Extract button triggers transcript extraction
- [ ] Transcript panel opens automatically if closed
- [ ] Timestamps are correctly extracted and formatted
- [ ] Text is copied to clipboard successfully
- [ ] Preview displays in popup
- [ ] Error messages show for videos without transcripts
- [ ] Works on various YouTube video types (different caption sources)
- [ ] Settings persist after saving
- [ ] API keys load correctly when reopening settings
- [ ] Models fetch automatically when API key is entered
- [ ] Refresh button reloads models
- [ ] AI processing works with valid API keys
- [ ] Fallback to original transcript on API errors
- [ ] Clear settings removes all stored data

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

**Debug Settings Page:**
- Right-click on settings page → "Inspect"
- Check Network tab for API calls
- Verify Chrome storage in Application tab

**Test Transcript Extraction:**
Use YouTube videos with known good transcripts:
- TED Talks (usually have high-quality captions)
- Official music videos
- Educational content

**Test API Integration:**
- Use test API keys from provider dashboards
- Test with various transcript lengths
- Verify error handling with invalid keys
- Check rate limiting behavior

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

### Permissions
- `activeTab` - Access to the currently active tab only
- `scripting` - Dynamic script injection for content script
- `clipboardWrite` - Write access to clipboard for copying transcripts
- `storage` - Chrome sync storage for API keys and settings

### API Key Security
- API keys stored in Chrome's encrypted sync storage
- Keys never transmitted to any server except the selected API provider
- Keys sync across Chrome browsers (encrypted by Chrome's sync)
- No logging or tracking of API keys
- User responsible for key security and rotation

### Network Requests
- **YouTube:** Content script reads DOM elements only (no API calls)
- **OpenAI:** Direct HTTPS requests to api.openai.com (user's API key)
- **Claude:** Direct HTTPS requests to api.anthropic.com (user's API key)
- No analytics, tracking, or telemetry
- No third-party services
- Content script only runs on youtube.com domain
- No eval() or unsafe code execution

### Data Privacy
- Transcripts processed client-side only
- AI processing happens via direct API calls (not through intermediary servers)
- No data collected, stored, or transmitted by the extension developer
- User's API provider (OpenAI/Claude) may log API requests per their policies

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
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Claude API Documentation](https://docs.anthropic.com)

## Version Numbering

The extension follows semantic versioning (MAJOR.MINOR.PATCH):
- **MAJOR** version (x.0.0): Breaking changes or complete rewrites
- **MINOR** version (x.y.0): New features, significant enhancements
- **PATCH** version (x.y.z): Bug fixes, minor improvements, incrementing by 0.0.1

**Current Version:** 2.0.0
- v2.0.0 was a major version bump due to significant new features (settings panel, API integration)
- Future updates will increment by 0.0.1 for patches (2.0.1, 2.0.2, etc.)
- New features will increment minor version (2.1.0, 2.2.0, etc.)

---

**Last Updated:** 2026-01-09
**Current Version:** 2.0.0
**For Questions or Contributions:** See README.md
