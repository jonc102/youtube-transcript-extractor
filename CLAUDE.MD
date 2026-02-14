# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

YouTube Transcript Extractor is a Chrome Manifest V3 extension that extracts transcripts from YouTube videos and optionally processes them using OpenAI or Claude AI with custom prompts.

**Current Version:** 3.1.0
**Branch Strategy:** `main` is the stable branch (contains v3.1.0). All PRs should target `main`. Create feature branches from `main`.

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
manifest.json                    # Extension configuration (permissions, content scripts, background worker)
├── popup.html/css/js            # Extension popup UI (extract button)
├── settings.html/css/js         # Settings page (API keys, prompts, models)
├── api.js                       # Popup-side API wrapper (routes to background.js)
├── background.js                # Service worker (CORS bypass for API calls)
└── Content Scripts (run on YouTube pages):
    ├── utils.js                 # Shared utility functions (logging, HTML escaping, markdown)
    ├── theme-detector.js        # Detects YouTube light/dark theme
    ├── cache-manager.js         # Local cache with LRU eviction (10 videos)
    ├── modal-ui.js              # Modal creation, display, interactions
    ├── modal-styles.css         # Modal styling with theme support
    ├── transcript-orchestrator.js  # Unified extraction/caching flow
    ├── content.js               # YouTube transcript extraction logic
    └── content-injector.js      # Injects in-page "Get Transcript" button
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

- `formatModelLabel(modelId)` - Converts raw model IDs to user-friendly labels (e.g., "gpt-4o" → "GPT-4o")
- `fetchOpenAIModels(apiKey)` - Fetches models from OpenAI `/v1/models` endpoint
  - Filters by excluding non-chat models (embedding, whisper, tts, dall-e, legacy models)
  - Includes all GPT, O1, and ChatGPT variants
  - Returns models with friendly labels and priority sorting
  - Logs discovered models to console for debugging
- `fetchClaudeModels(apiKey)` - Validates Claude API key with test request, returns hardcoded model list
- `callOpenAI(apiKey, model, prompt, transcript)` - Calls OpenAI chat completions with dynamic parameters
  - Uses `max_completion_tokens` for O1/GPT-4o models, `max_tokens` for legacy models
  - Includes `temperature: 0.7` for non-O1 models, excludes it for O1 models
  - Backward compatible with GPT-3.5/GPT-4, forward compatible with O1/GPT-4o
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
Hardcoded in background.js only (settings.js delegates via message passing). Claude doesn't expose a public models endpoint.

Current models (as of v3.1.0):
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

### v3.0 Components (Content Scripts)

#### utils.js (Shared Utilities)

Provides shared functions for all content scripts:
- `Utils.logInfo()`, `Utils.logError()` - Namespaced logging
- `Utils.escapeHtml()` - Sanitizes HTML for safe display
- `Utils.markdownToHtml()` - Converts markdown to HTML for AI summaries
- `Utils.copyRichText(plainText, html)` - Copies to clipboard with dual format support (plain text + HTML)
- Used by modal-ui.js, transcript-orchestrator.js, and other content scripts

#### theme-detector.js (Theme Detection)

Detects YouTube's current theme (light/dark mode):
- Checks `html[dark]` attribute on document root
- Returns boolean `isDark` flag
- Used by modal-ui.js and content-injector.js for theme-aware styling

```javascript
const isDark = document.documentElement.hasAttribute('dark');
```

#### cache-manager.js (Local Cache with LRU Eviction)

Manages local cache for transcripts and AI summaries:
- Stores up to 10 most recent videos (LRU eviction)
- Uses Chrome `chrome.storage.local` (not synced across devices)
- Cache key: video ID
- Cache entry: `{ videoId, videoTitle, transcript, summary, timestamp }`
- Methods: `CacheManager.get()`, `CacheManager.set()`, `CacheManager.has()`
- Automatic eviction of oldest entries when cache exceeds 10 items

**Storage format:**
```javascript
{
  'yte-cache': {
    'videoId1': { videoId, videoTitle, transcript: {...}, summary: {...}, timestamp },
    'videoId2': { ... },
    // ... up to 10 entries
  }
}
```

#### modal-ui.js (Modal UI System)

**v3.0.1 Architecture: Floating Corner Modal (No Overlay)**

Creates and manages a floating modal in the bottom-right corner:
- **No backdrop overlay** - allows video interaction while modal is open
- **Fixed positioning:** `bottom: 24px; right: 24px`
- **Compact size:** 450px width, 600px max height
- **Mobile responsive:** Full-screen on devices ≤768px

**Key methods:**
- `ModalUI.createModal(data, isDark)` - Creates floating modal directly in document.body
- `ModalUI.showLoading(isDark)` - Shows loading spinner while extracting
- `ModalUI.showError(message, isDark)` - Shows error state
- `ModalUI.close()` - Removes modal from DOM
- `ModalUI._switchTab(tabName)` - Switches between Transcript/Summary tabs
- `ModalUI._copyToClipboard(text, message, type)` - Copies content with rich text support (type: 'transcript' or 'summary')

**v3.0.1 Features:**
1. **AI Summary Default Tab:** When `data.summary` exists, AI Summary tab is active by default
2. **Settings Gear Icon:** Header includes SVG gear button that opens settings.html in new tab
3. **Floating Corner Design:** Modal appears in bottom-right without backdrop, keeping video accessible

**Modal structure:**
```html
<div class="yte-modal yte-dark">  <!-- Appended directly to document.body -->
  <div class="yte-modal-header">
    <h2>Transcript & Summary</h2>
    <div class="yte-modal-header-actions">
      <button class="yte-modal-settings"><svg><!-- gear icon --></svg></button>
      <button class="yte-modal-close">×</button>
    </div>
  </div>
  <div class="yte-modal-tabs">
    <div class="yte-modal-tabs-container">  <!-- iOS segmented control -->
      <button class="yte-tab-btn">Transcript</button>
      <button class="yte-tab-btn yte-active">Summary</button>  <!-- Active if summary exists -->
    </div>
  </div>
  <div class="yte-modal-content">
    <div class="yte-tab-content">...</div>
    <div class="yte-tab-content yte-active">...</div>  <!-- Summary active by default -->
  </div>
  <div class="yte-modal-footer">
    <button data-action="regenerate">Regenerate</button>
    <button data-action="copy-transcript">Copy Transcript</button>
    <button data-action="copy-summary">Copy Summary</button>
  </div>
</div>
```

**Close behavior:**
- Close button (×) - removes modal
- Escape key - removes modal
- No click-outside-to-close (no overlay to click)

#### modal-styles.css (Modal Styling)

Apple HIG flat design styles for the floating corner modal:
- CSS variables for light/dark themes (Apple HIG color palette)
- `.yte-modal` - Frosted glass floating corner (`backdrop-filter: blur(20px)`)
- `.yte-modal-header-actions` - Flex container for settings + close buttons
- `.yte-modal-settings` - SVG gear icon button (no emoji)
- `.yte-modal-tabs-container` - iOS segmented control (pill bg, active white/dark surface)
- `.yte-tab-btn` - Segmented control segments with active shadow
- `.yte-toast` - Pill-shaped, centered bottom, frosted glass background
- `.yte-btn` - Flat buttons with opacity hover (no box-shadow, no translateY)
- Responsive: full-screen on mobile (≤768px)
- Font: SF Pro system font stack (`-apple-system, BlinkMacSystemFont, ...`)

**Theme variables (Apple HIG):**
```css
.yte-modal.yte-light {
  --yte-bg: #F2F2F7;         /* systemGroupedBackground */
  --yte-text: #1C1C1E;       /* label */
  --yte-accent: #007AFF;     /* systemBlue */
  --yte-modal-bg: rgba(255, 255, 255, 0.85);  /* frosted glass */
  /* ... */
}

.yte-modal.yte-dark {
  --yte-bg: #1C1C1E;         /* systemBackground */
  --yte-text: #FFFFFF;        /* label */
  --yte-accent: #0A84FF;     /* systemBlue */
  --yte-modal-bg: rgba(28, 28, 30, 0.85);     /* frosted glass */
  /* ... */
}
```

#### transcript-orchestrator.js (Unified Extraction Flow)

Orchestrates the entire transcript extraction and display flow:

**Flow:**
1. Check if video is cached (`CacheManager.has(videoId)`)
2. If cached: Load from cache and display modal immediately
3. If not cached: Extract transcript via `content.js`
4. Save to cache with `CacheManager.set()`
5. Display modal with transcript (and AI summary if available)

**API:**
- `TranscriptOrchestrator.extract(videoId, videoTitle)` - Main entry point
- Returns: `{ success: true/false, data: {...}, fromCache: true/false }`

**Usage:**
Called by both popup.js (extension icon) and content-injector.js (in-page button)

#### content-injector.js (In-Page Button)

Injects "Get Transcript" button into YouTube sidebar:

**Features:**
- Desktop only (checks viewport width > 768px)
- Button appears above related videos in right sidebar
- Uses MutationObserver to detect navigation (YouTube is SPA)
- Button text changes based on cache state:
  - "Get Transcript" - First time (not cached)
  - "View Transcript" - Cached (instant load)
- Clicking button calls `TranscriptOrchestrator.extract()`

**Button placement:**
```javascript
const relatedContainer = document.querySelector('#related');
if (relatedContainer) {
  relatedContainer.insertAdjacentElement('beforebegin', button);
}
```

**Navigation detection:**
Uses MutationObserver on `ytd-app` to detect YouTube's client-side navigation and re-inject button on new videos.

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

**v3.1.0** (2026-01-30) - Current
- **Apple/iOS Native UI Redesign**: Full visual overhaul to Apple HIG flat aesthetic
  - SF Pro system font stack (`-apple-system, BlinkMacSystemFont, ...`) throughout all surfaces
  - Apple HIG color palette: `#007AFF`/`#0A84FF` system blue, `#F2F2F7`/`#1C1C1E` backgrounds
  - Frosted glass modal with `backdrop-filter: blur(20px)` and semi-transparent background
  - iOS segmented control tabs replacing underline-style tabs
  - Flat buttons with opacity hover (removed all `box-shadow`, `translateY`, `filter: brightness` effects)
  - Pill-shaped centered toast notifications with frosted glass background
  - Removed all emoji from UI controls (clean text labels only)
  - SVG gear icon replacing emoji settings button in modal
  - Settings: uppercase letterspaced section headers, filled inputs (no border), text Show/Hide toggle
  - Settings: refresh button uses "Refresh" text instead of emoji
  - In-page button: clean labels ("Get Transcript", "View Transcript", "Loading...", "Try Again")
  - Thinner scrollbars (6px) with subtle colors
  - Subtle error state (background tint only, no left border bar, no emoji)
  - All `::before` content emoji pseudo-elements removed from status/toast/error/info messages
  - Uses `:focus-visible` instead of `:focus` for keyboard-only focus rings
  - 10px border radius on buttons and inputs (Apple standard)

**v3.0.6** (2026-01-20)
- **Regenerate AI Summary Feature**: Added ability to regenerate or generate AI summaries from modal
  - New "Regenerate" / "Generate Summary" button in modal footer
  - Button state adapts based on AI configuration and existing summary
  - Loading animation with pulse effect during regeneration
  - Toast notifications for success/failure feedback
  - Double-click prevention during processing
  - Cache automatically updated with regenerated summaries
  - Settings validation before regeneration attempt

**v3.0.5** (2026-01-19)
- **Extension Context Invalidation Fix**: Improved error handling when extension is reloaded
  - Added `Utils.isChromeAPIAvailable()` to check Chrome API availability
  - Enhanced error detection to catch "Cannot read properties of undefined" errors
  - Shows clear user-facing error modal: "Extension was reloaded. Please refresh (F5)"
  - Prevents cryptic console errors and silent failures
  - Added guard checks in TranscriptOrchestrator before accessing chrome.storage

**v3.0.4** (2026-01-19)
- Complete UI/UX modernization: unified design system, dark/light theme support, CSS variables
- Rich text copy support (dual MIME: text/plain + text/html for formatted paste in Docs/Word)
- Arc Browser compatibility fix (chrome.tabs.create instead of window.open)
- OpenAI API compatibility fix (max_completion_tokens for newer models, temperature exclusion for O1)
- Improved OpenAI model filtering and user-friendly labels
- Accessibility: focus outlines, ARIA labels, keyboard navigation

**v3.0.3** (2026-01-19)
- UI engagement improvements: button styling and text updates (superseded by v3.1.0)

**v3.0.2** (2026-01-19)
- Fixed stale modal data on video navigation
- Modal automatically closes when navigating to new videos
- Added currentVideoId tracking to prevent showing wrong video's data
- Button click handler uses current URL instead of stale captured videoId
- Fixed markdown bold/italic rendering in AI summaries (list items and headers)
- Enhanced markdownToHtml() with applyInlineFormatting() helper function

**v3.0.1** (2026-01-18)
- AI Summary tab as default when summary exists
- Settings gear icon in modal header
- Floating corner modal (no backdrop overlay)
- Video remains accessible while modal open

**v3.0.0** (2026-01-18) - Major Release
- In-page "Get Transcript" button (desktop sidebar)
- Smart caching system (10 most recent videos, LRU eviction)
- Modern modal UI with tabs (Transcript/AI Summary)
- Dual entry points (in-page button + extension icon)
- Theme detection (auto light/dark mode)
- Content script architecture with modular components
- Instant loading for cached transcripts

**v2.2.0** (2026-01-18)
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

### Core Functionality
- [ ] Extension loads without errors
- [ ] Transcript extraction works (try TED Talks, music videos)
- [ ] Timestamps formatted correctly `[0:00] text`
- [ ] Error messages for videos without transcripts

### Dual Entry Points (v3.0)
- [ ] In-page button appears in sidebar (desktop only)
- [ ] In-page button is Apple system blue with white text
- [ ] In-page button text: "Get Transcript" (first time)
- [ ] In-page button text: "View Transcript" (cached)
- [ ] Loading state: "Loading..."
- [ ] Error state: "Try Again"
- [ ] Extension icon popup opens on YouTube video pages
- [ ] Both entry points open the same modal on YouTube page

### Modal UI (v3.0.1)
- [ ] Modal appears in bottom-right corner (not centered)
- [ ] No dark backdrop overlay present
- [ ] Video player remains clickable and playable with modal open
- [ ] AI Summary tab is active by default (when summary exists)
- [ ] Transcript tab is active by default (when no summary)
- [ ] Settings gear icon (SVG) appears in modal header
- [ ] Clicking settings gear opens settings.html in new tab
- [ ] Close button (×) closes modal
- [ ] Escape key closes modal
- [ ] Tab switching works between Transcript/Summary
- [ ] Copy buttons work for both tabs
- [ ] Toast notifications appear on copy
- [ ] Rich text copy: Paste summary in Google Docs shows formatted text (bold, lists, etc.)
- [ ] Rich text copy: Paste summary in VS Code shows plain markdown
- [ ] Rich text copy: Transcript copies as plain text with timestamps
- [ ] iOS segmented control tabs switch correctly
- [ ] Frosted glass modal background with blur effect
- [ ] Toast notifications are pill-shaped and centered
- [ ] No emoji visible in any UI controls
- [ ] Mobile: modal is full-screen (≤768px)

### Caching System (v3.0)
- [ ] First extraction caches transcript
- [ ] Revisiting cached video loads instantly
- [ ] Cache includes AI summary if processed
- [ ] Cache persists across browser sessions
- [ ] 11th video evicts oldest cached video
- [ ] Cache works independently per video ID

### Settings & API Processing
- [ ] Settings button opens settings page
- [ ] Settings persist after saving
- [ ] API keys load correctly when reopening settings
- [ ] Models fetch automatically when API key entered
- [ ] AI processing works with valid API keys
- [ ] AI summary appears in separate tab in modal
- [ ] Fallback to original transcript on API errors
- [ ] Clear settings removes all stored data

## Known Limitations

1. **YouTube UI Dependency:** Relies on specific DOM selectors that may break when YouTube updates
2. **Fixed Timing Delays:** 800ms/1500ms delays may not work on slow connections
3. **Only `/watch?v=` URLs:** Doesn't work on playlists, channels, homepage
4. **In-page button desktop only:** Button only appears on desktop (viewport > 768px) due to YouTube's sidebar layout
5. **Cache size limit:** Only 10 most recent videos cached (LRU eviction)
6. **Cache not synced:** Cache uses `chrome.storage.local` and doesn't sync across devices
7. **Claude Model List Hardcoded:** No public API endpoint, must update manually when new models release
8. **Token Limits:** OpenAI max_tokens=4000, Claude max_tokens=4096 - long transcripts may be truncated
9. **Modal z-index conflicts:** Modal uses z-index 999999, may conflict with other extensions or YouTube overlays

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
- `main` - Stable branch (contains v3.1.0). Default branch on GitHub.
- `v2.0`, `v3.0` - Version branches (merged into main)
- `v2.0-feature-expansion`, `v3-enhancements` - Feature branches (archived)
- `v1.1-timestamp` - Old stable branch name (replaced by main, can be deleted)

**Workflow:**
1. Create feature branches from `main`
2. Name feature branches descriptively (e.g., `v3.1-feature-name` or `bugfix-description`)
3. All pull requests should target `main` branch
4. After merging, version branches can be kept for reference

### Pre-Commit Documentation Checklist

**Before every commit and push**, ensure the following documentation is up to date with the changes being committed:

**CLAUDE.md updates (required if any of these changed):**
- [ ] Version number in "Project Overview" and "Last Updated" footer
- [ ] Version History section with new entry describing the changes
- [ ] Architecture Overview if files were added, removed, or renamed
- [ ] Component descriptions if behavior or API of a component changed
- [ ] Key Components section if new functions, parameters, or message types were added
- [ ] Critical Code Patterns if new patterns were introduced
- [ ] Testing Checklist if new testable behavior was added
- [ ] Known Limitations if new limitations were introduced or existing ones resolved

**README.md updates (required if any of these changed):**
- [ ] Version number and feature descriptions
- [ ] Installation or usage instructions if the user-facing workflow changed
- [ ] Screenshots or feature list if visible UI changed
- [ ] Any user-facing information that no longer matches the code

**Rule:** Do not commit code changes without also committing the corresponding documentation updates in the same commit. If only documentation changed, that's fine as a standalone commit.

---

**Last Updated:** 2026-02-14
**Current Version:** 3.1.0
