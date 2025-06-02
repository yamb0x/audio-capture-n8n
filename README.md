# 🎤 Audio Capture for n8n

> **Transform any browser tab into an intelligent audio recording system with automated transcription and AI analysis**

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue?logo=googlechrome)](chrome://extensions/)
[![n8n Integration](https://img.shields.io/badge/n8n-Workflow-orange?logo=n8n)](https://n8n.io)
[![Node.js](https://img.shields.io/badge/Node.js-Dashboard-green?logo=node.js)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ What This Does

Capture audio from **any browser tab** (Zoom calls, YouTube videos, Spotify, Discord) and automatically send it to n8n for **intelligent processing** with OpenAI Whisper transcription, GPT-4 analysis, and Notion integration.

🎯 **Perfect for:** Meeting notes, content analysis, lecture transcription, podcast processing, and any audio-to-text workflow.

## 🚀 Key Features

- 🌐 **Universal Audio Capture** - Works with any website (Zoom, Meet, Teams, YouTube, Spotify, Discord)
- 🤖 **Smart Chunking** - Automatically splits audio into 30-second chunks for optimal processing
- 📊 **Real-time Dashboard** - Monitor recordings with rich metadata and source detection
- 🔄 **n8n Integration** - Pre-built workflow for transcription and AI analysis
- 🎯 **Source Intelligence** - Detects platform and adds contextual metadata
- 🌙 **Arc Browser Support** - Special handling for Arc's permission model
- ⚡ **Zero Configuration** - Works out of the box with sensible defaults

## 📱 Live Dashboard

![Dashboard Preview](https://via.placeholder.com/800x400/4CAF50/white?text=🎤+Audio+Capture+Dashboard)

**Features:**
- 📞 **Source Detection**: Google Meet, Zoom, Teams, YouTube, Spotify, Discord
- 📊 **Real-time Monitoring**: Active sessions, chunk processing, forwarding status
- 🎵 **Rich Metadata**: Tab titles, recording types, audio sizes, processing times
- ➡️ **n8n Forwarding**: Automatic forwarding with status indicators

## 🎯 Quick Start

### 1. Install Chrome Extension
```bash
# Clone this repository
git clone https://github.com/yourusername/audio-capture-n8n.git
cd audio-capture-n8n

# Install dependencies
npm install
```

1. Open Chrome: `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select this folder

### 2. Start Dashboard
```bash
# Mac/Linux
./start-dashboard.sh

# Windows
start-dashboard.bat

# Or use npm
npm start
```

### 3. Start Recording
1. Open any website with audio
2. Click the extension icon
3. Click "Start Recording"
4. Monitor at http://localhost:5678

## 🔧 n8n Integration

### Webhook Data Structure
Each audio chunk includes rich metadata:

```json
{
  "audio": "base64-encoded-webm-data",
  "timestamp": "2025-06-02T12:30:45.123Z",
  "duration": 30,
  "format": "webm",
  "recordingSessionId": "session_1733067015123_x3k9m2n1p",
  "meetingId": "team-standup-zoom",
  "meetingUrl": "https://zoom.us/j/123456789",
  "chunkIndex": 0,
  "isFirstChunk": true,
  "isLastChunk": false,
  "source": "zoom",
  "recordingType": "meeting-audio",
  "title": "Team Weekly Standup"
}
```

### Pre-built n8n Workflow
Import `n8n-enhanced-workflow.json` for complete automation:

- 🎯 **Session Aggregation** - Waits for complete recordings
- 🗣️ **OpenAI Whisper** - High-quality transcription
- 🧠 **GPT-4 Analysis** - Extract insights, action items, summaries
- 📝 **Notion Integration** - Create structured meeting notes
- 🏷️ **Smart Tagging** - Automatic categorization and metadata

## 📊 Platform Support

| Platform | Emoji | Recording Type | Special Features |
|----------|-------|----------------|------------------|
| Google Meet | 📞 | `meeting-audio` | Meeting ID extraction |
| Zoom | 🟦 | `meeting-audio` | Session detection |
| Microsoft Teams | 💬 | `meeting-audio` | Team context |
| YouTube | 📺 | `media-playback` | Video metadata |
| Spotify | 🎵 | `media-playback` | Track information |
| Discord | 🎮 | `chat-audio` | Channel context |
| Any Website | 🌐 | `general-audio` | Universal capture |

## 🛠️ Configuration

### Default Webhook URL
```
http://localhost:5678/webhook/meeting-audio?forward=true
```

**What this does:**
- ✅ Records in dashboard for monitoring
- ✅ Forwards to n8n for processing
- ✅ Best of both worlds

### Environment Variables
```bash
PORT=5678                    # Dashboard port
N8N_WEBHOOK_URL=...         # Your n8n webhook URL
LOG_LEVEL=info              # Logging verbosity
```

## 🏗️ Architecture

```
🌐 Browser Tab → 🧩 Chrome Extension → 📊 Dashboard → 🤖 n8n → 🗣️ Whisper → 🧠 GPT-4 → 📝 Notion
   (Audio)        (Capture)           (Monitor)      (Process)  (Transcribe)  (Analyze)   (Store)
```

## 🔐 Privacy & Security

- 🏠 **Local Processing** - Audio processed locally when possible
- 🚫 **No Cloud Storage** - Audio chunks are temporary
- 🔒 **Minimal Permissions** - Only required Chrome APIs
- 🔐 **Secure Transfer** - HTTPS recommended for production
- 🗑️ **Auto-cleanup** - Temporary files deleted after processing

## 🎨 Dashboard Features

### Real-Time Monitoring
- 🟢 **System Status** - Server health and uptime
- 📈 **Recording Stats** - Sessions, chunks, data volume
- 🎵 **Live Sessions** - Active recordings with progress
- ⚡ **Processing Times** - n8n forwarding performance

### Rich Source Information
- 🏷️ **Platform Detection** - Automatic source identification
- 📄 **Tab Titles** - Full page context
- 🎯 **Recording Types** - Meeting, media, chat categorization
- 📊 **Audio Analytics** - Size, duration, chunk count

## 🧪 Advanced Usage

### Custom Webhook URLs
```javascript
// Dashboard only (no forwarding)
http://localhost:5678/webhook/meeting-audio

// Dashboard + custom n8n forwarding  
http://localhost:5678/webhook/meeting-audio?forward=true

// Direct to your n8n instance
https://your-n8n-instance.com/webhook/meeting-audio
```

### Arc Browser Support
Special handling for Arc's unique permission model:
- 🔄 **Auto-detection** - Recognizes Arc browser
- 📄 **Full-page recorder** - Alternative interface for permissions
- ⚡ **Permission recovery** - Automatic fallback methods

## 📦 File Structure

```
audio-capture-n8n/
├── 🧩 Extension Core
│   ├── manifest.json          # Chrome Extension Manifest V3
│   ├── popup.html/js         # Main extension interface
│   ├── background.js         # Service worker
│   ├── content.js           # Page integration
│   └── recording-page.html  # Arc browser support
├── 📊 Dashboard & Monitoring  
│   ├── dashboard-server.js   # Real-time monitoring
│   ├── launcher.js          # Application launcher
│   └── start-dashboard.*    # Cross-platform scripts
├── 🤖 n8n Integration
│   └── n8n-enhanced-workflow.json  # Complete automation workflow
├── 🔧 Audio Processing
│   └── audio-processor.js   # Modern AudioWorklet implementation
└── 📚 Documentation
    └── README.md           # This file
```

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines:

1. 🍴 Fork the repository
2. 🌟 Create your feature branch
3. ✅ Test thoroughly with the dashboard
4. 📝 Update documentation
5. 🚀 Submit a pull request

## 🐛 Troubleshooting

### Extension Issues
- **Permission denied**: Check Chrome microphone settings
- **No recordings**: Verify webhook URL in extension popup  
- **Arc browser**: Use the full-page recorder interface

### Dashboard Issues
- **Empty dashboard**: Extension using old webhook URL (auto-fixed)
- **Port conflicts**: Dashboard handles port 5678 automatically
- **Missing data**: Check extension console logs

### n8n Integration
- **No events**: Verify webhook URL configuration
- **Processing errors**: Check OpenAI API key and credits
- **Workflow failures**: Review n8n execution logs

## 📄 License

MIT License - Feel free to use, modify, and distribute!

## 🌟 Star This Repository

If this project helps you automate your audio workflows, please give it a star! ⭐

---

**Built with ❤️ for seamless meeting transcription and audio analysis**

[![GitHub stars](https://img.shields.io/github/stars/yourusername/audio-capture-n8n?style=social)](https://github.com/yourusername/audio-capture-n8n/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/yourusername/audio-capture-n8n?style=social)](https://github.com/yourusername/audio-capture-n8n/network/members)
[![GitHub issues](https://img.shields.io/github/issues/yourusername/audio-capture-n8n)](https://github.com/yourusername/audio-capture-n8n/issues)