console.log('[POPUP] Popup script loaded - ENHANCED DEBUG VERSION 1.4 with Arc fix');
console.log('[POPUP] Debug version timestamp:', new Date().toISOString());

// Arc Browser Detection and Workaround
function isArcBrowser() {
  const ua = navigator.userAgent;
  // Arc has specific patterns in user agent
  return ua.includes('Arc/') || 
         (ua.includes('Chrome/') && 
          window.navigator.brave === undefined && 
          !ua.includes('Edg/') && 
          // Arc often has certain window properties
          window.chrome && 
          !window.opr);
}

console.log('[POPUP] Browser detection - Is Arc?:', isArcBrowser());

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusIndicator = document.getElementById('status');
const webhookInput = document.getElementById('webhookUrl');
const statusText = document.getElementById('statusText');
const requestMicBtn = document.getElementById('requestMicBtn');
const audioSourceSelect = document.getElementById('audioSource');

// Debug: Check if elements were found
console.log('[POPUP] UI Elements found:', {
  startBtn: !!startBtn,
  stopBtn: !!stopBtn,
  statusIndicator: !!statusIndicator,
  webhookInput: !!webhookInput,
  statusText: !!statusText,
  requestMicBtn: !!requestMicBtn,
  audioSourceSelect: !!audioSourceSelect
});

let currentStatus = 'ready';

function updateStatus(status, message) {
  console.log('[POPUP] Status update:', status, message);
  currentStatus = status;
  
  // Update visual indicator
  statusIndicator.className = `status ${status}`;
  
  // Update status text
  if (statusText) {
    statusText.textContent = message;
  }
}

// Load saved webhook URL or use default
console.log('[POPUP] Loading saved webhook URL from storage');
const DEFAULT_WEBHOOK_URL = 'http://localhost:5678/webhook/meeting-audio?forward=true';

chrome.storage.local.get(['webhookUrl'], (result) => {
  console.log('[POPUP] Storage result:', result);
  
  // Force use new dashboard URL - clear old n8n direct URL
  if (result.webhookUrl && result.webhookUrl.includes('yambo-studio.app.n8n.cloud')) {
    console.log('[POPUP] Clearing old n8n direct URL, switching to dashboard forwarding');
    chrome.storage.local.remove(['webhookUrl']);
    webhookInput.value = DEFAULT_WEBHOOK_URL;
    chrome.storage.local.set({webhookUrl: DEFAULT_WEBHOOK_URL});
  } else if (result.webhookUrl) {
    webhookInput.value = result.webhookUrl;
    console.log('[POPUP] Loaded webhook URL:', result.webhookUrl);
  } else {
    // Set default webhook URL
    webhookInput.value = DEFAULT_WEBHOOK_URL;
    console.log('[POPUP] Using default webhook URL:', DEFAULT_WEBHOOK_URL);
    // Save it for future use
    chrome.storage.local.set({webhookUrl: DEFAULT_WEBHOOK_URL});
  }
});

// Load saved audio source preference
chrome.storage.local.get(['audioSource', 'activeRecordingSource'], (result) => {
  console.log('[POPUP] Loaded audio preferences:', result);
  
  // If there's an active recording, show that source
  if (result.activeRecordingSource) {
    audioSourceSelect.value = result.activeRecordingSource;
    console.log('[POPUP] Active recording with source:', result.activeRecordingSource);
  } else if (result.audioSource) {
    // Otherwise use the last selected source
    audioSourceSelect.value = result.audioSource;
    console.log('[POPUP] Restored audio source:', result.audioSource);
  }
});

// Save audio source when changed
audioSourceSelect.addEventListener('change', () => {
  const selectedSource = audioSourceSelect.value;
  console.log('[POPUP] Audio source changed to:', selectedSource);
  chrome.storage.local.set({ audioSource: selectedSource });
});

// Check current recording status from storage and background
console.log('[POPUP] Checking current recording status');
updateStatus('ready', 'Ready');

// Check storage first for persistent state
setTimeout(() => {
  chrome.storage.local.get(['isRecording', 'recordingData'], (result) => {
    console.log('[POPUP] Storage recording state:', result);
    
    // Also check background script state
    chrome.runtime.sendMessage({action: 'getStatus'}, (response) => {
      console.log('[POPUP] Background status response:', response);
      
      const isRecording = result.isRecording === true;
      
      if (isRecording) {
        // Restore recording state
        if (result.recordingData) {
          meetingId = result.recordingData.meetingId;
          meetingUrl = result.recordingData.meetingUrl;
          recordingSessionId = result.recordingData.recordingSessionId;
          chunkCounter = result.recordingData.chunkCounter || 0;
          isFirstChunk = result.recordingData.isFirstChunk || false;
          pageTitle = result.recordingData.pageTitle || 'Untitled';
          
          // Show recording status with audio source
          const audioSource = result.recordingData.audioSource || 'microphone';
          const sourceText = audioSource === 'microphone' ? 'Microphone' : 
                             audioSource === 'system' ? 'System Audio' : 
                             'Microphone + System';
          updateStatus('recording', `Recording (${sourceText})`);
        } else {
          updateStatus('recording', 'Recording');
        }
        console.log('[POPUP] Restoring recording state, calling updateUI(true)');
        updateUI(true);
      } else {
        // Clear any stale storage state
        chrome.storage.local.remove(['isRecording', 'recordingData']);
        updateStatus('ready', 'Ready');
        updateUI(false);
      }
    });
  });
}, 100); // Small delay to ensure DOM is ready

startBtn.addEventListener('click', async () => {
  console.log('[POPUP] Start button clicked');
  
  // Check if already recording to prevent multiple sessions
  const storageResult = await new Promise(resolve => 
    chrome.storage.local.get(['isRecording'], resolve)
  );
  
  if (storageResult.isRecording) {
    console.log('[POPUP] Already recording, ignoring start request');
    updateStatus('recording', 'Recording');
    updateUI(true);
    return;
  }
  
  updateStatus('connecting', 'Connecting...');
  
  try {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    console.log('[POPUP] Active tab:', tab);
    
    // Removed Google Meet restriction - can now record any tab
    console.log('[POPUP] Recording from:', tab.url);
    
    const webhookUrl = webhookInput.value;
    
    // Save webhook URL
    chrome.storage.local.set({webhookUrl: webhookUrl});
    
    // Generate IDs for this session
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 11);
    recordingSessionId = `session_${timestamp}_${randomSuffix}`;
    meetingId = generateMeetingId(tab.url);
    meetingUrl = tab.url;
    pageTitle = tab.title;
    
    console.log('[POPUP] Generated recording session ID:', recordingSessionId);
    console.log('[POPUP] Generated meeting ID:', meetingId);
    console.log('[POPUP] Page title:', pageTitle);
    
    // Setup recording in background
    chrome.runtime.sendMessage({
      action: 'setupRecording',
      tabId: tab.id,
      webhookUrl: webhookUrl,
      meetingId: meetingId,
      recordingSessionId: recordingSessionId
    }, (response) => {
      console.log('[POPUP] Setup response:', response);
      if (response && response.status === 'ready') {
        // Request microphone access
        startRecording(webhookUrl);
      }
    });
    
  } catch (error) {
    console.error('[POPUP] Error starting recording:', error);
    updateStatus('error', error.message);
    setTimeout(() => updateStatus('ready', 'Ready'), 3000);
  }
});

stopBtn.addEventListener('click', () => {
  console.log('[POPUP] Stop button clicked');
  stopRecording();
});

// Add microphone permission request button handler
requestMicBtn.addEventListener('click', async () => {
  console.log('[POPUP] Request microphone permission button clicked');
  
  // Arc Browser special handling
  if (isArcBrowser()) {
    console.log('[POPUP] Arc browser detected - using special handling');
    
    // First try: Check if we already have permission
    try {
      const testStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      testStream.getTracks().forEach(track => track.stop());
      
      // We have permission!
      console.log('[POPUP] Already have permission in Arc!');
      updateStatus('ready', 'Permission already granted!');
      requestMicBtn.style.display = 'none';
      alert('Microphone permission already granted!\n\nYou can now click "Start Recording".');
      return;
      
    } catch (testError) {
      // No permission yet
      console.log('[POPUP] No permission yet in Arc, opening recording page...');
      
      // Open the recording page in a new tab for Arc
      const recordingPageUrl = chrome.runtime.getURL('recording-page.html');
      chrome.tabs.create({ url: recordingPageUrl }, (tab) => {
        console.log('[POPUP] Opened recording page in tab:', tab.id);
        
        updateStatus('ready', 'Please grant permission in the new tab');
        alert('Arc Browser Permission Fix:\n\n1. A new tab has been opened\n2. Click "Request Microphone Permission" there\n3. Grant permission when Arc asks\n4. Come back here and click "Start Recording"\n\nThis is a one-time setup for Arc.');
      });
      
      return;
    }
  }
  
  // Regular Chrome/other browsers
  try {
    updateStatus('connecting', 'Requesting permission...');
    
    // Force permission prompt
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    
    console.log('[POPUP] Microphone permission GRANTED!');
    updateStatus('ready', 'Permission granted!');
    
    // Test audio level
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const microphone = audioContext.createMediaStreamSource(stream);
    microphone.connect(analyser);
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    setTimeout(() => {
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      console.log('[POPUP] Test audio level:', average);
      
      if (average > 0) {
        alert('Microphone permission granted and working!\nAudio level detected: ' + average.toFixed(1) + '\n\nYou can now click "Start Recording".');
      } else {
        alert('Microphone permission granted!\n\nNote: No audio detected. Make sure:\n- Your microphone is not muted\n- The correct microphone is selected in system settings');
      }
      
      // Cleanup
      stream.getTracks().forEach(track => track.stop());
      audioContext.close();
      
      // Hide permission button after success
      requestMicBtn.style.display = 'none';
    }, 500);
    
  } catch (error) {
    console.error('[POPUP] Microphone permission error:', error);
    
    let message = 'Permission error: ';
    if (error.name === 'NotAllowedError') {
      if (error.message.includes('Permission denied')) {
        message = 'Permission denied by browser. Reset in Chrome settings.';
        alert('Microphone permission is blocked!\n\nTo fix:\n1. Go to chrome://settings/content/microphone\n2. Remove any blocks\n3. Or click the lock icon in the address bar');
      } else if (error.message.includes('Permission dismissed')) {
        message = 'Permission dismissed. Click again and select Allow.';
        alert('You closed the permission dialog.\n\nPlease click the button again and make sure to click "Allow" when Chrome asks for microphone permission.');
      }
    } else if (error.name === 'NotFoundError') {
      message = 'No microphone found.';
      alert('No microphone detected!\n\nPlease:\n1. Connect a microphone\n2. Check system sound settings\n3. Try again');
    } else {
      message = error.message;
    }
    
    updateStatus('error', message);
    setTimeout(() => updateStatus('ready', 'Ready'), 3000);
  }
});

// Save webhook URL on change
webhookInput.addEventListener('change', (e) => {
  console.log('[POPUP] Webhook URL changed to:', e.target.value);
  chrome.storage.local.set({webhookUrl: e.target.value});
});

function updateUI(isRecording) {
  console.log('[POPUP] Updating UI, isRecording:', isRecording);
  if (isRecording) {
    startBtn.style.display = 'none';
    stopBtn.style.display = 'block';
    startBtn.disabled = true;
    stopBtn.disabled = false;
    // Disable audio source selector during recording
    audioSourceSelect.disabled = true;
    webhookInput.disabled = true;
  } else {
    startBtn.style.display = 'block';
    stopBtn.style.display = 'none';
    startBtn.disabled = false;
    stopBtn.disabled = true;
    // Enable audio source selector when not recording
    audioSourceSelect.disabled = false;
    webhookInput.disabled = false;
  }
}

// Recording functionality
let mediaRecorder = null;
let audioChunks = [];
let recordingInterval = null;
let audioStream = null;
let audioCaptureHandler = null;

async function startRecording(webhookUrl) {
  console.log('[POPUP] startRecording called');
  
  // Arc Browser check - if no permission, redirect to recording page
  if (isArcBrowser()) {
    try {
      // Quick test if we have permission
      const testStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      testStream.getTracks().forEach(track => track.stop());
      console.log('[POPUP] Arc has permission, continuing...');
    } catch (error) {
      if (error.name === 'NotAllowedError') {
        console.log('[POPUP] Arc permission issue in startRecording, opening recording page...');
        const recordingPageUrl = chrome.runtime.getURL('recording-page.html');
        chrome.tabs.create({ url: recordingPageUrl });
        updateStatus('error', 'Please use the recording page for Arc');
        alert('Arc Browser requires the full page for recording.\n\nA new tab has been opened. Please use that for recording.');
        return;
      }
    }
  }
  
  try {
    // Get selected audio source
    const audioSource = audioSourceSelect.value;
    console.log('[POPUP] Selected audio source:', audioSource);
    
    // Get current tab for system audio
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];
    console.log('[POPUP] Current tab:', currentTab);
    
    // Check system audio availability
    if (audioSource !== 'microphone') {
      const availability = await AudioCaptureHandler.checkSystemAudioAvailability();
      console.log('[POPUP] System audio availability:', availability);
      
      if (!availability.available) {
        updateStatus('error', `System audio not available: ${availability.reason}`);
        // Fall back to microphone only
        audioSourceSelect.value = 'microphone';
        alert(`System audio capture not available: ${availability.reason}\n\nFalling back to microphone only.`);
      }
    }
    
    // Initialize audio capture handler
    audioCaptureHandler = new AudioCaptureHandler();
    
    // Get audio stream based on selected source
    console.log('[POPUP] Getting audio stream for source:', audioSourceSelect.value);
    audioStream = await audioCaptureHandler.getAudioStream(audioSourceSelect.value, currentTab.id);
    
    console.log('[POPUP] Got audio stream:', audioStream);
    console.log('[POPUP] Audio stream active:', audioStream.active);
    console.log('[POPUP] Audio tracks:', audioStream.getAudioTracks().length);
    
    // Analyze audio tracks
    const audioTracks = audioStream.getAudioTracks();
    audioTracks.forEach((track, index) => {
      console.log(`[POPUP] Audio track ${index}:`, {
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
        label: track.label,
        settings: track.getSettings()
      });
    });
    
    // Create audio context to analyze audio levels using modern AudioWorklet
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const microphone = audioContext.createMediaStreamSource(audioStream);
    
    analyser.smoothingTimeConstant = 0.8;
    analyser.fftSize = 1024;
    
    microphone.connect(analyser);
    
    try {
      // Load AudioWorklet processor (modern replacement for ScriptProcessorNode)
      await audioContext.audioWorklet.addModule('./audio-processor.js');
      
      // Create AudioWorkletNode
      const audioWorkletNode = new AudioWorkletNode(audioContext, 'audio-level-processor');
      
      // Connect the audio pipeline
      microphone.connect(audioWorkletNode);
      audioWorkletNode.connect(audioContext.destination);
      
      // Listen for audio level messages from the worklet
      audioWorkletNode.port.onmessage = (event) => {
        if (event.data.type === 'audioLevel') {
          const average = event.data.level;
          console.log('[POPUP] Audio level average:', average.toFixed(2));
          if (average < 1) {
            console.warn('[POPUP] WARNING: Audio level very low - check microphone!');
          }
        }
      };
      
      console.log('[POPUP] Modern AudioWorklet analysis setup complete');
      
    } catch (error) {
      console.warn('[POPUP] AudioWorklet not supported, falling back to AnalyserNode only:', error);
      
      // Fallback: use just AnalyserNode for basic level checking without deprecated ScriptProcessor
      setInterval(() => {
        const array = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(array);
        const values = array.reduce((a, b) => a + b, 0);
        const average = values / array.length;
        
        if (average > 0) {
          console.log('[POPUP] Audio level average (fallback):', average.toFixed(2));
        }
      }, 2000); // Check every 2 seconds instead of every frame
      
      console.log('[POPUP] Fallback audio analysis setup complete');
    }
    
    // Reset recording state
    chunkCounter = 0;
    isFirstChunk = true;
    
    // Start MediaRecorder
    startMediaRecorder(audioStream, webhookUrl);
    
  } catch (error) {
    console.error('[POPUP] Error accessing microphone:', error);
    console.error('[POPUP] Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    updateStatus('error', `Microphone error: ${error.message}`);
    setTimeout(() => updateStatus('ready', 'Ready'), 3000);
  }
}

// Generate a readable meeting ID from URL
function generateMeetingId(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace('www.', '');
    const path = urlObj.pathname.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').toLowerCase();
    return `${hostname}${path}`.substring(0, 50);
  } catch (e) {
    return 'unknown-meeting';
  }
}

let audioChunksSizes = []; // Track chunk sizes for debugging
let meetingId = null;
let meetingUrl = null;
let recordingSessionId = null;
let chunkCounter = 0;
let pageTitle = null;
let isFirstChunk = true;

function startMediaRecorder(stream, webhookUrl) {
  console.log('[POPUP] Starting MediaRecorder with stream');
  
  try {
    // Check supported MIME types
    const mimeTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4'
    ];
    
    let selectedMimeType = null;
    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        selectedMimeType = mimeType;
        console.log('[POPUP] Using MIME type:', mimeType);
        break;
      }
    }
    
    if (!selectedMimeType) {
      throw new Error('No supported audio MIME type found');
    }
    
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: selectedMimeType,
      audioBitsPerSecond: 128000 // 128 kbps
    });
    
    console.log('[POPUP] MediaRecorder created successfully');
    console.log('[POPUP] MediaRecorder state:', mediaRecorder.state);
    console.log('[POPUP] MediaRecorder mimeType:', mediaRecorder.mimeType);
    console.log('[POPUP] MediaRecorder audioBitsPerSecond:', mediaRecorder.audioBitsPerSecond);
    
    mediaRecorder.ondataavailable = (event) => {
      console.log('[POPUP] Data available event:', {
        size: event.data.size,
        type: event.data.type,
        timecode: event.timecode
      });
      
      if (event.data.size > 0) {
        audioChunks.push(event.data);
        audioChunksSizes.push(event.data.size);
        console.log('[POPUP] Audio chunk added. Total chunks:', audioChunks.length);
        console.log('[POPUP] Chunk sizes so far:', audioChunksSizes);
      } else {
        console.warn('[POPUP] WARNING: Received empty data chunk!');
      }
    };
    
    mediaRecorder.onstop = () => {
      console.log('[POPUP] MediaRecorder onstop event fired');
      console.log('[POPUP] onstop - audioChunks length:', audioChunks.length);
      console.log('[POPUP] onstop - Total size:', audioChunksSizes.reduce((a, b) => a + b, 0));
      console.log('[POPUP] onstop - isRecordingStopping flag:', window.isRecordingStopping);
      
      // Always send the chunk (the isLastChunk flag is set in sendAudioToWebhook)
      sendAudioToWebhook(webhookUrl);
      
      // Reset the flag after sending
      if (window.isRecordingStopping) {
        window.isRecordingStopping = false;
        console.log('[POPUP] Reset isRecordingStopping flag');
      }
      
      audioChunks = [];
      audioChunksSizes = [];
    };
    
    mediaRecorder.onerror = (event) => {
      console.error('[POPUP] MediaRecorder error:', event);
      console.error('[POPUP] Error details:', {
        error: event.error,
        type: event.type
      });
      updateStatus('error', 'Recording error');
    };
    
    mediaRecorder.onstart = () => {
      console.log('[POPUP] MediaRecorder started event');
      console.log('[POPUP] Recording state:', mediaRecorder.state);
    };
    
    // Start recording with larger timeslice for efficiency
    const timeslice = 5000; // Request data every 5 seconds instead of 1
    console.log('[POPUP] Starting MediaRecorder with timeslice:', timeslice);
    mediaRecorder.start(timeslice);
    
    // Send audio every 15 seconds for better reliability with long recordings
    const CHUNK_INTERVAL = 15000; // 15 seconds instead of 30
    recordingInterval = setInterval(() => {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        const totalSize = audioChunksSizes.reduce((a, b) => a + b, 0);
        console.log('[POPUP] Chunk interval - Current state:', {
          chunks: audioChunks.length,
          totalSize: totalSize,
          totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2) + ' MB'
        });
        
        // Check if we have accumulated data or size is getting large
        const SIZE_THRESHOLD = 5 * 1024 * 1024; // 5MB threshold
        if (audioChunks.length > 0 && (totalSize > SIZE_THRESHOLD || audioChunks.length > 3)) {
          console.log('[POPUP] Sending chunk - size threshold reached or enough chunks accumulated');
          mediaRecorder.stop();
          setTimeout(() => {
            if (mediaRecorder && !window.isRecordingStopping) {
              console.log('[POPUP] Restarting MediaRecorder after stop');
              mediaRecorder.start(timeslice);
            }
          }, 100);
        } else if (audioChunks.length > 0) {
          console.log('[POPUP] Have chunks but below threshold, will send at next interval');
        } else {
          console.log('[POPUP] No chunks accumulated yet');
        }
      }
    }, CHUNK_INTERVAL);
    
    // Notify background that recording started
    chrome.runtime.sendMessage({
      action: 'recordingStarted'
    });
    
    // Persist recording state to storage
    const currentAudioSource = audioSourceSelect.value;
    chrome.storage.local.set({
      isRecording: true,
      activeRecordingSource: currentAudioSource, // Save the source used for this recording
      recordingData: {
        meetingId: meetingId,
        meetingUrl: meetingUrl,
        recordingSessionId: recordingSessionId,
        chunkCounter: chunkCounter,
        isFirstChunk: isFirstChunk,
        pageTitle: pageTitle,
        startTime: new Date().toISOString(),
        audioSource: currentAudioSource
      }
    });
    
    // Show recording status with audio source
    const sourceText = currentAudioSource === 'microphone' ? 'Microphone' : 
                       currentAudioSource === 'system' ? 'System Audio' : 
                       'Microphone + System';
    updateStatus('recording', `Recording (${sourceText})`);
    console.log('[POPUP] About to call updateUI(true)');
    updateUI(true);
    console.log('[POPUP] After updateUI - startBtn display:', startBtn.style.display, 'stopBtn display:', stopBtn.style.display);
    
    console.log('[POPUP] Recording started successfully');
    
  } catch (error) {
    console.error('[POPUP] Error setting up MediaRecorder:', error);
    updateStatus('error', error.message);
    setTimeout(() => updateStatus('ready', 'Ready'), 3000);
  }
}

async function sendAudioToWebhook(webhookUrl) {
  console.log('[POPUP] sendAudioToWebhook called, chunks:', audioChunks.length);
  console.log('[POPUP] Chunk sizes:', audioChunksSizes);
  
  if (audioChunks.length === 0) {
    console.log('[POPUP] No audio chunks to send');
    return;
  }
  
  const audioBlob = new Blob(audioChunks, {type: 'audio/webm'});
  console.log('[POPUP] Created audio blob:', {
    size: audioBlob.size,
    type: audioBlob.type,
    sizeInMB: (audioBlob.size / (1024 * 1024)).toFixed(2) + ' MB'
  });
  
  // Validate blob size
  if (audioBlob.size < 1000) {
    console.warn('[POPUP] WARNING: Audio blob is suspiciously small:', audioBlob.size, 'bytes');
  }
  
  // Check if blob is too large (>10MB)
  const MAX_BLOB_SIZE = 10 * 1024 * 1024; // 10MB limit
  if (audioBlob.size > MAX_BLOB_SIZE) {
    console.warn('[POPUP] WARNING: Audio blob is very large:', (audioBlob.size / (1024 * 1024)).toFixed(2), 'MB');
    console.log('[POPUP] This might cause issues with transmission. Consider shorter chunks.');
  }
  
  // Prepare metadata for this chunk
  const chunkMetadata = {
    meetingId: meetingId,
    chunkIndex: chunkCounter,
    isFirstChunk: isFirstChunk,
    isLastChunk: window.isRecordingStopping || false, // Check if we're stopping
    meetingUrl: meetingUrl,
    recordingSessionId: recordingSessionId,
    pageTitle: pageTitle
  };
  
  console.log('[POPUP] Chunk metadata:', chunkMetadata);
  
  // Convert to base64
  const reader = new FileReader();
  reader.readAsDataURL(audioBlob);
  reader.onloadend = async () => {
    const base64Audio = reader.result.split(',')[1];
    console.log('[POPUP] Converted to base64, length:', base64Audio.length);
    console.log('[POPUP] Base64 preview (first 100 chars):', base64Audio.substring(0, 100));
    
    try {
      console.log('[POPUP] 📤 Sending audio chunk to webhook:', webhookUrl);
      console.log('[POPUP] Payload summary:', {
        audioLength: base64Audio.length,
        blobSize: audioBlob.size,
        meetingId: chunkMetadata.meetingId,
        chunkIndex: chunkMetadata.chunkIndex,
        isFirstChunk: chunkMetadata.isFirstChunk,
        isLastChunk: chunkMetadata.isLastChunk,
        targetUrl: webhookUrl
      });
      
      const payload = {
        // Core audio data
        audio: base64Audio,
        timestamp: new Date().toISOString(),
        duration: 30,
        format: 'webm',
        
        // Recording identification
        recordingSessionId: chunkMetadata.recordingSessionId,
        meetingId: chunkMetadata.meetingId,
        meetingUrl: chunkMetadata.meetingUrl,
        
        // Chunk metadata
        chunkIndex: chunkMetadata.chunkIndex,
        isFirstChunk: chunkMetadata.isFirstChunk,
        isLastChunk: chunkMetadata.isLastChunk,
        
        // Extended metadata for better context
        source: detectSource(chunkMetadata.meetingUrl),
        userAgent: navigator.userAgent,
        recordingType: detectRecordingType(chunkMetadata.meetingUrl),
        title: chunkMetadata.pageTitle || 'Untitled Recording'
      };
      
      // Implement retry logic for failed requests
      let retryCount = 0;
      const maxRetries = 3;
      let lastError = null;
      
      while (retryCount < maxRetries) {
        try {
          console.log('[POPUP] Sending request, attempt', retryCount + 1);
          
          // Create abort controller for timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
          
          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          console.log('[POPUP] Webhook response:', response.status, response.statusText);
          
          if (response.ok) {
            console.log('[POPUP] Audio chunk sent successfully');
            // Increment chunk counter for next chunk
            chunkCounter++;
            isFirstChunk = false;
            
            // Update persisted recording data
            chrome.storage.local.get(['recordingData'], (result) => {
              if (result.recordingData) {
                result.recordingData.chunkCounter = chunkCounter;
                result.recordingData.isFirstChunk = false;
                chrome.storage.local.set({recordingData: result.recordingData});
              }
            });
            break; // Success, exit retry loop
          } else {
            const errorText = await response.text();
            console.error('[POPUP] Webhook error:', response.status, errorText);
            lastError = `HTTP ${response.status}: ${errorText}`;
            
            // Don't retry on client errors (4xx)
            if (response.status >= 400 && response.status < 500) {
              console.error('[POPUP] Client error, not retrying');
              break;
            }
          }
        } catch (fetchError) {
          console.error('[POPUP] Fetch error:', fetchError);
          lastError = fetchError.message;
          
          if (fetchError.name === 'AbortError') {
            console.error('[POPUP] Request timed out after 30 seconds');
            lastError = 'Request timed out';
          }
        }
        
        retryCount++;
        if (retryCount < maxRetries) {
          console.log('[POPUP] Retrying in 2 seconds...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      if (retryCount === maxRetries && lastError) {
        console.error('[POPUP] Failed after', maxRetries, 'attempts:', lastError);
        updateStatus('error', 'Failed to send audio: ' + lastError);
        setTimeout(() => updateStatus('recording', 'Recording'), 5000);
      }
      
    } catch (error) {
      console.error('[POPUP] Error sending to webhook:', error);
      updateStatus('error', 'Failed to send audio');
      setTimeout(() => updateStatus('recording', 'Recording'), 3000);
    }
  };
}

function stopRecording() {
  console.log('[POPUP] stopRecording called');
  console.log('[POPUP] Current mediaRecorder state:', mediaRecorder?.state);
  console.log('[POPUP] Current audioChunks:', audioChunks.length);
  
  // Set flag to indicate we're stopping
  window.isRecordingStopping = true;
  console.log('[POPUP] Set isRecordingStopping flag to true');
  
  if (recordingInterval) {
    clearInterval(recordingInterval);
    recordingInterval = null;
    console.log('[POPUP] Cleared recording interval');
  }
  
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    console.log('[POPUP] Stopping MediaRecorder...');
    mediaRecorder.stop();
  }
  
  if (audioStream) {
    console.log('[POPUP] Stopping audio stream tracks...');
    audioStream.getTracks().forEach(track => {
      console.log('[POPUP] Stopping track:', track.label);
      track.stop();
    });
    audioStream = null;
  }
  
  // Stop audio capture handler
  if (audioCaptureHandler) {
    console.log('[POPUP] Stopping audio capture handler...');
    audioCaptureHandler.stopAllStreams();
    audioCaptureHandler = null;
  }
  
  // Clear storage (but keep the audio source preference)
  chrome.storage.local.remove(['isRecording', 'recordingData', 'activeRecordingSource']);
  
  // Notify background
  chrome.runtime.sendMessage({
    action: 'stopRecording'
  });
  
  updateStatus('ready', 'Ready');
  updateUI(false);
  
  console.log('[POPUP] Recording stopped');
}

// Helper functions
function detectSource(url) {
  if (url.includes('meet.google.com')) return 'google-meet';
  if (url.includes('zoom.us')) return 'zoom';
  if (url.includes('teams.microsoft.com')) return 'teams';
  if (url.includes('whereby.com')) return 'whereby';
  if (url.includes('discord.com')) return 'discord';
  return 'browser';
}

function detectRecordingType(url) {
  if (url.includes('meet.google.com') || 
      url.includes('zoom.us') || 
      url.includes('teams.microsoft.com')) {
    return 'meeting-audio';
  }
  if (url.includes('youtube.com') || 
      url.includes('vimeo.com')) {
    return 'video-audio';
  }
  return 'general-audio';
}

console.log('[POPUP] Script initialization complete');