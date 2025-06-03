#!/usr/bin/env node
/**
 * Meeting Audio Capture Dashboard
 * Advanced monitoring interface for n8n integration
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const app = express();
const PORT = 5678;

// Middleware with increased limits for long recordings
app.use(express.json({ 
  limit: '100mb',  // Increased from 50mb to handle longer recordings
  parameterLimit: 50000
}));
app.use(express.urlencoded({ 
  limit: '100mb', 
  extended: true,
  parameterLimit: 50000 
}));
app.use(express.static(path.join(__dirname, 'public')));

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

// In-memory storage for demo (use database in production)
const meetingData = {
  sessions: new Map(),
  chunks: [],
  webhookAttempts: [],
  stats: {
    totalSessions: 0,
    totalChunks: 0,
    totalAudioSize: 0,
    totalWebhookAttempts: 0,
    successfulWebhookAttempts: 0,
    serverStartTime: new Date(),
    lastActivity: null
  }
};

/**
 * Main webhook endpoint - receives audio from Chrome extension
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
    recordingSessionId,
    source,
    recordingType,
    title
  } = req.body;

  const receivedAt = new Date();
  const audioSize = audio ? audio.length : 0;
  const audioSizeBytes = Math.round(audioSize * 0.75); // Base64 to bytes conversion
  
  // Log webhook attempt
  const webhookAttempt = {
    id: `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: receivedAt,
    sourceIP: req.ip || req.connection.remoteAddress || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
    contentLength: req.get('Content-Length') || '0',
    meetingId,
    chunkIndex,
    recordingSessionId,
    audioSizeBytes,
    status: 'received',
    processingTimeMs: 0
  };
  
  meetingData.webhookAttempts.unshift(webhookAttempt);
  // Keep only last 50 webhook attempts
  if (meetingData.webhookAttempts.length > 50) {
    meetingData.webhookAttempts = meetingData.webhookAttempts.slice(0, 50);
  }
  
  meetingData.stats.totalWebhookAttempts++;
  meetingData.stats.successfulWebhookAttempts++;

  // Create chunk record
  const chunkRecord = {
    id: `${recordingSessionId}-${chunkIndex}`,
    meetingId,
    chunkIndex,
    isFirstChunk,
    isLastChunk,
    recordingSessionId,
    meetingUrl,
    timestamp: new Date(timestamp),
    receivedAt,
    duration,
    format,
    audioSizeChars: audioSize,
    audioSizeBytes,
    processingTime: 0,
    status: 'received',
    // Source information
    source: source || 'unknown',
    recordingType: recordingType || 'general-audio',
    title: title || 'Untitled Recording'
  };

  // Add to chunks array
  meetingData.chunks.unshift(chunkRecord); // Latest first
  
  // Keep only last 100 chunks for memory management
  if (meetingData.chunks.length > 100) {
    meetingData.chunks = meetingData.chunks.slice(0, 100);
  }

  // Update or create session
  if (!meetingData.sessions.has(recordingSessionId)) {
    meetingData.sessions.set(recordingSessionId, {
      sessionId: recordingSessionId,
      meetingId,
      meetingUrl,
      startTime: new Date(timestamp),
      endTime: null,
      chunkCount: 0,
      totalAudioSize: 0,
      status: 'active',
      firstChunkReceived: receivedAt,
      lastChunkReceived: receivedAt,
      // Source information
      source: source || 'unknown',
      recordingType: recordingType || 'general-audio',
      title: title || 'Untitled Recording'
    });
    meetingData.stats.totalSessions++;
  }

  const session = meetingData.sessions.get(recordingSessionId);
  session.chunkCount++;
  session.totalAudioSize += audioSizeBytes;
  session.lastChunkReceived = receivedAt;

  if (isLastChunk) {
    session.status = 'completed';
    session.endTime = receivedAt;
  }

  // Update global stats
  meetingData.stats.totalChunks++;
  meetingData.stats.totalAudioSize += audioSizeBytes;
  meetingData.stats.lastActivity = receivedAt;

  // Log to console with more detail for debugging
  console.log(`📥 [${receivedAt.toLocaleTimeString()}] Chunk ${chunkIndex} received`);
  console.log(`   Meeting: ${meetingId} | Session: ${recordingSessionId.slice(-8)}`);
  console.log(`   Size: ${audioSizeBytes.toLocaleString()} bytes (${(audioSizeBytes / (1024 * 1024)).toFixed(2)} MB) | ${isFirstChunk ? 'FIRST' : isLastChunk ? 'LAST' : 'MIDDLE'}`);
  console.log(`   Base64 length: ${audioSize.toLocaleString()} chars`);
  
  // Warn if chunk is very large
  if (audioSizeBytes > 10 * 1024 * 1024) {
    console.warn(`   ⚠️  Large chunk detected: ${(audioSizeBytes / (1024 * 1024)).toFixed(2)} MB`);
  }

  // Forward to n8n if configured (optional)
  const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'https://yambo-studio.app.n8n.cloud/webhook/meeting-audio';
  
  if (req.headers['x-forward-to-n8n'] === 'true' || req.query.forward === 'true') {
    // Forward to n8n webhook with timeout and better error handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 second timeout for n8n
    
    fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Dashboard-Forwarder/1.0'
      },
      body: JSON.stringify(req.body),
      signal: controller.signal
    }).then(n8nResponse => {
      clearTimeout(timeoutId);
      console.log(`📤 Forwarded to n8n: ${n8nResponse.status}`);
      if (!n8nResponse.ok) {
        n8nResponse.text().then(text => {
          console.error(`   n8n response: ${text.substring(0, 200)}`);
        });
      }
    }).catch(error => {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        console.error('❌ n8n forward timeout after 45 seconds');
      } else {
        console.error('❌ Failed to forward to n8n:', error.message);
      }
      console.error(`   Audio size was: ${(audioSizeBytes / (1024 * 1024)).toFixed(2)} MB`);
    });
  }

  // Simulate processing delay and respond
  setTimeout(() => {
    const processingTime = Date.now() - receivedAt.getTime();
    chunkRecord.processingTime = processingTime;
    chunkRecord.status = 'processed';
    
    // Update webhook attempt with processing time
    webhookAttempt.processingTimeMs = processingTime;
    webhookAttempt.status = 'processed';
    
    res.json({
      success: true,
      chunkId: chunkRecord.id,
      sessionId: recordingSessionId,
      chunkIndex,
      totalChunks: session.chunkCount,
      processingTime: processingTime,
      webhookAttemptId: webhookAttempt.id,
      forwardedToN8n: req.headers['x-forward-to-n8n'] === 'true' || req.query.forward === 'true'
    });
  }, Math.random() * 100 + 50); // 50-150ms delay
});

/**
 * Dashboard HTML page
 */
app.get('/', (req, res) => {
  res.send(generateDashboardHTML());
});

/**
 * API endpoints for dashboard
 */
app.get('/api/stats', (req, res) => {
  const activeSessions = Array.from(meetingData.sessions.values())
    .filter(s => s.status === 'active').length;
    
  res.json({
    ...meetingData.stats,
    activeSessions,
    uptime: Date.now() - meetingData.stats.serverStartTime.getTime(),
    memoryUsage: process.memoryUsage()
  });
});

app.get('/api/sessions', (req, res) => {
  const sessions = Array.from(meetingData.sessions.values())
    .sort((a, b) => b.startTime - a.startTime)
    .slice(0, 20); // Latest 20 sessions
    
  res.json(sessions);
});

app.get('/api/chunks', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json(meetingData.chunks.slice(0, limit));
});

app.get('/api/webhook-attempts', (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  res.json(meetingData.webhookAttempts.slice(0, limit));
});

app.get('/api/session/:sessionId', (req, res) => {
  const session = meetingData.sessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  const sessionChunks = meetingData.chunks
    .filter(c => c.recordingSessionId === req.params.sessionId)
    .sort((a, b) => a.chunkIndex - b.chunkIndex);
    
  res.json({
    session,
    chunks: sessionChunks
  });
});

app.post('/api/reset', (req, res) => {
  meetingData.sessions.clear();
  meetingData.chunks = [];
  meetingData.webhookAttempts = [];
  meetingData.stats = {
    totalSessions: 0,
    totalChunks: 0,
    totalAudioSize: 0,
    totalWebhookAttempts: 0,
    successfulWebhookAttempts: 0,
    serverStartTime: new Date(),
    lastActivity: null
  };
  
  console.log('🔄 Dashboard data reset');
  res.json({ message: 'Dashboard data reset successfully' });
});

/**
 * Test webhook endpoint - for n8n connectivity testing
 */
app.post('/api/test-webhook', async (req, res) => {
  const { webhookUrl } = req.body;
  
  if (!webhookUrl) {
    return res.status(400).json({ error: 'Webhook URL is required' });
  }
  
  // Create test payload
  const testPayload = {
    audio: 'dGVzdCBhdWRpbyBkYXRhIA==', // "test audio data " in base64
    timestamp: new Date().toISOString(),
    duration: 1,
    format: 'webm',
    meetingId: 'test-meeting-connection',
    chunkIndex: 0,
    isFirstChunk: true,
    isLastChunk: true,
    meetingUrl: 'https://meet.google.com/test-connection',
    recordingSessionId: `test_session_${Date.now()}`
  };
  
  // Try to send to the provided webhook URL
  const startTime = Date.now();
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'MeetingAudioCapture/1.0'
      },
      body: JSON.stringify(testPayload)
    });
    
    const responseTime = Date.now() - startTime;
    const responseText = await response.text();
    
    console.log(`[WEBHOOK TEST] Status: ${response.status}, Response: ${responseText.substring(0, 200)}`);
    
    if (response.ok) {
      res.json({
        success: true,
        status: response.status,
        statusText: response.statusText,
        responseTimeMs: responseTime,
        webhookUrl: webhookUrl,
        responseText: responseText.substring(0, 500),
        message: `Successfully connected to webhook in ${responseTime}ms`
      });
    } else {
      res.json({
        success: false,
        status: response.status,
        statusText: response.statusText,
        responseTimeMs: responseTime,
        webhookUrl: webhookUrl,
        responseText: responseText.substring(0, 500),
        message: `Webhook returned error status ${response.status}: ${response.statusText}`
      });
    }
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.log(`[WEBHOOK TEST] Error: ${error.message}`);
    res.json({
      success: false,
      error: error.message,
      responseTimeMs: responseTime,
      webhookUrl: webhookUrl,
      message: `Failed to connect to webhook: ${error.message}`
    });
  }
});

/**
 * Diagnostic endpoint - detailed session analysis
 */
app.get('/api/diagnostics/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = meetingData.sessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  // Analyze session
  const sessionChunks = meetingData.chunks.filter(c => c.recordingSessionId === sessionId);
  const sessionWebhooks = meetingData.webhookAttempts.filter(w => w.sessionId === sessionId);
  
  // Calculate diagnostics
  const duration = (Date.now() - session.startTime) / 1000; // in seconds
  const expectedChunks = Math.ceil(duration / 30);
  const missingChunks = [];
  for (let i = 0; i < expectedChunks; i++) {
    if (!sessionChunks.find(c => c.chunkIndex === i)) {
      missingChunks.push(i);
    }
  }
  
  const failedWebhooks = sessionWebhooks.filter(w => !w.success);
  const avgResponseTime = sessionWebhooks
    .filter(w => w.responseTime)
    .reduce((sum, w) => sum + w.responseTime, 0) / sessionWebhooks.length || 0;
  
  res.json({
    session: {
      id: sessionId,
      startTime: session.startTime,
      duration: (duration / 60).toFixed(1) + ' minutes',
      status: session.isComplete ? 'complete' : 'active',
      totalChunks: sessionChunks.length
    },
    analysis: {
      expectedChunks,
      receivedChunks: sessionChunks.length,
      missingChunks,
      missingCount: missingChunks.length,
      completeness: ((sessionChunks.length / expectedChunks) * 100).toFixed(1) + '%'
    },
    webhooks: {
      total: sessionWebhooks.length,
      successful: sessionWebhooks.filter(w => w.success).length,
      failed: failedWebhooks.length,
      avgResponseTime: avgResponseTime.toFixed(0) + 'ms',
      failures: failedWebhooks.map(f => ({
        chunkIndex: f.chunkIndex,
        error: f.error,
        timestamp: f.timestamp
      }))
    },
    chunks: sessionChunks.map(c => ({
      index: c.chunkIndex,
      size: c.audioSize,
      timestamp: c.timestamp,
      webhookSent: !!sessionWebhooks.find(w => w.chunkIndex === c.chunkIndex)
    }))
  });
});

/**
 * Long recording health check
 */
app.get('/api/health/long-recordings', (req, res) => {
  const longSessions = Array.from(meetingData.sessions.values())
    .filter(s => {
      const duration = (Date.now() - s.startTime) / 1000 / 60; // in minutes
      return duration > 20;
    });
  
  const diagnostics = longSessions.map(session => {
    const sessionChunks = meetingData.chunks.filter(c => c.recordingSessionId === session.id);
    const duration = (Date.now() - session.startTime) / 1000; // in seconds
    const expectedChunks = Math.ceil(duration / 30);
    const completeness = (sessionChunks.length / expectedChunks) * 100;
    
    return {
      sessionId: session.id,
      duration: (duration / 60).toFixed(1) + ' minutes',
      expectedChunks,
      receivedChunks: sessionChunks.length,
      completeness: completeness.toFixed(1) + '%',
      status: completeness > 90 ? 'healthy' : completeness > 70 ? 'degraded' : 'unhealthy'
    };
  });
  
  res.json({
    totalLongRecordings: longSessions.length,
    healthSummary: {
      healthy: diagnostics.filter(d => d.status === 'healthy').length,
      degraded: diagnostics.filter(d => d.status === 'degraded').length,
      unhealthy: diagnostics.filter(d => d.status === 'unhealthy').length
    },
    sessions: diagnostics
  });
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: Date.now() - meetingData.stats.serverStartTime.getTime(),
    totalSessions: meetingData.stats.totalSessions,
    totalChunks: meetingData.stats.totalChunks
  });
});

/**
 * Generate dashboard HTML
 */
function generateDashboardHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Meeting Audio Capture Dashboard</title>
    <style>
        @font-face {
            font-family: 'Basis Grotesque';
            src: url('basis-grotesque-regular.woff2') format('woff2'),
                 url('basis-grotesque-regular-pro.woff') format('woff');
            font-weight: normal;
            font-style: normal;
            font-display: swap;
        }

        @font-face {
            font-family: 'Kalice';
            src: url('Kalice-Regular.woff2') format('woff2'),
                 url('Kalice-Regular.woff') format('woff');
            font-weight: normal;
            font-style: normal;
            font-display: swap;
        }

        @font-face {
            font-family: 'Kalice';
            src: url('Kalice-Italic.woff2') format('woff2'),
                 url('Kalice-Italic.woff') format('woff');
            font-weight: normal;
            font-style: italic;
            font-display: swap;
        }

        * { 
            margin: 0; 
            padding: 0; 
            box-sizing: border-box; 
        }

        body { 
            font-family: 'Basis Grotesque', monospace, sans-serif;
            background: #ffffff;
            color: #000000;
            line-height: 1.4;
            font-size: 12px;
        }

        .header {
            background: #000000;
            color: #ffffff;
            padding: 20px;
            text-align: center;
            border-bottom: 1px solid #000000;
        }

        .header h1 { 
            font-family: 'Kalice', serif;
            font-size: 24px; 
            margin-bottom: 8px; 
            font-weight: normal;
        }

        .header p { 
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .live-indicator {
            display: inline-block;
            width: 6px;
            height: 6px;
            background: #ffffff;
            margin-right: 8px;
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.3; }
            100% { opacity: 1; }
        }

        .container { 
            max-width: 1200px; 
            margin: 0 auto; 
            padding: 20px; 
        }

        .controls {
            text-align: center;
            margin-bottom: 20px;
            padding: 20px;
            border: 1px solid #000000;
        }

        .btn {
            background: #ffffff;
            color: #000000;
            border: 1px solid #000000;
            padding: 12px 20px;
            cursor: pointer;
            font-family: 'Basis Grotesque', monospace, sans-serif;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin: 0 4px;
            transition: all 0.2s;
        }

        .btn:hover { 
            background: #000000; 
            color: #ffffff;
        }

        .btn-danger { 
            background: #000000; 
            color: #ffffff;
        }

        .btn-danger:hover { 
            background: #ffffff; 
            color: #000000;
        }

        .grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); 
            gap: 0; 
            margin-bottom: 20px; 
            border: 1px solid #000000;
        }

        .card {
            background: #ffffff;
            padding: 20px;
            border-right: 1px solid #000000;
            border-bottom: 1px solid #000000;
        }

        .card:nth-child(even) {
            background: #f5f5f5;
        }

        .card h3 { 
            font-family: 'Kalice', serif;
            color: #000000; 
            margin-bottom: 15px; 
            font-size: 14px;
            font-weight: normal;
        }

        .stat { 
            display: flex; 
            justify-content: space-between; 
            margin-bottom: 8px;
            font-size: 11px;
        }

        .stat-label { 
            color: #666666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .stat-value { 
            font-weight: normal;
            color: #000000;
        }

        .status-indicator {
            display: inline-block;
            width: 6px;
            height: 6px;
            border: 1px solid #000000;
            margin-right: 8px;
        }

        .status-active { 
            background: #000000; 
        }

        .status-completed { 
            background: #ffffff; 
        }

        .status-error { 
            background: #000000; 
        }

        .main-card {
            border: 1px solid #000000;
            background: #ffffff;
            margin-bottom: 20px;
        }

        .main-card h3 {
            font-family: 'Kalice', serif;
            font-size: 14px;
            font-weight: normal;
            padding: 15px 20px;
            border-bottom: 1px solid #000000;
            margin: 0;
        }

        .main-card-content {
            padding: 20px;
        }

        .config-card {
            background: #000000;
            color: #ffffff;
            border: 1px solid #000000;
            margin-bottom: 20px;
        }

        .config-card h3 {
            color: #ffffff;
            padding: 15px 20px;
            border-bottom: 1px solid #ffffff;
            font-family: 'Kalice', serif;
            font-size: 14px;
            font-weight: normal;
            margin: 0;
        }

        .config-content {
            padding: 20px;
        }

        .config-url {
            font-family: 'Basis Grotesque', monospace, sans-serif;
            font-size: 11px;
            margin-bottom: 15px;
            color: #ffffff;
        }

        .config-note {
            font-size: 10px;
            line-height: 1.3;
            opacity: 0.8;
        }

        .chunk-item {
            border-bottom: 1px solid #000000;
            padding: 15px 0;
            font-size: 11px;
        }

        .chunk-item:last-child {
            border-bottom: none;
        }

        .chunk-header { 
            font-weight: normal; 
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .chunk-meta { 
            color: #666666; 
            font-size: 10px;
            line-height: 1.3;
        }

        .badge {
            display: inline-block;
            padding: 2px 6px;
            border: 1px solid #000000;
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            background: #ffffff;
            color: #000000;
        }

        .badge-first { 
            background: #000000; 
            color: #ffffff; 
        }

        .badge-last { 
            background: #666666; 
            color: #ffffff; 
        }

        .badge-middle { 
            background: #ffffff; 
            color: #000000; 
        }

        .no-data {
            text-align: center;
            color: #666666;
            padding: 40px 20px;
            font-style: italic;
            font-size: 11px;
        }

        .footer {
            text-align: center;
            padding: 20px;
            color: #666666;
            border-top: 1px solid #000000;
            margin-top: 40px;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        /* Remove emoji dependencies */
        .icon {
            display: inline-block;
            width: 8px;
            height: 8px;
            background: currentColor;
            margin-right: 8px;
        }

        .icon.system {
            clip-path: polygon(25% 25%, 75% 25%, 75% 75%, 25% 75%);
        }

        .icon.stats {
            clip-path: polygon(0 100%, 25% 75%, 50% 85%, 75% 60%, 100% 70%, 100% 100%);
        }

        .icon.webhook {
            clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
        }

        .icon.server {
            clip-path: polygon(0% 20%, 60% 20%, 60% 0%, 100% 50%, 60% 100%, 60% 80%, 0% 80%);
        }

        .icon.recording {
            border-radius: 50%;
        }

        .icon.chunks {
            clip-path: polygon(20% 0%, 80% 0%, 100% 20%, 100% 80%, 80% 100%, 20% 100%, 0% 80%, 0% 20%);
        }

        /* Clean transitions */
        * {
            transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
        }

        /* Better focus states */
        button:focus {
            outline: 2px solid #000000;
            outline-offset: 2px;
        }

        /* Grid responsive behavior */
        @media (max-width: 768px) {
            .grid {
                grid-template-columns: 1fr;
            }
            
            .card {
                border-right: none;
            }
            
            .card:last-child {
                border-bottom: none;
            }
        }

        /* Monospace code styling */
        code {
            font-family: 'Basis Grotesque', monospace, sans-serif;
            background: #f5f5f5;
            padding: 2px 4px;
            border: 1px solid #000000;
            font-size: 10px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Meeting Audio Capture Dashboard</h1>
        <p><span class="live-indicator"></span>Yambo x Claude 2025</p>
    </div>

    <div class="container">
        <div class="controls">
            <button class="btn" onclick="refreshData()">
                <span class="icon system"></span>
                Refresh Data
            </button>
            <button class="btn btn-danger" onclick="resetData()">
                <span class="icon system"></span>
                Reset All Data
            </button>
        </div>
        
        <div class="config-card">
            <h3>Current Webhook Configuration</h3>
            <div class="config-content">
                <div class="config-url">
                    http://localhost:5678/webhook/meeting-audio?forward=true
                </div>
                <div class="config-note">
                    <strong>Not seeing recordings?</strong> Update your Chrome extension to use this webhook URL.
                </div>
            </div>
        </div>

        <div class="grid" id="statsGrid">
            <div class="card">
                <h3><span class="icon system"></span>System Status</h3>
                <div class="stat">
                    <span class="stat-label">Server Status</span>
                    <span class="stat-value">Online</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Uptime</span>
                    <span class="stat-value">0h 1m</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Active Sessions</span>
                    <span class="stat-value">0</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Last Activity</span>
                    <span class="stat-value">No activity yet</span>
                </div>
            </div>
            
            <div class="card">
                <h3><span class="icon stats"></span>Recording Stats</h3>
                <div class="stat">
                    <span class="stat-label">Total Sessions</span>
                    <span class="stat-value">0</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Total Chunks</span>
                    <span class="stat-value">0</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Total Audio Data</span>
                    <span class="stat-value">0 B</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Avg Chunk Size</span>
                    <span class="stat-value">0 B</span>
                </div>
            </div>
            
            <div class="card">
                <h3><span class="icon webhook"></span>Webhook Connection</h3>
                <div class="stat">
                    <span class="stat-label">Total Attempts</span>
                    <span class="stat-value">0</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Successful</span>
                    <span class="stat-value">0</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Success Rate</span>
                    <span class="stat-value">0%</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Webhook Status</span>
                    <span class="stat-value">Waiting</span>
                </div>
            </div>
            
            <div class="card">
                <h3><span class="icon server"></span>Server Resources</h3>
                <div class="stat">
                    <span class="stat-label">Memory Used</span>
                    <span class="stat-value">9.65 MB</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Memory Total</span>
                    <span class="stat-value">11.55 MB</span>
                </div>
                <div class="stat">
                    <span class="stat-label">External Memory</span>
                    <span class="stat-value">1.96 MB</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Server Started</span>
                    <span class="stat-value">6/3/2025, 9:04:11 PM</span>
                </div>
            </div>
        </div>

        <div class="main-card">
            <h3><span class="icon recording"></span>Recent Recording Sessions</h3>
            <div class="main-card-content">
                <div id="sessionsList">
                    <div class="no-data">No recording sessions yet. Start recording in Chrome extension!</div>
                </div>
            </div>
        </div>

        <div class="main-card">
            <h3><span class="icon webhook"></span>Recent Webhook Attempts</h3>
            <div class="main-card-content">
                <div id="webhookAttemptsList">
                    <div class="no-data">No webhook attempts yet. Start recording to see connection logs!</div>
                </div>
            </div>
        </div>

        <div class="main-card">
            <h3><span class="icon chunks"></span>Latest Audio Chunks</h3>
            <div class="main-card-content">
                <div id="chunksList">
                    <div class="no-data">No audio chunks received yet.</div>
                </div>
            </div>
        </div>
    </div>

    <div class="footer">
        <p>Meeting Audio Capture System v1.0 | by Yambo Studio 2025</p>
    </div>

    <script>
        let autoRefresh = true;
        
        async function loadStats() {
            try {
                const response = await fetch('/api/stats');
                const stats = await response.json();
                
                const uptimeHours = Math.floor(stats.uptime / (1000 * 60 * 60));
                const uptimeMinutes = Math.floor((stats.uptime % (1000 * 60 * 60)) / (1000 * 60));
                
                const lastActivityText = stats.lastActivity 
                    ? new Date(stats.lastActivity).toLocaleString()
                    : 'No activity yet';
                
                document.getElementById('statsGrid').innerHTML = \`
                    <div class="card">
                        <h3><span class="icon system"></span>System Status</h3>
                        <div class="stat">
                            <span class="stat-label">Server Status</span>
                            <span class="stat-value">Online</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Uptime</span>
                            <span class="stat-value">\${uptimeHours}h \${uptimeMinutes}m</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Active Sessions</span>
                            <span class="stat-value">\${stats.activeSessions}</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Last Activity</span>
                            <span class="stat-value">\${lastActivityText}</span>
                        </div>
                    </div>
                    
                    <div class="card">
                        <h3><span class="icon stats"></span>Recording Stats</h3>
                        <div class="stat">
                            <span class="stat-label">Total Sessions</span>
                            <span class="stat-value">\${stats.totalSessions.toLocaleString()}</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Total Chunks</span>
                            <span class="stat-value">\${stats.totalChunks.toLocaleString()}</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Total Audio Data</span>
                            <span class="stat-value">\${formatBytes(stats.totalAudioSize)}</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Avg Chunk Size</span>
                            <span class="stat-value">\${stats.totalChunks > 0 ? formatBytes(stats.totalAudioSize / stats.totalChunks) : '0 B'}</span>
                        </div>
                    </div>
                    
                    <div class="card">
                        <h3><span class="icon webhook"></span>Webhook Connection</h3>
                        <div class="stat">
                            <span class="stat-label">Total Attempts</span>
                            <span class="stat-value">\${stats.totalWebhookAttempts.toLocaleString()}</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Successful</span>
                            <span class="stat-value">\${stats.successfulWebhookAttempts.toLocaleString()}</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Success Rate</span>
                            <span class="stat-value">\${stats.totalWebhookAttempts > 0 ? Math.round((stats.successfulWebhookAttempts / stats.totalWebhookAttempts) * 100) : 0}%</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Webhook Status</span>
                            <span class="stat-value">\${stats.totalWebhookAttempts > 0 ? 'Active' : 'Waiting'}</span>
                        </div>
                    </div>
                    
                    <div class="card">
                        <h3><span class="icon server"></span>Server Resources</h3>
                        <div class="stat">
                            <span class="stat-label">Memory Used</span>
                            <span class="stat-value">\${formatBytes(stats.memoryUsage.heapUsed)}</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Memory Total</span>
                            <span class="stat-value">\${formatBytes(stats.memoryUsage.heapTotal)}</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">External Memory</span>
                            <span class="stat-value">\${formatBytes(stats.memoryUsage.external)}</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Server Started</span>
                            <span class="stat-value">\${new Date(stats.serverStartTime).toLocaleString()}</span>
                        </div>
                    </div>
                \`;
            } catch (error) {
                console.error('Error loading stats:', error);
            }
        }
        
        async function loadSessions() {
            try {
                const response = await fetch('/api/sessions');
                const sessions = await response.json();
                
                if (sessions.length === 0) {
                    document.getElementById('sessionsList').innerHTML = 
                        '<div class="no-data">No recording sessions yet. Start recording in Chrome extension!</div>';
                    return;
                }
                
                const sessionsHTML = sessions.map(session => {
                    const duration = session.endTime 
                        ? Math.round((new Date(session.endTime) - new Date(session.startTime)) / 1000)
                        : Math.round((Date.now() - new Date(session.startTime)) / 1000);
                    
                    const sourceIcon = {
                        'google-meet': 'recording',
                        'zoom': 'recording',
                        'teams': 'recording', 
                        'youtube': 'recording',
                        'spotify': 'recording',
                        'discord': 'recording',
                        'browser': 'recording'
                    }[session.source] || 'recording';
                        
                    return \`
                        <div class="chunk-item">
                            <div class="chunk-header">
                                <span class="status-indicator status-\${session.status}"></span>
                                <span class="icon \${sourceIcon}"></span>
                                \${session.title || session.meetingId}
                                <span class="badge badge-\${session.status === 'active' ? 'first' : 'last'}">\${session.status.toUpperCase()}</span>
                            </div>
                            <div class="chunk-meta">
                                Source: \${session.source} | 
                                Type: \${session.recordingType} | 
                                Chunks: \${session.chunkCount} | 
                                Size: \${formatBytes(session.totalAudioSize)} | 
                                Duration: \${duration}s | 
                                Started: \${new Date(session.startTime).toLocaleTimeString()}
                            </div>
                        </div>
                    \`;
                }).join('');
                
                document.getElementById('sessionsList').innerHTML = sessionsHTML;
            } catch (error) {
                console.error('Error loading sessions:', error);
            }
        }
        
        async function loadChunks() {
            try {
                const response = await fetch('/api/chunks?limit=20');
                const chunks = await response.json();
                
                if (chunks.length === 0) {
                    document.getElementById('chunksList').innerHTML = 
                        '<div class="no-data">No audio chunks received yet.</div>';
                    return;
                }
                
                const chunksHTML = chunks.map(chunk => {
                    const chunkType = chunk.isFirstChunk ? 'first' : chunk.isLastChunk ? 'last' : 'middle';
                    const badgeText = chunk.isFirstChunk ? 'FIRST' : chunk.isLastChunk ? 'LAST' : \`#\${chunk.chunkIndex}\`;
                    
                    return \`
                        <div class="chunk-item">
                            <div class="chunk-header">
                                <span class="icon chunks"></span>
                                \${chunk.title || chunk.meetingId} - Chunk \${chunk.chunkIndex}
                                <span class="badge badge-\${chunkType}">\${badgeText}</span>
                            </div>
                            <div class="chunk-meta">
                                Source: \${chunk.source} | 
                                Type: \${chunk.recordingType} | 
                                Size: \${formatBytes(chunk.audioSizeBytes)} | 
                                Duration: \${chunk.duration}s | 
                                Received: \${new Date(chunk.receivedAt).toLocaleTimeString()} | 
                                → n8n: \${chunk.processingTime}ms
                            </div>
                        </div>
                    \`;
                }).join('');
                
                document.getElementById('chunksList').innerHTML = chunksHTML;
            } catch (error) {
                console.error('Error loading chunks:', error);
            }
        }
        
        function formatBytes(bytes) {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }
        
        async function loadWebhookAttempts() {
            try {
                const response = await fetch('/api/webhook-attempts?limit=15');
                const attempts = await response.json();
                
                if (attempts.length === 0) {
                    document.getElementById('webhookAttemptsList').innerHTML = 
                        '<div class="no-data">No webhook attempts yet. Start recording to see connection logs!</div>';
                    return;
                }
                
                const attemptsHTML = attempts.map(attempt => {
                    const statusClass = attempt.status === 'processed' ? 'status-active' : 'status-error';
                    const timeSinceAttempt = Math.round((Date.now() - new Date(attempt.timestamp).getTime()) / 1000);
                    const timeText = timeSinceAttempt < 60 ? \`\${timeSinceAttempt}s ago\` : 
                                   timeSinceAttempt < 3600 ? \`\${Math.floor(timeSinceAttempt/60)}m ago\` : 
                                   \`\${Math.floor(timeSinceAttempt/3600)}h ago\`;
                    
                    return \`
                        <div class="chunk-item">
                            <div class="chunk-header">
                                <span class="status-indicator \${statusClass}"></span>
                                <span class="icon webhook"></span>
                                Webhook from \${attempt.sourceIP} - Meeting: \${attempt.meetingId}
                                <span class="badge badge-\${attempt.status === 'processed' ? 'first' : 'middle'}">\${attempt.status.toUpperCase()}</span>
                            </div>
                            <div class="chunk-meta">
                                Session: \${attempt.recordingSessionId ? attempt.recordingSessionId.slice(-12) : 'N/A'} | 
                                Chunk: \${attempt.chunkIndex} | 
                                Size: \${formatBytes(attempt.audioSizeBytes)} | 
                                Processing: \${attempt.processingTimeMs}ms | 
                                \${timeText} | 
                                Content-Length: \${attempt.contentLength} bytes
                            </div>
                        </div>
                    \`;
                }).join('');
                
                document.getElementById('webhookAttemptsList').innerHTML = attemptsHTML;
            } catch (error) {
                console.error('Error loading webhook attempts:', error);
            }
        }
        
        async function refreshData() {
            await Promise.all([loadStats(), loadSessions(), loadWebhookAttempts(), loadChunks()]);
        }
        
        async function resetData() {
            if (confirm('Are you sure you want to reset all dashboard data?')) {
                try {
                    await fetch('/api/reset', { method: 'POST' });
                    await refreshData();
                    alert('Data reset successfully!');
                } catch (error) {
                    alert('Error resetting data: ' + error.message);
                }
            }
        }
        
        // Initial load
        refreshData();
        
        // Auto-refresh every 5 seconds
        setInterval(() => {
            if (autoRefresh) {
                refreshData();
            }
        }, 5000);
        
        // Handle visibility change
        document.addEventListener('visibilitychange', () => {
            autoRefresh = !document.hidden;
        });
    </script>
</body>
</html>`;
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n📊 Dashboard server shutting down...');
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 Meeting Audio Capture Dashboard Server');
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`📥 Webhook: POST http://localhost:${PORT}/webhook/meeting-audio`);
  console.log(`🔧 API: http://localhost:${PORT}/api/stats`);
  console.log('');
  console.log('💡 Features:');
  console.log('   - Real-time monitoring of recording sessions');
  console.log('   - Audio chunk tracking with metadata');
  console.log('   - Server performance metrics');
  console.log('   - Session and chunk history');
  console.log('   - Auto-refresh dashboard');
  console.log('');
  console.log('🎯 Ready to receive audio chunks from Chrome extension!');
});