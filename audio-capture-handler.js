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
   * Get system audio stream using screen capture API
   * User will choose which tab/window to capture via browser dialog
   */
  async getSystemAudioStream(tabId) {
    console.log('[AudioCapture] Requesting system audio - user will choose tab/window...');
    
    try {
      // Use getDisplayMedia - this shows a picker for user to choose tab/window
      // Note: Arc browser requires video:true even if we only want audio
      const stream = await navigator.mediaDevices.getDisplayMedia({
        audio: true, // Request audio
        video: true // Required by Arc browser, we'll discard video tracks
      });

      // Check if we got audio track
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('No audio track selected. Please choose "Share tab audio" or "Share system audio" when prompted.');
      }

      // Stop video tracks since we only want audio
      const videoTracks = stream.getVideoTracks();
      videoTracks.forEach(track => {
        console.log('[AudioCapture] Stopping video track (we only need audio)');
        track.stop();
      });

      console.log('[AudioCapture] System audio stream obtained from user selection');
      this.systemStream = stream;
      
      // Add event listener for track ending (user stops sharing)
      audioTracks[0].addEventListener('ended', () => {
        console.log('[AudioCapture] System audio sharing ended by user');
      });
      
      return stream;
      
    } catch (error) {
      console.error('[AudioCapture] System audio capture error:', error);
      
      if (error.name === 'NotAllowedError') {
        throw new Error('Screen sharing permission denied. Please allow screen sharing and select a tab with audio.');
      }
      
      if (error.name === 'NotFoundError') {
        throw new Error('No audio source found. Please select a tab and enable "Share tab audio".');
      }
      
      throw new Error(`Failed to capture system audio: ${error.message}`);
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
    try {
      // Get current tab info
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs || tabs.length === 0) {
        return {
          available: false,
          reason: 'No active tab found',
          recommendation: 'Open a web page first'
        };
      }

      const currentTab = tabs[0];
      const url = currentTab.url;

      // Check for unsupported URLs
      if (this.isUnsupportedUrl(url)) {
        return {
          available: false,
          reason: 'Chrome internal pages cannot be captured',
          recommendation: 'Navigate to a regular website (like YouTube, Google Meet, etc.) to capture system audio',
          tabUrl: url
        };
      }

      // Check if getDisplayMedia is available (preferred method)
      if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
        return {
          available: true,
          method: 'screen-share',
          tabId: currentTab.id,
          message: 'System audio will use screen sharing (recommended)'
        };
      }

      // Check if tab capture API is available (fallback)
      if (!chrome.tabCapture) {
        return {
          available: false,
          reason: 'Browser does not support audio capture',
          recommendation: 'Use microphone only'
        };
      }

      return {
        available: true,
        method: 'tab-capture',
        tabId: currentTab.id,
        message: 'System audio will use tab capture (may mute tab)'
      };

    } catch (error) {
      return {
        available: false,
        reason: error.message,
        recommendation: 'Try refreshing the page or use microphone only'
      };
    }
  }

  /**
   * Check if URL is unsupported for audio capture
   */
  static isUnsupportedUrl(url) {
    if (!url) return true;
    
    const unsupportedPrefixes = [
      'chrome://',
      'chrome-extension://',
      'edge://',
      'about:',
      'moz-extension://',
      'safari-extension://',
      'chrome-search://',
      'chrome-devtools://'
    ];

    return unsupportedPrefixes.some(prefix => url.startsWith(prefix));
  }
}

// Export for use in popup.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AudioCaptureHandler;
}