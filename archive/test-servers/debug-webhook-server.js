const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3333;

// Enable CORS for all origins
app.use(cors());

// Parse JSON bodies
app.use(express.json({ limit: '50mb' }));

// Counter for received chunks
let chunkCounter = 0;
let sessions = {};

// Debug webhook endpoint
app.post('/webhook/debug', (req, res) => {
    chunkCounter++;
    const timestamp = new Date().toISOString();
    const { 
        recordingSessionId, 
        chunkIndex, 
        isFirstChunk, 
        isLastChunk, 
        meetingId,
        audio 
    } = req.body;
    
    console.log('\n=== WEBHOOK RECEIVED ===');
    console.log(`[${timestamp}] Chunk #${chunkCounter}`);
    console.log('Session ID:', recordingSessionId);
    console.log('Meeting ID:', meetingId);
    console.log('Chunk Index:', chunkIndex);
    console.log('Is First Chunk:', isFirstChunk);
    console.log('Is Last Chunk:', isLastChunk);
    console.log('Audio Data Length:', audio ? audio.length : 0);
    
    // Track session chunks
    if (!sessions[recordingSessionId]) {
        sessions[recordingSessionId] = {
            meetingId,
            chunks: [],
            startTime: timestamp
        };
    }
    
    sessions[recordingSessionId].chunks.push({
        chunkIndex,
        isFirstChunk,
        isLastChunk,
        audioLength: audio ? audio.length : 0,
        timestamp
    });
    
    if (isLastChunk) {
        console.log('\n🎯 FINAL CHUNK RECEIVED!');
        console.log('Session Summary:');
        console.log('- Total chunks:', sessions[recordingSessionId].chunks.length);
        console.log('- Session duration:', 
            new Date(timestamp) - new Date(sessions[recordingSessionId].startTime), 'ms');
        console.log('- All chunks:', JSON.stringify(sessions[recordingSessionId].chunks, null, 2));
    }
    
    console.log('=======================\n');
    
    res.json({ 
        success: true, 
        message: 'Chunk received',
        chunkNumber: chunkCounter,
        isLastChunk 
    });
});

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ 
        status: 'Debug webhook server running',
        chunksReceived: chunkCounter,
        activeSessions: Object.keys(sessions).length,
        sessions: Object.keys(sessions).map(id => ({
            id,
            chunks: sessions[id].chunks.length,
            hasLastChunk: sessions[id].chunks.some(c => c.isLastChunk)
        }))
    });
});

app.listen(PORT, () => {
    console.log(`\n🔧 Debug Webhook Server Started`);
    console.log(`📍 Webhook URL: http://localhost:${PORT}/webhook/debug`);
    console.log(`📊 Status page: http://localhost:${PORT}/`);
    console.log('\nWaiting for audio chunks...\n');
});