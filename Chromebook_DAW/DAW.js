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
const TRACK_HEADER_WIDTH = 200; // px, must match .track-header width in CSS

// --- State ---
let tracks = [];
let selectedTrackIndex = 0;
let audioCtx = null;
let isRecording = false;
let mediaRecorder = null;
let recordedChunks = [];
let liveRecordingBuffer = [];
let liveRecordingStart = 0;
let playheadTime = 0;
let playRequestId = null;
let playing = false;
let selectedClip = null;
let copiedClip = null;
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
let trackInsertChains = new Map(); // Per-track insert plugin chains { chain: [{id, instance, slotIndex}], inputNode, outputNode }
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
  automation: 'read', // read | write | latch | touch
    selected: false,
    id: Math.random().toString(36).slice(2,9)
  };
}
function createClip(audioBuffer, startTime, duration, offset=0, color, name) {
  return {
    id: Math.random().toString(36).slice(2,9),
    audioBuffer,
    startTime, // in seconds
    duration,  // in seconds
    offset,    // in seconds, offset in source buffer
    selected: false,
    color: color || CLIP_COLORS[Math.floor(Math.random()*CLIP_COLORS.length)],
    name: name || "Clip"
  };
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
    
    trackControls.appendChild(armBtn);
    trackControls.appendChild(muteBtn);
    trackControls.appendChild(soloBtn);
    trackControls.appendChild(volumeContainer);
    
    trackHeader.appendChild(trackInfo);
    trackHeader.appendChild(trackControls);
    
    // Track Area (for clips)
    let trackDiv = document.createElement('div');
    trackDiv.className = 'track' + (track.muted ? ' muted' : '') + (track.selected ? ' selected' : '');
    trackDiv.style.height = "90px";
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

      // Dragging
      clipDiv.addEventListener('dragstart', (e) => {
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
}

// --- Track Management Functions ---
function selectTrack(trackIndex) {
  tracks.forEach((track, idx) => {
    track.selected = idx === trackIndex;
  });
  selectedTrackIndex = trackIndex;
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

// --- Recording ---
recordBtn.onclick = async () => {
  if (isRecording) return;
  
  // Find armed tracks or use selected track
  let armedTracks = tracks.filter(t => t.armed);
  if (armedTracks.length === 0) {
    // Auto-arm selected track if no tracks are armed
    tracks[selectedTrackIndex].armed = true;
    render();
  }
  
  initAudioContext();
  let stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
  recordedChunks = [];
  liveRecordingBuffer = [];
  liveRecordingStart = playheadTime;
  let inputNode = audioCtx.createMediaStreamSource(stream);

  // Create processing chain: input -> analyser -> gain -> destination
  let recordGain = audioCtx.createGain();
  recordGain.gain.value = 0.8;
  
  inputNode.connect(analyserNode);
  analyserNode.connect(recordGain);
  recordGain.connect(audioCtx.destination);

  // Live preview processing - FIX THIS PART
  let processor = audioCtx.createScriptProcessor(4096, 1, 1);
  inputNode.connect(processor);
  processor.connect(audioCtx.destination); // Connect to hear the input
  
  processor.onaudioprocess = (e) => {
    if (!isRecording) return;
    
    let input = e.inputBuffer.getChannelData(0);
    // Convert Float32Array to regular array and add to buffer
    liveRecordingBuffer = liveRecordingBuffer.concat(Array.from(input));
    
    // Limit buffer size to prevent memory issues
    if (liveRecordingBuffer.length > audioCtx.sampleRate * 300) {
      processor.disconnect();
      inputNode.disconnect();
    }
    
    // Trigger re-render to show recording preview
    render();
  };

  mediaRecorder.ondataavailable = e => { recordedChunks.push(e.data); };
  mediaRecorder.onstop = async () => {
    processor.disconnect();
    inputNode.disconnect();
    recordGain.disconnect();
    
    if (recordedChunks.length === 0) { 
      isRecording = false; 
      recordBtn.disabled = false; 
      stopBtn.disabled = true; 
      return; 
    }
    
    const blob = new Blob(recordedChunks, { type: 'audio/webm' });
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
    });
    isRecording = false;
    recordBtn.disabled = false;
    stopBtn.disabled = true;
  };

  mediaRecorder.start();
  isRecording = true;
  recordBtn.disabled = true;
  stopBtn.disabled = false;
  if (metronomeEnabled) startMetronome();
};

// Add this handler to allow stopping recording via stopBtn
stopBtn.onclick = () => {
  if (isRecording && mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
  }
  stopAll();
};

// --- Audio Playback Functions (MODIFY EXISTING) ---
function playAll() {
  if (playing) return;
  
  initAudioContext();
  
  // Ensure audio context is running
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().then(() => {
      startPlayback();
    });
  } else {
    startPlayback();
  }
}

function startPlayback() {
  playing = true;
  playBtn.disabled = true;
  pauseBtn.disabled = false;
  
  const startTime = audioCtx.currentTime;
  const startOffset = playheadTime;
  
  console.log('Starting playback at', startOffset, 'seconds, max bars:', getTotalBars()); // Debug log
  
  // Clear any existing sources
  stopAllAudioSources();
  
  // Start metronome if enabled
  if (metronomeEnabled) startMetronome();
  
  // Schedule all clips for playback
  let activeSourcesCount = 0;
  tracks.forEach((track, trackIndex) => {
    if (track.muted) return;
    
    // Check if any track is soloed
    const hasSoloTracks = tracks.some(t => t.solo);
    if (hasSoloTracks && !track.solo) return;
    
    const trackGain = getTrackGainNode(trackIndex);
    trackGain.gain.value = track.volume;
    // Prepare insert chain once per track
    const trackChain = ensureTrackInsertChain(trackIndex);
    if (trackChain && trackChain.inputNode && trackChain.outputNode) {
      try { trackChain.outputNode.disconnect(); } catch {}
      try { trackChain.outputNode.connect(trackGain); } catch {}
    }
    
    track.clips.forEach(clip => {
      if (!clip.audioBuffer) return;
      
      const clipStartTime = clip.startTime;
      const clipEndTime = clipStartTime + clip.duration;
      
      // Only play clips that intersect with current playhead position
      if (clipEndTime > startOffset) {
        const source = audioCtx.createBufferSource();
        source.buffer = clip.audioBuffer;
        // Route through insert chain if present (already connected output once)
        if (trackChain && trackChain.inputNode && trackChain.outputNode) {
          source.connect(trackChain.inputNode);
        } else {
          source.connect(trackGain);
        }
        
        // Calculate when to start playing this clip
        const playDelay = Math.max(0, clipStartTime - startOffset);
        const sourceOffset = Math.max(0, startOffset - clipStartTime) + clip.offset;
        const sourceDuration = Math.min(clip.duration, clipEndTime - Math.max(startOffset, clipStartTime));
        
        if (sourceDuration > 0) {
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
          activeSourcesCount++;
        }
      }
    });
  });
  
  console.log('Active audio sources:', activeSourcesCount); // Debug log
  
  // Update playhead during playback
  const updatePlayheadLoop = () => {
    if (!playing) return;
    
    playheadTime = startOffset + (audioCtx.currentTime - startTime);
    
    // Calculate current bar for debugging
    const currentBar = Math.floor(playheadTime / getSecPerBar()) + 1;
    
    // Auto-scroll if enabled
    if (autoScrollEnabled) {
      const workspaceEl = document.getElementById('workspace');
      const gridOffset = TRACK_HEADER_WIDTH;
      const playheadX = gridOffset + playheadTime * PIXELS_PER_SEC;
      const workspaceWidth = workspaceEl.clientWidth;
      const scrollLeft = Math.max(0, playheadX - workspaceWidth / 2);
      workspaceEl.scrollLeft = scrollLeft;
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
      source.stop();
      source.disconnect();
    } catch (e) {
      // Source might already be stopped, ignore error
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
  
  // Stop all active audio sources
  stopAllAudioSources();
}

function stopAll() {
  pauseAll();
  // Don't automatically reset to 0 - let user control playhead position
  // playheadTime = 0; // Remove this line
  renderTimeline();
}

// --- Clip Management ---
function addClipToTrack(trackIndex, buffer, startTime, duration, color, name) {
  if (trackIndex >= tracks.length) return;
  tracks[trackIndex].clips.push(createClip(buffer, startTime, duration, 0, color, name));
  render();
}

function addClipToFirstTrack(buffer, startTime, duration, color, name) {
  if (tracks.length === 0) tracks.push(createTrack());
  addClipToTrack(selectedTrackIndex, buffer, startTime, duration, color, name);
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
  }
  
  return audioCtx;
}

function getTrackGainNode(trackIndex) {
  if (!trackGainNodes.has(trackIndex)) {
    const gainNode = audioCtx.createGain();
    gainNode.connect(analyserNode);
    trackGainNodes.set(trackIndex, gainNode);
  }
  return trackGainNodes.get(trackIndex);
}

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
        audioBuffer: null // Don't serialize audio buffer
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
  if (isRawBuffer && Array.isArray(audioBufferOrBuffer)) {
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
      splitClip(tIdx, cIdx, splitTimeToUse);
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
function splitClip(tIdx, cIdx, splitTime) {
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
  
  // Create first clip (from start to split point)
  let firstClip = createClip(
    clip.audioBuffer, 
    clip.startTime, 
    splitOffset, 
    clip.offset, 
    clip.color, 
    clip.name + " (1)"
  );
  
  // Create second clip (from split point to end)
  let secondClip = createClip(
    clip.audioBuffer, 
    splitTime, 
    clip.duration - splitOffset, 
    clip.offset + splitOffset, 
    clip.color, 
    clip.name + " (2)"
  );
  
  tracks[tIdx].clips.splice(cIdx, 1, firstClip, secondClip);
  tracks[tIdx].clips.sort((a, b) => a.startTime - b.startTime);
  
  saveState();
  render();
  console.log('Clip split successfully');
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
    // Read file as ArrayBuffer and decode as audio, then add as a new clip
    const arrayBuffer = await file.arrayBuffer();
    await new Promise((resolve, reject) => {
      audioCtx.decodeAudioData(arrayBuffer, (buffer) => {
        addClipToFirstTrack(buffer, playheadTime, buffer.duration, undefined, file.name.split(".")[0]);
        saveState();
        render();
        resolve();
      }, reject);
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
  if (tracks.length > 0) tracks[0].selected = true;
  initAudioContext();
  loadSettings();
  
  // Set up button handlers here to ensure DOM elements exist
  playBtn.onclick = () => {
    playAll();
  };

  pauseBtn.onclick = () => {
    pauseAll();
  };
  
  saveState();
  render();
}

// Ensure initialization after DOM is loaded
window.onload = init;

// Replace updatePlayhead to auto-scroll horizontally to keep playhead centered if enabled
function updatePlayhead(t) {
  playheadTime = t;
  renderTimeline();

  if (autoScrollEnabled) {
    const workspaceEl = document.getElementById('workspace');
    const gridOffset = TRACK_HEADER_WIDTH;
    const playheadX = gridOffset + playheadTime * PIXELS_PER_SEC;
    const workspaceWidth = workspaceEl.clientWidth;
    // Scroll so playhead is centered, but not before start or after end
    const scrollLeft = Math.max(0, playheadX - workspaceWidth / 2);
    workspaceEl.scrollLeft = scrollLeft;
  }
}

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

      <!-- Compact Pan -->
      <div class="knob-container">
        <div class="text-xs text-gray-400 text-center mb-1">PAN</div>
        <div class="knob-wrapper mx-auto relative">
          <svg class="knob-svg w-full h-full" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="14" fill="#374151" stroke="#4B5563" stroke-width="1"/>
            <circle cx="24" cy="24" r="10" fill="#1F2937" stroke="#6B7280" stroke-width="1"/>
            <path class="knob-indicator" d="M24 6 L24 12" stroke="#10B981" stroke-width="2" stroke-linecap="round" transform="rotate(${track.pan*135} 24 24)"/>
            <circle cx="24" cy="24" r="1" fill="#10B981"/>
          </svg>
          <input type="range" class="knob-input opacity-0 absolute inset-0 w-full h-full cursor-pointer" min="-100" max="100" value="${track.pan * 100}" step="1" data-track="${trackIndex}" data-param="pan">
        </div>
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

      <!-- Compact Automation -->
      <div class="automation">
        <label class="io-label">Auto</label>
        <select class="automation-select" data-track="${trackIndex}">
          <option ${track.automation==='read'?'selected':''} value="read">Read</option>
          <option ${track.automation==='write'?'selected':''} value="write">Write</option>
        </select>
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

  // Automation
  document.querySelectorAll('.automation-select').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const trackIndex = parseInt(e.target.dataset.track);
      const value = e.target.value;
      if (trackIndex >= tracks.length) return;
      tracks[trackIndex].automation = value;
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
    knobSvg.setAttribute('transform', `rotate(${rotation} 24 24)`);
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
      // Use custom UI renderer
      try {
        pluginDef.renderUI('pluginUI', instEntry?.instance);
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
  initializeAudioEditor();

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

/**
 * Initializes the audio editor with the current clip's data
 */
function initializeAudioEditor() {
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

  // Draw the waveform
  drawEditorWaveform();

  // Draw the timeline
  drawEditorTimeline();

  // Set up canvas event listeners for selection
  setupEditorCanvasEvents();

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
  const editorZoomFit = document.getElementById('editorZoomFit');
  const editorZoomIn = document.getElementById('editorZoomIn');
  const editorZoomOut = document.getElementById('editorZoomOut');
  
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