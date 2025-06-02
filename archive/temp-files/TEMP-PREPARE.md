// Prepare Audio Node - For OpenAI Node Compatibility
const sessionData = $input.first().json;

if (!sessionData.chunks || sessionData.chunks.length === 0) {
  return { json: { error: 'No audio chunks found' } };
}

const chunk = sessionData.chunks[0];

if (!chunk.audio) {
  return { json: { error: 'No audio data in chunk' } };
}

try {
  let base64Data = chunk.audio;
  base64Data = base64Data.replace(/^data:audio\/[^;]+;base64,/, '');
  
  // Create binary data with 'data' as the key (what OpenAI node expects)
  const binaryData = {
    data: base64Data,
    mimeType: 'audio/webm',
    fileName: `audio_${chunk.chunkIndex}.webm`,
    fileExtension: 'webm'
  };
  
  return {
    json: {
      sessionId: sessionData.sessionId,
      chunkIndex: chunk.chunkIndex,
      sessionMetadata: {
        meetingId: sessionData.meetingId,
        title: sessionData.title,
        source: sessionData.source,
        recordingType: sessionData.recordingType,
        totalDuration: sessionData.totalDuration,
        totalChunks: sessionData.chunks.length,
        meetingUrl: sessionData.meetingUrl
      }
    },
    binary: {
      data: binaryData  // Changed from 'audio' to 'data'
    }
  };
  
} catch (error) {
  return {
    json: {
      error: `Failed: ${error.message}`
    }
  };
}