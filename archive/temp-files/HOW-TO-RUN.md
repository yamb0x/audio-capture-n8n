# 🚀 How to Run the Dashboard

## Quick Start (macOS)

### Option 1: Double-click launcher
**Double-click** `Launch Dashboard.command` file

This will:
- ✅ Kill any existing dashboard processes
- ✅ Start the dashboard server
- ✅ Automatically open your browser to http://localhost:5678

### Option 2: Terminal
Open Terminal and run:
```bash
./start-dashboard.sh
```

### Option 3: npm command
```bash
npm run dashboard
```

## What happens when you launch:

1. **🔍 Process cleanup** - Kills any existing dashboard or launcher processes
2. **📦 Dependency check** - Installs npm packages if needed  
3. **🚀 Server start** - Launches dashboard on port 5678
4. **🌐 Browser open** - Automatically opens http://localhost:5678
5. **🎯 Ready** - Dashboard is ready to monitor webhook connections

## Stopping the Dashboard

- Press **Ctrl+C** in the terminal
- Or simply close the terminal window
- The cleanup will automatically kill all related processes

## Troubleshooting

### If clicking the .command file opens your IDE:
1. **Right-click** the `Launch Dashboard.command` file
2. Select **"Open With"** → **"Terminal"**
3. Or set Terminal as the default app for .command files

### If port 5678 is busy:
The script automatically kills processes using port 5678, so this shouldn't happen.

### If browser doesn't open automatically:
Manually navigate to: **http://localhost:5678**