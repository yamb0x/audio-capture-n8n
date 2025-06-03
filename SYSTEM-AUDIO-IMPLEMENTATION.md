# System Audio Implementation Guide

## Current Status

Due to Chrome's security restrictions in Manifest V3, implementing system audio capture has specific limitations:

### The Challenge

1. **chrome.tabCapture API Restrictions**:
   - Can only be called from extension popup or action context
   - Requires user interaction (click)
   - Cannot be called from web pages (even extension pages)
   - Cannot capture chrome:// or extension:// pages

2. **Manifest V3 Limitations**:
   - Background scripts are service workers (no persistent state)
   - Cannot pass MediaStream objects between contexts
   - Stricter security model

## Working Solution

### For Microphone Only
✅ **Works perfectly** - Can be captured from popup or recording page

### For System Audio
Currently, the most reliable approach is:

1. **Use Desktop Audio Capture Extensions**:
   - Use existing Chrome extensions like "Chrome Audio Capture"
   - These extensions are specifically designed for this purpose
   - They handle all the complexity of tab audio capture

2. **Alternative: Screen Recording with Audio**:
   - Use `getDisplayMedia` API which can capture system audio
   - This requires screen sharing permission
   - Works from the recording page

## Implementation for Screen + Audio Capture

Here's how to implement screen recording with system audio:

```javascript
// Request screen capture with audio
async function captureScreenWithAudio() {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        sampleRate: 48000,
        channelCount: 2
      }
    });
    
    // Extract just the audio track if you only need audio
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length > 0) {
      // Create audio-only stream
      const audioStream = new MediaStream(audioTracks);
      
      // Stop video track if not needed
      stream.getVideoTracks().forEach(track => track.stop());
      
      return audioStream;
    }
  } catch (error) {
    console.error('Screen capture error:', error);
  }
}
```

## Recommended Approach

For the best user experience with system audio capture:

1. **Keep Microphone Recording** in the current extension
2. **Use Screen Sharing** for system audio when needed
3. **Document the limitation** and suggest alternatives

## Future Considerations

- Chrome may improve tabCapture API in future versions
- Consider using Native Messaging for more control
- WebRTC solutions might provide alternatives

## Quick Fix for Current Implementation

To make system audio work with the current setup:

1. Update the recording page to use `getDisplayMedia` instead of `tabCapture`
2. This will prompt the user to share their screen/tab
3. Extract audio from the shared stream
4. Stop video track to save resources

This approach works reliably across all browsers and doesn't have the same restrictions as `tabCapture`.