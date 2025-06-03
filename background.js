console.log('[BACKGROUND] Background script loaded');

let isRecording = false;
let recordingTabId = null;
let webhookUrl = 'https://yambo-studio.app.n8n.cloud/webhook/meeting-audio';
let currentMeetingId = null;
let currentSessionId = null;
let tabStreamId = null;
let recordingPageTabId = null;

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[BACKGROUND] Received message:', request);
  
  if (request.action === 'setupRecording') {
    console.log('[BACKGROUND] Setting up recording for tab:', request.tabId);
    console.log('[BACKGROUND] Meeting metadata:', {
      meetingId: request.meetingId,
      meetingUrl: request.meetingUrl,
      sessionId: request.recordingSessionId
    });
    setupRecording(request.tabId, request.webhookUrl, request.meetingId, request.recordingSessionId);
    sendResponse({status: 'ready'});
  } else if (request.action === 'recordingStarted') {
    console.log('[BACKGROUND] Recording started notification from tab:', sender.tab?.id);
    isRecording = true;
    if (sender.tab?.id) {
      recordingPageTabId = sender.tab.id;
    }
    // Update extension badge
    chrome.action.setBadgeText({text: 'REC'});
    chrome.action.setBadgeBackgroundColor({color: '#FF0000'});
    // Persist state
    chrome.storage.local.set({
      globalRecordingState: {
        isRecording: true,
        recordingPageTabId: recordingPageTabId,
        startTime: new Date().toISOString()
      }
    });
    sendResponse({status: 'acknowledged'});
  } else if (request.action === 'stopRecording') {
    console.log('[BACKGROUND] Stop recording request from:', sender.tab?.id || 'popup');
    stopRecording();
    // If recording page is open, send stop message to it
    if (recordingPageTabId) {
      chrome.tabs.sendMessage(recordingPageTabId, {action: 'stopFromExternal'}, () => {
        if (chrome.runtime.lastError) {
          console.log('[BACKGROUND] Recording page tab not available');
        }
      });
    }
    sendResponse({status: 'stopped'});
  } else if (request.action === 'getStatus') {
    console.log('[BACKGROUND] Status check - isRecording:', isRecording);
    // Also check storage for persistent state
    chrome.storage.local.get(['globalRecordingState'], (result) => {
      const globalState = result.globalRecordingState;
      if (globalState && globalState.isRecording) {
        isRecording = true;
        recordingPageTabId = globalState.recordingPageTabId;
      }
      sendResponse({isRecording: isRecording, recordingPageTabId: recordingPageTabId});
    });
    return true; // Keep channel open for async response
  } else if (request.action === 'getTabInfo') {
    console.log('[BACKGROUND] Getting tab info');
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs[0]) {
        sendResponse({status: 'success', tab: tabs[0]});
      } else {
        sendResponse({status: 'error', error: 'No active tab found'});
      }
    });
    return true;
  }
});

function setupRecording(tabId, customWebhookUrl, meetingId, sessionId) {
  console.log('[BACKGROUND] setupRecording called with:', {
    tabId,
    webhookUrl: customWebhookUrl,
    meetingId,
    sessionId
  });
  
  recordingTabId = tabId;
  currentMeetingId = meetingId;
  currentSessionId = sessionId;
  
  if (customWebhookUrl) {
    webhookUrl = customWebhookUrl;
    console.log('[BACKGROUND] Updated webhook URL to:', webhookUrl);
  }
  
  console.log('[BACKGROUND] Recording setup complete for meeting:', meetingId);
}

function stopRecording() {
  console.log('[BACKGROUND] stopRecording called');
  console.log('[BACKGROUND] Ending session:', currentSessionId, 'for meeting:', currentMeetingId);
  
  isRecording = false;
  recordingTabId = null;
  currentMeetingId = null;
  currentSessionId = null;
  recordingPageTabId = null;
  
  // Clear badge
  chrome.action.setBadgeText({text: ''});
  
  // Clear persistent state
  chrome.storage.local.remove(['globalRecordingState']);
  
  console.log('[BACKGROUND] Recording stopped, session ended');
}

// Audio sending is now handled in popup.js
// Tab capture must be initiated from popup context, not background

// Initialize state from storage on startup
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get(['globalRecordingState'], (result) => {
    if (result.globalRecordingState && result.globalRecordingState.isRecording) {
      isRecording = true;
      recordingPageTabId = result.globalRecordingState.recordingPageTabId;
      chrome.action.setBadgeText({text: 'REC'});
      chrome.action.setBadgeBackgroundColor({color: '#FF0000'});
    }
  });
});

// Also check on installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['globalRecordingState'], (result) => {
    if (result.globalRecordingState && result.globalRecordingState.isRecording) {
      isRecording = true;
      recordingPageTabId = result.globalRecordingState.recordingPageTabId;
      chrome.action.setBadgeText({text: 'REC'});
      chrome.action.setBadgeBackgroundColor({color: '#FF0000'});
    }
  });
});