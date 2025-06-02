#!/usr/bin/env node
/**
 * Simple Webhook Server for Testing n8n Integration
 * Receives audio chunks with metadata and logs them
 */

const express = require('express');
const app = express();
const PORT = 5678;

// Middleware
app.use(express.json({ limit: '50mb' }));

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Store chunks by session for testing
const sessionChunks = new Map();

/**
 * Main webhook endpoint - mimics n8n webhook behavior
 */
app.post('/webhook/meeting-audio', (req, res) => {
  const {
    audio,
    timestamp,
    duration,
    format,
    meetingId,
    chunkIndex,
    isFirstChunk,
    isLastChunk,
    meetingUrl,
    recordingSessionId
  } = req.body;

  console.log('📥 Received audio chunk from extension:');
  console.log('   📊 Metadata:', {
    meetingId,
    chunkIndex,
    isFirstChunk,
    isLastChunk,
    recordingSessionId,
    timestamp: new Date(timestamp).toLocaleTimeString()
  });
  console.log('   🎵 Audio:', {
    format,
    duration,
    sizeBase64: audio ? audio.length : 0,
    sizeBytes: audio ? Math.round(audio.length * 0.75) : 0
  });
  console.log('   🔗 Meeting URL:', meetingUrl);
  
  // Track chunks by session
  if (!sessionChunks.has(recordingSessionId)) {
    sessionChunks.set(recordingSessionId, []);
    console.log('   🆕 New recording session started');
  }
  
  const chunks = sessionChunks.get(recordingSessionId);
  chunks.push({
    chunkIndex,
    timestamp,
    isFirstChunk,
    isLastChunk,
    audioSize: audio ? audio.length : 0
  });
  
  console.log(`   📈 Session progress: ${chunks.length} chunks received`);
  
  if (isFirstChunk) {
    console.log('   🎬 FIRST chunk of recording session');
  }
  
  if (isLastChunk) {
    console.log('   🏁 LAST chunk of recording session');
    console.log(`   ✅ Session ${recordingSessionId} completed with ${chunks.length} chunks`);
    
    // Log session summary
    console.log('   📋 Session Summary:');
    chunks.forEach((chunk, index) => {
      console.log(`      Chunk ${chunk.chunkIndex}: ${chunk.audioSize} chars, ${chunk.timestamp}`);
    });
  }
  
  console.log(''); // Empty line for readability
  
  // Respond with success (n8n expects this)
  res.json({ 
    message: 'Audio chunk received successfully',
    sessionId: recordingSessionId,
    chunkIndex: chunkIndex,
    totalChunks: chunks.length
  });
});

/**
 * Session status endpoint
 */
app.get('/sessions', (req, res) => {
  const sessions = Array.from(sessionChunks.entries()).map(([sessionId, chunks]) => ({
    sessionId,
    chunkCount: chunks.length,
    isComplete: chunks.some(c => c.isLastChunk),
    firstChunk: chunks.find(c => c.isFirstChunk)?.timestamp,
    lastChunk: chunks[chunks.length - 1]?.timestamp
  }));
  
  res.json(sessions);
});

/**
 * Session details endpoint
 */
app.get('/sessions/:sessionId', (req, res) => {
  const sessionId = req.params.sessionId;
  const chunks = sessionChunks.get(sessionId);
  
  if (!chunks) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json({
    sessionId,
    chunks: chunks.map(c => ({
      chunkIndex: c.chunkIndex,
      timestamp: c.timestamp,
      isFirstChunk: c.isFirstChunk,
      isLastChunk: c.isLastChunk,
      audioSizeChars: c.audioSize
    }))
  });
});

/**
 * Clear all sessions
 */
app.post('/reset', (req, res) => {
  sessionChunks.clear();
  console.log('🔄 All sessions cleared');
  res.json({ message: 'All sessions cleared' });
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 Simple Webhook Test Server for n8n Integration');
  console.log(`📥 Webhook endpoint: http://localhost:${PORT}/webhook/meeting-audio`);
  console.log(`📊 View sessions: http://localhost:${PORT}/sessions`);
  console.log(`🔄 Reset sessions: POST http://localhost:${PORT}/reset`);
  console.log('');
  console.log('💡 This server mimics n8n webhook behavior and logs all metadata');
  console.log('   Use this to test your Chrome extension before setting up n8n');
  console.log('');
  console.log('🎯 Expected metadata in each chunk:');
  console.log('   - meetingId: extracted from Google Meet URL');
  console.log('   - chunkIndex: incrementing counter (0, 1, 2...)');
  console.log('   - isFirstChunk: true for first chunk only');
  console.log('   - isLastChunk: true for final chunk only');
  console.log('   - recordingSessionId: unique per recording session');
  console.log('   - meetingUrl: full Google Meet URL');
  console.log('   - audio: base64 encoded WebM data');
});