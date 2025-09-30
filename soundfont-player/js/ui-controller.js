/**
 * UI Controller for AudioVerse SoundFont Player
 * Manages all user interface interactions and connects to the audio engine
 */

class SoundFontPlayerUI {
    constructor() {
        this.player = null;
        this.keyboard = null;
        this.isInitialized = false;
        
        // UI Elements
        this.elements = {};
        this.initializeElements();
        this.setupEventListeners();
        this.initializePlayer();
    }

    /**
     * Initialize UI elements
     */
    initializeElements() {
        this.elements = {
            // File inputs
            sfFileInput: document.getElementById('sf-file-input'),
            midiFileInput: document.getElementById('midi-file-input'),
            sfUploadCard: document.getElementById('sf-upload-card'),
            midiUploadCard: document.getElementById('midi-upload-card'),
            sfFileInfo: document.getElementById('sf-file-info'),
            midiFileInfo: document.getElementById('midi-file-info'),
            sfFileDetails: document.getElementById('sf-file-details'),
            midiFileDetails: document.getElementById('midi-file-details'),

            // Playback controls
            playBtn: document.getElementById('play-btn'),
            pauseBtn: document.getElementById('pause-btn'),
            stopBtn: document.getElementById('stop-btn'),
            rewindBtn: document.getElementById('rewind-btn'),
            
            // Progress and time
            progressBar: document.getElementById('progress-bar'),
            progressFill: document.getElementById('progress-fill'),
            currentTime: document.getElementById('current-time'),
            totalTime: document.getElementById('total-time'),
            
            // Volume
            volumeSlider: document.getElementById('volume-slider'),
            volumeDisplay: document.getElementById('volume-display'),
            
            // Status
            statusDisplay: document.getElementById('status-display'),
            
            // Settings
            voiceLimit: document.getElementById('voice-limit'),
            voiceLimitDisplay: document.getElementById('voice-limit-display'),
            reverbLevel: document.getElementById('reverb-level'),
            reverbDisplay: document.getElementById('reverb-display'),
            chorusLevel: document.getElementById('chorus-level'),
            chorusDisplay: document.getElementById('chorus-display'),
            resetBtn: document.getElementById('reset-btn'),
            
            // Keyboard
            virtualKeyboard: document.getElementById('virtual-keyboard')
        };
    }

    /**
     * Set up all event listeners
     */
    setupEventListeners() {
        // File upload events
        this.setupFileUploads();
        
        // Playback control events
        this.setupPlaybackControls();
        
        // Progress bar interaction
        this.setupProgressBar();
        
        // Volume control
        this.setupVolumeControl();
        
        // Settings
        this.setupSettings();
        
        // Keyboard events
        this.setupKeyboardEvents();
    }

    /**
     * Set up file upload functionality
     */
    setupFileUploads() {
        // SoundFont file input
        this.elements.sfFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handleSoundFontUpload(file);
            }
        });

        // MIDI file input
        this.elements.midiFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handleMidiUpload(file);
            }
        });

        // Drag and drop for SoundFont
        this.setupDragAndDrop(this.elements.sfUploadCard, (files) => {
            const file = files[0];
            if (this.isValidSoundFontFile(file)) {
                this.handleSoundFontUpload(file);
            } else {
                this.showError('Invalid SoundFont file. Please select a .sf2, .sf3, or .dls file.');
            }
        });

        // Drag and drop for MIDI
        this.setupDragAndDrop(this.elements.midiUploadCard, (files) => {
            const file = files[0];
            if (this.isValidMidiFile(file)) {
                this.handleMidiUpload(file);
            } else {
                this.showError('Invalid MIDI file. Please select a .mid, .midi, .kar, or .rmi file.');
            }
        });
    }

    /**
     * Set up drag and drop functionality
     */
    setupDragAndDrop(element, callback) {
        element.addEventListener('dragover', (e) => {
            e.preventDefault();
            element.classList.add('dragover');
        });

        element.addEventListener('dragleave', () => {
            element.classList.remove('dragover');
        });

        element.addEventListener('drop', (e) => {
            e.preventDefault();
            element.classList.remove('dragover');
            const files = Array.from(e.dataTransfer.files);
            if (files.length > 0) {
                callback(files);
            }
        });
    }

    /**
     * Set up playback controls
     */
    setupPlaybackControls() {
        this.elements.playBtn.addEventListener('click', () => {
            if (this.player) {
                this.player.play();
                this.updatePlaybackState('playing');
            }
        });

        this.elements.pauseBtn.addEventListener('click', () => {
            if (this.player) {
                this.player.pause();
                this.updatePlaybackState('paused');
            }
        });

        this.elements.stopBtn.addEventListener('click', () => {
            if (this.player) {
                this.player.stop();
                this.updatePlaybackState('stopped');
            }
        });

        this.elements.rewindBtn.addEventListener('click', () => {
            if (this.player) {
                this.player.seek(0);
            }
        });
    }

    /**
     * Set up progress bar interaction
     */
    setupProgressBar() {
        this.elements.progressBar.addEventListener('click', (e) => {
            if (!this.player || !this.player.duration) return;
            
            const rect = this.elements.progressBar.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const progress = clickX / rect.width;
            const seekTime = progress * this.player.duration;
            
            this.player.seek(seekTime);
        });
    }

    /**
     * Set up volume control
     */
    setupVolumeControl() {
        this.elements.volumeSlider.addEventListener('input', (e) => {
            const volume = e.target.value / 100;
            if (this.player) {
                this.player.setVolume(volume);
            }
            this.elements.volumeDisplay.textContent = `${e.target.value}%`;
        });
    }

    /**
     * Set up settings controls
     */
    setupSettings() {
        // Voice limit
        this.elements.voiceLimit.addEventListener('input', (e) => {
            this.elements.voiceLimitDisplay.textContent = `${e.target.value} voices`;
            // Would apply to synthesizer
        });

        // Reverb
        this.elements.reverbLevel.addEventListener('input', (e) => {
            this.elements.reverbDisplay.textContent = `${e.target.value}%`;
            // Would apply reverb effect
        });

        // Chorus
        this.elements.chorusLevel.addEventListener('input', (e) => {
            this.elements.chorusDisplay.textContent = `${e.target.value}%`;
            // Would apply chorus effect
        });

        // Reset button
        this.elements.resetBtn.addEventListener('click', () => {
            this.resetSettings();
        });
    }

    /**
     * Set up keyboard events for computer keyboard input
     */
    setupKeyboardEvents() {
        document.addEventListener('keydown', (e) => {
            if (e.repeat) return; // Ignore held keys
            
            const note = this.getKeyboardNote(e.key.toLowerCase());
            if (note !== -1 && this.keyboard) {
                this.keyboard.pressKey(note);
                if (this.player) {
                    this.player.playNote(note, 100, 0); // channel 0, velocity 100
                }
            }
        });

        document.addEventListener('keyup', (e) => {
            const note = this.getKeyboardNote(e.key.toLowerCase());
            if (note !== -1 && this.keyboard) {
                this.keyboard.releaseKey(note);
                if (this.player) {
                    this.player.stopNote(note, 0);
                }
            }
        });
    }

    /**
     * Get MIDI note from keyboard key
     */
    getKeyboardNote(key) {
        const keyMap = {
            // White keys (C4 = 60)
            'a': 60, 's': 62, 'd': 64, 'f': 65, 'g': 67, 'h': 69, 'j': 71, 'k': 72,
            // Black keys
            'w': 61, 'e': 63, 't': 66, 'y': 68, 'u': 70, 'o': 73, 'p': 74
        };
        return keyMap[key] || -1;
    }

    /**
     * Initialize the audio player
     */
    async initializePlayer() {
        try {
            this.updateStatus('Initializing audio engine...');
            
            // Create player instance
            this.player = new AdvancedSoundFontPlayer();
            
            // Set up player callbacks
            this.player.onReady = () => {
                this.isInitialized = true;
                this.updateStatus('Audio engine ready. Load a SoundFont to begin.');
            };
            
            this.player.onError = (error) => {
                this.showError(error);
            };
            
            this.player.onStatusChange = (status) => {
                this.updateStatus(status);
            };
            
            this.player.onProgress = (current, total) => {
                this.updateProgress(current, total);
            };
            
            this.player.onPlaybackEnd = () => {
                this.updatePlaybackState('stopped');
            };
            
            // Initialize player
            await this.player.initialize();
            
            // Initialize virtual keyboard
            this.keyboard = new VirtualKeyboard(this.elements.virtualKeyboard);
            this.keyboard.onKeyPress = (note) => {
                if (this.player) {
                    this.player.playNote(note, 100, 0);
                }
            };
            this.keyboard.onKeyRelease = (note) => {
                if (this.player) {
                    this.player.stopNote(note, 0);
                }
            };
            
        } catch (error) {
            this.showError(`Failed to initialize player: ${error.message}`);
        }
    }

    /**
     * Handle SoundFont file upload
     */
    async handleSoundFontUpload(file) {
        try {
            this.updateStatus(`Loading SoundFont: ${file.name}...`);
            this.elements.sfFileDetails.textContent = `${file.name} (${this.formatFileSize(file.size)})`;
            this.elements.sfFileInfo.classList.add('visible');
            
            if (this.player) {
                const success = await this.player.loadSoundFont(file);
                if (success) {
                    this.elements.sfFileInfo.classList.add('success');
                    this.updateStatus(`SoundFont loaded successfully: ${file.name}`);
                    this.checkReadyState();
                } else {
                    this.elements.sfFileInfo.classList.add('error');
                    this.showError('Failed to load SoundFont');
                }
            }
        } catch (error) {
            this.elements.sfFileInfo.classList.add('error');
            this.showError(`Error loading SoundFont: ${error.message}`);
        }
    }

    /**
     * Handle MIDI file upload
     */
    async handleMidiUpload(file) {
        try {
            this.updateStatus(`Loading MIDI: ${file.name}...`);
            this.elements.midiFileDetails.textContent = `${file.name} (${this.formatFileSize(file.size)})`;
            this.elements.midiFileInfo.classList.add('visible');
            
            if (this.player) {
                const success = await this.player.loadMIDI(file);
                if (success) {
                    this.elements.midiFileInfo.classList.add('success');
                    this.updateStatus(`MIDI loaded successfully: ${file.name}`);
                    this.elements.totalTime.textContent = this.formatTime(this.player.duration);
                    this.checkReadyState();
                } else {
                    this.elements.midiFileInfo.classList.add('error');
                    this.showError('Failed to load MIDI file');
                }
            }
        } catch (error) {
            this.elements.midiFileInfo.classList.add('error');
            this.showError(`Error loading MIDI: ${error.message}`);
        }
    }

    /**
     * Check if player is ready for playback
     */
    checkReadyState() {
        const hasSound = this.player && this.player.currentSoundFont;
        const hasMidi = this.player && this.player.currentSequence;
        const canPlay = hasSound && hasMidi;
        
        // Enable/disable playback controls
        this.elements.playBtn.disabled = !canPlay;
        this.elements.pauseBtn.disabled = !canPlay;
        this.elements.stopBtn.disabled = !canPlay;
        this.elements.rewindBtn.disabled = !canPlay;
        
        if (canPlay) {
            this.updateStatus('Ready to play! Click the play button to start.');
        }
    }

    /**
     * Update playback state UI
     */
    updatePlaybackState(state) {
        const playIcon = this.elements.playBtn.querySelector('i');
        
        switch (state) {
            case 'playing':
                playIcon.className = 'fas fa-pause';
                this.elements.playBtn.setAttribute('data-tooltip', 'Pause');
                document.body.classList.add('playing');
                break;
            case 'paused':
                playIcon.className = 'fas fa-play';
                this.elements.playBtn.setAttribute('data-tooltip', 'Resume');
                document.body.classList.remove('playing');
                break;
            case 'stopped':
                playIcon.className = 'fas fa-play';
                this.elements.playBtn.setAttribute('data-tooltip', 'Play');
                document.body.classList.remove('playing');
                this.elements.progressFill.style.width = '0%';
                this.elements.currentTime.textContent = '0:00';
                break;
        }
    }

    /**
     * Update progress display
     */
    updateProgress(current, total) {
        if (total > 0) {
            const percentage = (current / total) * 100;
            this.elements.progressFill.style.width = `${percentage}%`;
            this.elements.currentTime.textContent = this.formatTime(current);
        }
    }

    /**
     * Update status display
     */
    updateStatus(message) {
        const timestamp = new Date().toLocaleTimeString();
        const statusLine = `[${timestamp}] ${message}\\n`;
        this.elements.statusDisplay.textContent += statusLine;
        this.elements.statusDisplay.scrollTop = this.elements.statusDisplay.scrollHeight;
    }

    /**
     * Show error message
     */
    showError(message) {
        this.updateStatus(`ERROR: ${message}`);
        console.error('SoundFont Player UI Error:', message);
    }

    /**
     * Reset all settings to defaults
     */
    resetSettings() {
        this.elements.voiceLimit.value = 256;
        this.elements.voiceLimitDisplay.textContent = '256 voices';
        this.elements.reverbLevel.value = 40;
        this.elements.reverbDisplay.textContent = '40%';
        this.elements.chorusLevel.value = 20;
        this.elements.chorusDisplay.textContent = '20%';
        this.elements.volumeSlider.value = 70;
        this.elements.volumeDisplay.textContent = '70%';
        
        if (this.player) {
            this.player.setVolume(0.7);
        }
        
        this.updateStatus('Settings reset to defaults');
    }

    /**
     * Validate SoundFont file
     */
    isValidSoundFontFile(file) {
        const validExtensions = ['.sf2', '.sf3', '.dls'];
        const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
        return validExtensions.includes(extension);
    }

    /**
     * Validate MIDI file
     */
    isValidMidiFile(file) {
        const validExtensions = ['.mid', '.midi', '.kar', '.rmi'];
        const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
        return validExtensions.includes(extension);
    }

    /**
     * Format file size for display
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Format time for display
     */
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Cleanup
     */
    destroy() {
        if (this.player) {
            this.player.destroy();
        }
        if (this.keyboard) {
            this.keyboard.destroy();
        }
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SoundFontPlayerUI;
} else {
    window.SoundFontPlayerUI = SoundFontPlayerUI;
}