#!/bin/bash

echo "Enabling debug mode for Meet Audio Capture extension..."

# Backup current popup.js
if [ -f "popup.js" ]; then
    echo "Backing up current popup.js to popup-original.js"
    cp popup.js popup-original.js
else
    echo "Error: popup.js not found!"
    exit 1
fi

# Copy debug version
if [ -f "popup-debug.js" ]; then
    echo "Copying popup-debug.js to popup.js"
    cp popup-debug.js popup.js
    echo "✅ Debug mode enabled!"
    echo ""
    echo "Next steps:"
    echo "1. Go to chrome://extensions/"
    echo "2. Click the refresh icon on 'Meet Audio Capture' extension"
    echo "3. Right-click the extension popup and select 'Inspect'"
    echo "4. Start recording and check the Console tab for debug logs"
    echo ""
    echo "To restore original version later, run:"
    echo "  cp popup-original.js popup.js"
else
    echo "Error: popup-debug.js not found!"
    exit 1
fi