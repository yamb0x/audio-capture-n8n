/**
 * Popup Launcher
 * Simplified popup that launches and controls the recording control center
 */

console.log('[POPUP LAUNCHER] Script loaded');

// UI Elements
const statusEl = document.getElementById('status');
const statusTextEl = document.getElementById('statusText');
const openControlBtn = document.getElementById('openControlBtn');
const quickStopBtn = document.getElementById('quickStopBtn');
const recordingInfoEl = document.getElementById('recordingInfo');
const durationEl = document.getElementById('duration');
const sourceEl = document.getElementById('source');

let controlTabId = null;
let statusCheckInterval = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  console.log('[POPUP LAUNCHER] DOM ready, checking status...');
  checkControlCenterStatus();
});

// Check if control center is open and recording status
async function checkControlCenterStatus() {
  try {
    // Find control center tab
    const tabs = await chrome.tabs.query({});
    const controlTab = tabs.find(tab => tab.url && tab.url.includes('recording-control.html'));
    
    if (controlTab) {
      controlTabId = controlTab.id;
      console.log('[POPUP LAUNCHER] Found control center tab:', controlTabId);
      
      // Get status from control center
      chrome.tabs.sendMessage(controlTabId, { action: 'getControlStatus' }, (response) => {
        if (chrome.runtime.lastError) {
          console.log('[POPUP LAUNCHER] Could not get status from control center');
          updateUI(false, false);
        } else if (response) {
          console.log('[POPUP LAUNCHER] Control center status:', response);
          updateUI(true, response.isRecording, response);
        }
      });
      
      // Start periodic status updates
      startStatusUpdates();
    } else {
      // Check storage for recording state
      chrome.storage.local.get(['isRecording', 'recordingData'], (result) => {
        if (result.isRecording) {
          // Recording in progress but control center closed
          console.log('[POPUP LAUNCHER] Found orphaned recording session');
          updateUI(false, true, result.recordingData);
        } else {
          updateUI(false, false);
        }
      });
    }
  } catch (error) {
    console.error('[POPUP LAUNCHER] Error checking status:', error);
    updateUI(false, false);
  }
}

// Update UI based on state
function updateUI(controlCenterOpen, isRecording, recordingData) {
  if (isRecording) {
    // Recording in progress
    statusEl.className = 'status recording';
    statusTextEl.textContent = 'Recording';
    openControlBtn.style.display = 'none';
    quickStopBtn.style.display = 'block';
    recordingInfoEl.style.display = 'block';
    
    if (recordingData) {
      if (recordingData.duration) {
        durationEl.textContent = recordingData.duration;
      }
      if (recordingData.audioSource) {
        const sourceText = recordingData.audioSource === 'microphone' ? 'Microphone' :
                          recordingData.audioSource === 'system' ? 'System Audio' :
                          'Both';
        sourceEl.textContent = sourceText;
      }
    }
    
    if (!controlCenterOpen) {
      statusTextEl.textContent = 'Recording (Control Center Closed)';
    }
  } else {
    // Not recording
    statusEl.className = 'status ready';
    statusTextEl.textContent = 'Ready';
    openControlBtn.style.display = 'block';
    quickStopBtn.style.display = 'none';
    recordingInfoEl.style.display = 'none';
  }
}

// Start periodic status updates
function startStatusUpdates() {
  statusCheckInterval = setInterval(() => {
    if (controlTabId) {
      chrome.tabs.get(controlTabId, (tab) => {
        if (chrome.runtime.lastError || !tab) {
          // Control center closed
          clearInterval(statusCheckInterval);
          checkControlCenterStatus();
        } else {
          // Get updated status
          chrome.tabs.sendMessage(controlTabId, { action: 'getControlStatus' }, (response) => {
            if (response) {
              updateUI(true, response.isRecording, response);
            }
          });
        }
      });
    }
  }, 1000);
}

// Open control center button
openControlBtn.addEventListener('click', async () => {
  console.log('[POPUP LAUNCHER] Opening control center...');
  
  // Check if already open
  if (controlTabId) {
    // Focus existing tab
    chrome.tabs.update(controlTabId, { active: true });
  } else {
    // Open new control center
    const controlUrl = chrome.runtime.getURL('recording-control.html');
    const tab = await chrome.tabs.create({ 
      url: controlUrl,
      active: true 
    });
    controlTabId = tab.id;
    
    // Close popup after launching
    setTimeout(() => window.close(), 100);
  }
});

// Quick stop button
quickStopBtn.addEventListener('click', () => {
  console.log('[POPUP LAUNCHER] Quick stop clicked');
  
  if (controlTabId) {
    // Send stop message to control center
    chrome.tabs.sendMessage(controlTabId, { action: 'stopRecording' }, (response) => {
      console.log('[POPUP LAUNCHER] Stop response:', response);
      updateUI(true, false);
    });
  } else {
    // Control center not open, clear recording state
    chrome.storage.local.remove(['isRecording', 'recordingData', 'activeRecordingSource']);
    chrome.runtime.sendMessage({ action: 'stopRecording' });
    updateUI(false, false);
  }
});

// Clean up on popup close
window.addEventListener('unload', () => {
  if (statusCheckInterval) {
    clearInterval(statusCheckInterval);
  }
});