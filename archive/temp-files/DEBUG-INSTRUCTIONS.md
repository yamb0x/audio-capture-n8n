# Debug Instructions for Audio Recording Issue

## Steps to implement the debug version:

1. **Backup your current popup.js**
   ```bash
   cp popup.js popup-original.js
   ```

2. **Replace popup.js with the debug version**
   ```bash
   cp popup-debug.js popup.js
   ```

3. **Reload the Chrome extension**
   - Go to chrome://extensions/
   - Find your "Meet Audio Capture" extension
   - Click the refresh icon

4. **Open Chrome DevTools Console**
   - Right-click on the extension popup
   - Select "Inspect" 
   - Go to the Console tab

5. **Start a recording and speak clearly**
   - Click Start Recording
   - **Speak continuously for 5-10 seconds**
   - Watch the console logs

## What the debug version monitors:

### 1. **Audio Stream Validation**
   - Checks if microphone access is granted
   - Validates audio tracks are active
   - Shows audio track settings

### 2. **Real-time Audio Level Monitoring**
   - Shows average audio levels every ~250ms
   - Warns if audio level is too low (< 1)
   - Helps identify if microphone is muted or not picking up sound

### 3. **MediaRecorder Details**
   - Logs every state change
   - Shows MIME type being used
   - Tracks chunk sizes

### 4. **Data Validation**
   - Monitors each audio chunk size
   - Warns if blob size is suspiciously small
   - Shows base64 preview

## What to look for in console:

### ✅ Good signs:
- `[POPUP] Audio level average: XX.XX` (should be > 1 when speaking)
- `[POPUP] Audio chunk added. Total chunks: X`
- `[POPUP] Created audio blob: {size: XXXX}` (size should be > 1000)

### ❌ Problem signs:
- `[POPUP] WARNING: Audio level very low - check microphone!`
- `[POPUP] WARNING: Received empty data chunk!`
- `[POPUP] WARNING: Audio blob is suspiciously small: XX bytes`
- Any permission errors

## Common issues to check:

1. **Browser microphone permissions**
   - Chrome Settings → Privacy → Site Settings → Microphone
   - Make sure it's not blocked

2. **System microphone**
   - Check system sound settings
   - Ensure correct microphone is selected
   - Test microphone in other apps

3. **Browser tab audio**
   - Some browsers require the tab to be active/focused
   - Try keeping the extension popup open while recording

## Share the console output!

After recording for 5-10 seconds, copy all the console logs that start with `[POPUP]` and share them. This will help identify exactly where the audio capture is failing.