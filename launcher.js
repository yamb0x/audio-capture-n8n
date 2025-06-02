#!/usr/bin/env node
/**
 * Meeting Audio Capture Launcher
 * Desktop application to start the dashboard server
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

class MeetingAudioLauncher {
  constructor() {
    this.serverProcess = null;
    this.isRunning = false;
    this.port = 5678;
    this.logFile = path.join(__dirname, 'launcher.log');
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(message);
    fs.appendFileSync(this.logFile, logMessage);
  }

  async checkPort() {
    return new Promise((resolve) => {
      exec(`lsof -i :${this.port}`, (error, stdout) => {
        resolve(stdout.trim() !== '');
      });
    });
  }

  async startServer() {
    try {
      // Check if port is already in use
      const portInUse = await this.checkPort();
      if (portInUse) {
        this.log(`⚠️  Port ${this.port} is already in use`);
        this.log('💡 Attempting to kill existing process...');
        await this.killExistingProcess();
        await this.sleep(2000); // Wait 2 seconds
      }

      this.log('🚀 Starting Meeting Audio Capture Dashboard...');
      
      // Start the dashboard server
      this.serverProcess = spawn('node', ['dashboard-server.js'], {
        cwd: __dirname,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false
      });

      this.serverProcess.stdout.on('data', (data) => {
        const output = data.toString().trim();
        if (output) {
          this.log(`[SERVER] ${output}`);
        }
      });

      this.serverProcess.stderr.on('data', (data) => {
        const error = data.toString().trim();
        if (error) {
          this.log(`[ERROR] ${error}`);
        }
      });

      this.serverProcess.on('close', (code) => {
        this.isRunning = false;
        if (code === 0) {
          this.log('✅ Server stopped gracefully');
        } else {
          this.log(`❌ Server stopped with code ${code}`);
        }
      });

      this.serverProcess.on('error', (error) => {
        this.log(`❌ Server error: ${error.message}`);
        this.isRunning = false;
      });

      // Wait for server to start
      await this.sleep(3000);
      
      // Verify server is running
      const isRunning = await this.verifyServerRunning();
      if (isRunning) {
        this.isRunning = true;
        this.log('✅ Dashboard server started successfully!');
        this.log(`📊 Dashboard: http://localhost:${this.port}`);
        this.log(`📥 Webhook: http://localhost:${this.port}/webhook/meeting-audio`);
        this.openDashboard();
        return true;
      } else {
        this.log('❌ Failed to start dashboard server');
        return false;
      }
    } catch (error) {
      this.log(`❌ Error starting server: ${error.message}`);
      return false;
    }
  }

  async killExistingProcess() {
    return new Promise((resolve) => {
      exec(`pkill -f "dashboard-server.js"`, (error) => {
        resolve(); // Don't care if it fails
      });
    });
  }

  async verifyServerRunning() {
    return new Promise((resolve) => {
      const http = require('http');
      const options = {
        hostname: 'localhost',
        port: this.port,
        path: '/health',
        timeout: 2000
      };

      const req = http.request(options, (res) => {
        resolve(res.statusCode === 200);
      });

      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });

      req.end();
    });
  }

  openDashboard() {
    const url = `http://localhost:${this.port}`;
    
    // Open browser (cross-platform)
    const command = process.platform === 'win32' 
      ? `start ${url}`
      : process.platform === 'darwin' 
      ? `open ${url}`
      : `xdg-open ${url}`;
    
    exec(command, (error) => {
      if (error) {
        this.log(`⚠️  Could not open browser automatically. Please visit: ${url}`);
      } else {
        this.log('🌐 Dashboard opened in browser');
      }
    });
  }

  stopServer() {
    if (this.serverProcess && this.isRunning) {
      this.log('🛑 Stopping dashboard server...');
      this.serverProcess.kill('SIGINT');
      this.isRunning = false;
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  displayMenu() {
    console.clear();
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                🎤 Meeting Audio Capture Launcher             ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log('║                                                              ║');
    console.log('║  📊 Advanced Dashboard for Chrome Extension Monitoring       ║');
    console.log('║  🔗 n8n Webhook Integration Ready                            ║');
    console.log('║  📱 Real-time Audio Chunk Tracking                          ║');
    console.log('║                                                              ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log('║                                                              ║');
    if (this.isRunning) {
      console.log('║  🟢 Status: RUNNING                                          ║');
      console.log(`║  🌐 Dashboard: http://localhost:${this.port}                     ║`);
      console.log('║                                                              ║');
      console.log('║  Commands:                                                   ║');
      console.log('║    [o] Open Dashboard in Browser                             ║');
      console.log('║    [s] Stop Server                                           ║');
      console.log('║    [r] Restart Server                                        ║');
      console.log('║    [l] View Recent Logs                                      ║');
      console.log('║    [q] Quit Application                                      ║');
    } else {
      console.log('║  🔴 Status: STOPPED                                          ║');
      console.log('║                                                              ║');
      console.log('║  Commands:                                                   ║');
      console.log('║    [s] Start Dashboard Server                                ║');
      console.log('║    [l] View Recent Logs                                      ║');
      console.log('║    [q] Quit Application                                      ║');
    }
    console.log('║                                                              ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
    process.stdout.write('Enter command: ');
  }

  viewLogs() {
    console.clear();
    console.log('📄 Recent Logs (last 20 lines):');
    console.log('═'.repeat(60));
    
    try {
      if (fs.existsSync(this.logFile)) {
        const logs = fs.readFileSync(this.logFile, 'utf8')
          .split('\n')
          .filter(line => line.trim())
          .slice(-20)
          .join('\n');
        console.log(logs || 'No logs available');
      } else {
        console.log('No logs available');
      }
    } catch (error) {
      console.log('Error reading logs:', error.message);
    }
    
    console.log('═'.repeat(60));
    console.log('Press Enter to continue...');
  }

  async handleCommand(command) {
    switch (command.toLowerCase().trim()) {
      case 's':
        if (this.isRunning) {
          this.stopServer();
          await this.sleep(2000);
        }
        await this.startServer();
        break;
        
      case 'o':
        if (this.isRunning) {
          this.openDashboard();
        } else {
          console.log('❌ Server is not running. Start it first with [s]');
          await this.sleep(2000);
        }
        break;
        
      case 'stop':
      case 'x':
        if (this.isRunning) {
          this.stopServer();
          await this.sleep(2000);
        } else {
          console.log('ℹ️  Server is already stopped');
          await this.sleep(1000);
        }
        break;
        
      case 'r':
        console.log('🔄 Restarting server...');
        if (this.isRunning) {
          this.stopServer();
          await this.sleep(3000);
        }
        await this.startServer();
        break;
        
      case 'l':
        this.viewLogs();
        process.stdin.once('data', () => {});
        await new Promise(resolve => process.stdin.once('data', resolve));
        break;
        
      case 'q':
      case 'quit':
      case 'exit':
        if (this.isRunning) {
          this.log('🛑 Shutting down server...');
          this.stopServer();
          await this.sleep(2000);
        }
        this.log('👋 Meeting Audio Capture Launcher closed');
        process.exit(0);
        break;
        
      default:
        console.log(`❌ Unknown command: ${command}`);
        await this.sleep(1500);
        break;
    }
  }

  async run() {
    this.log('🚀 Meeting Audio Capture Launcher started');
    
    // Setup readline for interactive commands
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    // Handle Ctrl+C gracefully
    process.on('SIGINT', async () => {
      console.log('\n🛑 Received interrupt signal...');
      if (this.isRunning) {
        this.stopServer();
        await this.sleep(2000);
      }
      process.exit(0);
    });

    // Main interactive loop
    while (true) {
      this.displayMenu();
      
      const command = await new Promise((resolve) => {
        rl.question('', resolve);
      });
      
      await this.handleCommand(command);
    }
  }
}

// Auto-start if this script is run directly
if (require.main === module) {
  const launcher = new MeetingAudioLauncher();
  
  // Check for command line arguments
  const args = process.argv.slice(2);
  if (args.includes('--start') || args.includes('-s')) {
    // Auto-start mode
    launcher.log('🚀 Auto-starting dashboard server...');
    launcher.startServer().then(success => {
      if (success) {
        launcher.log('✅ Server started successfully in auto-start mode');
        launcher.log('💡 Press Ctrl+C to stop the server');
        
        // Keep the process running
        process.on('SIGINT', async () => {
          launcher.stopServer();
          await launcher.sleep(2000);
          process.exit(0);
        });
      } else {
        launcher.log('❌ Failed to start server');
        process.exit(1);
      }
    });
  } else {
    // Interactive mode
    launcher.run().catch(error => {
      console.error('❌ Launcher error:', error);
      process.exit(1);
    });
  }
}

module.exports = MeetingAudioLauncher;