console.log('[POPUP] Popup script loaded - ENHANCED DEBUG VERSION 1.3');
console.log('[POPUP] Debug version timestamp:', new Date().toISOString());

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusIndicator = document.getElementById('status');
const webhookInput = document.getElementById('webhookUrl');
const statusText = document.getElementById('statusText');

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
const DEFAULT_WEBHOOK_URL = 'https://yambo-studio.app.n8n.cloud/webhook/meeting-audio';

chrome.storage.local.get(['webhookUrl'], (result) => {
  console.log('[POPUP] Storage result:', result);
  if (result.webhookUrl) {
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

// Check current recording status from storage and background
console.log('[POPUP] Checking current recording status');
updateStatus('ready', 'Ready');

// Check storage first for persistent state
chrome.storage.local.get(['isRecording', 'recordingData'], (result) => {
  console.log('[POPUP] Storage recording state:', result);
  
  // Also check background script state
  chrome.runtime.sendMessage({action: 'getStatus'}, (response) => {
    console.log('[POPUP] Background status response:', response);
    
    const isRecording = (result.isRecording && response?.isRecording) || false;
    
    if (isRecording) {
      // Restore recording state
      if (result.recordingData) {
        meetingId = result.recordingData.meetingId;
        meetingUrl = result.recordingData.meetingUrl;
        recordingSessionId = result.recordingData.recordingSessionId;
        chunkCounter = result.recordingData.chunkCounter || 0;
        isFirstChunk = result.recordingData.isFirstChunk || false;
        pageTitle = result.recordingData.pageTitle || 'Untitled';
      }
      updateStatus('recording', 'Recording');
      updateUI(true);
    } else {
      // Clear any stale storage state
      chrome.storage.local.remove(['isRecording', 'recordingData']);
      updateStatus('ready', 'Ready');
      updateUI(false);
    }
  });
});

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

// Save webhook URL on change
webhookInput.addEventListener('change', (e) => {
  console.log('[POPUP] Webhook URL changed to:', e.target.value);
  chrome.storage.local.set({webhookUrl: e.target.value});
});

function updateUI(isRecording) {
  console.log('[POPUP] Updating UI, isRecording:', isRecording);
  startBtn.disabled = isRecording;
  stopBtn.disabled = !isRecording;
}

// Recording functionality
let mediaRecorder = null;
let audioChunks = [];
let recordingInterval = null;
let audioStream = null;

async function startRecording(webhookUrl) {
  console.log('[POPUP] startRecording called');
  try {
    console.log('[POPUP] Requesting microphone access...');
    
    // Enhanced getUserMedia with detailed constraints
    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000
      }
    };
    
    console.log('[POPUP] Audio constraints:', constraints);
    
    audioStream = await navigator.mediaDevices.getUserMedia(constraints);
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
    
    // Create audio context to analyze audio levels
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const microphone = audioContext.createMediaStreamSource(audioStream);
    const javascriptNode = audioContext.createScriptProcessor(2048, 1, 1);
    
    analyser.smoothingTimeConstant = 0.8;
    analyser.fftSize = 1024;
    
    microphone.connect(analyser);
    analyser.connect(javascriptNode);
    javascriptNode.connect(audioContext.destination);
    
    let audioLevelCheckCount = 0;
    javascriptNode.onaudioprocess = function() {
      const array = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(array);
      const values = array.reduce((a, b) => a + b, 0);
      const average = values / array.length;
      
      // Log audio levels every 100 frames (about 4 times per second)
      if (audioLevelCheckCount % 100 === 0) {
        console.log('[POPUP] Audio level average:', average.toFixed(2));
        if (average < 1) {
          console.warn('[POPUP] WARNING: Audio level very low - check microphone!');
        }
      }
      audioLevelCheckCount++;
    };
    
    console.log('[POPUP] Audio analysis setup complete');
    
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
    
    // Start recording with timeslice for debugging
    const timeslice = 1000; // Request data every 1 second for debugging
    console.log('[POPUP] Starting MediaRecorder with timeslice:', timeslice);
    mediaRecorder.start(timeslice);
    
    // Send audio every 30 seconds
    recordingInterval = setInterval(() => {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        console.log('[POPUP] 30-second interval - Restarting recorder for next chunk');
        console.log('[POPUP] Current chunks before stop:', audioChunks.length);
        mediaRecorder.stop();
        setTimeout(() => {
          if (mediaRecorder && !window.isRecordingStopping) {
            console.log('[POPUP] Restarting MediaRecorder after stop');
            mediaRecorder.start(timeslice);
          }
        }, 100);
      }
    }, 30000);
    
    // Notify background that recording started
    chrome.runtime.sendMessage({
      action: 'recordingStarted'
    });
    
    // Persist recording state to storage
    chrome.storage.local.set({
      isRecording: true,
      recordingData: {
        meetingId: meetingId,
        meetingUrl: meetingUrl,
        recordingSessionId: recordingSessionId,
        chunkCounter: chunkCounter,
        isFirstChunk: isFirstChunk,
        pageTitle: pageTitle,
        startTime: new Date().toISOString()
      }
    });
    
    updateStatus('recording', 'Recording');
    updateUI(true);
    
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
    type: audioBlob.type
  });
  
  // Validate blob size
  if (audioBlob.size < 1000) {
    console.warn('[POPUP] WARNING: Audio blob is suspiciously small:', audioBlob.size, 'bytes');
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
      console.log('[POPUP] Sending audio chunk to n8n webhook:', webhookUrl);
      console.log('[POPUP] Payload summary:', {
        audioLength: base64Audio.length,
        blobSize: audioBlob.size,
        meetingId: chunkMetadata.meetingId,
        chunkIndex: chunkMetadata.chunkIndex,
        isFirstChunk: chunkMetadata.isFirstChunk,
        isLastChunk: chunkMetadata.isLastChunk
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
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
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
      } else {
        console.error('[POPUP] Webhook error:', response.status, await response.text());
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
  
  // Clear storage
  chrome.storage.local.remove(['isRecording', 'recordingData']);
  
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