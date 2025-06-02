const http = require('http');

const server = http.createServer((req, res) => {
  console.log('\n=== INCOMING REQUEST ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  
  if (req.method === 'POST' && req.url === '/webhook/debug') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        console.log('\n📦 CHUNK RECEIVED:');
        console.log('  Session ID:', data.recordingSessionId);
        console.log('  Chunk Index:', data.chunkIndex);
        console.log('  Is First Chunk:', data.isFirstChunk);
        console.log('  Is Last Chunk:', data.isLastChunk);
        console.log('  Audio Length:', data.audio ? data.audio.length : 0);
        
        if (data.isLastChunk === true) {
          console.log('\n🎯 FINAL CHUNK RECEIVED! Session complete.');
        } else {
          console.log('\n⏳ Intermediate chunk - waiting for final chunk...');
        }
        
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify({ status: 'received' }));
      } catch (error) {
        console.error('Error parsing body:', error);
        res.writeHead(400);
        res.end('Invalid JSON');
      }
    });
  } else if (req.method === 'OPTIONS') {
    // Handle CORS preflight
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.writeHead(200);
    res.end();
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const PORT = 3333;
server.listen(PORT, () => {
  console.log(`
🚀 Debug webhook server running at http://localhost:${PORT}/webhook/debug

Use this URL in your Chrome extension to see all chunks being sent.
Look for "🎯 FINAL CHUNK RECEIVED!" when you stop recording.
  `);
});