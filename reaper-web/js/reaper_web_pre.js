/*
 * REAPER Web - Pre-WASM JavaScript
 * JavaScript code executed before WASM module initialization
 */

// Global configuration for REAPER Web module
var ReaperWebConfig = {
    // Audio settings
    audioContextOptions: {
        latencyHint: 'interactive',
        sampleRate: 44100
    },
    
    // Threading configuration
    useThreads: typeof SharedArrayBuffer !== 'undefined',
    
    // Memory configuration
    initialMemory: 64 * 1024 * 1024, // 64MB
    
    // Debug settings
    debugMode: false,
    logLevel: 'info'
};

// Set up module configuration
var Module = {
    // Pre-run setup
    preRun: [function() {
        console.log('REAPER Web: Initializing WASM module...');
        
        // Set up file system if needed
        if (typeof FS !== 'undefined') {
            try {
                FS.mkdir('/projects');
                FS.mkdir('/audio');
                FS.mkdir('/temp');
                console.log('REAPER Web: File system initialized');
            } catch (e) {
                console.warn('REAPER Web: File system setup failed:', e);
            }
        }
    }],
    
    // Post-run setup
    postRun: [function() {
        console.log('REAPER Web: WASM module ready');
        
        // Initialize audio engine
        if (typeof Module._reaper_engine_create === 'function') {
            var result = Module._reaper_engine_create();
            if (result) {
                console.log('REAPER Web: Engine created successfully');
                
                // Initialize with default settings
                Module._reaper_engine_initialize(
                    ReaperWebConfig.audioContextOptions.sampleRate,
                    512, // buffer size
                    2    // channels
                );
                
                // Signal that module is ready
                if (typeof window !== 'undefined' && window.reaperApp) {
                    window.reaperApp.onWASMReady(Module);
                }
            } else {
                console.error('REAPER Web: Failed to create engine');
            }
        }
    }],
    
    // Print and error handling
    print: function(text) {
        if (ReaperWebConfig.debugMode) {
            console.log('REAPER WASM:', text);
        }
    },
    
    printErr: function(text) {
        console.error('REAPER WASM Error:', text);
    },
    
    // Canvas and graphics (not needed for audio-only)
    canvas: null,
    
    // Memory growth
    allowMemoryGrowth: true,
    
    // Threading
    pthreadPoolSize: ReaperWebConfig.useThreads ? 4 : 0,
    
    // Quit handling
    quit: function(status, toThrow) {
        console.log('REAPER Web: Module quit with status', status);
        if (toThrow) {
            throw toThrow;
        }
    }
};

// Audio worklet support check
if (typeof window !== 'undefined' && window.AudioContext) {
    ReaperWebConfig.audioWorkletSupported = 'audioWorklet' in AudioContext.prototype;
    console.log('REAPER Web: Audio Worklet support:', ReaperWebConfig.audioWorkletSupported);
}

// SharedArrayBuffer support check
ReaperWebConfig.sharedArrayBufferSupported = typeof SharedArrayBuffer !== 'undefined';
console.log('REAPER Web: SharedArrayBuffer support:', ReaperWebConfig.sharedArrayBufferSupported);

// Performance monitoring
if (typeof performance !== 'undefined') {
    ReaperWebConfig.performanceStart = performance.now();
}