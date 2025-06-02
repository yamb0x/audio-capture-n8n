# Troubleshooting: Final Chunk Not Being Sent

## Problem
The Chrome extension is not sending the final audio chunk with `isLastChunk: true` when stopping the recording.

## Changes Made

### 1. Enhanced Debugging in popup.js
- Added version check at startup: "Version 1.2 with enhanced debugging"
- Added detailed logging in `stopMediaRecorder()` function
- Added comprehensive logging in `sendFinalAudioChunk()` function
- Modified the stop button click handler to log recording state

### 2. Modified Recording Stop Logic
- The `sendFinalAudioChunk()` is now called immediately when stopping
- Added state logging to track the MediaRecorder status
- Enhanced the onstop event handler logging

## Testing Steps

### Step 1: Start Debug Webhook Server
```bash
# In the extension directory
node debug-webhook-server.js
```
This will start a debug server on http://localhost:3333/webhook/debug

### Step 2: Reload the Extension
1. Go to `chrome://extensions/`
2. Find "Audio Capture for n8n"
3. Click the refresh/reload icon
4. Make sure Developer mode is ON

### Step 3: Test Recording with Debug Webhook
1. Open the test page: `file:///path/to/test-extension.html`
2. Click the extension icon
3. Change webhook URL to: `http://localhost:3333/webhook/debug`
4. Click "Start Recording"
5. Wait 5-10 seconds
6. Click "Stop Recording"

### Step 4: Check Console Logs
1. Right-click the extension icon and select "Inspect popup"
2. Look for these key logs when stopping:

```
[POPUP] Stop button clicked
[POPUP] Recording state before stop: {...}
[POPUP] stopMediaRecorder called
[POPUP] Current state: {...}
[POPUP] Calling sendFinalAudioChunk immediately...
[POPUP] sendFinalAudioChunk called
[POPUP] Final chunk webhook URL: http://localhost:3333/webhook/debug
[POPUP] Sending FINAL audio chunk to n8n
[POPUP] Final chunk payload: {...isLastChunk: true...}
```

### Step 5: Check Debug Server Output
The debug server console should show:
```
🎯 FINAL CHUNK RECEIVED!
Session Summary:
- Total chunks: X
- Session duration: X ms
```

## Common Issues and Solutions

### Issue 1: Changes Not Taking Effect
**Symptom**: You don't see "Version 1.2 with enhanced debugging" in console
**Solution**: 
- Hard reload the extension in chrome://extensions/
- Close and reopen the popup
- Check that you're looking at the popup console, not the page console

### Issue 2: sendFinalAudioChunk Not Being Called
**Symptom**: No "sendFinalAudioChunk called" log
**Solution**:
- Check if mediaRecorder exists when stopping
- Verify the recording actually started successfully
- Check for JavaScript errors in the console

### Issue 3: Network Error Sending Final Chunk
**Symptom**: "Error sending final chunk" in console
**Solution**:
- Verify the webhook URL is accessible
- Check CORS settings on the webhook server
- Try with the debug webhook server first

### Issue 4: Final Chunk Sent but isLastChunk is false
**Symptom**: Chunk is sent but isLastChunk is not true
**Solution**:
- Check the payload in the console logs
- Verify the sendFinalAudioChunk function is being called (not sendAudioToWebhook)

## Quick Test Script

Run this in the popup console to test the final chunk function directly:

```javascript
// Test sendFinalAudioChunk directly
recordingSessionId = 'test_session_' + Date.now();
meetingId = 'test_meeting';
meetingUrl = 'https://test.com';
chunkCounter = 5;
audioChunks = [];
pageTitle = 'Test Page';

sendFinalAudioChunk();
```

## Expected Behavior

When working correctly, you should see:
1. The debug webhook server receives a chunk with `isLastChunk: true`
2. The popup console shows all the debug logs for the final chunk
3. The network tab shows a successful POST request with the final chunk

## Next Steps if Still Not Working

1. Check if there are any Chrome extension errors in chrome://extensions/
2. Try disabling other extensions that might interfere
3. Test in an incognito window (with the extension allowed in incognito)
4. Check if the MediaRecorder is actually in "recording" state when stopping
5. Verify that the popup isn't closing too quickly after clicking stop

## Files Modified
- `/popup.js` - Added extensive debugging and modified stop logic
- `/test-extension.html` - Created for testing
- `/debug-webhook-server.js` - Created for debugging webhooks