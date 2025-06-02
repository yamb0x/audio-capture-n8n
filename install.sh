#!/bin/bash

echo "🎤 Meeting Audio Capture - Installation Script"
echo "=============================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "💡 Please install Node.js from https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js found: $(node --version)"

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

echo "📁 Working in: $SCRIPT_DIR"

# Fix npm permissions if needed
if [ -d "/Users/$(whoami)/.npm" ]; then
    echo "🔧 Fixing npm permissions..."
    sudo chown -R $(id -u):$(id -g) "/Users/$(whoami)/.npm" 2>/dev/null || true
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install express

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully!"
    echo ""
    echo "🚀 Ready to start! Use one of these commands:"
    echo "   ./start-dashboard.sh     # Interactive launcher"
    echo "   ./start-dashboard.sh -a  # Auto-start mode"
    echo "   npm start               # Interactive launcher"
    echo "   npm run auto            # Auto-start mode"
else
    echo "❌ Failed to install dependencies"
    echo "💡 Try running: npm cache clean --force"
    exit 1
fi