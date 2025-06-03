/**
 * Recording Control Center
 * Persistent recording interface that doesn't rely on popup lifecycle
 */

console.log('[CONTROL CENTER] Script loaded');

// UI Elements
const statusBadge = document.getElementById('statusBadge');
const closeBtn = document.getElementById('closeBtn');
const errorMessage = document.getElementById('errorMessage');
const recordingInfo = document.getElementById('recordingInfo');
const durationEl = document.getElementById('duration');
const chunksSentEl = document.getElementById('chunksSent');
const activeSourceEl = document.getElementById('activeSource');
const connectionStatusEl = document.getElementById('connectionStatus');
const audioSourceSelect = document.getElementById('audioSource');
const webhookInput = document.getElementById('webhookUrl');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const audioVisualizer = document.getElementById('audioVisualizer');
const visualizerCanvas = document.getElementById('visualizerCanvas');

// State
let isRecording = false;
let mediaRecorder = null;
let audioStream = null;
let audioChunks = [];
let recordingInterval = null;
let audioCaptureHandler = null;
let durationInterval = null;
let startTime = null;
let chunkCounter = 0;
let isFirstChunk = true;
let audioContext = null;
let analyser = null;
let animationId = null;

// Recording metadata
let recordingSessionId = null;
let meetingId = null;
let meetingUrl = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  console.log('[CONTROL CENTER] DOM loaded, initializing...');
  
  // Load saved preferences
  loadPreferences();
  
  // Check if we're already recording
  checkRecordingState();
  
  // Set up event listeners
  setupEventListeners();
  
  // Set up audio visualizer
  setupVisualizer();
  
  // Check initial audio source availability
  checkAudioSourceAvailability();
});

// Check audio source availability and show guidance
async function checkAudioSourceAvailability() {
  const selectedSource = audioSourceSelect.value;
  
  if (selectedSource === 'microphone') {
    hideError();
    return;
  }
  
  // Check system audio availability
  const availability = await AudioCaptureHandler.checkSystemAudioAvailability();
  console.log('[CONTROL CENTER] Audio availability check:', availability);
  
  if (!availability.available) {
    let message = `System audio not available: ${availability.reason}`;
    if (availability.recommendation) {
      message += `\n\n💡 ${availability.recommendation}`;
    }
    if (availability.tabUrl) {
      message += `\n\nCurrent page: ${availability.tabUrl}`;
    }
    showError(message);
    
    // Disable start button
    startBtn.disabled = true;
    startBtn.textContent = 'System Audio Not Available';
  } else {
    hideError();
    startBtn.disabled = false;
    startBtn.innerHTML = '<span>▶️</span><span>Start Recording</span>';
    
    if (availability.message) {
      showInfo(availability.message);
    }
  }
}

// Load saved preferences
function loadPreferences() {
  // Load webhook URL
  chrome.storage.local.get(['webhookUrl', 'audioSource'], (result) => {
    if (result.webhookUrl) {
      webhookInput.value = result.webhookUrl;
    }
    if (result.audioSource) {
      audioSourceSelect.value = result.audioSource;
    }
  });
}

// Check current recording state
function checkRecordingState() {
  chrome.storage.local.get(['isRecording', 'recordingData'], (result) => {
    if (result.isRecording && result.recordingData) {
      // Restore recording state
      console.log('[CONTROL CENTER] Found active recording, restoring state...');
      
      recordingSessionId = result.recordingData.recordingSessionId;
      meetingId = result.recordingData.meetingId;
      meetingUrl = result.recordingData.meetingUrl;
      chunkCounter = result.recordingData.chunkCounter || 0;
      isFirstChunk = result.recordingData.isFirstChunk || false;
      startTime = new Date(result.recordingData.startTime);
      
      if (result.recordingData.audioSource) {
        audioSourceSelect.value = result.recordingData.audioSource;
      }
      
      updateUI(true);
      showError('Recording was in progress. Please stop and restart to ensure proper audio capture.');
    }
  });
}

// Set up event listeners
function setupEventListeners() {
  // Start button
  startBtn.addEventListener('click', startRecording);
  
  // Stop button
  stopBtn.addEventListener('click', stopRecording);
  
  // Audio source change - check availability
  audioSourceSelect.addEventListener('change', checkAudioSourceAvailability);
  
  // Close button
  closeBtn.addEventListener('click', () => {
    if (isRecording) {
      if (confirm('Recording is in progress. Stop recording and close?')) {
        stopRecording();
        window.close();
      }
    } else {
      window.close();
    }
  });
  
  // Audio source change
  audioSourceSelect.addEventListener('change', () => {
    chrome.storage.local.set({ audioSource: audioSourceSelect.value });
  });
  
  // Webhook URL change
  webhookInput.addEventListener('change', () => {
    chrome.storage.local.set({ webhookUrl: webhookInput.value });
  });
  
  // Listen for stop messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'stopRecording') {
      console.log('[CONTROL CENTER] Received stop message from popup');
      stopRecording();
      sendResponse({ status: 'stopped' });
    } else if (request.action === 'getControlStatus') {
      sendResponse({ 
        isRecording: isRecording,
        audioSource: audioSourceSelect.value,
        duration: isRecording ? formatDuration(Date.now() - startTime) : '00:00'
      });
    }
  });
}

// Start recording
async function startRecording() {
  console.log('[CONTROL CENTER] Starting recording...');
  
  try {
    // Clear any errors
    hideError();
    
    // Get current tab info
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];
    
    // Generate session metadata
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 11);
    recordingSessionId = `session_${timestamp}_${randomSuffix}`;
    meetingId = generateMeetingId(currentTab.url);
    meetingUrl = currentTab.url;
    
    console.log('[CONTROL CENTER] Recording session:', recordingSessionId);
    
    // Initialize audio capture
    audioCaptureHandler = new AudioCaptureHandler();
    
    // Get audio stream based on selected source
    const audioSource = audioSourceSelect.value;
    console.log('[CONTROL CENTER] Getting audio stream for source:', audioSource);
    
    try {
      // Check if we're on a supported page first
      if (audioSource !== 'microphone') {
        const availability = await AudioCaptureHandler.checkSystemAudioAvailability();
        if (!availability.available) {
          let errorMsg = `Cannot capture system audio: ${availability.reason}`;
          if (availability.recommendation) {
            errorMsg += `\n\n💡 Solution: ${availability.recommendation}`;
          }
          showError(errorMsg);
          return;
        }
      }
      
      audioStream = await audioCaptureHandler.getAudioStream(audioSource, currentTab.id);
      console.log('[CONTROL CENTER] Got audio stream');
    } catch (error) {
      console.error('[CONTROL CENTER] Failed to get audio stream:', error);
      
      // Handle specific error cases
      if (error.name === 'NotAllowedError') {
        if (audioSource === 'system' || audioSource === 'both') {
          showError('Screen sharing permission denied.\n\n💡 To capture system audio:\n1. Click "Start Recording" again\n2. Select "Share tab audio" or "Share system audio"\n3. Choose the tab/window you want to record');
        } else {
          showError('Microphone permission denied.\n\n💡 Please allow microphone access and try again.');
        }
        return;
      }
      
      if (error.message.includes('Chrome pages cannot be captured')) {
        showError('Cannot capture audio from Chrome internal pages.\n\n💡 Please navigate to a regular website (like YouTube, Google Meet, etc.) and try again.');
        return;
      }
      
      // Try fallback to microphone
      if (audioSource !== 'microphone') {
        showError(`Failed to capture ${audioSource}: ${error.message}\n\nFalling back to microphone only...`);
        audioSourceSelect.value = 'microphone';
        
        setTimeout(async () => {
          try {
            audioStream = await audioCaptureHandler.getAudioStream('microphone', currentTab.id);
            hideError();
            // Continue with recording setup...
            setupRecordingWithStream();
          } catch (fallbackError) {
            showError(`Microphone fallback also failed: ${fallbackError.message}`);
            return;
          }
        }, 1000);
        return;
      } else {
        showError(`Failed to start recording: ${error.message}`);
        return;
      }
    }
    
    setupRecordingWithStream();
  } catch (error) {
    console.error('[CONTROL CENTER] Failed to start recording:', error);
    showError(`Failed to start recording: ${error.message}`);
  }
}

// Continue recording setup after getting stream
function setupRecordingWithStream() {
  try {
    const currentAudioSource = audioSourceSelect.value;
    
    // Set up audio recording
    setupMediaRecorder();
    
    // Start recording
    mediaRecorder.start(5000); // Get data every 5 seconds
    
    // Set up chunk interval
    recordingInterval = setInterval(() => {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        console.log('[CONTROL CENTER] Chunk interval - requesting data');
        mediaRecorder.stop();
        setTimeout(() => {
          if (mediaRecorder && isRecording) {
            mediaRecorder.start(5000);
          }
        }, 100);
      }
    }, 30000); // Every 30 seconds
    
    // Update state
    isRecording = true;
    startTime = new Date();
    chunkCounter = 0;
    isFirstChunk = true;
    
    // Save state
    chrome.storage.local.set({
      isRecording: true,
      activeRecordingSource: currentAudioSource,
      recordingData: {
        recordingSessionId,
        meetingId,
        meetingUrl,
        startTime: startTime.toISOString(),
        audioSource: currentAudioSource,
        chunkCounter: 0,
        isFirstChunk: true
      }
    });
    
    // Notify background
    chrome.runtime.sendMessage({ action: 'recordingStarted' });
    
    // Update UI
    updateUI(true);
    
    // Start duration timer
    startDurationTimer();
    
    // Start visualizer
    startVisualizer();
    
    console.log('[CONTROL CENTER] Recording started successfully');
    
  } catch (error) {
    console.error('[CONTROL CENTER] Failed to start recording:', error);
    showError(`Failed to start recording: ${error.message}`);
  }
}

// Stop recording
function stopRecording() {
  console.log('[CONTROL CENTER] Stopping recording...');
  
  isRecording = false;
  
  // Clear intervals
  if (recordingInterval) {
    clearInterval(recordingInterval);
    recordingInterval = null;
  }
  
  if (durationInterval) {
    clearInterval(durationInterval);
    durationInterval = null;
  }
  
  // Stop media recorder
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    // Set flag for last chunk
    window.isLastChunk = true;
    mediaRecorder.stop();
  }
  
  // Stop audio streams
  if (audioCaptureHandler) {
    audioCaptureHandler.stopAllStreams();
    audioCaptureHandler = null;
  }
  
  if (audioStream) {
    audioStream.getTracks().forEach(track => track.stop());
    audioStream = null;
  }
  
  // Stop visualizer
  stopVisualizer();
  
  // Clear state
  chrome.storage.local.remove(['isRecording', 'recordingData', 'activeRecordingSource']);
  
  // Notify background
  chrome.runtime.sendMessage({ action: 'stopRecording' });
  
  // Update UI
  updateUI(false);
  
  console.log('[CONTROL CENTER] Recording stopped');
}

// Set up media recorder
function setupMediaRecorder() {
  const options = {
    mimeType: 'audio/webm;codecs=opus',
    audioBitsPerSecond: 128000
  };
  
  mediaRecorder = new MediaRecorder(audioStream, options);
  
  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      audioChunks.push(event.data);
    }
  };
  
  mediaRecorder.onstop = async () => {
    if (audioChunks.length > 0) {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      audioChunks = [];
      
      // Send to webhook
      await sendToWebhook(audioBlob);
      
      // Update counter
      chunkCounter++;
      isFirstChunk = false;
      updateChunkCount();
      
      // Update saved state
      chrome.storage.local.get(['recordingData'], (result) => {
        if (result.recordingData) {
          result.recordingData.chunkCounter = chunkCounter;
          result.recordingData.isFirstChunk = false;
          chrome.storage.local.set({ recordingData: result.recordingData });
        }
      });
    }
  };
  
  mediaRecorder.onerror = (error) => {
    console.error('[CONTROL CENTER] MediaRecorder error:', error);
    showError('Recording error: ' + error.message);
  };
}

// Send audio to webhook
async function sendToWebhook(audioBlob) {
  const reader = new FileReader();
  
  return new Promise((resolve) => {
    reader.onloadend = async () => {
      const base64Audio = reader.result.split(',')[1];
      
      const payload = {
        audio: base64Audio,
        timestamp: new Date().toISOString(),
        duration: 30,
        format: 'webm',
        recordingSessionId: recordingSessionId,
        meetingId: meetingId,
        meetingUrl: meetingUrl,
        chunkIndex: chunkCounter,
        isFirstChunk: isFirstChunk,
        isLastChunk: window.isLastChunk || false,
        source: 'control-center',
        recordingType: audioSourceSelect.value,
        title: document.title
      };
      
      try {
        const response = await fetch(webhookInput.value, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        
        if (response.ok) {
          console.log('[CONTROL CENTER] Chunk sent successfully');
          updateConnectionStatus('Connected', true);
        } else {
          console.error('[CONTROL CENTER] Webhook error:', response.status);
          updateConnectionStatus('Error: ' + response.status, false);
        }
      } catch (error) {
        console.error('[CONTROL CENTER] Failed to send chunk:', error);
        updateConnectionStatus('Connection failed', false);
      }
      
      resolve();
    };
    
    reader.readAsDataURL(audioBlob);
  });
}

// Update UI based on recording state
function updateUI(recording) {
  if (recording) {
    statusBadge.textContent = 'Recording';
    statusBadge.className = 'status-badge recording';
    recordingInfo.classList.add('active');
    audioVisualizer.classList.add('active');
    startBtn.style.display = 'none';
    stopBtn.style.display = 'flex';
    audioSourceSelect.disabled = true;
    webhookInput.disabled = true;
    
    // Update active source display
    const sourceText = audioSourceSelect.value === 'microphone' ? 'Microphone' :
                      audioSourceSelect.value === 'system' ? 'System Audio' :
                      'Microphone + System';
    activeSourceEl.textContent = sourceText;
  } else {
    statusBadge.textContent = 'Ready';
    statusBadge.className = 'status-badge ready';
    recordingInfo.classList.remove('active');
    audioVisualizer.classList.remove('active');
    startBtn.style.display = 'flex';
    stopBtn.style.display = 'none';
    audioSourceSelect.disabled = false;
    webhookInput.disabled = false;
    durationEl.textContent = '00:00';
    chunksSentEl.textContent = '0';
  }
}

// Start duration timer
function startDurationTimer() {
  durationInterval = setInterval(() => {
    if (startTime) {
      const elapsed = Date.now() - startTime;
      durationEl.textContent = formatDuration(elapsed);
    }
  }, 1000);
}

// Format duration
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  } else {
    return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }
}

// Update chunk count
function updateChunkCount() {
  chunksSentEl.textContent = chunkCounter;
}

// Update connection status
function updateConnectionStatus(status, success) {
  connectionStatusEl.textContent = status;
  connectionStatusEl.style.color = success ? '#2e7d32' : '#c62828';
}

// Show error message
function showError(message) {
  errorMessage.innerHTML = message.replace(/\n/g, '<br>');
  errorMessage.style.background = '#ffebee';
  errorMessage.style.borderColor = '#ef5350';
  errorMessage.style.color = '#c62828';
  errorMessage.classList.add('active');
}

// Show info message
function showInfo(message) {
  errorMessage.innerHTML = message.replace(/\n/g, '<br>');
  errorMessage.style.background = '#e3f2fd';
  errorMessage.style.borderColor = '#90caf9';
  errorMessage.style.color = '#1565c0';
  errorMessage.classList.add('active');
}

// Hide error message
function hideError() {
  errorMessage.classList.remove('active');
}

// Generate meeting ID from URL
function generateMeetingId(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    
    // Extract meeting ID patterns
    if (url.includes('zoom.us')) {
      const match = pathname.match(/\/j\/(\d+)/);
      return match ? `zoom_${match[1]}` : `zoom_${Date.now()}`;
    } else if (url.includes('meet.google.com')) {
      const match = pathname.match(/\/(.+)$/);
      return match ? `meet_${match[1]}` : `meet_${Date.now()}`;
    } else if (url.includes('teams.microsoft.com')) {
      return `teams_${Date.now()}`;
    } else {
      return `web_${urlObj.hostname}_${Date.now()}`;
    }
  } catch (error) {
    return `recording_${Date.now()}`;
  }
}

// Set up audio visualizer
function setupVisualizer() {
  const ctx = visualizerCanvas.getContext('2d');
  visualizerCanvas.width = visualizerCanvas.offsetWidth;
  visualizerCanvas.height = visualizerCanvas.offsetHeight;
}

// Start visualizer
function startVisualizer() {
  if (!audioStream) return;
  
  audioContext = new AudioContext();
  analyser = audioContext.createAnalyser();
  const source = audioContext.createMediaStreamSource(audioStream);
  source.connect(analyser);
  
  analyser.fftSize = 256;
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  
  const ctx = visualizerCanvas.getContext('2d');
  const width = visualizerCanvas.width;
  const height = visualizerCanvas.height;
  
  function draw() {
    animationId = requestAnimationFrame(draw);
    
    analyser.getByteFrequencyData(dataArray);
    
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, width, height);
    
    const barWidth = (width / bufferLength) * 2.5;
    let barHeight;
    let x = 0;
    
    for (let i = 0; i < bufferLength; i++) {
      barHeight = (dataArray[i] / 255) * height;
      
      ctx.fillStyle = `rgb(76, ${175 - dataArray[i] / 2}, 80)`;
      ctx.fillRect(x, height - barHeight, barWidth, barHeight);
      
      x += barWidth + 1;
    }
  }
  
  draw();
}

// Stop visualizer
function stopVisualizer() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  
  // Clear canvas
  const ctx = visualizerCanvas.getContext('2d');
  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
}

// Initialize when window is ready
window.addEventListener('beforeunload', (e) => {
  if (isRecording) {
    e.preventDefault();
    e.returnValue = 'Recording is in progress. Are you sure you want to leave?';
  }
});