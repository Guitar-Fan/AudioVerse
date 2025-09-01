#!/usr/bin/env node

/**
 * WebSocket Bridge Server for C++ DAW
 * This Node.js server acts as a bridge between the web interface and the C++ DAW application
 * It receives WebSocket commands from the browser and translates them to the C++ DAW CLI
 */

const WebSocket = require('ws');
const { spawn } = require('child_process');
const path = require('path');

class DAWWebSocketBridge {
    constructor(port = 8080) {
        this.port = port;
        this.dawProcess = null;
        this.clients = new Set();
        
        this.setupWebSocketServer();
        this.startDAWProcess();
    }
    
    setupWebSocketServer() {
        this.wss = new WebSocket.Server({ port: this.port });
        
        this.wss.on('connection', (ws) => {
            console.log('Client connected');
            this.clients.add(ws);
            
            // Send initial status
            this.sendToClient(ws, {
                type: 'status',
                data: {
                    connected: true,
                    dawRunning: this.dawProcess !== null
                }
            });
            
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    this.handleClientMessage(ws, message);
                } catch (error) {
                    console.error('Invalid message format:', error);
                }
            });
            
            ws.on('close', () => {
                console.log('Client disconnected');
                this.clients.delete(ws);
            });
            
            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                this.clients.delete(ws);
            });
        });
        
        console.log(`WebSocket server running on port ${this.port}`);
    }
    
    startDAWProcess() {
        // Path to the C++ DAW executable
        const dawExecutable = path.join(__dirname, '..', 'cpp-daw', 'build', 'cppdaw');
        
        try {
            this.dawProcess = spawn(dawExecutable, [], {
                stdio: ['pipe', 'pipe', 'pipe']
            });
            
            this.dawProcess.stdout.on('data', (data) => {
                const output = data.toString().trim();
                console.log('DAW Output:', output);
                this.broadcastToClients({
                    type: 'dawOutput',
                    data: { message: output }
                });
            });
            
            this.dawProcess.stderr.on('data', (data) => {
                const error = data.toString().trim();
                console.error('DAW Error:', error);
                this.broadcastToClients({
                    type: 'dawError',
                    data: { error: error }
                });
            });
            
            this.dawProcess.on('close', (code) => {
                console.log(`DAW process exited with code ${code}`);
                this.dawProcess = null;
                this.broadcastToClients({
                    type: 'dawDisconnected',
                    data: { exitCode: code }
                });
            });
            
            this.dawProcess.on('error', (error) => {
                console.error('Failed to start DAW process:', error);
                this.dawProcess = null;
                this.broadcastToClients({
                    type: 'dawError',
                    data: { error: error.message }
                });
            });
            
            console.log('C++ DAW process started');
            
        } catch (error) {
            console.error('Error starting DAW process:', error);
        }
    }
    
    handleClientMessage(ws, message) {
        console.log('Received command:', message.command, message.data);
        
        switch (message.command) {
            case 'play':
                this.sendDAWCommand('play');
                break;
                
            case 'stop':
                this.sendDAWCommand('stop');
                break;
                
            case 'pause':
                this.sendDAWCommand('pause');
                break;
                
            case 'tempo':
                this.sendDAWCommand(`tempo ${message.data.bpm}`);
                break;
                
            case 'track':
                this.sendDAWCommand('track');
                break;
                
            case 'volume':
                this.sendDAWCommand(`volume ${message.data.trackId} ${message.data.volume}`);
                break;
                
            case 'pan':
                this.sendDAWCommand(`pan ${message.data.trackId} ${message.data.pan}`);
                break;
                
            case 'mute':
                this.sendDAWCommand(`mute ${message.data.trackId}`);
                break;
                
            case 'solo':
                this.sendDAWCommand(`solo ${message.data.trackId}`);
                break;
                
            case 'fx':
                this.sendDAWCommand(`fx ${message.data.trackId} ${message.data.fxType}`);
                break;
                
            case 'status':
                this.sendDAWCommand('status');
                break;
                
            case 'settings':
                // Handle settings changes
                const { audioDevice, sampleRate, bufferSize } = message.data;
                console.log('Settings update:', { audioDevice, sampleRate, bufferSize });
                break;
                
            default:
                console.warn('Unknown command:', message.command);
        }
    }
    
    sendDAWCommand(command) {
        if (this.dawProcess && this.dawProcess.stdin) {
            this.dawProcess.stdin.write(command + '\n');
            console.log('Sent to DAW:', command);
        } else {
            console.error('DAW process not available');
            this.broadcastToClients({
                type: 'error',
                data: { message: 'DAW process not available' }
            });
        }
    }
    
    sendToClient(ws, message) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }
    
    broadcastToClients(message) {
        this.clients.forEach(client => {
            this.sendToClient(client, message);
        });
    }
    
    shutdown() {
        console.log('Shutting down WebSocket bridge...');
        
        // Close WebSocket server
        this.wss.close();
        
        // Terminate DAW process
        if (this.dawProcess) {
            this.dawProcess.kill('SIGTERM');
        }
    }
}

// Create and start the bridge server
const bridge = new DAWWebSocketBridge(8080);

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\nReceived SIGINT, shutting down gracefully...');
    bridge.shutdown();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    bridge.shutdown();
    process.exit(0);
});

console.log('DAW WebSocket Bridge Server started');
console.log('Connect your web browser to ws://localhost:8080');
console.log('Press Ctrl+C to stop');

module.exports = DAWWebSocketBridge;
