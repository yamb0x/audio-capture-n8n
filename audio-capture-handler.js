/**
 * Audio Capture Handler
 * Manages different audio sources: microphone, system audio, or both
 */

class AudioCaptureHandler {
  constructor() {
    this.micStream = null;
    this.systemStream = null;
    this.combinedStream = null;
    this.audioContext = null;
  }

  /**
   * Get audio stream based on selected source
   * @param {string} source - 'microphone', 'system', or 'both'
   * @param {number} tabId - Tab ID for system audio capture
   * @returns {Promise<MediaStream>}
   */
  async getAudioStream(source, tabId) {
    console.log('[AudioCapture] Getting audio stream for source:', source);

    switch (source) {
      case 'microphone':
        return await this.getMicrophoneStream();
      
      case 'system':
        return await this.getSystemAudioStream(tabId);
      
      case 'both':
        return await this.getCombinedStream(tabId);
      
      default:
        throw new Error(`Invalid audio source: ${source}`);
    }
  }

  /**
   * Get microphone stream
   */
  async getMicrophoneStream() {
    console.log('[AudioCapture] Requesting microphone access...');
    
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        }
      });
      
      console.log('[AudioCapture] Microphone stream obtained');
      return this.micStream;
    } catch (error) {
      console.error('[AudioCapture] Microphone access error:', error);
      throw error;
    }
  }

  /**
   * Get system audio stream using screen capture API (doesn't mute tab)
   */
  async getSystemAudioStream(tabId) {
    console.log('[AudioCapture] Requesting system audio...');
    
    try {
      // Use getDisplayMedia for system audio - this won't mute the tab
      const stream = await navigator.mediaDevices.getDisplayMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 48000
        },
        video: false // We only want audio
      });

      // Check if we got audio track
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('No audio track in screen capture. User may have disabled audio sharing.');
      }

      console.log('[AudioCapture] System audio stream obtained via screen capture');
      this.systemStream = stream;
      
      // Add event listener for track ending (user stops sharing)
      audioTracks[0].addEventListener('ended', () => {
        console.log('[AudioCapture] System audio sharing ended by user');
      });
      
      return stream;
      
    } catch (error) {
      console.error('[AudioCapture] System audio capture error:', error);
      
      // Fall back to tab capture if available
      if (chrome.tabCapture && tabId) {
        console.log('[AudioCapture] Falling back to tab capture (note: this will mute the tab)');
        return this.getTabAudioStream(tabId);
      }
      
      throw error;
    }
  }

  /**
   * Get tab audio stream using tab capture (mutes the tab)
   */
  async getTabAudioStream(tabId) {
    return new Promise((resolve, reject) => {
      if (!chrome.tabCapture) {
        reject(new Error('Tab capture API not available.'));
        return;
      }

      chrome.tabCapture.capture({
        audio: true,
        video: false
      }, (stream) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!stream) {
          reject(new Error('No stream returned from tab capture'));
          return;
        }

        console.log('[AudioCapture] Tab audio stream obtained (tab is now muted)');
        resolve(stream);
      });
    });
  }

  /**
   * Get combined microphone and system audio
   */
  async getCombinedStream(tabId) {
    console.log('[AudioCapture] Getting combined audio streams...');
    
    try {
      // Get both streams
      const [micStream, systemStream] = await Promise.all([
        this.getMicrophoneStream(),
        this.getSystemAudioStream(tabId)
      ]);

      // Create audio context for mixing
      this.audioContext = new AudioContext();
      const destination = this.audioContext.createMediaStreamDestination();

      // Add microphone
      const micSource = this.audioContext.createMediaStreamSource(micStream);
      const micGain = this.audioContext.createGain();
      micGain.gain.value = 1.0; // Adjust microphone volume if needed
      micSource.connect(micGain);
      micGain.connect(destination);

      // Add system audio
      const systemSource = this.audioContext.createMediaStreamSource(systemStream);
      const systemGain = this.audioContext.createGain();
      systemGain.gain.value = 1.0; // Adjust system audio volume if needed
      systemSource.connect(systemGain);
      systemGain.connect(destination);

      console.log('[AudioCapture] Combined audio stream created');
      this.combinedStream = destination.stream;
      return destination.stream;

    } catch (error) {
      console.error('[AudioCapture] Combined stream error:', error);
      // If system audio fails, fall back to microphone only
      if (error.message.includes('tab capture')) {
        console.warn('[AudioCapture] System audio not available, using microphone only');
        return await this.getMicrophoneStream();
      }
      throw error;
    }
  }

  /**
   * Stop all audio streams
   */
  stopAllStreams() {
    console.log('[AudioCapture] Stopping all streams...');

    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop());
      this.micStream = null;
    }

    if (this.systemStream) {
      this.systemStream.getTracks().forEach(track => track.stop());
      this.systemStream = null;
    }

    if (this.combinedStream) {
      this.combinedStream.getTracks().forEach(track => track.stop());
      this.combinedStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  /**
   * Check if system audio is available
   */
  static async checkSystemAudioAvailability() {
    // Check if tab capture API is available
    if (!chrome.tabCapture) {
      return {
        available: false,
        reason: 'Tab capture API not available'
      };
    }

    // Check if we're in a context that can use tab capture
    try {
      // Tab capture can only be called from a popup or tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs || tabs.length === 0) {
        return {
          available: false,
          reason: 'No active tab found'
        };
      }

      return {
        available: true,
        tabId: tabs[0].id
      };
    } catch (error) {
      return {
        available: false,
        reason: error.message
      };
    }
  }
}

// Export for use in popup.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AudioCaptureHandler;
}