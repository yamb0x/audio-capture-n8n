// Add this at the beginning of your popup.js, right after line 10

// Force microphone permission check on popup load
async function checkMicrophonePermission() {
  console.log('[POPUP] Checking microphone permission status...');
  
  try {
    // Check current permission state
    const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
    console.log('[POPUP] Current permission state:', permissionStatus.state);
    
    if (permissionStatus.state === 'denied') {
      updateStatus('error', 'Microphone access denied');
      alert('Microphone access is denied. Please reset permissions in Chrome settings:\n\nchrome://settings/content/microphone');
      return false;
    }
    
    if (permissionStatus.state === 'prompt') {
      console.log('[POPUP] Permission not yet granted, will request on recording start');
    }
    
    // Listen for permission changes
    permissionStatus.onchange = () => {
      console.log('[POPUP] Permission state changed to:', permissionStatus.state);
      if (permissionStatus.state === 'denied') {
        updateStatus('error', 'Microphone access denied');
        stopRecording();
      }
    };
    
    return true;
  } catch (error) {
    console.error('[POPUP] Error checking permissions:', error);
    // Permissions API might not be available, continue anyway
    return true;
  }
}

// Call this when popup loads
checkMicrophonePermission();

// Add a "Request Microphone" button handler
function addMicrophoneTestButton() {
  // Create a test button if it doesn't exist
  const container = document.querySelector('.container');
  if (container && !document.getElementById('requestMicBtn')) {
    const requestBtn = document.createElement('button');
    requestBtn.id = 'requestMicBtn';
    requestBtn.textContent = 'Request Microphone Access';
    requestBtn.style.cssText = 'margin: 10px 0; padding: 8px 16px; background: #ff9800; color: white; border: none; border-radius: 4px; cursor: pointer;';
    
    requestBtn.addEventListener('click', async () => {
      console.log('[POPUP] Manually requesting microphone permission...');
      try {
        // This will force the permission prompt
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        
        console.log('[POPUP] Microphone permission GRANTED!');
        updateStatus('ready', 'Microphone access granted!');
        
        // Create a visual indicator that mic is working
        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        const microphone = audioContext.createMediaStreamSource(stream);
        microphone.connect(analyser);
        
        // Check audio level once
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        
        console.log('[POPUP] Current audio level:', average);
        alert(`Microphone access granted!\n\nAudio level: ${average.toFixed(1)}\n\nYou can now use the Start Recording button.`);
        
        // Clean up
        stream.getTracks().forEach(track => track.stop());
        audioContext.close();
        
        // Hide the request button
        requestBtn.style.display = 'none';
        
      } catch (error) {
        console.error('[POPUP] Microphone permission DENIED:', error);
        
        if (error.name === 'NotAllowedError') {
          if (error.message.includes('Permission denied')) {
            alert('Microphone permission was denied.\n\nTo fix this:\n1. Click the lock icon in the address bar\n2. Set Microphone to "Allow"\n3. Reload the extension');
          } else if (error.message.includes('Permission dismissed')) {
            alert('You dismissed the permission dialog.\n\nPlease click the button again and select "Allow" when prompted.');
          }
        } else if (error.name === 'NotFoundError') {
          alert('No microphone found!\n\nPlease connect a microphone and try again.');
        } else {
          alert(`Error: ${error.message}\n\nPlease check your microphone settings.`);
        }
        
        updateStatus('error', 'Microphone access denied');
      }
    });
    
    // Insert before the webhook input
    const webhookGroup = document.querySelector('.input-group');
    container.insertBefore(requestBtn, webhookGroup);
  }
}

// Add the button when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', addMicrophoneTestButton);
} else {
  addMicrophoneTestButton();
}

// Also modify the startRecording function to be more aggressive with permissions
// Replace the getUserMedia call (around line 181) with this:

async function startRecording(webhookUrl) {
  console.log('[POPUP] startRecording called');
  try {
    console.log('[POPUP] Requesting microphone access...');
    
    // First, check if we can access media devices at all
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Media devices not available. Make sure you are using HTTPS or localhost.');
    }
    
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
    
    // Add a timeout to detect if permission prompt is stuck
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Permission request timeout - no response after 15 seconds')), 15000);
    });
    
    // Race between getUserMedia and timeout
    audioStream = await Promise.race([
      navigator.mediaDevices.getUserMedia(constraints),
      timeoutPromise
    ]);
    
    console.log('[POPUP] Got audio stream:', audioStream);
    console.log('[POPUP] Audio stream active:', audioStream.active);
    console.log('[POPUP] Audio tracks:', audioStream.getAudioTracks().length);
    
    // Rest of your existing startRecording code...
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
    
    // Provide specific guidance based on error type
    let errorMessage = 'Microphone error: ';
    
    if (error.name === 'NotAllowedError') {
      errorMessage = 'Microphone permission denied. Click "Request Microphone Access" button first.';
    } else if (error.name === 'NotFoundError') {
      errorMessage = 'No microphone found. Please connect a microphone.';
    } else if (error.message.includes('timeout')) {
      errorMessage = 'Permission request timed out. Your browser may be blocking popups.';
    } else {
      errorMessage += error.message;
    }
    
    updateStatus('error', errorMessage);
    setTimeout(() => updateStatus('ready', 'Ready'), 5000);
  }
}