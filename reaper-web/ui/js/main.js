/*
 * REAPER Web - Main Application Entry Point
 * Initializes the complete REAPER web DAW interface
 */

class ReaperWebApp {
    constructor() {
        this.initialized = false;
        this.audioContext = null;
        this.audioEngine = null;
        
        // UI Managers
        this.uiManager = null;
        this.trackControls = null;
        this.transportControls = null;
        this.arrangeView = null;
        this.mixerView = null;
        
        // Application state
        this.isPlaying = false;
        this.isRecording = false;
        this.currentTime = 0;
        this.totalTime = 0;
        this.tempo = 120;
        this.timeSignature = [4, 4];
        
        // Project data
        this.projectName = "Untitled Project";
        this.tracks = [];
        this.mediaItems = [];
    }
    
    async initialize() {
        try {
            console.log('REAPER Web DAW - Starting initialization...');
            
            // Initialize Web Audio Context
            await this.initializeAudio();
            
            // Initialize UI managers
            this.initializeUI();
            
            // Load WASM module (when available)
            await this.loadWASMModule();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Create default project structure
            this.createDefaultProject();
            
            this.initialized = true;
            console.log('REAPER Web DAW - Initialization complete!');
            
            // Update status
            this.updateStatus('Ready');
            
        } catch (error) {
            console.error('Failed to initialize REAPER Web DAW:', error);
            this.updateStatus('Initialization failed');
        }
    }
    
    async initializeAudio() {
        // Create AudioContext
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: 44100,
            latencyHint: 'interactive'
        });
        
        // Resume audio context if suspended
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
        
        // Set up audio worklet (for future use)
        try {
            await this.audioContext.audioWorklet.addModule('js/audio-worklet-processor.js');
        } catch (error) {
            console.warn('Audio worklet not available:', error);
        }
        
        console.log('Audio initialized:', {
            sampleRate: this.audioContext.sampleRate,
            state: this.audioContext.state,
            baseLatency: this.audioContext.baseLatency
        });
    }
    
    initializeUI() {
        // Initialize UI managers
        this.uiManager = new UIManager(this);
        this.trackControls = new TrackControls(this);
        this.transportControls = new TransportControls(this);
        this.arrangeView = new ArrangeView(this);
        this.mixerView = new MixerView(this);
        
        // Initialize each UI component
        this.uiManager.initialize();
        this.trackControls.initialize();
        this.transportControls.initialize();
        this.arrangeView.initialize();
        this.mixerView.initialize();
    }
    
    async loadWASMModule() {
        try {
            // Load the REAPER engine WASM module when available
            if (typeof Module !== 'undefined') {
                this.audioEngine = Module;
                console.log('WASM audio engine loaded');
            } else {
                console.log('WASM module not available, using JavaScript fallback');
            }
        } catch (error) {
            console.warn('Failed to load WASM module:', error);
        }
    }
    
    setupEventListeners() {
        // Window events
        window.addEventListener('beforeunload', (e) => {
            if (this.hasUnsavedChanges()) {
                e.preventDefault();
                e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
            }
        });
        
        window.addEventListener('resize', () => {
            this.arrangeView?.handleResize();
            this.mixerView?.handleResize();
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcut(e);
        });
        
        // Audio context state changes
        this.audioContext.addEventListener('statechange', () => {
            console.log('Audio context state changed:', this.audioContext.state);
            this.updateAudioStatus();
        });
    }
    
    createDefaultProject() {
        // Create master track
        this.createMasterTrack();
        
        // Create a few default tracks
        this.addTrack('Audio 1');
        this.addTrack('Audio 2');
        
        // Update UI
        this.trackControls.refreshTrackList();
        this.arrangeView.refreshArrangeView();
        this.mixerView.refreshMixer();
    }
    
    createMasterTrack() {
        const masterTrack = {
            id: 'master',
            name: 'Master',
            type: 'master',
            volume: 1.0,
            pan: 0.0,
            mute: false,
            solo: false,
            effects: [],
            sends: []
        };
        
        this.tracks.unshift(masterTrack);
    }
    
    addTrack(name = 'New Track') {
        const track = {
            id: `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: name,
            type: 'audio',
            volume: 1.0,
            pan: 0.0,
            mute: false,
            solo: false,
            recordArm: false,
            inputMonitor: false,
            effects: [],
            sends: [],
            color: '#808080'
        };
        
        this.tracks.push(track);
        
        // Update UI
        this.trackControls.addTrackControl(track);
        this.arrangeView.addTrackLane(track);
        this.mixerView.addMixerChannel(track);
        
        return track;
    }
    
    removeTrack(trackId) {
        const index = this.tracks.findIndex(t => t.id === trackId);
        if (index > 0) { // Don't remove master track
            this.tracks.splice(index, 1);
            
            // Update UI
            this.trackControls.removeTrackControl(trackId);
            this.arrangeView.removeTrackLane(trackId);
            this.mixerView.removeMixerChannel(trackId);
        }
    }
    
    // Transport controls
    play() {
        if (!this.isPlaying) {
            this.isPlaying = true;
            this.transportControls.updatePlayState(true);
            this.startAudioProcessing();
            console.log('Playback started');
        }
    }
    
    pause() {
        if (this.isPlaying) {
            this.isPlaying = false;
            this.transportControls.updatePlayState(false);
            this.stopAudioProcessing();
            console.log('Playback paused');
        }
    }
    
    stop() {
        this.isPlaying = false;
        this.isRecording = false;
        this.currentTime = 0;
        this.transportControls.updatePlayState(false);
        this.transportControls.updateRecordState(false);
        this.transportControls.updateTimeDisplay();
        this.stopAudioProcessing();
        console.log('Playback stopped');
    }
    
    record() {
        if (!this.isRecording) {
            this.isRecording = true;
            if (!this.isPlaying) {
                this.play();
            }
            this.transportControls.updateRecordState(true);
            console.log('Recording started');
        } else {
            this.isRecording = false;
            this.transportControls.updateRecordState(false);
            console.log('Recording stopped');
        }
    }
    
    startAudioProcessing() {
        // Start audio processing loop
        if (this.audioProcessingLoop) {
            clearInterval(this.audioProcessingLoop);
        }
        
        this.audioProcessingLoop = setInterval(() => {
            this.processAudioFrame();
        }, 1000 / 60); // 60 FPS update rate
    }
    
    stopAudioProcessing() {
        if (this.audioProcessingLoop) {
            clearInterval(this.audioProcessingLoop);
            this.audioProcessingLoop = null;
        }
    }
    
    processAudioFrame() {
        if (this.isPlaying) {
            // Update time position
            this.currentTime += 1 / 60; // Approximate time increment
            
            // Update UI
            this.transportControls.updateTimeDisplay();
            this.arrangeView.updatePlayhead();
            
            // Process audio through tracks (placeholder)
            this.processAudioTracks();
        }
    }
    
    processAudioTracks() {
        // Placeholder for audio processing
        // This will be replaced with actual WASM audio engine calls
        for (const track of this.tracks) {
            if (!track.mute) {
                // Process track audio
            }
        }
    }
    
    // Keyboard shortcuts
    handleKeyboardShortcut(e) {
        // Prevent shortcuts if typing in input fields
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }
        
        const key = e.key.toLowerCase();
        const ctrl = e.ctrlKey || e.metaKey;
        const alt = e.altKey;
        const shift = e.shiftKey;
        
        switch (key) {
            case ' ': // Spacebar - Play/Pause
                e.preventDefault();
                if (this.isPlaying) {
                    this.pause();
                } else {
                    this.play();
                }
                break;
                
            case 'r': // R - Record
                if (!ctrl && !alt) {
                    e.preventDefault();
                    this.record();
                }
                break;
                
            case 'escape': // Escape - Stop
                e.preventDefault();
                this.stop();
                break;
                
            case 't': // Ctrl+T - Add track
                if (ctrl) {
                    e.preventDefault();
                    this.addTrack();
                }
                break;
                
            case 's': // Ctrl+S - Save
                if (ctrl) {
                    e.preventDefault();
                    this.saveProject();
                }
                break;
                
            case 'z': // Ctrl+Z - Undo
                if (ctrl && !shift) {
                    e.preventDefault();
                    this.undo();
                }
                break;
                
            case 'y': // Ctrl+Y - Redo
            case 'z': // Ctrl+Shift+Z - Redo
                if (ctrl && (key === 'y' || shift)) {
                    e.preventDefault();
                    this.redo();
                }
                break;
        }
    }
    
    // Project management
    saveProject() {
        console.log('Saving project...');
        // Implement project saving
        this.updateStatus('Project saved');
    }
    
    loadProject() {
        console.log('Loading project...');
        // Implement project loading
    }
    
    undo() {
        console.log('Undo');
        // Implement undo system
    }
    
    redo() {
        console.log('Redo');
        // Implement redo system
    }
    
    hasUnsavedChanges() {
        // Check if project has unsaved changes
        return false; // Placeholder
    }
    
    // Status updates
    updateStatus(message) {
        const statusElement = document.getElementById('project-status');
        if (statusElement) {
            statusElement.textContent = message;
        }
    }
    
    updateAudioStatus() {
        const audioStatusElement = document.getElementById('audio-status');
        if (audioStatusElement && this.audioContext) {
            audioStatusElement.textContent = `Audio: ${this.audioContext.sampleRate / 1000}kHz, ${this.audioContext.state}`;
        }
    }
    
    // Public API
    getTrack(trackId) {
        return this.tracks.find(t => t.id === trackId);
    }
    
    getAllTracks() {
        return this.tracks;
    }
    
    getCurrentTime() {
        return this.currentTime;
    }
    
    // Menu Action Methods
    newProject() {
        if (confirm('Create new project? Unsaved changes will be lost.')) {
            this.tracks = [];
            this.mediaItems = [];
            this.currentTime = 0;
            this.isPlaying = false;
            this.transportControls.updateDisplay();
            console.log('New project created');
        }
    }
    
    openProject() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const project = JSON.parse(e.target.result);
                        console.log('Project loaded');
                    } catch (error) {
                        alert('Error loading project: ' + error.message);
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }
    
    saveProject() {
        const project = {
            tracks: this.tracks,
            mediaItems: this.mediaItems,
            tempo: this.tempo,
            currentTime: this.currentTime
        };
        
        const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'reaverse-project.json';
        a.click();
        URL.revokeObjectURL(url);
        console.log('Project saved');
    }
    
    saveProjectAs() { this.saveProject(); }
    importAudio() { 
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/*';
        input.multiple = true;
        input.onchange = (e) => {
            Array.from(e.target.files).forEach(file => {
                this.loadAudioFile(file);
            });
        };
        input.click();
    }
    exportAudio() { alert('Export audio functionality coming soon.'); }
    showRecentProjects() { alert('Recent projects functionality coming soon.'); }
    undo() { console.log('Undo action'); }
    redo() { console.log('Redo action'); }
    cut() { console.log('Cut action'); }
    copy() { console.log('Copy action'); }
    paste() { console.log('Paste action'); }
    selectAll() { console.log('Select all action'); }
    selectNone() { console.log('Select none action'); }
    toggleTrackManager() { console.log('Toggle track manager'); }
    toggleMixer() { 
        const mixer = document.getElementById('mixer-panel');
        if (mixer) mixer.style.display = mixer.style.display === 'none' ? 'flex' : 'none';
    }
    toggleNavigator() { console.log('Toggle navigator'); }
    zoomIn() { if (this.arrangeView) this.arrangeView.zoomIn(); }
    zoomOut() { if (this.arrangeView) this.arrangeView.zoomOut(); }
    zoomToFit() { if (this.arrangeView) this.arrangeView.zoomToFit(); }
    toggleGrid() { if (this.arrangeView) this.arrangeView.toggleGrid(); }
    addFolderTrack() { const track = this.addTrack(); track.type = 'folder'; }
    insertAudioItem() { this.importAudio(); }
    insertMIDIItem() { console.log('Insert MIDI item'); }
    insertMarker() { console.log('Insert marker'); }
    insertRegion() { console.log('Insert region'); }
    toggleRecordArm() { console.log('Toggle record arm'); }
    toggleMute() { console.log('Toggle mute'); }
    toggleSolo() { console.log('Toggle solo'); }
    addFX() { console.log('Add FX'); }
    setTrackColor() { console.log('Set track color'); }
    setTrackIcon() { console.log('Set track icon'); }
    duplicateTrack() { console.log('Duplicate track'); }
    deleteTrack() { console.log('Delete track'); }
    splitAtCursor() { console.log('Split at cursor'); }
    glueItems() { console.log('Glue items'); }
    fadeIn() { console.log('Fade in'); }
    fadeOut() { console.log('Fade out'); }
    crossfade() { console.log('Crossfade'); }
    reverseItem() { console.log('Reverse item'); }
    normalizeItem() { console.log('Normalize item'); }
    previousTake() { console.log('Previous take'); }
    nextTake() { console.log('Next take'); }
    cropToActiveTake() { console.log('Crop to active take'); }
    deleteActiveTake() { console.log('Delete active take'); }
    showActionList() { console.log('Show action list'); }
    record() { if (this.transportControls) this.transportControls.toggleRecord(); }
    play() { if (this.transportControls) this.transportControls.togglePlay(); }
    stop() { if (this.transportControls) this.transportControls.stop(); }
    showPreferences() { alert('Preferences coming soon.'); }
    showAudioDeviceSettings() { alert('Audio device settings coming soon.'); }
    showMIDIDeviceSettings() { alert('MIDI device settings coming soon.'); }
    showStartupAction() { alert('Startup action settings coming soon.'); }
    showReaScript() { alert('ReaScript editor coming soon.'); }
    showJSEffects() { alert('JS Effects browser coming soon.'); }
    showExtensionManager() { alert('Extension manager coming soon.'); }
    showQuickStart() { window.open('https://github.com/Guitar-Fan/AudioVerse', '_blank'); }
    showUserGuide() { alert('User guide coming soon.'); }
    showAbout() { alert('ReaVerse Web DAW v1.0\\nA professional web-based DAW inspired by REAPER.'); }
    
    getTempo() {
        return this.tempo;
    }
    
    setTempo(tempo) {
        this.tempo = tempo;
        this.transportControls.updateTempoDisplay();
    }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded, initializing REAPER Web DAW...');
    
    // Create global app instance
    window.reaperApp = new ReaperWebApp();
    
    // Initialize the application
    await window.reaperApp.initialize();
});