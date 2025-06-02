// Key changes: Add a function to send audio with isLastChunk flag
async function sendAudioToWebhook(webhookUrl, isFinal = false) {
  console.log('[POPUP] sendAudioToWebhook called, chunks:', audioChunks.length, 'isFinal:', isFinal);
  if (audioChunks.length === 0 && !isFinal) {
    console.log('[POPUP] No audio chunks to send');
    return;
  }
  
  const audioBlob = audioChunks.length > 0 
    ? new Blob(audioChunks, {type: 'audio/webm'})
    : new Blob([], {type: 'audio/webm'});
  console.log('[POPUP] Created audio blob, size:', audioBlob.size, 'bytes');
  
  // Prepare metadata for this chunk
  const chunkMetadata = {
    meetingId: meetingId,
    chunkIndex: chunkCounter,
    isFirstChunk: isFirstChunk,
    isLastChunk: isFinal, // Use the isFinal parameter
    meetingUrl: meetingUrl,
    recordingSessionId: recordingSessionId,
    pageTitle: pageTitle
  };
  
  console.log('[POPUP] Chunk metadata:', chunkMetadata);
  
  // Convert to base64
  const reader = new FileReader();
  reader.readAsDataURL(audioBlob);
  reader.onloadend = async () => {
    const base64Audio = audioChunks.length > 0
      ? reader.result.split(',')[1]
      : '';
    console.log('[POPUP] Converted to base64, length:', base64Audio.length);
    
    try {
      console.log('[POPUP] Sending audio chunk to n8n webhook:', webhookUrl);
      console.log('[POPUP] Payload size:', JSON.stringify({
        audioLength: base64Audio.length,
        meetingId: chunkMetadata.meetingId,
        chunkIndex: chunkMetadata.chunkIndex,
        isFirstChunk: chunkMetadata.isFirstChunk,
        isLastChunk: chunkMetadata.isLastChunk
      }));
      
      const payload = {
        // Core audio data
        audio: base64Audio,
        timestamp: new Date().toISOString(),
        duration: isFinal && audioChunks.length === 0 ? 0 : 30,
        format: 'webm',
        
        // Recording identification
        recordingSessionId: chunkMetadata.recordingSessionId,
        meetingId: chunkMetadata.meetingId,
        meetingUrl: chunkMetadata.meetingUrl,
        
        // Chunk metadata
        chunkIndex: chunkMetadata.chunkIndex,
        isFirstChunk: chunkMetadata.isFirstChunk,
        isLastChunk: chunkMetadata.isLastChunk,
        
        // Extended metadata for better context
        source: detectSource(chunkMetadata.meetingUrl),
        userAgent: navigator.userAgent,
        recordingType: detectRecordingType(chunkMetadata.meetingUrl),
        title: chunkMetadata.pageTitle || 'Untitled Recording'
      };
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      
      console.log('[POPUP] n8n webhook response status:', response.status);
      const responseText = await response.text();
      console.log('[POPUP] n8n webhook response:', responseText);
      
      if (!response.ok) {
        console.error('[POPUP] Failed to send audio to n8n webhook, status:', response.status);
        console.error('[POPUP] Response text:', responseText);
      } else {
        if (isFinal) {
          console.log('[POPUP] FINAL audio chunk sent successfully to n8n');
        } else {
          console.log('[POPUP] Audio chunk sent successfully to n8n');
        }
        
        // Increment chunk counter and reset first chunk flag
        chunkCounter++;
        isFirstChunk = false;
      }
    } catch (error) {
      console.error('[POPUP] Error sending audio:', error);
    }
  };
}

// Update the MediaRecorder setup to handle final chunks properly
function setupMediaRecorder(stream, webhookUrl) {
  mediaRecorder = new MediaRecorder(stream, {
    mimeType: 'audio/webm'
  });
  
  mediaRecorder.ondataavailable = (event) => {
    console.log('[POPUP] Data available, size:', event.data.size);
    if (event.data.size > 0) {
      audioChunks.push(event.data);
    }
  };
  
  mediaRecorder.onstop = () => {
    console.log('[POPUP] MediaRecorder onstop event fired');
    console.log('[POPUP] onstop - audioChunks length:', audioChunks.length);
    
    // Check if this is the final stop
    if (window.isRecordingStopping) {
      console.log('[POPUP] onstop - This is the FINAL stop, sending final chunk');
      sendAudioToWebhook(webhookUrl, true); // Send with isFinal = true
      window.isRecordingStopping = false; // Reset flag
    } else {
      console.log('[POPUP] onstop - Regular chunk rotation');
      sendAudioToWebhook(webhookUrl, false); // Send regular chunk
    }
    audioChunks = [];
  };
  
  // Start recording and interval...
}

// Update stopMediaRecorder to set the flag
function stopMediaRecorder() {
  console.log('[POPUP] stopMediaRecorder called');
  
  if (recordingInterval) {
    console.log('[POPUP] Clearing recording interval');
    clearInterval(recordingInterval);
    recordingInterval = null;
  }
  
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    console.log('[POPUP] Stopping MediaRecorder');
    
    // Set flag to indicate this is the final stop
    window.isRecordingStopping = true;
    
    // Stop will trigger onstop event which will send the final chunk
    mediaRecorder.stop();
    
    if (mediaRecorder.stream) {
      mediaRecorder.stream.getTracks().forEach(track => {
        console.log('[POPUP] Stopping track:', track.kind);
        track.stop();
      });
    }
    mediaRecorder = null;
    console.log('[POPUP] Recording stopped completely');
  }
}