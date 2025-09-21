// Enhanced AudioVerse C++ DAW Interface - Direct WASM Integration
class EnhancedCPPDAWInterface {
    constructor() {
        this.isConnected = false;
        this.isPlaying = false;
        this.currentTime = 0;
        this.tracks = [];
        this.selectedTrack = null;
        this.selectedFX = null;
        this.cppEngine = null;
        
        this.init();
    }
    
    async init() {
        this.initializeElements();
        this.bindEvents();
        
        // Initialize the C++ WASM module
        await this.initializeCPPEngine();
        
        this.updateDisplay();
        this.createTimelineRuler();
        this.startRealTimeUpdates();
    }
    
    async initializeCPPEngine() {
        try {
            console.log('Initializing Enhanced AudioVerse C++ DAW...');
            console.log('Loading C++ DAW Engine...');
            
            // Check if CPPDAWModule exists
            if (typeof CPPDAWModule === 'undefined') {
                throw new Error('CPPDAWModule not found - make sure advanced_cpp_daw.js is loaded');
            }
            
            // Load the C++ WASM module with timeout
            const timeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('WASM module loading timeout')), 10000)
            );
            
            this.cppEngine = await Promise.race([CPPDAWModule(), timeout]);
            
            if (!this.cppEngine) {
                throw new Error('Failed to initialize WASM module');
            }
            
            // Initialize the DAW engine
            if (typeof this.cppEngine._initializeDAW === 'function') {
                this.cppEngine._initializeDAW();
                
                // Check if initialization was successful
                if (typeof this.cppEngine._getIsInitialized === 'function') {
                    const isInitialized = this.cppEngine._getIsInitialized();
                    if (!isInitialized) {
                        throw new Error('C++ engine failed to initialize properly');
                    }
                }
                
                console.log('Advanced C++ DAW Engine initialized successfully!');
            } else {
                console.warn('_initializeDAW function not found, using fallback mode');
            }
            
            this.isConnected = true;
            this.updateConnectionStatus();
            
        } catch (error) {
            console.error('Failed to initialize C++ engine:', error);
            this.isConnected = false;
            this.updateConnectionStatus();
            
            // Show user-friendly error message
            if (this.connectionStatus) {
                this.connectionStatus.innerHTML = `
                    <span class="status-indicator offline"></span>
                    <span>Engine Loading... (${error.message})</span>
                `;
            }
            
            // Retry initialization after delay
            setTimeout(() => {
                console.log('Retrying C++ engine initialization...');
                this.initializeCPPEngine();
            }, 2000);
        }
    }
    
    initializeElements() {
        // Helper function to safely get elements
        const safeGetElement = (id) => {
            const element = document.getElementById(id);
            if (!element) {
                console.warn(`Element with id '${id}' not found`);
            }
            return element;
        };
        
        // Transport controls
        this.playBtn = safeGetElement('playBtn');
        this.stopBtn = safeGetElement('stopBtn');
        this.recordBtn = safeGetElement('recordBtn');
        this.rewindBtn = safeGetElement('rewindBtn');
        
        // Time display
        this.currentTimeElement = safeGetElement('currentTime');
        this.totalTimeElement = safeGetElement('totalTime');
        
        // Controls
        this.tempoInput = safeGetElement('tempoInput');
        this.masterVolumeSlider = safeGetElement('masterVolume');
        
        // Track management
        this.addTrackBtn = safeGetElement('addTrackBtn');
        this.tracksContainer = safeGetElement('tracksContainer');
        
        // Modals
        this.trackModal = safeGetElement('trackModal');
        this.fxModal = safeGetElement('fxModal');
        this.settingsModal = safeGetElement('settingsModal');
        
        // Status elements
        this.connectionStatus = safeGetElement('connectionStatus');
        this.sampleRateElement = safeGetElement('sampleRate');
        this.bufferSizeElement = safeGetElement('bufferSize');
        this.trackCountElement = safeGetElement('trackCount');
        
        // Synth controls
        this.synthFreqSlider = safeGetElement('synthFreq');
        this.synthFreqValue = safeGetElement('synthFreqValue');
        this.synthDurationSlider = safeGetElement('synthDuration');
        this.synthDurationValue = safeGetElement('synthDurationValue');
        this.generateSynthBtn = safeGetElement('generateSynthBtn');
    }
    
    bindEvents() {
        // Helper function to safely bind events
        const safeBind = (element, event, handler) => {
            if (element) {
                element.addEventListener(event, handler);
            }
        };
        
        // Transport controls
        safeBind(this.playBtn, 'click', () => this.togglePlay());
        safeBind(this.stopBtn, 'click', () => this.stop());
        safeBind(this.recordBtn, 'click', () => this.toggleRecord());
        safeBind(this.rewindBtn, 'click', () => this.rewind());
        
        // Tempo control
        safeBind(this.tempoInput, 'change', (e) => this.setTempo(parseInt(e.target.value)));
        
        // Master volume
        safeBind(this.masterVolumeSlider, 'input', (e) => this.setMasterVolume(parseInt(e.target.value)));
        
        // Track management
        safeBind(this.addTrackBtn, 'click', () => this.showAddTrackModal());
        
        // FX library
        document.querySelectorAll('.fx-item').forEach(item => {
            item.addEventListener('click', () => this.showFXModal(item.dataset.fx));
        });
        
        // Modal controls
        this.bindModalEvents();
        
        // Settings
        const settingsBtn = document.getElementById('settingsBtn');
        safeBind(settingsBtn, 'click', () => this.showSettingsModal());
        
        // Synth controls
        safeBind(this.synthFreqSlider, 'input', (e) => {
            if (this.synthFreqValue) {
                this.synthFreqValue.textContent = e.target.value + ' Hz';
            }
        });
        
        safeBind(this.synthDurationSlider, 'input', (e) => {
            if (this.synthDurationValue) {
                this.synthDurationValue.textContent = parseFloat(e.target.value).toFixed(1) + ' s';
            }
        });
        
        safeBind(this.generateSynthBtn, 'click', () => this.generateSynth());
    }
    
    bindModalEvents() {
        // Helper function to safely bind events
        const safeBind = (elementId, event, handler) => {
            const element = document.getElementById(elementId);
            if (element) {
                element.addEventListener(event, handler);
            }
        };
        
        // Track modal
        safeBind('closeTrackModal', 'click', () => this.hideTrackModal());
        safeBind('cancelTrack', 'click', () => this.hideTrackModal());
        safeBind('createTrack', 'click', () => this.createTrack());
        
        // FX modal
        safeBind('closeFxModal', 'click', () => this.hideFXModal());
        safeBind('cancelFx', 'click', () => this.hideFXModal());
        safeBind('applyFx', 'click', () => this.applyFX());
        
        // Settings modal
        safeBind('closeSettingsModal', 'click', () => this.hideSettingsModal());
        safeBind('cancelSettings', 'click', () => this.hideSettingsModal());
        safeBind('applySettings', 'click', () => this.applySettings());
        
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
            if (this.playBtn) this.playBtn.innerHTML = '<i class="fas fa-pause"></i>';
            if (this.cppEngine && typeof this.cppEngine._play === 'function') {
                this.cppEngine._play();
            } else {
                console.log('Playing in fallback mode');
            }
        } else {
            if (this.playBtn) this.playBtn.innerHTML = '<i class="fas fa-play"></i>';
            if (this.cppEngine && typeof this.cppEngine._pause === 'function') {
                this.cppEngine._pause();
            } else {
                console.log('Pausing in fallback mode');
            }
        }
        
        this.updateTransportButtons();
        console.log(this.isPlaying ? 'Playing' : 'Paused');
    }
    
    stop() {
        this.isPlaying = false;
        this.currentTime = 0;
        if (this.playBtn) this.playBtn.innerHTML = '<i class="fas fa-play"></i>';
        
        if (this.cppEngine && typeof this.cppEngine._stop === 'function') {
            this.cppEngine._stop();
        } else {
            console.log('Stopping in fallback mode');
        }
        
        this.updateDisplay();
        this.updateTransportButtons();
        console.log('Stopped');
    }
    
    rewind() {
        this.currentTime = 0;
        this.updateDisplay();
        console.log('Rewound to beginning');
    }
    
    setTempo(bpm) {
        if (this.cppEngine && typeof this.cppEngine._setTempo === 'function') {
            this.cppEngine._setTempo(bpm);
        }
        console.log(`Tempo set to ${bpm} BPM`);
    }
    
    setMasterVolume(volume) {
        const normalizedVolume = volume / 100;
        if (this.cppEngine && typeof this.cppEngine._setMasterVolume === 'function') {
            this.cppEngine._setMasterVolume(normalizedVolume);
        }
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
        if (!this.cppEngine) return;
        
        const name = document.getElementById('trackName').value || `Track ${this.tracks.length + 1}`;
        const color = document.getElementById('trackColor').value;
        const type = document.getElementById('trackType').value;
        
        // Create track in C++ engine
        const trackId = this.cppEngine._addTrack();
        
        if (trackId >= 0) {
            const track = {
                id: trackId,
                name: name,
                color: color,
                type: type,
                volume: 75,
                pan: 0,
                isMuted: false,
                isSoloed: false,
                isRecording: false,
                isArmed: false,
                effects: []
            };
            
            this.tracks.push(track);
            this.renderTrack(track);
            this.hideTrackModal();
            this.updateTrackCount();
            
            console.log(`Created ${type} track: ${name} (ID: ${trackId})`);
        }
    }
    
    renderTrack(track) {
        const trackRow = document.createElement('div');
        trackRow.className = 'track-row';
        trackRow.dataset.trackId = track.id;
        
        trackRow.innerHTML = `
            <div class="track-control-panel">
                <div class="track-name" style="border-left: 4px solid ${this.getTrackColor(track.color)};">
                    ${track.name} <span class="track-type">(${track.type})</span>
                </div>
                <div class="track-controls-row">
                    <button class="track-btn mute" data-action="mute" title="Mute">M</button>
                    <button class="track-btn solo" data-action="solo" title="Solo">S</button>
                    <button class="track-btn record" data-action="arm" title="Arm for Recording">R</button>
                    <button class="track-btn fx" data-action="fx" title="Effects">FX</button>
                </div>
                <div class="track-controls-row">
                    <label>Vol:</label>
                    <input type="range" class="track-slider" min="0" max="100" value="${track.volume}" 
                           data-action="volume" title="Volume">
                    <span class="value-display">${track.volume}</span>
                </div>
                <div class="track-controls-row">
                    <label>Pan:</label>
                    <input type="range" class="track-slider" min="-100" max="100" value="${track.pan}" 
                           data-action="pan" title="Pan">
                    <span class="value-display">${track.pan}</span>
                </div>
            </div>
            <div class="track-timeline" style="border-left-color: ${this.getTrackColor(track.color)}">
                <div class="track-content">
                    <!-- Track audio content will be rendered here -->
                    <div class="track-placeholder">Ready for audio</div>
                </div>
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
                const value = parseFloat(e.target.value);
                this.handleTrackAction(track, slider.dataset.action, slider, value);
                // Update value display
                const valueDisplay = slider.parentElement.querySelector('.value-display');
                valueDisplay.textContent = slider.dataset.action === 'volume' ? value : value;
            });
        });
    }
    
    selectTrack(track) {
        // Clear previous selection
        document.querySelectorAll('.track-row').forEach(row => {
            row.classList.remove('selected');
        });
        
        // Select new track
        const trackElement = document.querySelector(`[data-track-id=\"${track.id}\"]`);
        trackElement.classList.add('selected');
        
        this.selectedTrack = track;
        this.updateTrackInfo();
        console.log(`Selected track: ${track.name}`);
    }
    
    handleTrackAction(track, action, element, value) {
        if (!this.cppEngine) return;
        
        switch (action) {
            case 'mute':
                track.isMuted = !track.isMuted;
                element.classList.toggle('active', track.isMuted);
                this.cppEngine._muteTrack(track.id);
                console.log(`Track ${track.name} ${track.isMuted ? 'muted' : 'unmuted'}`);
                break;
                
            case 'solo':
                track.isSoloed = !track.isSoloed;
                element.classList.toggle('active', track.isSoloed);
                this.cppEngine._soloTrack(track.id);
                console.log(`Track ${track.name} ${track.isSoloed ? 'soloed' : 'unsoloed'}`);
                break;
                
            case 'arm':
                track.isArmed = !track.isArmed;
                element.classList.toggle('active', track.isArmed);
                console.log(`Track ${track.name} ${track.isArmed ? 'armed' : 'disarmed'}`);
                break;
                
            case 'fx':
                this.selectTrack(track);
                this.showFXModal('reverb'); // Default to reverb
                break;
                
            case 'volume':
                track.volume = value;
                const normalizedVolume = value / 100;
                this.cppEngine._setTrackVolume(track.id, normalizedVolume);
                break;
                
            case 'pan':
                track.pan = value;
                const normalizedPan = value / 100; // -1 to 1
                this.cppEngine._setTrackPan(track.id, normalizedPan);
                break;
        }
        
        if (this.selectedTrack === track) {
            this.updateTrackInfo();
        }
    }
    
    // FX Management
    showFXModal(fxType) {
        if (!this.selectedTrack) {
            alert('Please select a track first');
            return;
        }
        
        this.selectedFX = fxType;
        const modal = document.getElementById('fxModal');
        const title = document.getElementById('fxModalTitle');
        const body = document.getElementById('fxModalBody');
        
        title.textContent = `${fxType.charAt(0).toUpperCase() + fxType.slice(1)} Parameters`;
        
        // Generate FX parameter controls based on type
        body.innerHTML = this.generateFXControls(fxType);
        
        modal.style.display = 'block';
    }
    
    generateFXControls(fxType) {
        switch (fxType) {
            case 'reverb':
                return `
                    <div class="fx-control-group">
                        <label>Room Size:</label>
                        <input type="range" id="reverbRoomSize" min="0" max="1" step="0.01" value="0.5">
                        <span class="fx-value">0.5</span>
                    </div>
                    <div class="fx-control-group">
                        <label>Damping:</label>
                        <input type="range" id="reverbDamping" min="0" max="1" step="0.01" value="0.5">
                        <span class="fx-value">0.5</span>
                    </div>
                    <div class="fx-control-group">
                        <label>Wet Level:</label>
                        <input type="range" id="reverbWetLevel" min="0" max="1" step="0.01" value="0.3">
                        <span class="fx-value">0.3</span>
                    </div>
                `;
            case 'delay':
                return `
                    <div class="fx-control-group">
                        <label>Delay Time (s):</label>
                        <input type="range" id="delayTime" min="0.01" max="2" step="0.01" value="0.25">
                        <span class="fx-value">0.25</span>
                    </div>
                    <div class="fx-control-group">
                        <label>Feedback:</label>
                        <input type="range" id="delayFeedback" min="0" max="0.95" step="0.01" value="0.3">
                        <span class="fx-value">0.3</span>
                    </div>
                    <div class="fx-control-group">
                        <label>Wet Level:</label>
                        <input type="range" id="delayWetLevel" min="0" max="1" step="0.01" value="0.3">
                        <span class="fx-value">0.3</span>
                    </div>
                `;
            case 'filter':
                return `
                    <div class="fx-control-group">
                        <label>Cutoff Frequency (Hz):</label>
                        <input type="range" id="filterCutoff" min="20" max="20000" step="1" value="1000">
                        <span class="fx-value">1000</span>
                    </div>
                    <div class="fx-control-group">
                        <label>Resonance:</label>
                        <input type="range" id="filterResonance" min="0.1" max="10" step="0.1" value="0.7">
                        <span class="fx-value">0.7</span>
                    </div>
                `;
            case 'synth':
                return `
                    <div class="fx-control-group">
                        <label>Frequency (Hz):</label>
                        <input type="range" id="synthFrequency" min="80" max="2000" step="1" value="440">
                        <span class="fx-value">440</span>
                    </div>
                    <div class="fx-control-group">
                        <label>Amplitude:</label>
                        <input type="range" id="synthAmplitude" min="0" max="1" step="0.01" value="0.5">
                        <span class="fx-value">0.5</span>
                    </div>
                `;
            default:
                return '<p>No parameters available for this effect.</p>';
        }
    }
    
    hideFXModal() {
        document.getElementById('fxModal').style.display = 'none';
    }
    
    applyFX() {
        if (!this.cppEngine || !this.selectedTrack || !this.selectedFX) return;
        
        const trackId = this.selectedTrack.id;
        
        switch (this.selectedFX) {
            case 'reverb':
                const roomSize = parseFloat(document.getElementById('reverbRoomSize').value);
                const damping = parseFloat(document.getElementById('reverbDamping').value);
                const wetLevel = parseFloat(document.getElementById('reverbWetLevel').value);
                this.cppEngine._addReverbToTrack(trackId, roomSize, damping, wetLevel);
                console.log(`Applied reverb to track ${this.selectedTrack.name}`);
                break;
                
            case 'delay':
                const delayTime = parseFloat(document.getElementById('delayTime').value);
                const feedback = parseFloat(document.getElementById('delayFeedback').value);
                const delayWet = parseFloat(document.getElementById('delayWetLevel').value);
                this.cppEngine._addDelayToTrack(trackId, delayTime, feedback, delayWet);
                console.log(`Applied delay to track ${this.selectedTrack.name}`);
                break;
                
            case 'filter':
                const cutoff = parseFloat(document.getElementById('filterCutoff').value);
                this.cppEngine._setTrackFilterCutoff(trackId, cutoff);
                console.log(`Applied filter to track ${this.selectedTrack.name}`);
                break;
        }
        
        this.hideFXModal();
        this.updateTrackInfo();
    }
    
    // Synth Generation
    generateSynth() {
        if (!this.cppEngine || !this.selectedTrack) {
            alert('Please select a track first');
            return;
        }
        
        const frequency = parseFloat(this.synthFreqSlider.value);
        const duration = parseFloat(this.synthDurationSlider.value);
        const frames = Math.floor(duration * 44100); // 44.1kHz sample rate
        
        this.cppEngine._generateSynthOnTrack(this.selectedTrack.id, frequency, frames);
        
        // Update track visual to show audio content
        const trackElement = document.querySelector(`[data-track-id=\"${this.selectedTrack.id}\"] .track-placeholder`);
        if (trackElement) {
            trackElement.textContent = `Synth: ${frequency}Hz, ${duration}s`;
            trackElement.style.background = 'linear-gradient(90deg, #4CAF50, #2196F3)';
            trackElement.style.color = 'white';
            trackElement.style.padding = '5px';
            trackElement.style.borderRadius = '3px';
        }
        
        console.log(`Generated synth on track ${this.selectedTrack.name}: ${frequency}Hz for ${duration}s`);
    }
    
    // Display Updates
    updateDisplay() {
        this.updateTimeDisplay();
        this.updateSystemInfo();
    }
    
    updateTimeDisplay() {
        if (this.cppEngine) {
            this.currentTime = this.cppEngine._getCurrentTime();
        }
        this.currentTimeElement.textContent = this.formatTime(this.currentTime);
        this.totalTimeElement.textContent = this.formatTime(120); // 2 minutes for demo
    }
    
    updateSystemInfo() {
        if (this.cppEngine) {
            const trackCount = this.cppEngine._getTrackCount();
            this.trackCountElement.textContent = trackCount;
        }
    }
    
    updateTrackCount() {
        if (this.cppEngine) {
            const trackCount = this.cppEngine._getTrackCount();
            this.trackCountElement.textContent = trackCount;
        }
    }
    
    updateTrackInfo() {
        const infoElement = document.getElementById('selectedTrackInfo');
        
        if (this.selectedTrack) {
            const track = this.selectedTrack;
            infoElement.innerHTML = `
                <h4>${track.name}</h4>
                <div class="info-row">
                    <span>Type:</span>
                    <span>${track.type}</span>
                </div>
                <div class="info-row">
                    <span>Volume:</span>
                    <span>${track.volume}%</span>
                </div>
                <div class="info-row">
                    <span>Pan:</span>
                    <span>${track.pan > 0 ? 'R' : track.pan < 0 ? 'L' : 'C'}${Math.abs(track.pan)}</span>
                </div>
                <div class="info-row">
                    <span>Status:</span>
                    <span>${track.isMuted ? 'Muted' : track.isSoloed ? 'Soloed' : 'Active'}</span>
                </div>
                <div class="info-row">
                    <span>Engine:</span>
                    <span class="perf-excellent">C++ Native</span>
                </div>
            `;
        } else {
            infoElement.innerHTML = '<p>No track selected</p>';
        }
    }
    
    updateConnectionStatus() {
        if (this.isConnected) {
            this.connectionStatus.innerHTML = '<span class="status-indicator online"></span><span>Native C++ Engine Ready</span>';
        } else {
            this.connectionStatus.innerHTML = '<span class="status-indicator offline"></span><span>Engine Not Available</span>';
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
    
    // Real-time Updates
    startRealTimeUpdates() {
        setInterval(() => {
            if (this.isPlaying) {
                this.updateTimeDisplay();
            }
        }, 100); // Update every 100ms
        
        // Update FX controls in real-time
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('fx-value-slider')) {
                const valueSpan = e.target.parentElement.querySelector('.fx-value');
                if (valueSpan) {
                    valueSpan.textContent = e.target.value;
                }
            }
        });
    }
    
    // Timeline
    createTimelineRuler() {
        const ruler = document.getElementById('timelineRuler');
        const duration = 120; // 2 minutes in seconds
        const pixelsPerSecond = 20;
        
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
            orange: '#ff9800',
            cyan: '#00bcd4',
            yellow: '#ffeb3b'
        };
        return colors[colorName] || colors.blue;
    }
    
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${ms.toString().padStart(3, '0')}`;
    }
    
    // Modal Management
    showSettingsModal() {
        this.settingsModal.style.display = 'block';
    }
    
    hideSettingsModal() {
        this.settingsModal.style.display = 'none';
    }
    
    applySettings() {
        const sampleRate = document.getElementById('sampleRateSelect').value;
        const bufferSize = document.getElementById('bufferSizeSelect').value;
        
        // Update display
        this.sampleRateElement.textContent = `${parseInt(sampleRate).toLocaleString()} Hz`;
        this.bufferSizeElement.textContent = `${bufferSize} samples`;
        
        this.hideSettingsModal();
        console.log('Settings applied:', { sampleRate, bufferSize });
    }
    
    toggleRecord() {
        // Toggle record state for selected track
        if (this.selectedTrack) {
            this.selectedTrack.isRecording = !this.selectedTrack.isRecording;
            this.updateTrackInfo();
            console.log(`Recording ${this.selectedTrack.isRecording ? 'started' : 'stopped'} on ${this.selectedTrack.name}`);
        }
    }
}

// Initialize the enhanced DAW interface when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing Enhanced AudioVerse C++ DAW...');
    window.dawInterface = new EnhancedCPPDAWInterface();
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
            case ' ':
                e.preventDefault();
                if (window.dawInterface) window.dawInterface.togglePlay();
                break;
            case 's':
                e.preventDefault();
                if (window.dawInterface) window.dawInterface.stop();
                break;
            case 't':
                e.preventDefault();
                if (window.dawInterface) window.dawInterface.showAddTrackModal();
                break;
            case 'r':
                e.preventDefault();
                if (window.dawInterface) window.dawInterface.toggleRecord();
                break;
        }
    }
});