/*
 * REAPER Web - Audio Engine Interface
 * Bridge between UI and WASM audio engine
 */

class ReaperAudioEngine {
    constructor() {
        this.audioContext = null;
        this.wasmModule = null;
        this.audioWorkletNode = null;
        this.isInitialized = false;
        
        // Audio processing state
        this.sampleRate = 44100;
        this.bufferSize = 512;
        this.isProcessing = false;
        
        // Performance monitoring
        this.cpuUsage = 0;
        this.audioDropouts = 0;
    }
    
    async initialize(audioContext) {
        try {
            this.audioContext = audioContext;
            this.sampleRate = audioContext.sampleRate;
            
            console.log('Initializing REAPER Audio Engine...');
            
            // Try to load WASM module
            await this.loadWASMModule();
            
            // Set up audio worklet if available
            await this.setupAudioWorklet();
            
            this.isInitialized = true;
            console.log('REAPER Audio Engine initialized successfully');
            
            return true;
        } catch (error) {
            console.warn('WASM audio engine not available, using JavaScript fallback:', error);
            this.isInitialized = true; // Still usable with JS fallback
            return false;
        }
    }
    
    async loadWASMModule() {
        console.log('ReaperAudioEngine: Loading WASM module...');
        
        // Try to load the compiled REAPER engine WASM module
        if (typeof ReaperWebModule !== 'undefined') {
            try {
                console.log('ReaperWebModule found, initializing...');
                this.wasmModule = await ReaperWebModule();
                console.log('WASM module loaded successfully');
                
                // Check for API
                if (this.wasmModule.ReaperWebAPI) {
                    console.log('ReaperWebAPI found!');
                    const result = this.wasmModule.ReaperWebAPI.createEngine();
                    if (result) {
                        console.log('C++ REAPER engine created via API');
                        this.wasmModule.ReaperWebAPI.initializeEngine(this.sampleRate, this.bufferSize, 2);
                        return;
                    }
                }
                
                // Check raw functions
                if (this.wasmModule._reaper_engine_create) {
                    console.log('Raw WASM functions found');
                    if (this.wasmModule._reaper_engine_create()) {
                        console.log('C++ REAPER engine created via raw functions');
                        this.wasmModule._reaper_engine_initialize(this.sampleRate, this.bufferSize, 2);
                        return;
                    }
                }
            } catch (error) {
                console.warn('WASM module loading failed:', error);
            }
        }
        
        // Fallback: check for global Module
        if (typeof Module !== 'undefined') {
            this.wasmModule = Module;
            console.log('Global WASM module loaded');
        } else {
            console.warn('No WASM module available, using JavaScript fallback');
        }
    }
    
    async setupAudioWorklet() {
        try {
            // Try to register audio worklet processor with absolute path
            const workletPath = window.location.origin + window.location.pathname.replace('ReaVerse.html', '') + 'js/reaper-audio-processor.js';
            console.log('Loading audio worklet from:', workletPath);
            
            await this.audioContext.audioWorklet.addModule(workletPath);
            
            // Create worklet node
            this.audioWorkletNode = new AudioWorkletNode(
                this.audioContext, 
                'reaper-audio-processor',
                {
                    numberOfInputs: 1,
                    numberOfOutputs: 1,
                    channelCount: 2,
                    processorOptions: {
                        sampleRate: this.sampleRate,
                        bufferSize: this.bufferSize
                    }
                }
            );
            
            // Connect to audio context destination
            this.audioWorkletNode.connect(this.audioContext.destination);
            
            // Set up message handling
            this.audioWorkletNode.port.onmessage = (event) => {
                this.handleWorkletMessage(event.data);
            };
            
            console.log('Audio worklet initialized successfully');
        } catch (error) {
            console.warn('Audio worklet setup failed, using ScriptProcessor fallback:', error);
            this.setupScriptProcessorFallback();
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
        
        if (this.audioWorkletNode) {
            this.audioWorkletNode.port.postMessage({ type: 'start' });
        }
        
        this.isProcessing = true;
        console.log('Audio processing started');
        return true;
    }
    
    stopProcessing() {
        if (this.audioWorkletNode) {
            this.audioWorkletNode.port.postMessage({ type: 'stop' });
        }
        
        this.isProcessing = false;
        console.log('Audio processing stopped');
    }
    
    addTrack(trackConfig) {
        if (this.audioWorkletNode) {
            this.audioWorkletNode.port.postMessage({
                type: 'add-track',
                track: trackConfig
            });
        }
        
        console.log('Track added to audio engine:', trackConfig.id);
    }
    
    removeTrack(trackId) {
        if (this.audioWorkletNode) {
            this.audioWorkletNode.port.postMessage({
                type: 'remove-track',
                trackId: trackId
            });
        }
        
        console.log('Track removed from audio engine:', trackId);
    }
    
    updateTrackParameter(trackId, parameter, value) {
        if (this.audioWorkletNode) {
            this.audioWorkletNode.port.postMessage({
                type: 'update-track-parameter',
                trackId: trackId,
                parameter: parameter,
                value: value
            });
        }
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
    
    // Transport Controls - WASM Integration
    play() {
        if (this.wasmModule && this.wasmModule.ReaperWebAPI && this.wasmModule.ReaperWebAPI.play) {
            this.wasmModule.ReaperWebAPI.play();
            console.log('WASM play command sent via API');
        } else if (this.wasmModule && this.wasmModule._reaper_engine_play) {
            this.wasmModule._reaper_engine_play();
            console.log('WASM play command sent via raw function');
        } else {
            console.log('JavaScript fallback play');
        }
        this.isPlaying = true;
        this.notifyStateChange('play');
    }

    pause() {
        if (this.wasmModule && this.wasmModule.ReaperWebAPI && this.wasmModule.ReaperWebAPI.pause) {
            this.wasmModule.ReaperWebAPI.pause();
            console.log('WASM pause command sent via API');
        } else if (this.wasmModule && this.wasmModule._reaper_engine_pause) {
            this.wasmModule._reaper_engine_pause();
            console.log('WASM pause command sent via raw function');
        } else {
            console.log('JavaScript fallback pause');
        }
        this.isPlaying = false;
        this.notifyStateChange('pause');
    }

    stop() {
        if (this.wasmModule && this.wasmModule.ReaperWebAPI && this.wasmModule.ReaperWebAPI.stop) {
            this.wasmModule.ReaperWebAPI.stop();
            console.log('WASM stop command sent via API');
        } else if (this.wasmModule && this.wasmModule._reaper_engine_stop) {
            this.wasmModule._reaper_engine_stop();
            console.log('WASM stop command sent via raw function');
        } else {
            console.log('JavaScript fallback stop');
        }
        this.isPlaying = false;
        this.notifyStateChange('stop');
    }

    record() {
        if (this.wasmModule && this.wasmModule.ReaperWebAPI && this.wasmModule.ReaperWebAPI.record) {
            this.wasmModule.ReaperWebAPI.record();
            console.log('WASM record command sent via API');
        } else if (this.wasmModule && this.wasmModule._reaper_engine_record) {
            this.wasmModule._reaper_engine_record();
            console.log('WASM record command sent via raw function');
        } else {
            console.log('JavaScript fallback record');
        }
        this.isRecording = true;
        this.notifyStateChange('record');
    }

    stopRecord() {
        if (this.wasmModule && this.wasmModule._reaper_engine_stop_record) {
            this.wasmModule._reaper_engine_stop_record();
            console.log('WASM stop record command sent');
        } else {
            console.log('JavaScript fallback stop record');
        }
        this.isRecording = false;
        this.notifyStateChange('stopRecord');
    }

    // Master controls
    setMasterVolume(volume) {
        if (this.wasmModule && this.wasmModule.ReaperWebAPI && this.wasmModule.ReaperWebAPI.setMasterVolume) {
            this.wasmModule.ReaperWebAPI.setMasterVolume(volume);
        } else if (this.wasmModule && this.wasmModule._reaper_engine_set_master_volume) {
            this.wasmModule._reaper_engine_set_master_volume(volume);
        }
        console.log('Master volume set to:', volume);
    }

    setTempo(bpm) {
        if (this.wasmModule && this.wasmModule.ReaperWebAPI && this.wasmModule.ReaperWebAPI.setTempo) {
            this.wasmModule.ReaperWebAPI.setTempo(bpm);
        } else if (this.wasmModule && this.wasmModule._reaper_engine_set_tempo) {
            this.wasmModule._reaper_engine_set_tempo(bpm);
        }
        console.log('Tempo set to:', bpm);
    }

    // Track controls
    addTrackToEngine(trackConfig) {
        if (this.wasmModule && this.wasmModule.ReaperWebAPI && this.wasmModule.ReaperWebAPI.createTrack) {
            const trackId = this.wasmModule.ReaperWebAPI.createTrack();
            if (this.wasmModule.ReaperWebAPI.setTrackVolume) {
                this.wasmModule.ReaperWebAPI.setTrackVolume(trackId, trackConfig.volume || 0.8);
            }
            return trackId;
        } else if (this.wasmModule && this.wasmModule._track_manager_create_track) {
            const trackId = this.wasmModule._track_manager_create_track();
            if (this.wasmModule._track_manager_set_track_volume) {
                this.wasmModule._track_manager_set_track_volume(trackId, trackConfig.volume || 0.8);
            }
            return trackId;
        }
        return -1; // Fallback
    }

    removeTrackFromEngine(trackId) {
        if (this.wasmModule && this.wasmModule.ReaperWebAPI && this.wasmModule.ReaperWebAPI.deleteTrack) {
            this.wasmModule.ReaperWebAPI.deleteTrack(trackId);
        } else if (this.wasmModule && this.wasmModule._track_manager_delete_track) {
            this.wasmModule._track_manager_delete_track(trackId);
        }
        console.log('Track removed:', trackId);
    }

    // Event notification
    notifyStateChange(action) {
        if (typeof window !== 'undefined' && window.reaperUI) {
            window.reaperUI.onEngineStateChange(action, {
                isPlaying: this.isPlaying,
                isRecording: this.isRecording
            });
        }
    }
}