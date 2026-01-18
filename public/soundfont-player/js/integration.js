/**
 * AudioVerse SoundFont Player Integration
 * Simple integration example for adding SoundFont playback to AudioVerse
 */

class AudioVerseSoundFontIntegration {
    constructor() {
        this.player = null;
        this.isIntegrated = false;
    }

    /**
     * Integrate SoundFont player into existing AudioVerse interface
     */
    async integrate(container, options = {}) {
        try {
            // Create container if it doesn't exist
            if (typeof container === 'string') {
                container = document.getElementById(container) || document.querySelector(container);
            }

            if (!container) {
                throw new Error('Container element not found');
            }

            // Load the SoundFont player styles
            await this.loadStyles();

            // Create minimal player interface
            container.innerHTML = this.createMinimalInterface();

            // Initialize the player
            this.player = new AudioVerseAdvancedPlayer();
            
            // Set up basic callbacks
            this.player.onReady = () => {
                console.log('SoundFont player ready for AudioVerse integration');
                this.isIntegrated = true;
            };

            this.player.onError = (error) => {
                console.error('SoundFont player error:', error);
            };

            // Initialize
            await this.player.initialize();

            // Set up basic controls
            this.setupBasicControls(container);

            return true;
        } catch (error) {
            console.error('Failed to integrate SoundFont player:', error);
            return false;
        }
    }

    /**
     * Load necessary CSS styles
     */
    async loadStyles() {
        return new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'soundfont-player/css/player-styles.css';
            link.onload = resolve;
            link.onerror = reject;
            document.head.appendChild(link);
        });
    }

    /**
     * Create minimal interface for integration
     */
    createMinimalInterface() {
        return `
            <div class="audioverse-soundfont-integration" style="background: #2d3748; padding: 20px; border-radius: 8px; margin: 10px 0;">
                <h3 style="color: #3182ce; margin: 0 0 15px 0;">
                    <i class="fas fa-music"></i> SoundFont Player
                </h3>
                
                <div style="display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap;">
                    <input type="file" id="sf-quick-load" accept=".sf2,.sf3,.dls" style="display: none;">
                    <button class="quick-button" onclick="document.getElementById('sf-quick-load').click()">
                        Load SoundFont
                    </button>
                    
                    <input type="file" id="midi-quick-load" accept=".mid,.midi" style="display: none;">
                    <button class="quick-button" onclick="document.getElementById('midi-quick-load').click()">
                        Load MIDI
                    </button>
                    
                    <button class="quick-button" id="quick-play" disabled>Play</button>
                    <button class="quick-button" id="quick-stop" disabled>Stop</button>
                </div>
                
                <div style="margin-bottom: 10px;">
                    <div style="background: #4a5568; height: 4px; border-radius: 2px; overflow: hidden;">
                        <div id="quick-progress" style="background: #3182ce; height: 100%; width: 0%; transition: width 0.1s;"></div>
                    </div>
                </div>
                
                <div id="quick-status" style="font-size: 12px; color: #a0aec0; font-family: monospace;">
                    Ready to load SoundFont and MIDI files
                </div>
            </div>
            
            <style>
                .quick-button {
                    background: #3182ce;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    transition: background 0.3s;
                }
                .quick-button:hover:not(:disabled) {
                    background: #2c5aa0;
                }
                .quick-button:disabled {
                    background: #4a5568;
                    cursor: not-allowed;
                }
            </style>
        `;
    }

    /**
     * Set up basic control functionality
     */
    setupBasicControls(container) {
        const sfInput = container.querySelector('#sf-quick-load');
        const midiInput = container.querySelector('#midi-quick-load');
        const playBtn = container.querySelector('#quick-play');
        const stopBtn = container.querySelector('#quick-stop');
        const progress = container.querySelector('#quick-progress');
        const status = container.querySelector('#quick-status');

        let hasSound = false;
        let hasMidi = false;

        // SoundFont loading
        sfInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file && this.player) {
                status.textContent = 'Loading SoundFont...';
                const success = await this.player.loadSoundFont(file);
                if (success) {
                    hasSound = true;
                    status.textContent = `SoundFont loaded: ${file.name}`;
                    this.updateButtons();
                } else {
                    status.textContent = 'Failed to load SoundFont';
                }
            }
        });

        // MIDI loading
        midiInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file && this.player) {
                status.textContent = 'Loading MIDI...';
                const success = await this.player.loadMIDI(file);
                if (success) {
                    hasMidi = true;
                    status.textContent = `MIDI loaded: ${file.name}`;
                    this.updateButtons();
                } else {
                    status.textContent = 'Failed to load MIDI';
                }
            }
        });

        // Play button
        playBtn.addEventListener('click', () => {
            if (this.player && hasSound && hasMidi) {
                this.player.play();
                status.textContent = 'Playing...';
            }
        });

        // Stop button
        stopBtn.addEventListener('click', () => {
            if (this.player) {
                this.player.stop();
                progress.style.width = '0%';
                status.textContent = 'Stopped';
            }
        });

        // Progress updates
        if (this.player) {
            this.player.onProgress = (current, total) => {
                const percentage = total > 0 ? (current / total) * 100 : 0;
                progress.style.width = `${percentage}%`;
            };
        }

        // Update button states
        const updateButtons = () => {
            const canPlay = hasSound && hasMidi;
            playBtn.disabled = !canPlay;
            stopBtn.disabled = !canPlay;
        };

        this.updateButtons = updateButtons;
    }

    /**
     * Quick play a note (for testing or immediate feedback)
     */
    quickPlayNote(note, velocity = 100, duration = 1000) {
        if (this.player && this.player.currentSoundFont) {
            this.player.playNote(note, velocity, 0);
            setTimeout(() => {
                this.player.stopNote(note, 0);
            }, duration);
        }
    }

    /**
     * Load a SoundFont programmatically
     */
    async loadSoundFont(url) {
        if (!this.player) return false;
        
        try {
            const response = await fetch(url);
            const buffer = await response.arrayBuffer();
            return await this.player.loadSoundFont(buffer);
        } catch (error) {
            console.error('Failed to load SoundFont from URL:', error);
            return false;
        }
    }

    /**
     * Load a MIDI file programmatically
     */
    async loadMIDI(url) {
        if (!this.player) return false;
        
        try {
            const response = await fetch(url);
            const buffer = await response.arrayBuffer();
            return await this.player.loadMIDI(buffer);
        } catch (error) {
            console.error('Failed to load MIDI from URL:', error);
            return false;
        }
    }

    /**
     * Clean up
     */
    destroy() {
        if (this.player) {
            this.player.destroy();
            this.player = null;
        }
        this.isIntegrated = false;
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioVerseSoundFontIntegration;
} else {
    window.AudioVerseSoundFontIntegration = AudioVerseSoundFontIntegration;
}