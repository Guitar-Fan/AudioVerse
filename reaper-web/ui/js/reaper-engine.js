/*
 * REAPER Web - Audio Engine Interface
 * Bridge between UI and WASM audio engine
 */

class ReaperAudioEngine {
    constructor() {
        this.audioContext = null;
        this.wasmModule = null;
        this.wasmEngine = null;
        this.audioWorkletNode = null;
        this.isInitialized = false;
        
        // Audio processing state
        this.sampleRate = 44100;
        this.bufferSize = 512;
        this.isProcessing = false;
        
        // Performance monitoring
        this.cpuUsage = 0;
        this.audioDropouts = 0;
        
        // Track management
        this.wasmTracks = new Map();
    }
    
    async initialize(audioContext) {
        try {
            this.audioContext = audioContext;
            this.sampleRate = audioContext.sampleRate;
            
            console.log('Initializing REAPER Audio Engine with WASM...');
            
            // Load WASM module
            await this.loadWASMModule();
            
            // Set up audio worklet with WASM integration
            await this.setupAudioWorklet();
            
            this.isInitialized = true;
            console.log('REAPER Audio Engine initialized successfully with WASM');
            
            return true;
        } catch (error) {
            console.warn('WASM audio engine failed, using JavaScript fallback:', error);
            this.isInitialized = true; // Still usable with JS fallback
            return false;
        }
    }
    
    async loadWASMModule() {
        try {
            console.log('Loading WASM module...');
            
            if (typeof ReaperEngineModule === 'undefined') {
                console.warn('ReaperEngineModule not found, falling back to JavaScript');
                this.wasmModule = null;
                return false;
            }
            
            // Initialize the WASM module
            this.wasmModule = await ReaperEngineModule();
            
            if (this.wasmModule) {
                console.log('WASM module loaded successfully');
                
                // Initialize the REAPER engine
                this.wasmModule.ccall('reaper_initialize', null, [], []);
                
                // Pass WASM module to audio processor if it exists
                if (this.audioNode) {
                    this.audioNode.port.postMessage({
                        type: 'wasm-module',
                        module: this.wasmModule
                    });
                }
                
                return true;
            } else {
                console.warn('Failed to load WASM module');
                return false;
            }
        } catch (error) {
            console.error('Error loading WASM module:', error);
            this.wasmModule = null;
            return false;
        }
    }
    
    async setupAudioGraph() {
        try {
            // Initialize Web Audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: this.sampleRate,
                latencyHint: 'interactive'
            });
            
            // Load audio worklet processor
            await this.audioContext.audioWorklet.addModule('./ui/js/reaper-audio-processor.js');
            
            // Create audio worklet node
            this.audioNode = new AudioWorkletNode(this.audioContext, 'reaper-audio-processor', {
                processorOptions: {
                    sampleRate: this.sampleRate,
                    bufferSize: this.bufferSize
                }
            });
            
            // Set up message handling
            this.audioNode.port.onmessage = this.handleAudioMessage.bind(this);
            
            // Connect to output
            this.audioNode.connect(this.audioContext.destination);
            
            // Pass WASM module to audio processor if available
            if (this.wasmModule) {
                this.audioNode.port.postMessage({
                    type: 'wasm-module',
                    module: this.wasmModule
                });
            }
            
            console.log('Audio graph initialized successfully');
            return true;
        } catch (error) {
            console.error('Failed to initialize audio graph:', error);
            return false;
        }
    }
    
    setupScriptProcessorFallback() {
        try {
            // Create ScriptProcessor as fallback
            this.scriptProcessor = this.audioContext.createScriptProcessor(this.bufferSize, 2, 2);
            
            this.scriptProcessor.onaudioprocess = (event) => {
                this.processAudioJS(event.inputBuffer, event.outputBuffer);
            };
            
            // Connect to destination
            this.scriptProcessor.connect(this.audioContext.destination);
            
            console.log('ScriptProcessor fallback initialized');
        } catch (error) {
            console.error('Audio processing setup completely failed:', error);
        }
    }
    
    handleWorkletMessage(data) {
        switch (data.type) {
            case 'cpu-usage':
                this.cpuUsage = data.value;
                break;
                
            case 'audio-dropout':
                this.audioDropouts++;
                console.warn('Audio dropout detected');
                break;
                
            case 'meter-data':
                // Update meter displays
                this.updateMeters(data.meters);
                break;
                
            default:
                console.log('Unknown worklet message:', data);
        }
    }
    
    startProcessing() {
        if (!this.isInitialized) {
            console.warn('Audio engine not initialized');
            return false;
        }
        
        if (this.wasmEngine) {
            this.wasmEngine.ccall('reaper_play', null, [], []);
        }
        
        if (this.audioWorkletNode) {
            this.audioWorkletNode.port.postMessage({ type: 'start' });
        }
        
        this.isProcessing = true;
        console.log('Audio processing started with WASM engine');
        return true;
    }
    
    stopProcessing() {
        if (this.wasmEngine) {
            this.wasmEngine.ccall('reaper_stop', null, [], []);
        }
        
        if (this.audioWorkletNode) {
            this.audioWorkletNode.port.postMessage({ type: 'stop' });
        }
        
        this.isProcessing = false;
        console.log('Audio processing stopped');
    }
    
    addTrack(trackConfig) {
        let wasmTrackId = -1;
        
        if (this.wasmEngine) {
            wasmTrackId = this.wasmEngine.ccall('reaper_create_track', 'number', [], []);
            
            // Set initial parameters
            if (trackConfig.volume !== undefined) {
                this.wasmEngine.ccall('reaper_set_track_volume', null, 
                    ['number', 'number'], [wasmTrackId, trackConfig.volume]);
            }
            
            if (trackConfig.pan !== undefined) {
                this.wasmEngine.ccall('reaper_set_track_pan', null, 
                    ['number', 'number'], [wasmTrackId, trackConfig.pan]);
            }
            
            if (trackConfig.mute !== undefined) {
                this.wasmEngine.ccall('reaper_set_track_muted', null, 
                    ['number', 'number'], [wasmTrackId, trackConfig.mute ? 1 : 0]);
            }
            
            // Store mapping between UI track ID and WASM track ID
            this.wasmTracks.set(trackConfig.id, wasmTrackId);
        }
        
        if (this.audioWorkletNode) {
            this.audioWorkletNode.port.postMessage({
                type: 'add-track',
                track: { ...trackConfig, wasmTrackId }
            });
        }
        
        console.log('Track added to WASM engine:', trackConfig.id, '→', wasmTrackId);
    }
    
    removeTrack(trackId) {
        const wasmTrackId = this.wasmTracks.get(trackId);
        
        if (this.wasmEngine && wasmTrackId !== undefined) {
            this.wasmEngine.ccall('reaper_delete_track', null, ['number'], [wasmTrackId]);
            this.wasmTracks.delete(trackId);
        }
        
        if (this.audioWorkletNode) {
            this.audioWorkletNode.port.postMessage({
                type: 'remove-track',
                trackId: trackId
            });
        }
        
        console.log('Track removed from WASM engine:', trackId);
    }
    
    updateTrackParameter(trackId, parameter, value) {
        const wasmTrackId = this.wasmTracks.get(trackId);
        
        if (this.wasmEngine && wasmTrackId !== undefined) {
            switch (parameter) {
                case 'volume':
                    this.wasmEngine.ccall('reaper_set_track_volume', null, 
                        ['number', 'number'], [wasmTrackId, value]);
                    break;
                case 'pan':
                    this.wasmEngine.ccall('reaper_set_track_pan', null, 
                        ['number', 'number'], [wasmTrackId, value]);
                    break;
                case 'mute':
                    this.wasmEngine.ccall('reaper_set_track_muted', null, 
                        ['number', 'number'], [wasmTrackId, value ? 1 : 0]);
                    break;
                case 'solo':
                    this.wasmEngine.ccall('reaper_set_track_soloed', null, 
                        ['number', 'number'], [wasmTrackId, value ? 1 : 0]);
                    break;
                case 'recordArm':
                    this.wasmEngine.ccall('reaper_set_track_record_armed', null, 
                        ['number', 'number'], [wasmTrackId, value ? 1 : 0]);
                    break;
            }
        }
        
        if (this.audioWorkletNode) {
            this.audioWorkletNode.port.postMessage({
                type: 'update-track-parameter',
                trackId: trackId,
                parameter: parameter,
                value: value
            });
        }
    }
    
    // Transport controls using WASM
    play() {
        if (this.wasmEngine) {
            this.wasmEngine.ccall('reaper_play', null, [], []);
        }
        this.isProcessing = true;
    }
    
    stop() {
        if (this.wasmEngine) {
            this.wasmEngine.ccall('reaper_stop', null, [], []);
        }
        this.isProcessing = false;
    }
    
    pause() {
        if (this.wasmEngine) {
            this.wasmEngine.ccall('reaper_pause', null, [], []);
        }
        this.isProcessing = false;
    }
    
    record() {
        if (this.wasmEngine) {
            this.wasmEngine.ccall('reaper_record', null, [], []);
        }
        this.isProcessing = true;
    }
    
    isPlaying() {
        if (this.wasmEngine) {
            return this.wasmEngine.ccall('reaper_is_playing', 'number', [], []) !== 0;
        }
        return this.isProcessing;
    }
    
    isRecording() {
        if (this.wasmEngine) {
            return this.wasmEngine.ccall('reaper_is_recording', 'number', [], []) !== 0;
        }
        return false;
    }
    
    setPlaybackPosition(timeInSeconds) {
        if (this.wasmEngine) {
            this.wasmEngine.ccall('reaper_set_position', null, ['number'], [timeInSeconds]);
        }
        
        if (this.audioWorkletNode) {
            this.audioWorkletNode.port.postMessage({
                type: 'set-position',
                position: timeInSeconds
            });
        }
    }
    
    getPlaybackPosition() {
        if (this.wasmEngine) {
            return this.wasmEngine.ccall('reaper_get_position', 'number', [], []);
        }
        return 0.0;
    }
    
    setTempo(tempo) {
        if (this.wasmEngine) {
            this.wasmEngine.ccall('reaper_set_tempo', null, ['number'], [tempo]);
        }
        
        if (this.audioWorkletNode) {
            this.audioWorkletNode.port.postMessage({
                type: 'set-tempo',
                tempo: tempo
            });
        }
    }
    
    getTempo() {
        if (this.wasmEngine) {
            return this.wasmEngine.ccall('reaper_get_tempo', 'number', [], []);
        }
        return 120.0;
    }
    
    addEffect(trackId, effectConfig) {
        if (this.audioWorkletNode) {
            this.audioWorkletNode.port.postMessage({
                type: 'add-effect',
                trackId: trackId,
                effect: effectConfig
            });
        }
        
        console.log('Effect added to track:', trackId, effectConfig.name);
    }
    
    removeEffect(trackId, effectId) {
        if (this.audioWorkletNode) {
            this.audioWorkletNode.port.postMessage({
                type: 'remove-effect',
                trackId: trackId,
                effectId: effectId
            });
        }
        
        console.log('Effect removed from track:', trackId, effectId);
    }
    
    loadMediaItem(mediaItemConfig) {
        if (this.audioWorkletNode) {
            this.audioWorkletNode.port.postMessage({
                type: 'load-media-item',
                mediaItem: mediaItemConfig
            });
        }
        
        console.log('Media item loaded:', mediaItemConfig.id);
    }
    
    setPlaybackPosition(timeInSeconds) {
        if (this.audioWorkletNode) {
            this.audioWorkletNode.port.postMessage({
                type: 'set-position',
                position: timeInSeconds
            });
        }
    }
    
    setTempo(tempo) {
        if (this.audioWorkletNode) {
            this.audioWorkletNode.port.postMessage({
                type: 'set-tempo',
                tempo: tempo
            });
        }
    }
    
    updateMeters(meterData) {
        // Update UI meter displays
        for (const [trackId, levels] of Object.entries(meterData)) {
            // Update track controls meters
            window.reaperApp?.trackControls?.updateMeters(trackId, levels.left, levels.right);
            
            // Update mixer meters
            window.reaperApp?.mixerView?.updateMeters(trackId, levels.left, levels.right);
        }
    }
    
    // JavaScript fallback audio processing
    processAudioJS(inputBuffer, outputBuffer) {
        // Simple passthrough for now
        // This would be replaced with actual audio processing logic
        const inputLeft = inputBuffer.getChannelData(0);
        const inputRight = inputBuffer.getChannelData(1);
        const outputLeft = outputBuffer.getChannelData(0);
        const outputRight = outputBuffer.getChannelData(1);
        
        for (let i = 0; i < inputBuffer.length; i++) {
            outputLeft[i] = inputLeft[i];
            outputRight[i] = inputRight[i];
        }
    }
    
    getPerformanceStats() {
        return {
            cpuUsage: this.cpuUsage,
            audioDropouts: this.audioDropouts,
            sampleRate: this.sampleRate,
            bufferSize: this.bufferSize,
            isProcessing: this.isProcessing
        };
    }
    
    // Effect presets management
    getAvailableEffects() {
        // Return list of available effects from JSFX system
        return [
            { id: 'simple-gain', name: 'Simple Gain', category: 'utility' },
            { id: 'resonant-lowpass', name: 'Resonant Lowpass', category: 'filter' },
            { id: 'simple-compressor', name: 'Simple Compressor', category: 'dynamics' },
            { id: 'simple-delay', name: 'Simple Delay', category: 'time' },
            { id: 'high-pass', name: 'High Pass Filter', category: 'filter' },
            { id: 'dc-remove', name: 'DC Remove', category: 'utility' }
        ];
    }
    
    createEffect(effectId, parameters = {}) {
        // Create effect instance
        const effectConfig = {
            id: this.generateId(),
            type: effectId,
            parameters: parameters,
            bypass: false
        };
        
        return effectConfig;
    }
    
    generateId() {
        return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Audio file loading
    async loadAudioFile(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            const mediaItem = {
                id: this.generateId(),
                name: file.name,
                buffer: audioBuffer,
                duration: audioBuffer.duration,
                channels: audioBuffer.numberOfChannels,
                sampleRate: audioBuffer.sampleRate
            };
            
            console.log('Audio file loaded:', mediaItem);
            return mediaItem;
        } catch (error) {
            console.error('Failed to load audio file:', error);
            throw error;
        }
    }
    
    // Recording functionality
    async startRecording(trackId) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Set up MediaRecorder or direct audio processing
            console.log('Recording started for track:', trackId);
            
            return { success: true, stream };
        } catch (error) {
            console.error('Failed to start recording:', error);
            return { success: false, error };
        }
    }
    
    stopRecording() {
        console.log('Recording stopped');
        // Implementation for stopping recording
    }
}