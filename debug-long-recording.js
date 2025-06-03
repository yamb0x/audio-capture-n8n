#!/usr/bin/env node
/**
 * Debug Tool for Long Recording Issues
 * Monitors and diagnoses problems with 30+ minute recordings
 */

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

class LongRecordingDebugger {
  constructor() {
    this.startTime = Date.now();
    this.chunks = [];
    this.errors = [];
    this.webhookAttempts = [];
    this.memorySnapshots = [];
    this.logFile = `debug-recording-${new Date().toISOString().replace(/:/g, '-')}.log`;
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    const logEntry = `[${timestamp}] [${elapsed}s] [${level}] ${message}\n`;
    
    console.log(logEntry.trim());
    fs.appendFileSync(this.logFile, logEntry);
  }

  // Monitor memory usage
  checkMemory() {
    const used = process.memoryUsage();
    const snapshot = {
      timestamp: Date.now(),
      elapsed: (Date.now() - this.startTime) / 1000,
      heapUsed: Math.round(used.heapUsed / 1024 / 1024),
      heapTotal: Math.round(used.heapTotal / 1024 / 1024),
      rss: Math.round(used.rss / 1024 / 1024),
      external: Math.round(used.external / 1024 / 1024)
    };
    
    this.memorySnapshots.push(snapshot);
    this.log(`Memory: Heap ${snapshot.heapUsed}/${snapshot.heapTotal}MB, RSS ${snapshot.rss}MB`, 'MEMORY');
    
    // Warn if memory usage is high
    if (snapshot.heapUsed > 500) {
      this.log(`WARNING: High memory usage detected: ${snapshot.heapUsed}MB`, 'WARN');
    }
    
    return snapshot;
  }

  // Simulate audio chunk generation
  generateAudioChunk(chunkIndex, duration = 30) {
    // Generate realistic base64 audio data (30s of audio ≈ 200-400KB base64)
    const audioSize = 300 * 1024; // 300KB average
    const audioData = 'data:audio/webm;base64,' + Buffer.alloc(audioSize).toString('base64');
    
    return {
      recordingSessionId: `debug-session-${this.startTime}`,
      chunkIndex: chunkIndex,
      isFirstChunk: chunkIndex === 0,
      isLastChunk: false, // Will be set when stopping
      audio: audioData,
      timestamp: new Date().toISOString(),
      duration: duration,
      meetingId: 'debug-meeting-001',
      title: 'Debug Long Recording Test',
      source: 'debug-tool',
      recordingType: 'microphone'
    };
  }

  // Send chunk to webhook
  async sendChunk(chunk) {
    const webhookUrl = 'http://localhost:5678/webhook/meeting-audio?forward=true';
    const attempt = {
      chunkIndex: chunk.chunkIndex,
      timestamp: Date.now(),
      size: JSON.stringify(chunk).length,
      success: false,
      error: null,
      responseTime: null
    };

    try {
      this.log(`Sending chunk ${chunk.chunkIndex} (${(attempt.size / 1024).toFixed(1)}KB)...`, 'SEND');
      
      const startTime = Date.now();
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Debug-Mode': 'true'
        },
        body: JSON.stringify(chunk),
        timeout: 30000 // 30s timeout
      });

      attempt.responseTime = Date.now() - startTime;
      attempt.success = response.ok;
      attempt.statusCode = response.status;

      if (!response.ok) {
        const errorText = await response.text();
        attempt.error = `HTTP ${response.status}: ${errorText.substring(0, 200)}`;
        this.log(`Chunk ${chunk.chunkIndex} failed: ${attempt.error}`, 'ERROR');
      } else {
        this.log(`Chunk ${chunk.chunkIndex} sent successfully in ${attempt.responseTime}ms`, 'SUCCESS');
      }

    } catch (error) {
      attempt.error = error.message;
      this.log(`Chunk ${chunk.chunkIndex} error: ${error.message}`, 'ERROR');
      this.errors.push({
        chunkIndex: chunk.chunkIndex,
        error: error.message,
        timestamp: Date.now()
      });
    }

    this.webhookAttempts.push(attempt);
    return attempt;
  }

  // Monitor dashboard server
  async checkDashboardHealth() {
    try {
      const response = await fetch('http://localhost:5678/api/stats');
      if (response.ok) {
        const stats = await response.json();
        this.log(`Dashboard health: ${stats.totalChunks} chunks, ${stats.totalSessions} sessions`, 'HEALTH');
        return stats;
      }
    } catch (error) {
      this.log(`Dashboard health check failed: ${error.message}`, 'WARN');
    }
    return null;
  }

  // Check n8n webhook directly
  async checkN8nWebhook() {
    const testPayload = {
      recordingSessionId: 'test-connection',
      chunkIndex: 0,
      isFirstChunk: true,
      isLastChunk: true,
      audio: 'data:audio/webm;base64,TEST',
      timestamp: new Date().toISOString(),
      duration: 1
    };

    try {
      this.log('Testing direct n8n webhook connection...', 'TEST');
      const response = await fetch('https://yambo-studio.app.n8n.cloud/webhook/meeting-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload)
      });

      if (response.ok) {
        this.log('Direct n8n webhook test successful', 'TEST');
        return true;
      } else {
        this.log(`Direct n8n webhook test failed: ${response.status}`, 'TEST');
        return false;
      }
    } catch (error) {
      this.log(`Direct n8n webhook test error: ${error.message}`, 'TEST');
      return false;
    }
  }

  // Run diagnostic tests
  async runDiagnostics() {
    this.log('=== STARTING LONG RECORDING DIAGNOSTICS ===', 'START');
    
    // Test connections
    await this.checkDashboardHealth();
    await this.checkN8nWebhook();
    
    // Start memory monitoring
    const memoryInterval = setInterval(() => this.checkMemory(), 60000); // Every minute
    
    // Simulate long recording
    const chunkInterval = 30; // 30 seconds per chunk
    const totalDuration = 20 * 60; // 20 minutes
    const totalChunks = Math.ceil(totalDuration / chunkInterval);
    
    this.log(`Starting ${totalDuration/60} minute recording simulation (${totalChunks} chunks)`, 'START');
    
    let chunkIndex = 0;
    const sendInterval = setInterval(async () => {
      const chunk = this.generateAudioChunk(chunkIndex);
      this.chunks.push({
        index: chunkIndex,
        timestamp: Date.now(),
        size: JSON.stringify(chunk).length
      });
      
      await this.sendChunk(chunk);
      
      chunkIndex++;
      
      // Check if we should stop
      if (chunkIndex >= totalChunks) {
        clearInterval(sendInterval);
        clearInterval(memoryInterval);
        
        // Send final chunk
        const finalChunk = this.generateAudioChunk(chunkIndex);
        finalChunk.isLastChunk = true;
        await this.sendChunk(finalChunk);
        
        this.generateReport();
      }
    }, chunkInterval * 1000);
  }

  // Generate diagnostic report
  generateReport() {
    this.log('=== DIAGNOSTIC REPORT ===', 'REPORT');
    
    const successfulChunks = this.webhookAttempts.filter(a => a.success).length;
    const failedChunks = this.webhookAttempts.filter(a => !a.success).length;
    const avgResponseTime = this.webhookAttempts
      .filter(a => a.responseTime)
      .reduce((sum, a) => sum + a.responseTime, 0) / successfulChunks || 0;
    
    const report = {
      summary: {
        totalDuration: (Date.now() - this.startTime) / 1000 / 60,
        totalChunks: this.chunks.length,
        successfulChunks,
        failedChunks,
        successRate: (successfulChunks / this.chunks.length * 100).toFixed(1) + '%',
        avgResponseTime: avgResponseTime.toFixed(0) + 'ms'
      },
      memoryUsage: {
        peak: Math.max(...this.memorySnapshots.map(s => s.heapUsed)),
        final: this.memorySnapshots[this.memorySnapshots.length - 1]
      },
      errors: this.errors,
      failedChunks: this.webhookAttempts.filter(a => !a.success)
    };
    
    this.log(`Total chunks: ${report.summary.totalChunks}`, 'REPORT');
    this.log(`Success rate: ${report.summary.successRate}`, 'REPORT');
    this.log(`Failed chunks: ${report.summary.failedChunks}`, 'REPORT');
    this.log(`Peak memory: ${report.memoryUsage.peak}MB`, 'REPORT');
    
    // Save detailed report
    fs.writeFileSync(
      `debug-report-${new Date().toISOString().replace(/:/g, '-')}.json`,
      JSON.stringify(report, null, 2)
    );
    
    // Analyze common issues
    this.analyzeIssues(report);
  }

  // Analyze and suggest fixes
  analyzeIssues(report) {
    this.log('=== ISSUE ANALYSIS ===', 'ANALYSIS');
    
    const issues = [];
    
    // Check for chunk failures
    if (report.summary.failedChunks > 0) {
      issues.push({
        type: 'CHUNK_FAILURES',
        severity: 'HIGH',
        description: `${report.summary.failedChunks} chunks failed to send`,
        suggestion: 'Check network stability and webhook endpoint availability'
      });
      
      // Analyze failure patterns
      const failureIndices = report.failedChunks.map(c => c.chunkIndex);
      if (failureIndices.length > 3 && failureIndices.slice(-3).every((v, i, a) => i === 0 || v === a[i-1] + 1)) {
        issues.push({
          type: 'CONSECUTIVE_FAILURES',
          severity: 'CRITICAL',
          description: 'Multiple consecutive chunks failed',
          suggestion: 'Possible connection loss or server overload'
        });
      }
    }
    
    // Check memory usage
    if (report.memoryUsage.peak > 500) {
      issues.push({
        type: 'HIGH_MEMORY',
        severity: 'MEDIUM',
        description: `Peak memory usage: ${report.memoryUsage.peak}MB`,
        suggestion: 'Consider reducing chunk size or implementing cleanup'
      });
    }
    
    // Check response times
    if (parseFloat(report.summary.avgResponseTime) > 5000) {
      issues.push({
        type: 'SLOW_RESPONSE',
        severity: 'MEDIUM',
        description: `Average response time: ${report.summary.avgResponseTime}`,
        suggestion: 'Server may be overloaded or network is slow'
      });
    }
    
    // Log issues
    issues.forEach(issue => {
      this.log(`[${issue.severity}] ${issue.type}: ${issue.description}`, 'ISSUE');
      this.log(`Suggestion: ${issue.suggestion}`, 'SUGGEST');
    });
    
    // Save issues
    fs.writeFileSync(
      `debug-issues-${new Date().toISOString().replace(/:/g, '-')}.json`,
      JSON.stringify(issues, null, 2)
    );
  }
}

// Run diagnostics
if (require.main === module) {
  console.log('Audio Capture Long Recording Debugger');
  console.log('=====================================');
  console.log('This tool will simulate a 20-minute recording and identify issues.\n');
  
  const debugger = new LongRecordingDebugger();
  debugger.runDiagnostics().catch(error => {
    console.error('Diagnostic failed:', error);
  });
}

module.exports = LongRecordingDebugger;