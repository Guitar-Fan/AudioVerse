/*
 * REAPER Web - Arrange View
 * Timeline, track lanes, and media item management
 */

class ArrangeView {
    constructor(app) {
        this.app = app;
        this.timelineRuler = null;
        this.arrangeContent = null;
        this.playhead = null;
        
        // View state
        this.pixelsPerSecond = 50; // Zoom level
        this.scrollLeft = 0;
        this.gridSnapEnabled = true;
        this.gridSize = 0.25; // Quarter note grid
        
        // Track lanes
        this.trackLanes = new Map();
        this.selectedItems = new Set();
        
        // Mouse interaction state
        this.mouseState = {
            isDown: false,
            startX: 0,
            startY: 0,
            mode: null // 'select', 'move', 'resize', 'draw'
        };
    }
    
    initialize() {
        console.log('Initializing Arrange View...');
        
        this.timelineRuler = document.getElementById('timeline-ruler');
        this.arrangeContent = document.getElementById('arrange-content');
        
        // Create playhead
        this.createPlayhead();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Initial draw
        this.drawTimeline();
        this.refreshArrangeView();
        
        console.log('Arrange View initialized');
    }
    
    createPlayhead() {
        this.playhead = document.createElement('div');
        this.playhead.className = 'playhead';
        this.playhead.style.left = '0px';
        this.timelineRuler.appendChild(this.playhead);
    }
    
    setupEventListeners() {
        // Timeline ruler click for seeking
        this.timelineRuler.addEventListener('click', (e) => {
            this.handleTimelineClick(e);
        });
        
        // Arrange content mouse events
        this.arrangeContent.addEventListener('mousedown', (e) => {
            this.handleMouseDown(e);
        });
        
        this.arrangeContent.addEventListener('mousemove', (e) => {
            this.handleMouseMove(e);
        });
        
        this.arrangeContent.addEventListener('mouseup', (e) => {
            this.handleMouseUp(e);
        });
        
        // Scroll events
        this.arrangeContent.addEventListener('scroll', (e) => {
            this.handleScroll(e);
        });
        
        // Zoom with mouse wheel
        this.arrangeContent.addEventListener('wheel', (e) => {
            if (e.ctrlKey) {
                e.preventDefault();
                this.handleZoom(e);
            }
        });
        
        // Keyboard events
        document.addEventListener('keydown', (e) => {
            this.handleKeyDown(e);
        });
    }
    
    drawTimeline() {
        if (!this.timelineRuler) return;
        
        // Clear existing markers
        const existingMarkers = this.timelineRuler.querySelectorAll('.timeline-marker, .timeline-label');
        existingMarkers.forEach(marker => {
            if (marker !== this.playhead) {
                marker.remove();
            }
        });
        
        const rulerWidth = this.timelineRuler.clientWidth;
        const viewDuration = rulerWidth / this.pixelsPerSecond;
        const startTime = this.scrollLeft / this.pixelsPerSecond;
        
        // Calculate appropriate grid spacing
        const tempo = this.app.getTempo();
        const secondsPerBeat = 60 / tempo;
        const beatsPerBar = this.app.timeSignature ? this.app.timeSignature[0] : 4;
        const secondsPerBar = secondsPerBeat * beatsPerBar;
        
        // Draw bar markers
        const firstBar = Math.floor(startTime / secondsPerBar);
        const lastBar = Math.ceil((startTime + viewDuration) / secondsPerBar);
        
        for (let bar = firstBar; bar <= lastBar; bar++) {
            const barTime = bar * secondsPerBar;
            const x = (barTime * this.pixelsPerSecond) - this.scrollLeft;
            
            if (x >= -50 && x <= rulerWidth + 50) {
                this.createTimelineMarker(x, bar + 1, 'major');
                
                // Draw beat markers within bar
                for (let beat = 1; beat < beatsPerBar; beat++) {
                    const beatTime = barTime + (beat * secondsPerBeat);
                    const beatX = (beatTime * this.pixelsPerSecond) - this.scrollLeft;
                    
                    if (beatX >= 0 && beatX <= rulerWidth) {
                        this.createTimelineMarker(beatX, '', 'beat');
                    }
                }
            }
        }
    }
    
    createTimelineMarker(x, label, type) {
        const marker = document.createElement('div');
        marker.className = `timeline-marker ${type}`;
        marker.style.left = x + 'px';
        this.timelineRuler.appendChild(marker);
        
        if (label) {
            const labelElement = document.createElement('div');
            labelElement.className = `timeline-label ${type}`;
            labelElement.textContent = label;
            labelElement.style.left = x + 'px';
            this.timelineRuler.appendChild(labelElement);
        }
    }
    
    refreshArrangeView() {
        if (!this.arrangeContent) return;
        
        // Clear existing track lanes
        this.arrangeContent.innerHTML = '';
        this.trackLanes.clear();
        
        // Create track lanes for all tracks
        for (const track of this.app.tracks) {
            if (track.id !== 'master') {
                this.addTrackLane(track);
            }
        }
        
        // Add master track lane at the bottom
        const masterTrack = this.app.getTrack('master');
        if (masterTrack) {
            this.addTrackLane(masterTrack, true);
        }
    }
    
    addTrackLane(track, isMaster = false) {
        const laneElement = document.createElement('div');
        laneElement.className = `track-lane ${isMaster ? 'master' : ''}`;
        laneElement.dataset.trackId = track.id;
        
        // Set lane width based on project length or minimum width
        const minWidth = Math.max(2000, this.app.totalTime * this.pixelsPerSecond);
        laneElement.style.width = minWidth + 'px';
        
        this.arrangeContent.appendChild(laneElement);
        this.trackLanes.set(track.id, laneElement);
        
        // Add any existing media items for this track
        this.refreshTrackMediaItems(track.id);
        
        return laneElement;
    }
    
    removeTrackLane(trackId) {
        const laneElement = this.trackLanes.get(trackId);
        if (laneElement) {
            laneElement.remove();
            this.trackLanes.delete(trackId);
        }
    }
    
    refreshTrackMediaItems(trackId) {
        const laneElement = this.trackLanes.get(trackId);
        if (!laneElement) return;
        
        // Clear existing media items
        const existingItems = laneElement.querySelectorAll('.media-item');
        existingItems.forEach(item => item.remove());
        
        // Add media items for this track
        const trackMediaItems = this.app.mediaItems.filter(item => item.trackId === trackId);
        for (const mediaItem of trackMediaItems) {
            this.addMediaItemElement(mediaItem);
        }
    }
    
    addMediaItemElement(mediaItem) {
        const laneElement = this.trackLanes.get(mediaItem.trackId);
        if (!laneElement) return;
        
        const itemElement = document.createElement('div');
        itemElement.className = `media-item ${mediaItem.type || 'audio'}`;
        itemElement.dataset.itemId = mediaItem.id;
        
        // Position and size
        const left = mediaItem.startTime * this.pixelsPerSecond;
        const width = mediaItem.duration * this.pixelsPerSecond;
        
        itemElement.style.left = left + 'px';
        itemElement.style.width = width + 'px';
        
        itemElement.innerHTML = `
            <div class="media-item-content">
                <div class="media-item-name">${mediaItem.name}</div>
                <div class="media-item-info">${this.formatDuration(mediaItem.duration)}</div>
            </div>
            <div class="media-item-waveform"></div>
        `;
        
        laneElement.appendChild(itemElement);
        
        // Set up media item event listeners
        this.setupMediaItemEventListeners(itemElement, mediaItem);
    }
    
    setupMediaItemEventListeners(itemElement, mediaItem) {
        itemElement.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            this.handleMediaItemMouseDown(e, mediaItem);
        });
        
        itemElement.addEventListener('dblclick', (e) => {
            this.openMediaItemEditor(mediaItem);
        });
    }
    
    handleTimelineClick(e) {
        const rect = this.timelineRuler.getBoundingClientRect();
        const x = e.clientX - rect.left + this.scrollLeft;
        const time = x / this.pixelsPerSecond;
        
        this.app.currentTime = Math.max(0, time);
        this.updatePlayhead();
        this.app.transportControls.updateTimeDisplay();
    }
    
    handleMouseDown(e) {
        this.mouseState.isDown = true;
        this.mouseState.startX = e.clientX;
        this.mouseState.startY = e.clientY;
        this.mouseState.mode = 'select';
        
        // Clear selection if clicking on empty space
        if (e.target === this.arrangeContent || e.target.closest('.track-lane')) {
            this.clearMediaItemSelection();
        }
    }
    
    handleMouseMove(e) {
        if (!this.mouseState.isDown) return;
        
        const deltaX = e.clientX - this.mouseState.startX;
        const deltaY = e.clientY - this.mouseState.startY;
        
        // Implement selection rectangle, item moving, etc.
    }
    
    handleMouseUp(e) {
        this.mouseState.isDown = false;
        this.mouseState.mode = null;
    }
    
    handleMediaItemMouseDown(e, mediaItem) {
        // Select item
        if (!e.ctrlKey && !e.metaKey) {
            this.clearMediaItemSelection();
        }
        this.selectMediaItem(mediaItem.id);
        
        // Start move/resize operation
        this.mouseState.mode = 'move';
    }
    
    handleScroll(e) {
        this.scrollLeft = this.arrangeContent.scrollLeft;
        this.drawTimeline();
        this.updatePlayhead();
    }
    
    handleZoom(e) {
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newPixelsPerSecond = Math.max(10, Math.min(1000, this.pixelsPerSecond * zoomFactor));
        
        if (newPixelsPerSecond !== this.pixelsPerSecond) {
            const mouseX = e.clientX - this.arrangeContent.getBoundingClientRect().left;
            const timeAtMouse = (mouseX + this.scrollLeft) / this.pixelsPerSecond;
            
            this.pixelsPerSecond = newPixelsPerSecond;
            
            // Adjust scroll to keep time under mouse cursor
            const newMouseX = timeAtMouse * this.pixelsPerSecond;
            this.arrangeContent.scrollLeft = newMouseX - mouseX;
            
            this.drawTimeline();
            this.refreshArrangeView();
            this.updatePlayhead();
        }
    }
    
    handleKeyDown(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }
        
        switch (e.key) {
            case 'Delete':
            case 'Backspace':
                this.deleteSelectedMediaItems();
                break;
                
            case 'a':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.selectAllMediaItems();
                }
                break;
                
            case 'g':
                this.toggleGridSnap();
                break;
        }
    }
    
    updatePlayhead() {
        if (!this.playhead) return;
        
        const playheadX = (this.app.currentTime * this.pixelsPerSecond) - this.scrollLeft;
        this.playhead.style.left = playheadX + 'px';
        
        // Auto-scroll to follow playhead during playback
        if (this.app.isPlaying) {
            const rulerWidth = this.timelineRuler.clientWidth;
            if (playheadX > rulerWidth - 100) {
                this.arrangeContent.scrollLeft = (this.app.currentTime * this.pixelsPerSecond) - rulerWidth + 100;
            }
        }
    }
    
    selectMediaItem(itemId) {
        this.selectedItems.add(itemId);
        const itemElement = this.arrangeContent.querySelector(`[data-item-id="${itemId}"]`);
        if (itemElement) {
            itemElement.classList.add('selected');
        }
    }
    
    deselectMediaItem(itemId) {
        this.selectedItems.delete(itemId);
        const itemElement = this.arrangeContent.querySelector(`[data-item-id="${itemId}"]`);
        if (itemElement) {
            itemElement.classList.remove('selected');
        }
    }
    
    clearMediaItemSelection() {
        for (const itemId of this.selectedItems) {
            this.deselectMediaItem(itemId);
        }
        this.selectedItems.clear();
    }
    
    selectAllMediaItems() {
        for (const mediaItem of this.app.mediaItems) {
            this.selectMediaItem(mediaItem.id);
        }
    }
    
    deleteSelectedMediaItems() {
        const itemsToDelete = Array.from(this.selectedItems);
        for (const itemId of itemsToDelete) {
            this.app.removeMediaItem(itemId);
        }
        this.clearMediaItemSelection();
    }
    
    toggleGridSnap() {
        this.gridSnapEnabled = !this.gridSnapEnabled;
        console.log('Grid snap:', this.gridSnapEnabled ? 'ON' : 'OFF');
    }
    
    openMediaItemEditor(mediaItem) {
        console.log('Opening media item editor for:', mediaItem.name);
        // Implementation for media item editor
    }
    
    formatDuration(duration) {
        const minutes = Math.floor(duration / 60);
        const seconds = (duration % 60).toFixed(1);
        return `${minutes}:${seconds.padStart(4, '0')}`;
    }
    
    updateTrackName(trackId, name) {
        // Update any track-specific UI elements
    }
    
    updateTrackMute(trackId, muted) {
        const laneElement = this.trackLanes.get(trackId);
        if (laneElement) {
            laneElement.classList.toggle('muted', muted);
        }
    }
    
    updateTrackSolo(trackId, soloed) {
        const laneElement = this.trackLanes.get(trackId);
        if (laneElement) {
            laneElement.classList.toggle('soloed', soloed);
        }
    }
    
    updateTrackSelection(selectedTrackIds) {
        // Update arrange view track selection
        for (const [trackId, laneElement] of this.trackLanes) {
            laneElement.classList.toggle('selected', selectedTrackIds.includes(trackId));
        }
    }
    
    handleResize() {
        if (this.timelineRuler && this.arrangeContent) {
            this.drawTimeline();
        }
    }
}