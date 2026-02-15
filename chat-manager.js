// Chat Manager for YouTube Transcript Extractor
// Manages conversation state per video for AI chat feature

class ChatManager {
  // In-memory chat histories keyed by videoId
  static _histories = {};

  /**
   * Add a message to the chat history for a video
   * @param {string} videoId - YouTube video ID
   * @param {string} role - Message role ('user' or 'assistant')
   * @param {string} content - Message content
   */
  static addMessage(videoId, role, content) {
    if (!this._histories[videoId]) {
      this._histories[videoId] = [];
    }

    this._histories[videoId].push({ role, content });

    // Enforce message limit
    if (this._histories[videoId].length > YTE_CONSTANTS.MAX_CHAT_MESSAGES) {
      this._histories[videoId] = this._histories[videoId].slice(-YTE_CONSTANTS.MAX_CHAT_MESSAGES);
    }

    console.log(`[ChatManager] Added ${role} message for ${videoId}. Total: ${this._histories[videoId].length}`);
  }

  /**
   * Get chat history for a video
   * @param {string} videoId - YouTube video ID
   * @returns {Array} - Array of {role, content} objects
   */
  static getHistory(videoId) {
    return this._histories[videoId] || [];
  }

  /**
   * Load chat history from cached data
   * @param {string} videoId - YouTube video ID
   * @param {Array} history - Chat history array from cache
   */
  static loadHistory(videoId, history) {
    if (Array.isArray(history) && history.length > 0) {
      this._histories[videoId] = history.slice(-YTE_CONSTANTS.MAX_CHAT_MESSAGES);
      console.log(`[ChatManager] Loaded ${this._histories[videoId].length} messages for ${videoId}`);
    }
  }

  /**
   * Build conversation payload for API call
   * Uses summary as system context (not full transcript) to manage token budget
   * @param {string} videoId - YouTube video ID
   * @param {string} contextText - Summary or transcript excerpt for context
   * @param {string} provider - API provider ('openai' or 'claude')
   * @returns {Object} - { messages: [...], system?: string }
   */
  static getConversationPayload(videoId, contextText, provider) {
    const history = this.getHistory(videoId);
    const systemPrompt = `You are a helpful assistant discussing a YouTube video. Here is the video summary for context:\n\n${contextText}\n\nAnswer questions about this video based on the summary provided. Be concise and helpful.`;

    if (provider === 'claude') {
      // Claude uses top-level system param, not a system message in the array
      return {
        system: systemPrompt,
        messages: history.map(msg => ({ role: msg.role, content: msg.content }))
      };
    }

    // OpenAI uses system message in the messages array
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map(msg => ({ role: msg.role, content: msg.content }))
    ];

    return { messages };
  }

  /**
   * Clear chat history for a video
   * @param {string} videoId - YouTube video ID
   */
  static clearHistory(videoId) {
    delete this._histories[videoId];
    console.log(`[ChatManager] Cleared history for ${videoId}`);
  }

  /**
   * Check if a video has chat history
   * @param {string} videoId - YouTube video ID
   * @returns {boolean}
   */
  static hasHistory(videoId) {
    return !!(this._histories[videoId] && this._histories[videoId].length > 0);
  }
}

window.ChatManager = ChatManager;
