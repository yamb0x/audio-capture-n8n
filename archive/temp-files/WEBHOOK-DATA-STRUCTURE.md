# Webhook Data Structure Documentation

## Overview
The Audio Capture extension sends audio data to your n8n webhook in chunks every 30 seconds. Each payload contains the audio data and comprehensive metadata about the recording session.

## Complete Data Structure

```json
{
  // Core Audio Data
  "audio": "base64_encoded_audio_string",
  "timestamp": "2024-01-30T15:30:45.123Z",
  "duration": 30,
  "format": "webm",
  
  // Recording Identification
  "recordingSessionId": "session_1706628645123_abc123def",
  "meetingId": "zoom-123456789",
  "meetingUrl": "https://zoom.us/j/123456789",
  
  // Chunk Metadata
  "chunkIndex": 0,
  "isFirstChunk": true,
  "isLastChunk": false,
  
  // Extended Metadata
  "source": "zoom",
  "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...",
  "recordingType": "video-call",
  "title": "Team Weekly Standup - Zoom Meeting"
}
```

## Field Descriptions

### Core Audio Data
- **audio** (string): Base64 encoded WebM audio data
- **timestamp** (ISO 8601): When this chunk was created
- **duration** (number): Duration in seconds (usually 30, except last chunk)
- **format** (string): Audio format (always "webm")

### Recording Identification
- **recordingSessionId** (string): Unique ID for the entire recording session
- **meetingId** (string): Platform-specific meeting/content identifier
- **meetingUrl** (string): Full URL of the recorded tab

### Chunk Metadata
- **chunkIndex** (number): Sequential index of this chunk (0-based)
- **isFirstChunk** (boolean): True for the first chunk of a session
- **isLastChunk** (boolean): True for the final chunk when recording stops

### Extended Metadata
- **source** (string): Detected platform name
- **userAgent** (string): Browser user agent string
- **recordingType** (string): Type of recording
- **title** (string): Browser tab title

## Platform Detection

### Source Values
- `google-meet` - Google Meet
- `zoom` - Zoom
- `ms-teams` - Microsoft Teams
- `whereby` - Whereby
- `discord` - Discord
- `youtube` - YouTube
- `spotify` - Spotify
- `soundcloud` - SoundCloud
- `browser` - Any other website

### Recording Type Values
- `video-call` - Video conferencing platforms
- `media-playback` - Media streaming platforms
- `chat-audio` - Chat applications with audio
- `general-audio` - Any other audio source

## Meeting ID Examples
- Google Meet: `abc-defg-hij`
- Zoom: `zoom-123456789`
- Teams: `teams-meeting`
- YouTube: `youtube-com`
- Other sites: Uses hostname (e.g., `example-com`)

## Usage in n8n

### Example: Handling Different Recording Types
```javascript
// In your n8n Function node
const items = $input.all();

items.forEach(item => {
  const data = item.json;
  
  // Process based on recording type
  switch(data.recordingType) {
    case 'video-call':
      // Process meeting recordings
      // Send to transcription service
      // Extract action items
      break;
      
    case 'media-playback':
      // Process media content
      // Extract key moments
      // Generate summaries
      break;
      
    case 'general-audio':
      // Generic audio processing
      break;
  }
  
  // Aggregate chunks by session
  if (data.isFirstChunk) {
    // Initialize new session processing
  }
  
  if (data.isLastChunk) {
    // Finalize and process complete recording
  }
});

return items;
```

### Example: Filtering by Source
```javascript
// Only process Zoom recordings
const zoomRecordings = items.filter(item => 
  item.json.source === 'zoom'
);

// Process video calls only
const videoCalls = items.filter(item => 
  item.json.recordingType === 'video-call'
);
```

## Best Practices

1. **Session Management**: Use `recordingSessionId` to group chunks from the same recording
2. **Chunk Ordering**: Use `chunkIndex` to ensure proper sequencing
3. **Platform-Specific Logic**: Use `source` field for platform-specific processing
4. **Complete Recording**: Wait for `isLastChunk: true` before final processing
5. **Metadata Storage**: Store `title` and `meetingUrl` for reference and context