// Simplified Session Aggregator - Process only final chunks
const data = $input.first().json;

console.log('[SESSION] Received data:', JSON.stringify(data, null, 2));
console.log('[SESSION] Processing chunk ' + data.chunkIndex + ' for session: ' + data.recordingSessionId);
console.log('[SESSION] isFirstChunk: ' + data.isFirstChunk + ', isLastChunk: ' + data.isLastChunk);

// Only process the final chunk to continue the workflow
if (data.isLastChunk) {
  console.log('[SESSION] Final chunk received - processing session: ' + data.recordingSessionId);
  
  // Create session data from the final chunk
  const sessionData = {
    sessionId: data.recordingSessionId,
    meetingId: data.meetingId,
    meetingUrl: data.meetingUrl,
    title: data.title,
    source: data.source,
    recordingType: data.recordingType,
    startTime: data.timestamp,
    endTime: data.timestamp,
    totalDuration: (data.chunkIndex + 1) * data.duration,
    chunks: [
      {
        chunkIndex: data.chunkIndex,
        audio: data.audio,
        timestamp: data.timestamp,
        duration: data.duration
      }
    ],
    isComplete: true
  };
  
  console.log('[SESSION] Session ready for processing with ' + sessionData.chunks.length + ' chunk(s)');
  
  return [sessionData];
}

// For non-final chunks, just acknowledge but don't continue workflow
console.log('[SESSION] Intermediate chunk received - waiting for final chunk');
return [];