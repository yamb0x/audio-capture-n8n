#!/bin/bash

# Long Recording Test Script
# Tests 30-minute recording scenarios

echo "==================================="
echo "Audio Capture Long Recording Test"
echo "==================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if dashboard is running
echo "Checking dashboard server..."
if curl -s http://localhost:5678/api/stats > /dev/null; then
    echo -e "${GREEN}✓ Dashboard server is running${NC}"
else
    echo -e "${RED}✗ Dashboard server is not running${NC}"
    echo "Starting dashboard server..."
    cd "$(dirname "$0")"
    node dashboard-server.js > dashboard.log 2>&1 &
    sleep 3
fi

# Run the debug tool
echo ""
echo "Starting 30-minute recording simulation..."
echo "This will:"
echo "- Simulate 60 audio chunks (30 seconds each)"
echo "- Monitor memory usage"
echo "- Track webhook responses"
echo "- Generate diagnostic report"
echo ""

node debug-long-recording.js

echo ""
echo "Test complete. Check the generated debug files:"
echo "- debug-recording-*.log"
echo "- debug-report-*.json"
echo "- debug-issues-*.json"