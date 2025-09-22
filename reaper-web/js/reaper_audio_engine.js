/**
 * REAPER Web - Audio Engine JavaScript Interface
 * Web Audio API integration with low-latency AudioWorklet processing
 * Based on REAPER's real-time audio architecture
 */

class ReaperAudioEngine {
    constructor() {
        this.audioContext = null;
        this.audioWorkletNode = null;
        this.isInitialized = false;
        this.isPlaying = false;
        this.sampleRate = 48000;
        this.bufferSize = 512;
        this.inputDevices = [];
        this.outputDevices = [];
        this.selectedInputDevice = null;
        this.selectedOutputDevice = null;
        
        // Performance monitoring
        this.cpuUsage = 0;
        this.latency = 0;
        this.dropouts = 0;
        
        // Audio settings from REAPER analysis
        this.lowLatencyMode = true;
        this.enableInputMonitoring = true;
        this.maxChannels = 8; // Start with 8 channels, expandable
        
        // Callbacks
        this.onAudioProcess = null;
        this.onDeviceChange = null;
        this.onLatencyChange = null;
    }

    /**
     * Initialize the audio engine with REAPER-style settings
     */
    async initialize(options = {}) {
        try {
            // Audio context configuration for low latency
            const audioContextOptions = {
                sampleRate: options.sampleRate || this.sampleRate,
                latencyHint: this.lowLatencyMode ? 'interactive' : 'balanced'
            };

            this.audioContext = new (window.AudioContext || window.webkitAudioContext)(audioContextOptions);
            this.sampleRate = this.audioContext.sampleRate;
            
            // Request microphone access for input monitoring
            if (this.enableInputMonitoring) {
                try {
                    await navigator.mediaDevices.getUserMedia({ 
                        audio: {
                            sampleRate: this.sampleRate,
                            channelCount: 2,
                            echoCancellation: false,
                            noiseSuppression: false,
                            autoGainControl: false
                        } 
                    });
                } catch (e) {
                    console.warn('Microphone access denied, input monitoring disabled');
                    this.enableInputMonitoring = false;
                }
            }

            // Load and register AudioWorklet processor
            await this.loadAudioWorklet();
            
            // Enumerate audio devices
            await this.enumerateDevices();
            
            this.isInitialized = true;
            console.log(`REAPER Audio Engine initialized at ${this.sampleRate}Hz`);
            
            return true;
        } catch (error) {
            console.error('Failed to initialize audio engine:', error);
            return false;
        }
    }

    /**
     * Load the AudioWorklet processor for real-time audio
     */
    async loadAudioWorklet() {
        if (!this.audioContext.audioWorklet) {
            throw new Error('AudioWorklet not supported in this browser');
        }

        // Register the REAPER audio processor
        await this.audioContext.audioWorklet.addModule('/js/reaper-audio-processor.js');
        
        // Create AudioWorklet node with REAPER-style configuration
        this.audioWorkletNode = new AudioWorkletNode(this.audioContext, 'reaper-audio-processor', {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            channelCount: this.maxChannels,
            channelCountMode: 'explicit',
            channelInterpretation: 'discrete',
            processorOptions: {
                bufferSize: this.bufferSize,
                sampleRate: this.sampleRate,
                maxChannels: this.maxChannels
            }
        });

        // Connect to destination for monitoring
        this.audioWorkletNode.connect(this.audioContext.destination);

        // Handle messages from AudioWorklet
        this.audioWorkletNode.port.onmessage = (event) => {
            this.handleAudioWorkletMessage(event.data);
        };

        // Setup input if available
        if (this.enableInputMonitoring) {
            await this.setupAudioInput();
        }
    }

    /**
     * Setup audio input with REAPER-style low-latency configuration
     */
    async setupAudioInput() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: this.sampleRate,
                    channelCount: 2,
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    latency: 0.01 // 10ms latency target
                }
            });

            const source = this.audioContext.createMediaStreamSource(stream);
            source.connect(this.audioWorkletNode);
            
            console.log('Audio input connected with low latency');
        } catch (error) {
            console.warn('Could not setup audio input:', error);
        }
    }

    /**
     * Enumerate available audio devices
     */
    async enumerateDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            
            this.inputDevices = devices.filter(device => device.kind === 'audioinput');
            this.outputDevices = devices.filter(device => device.kind === 'audiooutput');
            
            // Set default devices
            if (this.inputDevices.length > 0) {
                this.selectedInputDevice = this.inputDevices[0];
            }
            if (this.outputDevices.length > 0) {
                this.selectedOutputDevice = this.outputDevices[0];
            }
            
            if (this.onDeviceChange) {
                this.onDeviceChange(this.inputDevices, this.outputDevices);
            }
        } catch (error) {
            console.error('Error enumerating devices:', error);
        }
    }

    /**
     * Start audio playback - REAPER-style transport control
     */
    async startPlayback() {
        if (!this.isInitialized) {
            throw new Error('Audio engine not initialized');
        }

        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }

        this.isPlaying = true;
        
        // Notify AudioWorklet to start processing
        this.audioWorkletNode.port.postMessage({
            type: 'start',
            timestamp: this.audioContext.currentTime
        });

        console.log('Audio playback started');
    }

    /**
     * Stop audio playback
     */
    stopPlayback() {
        this.isPlaying = false;
        
        if (this.audioWorkletNode) {
            this.audioWorkletNode.port.postMessage({
                type: 'stop',
                timestamp: this.audioContext.currentTime
            });
        }

        console.log('Audio playback stopped');
    }

    /**
     * Set buffer size for latency control
     */
    setBufferSize(size) {
        if (!this.isInitialized) {
            this.bufferSize = size;
            return;
        }

        this.bufferSize = size;
        
        if (this.audioWorkletNode) {
            this.audioWorkletNode.port.postMessage({
                type: 'setBufferSize',
                bufferSize: size
            });
        }

        // Calculate and update latency
        this.latency = (size / this.sampleRate) * 1000; // milliseconds
        
        if (this.onLatencyChange) {
            this.onLatencyChange(this.latency);
        }
    }

    /**
     * Handle messages from AudioWorklet processor
     */
    handleAudioWorkletMessage(data) {
        switch (data.type) {
            case 'performance':
                this.cpuUsage = data.cpuUsage;
                this.dropouts = data.dropouts;
                break;
                
            case 'error':
                console.error('AudioWorklet error:', data.message);
                break;
                
            case 'latency':
                this.latency = data.latency;
                if (this.onLatencyChange) {
                    this.onLatencyChange(this.latency);
                }
                break;
        }
    }

    /**
     * Get current audio settings - REAPER-style information
     */
    getAudioSettings() {
        return {
            sampleRate: this.sampleRate,
            bufferSize: this.bufferSize,
            latency: this.latency,
            cpuUsage: this.cpuUsage,
            dropouts: this.dropouts,
            isPlaying: this.isPlaying,
            maxChannels: this.maxChannels,
            inputDevices: this.inputDevices,
            outputDevices: this.outputDevices,
            selectedInputDevice: this.selectedInputDevice,
            selectedOutputDevice: this.selectedOutputDevice
        };
    }

    /**
     * Set audio device (input or output)
     */
    async setAudioDevice(deviceId, type = 'input') {
        try {
            if (type === 'input') {
                const device = this.inputDevices.find(d => d.deviceId === deviceId);
                if (device) {
                    this.selectedInputDevice = device;
                    // Reconnect with new device
                    await this.setupAudioInput();
                }
            } else if (type === 'output') {
                const device = this.outputDevices.find(d => d.deviceId === deviceId);
                if (device) {
                    this.selectedOutputDevice = device;
                    // Note: Changing output device requires AudioContext recreation in most browsers
                    console.warn('Output device change may require audio engine restart');
                }
            }
        } catch (error) {
            console.error(`Error setting ${type} device:`, error);
        }
    }

    /**
     * Enable/disable low latency mode
     */
    setLowLatencyMode(enabled) {
        this.lowLatencyMode = enabled;
        
        if (this.audioWorkletNode) {
            this.audioWorkletNode.port.postMessage({
                type: 'setLowLatencyMode',
                enabled: enabled
            });
        }
    }

    /**
     * Process WASM audio callback
     */
    processWASMAudio(inputBuffer, outputBuffer, numChannels, numSamples) {
        if (this.onAudioProcess) {
            this.onAudioProcess(inputBuffer, outputBuffer, numChannels, numSamples);
        }
    }

    /**
     * Shutdown audio engine
     */
    async shutdown() {
        this.stopPlayback();
        
        if (this.audioWorkletNode) {
            this.audioWorkletNode.disconnect();
            this.audioWorkletNode = null;
        }
        
        if (this.audioContext) {
            await this.audioContext.close();
            this.audioContext = null;
        }
        
        this.isInitialized = false;
        console.log('Audio engine shutdown complete');
    }

    /**
     * Check browser compatibility for REAPER Web features
     */
    static checkCompatibility() {
        const results = {
            audioContext: !!(window.AudioContext || window.webkitAudioContext),
            audioWorklet: !!(window.AudioContext && AudioContext.prototype.audioWorklet),
            sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
            webAssembly: typeof WebAssembly !== 'undefined',
            mediaDevices: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
            highResolutionTime: !!(performance && performance.now),
            messageChannel: typeof MessageChannel !== 'undefined'
        };

        results.compatible = Object.values(results).every(Boolean);
        
        if (!results.compatible) {
            console.warn('REAPER Web compatibility issues detected:', results);
        }
        
        return results;
    }
}

// Export for use in REAPER Web DAW
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReaperAudioEngine;
} else {
    window.ReaperAudioEngine = ReaperAudioEngine;
}