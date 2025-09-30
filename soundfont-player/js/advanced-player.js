/**
 * AudioVerse Advanced SoundFont Player
 * Integrates with SpessaSynth libraries for full SF2/DLS support
 * https://github.com/spessasus/SpessaSynth
 */

class AdvancedSoundFontPlayer {
    constructor() {
        // Use the ToneJS SoundFont player as the engine
        this.tonePlayer = new ToneJSSoundFontPlayer();
        
        // Legacy properties for compatibility
        this.audioContext = null;
        this.synthesizer = null;
        this.sequencer = null;
        this.workletNode = null;
        this.isInitialized = false;
        this.currentSoundFont = null;
        this.currentSequence = null;
        
        // Event callbacks
        this.onReady = null;
        this.onError = null;
        this.onProgress = null;
        this.onStatusChange = null;
        this.onPlaybackEnd = null;
        
        // Playback state
        this.isPlaying = false;
        this.isPaused = false;
        this.currentTime = 0;
        this.duration = 0;
        
        // Set up ToneJS player callbacks
        this.setupTonePlayerCallbacks();
        
        this.updateStatus('Player created with ToneJS SoundFont Engine');
    }

    /**
     * Set up callbacks for the ToneJS player
     */
    setupTonePlayerCallbacks() {
        this.tonePlayer.onReady = () => {
            this.isInitialized = true;
            if (this.onReady) this.onReady();
        };
        
        this.tonePlayer.onError = (error) => {
            if (this.onError) this.onError(error);
        };
        
        this.tonePlayer.onProgress = (current, total) => {
            this.currentTime = current;
            this.duration = total;
            if (this.onProgress) this.onProgress(current, total);
        };
        
        this.tonePlayer.onStatusChange = (status) => {
            this.updateStatus(status);
        };
        
        this.tonePlayer.onPlaybackEnd = () => {
            this.isPlaying = false;
            this.isPaused = false;
            if (this.onPlaybackEnd) this.onPlaybackEnd();
        };
    }

    /**
     * Initialize the advanced player with ToneJS SoundFont integration
     */
    async initialize() {
        try {
            this.updateStatus('Initializing ToneJS SoundFont engine...');
            
            // Initialize the ToneJS player
            const success = await this.tonePlayer.initialize();
            if (!success) {
                throw new Error('Failed to initialize ToneJS SoundFont engine');
            }

            // Update our properties
            this.isInitialized = true;
            this.updateStatus('ToneJS SoundFont engine ready');
            
            if (this.onReady) this.onReady();
            return true;
        } catch (error) {
            this.handleError('Initialization failed', error);
            return false;
        }
    }



    /**
     * Load SoundFont using ToneJS SoundFont engine
     */
    async loadSoundFont(soundFontData) {
        try {
            this.updateStatus('Loading SoundFont with ToneJS Engine...');
            
            // Use the ToneJS player to load the SoundFont
            const success = await this.tonePlayer.loadSoundFont(soundFontData);
            if (!success) {
                throw new Error('Failed to load SoundFont with ToneJS Engine');
            }

            // Update our properties
            this.currentSoundFont = this.tonePlayer.currentSoundFont;
            
            const fileName = soundFontData instanceof File ? soundFontData.name : 'Unknown SoundFont';
            this.updateStatus(`SoundFont loaded: ${fileName}`);
            return true;
        } catch (error) {
            this.handleError('Failed to load SoundFont', error);
            return false;
        }
    }

    /**
     * Parse SF2 presets (simplified implementation)
     */
    parsePresets(buffer) {
        // This would use SpessaSynth's actual SF2 parsing
        // For demonstration, create some default presets
        const presets = new Map();
        
        // Add some common GM presets
        const gmPresets = [
            'Acoustic Grand Piano', 'Bright Acoustic Piano', 'Electric Grand Piano',
            'Honky-tonk Piano', 'Electric Piano 1', 'Electric Piano 2', 'Harpsichord',
            'Clavi', 'Celesta', 'Glockenspiel', 'Music Box', 'Vibraphone'
        ];
        
        gmPresets.forEach((name, index) => {
            presets.set(index, {
                id: index,
                name: name,
                bank: 0,
                program: index
            });
        });
        
        return presets;
    }

    /**
     * Load MIDI sequence using Real SoundFont engine
     */
    async loadMIDI(midiData) {
        try {
            this.updateStatus('Loading MIDI sequence with Real Engine...');
            
            // Use the real player to load the MIDI
            const success = await this.realPlayer.loadMIDI(midiData);
            if (!success) {
                throw new Error('Failed to load MIDI with Real Engine');
            }

            // Update our properties
            this.currentSequence = this.realPlayer.currentMIDI;
            this.duration = this.currentSequence?.duration || 0;
            
            const fileName = midiData instanceof File ? midiData.name : 'Unknown MIDI';
            this.updateStatus(`MIDI loaded: ${fileName} (${this.formatDuration(this.duration)})`);
            
            return true;
        } catch (error) {
            this.handleError('Failed to load MIDI', error);
            return false;
        }
    }

    /**
     * Parse MIDI file format
     */
    parseMIDIFile(buffer) {
        const view = new DataView(buffer);
        let offset = 0;

        // Parse header chunk
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

        // Parse tracks
        for (let i = 0; i < trackCount; i++) {
            const trackChunk = this.readChunk(view, offset);
            if (trackChunk.type !== 'MTrk') {
                throw new Error(`Invalid track ${i}`);
            }

            const trackEvents = this.parseTrackEvents(view, offset + 8, trackChunk.length);
            tracks.push(trackEvents);
            
            // Calculate total duration
            const trackTicks = trackEvents.reduce((max, event) => Math.max(max, event.absoluteTime), 0);
            totalTicks = Math.max(totalTicks, trackTicks);
            
            offset += 8 + trackChunk.length;
        }

        // Convert ticks to seconds (simplified)
        const tempo = 500000; // Default tempo (120 BPM)
        const ticksPerSecond = division * (1000000 / tempo);
        const duration = totalTicks / ticksPerSecond;

        return {
            format,
            trackCount,
            division,
            tracks,
            duration,
            tempo,
            totalTicks
        };
    }

    /**
     * Read a MIDI chunk
     */
    readChunk(view, offset) {
        const type = new TextDecoder().decode(new Uint8Array(view.buffer, offset, 4));
        const length = view.getUint32(offset + 4);
        return { type, length };
    }

    /**
     * Parse track events (simplified)
     */
    parseTrackEvents(view, offset, length) {
        const events = [];
        let currentTime = 0;
        let runningStatus = 0;
        const endOffset = offset + length;

        while (offset < endOffset) {
            // Read delta time
            const { value: deltaTime, bytesRead } = this.readVariableLength(view, offset);
            offset += bytesRead;
            currentTime += deltaTime;

            // Read event
            let status = view.getUint8(offset);
            if (status < 0x80) {
                // Running status
                status = runningStatus;
                offset--; // Back up since we didn't consume the status byte
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

            // Parse event data based on type
            if (status >= 0x80 && status <= 0xEF) {
                // Channel message
                event.channel = status & 0x0F;
                event.command = status & 0xF0;
                
                if (event.command !== 0xC0 && event.command !== 0xD0) {
                    // Two data bytes
                    event.data1 = view.getUint8(offset++);
                    event.data2 = view.getUint8(offset++);
                } else {
                    // One data byte
                    event.data1 = view.getUint8(offset++);
                }
            } else if (status === 0xFF) {
                // Meta event
                event.metaType = view.getUint8(offset++);
                const { value: dataLength, bytesRead: lengthBytes } = this.readVariableLength(view, offset);
                offset += lengthBytes;
                
                event.data = new Uint8Array(view.buffer, offset, dataLength);
                offset += dataLength;
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
     * Get event type from status byte
     */
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
     * Start playback using ToneJS SoundFont engine
     */
    async play() {
        try {
            // Use the ToneJS player to start playback
            await this.tonePlayer.play();
            
            // Update our state
            this.isPlaying = this.tonePlayer.isPlaying;
            this.isPaused = this.tonePlayer.isPaused;
        } catch (error) {
            this.handleError('Playback failed', error);
        }
    }

    /**
     * Start the MIDI sequencer
     */
    async startSequencer() {
        if (!this.currentSequence) return;

        const startTime = this.audioContext.currentTime;
        let eventIndex = 0;
        const events = this.getAllEvents();

        const scheduleEvents = () => {
            const currentAudioTime = this.audioContext.currentTime - startTime;
            
            while (eventIndex < events.length && !this.isPaused) {
                const event = events[eventIndex];
                const eventTime = event.timeInSeconds;
                
                if (eventTime <= currentAudioTime + 0.1) { // 100ms lookahead
                    this.processEvent(event);
                    eventIndex++;
                } else {
                    break;
                }
            }

            // Update progress
            this.currentTime = currentAudioTime;
            if (this.onProgress) {
                this.onProgress(this.currentTime, this.duration);
            }

            // Continue scheduling if not finished
            if (eventIndex < events.length && this.isPlaying && !this.isPaused) {
                requestAnimationFrame(scheduleEvents);
            } else if (eventIndex >= events.length) {
                this.stop();
                if (this.onPlaybackEnd) this.onPlaybackEnd();
            }
        };

        scheduleEvents();
    }

    /**
     * Get all events from all tracks, sorted by time
     */
    getAllEvents() {
        if (!this.currentSequence) return [];
        
        const allEvents = [];
        const ticksPerSecond = this.currentSequence.division * (1000000 / this.currentSequence.tempo);

        this.currentSequence.tracks.forEach((track, trackIndex) => {
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

    /**
     * Process a MIDI event
     */
    processEvent(event) {
        switch (event.type) {
            case 'noteOn':
                if (event.data2 > 0) { // Velocity > 0
                    this.playNote(event.data1, event.data2, event.channel);
                } else {
                    this.stopNote(event.data1, event.channel);
                }
                break;
            case 'noteOff':
                this.stopNote(event.data1, event.channel);
                break;
            case 'programChange':
                this.changeProgram(event.data1, event.channel);
                break;
            case 'controller':
                this.handleController(event.data1, event.data2, event.channel);
                break;
        }
    }

    /**
     * Play a note using ToneJS SoundFont engine
     */
    playNote(note, velocity, channel = 0) {
        if (!this.tonePlayer || !this.tonePlayer.isInitialized) return;

        // Use the ToneJS player to play the note
        this.tonePlayer.playNote(note, velocity, channel);
    }

    /**
     * Stop a note using ToneJS SoundFont engine
     */
    stopNote(note, channel = 0) {
        if (!this.tonePlayer || !this.tonePlayer.isInitialized) return;

        // Use the ToneJS player to stop the note
        this.tonePlayer.stopNote(note, channel);
    }

    /**
     * Change program (instrument)
     */
    changeProgram(program, channel) {
        console.log(`Program change: ${program} on channel ${channel}`);
    }

    /**
     * Handle controller messages
     */
    handleController(controller, value, channel) {
        console.log(`Controller ${controller} = ${value} on channel ${channel}`);
    }

    /**
     * Pause playback using ToneJS SoundFont engine
     */
    pause() {
        this.tonePlayer.pause();
        this.isPaused = this.tonePlayer.isPaused;
    }

    /**
     * Resume playback using ToneJS SoundFont engine
     */
    resume() {
        this.tonePlayer.resume();
        this.isPaused = this.tonePlayer.isPaused;
        this.isPlaying = this.tonePlayer.isPlaying;
    }

    /**
     * Stop playback using ToneJS SoundFont engine
     */
    stop() {
        this.tonePlayer.stop();
        this.isPlaying = this.tonePlayer.isPlaying;
        this.isPaused = this.tonePlayer.isPaused;
        this.currentTime = 0;
    }

    /**
     * Seek to position
     */
    seek(timeInSeconds) {
        this.currentTime = Math.max(0, Math.min(timeInSeconds, this.duration));
        if (this.isPlaying) {
            // Would restart playback from new position
        }
    }

    /**
     * Set master volume using ToneJS SoundFont engine
     */
    setVolume(volume) {
        if (this.tonePlayer) {
            this.tonePlayer.setVolume(volume);
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
        console.log(`Advanced Player: ${message}`);
        if (this.onStatusChange) {
            this.onStatusChange(message);
        }
    }

    /**
     * Handle errors
     */
    handleError(message, error = null) {
        const fullMessage = error ? `${message}: ${error.message}` : message;
        console.error('Advanced Player Error:', fullMessage);
        if (this.onError) {
            this.onError(fullMessage);
        }
    }

    /**
     * Clean up
     */
    destroy() {
        this.stop();
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }
        this.audioContext = null;
        this.workletNode = null;
        this.currentSoundFont = null;
        this.currentSequence = null;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioVerseAdvancedPlayer;
} else {
    window.AudioVerseAdvancedPlayer = AudioVerseAdvancedPlayer;
}