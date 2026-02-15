// Cache Manager for Distill
// Implements LRU (Least Recently Used) caching with 10 video limit

class CacheManager {
  static MAX_VIDEOS = 10;
  static METADATA_KEY = 'transcript_cache_metadata';

  /**
   * Get cache key for a video ID
   * @param {string} videoId - YouTube video ID
   * @returns {string} - Cache key
   */
  static getCacheKey(videoId) {
    return `transcript_cache_${videoId}`;
  }

  /**
   * Get cached transcript data for a video
   * Updates LRU on access
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<Object|null>} - Cached data or null if not found
   */
  static async getCachedData(videoId) {
    try {
      // Check if extension context is still valid
      if (!Utils.isExtensionContextValid()) {
        console.warn('[CacheManager] Extension context invalidated. Please refresh the page.');
        return null;
      }

      const key = this.getCacheKey(videoId);
      const result = await chrome.storage.local.get(key);

      if (result[key]) {
        console.log(`[CacheManager] Cache HIT for video: ${videoId}`);

        // Update LRU on access
        await this._updateLRU(videoId);

        return result[key];
      }

      console.log(`[CacheManager] Cache MISS for video: ${videoId}`);
      return null;
    } catch (error) {
      // Silently handle context invalidated errors
      if (Utils.isContextInvalidatedError(error)) {
        console.warn('[CacheManager] Extension context invalidated. Please refresh the page.');
        return null;
      }
      Utils.logError('CacheManager.getCachedData', error, { videoId });
      return null;
    }
  }

  /**
   * Save transcript data to cache
   * Enforces quota and updates LRU
   * @param {string} videoId - YouTube video ID
   * @param {Object} data - Data to cache
   * @param {string} data.videoId - Video ID
   * @param {string} data.videoTitle - Video title
   * @param {Object} data.transcript - Transcript data
   * @param {Object|null} data.summary - AI summary data (optional)
   * @returns {Promise<boolean>} - True if saved successfully
   */
  static async setCachedData(videoId, data) {
    try {
      // Check if extension context is still valid
      if (!Utils.isExtensionContextValid()) {
        console.warn('[CacheManager] Extension context invalidated. Skipping cache save.');
        return false;
      }

      const key = this.getCacheKey(videoId);

      // Update LRU before saving
      await this._updateLRU(videoId);

      // Enforce quota (remove oldest if needed)
      await this._enforceQuota();

      // Save data with timestamp
      const cacheData = {
        ...data,
        timestamp: Date.now(),
        videoId: videoId
      };

      await chrome.storage.local.set({
        [key]: cacheData
      });

      console.log(`[CacheManager] Cached data for video: ${videoId}`);
      return true;
    } catch (error) {
      // Silently handle context invalidated errors
      if (Utils.isContextInvalidatedError(error)) {
        console.warn('[CacheManager] Extension context invalidated. Skipping cache save.');
        return false;
      }
      Utils.logError('CacheManager.setCachedData', error, { videoId });
      return false;
    }
  }

  /**
   * Check if a video has valid cached data
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<boolean>} - True if cached
   */
  static async isCacheValid(videoId) {
    const data = await this.getCachedData(videoId);
    return !!data;
  }

  /**
   * Clear cache for a specific video
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<boolean>} - True if cleared successfully
   */
  static async clearCache(videoId) {
    try {
      const key = this.getCacheKey(videoId);
      await chrome.storage.local.remove(key);

      // Update metadata
      const { [this.METADATA_KEY]: metadata } = await chrome.storage.local.get(this.METADATA_KEY);
      if (metadata) {
        metadata.videoIds = metadata.videoIds.filter(id => id !== videoId);
        await chrome.storage.local.set({ [this.METADATA_KEY]: metadata });
      }

      console.log(`[CacheManager] Cleared cache for video: ${videoId}`);
      return true;
    } catch (error) {
      Utils.logError('CacheManager.clearCache', error, { videoId });
      return false;
    }
  }

  /**
   * Clear all cached transcripts
   * @returns {Promise<boolean>} - True if cleared successfully
   */
  static async clearAllCache() {
    try {
      const { [this.METADATA_KEY]: metadata } = await chrome.storage.local.get(this.METADATA_KEY);

      if (metadata && metadata.videoIds) {
        // Remove all cached videos
        const keysToRemove = metadata.videoIds.map(id => this.getCacheKey(id));
        await chrome.storage.local.remove(keysToRemove);
      }

      // Clear metadata
      await chrome.storage.local.remove(this.METADATA_KEY);

      console.log('[CacheManager] Cleared all cached transcripts');
      return true;
    } catch (error) {
      Utils.logError('CacheManager.clearAllCache', error);
      return false;
    }
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>} - Cache stats
   */
  static async getStats() {
    try {
      const { [this.METADATA_KEY]: metadata } = await chrome.storage.local.get(this.METADATA_KEY);

      if (!metadata) {
        return {
          count: 0,
          videoIds: [],
          totalSize: 0
        };
      }

      // Get all cached data
      const keys = metadata.videoIds.map(id => this.getCacheKey(id));
      const cachedData = await chrome.storage.local.get(keys);

      // Calculate total size (rough estimate)
      const totalSize = JSON.stringify(cachedData).length;

      return {
        count: metadata.videoIds.length,
        videoIds: metadata.videoIds,
        totalSize: totalSize,
        lastCleanup: metadata.lastCleanup
      };
    } catch (error) {
      Utils.logError('CacheManager.getStats', error);
      return {
        count: 0,
        videoIds: [],
        totalSize: 0
      };
    }
  }

  /**
   * Update LRU metadata (most recently used goes to front)
   * @private
   * @param {string} videoId - YouTube video ID
   */
  static async _updateLRU(videoId) {
    try {
      // Check if extension context is still valid
      if (!Utils.isExtensionContextValid()) {
        return; // Silently skip if context invalid
      }

      const { [this.METADATA_KEY]: metadata } = await chrome.storage.local.get(this.METADATA_KEY);
      const currentMetadata = metadata || {
        videoIds: [],
        lastCleanup: Date.now()
      };

      // Remove videoId if it exists, then add to front
      currentMetadata.videoIds = currentMetadata.videoIds.filter(id => id !== videoId);
      currentMetadata.videoIds.unshift(videoId);

      await chrome.storage.local.set({
        [this.METADATA_KEY]: currentMetadata
      });
    } catch (error) {
      // Silently handle context invalidated errors
      if (Utils.isContextInvalidatedError(error)) {
        return;
      }
      Utils.logError('CacheManager._updateLRU', error, { videoId });
    }
  }

  /**
   * Enforce quota by removing oldest videos if limit exceeded
   * @private
   */
  static async _enforceQuota() {
    try {
      // Check if extension context is still valid
      if (!Utils.isExtensionContextValid()) {
        return; // Silently skip if context invalid
      }

      const { [this.METADATA_KEY]: metadata } = await chrome.storage.local.get(this.METADATA_KEY);

      if (!metadata || metadata.videoIds.length < this.MAX_VIDEOS) {
        return; // Under quota, no action needed
      }

      // Videos beyond MAX_VIDEOS (oldest are at the end)
      const toRemove = metadata.videoIds.slice(this.MAX_VIDEOS - 1);

      if (toRemove.length === 0) {
        return;
      }

      console.log(`[CacheManager] Enforcing quota: removing ${toRemove.length} oldest video(s)`);

      // Remove excess videos from storage
      const keysToRemove = toRemove.map(id => this.getCacheKey(id));
      await chrome.storage.local.remove(keysToRemove);

      // Update metadata with only MAX_VIDEOS - 1 (making room for new one)
      metadata.videoIds = metadata.videoIds.slice(0, this.MAX_VIDEOS - 1);
      metadata.lastCleanup = Date.now();

      await chrome.storage.local.set({
        [this.METADATA_KEY]: metadata
      });

      console.log(`[CacheManager] Cache quota enforced. Remaining: ${metadata.videoIds.length} videos`);
    } catch (error) {
      // Silently handle context invalidated errors
      if (Utils.isContextInvalidatedError(error)) {
        return;
      }
      Utils.logError('CacheManager._enforceQuota', error);
    }
  }

  /**
   * Debug: Log current cache state
   */
  static async debug() {
    const stats = await this.getStats();
    console.log('[CacheManager Debug]', stats);

    const { [this.METADATA_KEY]: metadata } = await chrome.storage.local.get(this.METADATA_KEY);
    console.log('[CacheManager Metadata]', metadata);

    // Log first 3 cached items
    if (metadata && metadata.videoIds.length > 0) {
      const sampleIds = metadata.videoIds.slice(0, 3);
      const sampleKeys = sampleIds.map(id => this.getCacheKey(id));
      const sampleData = await chrome.storage.local.get(sampleKeys);
      console.log('[CacheManager Sample Data]', sampleData);
    }
  }
}

// Export to window for global access
window.CacheManager = CacheManager;
