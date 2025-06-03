# Audio Capture for n8n v2.0 - Enhanced Features

## New Features

### 1. System Audio Recording
- **NEW**: Record system audio (tab audio) directly from any browser tab
- Perfect for capturing meeting audio, videos, podcasts, etc.
- No need for virtual audio cables or complex setup

### 2. Audio Source Selection
Choose from three recording modes:
- **Microphone Only**: Records only your microphone input
- **System Audio Only**: Records only the audio from the current browser tab
- **Both**: Records and mixes both microphone and system audio together

### 3. Enhanced Permission Handling
- **Force Permission**: Robust permission handling that ensures microphone access
- **Persistent Permissions**: Once granted, permissions are remembered
- **Arc Browser Support**: Special handling for Arc browser's unique permission system
- **Permission State Tracking**: The extension remembers if permissions were granted

### 4. Improved User Interface
- Audio source selector in the popup
- Real-time audio level monitoring
- Source indicator showing what's being recorded
- Better error messages and status updates

## How to Use

### Basic Setup
1. Install/update the extension in Chrome/Edge/Arc
2. Click the extension icon to open the popup
3. Select your preferred audio source
4. Enter your webhook URL
5. Grant microphone permission if needed
6. Click "Start Recording"

### Recording System Audio
1. Select "System Audio Only" or "Both" from the dropdown
2. Click "Start Recording"
3. For the first time, Chrome will ask which tab to capture
4. Select the tab you want to record audio from
5. Recording will start automatically

### Arc Browser Users
If you encounter permission issues:
1. Click the link to open the enhanced recording page
2. Use the full-page interface for better permission handling
3. The page provides all the same features with better Arc compatibility

## Technical Improvements

### Permission Management
- Uses `navigator.permissions.query()` to check permission state
- Implements force permission request with proper error handling
- Stores permission state in Chrome storage for persistence
- Handles Arc browser's specific permission quirks

### Audio Processing
- Supports mixing multiple audio streams
- Uses Web Audio API for real-time audio level monitoring
- Implements proper stream cleanup to prevent memory leaks
- Enhanced chunk management for reliable long recordings

### Error Handling
- Comprehensive error messages for different failure scenarios
- Automatic retry logic for webhook failures
- Graceful degradation when features aren't available
- Better handling of tab capture API limitations

## Troubleshooting

### Microphone Permission Issues
1. Click the lock icon in the address bar
2. Set Microphone to "Allow"
3. Reload the extension
4. Try again

### System Audio Not Working
1. Make sure you're using Chrome, Edge, or Arc browser
2. Select the correct tab when prompted
3. Check that the tab has audio playing
4. Try using the enhanced recording page for better control

### Arc Browser Specific
1. Use the enhanced recording page for best results
2. Grant permissions in the full-page interface
3. Once granted, you can use the popup normally

## API Changes

The webhook payload now includes:
- `audioSource`: Indicates which audio source was used ("microphone", "system", or "both")
- Enhanced metadata for better audio processing on the server side

## Security & Privacy

- System audio capture requires explicit user permission for each tab
- Microphone permissions are handled securely with user consent
- No audio data is stored locally - all streaming to your webhook
- Permissions can be revoked at any time through browser settings