# Fix Microphone Permission Issue

The error `NotAllowedError: Permission dismissed` means Chrome is blocking microphone access for the extension.

## Solution 1: Check Chrome Microphone Settings

1. **Open Chrome Settings**
   - Go to: `chrome://settings/content/microphone`
   - Or: Settings → Privacy and security → Site settings → Microphone

2. **Check if microphone is blocked**
   - Make sure "Sites can ask to use your microphone" is ON
   - Check the "Blocked" list - remove any blocks

3. **Check system microphone permission for Chrome**
   - **macOS**: System Preferences → Security & Privacy → Privacy → Microphone
   - Make sure Chrome is checked/allowed

## Solution 2: Grant Permission to Extension

Since Chrome extensions run in a special context, try this:

1. **Open a regular webpage** (not the N8N page)
   - Go to any website like https://www.google.com

2. **Click the extension icon** to open the popup

3. **Click "Start Recording"**
   - You should see a microphone permission prompt
   - Click "Allow"

## Solution 3: Test Microphone First

Let's add a microphone test button to verify permissions:

### Add this to your popup.html (before the Start button):

```html
<button id="testMicBtn">Test Microphone</button>
```

### Add this to your popup.js (after line 254):

```javascript
// Add microphone test functionality
const testMicBtn = document.getElementById('testMicBtn');
if (testMicBtn) {
  testMicBtn.addEventListener('click', async () => {
    console.log('[POPUP] Testing microphone access...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('[POPUP] Microphone test SUCCESS!');
      alert('Microphone access granted! You can now record.');
      
      // Stop the test stream
      stream.getTracks().forEach(track => track.stop());
    } catch (error) {
      console.error('[POPUP] Microphone test FAILED:', error);
      alert(`Microphone access denied: ${error.message}\n\nPlease check Chrome settings.`);
    }
  });
}
```

## Solution 4: Reset Extension Permissions

1. **Remove and re-add the extension**
   - Go to `chrome://extensions/`
   - Remove "Meet Audio Capture"
   - Re-add it
   - Try recording again

## Solution 5: Try Incognito Mode

1. **Enable extension in Incognito**
   - Go to `chrome://extensions/`
   - Find "Meet Audio Capture"
   - Click "Details"
   - Enable "Allow in Incognito"

2. **Open Incognito window** (Cmd+Shift+N)
3. **Try recording there**

## Why This Happens

Chrome blocks microphone access when:
- User previously denied permission
- Extension hasn't been granted permission yet
- System-level microphone permission is denied
- Chrome doesn't have system microphone access

## Quick Fix for Testing

For immediate testing, you can also try:

1. **Open Chrome DevTools** (F12)
2. **Go to Console**
3. **Run this test:**

```javascript
navigator.mediaDevices.getUserMedia({ audio: true })
  .then(stream => {
    console.log('Microphone access granted!');
    stream.getTracks().forEach(track => track.stop());
  })
  .catch(err => {
    console.error('Microphone access denied:', err);
  });
```

If this works in DevTools but not in the extension, it's an extension-specific permission issue.