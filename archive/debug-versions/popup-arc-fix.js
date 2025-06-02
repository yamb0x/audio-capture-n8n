// Arc Browser Permission Workaround for Popup
// Add this to the beginning of your popup.js

// Check if we're running in Arc Browser
function isArcBrowser() {
  // Arc browser has specific user agent markers
  const ua = navigator.userAgent;
  return ua.includes('Arc/') || (ua.includes('Chrome/') && window.navigator.brave === undefined && !ua.includes('Edg/'));
}

// Arc-specific permission request handler
async function requestMicrophonePermissionArc() {
  console.log('[POPUP] Arc browser detected, using workaround...');
  
  // Method 1: Try opening a small window first
  try {
    // Create a minimal HTML page for permission request
    const permissionHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Microphone Permission</title>
        <style>
          body { 
            font-family: -apple-system, sans-serif; 
            padding: 20px; 
            text-align: center;
          }
          button {
            padding: 10px 20px;
            font-size: 16px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
          }
        </style>
      </head>
      <body>
        <h2>Click to Allow Microphone</h2>
        <p>Arc needs you to grant permission in a separate window.</p>
        <button onclick="requestPermission()">Allow Microphone</button>
        <script>
          async function requestPermission() {
            try {
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              document.body.innerHTML = '<h2>✅ Permission Granted!</h2><p>You can close this window.</p>';
              stream.getTracks().forEach(track => track.stop());
              
              // Notify the extension
              chrome.runtime.sendMessage({ action: 'micPermissionGranted' });
              
              // Close after 2 seconds
              setTimeout(() => window.close(), 2000);
            } catch (error) {
              document.body.innerHTML = '<h2>❌ Permission Denied</h2><p>' + error.message + '</p>';
            }
          }
        </script>
      </body>
      </html>
    `;
    
    // Create blob URL
    const blob = new Blob([permissionHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    // Open in a new window
    const permissionWindow = window.open(url, 'micPermission', 'width=400,height=300');
    
    // Clean up after window closes
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    
    return new Promise((resolve, reject) => {
      // Listen for permission granted message
      const messageListener = (request, sender, sendResponse) => {
        if (request.action === 'micPermissionGranted') {
          chrome.runtime.onMessage.removeListener(messageListener);
          resolve(true);
        }
      };
      chrome.runtime.onMessage.addListener(messageListener);
      
      // Timeout after 30 seconds
      setTimeout(() => {
        chrome.runtime.onMessage.removeListener(messageListener);
        reject(new Error('Permission request timeout'));
      }, 30000);
    });
    
  } catch (error) {
    console.error('[POPUP] Arc workaround failed:', error);
    throw error;
  }
}

// Method 2: Use Chrome Extension API to open the recording page
async function openRecordingPageInTab() {
  console.log('[POPUP] Opening recording page in new tab...');
  
  // Get the extension URL
  const recordingPageUrl = chrome.runtime.getURL('recording-page.html');
  
  // Open in a new tab
  chrome.tabs.create({ url: recordingPageUrl }, (tab) => {
    console.log('[POPUP] Opened recording page in tab:', tab.id);
    
    // Optionally, you can listen for when the tab gets permission
    chrome.storage.local.set({ permissionTabId: tab.id });
  });
}

// Modified permission request for Arc
async function requestMicrophonePermissionSmart() {
  if (isArcBrowser()) {
    console.log('[POPUP] Arc browser detected');
    
    // First, check if we already have permission by trying a quick test
    try {
      const quickTest = await navigator.mediaDevices.getUserMedia({ audio: true });
      quickTest.getTracks().forEach(track => track.stop());
      console.log('[POPUP] Already have permission!');
      return true;
    } catch (e) {
      // No permission yet
    }
    
    // For Arc, open the recording page
    updateStatus('connecting', 'Opening permission page for Arc...');
    openRecordingPageInTab();
    
    // Update UI
    updateStatus('ready', 'Please grant permission in the new tab');
    alert('Arc Browser detected!\n\nA new tab has been opened.\nPlease grant microphone permission there, then come back here to start recording.');
    
    return false;
  } else {
    // Regular Chrome behavior
    return requestMicrophonePermissionNormal();
  }
}

// Regular permission request for Chrome
async function requestMicrophonePermissionNormal() {
  const stream = await navigator.mediaDevices.getUserMedia({ 
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  });
  
  // Test and cleanup
  stream.getTracks().forEach(track => track.stop());
  return true;
}

// Replace the existing permission button handler with this:
if (requestMicBtn) {
  requestMicBtn.addEventListener('click', async () => {
    console.log('[POPUP] Request microphone permission button clicked');
    try {
      updateStatus('connecting', 'Requesting permission...');
      
      const hasPermission = await requestMicrophonePermissionSmart();
      
      if (hasPermission) {
        console.log('[POPUP] Microphone permission granted!');
        updateStatus('ready', 'Permission granted!');
        requestMicBtn.style.display = 'none';
        alert('Microphone permission granted!\n\nYou can now click "Start Recording".');
      }
      
    } catch (error) {
      console.error('[POPUP] Microphone permission error:', error);
      
      let message = 'Permission error: ';
      if (error.name === 'NotAllowedError') {
        if (isArcBrowser()) {
          message = 'Arc permission issue. Opening full page...';
          openRecordingPageInTab();
        } else {
          message = 'Permission denied. Check browser settings.';
        }
      } else {
        message = error.message;
      }
      
      updateStatus('error', message);
      setTimeout(() => updateStatus('ready', 'Ready'), 3000);
    }
  });
}

// Also modify the startRecording function to check for Arc
async function startRecordingWithArcCheck(webhookUrl) {
  console.log('[POPUP] Starting recording with Arc check...');
  
  // If Arc and no permission, open recording page
  if (isArcBrowser()) {
    try {
      // Quick permission test
      const testStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      testStream.getTracks().forEach(track => track.stop());
      // Has permission, continue normally
    } catch (error) {
      if (error.name === 'NotAllowedError') {
        console.log('[POPUP] Arc permission issue, opening recording page...');
        openRecordingPageInTab();
        updateStatus('error', 'Please use the recording page that just opened');
        return;
      }
    }
  }
  
  // Continue with normal recording
  return startRecording(webhookUrl);
}