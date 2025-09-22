/**
 * REAPER Web - AudioWorklet Processor
 * Real-time audio processing in dedicated thread
 * Based on REAPER's low-latency audio architecture
 */

class ReaperAudioProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();
        
        // Initialize processor state
        this.bufferSize = options.processorOptions?.bufferSize || 512;
        this.sampleRate = options.processorOptions?.sampleRate || 48000;
        this.maxChannels = options.processorOptions?.maxChannels || 8;
        
        // REAPER-style audio processing state
        this.isPlaying = false;
        this.currentFrame = 0;
        this.processedSamples = 0;
        
        // Performance monitoring
        this.lastCpuCheck = 0;
        this.processingTimeAccumulator = 0;
        this.processCallCount = 0;
        this.dropoutCount = 0;
        
        // Audio buffers for WASM interface
        this.inputBufferFlat = new Float32Array(this.maxChannels * this.bufferSize);
        this.outputBufferFlat = new Float32Array(this.maxChannels * this.bufferSize);
        
        // Internal processing buffers
        this.internalInputBuffer = [];
        this.internalOutputBuffer = [];
        for (let ch = 0; ch < this.maxChannels; ch++) {
            this.internalInputBuffer[ch] = new Float32Array(this.bufferSize);
            this.internalOutputBuffer[ch] = new Float32Array(this.bufferSize);
        }
        
        // REAPER-style zero-latency processing
        this.lowLatencyMode = true;
        this.adaptiveBuffering = true;
        
        // Message handling from main thread
        this.port.onmessage = (event) => {
            this.handleMessage(event.data);
        };
        
        console.log(`REAPER AudioProcessor initialized: ${this.sampleRate}Hz, ${this.bufferSize} samples`);
    }

    /**
     * Handle messages from main thread
     */
    handleMessage(data) {
        switch (data.type) {
            case 'start':
                this.isPlaying = true;
                this.currentFrame = 0;
                console.log('AudioProcessor: Starting playback');
                break;
                
            case 'stop':
                this.isPlaying = false;
                console.log('AudioProcessor: Stopping playback');
                break;
                
            case 'setBufferSize':
                this.setBufferSize(data.bufferSize);
                break;
                
            case 'setLowLatencyMode':
                this.lowLatencyMode = data.enabled;
                break;
                
            case 'wasmReady':
                this.wasmModule = data.module;
                console.log('AudioProcessor: WASM module ready');
                break;
        }
    }

    /**
     * Set buffer size and reallocate buffers
     */
    setBufferSize(newSize) {
        this.bufferSize = newSize;
        
        // Reallocate flat buffers
        this.inputBufferFlat = new Float32Array(this.maxChannels * this.bufferSize);
        this.outputBufferFlat = new Float32Array(this.maxChannels * this.bufferSize);
        
        // Reallocate internal buffers
        for (let ch = 0; ch < this.maxChannels; ch++) {
            this.internalInputBuffer[ch] = new Float32Array(this.bufferSize);
            this.internalOutputBuffer[ch] = new Float32Array(this.bufferSize);
        }
        
        console.log(`AudioProcessor: Buffer size changed to ${this.bufferSize}`);
    }

    /**
     * Main audio processing function - called for each audio block
     * This is the real-time critical path
     */
    process(inputs, outputs, parameters) {
        const startTime = performance.now();
        
        const input = inputs[0];
        const output = outputs[0];
        const numChannels = Math.min(output.length, this.maxChannels);
        const numSamples = output[0] ? output[0].length : 128;
        
        // Safety check for buffer consistency
        if (numSamples !== 128 && numSamples !== 256 && numSamples !== 512) {
            // Handle non-standard buffer sizes
            console.warn(`AudioProcessor: Unusual buffer size ${numSamples}`);
        }
        
        try {
            if (this.isPlaying) {
                // Copy input to internal buffers and prepare for WASM
                this.prepareInputBuffers(input, numChannels, numSamples);
                
                // Process through REAPER engine (when WASM is available)
                if (this.wasmModule && typeof this.wasmModule._reaper_engine_process_audio === 'function') {
                    // Call WASM audio processing function
                    this.wasmModule._reaper_engine_process_audio(
                        this.inputBufferFlat.byteOffset,
                        this.outputBufferFlat.byteOffset,
                        numChannels,
                        numSamples
                    );
                    
                    // Copy processed audio to output
                    this.copyToOutputBuffers(output, numChannels, numSamples);
                } else {
                    // Fallback: passthrough audio when WASM not ready
                    this.passthroughAudio(input, output, numChannels, numSamples);
                }
                
                this.currentFrame += numSamples;
                this.processedSamples += numSamples * numChannels;
            } else {
                // Output silence when not playing
                this.outputSilence(output, numChannels, numSamples);
            }
            
            // Performance monitoring
            const processingTime = performance.now() - startTime;
            this.updatePerformanceStats(processingTime);
            
        } catch (error) {
            console.error('AudioProcessor error:', error);
            this.dropoutCount++;
            
            // Output silence on error to prevent audio artifacts
            this.outputSilence(output, numChannels, numSamples);
            
            // Report error to main thread
            this.port.postMessage({
                type: 'error',
                message: error.message
            });
        }
        
        return true; // Keep processor alive
    }

    /**
     * Prepare input buffers for WASM processing
     */
    prepareInputBuffers(input, numChannels, numSamples) {
        // Clear input buffer
        this.inputBufferFlat.fill(0);
        
        // Copy input channels to flat buffer (interleaved)
        for (let ch = 0; ch < numChannels && ch < input.length; ch++) {
            const channelData = input[ch];
            if (channelData) {
                for (let i = 0; i < numSamples; i++) {
                    this.inputBufferFlat[ch * numSamples + i] = channelData[i];
                }
            }
        }
    }

    /**
     * Copy processed audio from WASM to output buffers
     */
    copyToOutputBuffers(output, numChannels, numSamples) {
        // Copy from flat buffer to output channels
        for (let ch = 0; ch < numChannels && ch < output.length; ch++) {
            const channelData = output[ch];
            if (channelData) {
                for (let i = 0; i < numSamples; i++) {
                    channelData[i] = this.outputBufferFlat[ch * numSamples + i];
                }
            }
        }
    }

    /**
     * Passthrough audio when WASM is not ready
     */
    passthroughAudio(input, output, numChannels, numSamples) {
        for (let ch = 0; ch < numChannels; ch++) {
            if (input[ch] && output[ch]) {
                output[ch].set(input[ch]);
            } else if (output[ch]) {
                output[ch].fill(0);
            }
        }
    }

    /**
     * Output silence to all channels
     */
    outputSilence(output, numChannels, numSamples) {
        for (let ch = 0; ch < numChannels && ch < output.length; ch++) {
            if (output[ch]) {
                output[ch].fill(0);
            }
        }
    }

    /**
     * Update performance statistics
     */
    updatePerformanceStats(processingTime) {
        this.processingTimeAccumulator += processingTime;
        this.processCallCount++;
        
        // Report stats every second
        const now = performance.now();
        if (now - this.lastCpuCheck > 1000) {
            const avgProcessingTime = this.processingTimeAccumulator / this.processCallCount;
            const blockTime = (128 / this.sampleRate) * 1000; // 128 samples in milliseconds
            const cpuUsage = (avgProcessingTime / blockTime) * 100;
            
            this.port.postMessage({
                type: 'performance',
                cpuUsage: Math.min(cpuUsage, 100),
                dropouts: this.dropoutCount,
                processedSamples: this.processedSamples,
                avgProcessingTime: avgProcessingTime
            });
            
            // Reset counters
            this.processingTimeAccumulator = 0;
            this.processCallCount = 0;
            this.lastCpuCheck = now;
        }
    }

    /**
     * Handle processor destruction
     */
    static get parameterDescriptors() {
        return [];
    }
}

// Register the processor
registerProcessor('reaper-audio-processor', ReaperAudioProcessor);