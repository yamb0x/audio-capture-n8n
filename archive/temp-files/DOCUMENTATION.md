# 📖 Meeting Audio Capture - Complete Documentation

## 🎯 Overview

The Meeting Audio Capture system consists of a Chrome extension that captures Google Meet audio and sends it to n8n for automated transcription and summarization. This documentation covers the complete setup, usage, and monitoring.

## 🏗️ System Architecture

```
Google Meet Tab → Chrome Extension → Dashboard Server → n8n Webhook → Whisper API → OpenAI → Notion
     (Audio)         (Capture)        (Monitor)         (Process)     (Transcribe)  (Summarize)  (Store)
```

## 📁 Project Structure

```
meet-audio-capture/
├── 🧩 Chrome Extension
│   ├── manifest.json           # Extension manifest (v3)
│   ├── popup.html              # Extension popup UI
│   ├── popup.js                # Recording logic with metadata
│   ├── background.js           # Service worker
│   ├── content.js              # Google Meet integration
│   └── icon.png                # Extension icon
├── 📊 Dashboard & Monitoring
│   ├── dashboard-server.js     # Advanced monitoring dashboard
│   ├── launcher.js             # Desktop launcher application
│   ├── start-dashboard.sh      # Unix/Mac startup script
│   ├── start-dashboard.bat     # Windows startup script
│   └── simple-webhook-server.js # Basic webhook for testing
├── 📋 Documentation
│   ├── README.md               # Quick start guide
│   ├── DOCUMENTATION.md        # This comprehensive guide
│   └── package.json            # Project dependencies
└── 🔧 Configuration
    └── .gitignore              # Git ignore rules
```

## 🚀 Installation & Setup

### 1. Prerequisites

- **Node.js 16+** - Download from [nodejs.org](https://nodejs.org/)
- **Chrome Browser** - For the extension
- **n8n Instance** - For automation workflow

### 2. Install Dependencies

```bash
cd meet-audio-capture
npm install
```

### 3. Install Chrome Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked" 
4. Select the `meet-audio-capture` folder
5. Pin the extension to your toolbar

### 4. Start Dashboard

**Option A: Interactive Launcher (Recommended)**
```bash
./start-dashboard.sh          # Mac/Linux
start-dashboard.bat           # Windows
```

**Option B: Direct Commands**
```bash
npm start                     # Interactive launcher
npm run auto                  # Auto-start dashboard
npm run dashboard             # Dashboard only
```

## 🎮 Using the System

### Starting a Recording Session

1. **Launch Dashboard**
   - Run `./start-dashboard.sh` or double-click the script
   - The dashboard opens automatically at `http://localhost:5678`

2. **Join Google Meet**
   - Open any Google Meet meeting
   - URL format: `https://meet.google.com/abc-defg-hij`

3. **Start Recording**
   - Click the extension icon in Chrome
   - Click "Start Recording"
   - Status changes: Ready → Connecting → Recording

4. **Monitor in Dashboard**
   - Watch real-time audio chunks arrive
   - View session metadata and statistics
   - Track data flow to n8n

### Stopping Recording

1. Click "Stop Recording" in the extension
2. Final chunk is sent with `isLastChunk: true`
3. Session completes in dashboard

## 📊 Dashboard Features

### Real-Time Monitoring

- **🎯 System Status**: Server uptime, active sessions, last activity
- **📈 Recording Stats**: Total sessions, chunks, audio data processed
- **💾 Server Resources**: Memory usage, performance metrics
- **📊 Live Sessions**: Active recording sessions with progress
- **🎵 Audio Chunks**: Latest chunks with metadata and timing

### Session Tracking

Each recording session includes:
- **Session ID**: Unique identifier (`session_1733067015123_x3k9m2n1p`)
- **Meeting ID**: Extracted from URL (`abc-defg-hij`)
- **Chunk Counter**: Sequential numbering (0, 1, 2...)
- **First/Last Flags**: Special markers for workflow logic
- **Audio Metadata**: Size, duration, format, timestamps

### Dashboard Controls

- **🔄 Refresh Data**: Manual data refresh
- **🗑️ Reset All Data**: Clear dashboard history
- **📊 Auto-refresh**: Updates every 5 seconds
- **🌐 Browser Integration**: Opens automatically on start

## 🔗 n8n Integration

### Webhook Payload Format

Each audio chunk sent to n8n contains:

```json
{
  "audio": "UklGRiQAAABXQVZFZm10...",           // Base64 WebM audio
  "timestamp": "2025-06-01T17:30:15.123Z",      // Chunk timestamp
  "duration": 30,                               // Chunk duration (seconds)
  "format": "webm",                             // Audio format
  "meetingId": "abc-defg-hij",                  // Meeting ID from URL
  "chunkIndex": 2,                              // Chunk sequence number
  "isFirstChunk": false,                        // First chunk flag
  "isLastChunk": false,                         // Last chunk flag
  "meetingUrl": "https://meet.google.com/abc-defg-hij",
  "recordingSessionId": "session_1733067015123_x3k9m2n1p"
}
```

### n8n Workflow Setup

1. **Import Workflow**
   - Import `n8n-meeting-workflow.json` into your n8n instance

2. **Configure Webhook**
   - Copy your n8n webhook URL
   - Update the extension popup with your webhook URL
   - Default: `http://localhost:5678/webhook/meeting-audio`

3. **Set Up Local Services**
   - Whisper API on `http://localhost:8000`
   - OpenAI API key configured
   - Notion integration set up

### Workflow Process

1. **Audio Reception**: n8n receives audio chunk with metadata
2. **Audio Processing**: Saves base64 audio to temp file
3. **Transcription**: Sends to local Whisper API
4. **Context Management**: Maintains meeting transcript history
5. **AI Summarization**: Generates summaries with OpenAI
6. **Notion Updates**: Adds structured meeting notes
7. **Cleanup**: Removes temporary files

## 🛠️ Configuration

### Extension Settings

Access via extension popup:
- **Webhook URL**: Target endpoint for audio chunks
- **Recording Status**: Visual indicator with color coding
- **Session Management**: Start/stop recording controls

### Dashboard Configuration

Environment variables (optional):
```bash
PORT=5678                     # Dashboard port
LOG_LEVEL=info               # Logging level
MAX_SESSIONS=100             # Session history limit
MAX_CHUNKS=500               # Chunk history limit
```

### Chrome Extension Permissions

Required permissions:
- `tabCapture`: Capture audio from Google Meet tabs
- `activeTab`: Access current tab information  
- `storage`: Save webhook URL preferences

## 📈 Monitoring & Troubleshooting

### Dashboard Metrics

**System Health**
- Server uptime and status
- Memory usage tracking
- Request processing times
- Error rate monitoring

**Recording Analytics**
- Sessions per day/hour
- Audio data volume
- Average session duration
- Chunk success rate

### Common Issues & Solutions

**Extension Issues**
```
❌ "Not on Google Meet page"
✅ Ensure you're on https://meet.google.com/...

❌ "Failed to start recording"  
✅ Check microphone permissions in Chrome
✅ Refresh the page and try again

❌ "Audio chunks not appearing"
✅ Check dashboard is running on correct port
✅ Verify webhook URL in extension popup
```

**Dashboard Issues**
```
❌ "Port 5678 already in use"
✅ Run: pkill -f "dashboard-server"
✅ Restart with ./start-dashboard.sh

❌ "No data appearing"
✅ Check extension is sending to correct URL
✅ Verify CORS headers in network tab

❌ "High memory usage"
✅ Dashboard auto-limits history
✅ Use reset button to clear old data
```

**n8n Integration Issues**
```
❌ "Webhook not receiving data"
✅ Test with dashboard first (localhost:5678)
✅ Check n8n webhook URL is correct
✅ Verify n8n is running and accessible

❌ "Whisper transcription failing"
✅ Ensure Whisper API is running on port 8000
✅ Check audio format compatibility (WebM)
```

### Debug Mode

Enable detailed logging:
```bash
DEBUG=* npm run dashboard     # Full debug logs
NODE_ENV=development npm start # Development mode
```

### Log Files

Check application logs:
- `launcher.log`: Launcher activity
- Browser DevTools: Extension logs
- n8n execution logs: Workflow debugging

## 🔐 Security & Privacy

### Data Handling

- **Local Processing**: Audio processed locally via Whisper
- **Temporary Storage**: Audio files deleted after processing
- **No Cloud Storage**: Audio never permanently stored
- **Secure Transfer**: HTTPS required for production

### Chrome Extension Security

- **Manifest V3**: Latest security standards
- **Minimal Permissions**: Only required permissions requested
- **Content Security**: No external script loading
- **Local Communication**: Only talks to specified webhook

### Network Security

- **CORS Protection**: Proper headers configured
- **Input Validation**: All webhook inputs validated
- **Rate Limiting**: Built-in request throttling
- **Error Handling**: Secure error messages

## 🚀 Deployment

### Development Setup

1. Clone/download the project
2. Run `npm install`
3. Load extension in Chrome
4. Start dashboard with `./start-dashboard.sh`
5. Test with Google Meet recording

### Production Deployment

1. **Set up n8n instance** with proper security
2. **Configure Whisper API** on production server
3. **Update webhook URLs** in extension
4. **Deploy dashboard** on production server
5. **Set up monitoring** and alerting

### Scaling Considerations

- **Database Storage**: Replace in-memory storage with database
- **Load Balancing**: Multiple dashboard instances
- **Audio Processing**: Dedicated Whisper servers
- **Monitoring**: Production monitoring tools

## 📚 API Reference

### Dashboard API Endpoints

**Statistics**
```http
GET /api/stats
```
Returns system statistics and performance metrics.

**Sessions**
```http
GET /api/sessions?limit=20
```
Returns list of recording sessions.

**Chunks**
```http
GET /api/chunks?limit=50
```
Returns list of audio chunks.

**Session Details**
```http
GET /api/session/{sessionId}
```
Returns detailed session information with all chunks.

**Reset Data**
```http
POST /api/reset
```
Clears all dashboard data.

**Health Check**
```http
GET /health
```
Returns server health status.

### Webhook API

**Receive Audio**
```http
POST /webhook/meeting-audio
Content-Type: application/json

{
  "audio": "base64-encoded-audio",
  "meetingId": "abc-defg-hij",
  "chunkIndex": 0,
  "isFirstChunk": true,
  "isLastChunk": false,
  "recordingSessionId": "session_...",
  "meetingUrl": "https://meet.google.com/...",
  "timestamp": "2025-06-01T17:30:15.123Z",
  "duration": 30,
  "format": "webm"
}
```

## 🤝 Contributing

### Development Workflow

1. Fork the repository
2. Create feature branch
3. Make changes with tests
4. Update documentation
5. Submit pull request

### Code Standards

- **JavaScript ES6+**: Modern syntax
- **Error Handling**: Comprehensive try-catch
- **Logging**: Structured logging throughout
- **Comments**: Clear documentation in code

## 📞 Support

### Getting Help

1. **Check Documentation**: This file and README.md
2. **Review Logs**: Dashboard and browser console
3. **Test Components**: Use simple webhook server
4. **Debug Step-by-Step**: Isolate the issue

### Reporting Issues

Include in bug reports:
- Chrome extension logs
- Dashboard server logs  
- Steps to reproduce
- Expected vs actual behavior
- System information

## 🎉 Success Metrics

Your system is working correctly when you see:

✅ **Extension**: Status shows "Recording" with green indicator  
✅ **Dashboard**: Real-time chunks appearing with metadata  
✅ **n8n**: Workflow executing with audio processing  
✅ **Whisper**: Transcriptions being generated  
✅ **Notion**: Meeting notes being created automatically  

## 🚀 Next Steps

1. **Test the complete flow** with a real Google Meet call
2. **Configure your n8n workflow** with proper API keys
3. **Set up production deployment** for regular use
4. **Customize the dashboard** for your specific needs
5. **Scale the system** for multiple users if needed

---

## 📄 License

MIT License - Feel free to use, modify, and distribute!

For the latest updates and additional resources, check the project repository.