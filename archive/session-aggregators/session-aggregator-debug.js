// Session Aggregator with debugging
const data = $input.first().json;

// Log the entire received data structure
console.log('[SESSION DEBUG] Full input data:', JSON.stringify(data, null, 2));
console.log('[SESSION DEBUG] Data type:', typeof data);
console.log('[SESSION DEBUG] Data keys:', Object.keys(data));

// Try different ways to access the data
console.log('[SESSION DEBUG] data.isLastChunk:', data.isLastChunk);
console.log('[SESSION DEBUG] data.body?.isLastChunk:', data.body?.isLastChunk);
console.log('[SESSION DEBUG] data.data?.isLastChunk:', data.data?.isLastChunk);

// Check if the data might be nested
if (data.body) {
  console.log('[SESSION DEBUG] Found data.body, keys:', Object.keys(data.body));
}

// Create base session data
const sessionData = {
  sessionId: data.recordingSessionId || data.body?.recordingSessionId || 'unknown',
  rawData: data, // Include raw data for debugging
  isComplete: false,
  chunks: []
};

// Check for isLastChunk in various locations
const isLastChunk = data.isLastChunk || data.body?.isLastChunk || false;

console.log('[SESSION DEBUG] Final isLastChunk value:', isLastChunk);

if (isLastChunk) {
  console.log('[SESSION DEBUG] Processing final chunk');
  sessionData.isComplete = true;
  sessionData.chunks = [{
    chunkIndex: data.chunkIndex || data.body?.chunkIndex || 0,
    audio: data.audio || data.body?.audio || '',
    timestamp: data.timestamp || data.body?.timestamp || new Date().toISOString(),
    duration: data.duration || data.body?.duration || 0
  }];
} else {
  console.log('[SESSION DEBUG] Not a final chunk');
}

// Always return data
return [sessionData];