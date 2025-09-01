// C++ DAW Web Interface JavaScript
class CPPDAWInterface {
    constructor() {
        this.isConnected = false;
        this.isPlaying = false;
        this.currentTime = 0;
        this.tracks = [];
        this.selectedTrack = null;
        this.selectedFX = null;
        
        // WebSocket connection to C++ DAW
        this.socket = null;
        this.reconnectInterval = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        
        this.init();
    }
    
    init() {
        this.initializeElements();
        this.bindEvents();
        this.updateDisplay();
        this.createTimelineRuler();
        
        // Connect to WebSocket bridge
        this.connectToDAW();
    }
    
    initializeElements() {
        // Transport controls
        this.playBtn = document.getElementById('playBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.recordBtn = document.getElementById('recordBtn');
        this.rewindBtn = document.getElementById('rewindBtn');
        
        // Time display
        this.currentTimeElement = document.getElementById('currentTime');
        this.totalTimeElement = document.getElementById('totalTime');
        
        // Controls
        this.tempoInput = document.getElementById('tempoInput');
        this.masterVolumeSlider = document.getElementById('masterVolume');
        
        // Track management
        this.addTrackBtn = document.getElementById('addTrackBtn');
        this.tracksContainer = document.getElementById('tracksContainer');
        
        // Modals
        this.trackModal = document.getElementById('trackModal');
        this.settingsModal = document.getElementById('settingsModal');
        
        // Status elements
        this.connectionStatus = document.getElementById('connectionStatus');
        this.sampleRateElement = document.getElementById('sampleRate');
        this.bufferSizeElement = document.getElementById('bufferSize');
        this.cpuUsageElement = document.getElementById('cpuUsage');
    }
    
    bindEvents() {
        // Transport controls
        this.playBtn.addEventListener('click', () => this.togglePlay());
        this.stopBtn.addEventListener('click', () => this.stop());
        this.recordBtn.addEventListener('click', () => this.toggleRecord());
        this.rewindBtn.addEventListener('click', () => this.rewind());
        
        // Tempo control
        this.tempoInput.addEventListener('change', (e) => this.setTempo(parseInt(e.target.value)));
        
        // Master volume
        this.masterVolumeSlider.addEventListener('input', (e) => this.setMasterVolume(parseInt(e.target.value)));
        
        // Track management
        this.addTrackBtn.addEventListener('click', () => this.showAddTrackModal());
        
        // FX library
        document.querySelectorAll('.fx-item').forEach(item => {
            item.addEventListener('click', () => this.addFXToSelectedTrack(item.dataset.fx));
        });
        
        // Modal controls
        this.bindModalEvents();
        
        // Settings
        document.getElementById('settingsBtn').addEventListener('click', () => this.showSettingsModal());
    }
    
    bindModalEvents() {
        // Track modal
        document.getElementById('closeTrackModal').addEventListener('click', () => this.hideTrackModal());
        document.getElementById('cancelTrack').addEventListener('click', () => this.hideTrackModal());
        document.getElementById('createTrack').addEventListener('click', () => this.createTrack());
        
        // Settings modal
        document.getElementById('closeSettingsModal').addEventListener('click', () => this.hideSettingsModal());
        document.getElementById('cancelSettings').addEventListener('click', () => this.hideSettingsModal());
        document.getElementById('applySettings').addEventListener('click', () => this.applySettings());
        
        // Close modals when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });
    }
    
    // Transport Controls
    togglePlay() {
        this.isPlaying = !this.isPlaying;
        
        if (this.isPlaying) {
            this.playBtn.innerHTML = '<i class="fas fa-pause"></i>';
            this.sendCommand('play');
            this.startTimeUpdate();
        } else {
            this.playBtn.innerHTML = '<i class="fas fa-play"></i>';
            this.sendCommand('pause');
            this.stopTimeUpdate();
        }
        
        this.updateTransportButtons();
    }
    
    stop() {
        this.isPlaying = false;
        this.currentTime = 0;
        this.playBtn.innerHTML = '<i class="fas fa-play"></i>';
        this.sendCommand('stop');
        this.stopTimeUpdate();
        this.updateDisplay();
        this.updateTransportButtons();
    }
    
    toggleRecord() {
        // Toggle record state for selected track
        if (this.selectedTrack) {
            this.selectedTrack.isRecording = !this.selectedTrack.isRecording;
            this.sendCommand('record', { trackId: this.selectedTrack.id, recording: this.selectedTrack.isRecording });
            this.updateTrackDisplay(this.selectedTrack);
        }
    }
    
    rewind() {
        this.currentTime = 0;
        this.sendCommand('setPosition', { time: 0 });
        this.updateDisplay();
    }
    
    setTempo(bpm) {
        this.sendCommand('tempo', { bpm });
        console.log(`Tempo set to ${bpm} BPM`);
    }
    
    setMasterVolume(volume) {
        const normalizedVolume = volume / 100;
        this.sendCommand('masterVolume', { volume: normalizedVolume });
        console.log(`Master volume set to ${volume}%`);
    }
    
    // Track Management
    showAddTrackModal() {
        this.trackModal.style.display = 'block';
        document.getElementById('trackName').value = `Track ${this.tracks.length + 1}`;
    }
    
    hideTrackModal() {
        this.trackModal.style.display = 'none';
    }
    
    createTrack() {
        const name = document.getElementById('trackName').value || `Track ${this.tracks.length + 1}`;
        const color = document.getElementById('trackColor').value;
        
        const track = {
            id: this.tracks.length,
            name: name,
            color: color,
            volume: 75,
            pan: 0,
            isMuted: false,
            isSoloed: false,
            isRecording: false,
            isArmed: false,
            effects: [],
            clips: []
        };
        
        this.tracks.push(track);
        this.sendCommand('track', { name });
        this.renderTrack(track);
        this.hideTrackModal();
        
        console.log(`Created track: ${name}`);
    }
    
    renderTrack(track) {
        const trackRow = document.createElement('div');
        trackRow.className = 'track-row';
        trackRow.dataset.trackId = track.id;
        
        trackRow.innerHTML = `
            <div class="track-control-panel">
                <div class="track-name">${track.name}</div>
                <div class="track-controls-row">
                    <button class="track-btn mute" data-action="mute" title="Mute">M</button>
                    <button class="track-btn solo" data-action="solo" title="Solo">S</button>
                    <button class="track-btn record" data-action="arm" title="Arm for Recording">R</button>
                </div>
                <div class="track-controls-row">
                    <span style="font-size: 0.8em; color: #888;">Vol:</span>
                    <input type="range" class="track-slider" min="0" max="100" value="${track.volume}" 
                           data-action="volume" title="Volume">
                </div>
                <div class="track-controls-row">
                    <span style="font-size: 0.8em; color: #888;">Pan:</span>
                    <input type="range" class="track-slider" min="-100" max="100" value="${track.pan}" 
                           data-action="pan" title="Pan">
                </div>
            </div>
            <div class="track-timeline" style="border-left-color: ${this.getTrackColor(track.color)}">
                <!-- Track timeline content -->
            </div>
        `;
        
        this.tracksContainer.appendChild(trackRow);
        this.bindTrackEvents(trackRow, track);
    }
    
    bindTrackEvents(trackElement, track) {
        // Track selection
        trackElement.addEventListener('click', (e) => {
            if (!e.target.classList.contains('track-btn') && !e.target.classList.contains('track-slider')) {
                this.selectTrack(track);
            }
        });
        
        // Track controls
        trackElement.querySelectorAll('.track-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleTrackAction(track, btn.dataset.action, btn);
            });
        });
        
        trackElement.querySelectorAll('.track-slider').forEach(slider => {
            slider.addEventListener('input', (e) => {
                this.handleTrackAction(track, slider.dataset.action, slider, parseFloat(e.target.value));
            });
        });
    }
    
    selectTrack(track) {
        // Clear previous selection
        document.querySelectorAll('.track-row').forEach(row => {
            row.classList.remove('selected');
        });
        
        // Select new track
        const trackElement = document.querySelector(`[data-track-id="${track.id}"]`);
        trackElement.classList.add('selected');
        
        this.selectedTrack = track;
        this.updateTrackInfo();
    }
    
    handleTrackAction(track, action, element, value) {
        switch (action) {
            case 'mute':
                track.isMuted = !track.isMuted;
                element.classList.toggle('active', track.isMuted);
                this.sendCommand('mute', { trackId: track.id, muted: track.isMuted });
                break;
                
            case 'solo':
                track.isSoloed = !track.isSoloed;
                element.classList.toggle('active', track.isSoloed);
                this.sendCommand('solo', { trackId: track.id, soloed: track.isSoloed });
                break;
                
            case 'arm':
                track.isArmed = !track.isArmed;
                element.classList.toggle('active', track.isArmed);
                break;
                
            case 'volume':
                track.volume = value;
                const normalizedVolume = value / 100;
                this.sendCommand('volume', { trackId: track.id, volume: normalizedVolume });
                break;
                
            case 'pan':
                track.pan = value;
                const normalizedPan = value / 100; // -1 to 1
                this.sendCommand('pan', { trackId: track.id, pan: normalizedPan });
                break;
        }
        
        if (this.selectedTrack === track) {
            this.updateTrackInfo();
        }
    }
    
    addFXToSelectedTrack(fxType) {
        if (!this.selectedTrack) {
            alert('Please select a track first');
            return;
        }
        
        const fx = {
            id: this.selectedTrack.effects.length,
            type: fxType,
            enabled: true,
            parameters: this.getDefaultFXParameters(fxType)
        };
        
        this.selectedTrack.effects.push(fx);
        this.sendCommand('fx', { trackId: this.selectedTrack.id, fxType });
        this.updateTrackInfo();
        
        console.log(`Added ${fxType} to ${this.selectedTrack.name}`);
    }
    
    getDefaultFXParameters(fxType) {
        switch (fxType) {
            case 'delay':
                return {
                    delayTime: 0.25,
                    feedback: 0.3,
                    wetLevel: 0.3,
                    dryLevel: 0.7
                };
            case 'chorus':
                return {
                    rate: 0.5,
                    depth: 0.3,
                    wetLevel: 0.5,
                    dryLevel: 0.5
                };
            case 'reverb':
                return {
                    roomSize: 0.5,
                    damping: 0.5,
                    wetLevel: 0.3,
                    dryLevel: 0.7
                };
            default:
                return {};
        }
    }
    
    // Display Updates
    updateDisplay() {
        this.updateTimeDisplay();
        this.updateSystemInfo();
    }
    
    updateTimeDisplay() {
        this.currentTimeElement.textContent = this.formatTime(this.currentTime);
        // Total time would be calculated based on longest track/clip
        this.totalTimeElement.textContent = this.formatTime(120); // 2 minutes for demo
    }
    
    updateSystemInfo() {
        // Simulate CPU usage
        const cpuUsage = Math.floor(Math.random() * 30) + 5;
        this.cpuUsageElement.textContent = `${cpuUsage}%`;
    }
    
    updateTrackInfo() {
        const infoElement = document.getElementById('selectedTrackInfo');
        
        if (this.selectedTrack) {
            const track = this.selectedTrack;
            infoElement.innerHTML = `
                <h4>${track.name}</h4>
                <div class="info-row">
                    <span>Volume:</span>
                    <span>${track.volume}%</span>
                </div>
                <div class="info-row">
                    <span>Pan:</span>
                    <span>${track.pan > 0 ? 'R' : track.pan < 0 ? 'L' : 'C'}${Math.abs(track.pan)}</span>
                </div>
                <div class="info-row">
                    <span>Effects:</span>
                    <span>${track.effects.length}</span>
                </div>
                <div class="info-row">
                    <span>Status:</span>
                    <span>${track.isMuted ? 'Muted' : track.isSoloed ? 'Soloed' : 'Active'}</span>
                </div>
            `;
        } else {
            infoElement.innerHTML = '<p>No track selected</p>';
        }
    }
    
    updateTransportButtons() {
        // Visual feedback for transport state
        if (this.isPlaying) {
            this.playBtn.style.background = 'linear-gradient(135deg, #4CAF50, #45a049)';
        } else {
            this.playBtn.style.background = '';
        }
    }
    
    // Time Management
    startTimeUpdate() {
        this.timeUpdateInterval = setInterval(() => {
            this.currentTime += 0.1; // Update every 100ms
            this.updateTimeDisplay();
        }, 100);
    }
    
    stopTimeUpdate() {
        if (this.timeUpdateInterval) {
            clearInterval(this.timeUpdateInterval);
        }
    }
    
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${ms.toString().padStart(3, '0')}`;
    }
    
    // Timeline
    createTimelineRuler() {
        const ruler = document.getElementById('timelineRuler');
        const duration = 120; // 2 minutes in seconds
        const pixelsPerSecond = 20;
        const width = duration * pixelsPerSecond;
        
        for (let i = 0; i <= duration; i += 10) {
            const marker = document.createElement('div');
            marker.style.position = 'absolute';
            marker.style.left = `${i * pixelsPerSecond}px`;
            marker.style.top = '0';
            marker.style.width = '1px';
            marker.style.height = '100%';
            marker.style.background = '#444';
            marker.style.fontSize = '10px';
            marker.style.color = '#888';
            marker.innerHTML = `<span style="position: absolute; top: -15px; left: 2px;">${this.formatTime(i)}</span>`;
            ruler.appendChild(marker);
        }
    }
    
    // Utility Methods
    getTrackColor(colorName) {
        const colors = {
            blue: '#2196F3',
            red: '#f44336',
            green: '#4CAF50',
            purple: '#9c27b0',
            orange: '#ff9800'
        };
        return colors[colorName] || colors.blue;
    }
    
    // Communication with C++ DAW
    connectToDAW() {
        const wsUrl = 'ws://localhost:8080';
        
        try {
            this.socket = new WebSocket(wsUrl);
            
            this.socket.onopen = () => {
                console.log('Connected to C++ DAW WebSocket bridge');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.updateConnectionStatus();
            };
            
            this.socket.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleDAWMessage(message);
                } catch (error) {
                    console.error('Error parsing DAW message:', error);
                }
            };
            
            this.socket.onclose = () => {
                console.log('Disconnected from C++ DAW');
                this.isConnected = false;
                this.updateConnectionStatus();
                this.attemptReconnect();
            };
            
            this.socket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.isConnected = false;
                this.updateConnectionStatus();
            };
            
        } catch (error) {
            console.error('Failed to connect to WebSocket:', error);
            this.attemptReconnect();
        }
    }
    
    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            
            this.reconnectInterval = setTimeout(() => {
                this.connectToDAW();
            }, 2000 * this.reconnectAttempts); // Exponential backoff
        } else {
            console.log('Max reconnection attempts reached');
        }
    }
    
    updateConnectionStatus() {
        if (this.isConnected) {
            this.connectionStatus.innerHTML = '<span class="status-indicator online"></span><span>Connected</span>';
        } else {
            this.connectionStatus.innerHTML = '<span class="status-indicator offline"></span><span>Disconnected</span>';
        }
    }
    
    handleDAWMessage(message) {
        switch (message.type) {
            case 'status':
                console.log('DAW Status:', message.data);
                break;
                
            case 'dawOutput':
                console.log('DAW Output:', message.data.message);
                // Could display this in a console widget
                break;
                
            case 'dawError':
                console.error('DAW Error:', message.data.error);
                break;
                
            case 'dawDisconnected':
                console.log('DAW process disconnected');
                this.isConnected = false;
                this.updateConnectionStatus();
                break;
                
            default:
                console.log('Unknown message type:', message.type);
        }
    }
    
    sendCommand(command, data = {}) {
        const message = {
            command: command,
            data: data,
            timestamp: Date.now()
        };
        
        console.log('Sending command to C++ DAW:', message);
        
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(message));
        } else {
            console.warn('WebSocket not connected, command not sent:', command);
            // Optionally queue commands for when connection is restored
        }
    }
    
    // Modal Management
    showSettingsModal() {
        this.settingsModal.style.display = 'block';
    }
    
    hideSettingsModal() {
        this.settingsModal.style.display = 'none';
    }
    
    applySettings() {
        const audioDevice = document.getElementById('audioDevice').value;
        const sampleRate = document.getElementById('sampleRateSelect').value;
        const bufferSize = document.getElementById('bufferSizeSelect').value;
        
        this.sendCommand('settings', {
            audioDevice,
            sampleRate: parseInt(sampleRate),
            bufferSize: parseInt(bufferSize)
        });
        
        // Update display
        this.sampleRateElement.textContent = `${parseInt(sampleRate).toLocaleString()} Hz`;
        this.bufferSizeElement.textContent = `${bufferSize} samples`;
        
        this.hideSettingsModal();
        console.log('Settings applied:', { audioDevice, sampleRate, bufferSize });
    }
}

// Initialize the DAW interface when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.dawInterface = new CPPDAWInterface();
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
            case ' ':
                e.preventDefault();
                window.dawInterface.togglePlay();
                break;
            case 's':
                e.preventDefault();
                window.dawInterface.stop();
                break;
            case 't':
                e.preventDefault();
                window.dawInterface.showAddTrackModal();
                break;
        }
    }
});
