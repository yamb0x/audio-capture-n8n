/**
 * Recording Debug Module
 * Tracks and diagnoses issues with long recordings
 */

class RecordingDebugger {
  constructor() {
    this.sessionStart = null;
    this.chunks = [];
    this.webhookAttempts = [];
    this.errors = [];
    this.memorySnapshots = [];
    this.enabled = true;
  }

  startSession(sessionId) {
    this.sessionStart = Date.now();
    this.sessionId = sessionId;
    this.log('Recording session started', { sessionId });
    
    // Start memory monitoring
    this.memoryInterval = setInterval(() => this.captureMemorySnapshot(), 60000);
  }

  log(message, data = {}) {
    if (!this.enabled) return;
    
    const entry = {
      timestamp: new Date().toISOString(),
      elapsed: this.sessionStart ? (Date.now() - this.sessionStart) / 1000 : 0,
      message,
      ...data
    };
    
    console.log(`[RECORDING DEBUG] ${entry.elapsed.toFixed(1)}s: ${message}`, data);
    
    // Store in localStorage for persistence
    const debugLog = JSON.parse(localStorage.getItem('recordingDebugLog') || '[]');
    debugLog.push(entry);
    
    // Keep only last 1000 entries
    if (debugLog.length > 1000) {
      debugLog.splice(0, debugLog.length - 1000);
    }
    
    localStorage.setItem('recordingDebugLog', JSON.stringify(debugLog));
  }

  trackChunk(chunkIndex, audioSize, duration) {
    const chunk = {
      index: chunkIndex,
      timestamp: Date.now(),
      elapsed: (Date.now() - this.sessionStart) / 1000,
      audioSize,
      audiaSizeMB: (audioSize / 1024 / 1024).toFixed(2),
      duration
    };
    
    this.chunks.push(chunk);
    this.log(`Chunk ${chunkIndex} prepared`, chunk);
    
    // Warn if chunk is too large
    if (audioSize > 5 * 1024 * 1024) {
      this.log(`WARNING: Large chunk detected`, {
        chunkIndex,
        sizeMB: chunk.audiaSizeMB,
        alert: 'Chunk exceeds 5MB'
      });
    }
  }

  trackWebhookAttempt(chunkIndex, success, error = null, responseTime = null) {
    const attempt = {
      chunkIndex,
      timestamp: Date.now(),
      elapsed: (Date.now() - this.sessionStart) / 1000,
      success,
      error,
      responseTime
    };
    
    this.webhookAttempts.push(attempt);
    
    if (success) {
      this.log(`Webhook success for chunk ${chunkIndex}`, { responseTime });
    } else {
      this.log(`Webhook FAILED for chunk ${chunkIndex}`, { error });
      this.errors.push(attempt);
    }
    
    // Check for consecutive failures
    const recentAttempts = this.webhookAttempts.slice(-5);
    const recentFailures = recentAttempts.filter(a => !a.success).length;
    
    if (recentFailures >= 3) {
      this.log('CRITICAL: Multiple consecutive webhook failures', {
        recentFailures,
        lastError: error
      });
    }
  }

  captureMemorySnapshot() {
    if (!performance.memory) return;
    
    const snapshot = {
      timestamp: Date.now(),
      elapsed: (Date.now() - this.sessionStart) / 1000,
      usedJSHeapSize: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
      totalJSHeapSize: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
      jsHeapSizeLimit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
    };
    
    this.memorySnapshots.push(snapshot);
    
    // Warn if memory usage is high
    const usagePercent = (snapshot.usedJSHeapSize / snapshot.jsHeapSizeLimit) * 100;
    if (usagePercent > 80) {
      this.log('WARNING: High memory usage', {
        usedMB: snapshot.usedJSHeapSize,
        limitMB: snapshot.jsHeapSizeLimit,
        usagePercent: usagePercent.toFixed(1)
      });
    }
  }

  trackError(error, context) {
    const errorEntry = {
      timestamp: Date.now(),
      elapsed: (Date.now() - this.sessionStart) / 1000,
      error: error.message || error,
      stack: error.stack,
      context
    };
    
    this.errors.push(errorEntry);
    this.log('ERROR occurred', errorEntry);
  }

  generateReport() {
    const duration = (Date.now() - this.sessionStart) / 1000 / 60;
    const successfulWebhooks = this.webhookAttempts.filter(a => a.success).length;
    const failedWebhooks = this.webhookAttempts.filter(a => !a.success).length;
    
    const report = {
      sessionId: this.sessionId,
      duration: duration.toFixed(1) + ' minutes',
      chunks: {
        total: this.chunks.length,
        expectedFor30Min: Math.ceil(30 * 60 / 30), // 30s chunks
        missing: Math.max(0, Math.ceil(duration * 60 / 30) - this.chunks.length)
      },
      webhooks: {
        attempted: this.webhookAttempts.length,
        successful: successfulWebhooks,
        failed: failedWebhooks,
        successRate: ((successfulWebhooks / this.webhookAttempts.length) * 100).toFixed(1) + '%'
      },
      memory: {
        peak: Math.max(...this.memorySnapshots.map(s => s.usedJSHeapSize || 0)),
        snapshots: this.memorySnapshots.length
      },
      errors: this.errors,
      analysis: this.analyzeSession()
    };
    
    this.log('Session report generated', report);
    
    // Store report
    localStorage.setItem('lastRecordingReport', JSON.stringify(report));
    
    return report;
  }

  analyzeSession() {
    const issues = [];
    
    // Check for missing chunks
    const expectedChunks = Math.ceil(((Date.now() - this.sessionStart) / 1000) / 30);
    const missingChunks = expectedChunks - this.chunks.length;
    
    if (missingChunks > 2) {
      issues.push({
        type: 'MISSING_CHUNKS',
        severity: 'HIGH',
        description: `${missingChunks} chunks are missing`,
        suggestion: 'Check if MediaRecorder is stopping unexpectedly'
      });
    }
    
    // Check chunk intervals
    for (let i = 1; i < this.chunks.length; i++) {
      const interval = this.chunks[i].elapsed - this.chunks[i-1].elapsed;
      if (interval > 45) { // More than 45s between chunks
        issues.push({
          type: 'DELAYED_CHUNK',
          severity: 'MEDIUM',
          description: `${interval.toFixed(0)}s gap between chunks ${i-1} and ${i}`,
          suggestion: 'MediaRecorder may be pausing or system is under load'
        });
      }
    }
    
    // Check for webhook failures
    const failureRate = (this.webhookAttempts.filter(a => !a.success).length / this.webhookAttempts.length) * 100;
    if (failureRate > 10) {
      issues.push({
        type: 'HIGH_FAILURE_RATE',
        severity: 'HIGH',
        description: `${failureRate.toFixed(1)}% webhook failure rate`,
        suggestion: 'Check network connection and server availability'
      });
    }
    
    return issues;
  }

  // Export debug data for analysis
  exportDebugData() {
    const debugData = {
      sessionId: this.sessionId,
      startTime: new Date(this.sessionStart).toISOString(),
      duration: ((Date.now() - this.sessionStart) / 1000 / 60).toFixed(1) + ' minutes',
      chunks: this.chunks,
      webhookAttempts: this.webhookAttempts,
      memorySnapshots: this.memorySnapshots,
      errors: this.errors,
      report: this.generateReport()
    };
    
    const blob = new Blob([JSON.stringify(debugData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recording-debug-${this.sessionId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

// Make available globally
window.RecordingDebugger = RecordingDebugger;