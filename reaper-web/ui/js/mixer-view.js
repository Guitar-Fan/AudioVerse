/*
 * REAPER Web - Mixer View
 * Bottom panel mixer console
 */

class MixerView {
    constructor(app) {
        this.app = app;
        this.mixerPanel = null;
        this.mixerContent = null;
        this.mixerChannels = new Map();
        this.isVisible = false;
    }
    
    initialize() {
        console.log('Initializing Mixer View...');
        
        this.mixerPanel = document.getElementById('mixer-panel');
        this.mixerContent = document.getElementById('mixer-content');
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Show mixer by default (can be toggled later)
        this.show();
        
        console.log('Mixer View initialized');
    }
    
    setupEventListeners() {
        // Mixer close button
        document.getElementById('mixer-close')?.addEventListener('click', () => {
            this.hide();
        });
        
        // Show mixer from menu (will be implemented with menu system)
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'm') {
                e.preventDefault();
                this.toggle();
            }
        });
    }
    
    show() {
        if (this.mixerPanel) {
            this.mixerPanel.classList.remove('hidden');
            this.isVisible = true;
            this.refreshMixer();
        }
    }
    
    hide() {
        if (this.mixerPanel) {
            this.mixerPanel.classList.add('hidden');
            this.isVisible = false;
        }
    }
    
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }
    
    refreshMixer() {
        if (!this.mixerContent || !this.isVisible) return;
        
        // Clear existing channels
        this.mixerContent.innerHTML = '';
        this.mixerChannels.clear();
        
        // Add master channel first
        const masterTrack = this.app.getTrack('master');
        if (masterTrack) {
            this.addMixerChannel(masterTrack, true);
        }
        
        // Add regular tracks
        for (const track of this.app.tracks) {
            if (track.id !== 'master') {
                this.addMixerChannel(track);
            }
        }
    }
    
    addMixerChannel(track, isMaster = false) {
        const channelElement = this.createMixerChannelElement(track, isMaster);
        
        if (isMaster) {
            // Master channel goes at the end
            this.mixerContent.appendChild(channelElement);
        } else {
            // Regular channels go before master
            const masterChannel = this.mixerContent.querySelector('.mixer-channel.master');
            if (masterChannel) {
                this.mixerContent.insertBefore(channelElement, masterChannel);
            } else {
                this.mixerContent.appendChild(channelElement);
            }
        }
        
        this.mixerChannels.set(track.id, channelElement);
        return channelElement;
    }
    
    createMixerChannelElement(track, isMaster = false) {
        const channelDiv = document.createElement('div');
        channelDiv.className = `mixer-channel ${isMaster ? 'master' : ''}`;
        channelDiv.dataset.trackId = track.id;
        
        // Track number for display
        const trackIndex = this.app.tracks.indexOf(track);
        const trackNumber = isMaster ? 'M' : (trackIndex > 0 ? trackIndex : '');
        
        channelDiv.innerHTML = `
            <div class="mixer-channel-header">
                <div class="mixer-channel-number">${trackNumber}</div>
                <input type="text" class="mixer-channel-name" value="${track.name}">
            </div>
            
            <div class="mixer-effects">
                <div class="mixer-effect-slot" title="Insert Effect">+</div>
                <div class="mixer-effect-slot" title="Insert Effect">+</div>
                <div class="mixer-effect-slot" title="Insert Effect">+</div>
            </div>
            
            <div class="mixer-sends">
                <div class="mixer-send">
                    <span class="mixer-send-label">1</span>
                    <div class="mixer-send-knob" data-send="0"></div>
                </div>
                <div class="mixer-send">
                    <span class="mixer-send-label">2</span>
                    <div class="mixer-send-knob" data-send="1"></div>
                </div>
            </div>
            
            <div class="mixer-eq">
                <div class="mixer-eq-band">
                    <div class="mixer-eq-knob" data-eq="high" title="High"></div>
                    <div class="mixer-eq-knob" data-eq="mid" title="Mid"></div>
                    <div class="mixer-eq-knob" data-eq="low" title="Low"></div>
                </div>
            </div>
            
            <div class="mixer-channel-meters">
                <div class="mixer-channel-meter left-meter"></div>
                <div class="mixer-channel-meter right-meter"></div>
            </div>
            
            <div class="mixer-fader-section">
                <div class="mixer-fader-container">
                    <input type="range" class="mixer-fader" min="0" max="200" value="100" orient="vertical">
                </div>
                <div class="mixer-volume-label">0.0dB</div>
            </div>
            
            <div class="mixer-pan-section">
                <div class="mixer-pan-knob" data-pan="0"></div>
                <div class="mixer-pan-label">C</div>
            </div>
            
            <div class="mixer-channel-buttons">
                <button class="mixer-channel-btn mute">M</button>
                <button class="mixer-channel-btn solo">S</button>
            </div>
        `;
        
        // Set up channel-specific event listeners
        this.setupMixerChannelEventListeners(channelDiv, track);
        
        return channelDiv;
    }
    
    setupMixerChannelEventListeners(channelElement, track) {
        // Channel name editing
        const nameInput = channelElement.querySelector('.mixer-channel-name');
        nameInput.addEventListener('change', (e) => {
            track.name = e.target.value;
            this.app.trackControls?.updateTrackName(track.id, track.name);
        });
        
        // Volume fader
        const fader = channelElement.querySelector('.mixer-fader');
        fader.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            const dbValue = this.volumeSliderToDb(value);
            this.updateVolumeLabel(fader, dbValue);
            track.volume = this.dbToLinear(dbValue);
            
            // Sync with track controls
            this.syncTrackControlVolume(track.id, value);
        });
        
        // Pan knob
        const panKnob = channelElement.querySelector('.mixer-pan-knob');
        this.setupKnob(panKnob, (value) => {
            const panValue = (value - 0.5) * 2; // -1 to 1
            track.pan = panValue;
            this.updatePanLabel(panKnob, panValue);
            
            // Sync with track controls
            this.syncTrackControlPan(track.id, panValue);
        });
        
        // Mute button
        const muteBtn = channelElement.querySelector('.mixer-channel-btn.mute');
        muteBtn.addEventListener('click', (e) => {
            track.mute = !track.mute;
            e.target.classList.toggle('active', track.mute);
            
            // Sync with track controls
            this.app.trackControls?.updateTrackMute(track.id, track.mute);
        });
        
        // Solo button
        const soloBtn = channelElement.querySelector('.mixer-channel-btn.solo');
        soloBtn.addEventListener('click', (e) => {
            track.solo = !track.solo;
            e.target.classList.toggle('active', track.solo);
            
            // Sync with track controls
            this.app.trackControls?.updateTrackSolo(track.id, track.solo);
        });
        
        // Effect slots
        const effectSlots = channelElement.querySelectorAll('.mixer-effect-slot');
        effectSlots.forEach((slot, index) => {
            slot.addEventListener('click', () => {
                this.openEffectBrowser(track.id, index);
            });
        });
        
        // Send knobs
        const sendKnobs = channelElement.querySelectorAll('.mixer-send-knob');
        sendKnobs.forEach((knob) => {
            const sendIndex = parseInt(knob.dataset.send);
            this.setupKnob(knob, (value) => {
                // Update send level (0-1)
                console.log(`Track ${track.id} send ${sendIndex}: ${value}`);
            });
        });
        
        // EQ knobs
        const eqKnobs = channelElement.querySelectorAll('.mixer-eq-knob');
        eqKnobs.forEach((knob) => {
            const eqBand = knob.dataset.eq;
            this.setupKnob(knob, (value) => {
                // Update EQ band (-1 to 1, 0 = flat)
                const eqValue = (value - 0.5) * 2;
                console.log(`Track ${track.id} EQ ${eqBand}: ${eqValue}`);
            });
        });
    }
    
    setupKnob(knobElement, callback) {
        let isDragging = false;
        let startY = 0;
        let startValue = 0.5; // Default to center
        
        knobElement.addEventListener('mousedown', (e) => {
            isDragging = true;
            startY = e.clientY;
            startValue = parseFloat(knobElement.dataset.value || '0.5');
            
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            
            e.preventDefault();
        });
        
        const handleMouseMove = (e) => {
            if (!isDragging) return;
            
            const deltaY = startY - e.clientY; // Inverted for natural feel
            const sensitivity = 0.005;
            const newValue = Math.max(0, Math.min(1, startValue + deltaY * sensitivity));
            
            knobElement.dataset.value = newValue.toString();
            this.updateKnobRotation(knobElement, newValue);
            callback(newValue);
        };
        
        const handleMouseUp = () => {
            isDragging = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
        
        // Double-click to reset
        knobElement.addEventListener('dblclick', () => {
            knobElement.dataset.value = '0.5';
            this.updateKnobRotation(knobElement, 0.5);
            callback(0.5);
        });
        
        // Initialize rotation
        this.updateKnobRotation(knobElement, startValue);
    }
    
    updateKnobRotation(knobElement, value) {
        const rotation = (value - 0.5) * 270; // -135 to +135 degrees
        knobElement.style.setProperty('--knob-rotation', `${rotation}deg`);
    }
    
    removeMixerChannel(trackId) {
        const channelElement = this.mixerChannels.get(trackId);
        if (channelElement) {
            channelElement.remove();
            this.mixerChannels.delete(trackId);
        }
    }
    
    syncTrackControlVolume(trackId, sliderValue) {
        // Sync volume with track controls panel
        const trackControl = document.querySelector(`[data-track-id="${trackId}"] .volume-slider`);
        if (trackControl) {
            trackControl.value = sliderValue;
            const dbValue = this.volumeSliderToDb(sliderValue);
            this.updateVolumeLabel(trackControl, dbValue);
        }
    }
    
    syncTrackControlPan(trackId, panValue) {
        // Sync pan with track controls panel
        const trackControl = document.querySelector(`[data-track-id="${trackId}"] .pan-slider`);
        if (trackControl) {
            trackControl.value = panValue * 100;
            this.updatePanLabel(trackControl, panValue);
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
    
    updateVolumeLabel(fader, dbValue) {
        const label = fader.parentNode.parentNode.querySelector('.mixer-volume-label');
        if (label) {
            if (dbValue <= -60) {
                label.textContent = '-∞dB';
            } else {
                label.textContent = `${dbValue >= 0 ? '+' : ''}${dbValue.toFixed(1)}dB`;
            }
        }
    }
    
    updatePanLabel(knob, panValue) {
        const label = knob.parentNode.querySelector('.mixer-pan-label');
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
    
    updateMeters(trackId, leftLevel, rightLevel) {
        const channelElement = this.mixerChannels.get(trackId);
        if (!channelElement) return;
        
        const leftMeter = channelElement.querySelector('.left-meter');
        const rightMeter = channelElement.querySelector('.right-meter');
        
        if (leftMeter) {
            const height = Math.min(100, Math.max(0, (leftLevel + 60) / 60 * 100));
            leftMeter.style.setProperty('--meter-height', `${height}%`);
        }
        
        if (rightMeter) {
            const height = Math.min(100, Math.max(0, (rightLevel + 60) / 60 * 100));
            rightMeter.style.setProperty('--meter-height', `${height}%`);
        }
    }
    
    openEffectBrowser(trackId, slotIndex) {
        console.log(`Opening effect browser for track ${trackId}, slot ${slotIndex}`);
        // Implementation for effect browser
        this.app.uiManager?.showNotification(`Effect browser for track ${trackId}`, 'info');
    }
    
    handleResize() {
        // Handle mixer panel resize if needed
        if (this.isVisible && this.mixerContent) {
            // Adjust scrolling or layout as needed
        }
    }
}