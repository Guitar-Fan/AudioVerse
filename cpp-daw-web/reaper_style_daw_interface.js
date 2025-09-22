// Enhanced AudioVerse C++ DAW Interface with Reaper-style Features
class ReaperStyleDAWInterface {
    constructor() {
        this.isConnected = false;
        this.isPlaying = false;
        this.currentTime = 0;
        this.tracks = [];
        this.selectedTrack = null;
        this.cppEngine = null;
        
        // Timeline view state
        this.timelineZoom = 1.0;
        this.timelineStart = 0.0;
        this.timelineWidth = 800;
        
        // Mouse interaction state
        this.dragState = {
            isDragging: false,
            dragType: null, // 'clip', 'timeline', 'zoom'
            startX: 0,
            startY: 0,
            originalValue: 0
        };
        
        this.init();
    }
    
    async init() {
        this.initializeElements();
        this.bindEvents();
        
        // Initialize the enhanced C++ WASM module
        await this.initializeEnhancedCPPEngine();
        
        this.updateDisplay();
        this.createAdvancedTimeline();
        this.startRealTimeUpdates();
    }
    
    async initializeEnhancedCPPEngine() {
        try {
            console.log('Initializing Enhanced AudioVerse C++ DAW with Reaper-style features...');
            console.log('Loading Enhanced C++ DAW Engine...');
            
            // Check if EnhancedCPPDAWModule exists
            if (typeof EnhancedCPPDAWModule === 'undefined') {
                throw new Error('EnhancedCPPDAWModule not found - make sure enhanced_cpp_daw_engine.js is loaded');
            }
            
            // Load the C++ WASM module with timeout
            const timeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Enhanced WASM module loading timeout')), 15000)
            );
            
            this.cppEngine = await Promise.race([EnhancedCPPDAWModule(), timeout]);
            
            if (!this.cppEngine) {
                throw new Error('Failed to initialize Enhanced WASM module');
            }
            
            // Initialize the enhanced DAW engine
            if (typeof this.cppEngine._initializeEnhancedDAW === 'function') {
                this.cppEngine._initializeEnhancedDAW();
                
                // Check if initialization was successful
                if (typeof this.cppEngine._enhancedGetIsInitialized === 'function') {
                    const isInitialized = this.cppEngine._enhancedGetIsInitialized();
                    if (!isInitialized) {
                        throw new Error('Enhanced C++ engine failed to initialize properly');
                    }
                }
                
                console.log('🎵 Enhanced C++ DAW Engine with Reaper-style features initialized successfully!');
            } else {
                console.warn('Enhanced initialization function not found, using fallback mode');
            }
            
            this.isConnected = true;
            this.updateConnectionStatus();
            
        } catch (error) {
            console.error('Error loading Enhanced WASM module:', error);
            this.updateStatus('Failed', 'Enhanced Engine Load Failed: ' + error.message);
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
        
        // Timeline controls
        this.zoomInBtn = safeGetElement('zoomInBtn');
        this.zoomOutBtn = safeGetElement('zoomOutBtn');
        this.zoomFitBtn = safeGetElement('zoomFitBtn');
        
        // Time display
        this.currentTimeElement = safeGetElement('currentTime');
        this.totalTimeElement = safeGetElement('totalTime');
        
        // Controls
        this.tempoInput = safeGetElement('tempoInput');
        this.masterVolumeSlider = safeGetElement('masterVolume');
        
        // Track management
        this.addTrackBtn = safeGetElement('addTrackBtn');
        this.trackList = safeGetElement('trackList');
        this.tracksContainer = safeGetElement('tracksContainer');
        
        // Timeline
        this.timelineRuler = safeGetElement('timelineRuler');
        this.timelineContainer = safeGetElement('timelineContainer');
        
        // Modals
        this.trackModal = safeGetElement('trackModal');
        this.fxModal = safeGetElement('fxModal');
        this.settingsModal = safeGetElement('settingsModal');
        
        // Status displays
        this.connectionStatus = safeGetElement('connectionStatus');
        this.engineInfo = safeGetElement('engineInfo');
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
        
        // Timeline controls
        safeBind(this.zoomInBtn, 'click', () => this.zoomIn());
        safeBind(this.zoomOutBtn, 'click', () => this.zoomOut());
        safeBind(this.zoomFitBtn, 'click', () => this.zoomToFitProject());
        
        // Tempo control
        safeBind(this.tempoInput, 'change', (e) => this.setTempo(parseInt(e.target.value)));
        
        // Master volume
        safeBind(this.masterVolumeSlider, 'input', (e) => this.setMasterVolume(parseInt(e.target.value)));
        
        // Track management
        safeBind(this.addTrackBtn, 'click', () => this.showAddTrackModal());
        
        // Timeline mouse events
        safeBind(this.timelineContainer, 'mousedown', (e) => this.handleTimelineMouseDown(e));
        safeBind(this.timelineContainer, 'mousemove', (e) => this.handleTimelineMouseMove(e));
        safeBind(this.timelineContainer, 'mouseup', (e) => this.handleTimelineMouseUp(e));
        safeBind(this.timelineContainer, 'wheel', (e) => this.handleTimelineWheel(e));
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        
        this.bindModalEvents();
    }
    
    bindModalEvents() {
        // Track modal events
        if (this.trackModal) {
            const closeBtn = this.trackModal.querySelector('.close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.hideTrackModal());
            }
            
            const createBtn = document.getElementById('createTrackBtn');
            if (createBtn) {
                createBtn.addEventListener('click', () => this.createEnhancedTrack());
            }
        }
        
        // Close modals when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === this.trackModal) this.hideTrackModal();
            if (e.target === this.fxModal) this.hideFXModal();
            if (e.target === this.settingsModal) this.hideSettingsModal();
        });
    }
    
    // Enhanced Transport Controls
    togglePlay() {
        if (!this.cppEngine) return;
        
        this.isPlaying = !this.isPlaying;
        
        if (this.isPlaying) {
            this.cppEngine._enhancedPlay();
            console.log('🎵 Playing with enhanced timeline tracking');
        } else {
            this.cppEngine._enhancedPause();
            console.log('⏸ Paused');
        }
        
        this.updateTransportButtons();
    }
    
    stop() {
        if (!this.cppEngine) return;
        
        this.isPlaying = false;
        this.currentTime = 0;
        this.cppEngine._enhancedStop();
        
        this.updateDisplay();
        this.updateTransportButtons();
        console.log('⏹ Stopped and returned to start');
    }
    
    rewind() {
        if (!this.cppEngine) return;
        
        this.currentTime = 0;
        this.cppEngine._enhancedSetCurrentTime(0);
        this.updateDisplay();
        console.log('⏪ Rewound to start');
    }
    
    toggleRecord() {
        if (!this.cppEngine) return;
        
        const isRecording = this.cppEngine._enhancedGetIsRecording();
        
        if (isRecording) {
            this.cppEngine._stopGlobalRecording();
            console.log('🔴 Recording stopped');
        } else {
            const started = this.cppEngine._startGlobalRecording();
            if (started) {
                console.log('🔴 Recording started');
            } else {
                console.log('❌ Recording failed to start (no armed tracks?)');
            }
        }
        
        this.updateTransportButtons();
    }
    
    // Enhanced Timeline Controls (Reaper-style)
    zoomIn(factor = 1.5) {
        if (this.cppEngine) {
            this.cppEngine._zoomTimelineIn(factor);
            this.updateTimelineView();
            console.log(`🔍 Zoomed in by factor ${factor}`);
        }
    }
    
    zoomOut(factor = 1.5) {
        if (this.cppEngine) {
            this.cppEngine._zoomTimelineOut(factor);
            this.updateTimelineView();
            console.log(`🔍 Zoomed out by factor ${factor}`);
        }
    }
    
    zoomToFitProject() {
        if (this.cppEngine) {
            const projectDuration = this.cppEngine._getProjectDuration();
            if (projectDuration > 0) {
                this.cppEngine._zoomTimelineToFit(0, projectDuration);
                this.updateTimelineView();
                console.log(`🔍 Zoomed to fit project (${projectDuration.toFixed(2)}s)`);
            }
        }
    }
    
    scrollTimeline(deltaTime) {
        if (this.cppEngine) {
            this.cppEngine._scrollTimeline(deltaTime);
            this.updateTimelineView();
        }
    }
    
    scrollToTime(time) {
        if (this.cppEngine) {
            this.cppEngine._scrollToTime(time);
            this.updateTimelineView();
        }
    }
    
    // Enhanced Track Management
    showAddTrackModal() {
        if (this.trackModal) {
            this.trackModal.style.display = 'block';
            document.getElementById('trackName').value = `Track ${this.tracks.length + 1}`;
        }
    }
    
    hideTrackModal() {
        if (this.trackModal) {
            this.trackModal.style.display = 'none';
        }
    }
    
    createEnhancedTrack() {
        if (!this.cppEngine) return;
        
        const name = document.getElementById('trackName').value || `Track ${this.tracks.length + 1}`;
        const color = document.getElementById('trackColor').value;
        const type = document.getElementById('trackType').value;
        
        // Create track in enhanced C++ engine
        const trackId = this.cppEngine._addEnhancedTrack(name);
        
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
                clips: []
            };
            
            this.tracks.push(track);
            this.renderEnhancedTrack(track);
            this.hideTrackModal();
            this.updateTrackCount();
            
            console.log(`🎛 Created enhanced ${type} track: ${name} (ID: ${trackId})`);
        }
    }
    
    renderEnhancedTrack(track) {
        if (!this.tracksContainer) return;
        
        const trackElement = document.createElement('div');
        trackElement.className = 'enhanced-track';
        trackElement.dataset.trackId = track.id;
        
        trackElement.innerHTML = `
            <div class="track-header">
                <div class="track-controls">
                    <button class="track-btn mute-btn" data-action="mute" title="Mute">M</button>
                    <button class="track-btn solo-btn" data-action="solo" title="Solo">S</button>
                    <button class="track-btn arm-btn" data-action="arm" title="Arm for Recording">R</button>
                </div>
                <div class="track-info">
                    <div class="track-name">${track.name}</div>
                    <div class="track-type">${track.type || 'Audio'}</div>
                </div>
                <div class="track-meters">
                    <input type="range" class="volume-slider" min="0" max="100" value="${track.volume}" 
                           data-action="volume" title="Volume">
                    <input type="range" class="pan-slider" min="-100" max="100" value="${track.pan}" 
                           data-action="pan" title="Pan">
                </div>
            </div>
            <div class="track-timeline" data-track-id="${track.id}">
                <div class="track-clips"></div>
            </div>
        `;
        
        // Bind track events
        this.bindTrackEvents(trackElement, track);
        
        this.tracksContainer.appendChild(trackElement);
    }
    
    bindTrackEvents(trackElement, track) {
        // Track control buttons
        trackElement.querySelectorAll('.track-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                this.handleEnhancedTrackAction(track, action, e.target);
            });
        });
        
        // Volume and pan sliders
        trackElement.querySelectorAll('input[type="range"]').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const action = e.target.dataset.action;
                const value = parseFloat(e.target.value);
                this.handleEnhancedTrackAction(track, action, e.target, value);
            });
        });
        
        // Track timeline for clip management
        const trackTimeline = trackElement.querySelector('.track-timeline');
        if (trackTimeline) {
            trackTimeline.addEventListener('dblclick', (e) => this.addClipToTrackAt(track, e));
            trackTimeline.addEventListener('contextmenu', (e) => this.showTrackContextMenu(track, e));
        }
    }
    
    handleEnhancedTrackAction(track, action, element, value) {
        if (!this.cppEngine) return;
        
        switch (action) {
            case 'mute':
                track.isMuted = !track.isMuted;
                element.classList.toggle('active', track.isMuted);
                this.cppEngine._muteEnhancedTrack(track.id);
                console.log(`🔇 Track ${track.name} ${track.isMuted ? 'muted' : 'unmuted'}`);
                break;
                
            case 'solo':
                track.isSoloed = !track.isSoloed;
                element.classList.toggle('active', track.isSoloed);
                this.cppEngine._soloEnhancedTrack(track.id);
                console.log(`🎧 Track ${track.name} ${track.isSoloed ? 'soloed' : 'unsoloed'}`);
                break;
                
            case 'arm':
                track.isArmed = !track.isArmed;
                element.classList.toggle('active', track.isArmed);
                this.cppEngine._armTrackForRecording(track.id, track.isArmed);
                console.log(`🔴 Track ${track.name} ${track.isArmed ? 'armed' : 'disarmed'} for recording`);
                break;
                
            case 'volume':
                track.volume = value;
                this.cppEngine._setEnhancedTrackVolume(track.id, value / 100);
                console.log(`🔊 Track ${track.name} volume: ${value}%`);
                break;
                
            case 'pan':
                track.pan = value;
                this.cppEngine._setEnhancedTrackPan(track.id, value / 100);
                console.log(`↔️ Track ${track.name} pan: ${value > 0 ? 'R' : value < 0 ? 'L' : 'C'}${Math.abs(value)}`);
                break;
        }
    }
    
    // Timeline Mouse Interaction (Reaper-style)
    handleTimelineMouseDown(e) {
        if (!this.timelineContainer) return;
        
        const rect = this.timelineContainer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        this.dragState.isDragging = true;
        this.dragState.startX = x;
        this.dragState.startY = y;
        
        // Determine what we're interacting with
        if (e.target.classList.contains('clip')) {
            this.dragState.dragType = 'clip';
            this.dragState.clipElement = e.target;
        } else if (e.target.classList.contains('timeline-ruler')) {
            this.dragState.dragType = 'timeline';
            this.setPlayheadPosition(x);
        } else {
            this.dragState.dragType = 'scroll';
            this.dragState.originalStart = this.cppEngine ? this.cppEngine._getTimelineStart() : 0;
        }
        
        e.preventDefault();
    }
    
    handleTimelineMouseMove(e) {
        if (!this.dragState.isDragging) return;
        
        const rect = this.timelineContainer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const deltaX = x - this.dragState.startX;
        
        switch (this.dragState.dragType) {
            case 'clip':
                this.dragClip(deltaX);
                break;
            case 'timeline':
                this.setPlayheadPosition(x);
                break;
            case 'scroll':
                this.scrollTimelineByPixels(-deltaX);
                break;
        }
    }
    
    handleTimelineMouseUp(e) {
        this.dragState.isDragging = false;
        this.dragState.dragType = null;
        this.dragState.clipElement = null;
    }
    
    handleTimelineWheel(e) {
        e.preventDefault();
        
        if (e.ctrlKey || e.metaKey) {
            // Zoom with Ctrl+wheel (Reaper-style)
            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
            if (e.deltaY > 0) {
                this.zoomOut(1.1);
            } else {
                this.zoomIn(1.1);
            }
        } else {
            // Scroll with wheel
            const scrollAmount = e.deltaY * 0.01; // Convert to seconds
            this.scrollTimeline(scrollAmount);
        }
    }
    
    setPlayheadPosition(pixelX) {
        if (!this.cppEngine) return;
        
        const timelineStart = this.cppEngine._getTimelineStart();
        const timelineZoom = this.cppEngine._getTimelineZoom();
        const time = timelineStart + (pixelX / timelineZoom);
        
        this.cppEngine._enhancedSetCurrentTime(time);
        this.currentTime = time;
        this.updateTimeDisplay();
    }
    
    scrollTimelineByPixels(deltaPixels) {
        if (!this.cppEngine) return;
        
        const timelineZoom = this.cppEngine._getTimelineZoom();
        const deltaTime = deltaPixels / timelineZoom;
        this.scrollTimeline(deltaTime);
    }
    
    // Keyboard Shortcuts (Reaper-style)
    handleKeyDown(e) {
        // Prevent shortcuts when typing in inputs
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        switch (e.code) {
            case 'Space':
                e.preventDefault();
                this.togglePlay();
                break;
            case 'KeyR':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.toggleRecord();
                }
                break;
            case 'Home':
                e.preventDefault();
                this.rewind();
                break;
            case 'Equal':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.zoomIn();
                }
                break;
            case 'Minus':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.zoomOut();
                }
                break;
            case 'KeyF':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.zoomToFitProject();
                }
                break;
            case 'KeyT':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.showAddTrackModal();
                }
                break;
        }
    }
    
    // Timeline View Updates
    updateTimelineView() {
        if (!this.cppEngine) return;
        
        this.timelineZoom = this.cppEngine._getTimelineZoom();
        this.timelineStart = this.cppEngine._getTimelineStart();
        
        this.renderTimelineRuler();
        this.updateClipPositions();
    }
    
    createAdvancedTimeline() {
        this.renderTimelineRuler();
    }
    
    renderTimelineRuler() {
        if (!this.timelineRuler) return;
        
        this.timelineRuler.innerHTML = '';
        
        const visibleDuration = this.cppEngine ? this.cppEngine._getTimelineVisibleDuration() : 60;
        const startTime = this.timelineStart;
        const zoom = this.timelineZoom;
        
        // Calculate time intervals for markers
        let interval = 1; // Start with 1 second intervals
        if (zoom < 10) interval = 10;
        else if (zoom < 50) interval = 5;
        else if (zoom > 200) interval = 0.1;
        
        for (let time = Math.floor(startTime / interval) * interval; 
             time <= startTime + visibleDuration; 
             time += interval) {
            
            if (time < startTime) continue;
            
            const x = (time - startTime) * zoom;
            
            const marker = document.createElement('div');
            marker.className = 'timeline-marker';
            marker.style.left = `${x}px`;
            
            const label = document.createElement('span');
            label.className = 'timeline-label';
            label.textContent = this.formatTime(time);
            marker.appendChild(label);
            
            this.timelineRuler.appendChild(marker);
        }
        
        // Add playhead
        this.updatePlayhead();
    }
    
    updatePlayhead() {
        if (!this.timelineRuler) return;
        
        let playhead = this.timelineRuler.querySelector('.playhead');
        if (!playhead) {
            playhead = document.createElement('div');
            playhead.className = 'playhead';
            this.timelineRuler.appendChild(playhead);
        }
        
        const relativeTime = this.currentTime - this.timelineStart;
        const x = relativeTime * this.timelineZoom;
        playhead.style.left = `${x}px`;
    }
    
    // Display Updates
    updateDisplay() {
        this.updateTimeDisplay();
        this.updatePlayhead();
        this.updateConnectionStatus();
    }
    
    updateTimeDisplay() {
        if (this.currentTimeElement) {
            this.currentTimeElement.textContent = this.formatTime(this.currentTime);
        }
        
        if (this.totalTimeElement && this.cppEngine) {
            const projectDuration = this.cppEngine._getProjectDuration();
            this.totalTimeElement.textContent = this.formatTime(projectDuration);
        }
    }
    
    updateTransportButtons() {
        if (this.playBtn) {
            this.playBtn.innerHTML = this.isPlaying ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
            this.playBtn.classList.toggle('active', this.isPlaying);
        }
        
        if (this.recordBtn && this.cppEngine) {
            const isRecording = this.cppEngine._enhancedGetIsRecording();
            this.recordBtn.classList.toggle('active', isRecording);
        }
    }
    
    updateConnectionStatus() {
        const status = this.isConnected ? 'Connected' : 'Disconnected';
        const engine = this.isConnected ? 'Enhanced C++ Engine (Reaper-style)' : 'Not Connected';
        
        if (this.connectionStatus) {
            this.connectionStatus.innerHTML = `
                <span class="${this.isConnected ? 'connected' : 'disconnected'}">${status}</span>
            `;
        }
        
        if (this.engineInfo) {
            this.engineInfo.textContent = engine;
        }
    }
    
    updateTrackCount() {
        const trackCount = this.tracks.length;
        console.log(`📊 Total tracks: ${trackCount}`);
    }
    
    // Real-time Updates
    startRealTimeUpdates() {
        setInterval(() => {
            if (this.isPlaying && this.cppEngine) {
                this.currentTime = this.cppEngine._enhancedGetCurrentTime();
                this.updateTimeDisplay();
                this.updatePlayhead();
            }
        }, 50); // 20fps updates
    }
    
    // Utility Methods
    setTempo(bpm) {
        if (this.cppEngine) {
            this.cppEngine._enhancedSetTempo(bpm);
            console.log(`🎼 Tempo set to ${bpm} BPM`);
        }
    }
    
    setMasterVolume(volume) {
        const normalizedVolume = volume / 100;
        if (this.cppEngine) {
            this.cppEngine._enhancedSetMasterVolume(normalizedVolume);
            console.log(`🔊 Master volume set to ${volume}%`);
        }
    }
    
    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 100);
        return `${minutes}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }
    
    // Placeholder methods for modal management
    hideFXModal() {
        if (this.fxModal) this.fxModal.style.display = 'none';
    }
    
    hideSettingsModal() {
        if (this.settingsModal) this.settingsModal.style.display = 'none';
    }
    
    addClipToTrackAt(track, event) {
        // Placeholder for adding clips via double-click
        console.log(`Would add clip to track ${track.name} at click position`);
    }
    
    showTrackContextMenu(track, event) {
        // Placeholder for track context menu
        event.preventDefault();
        console.log(`Would show context menu for track ${track.name}`);
    }
}

// Initialize the enhanced DAW interface when the page loads
window.addEventListener('load', () => {
    console.log('🎵 Initializing AudioVerse Enhanced DAW with Reaper-style features...');
    window.dawInterface = new ReaperStyleDAWInterface();
});