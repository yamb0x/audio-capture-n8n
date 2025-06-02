#!/bin/bash

# Meeting Audio Capture Dashboard Launcher
# Cross-platform startup script with process management

echo "🎤 Meeting Audio Capture Dashboard Launcher"
echo "=============================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "💡 Please install Node.js from https://nodejs.org/"
    read -p "Press Enter to exit..."
    exit 1
fi

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

echo "📁 Working directory: $SCRIPT_DIR"

# Function to kill existing dashboard processes
kill_existing_processes() {
    echo "🔍 Checking for existing dashboard processes..."
    
    # Kill any existing dashboard-server.js processes
    DASHBOARD_PIDS=$(pgrep -f "dashboard-server.js")
    if [ ! -z "$DASHBOARD_PIDS" ]; then
        echo "🔪 Killing existing dashboard processes: $DASHBOARD_PIDS"
        kill -9 $DASHBOARD_PIDS 2>/dev/null
        sleep 1
    fi
    
    # Kill any existing launcher.js processes
    LAUNCHER_PIDS=$(pgrep -f "launcher.js")
    if [ ! -z "$LAUNCHER_PIDS" ]; then
        echo "🔪 Killing existing launcher processes: $LAUNCHER_PIDS"
        kill -9 $LAUNCHER_PIDS 2>/dev/null
        sleep 1
    fi
    
    # Kill any Node.js processes using port 5678
    PORT_PIDS=$(lsof -ti:5678 2>/dev/null)
    if [ ! -z "$PORT_PIDS" ]; then
        echo "🔪 Killing processes using port 5678: $PORT_PIDS"
        kill -9 $PORT_PIDS 2>/dev/null
        sleep 1
    fi
    
    echo "✅ Previous processes cleaned up"
}

# Kill existing processes
kill_existing_processes

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies"
        read -p "Press Enter to exit..."
        exit 1
    fi
fi

# Create a trap to cleanup on script exit
cleanup() {
    echo ""
    echo "🛑 Shutting down dashboard..."
    kill_existing_processes
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start the dashboard directly
echo "🚀 Starting dashboard server..."
echo "📊 Dashboard will be available at: http://localhost:5678"
echo "🔗 Webhook endpoint: http://localhost:5678/webhook/meeting-audio"
echo ""
echo "💡 Press Ctrl+C to stop the server"
echo "🌐 Opening browser in 3 seconds..."
echo ""

# Start the dashboard server in the background
node dashboard-server.js &
DASHBOARD_PID=$!

# Wait a moment for server to start
sleep 3

# Open browser (works on macOS)
if command -v open &> /dev/null; then
    open "http://localhost:5678"
elif command -v xdg-open &> /dev/null; then
    xdg-open "http://localhost:5678"
elif command -v start &> /dev/null; then
    start "http://localhost:5678"
fi

# Wait for the dashboard process
wait $DASHBOARD_PID