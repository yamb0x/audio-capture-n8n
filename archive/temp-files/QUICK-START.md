# 🚀 Quick Start Guide

## ⚡ 5-Minute Setup

### 1. Install Chrome Extension
```bash
# Open Chrome → Extensions → Developer Mode → Load Unpacked
# Select this folder: meet-audio-capture
```

### 2. Start Dashboard
```bash
# Double-click one of these files:
./start-dashboard.sh          # Mac/Linux  
start-dashboard.bat           # Windows

# OR run from terminal:
npm start                     # Interactive mode
npm run auto                  # Auto-start mode
```

### 3. Test Recording
```bash
# 1. Join any Google Meet call
# 2. Click the extension icon
# 3. Click "Start Recording"  
# 4. Watch dashboard at http://localhost:5678
```

## 🎯 For n8n Integration

1. **Change webhook URL** in extension popup to your n8n webhook
2. **Import workflow** from `n8n-meeting-workflow.json`
3. **Set up Whisper API** and other services per your workflow
4. **Start recording** - data flows automatically to n8n!

## 📊 Dashboard Features

- **Real-time monitoring** of audio chunks
- **Session tracking** with metadata
- **Performance metrics** and statistics  
- **Auto-refresh** every 5 seconds
- **API endpoints** for integration

## 🛠️ Troubleshooting

**Extension not working?**
- Ensure you're on `https://meet.google.com/...`
- Check Chrome permissions
- Reload extension

**Dashboard not loading?**
- Check port 5678 is free
- Run `npm install` if needed
- Use `./install.sh` for setup

**No data flowing?**
- Verify webhook URL in extension
- Check dashboard logs
- Test with simple webhook first

## 📁 Key Files

- `manifest.json` - Chrome extension config
- `popup.js` - Recording logic with metadata
- `dashboard-server.js` - Advanced monitoring dashboard
- `launcher.js` - Desktop application launcher
- `start-dashboard.sh/.bat` - Cross-platform startup scripts

## 🎉 Success Indicators

✅ Extension shows "Recording" status  
✅ Dashboard shows real-time audio chunks  
✅ Metadata includes meeting ID and session tracking  
✅ API returns session statistics  

Your meeting audio capture system is ready for production use with n8n! 🚀