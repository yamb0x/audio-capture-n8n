console.log('[BACKGROUND] Background script loaded');

let isRecording = false;
let recordingTabId = null;
let webhookUrl = 'https://yambo-studio.app.n8n.cloud/webhook/meeting-audio';
let currentMeetingId = null;
let currentSessionId = null;

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
    console.log('[BACKGROUND] Recording started notification');
    isRecording = true;
    // Update extension badge
    chrome.action.setBadgeText({text: 'REC'});
    chrome.action.setBadgeBackgroundColor({color: '#FF0000'});
    sendResponse({status: 'acknowledged'});
  } else if (request.action === 'stopRecording') {
    console.log('[BACKGROUND] Stopping recording');
    stopRecording();
    sendResponse({status: 'stopped'});
  } else if (request.action === 'getStatus') {
    console.log('[BACKGROUND] Status check - isRecording:', isRecording);
    sendResponse({isRecording: isRecording});
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
  
  // Clear badge
  chrome.action.setBadgeText({text: ''});
  console.log('[BACKGROUND] Recording stopped, session ended');
}

// Audio sending is now handled in popup.js