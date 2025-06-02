// Session Aggregator - Process audio chunks
const input = $input.first().json;
const data = input.body; // The actual webhook data is in the body property

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
if (data.isLastChunk === true) {
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
  
  console.log('[SESSION] Session ready for processing with duration: ' + sessionData.totalDuration + 's');
} else {
  console.log('[SESSION] Intermediate chunk - waiting for final chunk');
}

// Always return data so workflow continues
return [sessionData];