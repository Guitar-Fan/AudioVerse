/*
 * REAPER Web - Track Controls
 * Manages track panel and individual track controls
 */

class TrackControls {
    constructor(app) {
        this.app = app;
        this.trackList = null;
        this.selectedTracks = new Set();
        this.trackElements = new Map();
    }
    
    initialize() {
        console.log('Initializing Track Controls...');
        
        this.trackList = document.getElementById('track-list');
        
        // Set up master track controls
        this.setupMasterTrackControls();
        
        // Set up event listeners
        this.setupEventListeners();
        
        console.log('Track Controls initialized');
    }
    
    setupMasterTrackControls() {
        const masterTrack = document.getElementById('master-track');
        if (!masterTrack) return;
        
        // Master volume control
        const masterVolume = document.getElementById('master-volume');
        if (masterVolume) {
            masterVolume.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                const dbValue = this.volumeSliderToDb(value);
                this.updateVolumeLabel(masterVolume, dbValue);
                this.app.setMasterVolume(this.dbToLinear(dbValue));
            });
            
            // Initialize label
            this.updateVolumeLabel(masterVolume, 0);
        }
        
        // Master pan control
        const masterPan = document.getElementById('master-pan');
        if (masterPan) {
            masterPan.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                const panValue = value / 100; // -1 to 1
                this.updatePanLabel(masterPan, panValue);
                this.app.setMasterPan(panValue);
            });
            
            // Initialize label
            this.updatePanLabel(masterPan, 0);
        }
        
        // Master mute/solo buttons
        document.getElementById('master-mute')?.addEventListener('click', (e) => {
            const track = this.app.getTrack('master');
            if (track) {
                track.mute = !track.mute;
                e.target.classList.toggle('active', track.mute);
            }
        });
        
        document.getElementById('master-solo')?.addEventListener('click', (e) => {
            const track = this.app.getTrack('master');
            if (track) {
                track.solo = !track.solo;
                e.target.classList.toggle('active', track.solo);
            }
        });
        
        // FX and I/O buttons
        masterTrack.querySelector('.fx-btn')?.addEventListener('click', () => {
            this.openEffectsWindow('master');
        });
        
        masterTrack.querySelector('.io-btn')?.addEventListener('click', () => {
            this.openIOWindow('master');
        });
    }
    
    setupEventListeners() {
        // Track selection
        document.addEventListener('click', (e) => {
            if (e.target.closest('.track-control')) {
                this.handleTrackSelection(e);
            }
        });
    }
    
    addTrackControl(track) {
        const trackElement = this.createTrackElement(track);
        this.trackList.appendChild(trackElement);
        this.trackElements.set(track.id, trackElement);
        return trackElement;
    }
    
    createTrackElement(track) {
        const trackDiv = document.createElement('div');
        trackDiv.className = 'track-control';
        trackDiv.dataset.trackId = track.id;
        
        // Track number (1-based index)
        const trackIndex = this.app.tracks.indexOf(track);
        const trackNumber = trackIndex > 0 ? trackIndex : '';
        
        trackDiv.innerHTML = `
            <div class="track-header">
                <div class="track-number">${trackNumber}</div>
                <input type="text" class="track-name" value="${track.name}" placeholder="Track Name">
                <div class="track-controls-right">
                    <button class="track-btn fx-btn" title="Effects">FX</button>
                    <button class="track-btn io-btn" title="I/O">I/O</button>
                </div>
            </div>
            
            <div class="track-volume-pan">
                <div class="volume-control">
                    <input type="range" class="volume-slider" min="0" max="200" value="100">
                    <span class="volume-label">0.0dB</span>
                </div>
                <div class="pan-control">
                    <input type="range" class="pan-slider" min="-100" max="100" value="0">
                    <span class="pan-label">C</span>
                </div>
            </div>
            
            <div class="track-buttons">
                <button class="track-state-btn mute-btn">M</button>
                <button class="track-state-btn solo-btn">S</button>
                <button class="track-state-btn record-btn">R</button>
            </div>
            
            <div class="track-meters">
                <div class="meter-container">
                    <div class="meter left-meter"></div>
                    <div class="meter right-meter"></div>
                </div>
            </div>
        `;
        
        // Set up track-specific event listeners
        this.setupTrackEventListeners(trackDiv, track);
        
        return trackDiv;
    }
    
    setupTrackEventListeners(trackElement, track) {
        // Track name editing
        const trackNameInput = trackElement.querySelector('.track-name');
        trackNameInput.addEventListener('change', (e) => {
            track.name = e.target.value;
            this.app.arrangeView?.updateTrackName(track.id, track.name);
        });
        
        trackNameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.target.blur();
            }
        });
        
        // Volume control
        const volumeSlider = trackElement.querySelector('.volume-slider');
        volumeSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            const dbValue = this.volumeSliderToDb(value);
            this.updateVolumeLabel(volumeSlider, dbValue);
            track.volume = this.dbToLinear(dbValue);
        });
        
        // Pan control
        const panSlider = trackElement.querySelector('.pan-slider');
        panSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            const panValue = value / 100;
            this.updatePanLabel(panSlider, panValue);
            track.pan = panValue;
        });
        
        // Mute button
        const muteBtn = trackElement.querySelector('.mute-btn');
        muteBtn.addEventListener('click', (e) => {
            track.mute = !track.mute;
            e.target.classList.toggle('active', track.mute);
            this.app.arrangeView?.updateTrackMute(track.id, track.mute);
        });
        
        // Solo button
        const soloBtn = trackElement.querySelector('.solo-btn');
        soloBtn.addEventListener('click', (e) => {
            track.solo = !track.solo;
            e.target.classList.toggle('active', track.solo);
            this.updateSoloState();
            this.app.arrangeView?.updateTrackSolo(track.id, track.solo);
        });
        
        // Record arm button
        const recordBtn = trackElement.querySelector('.record-btn');
        recordBtn.addEventListener('click', (e) => {
            track.recordArm = !track.recordArm;
            e.target.classList.toggle('active', track.recordArm);
        });
        
        // FX button
        const fxBtn = trackElement.querySelector('.fx-btn');
        fxBtn.addEventListener('click', () => {
            this.openEffectsWindow(track.id);
        });
        
        // I/O button
        const ioBtn = trackElement.querySelector('.io-btn');
        ioBtn.addEventListener('click', () => {
            this.openIOWindow(track.id);
        });
    }
    
    removeTrackControl(trackId) {
        const trackElement = this.trackElements.get(trackId);
        if (trackElement) {
            trackElement.remove();
            this.trackElements.delete(trackId);
            this.selectedTracks.delete(trackId);
        }
    }
    
    refreshTrackList() {
        // Clear existing tracks except master
        this.trackList.innerHTML = '';
        this.trackElements.clear();
        
        // Re-add all tracks (excluding master)
        for (const track of this.app.tracks) {
            if (track.id !== 'master') {
                this.addTrackControl(track);
            }
        }
        
        this.updateTrackNumbers();
    }
    
    updateTrackNumbers() {
        let trackNumber = 1;
        for (const track of this.app.tracks) {
            if (track.id !== 'master') {
                const trackElement = this.trackElements.get(track.id);
                if (trackElement) {
                    const numberElement = trackElement.querySelector('.track-number');
                    if (numberElement) {
                        numberElement.textContent = trackNumber;
                    }
                }
                trackNumber++;
            }
        }
    }
    
    handleTrackSelection(e) {
        const trackElement = e.target.closest('.track-control');
        if (!trackElement) return;
        
        const trackId = trackElement.dataset.trackId;
        const isCtrlClick = e.ctrlKey || e.metaKey;
        const isShiftClick = e.shiftKey;
        
        if (!isCtrlClick && !isShiftClick) {
            // Single selection
            this.clearSelection();
            this.selectTrack(trackId);
        } else if (isCtrlClick) {
            // Toggle selection
            if (this.selectedTracks.has(trackId)) {
                this.deselectTrack(trackId);
            } else {
                this.selectTrack(trackId);
            }
        } else if (isShiftClick) {
            // Range selection
            this.selectTrackRange(trackId);
        }
    }
    
    selectTrack(trackId) {
        this.selectedTracks.add(trackId);
        const trackElement = this.trackElements.get(trackId);
        if (trackElement) {
            trackElement.classList.add('selected');
        }
        
        // Update arrange view
        this.app.arrangeView?.updateTrackSelection(Array.from(this.selectedTracks));
    }
    
    deselectTrack(trackId) {
        this.selectedTracks.delete(trackId);
        const trackElement = this.trackElements.get(trackId);
        if (trackElement) {
            trackElement.classList.remove('selected');
        }
        
        // Update arrange view
        this.app.arrangeView?.updateTrackSelection(Array.from(this.selectedTracks));
    }
    
    clearSelection() {
        for (const trackId of this.selectedTracks) {
            const trackElement = this.trackElements.get(trackId);
            if (trackElement) {
                trackElement.classList.remove('selected');
            }
        }
        this.selectedTracks.clear();
        
        // Update arrange view
        this.app.arrangeView?.updateTrackSelection([]);
    }
    
    selectTrackRange(endTrackId) {
        // Implementation for shift-click range selection
        console.log('Range selection to:', endTrackId);
    }
    
    updateSoloState() {
        const hasSoloedTracks = this.app.tracks.some(track => track.solo);
        
        // Update UI to show which tracks are audible
        for (const track of this.app.tracks) {
            const trackElement = this.trackElements.get(track.id);
            if (trackElement) {
                const isAudible = !track.mute && (!hasSoloedTracks || track.solo);
                trackElement.classList.toggle('audible', isAudible);
            }
        }
    }
    
    volumeSliderToDb(sliderValue) {
        // Convert 0-200 slider to dB (-60 to +12)
        if (sliderValue === 0) return -60;
        if (sliderValue === 100) return 0;
        if (sliderValue <= 100) {
            return -60 + (sliderValue * 60 / 100);
        } else {
            return (sliderValue - 100) * 12 / 100;
        }
    }
    
    dbToLinear(dbValue) {
        return Math.pow(10, dbValue / 20);
    }
    
    updateVolumeLabel(slider, dbValue) {
        const label = slider.parentNode.querySelector('.volume-label');
        if (label) {
            if (dbValue <= -60) {
                label.textContent = '-∞dB';
            } else {
                label.textContent = `${dbValue >= 0 ? '+' : ''}${dbValue.toFixed(1)}dB`;
            }
        }
    }
    
    updatePanLabel(slider, panValue) {
        const label = slider.parentNode.querySelector('.pan-label');
        if (label) {
            if (Math.abs(panValue) < 0.01) {
                label.textContent = 'C';
            } else if (panValue < 0) {
                label.textContent = `L${Math.round(Math.abs(panValue) * 100)}`;
            } else {
                label.textContent = `R${Math.round(panValue * 100)}`;
            }
        }
    }
    
    openEffectsWindow(trackId) {
        console.log('Opening effects window for track:', trackId);
        // Implementation for effects window
        this.app.uiManager?.showNotification(`Effects window for ${trackId}`, 'info');
    }
    
    openIOWindow(trackId) {
        console.log('Opening I/O window for track:', trackId);
        // Implementation for I/O window
        this.app.uiManager?.showNotification(`I/O window for ${trackId}`, 'info');
    }
    
    updateMeters(trackId, leftLevel, rightLevel) {
        const trackElement = this.trackElements.get(trackId);
        if (!trackElement) return;
        
        const leftMeter = trackElement.querySelector('.left-meter');
        const rightMeter = trackElement.querySelector('.right-meter');
        
        if (leftMeter) {
            const height = Math.min(100, Math.max(0, (leftLevel + 60) / 60 * 100));
            leftMeter.style.setProperty('--meter-height', `${height}%`);
        }
        
        if (rightMeter) {
            const height = Math.min(100, Math.max(0, (rightLevel + 60) / 60 * 100));
            rightMeter.style.setProperty('--meter-height', `${height}%`);
        }
    }
    
    getSelectedTracks() {
        return Array.from(this.selectedTracks);
    }
}