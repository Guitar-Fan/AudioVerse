/*
 * REAPER Web - Audio Worklet Processor with WASM Integration
 * Real-time audio processing using C++ WASM engine
 */

class ReaperAudioProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();
        
        // Initialize processor state
        this.sampleRate = options.processorOptions?.sampleRate || 44100;
        this.bufferSize = options.processorOptions?.bufferSize || 512;
        
        // WASM integration
        this.wasmModule = null;
        this.wasmBuffers = {
            inputLeft: null,
            inputRight: null,
            outputLeft: null,
            outputRight: null
        };
        
        // Track management
        this.tracks = new Map();
        
        // Transport state
        this.isPlaying = false;
        this.currentPosition = 0; // in samples
        
        // Performance monitoring
        this.processTime = 0;
        this.maxProcessTime = 0;
        this.cpuThreshold = 0.8;
        
        // Set up message handling
        this.port.onmessage = this.handleMessage.bind(this);
        
        console.log('ReaperAudioProcessor initialized with WASM support');
    }
    
    handleMessage(event) {
        const { type, ...data } = event.data;
        
        switch (type) {
            case 'wasm-module':
                this.initializeWASM(data.module);
                break;
                
            case 'start':
                this.isPlaying = true;
                this.port.postMessage({ type: 'transport-started' });
                break;
                
            case 'stop':
                this.isPlaying = false;
                this.port.postMessage({ type: 'transport-stopped' });
                break;
                
            case 'set-position':
                this.currentPosition = data.position * this.sampleRate;
                break;
                
            case 'add-track':
                this.addTrack(data.track);
                break;
                
            case 'remove-track':
                this.removeTrack(data.trackId);
                break;
                
            case 'update-track-parameter':
                this.updateTrackParameter(data.trackId, data.parameter, data.value);
                break;
                
            default:
                console.log('Unknown message type:', type);
        }
    }
    
    initializeWASM(module) {
        this.wasmModule = module;
        
        if (this.wasmModule) {
            // Allocate WASM buffers for audio processing
            const bufferSizeBytes = this.bufferSize * 4; // 4 bytes per float
            
            this.wasmBuffers.inputLeft = this.wasmModule._malloc(bufferSizeBytes);
            this.wasmBuffers.inputRight = this.wasmModule._malloc(bufferSizeBytes);
            this.wasmBuffers.outputLeft = this.wasmModule._malloc(bufferSizeBytes);
            this.wasmBuffers.outputRight = this.wasmModule._malloc(bufferSizeBytes);
            
            console.log('WASM audio buffers allocated');
        }
    }
    
    process(inputs, outputs, parameters) {
        const startTime = performance.now();
        
        try {
            const output = outputs[0];
            const blockLength = output[0].length;
            
            // Clear output buffers
            for (let channel = 0; channel < output.length; channel++) {
                output[channel].fill(0);
            }
            
            if (this.isPlaying && this.wasmModule && this.wasmBuffers.inputLeft) {
                // Process audio through WASM engine
                this.processAudioWithWASM(inputs[0], output, blockLength);
                
                // Update playback position
                this.currentPosition += blockLength;
                
                // Send position updates periodically
                if (this.currentPosition % (this.sampleRate * 0.1) < blockLength) {
                    this.port.postMessage({
                        type: 'position-update',
                        position: this.currentPosition / this.sampleRate
                    });
                }
            } else if (this.isPlaying) {
                // Fallback JavaScript processing
                this.processAudioFallback(inputs[0], output, blockLength);
                this.currentPosition += blockLength;
            }
            
            // Monitor CPU usage
            this.processTime = performance.now() - startTime;
            this.maxProcessTime = Math.max(this.maxProcessTime, this.processTime);
            
            const cpuUsage = this.processTime / (blockLength / this.sampleRate * 1000);
            if (cpuUsage > this.cpuThreshold) {
                this.port.postMessage({
                    type: 'cpu-usage',
                    value: cpuUsage
                });
            }
            
            return true;
        } catch (error) {
            console.error('Audio processing error:', error);
            this.port.postMessage({
                type: 'audio-dropout',
                error: error.message
            });
            return true; // Continue processing
        }
    }
    
    processAudioWithWASM(input, output, blockLength) {
        const inputLeft = input[0] || new Float32Array(blockLength);
        const inputRight = input[1] || inputLeft;
        
        // Copy input data to WASM buffers
        const wasmInputLeft = new Float32Array(
            this.wasmModule.HEAPF32.buffer,
            this.wasmBuffers.inputLeft,
            blockLength
        );
        const wasmInputRight = new Float32Array(
            this.wasmModule.HEAPF32.buffer,
            this.wasmBuffers.inputRight,
            blockLength
        );
        
        wasmInputLeft.set(inputLeft);
        wasmInputRight.set(inputRight);
        
        // Process audio through WASM engine
        this.wasmModule.ccall(
            'reaper_process_audio',
            null,
            ['number', 'number', 'number', 'number', 'number'],
            [
                this.wasmBuffers.inputLeft,
                this.wasmBuffers.inputRight,
                this.wasmBuffers.outputLeft,
                this.wasmBuffers.outputRight,
                blockLength
            ]
        );
        
        // Copy output data from WASM buffers
        const wasmOutputLeft = new Float32Array(
            this.wasmModule.HEAPF32.buffer,
            this.wasmBuffers.outputLeft,
            blockLength
        );
        const wasmOutputRight = new Float32Array(
            this.wasmModule.HEAPF32.buffer,
            this.wasmBuffers.outputRight,
            blockLength
        );
        
        output[0].set(wasmOutputLeft);
        if (output[1]) {
            output[1].set(wasmOutputRight);
        }
    }
    
    processAudioFallback(input, output, blockLength) {
        // Simple JavaScript fallback
        const inputLeft = input[0] || new Float32Array(blockLength);
        const inputRight = input[1] || inputLeft;
        
        // Simple passthrough for now
        output[0].set(inputLeft);
        if (output[1]) {
            output[1].set(inputRight);
        }
    }
    
    processAllTracks(output, blockLength) {
        const trackOutputs = new Map();
        const meterData = {};
        
        // Process each track
        for (const [trackId, track] of this.tracks) {
            const trackOutput = this.processTrack(track, blockLength);
            trackOutputs.set(trackId, trackOutput);
            
            // Calculate meter levels
            meterData[trackId] = this.calculateMeterLevels(trackOutput);
            
            // Mix to master output if track is not muted
            if (!track.mute && track.volume > 0) {
                this.mixToOutput(output, trackOutput, track.volume, track.pan);
            }
        }
        
        // Send meter data
        if (Object.keys(meterData).length > 0) {
            this.port.postMessage({
                type: 'meter-data',
                meters: meterData
            });
        }
    }
    
    processTrack(track, blockLength) {
        // Create temporary buffers for track processing
        const trackBuffer = [
            new Float32Array(blockLength),
            new Float32Array(blockLength)
        ];
        
        // Process media items for this track
        this.processTrackMediaItems(track, trackBuffer, blockLength);
        
        // Apply track effects chain
        for (const effect of track.effects) {
            if (!effect.bypass) {
                this.processEffect(effect, trackBuffer, blockLength);
            }
        }
        
        return trackBuffer;
    }
    
    processTrackMediaItems(track, trackBuffer, blockLength) {
        const currentTime = this.currentPosition / this.sampleRate;
        
        for (const itemId of track.mediaItems) {
            const mediaItem = this.mediaItems.get(itemId);
            if (!mediaItem) continue;
            
            // Check if media item should be playing at current position
            const itemStart = mediaItem.position || 0;
            const itemEnd = itemStart + mediaItem.duration;
            
            if (currentTime >= itemStart && currentTime < itemEnd) {
                const itemOffset = currentTime - itemStart;
                this.renderMediaItem(mediaItem, trackBuffer, blockLength, itemOffset);
            }
        }
    }
    
    renderMediaItem(mediaItem, trackBuffer, blockLength, offset) {
        if (!mediaItem.buffer) return;
        
        const sourceBuffer = mediaItem.buffer;
        const startSample = Math.floor(offset * sourceBuffer.sampleRate);
        
        for (let i = 0; i < blockLength; i++) {
            const sourceSample = startSample + i;
            
            if (sourceSample >= sourceBuffer.length) break;
            
            // Handle channel mapping
            const sourceChannels = sourceBuffer.numberOfChannels;
            
            // Left channel
            if (sourceChannels >= 1) {
                const sample = sourceBuffer.getChannelData(0)[sourceSample] || 0;
                trackBuffer[0][i] += sample;
            }
            
            // Right channel
            if (sourceChannels >= 2) {
                const sample = sourceBuffer.getChannelData(1)[sourceSample] || 0;
                trackBuffer[1][i] += sample;
            } else if (sourceChannels === 1) {
                // Mono to stereo
                const sample = sourceBuffer.getChannelData(0)[sourceSample] || 0;
                trackBuffer[1][i] += sample;
            }
        }
    }
    
    processEffect(effect, buffer, blockLength) {
        // Simple effect processing implementations
        switch (effect.type) {
            case 'simple-gain':
                this.processGain(buffer, blockLength, effect.parameters.gain || 1.0);
                break;
                
            case 'resonant-lowpass':
                this.processLowpass(buffer, blockLength, effect);
                break;
                
            case 'simple-compressor':
                this.processCompressor(buffer, blockLength, effect);
                break;
                
            case 'simple-delay':
                this.processDelay(buffer, blockLength, effect);
                break;
                
            case 'high-pass':
                this.processHighpass(buffer, blockLength, effect);
                break;
                
            case 'dc-remove':
                this.processDCRemove(buffer, blockLength, effect);
                break;
                
            default:
                console.warn('Unknown effect type:', effect.type);
        }
    }
    
    processGain(buffer, blockLength, gain) {
        for (let channel = 0; channel < buffer.length; channel++) {
            for (let i = 0; i < blockLength; i++) {
                buffer[channel][i] *= gain;
            }
        }
    }
    
    processLowpass(buffer, blockLength, effect) {
        const cutoff = effect.parameters.cutoff || 1000;
        const resonance = effect.parameters.resonance || 0.5;
        
        // Simple one-pole lowpass filter (placeholder)
        const rc = 1.0 / (cutoff * 2 * Math.PI);
        const dt = 1.0 / this.sampleRate;
        const alpha = dt / (rc + dt);
        
        if (!effect.state) {
            effect.state = { prev: [0, 0] };
        }
        
        for (let channel = 0; channel < buffer.length; channel++) {
            for (let i = 0; i < blockLength; i++) {
                effect.state.prev[channel] = effect.state.prev[channel] + alpha * (buffer[channel][i] - effect.state.prev[channel]);
                buffer[channel][i] = effect.state.prev[channel];
            }
        }
    }
    
    processCompressor(buffer, blockLength, effect) {
        const threshold = effect.parameters.threshold || -20;
        const ratio = effect.parameters.ratio || 4;
        const attack = effect.parameters.attack || 0.003;
        const release = effect.parameters.release || 0.1;
        
        // Simple compressor implementation (placeholder)
        for (let channel = 0; channel < buffer.length; channel++) {
            for (let i = 0; i < blockLength; i++) {
                const input = buffer[channel][i];
                const inputDb = 20 * Math.log10(Math.abs(input) + 1e-12);
                
                if (inputDb > threshold) {
                    const excess = inputDb - threshold;
                    const compression = excess * (1 - 1/ratio);
                    const outputDb = inputDb - compression;
                    const outputGain = Math.pow(10, (outputDb - inputDb) / 20);
                    buffer[channel][i] = input * outputGain;
                }
            }
        }
    }
    
    processDelay(buffer, blockLength, effect) {
        const delayTime = effect.parameters.delay || 0.25; // seconds
        const feedback = effect.parameters.feedback || 0.3;
        const mix = effect.parameters.mix || 0.3;
        
        const delaySamples = Math.floor(delayTime * this.sampleRate);
        
        if (!effect.state) {
            effect.state = {
                delayBuffer: [new Float32Array(delaySamples), new Float32Array(delaySamples)],
                writeIndex: 0
            };
        }
        
        const state = effect.state;
        
        for (let channel = 0; channel < buffer.length; channel++) {
            for (let i = 0; i < blockLength; i++) {
                const input = buffer[channel][i];
                const delayed = state.delayBuffer[channel][state.writeIndex];
                
                state.delayBuffer[channel][state.writeIndex] = input + delayed * feedback;
                buffer[channel][i] = input * (1 - mix) + delayed * mix;
                
                state.writeIndex = (state.writeIndex + 1) % delaySamples;
            }
        }
    }
    
    processHighpass(buffer, blockLength, effect) {
        const cutoff = effect.parameters.cutoff || 100;
        
        // Simple high-pass filter
        const rc = 1.0 / (cutoff * 2 * Math.PI);
        const dt = 1.0 / this.sampleRate;
        const alpha = rc / (rc + dt);
        
        if (!effect.state) {
            effect.state = { prev: [0, 0], prevOut: [0, 0] };
        }
        
        for (let channel = 0; channel < buffer.length; channel++) {
            for (let i = 0; i < blockLength; i++) {
                const input = buffer[channel][i];
                const output = alpha * (effect.state.prevOut[channel] + input - effect.state.prev[channel]);
                
                effect.state.prev[channel] = input;
                effect.state.prevOut[channel] = output;
                buffer[channel][i] = output;
            }
        }
    }
    
    processDCRemove(buffer, blockLength, effect) {
        // Simple DC removal filter
        if (!effect.state) {
            effect.state = { prev: [0, 0], prevOut: [0, 0] };
        }
        
        const alpha = 0.995;
        
        for (let channel = 0; channel < buffer.length; channel++) {
            for (let i = 0; i < blockLength; i++) {
                const input = buffer[channel][i];
                const output = input - effect.state.prev[channel] + alpha * effect.state.prevOut[channel];
                
                effect.state.prev[channel] = input;
                effect.state.prevOut[channel] = output;
                buffer[channel][i] = output;
            }
        }
    }
    
    mixToOutput(output, trackBuffer, volume, pan) {
        const leftGain = volume * Math.cos((pan + 1) * Math.PI / 4);
        const rightGain = volume * Math.sin((pan + 1) * Math.PI / 4);
        
        for (let i = 0; i < output[0].length; i++) {
            output[0][i] += trackBuffer[0][i] * leftGain;
            output[1][i] += trackBuffer[1][i] * rightGain;
        }
    }
    
    calculateMeterLevels(buffer) {
        let leftPeak = 0, rightPeak = 0;
        let leftRMS = 0, rightRMS = 0;
        
        for (let i = 0; i < buffer[0].length; i++) {
            const leftSample = Math.abs(buffer[0][i]);
            const rightSample = Math.abs(buffer[1][i]);
            
            leftPeak = Math.max(leftPeak, leftSample);
            rightPeak = Math.max(rightPeak, rightSample);
            
            leftRMS += leftSample * leftSample;
            rightRMS += rightSample * rightSample;
        }
        
        leftRMS = Math.sqrt(leftRMS / buffer[0].length);
        rightRMS = Math.sqrt(rightRMS / buffer[0].length);
        
        return {
            left: { peak: leftPeak, rms: leftRMS },
            right: { peak: rightPeak, rms: rightRMS }
        };
    }
    
    addTrack(trackConfig) {
        const track = {
            id: trackConfig.id,
            name: trackConfig.name || `Track ${this.tracks.size + 1}`,
            volume: trackConfig.volume || 1.0,
            pan: trackConfig.pan || 0.0,
            mute: trackConfig.mute || false,
            solo: trackConfig.solo || false,
            effects: [],
            mediaItems: [],
            input: trackConfig.input || null,
            output: trackConfig.output || 'master'
        };
        
        this.tracks.set(trackConfig.id, track);
        
        // Create track in WASM engine if available
        if (this.wasmModule) {
            this.wasmModule.ccall(
                'reaper_create_track',
                null,
                ['string'],
                [track.name]
            );
        }
        
        this.port.postMessage({
            type: 'track-added',
            trackId: track.id
        });
        
        console.log('Track added to processor:', track.id);
    }
    
    removeTrack(trackId) {
        this.tracks.delete(trackId);
        
        // Remove track from WASM engine if available
        if (this.wasmModule) {
            this.wasmModule.ccall(
                'reaper_delete_track',
                null,
                ['number'],
                [trackId]
            );
        }
        
        this.port.postMessage({
            type: 'track-removed',
            trackId
        });
        
        console.log('Track removed from processor:', trackId);
    }
    
    updateTrackParameter(trackId, parameter, value) {
        const track = this.tracks.get(trackId);
        if (!track) return;
        
        track[parameter] = value;
        
        // Update parameter in WASM engine if available
        if (this.wasmModule) {
            switch (parameter) {
                case 'volume':
                    this.wasmModule.ccall(
                        'reaper_set_track_volume',
                        null,
                        ['number', 'number'],
                        [trackId, value]
                    );
                    break;
                    
                case 'pan':
                    this.wasmModule.ccall(
                        'reaper_set_track_pan',
                        null,
                        ['number', 'number'],
                        [trackId, value]
                    );
                    break;
                    
                case 'mute':
                    this.wasmModule.ccall(
                        'reaper_set_track_muted',
                        null,
                        ['number', 'number'],
                        [trackId, value ? 1 : 0]
                    );
                    break;
                    
                case 'solo':
                    this.wasmModule.ccall(
                        'reaper_set_track_soloed',
                        null,
                        ['number', 'number'],
                        [trackId, value ? 1 : 0]
                    );
                    break;
            }
        }
        
        this.port.postMessage({
            type: 'track-parameter-updated',
            trackId,
            parameter,
            value
        });
    }
    
    static get parameterDescriptors() {
        return [];
    }
}

// Register the processor
registerProcessor('reaper-audio-processor', ReaperAudioProcessor);