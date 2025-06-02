console.log('[POPUP] Popup script loaded - Version 1.2 with enhanced debugging');
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
    
    // Save webhook URL
    const webhookUrl = webhookInput.value.trim();
    console.log('[POPUP] Webhook input value:', webhookInput.value);
    console.log('[POPUP] Trimmed webhook URL:', webhookUrl);
    
    if (!webhookUrl) {
      console.log('[POPUP] No webhook URL provided');
      alert('Please enter a webhook URL');
      updateStatus('ready', 'Ready');
      return;
    }
    console.log('[POPUP] Saving webhook URL:', webhookUrl);
    chrome.storage.local.set({webhookUrl: webhookUrl});
    
    console.log('[POPUP] Starting tab capture...');
    
    // Capture tab audio in popup context (Manifest V3 requirement)
    chrome.tabCapture.capture(
      {
        audio: true,
        video: false,
        audioConstraints: {
          mandatory: {
            chromeMediaSource: 'tab',
            echoCancellation: true
          }
        }
      },
      (stream) => {
        console.log('[POPUP] Tab capture callback, stream:', stream);
        console.log('[POPUP] Chrome runtime lastError:', chrome.runtime.lastError);
        
        if (chrome.runtime.lastError) {
          console.error('[POPUP] Chrome runtime error:', chrome.runtime.lastError);
          updateStatus('error', chrome.runtime.lastError.message);
          setTimeout(() => updateStatus('ready', 'Ready'), 3000);
          return;
        }
        
        if (!stream) {
          console.error('[POPUP] Failed to capture tab audio - no stream');
          updateStatus('error', 'Failed to capture audio');
          setTimeout(() => updateStatus('ready', 'Ready'), 3000);
          return;
        }
        
        console.log('[POPUP] Successfully captured stream, extracting meeting metadata');
        
        // Extract meeting metadata from tab URL
        const meetingData = extractMeetingMetadata(tab.url);
        meetingId = meetingData.meetingId;
        meetingUrl = meetingData.meetingUrl;
        pageTitle = tab.title || 'Untitled';
        
        // Generate unique session ID for this recording session
        recordingSessionId = generateSessionId();
        chunkCounter = 0;
        isFirstChunk = true;
        
        console.log('[POPUP] Meeting metadata:', { meetingId, meetingUrl, recordingSessionId });
        
        // Send the stream to background for setup
        chrome.runtime.sendMessage({
          action: 'setupRecording',
          tabId: tab.id,
          webhookUrl: webhookUrl,
          meetingId: meetingId,
          meetingUrl: meetingUrl,
          recordingSessionId: recordingSessionId
        }, (response) => {
          console.log('[POPUP] Setup recording response:', response);
          
          if (response && response.status === 'ready') {
            // Start the MediaRecorder in popup context
            startMediaRecorder(stream, webhookUrl);
          } else {
            updateStatus('error', response?.message || 'Failed to setup recording');
            setTimeout(() => updateStatus('ready', 'Ready'), 3000);
          }
        });
      }
    );
    
  } catch (error) {
    console.error('[POPUP] Error in start button click:', error);
    console.error('[POPUP] Error details:', error.message, error.stack);
    updateStatus('error', `Error: ${error.message}`);
    setTimeout(() => updateStatus('ready', 'Ready'), 3000);
  }
});

let mediaRecorder = null;
let audioChunks = [];
let recordingInterval = null;
let chunkCounter = 0;
let recordingSessionId = null;
let meetingId = null;
let meetingUrl = null;
let pageTitle = null;
let isFirstChunk = true;

function startMediaRecorder(stream, webhookUrl) {
  console.log('[POPUP] Starting MediaRecorder with stream');
  
  try {
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm'
    });
    
    console.log('[POPUP] MediaRecorder created successfully');
    
    mediaRecorder.ondataavailable = (event) => {
      console.log('[POPUP] Data available, size:', event.data.size);
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };
    
    mediaRecorder.onstop = () => {
      console.log('[POPUP] MediaRecorder onstop event fired');
      console.log('[POPUP] onstop - audioChunks length:', audioChunks.length);
      console.log('[POPUP] onstop - isRecordingStopping flag:', window.isRecordingStopping);
      
      // Always send the chunk (the isLastChunk flag is set in sendAudioToWebhook)
      sendAudioToWebhook(webhookUrl);
      
      // Reset the flag after sending
      if (window.isRecordingStopping) {
        window.isRecordingStopping = false;
        console.log('[POPUP] Reset isRecordingStopping flag');
      }
      
      audioChunks = [];
    };
    
    mediaRecorder.onerror = (event) => {
      console.error('[POPUP] MediaRecorder error:', event.error);
      updateStatus('error', 'Recording error');
    };
    
    // Start recording
    mediaRecorder.start();
    
    // Send audio every 30 seconds
    recordingInterval = setInterval(() => {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        console.log('[POPUP] Restarting recorder for next chunk');
        mediaRecorder.stop();
        mediaRecorder.start();
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
  
  if (audioChunks.length === 0) {
    console.log('[POPUP] No audio chunks to send');
    return;
  }
  
  const audioBlob = new Blob(audioChunks, {type: 'audio/webm'});
  console.log('[POPUP] Created audio blob, size:', audioBlob.size, 'bytes');
  
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
    
    try {
      console.log('[POPUP] Sending audio chunk to n8n webhook:', webhookUrl);
      console.log('[POPUP] Payload size:', JSON.stringify({
        audioLength: base64Audio.length,
        meetingId: chunkMetadata.meetingId,
        chunkIndex: chunkMetadata.chunkIndex,
        isFirstChunk: chunkMetadata.isFirstChunk,
        isLastChunk: chunkMetadata.isLastChunk
      }));
      
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
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      
      console.log('[POPUP] n8n webhook response status:', response.status);
      const responseText = await response.text();
      console.log('[POPUP] n8n webhook response:', responseText);
      
      if (!response.ok) {
        console.error('[POPUP] Failed to send audio to n8n webhook, status:', response.status);
        console.error('[POPUP] Response text:', responseText);
      } else {
        console.log('[POPUP] Audio chunk sent successfully to n8n');
        
        // Also send a copy to local dashboard for monitoring (if running)
        if (webhookUrl !== 'http://localhost:5678/webhook/meeting-audio') {
          try {
            await fetch('http://localhost:5678/webhook/meeting-audio', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(payload)
            });
            console.log('[POPUP] Also sent to local dashboard for monitoring');
          } catch (e) {
            // Dashboard not running, ignore
          }
        }
      }
      
      // Update counters for next chunk
      chunkCounter++;
      isFirstChunk = false;
      
      // Update storage with new chunk counter
      chrome.storage.local.get(['recordingData'], (result) => {
        if (result.recordingData) {
          result.recordingData.chunkCounter = chunkCounter;
          result.recordingData.isFirstChunk = isFirstChunk;
          chrome.storage.local.set({recordingData: result.recordingData});
        }
      });
      
    } catch (error) {
      console.error('[POPUP] Error sending audio to n8n webhook:', error);
    }
  };
  
  reader.onerror = (error) => {
    console.error('[POPUP] Error reading audio blob:', error);
  };
}

stopBtn.addEventListener('click', () => {
  console.log('[POPUP] Stop button clicked');
  console.log('[POPUP] Recording state before stop:', {
    isRecording: currentStatus === 'recording',
    hasMediaRecorder: !!mediaRecorder,
    mediaRecorderState: mediaRecorder?.state,
    recordingSessionId: recordingSessionId
  });
  
  updateStatus('connecting', 'Stopping...');
  
  stopMediaRecorder();
  
  chrome.runtime.sendMessage({action: 'stopRecording'}, (response) => {
    console.log('[POPUP] Stop recording response:', response);
    
    // Clear recording state from storage
    chrome.storage.local.remove(['isRecording', 'recordingData']);
    
    updateStatus('ready', 'Ready');
    updateUI(false);
  });
});

function stopMediaRecorder() {
  console.log('[POPUP] stopMediaRecorder called');
  console.log('[POPUP] Current state:', {
    hasMediaRecorder: !!mediaRecorder,
    mediaRecorderState: mediaRecorder?.state,
    audioChunksLength: audioChunks.length,
    chunkCounter: chunkCounter,
    recordingSessionId: recordingSessionId
  });
  
  if (recordingInterval) {
    console.log('[POPUP] Clearing recording interval');
    clearInterval(recordingInterval);
    recordingInterval = null;
  }
  
  if (mediaRecorder) {
    console.log('[POPUP] Stopping MediaRecorder and stream tracks');
    console.log('[POPUP] MediaRecorder state before stop:', mediaRecorder.state);
    
    // Store current audio chunks before stopping
    const finalChunks = [...audioChunks];
    console.log('[POPUP] Stored', finalChunks.length, 'chunks before stopping');
    
    // Set global flag to indicate we're stopping for final chunk
    window.isRecordingStopping = true;
    console.log('[POPUP] Set isRecordingStopping flag to true');
    
    // Stop the recorder which will trigger onstop event
    // The onstop event will call sendAudioToWebhook with the final flag
    mediaRecorder.stop();
    if (mediaRecorder.stream) {
      mediaRecorder.stream.getTracks().forEach(track => {
        console.log('[POPUP] Stopping track:', track.kind);
        track.stop();
      });
    }
    mediaRecorder = null;
    console.log('[POPUP] Recording stopped completely');
  } else {
    console.log('[POPUP] No mediaRecorder to stop');
  }
}

async function sendFinalAudioChunk() {
  console.log('[POPUP] sendFinalAudioChunk called');
  const webhookUrl = webhookInput.value;
  console.log('[POPUP] Final chunk webhook URL:', webhookUrl);
  console.log('[POPUP] Final chunk metadata:', {
    recordingSessionId: recordingSessionId,
    meetingId: meetingId,
    chunkCounter: chunkCounter,
    audioChunksLength: audioChunks.length
  });
  
  // Create audio blob if there are chunks, otherwise send empty audio
  const audioBlob = audioChunks.length > 0 
    ? new Blob(audioChunks, {type: 'audio/webm'})
    : new Blob([], {type: 'audio/webm'});
  
  console.log('[POPUP] Created final audio blob, size:', audioBlob.size);
  
  const reader = new FileReader();
  reader.readAsDataURL(audioBlob);
  reader.onloadend = async () => {
    console.log('[POPUP] FileReader onloadend triggered for final chunk');
    const base64Audio = audioChunks.length > 0 
      ? reader.result.split(',')[1]
      : ''; // Empty audio for final marker chunk
    
    console.log('[POPUP] Final chunk base64 length:', base64Audio.length);
    
    try {
      console.log('[POPUP] Sending FINAL audio chunk to n8n');
      const payload = {
        // Core audio data
        audio: base64Audio,
        timestamp: new Date().toISOString(),
        duration: audioChunks.length > 0 ? 30 : 0, // 0 duration if no audio
        format: 'webm',
        
        // Recording identification
        recordingSessionId: recordingSessionId,
        meetingId: meetingId,
        meetingUrl: meetingUrl,
        
        // Chunk metadata
        chunkIndex: chunkCounter,
        isFirstChunk: false,
        isLastChunk: true, // Always mark as last chunk
        
        // Extended metadata
        source: detectSource(meetingUrl),
        userAgent: navigator.userAgent,
        recordingType: detectRecordingType(meetingUrl),
        title: pageTitle || 'Untitled Recording'
      };
      
      console.log('[POPUP] Final chunk payload:', {
        ...payload,
        audio: `[base64 data ${payload.audio.length} chars]`
      });
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      
      console.log('[POPUP] Final chunk sent, status:', response.status);
      const responseText = await response.text();
      console.log('[POPUP] Final chunk response:', responseText);
      
      if (!response.ok) {
        console.error('[POPUP] Final chunk failed with status:', response.status);
      } else {
        console.log('[POPUP] Final chunk sent successfully!');
      }
      
    } catch (error) {
      console.error('[POPUP] Error sending final chunk:', error);
      console.error('[POPUP] Error details:', error.message, error.stack);
    }
  };
  
  reader.onerror = (error) => {
    console.error('[POPUP] FileReader error for final chunk:', error);
  };
}

// Helper function to extract meeting metadata from any URL
function extractMeetingMetadata(url) {
  console.log('[POPUP] Extracting metadata from URL:', url);
  
  let meetingId = 'recording';
  
  // Try to extract meeting ID from various platforms
  if (url.includes('meet.google.com')) {
    // Google Meet: https://meet.google.com/abc-defg-hij
    const meetIdMatch = url.match(/meet\.google\.com\/([a-z-]+)/i);
    meetingId = meetIdMatch ? meetIdMatch[1] : 'google-meet';
  } else if (url.includes('zoom.us')) {
    // Zoom: https://zoom.us/j/123456789
    const zoomMatch = url.match(/\/j\/(\d+)/);
    meetingId = zoomMatch ? `zoom-${zoomMatch[1]}` : 'zoom-meeting';
  } else if (url.includes('teams.microsoft.com')) {
    meetingId = 'teams-meeting';
  } else {
    // For other URLs, use the hostname
    try {
      const urlObj = new URL(url);
      meetingId = urlObj.hostname.replace(/\./g, '-');
    } catch (e) {
      meetingId = 'browser-recording';
    }
  }
  
  return {
    meetingId: meetingId,
    meetingUrl: url
  };
}

// Helper function to generate unique session ID
function generateSessionId() {
  return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Helper function to detect source platform
function detectSource(url) {
  if (url.includes('meet.google.com')) return 'google-meet';
  if (url.includes('zoom.us')) return 'zoom';
  if (url.includes('teams.microsoft.com')) return 'ms-teams';
  if (url.includes('whereby.com')) return 'whereby';
  if (url.includes('discord.com')) return 'discord';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('spotify.com')) return 'spotify';
  if (url.includes('soundcloud.com')) return 'soundcloud';
  return 'browser';
}

// Helper function to detect recording type
function detectRecordingType(url) {
  const videoCallPlatforms = ['meet.google.com', 'zoom.us', 'teams.microsoft.com', 'whereby.com'];
  const mediaPlatforms = ['youtube.com', 'youtu.be', 'spotify.com', 'soundcloud.com', 'netflix.com'];
  
  if (videoCallPlatforms.some(platform => url.includes(platform))) {
    return 'video-call';
  }
  if (mediaPlatforms.some(platform => url.includes(platform))) {
    return 'media-playback';
  }
  if (url.includes('discord.com') || url.includes('slack.com')) {
    return 'chat-audio';
  }
  return 'general-audio';
}

function updateUI(isRecording) {
  console.log('[POPUP] Updating UI, isRecording:', isRecording);
  if (isRecording) {
    startBtn.style.display = 'none';
    stopBtn.style.display = 'block';
    webhookInput.disabled = true;
  } else {
    startBtn.style.display = 'block';
    stopBtn.style.display = 'none';
    webhookInput.disabled = false;
  }
}