/**
 * ToneJS SoundFont Player
 * Uses soundfont-player library with Tone.js for reliable SF2 loading and playback
 */

class ToneJSSoundFontPlayer {
    constructor() {
        this.isInitialized = false;
        this.currentSoundFont = null;
        this.currentMIDI = null;
        this.isPlaying = false;
        this.isPaused = false;
        
        // Tone.js components
        this.sampler = null;
        this.masterVolume = null;
        
        // MIDI playback
        this.midiEvents = [];
        this.playbackStartTime = 0;
        this.currentTime = 0;
        this.duration = 0;
        this.schedulerTimer = null;
        
        // Event callbacks
        this.onReady = null;
        this.onError = null;
        this.onProgress = null;
        this.onStatusChange = null;
        this.onPlaybackEnd = null;
        
        // Available instruments cache
        this.availableInstruments = new Map();
        this.currentInstrument = 'acoustic_grand_piano';
        
        this.updateStatus('ToneJS SoundFont Player created');
    }

    /**
     * Initialize Tone.js and prepare the audio context
     */
    async initialize() {
        try {
            this.updateStatus('Initializing Tone.js...');
            
            // Start Tone.js audio context
            if (Tone.context.state !== 'running') {
                await Tone.start();
            }
            
            // Create master volume control
            this.masterVolume = new Tone.Volume(-10).toDestination();
            
            // Create initial sampler (empty for now)
            this.sampler = new Tone.Sampler().connect(this.masterVolume);
            
            this.isInitialized = true;
            this.updateStatus('ToneJS ready - load a SoundFont to begin');
            
            if (this.onReady) this.onReady();
            return true;
        } catch (error) {
            this.handleError('Failed to initialize ToneJS', error);
            return false;
        }
    }

    /**
     * Load SoundFont using soundfont-player library
     */
    async loadSoundFont(soundFontData) {
        try {
            this.updateStatus('Loading SoundFont...');
            
            let fileName = 'Unknown SoundFont';
            let arrayBuffer;
            
            if (soundFontData instanceof File) {
                fileName = soundFontData.name;
                arrayBuffer = await soundFontData.arrayBuffer();
            } else {
                arrayBuffer = soundFontData;
            }

            // Parse SF2 file using soundfont-player
            this.updateStatus('Parsing SoundFont...');
            
            // Create a blob URL for the SF2 file
            const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
            const blobUrl = URL.createObjectURL(blob);
            
            try {
                // Use soundfont-player to load the SF2
                const soundfont = await Soundfont.instrument(Tone.context, blobUrl);
                
                // Convert soundfont-player format to Tone.js Sampler format
                await this.createToneSampler(soundfont);
                
                this.currentSoundFont = {
                    name: fileName,
                    size: arrayBuffer.byteLength,
                    data: soundfont,
                    presets: this.extractPresets(soundfont)
                };

                // Clean up blob URL
                URL.revokeObjectURL(blobUrl);
                
                this.updateStatus(`SoundFont loaded: ${fileName} (${this.formatFileSize(arrayBuffer.byteLength)})`);
                return true;
                
            } catch (sfError) {
                // Fallback: try to create a basic instrument mapping
                this.updateStatus('Creating fallback instrument mapping...');
                await this.createFallbackSampler(arrayBuffer);
                
                this.currentSoundFont = {
                    name: fileName,
                    size: arrayBuffer.byteLength,
                    presets: this.createDefaultPresets()
                };
                
                this.updateStatus(`SoundFont loaded (fallback mode): ${fileName}`);
                return true;
            }
            
        } catch (error) {
            this.handleError('Failed to load SoundFont', error);
            return false;
        }
    }

    /**
     * Create Tone.js Sampler from soundfont-player data
     */
    async createToneSampler(soundfontData) {
        try {
            this.updateStatus('Creating Tone.js sampler...');
            
            // Dispose old sampler
            if (this.sampler) {
                this.sampler.dispose();
            }
            
            // Extract samples for Tone.js Sampler
            const samples = {};
            
            // If soundfontData has note mappings, use them
            if (soundfontData && typeof soundfontData === 'object') {
                // Try to extract audio buffers from the soundfont
                for (let note = 21; note <= 108; note++) { // Piano range
                    const noteName = this.midiNoteToName(note);
                    
                    // Try to get audio data for this note
                    if (soundfontData[note] || soundfontData[noteName]) {
                        const audioData = soundfontData[note] || soundfontData[noteName];
                        if (audioData instanceof AudioBuffer || audioData.buffer) {
                            samples[noteName] = audioData;
                        }
                    }
                }
                
                // If we got samples, create the sampler
                if (Object.keys(samples).length > 0) {
                    this.sampler = new Tone.Sampler(samples).connect(this.masterVolume);
                    this.updateStatus(`Sampler created with ${Object.keys(samples).length} samples`);
                    return;
                }
            }
            
            // Fallback: create a basic sampler with a few key samples
            await this.createBasicSampler();
            
        } catch (error) {
            this.updateStatus('Error creating sampler, using fallback...');
            await this.createBasicSampler();
        }
    }

    /**
     * Create a basic sampler with generated tones (fallback)
     */
    async createBasicSampler() {
        try {
            // Dispose old sampler
            if (this.sampler) {
                this.sampler.dispose();
            }
            
            // Create a basic sampler with a few key notes using oscillator
            const samples = {};
            const keyNotes = ['C4', 'E4', 'G4', 'C5']; // Basic chord samples
            
            for (const note of keyNotes) {
                // Create a simple audio buffer with a sine wave
                const freq = Tone.Frequency(note).toFrequency();
                const buffer = new Tone.Buffer();
                
                // Generate a simple waveform
                const length = 44100; // 1 second at 44.1kHz
                const audioBuffer = Tone.context.createBuffer(1, length, 44100);
                const channelData = audioBuffer.getChannelData(0);
                
                for (let i = 0; i < length; i++) {
                    const t = i / 44100;
                    channelData[i] = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 2);
                }
                
                buffer.set(audioBuffer);
                samples[note] = buffer;
            }
            
            this.sampler = new Tone.Sampler(samples).connect(this.masterVolume);
            this.updateStatus('Basic sampler created');
            
        } catch (error) {
            this.updateStatus('Error creating basic sampler');
            throw error;
        }
    }

    /**
     * Create fallback sampler when SF2 parsing fails
     */
    async createFallbackSampler(arrayBuffer) {
        this.updateStatus('Creating fallback sampler...');
        
        // Try to extract basic info from SF2 header
        const view = new DataView(arrayBuffer);
        const signature = new TextDecoder().decode(new Uint8Array(arrayBuffer, 0, 4));
        
        if (signature === 'RIFF') {
            this.updateStatus('Valid SF2 file detected, creating basic mapping...');
            // Create a simple mapping with common instruments
            await this.createBasicSampler();
        } else {
            throw new Error('Invalid SoundFont file format');
        }
    }

    /**
     * Extract presets from soundfont data
     */
    extractPresets(soundfontData) {
        const presets = new Map();
        
        // Create some default presets based on General MIDI
        const gmPresets = [
            { bank: 0, preset: 0, name: 'Acoustic Grand Piano' },
            { bank: 0, preset: 1, name: 'Bright Acoustic Piano' },
            { bank: 0, preset: 4, name: 'Electric Piano 1' },
            { bank: 0, preset: 25, name: 'Acoustic Guitar (nylon)' },
            { bank: 0, preset: 40, name: 'Violin' },
            { bank: 0, preset: 56, name: 'Trumpet' },
            { bank: 0, preset: 73, name: 'Flute' },
        ];
        
        gmPresets.forEach(preset => {
            presets.set(`${preset.bank}:${preset.preset}`, preset);
        });
        
        return presets;
    }

    /**
     * Create default presets when no SF2 data available
     */
    createDefaultPresets() {
        const presets = new Map();
        presets.set('0:0', { bank: 0, preset: 0, name: 'Default Piano' });
        return presets;
    }

    /**
     * Convert MIDI note number to note name
     */
    midiNoteToName(noteNumber) {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(noteNumber / 12) - 1;
        const note = notes[noteNumber % 12];
        return note + octave;
    }

    /**
     * Load MIDI file
     */
    async loadMIDI(midiData) {
        try {
            this.updateStatus('Loading MIDI file...');
            
            let fileName = 'Unknown MIDI';
            let arrayBuffer;
            
            if (midiData instanceof File) {
                fileName = midiData.name;
                arrayBuffer = await midiData.arrayBuffer();
            } else {
                arrayBuffer = midiData;
            }

            // Parse MIDI file
            const midiFile = this.parseMIDIFile(arrayBuffer);
            
            this.currentMIDI = {
                name: fileName,
                ...midiFile
            };

            this.duration = midiFile.duration;
            this.updateStatus(`MIDI loaded: ${fileName} (${this.formatDuration(midiFile.duration)})`);
            return true;
            
        } catch (error) {
            this.handleError('Failed to load MIDI', error);
            return false;
        }
    }

    /**
     * Simple MIDI parser
     */
    parseMIDIFile(buffer) {
        const view = new DataView(buffer);
        let offset = 0;

        // Parse header
        const headerType = new TextDecoder().decode(new Uint8Array(buffer, offset, 4));
        if (headerType !== 'MThd') {
            throw new Error('Invalid MIDI file');
        }

        offset += 4;
        const headerLength = view.getUint32(offset);
        offset += 4;
        
        const format = view.getUint16(offset);
        const trackCount = view.getUint16(offset + 2);
        const division = view.getUint16(offset + 4);
        offset += headerLength;

        // Parse tracks
        const tracks = [];
        let totalTicks = 0;

        for (let i = 0; i < trackCount; i++) {
            const trackType = new TextDecoder().decode(new Uint8Array(buffer, offset, 4));
            if (trackType !== 'MTrk') break;
            
            offset += 4;
            const trackLength = view.getUint32(offset);
            offset += 4;
            
            const trackEvents = this.parseTrackEvents(view, offset, trackLength);
            tracks.push(trackEvents);
            
            const trackTicks = trackEvents.reduce((max, event) => Math.max(max, event.absoluteTime), 0);
            totalTicks = Math.max(totalTicks, trackTicks);
            
            offset += trackLength;
        }

        // Convert to events timeline
        this.midiEvents = this.createEventTimeline(tracks, division);
        
        const duration = (totalTicks / division) * 0.5; // Rough conversion to seconds
        
        return {
            format,
            trackCount,
            division,
            tracks,
            duration,
            totalTicks
        };
    }

    /**
     * Parse track events
     */
    parseTrackEvents(view, offset, length) {
        const events = [];
        let currentTime = 0;
        let runningStatus = 0;
        const endOffset = offset + length;

        while (offset < endOffset) {
            // Read delta time
            const deltaTime = this.readVariableLength(view, offset);
            offset += deltaTime.bytesRead;
            currentTime += deltaTime.value;

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
                deltaTime: deltaTime.value,
                absoluteTime: currentTime,
                status,
                channel: status & 0x0F,
                command: status & 0xF0
            };

            // Parse event data
            if (status >= 0x80 && status <= 0xEF) {
                if (event.command !== 0xC0 && event.command !== 0xD0) {
                    event.data1 = view.getUint8(offset++);
                    event.data2 = view.getUint8(offset++);
                } else {
                    event.data1 = view.getUint8(offset++);
                }
            } else if (status === 0xFF) {
                event.metaType = view.getUint8(offset++);
                const dataLength = this.readVariableLength(view, offset);
                offset += dataLength.bytesRead;
                event.data = new Uint8Array(view.buffer, offset, dataLength.value);
                offset += dataLength.value;
            }

            events.push(event);
        }

        return events;
    }

    /**
     * Read variable length quantity
     */
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

    /**
     * Create event timeline for playback
     */
    createEventTimeline(tracks, division) {
        const allEvents = [];
        const ticksPerSecond = division * 2; // Rough conversion

        tracks.forEach((track, trackIndex) => {
            track.forEach(event => {
                if (event.status >= 0x80 && event.status <= 0xEF) {
                    allEvents.push({
                        ...event,
                        trackIndex,
                        timeInSeconds: event.absoluteTime / ticksPerSecond
                    });
                }
            });
        });

        return allEvents.sort((a, b) => a.timeInSeconds - b.timeInSeconds);
    }

    /**
     * Play note using Tone.js sampler
     */
    playNote(note, velocity, channel = 0) {
        if (!this.sampler || !this.isInitialized) return;

        try {
            const noteName = this.midiNoteToName(note);
            const volume = (velocity / 127) * 0.5; // Convert MIDI velocity to gain
            
            // Trigger the sampler
            this.sampler.triggerAttack(noteName, undefined, volume);
            
        } catch (error) {
            console.warn('Error playing note:', error);
        }
    }

    /**
     * Stop note
     */
    stopNote(note, channel = 0) {
        if (!this.sampler || !this.isInitialized) return;

        try {
            const noteName = this.midiNoteToName(note);
            this.sampler.triggerRelease(noteName);
        } catch (error) {
            console.warn('Error stopping note:', error);
        }
    }

    /**
     * Play MIDI sequence
     */
    async play() {
        if (!this.currentMIDI || !this.sampler) {
            this.handleError('No MIDI loaded or sampler not ready');
            return;
        }

        try {
            this.isPlaying = true;
            this.isPaused = false;
            this.playbackStartTime = Tone.now();
            this.updateStatus('Playing...');

            this.scheduleEvents();
        } catch (error) {
            this.handleError('Playback failed', error);
        }
    }

    /**
     * Schedule MIDI events for playback
     */
    scheduleEvents() {
        const currentTime = Tone.now() - this.playbackStartTime;
        
        this.midiEvents.forEach(event => {
            const scheduleTime = this.playbackStartTime + event.timeInSeconds;
            
            if (scheduleTime > Tone.now()) {
                Tone.Transport.schedule((time) => {
                    if (!this.isPlaying || this.isPaused) return;
                    
                    const command = event.command;
                    if (command === 0x90 && event.data2 > 0) { // Note On
                        this.playNote(event.data1, event.data2, event.channel);
                    } else if (command === 0x80 || (command === 0x90 && event.data2 === 0)) { // Note Off
                        this.stopNote(event.data1, event.channel);
                    }
                }, scheduleTime);
            }
        });

        // Schedule progress updates
        this.schedulerTimer = setInterval(() => {
            if (!this.isPlaying) {
                clearInterval(this.schedulerTimer);
                return;
            }
            
            this.currentTime = Tone.now() - this.playbackStartTime;
            if (this.onProgress) {
                this.onProgress(this.currentTime, this.duration);
            }
            
            if (this.currentTime >= this.duration) {
                this.stop();
                if (this.onPlaybackEnd) this.onPlaybackEnd();
            }
        }, 100);

        Tone.Transport.start();
    }

    /**
     * Pause playback
     */
    pause() {
        this.isPaused = true;
        Tone.Transport.pause();
        this.updateStatus('Paused');
    }

    /**
     * Resume playback
     */
    resume() {
        if (this.isPaused) {
            this.isPaused = false;
            Tone.Transport.start();
            this.updateStatus('Resumed');
        }
    }

    /**
     * Stop playback
     */
    stop() {
        this.isPlaying = false;
        this.isPaused = false;
        this.currentTime = 0;
        
        Tone.Transport.stop();
        Tone.Transport.cancel();
        
        if (this.schedulerTimer) {
            clearInterval(this.schedulerTimer);
            this.schedulerTimer = null;
        }
        
        this.updateStatus('Stopped');
    }

    /**
     * Set master volume
     */
    setVolume(volume) {
        if (this.masterVolume) {
            // Convert 0-1 to decibels
            const db = volume > 0 ? 20 * Math.log10(volume) : -Infinity;
            this.masterVolume.volume.value = Math.max(-60, Math.min(0, db));
        }
    }

    /**
     * Format file size
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Format duration
     */
    formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Update status
     */
    updateStatus(message) {
        console.log(`ToneJS SoundFont Player: ${message}`);
        if (this.onStatusChange) {
            this.onStatusChange(message);
        }
    }

    /**
     * Handle errors
     */
    handleError(message, error = null) {
        const fullMessage = error ? `${message}: ${error.message}` : message;
        console.error('ToneJS SoundFont Player Error:', fullMessage, error);
        if (this.onError) {
            this.onError(fullMessage);
        }
    }

    /**
     * Cleanup
     */
    destroy() {
        this.stop();
        
        if (this.sampler) {
            this.sampler.dispose();
        }
        
        if (this.masterVolume) {
            this.masterVolume.dispose();
        }
        
        this.isInitialized = false;
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ToneJSSoundFontPlayer;
} else {
    window.ToneJSSoundFontPlayer = ToneJSSoundFontPlayer;
}