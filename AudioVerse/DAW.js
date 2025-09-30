const BASE_PIXELS_PER_SEC = 110;
const MIN_CLIP_WIDTH = 36;
const DEFAULT_TRACKS = 2;
const DEFAULT_BPM = 120;
const DEFAULT_SIG_NUM = 4;
const DEFAULT_SIG_DEN = 4;
const MAX_TIME = 600; // Increased from 180 to 600 seconds (10 minutes)
const MAX_BARS = 500; // Increased from 128 to 500 bars
const CLIP_COLORS = [
  "#1de9b6", "#42a5f5", "#ffb300", "#ec407a", "#ffd600", "#8bc34a",
  "#00bcd4", "#ba68c8", "#ff7043", "#90caf9", "#cddc39"
];
const TRACK_COLORS = [
  "#374151", "#232b36", "#2d3748", "#3b4252", "#223",
];
let TRACK_HEADER_WIDTH = 200; // px, must match .track-header width in CSS

// --- State ---
let tracks = [];
let selectedTrackIndex = 0;
let audioCtx = null;
let isRecording = false;
let mediaRecorder = null;
let recordedChunks = [];
let liveRecordingBuffer = [];
let liveRecordingStart = 0;
let recordingWorklet = null;
let recordingStream = null;
let recordingInputNode = null;
let recordingGainNode = null;
let playheadTime = 0;

// --- Tone.js and Automation System State ---
let toneStarted = false;
let currentAutomationType = 'volume'; // Only volume automation now
let currentEditingClip = null;
let playRequestId = null;
let playing = false;
let selectedClip = null;
let copiedClip = null;
let toneClips = new Map(); // Map of clip ID to Tone.js players and volume nodes
let zoomLevel = 1;
let PIXELS_PER_SEC = BASE_PIXELS_PER_SEC;
let bpm = DEFAULT_BPM;
let timeSigNum = DEFAULT_SIG_NUM;
let timeSigDen = DEFAULT_SIG_DEN;
let metronomeEnabled = false;
let metronomeTimeout = null;
let metronomeTickBuffer = null;
let metronomeAccentBuffer = null;
let contextMenuEl = null;
// New Web Audio API additions
let masterGainNode = null;
let analyserNode = null;
let filterNodes = new Map(); // Per-track filters
let trackGainNodes = new Map(); // Per-track gain nodes
let trackPanNodes = new Map(); // Per-track stereo panner nodes
// Removed pitch automation system - using selection-based pitch shifting instead
let trackInsertChains = new Map(); // Per-track insert plugin chains { chain: [{id, instance, slotIndex}], inputNode, outputNode }
// Expose to global scope for FXPlugins access
window.trackInsertChains = trackInsertChains;
let fxPendingSelect = null; // { trackIndex, slotIndex }
let fxSelected = null; // { trackIndex, slotIndex }
let clipboard = null; // For copy/paste operations
let undoStack = [];
let redoStack = [];
let activeAudioSources = []; // Track active audio sources for proper stopping
// Settings state
let settings = {
  autoScroll: true,
  snapToGrid: true,
  showTriplets: true,
  confirmDelete: false,
  faderCurve: 'db' // 'db' or 'linear'
};

// Shortcut definitions
const SHORTCUTS = [
  { keys: 'Space', label: 'Play/Pause' },
  { keys: 'R', label: 'Record' },
  { keys: 'S', label: 'Stop' },
  { keys: 'Ctrl/Cmd+Z', label: 'Undo' },
  { keys: 'Ctrl/Cmd+Shift+Z', label: 'Redo' },
  { keys: 'Ctrl/Cmd+C', label: 'Copy Clip' },
  { keys: 'Ctrl/Cmd+V', label: 'Paste Clip at Playhead' },
  { keys: 'D', label: 'Duplicate Clip' },
  { keys: 'Q', label: 'Quantize Selected Clip' },
  { keys: 'Delete / Backspace', label: 'Delete Selected Clip' },
  { keys: '+ / =', label: 'Zoom In' },
  { keys: '- / _', label: 'Zoom Out' },
  { keys: 'Shift+/', label: 'Open Settings' }
];

// DOM Elements
const recordBtn = document.getElementById('recordBtn');
const stopBtn = document.getElementById('stopBtn');
const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const goToStartBtn = document.getElementById('goToStartBtn');
const skipBackBtn = document.getElementById('skipBackBtn');
const skipForwardBtn = document.getElementById('skipForwardBtn');
const timelineDiv = document.getElementById('timeline');
const tracksDiv = document.getElementById('tracks');
const fileInput = document.getElementById('fileInput');
const addTrackBtn = document.getElementById('addTrackBtn');
const bpmInput = document.getElementById('bpm');
const tsNumInput = document.getElementById('timeSigNum');
const tsDenInput = document.getElementById('timeSigDen');
const metronomeBtn = document.getElementById('metronomeBtn');

const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const workspace = document.getElementById('workspace');
const arrangeViewBtn = document.getElementById('arrangeViewBtn');
const mixerViewBtn = document.getElementById('mixerViewBtn');
const fxViewBtn = document.getElementById('fxViewBtn');
const arrangementWindow = document.getElementById('arrangementWindow');
const mixerWindow = document.getElementById('mixerWindow');
// FX modal elements
const fxOverlay = document.getElementById('fxOverlay');
const fxDialog = document.getElementById('fxDialog');
const fxClose = document.getElementById('fxClose');
const fxCloseFooter = document.getElementById('fxCloseFooter');
const mixerChannels = document.getElementById('mixerChannels');
const editorViewBtn = document.getElementById('editorViewBtn');
const editorWindow = document.getElementById('editorWindow');
const backButton = document.getElementById('backButton');
const editorClipName = document.getElementById('editorClipName');
const editorClipDetails = document.getElementById('editorClipDetails');
const editorWaveformCanvas = document.getElementById('editorWaveformCanvas');
const editorPlayhead = document.getElementById('editorPlayhead');
const editorSelection = document.getElementById('editorSelection');
const editorTimeline = document.getElementById('editorTimeline');
// Settings DOM
const settingsBtn = document.getElementById('settingsBtn');
const settingsOverlay = document.getElementById('settingsOverlay');
const settingsDialog = document.getElementById('settingsDialog');
const settingsClose = document.getElementById('settingsClose');
const settingsSave = document.getElementById('settingsSave');
const settingsCancel = document.getElementById('settingsCancel');
const setAutoScroll = document.getElementById('setAutoScroll');
const setSnapToGrid = document.getElementById('setSnapToGrid');
const setTripletGuides = document.getElementById('setTripletGuides');
const setConfirmDelete = document.getElementById('setConfirmDelete');
const shortcutsList = document.getElementById('shortcutsList');

// --- Data Model ---
function createTrack(label, color) {
  return {
    label: label || `Track ${tracks.length + 1}`,
    color: color || TRACK_COLORS[tracks.length % TRACK_COLORS.length],
    clips: [],
    muted: false,
    solo: false,
    armed: false,
  volume: 0.8, // linear gain applied to audio graph
  faderPos: 0.8, // UI position 0..1 mapped via pos->gain
    pan: 0,
  io: { input: 'Input 1', output: 'Master' },
  inserts: [null, null, null, null, null], // plugin ids or null
  insertEnabled: [true, true, true, true, true],
  fxBypass: false,
  sends: { A: 0, B: 0, C: 0, D: 0, E: 0 }, // 0..1
    selected: false,
    id: Math.random().toString(36).slice(2,9),
    // Simple volume automation: array of {time, value} points
    volumeAuto: {
      enabled: false,
      points: [
        { time: 0, value: 0.8 },
        { time: MAX_TIME, value: 0.8 }
      ]
    }
  };
}
function createClip(audioBuffer, startTime, duration, offset=0, color, name, audioUrl = null, mimeType = null) {
  const clip = {
    id: Math.random().toString(36).slice(2,9),
    audioBuffer,
    startTime, // in seconds
    duration,  // in seconds
    offset,    // in seconds, offset in source buffer
    selected: false,
    color: color || CLIP_COLORS[Math.floor(Math.random()*CLIP_COLORS.length)],
    name: name || "Clip",
    // Volume automation system (Tone.js based)
    automation: {
      volume: {
        enabled: false,
        curved: true,
        minRange: -100, // dB
        maxRange: 12,   // dB
        points: [] // Array of {time, value} relative to clip start
      }
    },
    // Tone.js integration
    audioUrl: audioUrl,
    mimeType: mimeType,
    tonePlayer: null, // Will store Tone.Player instance
    toneVolume: null, // Will store Tone.Volume node
    useTone: false // Track whether Tone.js is available for this clip
  };
  
  // Create Tone.js Player and Volume node if we have an audio URL and Tone.js is available
  if (audioUrl && typeof Tone !== 'undefined') {
    console.log(`Creating Tone.Player for clip: ${name}, URL: ${audioUrl}, MIME: ${mimeType}`);
    
    try {
      // Create Tone.Player for audio playback
      clip.tonePlayer = new Tone.Player({
        url: audioUrl,
        onload: () => {
          console.log('Tone.Player loaded successfully for clip:', name);
          clip.useTone = true;
          
          // Set up volume automation node
          clip.toneVolume = new Tone.Volume(0); // Start at 0dB
          
          // Connect player through volume node to destination
          clip.tonePlayer.connect(clip.toneVolume);
          clip.toneVolume.toDestination();
          
          // Store in global map for easy access
          toneClips.set(clip.id, {
            player: clip.tonePlayer,
            volume: clip.toneVolume,
            clip: clip
          });
        },
        onerror: (error) => {
          console.error('Failed to load Tone.Player for clip:', name, 'Error:', error);
          clip.useTone = false;
          // Clean up failed Tone objects
          if (clip.tonePlayer) {
            clip.tonePlayer.dispose();
            clip.tonePlayer = null;
          }
          if (clip.toneVolume) {
            clip.toneVolume.dispose();
            clip.toneVolume = null;
          }
        }
      });
    } catch (error) {
      console.error('Error creating Tone.Player for clip:', name, error);
      clip.useTone = false;
    }
  }
  
  return clip;
}

// --- Timeline ---
function getSecPerBeat() { return 60 / bpm; }
function getSecPerBar() { return getSecPerBeat() * timeSigNum; }
function getFurthestClipEnd() {
  let maxEnd = 0;
  tracks.forEach(track => {
    track.clips.forEach(clip => {
      maxEnd = Math.max(maxEnd, clip.startTime + clip.duration);
    });
  });
  return maxEnd;
}
function getTotalBars() {
  // Calculate based on furthest clip or a reasonable default
  const furthestEnd = getFurthestClipEnd();
  const barsByClips = Math.ceil(furthestEnd / getSecPerBar());
  // Use a more reasonable maximum that allows for longer projects
  return Math.max(barsByClips, Math.min(500, Math.max(100, barsByClips + 50))); 
}
function getTimelineWidth() {
  return TRACK_HEADER_WIDTH + getTotalBars() * getSecPerBar() * PIXELS_PER_SEC;
}

let autoScrollEnabled = true; // default to enabled

function renderTimeline() {
  timelineDiv.innerHTML = '';
  timelineDiv.style.width = getTimelineWidth() + 'px';
  timelineDiv.style.position = 'relative';

  const gridOffset = TRACK_HEADER_WIDTH;
  const secPerBar = getSecPerBar();
  const secPerBeat = getSecPerBeat();
  const totalBars = getTotalBars();

  // Determine subdivision based on zoom level
  let subdivisions = 1;
  if (zoomLevel > 1.5) subdivisions = 4; // 16th notes
  else if (zoomLevel > 1.1) subdivisions = 2; // 8th notes

  // Triplet grid always shown if zoomed in enough
  const showTriplets = settings.showTriplets && zoomLevel > 1.2;

  for (let bar = 0; bar <= totalBars; bar++) {
    let left = gridOffset + bar * secPerBar * PIXELS_PER_SEC;
    // Bar marker
    let marker = document.createElement('div');
    marker.className = 'bar-marker';
    marker.style.left = left + 'px';
    marker.style.height = '80%';
    timelineDiv.appendChild(marker);

    // Bar label
    let label = document.createElement('span');
    label.className = 'bar-label';
    label.innerText = `${bar+1}`;
    label.style.left = (left+2) + 'px';
    timelineDiv.appendChild(label);

    // Beat markers
    if (bar < totalBars) {
      for (let beat = 1; beat < timeSigNum; beat++) {
        let bleft = gridOffset + left - gridOffset + beat * secPerBeat * PIXELS_PER_SEC;
        let bm = document.createElement('div');
        bm.className = 'beat-marker';
        bm.style.left = bleft + 'px';
        bm.style.height = '60%';
        timelineDiv.appendChild(bm);

        // Subdivision markers (e.g., 8th/16th notes)
        if (subdivisions > 1) {
          for (let sub = 1; sub < subdivisions; sub++) {
            let subLeft = bleft + (sub * secPerBeat * PIXELS_PER_SEC) / subdivisions;
            let subDiv = document.createElement('div');
            subDiv.className = 'beat-marker grid-line';
            subDiv.style.left = subLeft + 'px';
            subDiv.style.height = '40%';
            subDiv.style.opacity = '0.35';
            timelineDiv.appendChild(subDiv);
          }
        }

        // Triplet grid markers
        if (showTriplets) {
          for (let trip = 1; trip < 3; trip++) {
            let tripLeft = bleft + (trip * secPerBeat * PIXELS_PER_SEC) / 3;
            let tripDiv = document.createElement('div');
            tripDiv.className = 'beat-marker grid-line';
            tripDiv.style.left = tripLeft + 'px';
            tripDiv.style.height = '30%';
            tripDiv.style.background = '#ff9500';
            tripDiv.style.opacity = '0.25';
            timelineDiv.appendChild(tripDiv);
          }
        }
      }
    }
  }
  // Playhead
  let playhead = document.createElement('div');
  playhead.className = 'playhead';
  playhead.style.left = (gridOffset + playheadTime * PIXELS_PER_SEC) + 'px';
  playhead.style.height = '100%';
  timelineDiv.appendChild(playhead);
}

// --- Tracks and Clips ---
function renderTracks() {
  tracksDiv.innerHTML = '';
  tracks.forEach((track, tIdx) => {
    // Track Container
    let trackContainer = document.createElement('div');
    trackContainer.className = 'track-container';
    
    // Track Header
    let trackHeader = document.createElement('div');
    trackHeader.className = 'track-header' + (track.selected ? ' selected' : '');
    trackHeader.dataset.track = tIdx;
    trackHeader.onclick = () => selectTrack(tIdx);
    
    // Add context menu to track header
    trackHeader.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showTrackContextMenu(e, tIdx);
    });
    
    // Track number and name
    let trackInfo = document.createElement('div');
    trackInfo.className = 'track-info';
    
    let trackNumber = document.createElement('div');
    trackNumber.className = 'track-number';
    trackNumber.innerText = tIdx + 1;
    
    let trackName = document.createElement('div');
    trackName.className = 'track-name';
    trackName.innerText = track.label;
    trackName.ondblclick = (e) => {
      e.stopPropagation();
      renameTrack(tIdx);
    };
    
    trackInfo.appendChild(trackNumber);
    trackInfo.appendChild(trackName);
    
    // Track Controls
    let trackControls = document.createElement('div');
    trackControls.className = 'track-controls-header';
    
    // Record Arm Button
    let armBtn = document.createElement('button');
    armBtn.className = 'track-btn arm-btn' + (track.armed ? ' active' : '');
    armBtn.innerHTML = '●';
    armBtn.title = 'Record Arm';
    armBtn.onclick = (e) => {
      e.stopPropagation();
      toggleTrackArm(tIdx);
    };
    
    // Mute Button
    let muteBtn = document.createElement('button');
    muteBtn.className = 'track-btn mute-btn' + (track.muted ? ' active' : '');
    muteBtn.innerHTML = 'M';
    muteBtn.title = 'Mute';
    muteBtn.onclick = (e) => {
      e.stopPropagation();
      toggleTrackMute(tIdx);
    };
    
    // Solo Button
    let soloBtn = document.createElement('button');
    soloBtn.className = 'track-btn solo-btn' + (track.solo ? ' active' : '');
    soloBtn.innerHTML = 'S';
    soloBtn.title = 'Solo';
    soloBtn.onclick = (e) => {
      e.stopPropagation();
      toggleTrackSolo(tIdx);
    };
    
    // Volume Slider
    let volumeContainer = document.createElement('div');
    volumeContainer.className = 'volume-container';
    
    let volumeSlider = document.createElement('input');
    volumeSlider.type = 'range';
    volumeSlider.className = 'volume-slider';
    volumeSlider.min = '0';
    volumeSlider.max = '1';
    volumeSlider.step = '0.01';
    volumeSlider.value = track.volume;
    volumeSlider.title = 'Volume';
    volumeSlider.oninput = (e) => {
      e.stopPropagation();
      setTrackVolume(tIdx, parseFloat(e.target.value));
    };
    
    let volumeLabel = document.createElement('div');
    volumeLabel.className = 'volume-label';
    volumeLabel.innerText = Math.round(track.volume * 100);
    
    volumeContainer.appendChild(volumeSlider);
    volumeContainer.appendChild(volumeLabel);

    // Automation Button
    let automationBtn = document.createElement('button');
    automationBtn.className = 'track-btn automation-btn' + (track.volumeAuto.enabled ? ' active' : '');
    automationBtn.innerHTML = 'A';
    automationBtn.title = 'Track Volume Automation';
    automationBtn.onclick = (e) => {
      e.stopPropagation();
      openTrackAutomation(tIdx);
    };

    trackControls.appendChild(armBtn);
    trackControls.appendChild(muteBtn);
    trackControls.appendChild(soloBtn);
    trackControls.appendChild(automationBtn);
    trackControls.appendChild(volumeContainer);
    
    trackHeader.appendChild(trackInfo);
    trackHeader.appendChild(trackControls);
    
    // Track Area (for clips)
    let trackDiv = document.createElement('div');
    trackDiv.className = 'track' + (track.muted ? ' muted' : '') + (track.selected ? ' selected' : '');
    trackDiv.style.height = (track.height || 90) + "px";
    trackDiv.style.position = 'relative';
    trackDiv.style.background = track.color;
    trackDiv.dataset.track = tIdx;

    // Add context menu to track div (for empty areas)
    trackDiv.addEventListener('contextmenu', (e) => {
      // Only show track context menu if not clicking on a clip
      if (!e.target.closest('.clip')) {
        e.preventDefault();
        e.stopPropagation();
        showTrackContextMenu(e, tIdx);
      }
    });

    // Render Clips with context menus and double-click listeners
    track.clips.forEach((clip, cIdx) => {
      let clipDiv = document.createElement('div');
      clipDiv.className = 'clip audio-clip' + (clip.selected ? ' selected' : '');
      const left = clip.startTime * PIXELS_PER_SEC;
      const width = Math.max(clip.duration * PIXELS_PER_SEC, MIN_CLIP_WIDTH);
      clipDiv.style.left = left + 'px';
      clipDiv.style.width = width + 'px';
      clipDiv.draggable = true;
      clipDiv.tabIndex = 0;
      clipDiv.dataset.track = tIdx;
      clipDiv.dataset.clip = cIdx;
      clipDiv.title = clip.name + ' - Drag to move. Right-click for actions';
      clipDiv.style.background = clip.color;

      // Add context menu to clip
      clipDiv.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectClip(tIdx, cIdx);
        showClipContextMenu(e, tIdx, cIdx, clipDiv);
      });

      // Enhanced Waveform Canvas with selection highlighting
      let canvas = document.createElement('canvas');
      canvas.className = 'waveform-canvas';
      canvas.width = width - 8;
      canvas.height = 62;
      drawWaveform(canvas, clip.audioBuffer, clip.offset, clip.duration, false, clip.selected);
      clipDiv.appendChild(canvas);

      // Spectrum canvas for real-time analysis during playback
      if (playing && clip.selected) {
        let spectrumCanvas = document.createElement('canvas');
        spectrumCanvas.className = 'spectrum-canvas';
        spectrumCanvas.width = 180;
        spectrumCanvas.height = 62;
        drawSpectrum(spectrumCanvas, track);
        clipDiv.appendChild(spectrumCanvas);
      }

      // Name
      let nameDiv = document.createElement('div');
      nameDiv.style.position = 'absolute';
      nameDiv.style.left = '7px';
      nameDiv.style.top = '2px';
      nameDiv.style.fontWeight = 'bold';
      nameDiv.style.fontSize = '0.92em';
      nameDiv.style.color = '#21272e';
      nameDiv.innerText = clip.name;
      clipDiv.appendChild(nameDiv);

      // Add resize handle for time stretching
      let resizeHandle = document.createElement('div');
      resizeHandle.className = 'clip-resize-handle';
      resizeHandle.style.position = 'absolute';
      resizeHandle.style.right = '0';
      resizeHandle.style.top = '0';
      resizeHandle.style.width = '8px';
      resizeHandle.style.height = '100%';
      resizeHandle.style.cursor = 'ew-resize';
      resizeHandle.style.background = 'rgba(255, 255, 255, 0.3)';
      resizeHandle.style.opacity = '0';
      resizeHandle.style.transition = 'opacity 0.2s';
      resizeHandle.style.zIndex = '10';
      resizeHandle.title = 'Drag to time stretch';
      
      // Show handle on hover
      clipDiv.addEventListener('mouseenter', () => {
        resizeHandle.style.opacity = '1';
      });
      
      clipDiv.addEventListener('mouseleave', () => {
        if (!resizeHandle.dataset.dragging) {
          resizeHandle.style.opacity = '0';
        }
      });
      
      clipDiv.appendChild(resizeHandle);

      // Add resize drag functionality
      let isResizing = false;
      let originalWidth = 0;
      let originalDuration = 0;
      let startX = 0;
      
      resizeHandle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        isResizing = true;
        resizeHandle.dataset.dragging = 'true';
        resizeHandle.style.opacity = '1';
        
        originalWidth = clipDiv.offsetWidth;
        originalDuration = clip.duration;
        startX = e.clientX;
        
        // Add global mouse events
        const handleMouseMove = (e) => {
          if (!isResizing) return;
          
          const deltaX = e.clientX - startX;
          const newWidth = Math.max(MIN_CLIP_WIDTH, originalWidth + deltaX);
          const newDuration = newWidth / PIXELS_PER_SEC;
          const stretchRatio = newDuration / originalDuration;
          
          // Update visual feedback
          clipDiv.style.width = newWidth + 'px';
          
          // Update canvas width
          const canvas = clipDiv.querySelector('.waveform-canvas');
          if (canvas && clip.audioBuffer) {
            canvas.width = newWidth - 8;
            
            // Verify audio buffer integrity before drawing
            const bufferOk = clip.audioBuffer && 
                           clip.audioBuffer.length > 0 && 
                           clip.audioBuffer.getChannelData(0) && 
                           clip.audioBuffer.getChannelData(0).length > 0;
            
            if (bufferOk) {
              drawWaveform(canvas, clip.audioBuffer, clip.offset, newDuration, false, clip.selected);
            } else {
              console.warn('Audio buffer invalid during drag, skipping waveform draw');
            }
          }
          
          // Show stretch ratio tooltip
          clipDiv.title = `${clip.name} - Stretch: ${stretchRatio.toFixed(2)}x (${newDuration.toFixed(2)}s)`;
        };
        
        const handleMouseUp = (e) => {
          if (!isResizing) return;
          
          isResizing = false;
          resizeHandle.dataset.dragging = 'false';
          
          const deltaX = e.clientX - startX;
          const newWidth = Math.max(MIN_CLIP_WIDTH, originalWidth + deltaX);
          const newDuration = newWidth / PIXELS_PER_SEC;
          const stretchRatio = newDuration / originalDuration;
          
          // Apply time stretch using VexWarp if the ratio changed significantly
          if (Math.abs(stretchRatio - 1.0) > 0.01) {
            console.log('Applying time stretch from drag:', {
              trackIndex: tIdx,
              clipIndex: cIdx,
              stretchRatio: stretchRatio,
              originalDuration: originalDuration,
              newDuration: newDuration,
              clipName: clip.name,
              hasAudioBuffer: !!clip.audioBuffer,
              audioBufferLength: clip.audioBuffer ? clip.audioBuffer.length : 'N/A'
            });
            
            applyTimeStretchToClip(tIdx, cIdx, stretchRatio);
          } else {
            console.log('Stretch ratio too small, not applying:', stretchRatio);
            
            // Just update the duration for visual purposes if no actual stretching
            clip.duration = newDuration;
            render();
          }
          
          // Clean up event listeners
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
          
          // Reset tooltip
          clipDiv.title = clip.name + ' - Drag to move. Right-click for actions';
        };
        
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      });

      // Dragging (only for the clip body, not the resize handle)
      clipDiv.addEventListener('dragstart', (e) => {
        if (e.target === resizeHandle || e.target.closest('.clip-resize-handle')) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.setData('text/plain', JSON.stringify({tIdx, cIdx}));
      });

      clipDiv.addEventListener('click', (e) => {
        selectClip(tIdx, cIdx);
        e.stopPropagation();
      });

      // Add double-click event listener to open audio editor
      clipDiv.addEventListener('dblclick', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openAudioEditor(tIdx, cIdx, clip);
      });

      trackDiv.appendChild(clipDiv);
    });

    // Live recording preview - only on armed tracks
    if (isRecording && track.armed && liveRecordingBuffer.length > 0) {
      const recLeft = liveRecordingStart * PIXELS_PER_SEC;
      const recDuration = liveRecordingBuffer.length / (audioCtx ? audioCtx.sampleRate : 44100);
      const recWidth = Math.max(recDuration * PIXELS_PER_SEC, MIN_CLIP_WIDTH);
      let recDiv = document.createElement('div');
      recDiv.className = 'record-preview';
      recDiv.style.left = recLeft + 'px';
      recDiv.style.width = recWidth + 'px';

      let recCanvas = document.createElement('canvas');
      recCanvas.className = 'waveform-canvas';
      recCanvas.width = recWidth - 8;
      recCanvas.height = 62;
      drawWaveform(recCanvas, liveRecordingBuffer, 0, recDuration, true);
      recDiv.appendChild(recCanvas);
      trackDiv.appendChild(recDiv);
    }

    // Drag Over to Drop Clips
    trackDiv.addEventListener('dragover', (e) => e.preventDefault());
    trackDiv.addEventListener('drop', (e) => {
      e.preventDefault();
      let data = JSON.parse(e.dataTransfer.getData('text/plain'));
      let relX = e.offsetX;
      moveClip(data.tIdx, data.cIdx, tIdx, relX / PIXELS_PER_SEC);
    });

    trackDiv.style.minWidth = (getTimelineWidth() - TRACK_HEADER_WIDTH) + 'px';

    trackContainer.appendChild(trackHeader);
    trackContainer.appendChild(trackDiv);
    
    tracksDiv.appendChild(trackContainer);
  });
  
  // Refresh resizable components after rendering tracks
  setTimeout(() => {
    if (typeof refreshResizableComponents === 'function') {
      refreshResizableComponents();
    }
  }, 0);
}

// --- Track Management Functions ---
function selectTrack(trackIndex) {
  tracks.forEach((track, idx) => {
    track.selected = idx === trackIndex;
  });
  selectedTrackIndex = trackIndex;
  updatePluginStrip();
  render();
}

function toggleTrackArm(trackIndex) {
  tracks[trackIndex].armed = !tracks[trackIndex].armed;
  render();
}

function toggleTrackMute(trackIndex) {
  tracks[trackIndex].muted = !tracks[trackIndex].muted;
  render();
}

function toggleTrackSolo(trackIndex) {
  tracks[trackIndex].solo = !tracks[trackIndex].solo;
  render();
}

function setTrackVolume(trackIndex, volume) {
  tracks[trackIndex].volume = volume;
  tracks[trackIndex].faderPos = gainToPos(volume);
  updateTrackGainImmediate(trackIndex);
  render();
}

// --- Enhanced Clip Automation System (Audio Editor Only) ---
function initializeClipAutomation() {
  if (!currentEditingClip) return;
  
  // Initialize automation points if none exist for current type
  const autoType = currentAutomationType;
  const autoData = currentEditingClip.automation[autoType];
  
  if (autoData.points.length === 0) {
    // Check if there's a previously applied automation to restore
    const lastAppliedAutomation = getLastAppliedAutomation(currentEditingClip, autoType);
    
    if (lastAppliedAutomation) {
      // Restore the last applied automation for editing
      autoData.points = [...lastAppliedAutomation.points];
      autoData.minRange = lastAppliedAutomation.minRange;
      autoData.maxRange = lastAppliedAutomation.maxRange;
      autoData.enabled = true;
      console.log(`Restored ${autoType} automation with ${autoData.points.length} points from previous application`);
    } else {
      // Initialize with default values (volume only)
      if (autoType === 'volume') {
        // Start at 0dB (value 0.5 represents 0dB in -100dB to +12dB range)
        const zeroDbValue = dbToAutomationValue(0, autoData.minRange, autoData.maxRange);
        autoData.points = [
          { time: 0, value: zeroDbValue },
          { time: currentEditingClip.duration, value: zeroDbValue }
        ];
      }
    }
  }
  
  // Add automation controls to the editor
  addAutomationControlsToEditor();
  
  // Render automation overlay on the waveform
  renderClipAutomation();
}

// --- Automation Utility Functions ---
function dbToAutomationValue(db, minDb, maxDb) {
  return (db - minDb) / (maxDb - minDb);
}

function automationValueToDb(value, minDb, maxDb) {
  return minDb + (value * (maxDb - minDb));
}

function semitonesToAutomationValue(semitones) {
  return (semitones + 12) / 24; // -12 to +12 becomes 0 to 1
}

function automationValueToSemitones(value) {
  return (value * 24) - 12; // 0 to 1 becomes -12 to +12
}

function addAutomationControlsToEditor() {
  // Find the editor controls panel
  const controlsPanel = document.querySelector('.editor-controls-panel .grid');
  if (!controlsPanel) return;
  
  // Check if automation section already exists
  if (document.getElementById('automationSection')) return;
  
  // Create automation section with dynamic content based on type
  const automationSection = document.createElement('div');
  automationSection.id = 'automationSection';
  automationSection.className = 'automation-section';
  
  updateAutomationControlsContent();
  
  // Add to controls panel
  controlsPanel.appendChild(automationSection);
}

function updateAutomationControlsContent() {
  const automationSection = document.getElementById('automationSection');
  if (!automationSection) return;
  
  const autoType = currentAutomationType;
  const displayName = autoType.charAt(0).toUpperCase() + autoType.slice(1);
  
  automationSection.innerHTML = `
    <h4 class="text-sm font-semibold text-gray-300 mb-2">${displayName} Automation</h4>
    <div class="space-y-2">
      <button id="resetClipAutomation" class="w-full px-2 py-1 bg-gray-600 hover:bg-gray-700 rounded text-xs transition-colors">
        Reset to ${autoType === 'volume' ? '0dB' : '0 Semitones'}
      </button>
      <p class="text-xs text-gray-400">Use toolbar controls to toggle automation</p>
    </div>
  `;
  
  // Add event listener
  document.getElementById('resetClipAutomation').onclick = () => resetClipAutomation();
}

function toggleClipAutomation() {
  if (!currentEditingClip) return;
  
  const autoData = currentEditingClip.automation[currentAutomationType];
  
  // If automation is not enabled, just enable it for editing
  if (!autoData.enabled) {
    autoData.enabled = true;
    updateAutomationButtonState();
    renderClipAutomation();
    return;
  }
  
  // If automation is enabled and has points, show apply dialog
  if (autoData.points && autoData.points.length > 0) {
    showVolumeAutomationApplyDialog();
  } else {
    // No points, just disable
    autoData.enabled = false;
    updateAutomationButtonState();
    renderClipAutomation();
  }
}

function toggleCurveMode() {
  if (!currentEditingClip) return;
  
  const autoData = currentEditingClip.automation[currentAutomationType];
  autoData.curved = !autoData.curved;
  
  // Update curve button state
  updateCurveModeButtonState();
  
  renderClipAutomation();
}

function updateAutomationButtonState() {
  const automationBtn = document.getElementById('editorAutomationBtn');
  if (!automationBtn || !currentEditingClip) return;
  
  const autoData = currentEditingClip.automation[currentAutomationType];
  if (autoData.enabled) {
    automationBtn.classList.remove('bg-gray-700', 'border-gray-500', 'text-gray-300');
    automationBtn.classList.add('bg-orange-600', 'border-orange-500', 'text-white');
  } else {
    automationBtn.classList.remove('bg-orange-600', 'border-orange-500', 'text-white');
    automationBtn.classList.add('bg-gray-700', 'border-gray-500', 'text-gray-300');
  }
}

function updateCurveModeButtonState() {
  const curveBtn = document.getElementById('editorCurveModeBtn');
  const curveModeIcon = document.getElementById('curveModeIcon');
  if (!curveBtn || !currentEditingClip) return;
  
  const autoData = currentEditingClip.automation[currentAutomationType];
  if (autoData.curved) {
    curveBtn.classList.remove('bg-gray-700', 'border-gray-500', 'text-gray-300');
    curveBtn.classList.add('bg-blue-600', 'border-blue-500', 'text-white');
    curveModeIcon.setAttribute('d', 'M2 12 C 6 8, 10 10, 14 4'); // Curved line
    curveBtn.querySelector('span').textContent = 'Curve';
  } else {
    curveBtn.classList.remove('bg-blue-600', 'border-blue-500', 'text-white');
    curveBtn.classList.add('bg-gray-700', 'border-gray-500', 'text-gray-300');
    curveModeIcon.setAttribute('d', 'M2 12 L6 8 L10 10 L14 4'); // Straight lines
    curveBtn.querySelector('span').textContent = 'Line';
  }
}

function updateVolumeRangeVisibility() {
  const volumeControls = document.getElementById('volumeRangeControls');
  if (!volumeControls) return;
  
  volumeControls.style.display = currentAutomationType === 'volume' ? 'flex' : 'none';
}

function updateVolumeRangeValues() {
  if (!currentEditingClip) return;
  
  const volumeMinRange = document.getElementById('volumeMinRange');
  const volumeMaxRange = document.getElementById('volumeMaxRange');
  
  if (volumeMinRange && volumeMaxRange) {
    const autoData = currentEditingClip.automation.volume;
    volumeMinRange.value = autoData.minRange;
    volumeMaxRange.value = autoData.maxRange;
  }
}

function resetClipAutomation() {
  if (!currentEditingClip) return;
  
  const autoType = currentAutomationType;
  const autoData = currentEditingClip.automation[autoType];
  
  if (autoType === 'volume') {
    const zeroDbValue = dbToAutomationValue(0, autoData.minRange, autoData.maxRange);
    autoData.points = [
      { time: 0, value: zeroDbValue },
      { time: currentEditingClip.duration, value: zeroDbValue }
    ];
  } else if (autoType === 'pitch') {
    autoData.points = [
      { time: 0, value: 0.5 }, // 0 semitones
      { time: currentEditingClip.duration, value: 0.5 }
    ];
  }
  
  renderClipAutomation();
}

function renderClipAutomation() {
  if (!currentEditingClip) return;
  
  const canvas = editorWaveformCanvas;
  if (!canvas) return;
  
  // Remove existing automation overlay
  let autoOverlay = document.getElementById('editorAutomationOverlay');
  if (autoOverlay) autoOverlay.remove();
  
  const autoData = currentEditingClip.automation[currentAutomationType];
  if (!autoData.enabled) return;
  
  // Create automation overlay
  autoOverlay = document.createElement('div');
  autoOverlay.id = 'editorAutomationOverlay';
  autoOverlay.style.position = 'absolute';
  autoOverlay.style.top = '0';
  autoOverlay.style.left = '0';
  autoOverlay.style.width = '100%';
  autoOverlay.style.height = '100%';
  autoOverlay.style.pointerEvents = 'auto';
  autoOverlay.style.zIndex = '20';
  
  // Create SVG for automation curve
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.style.position = 'absolute';
  svg.style.top = '0';
  svg.style.left = '0';
  svg.style.width = '100%';
  svg.style.height = '100%';
  svg.style.pointerEvents = 'none';
  
  // Create filled area above the automation curve (gray shading) - only for volume
  const fillPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  fillPath.setAttribute('fill', 'rgba(128, 128, 128, 0.2)');
  fillPath.setAttribute('stroke', 'none');
  
  // Create path for automation curve with type-specific styling
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke-width', '4');
  path.setAttribute('opacity', '0.9');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  
  // Set color based on automation type
  if (currentAutomationType === 'volume') {
    path.setAttribute('stroke', '#ff5050'); // Red for volume
  } else {
    path.setAttribute('stroke', '#42a5f5'); // Blue for pitch
  }
  
  // Calculate path data based on clip duration and canvas size
  const canvasRect = canvas.getBoundingClientRect();
  const pixelsPerSecond = canvasRect.width / currentEditingClip.duration;

  let pathData = '';
  let fillPathData = '';
  
  // Generate path data based on automation type and curve mode
  const points = autoData.points.map((point, i) => ({
    x: point.time * pixelsPerSecond,
    y: canvasRect.height * (1 - point.value), // Invert Y, top = 1.0, bottom = 0.0
    value: point.value,
    time: point.time
  }));
  
  if (points.length === 0) return;
  
  // Start path
  pathData = `M ${points[0].x} ${points[0].y}`;
  if (currentAutomationType === 'volume') {
    fillPathData = `M ${points[0].x} 0 L ${points[0].x} ${points[0].y}`;
  }
  
  // Generate curves or straight lines based on curve mode
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    
    if (!autoData.curved || points.length === 2) {
      // Straight lines
      pathData += ` L ${curr.x} ${curr.y}`;
      if (currentAutomationType === 'volume') {
        fillPathData += ` L ${curr.x} ${curr.y}`;
      }
    } else {
      // Smooth curves using Catmull-Rom splines
      const tension = 0.25; // Curve tension (0 = straight lines, 0.5 = natural curves)
      
      // Get surrounding points for smoother curves
      const p0 = i > 1 ? points[i - 2] : { x: prev.x - (curr.x - prev.x), y: prev.y - (curr.y - prev.y) };
      const p1 = prev;
      const p2 = curr;
      const p3 = i < points.length - 1 ? points[i + 1] : { x: curr.x + (curr.x - prev.x), y: curr.y + (curr.y - prev.y) };
      
      // Calculate tangents for natural curve flow
      const t1x = (p2.x - p0.x) * tension;
      const t1y = (p2.y - p0.y) * tension;
      const t2x = (p3.x - p1.x) * tension;
      const t2y = (p3.y - p1.y) * tension;
      
      // Control points for cubic Bézier
      const cp1x = p1.x + t1x / 3;
      const cp1y = p1.y + t1y / 3;
      const cp2x = p2.x - t2x / 3;
      const cp2y = p2.y - t2y / 3;
      
      // Add cubic Bézier curve with smooth control points
      pathData += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
      if (currentAutomationType === 'volume') {
        fillPathData += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
      }
    }
  }
  
  // Close the fill path for volume automation only
  if (currentAutomationType === 'volume') {
    const lastPoint = points[points.length - 1];
    fillPathData += ` L ${lastPoint.x} 0 Z`; // Close path at top
  }
  
  // Set path data and styling based on automation type
  path.setAttribute('d', pathData);
  
  if (currentAutomationType === 'volume') {
    fillPath.setAttribute('d', fillPathData);
    svg.appendChild(fillPath);
  }
  
  svg.appendChild(path);
  
  // Add control points
  autoData.points.forEach((point, i) => {
    const pointEl = document.createElement('div');
    pointEl.className = 'auto-point';
    pointEl.style.position = 'absolute';
    pointEl.style.width = '8px';
    pointEl.style.height = '8px';
    pointEl.style.background = currentAutomationType === 'volume' ? '#ff5050' : '#42a5f5';
    pointEl.style.border = '2px solid white';
    pointEl.style.borderRadius = '50%';
    pointEl.style.cursor = 'pointer';
    pointEl.style.left = (point.time * pixelsPerSecond - 4) + 'px';
    pointEl.style.top = (canvasRect.height * (1 - point.value) - 4) + 'px';
    
    // Set tooltip based on automation type
    if (currentAutomationType === 'volume') {
      const dbValue = automationValueToDb(point.value, autoData.minRange, autoData.maxRange);
      pointEl.title = `Volume: ${dbValue.toFixed(1)}dB`;
    } else {
      const semitonesValue = automationValueToSemitones(point.value);
      pointEl.title = `Pitch: ${semitonesValue.toFixed(1)} semitones`;
    }
    
    pointEl.dataset.pointIndex = i;
    
    // Make draggable
    pointEl.addEventListener('mousedown', (e) => startDragClipAutoPoint(e, i));
    pointEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      removeClipAutoPoint(i);
    });
    
    autoOverlay.appendChild(pointEl);
  });
  
  autoOverlay.appendChild(svg);
  
  // Add click handler for creating points
  autoOverlay.addEventListener('click', (e) => {
    if (e.target.classList.contains('auto-point')) return;
    
    const rect = autoOverlay.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const time = (x / rect.width) * currentEditingClip.duration;
    const value = Math.max(0, Math.min(1, 1 - (y / rect.height)));
    
    addClipAutoPoint(time, value);
  });
  
  // Add to waveform container
  const waveformContainer = canvas.parentElement;
  waveformContainer.appendChild(autoOverlay);
}

function addClipAutoPoint(time, value) {
  if (!currentEditingClip) return;
  
  const autoData = currentEditingClip.automation[currentAutomationType];
  
  // Find insertion point to keep sorted
  let insertIndex = autoData.points.findIndex(p => p.time > time);
  if (insertIndex === -1) insertIndex = autoData.points.length;
  
  autoData.points.splice(insertIndex, 0, { time, value });
  renderClipAutomation();
}

function removeClipAutoPoint(pointIndex) {
  if (!currentEditingClip) return;
  
  const autoData = currentEditingClip.automation[currentAutomationType];
  if (autoData.points.length <= 2) return;
  
  autoData.points.splice(pointIndex, 1);
  renderClipAutomation();
}

function startDragClipAutoPoint(e, pointIndex) {
  e.preventDefault();
  e.stopPropagation();
  
  if (!currentEditingClip) return;
  
  const autoData = currentEditingClip.automation[currentAutomationType];
  const point = autoData.points[pointIndex];
  const startX = e.clientX;
  const startY = e.clientY;
  const startTime = point.time;
  const startValue = point.value;
  
  const canvas = editorWaveformCanvas;
  const canvasRect = canvas.getBoundingClientRect();
  const pixelsPerSecond = canvasRect.width / currentEditingClip.duration;
  
  function onMouseMove(e) {
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    
    const newTime = Math.max(0, Math.min(currentEditingClip.duration, startTime + deltaX / pixelsPerSecond));
    const newValue = Math.max(0, Math.min(1, startValue - deltaY / canvasRect.height));
    
    autoData.points[pointIndex] = { time: newTime, value: newValue };
    
    // Re-sort points by time
    autoData.points.sort((a, b) => a.time - b.time);
    
    renderClipAutomation();
  }
  
  function onMouseUp() {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }
  
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

function interpolateClipVolumeAuto(points, time) {
  if (!points || points.length === 0) return 1;
  if (points.length === 1) return points[0].value;
  
  // Find bracketing points
  for (let i = 0; i < points.length - 1; i++) {
    if (time >= points[i].time && time <= points[i + 1].time) {
      const t = (time - points[i].time) / (points[i + 1].time - points[i].time);
      return points[i].value + t * (points[i + 1].value - points[i].value);
    }
  }
  
  // Return boundary values
  if (time < points[0].time) return points[0].value;
  return points[points.length - 1].value;
}

// Volume automation has been moved to apply-based processing system

// Helper function to convert dB to volume (0-1 range) for new automation system
function convertDbToVolume(dbValue, minDb, maxDb) {
  // Clamp the dB value to the range
  const clampedDb = Math.max(minDb, Math.min(maxDb, dbValue));
  
  // Convert dB to linear volume (0-1 range)
  if (clampedDb <= -60) return 0; // Below -60dB is effectively silence
  return Math.pow(10, clampedDb / 20) / Math.pow(10, maxDb / 20); // Normalize to 0-1 range
}

// Play clip using Howler.js with volume automation
async function playClipWithTone(clip, playDelay, sourceOffset, sourceDuration, startOffset, clipStartTime, trackGain) {
  // Check if we have the audio URL for creating a new player
  if (!clip.audioUrl || !clip.useTone) {
    console.warn('Audio URL not available for Tone.js playback for clip:', clip.name, 'falling back to Web Audio API');
    return false;
  }
  
  console.log(`Playing clip with Tone.js: ${clip.name}, delay: ${playDelay}s, offset: ${sourceOffset}s, duration: ${sourceDuration}s`);
  
  try {
    // Ensure Tone.js is started
    if (!toneStarted) {
      await initializeToneJS();
    }
    
    // Create a new player instance for each playback (Tone.js best practice)
    const player = new Tone.Player({
      url: clip.audioUrl,
      onload: () => {
        console.log(`Playback player loaded for ${clip.name}`);
      },
      onerror: (error) => {
        console.error(`Playback player error for ${clip.name}:`, error.message || error);
      }
    });
    
    // Create volume node for this playback instance
    const volumeNode = new Tone.Volume(0); // Start at 0dB
    
    // Connect player -> volume -> destination
    player.connect(volumeNode);
    volumeNode.toDestination();
    
    // Calculate start time in Tone.js context
    const toneStartTime = Tone.now() + playDelay;
    
    // Apply volume automation if enabled
    if (clip.automation && clip.automation.volume && clip.automation.volume.enabled && clip.automation.volume.points.length > 0) {
      applyToneVolumeAutomationToNode(volumeNode, clip.automation.volume, toneStartTime, sourceOffset, sourceDuration);
    }
    
    // Start the player at the specified time and offset
    if (sourceDuration < clip.duration) {
      // Play for a specific duration
      player.start(toneStartTime, sourceOffset, sourceDuration);
    } else {
      // Play from offset to end
      player.start(toneStartTime, sourceOffset);
    }
    
    // Add to active sources for proper stopping
    activeAudioSources.push({
      player: player,
      volumeNode: volumeNode,
      stop: () => {
        try {
          player.stop();
          player.dispose();
          volumeNode.dispose();
        } catch (e) {
          console.warn('Error stopping Tone.js player:', e.message || e);
        }
      }
    });
    
    // Auto cleanup after duration
    setTimeout(() => {
      try {
        if (player.disposed === false) {
          player.dispose();
        }
        if (volumeNode.disposed === false) {
          volumeNode.dispose();
        }
      } catch (error) {
        console.warn('Cleanup error:', error.message || error);
      }
    }, (playDelay + sourceDuration + 1) * 1000);
    
    console.log('Tone.js playbook started successfully for:', clip.name);
    return true;
    
  } catch (error) {
    console.error('Error during Tone.js playback:', error.message || error);
    return false;
  }
}

// Play clip using Web Audio API (fallback for when Tone.js is not available)
function playClipWithWebAudio(clip, source, clipGain, playDelay, sourceOffset, sourceDuration, startOffset, clipStartTime, startTime) {
  if (sourceDuration <= 0) return;
  
  console.log(`Playing clip with Web Audio API: ${clip.name}, delay: ${playDelay}s, offset: ${sourceOffset}s, duration: ${sourceDuration}s`);
  
  // Set default volume (automation applied via Tone.js when available)
  clipGain.gain.value = 1.0;
  
  // Track this source so we can stop it later
  activeAudioSources.push(source);
  
  // Set up automatic cleanup when source ends
  source.onended = () => {
    const index = activeAudioSources.indexOf(source);
    if (index > -1) {
      activeAudioSources.splice(index, 1);
    }
  };
  
  source.start(startTime + playDelay, sourceOffset, sourceDuration);
}

// --- Recording ---
recordBtn.onclick = async () => {
  if (isRecording) return;
  
  try {
    // Find armed tracks or use selected track
    let armedTracks = tracks.filter(t => t.armed);
    if (armedTracks.length === 0) {
      // Auto-arm selected track if no tracks are armed
      tracks[selectedTrackIndex].armed = true;
      render();
    }
    
    initAudioContext();
    
    // Get audio stream with optimal settings for consistent recording
    recordingStream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        sampleRate: audioCtx.sampleRate,
        channelCount: 1
      } 
    });
    
    // Create MediaRecorder with higher quality settings
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
      ? 'audio/webm;codecs=opus' 
      : 'audio/webm';
    
    mediaRecorder = new MediaRecorder(recordingStream, { 
      mimeType: mimeType,
      audioBitsPerSecond: 128000 // Higher quality
    });
    
    recordedChunks = [];
    liveRecordingBuffer = [];
    liveRecordingStart = playheadTime;
    
    // Create audio processing chain
    recordingInputNode = audioCtx.createMediaStreamSource(recordingStream);
    recordingGainNode = audioCtx.createGain();
    recordingGainNode.gain.value = 0.8;
    
    // Use modern AudioWorklet for live monitoring (fallback to ScriptProcessor if not available)
    try {
      // Try to use AudioWorklet for better performance
      await audioCtx.audioWorklet.addModule('data:text/javascript;base64,' + btoa(`
        class RecordingProcessor extends AudioWorkletProcessor {
          constructor() {
            super();
            this.isRecording = false;
            this.bufferChunks = [];
            this.port.onmessage = (e) => {
              if (e.data.type === 'start') {
                this.isRecording = true;
                this.bufferChunks = [];
              } else if (e.data.type === 'stop') {
                this.isRecording = false;
                this.port.postMessage({ type: 'buffer', data: this.bufferChunks });
                this.bufferChunks = [];
              }
            };
          }
          
          process(inputs, outputs, parameters) {
            const input = inputs[0];
            const output = outputs[0];
            
            if (input.length > 0 && this.isRecording) {
              const inputChannel = input[0];
              
              // Store for live preview
              this.bufferChunks.push(new Float32Array(inputChannel));
              
              // Pass through for monitoring
              if (output.length > 0) {
                output[0].set(inputChannel);
              }
              
              // Send updates periodically for UI
              if (this.bufferChunks.length % 100 === 0) {
                this.port.postMessage({ type: 'update', length: this.bufferChunks.length });
              }
            }
            
            return true;
          }
        }
        
        registerProcessor('recording-processor', RecordingProcessor);
      `));
      
      recordingWorklet = new AudioWorkletNode(audioCtx, 'recording-processor');
      
      recordingWorklet.port.onmessage = (e) => {
        if (e.data.type === 'buffer') {
          // Convert worklet buffer chunks to single array
          const totalLength = e.data.data.reduce((sum, chunk) => sum + chunk.length, 0);
          liveRecordingBuffer = new Float32Array(totalLength);
          let offset = 0;
          for (const chunk of e.data.data) {
            liveRecordingBuffer.set(chunk, offset);
            offset += chunk.length;
          }
        } else if (e.data.type === 'update') {
          // Trigger UI update periodically
          render();
        }
      };
      
      // Connect audio chain with worklet
      recordingInputNode.connect(recordingWorklet);
      recordingWorklet.connect(recordingGainNode);
      recordingGainNode.connect(audioCtx.destination);
      
    } catch (workletError) {
      console.warn('AudioWorklet not available, using ScriptProcessor fallback:', workletError);
      
      // Fallback to ScriptProcessor with optimizations
      recordingWorklet = audioCtx.createScriptProcessor(2048, 1, 1); // Smaller buffer for less latency
      
      recordingWorklet.onaudioprocess = (e) => {
        if (!isRecording) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        const outputData = e.outputBuffer.getChannelData(0);
        
        // Copy input to output for monitoring
        outputData.set(inputData);
        
        // Efficiently append to buffer using typed arrays
        const currentLength = liveRecordingBuffer.length;
        const newBuffer = new Float32Array(currentLength + inputData.length);
        newBuffer.set(liveRecordingBuffer);
        newBuffer.set(inputData, currentLength);
        liveRecordingBuffer = newBuffer;
        
        // Limit buffer size to prevent memory issues (5 minutes max)
        if (liveRecordingBuffer.length > audioCtx.sampleRate * 300) {
          console.warn('Recording buffer limit reached, stopping recording');
          stopRecording();
        }
      };
      
      // Connect audio chain with script processor
      recordingInputNode.connect(recordingWorklet);
      recordingWorklet.connect(recordingGainNode);
      recordingGainNode.connect(audioCtx.destination);
    }
    
    // Connect to analyser for visual feedback
    recordingInputNode.connect(analyserNode);
    
    // MediaRecorder event handlers
    mediaRecorder.ondataavailable = e => { 
      if (e.data.size > 0) recordedChunks.push(e.data); 
    };
    
    mediaRecorder.onstop = async () => {
      await processRecordedAudio();
    };
    
    mediaRecorder.onerror = (e) => {
      console.error('MediaRecorder error:', e);
      stopRecording();
    };

    // Start recording
    mediaRecorder.start(100); // Collect data every 100ms for smoother recording
    isRecording = true;
    recordBtn.disabled = true;
    stopBtn.disabled = false;
    
    // Start worklet recording if available
    if (recordingWorklet.port) {
      recordingWorklet.port.postMessage({ type: 'start' });
    }
    
    if (metronomeEnabled) startMetronome();
    
    console.log('Recording started successfully');
    
  } catch (error) {
    console.error('Failed to start recording:', error);
    stopRecording();
    alert('Failed to start recording. Please check your microphone permissions.');
  }
};

async function processRecordedAudio() {
  try {
    // Stop worklet recording
    if (recordingWorklet && recordingWorklet.port) {
      recordingWorklet.port.postMessage({ type: 'stop' });
    }
    
    // Clean up audio connections
    cleanupRecordingNodes();
    
    if (recordedChunks.length === 0) { 
      console.warn('No audio data recorded');
      isRecording = false; 
      recordBtn.disabled = false; 
      stopBtn.disabled = true; 
      return; 
    }
    
    // Process recorded audio
    const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType });
    const arrayBuffer = await blob.arrayBuffer();
    
    audioCtx.decodeAudioData(arrayBuffer, (buffer) => {
      let targetTracks = tracks.filter(t => t.armed);
      if (targetTracks.length === 0) targetTracks = [tracks[selectedTrackIndex]];
      
      targetTracks.forEach(track => {
        let trackIndex = tracks.indexOf(track);
        addClipToTrack(trackIndex, buffer, liveRecordingStart, buffer.duration);
      });
      
      liveRecordingBuffer = [];
      saveState();
      render();
      console.log('Recording processed and added to track(s)');
    }, (error) => {
      console.error('Failed to decode recorded audio:', error);
      alert('Failed to process recorded audio');
    });
    
  } catch (error) {
    console.error('Error processing recorded audio:', error);
  } finally {
    isRecording = false;
    recordBtn.disabled = false;
    stopBtn.disabled = true;
  }
}

function cleanupRecordingNodes() {
  // Disconnect and clean up all recording-related nodes
  if (recordingInputNode) {
    recordingInputNode.disconnect();
    recordingInputNode = null;
  }
  if (recordingWorklet) {
    recordingWorklet.disconnect();
    recordingWorklet = null;
  }
  if (recordingGainNode) {
    recordingGainNode.disconnect();
    recordingGainNode = null;
  }
  if (recordingStream) {
    recordingStream.getTracks().forEach(track => track.stop());
    recordingStream = null;
  }
}

function stopRecording() {
  if (isRecording && mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
  } else {
    // Force cleanup if MediaRecorder didn't stop properly
    cleanupRecordingNodes();
    isRecording = false;
    recordBtn.disabled = false;
    stopBtn.disabled = true;
  }
};

// Add this handler to allow stopping recording via stopBtn
stopBtn.onclick = () => {
  stopRecording();
  stopAll();
};

// --- Audio Playback Functions (MODIFY EXISTING) ---
function playAll() {
  if (playing) return;
  
  // Initialize Tone.js and audio context
  initializeToneJS().then(async () => {
    await startPlayback();
  }).catch(async (error) => {
    console.error('Failed to initialize Tone.js:', error);
    // Fallback to regular audio context
    initAudioContext();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().then(async () => {
        await startPlayback();
      });
    } else {
      await startPlayback();
    }
  });
}

async function startPlayback() {
  playing = true;
  playBtn.disabled = true;
  pauseBtn.disabled = false;
  
  const startTime = audioCtx.currentTime;
  const startOffset = playheadTime;
  
  console.log('Starting playback at', startOffset, 'seconds, max bars:', getTotalBars()); // Debug log
  
  // Clear any existing sources
  stopAllAudioSources();
  
  // Start Tone.js Transport if available
  if (toneStarted && typeof Tone !== 'undefined') {
    Tone.Transport.start();
    console.log('Tone.js Transport started');
  }
  
  // Start metronome if enabled
  if (metronomeEnabled) startMetronome();
  
  // Schedule all clips for playback
  tracks.forEach((track, trackIndex) => {
    if (track.muted) return;
    
    // Check if any track is soloed
    const hasSoloTracks = tracks.some(t => t.solo);
    if (hasSoloTracks && !track.solo) return;
    
    const trackGain = getTrackGainNode(trackIndex);
    
    // Set track volume
    trackGain.gain.value = track.volume;
    
    // Prepare insert chain once per track
    const trackChain = ensureTrackInsertChain(trackIndex);
    if (trackChain && trackChain.inputNode && trackChain.outputNode) {
      try { trackChain.outputNode.disconnect(); } catch {}
      try { trackChain.outputNode.connect(trackGain); } catch {}
    }
    
    track.clips.forEach(async clip => {
      if (!clip.audioBuffer) return;
      
      const clipStartTime = clip.startTime;
      const clipEndTime = clipStartTime + clip.duration;
      
      // Only play clips that intersect with current playhead position
      if (clipEndTime > startOffset) {
        // Calculate timing for both Howler.js and Web Audio API
        const playDelay = Math.max(0, clipStartTime - startOffset);
        const sourceOffset = Math.max(0, startOffset - clipStartTime) + clip.offset;
        const sourceDuration = Math.min(clip.duration, clipEndTime - Math.max(startOffset, clipStartTime));
        
        // Try Tone.js first, fallback to Web Audio API if needed
        const toneSuccess = await playClipWithTone(clip, playDelay, sourceOffset, sourceDuration, startOffset, clipStartTime, trackIndex);
        
        if (!toneSuccess && clip.audioBuffer) {
          // Fallback to Web Audio API
          console.log('Falling back to Web Audio API for clip:', clip.name);
          const source = audioCtx.createBufferSource();
          source.buffer = clip.audioBuffer;
          
          // Create clip gain node for individual clip automation
          const clipGain = audioCtx.createGain();
          source.connect(clipGain);
          
          // Route through insert chain if present
          const trackChain = ensureTrackInsertChain(trackIndex);
          if (trackChain && trackChain.inputNode && trackChain.outputNode) {
            clipGain.connect(trackChain.inputNode);
          } else {
            const trackGain = getTrackGainNode(trackIndex);
            clipGain.connect(trackGain);
          }
          
          playClipWithWebAudio(clip, source, clipGain, playDelay, sourceOffset, sourceDuration, startOffset, clipStartTime, startTime);
        }
        

      }
    });
  });
  
  console.log('Active audio sources:', activeAudioSources.length); // Debug log
  
  // Update playhead during playback
  const updatePlayheadLoop = () => {
    if (!playing) {
      console.log('Playhead loop stopped: not playing');
      return;
    }
    
    // Use Tone.js transport time if available, otherwise fall back to AudioContext
    if (toneStarted && typeof Tone !== 'undefined' && Tone.Transport.state === 'started') {
      playheadTime = startOffset + Tone.Transport.seconds;
    } else {
      playheadTime = startOffset + (audioCtx.currentTime - startTime);
    }
    
    // Debug log occasionally (every 60 frames = ~1 second)
    if (Math.floor(Date.now() / 1000) % 2 === 0 && Math.floor(Date.now() / 16) % 60 === 0) {
      console.log('Playhead loop running:', {
        playing,
        playheadTime: playheadTime.toFixed(2),
        autoScrollEnabled,
        toneTransportState: toneStarted ? Tone?.Transport?.state : 'N/A'
      });
    }
    
    // Update pitch automation for all tracks with active clips
    tracks.forEach((track, trackIndex) => {
      track.clips.forEach(clip => {
        const clipStartTime = clip.startTime;
        const clipEndTime = clipStartTime + clip.duration;
        
        // Pitch automation removed - using selection-based pitch shifting instead
      });
    });
    
    // Calculate current bar for debugging
    const currentBar = Math.floor(playheadTime / getSecPerBar()) + 1;
    
    // Auto-scroll if enabled
    if (autoScrollEnabled) {
      const workspaceEl = document.getElementById('workspace');
      const workspaceMainEl = workspaceEl?.querySelector('.workspace-main');
      const scrollElement = workspaceMainEl || workspaceEl;
      
      if (scrollElement) {
        const gridOffset = TRACK_HEADER_WIDTH;
        const playheadX = gridOffset + playheadTime * PIXELS_PER_SEC;
        const workspaceWidth = scrollElement.clientWidth;
        const scrollLeft = Math.max(0, playheadX - workspaceWidth / 2);
        
        console.log('Auto-scroll debug:', {
          playheadTime: playheadTime.toFixed(2),
          playheadX,
          workspaceWidth,
          scrollLeft,
          currentScrollLeft: scrollElement.scrollLeft,
          elementType: scrollElement.className
        });
        
        scrollElement.scrollLeft = scrollLeft;
      } else {
        console.warn('Scroll element not found for auto-scroll');
      }
    }
    
    renderTimeline();
    
    // More generous stopping condition - only stop if we exceed reasonable limits
    const maxReasonableTime = Math.max(MAX_TIME, getFurthestClipEnd() + 30); // 30 seconds past last clip
    const maxReasonableBars = Math.max(getTotalBars(), 200); // At least 200 bars
    const currentTimeInBars = playheadTime / getSecPerBar();
    
    if (playheadTime >= maxReasonableTime || currentTimeInBars >= maxReasonableBars) {
      console.log('Playback stopped at limits:', {
        playheadTime,
        maxReasonableTime,
        currentBar,
        maxReasonableBars
      });
      stopAll();
      return;
    }
    
    playRequestId = requestAnimationFrame(updatePlayheadLoop);
  };
  
  updatePlayheadLoop();
}

function stopAllAudioSources() {
  // Stop all currently playing audio sources
  activeAudioSources.forEach(source => {
    try {
      if (source && typeof source === 'object') {
        // Handle Tone.js player objects
        if (source.player && source.player.stop) {
          source.player.stop();
        }
        if (source.volumeNode && source.volumeNode.dispose) {
          source.volumeNode.dispose();
        }
        // Handle custom stop method
        if (source.stop && typeof source.stop === 'function') {
          source.stop();
        }
        // Handle regular Web Audio API sources
        if (source.disconnect && typeof source.disconnect === 'function') {
          source.disconnect();
        }
      }
    } catch (e) {
      // Source might already be stopped, ignore error
      console.warn('Error stopping audio source:', e);
    }
  });
  activeAudioSources = [];
  console.log('Stopped all audio sources'); // Debug log
}

function pauseAll() {
  if (!playing) return;
  
  console.log('Pausing playback'); // Debug log
  
  playing = false;
  playBtn.disabled = false;
  pauseBtn.disabled = true;
  
  if (playRequestId) {
    cancelAnimationFrame(playRequestId);
    playRequestId = null;
  }
  
  stopMetronome();
  
  // Stop Tone.js transport and all active audio sources
  if (toneStarted && typeof Tone !== 'undefined') {
    Tone.Transport.stop();
  }
  stopAllAudioSources();
  

}

function stopAll() {
  pauseAll();
  // Don't automatically reset to 0 - let user control playhead position
  // playheadTime = 0; // Remove this line
  renderTimeline();
}

// New transport functions
function goToBeginning() {
  console.log('Going to beginning');
  playheadTime = 0;
  
  // If playing, restart Tone.js Transport from beginning
  if (playing && toneStarted && typeof Tone !== 'undefined') {
    Tone.Transport.stop();
    Tone.Transport.start();
  }
  
  renderTimeline();
}

function skipBackOneMeasure() {
  const secPerBar = getSecPerBar();
  const newTime = Math.max(0, playheadTime - secPerBar);
  console.log(`Skipping back 1 measure: ${playheadTime.toFixed(2)}s -> ${newTime.toFixed(2)}s`);
  
  playheadTime = newTime;
  
  // If playing, update Tone.js Transport position
  if (playing && toneStarted && typeof Tone !== 'undefined') {
    Tone.Transport.stop();
    Tone.Transport.start('+0', playheadTime);
  }
  
  renderTimeline();
}

function skipForwardOneMeasure() {
  const secPerBar = getSecPerBar();
  const newTime = playheadTime + secPerBar;
  console.log(`Skipping forward 1 measure: ${playheadTime.toFixed(2)}s -> ${newTime.toFixed(2)}s`);
  
  playheadTime = newTime;
  
  // If playing, update Tone.js Transport position
  if (playing && toneStarted && typeof Tone !== 'undefined') {
    Tone.Transport.stop();
    Tone.Transport.start('+0', playheadTime);
  }
  
  renderTimeline();
}

// --- Clip Management ---
function addClipToTrack(trackIndex, buffer, startTime, duration, color, name) {
  if (trackIndex >= tracks.length) return;
  tracks[trackIndex].clips.push(createClip(buffer, startTime, duration, 0, color, name));
  render();
}

function addClipToTrackWithHowler(trackIndex, buffer, startTime, duration, color, name, audioUrl, mimeType) {
  if (trackIndex >= tracks.length) return;
  tracks[trackIndex].clips.push(createClip(buffer, startTime, duration, 0, color, name, audioUrl, mimeType));
  render();
}

function addClipToFirstTrack(buffer, startTime, duration, color, name) {
  if (tracks.length === 0) tracks.push(createTrack());
  addClipToTrack(selectedTrackIndex, buffer, startTime, duration, color, name);
}

function addClipToFirstTrackWithHowler(buffer, startTime, duration, color, name, audioUrl, mimeType) {
  if (tracks.length === 0) tracks.push(createTrack());
  addClipToTrackWithHowler(selectedTrackIndex, buffer, startTime, duration, color, name, audioUrl, mimeType);
}

// --- Timeline and Playhead (MODIFY EXISTING) ---
timelineDiv.onclick = (e) => {
  // Fix offset calculation to account for header width
  const rect = timelineDiv.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const adjustedX = clickX - TRACK_HEADER_WIDTH; // Account for header offset
  let rawTime = Math.max(0, adjustedX / PIXELS_PER_SEC);
  
  let gridTimes = settings.snapToGrid ? getGridTimes() : [];

  // Collect all clip edges
  let clipEdges = [];
  tracks.forEach(track => {
    track.clips.forEach(clip => {
      clipEdges.push(clip.startTime);
      clipEdges.push(clip.startTime + clip.duration);
    });
  });

  // Combine grid and clip edges
  let snapPoints = settings.snapToGrid ? gridTimes.concat(clipEdges) : clipEdges;

  // Find nearest snap point
  let minDist = Infinity, snapTime = rawTime;
  snapPoints.forEach(t => {
    let dist = Math.abs(t - rawTime);
    if (dist < minDist) {
      minDist = dist;
      snapTime = t;
    }
  });

  playheadTime = Math.max(0, snapTime);
  renderTimeline();
};

// Helper: get all grid times (bars, beats, subdivisions, triplets)
function getGridTimes() {
  const gridTimes = [];
  const secPerBar = getSecPerBar();
  const secPerBeat = getSecPerBeat();
  const totalBars = getTotalBars();
  let subdivisions = 1;
  if (zoomLevel > 1.5) subdivisions = 4;
  else if (zoomLevel > 1.1) subdivisions = 2;
  const showTriplets = settings.showTriplets && zoomLevel > 1.2;

  for (let bar = 0; bar <= totalBars; bar++) {
    let barTime = bar * secPerBar;
    gridTimes.push(barTime);
    if (bar < totalBars) {
      for (let beat = 1; beat < timeSigNum; beat++) {
        let beatTime = barTime + beat * secPerBeat;
        gridTimes.push(beatTime);

        // Subdivisions
        if (subdivisions > 1) {
          for (let sub = 1; sub < subdivisions; sub++) {
            gridTimes.push(beatTime + (sub * secPerBeat) / subdivisions);
          }
        }
        // Triplets
        if (showTriplets) {
          for (let trip = 1; trip < 3; trip++) {
            gridTimes.push(beatTime + (trip * secPerBeat) / 3);
          }
        }
      }
    }
  }
  return gridTimes;
}

// --- Audio Processing Setup (MODIFY EXISTING) ---
function initAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // TODO: Initialize Tone.js later when pitch shifting is properly implemented
    // Tone.setContext(audioCtx);
    
    // Master gain node
    masterGainNode = audioCtx.createGain();
    masterGainNode.connect(audioCtx.destination);
    
    // Analyser for visualization
    analyserNode = audioCtx.createAnalyser();
    analyserNode.fftSize = 2048;
    analyserNode.connect(masterGainNode);
  }
  
  // Resume audio context if suspended (required for user interaction)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
    // TODO: Resume Tone.js context when pitch shifting is implemented
    // if (Tone.context.state === 'suspended') {
    //   Tone.start();
    // }
  }
  
  return audioCtx;
}

function getTrackGainNode(trackIndex) {
  if (!trackGainNodes.has(trackIndex)) {
    const gainNode = audioCtx.createGain();
    // Connect gain -> pan -> analyser (removed pitch node)
    const panNode = getTrackPanNode(trackIndex);
    
    gainNode.connect(panNode);
    
    trackGainNodes.set(trackIndex, gainNode);
  }
  return trackGainNodes.get(trackIndex);
}

function getTrackPanNode(trackIndex) {
  if (!trackPanNodes.has(trackIndex)) {
    const panNode = audioCtx.createStereoPanner();
    panNode.pan.value = 0; // Center by default
    panNode.connect(analyserNode);
    trackPanNodes.set(trackIndex, panNode);
  }
  return trackPanNodes.get(trackIndex);
}

// Removed getTrackPitchNode - using selection-based pitch shifting instead

// --- Fader mapping helpers (supreme fader experience) ---
const FADER_DB_MIN = -60;
const FADER_DB_MAX = 6; // allow small boost over unity

function dbToGain(db) {
  if (db === -Infinity) return 0;
  return Math.pow(10, db / 20);
}

function gainToDb(gain) {
  if (gain <= 0) return -Infinity;
  return 20 * Math.log10(gain);
}

function posToGain(pos) {
  pos = Math.min(1, Math.max(0, pos));
  // Hard mute zone near bottom
  if (pos <= 0.005) return 0;
  if (settings.faderCurve === 'linear') {
    return pos; // direct linear mapping
  }
  const db = FADER_DB_MIN + pos * (FADER_DB_MAX - FADER_DB_MIN);
  return dbToGain(db);
}

function gainToPos(gain) {
  if (gain <= 0) return 0;
  if (settings.faderCurve === 'linear') {
    return Math.min(1, Math.max(0, gain));
  }
  const db = gainToDb(gain);
  const pos = (db - FADER_DB_MIN) / (FADER_DB_MAX - FADER_DB_MIN);
  return Math.min(1, Math.max(0, pos));
}

function formatDb(gain) {
  if (gain <= 0) return '-∞ dB';
  const db = gainToDb(gain);
  const fixed = Math.abs(db) < 0.05 ? '0.0' : db.toFixed(1);
  return `${db > 0 ? '+' : ''}${fixed} dB`;
}

function updateTrackGainImmediate(trackIndex) {
  const node = getTrackGainNode(trackIndex);
  node.gain.value = tracks[trackIndex].volume;
}

function updateTrackPanImmediate(trackIndex) {
  const panNode = getTrackPanNode(trackIndex);
  panNode.pan.value = tracks[trackIndex].pan; // -1 (left) to +1 (right)
}

// Removed updateTrackPitchImmediate - using selection-based pitch shifting instead

// Removed interpolateClipPitchAuto - using selection-based pitch shifting instead

function feedbackClick() {
  try {
    initAudioContext();
    const dur = 0.01;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.frequency.value = 2200;
    g.gain.value = 0.0008; // subtle
    osc.connect(g).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + dur);
  } catch {}
}

function createTrackFilter(trackIndex, type = 'lowpass', frequency = 1000, Q = 1) {
  if (!audioCtx) initAudioContext();
  const filter = audioCtx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  filter.Q.value = Q;
  filterNodes.set(trackIndex, filter);
  return filter;
}

// --- Copy/Paste Functionality ---
function selectClip(tIdx, cIdx) {
  // Deselect all clips first
  tracks.forEach(track => {
    track.clips.forEach(clip => clip.selected = false);
  });
  
  if (tIdx < tracks.length && cIdx < tracks[tIdx].clips.length) {
    tracks[tIdx].clips[cIdx].selected = true;
    selectedClip = {trackIndex: tIdx, clipIndex: cIdx};
  }
  render();
}

function deselectAllClips() {
  tracks.forEach(track => {
    track.clips.forEach(clip => clip.selected = false);
  });
  selectedClip = null;
}

function copySelectedClip() {
  if (selectedClip) {
    const {trackIndex, clipIndex} = selectedClip;
    const clip = tracks[trackIndex].clips[clipIndex];
    clipboard = {
      audioBuffer: clip.audioBuffer,
      duration: clip.duration,
      offset: clip.offset,
      color: clip.color,
      name: clip.name + " Copy"
    };
  }
}

function pasteClip() {
  if (clipboard && selectedTrackIndex < tracks.length) {
    const newClip = createClip(
      clipboard.audioBuffer,
      playheadTime,
      clipboard.duration,
      clipboard.offset,
      clipboard.color,
      clipboard.name
    );
    tracks[selectedTrackIndex].clips.push(newClip);
    saveState(); // For undo
    render();
  }
}

// --- Quantize Functionality ---
function quantizeSelectedClip() {
  if (!selectedClip) return;
  
  const {trackIndex, clipIndex} = selectedClip;
  const clip = tracks[trackIndex].clips[clipIndex];
  const secPerBeat = getSecPerBeat();
  
  // Quantize to nearest beat
  const nearestBeat = Math.round(clip.startTime / secPerBeat) * secPerBeat;
  clip.startTime = nearestBeat;
  
  saveState();
  render();
}

function quantizeAllClipsInTrack(trackIndex) {
  const secPerBeat = getSecPerBeat();
  tracks[trackIndex].clips.forEach(clip => {
    clip.startTime = Math.round(clip.startTime / secPerBeat) * secPerBeat;
  });
  saveState();
  render();
}

// --- Undo/Redo System ---
function saveState() {
  const state = JSON.stringify({
    tracks: tracks.map(track => ({
      ...track,
      clips: track.clips.map(clip => ({
        ...clip,
        audioBuffer: null, // Don't serialize audio buffer
        tonePlayer: null,  // Don't serialize Tone.js player
        toneVolume: null,  // Don't serialize Tone.js volume node
        howl: null         // Don't serialize Howl object (legacy)
      }))
    })),
    playheadTime,
    bpm,
    timeSigNum,
    timeSigDen
  });
  undoStack.push(state);
  if (undoStack.length > 50) undoStack.shift(); // Limit stack size
  redoStack = []; // Clear redo when new action performed
}

// --- Settings helpers ---
function loadSettings() {
  try {
    const raw = localStorage.getItem('daw_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      settings = { ...settings, ...parsed };
    }
  } catch {}
  // apply to legacy flag
  autoScrollEnabled = !!settings.autoScroll;
}

function persistSettings() {
  try { localStorage.setItem('daw_settings', JSON.stringify(settings)); } catch {}
}

function openSettings() {
  if (!settingsOverlay) return;
  // sync checkboxes
  if (setAutoScroll) setAutoScroll.checked = !!settings.autoScroll;
  if (setSnapToGrid) setSnapToGrid.checked = !!settings.snapToGrid;
  if (setTripletGuides) setTripletGuides.checked = !!settings.showTriplets;
  if (setConfirmDelete) setConfirmDelete.checked = !!settings.confirmDelete;
  // render shortcuts
  if (shortcutsList) {
    shortcutsList.innerHTML = '';
    SHORTCUTS.forEach(sc => {
      const label = document.createElement('div');
      label.className = 'shortcut-label';
      label.textContent = sc.label;
      const key = document.createElement('div');
      key.className = 'shortcut-key';
      key.textContent = sc.keys;
      shortcutsList.appendChild(label);
      shortcutsList.appendChild(key);
    });
  }
  settingsOverlay.classList.remove('hidden');
}

function closeSettings() {
  if (!settingsOverlay) return;
  settingsOverlay.classList.add('hidden');
}



function undo() {
  if (undoStack.length > 1) {
    redoStack.push(undoStack.pop());
    const state = JSON.parse(undoStack[undoStack.length - 1]);
    // Restore state (simplified - would need proper audio buffer restoration)
    playheadTime = state.playheadTime;
    bpm = state.bpm;
    timeSigNum = state.timeSigNum;
    timeSigDen = state.timeSigDen;
    render();
  }
}

function redo() {
  if (redoStack.length > 0) {
    const state = JSON.parse(redoStack.pop());
    undoStack.push(JSON.stringify(state));
    // Restore state
    playheadTime = state.playheadTime;
    bpm = state.bpm;
    timeSigNum = state.timeSigNum;
    timeSigDen = state.timeSigDen;
    render();
  }
}

// --- Enhanced Clip Operations ---
function moveClip(fromTrackIdx, clipIdx, toTrackIdx, newStartTime) {
  if (fromTrackIdx >= tracks.length || toTrackIdx >= tracks.length) return;
  
  const clip = tracks[fromTrackIdx].clips.splice(clipIdx, 1)[0];
  clip.startTime = Math.max(0, newStartTime);
  tracks[toTrackIdx].clips.push(clip);
  
  // Sort clips by start time
  tracks[toTrackIdx].clips.sort((a, b) => a.startTime - b.startTime);
  
  saveState();
  render();
}

function trimClip(tIdx, cIdx, newDuration, fromStart = false) {
  const clip = tracks[tIdx].clips[cIdx];
  if (fromStart) {
    const trimAmount = newDuration - clip.duration;
    clip.startTime -= trimAmount;
    clip.offset += trimAmount;
  }
  clip.duration = Math.max(0.1, newDuration);
  saveState();
  render();
}

function fadeInClip(tIdx, cIdx, fadeDuration = 0.5) {
  const clip = tracks[tIdx].clips[cIdx];
  if (!clip.audioBuffer) return;
  
  const buffer = clip.audioBuffer;
  const sampleRate = buffer.sampleRate;
  const fadeLength = Math.floor(fadeDuration * sampleRate);
  
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < Math.min(fadeLength, channelData.length); i++) {
      channelData[i] *= (i / fadeLength);
    }
  }
  render();
}

function fadeOutClip(tIdx, cIdx, fadeDuration = 0.5) {
  const clip = tracks[tIdx].clips[cIdx];
  if (!clip.audioBuffer) return;
  
  const buffer = clip.audioBuffer;
  const sampleRate = buffer.sampleRate;
  const fadeLength = Math.floor(fadeDuration * sampleRate);
  
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    const startFade = channelData.length - fadeLength;
    for (let i = startFade; i < channelData.length; i++) {
      const fadePosition = (channelData.length - i) / fadeLength;
      channelData[i] *= fadePosition;
    }
  }
  render();
}



// --- Audio Analysis and Visualization ---
function drawSpectrum(canvas, track) {
  if (!analyserNode) return;
  
  const ctx = canvas.getContext('2d');
  const bufferLength = analyserNode.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  
  analyserNode.getByteFrequencyData(dataArray);
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  const barWidth = canvas.width / bufferLength * 2.5;
  let x = 0;
  
  for (let i = 0; i < bufferLength; i++) {
    const barHeight = (dataArray[i] / 255) * canvas.height;
    
    const r = barHeight + 25 * (i / bufferLength);
    const g = 250 * (i / bufferLength);
    const b = 50;
    
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
    
    x += barWidth + 1;
  }
}

// --- Enhanced Waveform Drawing with Selection ---
function drawWaveform(canvas, audioBufferOrBuffer, offset, duration, isRawBuffer, isSelected = false) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  
  // Selection highlight
  if (isSelected) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  
  ctx.strokeStyle = isRawBuffer ? "rgba(255,60,60,1)" : (isSelected ? 'rgba(255,255,255,0.8)' : 'rgba(50,50,70,0.99)');
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  
  let channel;
  let sampleRate = 44100;
  if (isRawBuffer && (Array.isArray(audioBufferOrBuffer) || audioBufferOrBuffer instanceof Float32Array)) {
    channel = audioBufferOrBuffer;
    sampleRate = audioCtx ? audioCtx.sampleRate : 44100;
  } else if (audioBufferOrBuffer && audioBufferOrBuffer.getChannelData) {
    channel = audioBufferOrBuffer.getChannelData(0);
    sampleRate = audioBufferOrBuffer.sampleRate;
  } else {
    return;
  }
  
  const start = Math.floor(offset * sampleRate);
  const end = Math.min(channel.length, Math.floor((offset+duration) * sampleRate));
  const samples = end - start;
  const step = Math.max(1, Math.floor(samples / canvas.width));
  
  for (let x = 0; x < canvas.width; x++) {
    const idx = start + Math.floor(x * samples / canvas.width);
    let min = 1.0, max = -1.0;
    for (let j = 0; j < step && idx + j < end; j++) {
      const val = channel[idx + j];
      min = Math.min(min, val);
      max = Math.max(max, val);
    }
    const y1 = (1 - (max+1)/2) * canvas.height;
    const y2 = (1 - (min+1)/2) * canvas.height;
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2);
  }
  ctx.stroke();
}

// --- Context Menu Functions ---
function removeContextMenu() {
  if (contextMenuEl) {
    try {
      contextMenuEl.remove();
    } catch (e) {
      // Fallback if remove() fails
      if (contextMenuEl.parentNode) {
        contextMenuEl.parentNode.removeChild(contextMenuEl);
      }
    }
    contextMenuEl = null;
  }
  
  // Remove any orphaned context menus
  document.querySelectorAll('.context-menu').forEach(menu => {
    try {
      menu.remove();
    } catch (e) {
      if (menu.parentNode) {
        menu.parentNode.removeChild(menu);
      }
    }
  });
}

// --- Enhanced Context Menus with ALL Functions ---
function showClipContextMenu(e, tIdx, cIdx, clipDiv) {
  removeContextMenu();
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  
  // Calculate position to keep menu on screen
  const menuWidth = 200;
  const menuHeight = 400;
  let x = e.clientX;
  let y = e.clientY;
  
  if (x + menuWidth > window.innerWidth) {
    x = window.innerWidth - menuWidth - 10;
  }
  if (y + menuHeight > window.innerHeight) {
    y = window.innerHeight - menuHeight - 10;
  }
  
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';

  const clip = tracks[tIdx].clips[cIdx];
  const canSplitAtPlayhead = playheadTime >= clip.startTime && playheadTime <= (clip.startTime + clip.duration);
  
  console.log('Context menu split check:', {
    playheadTime: playheadTime,
    clipStart: clip.startTime,
    clipEnd: clip.startTime + clip.duration,
    canSplitAtPlayhead: canSplitAtPlayhead
  });

  let actions = [
    {label: 'Copy', fn: () => { selectClip(tIdx, cIdx); copySelectedClip(); console.log('Copy executed'); }},
    {label: 'Paste', fn: () => { pasteClip(); console.log('Paste executed'); }},
    {sep:true},
    {label: canSplitAtPlayhead ? `Split at Playhead (${playheadTime.toFixed(2)}s)` : `Split at Center (${(clip.startTime + clip.duration/2).toFixed(2)}s)`, fn: () => {
      const splitTimeToUse = canSplitAtPlayhead ? playheadTime : (clip.startTime + clip.duration / 2);
      console.log('Executing split at:', splitTimeToUse);
      splitClip(tIdx, cIdx, splitTimeToUse).catch(error => {
        console.error('Error splitting clip:', error);
        alert('Failed to split clip: ' + error.message);
      });
    }},
    {label: 'Delete', fn: () => { 
      if (settings.confirmDelete) {
        if (!confirm('Delete this clip?')) return;
      }
      tracks[tIdx].clips.splice(cIdx,1); 
      selectedClip = null;
      saveState(); 
      render(); 
      console.log('Delete executed');
    }},
    {label: 'Duplicate', fn: () => { duplicateClip(tIdx, cIdx); console.log('Duplicate executed'); }},
    {label: 'Quantize', fn: () => { selectClip(tIdx, cIdx); quantizeSelectedClip(); console.log('Quantize executed'); }},
    {sep:true},
    {label: 'Fade In', fn: () => { fadeInClip(tIdx, cIdx); saveState(); console.log('Fade In executed'); }},
    {label: 'Fade Out', fn: () => { fadeOutClip(tIdx, cIdx); saveState(); console.log('Fade Out executed'); }},
    {label: 'Normalize', fn: () => { normalizeClip(tIdx, cIdx); console.log('Normalize executed'); }},
    {label: 'Reverse', fn: () => { reverseClip(tIdx, cIdx); console.log('Reverse executed'); }},
    {sep:true},
    {label: 'Rename', fn: () => { renameClip(tIdx, cIdx); console.log('Rename executed'); }},
    {label: 'Export Clip', fn: () => { exportClip(tIdx, cIdx); console.log('Export executed'); }},
    {label: 'Move to New Track', fn: () => { moveClipToNewTrack(tIdx, cIdx); console.log('Move to new track executed'); }},
    {sep:true},
    {label: 'Change Color', color:true, fn: (color) => { changeClipColor(tIdx, cIdx, color); console.log('Color changed to:', color); }}
  ];
  
  actions.forEach(act => {
    if (act.sep) {
      let sep = document.createElement('div');
      sep.className = 'context-menu-sep';
      menu.appendChild(sep);
      return;
    }
    let item = document.createElement('div');
    item.className = 'context-menu-item';
    item.innerText = act.label;
    if (act.color) {
      let colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.value = tracks[tIdx].clips[cIdx].color;
      colorInput.className = 'color-picker';
      colorInput.onclick = (ev) => ev.stopPropagation();
      colorInput.onchange = (ev) => { 
        act.fn(ev.target.value); 
        removeContextMenu(); 
      };
      item.appendChild(colorInput);
    } else {
      item.onclick = (ev) => { 
        ev.stopPropagation();
        ev.preventDefault();
        console.log('Menu item clicked:', act.label);
        try {
          act.fn();
        } catch (error) {
          console.error('Error executing action:', act.label, error);
        }
        removeContextMenu(); 
      };
    }
    menu.appendChild(item);
  });
  
  document.body.appendChild(menu);
  contextMenuEl = menu;
  
  // Force reflow to ensure menu is rendered
  menu.offsetHeight;
  
  // Prevent menu from closing immediately
  setTimeout(() => {
    const closeMenu = (event) => {
      if (!menu.contains(event.target)) {
        removeContextMenu();
        document.removeEventListener('mousedown', closeMenu);
        document.removeEventListener('contextmenu', closeMenu);
      }
    };
    
    document.addEventListener('mousedown', closeMenu);
    document.addEventListener('contextmenu', closeMenu);
    
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        removeContextMenu();
      }
    }, { once: true });
  }, 100); // Increased timeout
}

function showTrackContextMenu(e, tIdx) {
  removeContextMenu();
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  
  // Calculate position to keep menu on screen
  const menuWidth = 200;
  const menuHeight = 350;
  let x = e.clientX;
  let y = e.clientY;
  
  if (x + menuWidth > window.innerWidth) {
    x = window.innerWidth - menuWidth - 10;
  }
  if (y + menuHeight > window.innerHeight) {
    y = window.innerHeight - menuHeight - 10;
  }
  
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';

  let actions = [
    {label: tracks[tIdx].muted ? "Unmute" : "Mute", fn: () => { toggleTrackMute(tIdx); console.log('Track mute toggled'); }},
    {label: tracks[tIdx].solo ? "Unsolo" : "Solo", fn: () => { toggleTrackSolo(tIdx); console.log('Track solo toggled'); }},
    {label: tracks[tIdx].armed ? "Disarm" : "Arm for Recording", fn: () => { toggleTrackArm(tIdx); console.log('Track arm toggled'); }},
    {sep:true},
    {label: 'Rename Track', fn: () => { renameTrack(tIdx); console.log('Rename track executed'); }},
    {label: 'Delete Track', fn: () => { 
      if (tracks.length <= 1) {
        alert('Cannot delete the last track');
        return;
      }
      if (confirm(`Delete track "${tracks[tIdx].label}"?`)) {
        tracks.splice(tIdx, 1);
        if (selectedTrackIndex >= tracks.length) selectedTrackIndex = tracks.length - 1;
        saveState();
        render();
        console.log('Track deleted');
      }
    }},
    {label: 'Duplicate Track', fn: () => { duplicateTrack(tIdx); console.log('Track duplicated'); }},
    {sep:true},
    {label: 'Add Silence Clip', fn: () => { addSilenceClip(tIdx); console.log('Silence clip added'); }},
    {label: 'Quantize All Clips', fn: () => { quantizeAllClipsInTrack(tIdx); console.log('All clips quantized'); }},
    {sep:true},
    {label: 'Paste', fn: () => { pasteClip(); console.log('Paste executed'); }},
    {label: 'Change Track Color', color:true, fn: (color) => { tracks[tIdx].color = color; saveState(); render(); console.log('Track color changed to:', color); }}
  ];
  
  actions.forEach(act => {
    if (act.sep) {
      let sep = document.createElement('div');
      sep.className = 'context-menu-sep';
      menu.appendChild(sep);
      return;
    }
    let item = document.createElement('div');
    item.className = 'context-menu-item';
    item.innerText = act.label;
    if (act.color) {
      let colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.value = tracks[tIdx].color;
      colorInput.className = 'color-picker';
      colorInput.onclick = (ev) => ev.stopPropagation();
      colorInput.onchange = (ev) => { 
        act.fn(ev.target.value); 
        removeContextMenu(); 
      };
      item.appendChild(colorInput);
    } else {
      item.onclick = (ev) => { 
        ev.stopPropagation();
        ev.preventDefault();
        console.log('Menu item clicked:', act.label);
        try {
          act.fn();
        } catch (error) {
          console.error('Error executing action:', act.label, error);
        }
        removeContextMenu(); 
      };
    }
    menu.appendChild(item);
  });
  
  document.body.appendChild(menu);
  contextMenuEl = menu;
  
  // Force reflow to ensure menu is rendered
  menu.offsetHeight;
  
  setTimeout(() => {
    const closeMenu = (event) => {
      if (!menu.contains(event.target)) {
        removeContextMenu();
        document.removeEventListener('mousedown', closeMenu);
        document.removeEventListener('contextmenu', closeMenu);
      }
    };
    
    document.addEventListener('mousedown', closeMenu);
    document.addEventListener('contextmenu', closeMenu);
    
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        removeContextMenu();
      }
    }, { once: true });
  }, 100);
}

// --- Missing Context Menu Functions ---
function duplicateClip(tIdx, cIdx) {
  const clip = tracks[tIdx].clips[cIdx];
  if (!clip || !clip.audioBuffer) {
    console.error('Cannot duplicate clip: clip or audioBuffer missing');
    return;
  }
  
  const newClip = createClip(
    clip.audioBuffer,
    clip.startTime + clip.duration, // Place after original clip
    clip.duration,
    clip.offset,
    clip.color,
    clip.name + " Copy"
  );
  
  tracks[tIdx].clips.push(newClip);
  
  // Sort clips by start time
  tracks[tIdx].clips.sort((a, b) => a.startTime - b.startTime);
  
  saveState();
  render();
  console.log('Clip duplicated successfully');
}

function normalizeClip(tIdx, cIdx) {
  const clip = tracks[tIdx].clips[cIdx];
  if (!clip.audioBuffer) {
    console.error('Cannot normalize clip: audioBuffer missing');
    return;
  }
  
  // Find peak
  let peak = 0;
  for (let ch = 0; ch < clip.audioBuffer.numberOfChannels; ch++) {
    const data = clip.audioBuffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      peak = Math.max(peak, Math.abs(data[i]));
    }
  }
  
  // Normalize to 0.9 to avoid clipping
  if (peak > 0) {
    const gain = 0.9 / peak;
    for (let ch = 0; ch < clip.audioBuffer.numberOfChannels; ch++) {
      const data = clip.audioBuffer.getChannelData(ch);
      for (let i = 0; i < data.length; i++) {
        data[i] *= gain;
      }
    }
    console.log('Clip normalized with gain:', gain);
  } else {
    console.log('Clip is silent, no normalization needed');
  }
  
  saveState();
  render();
}

function changeClipColor(tIdx, cIdx, color) {
  if (tIdx >= tracks.length || cIdx >= tracks[tIdx].clips.length) {
    console.error('Cannot change clip color: invalid indices');
    return;
  }
  
  tracks[tIdx].clips[cIdx].color = color;
  saveState();
  render();
  console.log('Clip color changed to:', color);
}

function exportClip(tIdx, cIdx) {
  const clip = tracks[tIdx].clips[cIdx];
  if (!clip.audioBuffer) {
    console.error('Cannot export clip: audioBuffer missing');
    alert('Cannot export clip: no audio data');
    return;
  }
  
  try {
    const wavData = audioBufferToWav(clip.audioBuffer, clip.offset, clip.duration);
    const blob = new Blob([wavData], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${clip.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('Clip exported successfully as:', a.download);
  } catch (error) {
    console.error('Error exporting clip:', error);
    alert('Error exporting clip. Please try again.');
  }
}

function moveClipToNewTrack(tIdx, cIdx) {
  const clip = tracks[tIdx].clips[cIdx];
  if (!clip) {
    console.error('Cannot move clip: clip not found');
    return;
  }
  
  // Create new track
  const newTrack = createTrack(`Track ${tracks.length + 1}`);
  tracks.push(newTrack);
  
  // Move clip to new track
  tracks[tIdx].clips.splice(cIdx, 1);
  tracks[tracks.length - 1].clips.push(clip);
  
  saveState();
  render();
  console.log('Clip moved to new track');
}

function reverseClip(tIdx, cIdx) {
  const clip = tracks[tIdx].clips[cIdx];
  if (!clip.audioBuffer) {
    console.error('Cannot reverse clip: audioBuffer missing');
    return;
  }
  
  for (let ch = 0; ch < clip.audioBuffer.numberOfChannels; ch++) {
    const data = clip.audioBuffer.getChannelData(ch);
    Array.prototype.reverse.call(data);
  }
  
  saveState();
  render();
  console.log('Clip reversed');
}

function duplicateTrack(tIdx) {
  if (tIdx >= tracks.length) {
    console.error('Cannot duplicate track: invalid index');
    return;
  }
  
  const originalTrack = tracks[tIdx];
  const newTrack = createTrack(originalTrack.label + ' Copy', originalTrack.color);
  newTrack.volume = originalTrack.volume;
  newTrack.pan = originalTrack.pan;
  newTrack.muted = originalTrack.muted;
  newTrack.solo = false; // Don't duplicate solo state
  
  // Duplicate all clips
  originalTrack.clips.forEach(clip => {
    if (clip.audioBuffer) {
      const newClip = createClip(
        clip.audioBuffer,
        clip.startTime,
        clip.duration,
        clip.offset,
        clip.color,
        clip.name + ' Copy'
      );
      newTrack.clips.push(newClip);
    }
  });
  
  tracks.splice(tIdx + 1, 0, newTrack);
  saveState();
  render();
  console.log('Track duplicated');
}

// Fixed split function
// Helper function to extract a portion of audio data into a new independent AudioBuffer
function extractAudioBufferSegment(sourceBuffer, startOffsetInSeconds, durationInSeconds) {
  const sampleRate = sourceBuffer.sampleRate;
  const numberOfChannels = sourceBuffer.numberOfChannels;
  
  // Calculate sample positions
  const startSample = Math.floor(startOffsetInSeconds * sampleRate);
  const endSample = Math.min(
    Math.floor((startOffsetInSeconds + durationInSeconds) * sampleRate),
    sourceBuffer.length
  );
  const segmentLength = endSample - startSample;
  
  if (segmentLength <= 0) {
    console.error('Invalid segment length for audio buffer extraction');
    return null;
  }
  
  console.log('Extracting audio segment:', {
    startOffsetInSeconds,
    durationInSeconds,
    startSample,
    endSample,
    segmentLength,
    sampleRate,
    numberOfChannels
  });
  
  // Create new independent AudioBuffer
  const newBuffer = audioCtx.createBuffer(numberOfChannels, segmentLength, sampleRate);
  
  // Copy audio data for each channel
  for (let channel = 0; channel < numberOfChannels; channel++) {
    const sourceChannelData = sourceBuffer.getChannelData(channel);
    const newChannelData = newBuffer.getChannelData(channel);
    
    // Copy the segment data
    for (let i = 0; i < segmentLength; i++) {
      const sourceIndex = startSample + i;
      if (sourceIndex < sourceChannelData.length) {
        newChannelData[i] = sourceChannelData[sourceIndex];
      } else {
        newChannelData[i] = 0; // Fill with silence if we exceed source length
      }
    }
  }
  
  return newBuffer;
}

async function splitClip(tIdx, cIdx, splitTime) {
  const clip = tracks[tIdx].clips[cIdx];
  if (!clip || !clip.audioBuffer) {
    console.error('Cannot split clip: clip or audioBuffer missing');
    return;
  }
  
  console.log('Split parameters:', {
    clipStart: clip.startTime,
    clipEnd: clip.startTime + clip.duration,
    splitTime: splitTime,
    playheadTime: playheadTime
  });
  
  // Validate that split time is within the clip bounds
  if (splitTime < clip.startTime || splitTime > clip.startTime + clip.duration) {
    console.log('Split time is outside clip bounds');
    alert(`Split time ${splitTime.toFixed(2)}s is outside clip bounds (${clip.startTime.toFixed(2)}s - ${(clip.startTime + clip.duration).toFixed(2)}s)`);
    return;
  }
  
  // Calculate the split position relative to clip start
  const splitOffset = splitTime - clip.startTime;
  
  console.log('Split offset from clip start:', splitOffset);
  
  // Show progress indicator for the split operation
  const progressDiv = document.createElement('div');
  progressDiv.style.cssText = `
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    background: rgba(0,0,0,0.9); color: white; padding: 15px; border-radius: 8px;
    z-index: 10000; text-align: center; min-width: 200px;
  `;
  progressDiv.innerHTML = `
    <div style="margin-bottom: 10px;">Splitting clip...</div>
    <div style="color: #1de9b6; font-size: 12px;">Creating independent audio segments</div>
  `;
  document.body.appendChild(progressDiv);
  
  try {
    // Create independent audio buffers for each split clip
    const firstClipDuration = splitOffset;
    const secondClipDuration = clip.duration - splitOffset;
    
    // Extract first portion (from clip start to split point)
    const firstAudioBuffer = extractAudioBufferSegment(
      clip.audioBuffer,
      clip.offset, // Start from the clip's current offset in the source buffer
      firstClipDuration
    );
    
    // Extract second portion (from split point to clip end)
    const secondAudioBuffer = extractAudioBufferSegment(
      clip.audioBuffer,
      clip.offset + splitOffset, // Start from clip offset + split offset
      secondClipDuration
    );
    
    if (!firstAudioBuffer || !secondAudioBuffer) {
      console.error('Failed to extract audio buffer segments for split');
      alert('Failed to split clip: could not extract audio segments');
      return;
    }
    
    // Create independent blob URLs for Tone.js integration if needed
    let firstAudioUrl = null;
    let secondAudioUrl = null;
    
    if (clip.audioUrl && typeof Tone !== 'undefined') {
      try {
        console.log('Creating independent blob URLs for split clips...');
        firstAudioUrl = await bufferToBlob(firstAudioBuffer);
        secondAudioUrl = await bufferToBlob(secondAudioBuffer);
        console.log('Independent blob URLs created successfully');
      } catch (blobError) {
        console.warn('Failed to create blob URLs for split clips:', blobError);
        // Continue without blob URLs - clips will still work with AudioBuffer
      }
    }
    
    // Create first clip (from start to split point) with independent audio buffer
    let firstClip = createClip(
      firstAudioBuffer, 
      clip.startTime, 
      firstClipDuration, 
      0, // Reset offset since we extracted the exact segment
      clip.color, 
      clip.name + " (1)",
      firstAudioUrl, // Independent blob URL
      clip.mimeType
    );
    
    // Create second clip (from split point to end) with independent audio buffer  
    let secondClip = createClip(
      secondAudioBuffer, 
      splitTime, 
      secondClipDuration, 
      0, // Reset offset since we extracted the exact segment
      clip.color, 
      clip.name + " (2)",
      secondAudioUrl, // Independent blob URL
      clip.mimeType
    );
    
    // Copy any automation data that might be relevant
    if (clip.automation && clip.automation.volume && clip.automation.volume.points.length > 0) {
      // Copy automation points that fall within each clip's time range
      firstClip.automation.volume.points = clip.automation.volume.points.filter(point => 
        point.time <= splitOffset
      );
      
      secondClip.automation.volume.points = clip.automation.volume.points
        .filter(point => point.time > splitOffset)
        .map(point => ({ ...point, time: point.time - splitOffset })); // Adjust time relative to new clip start
    }
    
    // Dispose of original Tone.js player and clean up blob URL if it exists
    if (clip.tonePlayer) {
      clip.tonePlayer.dispose();
    }
    if (clip.toneVolume) {
      clip.toneVolume.dispose();
    }
    
    // Clean up original blob URL to prevent memory leaks
    if (clip.audioUrl && clip.audioUrl.startsWith('blob:')) {
      URL.revokeObjectURL(clip.audioUrl);
      console.log('Revoked original blob URL for split clip');
    }
    
    // Remove original clip and add the two new independent clips
    tracks[tIdx].clips.splice(cIdx, 1, firstClip, secondClip);
    tracks[tIdx].clips.sort((a, b) => a.startTime - b.startTime);
    
    // Clean up progress indicator
    if (progressDiv && progressDiv.parentNode) {
      document.body.removeChild(progressDiv);
    }
    
    saveState();
    render();
    
    console.log('Clip split successfully into two independent clips:', {
      originalClip: clip.name,
      firstClip: { name: firstClip.name, duration: firstClip.duration, hasBlob: !!firstClip.audioUrl },
      secondClip: { name: secondClip.name, duration: secondClip.duration, hasBlob: !!secondClip.audioUrl },
      totalDuration: firstClip.duration + secondClip.duration,
      originalDuration: clip.duration
    });
    
  } catch (error) {
    // Clean up progress indicator on error
    if (progressDiv && progressDiv.parentNode) {
      document.body.removeChild(progressDiv);
    }
    
    console.error('Error splitting clip:', error);
    alert('Failed to split clip: ' + error.message);
  }
}

function renameClip(tIdx, cIdx) {
  const clip = tracks[tIdx].clips[cIdx];
  if (!clip) {
    console.error('Cannot rename clip: clip not found');
    return;
  }
  
  const newName = prompt("Enter new clip name:", clip.name);
  if (newName && newName.trim()) {
    clip.name = newName.trim();
    saveState();
    render();
    console.log('Clip renamed to:', newName.trim());
  }
}

function renameTrack(tIdx) {
  if (tIdx >= tracks.length) {
    console.error('Cannot rename track: invalid index');
    return;
  }
  
  const track = tracks[tIdx];
  const newName = prompt("Enter new track name:", track.label);
  if (newName && newName.trim()) { 
    track.label = newName.trim(); 
    saveState();
    render(); 
    console.log('Track renamed to:', newName.trim());
  }
}

function addSilenceClip(tIdx) {
  if (tIdx >= tracks.length) {
    console.error('Cannot add silence clip: invalid track index');
    return;
  }
  
  initAudioContext();
  let dur = 2; // 2 seconds of silence
  let buffer = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * dur), audioCtx.sampleRate);
  
  // Fill with silence (zeros) - actually already zero by default
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < channelData.length; i++) {
    channelData[i] = 0;
  }
  
  const clip = createClip(buffer, playheadTime, dur, 0, undefined, "Silence");
  tracks[tIdx].clips.push(clip);
  
  saveState();
  render();
  console.log('Silence clip added');
}

// --- Simple WAV Export Function ---
function audioBufferToWav(buffer, offset = 0, duration = null) {
  const length = duration ? Math.min(duration * buffer.sampleRate, buffer.length) : buffer.length;
  const startSample = Math.floor(offset * buffer.sampleRate);
  const endSample = Math.min(startSample + length, buffer.length);
  const actualLength = endSample - startSample;
  
  const arrayBuffer = new ArrayBuffer(44 + actualLength * 2);
  const view = new DataView(arrayBuffer);
  
  // WAV header
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + actualLength * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, actualLength * 2, true);
  
  // Audio data
  const channelData = buffer.getChannelData(0);
  let offset_wav = 44;
  for (let i = startSample; i < endSample; i++) {
    const sample = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(offset_wav, sample * 0x7FFF, true);
    offset_wav += 2;
  }
  
  return arrayBuffer;
}

// --- Metronome Functions ---
function startMetronome() {
  if (!audioCtx) return;
  
  // Create simple metronome sounds if not already created
  if (!metronomeTickBuffer) {
    metronomeTickBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.1, audioCtx.sampleRate);
    metronomeAccentBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.1, audioCtx.sampleRate);
    
    const tickData = metronomeTickBuffer.getChannelData(0);
    const accentData = metronomeAccentBuffer.getChannelData(0);
    
    for (let i = 0; i < tickData.length; i++) {
      const t = i / audioCtx.sampleRate;
      tickData[i] = Math.sin(2 * Math.PI * 800 * t) * Math.exp(-t * 30) * 0.3;
      accentData[i] = Math.sin(2 * Math.PI * 1000 * t) * Math.exp(-t * 20) * 0.5;
    }
  }
  
  const scheduleNextTick = () => {
    if (!metronomeEnabled || !playing) return;
    
    const secPerBeat = getSecPerBeat();
    const nextBeat = Math.ceil(playheadTime / secPerBeat) * secPerBeat;
    const timeToNext = nextBeat - playheadTime;
    
    if (timeToNext > 0 && timeToNext < secPerBeat) {
      const source = audioCtx.createBufferSource();
      const beatNumber = Math.floor(nextBeat / secPerBeat) % timeSigNum;
      source.buffer = beatNumber === 0 ? metronomeAccentBuffer : metronomeTickBuffer;
      source.connect(audioCtx.destination);
      source.start(audioCtx.currentTime + timeToNext);
      
      metronomeTimeout = setTimeout(scheduleNextTick, timeToNext * 1000 + 50);
    } else {
      metronomeTimeout = setTimeout(scheduleNextTick, 50);
    }
  };
  
  scheduleNextTick();
}

function stopMetronome() {
  if (metronomeTimeout) {
    clearTimeout(metronomeTimeout);
    metronomeTimeout = null;
  }
}

// --- Rendering ---
function render() {
  renderTimeline();
  renderTracks();
}

// --- File Upload ---
fileInput.onchange = async (e) => {
  const files = e.target.files;
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  for (let file of files) {
    console.log('Loading file:', file.name, 'Type:', file.type, 'Size:', file.size);
    
    // Create URL for Howler.js with proper MIME type
    const audioUrl = URL.createObjectURL(file);
    
    // Read file as ArrayBuffer and decode as audio, then add as a new clip
    const arrayBuffer = await file.arrayBuffer();
    await new Promise((resolve, reject) => {
      audioCtx.decodeAudioData(arrayBuffer, (buffer) => {
        // Try to create clip with Howler.js support
        addClipToFirstTrackWithHowler(buffer, playheadTime, buffer.duration, undefined, file.name.split(".")[0], audioUrl, file.type);
        saveState();
        render();
        resolve();
      }, (error) => {
        console.error('Failed to decode audio data:', error);
        // Fallback: create clip without Howler.js
        addClipToFirstTrack(buffer, playheadTime, buffer.duration, undefined, file.name.split(".")[0]);
        saveState();
        render();
        resolve();
      });
    });
  }
  fileInput.value = '';
};

// --- Initialize with proper setup ---
function init() {
  bpm = DEFAULT_BPM;
  timeSigNum = DEFAULT_SIG_NUM;
  timeSigDen = DEFAULT_SIG_DEN;
  tracks = [];
  selectedTrackIndex = 0;
  for (let i = 0; i < DEFAULT_TRACKS; i++) {
    tracks.push(createTrack());
  }
  if (tracks.length > 0) {
    tracks[0].selected = true;
    // Add a test plugin to the first track for demonstration
    tracks[0].inserts[0] = 'delay';
    tracks[0].inserts[1] = 'convolutionReverb';
  }
  initAudioContext();
  
  // Initialize pan nodes for all tracks
  for (let i = 0; i < tracks.length; i++) {
    getTrackPanNode(i); // This creates the pan node if it doesn't exist
  }
  
  loadSettings();
  
  // Set up button handlers here to ensure DOM elements exist
  playBtn.onclick = () => {
    playAll();
  };

  pauseBtn.onclick = () => {
    pauseAll();
  };

  // New transport button handlers
  goToStartBtn.onclick = () => {
    goToBeginning();
  };

  skipBackBtn.onclick = () => {
    skipBackOneMeasure();
  };

  skipForwardBtn.onclick = () => {
    skipForwardOneMeasure();
  };
  

  
  // Initialize plugin strip
  initializePluginStrip();
  
  saveState();
  render();
}

// Ensure initialization after DOM is loaded
window.onload = init;

// Note: updatePlayhead function removed - auto-scroll is now handled in updatePlayheadLoop

// --- Add Track Button ---
addTrackBtn.onclick = () => {
  tracks.push(createTrack());
  saveState();
  render();
};

// --- Zoom Controls ---
zoomInBtn.onclick = () => {
  zoomLevel = Math.min(zoomLevel * 1.5, 4);
  PIXELS_PER_SEC = BASE_PIXELS_PER_SEC * zoomLevel;
  render();
};

zoomOutBtn.onclick = () => {
  zoomLevel = Math.max(zoomLevel / 1.5, 0.25);
  PIXELS_PER_SEC = BASE_PIXELS_PER_SEC * zoomLevel;
  render();
};

// --- Settings Controls ---
bpmInput.onchange = () => {
  bpm = parseInt(bpmInput.value);
  render();
};

tsNumInput.onchange = () => {
  timeSigNum = parseInt(tsNumInput.value);
  render();
};

tsDenInput.onchange = () => {
  timeSigDen = parseInt(tsDenInput.value);
  render();
};

metronomeBtn.onclick = () => {
  metronomeEnabled = !metronomeEnabled;
  metronomeBtn.textContent = metronomeEnabled ? 'Metronome On' : 'Metronome Off';
  metronomeBtn.className = metronomeEnabled ? 'metronome-btn metronome-on' : 'metronome-btn';
};



// --- Window Management System
let currentView = 'arrangement';

// Window switching functions
function showArrangementView() {
  currentView = 'arrangement';
  arrangementWindow.classList.remove('hidden');
  arrangementWindow.classList.add('active');
  mixerWindow.classList.add('hidden');
  mixerWindow.classList.remove('active');
  if (fxOverlay) { fxOverlay.classList.add('hidden'); }
  editorWindow.classList.add('hidden');
  editorWindow.classList.remove('active');
  updateViewButtons('arrangement');
}

function showMixerView() {
  currentView = 'mixer';
  mixerWindow.classList.remove('hidden');
  mixerWindow.classList.add('active');
  arrangementWindow.classList.add('hidden');
  arrangementWindow.classList.remove('active');
  if (fxOverlay) { fxOverlay.classList.add('hidden'); }
  editorWindow.classList.add('hidden');
  editorWindow.classList.remove('active');
  updateViewButtons('mixer');
  renderMixer();
}

function showFxView() {
  // Open as modal over current view; keep highlight on existing view
  if (fxOverlay) fxOverlay.classList.remove('hidden');
  updateViewButtons(currentView);
  renderFxView();
  
  // Initialize resizable functionality for the modal
  setTimeout(() => {
    if (typeof refreshResizableComponents === 'function') {
      refreshResizableComponents();
    }
  }, 100);
}

// Event listeners for window switching
arrangeViewBtn.onclick = showArrangementView;
mixerViewBtn.onclick = showMixerView;
if (fxViewBtn) fxViewBtn.onclick = showFxView;
// FX modal close controls
if (fxOverlay) {
  fxOverlay.addEventListener('click', (e) => { if (e.target === fxOverlay) fxOverlay.classList.add('hidden'); });
}
if (fxClose) fxClose.onclick = () => fxOverlay.classList.add('hidden');
if (fxCloseFooter) fxCloseFooter.onclick = () => fxOverlay.classList.add('hidden');
// Close FX overlay on Escape
document.addEventListener('keydown', (e) => {
  const fxOpen = fxOverlay && !fxOverlay.classList.contains('hidden');
  if (fxOpen && e.key === 'Escape') {
    e.preventDefault();
    fxOverlay.classList.add('hidden');
  }
});

// Mixer Channel Creation and Management
function createMixerChannel(trackIndex, track) {
  const channelId = `mixer-channel-${trackIndex}`;
  const pos = typeof track.faderPos === 'number' ? track.faderPos : gainToPos(track.volume);
  
  return `
  <div id="${channelId}" class="mixer-channel mixer-strip bg-gray-800 rounded-lg border border-gray-700 shadow-lg">
      <div class="strip-color" style="background:${track.color}"></div>
      
      <!-- Compact Header: Name + buttons -->
      <div class="strip-header">
        <div class="strip-title" title="${track.label}">${track.label}</div>
        <div class="strip-buttons">
          <button class="strip-btn record ${track.armed ? 'active' : ''}" data-track="${trackIndex}" title="Arm (R)">R</button>
          <button class="strip-btn solo ${track.solo ? 'active' : ''}" data-track="${trackIndex}" title="Solo">S</button>
          <button class="strip-btn mute ${track.muted ? 'active' : ''}" data-track="${trackIndex}" title="Mute">M</button>
        </div>
      </div>

      <!-- Compact I/O -->
      <div class="io-section">
        <div class="io-row">
          <label class="io-label">In</label>
          <select class="io-input" data-track="${trackIndex}" data-io="input">
            <option ${track.io.input==='Input 1'?'selected':''}>Input 1</option>
            <option ${track.io.input==='Input 2'?'selected':''}>Input 2</option>
            <option ${track.io.input==='None'?'selected':''}>None</option>
          </select>
        </div>
        <div class="io-row">
          <label class="io-label">Out</label>
          <select class="io-input" data-track="${trackIndex}" data-io="output">
            <option ${track.io.output==='Master'?'selected':''}>Master</option>
            <option ${track.io.output==='Bus 1-2'?'selected':''}>Bus 1-2</option>
          </select>
        </div>
      </div>

      <!-- Compact Inserts -->
      <div class="inserts">
        <div class="section-label">FX</div>
        ${track.inserts.slice(0, 3).map((inst, i)=>`<button class="insert-slot" data-track="${trackIndex}" data-slot="${i}" title="Insert ${i+1}">${inst ? (window.FXPlugins && FXPlugins.get(inst) ? FXPlugins.get(inst).name : inst) : '—'}</button>`).join('')}
      </div>

      <!-- Compact Sends -->
      <div class="sends">
        <div class="section-label">Sends</div>
        ${['A','B','C'].map(letter=>`<div class="send"><span class="send-label">${letter}</span><input type="range" min="0" max="1" step="0.01" value="${track.sends[letter]}" class="send-knob" data-track="${trackIndex}" data-send="${letter}"></div>`).join('')}
      </div>

      <!-- Enhanced Pan Knob (20px diameter) -->
      <div class="knob-container">
        <div class="text-xs text-gray-400 text-center mb-1">PAN</div>
        <div class="knob-wrapper mx-auto relative w-5 h-5">
          <svg class="knob-svg w-full h-full" viewBox="0 0 20 20">
            <!-- Outer ring -->
            <circle cx="10" cy="10" r="9" fill="#374151" stroke="#4B5563" stroke-width="0.5"/>
            <!-- Inner knob -->
            <circle cx="10" cy="10" r="7" fill="#1F2937" stroke="#6B7280" stroke-width="0.5"/>
            <!-- Pan indicator line -->
            <path class="knob-indicator" d="M10 2 L10 5" stroke="#10B981" stroke-width="1.5" stroke-linecap="round" transform="rotate(${track.pan*135} 10 10)"/>
            <!-- Center dot -->
            <circle cx="10" cy="10" r="0.5" fill="#10B981"/>
            <!-- Pan position markers -->
            <text x="10" y="3" text-anchor="middle" fill="#6B7280" font-size="2" font-family="monospace">L</text>
            <text x="17" y="12" text-anchor="middle" fill="#6B7280" font-size="2" font-family="monospace">R</text>
          </svg>
          <input type="range" class="knob-input opacity-0 absolute inset-0 w-full h-full cursor-pointer" min="-100" max="100" value="${track.pan * 100}" step="1" data-track="${trackIndex}" data-param="pan" title="Pan: ${(track.pan * 100).toFixed(0)}%">
        </div>
        <!-- Pan value display -->
        <div class="text-[9px] text-gray-500 text-center mt-1 font-mono">${track.pan === 0 ? 'C' : (track.pan > 0 ? 'R' + Math.abs(track.pan * 100).toFixed(0) : 'L' + Math.abs(track.pan * 100).toFixed(0))}</div>
      </div>

      <!-- PROFESSIONAL FADER - The Main Feature -->
      <div class="fader-container">
        <div class="text-[10px] text-gray-400 text-center mb-2 tracking-wide font-bold">VOLUME</div>
        <div class="fader-track" data-track="${trackIndex}" data-min="0" data-max="1" data-step="0.001">
          <!-- Unity gain marker -->
          <div class="unity-marker" style="top: ${(1 - gainToPos(1.0)) * 100}%;"></div>
          <!-- Professional fader handle -->
          <div class="fader-handle" style="top: ${(1 - pos) * 100}%;"></div>
          <!-- Hidden range input for fallback -->
          <input type="range" class="volume-fader" min="0" max="1" value="${pos}" step="0.001" data-track="${trackIndex}" data-param="volume" orient="vertical">
        </div>
        <div class="volume-display">${formatDb(track.volume)}</div>
      </div>

      <!-- Compact Level Meter -->
      <div class="meter-block">
        <div class="clip-led" title="Clip (click to reset)"></div>
        <div class="output-meter bg-gray-900 rounded relative overflow-hidden">
          <div class="meter-fill w-full absolute bottom-0 transition-all duration-75" style="height: 0%"></div>
        </div>
      </div>

    </div>
  `;
}

function renderMixer() {
  if (!mixerChannels) return;
  
  let mixerHTML = '';
  tracks.forEach((track, index) => {
  if (typeof track.faderPos !== 'number') track.faderPos = gainToPos(track.volume);
    mixerHTML += createMixerChannel(index, track);
  });
  // Master strip
  mixerHTML += createMasterChannel();
  mixerChannels.innerHTML = mixerHTML;
  
  // Add event listeners for mixer controls
  setupMixerEventListeners();
  
  // Refresh resizable components after rendering mixer
  setTimeout(() => {
    if (typeof refreshResizableComponents === 'function') {
      refreshResizableComponents();
    }
  }, 0);
}

function createMasterChannel() {
  return `
  <div class="mixer-channel mixer-strip master bg-gray-900 rounded-lg border border-gray-700 shadow-lg">
      <div class="strip-header">
        <div class="strip-title" title="Master">Master</div>
      </div>
      
      <!-- PROFESSIONAL MASTER FADER -->
      <div class="fader-container">
        <div class="text-[10px] text-gray-400 text-center mb-2 tracking-wide font-bold">MASTER</div>
        <div class="fader-track master-fader" data-track="master" data-min="0" data-max="1" data-step="0.001">
          <!-- Unity gain marker -->
          <div class="unity-marker" style="top: 20%;"></div>
          <!-- Professional master fader handle -->
          <div class="fader-handle master-handle" style="top: 20%;"></div>
        </div>
        <div class="volume-display">0.0 dB</div>
      </div>
      
      <!-- Master Level Meter -->
      <div class="meter-block">
        <div class="clip-led" title="Master Clip (click to reset)"></div>
        <div class="output-meter bg-gray-900 rounded relative overflow-hidden">
          <div class="meter-fill w-full absolute bottom-0 transition-all duration-75" style="height: 0%"></div>
        </div>
      </div>
    </div>
  `;
}

function setupMixerEventListeners() {
  // === PROFESSIONAL FADER INTERACTION (Lexicon-style) ===
  document.querySelectorAll('.fader-track').forEach(track => {
    const trackIndex = parseInt(track.dataset.track);
    const handle = track.querySelector('.fader-handle');
    const volumeDisplay = track.parentElement.querySelector('.volume-display');
    const hiddenInput = track.querySelector('.volume-fader');
    const trackData = tracks[trackIndex];
    
    let isDragging = false;
    let startY = 0;
    let startValue = 0;

    function startDrag(e) {
      isDragging = true;
      startY = e.clientY || (e.touches && e.touches[0].clientY);
      startValue = trackData.faderPos || gainToPos(trackData.volume);
      document.body.style.cursor = 'grabbing';
      track.classList.add('dragging');
      e.preventDefault();
    }

    function doDrag(e) {
      if (!isDragging) return;
      
      const currentY = e.clientY || (e.touches && e.touches[0].clientY);
      const deltaY = startY - currentY; // Inverted: up = higher value
      const trackRect = track.getBoundingClientRect();
      const sensitivity = 1.5; // Fine control like Lexicon hardware
      const deltaValue = (deltaY / trackRect.height) * sensitivity;
      
      let newValue = Math.max(0, Math.min(1, startValue + deltaValue));
      
      // Snap to unity gain (0dB) for easier targeting
      const unityPos = gainToPos(1.0);
      if (Math.abs(newValue - unityPos) < 0.02) {
        newValue = unityPos;
      }
      
      // Update fader position
      trackData.faderPos = newValue;
      trackData.volume = posToGain(newValue);
      
      // Visual updates with smooth animation
      const topPercent = (1 - newValue) * 100;
      handle.style.top = `${topPercent}%`;
      hiddenInput.value = newValue;
      volumeDisplay.textContent = formatDb(trackData.volume);
      
      // Audio update
      if (trackData.gainNode) {
        trackData.gainNode.gain.setValueAtTime(trackData.volume, audioCtx.currentTime);
      }
      
      e.preventDefault();
    }

    function stopDrag() {
      if (!isDragging) return;
      isDragging = false;
      document.body.style.cursor = '';
      track.classList.remove('dragging');
    }

    // Mouse events
    track.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', doDrag);
    document.addEventListener('mouseup', stopDrag);
    
    // Touch events for mobile
    track.addEventListener('touchstart', startDrag, { passive: false });
    document.addEventListener('touchmove', doDrag, { passive: false });
    document.addEventListener('touchend', stopDrag);

    // Double-click to reset to unity
    track.addEventListener('dblclick', () => {
      const unityPos = gainToPos(1.0);
      trackData.faderPos = unityPos;
      trackData.volume = 1.0;
      handle.style.top = `${(1 - unityPos) * 100}%`;
      hiddenInput.value = unityPos;
      volumeDisplay.textContent = formatDb(1.0);
      if (trackData.gainNode) {
        trackData.gainNode.gain.setValueAtTime(1.0, audioCtx.currentTime);
      }
    });
  });

  // === EXISTING CONTROLS ===
  
  // Knob controls
  document.querySelectorAll('.knob-input').forEach(knob => {
    knob.addEventListener('input', (e) => {
      const trackIndex = parseInt(e.target.dataset.track);
      const param = e.target.dataset.param;
      const value = parseFloat(e.target.value);
      
      updateKnobVisualization(e.target, value);
      updateTrackParameter(trackIndex, param, value);
    });
  });
  
  // Volume faders
  document.querySelectorAll('.volume-fader').forEach(fader => {
    fader.addEventListener('input', (e) => {
      const trackIndex = parseInt(e.target.dataset.track);
      let pos = parseFloat(e.target.value); // 0..1 UI position
      // Detent snaps
      const unityPos = gainToPos(1.0);
      if (Math.abs(pos - unityPos) < 0.01) pos = unityPos; // snap near 0 dB
      if (pos < 0.01) pos = 0; // snap to mute

      const gain = posToGain(pos);
      tracks[trackIndex].faderPos = pos;
      tracks[trackIndex].volume = gain; // linear gain for node
      updateFaderVisualization(e.target, pos);
      updateTrackGainImmediate(trackIndex);
      // Update display
      const display = e.target.parentElement.parentElement.querySelector('.volume-display');
      if (display) display.textContent = formatDb(gain);
    });
    fader.addEventListener('change', (e) => {
      const trackIndex = parseInt(e.target.dataset.track);
      const pos = tracks[trackIndex].faderPos ?? parseFloat(e.target.value);
      const unityPos = gainToPos(1.0);
      if (pos === 0 || Math.abs(pos - unityPos) < 0.0001) {
        feedbackClick();
      }
      saveState();
    });
  });
  
  // Solo buttons
  document.querySelectorAll('.strip-btn.solo').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const trackIndex = parseInt(e.target.dataset.track);
      toggleTrackSolo(trackIndex);
      renderMixer(); // Re-render to update button states
    });
  });
  
  // Mute buttons
  document.querySelectorAll('.strip-btn.mute').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const trackIndex = parseInt(e.target.dataset.track);
      toggleTrackMute(trackIndex);
      renderMixer(); // Re-render to update button states
    });
  });

  // Record arm
  document.querySelectorAll('.strip-btn.record').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const trackIndex = parseInt(e.target.dataset.track);
      toggleTrackArm(trackIndex);
      renderMixer();
    });
  });

  // IO selects
  document.querySelectorAll('.io-input').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const trackIndex = parseInt(e.target.dataset.track);
      const which = e.target.dataset.io;
      if (trackIndex >= tracks.length) return;
      tracks[trackIndex].io[which] = e.target.value;
    });
  });

  // Insert slot click -> open FX picker
  document.querySelectorAll('.insert-slot').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const trackIndex = parseInt(e.currentTarget.dataset.track);
      const slotIndex = parseInt(e.currentTarget.dataset.slot);
      openFxPicker(trackIndex, slotIndex);
    });
  });



  // Sends
  document.querySelectorAll('.send-knob').forEach(input => {
    input.addEventListener('input', (e) => {
      const trackIndex = parseInt(e.target.dataset.track);
      const send = e.target.dataset.send;
      const val = parseFloat(e.target.value);
      if (trackIndex >= tracks.length) return;
      tracks[trackIndex].sends[send] = val;
    });
  });

  // Clip LED reset
  document.querySelectorAll('.clip-led').forEach(led => {
    led.addEventListener('click', () => {
      led.classList.remove('active');
    });
  });
}

function updateKnobVisualization(knobInput, value) {
  const knobSvg = knobInput.parentElement.querySelector('.knob-indicator');
  const min = parseFloat(knobInput.min);
  const max = parseFloat(knobInput.max);
  const normalizedValue = (value - min) / (max - min);
  const rotation = (normalizedValue * 270) - 135; // -135° to +135° range
  
  if (knobSvg) {
    // Check if this is the new 20px pan knob
    const svgElement = knobSvg.closest('svg');
    const centerX = svgElement && svgElement.getAttribute('viewBox') === '0 0 20 20' ? 10 : 24;
    const centerY = centerX;
    
    knobSvg.setAttribute('transform', `rotate(${rotation} ${centerX} ${centerY})`);
    
    // Update pan value display if this is a pan knob
    if (knobInput.dataset.param === 'pan') {
      const panDisplay = knobInput.parentElement.parentElement.querySelector('.text-\\[9px\\]');
      if (panDisplay) {
        const panValue = value / 100; // Convert back to -1 to 1 range
        const displayText = panValue === 0 ? 'C' : (panValue > 0 ? 'R' + Math.abs(panValue * 100).toFixed(0) : 'L' + Math.abs(panValue * 100).toFixed(0));
        panDisplay.textContent = displayText;
      }
      
      // Update tooltip
      knobInput.title = `Pan: ${value.toFixed(0)}%`;
    }
  }
}

function updateFaderVisualization(faderInput, pos) {
  const faderHandle = faderInput.parentElement.querySelector('.fader-handle');
  const volumeDisplay = faderInput.parentElement.parentElement.querySelector('.volume-display');
  
  if (faderHandle) {
  // Map pos (0..1) to top% such that 0 => 100% (bottom), 1 => 0% (top)
  const topPercent = (1 - pos) * 100;
  faderHandle.style.top = `${topPercent}%`;
  }
  
  if (volumeDisplay) {
  const gain = posToGain(pos);
  volumeDisplay.textContent = formatDb(gain);
  }
}

function updateTrackParameter(trackIndex, param, value) {
  if (trackIndex >= tracks.length) return;
  
  const track = tracks[trackIndex];
  
  switch (param) {
    case 'pan':
      track.pan = value / 100; // Convert back to -1 to 1 range
      updateTrackPanImmediate(trackIndex);
      break;
    case 'high':
    case 'mid':
    case 'low':
      // Store EQ values (would be used with actual audio processing)
      if (!track.eq) track.eq = {};
      track.eq[param] = value;
      break;
  }
  
  // Update arrangement view if needed
  if (currentView === 'arrangement') {
    render();
  }
}

// Level meter simulation (would be connected to real audio analysis)
function updateLevelMeters() {
  if (currentView !== 'mixer') return;
  
  const fills = document.querySelectorAll('.mixer-channel .meter-fill');
  fills.forEach((meter) => {
    // Simulate levels: higher when playing
    let level = Math.random() * (playing ? 95 : 20);
    meter.style.height = `${level}%`;
    const led = meter.closest('.mixer-channel').querySelector('.clip-led');
    if (level > 92 && led) led.classList.add('active');
  });
}

// Update level meters during playback
setInterval(updateLevelMeters, 100);

// Modify the existing render function to also update mixer when tracks change
const originalRender = render;
render = function() {
  originalRender();
  if (currentView === 'mixer') {
    renderMixer();
  }
};

// --- Keyboard Shortcuts (Enhanced) ---
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  // If settings modal is open, only handle Escape
  const settingsOpen = settingsOverlay && !settingsOverlay.classList.contains('hidden');
  if (settingsOpen && e.key !== 'Escape') return;
  
  switch (e.key) {
    case ' ':
      e.preventDefault();
      if (playing) pauseAll();
      else playAll();
      break;
    case '+':
    case '=':
      e.preventDefault();
      zoomInBtn.click();
      break;
    case '-':
    case '_':
      e.preventDefault();
      zoomOutBtn.click();
      break;
    case '?':
      if (e.shiftKey) {
        e.preventDefault();
        openSettings();
      }
      break;
    case 'r':
    case 'R':
      if (!isRecording) recordBtn.click();
      break;
    case 's':
    case 'S':
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        // Could add save project functionality here
      } else {
        stopBtn.click();
      }
      break;
    case 'Home':
      e.preventDefault();
      goToStartBtn.click();
      break;
    case 'ArrowLeft':
      e.preventDefault();
      skipBackBtn.click();
      break;
    case 'ArrowRight':
      e.preventDefault();
      skipForwardBtn.click();
      break;
    case 'z':
    case 'Z':
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      break;
    case 'Escape':
      if (settingsOpen) {
        e.preventDefault();
        closeSettings();
      }
      break;
    case 'c':
    case 'C':
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        copySelectedClip();
      }
      break;
    case 'v':
    case 'V':
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        pasteClip();
      }
      break;
    case 'Delete':
    case 'Backspace':
      if (selectedClip) {
        const {trackIndex, clipIndex} = selectedClip;
        if (!settings.confirmDelete || confirm('Delete this clip?')) {
          tracks[trackIndex].clips.splice(clipIndex, 1);
          selectedClip = null;
          saveState();
          render();
        }
      }
      break;
    case 'd':
    case 'D':
      if (selectedClip) {
        const {trackIndex, clipIndex} = selectedClip;
        duplicateClip(trackIndex, clipIndex);
      }
      break;
    case 'q':
    case 'Q':
      if (selectedClip) {
        quantizeSelectedClip();
      }
      break;
  }
});

// View button highlighting helper
function updateViewButtons(which) {
  const buttons = [
    { el: arrangeViewBtn, id: 'arrangement' },
    { el: mixerViewBtn, id: 'mixer' },
  { el: editorViewBtn, id: 'editor' },
  { el: fxViewBtn, id: 'fx' }
  ];
  buttons.forEach(({el, id}) => {
    if (!el) return;
    if (id === which) el.classList.add('active');
    else el.classList.remove('active');
  });
}

// Settings UI events
if (settingsBtn) settingsBtn.onclick = openSettings;
if (settingsClose) settingsClose.onclick = closeSettings;
if (settingsCancel) settingsCancel.onclick = closeSettings;
if (settingsOverlay) settingsOverlay.addEventListener('click', (e) => {
  if (e.target === settingsOverlay) closeSettings();
});
if (settingsDialog) settingsDialog.addEventListener('click', (e) => e.stopPropagation());
if (settingsSave) settingsSave.onclick = () => {
  settings.autoScroll = !!(setAutoScroll && setAutoScroll.checked);
  settings.snapToGrid = !!(setSnapToGrid && setSnapToGrid.checked);
  settings.showTriplets = !!(setTripletGuides && setTripletGuides.checked);
  settings.confirmDelete = !!(setConfirmDelete && setConfirmDelete.checked);
  autoScrollEnabled = settings.autoScroll;
  persistSettings();
  closeSettings();
  render();
};

// --- Insert Plugin Chain Management ---
function ensureTrackInsertChain(trackIndex) {
  if (!audioCtx) return null;
  const track = tracks[trackIndex];
  if (!track) return null;

  // If bypassed, clear chain and do not route through FX
  if (track.fxBypass) {
    // Disconnect any prior tail from the track gain
    const prev = trackInsertChains.get(trackIndex);
    if (prev && prev.outputNode) {
      try { prev.outputNode.disconnect(); } catch {}
    }
    const cleared = { chain: [], inputNode: null, outputNode: null };
    trackInsertChains.set(trackIndex, cleared);
    return null;
  }

  // Snapshot params from existing chain so we can rebuild safely
  const existing = trackInsertChains.get(trackIndex);
  const paramSnap = new Map(); // slotIndex -> { id, params }
  if (existing && existing.chain) {
    existing.chain.forEach(({ id, instance, slotIndex }) => {
      try {
        const params = instance?.api?.getParams ? instance.api.getParams() : undefined;
        if (params) paramSnap.set(slotIndex, { id, params });
      } catch {}
      // Ensure old tail isn't still connected downstream
      try { (instance.output || instance)?.disconnect && (instance.output || instance).disconnect(); } catch {}
    });
  }

  // Build fresh instances and wire them head->tail
  const chain = [];
  let head = null;
  let tail = null;
  (track.inserts || []).forEach((id, idx) => {
    if (!id) return;
    if (Array.isArray(track.insertEnabled) && track.insertEnabled[idx] === false) return;
    const def = window.FXPlugins && FXPlugins.get(id);
    if (!def) return;
    const inst = def.create(audioCtx);
    // Restore params if available
    const snap = paramSnap.get(idx);
    if (snap && snap.id === id && inst?.api?.setParam) {
      Object.entries(snap.params).forEach(([pid, val]) => {
        try { inst.api.setParam(pid, val); } catch {}
      });
    }
    const nodeIn = inst.input || inst;
    const nodeOut = inst.output || inst;
    if (!head) head = nodeIn;
    if (tail) { try { tail.connect(nodeIn); } catch {} }
    tail = nodeOut;
    chain.push({ id, instance: inst, slotIndex: idx });
  });

  const built = { chain, inputNode: head, outputNode: tail };
  trackInsertChains.set(trackIndex, built);

  // Always ensure the tail feeds the per-track gain node when present
  try {
    const trackGain = getTrackGainNode(trackIndex);
    if (tail && trackGain) {
      // Disconnect prior connection from the new tail (if any) then connect
      try { tail.disconnect(); } catch {}
      tail.connect(trackGain);
    }
  } catch {}

  return built;
}

// Alias for ensureTrackInsertChain (for compatibility)
function buildInsertChain(trackIndex) {
  return ensureTrackInsertChain(trackIndex);
}

// --- FX View / Plugin Picker ---
function renderFxView() {
  const fxView = document.getElementById('fxView');
  if (!fxView) return;
  // Determine selected slot
  const sel = fxSelected || fxPendingSelect;
  if (!sel) {
    fxView.innerHTML = '<div class="text-gray-400">Open FX from a mixer insert, or pick a track to manage its FX chain.</div>';
    return;
  }
  const { trackIndex, slotIndex } = sel;
  if (!fxSelected) fxSelected = { trackIndex, slotIndex };
  const track = tracks[trackIndex];
  const chainList = track.inserts.map((id, idx) => ({ idx, id, name: id ? (FXPlugins.get(id)?.name || id) : null, enabled: track.insertEnabled[idx] !== false }));

  // Build two-pane UI
  const selectedId = track.inserts[fxSelected.slotIndex];
  const showBrowser = !selectedId;
  const pluginParams = selectedId ? FXPlugins.getParams(selectedId) : [];
  const pluginName = selectedId ? (FXPlugins.get(selectedId)?.name || selectedId) : '';
  const searchBox = `<input id="fxSearch" type="text" placeholder="Search plugins..." class="w-full px-2 py-1 rounded bg-gray-700 border border-gray-600 text-sm text-gray-200" />`;

  fxView.innerHTML = `
    <div class="h-full grid grid-cols-12 gap-4">
      <div class="col-span-4 bg-gray-800 rounded border border-gray-700 p-3 flex flex-col">
        <div class="flex items-center justify-between mb-2">
          <div class="text-sm font-semibold text-gray-200">${track.label} FX Chain</div>
          <label class="text-xs text-gray-300 flex items-center gap-2"><input id="fxTrackBypass" type="checkbox" ${track.fxBypass?'checked':''}/> Bypass</label>
        </div>
        <div class="flex items-center gap-2 mb-2">
          <button id="fxAddPlugin" class="px-2 py-1 text-xs bg-orange-600 hover:bg-orange-500 rounded">Add</button>
          <div class="flex-1">${searchBox}</div>
        </div>
        <div id="fxChainList" class="flex-1 overflow-auto space-y-1">
          ${chainList.map(item => `
            <div class=\"fx-item flex items-center gap-2 p-2 rounded ${item.idx===fxSelected.slotIndex?'bg-gray-700':'bg-gray-900'} border border-gray-700\" data-index=\"${item.idx}\">
              <input type=\"checkbox\" class=\"fx-enable\" data-index=\"${item.idx}\" ${item.enabled?'checked':''} />
              <div class=\"flex-1 text-xs ${item.id? 'text-gray-100' : 'text-gray-500'}\">${item.name || '— Empty —'}</div>
              <div class=\"flex items-center gap-1\">
                <button class=\"fx-up px-1 text-xs bg-gray-700 rounded\" data-index=\"${item.idx}\">↑</button>
                <button class=\"fx-down px-1 text-xs bg-gray-700 rounded\" data-index=\"${item.idx}\">↓</button>
                <button class=\"fx-remove px-1 text-xs bg-red-700 rounded\" data-index=\"${item.idx}\">✕</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="col-span-8 bg-gray-800 rounded border border-gray-700 p-4">
        ${showBrowser ? `
          <div class=\"mb-3 text-sm text-gray-300\">Select a plugin for Insert ${fxSelected.slotIndex+1} on ${track.label}</div>
          <div id=\"fxBrowser\" class=\"grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4\"></div>
        ` : `
          <div class=\"flex items-center justify-between mb-3\">
            <div class=\"text-sm font-semibold text-orange-400\">${pluginName} — Insert ${fxSelected.slotIndex+1}</div>
            <div class=\"flex gap-2\">
              <button id=\"fxChangePlugin\" class=\"px-2 py-1 text-xs bg-gray-700 rounded\">Change</button>
            </div>
          </div>
          <div id=\"pluginUI\" class=\"plugin-ui-container\">
            ${pluginParams.map(pm => `
              <label class=\"block text-xs text-gray-300\">
                <span class=\"block mb-1\">${pm.name}</span>
                <input type=\"range\" class=\"w-full fx-param\" data-param=\"${pm.id}\" min=\"${pm.min}\" max=\"${pm.max}\" step=\"${pm.step}\" />
              </label>
            `).join('')}
          </div>
        `}
      </div>
    </div>
  `;

  // Wire chain list actions
  const listEl = document.getElementById('fxChainList');
  if (listEl) {
    listEl.querySelectorAll('.fx-item').forEach(row => {
      row.addEventListener('click', (e) => {
        const idx = parseInt(row.dataset.index);
        fxSelected = { trackIndex, slotIndex: idx };
        renderFxView();
      });
    });
    listEl.querySelectorAll('.fx-enable').forEach(cb => {
      cb.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(cb.dataset.index);
        track.insertEnabled[idx] = cb.checked;
        ensureTrackInsertChain(trackIndex);
      });
    });
    listEl.querySelectorAll('.fx-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index);
        track.inserts[idx] = null;
        track.insertEnabled[idx] = true;
        ensureTrackInsertChain(trackIndex);
        renderFxView();
        renderMixer();
      });
    });
    listEl.querySelectorAll('.fx-up').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index);
        if (idx <= 0) return;
        // swap with previous
        const tmpId = track.inserts[idx-1];
        const tmpEn = track.insertEnabled[idx-1];
        track.inserts[idx-1] = track.inserts[idx];
        track.insertEnabled[idx-1] = track.insertEnabled[idx];
        track.inserts[idx] = tmpId;
        track.insertEnabled[idx] = tmpEn;
        fxSelected = { trackIndex, slotIndex: idx-1 };
        ensureTrackInsertChain(trackIndex);
        renderFxView();
        renderMixer();
      });
    });
    listEl.querySelectorAll('.fx-down').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index);
        if (idx >= track.inserts.length - 1) return;
        const tmpId = track.inserts[idx+1];
        const tmpEn = track.insertEnabled[idx+1];
        track.inserts[idx+1] = track.inserts[idx];
        track.insertEnabled[idx+1] = track.insertEnabled[idx];
        track.inserts[idx] = tmpId;
        track.insertEnabled[idx] = tmpEn;
        fxSelected = { trackIndex, slotIndex: idx+1 };
        ensureTrackInsertChain(trackIndex);
        renderFxView();
        renderMixer();
      });
    });
  }

  // Track bypass
  const trackBypass = document.getElementById('fxTrackBypass');
  if (trackBypass) trackBypass.onchange = () => { track.fxBypass = trackBypass.checked; ensureTrackInsertChain(trackIndex); };

  // Add plugin or search
  const addBtn = document.getElementById('fxAddPlugin');
  const searchEl = document.getElementById('fxSearch');
  const updateBrowser = () => {
    const q = (searchEl?.value || '').toLowerCase();
    const list = (window.FXPlugins ? FXPlugins.list() : []);
    const matches = list.filter(p => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
    const grid = document.getElementById('fxBrowser');
    if (grid) {
      grid.innerHTML = matches.map(p=>`
        <div class=\"p-4 rounded-lg border border-gray-700 bg-gray-900 shadow\">
          <div class=\"text-base font-semibold text-white\">${p.name}</div>
          <div class=\"text-xs text-gray-400 mb-2\">${p.description || ''}</div>
          <button class=\"px-2 py-1 text-xs bg-orange-600 hover:bg-orange-500 rounded add-plugin\" data-plugin=\"${p.id}\">Add</button>
        </div>
      `).join('');
      grid.querySelectorAll('.add-plugin').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.plugin;
          track.inserts[fxSelected.slotIndex] = id;
          track.insertEnabled[fxSelected.slotIndex] = true;
          ensureTrackInsertChain(trackIndex);
          renderFxView();
          renderMixer();
        });
      });
    }
  };
  if (addBtn) addBtn.onclick = () => { track.inserts[fxSelected.slotIndex] = null; renderFxView(); };
  if (searchEl) searchEl.oninput = () => updateBrowser();
  updateBrowser();

  // Plugin params for selected
  if (!showBrowser) {
    const chain = ensureTrackInsertChain(trackIndex);
    const instEntry = chain && chain.chain.find(c => c.slotIndex === fxSelected.slotIndex);
    
    // Check if plugin has custom UI
    const pluginDef = selectedId ? FX_PLUGINS[selectedId] : null;
    const hasCustomUI = pluginDef && pluginDef.customUI && pluginDef.renderUI;
    
    if (hasCustomUI) {
      // Use custom UI renderer with resizable functionality
      try {
        if (typeof renderResizablePluginUI === 'function') {
          renderResizablePluginUI(selectedId, 'pluginUI', instEntry?.instance, pluginDef.renderUI);
        } else {
          // Fallback to regular rendering
          pluginDef.renderUI('pluginUI', instEntry?.instance);
          // Make it resizable after rendering
          setTimeout(() => {
            if (typeof makePluginUIResizable === 'function') {
              makePluginUIResizable('pluginUI');
            }
          }, 100);
        }
      } catch (err) {
        console.error('Error rendering custom UI:', err);
        // Fall back to default sliders
        setupDefaultSliders();
      }
    } else {
      // Use default slider interface
      setupDefaultSliders();
    }
    
    function setupDefaultSliders() {
      const pluginUIContainer = document.getElementById('pluginUI');
      if (pluginUIContainer && !hasCustomUI) {
        pluginUIContainer.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4';
      }
      
      document.querySelectorAll('.fx-param').forEach(input => {
        const id = input.dataset.param;
        const val = instEntry?.instance?.api?.getParam ? instEntry.instance.api.getParam(id) : undefined;
        if (typeof val !== 'undefined') input.value = val;
        input.addEventListener('input', (e) => {
          const v = parseFloat(e.target.value);
          if (instEntry?.instance?.api?.setParam) instEntry.instance.api.setParam(id, v);
        });
      });
    }
    
    const changeBtn = document.getElementById('fxChangePlugin');
    if (changeBtn) changeBtn.onclick = () => { track.inserts[fxSelected.slotIndex] = null; renderFxView(); };
  }
}

function openFxPicker(trackIndex, slotIndex) {
  fxPendingSelect = { trackIndex, slotIndex };
  fxSelected = { trackIndex, slotIndex };
  showFxView();
}

// --- Audio Editor Functions ---

/**
 * Opens the audio editor view for the specified clip
 * @param {number} trackIndex - Index of the track containing the clip
 * @param {number} clipIndex - Index of the clip within the track
 * @param {Object} clip - The clip object to edit
 */
function openAudioEditor(trackIndex, clipIndex, clip) {
  if (!clip || !clip.audioBuffer) {
    console.error('Cannot open editor: clip or audioBuffer missing');
    return;
  }

  // Store current editing context
  currentEditingClip = clip;
  currentEditingTrackIndex = trackIndex;
  currentEditingClipIndex = clipIndex;

  // Update clip information in editor header
  editorClipName.textContent = clip.name;
  editorClipDetails.textContent = `Duration: ${clip.duration.toFixed(2)}s | Sample Rate: ${clip.audioBuffer.sampleRate}Hz | Channels: ${clip.audioBuffer.numberOfChannels}`;

  // Show the audio editor view
  showAudioEditorView();

  // Initialize the editor with the clip data
  initializeAudioEditor().catch(error => {
    console.error('Failed to initialize audio editor:', error);
  });

  console.log('Opened audio editor for clip:', clip.name);
}

/**
 * Shows the audio editor view and hides other views
 */
function showAudioEditorView() {
  currentView = 'editor';
  
  // Hide other windows
  arrangementWindow.classList.add('hidden');
  arrangementWindow.classList.remove('active');
  mixerWindow.classList.add('hidden');
  mixerWindow.classList.remove('active');
  if (fxOverlay) { fxOverlay.classList.add('hidden'); }
  
  // Show editor window
  editorWindow.classList.remove('hidden');
  editorWindow.classList.add('active');
  updateViewButtons('editor');
  
  // Show the editor view button if it was hidden
  editorViewBtn.classList.remove('hidden');
}

/**
 * Returns to the arrangement view from the audio editor
 */
function returnToArrangementView() {
  // Apply any pending changes to the clip
  applyEditorChanges();
  
  // Clean up automation controls
  cleanupAutomationControls();
  
  // Clear editor state
  currentEditingClip = null;
  currentEditingTrackIndex = -1;
  currentEditingClipIndex = -1;
  
  // Show arrangement view
  showArrangementView();
  
  // Hide the editor view button
  editorViewBtn.classList.add('hidden');
  
  // Re-render to reflect any changes
  render();
  
  console.log('Returned to arrangement view');
}

function cleanupAutomationControls() {
  // Remove automation overlay
  const autoOverlay = document.getElementById('editorAutomationOverlay');
  if (autoOverlay) autoOverlay.remove();
  
  // Remove automation controls section
  const automationSection = document.getElementById('volumeAutomationSection');
  if (automationSection) automationSection.remove();
  
  // Reset toolbar button state
  const automationBtn = document.getElementById('editorAutomationBtn');
  if (automationBtn) {
    automationBtn.classList.remove('bg-orange-600', 'border-orange-500', 'text-white');
    automationBtn.classList.add('bg-gray-700', 'border-gray-500', 'text-gray-300');
  }
}

/**
 * Initializes the audio editor with the current clip's data
 */
async function initializeAudioEditor() {
  if (!currentEditingClip || !currentEditingClip.audioBuffer) return;

  const clip = currentEditingClip;
  const buffer = clip.audioBuffer;

  // Reset editor state
  editorZoomLevel = 1;
  editorPixelsPerSecond = 200;
  editorSelectionStart = 0;
  editorSelectionEnd = 0;
  editorPlayheadPosition = 0;

  // Update clip property inputs
  document.getElementById('editorClipStart').value = clip.startTime.toFixed(2);
  document.getElementById('editorClipLength').value = clip.duration.toFixed(2);
  document.getElementById('editorClipOffset').value = clip.offset.toFixed(2);
  
  // Initialize Tone.js if needed
  await initializeToneJS();

  // Draw the waveform
  drawEditorWaveform();

  // Draw the timeline
  drawEditorTimeline();

  // Set up canvas event listeners for selection
  setupEditorCanvasEvents();

  // Initialize enhanced automation system
  initializeClipAutomation();
  
  // Initialize pitch shifting system
  initializePhazeSystem().then(() => {
    console.log('Phaze system ready');
  }).catch(error => {
    console.warn('Phaze system initialization failed:', error);
  });
  initializeAudioSelection();
  initializePitchShiftDialog();
  
  // Update automation button states and controls
  updateAutomationButtonState();
  updateCurveModeButtonState();
  updateVolumeRangeVisibility();
  updateVolumeRangeValues();

  console.log('Initialized audio editor for clip:', clip.name);
}

/**
 * Draws the detailed waveform in the editor canvas
 */
function drawEditorWaveform() {
  if (!currentEditingClip || !currentEditingClip.audioBuffer) return;

  const canvas = editorWaveformCanvas;
  const ctx = canvas.getContext('2d');
  const buffer = currentEditingClip.audioBuffer;
  
  // Set canvas size to match container
  const container = canvas.parentElement;
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw background
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Get audio data
  const channelData = buffer.getChannelData(0);
  const samplesPerPixel = Math.max(1, Math.floor(channelData.length / canvas.width));

  // Draw waveform
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 1;
  ctx.beginPath();

  for (let x = 0; x < canvas.width; x++) {
    const startSample = Math.floor(x * samplesPerPixel);
    const endSample = Math.min(startSample + samplesPerPixel, channelData.length);
    
    let min = 1.0;
    let max = -1.0;
    
    for (let i = startSample; i < endSample; i++) {
      const sample = channelData[i];
      min = Math.min(min, sample);
      max = Math.max(max, sample);
    }
    
    const y1 = ((1 - max) / 2) * canvas.height;
    const y2 = ((1 - min) / 2) * canvas.height;
    
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2);
  }
  
  ctx.stroke();

  // Draw center line
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, canvas.height / 2);
  ctx.lineTo(canvas.width, canvas.height / 2);
  ctx.stroke();
}

/**
 * Draws the timeline below the waveform
 */
function drawEditorTimeline() {
  if (!currentEditingClip) return;

  const timeline = editorTimeline;
  timeline.innerHTML = '';
  
  const duration = currentEditingClip.duration;
  const timelineWidth = timeline.clientWidth;
  const pixelsPerSecond = timelineWidth / duration;
  
  // Create time markers
  const interval = duration > 10 ? 1 : duration > 5 ? 0.5 : 0.1;
  
  for (let time = 0; time <= duration; time += interval) {
    const x = (time / duration) * timelineWidth;
    
    const marker = document.createElement('div');
    marker.className = 'timeline-marker';
    marker.style.position = 'absolute';
    marker.style.left = x + 'px';
    marker.style.top = '0';
    marker.style.width = '1px';
    marker.style.height = '100%';
    marker.style.backgroundColor = '#6b7280';
    
    const label = document.createElement('span');
    label.className = 'timeline-label';
    label.style.position = 'absolute';
    label.style.left = (x + 2) + 'px';
    label.style.top = '2px';
    label.style.fontSize = '10px';
    label.style.color = '#9ca3af';
    label.textContent = time.toFixed(1) + 's';
    
    timeline.appendChild(marker);
    timeline.appendChild(label);
  }
}

/**
 * Sets up mouse event listeners for the editor canvas
 */
function setupEditorCanvasEvents() {
  const canvas = editorWaveformCanvas;
  let isMouseDown = false;
  let startX = 0;

  canvas.addEventListener('mousedown', (e) => {
    isMouseDown = true;
    editorIsSelecting = true;
    const rect = canvas.getBoundingClientRect();
    startX = e.clientX - rect.left;
    
    // Convert pixel position to time
    const duration = currentEditingClip.duration;
    const timePosition = (startX / canvas.width) * duration;
    
    editorSelectionStart = timePosition;
    editorSelectionEnd = timePosition;
    
    updateEditorSelection();
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!isMouseDown || !editorIsSelecting) return;
    
    const rect = canvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    
    // Convert pixel position to time
    const duration = currentEditingClip.duration;
    const timePosition = (currentX / canvas.width) * duration;
    
    editorSelectionEnd = timePosition;
    updateEditorSelection();
  });

  canvas.addEventListener('mouseup', () => {
    isMouseDown = false;
    editorIsSelecting = false;
    
    // Ensure selection start is less than end
    if (editorSelectionStart > editorSelectionEnd) {
      const temp = editorSelectionStart;
      editorSelectionStart = editorSelectionEnd;
      editorSelectionEnd = temp;
    }
  });

  // Click to set playhead position
  canvas.addEventListener('click', (e) => {
    if (editorIsSelecting) return;
    
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    
    // Convert pixel position to time
    const duration = currentEditingClip.duration;
    editorPlayheadPosition = (clickX / canvas.width) * duration;
    
    updateEditorPlayhead();
  });
}

/**
 * Updates the visual selection overlay in the editor
 */
function updateEditorSelection() {
  if (!currentEditingClip) return;
  
  const canvas = editorWaveformCanvas;
  const selection = editorSelection;
  const duration = currentEditingClip.duration;
  
  if (Math.abs(editorSelectionEnd - editorSelectionStart) > 0.001) {
    const startPercent = (editorSelectionStart / duration) * 100;
    const widthPercent = ((editorSelectionEnd - editorSelectionStart) / duration) * 100;
    
    selection.style.left = startPercent + '%';
    selection.style.width = widthPercent + '%';
    selection.classList.remove('hidden');
  } else {
    selection.classList.add('hidden');
  }
}

/**
 * Updates the visual playhead position in the editor
 */
function updateEditorPlayhead() {
  if (!currentEditingClip) return;
  
  const playhead = editorPlayhead;
  const duration = currentEditingClip.duration;
  const positionPercent = (editorPlayheadPosition / duration) * 100;
  
  playhead.style.left = positionPercent + '%';
  playhead.classList.remove('hidden');
}

/**
 * Applies any changes made in the editor back to the original clip
 */
function applyEditorChanges() {
  if (!currentEditingClip || currentEditingTrackIndex === -1 || currentEditingClipIndex === -1) return;

  // Get updated values from input fields
  const newStart = parseFloat(document.getElementById('editorClipStart').value) || currentEditingClip.startTime;
  const newLength = parseFloat(document.getElementById('editorClipLength').value) || currentEditingClip.duration;
  const newOffset = parseFloat(document.getElementById('editorClipOffset').value) || currentEditingClip.offset;

  // Apply changes to the clip
  currentEditingClip.startTime = newStart;
  currentEditingClip.duration = Math.max(0.1, newLength);
  currentEditingClip.offset = Math.max(0, newOffset);

  // Save state for undo
  saveState();

  console.log('Applied editor changes to clip:', currentEditingClip.name);
}

// --- Audio Editor Event Listeners ---

// Back button to return to arrangement view
if (backButton) {
  backButton.onclick = returnToArrangementView;
}

// Editor view button
if (editorViewBtn) {
  editorViewBtn.onclick = () => {
    if (currentEditingClip) {
      showAudioEditorView();
    }
  };
}

// Editor tool buttons - Add this to the existing DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', () => {
  // Zoom controls
  const editorAutomationBtn = document.getElementById('editorAutomationBtn');
  const editorZoomFit = document.getElementById('editorZoomFit');
  const editorZoomIn = document.getElementById('editorZoomIn');
  const editorZoomOut = document.getElementById('editorZoomOut');
  
  // Enhanced automation controls
  if (editorAutomationBtn) {
    editorAutomationBtn.onclick = () => {
      if (currentEditingClip) {
        toggleClipAutomation();
      }
    };
  }
  
  // Automation type dropdown
  const editorAutomationType = document.getElementById('editorAutomationType');
  if (editorAutomationType) {
    editorAutomationType.onchange = () => {
      currentAutomationType = editorAutomationType.value;
      updateAutomationControlsContent();
      updateAutomationButtonState();
      updateCurveModeButtonState();
      updateVolumeRangeVisibility();
      updateVolumeRangeValues();
      renderClipAutomation();
    };
  }
  
  // Curve mode toggle
  const editorCurveModeBtn = document.getElementById('editorCurveModeBtn');
  if (editorCurveModeBtn) {
    editorCurveModeBtn.onclick = () => {
      if (currentEditingClip) {
        toggleCurveMode();
      }
    };
  }
  
  // Volume range controls
  const volumeMinRange = document.getElementById('volumeMinRange');
  const volumeMaxRange = document.getElementById('volumeMaxRange');
  
  if (volumeMinRange) {
    volumeMinRange.onchange = () => {
      if (currentEditingClip) {
        const minVal = parseInt(volumeMinRange.value);
        const maxVal = parseInt(volumeMaxRange.value);
        if (minVal < maxVal) {
          currentEditingClip.automation.volume.minRange = minVal;
          renderClipAutomation();
        } else {
          volumeMinRange.value = currentEditingClip.automation.volume.minRange;
        }
      }
    };
  }
  
  if (volumeMaxRange) {
    volumeMaxRange.onchange = () => {
      if (currentEditingClip) {
        const minVal = parseInt(volumeMinRange.value);
        const maxVal = parseInt(volumeMaxRange.value);
        if (maxVal > minVal) {
          currentEditingClip.automation.volume.maxRange = maxVal;
          renderClipAutomation();
        } else {
          volumeMaxRange.value = currentEditingClip.automation.volume.maxRange;
        }
      }
    };
  }
  
  if (editorZoomFit) {
    editorZoomFit.onclick = () => {
      editorZoomLevel = 1;
      drawEditorWaveform();
    };
  }
  
  if (editorZoomIn) {
    editorZoomIn.onclick = () => {
      editorZoomLevel = Math.min(editorZoomLevel * 1.5, 10);
      drawEditorWaveform();
    };
  }
  
  if (editorZoomOut) {
    editorZoomOut.onclick = () => {
      editorZoomLevel = Math.max(editorZoomLevel / 1.5, 0.1);
      drawEditorWaveform();
    };
  }

  // Processing buttons
  const editorNormalize = document.getElementById('editorNormalize');
  const editorReverse = document.getElementById('editorReverse');
  const editorFadeIn = document.getElementById('editorFadeIn');
  const editorFadeOut = document.getElementById('editorFadeOut');
  
  if (editorNormalize) {
    editorNormalize.onclick = () => {
      if (currentEditingClip) {
        normalizeClip(currentEditingTrackIndex, currentEditingClipIndex);
        drawEditorWaveform();
      }
    };
  }
  
  if (editorReverse) {
    editorReverse.onclick = () => {
      if (currentEditingClip) {
        reverseClip(currentEditingTrackIndex, currentEditingClipIndex);
        drawEditorWaveform();
      }
    };
  }
  
  if (editorFadeIn) {
    editorFadeIn.onclick = () => {
      if (currentEditingClip) {
        fadeInClip(currentEditingTrackIndex, currentEditingClipIndex);
        drawEditorWaveform();
      }
    };
  }
  
  if (editorFadeOut) {
    editorFadeOut.onclick = () => {
      if (currentEditingClip) {
        fadeOutClip(currentEditingTrackIndex, currentEditingClipIndex);
        drawEditorWaveform();
      }
    };
  }

  // Selection tools
  const editorSelectAll = document.getElementById('editorSelectAll');
  const editorClearSelection = document.getElementById('editorClearSelection');
  
  if (editorSelectAll) {
    editorSelectAll.onclick = () => {
      if (currentEditingClip) {
        editorSelectionStart = 0;
        editorSelectionEnd = currentEditingClip.duration;
        updateEditorSelection();
      }
    };
  }
  
  if (editorClearSelection) {
    editorClearSelection.onclick = () => {
      editorSelectionStart = 0;
      editorSelectionEnd = 0;
      updateEditorSelection();
    };
  }

  // Property input change handlers
  const clipStartInput = document.getElementById('editorClipStart');
  const clipLengthInput = document.getElementById('editorClipLength');
  const clipOffsetInput = document.getElementById('editorClipOffset');
  
  if (clipStartInput) {
    clipStartInput.onchange = () => applyEditorChanges();
  }
  
  if (clipLengthInput) {
    clipLengthInput.onchange = () => applyEditorChanges();
  }
  
  if (clipOffsetInput) {
    clipOffsetInput.onchange = () => applyEditorChanges();
  }
});

// Handle window resize for the editor canvas
window.addEventListener('resize', () => {
  if (currentView === 'editor' && currentEditingClip) {
    setTimeout(() => {
      drawEditorWaveform();
      drawEditorTimeline();
    }, 100);
  }
});

// Update the existing window management functions to include editor view
function showArrangementView() {
  currentView = 'arrangement';
  arrangementWindow.classList.remove('hidden');
  arrangementWindow.classList.add('active');
  mixerWindow.classList.add('hidden');
  mixerWindow.classList.remove('active');
  if (fxOverlay) { fxOverlay.classList.add('hidden'); }
  editorWindow.classList.add('hidden');
  editorWindow.classList.remove('active');
  
  arrangeViewBtn.classList.add('bg-orange-500', 'text-black');
  arrangeViewBtn.classList.remove('bg-gray-600', 'text-white');
  mixerViewBtn.classList.add('bg-gray-600', 'text-white');
  mixerViewBtn.classList.remove('bg-orange-500', 'text-black');
  editorViewBtn.classList.add('bg-gray-600', 'text-white');
  editorViewBtn.classList.remove('bg-orange-500', 'text-black');
}

function showMixerView() {
  currentView = 'mixer';
  mixerWindow.classList.remove('hidden');
  mixerWindow.classList.add('active');
  arrangementWindow.classList.add('hidden');
  arrangementWindow.classList.remove('active');
  if (fxOverlay) { fxOverlay.classList.add('hidden'); }
  editorWindow.classList.add('hidden');
  editorWindow.classList.remove('active');
  
  mixerViewBtn.classList.add('bg-orange-500', 'text-black');
  mixerViewBtn.classList.remove('bg-gray-600', 'text-white');
  arrangeViewBtn.classList.add('bg-gray-600', 'text-white');
  arrangeViewBtn.classList.remove('bg-orange-500', 'text-black');
  editorViewBtn.classList.add('bg-gray-600', 'text-white');
  editorViewBtn.classList.remove('bg-orange-500', 'text-black');
  
  renderMixer();
}

// --- Plugin Strip (Ableton Style) ---
let pluginStripCollapsed = false;
let activePluginBrowser = null;

function initializePluginStrip() {
  const header = document.querySelector('.plugin-strip-header');
  const strip = document.querySelector('.plugin-strip');
  const collapseBtn = document.getElementById('togglePluginStrip');
  const addBtn = document.getElementById('addPluginBtn');
  
  // Collapse/expand functionality
  if (collapseBtn) {
    collapseBtn.addEventListener('click', () => {
      pluginStripCollapsed = !pluginStripCollapsed;
      strip.classList.toggle('collapsed', pluginStripCollapsed);
      // Update the SVG rotation instead of text
      const svg = collapseBtn.querySelector('svg');
      if (svg) {
        svg.style.transform = pluginStripCollapsed ? 'rotate(180deg)' : 'rotate(0deg)';
        svg.style.transition = 'transform 0.2s ease';
      }
    });
  }
  
  // Add plugin functionality
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      showPluginBrowser();
    });
  }
  
  // Update plugin strip when track selection changes
  updatePluginStrip();
}

function updatePluginStrip() {
  const trackNameEl = document.getElementById('currentTrackName');
  const contentEl = document.querySelector('.plugin-strip-content');
  
  if (!trackNameEl || !contentEl) return;
  
  const selectedTrack = tracks[selectedTrackIndex];
  if (!selectedTrack) {
    trackNameEl.textContent = 'No Track Selected';
    contentEl.innerHTML = '<div class="plugin-strip-empty">No track selected</div>';
    return;
  }
  
  trackNameEl.textContent = selectedTrack.label || `${selectedTrackIndex + 1}`;
  
  // Render plugin chain
  const pluginChain = document.createElement('div');
  pluginChain.className = 'plugin-chain';
  
  // Render existing plugins
  selectedTrack.inserts.forEach((pluginId, slotIndex) => {
    const pluginSlot = createPluginSlot(pluginId, slotIndex, selectedTrackIndex);
    pluginChain.appendChild(pluginSlot);
  });
  
  // Add empty slot for adding new plugins
  const addSlot = document.createElement('div');
  addSlot.className = 'plugin-add-slot';
  addSlot.innerHTML = '<span>+ Add Plugin</span>';
  addSlot.addEventListener('click', () => {
    showPluginBrowser(selectedTrackIndex, selectedTrack.inserts.length);
  });
  pluginChain.appendChild(addSlot);
  
  contentEl.innerHTML = '';
  contentEl.appendChild(pluginChain);
}

function createPluginSlot(pluginId, slotIndex, trackIndex) {
  const slot = document.createElement('div');
  slot.className = 'plugin-slot';
  
  if (pluginId) {
    const plugin = window.FXPlugins ? FXPlugins.get(pluginId) : null;
    const pluginName = plugin ? plugin.name : pluginId;
    const track = tracks[trackIndex];
    const isEnabled = track.insertEnabled[slotIndex] !== false;
    const isBypassed = !isEnabled;
    
    // Simple square with plugin name only - Ableton style
    slot.innerHTML = `
      <div class="plugin-square ${isBypassed ? 'bypassed' : ''}">
        <span class="plugin-name" title="${pluginName}">${pluginName}</span>
        <div class="plugin-square-controls">
          <button class="plugin-square-btn bypass ${isBypassed ? 'active' : ''}" 
                  title="Bypass" data-track="${trackIndex}" data-slot="${slotIndex}">B</button>
          <button class="plugin-square-btn remove" 
                  title="Remove" data-track="${trackIndex}" data-slot="${slotIndex}">×</button>
        </div>
      </div>
    `;
    
    // Add event listeners
    const bypassBtn = slot.querySelector('.bypass');
    const removeBtn = slot.querySelector('.remove');
    const pluginSquare = slot.querySelector('.plugin-square');
    
    // Main click opens plugin dialog (not inline parameters)
    pluginSquare.addEventListener('click', (e) => {
      if (!e.target.classList.contains('plugin-square-btn')) {
        openPluginDialog(pluginId, trackIndex, slotIndex);
      }
    });
    
    if (bypassBtn) {
      bypassBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePluginBypass(trackIndex, slotIndex);
      });
    }
    
    if (removeBtn) {
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removePlugin(trackIndex, slotIndex);
      });
    }
  } else {
    // Empty slot - Ableton style square
    slot.innerHTML = `
      <div class="plugin-square empty">
        <span class="plugin-name" style="color: #777; font-style: italic;">Empty</span>
      </div>
    `;
    
    slot.addEventListener('click', () => {
      showPluginBrowser(trackIndex, slotIndex);
    });
  }
  
  return slot;
}

function renderPluginParameters(pluginId, trackIndex, slotIndex) {
  if (!window.FXPlugins) return '<div>No plugin system available</div>';
  
  const plugin = FXPlugins.get(pluginId);
  if (!plugin) return '<div>Plugin not found</div>';
  
  const params = FXPlugins.getParams(pluginId);
  if (!params || params.length === 0) {
    return '<div style="text-align: center; color: #777; padding: 20px;">No parameters</div>';
  }
  
  let html = '';
  params.forEach((param, paramIndex) => {
    const value = FXPlugins.getParamValue(trackIndex, slotIndex, param.id) || param.min || 0;
    const displayValue = typeof value === 'number' ? value.toFixed(2) : value;
    
    html += `
      <div class="plugin-param-control">
        <span class="plugin-param-name">${param.name}</span>
        <input type="range" 
               class="plugin-param-slider" 
               min="${param.min || 0}" 
               max="${param.max || 1}" 
               step="${param.step || 0.01}" 
               value="${value}"
               data-plugin="${pluginId}"
               data-param="${param.id}"
               data-track="${trackIndex}"
               data-slot="${slotIndex}">
        <span class="plugin-param-value">${displayValue}</span>
      </div>
    `;
  });
  
  return html;
}

function showPluginBrowser(trackIndex = null, slotIndex = null) {
  if (activePluginBrowser) {
    closePluginBrowser();
    return;
  }
  
  // Use selected track if no track specified
  if (trackIndex === null) trackIndex = selectedTrackIndex;
  if (slotIndex === null) {
    // Find first empty slot or add new one
    const track = tracks[trackIndex];
    slotIndex = track.inserts.findIndex(slot => slot === null);
    if (slotIndex === -1) {
      slotIndex = track.inserts.length;
      track.inserts.push(null);
      track.insertEnabled.push(true);
    }
  }
  
  const overlay = document.createElement('div');
  overlay.className = 'plugin-browser-overlay';
  
  const browser = document.createElement('div');
  browser.className = 'plugin-browser';
  
  browser.innerHTML = `
    <div class="plugin-browser-header">
      <span class="plugin-browser-title">Add Plugin</span>
      <button class="plugin-browser-close">×</button>
    </div>
    <div class="plugin-browser-content">
      ${renderPluginBrowserContent()}
    </div>
  `;
  
  overlay.appendChild(browser);
  document.body.appendChild(overlay);
  
  activePluginBrowser = { overlay, browser, trackIndex, slotIndex };
  
  // Add event listeners
  const closeBtn = browser.querySelector('.plugin-browser-close');
  closeBtn.addEventListener('click', closePluginBrowser);
  
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closePluginBrowser();
  });
  
  // Add click listeners to plugin items
  browser.querySelectorAll('.plugin-browser-item').forEach(item => {
    item.addEventListener('click', () => {
      const pluginId = item.dataset.pluginId;
      addPluginToTrack(trackIndex, slotIndex, pluginId);
      closePluginBrowser();
    });
  });
}

function renderPluginBrowserContent() {
  if (!window.FXPlugins) {
    return '<div style="padding: 20px; text-align: center; color: #777;">No plugins available</div>';
  }
  
  const plugins = FXPlugins.list();
  if (!plugins || plugins.length === 0) {
    return '<div style="padding: 20px; text-align: center; color: #777;">No plugins found</div>';
  }
  
  return plugins.map(plugin => `
    <div class="plugin-browser-item" data-plugin-id="${plugin.id}">
      <div class="plugin-browser-item-name">${plugin.name}</div>
      <div class="plugin-browser-item-desc">${plugin.description || 'Audio Effect'}</div>
    </div>
  `).join('');
}

function closePluginBrowser() {
  if (activePluginBrowser) {
    document.body.removeChild(activePluginBrowser.overlay);
    activePluginBrowser = null;
  }
}

function addPluginToTrack(trackIndex, slotIndex, pluginId) {
  const track = tracks[trackIndex];
  
  // Ensure inserts array is long enough
  while (track.inserts.length <= slotIndex) {
    track.inserts.push(null);
    track.insertEnabled.push(true);
  }
  
  track.inserts[slotIndex] = pluginId;
  track.insertEnabled[slotIndex] = true;
  
  // Rebuild the insert chain to create the plugin instance
  buildInsertChain(trackIndex);
  
  updatePluginStrip();
  render(); // Update main DAW view
}

function removePlugin(trackIndex, slotIndex) {
  const track = tracks[trackIndex];
  track.inserts[slotIndex] = null;
  track.insertEnabled[slotIndex] = true;
  
  // Rebuild the insert chain to remove the plugin instance
  buildInsertChain(trackIndex);
  
  updatePluginStrip();
  render();
}

function togglePluginBypass(trackIndex, slotIndex) {
  const track = tracks[trackIndex];
  track.insertEnabled[slotIndex] = !track.insertEnabled[slotIndex];
  
  // Rebuild the insert chain to apply bypass
  buildInsertChain(trackIndex);
  
  updatePluginStrip();
  render();
}

function openPluginDialog(pluginId, trackIndex, slotIndex) {
  // Set the selected plugin for the FX system
  window.fxSelected = { trackIndex, slotIndex };
  
  // Open the FX overlay with the plugin parameters
  if (fxOverlay) {
    fxOverlay.classList.remove('hidden');
    renderFxView();
  } else {
    // Fallback if FX overlay not available
    console.warn('FX overlay not available');
  }
}

function expandPluginUI(pluginId, trackIndex, slotIndex) {
  // Redirect to the new dialog system
  openPluginDialog(pluginId, trackIndex, slotIndex);
}

// Add parameter change handling
document.addEventListener('input', (e) => {
  if (e.target.classList.contains('plugin-param-slider')) {
    const pluginId = e.target.dataset.plugin;
    const paramId = e.target.dataset.param;
    const trackIndex = parseInt(e.target.dataset.track);
    const slotIndex = parseInt(e.target.dataset.slot);
    const value = parseFloat(e.target.value);
    
    // Update parameter value
    if (window.FXPlugins && FXPlugins.setParam) {
      FXPlugins.setParam(trackIndex, slotIndex, paramId, value);
    }
    
    // Update display value
    const valueDisplay = e.target.nextElementSibling;
    if (valueDisplay) {
      valueDisplay.textContent = value.toFixed(2);
    }
  }
});

// =============================================================================
// PHAZE PITCH SHIFTING SYSTEM
// =============================================================================

// Global state for pitch shifting
let currentAudioSelection = null;
let pitchShiftPreviewPlayer = null;
let phazeProcessor = null;

// Audio selection state
let audioSelectionStart = null;
let audioSelectionEnd = null;
let audioSelectionActive = false;

// Initialize Phaze pitch shifting system
async function initializePhazeSystem() {
  if (!audioCtx) {
    initAudioContext();
  }
  
  // Initialize Phaze AudioWorklet if available
  if (audioCtx.audioWorklet) {
    try {
      await audioCtx.audioWorklet.addModule('./phase-vocoder.js');
      console.log('Phaze AudioWorklet loaded successfully');
      return true;
    } catch (error) {
      console.warn('Failed to load Phaze AudioWorklet:', error);
      return false;
    }
  } else {
    console.warn('AudioWorklet not supported in this browser');
    return false;
  }
}

// Audio selection functionality for drag-to-select
function initializeAudioSelection() {
  const waveformCanvas = document.getElementById('editorWaveformCanvas');
  const waveformContainer = document.getElementById('editorWaveformDisplay');
  const pitchShiftBtn = document.getElementById('pitchShiftBtn');
  
  if (!waveformCanvas || !waveformContainer || !pitchShiftBtn) return;
  
  let isDragging = false;
  let dragStartX = 0;
  let dragStartTime = 0;
  
  // Mouse down - start selection
  waveformCanvas.addEventListener('mousedown', (e) => {
    if (!currentEditingClip) return;
    
    const rect = waveformCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const timeInClip = (x / rect.width) * currentEditingClip.duration;
    
    isDragging = true;
    dragStartX = x;
    dragStartTime = timeInClip;
    audioSelectionStart = timeInClip;
    audioSelectionEnd = timeInClip;
    
    // Clear previous selection
    clearAudioSelection();
    
    e.preventDefault();
  });
  
  // Mouse move - update selection
  waveformCanvas.addEventListener('mousemove', (e) => {
    if (!isDragging || !currentEditingClip) return;
    
    const rect = waveformCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const timeInClip = (x / rect.width) * currentEditingClip.duration;
    
    audioSelectionEnd = timeInClip;
    
    // Ensure start is always before end
    const selStart = Math.min(audioSelectionStart, audioSelectionEnd);
    const selEnd = Math.max(audioSelectionStart, audioSelectionEnd);
    
    audioSelectionStart = selStart;
    audioSelectionEnd = selEnd;
    
    // Update visual selection
    updateAudioSelectionVisual();
  });
  
  // Mouse up - finish selection
  waveformCanvas.addEventListener('mouseup', () => {
    if (!isDragging) return;
    
    isDragging = false;
    
    // Check if we have a valid selection
    const selectionDuration = Math.abs(audioSelectionEnd - audioSelectionStart);
    if (selectionDuration > 0.01) { // Minimum 10ms selection
      audioSelectionActive = true;
      pitchShiftBtn.disabled = false;
      pitchShiftBtn.classList.add('bg-purple-600', 'hover:bg-purple-500');
      pitchShiftBtn.classList.remove('bg-purple-700');
    } else {
      clearAudioSelection();
    }
  });
  
  // Pitch shift button click
  pitchShiftBtn.addEventListener('click', () => {
    if (audioSelectionActive && currentEditingClip) {
      openPitchShiftDialog();
    }
  });
}

// Update visual selection overlay
function updateAudioSelectionVisual() {
  const selectionOverlay = document.getElementById('editorSelection');
  const waveformCanvas = document.getElementById('editorWaveformCanvas');
  
  if (!selectionOverlay || !waveformCanvas || !currentEditingClip) return;
  
  const rect = waveformCanvas.getBoundingClientRect();
  const startPercent = (audioSelectionStart / currentEditingClip.duration) * 100;
  const endPercent = (audioSelectionEnd / currentEditingClip.duration) * 100;
  
  selectionOverlay.style.left = `${startPercent}%`;
  selectionOverlay.style.width = `${endPercent - startPercent}%`;
  selectionOverlay.classList.remove('hidden');
}

// Clear audio selection
function clearAudioSelection() {
  audioSelectionActive = false;
  audioSelectionStart = null;
  audioSelectionEnd = null;
  
  const selectionOverlay = document.getElementById('editorSelection');
  const pitchShiftBtn = document.getElementById('pitchShiftBtn');
  
  if (selectionOverlay) {
    selectionOverlay.classList.add('hidden');
  }
  
  if (pitchShiftBtn) {
    pitchShiftBtn.disabled = true;
    pitchShiftBtn.classList.remove('bg-purple-600', 'hover:bg-purple-500');
    pitchShiftBtn.classList.add('bg-purple-700');
  }
}

// Open pitch shift dialog
function openPitchShiftDialog() {
  if (!audioSelectionActive || !currentEditingClip) return;
  
  const overlay = document.getElementById('pitchShiftOverlay');
  const startDisplay = document.getElementById('pitchShiftSelStart');
  const durationDisplay = document.getElementById('pitchShiftSelDuration');
  const trackDisplay = document.getElementById('pitchShiftSelTrack');
  const slider = document.getElementById('pitchShiftSlider');
  const valueDisplay = document.getElementById('pitchShiftValue');
  
  if (!overlay) return;
  
  // Update dialog info
  if (startDisplay) startDisplay.textContent = `${audioSelectionStart.toFixed(2)}s`;
  if (durationDisplay) durationDisplay.textContent = `${(audioSelectionEnd - audioSelectionStart).toFixed(2)}s`;
  if (trackDisplay) trackDisplay.textContent = `Track ${tracks.findIndex(t => t.clips.includes(currentEditingClip)) + 1}`;
  
  // Reset slider
  if (slider) {
    slider.value = 0;
    updatePitchShiftValue(0);
  }
  
  // Show dialog
  overlay.classList.remove('hidden');
}

// Update pitch shift value display
function updatePitchShiftValue(semitones) {
  const valueDisplay = document.getElementById('pitchShiftValue');
  if (valueDisplay) {
    valueDisplay.textContent = semitones.toFixed(1);
  }
}

// Apply pitch shift using Phaze
async function applyPitchShift(semitones) {
  console.log('applyPitchShift called with:', {
    semitones,
    audioSelectionActive,
    currentEditingClip: !!currentEditingClip,
    hasAudioBuffer: !!(currentEditingClip && currentEditingClip.audioBuffer),
    audioSelectionStart,
    audioSelectionEnd
  });
  
  if (!audioSelectionActive || !currentEditingClip || !currentEditingClip.audioBuffer) {
    throw new Error('No audio selection or clip buffer available');
  }
  
  const startSample = Math.floor(audioSelectionStart * currentEditingClip.audioBuffer.sampleRate);
  const endSample = Math.floor(audioSelectionEnd * currentEditingClip.audioBuffer.sampleRate);
  const selectionLength = endSample - startSample;
  
  if (selectionLength <= 0) {
    throw new Error('Invalid selection');
  }
  
  // Extract selected audio
  const originalBuffer = currentEditingClip.audioBuffer;
  const selectedBuffer = audioCtx.createBuffer(
    originalBuffer.numberOfChannels,
    selectionLength,
    originalBuffer.sampleRate
  );
  
  // Copy selected audio to new buffer
  for (let channel = 0; channel < originalBuffer.numberOfChannels; channel++) {
    const originalData = originalBuffer.getChannelData(channel);
    const selectedData = selectedBuffer.getChannelData(channel);
    
    for (let i = 0; i < selectionLength; i++) {
      selectedData[i] = originalData[startSample + i];
    }
  }
  
  // Try to use Phaze AudioWorkletProcessor, fallback to simple method
  let pitchShiftedBuffer;
  try {
    pitchShiftedBuffer = await applyPhazePitchShift(selectedBuffer, semitones);
  } catch (error) {
    console.warn('Phaze pitch shift failed, using fallback method:', error);
    const pitchFactor = Math.pow(2, semitones / 12);
    pitchShiftedBuffer = await applySimplePitchShift(selectedBuffer, pitchFactor);
  }
  
  // Replace the selected audio in the original buffer
  await replaceAudioInClip(currentEditingClip, startSample, endSample, pitchShiftedBuffer);
  
  // Refresh waveform display
  if (typeof drawEditorWaveform === 'function') {
    drawEditorWaveform();
  }
  
  console.log('Pitch shift applied successfully');
}

// Apply pitch shift using Phaze AudioWorkletProcessor
async function applyPhazePitchShift(inputBuffer, semitones) {
  console.log('applyPhazePitchShift called with:', { semitones, bufferLength: inputBuffer.length });
  
  try {
    // Convert semitones to pitch factor
    const pitchFactor = Math.pow(2, semitones / 12);
    console.log('Pitch factor:', pitchFactor);
    
    // Create offline context for processing
    const offlineCtx = new OfflineAudioContext(
      inputBuffer.numberOfChannels,
      inputBuffer.length,
      inputBuffer.sampleRate
    );
    
    console.log('Created offline context');
    
    // Load the AudioWorklet in offline context
    await offlineCtx.audioWorklet.addModule('./phase-vocoder.js');
    console.log('Loaded AudioWorklet module');
    
    // Create AudioWorkletNode for phase vocoder
    const offlinePhaseVocoderNode = new AudioWorkletNode(offlineCtx, 'phase-vocoder-processor');
    console.log('Created phase vocoder node');
    
    // Set pitch factor for offline processing
    const offlinePitchParam = offlinePhaseVocoderNode.parameters.get('pitchFactor');
    if (offlinePitchParam) {
      offlinePitchParam.value = pitchFactor;
      console.log('Set pitch factor parameter to:', pitchFactor);
    } else {
      console.warn('pitchFactor parameter not found');
    }
    
    // Create buffer source and connect to phase vocoder
    const bufferSource = offlineCtx.createBufferSource();
    bufferSource.buffer = inputBuffer;
    bufferSource.connect(offlinePhaseVocoderNode);
    offlinePhaseVocoderNode.connect(offlineCtx.destination);
    
    console.log('Connected audio graph');
    
    // Start processing
    bufferSource.start(0);
    console.log('Started buffer source');
    
    // Render the processed audio
    const processedBuffer = await offlineCtx.startRendering();
    console.log('Processing complete, output buffer length:', processedBuffer.length);
    
    return processedBuffer;
    
  } catch (error) {
    console.error('Error in applyPhazePitchShift:', error);
    throw error;
  }
}

// Simple pitch shift using time stretching and resampling (fallback)
async function applySimplePitchShift(inputBuffer, pitchFactor) {
  const outputLength = Math.floor(inputBuffer.length / pitchFactor);
  const outputBuffer = audioCtx.createBuffer(
    inputBuffer.numberOfChannels,
    outputLength,
    inputBuffer.sampleRate
  );
  
  for (let channel = 0; channel < inputBuffer.numberOfChannels; channel++) {
    const inputData = inputBuffer.getChannelData(channel);
    const outputData = outputBuffer.getChannelData(channel);
    
    // Simple linear interpolation resampling
    for (let i = 0; i < outputLength; i++) {
      const sourceIndex = i * pitchFactor;
      const index = Math.floor(sourceIndex);
      const fraction = sourceIndex - index;
      
      if (index < inputData.length - 1) {
        outputData[i] = inputData[index] * (1 - fraction) + inputData[index + 1] * fraction;
      } else if (index < inputData.length) {
        outputData[i] = inputData[index];
      } else {
        outputData[i] = 0;
      }
    }
  }
  
  return outputBuffer;
}

// Replace audio in clip buffer
async function replaceAudioInClip(clip, startSample, endSample, newBuffer) {
  const originalBuffer = clip.audioBuffer;
  const originalLength = originalBuffer.length;
  const replacementLength = newBuffer.length;
  const selectionLength = endSample - startSample;
  
  // Calculate new buffer length
  const newLength = originalLength - selectionLength + replacementLength;
  
  // Create new buffer
  const resultBuffer = audioCtx.createBuffer(
    originalBuffer.numberOfChannels,
    newLength,
    originalBuffer.sampleRate
  );
  
  for (let channel = 0; channel < originalBuffer.numberOfChannels; channel++) {
    const originalData = originalBuffer.getChannelData(channel);
    const newData = newBuffer.getChannelData(channel);
    const resultData = resultBuffer.getChannelData(channel);
    
    // Copy data before selection
    for (let i = 0; i < startSample; i++) {
      resultData[i] = originalData[i];
    }
    
    // Copy pitch-shifted data
    for (let i = 0; i < replacementLength; i++) {
      resultData[startSample + i] = newData[i];
    }
    
    // Copy data after selection
    const afterStart = startSample + replacementLength;
    for (let i = endSample; i < originalLength; i++) {
      resultData[afterStart + (i - endSample)] = originalData[i];
    }
  }
  
  // Update clip buffer and duration
  clip.audioBuffer = resultBuffer;
  clip.duration = resultBuffer.duration;
  
  return resultBuffer;
}

// Preview functions
async function previewOriginalAudio() {
  if (!audioSelectionActive || !currentEditingClip) return;
  
  stopPreview();
  
  const buffer = currentEditingClip.audioBuffer;
  const startSample = Math.floor(audioSelectionStart * buffer.sampleRate);
  const endSample = Math.floor(audioSelectionEnd * buffer.sampleRate);
  const selectionLength = endSample - startSample;
  
  // Create buffer for selected audio
  const previewBuffer = audioCtx.createBuffer(
    buffer.numberOfChannels,
    selectionLength,
    buffer.sampleRate
  );
  
  // Copy selected audio
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const originalData = buffer.getChannelData(channel);
    const previewData = previewBuffer.getChannelData(channel);
    
    for (let i = 0; i < selectionLength; i++) {
      previewData[i] = originalData[startSample + i];
    }
  }
  
  // Play preview
  pitchShiftPreviewPlayer = audioCtx.createBufferSource();
  pitchShiftPreviewPlayer.buffer = previewBuffer;
  pitchShiftPreviewPlayer.connect(masterGainNode);
  pitchShiftPreviewPlayer.start();
}

async function previewPitchShiftedAudio() {
  console.log('previewPitchShiftedAudio called with:', {
    audioSelectionActive,
    currentEditingClip: !!currentEditingClip,
    hasAudioBuffer: !!(currentEditingClip && currentEditingClip.audioBuffer)
  });
  
  if (!audioSelectionActive || !currentEditingClip) return;
  
  stopPreview();
  
  const slider = document.getElementById('pitchShiftSlider');
  const semitones = slider ? parseFloat(slider.value) : 0;
  
  if (semitones === 0) {
    previewOriginalAudio();
    return;
  }
  
  try {
    const buffer = currentEditingClip.audioBuffer;
    const startSample = Math.floor(audioSelectionStart * buffer.sampleRate);
    const endSample = Math.floor(audioSelectionEnd * buffer.sampleRate);
    const selectionLength = endSample - startSample;
    
    // Create buffer for selected audio
    const selectedBuffer = audioCtx.createBuffer(
      buffer.numberOfChannels,
      selectionLength,
      buffer.sampleRate
    );
    
    // Copy selected audio
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const originalData = buffer.getChannelData(channel);
      const selectedData = selectedBuffer.getChannelData(channel);
      
      for (let i = 0; i < selectionLength; i++) {
        selectedData[i] = originalData[startSample + i];
      }
    }
    
    // Apply pitch shift with Phaze or fallback
    let pitchShiftedBuffer;
    try {
      pitchShiftedBuffer = await applyPhazePitchShift(selectedBuffer, semitones);
    } catch (error) {
      console.warn('Phaze preview failed, using fallback:', error);
      const pitchFactor = Math.pow(2, semitones / 12);
      pitchShiftedBuffer = await applySimplePitchShift(selectedBuffer, pitchFactor);
    }
    
    // Play preview
    pitchShiftPreviewPlayer = audioCtx.createBufferSource();
    pitchShiftPreviewPlayer.buffer = pitchShiftedBuffer;
    pitchShiftPreviewPlayer.connect(masterGainNode);
    pitchShiftPreviewPlayer.start();
    
  } catch (error) {
    console.error('Error previewing pitch shifted audio:', error);
  }
}

function stopPreview() {
  if (pitchShiftPreviewPlayer) {
    try {
      pitchShiftPreviewPlayer.stop();
    } catch (e) {
      // Player may already be stopped
    }
    pitchShiftPreviewPlayer = null;
  }
}

// Initialize pitch shift dialog controls
function initializePitchShiftDialog() {
  const overlay = document.getElementById('pitchShiftOverlay');
  const closeBtn = document.getElementById('pitchShiftClose');
  const cancelBtn = document.getElementById('pitchShiftCancel');
  const applyBtn = document.getElementById('pitchShiftApply');
  const slider = document.getElementById('pitchShiftSlider');
  const fineTuneUp = document.getElementById('pitchUpFine');
  const fineTuneDown = document.getElementById('pitchDownFine');
  const presetBtns = document.querySelectorAll('.pitch-preset-btn');
  const previewOriginalBtn = document.getElementById('previewOriginal');
  const previewPitchShiftedBtn = document.getElementById('previewPitchShifted');
  const stopPreviewBtn = document.getElementById('stopPreview');
  
  // Close dialog handlers
  [closeBtn, cancelBtn].forEach(btn => {
    if (btn) {
      btn.addEventListener('click', () => {
        stopPreview();
        overlay?.classList.add('hidden');
      });
    }
  });
  
  // Slider change
  if (slider) {
    slider.addEventListener('input', (e) => {
      updatePitchShiftValue(parseFloat(e.target.value));
    });
  }
  
  // Fine tune buttons
  if (fineTuneUp) {
    fineTuneUp.addEventListener('click', () => {
      if (slider) {
        const newValue = Math.min(12, parseFloat(slider.value) + 0.1);
        slider.value = newValue;
        updatePitchShiftValue(newValue);
      }
    });
  }
  
  if (fineTuneDown) {
    fineTuneDown.addEventListener('click', () => {
      if (slider) {
        const newValue = Math.max(-12, parseFloat(slider.value) - 0.1);
        slider.value = newValue;
        updatePitchShiftValue(newValue);
      }
    });
  }
  
  // Preset buttons
  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const semitones = parseFloat(btn.dataset.semitones);
      if (slider) {
        slider.value = semitones;
        updatePitchShiftValue(semitones);
      }
    });
  });
  
  // Preview buttons
  if (previewOriginalBtn) {
    previewOriginalBtn.addEventListener('click', previewOriginalAudio);
  }
  
  if (previewPitchShiftedBtn) {
    previewPitchShiftedBtn.addEventListener('click', previewPitchShiftedAudio);
  }
  
  if (stopPreviewBtn) {
    stopPreviewBtn.addEventListener('click', stopPreview);
  }
  
  // Apply button
  if (applyBtn) {
    applyBtn.addEventListener('click', async () => {
      if (!slider) return;
      
      const semitones = parseFloat(slider.value);
      if (semitones === 0) {
        overlay?.classList.add('hidden');
        return;
      }
      
      try {
        applyBtn.disabled = true;
        applyBtn.textContent = 'Processing...';
        
        await applyPitchShift(semitones);
        
        overlay?.classList.add('hidden');
        
        // Clear selection after successful application
        clearAudioSelection();
        
        // Add to undo stack
        addToUndoStack({
          action: 'pitchShift',
          trackIndex: tracks.findIndex(t => t.clips.includes(currentEditingClip)),
          clipId: currentEditingClip.id,
          semitones: semitones,
          selectionStart: audioSelectionStart,
          selectionEnd: audioSelectionEnd
        });
        
      } catch (error) {
        console.error('Error applying pitch shift:', error);
        alert('Error applying pitch shift: ' + error.message);
      } finally {
        applyBtn.disabled = false;
        applyBtn.textContent = 'Apply Pitch Shift';
        stopPreview();
      }
    });
  }
  
  // Close on overlay click
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        stopPreview();
        overlay.classList.add('hidden');
      }
    });
  }
}

// === Volume Automation Apply Dialog System ===

function showVolumeAutomationApplyDialog() {
  if (!currentEditingClip) return;
  
  const overlay = document.getElementById('volumeAutomationOverlay');
  if (!overlay) return;
  
  // Update dialog information
  updateVolumeAutomationDialogInfo();
  
  // Draw automation preview
  drawVolumeAutomationPreview();
  
  // Show the dialog
  overlay.classList.remove('hidden');
  
  // Set up event handlers
  setupVolumeAutomationDialogEvents();
}

function updateVolumeAutomationDialogInfo() {
  if (!currentEditingClip) return;
  
  const clipNameSpan = document.getElementById('volumeAutomationClipName');
  const durationSpan = document.getElementById('volumeAutomationDuration');
  const pointCountSpan = document.getElementById('volumeAutomationPointCount');
  
  if (clipNameSpan) clipNameSpan.textContent = currentEditingClip.name || 'Audio Clip';
  if (durationSpan) durationSpan.textContent = currentEditingClip.duration.toFixed(2) + 's';
  
  const autoData = currentEditingClip.automation.volume;
  if (pointCountSpan) pointCountSpan.textContent = autoData.points ? autoData.points.length : 0;
}

function drawVolumeAutomationPreview() {
  const canvas = document.getElementById('volumeAutomationPreviewCanvas');
  if (!canvas || !currentEditingClip) return;
  
  const ctx = canvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  const autoData = currentEditingClip.automation.volume;
  if (!autoData.points || autoData.points.length === 0) {
    // Draw flat line at 0dB
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
    
    ctx.fillStyle = '#9ca3af';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('No automation points', canvas.width / 2, canvas.height / 2 + 20);
    return;
  }
  
  // Draw automation curve
  const duration = currentEditingClip.duration;
  const minDb = autoData.minRange;
  const maxDb = autoData.maxRange;
  
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 2;
  ctx.beginPath();
  
  for (let x = 0; x < canvas.width; x++) {
    const time = (x / canvas.width) * duration;
    const dbValue = interpolateAutomationValue(autoData.points, time, minDb, maxDb);
    const y = canvas.height - ((dbValue - minDb) / (maxDb - minDb)) * canvas.height;
    
    if (x === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
  
  // Draw automation points
  ctx.fillStyle = '#10b981';
  autoData.points.forEach(point => {
    const x = (point.time / duration) * canvas.width;
    const y = canvas.height - ((point.value - minDb) / (maxDb - minDb)) * canvas.height;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  });
}

function interpolateAutomationValue(points, time, minRange, maxRange) {
  if (!points || points.length === 0) return 0;
  if (points.length === 1) return points[0].value;
  
  // Find surrounding points
  let before = null, after = null;
  
  for (let i = 0; i < points.length; i++) {
    if (points[i].time <= time) {
      before = points[i];
    }
    if (points[i].time >= time && !after) {
      after = points[i];
      break;
    }
  }
  
  if (!before) return after.value;
  if (!after) return before.value;
  if (before === after) return before.value;
  
  // Linear interpolation
  const ratio = (time - before.time) / (after.time - before.time);
  return before.value + (after.value - before.value) * ratio;
}

function setupVolumeAutomationDialogEvents() {
  const overlay = document.getElementById('volumeAutomationOverlay');
  const closeBtn = document.getElementById('volumeAutomationClose');
  const cancelBtn = document.getElementById('volumeAutomationCancel');
  const applyBtn = document.getElementById('volumeAutomationApply');
  const previewOriginalBtn = document.getElementById('previewVolumeOriginal');
  const previewAutomatedBtn = document.getElementById('previewVolumeAutomated');
  const stopPreviewBtn = document.getElementById('stopVolumePreview');
  
  // Remove existing event listeners
  const newCloseBtn = closeBtn?.cloneNode(true);
  const newCancelBtn = cancelBtn?.cloneNode(true);
  const newApplyBtn = applyBtn?.cloneNode(true);
  const newPreviewOriginalBtn = previewOriginalBtn?.cloneNode(true);
  const newPreviewAutomatedBtn = previewAutomatedBtn?.cloneNode(true);
  const newStopPreviewBtn = stopPreviewBtn?.cloneNode(true);
  
  if (closeBtn && newCloseBtn) closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
  if (cancelBtn && newCancelBtn) cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
  if (applyBtn && newApplyBtn) applyBtn.parentNode.replaceChild(newApplyBtn, applyBtn);
  if (previewOriginalBtn && newPreviewOriginalBtn) previewOriginalBtn.parentNode.replaceChild(newPreviewOriginalBtn, previewOriginalBtn);
  if (previewAutomatedBtn && newPreviewAutomatedBtn) previewAutomatedBtn.parentNode.replaceChild(newPreviewAutomatedBtn, previewAutomatedBtn);
  if (stopPreviewBtn && newStopPreviewBtn) stopPreviewBtn.parentNode.replaceChild(newStopPreviewBtn, stopPreviewBtn);
  
  // Close handlers
  if (newCloseBtn) {
    newCloseBtn.addEventListener('click', closeVolumeAutomationDialog);
  }
  
  if (newCancelBtn) {
    newCancelBtn.addEventListener('click', closeVolumeAutomationDialog);
  }
  
  // Apply handler
  if (newApplyBtn) {
    newApplyBtn.addEventListener('click', applyVolumeAutomation);
  }
  
  // Preview handlers
  if (newPreviewOriginalBtn) {
    newPreviewOriginalBtn.addEventListener('click', previewVolumeOriginal);
  }
  
  if (newPreviewAutomatedBtn) {
    newPreviewAutomatedBtn.addEventListener('click', previewVolumeAutomated);
  }
  
  if (newStopPreviewBtn) {
    newStopPreviewBtn.addEventListener('click', stopVolumePreview);
  }
  
  // Close on overlay click
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeVolumeAutomationDialog();
      }
    });
  }
}

function closeVolumeAutomationDialog() {
  const overlay = document.getElementById('volumeAutomationOverlay');
  if (overlay) {
    overlay.classList.add('hidden');
  }
  stopVolumePreview();
}

function previewVolumeOriginal() {
  if (!currentEditingClip) return;
  
  stopVolumePreview();
  
  // Play the original clip without automation using Tone.js
  previewClipWithTone(currentEditingClip, false);
}

function previewVolumeAutomated() {
  if (!currentEditingClip) return;
  
  stopVolumePreview();
  
  // Play the clip with current automation using Tone.js
  previewClipWithTone(currentEditingClip, true);
}

function stopVolumePreview() {
  stopPreview();
}

// Preview player management
let currentPreviewPlayer = null;
let currentPreviewVolume = null;

async function previewClipWithTone(clip, withAutomation) {
  if (!clip.audioUrl) {
    console.warn('No audio URL available for preview');
    return;
  }
  
  // Stop any existing preview
  stopPreview();
  
  try {
    // Initialize Tone.js if needed
    if (!toneStarted) {
      await initializeToneJS();
    }
    
    // Create new preview player and volume node
    currentPreviewPlayer = new Tone.Player({
      url: clip.audioUrl,
      onload: () => {
        console.log('Preview player loaded');
      },
      onerror: (error) => {
        console.error('Preview player error:', error.message || error);
      }
    });
    
    currentPreviewVolume = new Tone.Volume(0);
    
    // Connect player -> volume -> destination
    currentPreviewPlayer.connect(currentPreviewVolume);
    currentPreviewVolume.toDestination();
    
    if (withAutomation && clip.automation.volume.enabled && clip.automation.volume.points.length > 0) {
      // Apply automation to preview
      const startTime = Tone.now();
      applyToneVolumeAutomationToNode(currentPreviewVolume, clip.automation.volume, startTime, 0, clip.duration);
    }
    
    // Start playback
    currentPreviewPlayer.start();
    
    // Auto-cleanup after clip duration
    setTimeout(() => {
      stopPreview();
    }, (clip.duration || 10) * 1000);
    
  } catch (error) {
    console.error('Error creating preview player:', error.message || error);
  }
}

function stopPreview() {
  try {
    if (currentPreviewPlayer) {
      if (currentPreviewPlayer.state !== 'stopped') {
        currentPreviewPlayer.stop();
      }
      currentPreviewPlayer.dispose();
      currentPreviewPlayer = null;
    }
    
    if (currentPreviewVolume) {
      currentPreviewVolume.dispose();
      currentPreviewVolume = null;
    }
  } catch (error) {
    console.error('Error stopping preview:', error.message || error);
  }
}

function applyToneVolumeAutomationToNode(volumeNode, automationData, startTime, sourceOffset, sourceDuration) {
  if (!automationData.points || automationData.points.length === 0) return;
  
  // Clear any existing automation
  volumeNode.volume.cancelScheduledValues(startTime);
  
  // Convert automation points to Tone.js scheduling
  const clipRelativeStart = sourceOffset;
  const clipRelativeEnd = sourceOffset + sourceDuration;
  
  // Find initial volume value
  let initialDb = interpolateAutomationValue(automationData.points, clipRelativeStart, automationData.minRange, automationData.maxRange);
  volumeNode.volume.setValueAtTime(initialDb, startTime);
  
  // Schedule automation points within playback range
  automationData.points.forEach(point => {
    if (point.time >= clipRelativeStart && point.time <= clipRelativeEnd) {
      const scheduleTime = startTime + (point.time - clipRelativeStart);
      const dbValue = automationValueToDb(point.value, automationData.minRange, automationData.maxRange);
      
      if (automationData.curved) {
        // Use exponential ramp for curved automation (more natural)
        const gainValue = Tone.dbToGain(dbValue);
        volumeNode.volume.exponentialRampToValueAtTime(Math.max(0.001, gainValue), scheduleTime);
      } else {
        // Use linear ramp for straight lines
        volumeNode.volume.linearRampToValueAtTime(dbValue, scheduleTime);
      }
    }
  });
}

async function applyVolumeAutomation() {
  if (!currentEditingClip) return;
  
  const applyBtn = document.getElementById('volumeAutomationApply');
  
  try {
    if (applyBtn) {
      applyBtn.disabled = true;
      applyBtn.textContent = 'Processing...';
    }
    
    // Apply volume automation using Tone.js approach
    await processVolumeAutomation(currentEditingClip);
    
    // Keep automation points for Tone.js playback, but mark as applied
    // Don't clear the points since Tone.js needs them during playback
    currentEditingClip.automation.volume.applied = true;
    
    // Update automation button state
    updateAutomationButtonState();
    
    // Re-render the clip and automation
    renderClipAutomation();
    render();
    
    // Close dialog
    closeVolumeAutomationDialog();
    
    console.log('Volume automation applied successfully');
    
  } catch (error) {
    console.error('Error applying volume automation:', error);
    alert('Error applying volume automation: ' + error.message);
  } finally {
    if (applyBtn) {
      applyBtn.disabled = false;
      applyBtn.textContent = 'Apply Automation';
    }
  }
}

async function processVolumeAutomation(clip) {
  if (!clip.automation.volume.points || clip.automation.volume.points.length === 0) {
    return;
  }
  
  const autoData = clip.automation.volume;
  
  // With Tone.js, we don't need to process the audio buffer directly
  // Instead, we store the automation data and apply it during playback
  
  // Store the applied automation in clip history for potential re-editing
  if (!clip.appliedAutomations) {
    clip.appliedAutomations = [];
  }
  
  clip.appliedAutomations.push({
    type: 'volume',
    points: [...autoData.points],
    minRange: autoData.minRange,
    maxRange: autoData.maxRange,
    timestamp: Date.now()
  });
  
  // Mark that this clip has applied volume automation
  clip.hasAppliedVolumeAutomation = true;
  
  console.log(`Stored volume automation with ${autoData.points.length} points for clip: ${clip.name}`);
}

function dbToLinear(db) {
  return Math.pow(10, db / 20);
}

function getLastAppliedAutomation(clip, automationType) {
  if (!clip.appliedAutomations || clip.appliedAutomations.length === 0) {
    return null;
  }
  
  // Find the most recent applied automation of the specified type
  const automationsOfType = clip.appliedAutomations
    .filter(a => a.type === automationType)
    .sort((a, b) => b.timestamp - a.timestamp);
  
  return automationsOfType.length > 0 ? automationsOfType[0] : null;
}

// === Tone.js Initialization and Management ===

async function initializeToneJS() {
  if (!toneStarted && typeof Tone !== 'undefined') {
    try {
      await Tone.start();
      toneStarted = true;
      console.log('Tone.js audio context started');
      
      // Set up Transport for global timing
      Tone.Transport.bpm.value = bpm;
      
      return true;
    } catch (error) {
      console.error('Failed to start Tone.js:', error);
      return false;
    }
  }
  return toneStarted;
}

function applyToneVolumeAutomation(clip, startTime) {
  if (!clip.useTone || !clip.toneVolume) {
    return;
  }
  
  let autoData = clip.automation.volume;
  
  // Check if we should use applied automation or current editing automation
  if (autoData.applied && clip.appliedAutomations) {
    // Use the most recent applied automation for playback
    const lastApplied = getLastAppliedAutomation(clip, 'volume');
    if (lastApplied) {
      autoData = lastApplied;
    }
  } else if (!autoData.enabled) {
    return;
  }
  
  if (!autoData.points || autoData.points.length === 0) {
    return;
  }
  
  // Clear any existing automation
  clip.toneVolume.gain.cancelScheduledValues(Tone.now());
  
  // Set initial volume
  const initialPoint = autoData.points[0];
  const initialDb = automationValueToDb(initialPoint.value, autoData.minRange, autoData.maxRange);
  const initialGain = Tone.dbToGain(initialDb);
  
  clip.toneVolume.gain.setValueAtTime(initialGain, startTime);
  
  // Schedule volume automation points
  for (let i = 1; i < autoData.points.length; i++) {
    const point = autoData.points[i];
    const pointTime = startTime + point.time;
    const dbValue = automationValueToDb(point.value, autoData.minRange, autoData.maxRange);
    const gainValue = Tone.dbToGain(dbValue);
    
    if (autoData.curved) {
      // Use exponential ramp for more natural-sounding volume changes
      clip.toneVolume.gain.exponentialRampToValueAtTime(Math.max(0.001, gainValue), pointTime);
    } else {
      // Use linear ramp for straight-line automation
      clip.toneVolume.gain.linearRampToValueAtTime(gainValue, pointTime);
    }
  }
  
  console.log(`Applied Tone.js volume automation with ${autoData.points.length} points for clip: ${clip.name}`);
}

// Time stretching using VexWarp
async function applyTimeStretchToClip(trackIndex, clipIndex, stretchRatio) {
  console.log('Checking VexWarp availability...', {
    hasVexWarp: !!window.VexWarp,
    hasTimeStretcher: !!(window.VexWarp && window.VexWarp.TimeStretcher),
    hasVexWarpTimeStretcher: !!window.VexWarpTimeStretcher
  });
  
  if (!window.VexWarp || !window.VexWarp.TimeStretcher) {
    console.error('VexWarp TimeStretcher not available');
    alert('VexWarp time stretching library not loaded. Please refresh the page.');
    return;
  }
  
  const track = tracks[trackIndex];
  const clip = track.clips[clipIndex];
  
  if (!clip || !clip.audioBuffer) {
    console.error('No audio buffer to stretch');
    return;
  }
  
  // Verify audio buffer integrity before processing
  console.log('Audio buffer check before stretch:', {
    bufferExists: !!clip.audioBuffer,
    bufferLength: clip.audioBuffer ? clip.audioBuffer.length : 'N/A',
    channels: clip.audioBuffer ? clip.audioBuffer.numberOfChannels : 'N/A',
    sampleRate: clip.audioBuffer ? clip.audioBuffer.sampleRate : 'N/A',
    duration: clip.duration,
    clipName: clip.name
  });
  
  // Test channel data access
  try {
    if (clip.audioBuffer) {
      const testChannel = clip.audioBuffer.getChannelData(0);
      const hasData = testChannel && testChannel.length > 0;
      const firstSamples = hasData ? Array.from(testChannel.slice(0, 5)) : [];
      
      console.log('Channel data test:', {
        hasChannelData: hasData,
        channelLength: testChannel ? testChannel.length : 'N/A',
        firstSamples: firstSamples
      });
      
      if (!hasData) {
        console.error('Audio buffer has no channel data!');
        return;
      }
    }
  } catch (channelError) {
    console.error('Error accessing channel data:', channelError);
    return;
  }
  
  // Add clip length validation to prevent freezing
  const maxDurationForTimeStretch = 30; // Maximum duration in seconds for time stretching
  const maxSamplesForTimeStretch = clip.audioBuffer.sampleRate * maxDurationForTimeStretch;
  
  if (clip.duration > maxDurationForTimeStretch || clip.audioBuffer.length > maxSamplesForTimeStretch) {
    console.warn(`Clip too long for time stretching: ${clip.duration.toFixed(2)}s (max: ${maxDurationForTimeStretch}s)`);
    
    const userChoice = confirm(
      `The clip "${clip.name}" is ${clip.duration.toFixed(2)} seconds long, which may cause the browser to freeze during time stretching.\n\n` +
      `For clips longer than ${maxDurationForTimeStretch} seconds, we recommend:\n` +
      `• Split the clip into smaller segments\n` +
      `• Use a lower quality/faster processing mode\n` +
      `• Try time stretching offline\n\n` +
      `Do you want to continue anyway? (This may freeze your browser)`
    );
    
    if (!userChoice) {
      console.log('User cancelled time stretch for long clip');
      return;
    }
    
    console.log('User chose to proceed with time stretch for long clip - using fallback mode');
    
    // Use fast fallback processing for very long clips
    try {
      await applyFastTimeStretchToClip(trackIndex, clipIndex, stretchRatio);
      return;
    } catch (fallbackError) {
      console.error('Fast time stretch also failed:', fallbackError);
      alert('Time stretching failed for this clip. The clip may be too long or corrupted.');
      return;
    }
  }
  
  try {
    console.log(`Applying time stretch: ${stretchRatio.toFixed(3)}x to clip "${clip.name}"`);
    
    // Show progress indicator for medium/large clips
    let progressDiv = null;
    if (clip.duration > 5) { // Show progress for clips longer than 5 seconds
      progressDiv = document.createElement('div');
      progressDiv.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: rgba(0,0,0,0.9); color: white; padding: 20px; border-radius: 8px;
        z-index: 10000; text-align: center; min-width: 250px;
      `;
      progressDiv.innerHTML = `
        <div style="margin-bottom: 10px;">Time stretching: "${clip.name}"</div>
        <div style="background: #333; height: 8px; border-radius: 4px; overflow: hidden;">
          <div id="timeStretchProgress" style="background: #1de9b6; height: 100%; width: 0%; transition: width 0.3s;"></div>
        </div>
        <div style="margin-top: 10px; font-size: 12px; color: #ccc;">Processing...</div>
      `;
      document.body.appendChild(progressDiv);
    }
    
    // Optimize VexWarp parameters based on clip length for better performance
    let frameSize = 2048;
    let hopSize = 512;
    let stftBins = 8192;
    let algorithm = 'psola';
    
    // Use smaller frames and bins for longer clips to reduce memory usage and processing time
    if (clip.duration > 20) {
      // Very long clips: prioritize speed over quality
      frameSize = 512;
      hopSize = 128;
      stftBins = 2048;
      algorithm = 'simple'; // Use simpler algorithm
    } else if (clip.duration > 15) {
      frameSize = 1024;
      hopSize = 256;
      stftBins = 4096;
    } else if (clip.duration > 10) {
      frameSize = 1536;
      hopSize = 384;
      stftBins = 6144;
    }
    
    console.log(`VexWarp parameters for ${clip.duration.toFixed(2)}s clip:`, {
      frameSize, hopSize, stftBins, algorithm
    });
    
    // Create VexWarp TimeStretcher instance with optimized parameters
    const stretcher = new window.VexWarp.TimeStretcher(
      clip.audioBuffer.sampleRate,
      clip.audioBuffer.numberOfChannels,
      {
        algorithm: algorithm,
        frameSize: frameSize,
        hopSize: hopSize,
        stftBins: stftBins,
        preserveFormants: algorithm === 'psola', // Only preserve formants for high-quality modes
        progressCallback: (details, message) => {
          // Update progress bar if visible
          if (progressDiv) {
            const progressBar = document.getElementById('timeStretchProgress');
            if (progressBar && details.current_window && details.total_windows) {
              const progress = (details.current_window / details.total_windows) * 100;
              progressBar.style.width = progress + '%';
            }
          }
          
          // Call original progress callback
          VexWarpTools.onProgress(details, message);
        }
      }
    );
    
    // Get original audio data
    const originalLength = clip.audioBuffer.length;
    const channelData = [];
    
    for (let channel = 0; channel < clip.audioBuffer.numberOfChannels; channel++) {
      channelData.push(clip.audioBuffer.getChannelData(channel));
    }
    
    // Calculate new length
    const newLength = Math.floor(originalLength * stretchRatio);
    
    // Create new audio buffer for stretched audio
    const stretchedBuffer = Tone.context.createBuffer(
      clip.audioBuffer.numberOfChannels,
      newLength,
      clip.audioBuffer.sampleRate
    );
    
    // Process each channel with yielding for better responsiveness
    for (let channel = 0; channel < clip.audioBuffer.numberOfChannels; channel++) {
      const inputData = channelData[channel];
      const outputData = new Float32Array(newLength);
      
      console.log(`Processing channel ${channel}:`, {
        inputLength: inputData.length,
        outputLength: outputData.length,
        hasValidInput: inputData && inputData.length > 0
      });
      
      // Update progress indicator for multi-channel processing
      if (progressDiv) {
        const progressBar = document.getElementById('timeStretchProgress');
        if (progressBar) {
          const channelProgress = (channel / clip.audioBuffer.numberOfChannels) * 50; // First 50% for channel setup
          progressBar.style.width = channelProgress + '%';
        }
      }
      
      // Verify input data is valid
      if (!inputData || inputData.length === 0) {
        console.error(`Channel ${channel} has invalid input data`);
        throw new Error(`Invalid audio data for channel ${channel}`);
      }
      
      // Yield to browser between channels for better responsiveness
      if (channel > 0) {
        await new Promise(resolve => setTimeout(resolve, 1));
      }
      
      // Apply time stretching using VexWarp
      try {
        stretcher.stretch(inputData, outputData, stretchRatio);
        
        // Verify output data
        let hasValidOutput = false;
        for (let i = 0; i < Math.min(100, outputData.length); i++) {
          if (outputData[i] !== 0) {
            hasValidOutput = true;
            break;
          }
        }
        
        if (!hasValidOutput) {
          console.warn(`Channel ${channel} output appears to be all zeros`);
        }
        
        console.log(`Channel ${channel} stretch completed:`, {
          outputNonZeroSamples: hasValidOutput,
          firstFewSamples: Array.from(outputData.slice(0, 5))
        });
        
      } catch (stretchError) {
        console.error(`Error stretching channel ${channel}:`, stretchError);
        
        // Fallback: simple resampling for this channel
        for (let i = 0; i < newLength; i++) {
          const sourceIndex = (i / newLength) * inputData.length;
          const index1 = Math.floor(sourceIndex);
          const index2 = Math.min(index1 + 1, inputData.length - 1);
          const fraction = sourceIndex - index1;
          
          outputData[i] = inputData[index1] * (1 - fraction) + inputData[index2] * fraction;
        }
        
        console.log(`Applied fallback resampling for channel ${channel}`);
      }
      
      // Copy stretched data to buffer
      stretchedBuffer.copyToChannel(outputData, channel);
    }
    
    // Store original data for potential recovery
    const originalAudioBuffer = clip.audioBuffer;
    const originalDuration = clip.duration;
    const originalTonePlayer = clip.tonePlayer;
    
    try {
      // Create blob URL from stretched audio
      const url = await bufferToBlob(stretchedBuffer);
      
      // Create new Tone.Player
      const newTonePlayer = new Tone.Player({
        url: url,
        playbackRate: 1.0,
        onload: () => {
          console.log(`Time-stretched clip "${clip.name}" loaded successfully`);
          
          // Only update clip data after successful load
          clip.audioBuffer = stretchedBuffer;
          clip.duration = newLength / stretchedBuffer.sampleRate;
          
          // Dispose old player only after new one is ready
          if (originalTonePlayer) {
            originalTonePlayer.dispose();
          }
          
          // Update visual
          render();
        },
        onerror: (error) => {
          console.error('Error loading time-stretched audio:', error);
          
          // Restore original data on error
          clip.audioBuffer = originalAudioBuffer;
          clip.duration = originalDuration;
          clip.tonePlayer = originalTonePlayer;
          
          alert('Error loading time-stretched audio. Reverted to original.');
          render();
        }
      }).toDestination();
      
      // Connect to track effects chain if it exists
      if (track.effectsChain) {
        newTonePlayer.disconnect();
        newTonePlayer.connect(track.effectsChain);
      }
      
      // Update clip with new player
      clip.tonePlayer = newTonePlayer;
      
    } catch (blobError) {
      console.error('Error creating audio blob:', blobError);
      
      // Fallback: update audioBuffer directly without recreating Tone.Player
      clip.audioBuffer = stretchedBuffer;
      clip.duration = newLength / stretchedBuffer.sampleRate;
      
      console.log('Fallback: Updated audioBuffer directly');
      render();
    }
    
    console.log(`Time stretch complete: ${clip.duration.toFixed(2)}s (ratio: ${stretchRatio.toFixed(3)}x)`);
    
    // Clean up progress indicator
    if (progressDiv && progressDiv.parentNode) {
      document.body.removeChild(progressDiv);
    }
    
  } catch (error) {
    console.error('Error applying time stretch:', error);
    console.log('Error details:', {
      trackIndex: trackIndex,
      clipIndex: clipIndex,
      clipName: clip ? clip.name : 'Unknown',
      hasAudioBuffer: clip ? !!clip.audioBuffer : false,
      stretchRatio: stretchRatio
    });
    
    // Clean up progress indicator on error
    if (progressDiv && progressDiv.parentNode) {
      document.body.removeChild(progressDiv);
    }
    
    // Ensure clip data integrity
    if (clip && clip.audioBuffer) {
      console.log('Clip audio buffer still exists after error');
    } else {
      console.error('Clip audio buffer has been lost!');
    }
    
    alert('Error applying time stretch: ' + error.message + '\nClip data has been preserved.');
    
    // Re-render to ensure UI is consistent
    render();
  }
}

// Fast time stretch fallback for large clips - uses simple resampling with chunked processing
async function applyFastTimeStretchToClip(trackIndex, clipIndex, stretchRatio) {
  console.log('Applying fast time stretch for large clip...');
  
  const track = tracks[trackIndex];
  const clip = track.clips[clipIndex];
  
  if (!clip || !clip.audioBuffer) {
    console.error('No audio buffer for fast stretch');
    return;
  }
  
  const originalLength = clip.audioBuffer.length;
  const newLength = Math.floor(originalLength * stretchRatio);
  const chunkSize = 44100; // Process 1 second chunks at 44.1kHz
  
  console.log(`Fast stretch processing: ${originalLength} -> ${newLength} samples (${Math.ceil(newLength / chunkSize)} chunks)`);
  
  // Show progress indicator
  const progressDiv = document.createElement('div');
  progressDiv.style.cssText = `
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    background: rgba(0,0,0,0.9); color: white; padding: 20px; border-radius: 8px;
    z-index: 10000; text-align: center; min-width: 300px;
  `;
  progressDiv.innerHTML = `
    <div style="margin-bottom: 10px;">Processing large clip...</div>
    <div style="background: #333; height: 10px; border-radius: 5px; overflow: hidden;">
      <div id="fastStretchProgress" style="background: #ff9500; height: 100%; width: 0%; transition: width 0.3s;"></div>
    </div>
    <div style="margin-top: 10px; font-size: 12px;">Click anywhere to cancel</div>
  `;
  document.body.appendChild(progressDiv);
  
  let cancelled = false;
  const cancelHandler = () => {
    cancelled = true;
    document.body.removeChild(progressDiv);
    console.log('Fast time stretch cancelled by user');
  };
  progressDiv.addEventListener('click', cancelHandler);
  
  try {
    // Create new audio buffer for stretched audio
    const stretchedBuffer = Tone.context.createBuffer(
      clip.audioBuffer.numberOfChannels,
      newLength,
      clip.audioBuffer.sampleRate
    );
    
    // Process each channel with chunked processing
    for (let channel = 0; channel < clip.audioBuffer.numberOfChannels; channel++) {
      if (cancelled) break;
      
      const inputData = clip.audioBuffer.getChannelData(channel);
      const outputData = new Float32Array(newLength);
      
      // Process in chunks to prevent freezing
      for (let chunkStart = 0; chunkStart < newLength; chunkStart += chunkSize) {
        if (cancelled) break;
        
        const chunkEnd = Math.min(chunkStart + chunkSize, newLength);
        const chunkLength = chunkEnd - chunkStart;
        
        // Simple linear interpolation for this chunk
        for (let i = 0; i < chunkLength; i++) {
          const outputIndex = chunkStart + i;
          const sourceIndex = (outputIndex / newLength) * inputData.length;
          const index1 = Math.floor(sourceIndex);
          const index2 = Math.min(index1 + 1, inputData.length - 1);
          const fraction = sourceIndex - index1;
          
          outputData[outputIndex] = inputData[index1] * (1 - fraction) + inputData[index2] * fraction;
        }
        
        // Update progress
        const progress = ((channel * newLength + chunkEnd) / (clip.audioBuffer.numberOfChannels * newLength)) * 100;
        const progressBar = document.getElementById('fastStretchProgress');
        if (progressBar) {
          progressBar.style.width = progress + '%';
        }
        
        // Yield to browser to prevent freezing
        if (chunkStart % (chunkSize * 4) === 0) { // Every 4 chunks
          await new Promise(resolve => setTimeout(resolve, 1)); // 1ms yield
        }
      }
      
      if (!cancelled) {
        stretchedBuffer.copyToChannel(outputData, channel);
        console.log(`Fast stretch completed for channel ${channel}`);
      }
    }
    
    // Remove progress indicator
    if (progressDiv.parentNode) {
      document.body.removeChild(progressDiv);
    }
    
    if (cancelled) {
      console.log('Fast time stretch was cancelled');
      return;
    }
    
    // Update clip with stretched audio
    try {
      const url = await bufferToBlob(stretchedBuffer);
      
      const originalTonePlayer = clip.tonePlayer;
      
      const newTonePlayer = new Tone.Player({
        url: url,
        playbackRate: 1.0,
        onload: () => {
          console.log(`Fast time-stretched clip "${clip.name}" loaded successfully`);
          
          clip.audioBuffer = stretchedBuffer;
          clip.duration = newLength / stretchedBuffer.sampleRate;
          
          if (originalTonePlayer) {
            originalTonePlayer.dispose();
          }
          
          render();
        },
        onerror: (error) => {
          console.error('Error loading fast time-stretched audio:', error);
          alert('Error loading processed audio. Reverted to original.');
          render();
        }
      }).toDestination();
      
      if (track.effectsChain) {
        newTonePlayer.disconnect();
        newTonePlayer.connect(track.effectsChain);
      }
      
      clip.tonePlayer = newTonePlayer;
      
    } catch (blobError) {
      console.error('Error creating blob for fast stretch:', blobError);
      
      // Direct buffer update fallback
      clip.audioBuffer = stretchedBuffer;
      clip.duration = newLength / stretchedBuffer.sampleRate;
      render();
    }
    
    console.log(`Fast time stretch complete: ${clip.duration.toFixed(2)}s (ratio: ${stretchRatio.toFixed(3)}x)`);
    
  } catch (error) {
    console.error('Error in fast time stretch:', error);
    
    // Remove progress indicator on error
    if (progressDiv.parentNode) {
      document.body.removeChild(progressDiv);
    }
    
    alert('Error during fast time stretch: ' + error.message);
    throw error;
  }
}

// Helper function to convert AudioBuffer to Blob URL
async function bufferToBlob(audioBuffer) {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const sampleRate = audioBuffer.sampleRate;
  
  // Create WAV file
  const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
  const view = new DataView(arrayBuffer);
  
  // WAV header
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length * numberOfChannels * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numberOfChannels * 2, true);
  view.setUint16(32, numberOfChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, length * numberOfChannels * 2, true);
  
  // Convert float samples to 16-bit PCM
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]));
      view.setInt16(offset, sample * 0x7FFF, true);
      offset += 2;
    }
  }
  
  return URL.createObjectURL(new Blob([arrayBuffer], { type: 'audio/wav' }));
}

// ===== RESIZABLE COMPONENTS SYSTEM =====

class ResizableManager {
  constructor() {
    this.activeResize = null;
    this.resizeState = {
      isResizing: false,
      startX: 0,
      startY: 0,
      startWidth: 0,
      startHeight: 0,
      element: null,
      handle: null,
      type: null // 'width', 'height', 'both'
    };
    
    this.init();
  }
  
  init() {
    // Add global mouse event listeners
    document.addEventListener('mousemove', this.handleMouseMove.bind(this));
    document.addEventListener('mouseup', this.handleMouseUp.bind(this));
    
    // Initialize all resizable components
    // this.initResizableTracks(); // DISABLED
    // this.initResizableMixerChannels(); // DISABLED
    this.initResizableModals();
    // this.initResizableTrackHeaders(); // DISABLED
  }
  
  // ===== TRACK RESIZING =====
  
  initResizableTracks() {
    // DISABLED - Track resizing disabled by user request
    return;
  }
  
  makeTracksResizable() {
    const trackContainers = document.querySelectorAll('.track-container');
    trackContainers.forEach((container, index) => {
      if (!container.classList.contains('resizable')) {
        container.classList.add('resizable');
        this.addTrackResizeHandles(container, index);
      }
    });
  }
  
  addTrackResizeHandles(container, trackIndex) {
    // Add bottom resize handle for track height
    const bottomHandle = document.createElement('div');
    bottomHandle.className = 'resize-handle resize-handle-bottom';
    bottomHandle.dataset.trackIndex = trackIndex;
    bottomHandle.dataset.resizeType = 'track-height';
    
    // Add resize indicator
    const indicator = document.createElement('div');
    indicator.className = 'track-resize-indicator';
    indicator.textContent = '90px';
    
    container.appendChild(bottomHandle);
    container.appendChild(indicator);
    
    // Add event listeners
    bottomHandle.addEventListener('mousedown', this.handleTrackResizeStart.bind(this));
  }
  
  handleTrackResizeStart(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const handle = e.target;
    const trackIndex = parseInt(handle.dataset.trackIndex);
    const container = handle.parentElement;
    const track = container.querySelector('.track');
    
    this.resizeState = {
      isResizing: true,
      startY: e.clientY,
      startHeight: track.offsetHeight,
      element: track,
      container: container,
      handle: handle,
      type: 'track-height',
      trackIndex: trackIndex
    };
    
    container.classList.add('resizing');
    document.body.classList.add('resizing-ns');
    handle.classList.add('active');
  }
  
  // ===== MIXER CHANNEL RESIZING =====
  
  initResizableMixerChannels() {
    // DISABLED - Mixer resizing disabled by user request
    return;
  }
  
  makeMixerChannelsResizable() {
    const mixerChannels = document.querySelectorAll('.mixer-channel:not(.master)');
    mixerChannels.forEach((channel, index) => {
      if (!channel.classList.contains('resizable')) {
        channel.classList.add('resizable');
        this.addMixerChannelResizeHandles(channel, index);
      }
    });
  }
  
  addMixerChannelResizeHandles(channel, channelIndex) {
    // Add right resize handle for mixer channel width
    const rightHandle = document.createElement('div');
    rightHandle.className = 'resize-handle resize-handle-right';
    rightHandle.dataset.channelIndex = channelIndex;
    rightHandle.dataset.resizeType = 'mixer-width';
    
    // Add resize indicator
    const indicator = document.createElement('div');
    indicator.className = 'mixer-resize-indicator';
    indicator.textContent = '120px';
    
    channel.appendChild(rightHandle);
    channel.appendChild(indicator);
    
    // Add event listeners
    rightHandle.addEventListener('mousedown', this.handleMixerResizeStart.bind(this));
  }
  
  handleMixerResizeStart(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const handle = e.target;
    const channelIndex = parseInt(handle.dataset.channelIndex);
    const channel = handle.parentElement;
    
    this.resizeState = {
      isResizing: true,
      startX: e.clientX,
      startWidth: channel.offsetWidth,
      element: channel,
      handle: handle,
      type: 'mixer-width',
      channelIndex: channelIndex
    };
    
    channel.classList.add('resizing');
    document.body.classList.add('resizing-ew');
    handle.classList.add('active');
  }
  
  // ===== MODAL DIALOG RESIZING =====
  
  initResizableModals() {
    this.makeModalsResizable();
  }
  
  makeModalsResizable() {
    const modals = document.querySelectorAll('.modal-dialog');
    modals.forEach((modal) => {
      if (!modal.classList.contains('resizable')) {
        modal.classList.add('resizable');
        this.addModalResizeHandles(modal);
      }
    });
  }
  
  addModalResizeHandles(modal) {
    // Add corner resize handle for both width and height
    const cornerHandle = document.createElement('div');
    cornerHandle.className = 'resize-handle resize-handle-corner bottom-right';
    cornerHandle.dataset.resizeType = 'modal-both';
    
    // Add resize indicator
    const indicator = document.createElement('div');
    indicator.className = 'modal-resize-indicator';
    indicator.textContent = `${modal.offsetWidth}×${modal.offsetHeight}`;
    
    modal.appendChild(cornerHandle);
    modal.appendChild(indicator);
    
    // Add event listeners
    cornerHandle.addEventListener('mousedown', this.handleModalResizeStart.bind(this));
  }
  
  handleModalResizeStart(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const handle = e.target;
    const modal = handle.parentElement;
    
    this.resizeState = {
      isResizing: true,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: modal.offsetWidth,
      startHeight: modal.offsetHeight,
      element: modal,
      handle: handle,
      type: 'modal-both'
    };
    
    modal.classList.add('resizing');
    document.body.classList.add('resizing-nw');
    handle.classList.add('active');
  }
  
  // ===== TRACK HEADER RESIZING =====
  
  initResizableTrackHeaders() {
    // DISABLED - Track header resizing disabled by user request
    return;
  }
  
  makeTrackHeadersResizable() {
    const trackHeaders = document.querySelectorAll('.track-header');
    trackHeaders.forEach((header, index) => {
      if (!header.classList.contains('resizable')) {
        header.classList.add('resizable');
        this.addTrackHeaderResizeHandles(header, index);
      }
    });
  }
  
  addTrackHeaderResizeHandles(header, headerIndex) {
    // Add right resize handle for track header width
    const rightHandle = document.createElement('div');
    rightHandle.className = 'resize-handle resize-handle-right';
    rightHandle.dataset.headerIndex = headerIndex;
    rightHandle.dataset.resizeType = 'header-width';
    
    // Add resize indicator
    const indicator = document.createElement('div');
    indicator.className = 'track-header-resize-indicator';
    indicator.textContent = '200px';
    
    header.appendChild(rightHandle);
    header.appendChild(indicator);
    
    // Add event listeners
    rightHandle.addEventListener('mousedown', this.handleTrackHeaderResizeStart.bind(this));
  }
  
  handleTrackHeaderResizeStart(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const handle = e.target;
    const headerIndex = parseInt(handle.dataset.headerIndex);
    const header = handle.parentElement;
    
    this.resizeState = {
      isResizing: true,
      startX: e.clientX,
      startWidth: header.offsetWidth,
      element: header,
      handle: handle,
      type: 'header-width',
      headerIndex: headerIndex
    };
    
    header.classList.add('resizing');
    document.body.classList.add('resizing-ew');
    handle.classList.add('active');
  }
  
  // ===== GLOBAL MOUSE HANDLERS =====
  
  handleMouseMove(e) {
    if (!this.resizeState.isResizing) return;
    
    const state = this.resizeState;
    
    switch (state.type) {
      case 'track-height':
        this.handleTrackHeightResize(e);
        break;
      case 'mixer-width':
        this.handleMixerWidthResize(e);
        break;
      case 'modal-both':
        this.handleModalBothResize(e);
        break;
      case 'header-width':
        this.handleTrackHeaderWidthResize(e);
        break;
      case 'plugin-ui':
        this.handlePluginUIResize(e);
        break;
    }
  }
  
  handleTrackHeightResize(e) {
    const state = this.resizeState;
    const deltaY = e.clientY - state.startY;
    const newHeight = Math.max(60, Math.min(300, state.startHeight + deltaY));
    
    state.element.style.height = newHeight + 'px';
    
    // Update indicator
    const indicator = state.container.querySelector('.track-resize-indicator');
    if (indicator) {
      indicator.textContent = newHeight + 'px';
    }
    
    // Update track height in data structure
    if (tracks[state.trackIndex]) {
      tracks[state.trackIndex].height = newHeight;
    }
  }
  
  handleMixerWidthResize(e) {
    const state = this.resizeState;
    const deltaX = e.clientX - state.startX;
    const newWidth = Math.max(80, Math.min(200, state.startWidth + deltaX));
    
    state.element.style.width = newWidth + 'px';
    
    // Update indicator
    const indicator = state.element.querySelector('.mixer-resize-indicator');
    if (indicator) {
      indicator.textContent = newWidth + 'px';
    }
  }
  
  handleModalBothResize(e) {
    const state = this.resizeState;
    const deltaX = e.clientX - state.startX;
    const deltaY = e.clientY - state.startY;
    const newWidth = Math.max(400, Math.min(window.innerWidth * 0.95, state.startWidth + deltaX));
    const newHeight = Math.max(300, Math.min(window.innerHeight * 0.95, state.startHeight + deltaY));
    
    state.element.style.width = newWidth + 'px';
    state.element.style.height = newHeight + 'px';
    
    // Update indicator
    const indicator = state.element.querySelector('.modal-resize-indicator');
    if (indicator) {
      indicator.textContent = `${newWidth}×${newHeight}`;
    }
  }
  
  handleTrackHeaderWidthResize(e) {
    const state = this.resizeState;
    const deltaX = e.clientX - state.startX;
    const newWidth = Math.max(150, Math.min(400, state.startWidth + deltaX));
    
    state.element.style.width = newWidth + 'px';
    
    // Update indicator
    const indicator = state.element.querySelector('.track-header-resize-indicator');
    if (indicator) {
      indicator.textContent = newWidth + 'px';
    }
    
    // Update global TRACK_HEADER_WIDTH constant and recalculate timeline
    if (newWidth !== TRACK_HEADER_WIDTH) {
      // Update all track headers to same width for consistency
      document.querySelectorAll('.track-header').forEach(header => {
        header.style.width = newWidth + 'px';
      });
      
      // Update the global constant (we need to modify this)
      window.TRACK_HEADER_WIDTH = newWidth;
      
      // Recalculate timeline width
      updateTimelineWidth();
    }
  }
  
  handlePluginUIResize(e) {
    const state = this.resizeState;
    const deltaX = e.clientX - state.startX;
    const deltaY = e.clientY - state.startY;
    const newWidth = Math.max(300, Math.min(window.innerWidth * 0.9, state.startWidth + deltaX));
    const newHeight = Math.max(200, Math.min(window.innerHeight * 0.9, state.startHeight + deltaY));
    
    state.element.style.width = newWidth + 'px';
    state.element.style.height = newHeight + 'px';
    
    // Update indicator
    const indicator = state.element.querySelector('.plugin-resize-indicator');
    if (indicator) {
      indicator.textContent = `${newWidth}×${newHeight}`;
    }
  }
  
  handleMouseUp(e) {
    if (!this.resizeState.isResizing) return;
    
    const state = this.resizeState;
    
    // Clean up resize state
    if (state.container) {
      state.container.classList.remove('resizing');
    }
    if (state.element) {
      state.element.classList.remove('resizing');
    }
    if (state.handle) {
      state.handle.classList.remove('active');
    }
    
    // Remove cursor classes
    document.body.classList.remove('resizing-ns', 'resizing-ew', 'resizing-nw', 'resizing-ne');
    
    // Reset resize state
    this.resizeState = {
      isResizing: false,
      startX: 0,
      startY: 0,
      startWidth: 0,
      startHeight: 0,
      element: null,
      handle: null,
      type: null
    };
    
    // Trigger any necessary updates
    this.onResizeComplete(state);
  }
  
  onResizeComplete(state) {
    switch (state.type) {
      case 'track-height':
        // Re-render track if needed
        renderTracks();
        break;
      case 'mixer-width':
        // Update mixer layout if needed
        break;
      case 'modal-both':
        // Trigger modal content reflow
        const event = new Event('resize');
        state.element.dispatchEvent(event);
        break;
      case 'header-width':
        // Update timeline and track positioning
        break;
      case 'plugin-ui':
        // Trigger plugin UI content reflow
        const pluginEvent = new Event('resize');
        state.element.dispatchEvent(pluginEvent);
        break;
    }
  }
  
  // ===== PLUGIN UI RESIZING =====
  
  makePluginUIResizable(container) {
    if (!container.classList.contains('resizable')) {
      container.classList.add('resizable');
      container.classList.add('plugin-ui-container');
      
      // Add corner resize handle
      const cornerHandle = document.createElement('div');
      cornerHandle.className = 'resize-handle resize-handle-corner bottom-right';
      cornerHandle.dataset.resizeType = 'plugin-ui';
      
      // Add resize indicator
      const indicator = document.createElement('div');
      indicator.className = 'plugin-resize-indicator';
      indicator.textContent = `${container.offsetWidth}×${container.offsetHeight}`;
      
      container.appendChild(cornerHandle);
      container.appendChild(indicator);
      
      // Add event listeners
      cornerHandle.addEventListener('mousedown', this.handlePluginUIResizeStart.bind(this));
    }
  }
  
  handlePluginUIResizeStart(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const handle = e.target;
    const container = handle.parentElement;
    
    this.resizeState = {
      isResizing: true,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: container.offsetWidth,
      startHeight: container.offsetHeight,
      element: container,
      handle: handle,
      type: 'plugin-ui'
    };
    
    container.classList.add('resizing');
    document.body.classList.add('resizing-nw');
    handle.classList.add('active');
  }
  
  // ===== UTILITY METHODS =====
  
  refreshResizableComponents() {
    // Re-initialize all resizable components (call after DOM changes)
    this.initResizableTracks();
    this.initResizableMixerChannels();
    this.initResizableModals();
    this.initResizableTrackHeaders();
  }
  
  removeResizeHandles(element) {
    // Remove all resize handles from an element
    const handles = element.querySelectorAll('.resize-handle');
    const indicators = element.querySelectorAll('[class*="resize-indicator"]');
    
    handles.forEach(handle => handle.remove());
    indicators.forEach(indicator => indicator.remove());
    
    element.classList.remove('resizable', 'resizing');
  }
}

// Initialize the resizable manager
let resizableManager;

// Initialize resizable components when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  resizableManager = new ResizableManager();
});

// Re-initialize resizable components after track/mixer updates
function refreshResizableComponents() {
  if (resizableManager) {
    resizableManager.refreshResizableComponents();
  }
}

// ===== FEATURES GUIDE DIALOG =====

class FeaturesGuideDialog {
  constructor() {
    this.overlay = null;
    this.dialog = null;
    this.isOpen = false;
    this.animationQueue = [];
    this.currentAnimationIndex = 0;
    this.animationDelay = 120; // ms between text reveals
    this.animationStartDelay = 600; // ms before starting animations
    
    this.init();
  }
  
  init() {
    this.overlay = document.getElementById('featuresOverlay');
    this.dialog = document.getElementById('featuresDialog');
    
    if (!this.overlay || !this.dialog) {
      console.warn('Features Guide Dialog elements not found');
      return;
    }
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Collect all animated text elements
    this.collectAnimatedElements();
  }
  
  setupEventListeners() {
    // Logo click handler
    const logoContainer = document.querySelector('.audioverse-logo-container');
    if (logoContainer) {
      logoContainer.addEventListener('click', () => this.open());
    }
    
    // Close button handlers
    const closeButtons = [
      document.getElementById('featuresClose'),
      document.getElementById('featuresCloseFooter')
    ];
    
    closeButtons.forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => this.close());
      }
    });
    
    // Start button
    const startBtn = document.getElementById('featuresStart');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        this.close();
        this.celebrateStart();
      });
    }
    
    // Close on overlay click (but not dialog click)
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close();
      }
    });
    
    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
    
    // Make dialog resizable
    if (resizableManager) {
      setTimeout(() => {
        resizableManager.makeModalResizable(this.dialog);
      }, 100);
    }
  }
  
  collectAnimatedElements() {
    this.animationQueue = Array.from(this.dialog.querySelectorAll('.animated-text'));
    this.resetAnimations();
  }
  
  resetAnimations() {
    this.currentAnimationIndex = 0;
    this.animationQueue.forEach(element => {
      element.classList.remove('revealed');
    });
  }
  
  open() {
    if (this.isOpen) return;
    
    this.isOpen = true;
    this.overlay.classList.remove('hidden');
    
    // Reset and start animations
    this.resetAnimations();
    setTimeout(() => {
      this.startTextAnimations();
    }, this.animationStartDelay);
    
    // Focus management for accessibility
    this.dialog.focus();
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    
    console.log('Features Guide Dialog opened');
  }
  
  close() {
    if (!this.isOpen) return;
    
    this.isOpen = false;
    this.overlay.classList.add('hidden');
    
    // Reset animations for next time
    this.resetAnimations();
    
    // Restore body scroll
    document.body.style.overflow = '';
    
    console.log('Features Guide Dialog closed');
  }
  
  startTextAnimations() {
    if (this.currentAnimationIndex >= this.animationQueue.length) {
      this.onAnimationsComplete();
      return;
    }
    
    const element = this.animationQueue[this.currentAnimationIndex];
    
    // Add revealed class with staggered timing
    setTimeout(() => {
      element.classList.add('revealed');
      this.currentAnimationIndex++;
      
      // Continue to next element
      if (this.currentAnimationIndex < this.animationQueue.length) {
        // Variable delay based on element type
        let delay = this.animationDelay;
        
        if (element.classList.contains('category-title')) {
          delay = 250; // Longer pause after category headers
        } else if (element.classList.contains('welcome-text')) {
          delay = 400; // Longer pause after welcome text
        } else if (element.classList.contains('cta-text')) {
          delay = 350; // Pause before CTA
        }
        
        setTimeout(() => this.startTextAnimations(), delay);
      } else {
        this.onAnimationsComplete();
      }
    }, 60);
  }
  
  onAnimationsComplete() {
    console.log('All text animations completed');
    
    // Add subtle completion effect
    this.dialog.style.transform = 'scale(1.02)';
    setTimeout(() => {
      this.dialog.style.transform = '';
    }, 200);
    
    // Play completion sound
    this.playCompletionSound();
  }
  
  playCompletionSound() {
    // Create a cheerful audio feedback
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Play a nice chord progression
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.1);
      oscillator.frequency.exponentialRampToValueAtTime(1000, audioContext.currentTime + 0.2);
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.08, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.log('Audio feedback not available');
    }
  }
  
  celebrateStart() {
    // Enhanced celebration effect
    const logoContainer = document.querySelector('.audioverse-logo-container');
    if (logoContainer) {
      // Add a special celebration class
      logoContainer.classList.add('celebrating');
      
      // Remove it after animation
      setTimeout(() => {
        logoContainer.classList.remove('celebrating');
      }, 2000);
    }
    
    // Show welcome message
    this.showWelcomeMessage();
    
    // Add some sparkle effects
    this.createSparkleEffects();
  }
  
  showWelcomeMessage() {
    const message = document.createElement('div');
    message.innerHTML = `
      <div style="
        position: fixed;
        top: 90px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #ff9500, #1de9b6);
        color: white;
        padding: 16px 32px;
        border-radius: 12px;
        font-weight: 700;
        font-size: 1.1rem;
        z-index: 10000;
        box-shadow: 0 8px 30px rgba(255, 149, 0, 0.5);
        animation: celebrationSlide 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
        text-align: center;
      ">
        � Awesome! Let's make some music! 🎵
        <div style="font-size: 0.9rem; margin-top: 4px; opacity: 0.9;">
          Try uploading an audio file or adding a track! 🚀
        </div>
      </div>
    `;
    
    // Add celebration animation styles
    const style = document.createElement('style');
    style.textContent = `
      @keyframes celebrationSlide {
        0% { opacity: 0; transform: translateX(-50%) translateY(-30px) scale(0.8); }
        60% { opacity: 1; transform: translateX(-50%) translateY(5px) scale(1.05); }
        100% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
      }
      @keyframes celebrationOut {
        0% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        100% { opacity: 0; transform: translateX(-50%) translateY(-30px) scale(0.9); }
      }
      .celebrating {
        animation: logoOverjoy 2s ease-in-out !important;
      }
      @keyframes logoOverjoy {
        0%, 100% { transform: scale(1) rotate(0deg); }
        25% { transform: scale(1.2) rotate(5deg); }
        50% { transform: scale(1.15) rotate(-3deg); }
        75% { transform: scale(1.25) rotate(3deg); }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(message);
    
    // Remove message after 4 seconds
    setTimeout(() => {
      message.firstElementChild.style.animation = 'celebrationOut 0.5s ease-in';
      setTimeout(() => {
        if (document.body.contains(message)) {
          document.body.removeChild(message);
        }
        if (document.head.contains(style)) {
          document.head.removeChild(style);
        }
      }, 500);
    }, 4000);
  }
  
  createSparkleEffects() {
    // Create sparkle particles around the logo
    const logoContainer = document.querySelector('.audioverse-logo-container');
    if (!logoContainer) return;
    
    const rect = logoContainer.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        this.createSparkle(centerX, centerY);
      }, i * 100);
    }
  }
  
  createSparkle(x, y) {
    const sparkle = document.createElement('div');
    const angle = Math.random() * Math.PI * 2;
    const distance = 50 + Math.random() * 50;
    const endX = x + Math.cos(angle) * distance;
    const endY = y + Math.sin(angle) * distance;
    
    sparkle.innerHTML = ['✨', '⭐', '🌟', '💫'][Math.floor(Math.random() * 4)];
    sparkle.style.cssText = `
      position: fixed;
      left: ${x}px;
      top: ${y}px;
      font-size: 20px;
      pointer-events: none;
      z-index: 10001;
      animation: sparkleFloat 1.5s ease-out forwards;
    `;
    
    const sparkleStyle = document.createElement('style');
    sparkleStyle.textContent = `
      @keyframes sparkleFloat {
        0% {
          opacity: 1;
          transform: translate(0, 0) scale(0.5);
        }
        50% {
          opacity: 1;
          transform: translate(${endX - x}px, ${endY - y}px) scale(1.2);
        }
        100% {
          opacity: 0;
          transform: translate(${endX - x}px, ${endY - y}px) scale(0.3);
        }
      }
    `;
    
    document.head.appendChild(sparkleStyle);
    document.body.appendChild(sparkle);
    
    // Cleanup
    setTimeout(() => {
      if (document.body.contains(sparkle)) {
        document.body.removeChild(sparkle);
      }
      if (document.head.contains(sparkleStyle)) {
        document.head.removeChild(sparkleStyle);
      }
    }, 1500);
  }
}

// Initialize Features Guide Dialog
let featuresGuideDialog;

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    featuresGuideDialog = new FeaturesGuideDialog();
  }, 150);
});

// ===== TRACK VOLUME AUTOMATION SYSTEM =====

class TrackAutomationManager {
  constructor() {
    this.overlay = null;
    this.dialog = null;
    this.canvas = null;
    this.ctx = null;
    this.currentTrackIndex = -1;
    this.selectedPointIndex = -1;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.timeScale = 1; // pixels per second
    this.volumeScale = 1; // pixels per volume unit
    
    this.init();
  }
  
  init() {
    this.overlay = document.getElementById('trackAutomationOverlay');
    this.dialog = document.getElementById('trackAutomationDialog');
    this.canvas = document.getElementById('automationCanvas');
    
    if (!this.canvas) {
      console.warn('Automation canvas not found');
      return;
    }
    
    this.ctx = this.canvas.getContext('2d');
    this.setupEventListeners();
    this.setupCanvas();
  }
  
  setupEventListeners() {
    // Close buttons
    document.getElementById('trackAutomationClose')?.addEventListener('click', () => this.close());
    document.getElementById('automationCancel')?.addEventListener('click', () => this.close());
    
    // Save button
    document.getElementById('automationSave')?.addEventListener('click', () => this.saveAutomation());
    
    // Preview button
    document.getElementById('automationPreview')?.addEventListener('click', () => this.previewAutomation());
    
    // Control buttons
    document.getElementById('automationAddPoint')?.addEventListener('click', () => this.addPoint());
    document.getElementById('automationDeletePoint')?.addEventListener('click', () => this.deleteSelectedPoint());
    document.getElementById('automationClearAll')?.addEventListener('click', () => this.clearAllPoints());
    
    // Volume range sliders
    document.getElementById('automationMinVolume')?.addEventListener('input', (e) => {
      this.updateVolumeRange();
      this.redraw();
    });
    document.getElementById('automationMaxVolume')?.addEventListener('input', (e) => {
      this.updateVolumeRange();
      this.redraw();
    });
    
    // Canvas events
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
    this.canvas.addEventListener('dblclick', (e) => this.onDoubleClick(e));
    this.canvas.addEventListener('mouseleave', (e) => this.onMouseLeave(e));
    
    // Close on overlay click
    this.overlay?.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close();
      }
    });
    
    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        this.close();
      }
    });
  }
  
  setupCanvas() {
    if (!this.canvas) return;
    
    const resizeCanvas = () => {
      const rect = this.canvas.getBoundingClientRect();
      this.canvas.width = rect.width;
      this.canvas.height = rect.height;
      
      // Update scales
      this.timeScale = this.canvas.width / this.getTrackDuration();
      this.volumeScale = this.canvas.height;
      
      this.redraw();
    };
    
    // Initial resize
    setTimeout(resizeCanvas, 100);
    
    // Resize observer
    if (window.ResizeObserver) {
      const resizeObserver = new ResizeObserver(resizeCanvas);
      resizeObserver.observe(this.canvas.parentElement);
    }
    
    window.addEventListener('resize', resizeCanvas);
  }
  
  open(trackIndex) {
    if (trackIndex < 0 || trackIndex >= tracks.length) {
      console.warn('Invalid track index:', trackIndex);
      return;
    }
    
    this.currentTrackIndex = trackIndex;
    const track = tracks[trackIndex];
    
    // Update dialog title
    const titleElement = document.getElementById('automationTrackTitle');
    if (titleElement) {
      titleElement.textContent = `${track.label} - Volume Automation`;
    }
    
    // Initialize volume range sliders
    const minSlider = document.getElementById('automationMinVolume');
    const maxSlider = document.getElementById('automationMaxVolume');
    if (minSlider && maxSlider) {
      minSlider.value = Math.round(track.volumeAuto.points[0]?.value * 100) || 0;
      maxSlider.value = Math.round(Math.max(...track.volumeAuto.points.map(p => p.value)) * 100) || 100;
    }
    
    this.updateVolumeRange();
    this.updateTrackInfo();
    
    // Show dialog
    this.overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    
    // Setup canvas and redraw
    setTimeout(() => {
      this.setupCanvas();
      this.generateTimeline();
      this.redraw();
    }, 100);
    
    console.log('Track automation opened for track:', trackIndex);
  }
  
  close() {
    this.overlay.classList.add('hidden');
    document.body.style.overflow = '';
    this.selectedPointIndex = -1;
    this.isDragging = false;
    this.currentTrackIndex = -1;
  }
  
  isOpen() {
    return !this.overlay.classList.contains('hidden');
  }
  
  getTrackDuration() {
    if (this.currentTrackIndex < 0) return 10; // default 10 seconds
    
    const track = tracks[this.currentTrackIndex];
    let maxDuration = 10; // minimum 10 seconds
    
    track.clips.forEach(clip => {
      const clipEnd = clip.startTime + clip.duration;
      if (clipEnd > maxDuration) {
        maxDuration = clipEnd;
      }
    });
    
    return Math.max(maxDuration, 10);
  }
  
  generateTimeline() {
    const timeline = document.getElementById('automationTimeline');
    if (!timeline) return;
    
    timeline.innerHTML = '';
    const duration = this.getTrackDuration();
    const timelineWidth = timeline.clientWidth;
    const secondWidth = timelineWidth / duration;
    
    // Generate time markers
    for (let i = 0; i <= duration; i++) {
      const marker = document.createElement('div');
      marker.className = 'timeline-marker' + (i % 4 === 0 ? ' bar' : '');
      marker.style.left = (i * secondWidth) + 'px';
      timeline.appendChild(marker);
      
      if (i % 4 === 0) {
        const label = document.createElement('div');
        label.className = 'timeline-label';
        label.style.left = (i * secondWidth) + 'px';
        label.textContent = this.formatTime(i);
        timeline.appendChild(label);
      }
    }
  }
  
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  
  updateVolumeRange() {
    const minSlider = document.getElementById('automationMinVolume');
    const maxSlider = document.getElementById('automationMaxVolume');
    const minLabel = document.getElementById('minVolumeLabel');
    const maxLabel = document.getElementById('maxVolumeLabel');
    
    if (minSlider && maxSlider && minLabel && maxLabel) {
      minLabel.textContent = minSlider.value + '%';
      maxLabel.textContent = maxSlider.value + '%';
      
      // Ensure min <= max
      if (parseInt(minSlider.value) > parseInt(maxSlider.value)) {
        minSlider.value = maxSlider.value;
        minLabel.textContent = minSlider.value + '%';
      }
    }
  }
  
  updateTrackInfo() {
    const track = tracks[this.currentTrackIndex];
    if (!track) return;
    
    const durationInfo = document.getElementById('trackDurationInfo');
    const pointCountInfo = document.getElementById('automationPointCount');
    
    if (durationInfo) {
      durationInfo.textContent = this.formatTime(this.getTrackDuration());
    }
    
    if (pointCountInfo) {
      pointCountInfo.textContent = track.volumeAuto.points.length.toString();
    }
  }
  
  updateSelectedPointInfo() {
    const selectedInfo = document.getElementById('selectedPointInfo');
    const deleteBtn = document.getElementById('automationDeletePoint');
    
    if (this.selectedPointIndex >= 0) {
      const track = tracks[this.currentTrackIndex];
      const point = track.volumeAuto.points[this.selectedPointIndex];
      
      if (selectedInfo && point) {
        selectedInfo.textContent = `Time: ${this.formatTime(point.time)}, Volume: ${Math.round(point.value * 100)}%`;
      }
      
      if (deleteBtn) {
        deleteBtn.disabled = false;
      }
    } else {
      if (selectedInfo) {
        selectedInfo.textContent = 'None';
      }
      if (deleteBtn) {
        deleteBtn.disabled = true;
      }
    }
  }
  
  redraw() {
    if (!this.ctx || this.currentTrackIndex < 0) return;
    
    const track = tracks[this.currentTrackIndex];
    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;
    
    // Clear canvas
    this.ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // Draw background grid
    this.drawGrid();
    
    // Draw track audio clips as background
    this.drawTrackClips();
    
    // Draw automation curve
    this.drawAutomationCurve();
    
    // Draw automation points
    this.drawAutomationPoints();
  }
  
  drawGrid() {
    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;
    
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    this.ctx.lineWidth = 1;
    
    // Vertical lines (time)
    const duration = this.getTrackDuration();
    for (let i = 0; i <= duration; i++) {
      const x = (i / duration) * canvasWidth;
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, canvasHeight);
      this.ctx.stroke();
    }
    
    // Horizontal lines (volume)
    for (let i = 0; i <= 4; i++) {
      const y = (i / 4) * canvasHeight;
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(canvasWidth, y);
      this.ctx.stroke();
    }
  }
  
  drawTrackClips() {
    if (this.currentTrackIndex < 0) return;
    
    const track = tracks[this.currentTrackIndex];
    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;
    const duration = this.getTrackDuration();
    
    this.ctx.fillStyle = 'rgba(29, 233, 182, 0.1)';
    
    track.clips.forEach(clip => {
      const startX = (clip.startTime / duration) * canvasWidth;
      const width = (clip.duration / duration) * canvasWidth;
      
      this.ctx.fillRect(startX, 0, width, canvasHeight);
      
      // Draw clip outline
      this.ctx.strokeStyle = 'rgba(29, 233, 182, 0.3)';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(startX, 0, width, canvasHeight);
    });
  }
  
  drawAutomationCurve() {
    if (this.currentTrackIndex < 0) return;
    
    const track = tracks[this.currentTrackIndex];
    const points = track.volumeAuto.points;
    if (points.length < 2) return;
    
    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;
    const duration = this.getTrackDuration();
    
    this.ctx.strokeStyle = '#ff9500';
    this.ctx.lineWidth = 3;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    
    // Add glow effect
    this.ctx.shadowColor = '#ff9500';
    this.ctx.shadowBlur = 8;
    
    this.ctx.beginPath();
    
    // Sort points by time
    const sortedPoints = [...points].sort((a, b) => a.time - b.time);
    
    sortedPoints.forEach((point, index) => {
      const x = (point.time / duration) * canvasWidth;
      const y = canvasHeight - (point.value * canvasHeight);
      
      if (index === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    });
    
    this.ctx.stroke();
    
    // Reset shadow
    this.ctx.shadowColor = 'transparent';
    this.ctx.shadowBlur = 0;
  }
  
  drawAutomationPoints() {
    if (this.currentTrackIndex < 0) return;
    
    const track = tracks[this.currentTrackIndex];
    const points = track.volumeAuto.points;
    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;
    const duration = this.getTrackDuration();
    
    points.forEach((point, index) => {
      const x = (point.time / duration) * canvasWidth;
      const y = canvasHeight - (point.value * canvasHeight);
      const isSelected = index === this.selectedPointIndex;
      
      // Draw point
      this.ctx.fillStyle = isSelected ? '#1de9b6' : '#ff9500';
      this.ctx.strokeStyle = 'white';
      this.ctx.lineWidth = 2;
      
      this.ctx.beginPath();
      this.ctx.arc(x, y, isSelected ? 8 : 6, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
      
      // Draw selection highlight
      if (isSelected) {
        this.ctx.strokeStyle = '#ff9500';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(x, y, 12, 0, Math.PI * 2);
        this.ctx.stroke();
      }
    });
  }
  
  onMouseDown(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Check if clicking on an existing point
    const clickedPointIndex = this.findPointAtPosition(x, y);
    
    if (clickedPointIndex >= 0) {
      // Select and prepare to drag existing point
      this.selectedPointIndex = clickedPointIndex;
      this.isDragging = true;
      
      const track = tracks[this.currentTrackIndex];
      const point = track.volumeAuto.points[clickedPointIndex];
      const duration = this.getTrackDuration();
      
      const pointX = (point.time / duration) * this.canvas.width;
      const pointY = this.canvas.height - (point.value * this.canvas.height);
      
      this.dragOffset = {
        x: x - pointX,
        y: y - pointY
      };
      
      // Change cursor and visual feedback
      this.canvas.style.cursor = 'grabbing';
      
      // Prevent default to avoid text selection
      e.preventDefault();
    } else {
      // Create new point
      this.createPointAtPosition(x, y);
    }
    
    this.updateSelectedPointInfo();
    this.redraw();
  }
  
  onMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (this.isDragging && this.selectedPointIndex >= 0) {
      // Dragging a point
      const adjustedX = x - this.dragOffset.x;
      const adjustedY = y - this.dragOffset.y;
      
      this.updatePointPosition(this.selectedPointIndex, adjustedX, adjustedY);
      this.updateSelectedPointInfo();
      this.redraw();
      e.preventDefault();
    } else {
      // Check for hover over points for cursor change
      const hoveredPointIndex = this.findPointAtPosition(x, y);
      if (hoveredPointIndex >= 0) {
        this.canvas.style.cursor = 'grab';
      } else {
        this.canvas.style.cursor = 'crosshair';
      }
    }
  }
  
  onMouseUp(e) {
    if (this.isDragging) {
      this.isDragging = false;
      this.dragOffset = { x: 0, y: 0 };
      
      // Reset cursor
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const hoveredPointIndex = this.findPointAtPosition(x, y);
      
      this.canvas.style.cursor = hoveredPointIndex >= 0 ? 'grab' : 'crosshair';
      
      // Sort points after drag to maintain time order
      if (this.currentTrackIndex >= 0) {
        const track = tracks[this.currentTrackIndex];
        const selectedPoint = track.volumeAuto.points[this.selectedPointIndex];
        track.volumeAuto.points.sort((a, b) => a.time - b.time);
        
        // Update selected index after sorting
        if (selectedPoint) {
          this.selectedPointIndex = track.volumeAuto.points.findIndex(p => 
            Math.abs(p.time - selectedPoint.time) < 0.01 && 
            Math.abs(p.value - selectedPoint.value) < 0.01
          );
        }
        
        this.updateSelectedPointInfo();
        this.redraw();
      }
    }
  }
  
  onDoubleClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const clickedPointIndex = this.findPointAtPosition(x, y);
    if (clickedPointIndex >= 0) {
      this.deletePoint(clickedPointIndex);
    }
  }
  
  onMouseLeave(e) {
    // Reset cursor and stop dragging if mouse leaves canvas
    this.canvas.style.cursor = 'crosshair';
    if (this.isDragging) {
      this.isDragging = false;
      this.dragOffset = { x: 0, y: 0 };
      
      // Sort points after drag to maintain time order
      if (this.currentTrackIndex >= 0) {
        const track = tracks[this.currentTrackIndex];
        const selectedPoint = track.volumeAuto.points[this.selectedPointIndex];
        track.volumeAuto.points.sort((a, b) => a.time - b.time);
        
        // Update selected index after sorting
        if (selectedPoint) {
          this.selectedPointIndex = track.volumeAuto.points.findIndex(p => 
            Math.abs(p.time - selectedPoint.time) < 0.01 && 
            Math.abs(p.value - selectedPoint.value) < 0.01
          );
        }
        
        this.updateSelectedPointInfo();
        this.redraw();
      }
    }
  }
  
  findPointAtPosition(x, y) {
    if (this.currentTrackIndex < 0) return -1;
    
    const track = tracks[this.currentTrackIndex];
    const duration = this.getTrackDuration();
    const threshold = 20; // Increased hit area for better usability
    
    // Find closest point within threshold
    let closestIndex = -1;
    let closestDistance = threshold + 1;
    
    for (let i = 0; i < track.volumeAuto.points.length; i++) {
      const point = track.volumeAuto.points[i];
      const pointX = (point.time / duration) * this.canvas.width;
      const pointY = this.canvas.height - (point.value * this.canvas.height);
      
      const distance = Math.sqrt((x - pointX) ** 2 + (y - pointY) ** 2);
      if (distance <= threshold && distance < closestDistance) {
        closestDistance = distance;
        closestIndex = i;
      }
    }
    
    return closestIndex;
  }
  
  createPointAtPosition(x, y) {
    if (this.currentTrackIndex < 0) return;
    
    const duration = this.getTrackDuration();
    const time = Math.max(0, Math.min(duration, (x / this.canvas.width) * duration));
    const value = Math.max(0, Math.min(1, 1 - (y / this.canvas.height)));
    
    const track = tracks[this.currentTrackIndex];
    const newPoint = { time, value };
    
    // Insert point in correct time order
    let insertIndex = track.volumeAuto.points.length;
    for (let i = 0; i < track.volumeAuto.points.length; i++) {
      if (track.volumeAuto.points[i].time > time) {
        insertIndex = i;
        break;
      }
    }
    
    track.volumeAuto.points.splice(insertIndex, 0, newPoint);
    this.selectedPointIndex = insertIndex;
    
    this.updateTrackInfo();
    console.log('Created automation point:', newPoint);
  }
  
  updatePointPosition(pointIndex, x, y) {
    if (this.currentTrackIndex < 0 || pointIndex < 0) return;
    
    const track = tracks[this.currentTrackIndex];
    const point = track.volumeAuto.points[pointIndex];
    if (!point) return;
    
    const duration = this.getTrackDuration();
    let newTime = Math.max(0, Math.min(duration, (x / this.canvas.width) * duration));
    let newValue = Math.max(0, Math.min(1, 1 - (y / this.canvas.height)));
    
    // Snap to grid if close (optional - makes it easier to align)
    const timeSnapThreshold = duration / this.canvas.width * 5; // 5 pixel snap
    const valueSnapThreshold = 1 / this.canvas.height * 5; // 5 pixel snap
    
    // Snap to quarter beats for time
    const quarterBeat = 0.25;
    const nearestQuarter = Math.round(newTime / quarterBeat) * quarterBeat;
    if (Math.abs(newTime - nearestQuarter) < timeSnapThreshold) {
      newTime = nearestQuarter;
    }
    
    // Snap to 10% increments for volume
    const volumeIncrement = 0.1;
    const nearestVolume = Math.round(newValue / volumeIncrement) * volumeIncrement;
    if (Math.abs(newValue - nearestVolume) < valueSnapThreshold) {
      newValue = nearestVolume;
    }
    
    // Prevent overlapping points at the same time
    const existingAtTime = track.volumeAuto.points.find((p, i) => 
      i !== pointIndex && Math.abs(p.time - newTime) < 0.01
    );
    if (existingAtTime) {
      newTime = point.time; // Keep original time if would overlap
    }
    
    point.time = newTime;
    point.value = Math.max(0, Math.min(1, newValue));
  }
  
  addPoint() {
    // Add point at center of canvas
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    this.createPointAtPosition(centerX, centerY);
    this.redraw();
  }
  
  deleteSelectedPoint() {
    this.deletePoint(this.selectedPointIndex);
  }
  
  deletePoint(pointIndex) {
    if (this.currentTrackIndex < 0 || pointIndex < 0) return;
    
    const track = tracks[this.currentTrackIndex];
    if (track.volumeAuto.points.length <= 2) {
      alert('Cannot delete - automation needs at least 2 points');
      return;
    }
    
    track.volumeAuto.points.splice(pointIndex, 1);
    this.selectedPointIndex = -1;
    
    this.updateTrackInfo();
    this.updateSelectedPointInfo();
    this.redraw();
    
    console.log('Deleted automation point at index:', pointIndex);
  }
  
  clearAllPoints() {
    if (!confirm('Clear all automation points? This cannot be undone.')) {
      return;
    }
    
    if (this.currentTrackIndex < 0) return;
    
    const track = tracks[this.currentTrackIndex];
    const duration = this.getTrackDuration();
    
    // Reset to basic 2-point automation
    track.volumeAuto.points = [
      { time: 0, value: 0.8 },
      { time: duration, value: 0.8 }
    ];
    
    this.selectedPointIndex = -1;
    this.updateTrackInfo();
    this.updateSelectedPointInfo();
    this.redraw();
  }
  
  previewAutomation() {
    if (this.currentTrackIndex < 0) return;
    
    console.log('Preview automation for track:', this.currentTrackIndex);
    // This would integrate with the audio playback system
    // For now, just log the automation data
    const track = tracks[this.currentTrackIndex];
    console.log('Automation points:', track.volumeAuto.points);
  }
  
  saveAutomation() {
    if (this.currentTrackIndex < 0) return;
    
    const track = tracks[this.currentTrackIndex];
    
    // Enable automation for this track
    track.volumeAuto.enabled = true;
    
    // Update the automation button state
    this.updateAutomationButtonState();
    
    // Save the project state
    saveState();
    
    // Re-render tracks to show updated button state
    renderTracks();
    
    console.log('Saved automation for track:', this.currentTrackIndex);
    console.log('Automation points:', track.volumeAuto.points);
    
    this.close();
  }
  
  updateAutomationButtonState() {
    const track = tracks[this.currentTrackIndex];
    const trackHeader = document.querySelector(`[data-track="${this.currentTrackIndex}"].track-header`);
    if (trackHeader) {
      const automationBtn = trackHeader.querySelector('.automation-btn');
      if (automationBtn) {
        if (track.volumeAuto.enabled) {
          automationBtn.classList.add('active');
        } else {
          automationBtn.classList.remove('active');
        }
      }
    }
  }
}

// Initialize Track Automation Manager
let trackAutomationManager;

// Function to open track automation (called from track button)
function openTrackAutomation(trackIndex) {
  if (!trackAutomationManager) {
    trackAutomationManager = new TrackAutomationManager();
  }
  trackAutomationManager.open(trackIndex);
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    trackAutomationManager = new TrackAutomationManager();
  }, 200);
});


