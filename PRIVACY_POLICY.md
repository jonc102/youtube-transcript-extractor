# Privacy Policy for Distill

**Last Updated:** February 27, 2026

## Overview

Distill is a Chrome extension that extracts transcripts from YouTube videos and optionally processes them using AI services (OpenAI or Anthropic Claude). This privacy policy explains what data is collected, how it is used, and how it is stored.

## Data Collection

### What We Collect

Distill collects and stores the following data **locally on your device**:

- **API Keys:** Your OpenAI and/or Anthropic API keys, entered voluntarily by you in the extension settings.
- **User Preferences:** Your selected AI provider, model, and custom prompt settings.
- **Cached Transcripts:** Transcripts extracted from YouTube videos you interact with, cached locally for faster access (up to 10 most recent videos).
- **AI Summaries:** AI-generated summaries of transcripts, cached alongside the transcript data.
- **Chat History:** Conversation messages from the in-extension chat feature, stored per video.

### What We Do NOT Collect

- No personal information (name, email, address, etc.)
- No browsing history beyond the YouTube videos you actively extract transcripts from
- No analytics or telemetry data
- No tracking cookies or identifiers
- No data is sent to the extension developer or any third-party analytics service

## Data Storage

- **Settings and API keys** are stored in Chrome's encrypted sync storage (`chrome.storage.sync`), which Chrome encrypts and may sync across your signed-in browsers.
- **Cached transcripts, summaries, and chat history** are stored in Chrome's local storage (`chrome.storage.local`) and remain on your device only.
- Cached data is automatically managed with a 10-video limit using least-recently-used (LRU) eviction.

## Data Sharing

Distill does **not** send data to the extension developer or any third party, with one exception:

- **AI Processing (optional):** If you configure an API key and request an AI summary or use the chat feature, the transcript text and your chat messages are sent to your selected AI provider (OpenAI or Anthropic) using **your own API key**. This communication is directly between your browser and the AI provider's API. Distill does not intermediate, log, or store this communication beyond the local cache.

Please review the privacy policies of these providers if you choose to use AI features:
- [OpenAI Privacy Policy](https://openai.com/privacy)
- [Anthropic Privacy Policy](https://www.anthropic.com/privacy)

## Permissions

Distill requests the following Chrome permissions:

| Permission | Purpose |
|---|---|
| `activeTab` | Access the current YouTube tab to extract transcript data |
| `scripting` | Inject the transcript extraction script into YouTube pages |
| `clipboardWrite` | Copy transcripts and summaries to your clipboard |
| `storage` | Save your settings and cache transcript data locally |

### Host Permissions

| Host | Purpose |
|---|---|
| `youtube.com` | Extract transcripts from YouTube video pages |
| `api.openai.com` | Send transcripts to OpenAI for AI summaries (only when configured by you) |
| `api.anthropic.com` | Send transcripts to Anthropic for AI summaries (only when configured by you) |

## User Control

- **API Keys:** You can add, change, or remove your API keys at any time in the extension settings.
- **Cached Data:** Cached transcripts are automatically evicted when the cache exceeds 10 videos. You can clear all extension data by removing the extension from Chrome.
- **AI Features:** AI processing is entirely optional. The extension works for transcript extraction without any API key.

## Children's Privacy

Distill does not knowingly collect any personal information from children under 13. The extension does not collect personal information from any user.

## Changes to This Policy

Any changes to this privacy policy will be reflected in the "Last Updated" date above and included in the extension's release notes.

## Contact

If you have questions about this privacy policy, please open an issue on the [GitHub repository](https://github.com/jonc102/youtube-transcript-extractor).
