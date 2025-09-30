/**
 * Virtual Keyboard for AudioVerse SoundFont Player
 * Creates an interactive piano keyboard interface
 */

class VirtualKeyboard {
    constructor(container) {
        this.container = container;
        this.keys = new Map();
        this.activeKeys = new Set();
        
        // Callbacks
        this.onKeyPress = null;
        this.onKeyRelease = null;
        
        // Configuration
        this.startNote = 48; // C3
        this.endNote = 84;   // C6 (3 octaves)
        this.keyWidth = 40;
        this.keyHeight = 200;
        this.blackKeyWidth = 28;
        this.blackKeyHeight = 120;
        
        this.initializeKeyboard();
        this.setupEventListeners();
    }

    /**
     * Initialize the keyboard layout
     */
    initializeKeyboard() {
        this.container.innerHTML = '';
        this.container.style.position = 'relative';
        this.container.style.display = 'flex';
        this.container.style.justifyContent = 'center';
        
        // Create keys
        for (let note = this.startNote; note <= this.endNote; note++) {
            const keyElement = this.createKey(note);
            this.keys.set(note, keyElement);
            this.container.appendChild(keyElement);
        }
    }

    /**
     * Create a single key element
     */
    createKey(note) {
        const isBlackKey = this.isBlackKey(note);
        const key = document.createElement('div');
        
        key.className = `key ${isBlackKey ? 'black' : 'white'}`;
        key.dataset.note = note;
        key.setAttribute('data-tooltip', this.getNoteLabel(note));
        
        // Set dimensions and positioning
        if (isBlackKey) {
            key.style.width = `${this.blackKeyWidth}px`;
            key.style.height = `${this.blackKeyHeight}px`;
            key.style.position = 'absolute';
            key.style.zIndex = '2';
            key.style.left = `${this.getBlackKeyPosition(note)}px`;
        } else {
            key.style.width = `${this.keyWidth}px`;
            key.style.height = `${this.keyHeight}px`;
            key.style.position = 'relative';
            key.style.zIndex = '1';
        }
        
        // Add note label for white keys
        if (!isBlackKey) {
            const label = document.createElement('span');
            label.textContent = this.getNoteLabel(note);
            label.style.position = 'absolute';
            label.style.bottom = '10px';
            label.style.left = '50%';
            label.style.transform = 'translateX(-50%)';
            label.style.fontSize = '10px';
            label.style.color = '#666';
            label.style.userSelect = 'none';
            key.appendChild(label);
        }
        
        return key;
    }

    /**
     * Set up event listeners for keyboard interaction
     */
    setupEventListeners() {
        // Mouse events
        this.container.addEventListener('mousedown', this.handleMouseDown.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        
        // Touch events for mobile
        this.container.addEventListener('touchstart', this.handleTouchStart.bind(this));
        document.addEventListener('touchend', this.handleTouchEnd.bind(this));
        document.addEventListener('touchmove', this.handleTouchMove.bind(this));
        
        // Prevent context menu on right click
        this.container.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    /**
     * Handle mouse down events
     */
    handleMouseDown(e) {
        e.preventDefault();
        const key = e.target.closest('.key');
        if (key) {
            const note = parseInt(key.dataset.note);
            this.pressKey(note);
        }
    }

    /**
     * Handle mouse up events
     */
    handleMouseUp(e) {
        // Release all active keys on mouse up
        for (const note of this.activeKeys) {
            this.releaseKey(note);
        }
    }

    /**
     * Handle mouse move for drag playing
     */
    handleMouseMove(e) {
        if (e.buttons === 1) { // Left mouse button is pressed
            const elementUnder = document.elementFromPoint(e.clientX, e.clientY);
            const key = elementUnder?.closest('.key');
            
            if (key) {
                const note = parseInt(key.dataset.note);
                if (!this.activeKeys.has(note)) {
                    // Release other keys first
                    for (const activeNote of this.activeKeys) {
                        this.releaseKey(activeNote);
                    }
                    this.pressKey(note);
                }
            }
        }
    }

    /**
     * Handle touch start events
     */
    handleTouchStart(e) {
        e.preventDefault();
        for (const touch of e.changedTouches) {
            const element = document.elementFromPoint(touch.clientX, touch.clientY);
            const key = element?.closest('.key');
            if (key) {
                const note = parseInt(key.dataset.note);
                this.pressKey(note);
            }
        }
    }

    /**
     * Handle touch end events
     */
    handleTouchEnd(e) {
        e.preventDefault();
        // For touch, we release all keys on touch end
        for (const note of this.activeKeys) {
            this.releaseKey(note);
        }
    }

    /**
     * Handle touch move events
     */
    handleTouchMove(e) {
        e.preventDefault();
        // Handle touch move similar to mouse move
        for (const touch of e.changedTouches) {
            const element = document.elementFromPoint(touch.clientX, touch.clientY);
            const key = element?.closest('.key');
            if (key) {
                const note = parseInt(key.dataset.note);
                if (!this.activeKeys.has(note)) {
                    // Release other keys and press new one
                    for (const activeNote of this.activeKeys) {
                        this.releaseKey(activeNote);
                    }
                    this.pressKey(note);
                }
            }
        }
    }

    /**
     * Press a key (visually and trigger sound)
     */
    pressKey(note) {
        if (this.activeKeys.has(note)) return;
        
        const keyElement = this.keys.get(note);
        if (keyElement) {
            keyElement.classList.add('pressed');
            this.activeKeys.add(note);
            
            // Trigger callback
            if (this.onKeyPress) {
                this.onKeyPress(note);
            }
        }
    }

    /**
     * Release a key
     */
    releaseKey(note) {
        if (!this.activeKeys.has(note)) return;
        
        const keyElement = this.keys.get(note);
        if (keyElement) {
            keyElement.classList.remove('pressed');
            this.activeKeys.delete(note);
            
            // Trigger callback
            if (this.onKeyRelease) {
                this.onKeyRelease(note);
            }
        }
    }

    /**
     * Check if a note is a black key
     */
    isBlackKey(note) {
        const noteInOctave = note % 12;
        return [1, 3, 6, 8, 10].includes(noteInOctave);
    }

    /**
     * Get the position for a black key
     */
    getBlackKeyPosition(note) {
        const noteInOctave = note % 12;
        const octave = Math.floor((note - this.startNote) / 12);
        const whiteKeysInOctave = 7;
        const octaveWidth = whiteKeysInOctave * this.keyWidth;
        
        // Count white keys before this note
        let whiteKeysBefore = 0;
        for (let n = this.startNote; n < note; n++) {
            if (!this.isBlackKey(n)) {
                whiteKeysBefore++;
            }
        }
        
        // Black key positions relative to white keys
        const blackKeyOffsets = {
            1: 0.7,   // C#
            3: 1.7,   // D#
            6: 3.7,   // F#
            8: 4.7,   // G#
            10: 5.7   // A#
        };
        
        const offset = blackKeyOffsets[noteInOctave] || 0;
        const octaveOffset = Math.floor((note - this.startNote) / 12) * whiteKeysInOctave;
        
        return (whiteKeysBefore + offset - octaveOffset) * this.keyWidth - this.blackKeyWidth / 2;
    }

    /**
     * Get note label (e.g., "C4", "F#5")
     */
    getNoteLabel(note) {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(note / 12) - 1;
        const noteName = noteNames[note % 12];
        return `${noteName}${octave}`;
    }

    /**
     * Highlight keys for a chord or scale
     */
    highlightKeys(notes, className = 'highlighted') {
        // Remove existing highlights
        this.clearHighlights(className);
        
        // Add highlights to specified notes
        notes.forEach(note => {
            const keyElement = this.keys.get(note);
            if (keyElement) {
                keyElement.classList.add(className);
            }
        });
    }

    /**
     * Clear all highlights
     */
    clearHighlights(className = 'highlighted') {
        this.keys.forEach(keyElement => {
            keyElement.classList.remove(className);
        });
    }

    /**
     * Set the keyboard range
     */
    setRange(startNote, endNote) {
        this.startNote = startNote;
        this.endNote = endNote;
        this.initializeKeyboard();
    }

    /**
     * Get all currently active keys
     */
    getActiveKeys() {
        return Array.from(this.activeKeys);
    }

    /**
     * Release all keys
     */
    releaseAllKeys() {
        for (const note of this.activeKeys) {
            this.releaseKey(note);
        }
    }

    /**
     * Resize the keyboard
     */
    resize(width, height) {
        this.keyWidth = width || this.keyWidth;
        this.keyHeight = height || this.keyHeight;
        this.blackKeyWidth = this.keyWidth * 0.7;
        this.blackKeyHeight = this.keyHeight * 0.6;
        this.initializeKeyboard();
    }

    /**
     * Enable/disable the keyboard
     */
    setEnabled(enabled) {
        this.container.style.pointerEvents = enabled ? 'auto' : 'none';
        this.container.style.opacity = enabled ? '1' : '0.5';
    }

    /**
     * Clean up event listeners and resources
     */
    destroy() {
        this.releaseAllKeys();
        this.container.innerHTML = '';
        this.keys.clear();
        this.activeKeys.clear();
        
        // Remove event listeners would be here if we stored references
        // For now, they'll be cleaned up when the container is removed
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VirtualKeyboard;
} else {
    window.VirtualKeyboard = VirtualKeyboard;
}