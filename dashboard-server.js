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

// Middleware
app.use(express.json({ limit: '50mb' }));
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

  // Log to console
  console.log(`📥 [${receivedAt.toLocaleTimeString()}] Chunk ${chunkIndex} received`);
  console.log(`   Meeting: ${meetingId} | Session: ${recordingSessionId.slice(-8)}`);
  console.log(`   Size: ${audioSizeBytes.toLocaleString()} bytes | ${isFirstChunk ? 'FIRST' : isLastChunk ? 'LAST' : 'MIDDLE'}`);

  // Forward to n8n if configured (optional)
  const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'https://yambo-studio.app.n8n.cloud/webhook/meeting-audio';
  
  if (req.headers['x-forward-to-n8n'] === 'true' || req.query.forward === 'true') {
    // Forward to n8n webhook
    fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Dashboard-Forwarder/1.0'
      },
      body: JSON.stringify(req.body)
    }).then(n8nResponse => {
      console.log(`📤 Forwarded to n8n: ${n8nResponse.status}`);
    }).catch(error => {
      console.error('❌ Failed to forward to n8n:', error.message);
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
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Meeting Audio Capture Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f7;
            color: #1d1d1f;
            line-height: 1.6;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2rem;
            text-align: center;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }
        .header h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
        .header p { opacity: 0.9; font-size: 1.1rem; }
        .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem; margin-bottom: 2rem; }
        .card {
            background: white;
            border-radius: 12px;
            padding: 1.5rem;
            box-shadow: 0 4px 20px rgba(0,0,0,0.08);
            border: 1px solid #e5e5e7;
        }
        .card h3 { color: #333; margin-bottom: 1rem; font-size: 1.2rem; }
        .stat { display: flex; justify-content: space-between; margin-bottom: 0.5rem; }
        .stat-label { color: #666; }
        .stat-value { font-weight: 600; }
        .status-indicator {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            margin-right: 8px;
        }
        .status-active { background: #34c759; }
        .status-completed { background: #007aff; }
        .status-error { background: #ff3b30; }
        .chunk-item {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 1rem;
            margin-bottom: 0.5rem;
            font-size: 0.9rem;
        }
        .chunk-header { font-weight: 600; margin-bottom: 0.5rem; }
        .chunk-meta { color: #666; font-size: 0.8rem; }
        .badge {
            display: inline-block;
            padding: 0.2rem 0.6rem;
            border-radius: 12px;
            font-size: 0.75rem;
            font-weight: 600;
            margin-right: 0.5rem;
        }
        .badge-first { background: #d4edda; color: #155724; }
        .badge-last { background: #f8d7da; color: #721c24; }
        .badge-middle { background: #e2e3e5; color: #383d41; }
        .controls {
            text-align: center;
            margin-bottom: 2rem;
        }
        .btn {
            background: #007aff;
            color: white;
            border: none;
            padding: 0.8rem 1.5rem;
            border-radius: 8px;
            cursor: pointer;
            font-size: 1rem;
            margin: 0 0.5rem;
            transition: background 0.3s;
        }
        .btn:hover { background: #0051d5; }
        .btn-danger { background: #ff3b30; }
        .btn-danger:hover { background: #d70015; }
        .no-data {
            text-align: center;
            color: #666;
            padding: 3rem;
            font-style: italic;
        }
        .live-indicator {
            display: inline-block;
            width: 12px;
            height: 12px;
            background: #34c759;
            border-radius: 50%;
            animation: pulse 2s infinite;
            margin-right: 8px;
        }
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }
        .footer {
            text-align: center;
            padding: 2rem;
            color: #666;
            border-top: 1px solid #e5e5e7;
            margin-top: 3rem;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🎤 Meeting Audio Capture Dashboard</h1>
        <p><span class="live-indicator"></span>Monitoring Chrome Extension → n8n Webhook Integration</p>
    </div>

    <div class="container">
        <div class="controls">
            <button class="btn" onclick="refreshData()">🔄 Refresh Data</button>
            <button class="btn btn-danger" onclick="resetData()">🗑️ Reset All Data</button>
        </div>
        
        <div class="card" style="background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); border: 2px solid #4caf50;">
            <h3 style="color: #2e7d32;">📍 Current Webhook Configuration</h3>
            <div style="padding: 1rem; background: #fff; border-radius: 6px; border-left: 4px solid #4caf50;">
                <code style="font-family: 'Monaco', 'Consolas', monospace; font-size: 1rem; color: #2e7d32;">http://localhost:5678/webhook/meeting-audio?forward=true</code>
                <p style="margin: 0.5rem 0 0 0; font-size: 0.9rem; color: #666;">✅ Monitoring recordings in dashboard and forwarding to n8n</p>
            </div>
            <div style="margin-top: 1rem; padding: 1rem; background: #fff3cd; border-radius: 6px; border-left: 4px solid #ff9800;">
                <p style="margin: 0 0 0.5rem 0; font-size: 0.9rem; color: #856404;">
                    <strong>Not seeing recordings here?</strong> Your Chrome extension might be using the old webhook URL.
                    Update it in the extension popup to: <code>http://localhost:5678/webhook/meeting-audio?forward=true</code>
                </p>
            </div>
        </div>

        <div class="grid" id="statsGrid">
            <!-- Stats will be loaded here -->
        </div>

        <div class="card">
            <h3>📊 Recent Recording Sessions</h3>
            <div id="sessionsList">
                <div class="no-data">Loading sessions...</div>
            </div>
        </div>

        <div class="card">
            <h3>🔗 Recent Webhook Attempts</h3>
            <div id="webhookAttemptsList">
                <div class="no-data">Loading webhook attempts...</div>
            </div>
        </div>

        <div class="card">
            <h3>🎵 Latest Audio Chunks</h3>
            <div id="chunksList">
                <div class="no-data">Loading chunks...</div>
            </div>
        </div>
    </div>

    <div class="footer">
        <p>Meeting Audio Capture System v1.0 | Ready for n8n Integration</p>
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
                        <h3>🎯 System Status</h3>
                        <div class="stat">
                            <span class="stat-label">Server Status</span>
                            <span class="stat-value">🟢 Online</span>
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
                        <h3>📈 Recording Stats</h3>
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
                        <h3>🔗 Webhook Connection</h3>
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
                            <span class="stat-value">\${stats.totalWebhookAttempts > 0 ? '🟢 Active' : '🟡 Waiting'}</span>
                        </div>
                    </div>
                    
                    <div class="card">
                        <h3>💾 Server Resources</h3>
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
                    
                    const sourceEmoji = {
                        'google-meet': '📞',
                        'zoom': '🟦',
                        'teams': '💬', 
                        'youtube': '📺',
                        'spotify': '🎵',
                        'discord': '🎮',
                        'browser': '🌐'
                    }[session.source] || '📄';
                        
                    return \`
                        <div class="chunk-item">
                            <div class="chunk-header">
                                <span class="status-indicator status-\${session.status}"></span>
                                \${sourceEmoji} \${session.title || session.meetingId}
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
                    
                    const sourceEmoji = {
                        'google-meet': '📞',
                        'zoom': '🟦',
                        'teams': '💬', 
                        'youtube': '📺',
                        'spotify': '🎵',
                        'discord': '🎮',
                        'browser': '🌐'
                    }[chunk.source] || '📄';
                    
                    return \`
                        <div class="chunk-item">
                            <div class="chunk-header">
                                \${sourceEmoji} \${chunk.title || chunk.meetingId} - Chunk \${chunk.chunkIndex}
                                <span class="badge badge-\${chunkType}">\${badgeText}</span>
                            </div>
                            <div class="chunk-meta">
                                Source: \${chunk.source} | 
                                Type: \${chunk.recordingType} | 
                                Size: \${formatBytes(chunk.audioSizeBytes)} | 
                                Duration: \${chunk.duration}s | 
                                Received: \${new Date(chunk.receivedAt).toLocaleTimeString()} | 
                                ➡️ n8n: \${chunk.processingTime}ms
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
                    const statusColor = attempt.status === 'processed' ? '#34c759' : '#ff9500';
                    const timeSinceAttempt = Math.round((Date.now() - new Date(attempt.timestamp).getTime()) / 1000);
                    const timeText = timeSinceAttempt < 60 ? \`\${timeSinceAttempt}s ago\` : 
                                   timeSinceAttempt < 3600 ? \`\${Math.floor(timeSinceAttempt/60)}m ago\` : 
                                   \`\${Math.floor(timeSinceAttempt/3600)}h ago\`;
                    
                    return \`
                        <div class="chunk-item">
                            <div class="chunk-header">
                                <span class="status-indicator" style="background: \${statusColor}"></span>
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
        
        async function testWebhookTest() {
            const webhookUrl = document.getElementById('testWebhookUrlTest').value.trim();
            const resultDiv = document.getElementById('webhookTestResult');
            const testBtn = document.getElementById('testWebhookTestBtn');
            
            if (!webhookUrl) {
                alert('Please enter a webhook URL to test');
                return;
            }
            
            // Show testing state
            testBtn.disabled = true;
            testBtn.textContent = '⚡ Triggering...';
            resultDiv.style.display = 'block';
            resultDiv.style.background = '#fff3cd';
            resultDiv.style.border = '1px solid #ffeaa7';
            resultDiv.style.color = '#856404';
            resultDiv.innerHTML = '⚡ Triggering n8n test mode...';
            
            try {
                const response = await fetch('/api/test-webhook', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ webhookUrl })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    resultDiv.style.background = '#d4edda';
                    resultDiv.style.border = '1px solid #c3e6cb';
                    resultDiv.style.color = '#155724';
                    resultDiv.innerHTML = \`✅ <strong>n8n Test Triggered!</strong> Status \${result.status} in \${result.responseTimeMs}ms<br>
                    <small>Now you can switch to the Production URL tab in n8n and test the production webhook below.</small>\`;
                } else {
                    resultDiv.style.background = '#f8d7da';
                    resultDiv.style.border = '1px solid #f5c6cb';
                    resultDiv.style.color = '#721c24';
                    let errorDetails = result.message;
                    if (result.status) {
                        errorDetails += \`<br><small>Status: \${result.status} \${result.statusText}</small>\`;
                    }
                    if (result.responseText) {
                        errorDetails += \`<br><small>Response: \${result.responseText}</small>\`;
                    }
                    resultDiv.innerHTML = \`❌ <strong>Failed:</strong> \${errorDetails}\`;
                }
            } catch (error) {
                resultDiv.style.background = '#f8d7da';
                resultDiv.style.border = '1px solid #f5c6cb';
                resultDiv.style.color = '#721c24';
                resultDiv.innerHTML = \`❌ <strong>Error:</strong> \${error.message}\`;
            }
            
            // Reset button
            testBtn.disabled = false;
            testBtn.textContent = '⚡ Trigger n8n Test';
        }
        
        async function testWebhook() {
            const webhookUrl = document.getElementById('testWebhookUrl').value.trim();
            const resultDiv = document.getElementById('webhookTestResult');
            const testBtn = document.getElementById('testWebhookBtn');
            
            if (!webhookUrl) {
                alert('Please enter a webhook URL to test');
                return;
            }
            
            // Show testing state
            testBtn.disabled = true;
            testBtn.textContent = '🔄 Testing...';
            resultDiv.style.display = 'block';
            resultDiv.style.background = '#f0f0f0';
            resultDiv.style.border = '1px solid #ddd';
            resultDiv.style.color = '#666';
            resultDiv.innerHTML = '🔄 Testing webhook connection...';
            
            try {
                const response = await fetch('/api/test-webhook', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ webhookUrl })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    resultDiv.style.background = '#d4edda';
                    resultDiv.style.border = '1px solid #c3e6cb';
                    resultDiv.style.color = '#155724';
                    resultDiv.innerHTML = \`✅ <strong>Success!</strong> Webhook responded with status \${result.status} in \${result.responseTimeMs}ms<br>
                    <small>Response: \${result.responseText || 'No response body'}</small>\`;
                } else {
                    resultDiv.style.background = '#f8d7da';
                    resultDiv.style.border = '1px solid #f5c6cb';
                    resultDiv.style.color = '#721c24';
                    let errorDetails = result.message;
                    if (result.status) {
                        errorDetails += \`<br><small>Status: \${result.status} \${result.statusText}</small>\`;
                    }
                    if (result.responseText) {
                        errorDetails += \`<br><small>Response: \${result.responseText}</small>\`;
                    }
                    resultDiv.innerHTML = \`❌ <strong>Failed:</strong> \${errorDetails}\`;
                }
            } catch (error) {
                resultDiv.style.background = '#f8d7da';
                resultDiv.style.border = '1px solid #f5c6cb';
                resultDiv.style.color = '#721c24';
                resultDiv.innerHTML = \`❌ <strong>Error:</strong> \${error.message}\`;
            }
            
            // Reset button
            testBtn.disabled = false;
            testBtn.textContent = '🔗 Test Connection';
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
</html>
  `;
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