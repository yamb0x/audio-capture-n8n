// AudioWorklet processor to replace deprecated ScriptProcessorNode
class AudioLevelProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.levelCheckCount = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    
    if (input && input[0]) {
      const inputData = input[0];
      let sum = 0;
      
      // Calculate RMS (Root Mean Square) for audio level
      for (let i = 0; i < inputData.length; i++) {
        sum += inputData[i] * inputData[i];
      }
      
      const rms = Math.sqrt(sum / inputData.length);
      const average = rms * 1000; // Scale for visibility
      
      // Send level data back to main thread every 100 frames
      if (this.levelCheckCount % 100 === 0) {
        this.port.postMessage({
          type: 'audioLevel',
          level: average
        });
      }
      
      this.levelCheckCount++;
    }
    
    // Return true to keep the processor alive
    return true;
  }
}

registerProcessor('audio-level-processor', AudioLevelProcessor);