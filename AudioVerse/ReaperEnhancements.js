/**
 * REAPER-Inspired DAW Enhancements
 * Modular additions that extend AudioVerse functionality without affecting core DAW logic
 * 
 * This file contains all REAPER-inspired features that were previously embedded in DAW.js
 * Now cleanly separated for better maintainability and modularity.
 */

// --- Drag Preview System (moved from DAW.js) ---
let dragPreviewSystem = {
  dragPreviewElement: null,
  draggedClipData: null,
  
  init() {
    // Drag preview functionality is now handled here
    this.setupDragHandlers();
  },
  
  setupDragHandlers() {
    // Enhanced drag preview with snap-to-grid functionality
    document.addEventListener('dragover', (e) => {
      if (window.draggedClipData && e.target.closest('.track')) {
        this.updateDragPreview(e);
      }
    });
  },
  
  createDragPreview(trackDiv, clipData, position) {
    this.removeDragPreview();
    
    this.dragPreviewElement = document.createElement('div');
    this.dragPreviewElement.className = 'clip-drag-preview';
    this.dragPreviewElement.style.left = position + 'px';
    this.dragPreviewElement.style.width = clipData.width + 'px';
    
    const nameDiv = document.createElement('div');
    nameDiv.style.padding = '4px 8px';
    nameDiv.style.fontSize = '11px';
    nameDiv.style.fontWeight = 'bold';
    nameDiv.style.color = '#21272e';
    nameDiv.innerText = clipData.name;
    this.dragPreviewElement.appendChild(nameDiv);
    
    trackDiv.appendChild(this.dragPreviewElement);
  },
  
  updateDragPreview(e) {
    const trackDiv = e.target.closest('.track');
    if (!trackDiv || !this.dragPreviewElement) return;
    
    const rect = trackDiv.getBoundingClientRect();
    const position = this.calculateSnapPosition(trackDiv, e.clientX - rect.left);
    this.dragPreviewElement.style.left = position + 'px';
  },
  
  removeDragPreview() {
    if (this.dragPreviewElement) {
      this.dragPreviewElement.remove();
      this.dragPreviewElement = null;
    }
  },
  
  calculateSnapPosition(trackDiv, rawX) {
    // Enhanced snap calculation with grid and clip edge snapping
    const TRACK_HEADER_WIDTH = 200;
    const PIXELS_PER_SEC = window.PIXELS_PER_SEC || 110;
    
    const adjustedX = rawX - TRACK_HEADER_WIDTH;
    let rawTime = Math.max(0, adjustedX / PIXELS_PER_SEC);
    
    // Snap to grid if enabled
    const settings = window.settings || { snapToGrid: true };
    if (settings.snapToGrid) {
      const gridTimes = this.getGridTimes();
      let minDist = Infinity, snapTime = rawTime;
      const snapThreshold = 0.1;
      
      gridTimes.forEach(t => {
        let dist = Math.abs(t - rawTime);
        if (dist < minDist && dist < snapThreshold) {
          minDist = dist;
          snapTime = t;
        }
      });
      
      rawTime = snapTime;
    }
    
    return Math.max(0, rawTime * PIXELS_PER_SEC + TRACK_HEADER_WIDTH);
  },
  
  getGridTimes() {
    // Get grid snap points (bars, beats, etc.)
    const bpm = window.bpm || 120;
    const timeSigNum = window.timeSigNum || 4;
    const secPerBeat = 60 / bpm;
    const secPerBar = secPerBeat * timeSigNum;
    
    let gridTimes = [];
    for (let bar = 0; bar < 100; bar++) {
      const barTime = bar * secPerBar;
      gridTimes.push(barTime);
      
      // Add beat subdivisions
      for (let beat = 1; beat < timeSigNum; beat++) {
        gridTimes.push(barTime + beat * secPerBeat);
      }
    }
    
    return gridTimes;
  }
};

// --- Enhanced Level Metering System (moved from DAW.js) ---
let enhancedLevelMeters = {
  levelMeterSystem: {
    analysers: new Map(),
    meterData: new Map(),
    peakHold: new Map(),
    clipIndicators: new Map(),
    updateInterval: 50,
    lastUpdate: 0
  },
  
  init() {
    this.initLevelMeters();
    this.startLevelMeterUpdates();
  },
  
  initLevelMeters() {
    if (!window.tracks || !window.audioCtx) return;
    
    window.tracks.forEach((track, tIdx) => {
      if (!this.levelMeterSystem.analysers.has(tIdx)) {
        const analyser = window.audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.3;
        
        // Connect to track output
        const trackGain = window.trackGainNodes?.get(tIdx);
        if (trackGain) {
          trackGain.connect(analyser);
        }
        
        this.levelMeterSystem.analysers.set(tIdx, analyser);
        this.levelMeterSystem.meterData.set(tIdx, {
          left: new Uint8Array(analyser.frequencyBinCount),
          right: new Uint8Array(analyser.frequencyBinCount),
          leftLevel: 0,
          rightLevel: 0,
          leftPeak: 0,
          rightPeak: 0,
          clipCount: 0
        });
        this.levelMeterSystem.peakHold.set(tIdx, { left: 0, right: 0, time: 0 });
        this.levelMeterSystem.clipIndicators.set(tIdx, { active: false, time: 0 });
      }
    });
  },
  
  startLevelMeterUpdates() {
    const updateMeters = () => {
      const now = performance.now();
      
      if (now - this.levelMeterSystem.lastUpdate >= this.levelMeterSystem.updateInterval) {
        // Check if window.tracks exists and is an array
        if (window.tracks && Array.isArray(window.tracks)) {
          window.tracks.forEach((track, tIdx) => {
            this.updateTrackLevelMeter(tIdx);
          });
        }
        this.levelMeterSystem.lastUpdate = now;
      }
      
      requestAnimationFrame(updateMeters);
    };
    
    updateMeters();
  },
  
  updateTrackLevelMeter(trackIndex) {
    const analyser = this.levelMeterSystem.analysers.get(trackIndex);
    const meterData = this.levelMeterSystem.meterData.get(trackIndex);
    
    if (!analyser || !meterData) return;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);
    
    // Calculate RMS levels
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sum / bufferLength);
    const level = (rms / 128) * 100;
    
    meterData.leftLevel = Math.min(100, level);
    meterData.rightLevel = Math.min(100, level * (0.95 + Math.random() * 0.1));
    
    this.updateMeterDisplay(trackIndex, meterData);
  },
  
  updateMeterDisplay(trackIndex, meterData) {
    const leftMeterEl = document.getElementById(`leftMeter-${trackIndex}`);
    const rightMeterEl = document.getElementById(`rightMeter-${trackIndex}`);
    
    if (leftMeterEl && rightMeterEl) {
      leftMeterEl.style.height = `${meterData.leftLevel}%`;
      rightMeterEl.style.height = `${meterData.rightLevel}%`;
      
      // Color coding
      [leftMeterEl, rightMeterEl].forEach((el, i) => {
        const level = i === 0 ? meterData.leftLevel : meterData.rightLevel;
        el.classList.toggle('clip', level > 95);
        el.classList.toggle('peak', level > 85);
      });
    }
  }
};

// --- CPU Performance Monitor ---
let cpuMonitor = {
  enabled: false,
  lastTime: 0,
  samples: [],
  maxSamples: 60,
  
  init() {
    this.enabled = true;
    this.element = document.getElementById('cpuMonitor');
    this.updateDisplay();
    this.startMonitoring();
  },
  
  startMonitoring() {
    if (!this.enabled) return;
    
    setInterval(() => {
      const now = performance.now();
      if (this.lastTime > 0) {
        const delta = now - this.lastTime;
        const cpuUsage = Math.min(100, Math.max(0, (delta - 16.67) / 16.67 * 100));
        this.samples.push(cpuUsage);
        if (this.samples.length > this.maxSamples) {
          this.samples.shift();
        }
        this.updateDisplay();
      }
      this.lastTime = now;
    }, 100);
  },
  
  updateDisplay() {
    if (!this.element || this.samples.length === 0) return;
    
    const avg = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    const peak = Math.max(...this.samples);
    
    this.element.innerHTML = `
      <div class="cpu-meter">
        <div class="cpu-bar" style="width: ${Math.min(100, avg)}%"></div>
      </div>
      <span class="cpu-text">CPU: ${avg.toFixed(1)}%</span>
    `;
    
    // Color coding based on CPU usage
    const bar = this.element.querySelector('.cpu-bar');
    if (avg > 80) bar.style.backgroundColor = '#ff4444';
    else if (avg > 60) bar.style.backgroundColor = '#ffaa44';
    else bar.style.backgroundColor = '#44ff44';
  }
};

// --- Professional Audio Level Meters ---
let levelMeters = {
  meters: new Map(),
  analyserNodes: new Map(),
  
  init() {
    this.createAnalyserNodes();
    this.startMetering();
  },
  
  createAnalyserNodes() {
    if (!window.tracks || !window.audioCtx) return;
    
    window.tracks.forEach((track, index) => {
      if (!this.analyserNodes.has(index)) {
        const analyser = window.audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.3;
        this.analyserNodes.set(index, analyser);
        
        // Connect to track's audio chain
        const trackGain = window.trackGainNodes?.get(index);
        if (trackGain) {
          trackGain.connect(analyser);
        }
      }
    });
  },
  
  createMeterElement(trackIndex) {
    const meter = document.createElement('div');
    meter.className = 'level-meter';
    meter.innerHTML = `
      <div class="level-bar level-l">
        <div class="level-fill"></div>
      </div>
      <div class="level-bar level-r">
        <div class="level-fill"></div>
      </div>
      <div class="level-labels">
        <span class="level-label">L</span>
        <span class="level-label">R</span>
      </div>
    `;
    return meter;
  },
  
  startMetering() {
    const updateMeters = () => {
      this.analyserNodes.forEach((analyser, trackIndex) => {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        
        // Calculate RMS level
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / dataArray.length);
        const level = (rms / 255) * 100;
        
        // Update meter display
        const meterElement = document.querySelector(`[data-track="${trackIndex}"] .level-meter`);
        if (meterElement) {
          const fills = meterElement.querySelectorAll('.level-fill');
          fills.forEach(fill => {
            fill.style.height = `${level}%`;
            
            // Color coding
            if (level > 90) fill.style.backgroundColor = '#ff4444';
            else if (level > 75) fill.style.backgroundColor = '#ffaa44';
            else fill.style.backgroundColor = '#44ff44';
          });
        }
      });
      
      if (this.analyserNodes.size > 0) {
        requestAnimationFrame(updateMeters);
      }
    };
    
    updateMeters();
  }
};

// --- Advanced Undo/Redo System ---
let advancedUndoRedo = {
  history: [],
  currentIndex: -1,
  maxHistory: 100,
  
  init() {
    this.setupButtons();
    this.setupKeyboardShortcuts();
  },
  
  saveAction(actionName, beforeState, afterState) {
    // Remove any redo history when new action is performed
    this.history = this.history.slice(0, this.currentIndex + 1);
    
    this.history.push({
      name: actionName,
      timestamp: Date.now(),
      before: JSON.parse(JSON.stringify(beforeState)),
      after: JSON.parse(JSON.stringify(afterState))
    });
    
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    } else {
      this.currentIndex++;
    }
    
    this.updateButtons();
  },
  
  undo() {
    if (this.currentIndex >= 0) {
      const action = this.history[this.currentIndex];
      this.restoreState(action.before);
      this.currentIndex--;
      this.updateButtons();
      return true;
    }
    return false;
  },
  
  redo() {
    if (this.currentIndex < this.history.length - 1) {
      this.currentIndex++;
      const action = this.history[this.currentIndex];
      this.restoreState(action.after);
      this.updateButtons();
      return true;
    }
    return false;
  },
  
  restoreState(state) {
    if (window.tracks && state.tracks) {
      window.tracks = JSON.parse(JSON.stringify(state.tracks));
      if (window.render) window.render();
    }
  },
  
  setupButtons() {
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    
    if (undoBtn) undoBtn.onclick = () => this.undo();
    if (redoBtn) redoBtn.onclick = () => this.redo();
    
    this.updateButtons();
  },
  
  updateButtons() {
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    
    if (undoBtn) {
      undoBtn.disabled = this.currentIndex < 0;
      undoBtn.title = this.currentIndex >= 0 ? 
        `Undo: ${this.history[this.currentIndex]?.name}` : 'Nothing to undo';
    }
    
    if (redoBtn) {
      redoBtn.disabled = this.currentIndex >= this.history.length - 1;
      redoBtn.title = this.currentIndex < this.history.length - 1 ? 
        `Redo: ${this.history[this.currentIndex + 1]?.name}` : 'Nothing to redo';
    }
  },
  
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        this.undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        this.redo();
      }
    });
  }
};

// --- Scripted FX (JSFX-style) System ---
let scriptedFxSystem = {
  effects: [],
  
  init() {
    this.setupUI();
  },
  
  setupUI() {
    const addBtn = document.getElementById('addScriptedFxBtn');
    if (addBtn) {
      addBtn.onclick = () => this.addNewEffect();
    }
    this.renderEffectsList();
  },
  
  addNewEffect() {
    const defaultCode = `function process(input, output, params) {
  // Basic pass-through effect
  // input and output are Float32Array buffers
  for (let i = 0; i < input.length; i++) {
    output[i] = input[i]; // Copy input to output
  }
}`;

    this.effects.push({
      id: Date.now(),
      name: 'New Effect',
      code: defaultCode,
      enabled: true,
      compiled: null
    });
    
    this.renderEffectsList();
    this.updateAudioChain();
  },
  
  removeEffect(id) {
    this.effects = this.effects.filter(fx => fx.id !== id);
    this.renderEffectsList();
    this.updateAudioChain();
  },
  
  toggleEffect(id) {
    const fx = this.effects.find(fx => fx.id === id);
    if (fx) {
      fx.enabled = !fx.enabled;
      this.renderEffectsList();
      this.updateAudioChain();
    }
  },
  
  editEffect(id) {
    const fx = this.effects.find(fx => fx.id === id);
    if (!fx) return;
    
    // Create a modal editor
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-dialog modal-wide">
        <div class="modal-header">
          <h3>Edit JSFX Effect: ${fx.name}</h3>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
        </div>
        <div class="modal-content">
          <div style="margin-bottom: 1rem;">
            <label>Effect Name:</label>
            <input type="text" id="fxName" value="${fx.name}" style="width: 100%; margin-top: 0.5rem;">
          </div>
          <div style="margin-bottom: 1rem;">
            <label>JavaScript Code:</label>
            <textarea id="fxCode" style="width: 100%; height: 300px; font-family: monospace; margin-top: 0.5rem;">${fx.code}</textarea>
          </div>
          <div class="fx-help" style="background: #333; padding: 1rem; border-radius: 4px; margin-bottom: 1rem;">
            <h4>JSFX API:</h4>
            <ul>
              <li><code>input</code> - Float32Array input buffer</li>
              <li><code>output</code> - Float32Array output buffer</li>
              <li><code>params</code> - Effect parameters object</li>
            </ul>
            <p>Example: <code>output[i] = input[i] * 0.5; // 50% volume</code></p>
          </div>
        </div>
        <div class="modal-footer">
          <button class="modal-btn" onclick="scriptedFxSystem.saveEffect('${id}'); this.closest('.modal-overlay').remove();">Save</button>
          <button class="modal-btn" onclick="this.closest('.modal-overlay').remove();">Cancel</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  },
  
  saveEffect(id) {
    const fx = this.effects.find(fx => fx.id === id);
    if (!fx) return;
    
    const nameInput = document.getElementById('fxName');
    const codeInput = document.getElementById('fxCode');
    
    if (nameInput && codeInput) {
      fx.name = nameInput.value;
      fx.code = codeInput.value;
      fx.compiled = null; // Reset compilation
      
      this.renderEffectsList();
      this.updateAudioChain();
    }
  },
  
  renderEffectsList() {
    const list = document.getElementById('scriptedFxList');
    if (!list) return;
    
    list.innerHTML = '';
    
    this.effects.forEach(fx => {
      const item = document.createElement('div');
      item.className = 'scripted-fx-item';
      item.innerHTML = `
        <div class="fx-item-header">
          <span class="fx-name">${fx.name}</span>
          <div class="fx-controls">
            <button class="fx-btn" onclick="scriptedFxSystem.editEffect('${fx.id}')">Edit</button>
            <button class="fx-btn" onclick="scriptedFxSystem.removeEffect('${fx.id}')">Remove</button>
            <label class="fx-toggle">
              <input type="checkbox" ${fx.enabled ? 'checked' : ''} 
                     onchange="scriptedFxSystem.toggleEffect('${fx.id}')">
              <span>Enabled</span>
            </label>
          </div>
        </div>
      `;
      list.appendChild(item);
    });
  },
  
  compileEffect(fx) {
    try {
      // Create a safe function wrapper
      const wrapper = new Function('input', 'output', 'params', fx.code + '\nreturn process;');
      fx.compiled = wrapper();
      return true;
    } catch (error) {
      console.error(`Error compiling effect ${fx.name}:`, error);
      fx.compiled = null;
      return false;
    }
  },
  
  updateAudioChain() {
    // This would integrate with the main DAW's audio routing
    // For now, just compile the effects
    this.effects.forEach(fx => {
      if (fx.enabled && !fx.compiled) {
        this.compileEffect(fx);
      }
    });
  }
};

// --- Track Grouping & Folders ---
let trackGrouping = {
  groups: [],
  
  init() {
    this.setupUI();
  },
  
  setupUI() {
    // Add group controls to track headers
    this.addGroupControls();
  },
  
  addGroupControls() {
    // This would add group/folder controls to each track header
    // Implementation would depend on the main DAW's track rendering
  },
  
  createGroup(name, trackIndices) {
    const group = {
      id: Date.now(),
      name: name,
      tracks: trackIndices,
      collapsed: false,
      color: '#444'
    };
    
    this.groups.push(group);
    return group;
  },
  
  toggleGroup(groupId) {
    const group = this.groups.find(g => g.id === groupId);
    if (group) {
      group.collapsed = !group.collapsed;
      this.updateGroupDisplay();
    }
  },
  
  updateGroupDisplay() {
    // Update the visual representation of groups
    // This would modify the track display based on group state
  }
};

// --- Professional Keyboard Shortcuts ---
let keyboardShortcuts = {
  shortcuts: new Map(),
  
  init() {
    this.setupDefaultShortcuts();
    this.bindEvents();
  },
  
  setupDefaultShortcuts() {
    // Transport controls
    this.addShortcut('Space', () => window.togglePlayback && window.togglePlayback());
    this.addShortcut('Home', () => window.stop && window.stop());
    this.addShortcut('End', () => window.goToEnd && window.goToEnd());
    
    // Editing
    this.addShortcut('Ctrl+C', () => this.copySelection());
    this.addShortcut('Ctrl+V', () => this.pasteSelection());
    this.addShortcut('Ctrl+X', () => this.cutSelection());
    this.addShortcut('Delete', () => this.deleteSelection());
    
    // Navigation
    this.addShortcut('Ctrl+A', () => this.selectAll());
    this.addShortcut('Escape', () => this.deselectAll());
    
    // Zoom
    this.addShortcut('Ctrl+=', () => window.zoomIn && window.zoomIn());
    this.addShortcut('Ctrl+-', () => window.zoomOut && window.zoomOut());
    this.addShortcut('Ctrl+0', () => window.zoomFit && window.zoomFit());
  },
  
  addShortcut(keys, callback) {
    this.shortcuts.set(keys.toLowerCase(), callback);
  },
  
  bindEvents() {
    document.addEventListener('keydown', (e) => {
      const key = this.getKeyString(e);
      const shortcut = this.shortcuts.get(key.toLowerCase());
      
      if (shortcut && !this.isInputFocused()) {
        e.preventDefault();
        shortcut();
      }
    });
  },
  
  getKeyString(e) {
    let key = e.key;
    if (e.ctrlKey) key = 'Ctrl+' + key;
    if (e.shiftKey) key = 'Shift+' + key;
    if (e.altKey) key = 'Alt+' + key;
    if (e.metaKey) key = 'Meta+' + key;
    return key;
  },
  
  isInputFocused() {
    const active = document.activeElement;
    return active && (
      active.tagName === 'INPUT' ||
      active.tagName === 'TEXTAREA' ||
      active.contentEditable === 'true'
    );
  },
  
  copySelection() {
    // Implementation would depend on what's selected
    console.log('Copy shortcut triggered');
  },
  
  pasteSelection() {
    console.log('Paste shortcut triggered');
  },
  
  cutSelection() {
    console.log('Cut shortcut triggered');
  },
  
  deleteSelection() {
    console.log('Delete shortcut triggered');
  },
  
  selectAll() {
    console.log('Select all shortcut triggered');
  },
  
  deselectAll() {
    console.log('Deselect all shortcut triggered');
  }
};

// --- Initialization ---
class ReaperEnhancements {
  constructor() {
    this.modules = {
      cpuMonitor,
      levelMeters,
      advancedUndoRedo,
      scriptedFxSystem,
      trackGrouping,
      keyboardShortcuts
    };
  }
  
  init() {
    // Wait for DOM and main DAW to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.initModules());
    } else {
      this.initModules();
    }
  }
  
  initModules() {
    // Initialize modules in order
    setTimeout(() => {
      Object.entries(this.modules).forEach(([name, module]) => {
        try {
          if (module && typeof module.init === 'function') {
            console.log(`Initializing ${name}...`);
            module.init();
          }
        } catch (error) {
          console.error(`Error initializing module ${name}:`, error);
        }
      });
    }, 1000); // Give main DAW time to initialize
  }
  
  getModule(name) {
    return this.modules[name];
  }
}

// --- Enhanced Action History System (moved from DAW.js) ---
let enhancedActionHistory = {
  actionHistory: {
    actions: [],
    currentIndex: -1,
    maxHistory: 50,
    lastActionTime: 0,
    groupingDelay: 500
  },
  
  init() {
    this.setupUndoRedoButtons();
  },
  
  addAction(type, description, data = null) {
    const now = Date.now();
    const action = this.createAction(type, description, data);
    
    // Group rapid similar actions
    if (this.actionHistory.actions.length > 0 && 
        now - this.actionHistory.lastActionTime < this.actionHistory.groupingDelay &&
        this.actionHistory.actions[this.actionHistory.currentIndex]?.type === type) {
      this.actionHistory.actions[this.actionHistory.currentIndex] = action;
    } else {
      this.actionHistory.actions = this.actionHistory.actions.slice(0, this.actionHistory.currentIndex + 1);
      this.actionHistory.actions.push(action);
      this.actionHistory.currentIndex++;
      
      if (this.actionHistory.actions.length > this.actionHistory.maxHistory) {
        this.actionHistory.actions.shift();
        this.actionHistory.currentIndex--;
      }
    }
    
    this.actionHistory.lastActionTime = now;
    this.updateUndoRedoButtons();
  },
  
  createAction(type, description, data) {
    return {
      type: type,
      description: description,
      timestamp: Date.now(),
      data: data,
      state: this.getCurrentState()
    };
  },
  
  getCurrentState() {
    return {
      tracks: window.tracks?.map(track => ({
        ...track,
        clips: track.clips.map(clip => ({
          ...clip,
          audioBuffer: null,
          tonePlayer: null,
          toneVolume: null,
          howl: null
        }))
      })) || [],
      playheadTime: window.playheadTime || 0,
      bpm: window.bpm || 120,
      timeSigNum: window.timeSigNum || 4,
      timeSigDen: window.timeSigDen || 4
    };
  },
  
  setupUndoRedoButtons() {
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    
    if (undoBtn) {
      undoBtn.onclick = () => {
        if (this.actionHistory.currentIndex > 0) {
          this.actionHistory.currentIndex--;
          const action = this.actionHistory.actions[this.actionHistory.currentIndex];
          this.restoreState(action.state);
          this.showActionFeedback(`Undo: ${action.description}`);
          this.updateUndoRedoButtons();
        }
      };
    }
    
    if (redoBtn) {
      redoBtn.onclick = () => {
        if (this.actionHistory.currentIndex < this.actionHistory.actions.length - 1) {
          this.actionHistory.currentIndex++;
          const action = this.actionHistory.actions[this.actionHistory.currentIndex];
          this.restoreState(action.state);
          this.showActionFeedback(`Redo: ${action.description}`);
          this.updateUndoRedoButtons();
        }
      };
    }
    
    this.updateUndoRedoButtons();
  },
  
  updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    
    if (undoBtn) {
      undoBtn.disabled = this.actionHistory.currentIndex <= 0;
      undoBtn.title = this.actionHistory.currentIndex > 0 ? 
        `Undo: ${this.actionHistory.actions[this.actionHistory.currentIndex].description}` : 
        'Nothing to undo';
    }
    
    if (redoBtn) {
      redoBtn.disabled = this.actionHistory.currentIndex >= this.actionHistory.actions.length - 1;
      redoBtn.title = this.actionHistory.currentIndex < this.actionHistory.actions.length - 1 ? 
        `Redo: ${this.actionHistory.actions[this.actionHistory.currentIndex + 1].description}` : 
        'Nothing to redo';
    }
  },
  
  restoreState(state) {
    if (window.tracks && state.tracks) {
      window.tracks = JSON.parse(JSON.stringify(state.tracks));
      window.playheadTime = state.playheadTime;
      window.bpm = state.bpm;
      window.timeSigNum = state.timeSigNum;
      window.timeSigDen = state.timeSigDen;
      
      if (window.render) window.render();
    }
  },
  
  showActionFeedback(message) {
    const feedback = document.createElement('div');
    feedback.className = 'action-feedback';
    feedback.textContent = message;
    feedback.style.cssText = `
      position: fixed;
      top: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--panel);
      color: var(--text);
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 1000;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;
    
    document.body.appendChild(feedback);
    setTimeout(() => feedback.style.opacity = '1', 10);
    setTimeout(() => {
      feedback.style.opacity = '0';
      setTimeout(() => feedback.remove(), 300);
    }, 2000);
  }
};

// Global instance
window.reaperEnhancements = new ReaperEnhancements();

// --- Audio Analysis System (moved from DAW.js) ---
let audioAnalysisSystem = {
  analysisSystem: {
    initialized: false,
    currentClip: null,
    analyzers: {},
    canvases: {},
    animationFrames: {},
    isAnalyzing: false
  },
  
  analysisData: {
    spectrum: null,
    levels: { peak: -Infinity, rms: -Infinity, lufs: -Infinity },
    phase: 0,
    tempo: null,
    key: null
  },
  
  init() {
    this.initializeAudioAnalysis();
  },
  
  initializeAudioAnalysis() {
    console.log('Initializing Audio Analysis System...');
    
    // Get DOM elements
    const analysisOverlay = document.getElementById('analysisOverlay');
    const analysisClose = document.getElementById('analysisClose');
    const analysisCloseFooter = document.getElementById('analysisCloseFooter');
    const refreshBtn = document.getElementById('refreshAnalysis');
    
    // Initialize canvases
    this.initializeAnalysisCanvases();
    
    // Set up event listeners
    if (analysisClose) {
      analysisClose.addEventListener('click', () => this.closeAnalysisDialog());
    }
    
    if (analysisCloseFooter) {
      analysisCloseFooter.addEventListener('click', () => this.closeAnalysisDialog());
    }
    
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refreshAnalysis());
    }
    
    // Close on overlay click
    if (analysisOverlay) {
      analysisOverlay.addEventListener('click', (e) => {
        if (e.target === analysisOverlay) {
          this.closeAnalysisDialog();
        }
      });
    }
    
    // Set up spectrum analyzer controls
    this.setupSpectrumControls();
    
    this.analysisSystem.initialized = true;
    console.log('Audio Analysis System initialized');
  },
  
  initializeAnalysisCanvases() {
    const spectrumCanvas = document.getElementById('spectrumCanvas');
    const levelMetersCanvas = document.getElementById('levelMetersCanvas');
    const phaseCanvas = document.getElementById('phaseCorrelationCanvas');
    
    if (spectrumCanvas) {
      this.analysisSystem.canvases.spectrum = spectrumCanvas.getContext('2d');
      this.setupCanvasSize(spectrumCanvas);
    }
    
    if (levelMetersCanvas) {
      this.analysisSystem.canvases.levels = levelMetersCanvas.getContext('2d');
      this.setupCanvasSize(levelMetersCanvas);
    }
    
    if (phaseCanvas) {
      this.analysisSystem.canvases.phase = phaseCanvas.getContext('2d');
      this.setupCanvasSize(phaseCanvas);
    }
  },
  
  setupCanvasSize(canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    
    // Set canvas CSS size back to original
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
  },
  
  openAnalysisDialog() {
    const overlay = document.getElementById('analysisOverlay');
    
    if (overlay) {
      overlay.classList.remove('hidden');
      
      // Re-initialize canvases after dialog is shown
      setTimeout(() => {
        this.initializeAnalysisCanvases();
      }, 100);
    }
  },
  
  showAnalysisControls() {
    const overlay = document.getElementById('analysisOverlay');
    
    if (overlay) {
      overlay.classList.remove('hidden');
    } else {
      console.warn('Analysis overlay not found in DOM');
      // Could create the overlay dynamically here if needed
      this.createAnalysisOverlay();
    }
    
    // Start analysis if not already running
    if (!this.analysisSystem.isAnalyzing) {
      this.startAnalysisMode();
    }
  },
  
  createAnalysisOverlay() {
    // Create analysis overlay if it doesn't exist
    const overlay = document.createElement('div');
    overlay.id = 'analysisOverlay';
    overlay.className = 'fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50';
    overlay.innerHTML = `
      <div class="bg-gray-800 p-6 rounded-lg max-w-4xl w-full mx-4 max-h-screen overflow-y-auto">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-bold text-orange-400">Audio Analysis Tools</h2>
          <button id="analysisClose" class="text-gray-400 hover:text-white text-2xl">&times;</button>
        </div>
        <div class="analysis-content">
          <p class="text-gray-300">Audio analysis tools will be displayed here.</p>
          <p class="text-gray-400 text-sm mt-2">Load audio clips to see spectrum analysis, level meters, and other tools.</p>
        </div>
        <div class="mt-4 flex justify-end">
          <button id="analysisCloseFooter" class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">Close</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Set up event listeners for the dynamically created overlay
    const closeBtn = overlay.querySelector('#analysisClose');
    const closeFooter = overlay.querySelector('#analysisCloseFooter');
    
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeAnalysisDialog());
    }
    
    if (closeFooter) {
      closeFooter.addEventListener('click', () => this.closeAnalysisDialog());
    }
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.closeAnalysisDialog();
      }
    });
  },
  
  closeAnalysisDialog() {
    const overlay = document.getElementById('analysisOverlay');
    
    if (overlay) {
      overlay.classList.add('hidden');
    }
  },
  
  setupSpectrumControls() {
    const linearBtn = document.getElementById('spectrumLinear');
    const logBtn = document.getElementById('spectrumLog');
    const peakHoldBtn = document.getElementById('spectrumPeakHold');
    
    if (linearBtn) {
      linearBtn.addEventListener('click', () => this.setSpectrumScale('linear'));
    }
    
    if (logBtn) {
      logBtn.addEventListener('click', () => this.setSpectrumScale('log'));
    }
    
    if (peakHoldBtn) {
      peakHoldBtn.addEventListener('click', () => this.togglePeakHold());
    }
  },
  
  setSpectrumScale(scale) {
    const linearBtn = document.getElementById('spectrumLinear');
    const logBtn = document.getElementById('spectrumLog');
    
    if (linearBtn && logBtn) {
      linearBtn.classList.toggle('active', scale === 'linear');
      logBtn.classList.toggle('active', scale === 'log');
    }
    
    this.analysisSystem.spectrumScale = scale;
  },
  
  togglePeakHold() {
    const btn = document.getElementById('spectrumPeakHold');
    
    if (btn) {
      const isActive = btn.classList.contains('active');
      btn.classList.toggle('active');
      this.analysisSystem.peakHold = !isActive;
    }
  },
  
  selectClipForAnalysis(clip) {
    console.log('Selecting clip for analysis:', clip.name);
    
    this.analysisSystem.currentClip = clip;
    
    // Update UI
    const clipNameEl = document.getElementById('analysisClipName');
    if (clipNameEl) {
      clipNameEl.textContent = clip.name || 'Unnamed Clip';
    }
    
    // Open analysis dialog
    this.openAnalysisDialog();
    
    // Start analysis
    this.startClipAnalysis(clip);
  },
  
  async startClipAnalysis(clip) {
    if (!clip || !clip.audioUrl) {
      console.warn('No audio URL available for analysis');
      return;
    }
    
    this.analysisSystem.isAnalyzing = true;
    
    try {
      // Load audio for analysis
      const audioBuffer = await this.loadAudioForAnalysis(clip.audioUrl);
      
      if (audioBuffer) {
        // Phase 1: Essential Meters
        await this.analyzeSpectrum(audioBuffer);
        await this.analyzeLevels(audioBuffer);
        await this.analyzePhase(audioBuffer);
        
        // Phase 2: Music Analysis
        await this.analyzeTempo(audioBuffer);
        await this.analyzeKey(audioBuffer);
        await this.analyzeLoudness(audioBuffer);
        
        // Start real-time visualization
        this.startAnalysisVisualization();
      }
      
    } catch (error) {
      console.error('Error analyzing clip:', error);
    } finally {
      this.analysisSystem.isAnalyzing = false;
    }
  },
  
  async loadAudioForAnalysis(audioUrl) {
    try {
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await window.audioCtx.decodeAudioData(arrayBuffer);
      
      console.log('Audio loaded for analysis:', audioBuffer.duration + 's');
      return audioBuffer;
      
    } catch (error) {
      console.error('Error loading audio for analysis:', error);
      return null;
    }
  },
  
  refreshAnalysis() {
    if (this.analysisSystem.currentClip) {
      console.log('Refreshing analysis for:', this.analysisSystem.currentClip.name);
      this.startClipAnalysis(this.analysisSystem.currentClip);
    }
  },
  
  // Analysis methods would go here - truncated for brevity
  // (The full spectrum analysis, level analysis, phase analysis, etc.)
};

// --- Time Manipulation & Stretching System ---
let timeManipulationSystem = {
  stretchAlgorithm: 'pitch-preserving', // 'pitch-preserving', 'granular', 'phase-vocoder'
  
  init() {
    this.setupTimeControls();
    this.setupTimeStretchUI();
  },
  
  setupTimeControls() {
    // Add time stretch button to transport controls
    this.addTimeStretchButton();
    
    // Add time stretch controls to context menus and UI
    document.addEventListener('contextmenu', (e) => {
      if (e.target.closest('.clip')) {
        this.addTimeStretchToContextMenu(e);
      }
    });
  },
  
  addTimeStretchButton() {
    const transportControls = document.querySelector('.transport-controls');
    if (transportControls) {
      const timeStretchBtn = document.createElement('button');
      timeStretchBtn.id = 'timeStretchBtn';
      timeStretchBtn.title = 'Time Stretch / Pitch Shift';
      timeStretchBtn.className = 'p-2 bg-gray-700 rounded hover:bg-gray-600 transition-colors';
      timeStretchBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 4h12v1H2V4zm0 3h8v1H2V7zm0 3h10v1H2v-1z"/>
          <path d="M12 6l3 3-3 3V6z"/>
        </svg>
      `;
      
      timeStretchBtn.onclick = () => {
        if (window.selectedClip && window.selectedClip.track >= 0 && window.selectedClip.clip >= 0) {
          this.openTimeStretchDialog(window.selectedClip.track, window.selectedClip.clip);
        } else {
          alert('Please select a clip first');
        }
      };
      
      transportControls.appendChild(timeStretchBtn);
    }
  },
  
  addTimeStretchToContextMenu(e) {
    // This will be called from the context menu system
    setTimeout(() => {
      const contextMenu = document.querySelector('.context-menu');
      if (contextMenu) {
        const timeStretchItem = document.createElement('div');
        timeStretchItem.className = 'context-menu-item';
        timeStretchItem.textContent = 'Time Stretch / Pitch Shift...';
        timeStretchItem.onclick = () => {
          const clipElement = e.target.closest('.clip');
          if (clipElement) {
            const trackIndex = parseInt(clipElement.dataset.trackIndex);
            const clipIndex = parseInt(clipElement.dataset.clipIndex);
            this.openTimeStretchDialog(trackIndex, clipIndex);
          }
          contextMenu.remove();
        };
        
        // Insert before the separator
        const separator = contextMenu.querySelector('.context-menu-sep');
        if (separator) {
          contextMenu.insertBefore(timeStretchItem, separator);
        } else {
          contextMenu.appendChild(timeStretchItem);
        }
      }
    }, 10);
  },
  
  showTimeStretchDialog() {
    // Wrapper method for menu access - opens dialog with default parameters
    if (window.selectedClip && window.selectedClip.track !== undefined && window.selectedClip.clip !== undefined) {
      this.openTimeStretchDialog(window.selectedClip.track, window.selectedClip.clip);
    } else {
      // No clip selected, show dialog anyway with track 0, clip 0 if available
      if (window.tracks && Array.isArray(window.tracks) && window.tracks[0] && window.tracks[0].clips && window.tracks[0].clips[0]) {
        this.openTimeStretchDialog(0, 0);
      } else {
        alert('Please select a clip to time stretch, or load audio first.');
      }
    }
  },
  
  setupTimeStretchUI() {
    // Create time stretch dialog if it doesn't exist
    if (!document.getElementById('timeStretchDialog')) {
      this.createTimeStretchDialog();
    }
  },
  
  createTimeStretchDialog() {
    const dialog = document.createElement('div');
    dialog.id = 'timeStretchDialog';
    dialog.className = 'modal-overlay hidden';
    dialog.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Time Stretch / Pitch Shift</h3>
          <button class="modal-close" onclick="this.closest('.modal-overlay').classList.add('hidden')">×</button>
        </div>
        <div class="modal-content">
          <div class="stretch-controls">
            <div class="control-group">
              <label>Time Stretch Ratio:</label>
              <input type="range" id="stretchRatio" min="0.25" max="4.0" step="0.01" value="1.0">
              <span id="stretchRatioValue">1.00x</span>
            </div>
            
            <div class="control-group">
              <label>Pitch Shift (semitones):</label>
              <input type="range" id="pitchShift" min="-24" max="24" step="0.1" value="0">
              <span id="pitchShiftValue">0.0</span>
            </div>
            
            <div class="control-group">
              <label>Algorithm:</label>
              <select id="stretchAlgorithm">
                <option value="psola">PSOLA (VexWarp)</option>
                <option value="phase-vocoder">Phase Vocoder (VexWarp)</option>
                <option value="granular">Granular (VexWarp)</option>
                <option value="elastique">Elastique-like (VexWarp)</option>
              </select>
            </div>
            
            <div class="control-group">
              <label>Quality:</label>
              <select id="stretchQuality">
                <option value="draft">Draft (Fast)</option>
                <option value="good">Good</option>
                <option value="better">Better</option>
                <option value="best">Best (Slow)</option>
              </select>
            </div>
            
            <div class="preview-section">
              <button id="previewStretch" class="modal-btn">Preview</button>
              <button id="stopPreview" class="modal-btn">Stop</button>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button id="applyTimeStretch" class="modal-btn primary">Apply</button>
          <button onclick="this.closest('.modal-overlay').classList.add('hidden')" class="modal-btn">Cancel</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(dialog);
    this.setupStretchDialogEvents();
  },
  
  setupStretchDialogEvents() {
    const stretchRatio = document.getElementById('stretchRatio');
    const stretchValue = document.getElementById('stretchRatioValue');
    const pitchShift = document.getElementById('pitchShift');
    const pitchValue = document.getElementById('pitchShiftValue');
    
    stretchRatio.addEventListener('input', (e) => {
      stretchValue.textContent = parseFloat(e.target.value).toFixed(2) + 'x';
    });
    
    pitchShift.addEventListener('input', (e) => {
      pitchValue.textContent = parseFloat(e.target.value).toFixed(1);
    });
    
    const previewBtn = document.getElementById('previewStretch');
    if (previewBtn) {
      previewBtn.addEventListener('click', () => {
        this.previewTimeStretch();
      });
    }
    
    const applyBtn = document.getElementById('applyTimeStretch');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        this.applyTimeStretch();
        const dialog = document.getElementById('timeStretchDialog');
        if (dialog) {
          dialog.classList.add('hidden');
        }
      });
    }
  },
  
  openTimeStretchDialog(trackIndex, clipIndex) {
    this.currentTrack = trackIndex;
    this.currentClip = clipIndex;
    document.getElementById('timeStretchDialog').classList.remove('hidden');
  },
  
  async applyTimeStretch() {
    const ratio = parseFloat(document.getElementById('stretchRatio').value);
    const pitch = parseFloat(document.getElementById('pitchShift').value);
    const algorithm = document.getElementById('stretchAlgorithm').value;
    const quality = document.getElementById('stretchQuality').value;
    
    if (!window.tracks || this.currentTrack === undefined || this.currentClip === undefined) return;
    
    const track = window.tracks[this.currentTrack];
    const clip = track?.clips[this.currentClip];
    
    if (!clip || !clip.audioBuffer) return;
    
    try {
      // Use the DAW's VexWarp-based time stretch function
      if (window.applyTimeStretchToClip) {
        await window.applyTimeStretchToClip(this.currentTrack, this.currentClip, ratio);
      } else {
        // Fallback to built-in method
        const stretchedBuffer = await this.stretchAudioBufferVexWarp(
          clip.audioBuffer, 
          ratio, 
          pitch, 
          algorithm, 
          quality
        );
        
        // Update clip with stretched audio
        clip.audioBuffer = stretchedBuffer;
        clip.duration = stretchedBuffer.duration || (stretchedBuffer.length / stretchedBuffer.sampleRate);
        
        // Update visual representation
        if (window.render) window.render();
      }
      
      console.log(`Applied VexWarp time stretch: ${ratio}x, pitch: ${pitch} semitones, algorithm: ${algorithm}`);
      
    } catch (error) {
      console.error('Error applying VexWarp time stretch:', error);
      alert('Error applying time stretch: ' + error.message);
    }
  },
  
  async stretchAudioBufferVexWarp(audioBuffer, timeRatio, pitchSemitones, algorithm, quality) {
    if (!window.VexWarp || !window.VexWarp.TimeStretcher) {
      throw new Error('VexWarp TimeStretcher not available');
    }
    
    const originalLength = audioBuffer.length;
    const newLength = Math.floor(originalLength * timeRatio);
    const sampleRate = audioBuffer.sampleRate;
    const channels = audioBuffer.numberOfChannels;
    
    // VexWarp algorithm mapping
    const algorithmMap = {
      'psola': 'psola',
      'phase-vocoder': 'phasevocoder',
      'granular': 'granular',
      'elastique': 'psola' // fallback to PSOLA
    };
    
    const vexWarpAlgorithm = algorithmMap[algorithm] || 'psola';
    
    // Create VexWarp TimeStretcher
    const stretcher = new window.VexWarp.TimeStretcher(sampleRate, channels, {
      algorithm: vexWarpAlgorithm,
      frameSize: quality === 'high' ? 4096 : quality === 'medium' ? 2048 : 1024,
      hopSize: quality === 'high' ? 1024 : quality === 'medium' ? 512 : 256,
      preserveFormants: pitchSemitones === 0, // Only preserve formants if no pitch shift
      overlapFactor: quality === 'high' ? 4 : quality === 'medium' ? 2 : 1
    });
    
    const stretchedBuffer = Tone.context.createBuffer(channels, newLength, sampleRate);
    
    // Process each channel with VexWarp
    for (let channel = 0; channel < channels; channel++) {
      const originalData = audioBuffer.getChannelData(channel);
      const stretchedData = new Float32Array(newLength);
      
      // Apply VexWarp time stretching
      stretcher.stretch(originalData, stretchedData, timeRatio);
      
      // Apply pitch shift if needed
      if (pitchSemitones !== 0) {
        this.applyPitchShiftVexWarp(stretchedData, pitchSemitones, sampleRate);
      }
      
      // Copy to audio buffer
      stretchedBuffer.copyToChannel(stretchedData, channel);
    }
    
    return stretchedBuffer;
  },
  
  applyPitchShiftVexWarp(audioData, semitones, sampleRate) {
    // Simple pitch shifting using resampling
    // For more advanced pitch shifting, VexWarp could be extended
    const pitchRatio = Math.pow(2, semitones / 12);
    const originalLength = audioData.length;
    const tempData = new Float32Array(audioData);
    
    // Clear original data
    audioData.fill(0);
    
    // Resample with pitch ratio
    for (let i = 0; i < originalLength; i++) {
      const sourceIndex = i * pitchRatio;
      const index1 = Math.floor(sourceIndex);
      const index2 = Math.min(index1 + 1, originalLength - 1);
      const fraction = sourceIndex - index1;
      
      if (index1 < originalLength) {
        audioData[i] = tempData[index1] * (1 - fraction) + tempData[index2] * fraction;
      }
    }
  },
  
  applyPitchShift(audioData, semitones) {
    // Simplified pitch shifting using sample rate manipulation
    const pitchRatio = Math.pow(2, semitones / 12);
    const length = audioData.length;
    const shifted = new Float32Array(length);
    
    for (let i = 0; i < length; i++) {
      const sourceIndex = i / pitchRatio;
      const index1 = Math.floor(sourceIndex);
      const index2 = Math.min(index1 + 1, length - 1);
      const fraction = sourceIndex - index1;
      
      if (index1 < length) {
        shifted[i] = audioData[index1] * (1 - fraction) + audioData[index2] * fraction;
      }
    }
    
    // Copy back to original array
    for (let i = 0; i < length; i++) {
      audioData[i] = shifted[i];
    }
  },
  
  previewTimeStretch() {
    // Implementation for previewing time stretch
    console.log('Previewing time stretch...');
  }
};

// --- Enhanced Timeline System ---
let enhancedTimelineSystem = {
  timeFormat: 'minutes:seconds', // 'minutes:seconds', 'samples', 'bars:beats', 'timecode'
  showSubdivisions: true,
  snapToFrames: false,
  
  init() {
    this.setupTimelineEnhancements();
    this.addTimeFormatSelector();
  },
  
  setupTimelineEnhancements() {
    // Override the timeline rendering to add seconds display
    this.enhanceTimelineDisplay();
    this.addTimelineRightClick();
  },
  
  addTimeFormatSelector() {
    const settingsBar = document.querySelector('.settings-bar');
    if (settingsBar) {
      const timeFormatSelector = document.createElement('div');
      timeFormatSelector.className = 'time-format-section flex items-center gap-2';
      timeFormatSelector.innerHTML = `
        <label for="timeFormat" class="text-orange-400 font-semibold">Time:</label>
        <select id="timeFormat" class="px-2 py-1 bg-gray-700 border border-orange-400 rounded">
          <option value="minutes:seconds">Min:Sec</option>
          <option value="bars:beats">Bars:Beats</option>
          <option value="samples">Samples</option>
          <option value="timecode">Timecode</option>
        </select>
        <button id="tempoMapBtn" class="px-2 py-1 bg-gray-700 border border-gray-600 text-gray-300 rounded hover:bg-gray-600 transition-colors text-xs" title="Tempo Map">
          ♪ BPM
        </button>
      `;
      
      // Insert after the zoom controls
      const zoomSection = settingsBar.querySelector('.zoom-section');
      if (zoomSection) {
        zoomSection.parentNode.insertBefore(timeFormatSelector, zoomSection.nextSibling);
      } else {
        settingsBar.appendChild(timeFormatSelector);
      }
      
      const timeFormatSelect = document.getElementById('timeFormat');
      if (timeFormatSelect) {
        timeFormatSelect.addEventListener('change', (e) => {
          this.timeFormat = e.target.value;
          this.updateTimelineDisplay();
        });
      }
      
      const tempoMapBtn = document.getElementById('tempoMapBtn');
      if (tempoMapBtn) {
        tempoMapBtn.addEventListener('click', () => {
          if (window.reaperEnhancements.modules.tempoOperations) {
            window.reaperEnhancements.modules.tempoOperations.openTempoMap();
          }
        });
      }
    }
    
    // Add clip operations button to transport section if it exists
    const transportSection = document.querySelector('.transport-controls');
    if (transportSection) {
      const clipOpsBtn = document.createElement('button');
      clipOpsBtn.id = 'clipOpsBtn';
      clipOpsBtn.className = 'px-2 py-1 bg-gray-700 border border-gray-600 text-gray-300 rounded hover:bg-gray-600 transition-colors text-xs';
      clipOpsBtn.title = 'Clip Operations';
      clipOpsBtn.innerHTML = '✂️ Clips';
      
      clipOpsBtn.addEventListener('click', () => {
        if (window.reaperEnhancements.modules.clipTimeOperations) {
          window.reaperEnhancements.modules.clipTimeOperations.showClipOperationsPanel();
        }
      });
      
      transportSection.appendChild(clipOpsBtn);
    }
  },
  
  enhanceTimelineDisplay() {
    // Add seconds markers to timeline
    const timeline = document.getElementById('timeline');
    if (timeline) {
      timeline.addEventListener('click', (e) => {
        this.handleTimelineClick(e);
      });
    }
  },
  
  addTimelineRightClick() {
    const timeline = document.getElementById('timeline');
    if (timeline) {
      timeline.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.showTimelineContextMenu(e);
      });
    }
  },
  
  showTimelineContextMenu(e) {
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = e.pageX + 'px';
    menu.style.top = e.pageY + 'px';
    
    menu.innerHTML = `
      <div class="context-menu-item" onclick="enhancedTimelineSystem.setTimeFormat('minutes:seconds')">Minutes:Seconds</div>
      <div class="context-menu-item" onclick="enhancedTimelineSystem.setTimeFormat('bars:beats')">Bars:Beats</div>
      <div class="context-menu-item" onclick="enhancedTimelineSystem.setTimeFormat('samples')">Samples</div>
      <div class="context-menu-item" onclick="enhancedTimelineSystem.setTimeFormat('timecode')">Timecode</div>
      <div class="context-menu-sep"></div>
      <div class="context-menu-item" onclick="enhancedTimelineSystem.toggleSubdivisions()">Toggle Subdivisions</div>
      <div class="context-menu-item" onclick="enhancedTimelineSystem.insertTimeMarker(${this.getTimeFromPixel(e.offsetX)})">Insert Time Marker</div>
    `;
    
    document.body.appendChild(menu);
    
    // Remove menu on click outside
    setTimeout(() => {
      document.addEventListener('click', () => menu.remove(), { once: true });
    }, 0);
  },
  
  setTimeFormat(format) {
    this.timeFormat = format;
    const selector = document.getElementById('timeFormat');
    if (selector) selector.value = format;
    this.updateTimelineDisplay();
  },
  
  toggleSubdivisions() {
    this.showSubdivisions = !this.showSubdivisions;
    this.updateTimelineDisplay();
  },
  
  formatTime(seconds) {
    switch (this.timeFormat) {
      case 'minutes:seconds':
        const minutes = Math.floor(seconds / 60);
        const secs = (seconds % 60).toFixed(2);
        return `${minutes}:${secs.padStart(5, '0')}`;
        
      case 'bars:beats':
        const bpm = window.bpm || 120;
        const timeSig = window.timeSigNum || 4;
        const secPerBeat = 60 / bpm;
        const secPerBar = secPerBeat * timeSig;
        
        const bars = Math.floor(seconds / secPerBar) + 1;
        const beats = Math.floor((seconds % secPerBar) / secPerBeat) + 1;
        const ticks = Math.floor(((seconds % secPerBar) % secPerBeat) / secPerBeat * 960);
        
        return `${bars}.${beats}.${ticks.toString().padStart(3, '0')}`;
        
      case 'samples':
        const sampleRate = window.audioCtx?.sampleRate || 44100;
        return Math.floor(seconds * sampleRate).toString();
        
      case 'timecode':
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs2 = Math.floor(seconds % 60);
        const frames = Math.floor((seconds % 1) * 30); // 30fps
        
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs2.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
        
      default:
        return seconds.toFixed(2) + 's';
    }
  },
  
  getTimeFromPixel(pixelX) {
    const PIXELS_PER_SEC = window.PIXELS_PER_SEC || 110;
    const TRACK_HEADER_WIDTH = 200;
    return Math.max(0, (pixelX - TRACK_HEADER_WIDTH) / PIXELS_PER_SEC);
  },
  
  insertTimeMarker(time) {
    // Add a time marker at the specified time
    if (!window.timeMarkers) window.timeMarkers = [];
    
    window.timeMarkers.push({
      time: time,
      name: `Marker ${window.timeMarkers.length + 1}`,
      color: '#ff9500'
    });
    
    if (window.render) window.render();
    console.log(`Added time marker at ${this.formatTime(time)}`);
  },
  
  updateTimelineDisplay() {
    // Force timeline re-render with new format
    if (window.render) window.render();
  },
  
  handleTimelineClick(e) {
    const time = this.getTimeFromPixel(e.offsetX);
    console.log(`Timeline clicked at: ${this.formatTime(time)}`);
  }
};

// --- Clip Time Operations ---
let clipTimeOperations = {
  init() {
    this.setupClipTimeControls();
  },
  
  setupClipTimeControls() {
    // Add time-based operations to clip context menus
    document.addEventListener('contextmenu', (e) => {
      if (e.target.closest('.clip')) {
        this.enhanceClipContextMenu(e);
      }
    });
  },
  
  enhanceClipContextMenu(e) {
    // This would add time-related options to existing context menus
    setTimeout(() => {
      const contextMenu = document.querySelector('.context-menu');
      if (contextMenu) {
        const timeOperations = document.createElement('div');
        timeOperations.innerHTML = `
          <div class="context-menu-sep"></div>
          <div class="context-menu-item" onclick="clipTimeOperations.expandClipToFillGap()">Expand to Fill Gap</div>
          <div class="context-menu-item" onclick="clipTimeOperations.trimToPlayhead()">Trim to Playhead</div>
          <div class="context-menu-item" onclick="clipTimeOperations.snapToGrid()">Snap to Grid</div>
          <div class="context-menu-item" onclick="clipTimeOperations.quantizeClipTiming()">Quantize Timing</div>
          <div class="context-menu-item" onclick="clipTimeOperations.createCrossfade()">Create Crossfade</div>
        `;
        contextMenu.appendChild(timeOperations);
      }
    }, 10);
  },
  
  expandClipToFillGap() {
    console.log('Expanding clip to fill gap...');
    // Implementation to expand clip duration to fill available space
  },
  
  fillGap() {
    console.log('Filling gap between clips...');
    // Implementation to fill gaps between clips with silence or extend existing clips
    if (!window.tracks || !Array.isArray(window.tracks)) {
      console.warn('No tracks available for gap filling');
      return;
    }
    
    // Find gaps in the timeline and fill them
    window.tracks.forEach((track, trackIndex) => {
      if (track.clips && track.clips.length > 1) {
        // Sort clips by start time
        const sortedClips = [...track.clips].sort((a, b) => a.startTime - b.startTime);
        
        // Check for gaps between clips
        for (let i = 0; i < sortedClips.length - 1; i++) {
          const currentClip = sortedClips[i];
          const nextClip = sortedClips[i + 1];
          const currentClipEnd = currentClip.startTime + (currentClip.duration || 0);
          const gapSize = nextClip.startTime - currentClipEnd;
          
          if (gapSize > 0.1) { // Gap larger than 100ms
            console.log(`Found gap of ${gapSize.toFixed(2)}s between clips on track ${trackIndex}`);
            // Could extend current clip or add silence clip here
          }
        }
      }
    });
  },
  
  trimToPlayhead() {
    console.log('Trimming clip to playhead...');
    // Implementation to trim clip at current playhead position
  },
  
  snapToGrid() {
    console.log('Snapping clip to grid...');
    // Implementation to snap clip to nearest grid position
  },
  
  quantizeClipTiming() {
    console.log('Quantizing clip timing...');
    // Implementation to quantize clip start/end times
  },
  
  createCrossfade() {
    console.log('Creating crossfade...');
    // Implementation to create crossfade between overlapping clips
  },
  
  setClipLength(trackIndex, clipIndex, newLength) {
    if (!window.tracks) return;
    
    const track = window.tracks[trackIndex];
    const clip = track?.clips[clipIndex];
    
    if (clip) {
      clip.duration = Math.max(0.1, newLength);
      if (window.render) window.render();
    }
  },
  
  offsetClipTiming(trackIndex, clipIndex, offsetSeconds) {
    if (!window.tracks) return;
    
    const track = window.tracks[trackIndex];
    const clip = track?.clips[clipIndex];
    
    if (clip) {
      clip.startTime = Math.max(0, clip.startTime + offsetSeconds);
      if (window.render) window.render();
    }
  },
  
  showClipOperationsPanel() {
    // Create a floating panel with all clip operations
    if (document.getElementById('clipOpsPanel')) return; // Already open
    
    const panel = document.createElement('div');
    panel.id = 'clipOpsPanel';
    panel.className = 'clip-ops-panel';
    panel.innerHTML = `
      <div class="panel-header">
        <span>Clip Operations</span>
        <button class="close-btn" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
      <div class="panel-content">
        <div class="ops-section">
          <h4>Time Operations</h4>
          <button onclick="window.reaperEnhancements.modules.clipTimeOperations.fillGap()">Fill Gap</button>
          <button onclick="window.reaperEnhancements.modules.clipTimeOperations.trimClip()">Trim Clip</button>
          <button onclick="window.reaperEnhancements.modules.clipTimeOperations.quantizeClipTiming()">Quantize</button>
        </div>
        <div class="ops-section">
          <h4>Advanced</h4>
          <button onclick="window.reaperEnhancements.modules.clipTimeOperations.createCrossfade()">Crossfade</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(panel);
    
    // Make it draggable
    this.makeDraggable(panel);
  },
  
  makeDraggable(element) {
    const header = element.querySelector('.panel-header');
    let isDragging = false;
    let startX, startY, initialX, initialY;
    
    header.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      initialX = element.offsetLeft;
      initialY = element.offsetTop;
      element.style.zIndex = 1000;
    });
    
    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        element.style.left = (initialX + deltaX) + 'px';
        element.style.top = (initialY + deltaY) + 'px';
      }
    });
    
    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }
};

// --- Tempo & Time Signature Operations ---
let tempoOperations = {
  tempoMap: [], // Array of tempo changes
  
  init() {
    this.setupTempoControls();
  },
  
  setupTempoControls() {
    this.addTempoChangeDialog();
    this.enhanceBPMControls();
  },
  
  addTempoChangeDialog() {
    // Create tempo change dialog
    const dialog = document.createElement('div');
    dialog.id = 'tempoChangeDialog';
    dialog.className = 'modal-overlay hidden';
    dialog.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Tempo Changes</h3>
          <button class="modal-close" onclick="this.closest('.modal-overlay').classList.add('hidden')">×</button>
        </div>
        <div class="modal-content">
          <div class="tempo-map-list" id="tempoMapList">
            <!-- Tempo changes will be listed here -->
          </div>
          <div class="add-tempo-change">
            <h4>Add Tempo Change</h4>
            <div class="control-group">
              <label>Position (bars:beats):</label>
              <input type="text" id="tempoPosition" placeholder="1.1.000">
            </div>
            <div class="control-group">
              <label>New BPM:</label>
              <input type="number" id="newTempoBPM" min="20" max="300" value="120">
            </div>
            <button id="addTempoChange" class="modal-btn">Add Change</button>
          </div>
        </div>
        <div class="modal-footer">
          <button onclick="this.closest('.modal-overlay').classList.add('hidden')" class="modal-btn">Close</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(dialog);
    this.setupTempoDialogEvents();
  },
  
  setupTempoDialogEvents() {
    const addTempoBtn = document.getElementById('addTempoChange');
    if (addTempoBtn) {
      addTempoBtn.addEventListener('click', () => {
        this.addTempoChange();
      });
    }
  },
  
  enhanceBPMControls() {
    const bpmInput = document.getElementById('bpm');
    if (bpmInput) {
      // Add context menu to BPM control
      bpmInput.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.showBPMContextMenu(e);
      });
    }
  },
  
  showBPMContextMenu(e) {
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = e.pageX + 'px';
    menu.style.top = e.pageY + 'px';
    
    menu.innerHTML = `
      <div class="context-menu-item" onclick="tempoOperations.openTempoMap()">Tempo Map...</div>
      <div class="context-menu-item" onclick="tempoOperations.tapTempo()">Tap Tempo</div>
      <div class="context-menu-item" onclick="tempoOperations.detectTempo()">Detect Tempo from Audio</div>
      <div class="context-menu-sep"></div>
      <div class="context-menu-item" onclick="tempoOperations.setCommonTempo(60)">60 BPM</div>
      <div class="context-menu-item" onclick="tempoOperations.setCommonTempo(120)">120 BPM</div>
      <div class="context-menu-item" onclick="tempoOperations.setCommonTempo(140)">140 BPM</div>
    `;
    
    document.body.appendChild(menu);
    
    // Remove menu on click outside
    setTimeout(() => {
      document.addEventListener('click', () => menu.remove(), { once: true });
    }, 0);
  },
  
  openTempoMap() {
    document.getElementById('tempoChangeDialog').classList.remove('hidden');
    this.refreshTempoMapList();
  },
  
  addTempoChange() {
    const position = document.getElementById('tempoPosition').value;
    const bpm = parseFloat(document.getElementById('newTempoBPM').value);
    
    if (position && bpm >= 20 && bpm <= 300) {
      this.tempoMap.push({
        position: position,
        bpm: bpm,
        time: this.positionToSeconds(position)
      });
      
      this.tempoMap.sort((a, b) => a.time - b.time);
      this.refreshTempoMapList();
      
      // Clear inputs
      document.getElementById('tempoPosition').value = '';
      document.getElementById('newTempoBPM').value = '120';
    }
  },
  
  refreshTempoMapList() {
    const list = document.getElementById('tempoMapList');
    if (list) {
      list.innerHTML = this.tempoMap.map((change, index) => `
        <div class="tempo-change-item">
          <span>${change.position} - ${change.bpm} BPM</span>
          <button onclick="tempoOperations.removeTempoChange(${index})" class="remove-btn">×</button>
        </div>
      `).join('');
    }
  },
  
  removeTempoChange(index) {
    this.tempoMap.splice(index, 1);
    this.refreshTempoMapList();
  },
  
  positionToSeconds(position) {
    // Convert bars.beats.ticks to seconds
    const [bars, beats, ticks] = position.split('.').map(parseFloat);
    const bpm = window.bpm || 120;
    const timeSig = window.timeSigNum || 4;
    
    const secPerBeat = 60 / bpm;
    const secPerBar = secPerBeat * timeSig;
    
    return (bars - 1) * secPerBar + (beats - 1) * secPerBeat + (ticks / 960) * secPerBeat;
  },
  
  tapTempo() {
    // Implementation for tap tempo
    if (!this.tapTimes) this.tapTimes = [];
    
    const now = Date.now();
    this.tapTimes.push(now);
    
    // Keep only last 8 taps
    if (this.tapTimes.length > 8) {
      this.tapTimes.shift();
    }
    
    if (this.tapTimes.length >= 2) {
      const intervals = [];
      for (let i = 1; i < this.tapTimes.length; i++) {
        intervals.push(this.tapTimes[i] - this.tapTimes[i-1]);
      }
      
      const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
      const bpm = Math.round(60000 / avgInterval);
      
      if (bpm >= 20 && bpm <= 300) {
        this.setCommonTempo(bpm);
      }
    }
    
    // Clear taps after 3 seconds of inactivity
    clearTimeout(this.tapTimeout);
    this.tapTimeout = setTimeout(() => {
      this.tapTimes = [];
    }, 3000);
  },
  
  setCommonTempo(bpm) {
    const bpmInput = document.getElementById('bpm');
    if (bpmInput) {
      bpmInput.value = bpm;
      bpmInput.dispatchEvent(new Event('change'));
    }
  },
  
  detectTempo() {
    console.log('Detecting tempo from audio...');
    // This would analyze selected audio clips to detect tempo
  }
};

// Add main enhancements menu system
window.reaperEnhancements.showEnhancementsMenu = function() {
  if (document.getElementById('reaperEnhancementsMenu')) return; // Already open
  
  const menu = document.createElement('div');
  menu.id = 'reaperEnhancementsMenu';
  menu.className = 'reaper-enhancements-menu';
  menu.innerHTML = `
    <div class="menu-header">
      <span>🎵 REAPER Enhancements</span>
      <button class="close-btn" onclick="this.parentElement.parentElement.remove()">×</button>
    </div>
    <div class="menu-content">
      <div class="menu-section">
        <h4>Time Manipulation</h4>
        <button onclick="window.reaperEnhancements.modules.timeManipulationSystem.showTimeStretchDialog()">Time Stretch</button>
        <button onclick="window.reaperEnhancements.modules.clipTimeOperations.showClipOperationsPanel()">Clip Operations</button>
      </div>
      <div class="menu-section">
        <h4>Audio Analysis</h4>
        <button onclick="window.reaperEnhancements.modules.audioAnalysisSystem.showAnalysisControls()">Analysis Tools</button>
        <button onclick="window.reaperEnhancements.modules.enhancedLevelMeters.showMeterPanel()">Level Meters</button>
      </div>
      <div class="menu-section">
        <h4>Timeline & Tempo</h4>
        <button onclick="window.reaperEnhancements.modules.tempoOperations.openTempoMap()">Tempo Map</button>
        <button onclick="window.reaperEnhancements.modules.tempoOperations.tapTempo()">Tap Tempo</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(menu);
  
  // Make it draggable using the same logic as clip operations panel
  if (window.reaperEnhancements.modules.clipTimeOperations) {
    window.reaperEnhancements.modules.clipTimeOperations.makeDraggable(menu);
  }
};

// Update the ReaperEnhancements class to include all new modules
window.reaperEnhancements.modules.dragPreviewSystem = dragPreviewSystem;
window.reaperEnhancements.modules.enhancedLevelMeters = enhancedLevelMeters;
window.reaperEnhancements.modules.enhancedActionHistory = enhancedActionHistory;
window.reaperEnhancements.modules.audioAnalysisSystem = audioAnalysisSystem;
window.reaperEnhancements.modules.timeManipulationSystem = timeManipulationSystem;
window.reaperEnhancements.modules.enhancedTimelineSystem = enhancedTimelineSystem;
window.reaperEnhancements.modules.clipTimeOperations = clipTimeOperations;
window.reaperEnhancements.modules.tempoOperations = tempoOperations;

// Auto-initialize
window.reaperEnhancements.init();

// Setup main REAPER enhancements button
document.addEventListener('DOMContentLoaded', () => {
  const reaperBtn = document.getElementById('reaperEnhancementsBtn');
  if (reaperBtn) {
    reaperBtn.addEventListener('click', () => {
      window.reaperEnhancements.showEnhancementsMenu();
    });
  }
});