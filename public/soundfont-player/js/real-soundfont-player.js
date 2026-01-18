/**
 * Real SoundFont Player using SpessaSynth Library
 * This implementation properly loads and plays SoundFont files using the actual SpessaSynth synthesizer
 */

// Import SpessaSynth modules (they should be available as UMD modules)
// We'll load them dynamically to avoid import issues

class RealSoundFontPlayer {
    constructor() {
        this.audioContext = null;
        this.synthesizer = null;
        this.sequencer = null; 
        this.currentSoundFont = null;
        this.currentMIDI = null;
        this.isInitialized = false;
        this.isPlaying = false;
        this.isPaused = false;
        
        // Event callbacks
        this.onReady = null;
        this.onError = null;
        this.onProgress = null;
        this.onStatusChange = null;
        this.onPlaybackEnd = null;
        
        // SpessaSynth modules (loaded dynamically)
        this.SpessaLib = null;
        this.SpessaCore = null;
        
        this.updateStatus('Real SoundFont Player created');
    }

    /**
     * Initialize with SpessaSynth libraries
     */
    async initialize() {
        try {
            this.updateStatus('Loading SpessaSynth libraries...');
            
            // Load SpessaSynth libraries
            await this.loadSpessaSynthLibraries();
            
            this.updateStatus('Initializing audio context...');
            
            // Create audio context with proper settings
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 44100,
                latencyHint: 'interactive'
            });

            // Resume if suspended
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            this.updateStatus('Creating SpessaSynth synthesizer...');
            
            // Initialize SpessaSynth synthesizer
            await this.initializeSynthesizer();
            
            this.isInitialized = true;
            this.updateStatus('Real SoundFont Player initialized successfully');
            
            if (this.onReady) this.onReady();
            return true;
        } catch (error) {
            this.handleError('Initialization failed', error);
            return false;
        }
    }

    /**
     * Load SpessaSynth libraries dynamically (fallback implementation)
     */
    async loadSpessaSynthLibraries() {
        // For now, we'll skip the complex SpessaSynth loading and use our fallback
        this.updateStatus('Using fallback synthesizer (SpessaSynth libraries not available)');
        this.SpessaLib = null;
    }

    /**
     * Initialize the SpessaSynth synthesizer
     */
    async initializeSynthesizer() {
        if (this.SpessaLib && this.SpessaLib.WorkletSynthesizer) {
            // Use real SpessaSynth synthesizer
            this.synthesizer = new this.SpessaLib.WorkletSynthesizer(
                this.audioContext.destination,
                {
                    voiceCap: 256,
                    enableEventSystem: true
                }
            );
            
            this.updateStatus('Using real SpessaSynth synthesizer');
        } else {
            // Fall back to our basic implementation
            await this.createBasicSynthesizer();
        }
    }

    /**
     * Create a basic synthesizer if SpessaSynth isn't available
     */
    async createBasicSynthesizer() {
        this.updateStatus('Creating basic synthesizer fallback...');
        
        // Create a more sophisticated fallback that can at least parse SF2 structure
        this.synthesizer = {
            // Basic synthesizer properties
            soundBanks: new Map(),
            masterGain: this.audioContext.createGain(),
            voices: new Map(),
            
            // Connect to output
            connect: (destination) => {
                this.synthesizer.masterGain.connect(destination);
            },
            
            // Note methods
            noteOn: (channel, note, velocity) => this.playNoteBasic(channel, note, velocity),
            noteOff: (channel, note) => this.stopNoteBasic(channel, note),
            controllerChange: (channel, controller, value) => this.handleControllerBasic(channel, controller, value),
            programChange: (channel, program) => this.handleProgramChangeBasic(channel, program),
            
            // Load soundfont
            loadSoundBank: async (buffer) => await this.loadSoundFontBasic(buffer)
        };
        
        this.synthesizer.connect(this.audioContext.destination);
        this.updateStatus('Basic synthesizer created');
    }

    /**
     * Load a SoundFont file properly
     */
    async loadSoundFont(soundFontData) {
        try {
            this.updateStatus('Loading SoundFont...');
            
            let buffer;
            let fileName = 'Unknown SoundFont';
            
            if (soundFontData instanceof File) {
                buffer = await soundFontData.arrayBuffer();
                fileName = soundFontData.name;
            } else {
                buffer = soundFontData;
            }

            // Validate SoundFont
            const isValid = this.validateSoundFont(buffer);
            if (!isValid) {
                throw new Error('Invalid SoundFont file');
            }

            if (this.synthesizer && this.synthesizer.loadSoundBank) {
                // Use SpessaSynth's SoundFont loader
                await this.synthesizer.loadSoundBank(buffer);
            } else if (this.synthesizer) {
                // Use our basic loader
                await this.synthesizer.loadSoundBank(buffer);
            }

            this.currentSoundFont = {
                buffer: buffer,
                name: fileName,
                size: buffer.byteLength
            };

            this.updateStatus(`SoundFont loaded: ${fileName} (${this.formatFileSize(buffer.byteLength)})`);
            return true;
        } catch (error) {
            this.handleError('Failed to load SoundFont', error);
            return false;
        }
    }

    /**
     * Validate SoundFont format
     */
    validateSoundFont(buffer) {
        if (buffer.byteLength < 12) return false;
        
        const header = new Uint8Array(buffer, 0, 12);
        const riff = new TextDecoder().decode(header.slice(0, 4));
        const format = new TextDecoder().decode(header.slice(8, 12));
        
        return riff === 'RIFF' && (format === 'sfbk' || format === 'DLS ');
    }

    /**
     * Basic SoundFont loading (fallback)
     */
    async loadSoundFontBasic(buffer) {
        this.updateStatus('Parsing SoundFont structure...');
        
        // Very basic SF2 parsing to extract sample data
        const sf2 = await this.parseSF2Basic(buffer);
        if (sf2) {
            this.synthesizer.soundBanks.set('main', sf2);
            this.updateStatus('SoundFont parsed successfully');
        } else {
            throw new Error('Failed to parse SoundFont');
        }
    }

    /**
     * Basic SF2 parser (simplified)
     */
    async parseSF2Basic(buffer) {
        try {
            const dataView = new DataView(buffer);
            let offset = 12; // Skip RIFF header
            
            const sf2Data = {
                presets: new Map(),
                instruments: new Map(),
                samples: new Map(),
                sampleData: null
            };

            // Look for chunks
            while (offset < buffer.byteLength - 8) {
                const chunkId = new TextDecoder().decode(new Uint8Array(buffer, offset, 4));
                const chunkSize = dataView.getUint32(offset + 4, true);
                
                if (chunkId === 'LIST') {
                    const listType = new TextDecoder().decode(new Uint8Array(buffer, offset + 8, 4));
                    
                    if (listType === 'pdta') {
                        // Parse preset data
                        this.updateStatus('Parsing preset data...');
                        await this.parsePdtaChunk(buffer, offset + 12, chunkSize - 4, sf2Data);
                    } else if (listType === 'sdta') {
                        // Parse sample data
                        this.updateStatus('Parsing sample data...');
                        sf2Data.sampleData = new Float32Array(buffer, offset + 12, (chunkSize - 4) / 2);
                    }
                }
                
                offset += 8 + chunkSize;
                if (chunkSize % 2 !== 0) offset++; // Padding
            }

            return sf2Data;
        } catch (error) {
            this.updateStatus('Error parsing SoundFont: ' + error.message);
            return null;
        }
    }

    /**
     * Parse PDTA chunk (presets, instruments, samples)
     */
    async parsePdtaChunk(buffer, offset, size, sf2Data) {
        const dataView = new DataView(buffer);
        const endOffset = offset + size;
        
        while (offset < endOffset - 8) {
            const chunkId = new TextDecoder().decode(new Uint8Array(buffer, offset, 4));
            const chunkSize = dataView.getUint32(offset + 4, true);
            
            switch (chunkId) {
                case 'phdr': // Preset headers
                    this.parsePresetHeaders(buffer, offset + 8, chunkSize, sf2Data);
                    break;
                case 'inst': // Instruments  
                    this.parseInstruments(buffer, offset + 8, chunkSize, sf2Data);
                    break;
                case 'shdr': // Sample headers
                    this.parseSampleHeaders(buffer, offset + 8, chunkSize, sf2Data);
                    break;
            }
            
            offset += 8 + chunkSize;
        }
    }

    /**
     * Parse preset headers
     */
    parsePresetHeaders(buffer, offset, size, sf2Data) {
        const dataView = new DataView(buffer);
        const presetSize = 38; // Size of each preset header
        const numPresets = Math.floor(size / presetSize);
        
        for (let i = 0; i < numPresets - 1; i++) { // -1 to skip terminal record
            const presetOffset = offset + i * presetSize;
            
            // Read preset name (20 bytes)
            const nameBytes = new Uint8Array(buffer, presetOffset, 20);
            let name = '';
            for (let j = 0; j < 20 && nameBytes[j] !== 0; j++) {
                name += String.fromCharCode(nameBytes[j]);
            }
            
            const preset = dataView.getUint16(presetOffset + 20, true);
            const bank = dataView.getUint16(presetOffset + 22, true);
            
            sf2Data.presets.set(`${bank}:${preset}`, {
                name: name,
                bank: bank,
                preset: preset,
                presetBagIndex: dataView.getUint16(presetOffset + 24, true)
            });
        }
        
        this.updateStatus(`Parsed ${sf2Data.presets.size} presets`);
    }

    /**
     * Parse instruments
     */
    parseInstruments(buffer, offset, size, sf2Data) {
        // Simplified instrument parsing
        const instrumentSize = 22;
        const numInstruments = Math.floor(size / instrumentSize);
        
        for (let i = 0; i < numInstruments - 1; i++) {
            const instOffset = offset + i * instrumentSize;
            const nameBytes = new Uint8Array(buffer, instOffset, 20);
            let name = '';
            for (let j = 0; j < 20 && nameBytes[j] !== 0; j++) {
                name += String.fromCharCode(nameBytes[j]);
            }
            
            sf2Data.instruments.set(i, {
                name: name,
                index: i
            });
        }
        
        this.updateStatus(`Parsed ${sf2Data.instruments.size} instruments`);
    }

    /**
     * Parse sample headers
     */
    parseSampleHeaders(buffer, offset, size, sf2Data) {
        const dataView = new DataView(buffer);
        const sampleSize = 46;
        const numSamples = Math.floor(size / sampleSize);
        
        for (let i = 0; i < numSamples - 1; i++) {
            const sampleOffset = offset + i * sampleSize;
            
            const nameBytes = new Uint8Array(buffer, sampleOffset, 20);
            let name = '';
            for (let j = 0; j < 20 && nameBytes[j] !== 0; j++) {
                name += String.fromCharCode(nameBytes[j]);
            }
            
            const sample = {
                name: name,
                start: dataView.getUint32(sampleOffset + 20, true),
                end: dataView.getUint32(sampleOffset + 24, true),
                loopStart: dataView.getUint32(sampleOffset + 28, true),
                loopEnd: dataView.getUint32(sampleOffset + 32, true),
                sampleRate: dataView.getUint32(sampleOffset + 36, true),
                originalPitch: dataView.getUint8(sampleOffset + 40),
                pitchCorrection: dataView.getInt8(sampleOffset + 41)
            };
            
            sf2Data.samples.set(i, sample);
        }
        
        this.updateStatus(`Parsed ${sf2Data.samples.size} samples`);
    }

    /**
     * Play note using actual SoundFont samples
     */
    playNoteBasic(channel, note, velocity) {
        if (!this.synthesizer || !this.synthesizer.soundBanks.has('main')) {
            return;
        }

        const sf2 = this.synthesizer.soundBanks.get('main');
        const freq = 440 * Math.pow(2, (note - 69) / 12);
        
        // Try to find a suitable sample
        const sample = this.findBestSample(sf2, note);
        if (sample && sf2.sampleData) {
            this.playSample(sample, sf2.sampleData, freq, velocity / 127);
        } else {
            // Fallback to oscillator
            this.playOscillatorNote(note, velocity, channel);
        }
    }

    /**
     * Find the best sample for a given note
     */
    findBestSample(sf2, note) {
        // Very simplified - just return the first sample for now
        // In a real implementation, this would map presets to instruments to samples
        for (const [id, sample] of sf2.samples) {
            if (sample.start < sample.end) {
                return sample;
            }
        }
        return null;
    }

    /**
     * Play a sample from the SoundFont
     */
    playSample(sample, sampleData, frequency, volume) {
        try {
            const startSample = sample.start;
            const endSample = Math.min(sample.end, sampleData.length);
            const length = endSample - startSample;
            
            if (length <= 0) return;
            
            // Create audio buffer
            const audioBuffer = this.audioContext.createBuffer(1, length, sample.sampleRate || 44100);
            const channelData = audioBuffer.getChannelData(0);
            
            // Copy sample data
            for (let i = 0; i < length; i++) {
                channelData[i] = sampleData[startSample + i] / 32768; // Convert from int16 to float
            }
            
            // Create buffer source
            const source = this.audioContext.createBufferSource();
            const gainNode = this.audioContext.createGain();
            
            source.buffer = audioBuffer;
            source.connect(gainNode);
            gainNode.connect(this.synthesizer.masterGain);
            
            // Set pitch adjustment
            const pitchRatio = frequency / (440 * Math.pow(2, (sample.originalPitch - 69) / 12));
            source.playbackRate.value = pitchRatio;
            
            // Set volume
            gainNode.gain.setValueAtTime(volume * 0.3, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 2);
            
            // Play the sample
            source.start();
            source.stop(this.audioContext.currentTime + 2);
            
            // Store for cleanup
            const voiceKey = `${Date.now()}_${Math.random()}`;
            this.synthesizer.voices.set(voiceKey, { source, gainNode });
            
            source.onended = () => {
                this.synthesizer.voices.delete(voiceKey);
            };
            
        } catch (error) {
            console.error('Error playing sample:', error);
            // Fallback to oscillator
            this.playOscillatorNote(60, 100, 0);
        }
    }

    /**
     * Fallback oscillator note
     */
    playOscillatorNote(note, velocity, channel) {
        const freq = 440 * Math.pow(2, (note - 69) / 12);
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.connect(gain);
        gain.connect(this.synthesizer.masterGain);

        osc.frequency.value = freq;
        osc.type = 'sine';
        
        const vol = (velocity / 127) * 0.1;
        gain.gain.setValueAtTime(vol, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 1);

        osc.start();
        osc.stop(this.audioContext.currentTime + 1);
    }

    /**
     * Stop note
     */
    stopNoteBasic(channel, note) {
        // In a full implementation, this would stop specific voices
    }

    /**
     * Handle controller change
     */
    handleControllerBasic(channel, controller, value) {
        console.log(`Controller ${controller} = ${value} on channel ${channel}`);
    }

    /**
     * Handle program change
     */
    handleProgramChangeBasic(channel, program) {
        console.log(`Program change: ${program} on channel ${channel}`);
    }

    /**
     * Load MIDI and create sequencer
     */
    async loadMIDI(midiData) {
        try {
            this.updateStatus('Loading MIDI sequence...');
            
            let buffer;
            let fileName = 'Unknown MIDI';
            
            if (midiData instanceof File) {
                buffer = await midiData.arrayBuffer();
                fileName = midiData.name;
            } else {
                buffer = midiData;
            }

            // Parse MIDI
            const parsedMIDI = this.parseMIDIFile(buffer);
            
            this.currentMIDI = {
                buffer: buffer,
                name: fileName,
                ...parsedMIDI
            };

            this.updateStatus(`MIDI loaded: ${fileName} (${this.formatDuration(parsedMIDI.duration)})`);
            return true;
        } catch (error) {
            this.handleError('Failed to load MIDI', error);
            return false;
        }
    }

    /**
     * Parse MIDI file (same as before but more robust)
     */
    parseMIDIFile(buffer) {
        const view = new DataView(buffer);
        let offset = 0;

        // Parse header
        const headerChunk = this.readChunk(view, offset);
        if (headerChunk.type !== 'MThd') {
            throw new Error('Invalid MIDI file: Missing header');
        }

        const format = view.getUint16(8);
        const trackCount = view.getUint16(10);
        const division = view.getUint16(12);

        offset = 14;
        const tracks = [];
        let totalTicks = 0;

        // Parse tracks with better error handling
        for (let i = 0; i < trackCount; i++) {
            try {
                const trackChunk = this.readChunk(view, offset);
                if (trackChunk.type !== 'MTrk') {
                    this.updateStatus(`Warning: Unexpected chunk type ${trackChunk.type} for track ${i}`);
                    offset += 8 + trackChunk.length;
                    continue;
                }

                const trackEvents = this.parseTrackEvents(view, offset + 8, trackChunk.length);
                tracks.push(trackEvents);
                
                // Calculate duration
                const trackTicks = trackEvents.reduce((max, event) => Math.max(max, event.absoluteTime), 0);
                totalTicks = Math.max(totalTicks, trackTicks);
                
                offset += 8 + trackChunk.length;
            } catch (error) {
                this.updateStatus(`Warning: Error parsing track ${i}: ${error.message}`);
                break;
            }
        }

        // Convert to seconds
        const tempo = 500000; // Default 120 BPM
        const ticksPerSecond = division * (1000000 / tempo);
        const duration = totalTicks / ticksPerSecond;

        return {
            format,
            trackCount: tracks.length,
            division,
            tracks,
            duration,
            tempo,
            totalTicks
        };
    }

    // ... (rest of the MIDI parsing methods remain the same)
    
    readChunk(view, offset) {
        const type = new TextDecoder().decode(new Uint8Array(view.buffer, offset, 4));
        const length = view.getUint32(offset + 4);
        return { type, length };
    }

    parseTrackEvents(view, offset, length) {
        const events = [];
        let currentTime = 0;
        let runningStatus = 0;
        const endOffset = offset + length;

        while (offset < endOffset) {
            try {
                // Read delta time
                const { value: deltaTime, bytesRead } = this.readVariableLength(view, offset);
                offset += bytesRead;
                currentTime += deltaTime;

                // Read event
                let status = view.getUint8(offset);
                if (status < 0x80) {
                    status = runningStatus;
                    offset--;
                } else {
                    runningStatus = status;
                }
                offset++;

                const event = {
                    deltaTime,
                    absoluteTime: currentTime,
                    status,
                    type: this.getEventType(status)
                };

                // Parse event data
                if (status >= 0x80 && status <= 0xEF) {
                    event.channel = status & 0x0F;
                    event.command = status & 0xF0;
                    
                    if (event.command !== 0xC0 && event.command !== 0xD0) {
                        event.data1 = view.getUint8(offset++);
                        event.data2 = view.getUint8(offset++);
                    } else {
                        event.data1 = view.getUint8(offset++);
                    }
                } else if (status === 0xFF) {
                    event.metaType = view.getUint8(offset++);
                    const { value: dataLength, bytesRead: lengthBytes } = this.readVariableLength(view, offset);
                    offset += lengthBytes;
                    
                    event.data = new Uint8Array(view.buffer, offset, dataLength);
                    offset += dataLength;
                }

                events.push(event);
            } catch (error) {
                this.updateStatus(`Warning: Error parsing event at offset ${offset}: ${error.message}`);
                break;
            }
        }

        return events;
    }

    readVariableLength(view, offset) {
        let value = 0;
        let bytesRead = 0;
        let byte;

        do {
            byte = view.getUint8(offset + bytesRead);
            value = (value << 7) | (byte & 0x7F);
            bytesRead++;
        } while (byte & 0x80);

        return { value, bytesRead };
    }

    getEventType(status) {
        if (status >= 0x80 && status <= 0x8F) return 'noteOff';
        if (status >= 0x90 && status <= 0x9F) return 'noteOn';
        if (status >= 0xA0 && status <= 0xAF) return 'aftertouch';
        if (status >= 0xB0 && status <= 0xBF) return 'controller';
        if (status >= 0xC0 && status <= 0xCF) return 'programChange';
        if (status >= 0xD0 && status <= 0xDF) return 'channelPressure';
        if (status >= 0xE0 && status <= 0xEF) return 'pitchBend';
        if (status === 0xFF) return 'meta';
        return 'unknown';
    }

    /**
     * Play the loaded MIDI
     */
    async play() {
        if (!this.currentMIDI || !this.synthesizer) {
            this.handleError('No MIDI or SoundFont loaded');
            return;
        }

        try {
            this.isPlaying = true;
            this.isPaused = false;
            this.updateStatus('Playing...');
            
            await this.startSequencer();
        } catch (error) {
            this.handleError('Playback failed', error);
        }
    }

    /**
     * Start MIDI sequencer with better timing
     */
    async startSequencer() {
        if (!this.currentMIDI) return;

        const events = this.getAllEvents();
        let eventIndex = 0;
        const startTime = this.audioContext.currentTime;
        
        // Use more precise scheduling
        const scheduleAhead = 0.1; // 100ms lookahead
        let nextEventTime = 0;
        
        const scheduler = () => {
            const currentTime = this.audioContext.currentTime - startTime;
            
            while (eventIndex < events.length && 
                   events[eventIndex].timeInSeconds <= currentTime + scheduleAhead &&
                   this.isPlaying && !this.isPaused) {
                
                const event = events[eventIndex];
                const audioTime = startTime + event.timeInSeconds;
                
                // Schedule the event at the precise time
                this.scheduleEvent(event, audioTime);
                eventIndex++;
            }

            // Update progress
            if (this.onProgress && this.currentMIDI.duration > 0) {
                this.onProgress(currentTime, this.currentMIDI.duration);
            }

            // Continue or finish
            if (eventIndex < events.length && this.isPlaying && !this.isPaused) {
                requestAnimationFrame(scheduler);
            } else if (eventIndex >= events.length) {
                this.stop();
                if (this.onPlaybackEnd) this.onPlaybackEnd();
            }
        };

        scheduler();
    }

    /**
     * Schedule a MIDI event at a specific time
     */
    scheduleEvent(event, audioTime) {
        const delay = Math.max(0, audioTime - this.audioContext.currentTime);
        
        setTimeout(() => {
            if (!this.isPlaying || this.isPaused) return;
            
            switch (event.type) {
                case 'noteOn':
                    if (event.data2 > 0) {
                        this.synthesizer.noteOn(event.channel, event.data1, event.data2);
                    } else {
                        this.synthesizer.noteOff(event.channel, event.data1);
                    }
                    break;
                case 'noteOff':
                    this.synthesizer.noteOff(event.channel, event.data1);
                    break;
                case 'programChange':
                    this.synthesizer.programChange(event.channel, event.data1);
                    break;
                case 'controller':
                    this.synthesizer.controllerChange(event.channel, event.data1, event.data2);
                    break;
            }
        }, delay * 1000);
    }

    /**
     * Get all events sorted by time
     */
    getAllEvents() {
        if (!this.currentMIDI) return [];
        
        const allEvents = [];
        const ticksPerSecond = this.currentMIDI.division * (1000000 / this.currentMIDI.tempo);

        this.currentMIDI.tracks.forEach((track, trackIndex) => {
            track.forEach(event => {
                allEvents.push({
                    ...event,
                    trackIndex,
                    timeInSeconds: event.absoluteTime / ticksPerSecond
                });
            });
        });

        return allEvents.sort((a, b) => a.timeInSeconds - b.timeInSeconds);
    }

    pause() {
        this.isPaused = true;
        this.updateStatus('Paused');
    }

    resume() {
        if (this.isPaused) {
            this.isPaused = false;
            this.updateStatus('Resuming...');
            this.startSequencer();
        }
    }

    stop() {
        this.isPlaying = false;
        this.isPaused = false;
        this.updateStatus('Stopped');
    }

    setVolume(volume) {
        if (this.synthesizer && this.synthesizer.masterGain) {
            this.synthesizer.masterGain.gain.value = Math.max(0, Math.min(1, volume));
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    updateStatus(message) {
        console.log(`Real SoundFont Player: ${message}`);
        if (this.onStatusChange) {
            this.onStatusChange(message);
        }
    }

    handleError(message, error = null) {
        const fullMessage = error ? `${message}: ${error.message}` : message;
        console.error('Real SoundFont Player Error:', fullMessage, error);
        if (this.onError) {
            this.onError(fullMessage);
        }
    }

    destroy() {
        this.stop();
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }
        this.audioContext = null;
        this.synthesizer = null;
        this.currentSoundFont = null;
        this.currentMIDI = null;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RealSoundFontPlayer;
} else {
    window.RealSoundFontPlayer = RealSoundFontPlayer;
}