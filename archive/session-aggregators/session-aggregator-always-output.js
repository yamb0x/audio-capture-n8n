// Session Aggregator - Always outputs data
const data = $input.first().json;

console.log('[SESSION] Received data keys:', Object.keys(data));
console.log('[SESSION] Processing chunk ' + data.chunkIndex + ' for session: ' + data.recordingSessionId);
console.log('[SESSION] isFirstChunk: ' + data.isFirstChunk + ', isLastChunk: ' + data.isLastChunk);

// Create base session data
const sessionData = {
  sessionId: data.recordingSessionId,
  meetingId: data.meetingId,
  meetingUrl: data.meetingUrl,
  title: data.title,
  source: data.source,
  recordingType: data.recordingType,
  timestamp: data.timestamp,
  chunkIndex: data.chunkIndex,
  isFirstChunk: data.isFirstChunk,
  isLastChunk: data.isLastChunk,
  isComplete: false,
  chunks: []
};

// Only mark as complete and add chunk data if this is the final chunk
if (data.isLastChunk) {
  console.log('[SESSION] Final chunk received - marking session as complete');
  
  sessionData.isComplete = true;
  sessionData.startTime = data.timestamp;
  sessionData.endTime = data.timestamp;
  sessionData.totalDuration = (data.chunkIndex + 1) * data.duration;
  sessionData.chunks = [{
    chunkIndex: data.chunkIndex,
    audio: data.audio,
    timestamp: data.timestamp,
    duration: data.duration
  }];
  
  console.log('[SESSION] Session ready for processing');
} else {
  console.log('[SESSION] Intermediate chunk - session not complete');
}

// Always return data so workflow continues
return [sessionData];