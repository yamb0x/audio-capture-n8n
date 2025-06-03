# Audio Capture Recording Flow Guide

## How Recording Works

### Starting a Recording

1. **From Popup - Microphone Only**:
   - Click extension icon → Select "Microphone Only" → Click "Start Recording"
   - Recording starts directly in the popup
   - Popup shows "Recording" status with Stop button

2. **From Popup - System Audio or Both**:
   - Click extension icon → Select "System Audio" or "Both" → Click "Start Recording"
   - New tab opens with recording page
   - Click "Start Recording" on the page
   - Chrome shows screen/tab selection dialog
   - **Important**: Check "Share audio" checkbox in the dialog
   - Select the tab/window you want to record
   - Recording starts with visual feedback

### During Recording

- Extension badge shows "REC" in red
- Recording state is synchronized across:
  - The popup (if you open it again)
  - The recording page (if open)
  - Background service
- Audio chunks are sent to webhook every 15 seconds
- Audio levels are displayed in real-time

### Stopping a Recording

You can stop recording from multiple places:

1. **From the Recording Page**:
   - Click "Stop Recording" button on the page
   - Recording stops and UI resets

2. **From the Popup**:
   - Open extension popup (it will show "Recording" status)
   - Click "Stop Recording"
   - Recording stops even if it was started from the recording page

3. **Closing the Recording Page**:
   - If you close the recording page tab, recording stops automatically

## State Synchronization

The extension maintains recording state in multiple places:

1. **Chrome Storage**: Persists recording state
2. **Background Service**: Manages global recording state
3. **Extension Badge**: Visual indicator ("REC")
4. **Popup UI**: Updates automatically when opened
5. **Recording Page**: Maintains its own state

## Important Notes

- **System Audio**: Requires screen/tab sharing with "Share audio" checked
- **Permissions**: Microphone permission is requested once and remembered
- **Multiple Windows**: Only one recording can be active at a time
- **Tab Switching**: You can switch tabs while recording continues
- **Popup Reopening**: Popup will always show current recording state

## Troubleshooting

### Recording Won't Stop
- Open the extension popup and click "Stop Recording"
- Refresh the recording page
- Check Chrome Task Manager for stuck processes

### No Audio Captured
- For system audio: Make sure "Share audio" was checked
- For microphone: Check system permissions and microphone selection
- Verify the audio source selection matches your intent

### State Out of Sync
- Close and reopen the popup
- The popup checks recording state every 2 seconds
- Recording state is stored persistently

## Best Practices

1. **For Meetings**: Use "Both" to capture your voice and meeting audio
2. **For Videos**: Use "System Audio Only" to capture just the video sound
3. **For Presentations**: Use "Microphone Only" for your narration
4. **Always Check**: The "Share audio" checkbox when using system audio