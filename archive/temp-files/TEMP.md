**Browser Extension Debug Steps:**

The WebM file shows that audio is being recorded but it's:
- Only 5.4 seconds long (not 30 seconds as expected)
- Missing duration metadata 
- Possibly silent or very quiet

**Check these in your browser extension:**

1. **Microphone Permissions:**
   - Open Chrome DevTools (F12)
   - Go to Console tab
   - Check for any microphone permission errors

2. **Audio Input Level:**
   - Check if your microphone is actually picking up sound
   - Look for getUserMedia errors in console

3. **Recording Duration:**
   - Your extension should be recording for 30 seconds
   - But the file only contains 5.4 seconds

4. **Extension Console Logs:**
   - Check what your extension logs during recording
   - Look for any errors in the recording process

**Quick Test:**
1. **Record a new session**
2. **Speak clearly into microphone during recording**
3. **Check Chrome DevTools Console for errors**
4. **Download the WebM file again**
5. **Try playing it in a media player to hear if there's actual voice**

The transcription is failing because either:
- The audio is silent/too quiet
- The recording is cutting off early
- The browser isn't capturing microphone properly

**Show me what's in your browser console during recording!**