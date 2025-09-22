/*
 * REAPER Web - Post-WASM JavaScript
 * JavaScript code executed after WASM module initialization
 */

// Wrap WASM functions for easier JavaScript access
if (typeof Module !== 'undefined') {
    
    // Create high-level JavaScript API
    Module.ReaperWebAPI = {
        // Engine lifecycle
        createEngine: function() {
            return Module._reaper_engine_create();
        },
        
        destroyEngine: function() {
            return Module._reaper_engine_destroy();
        },
        
        initializeEngine: function(sampleRate, bufferSize, channels) {
            return Module._reaper_engine_initialize(sampleRate || 44100, bufferSize || 512, channels || 2);
        },
        
        // Transport controls
        play: function() {
            return Module._reaper_engine_play();
        },
        
        stop: function() {
            return Module._reaper_engine_stop();
        },
        
        pause: function() {
            return Module._reaper_engine_pause();
        },
        
        record: function() {
            return Module._reaper_engine_record();
        },
        
        // Position and tempo
        setPosition: function(seconds) {
            return Module._reaper_engine_set_position(seconds);
        },
        
        getPosition: function() {
            return Module._reaper_engine_get_position();
        },
        
        setTempo: function(bpm) {
            return Module._reaper_engine_set_tempo(bpm);
        },
        
        getTempo: function() {
            return Module._reaper_engine_get_tempo();
        },
        
        // Master controls
        setMasterVolume: function(volume) {
            return Module._reaper_engine_set_master_volume(volume);
        },
        
        setMasterPan: function(pan) {
            return Module._reaper_engine_set_master_pan(pan);
        },
        
        toggleMasterMute: function() {
            return Module._reaper_engine_toggle_master_mute();
        },
        
        // Track management
        createTrack: function() {
            return Module._track_manager_create_track();
        },
        
        deleteTrack: function(trackId) {
            return Module._track_manager_delete_track(trackId);
        },
        
        getTrackCount: function() {
            return Module._track_manager_get_track_count();
        },
        
        setTrackVolume: function(trackId, volume) {
            return Module._track_manager_set_track_volume(trackId, volume);
        },
        
        setTrackPan: function(trackId, pan) {
            return Module._track_manager_set_track_pan(trackId, pan);
        },
        
        setTrackMute: function(trackId, mute) {
            return Module._track_manager_set_track_mute(trackId, mute ? 1 : 0);
        },
        
        setTrackSolo: function(trackId, solo) {
            return Module._track_manager_set_track_solo(trackId, solo ? 1 : 0);
        },
        
        setTrackRecordArm: function(trackId, arm) {
            return Module._track_manager_set_track_record_arm(trackId, arm ? 1 : 0);
        },
        
        // Project management
        newProject: function() {
            return Module._project_manager_new_project();
        },
        
        loadProject: function(data) {
            // Implementation would involve file system operations
            console.log('REAPER Web: Load project functionality available');
            return Module._project_manager_load_project();
        },
        
        saveProject: function() {
            // Implementation would involve file system operations
            console.log('REAPER Web: Save project functionality available');
            return Module._project_manager_save_project();
        },
        
        // Audio processing
        processAudio: function(inputPtr, outputPtr, numSamples, numChannels) {
            return Module._reaper_engine_process_audio(inputPtr, outputPtr, numSamples, numChannels);
        },
        
        // Configuration
        setSampleRate: function(sampleRate) {
            return Module._reaper_engine_set_sample_rate(sampleRate);
        },
        
        setBufferSize: function(bufferSize) {
            return Module._reaper_engine_set_buffer_size(bufferSize);
        }
    };
    
    // Performance monitoring
    if (typeof ReaperWebConfig !== 'undefined' && ReaperWebConfig.performanceStart) {
        var loadTime = performance.now() - ReaperWebConfig.performanceStart;
        console.log(`REAPER Web: Module loaded in ${loadTime.toFixed(2)}ms`);
    }
    
    // Set up error handling
    Module.ReaperWebAPI.onError = function(callback) {
        Module.printErr = function(text) {
            console.error('REAPER WASM Error:', text);
            if (callback) callback(text);
        };
    };
    
    // Memory utilities
    Module.ReaperWebAPI.memory = {
        allocFloat32Array: function(size) {
            var ptr = Module._malloc(size * 4);
            return {
                ptr: ptr,
                array: new Float32Array(Module.HEAPF32.buffer, ptr, size),
                free: function() { Module._free(ptr); }
            };
        },
        
        allocInt32Array: function(size) {
            var ptr = Module._malloc(size * 4);
            return {
                ptr: ptr,
                array: new Int32Array(Module.HEAP32.buffer, ptr, size),
                free: function() { Module._free(ptr); }
            };
        }
    };
    
    console.log('REAPER Web: JavaScript API ready');
    
    // Signal readiness to any waiting code
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('reaperWebReady', { detail: Module }));
    }
}

// Export for Node.js if applicable
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Module;
}