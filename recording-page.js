console.log('[RECORDING PAGE] Script loaded - Arc Browser compatible version');

// UI Elements
const btnPermission = document.getElementById('btnPermission');
const btnStart = document.getElementById('btnStart');
const btnStop = document.getElementById('btnStop');
const webhookInput = document.getElementById('webhookUrl');
const statusIndicator = document.getElementById('statusIndicator');
const statusMessage = document.getElementById('statusMessage');
const audioLevels = document.getElementById('audioLevels');
const levelFill = document.getElementById('levelFill');
const levelValue = document.getElementById('levelValue');

// State
let mediaRecorder = null;
let audioStream = null;
let audioChunks = [];
let recordingInterval = null;
let audioContext = null;
let analyser = null;
let animationId = null;

// Recording metadata
let recordingSessionId = null;
let meetingId = null;
let meetingUrl = null;
let chunkCounter = 0;
let isFirstChunk = true;

// Initialize debugger
const recordingDebugger = new RecordingDebugger();
console.log('[RECORDING PAGE] Debugger initialized');

// Load saved webhook URL
const savedUrl = localStorage.getItem('webhookUrl');
if (savedUrl) {
  webhookInput.value = savedUrl;
}

// Status management
function updateStatus(status, message, isError = false) {
  console.log('[RECORDING PAGE] Status update:', status, message);
  
  // Update indicator
  statusIndicator.className = `status-indicator ${status}`;
  
  // Update message
  statusMessage.textContent = message;
  statusMessage.className = isError ? 'error-box' : 'info-box';
}

// Request microphone permission
btnPermission.addEventListener('click', async () => {
  console.log('[RECORDING PAGE] Requesting microphone permission...');
  
  try {
    updateStatus('connecting', 'Requesting microphone permission...');
    
    // Request permission with constraints
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000
      }
    });
    
    console.log('[RECORDING PAGE] Permission granted!');
    
    // Test audio levels
    const testContext = new AudioContext();
    const testAnalyser = testContext.createAnalyser();
    const testMicrophone = testContext.createMediaStreamSource(stream);
    testMicrophone.connect(testAnalyser);
    
    // Check audio level
    const dataArray = new Uint8Array(testAnalyser.frequencyBinCount);
    let maxLevel = 0;
    
    // Monitor for 2 seconds
    const checkInterval = setInterval(() => {
      testAnalyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      maxLevel = Math.max(maxLevel, average);
    }, 100);
    
    setTimeout(() => {
      clearInterval(checkInterval);
      
      // Clean up test
      stream.getTracks().forEach(track => track.stop());
      testContext.close();
      
      if (maxLevel > 1) {
        updateStatus('ready', `✅ Microphone working! Audio level detected: ${maxLevel.toFixed(1)}. Click "Start Recording" to begin.`);
      } else {
        updateStatus('ready', '⚠️ Microphone permission granted but no audio detected. Check if your mic is muted or try speaking louder.');
      }
      
      // Enable start button and hide permission button
      btnStart.disabled = false;
      btnPermission.style.display = 'none';
      
    }, 2000);
    
  } catch (error) {
    console.error('[RECORDING PAGE] Permission error:', error);
    
    if (error.name === 'NotAllowedError') {
      updateStatus('error', '❌ Microphone permission denied. Please reload the page and try again.', true);
      
      // Arc-specific advice
      setTimeout(() => {
        alert('Arc Browser Tip:\n\n1. Click the lock icon in the address bar\n2. Set Microphone to "Allow"\n3. Reload this page\n4. Try again');
      }, 500);
      
    } else if (error.name === 'NotFoundError') {
      updateStatus('error', '❌ No microphone found. Please connect a microphone and reload the page.', true);
    } else {
      updateStatus('error', `❌ Error: ${error.message}`, true);
    }
  }
});

// Start recording
btnStart.addEventListener('click', async () => {
  console.log('[RECORDING PAGE] Start recording clicked');
  
  try {
    updateStatus('connecting', 'Starting recording...');
    
    // Get current tab info
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    
    // Generate session IDs
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 11);
    recordingSessionId = `session_${timestamp}_${randomSuffix}`;
    meetingId = generateMeetingId(tab.url);
    meetingUrl = tab.url;
    
    console.log('[RECORDING PAGE] Recording session:', recordingSessionId);
    
    // Start debug tracking
    recordingDebugger.startSession(recordingSessionId);
    
    // Save webhook URL
    localStorage.setItem('webhookUrl', webhookInput.value);
    
    // Get audio stream
    audioStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000
      }
    });
    
    // Setup audio level monitoring
    setupAudioLevelMonitoring(audioStream);
    
    // Reset chunk counter
    chunkCounter = 0;
    isFirstChunk = true;
    
    // Start media recorder
    startMediaRecorder(audioStream, webhookInput.value);
    
    // Update UI
    updateStatus('recording', '🔴 Recording in progress...');
    btnStart.style.display = 'none';
    btnStop.style.display = 'inline-block';
    webhookInput.disabled = true;
    
  } catch (error) {
    console.error('[RECORDING PAGE] Start recording error:', error);
    updateStatus('error', `❌ Failed to start recording: ${error.message}`, true);
  }
});

// Stop recording
btnStop.addEventListener('click', () => {
  console.log('[RECORDING PAGE] Stop recording clicked');
  stopRecording();
});

// Setup audio level monitoring
function setupAudioLevelMonitoring(stream) {
  audioContext = new AudioContext();
  analyser = audioContext.createAnalyser();
  const microphone = audioContext.createMediaStreamSource(stream);
  microphone.connect(analyser);
  
  analyser.fftSize = 256;
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  
  audioLevels.classList.add('active');
  
  function updateLevels() {
    analyser.getByteFrequencyData(dataArray);
    const average = dataArray.reduce((a, b) => a + b) / bufferLength;
    const percentage = Math.min(100, (average / 128) * 100);
    
    levelFill.style.width = percentage + '%';
    levelValue.textContent = percentage.toFixed(0);
    
    if (percentage < 1) {
      levelFill.style.background = '#f44336';
    } else if (percentage < 20) {
      levelFill.style.background = '#ff9800';
    } else {
      levelFill.style.background = '#4CAF50';
    }
    
    animationId = requestAnimationFrame(updateLevels);
  }
  
  updateLevels();
}

// Start media recorder
function startMediaRecorder(stream, webhookUrl) {
  console.log('[RECORDING PAGE] Starting MediaRecorder');
  
  try {
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
      ? 'audio/webm;codecs=opus' 
      : 'audio/webm';
    
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: mimeType,
      audioBitsPerSecond: 128000
    });
    
    console.log('[RECORDING PAGE] MediaRecorder created with:', mimeType);
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
        console.log('[RECORDING PAGE] Audio chunk received, size:', event.data.size);
      }
    };
    
    mediaRecorder.onstop = () => {
      console.log('[RECORDING PAGE] MediaRecorder stopped, sending data...');
      sendAudioToWebhook(webhookUrl);
      audioChunks = [];
    };
    
    mediaRecorder.onerror = (event) => {
      console.error('[RECORDING PAGE] MediaRecorder error:', event.error);
      updateStatus('error', `Recording error: ${event.error}`, true);
    };
    
    // Start recording with timeslice
    mediaRecorder.start(1000); // Collect data every second
    
    // Send chunks every 30 seconds
    recordingInterval = setInterval(() => {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        console.log('[RECORDING PAGE] 30-second interval, restarting recorder');
        mediaRecorder.stop();
        setTimeout(() => {
          if (mediaRecorder && mediaRecorder.state !== 'recording') {
            mediaRecorder.start(1000);
          }
        }, 100);
      }
    }, 30000);
    
  } catch (error) {
    console.error('[RECORDING PAGE] MediaRecorder setup error:', error);
    updateStatus('error', `Failed to setup recording: ${error.message}`, true);
  }
}

// Send audio to webhook
async function sendAudioToWebhook(webhookUrl) {
  if (audioChunks.length === 0) {
    console.log('[RECORDING PAGE] No audio chunks to send');
    return;
  }
  
  const audioBlob = new Blob(audioChunks, {type: 'audio/webm'});
  console.log('[RECORDING PAGE] Sending audio blob, size:', audioBlob.size);
  
  // Convert to base64
  const reader = new FileReader();
  reader.readAsDataURL(audioBlob);
  reader.onloadend = async () => {
    const base64Audio = reader.result.split(',')[1];
    const audioSize = base64Audio.length;
    
    // Track chunk in debugger
    recordingDebugger.trackChunk(chunkCounter, audioSize, 30);
    
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
      isLastChunk: window.isRecordingStopping || false,
      source: 'arc-browser',
      recordingType: 'general-audio',
      title: document.title
    };
    
    const startTime = Date.now();
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      const responseTime = Date.now() - startTime;
      
      if (response.ok) {
        console.log('[RECORDING PAGE] Audio chunk sent successfully');
        recordingDebugger.trackWebhookAttempt(chunkCounter, true, null, responseTime);
        chunkCounter++;
        isFirstChunk = false;
      } else {
        const errorText = await response.text();
        console.error('[RECORDING PAGE] Webhook error:', response.status, errorText);
        recordingDebugger.trackWebhookAttempt(chunkCounter, false, `HTTP ${response.status}: ${errorText}`, responseTime);
      }
    } catch (error) {
      console.error('[RECORDING PAGE] Error sending to webhook:', error);
      recordingDebugger.trackWebhookAttempt(chunkCounter, false, error.message);
      recordingDebugger.trackError(error, 'webhook_send');
    }
  };
}

// Stop recording
function stopRecording() {
  console.log('[RECORDING PAGE] Stopping recording...');
  
  window.isRecordingStopping = true;
  
  if (recordingInterval) {
    clearInterval(recordingInterval);
    recordingInterval = null;
  }
  
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  
  if (audioStream) {
    audioStream.getTracks().forEach(track => track.stop());
    audioStream = null;
  }
  
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
  
  if (audioContext) {
    audioContext.close();
  }
  
  // Generate debug report
  const report = recordingDebugger.generateReport();
  console.log('[RECORDING PAGE] Debug report generated:', report);
  
  // Show summary in status
  let statusMessage = '✅ Recording stopped.';
  if (report.errors.length > 0) {
    statusMessage += ` ⚠️ ${report.errors.length} errors detected.`;
  }
  if (report.chunks.missing > 0) {
    statusMessage += ` Missing ${report.chunks.missing} chunks.`;
  }
  statusMessage += ' Click "Start Recording" to begin a new session.';
  
  // Update UI
  updateStatus('ready', statusMessage);
  btnStart.style.display = 'inline-block';
  btnStop.style.display = 'none';
  webhookInput.disabled = false;
  audioLevels.classList.remove('active');
  
  // Add export button if there were issues
  if (report.errors.length > 0 || report.analysis.length > 0) {
    const exportBtn = document.createElement('button');
    exportBtn.textContent = 'Export Debug Log';
    exportBtn.style.marginTop = '10px';
    exportBtn.onclick = () => recordingDebugger.exportDebugData();
    document.querySelector('.container').appendChild(exportBtn);
  }
  
  window.isRecordingStopping = false;
}

// Helper function
function generateMeetingId(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace('www.', '');
    return hostname.substring(0, 50);
  } catch (e) {
    return 'arc-browser-recording';
  }
}