# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

YouTube Transcript Extractor is a Chrome Manifest V3 extension that extracts transcripts from YouTube videos and optionally processes them using OpenAI or Claude AI with custom prompts.

**Current Version:** 2.2.0
**Branch Strategy:** Main branch for PRs is `v1.1-timestamp`

## Development Workflow

### Zero-Build Architecture

This extension has **no build process**:
- No `package.json`, no npm dependencies, no bundler
- All JavaScript is vanilla ES6
- Direct file editing workflow
- No transpilation or compilation

### Loading the Extension

1. Navigate to `chrome://extensions/`
2. Enable "Developer mode" (top-right toggle)
3. Click "Load unpacked"
4. Select the repository folder
5. Extension loads immediately

### Reloading During Development

After editing any files:
1. Go to `chrome://extensions/`
2. Click the reload icon on the extension card
3. If you modified `content.js`, also refresh the YouTube page

### Debugging

**Popup (popup.js):**
- Right-click extension icon → "Inspect popup"
- Opens dedicated DevTools instance for popup

**Settings Page (settings.js):**
- Right-click on settings page → "Inspect"
- Check Network tab for API calls
- Check Application → Storage → Chrome Sync for saved settings

**Content Script (content.js):**
- Open YouTube page
- Press F12 to open DevTools
- Check Console tab for content script logs

**Background Service Worker (background.js):**
- Go to `chrome://extensions/`
- Click "service worker" link under the extension
- Opens dedicated DevTools instance for background worker

### Icon Generation (Optional)

If modifying icons:
```bash
python3 create_icons.py
```
Generates icon16.png, icon48.png, icon128.png from RGB data.

## Architecture Overview

### Component Structure

```
manifest.json          # Extension configuration (permissions, content scripts, background worker)
├── popup.html/css/js       # Main UI (extract button, preview)
├── settings.html/css/js    # Settings UI (API keys, prompts, models)
├── content.js              # Runs on YouTube pages (extracts transcripts)
├── api.js                  # Popup-side API wrapper (routes to background.js)
├── background.js           # Service worker (CORS bypass for API calls)
└── create_icons.py         # Icon generator
```

### Message Passing Architecture

The extension uses three message channels:

**Channel 1: Popup ↔ Content Script**
```javascript
// popup.js sends to content.js
chrome.tabs.sendMessage(tabId, { action: 'getTranscript' });

// content.js responds
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getTranscript') {
    getTranscript().then(result => sendResponse(result));
    return true; // CRITICAL: Keep channel open for async response
  }
});
```

Response format: `{ success: true, transcript: "...", videoId: "..." }`

**Channel 2: Popup/Settings ↔ Background Worker**
```javascript
// api.js or settings.js sends to background.js
chrome.runtime.sendMessage({
  action: 'callOpenAI',  // or 'callClaude', 'fetchOpenAIModels', 'fetchClaudeModels'
  apiKey, model, prompt, transcript
});

// background.js responds
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'callOpenAI') {
    callOpenAI(...).then(result => sendResponse({ success: true, result }));
    return true; // CRITICAL: Keep channel open for async response
  }
});
```

**Channel 3: Background Worker ↔ External APIs**
```javascript
// background.js makes direct fetch() calls
fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${apiKey}` }
});
```

**Why background.js exists:** Content scripts and popup/settings pages cannot make cross-origin API requests due to CORS. The background service worker bypasses this restriction.

### Critical Pattern: Async Message Responses

ALL message listeners that respond asynchronously **must** return `true`:

```javascript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  asyncFunction()
    .then(result => sendResponse(result))
    .catch(error => sendResponse({ error }));
  return true; // Without this, Chrome closes the channel before async response
});
```

## Key Components

### background.js (Service Worker)

Acts as a CORS bypass proxy for API calls. Implements:

- `fetchOpenAIModels(apiKey)` - Fetches models from OpenAI `/v1/models` endpoint, filters for GPT-4/3.5/O1 models
- `fetchClaudeModels(apiKey)` - Validates Claude API key with test request, returns hardcoded model list
- `callOpenAI(apiKey, model, prompt, transcript)` - Calls OpenAI chat completions (temperature 0.7, max_tokens 4000)
- `callClaude(apiKey, model, prompt, transcript)` - Calls Claude messages API (max_tokens 4096)

All functions use `fetch()` with proper authentication headers.

### content.js (YouTube Transcript Extraction)

Extracts transcripts from YouTube's DOM:

1. Checks if transcript panel is open
2. If not, clicks "More actions" button → "Show transcript" menu item
3. Uses fixed delays (800ms, 1500ms) to wait for UI updates
4. Queries transcript segments: `ytd-transcript-segment-renderer`
5. Extracts timestamp and text from each segment
6. Formats as `[timestamp] text` per line

**Multiple selector fallbacks** for YouTube UI resilience:
```javascript
const timestampElement = segment.querySelector('.segment-timestamp') ||
                        segment.querySelector('[class*="segment-timestamp"]') ||
                        segment.querySelector('div[class*="cue-group"] div[class*="cue"]:first-child');
```

### popup.js (Main UI Logic)

Flow:
1. Validates user is on YouTube `/watch?v=` page
2. Injects `content.js` dynamically if needed
3. Sends `{ action: 'getTranscript' }` message to content script
4. Receives transcript data
5. Loads settings from Chrome storage (`chrome.storage.sync.get()`)
6. If API configured, calls `processTranscriptWithAI()` via `api.js`
7. Copies result to clipboard (`navigator.clipboard.writeText()`)
8. Displays preview (first 300 chars with markdown rendering)

### settings.js (Settings Management)

**Model Caching Pattern:**
```javascript
let cachedModels = { openai: null, claude: null };

// Only fetch if not cached or force refresh
if (!forceRefresh && cachedModels[provider]) {
  populateModelSelect(cachedModels[provider]);
  return;
}
```

**Auto-fetch on API key blur:**
When user enters API key and moves to next field, automatically fetches available models.

**Claude Model List:**
Hardcoded in two places (settings.js and background.js) because Claude doesn't expose a public models endpoint.

Current models (as of v2.2.0):
- claude-opus-4-5-20251101 (Latest)
- claude-sonnet-4-5-20250929
- claude-haiku-4-5-20251001
- claude-3-7-sonnet-20250219
- claude-3-5-sonnet-20241022/20240620
- claude-3-5-haiku-20241022
- claude-3-opus/sonnet/haiku-202402xx

### api.js (API Client Wrapper)

Thin wrapper that routes API calls from popup.js to background.js:

```javascript
async function processTranscriptWithAI(apiProvider, apiKey, model, prompt, transcript) {
  if (apiProvider === 'openai') {
    return chrome.runtime.sendMessage({ action: 'callOpenAI', ... });
  } else if (apiProvider === 'claude') {
    return chrome.runtime.sendMessage({ action: 'callClaude', ... });
  }
}
```

## Critical Code Patterns

### Chrome Storage (Sync)

Settings persist across Chrome browsers (encrypted by Chrome):

```javascript
// Save
chrome.storage.sync.set({
  apiProvider: 'openai',
  apiKey: 'sk-...',
  customPrompt: '...',
  model: 'gpt-4o'
});

// Load
const settings = await chrome.storage.sync.get([
  'apiProvider', 'apiKey', 'customPrompt', 'model'
]);
```

### YouTube DOM Resilience

Always use multiple fallback selectors:

```javascript
const button = document.querySelector('button[aria-label="More actions"]') ||
               document.querySelector('button[aria-label*="More"]') ||
               document.querySelector('ytd-menu-renderer button');
```

YouTube frequently updates their DOM structure. Multiple selectors increase resilience.

### Fixed Timing Delays

Current implementation uses `setTimeout()` with fixed delays:
- 800ms after clicking "More actions"
- 1500ms after clicking "Show transcript"

These may fail on slow connections. Consider using `MutationObserver` for more robust implementation.

## Version History

**v2.2.0** (2026-01-18) - Current
- API key fixes
- Updated model lists

**v2.0.0** (2026-01-09) - Major Release
- Settings panel with gear icon
- OpenAI and Claude API integration
- Custom prompt functionality
- Dynamic model fetching
- Model caching

**v1.1-timestamp**
- Added timestamp extraction
- Enhanced error handling

**v1.0.0** - Initial Release
- Basic transcript extraction
- One-click copy to clipboard

## Versioning

Semantic versioning (MAJOR.MINOR.PATCH):
- **MAJOR** (x.0.0): Breaking changes
- **MINOR** (x.y.0): New features
- **PATCH** (x.y.z): Bug fixes

Increment by 0.0.1 for patches, 0.1.0 for features.

## Testing Checklist

Manual testing required (no automated tests):

- [ ] Extension loads without errors
- [ ] Popup opens on YouTube video pages
- [ ] Settings button opens settings page
- [ ] Transcript extraction works (try TED Talks, music videos)
- [ ] Timestamps formatted correctly `[0:00] text`
- [ ] Clipboard copy works
- [ ] Preview displays in popup
- [ ] Error messages for videos without transcripts
- [ ] Settings persist after saving
- [ ] API keys load correctly when reopening settings
- [ ] Models fetch automatically when API key entered
- [ ] AI processing works with valid API keys
- [ ] Fallback to original transcript on API errors
- [ ] Clear settings removes all stored data

## Known Limitations

1. **YouTube UI Dependency:** Relies on specific DOM selectors that may break when YouTube updates
2. **Fixed Timing Delays:** 800ms/1500ms delays may not work on slow connections
3. **Only `/watch?v=` URLs:** Doesn't work on playlists, channels, homepage
4. **Claude Model List Hardcoded:** No public API endpoint, must update manually when new models release
5. **Token Limits:** OpenAI max_tokens=4000, Claude max_tokens=4096 - long transcripts may be truncated

## Security Notes

**Permissions:**
- `activeTab` - Access current tab only
- `scripting` - Inject content.js dynamically
- `clipboardWrite` - Copy transcripts
- `storage` - Chrome sync storage (encrypted)
- Host permissions: youtube.com, api.openai.com, api.anthropic.com

**API Keys:**
- Stored in Chrome's encrypted sync storage
- Never transmitted except to the selected API provider
- User responsible for key security and rotation

**No external services:** Extension doesn't send data to any third parties. API calls go directly to OpenAI/Claude.

## Git Workflow

**Branches:**
- `v1.1-timestamp` - Main branch for PRs (current stable)
- `main` - Initial development branch
- `v2.0`, `v2.0-feature-expansion`, `v3-enhancements` - Feature branches

**Creating PRs:**
Pull requests should target `v1.1-timestamp` branch.

---

**Last Updated:** 2026-01-18
**Current Version:** 2.2.0
