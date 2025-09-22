/*
 * REAPER Web - Transport Controls
 * Handles play, stop, record, and timeline controls
 */

class TransportControls {
    constructor(app) {
        this.app = app;
        this.playButton = null;
        this.pauseButton = null;
        this.stopButton = null;
        this.recordButton = null;
        this.loopButton = null;
        this.metronomeButton = null;
        
        // Time tracking
        this.animationFrame = null;
        this.lastUpdateTime = 0;
    }
    
    initialize() {
        console.log('Initializing Transport Controls...');
        
        // Get button references
        this.playButton = document.getElementById('play');
        this.pauseButton = document.getElementById('pause');
        this.stopButton = document.getElementById('stop');
        this.recordButton = document.getElementById('record');
        this.loopButton = document.getElementById('loop');
        this.metronomeButton = document.getElementById('metronome');
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Initialize display
        this.updateTimeDisplay();
        this.updateTempoDisplay();
        
        console.log('Transport Controls initialized');
    }
    
    setupEventListeners() {
        // Transport buttons
        this.playButton?.addEventListener('click', () => {
            this.app.play();
        });
        
        this.pauseButton?.addEventListener('click', () => {
            this.app.pause();
        });
        
        this.stopButton?.addEventListener('click', () => {
            this.app.stop();
        });
        
        this.recordButton?.addEventListener('click', () => {
            this.app.record();
        });
        
        // Navigation buttons
        document.getElementById('goto-start')?.addEventListener('click', () => {
            this.app.gotoStart();
        });
        
        document.getElementById('goto-end')?.addEventListener('click', () => {
            this.app.gotoEnd();
        });
        
        document.getElementById('rewind')?.addEventListener('click', () => {
            this.app.rewind();
        });
        
        document.getElementById('fast-forward')?.addEventListener('click', () => {
            this.app.fastForward();
        });
        
        // Options
        this.loopButton?.addEventListener('click', () => {
            this.toggleLoop();
        });
        
        this.metronomeButton?.addEventListener('click', () => {
            this.toggleMetronome();
        });
        
        document.getElementById('auto-crossfade')?.addEventListener('click', () => {
            this.toggleAutoCrossfade();
        });
        
        // Time display click for editing
        document.getElementById('current-time')?.addEventListener('click', () => {
            this.editTime();
        });
        
        document.getElementById('tempo')?.addEventListener('click', () => {
            this.editTempo();
        });
    }
    
    updatePlayState(isPlaying) {
        if (isPlaying) {
            this.playButton?.classList.add('active');
            this.pauseButton?.classList.remove('active');
            this.startTimeUpdate();
        } else {
            this.playButton?.classList.remove('active');
            this.pauseButton?.classList.add('active');
            this.stopTimeUpdate();
        }
        
        // Update time display classes
        const timeDisplay = document.querySelector('.time-display');
        if (timeDisplay) {
            if (isPlaying) {
                timeDisplay.classList.add('playing');
            } else {
                timeDisplay.classList.remove('playing');
            }
        }
    }
    
    updateRecordState(isRecording) {
        if (isRecording) {
            this.recordButton?.classList.add('active');
            document.querySelector('.time-display')?.classList.add('recording');
        } else {
            this.recordButton?.classList.remove('active');
            document.querySelector('.time-display')?.classList.remove('recording');
        }
    }
    
    updateTimeDisplay() {
        const currentTime = this.app.getCurrentTime();
        const totalTime = this.app.totalTime || 0;
        
        // Format time as HH:MM:SS.mmm
        const currentTimeStr = this.formatTime(currentTime);
        const totalTimeStr = this.formatTime(totalTime);
        
        // Update displays
        const currentTimeElement = document.getElementById('current-time');
        const totalTimeElement = document.getElementById('total-time');
        
        if (currentTimeElement) {
            currentTimeElement.textContent = currentTimeStr;
        }
        
        if (totalTimeElement) {
            totalTimeElement.textContent = totalTimeStr;
        }
        
        // Update position display (bars.beats.ticks)
        this.updatePositionDisplay(currentTime);
    }
    
    updatePositionDisplay(timeInSeconds) {
        const tempo = this.app.getTempo();
        const timeSignature = this.app.timeSignature || [4, 4];
        
        // Convert time to musical position
        const beatsPerSecond = tempo / 60;
        const totalBeats = timeInSeconds * beatsPerSecond;
        const beatsPerBar = timeSignature[0];
        
        const bars = Math.floor(totalBeats / beatsPerBar) + 1;
        const beats = Math.floor(totalBeats % beatsPerBar) + 1;
        const ticks = Math.floor((totalBeats % 1) * 960); // 960 ticks per beat
        
        const positionStr = `${bars}.${beats}.${ticks.toString().padStart(2, '0')}`;
        
        const positionElement = document.getElementById('current-position');
        if (positionElement) {
            positionElement.textContent = positionStr;
        }
    }
    
    updateTempoDisplay() {
        const tempo = this.app.getTempo();
        const tempoElement = document.getElementById('tempo');
        if (tempoElement) {
            tempoElement.textContent = tempo.toFixed(2);
        }
    }
    
    formatTime(timeInSeconds) {
        const hours = Math.floor(timeInSeconds / 3600);
        const minutes = Math.floor((timeInSeconds % 3600) / 60);
        const seconds = Math.floor(timeInSeconds % 60);
        const milliseconds = Math.floor((timeInSeconds % 1) * 1000);
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
    }
    
    startTimeUpdate() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        
        const update = (timestamp) => {
            if (this.lastUpdateTime === 0) {
                this.lastUpdateTime = timestamp;
            }
            
            const deltaTime = (timestamp - this.lastUpdateTime) / 1000;
            this.lastUpdateTime = timestamp;
            
            // Update app time
            if (this.app.isPlaying) {
                this.app.currentTime += deltaTime;
                this.updateTimeDisplay();
            }
            
            if (this.app.isPlaying) {
                this.animationFrame = requestAnimationFrame(update);
            }
        };
        
        this.animationFrame = requestAnimationFrame(update);
    }
    
    stopTimeUpdate() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        this.lastUpdateTime = 0;
    }
    
    toggleLoop() {
        this.app.loopEnabled = !this.app.loopEnabled;
        
        if (this.app.loopEnabled) {
            this.loopButton?.classList.add('active');
        } else {
            this.loopButton?.classList.remove('active');
        }
        
        // Update arrange view loop display
        this.app.arrangeView?.updateLoopDisplay();
    }
    
    toggleMetronome() {
        this.app.metronomeEnabled = !this.app.metronomeEnabled;
        
        if (this.app.metronomeEnabled) {
            this.metronomeButton?.classList.add('active');
        } else {
            this.metronomeButton?.classList.remove('active');
        }
        
        console.log('Metronome:', this.app.metronomeEnabled ? 'ON' : 'OFF');
    }
    
    toggleAutoCrossfade() {
        this.app.autoCrossfadeEnabled = !this.app.autoCrossfadeEnabled;
        
        const button = document.getElementById('auto-crossfade');
        if (button) {
            if (this.app.autoCrossfadeEnabled) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        }
        
        console.log('Auto-crossfade:', this.app.autoCrossfadeEnabled ? 'ON' : 'OFF');
    }
    
    editTime() {
        const currentTimeElement = document.getElementById('current-time');
        if (!currentTimeElement) return;
        
        const currentValue = currentTimeElement.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentValue;
        input.style.cssText = `
            background: var(--reaper-bg-dark);
            color: var(--reaper-text-primary);
            border: 1px solid var(--reaper-accent-blue);
            padding: 2px 4px;
            font-family: 'Courier New', monospace;
            font-size: inherit;
            width: 100%;
            text-align: center;
        `;
        
        currentTimeElement.style.display = 'none';
        currentTimeElement.parentNode.insertBefore(input, currentTimeElement);
        input.focus();
        input.select();
        
        const finishEdit = () => {
            const newTime = this.parseTimeString(input.value);
            if (newTime !== null) {
                this.app.currentTime = newTime;
                this.updateTimeDisplay();
            }
            
            input.remove();
            currentTimeElement.style.display = '';
        };
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                finishEdit();
            } else if (e.key === 'Escape') {
                input.remove();
                currentTimeElement.style.display = '';
            }
        });
        
        input.addEventListener('blur', finishEdit);
    }
    
    editTempo() {
        const tempoElement = document.getElementById('tempo');
        if (!tempoElement) return;
        
        const currentValue = tempoElement.textContent;
        const input = document.createElement('input');
        input.type = 'number';
        input.value = parseFloat(currentValue);
        input.min = '20';
        input.max = '300';
        input.step = '0.01';
        input.style.cssText = `
            background: var(--reaper-bg-dark);
            color: var(--reaper-text-primary);
            border: 1px solid var(--reaper-accent-blue);
            padding: 2px 4px;
            font-family: 'Courier New', monospace;
            font-size: inherit;
            width: 60px;
            text-align: center;
        `;
        
        tempoElement.style.display = 'none';
        tempoElement.parentNode.insertBefore(input, tempoElement);
        input.focus();
        input.select();
        
        const finishEdit = () => {
            const newTempo = parseFloat(input.value);
            if (newTempo >= 20 && newTempo <= 300) {
                this.app.setTempo(newTempo);
            }
            
            input.remove();
            tempoElement.style.display = '';
        };
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                finishEdit();
            } else if (e.key === 'Escape') {
                input.remove();
                tempoElement.style.display = '';
            }
        });
        
        input.addEventListener('blur', finishEdit);
    }
    
    parseTimeString(timeStr) {
        // Parse HH:MM:SS.mmm format
        const match = timeStr.match(/^(\d{1,2}):(\d{1,2}):(\d{1,2})\.(\d{1,3})$/);
        if (!match) return null;
        
        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const seconds = parseInt(match[3], 10);
        const milliseconds = parseInt(match[4].padEnd(3, '0'), 10);
        
        if (minutes >= 60 || seconds >= 60) return null;
        
        return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
    }
}