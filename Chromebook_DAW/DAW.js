const BASE_PIXELS_PER_SEC = 110;
const MIN_CLIP_WIDTH = 36;
const DEFAULT_TRACKS = 2;
const DEFAULT_BPM = 120;
const DEFAULT_SIG_NUM = 4;
const DEFAULT_SIG_DEN = 4;
const MAX_TIME = 3600; // seconds (1 hour instead of 180 seconds)
const MAX_BARS = 999; // Essentially unlimited
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
let clipboard = null; // For copy/paste operations
let undoStack = [];
let redoStack = [];
let activeAudioSources = []; // Track active audio sources for proper stopping

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

// --- Data Model ---
function createTrack(label, color) {
  return {
    label: label || `Track ${tracks.length + 1}`,
    color: color || TRACK_COLORS[tracks.length % TRACK_COLORS.length],
    clips: [],
    muted: false,
    solo: false,
    armed: false,
    volume: 0.8,
    pan: 0,
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
function getTotalBars() { 
  // Calculate based on actual content or minimum display
  let maxTime = MAX_TIME;
  
  // Find the furthest clip end time
  tracks.forEach(track => {
    track.clips.forEach(clip => {
      maxTime = Math.max(maxTime, clip.startTime + clip.duration + 60); // Add 60s buffer
    });
  });
  
  return Math.min(Math.ceil(maxTime / getSecPerBar()), MAX_BARS);
}
function getTimelineWidth() {
  // Add TRACK_HEADER_WIDTH to timeline width so grid/playhead align with clips
  return TRACK_HEADER_WIDTH + Math.max(getTotalBars() * getSecPerBar() * PIXELS_PER_SEC, 1200);
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
  const showTriplets = zoomLevel > 1.2;

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
    // Remove marginLeft so clips start at measure 1
    // trackDiv.style.marginLeft = TRACK_HEADER_WIDTH + 'px'; // REMOVE THIS LINE

    // Render Clips with enhanced features
    track.clips.forEach((clip, cIdx) => {
      let clipDiv = document.createElement('div');
      clipDiv.className = 'clip' + (clip.selected ? ' selected' : '');
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
  
  try {
    initAudioContext();
    let stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        sampleRate: 44100
      } 
    });
    
    mediaRecorder = new MediaRecorder(stream, { 
      mimeType: 'audio/webm;codecs=opus',
      audioBitsPerSecond: 128000
    });
    
    recordedChunks = [];
    liveRecordingBuffer = [];
    liveRecordingStart = playheadTime;
    
    // Create input node for live preview only (no feedback)
    let inputNode = audioCtx.createMediaStreamSource(stream);
    
    // Live preview processing WITHOUT connecting to destination (no feedback)
    let processor = audioCtx.createScriptProcessor(4096, 1, 1);
    inputNode.connect(processor);
    // DON'T connect processor to destination to avoid feedback
    processor.connect(audioCtx.createGain()); // Connect to a dummy gain node
    
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

    mediaRecorder.ondataavailable = e => { 
      if (e.data.size > 0) {
        recordedChunks.push(e.data); 
      }
    };
    
    mediaRecorder.onstop = async () => {
      console.log('MediaRecorder stopped, processing audio...');
      
      // Clean up audio nodes
      try {
        processor.disconnect();
        inputNode.disconnect();
        stream.getTracks().forEach(track => track.stop());
      } catch (e) {
        console.log('Error cleaning up audio nodes:', e);
      }
      
      if (recordedChunks.length === 0) { 
        console.log('No audio data recorded');
        isRecording = false; 
        recordBtn.disabled = false; 
        stopBtn.disabled = true; 
        return; 
      }
      
      try {
        const blob = new Blob(recordedChunks, { type: 'audio/webm' });
        const arrayBuffer = await blob.arrayBuffer();
        
        audioCtx.decodeAudioData(arrayBuffer, (buffer) => {
          let targetTracks = tracks.filter(t => t.armed);
          if (targetTracks.length === 0) targetTracks = [tracks[selectedTrackIndex]];
          
          targetTracks.forEach(track => {
            let trackIndex = tracks.indexOf(track);
            const clipName = `Recording ${new Date().toLocaleTimeString()}`;
            addClipToTrack(trackIndex, buffer, liveRecordingStart, buffer.duration, undefined, clipName);
          });
          
          liveRecordingBuffer = [];
          saveState();
          render();
          console.log('Recording processed and added to track');
        }, (error) => {
          console.error('Error decoding audio data:', error);
          alert('Error processing recorded audio. Try again.');
        });
      } catch (error) {
        console.error('Error processing recording:', error);
        alert('Error processing recorded audio. Try again.');
      }
      
      isRecording = false;
      recordBtn.disabled = false;
      stopBtn.disabled = true;
    };

    mediaRecorder.onerror = (event) => {
      console.error('MediaRecorder error:', event.error);
      isRecording = false;
      recordBtn.disabled = false;
      stopBtn.disabled = true;
    };

    mediaRecorder.start(100); // Record in 100ms chunks for better quality
    isRecording = true;
    recordBtn.disabled = true;
    stopBtn.disabled = false;
    
    console.log('Recording started');
    
    if (metronomeEnabled) startMetronome();
    
  } catch (error) {
    console.error('Error starting recording:', error);
    alert('Error accessing microphone. Please check permissions.');
    isRecording = false;
    recordBtn.disabled = false;
    stopBtn.disabled = true;
  }
};

// Improved stop button handler
stopBtn.onclick = () => {
  console.log('Stop button clicked, isRecording:', isRecording);
  
  if (isRecording) {
    console.log('Stopping recording...');
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
    } else {
      // Force stop if mediaRecorder is in weird state
      isRecording = false;
      recordBtn.disabled = false;
      stopBtn.disabled = true;
      liveRecordingBuffer = [];
      render();
    }
  }
  
  // Always stop playback
  if (playing) {
    pauseAll();
  }
  
  // Reset playhead to beginning
  playheadTime = 0;
  renderTimeline();
};

// --- Timeline and Playhead (MODIFY EXISTING) ---
timelineDiv.onclick = (e) => {
  // Fix offset calculation to account for header width
  const rect = timelineDiv.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const adjustedX = clickX - TRACK_HEADER_WIDTH; // Account for header offset
  let rawTime = Math.max(0, adjustedX / PIXELS_PER_SEC);
  
  let gridTimes = getGridTimes();

  // Collect all clip edges
  let clipEdges = [];
  tracks.forEach(track => {
    track.clips.forEach(clip => {
      clipEdges.push(clip.startTime);
      clipEdges.push(clip.startTime + clip.duration);
    });
  });

  // Combine grid and clip edges
  let snapPoints = gridTimes.concat(clipEdges);

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
  const showTriplets = zoomLevel > 1.2;

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

// --- Enhanced Context Menus ---
function showClipContextMenu(e, tIdx, cIdx, clipDiv) {
  removeContextMenu();
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.left = e.clientX + 'px';
  menu.style.top = e.clientY + 'px';

  let actions = [
    {label: 'Copy', fn: () => { selectClip(tIdx, cIdx); copySelectedClip(); }},
    {label: 'Paste', fn: () => { pasteClip(); }},
    {sep:true},
    {label: 'Split at cursor', fn: () => splitClip(tIdx, cIdx, ((e.offsetX-8)/clipDiv.offsetWidth)) },
    {label: 'Delete', fn: () => { tracks[tIdx].clips.splice(cIdx,1); saveState(); render(); }},
    {label: 'Duplicate', fn: () => { duplicateClip(tIdx, cIdx); }},
    {label: 'Quantize', fn: () => { selectClip(tIdx, cIdx); quantizeSelectedClip(); }},
    {sep:true},
    {label: 'Fade In', fn: () => { fadeInClip(tIdx, cIdx); saveState(); }},
    {label: 'Fade Out', fn: () => { fadeOutClip(tIdx, cIdx); saveState(); }},
    {label: 'Normalize', fn: () => { normalizeClip(tIdx, cIdx); }},
    {label: 'Reverse', fn: () => { reverseClip(tIdx, cIdx); }},
    {sep:true},
    {label: 'Rename', fn: () => { renameClip(tIdx, cIdx); }},
    {label: 'Export Clip', fn: () => { exportClip(tIdx, cIdx); }},
    {label: 'Move to New Track', fn: () => { moveClipToNewTrack(tIdx, cIdx); }},
    {sep:true},
    {label: 'Change Color', color:true, fn: (color) => { changeClipColor(tIdx, cIdx, color); }}
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
      colorInput.oninput = (ev) => { act.fn(ev.target.value); removeContextMenu(); };
      item.appendChild(colorInput);
    } else {
      item.onclick = () => { act.fn(); removeContextMenu(); };
    }
    menu.appendChild(item);
  });
  document.body.appendChild(menu);
  contextMenuEl = menu;
  document.addEventListener('mousedown', removeContextMenu, {once: true});
}
function showTrackContextMenu(e, tIdx, trackDiv) {
  removeContextMenu();
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.left = e.clientX + 'px';
  menu.style.top = e.clientY + 'px';

  let actions = [
    {label: tracks[tIdx].muted ? "Unmute" : "Mute", fn: () => { tracks[tIdx].muted = !tracks[tIdx].muted; render(); }},
    {label: tracks[tIdx].solo ? "Unsolo" : "Solo", fn: () => { tracks[tIdx].solo = !tracks[tIdx].solo; render(); }},
    {label: 'Rename Track', fn: () => { renameTrack(tIdx); }},
    {label: 'Delete Track', fn: () => { tracks.splice(tIdx,1); render(); }},
    {label: 'Add New Clip (Silence)', fn: () => { addSilenceClip(tIdx); }},
    {sep:true},
    {label: 'Change Track Color', color:true, fn: (color) => { tracks[tIdx].color = color; render(); }},
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
      colorInput.oninput = (ev) => { act.fn(ev.target.value); removeContextMenu(); };
      item.appendChild(colorInput);
    } else {
      item.onclick = () => { act.fn(); removeContextMenu(); };
    }
    menu.appendChild(item);
  });
  document.body.appendChild(menu);
  contextMenuEl = menu;
  document.addEventListener('mousedown', removeContextMenu, {once: true});
}
function removeContextMenu() {
  if (contextMenuEl) contextMenuEl.remove();
  contextMenuEl = null;
}
// --- Clip DAW Actions ---
function splitClip(tIdx, cIdx, splitTime) {
  let clip = tracks[tIdx].clips[cIdx];
  
  // Validate that split time is within the clip bounds
  if (splitTime <= clip.startTime || splitTime >= clip.startTime + clip.duration) {
    console.log('Split time is outside clip bounds');
    return;
  }
  
  // Calculate the split position relative to clip start
  const splitOffset = splitTime - clip.startTime;
  
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
  
  // Replace original clip with the two new clips
  tracks[tIdx].clips.splice(cIdx, 1, firstClip, secondClip);
  
  // Sort clips by start time to maintain order
  tracks[tIdx].clips.sort((a, b) => a.startTime - b.startTime);
  
  saveState();
  render();
}

function duplicateClip(tIdx, cIdx) {
  let orig = tracks[tIdx].clips[cIdx];
  // Place duplicate immediately after the original clip
  let dup = createClip(
    orig.audioBuffer, 
    orig.startTime + orig.duration, 
    orig.duration, 
    orig.offset, 
    orig.color, 
    orig.name + " Copy"
  );
  tracks[tIdx].clips.push(dup);
  
  // Sort clips by start time
  tracks[tIdx].clips.sort((a, b) => a.startTime - b.startTime);
  
  saveState();
  render();
}

function reverseClip(tIdx, cIdx) {
  let clip = tracks[tIdx].clips[cIdx];
  if (!clip.audioBuffer) return;
  
  // Create a new buffer with the same properties
  const originalBuffer = clip.audioBuffer;
  const newBuffer = audioCtx.createBuffer(
    originalBuffer.numberOfChannels,
    originalBuffer.length,
    originalBuffer.sampleRate
  );
  
  // Reverse each channel
  for (let channel = 0; channel < originalBuffer.numberOfChannels; channel++) {
    const originalData = originalBuffer.getChannelData(channel);
    const newData = newBuffer.getChannelData(channel);
    
    for (let i = 0; i < originalData.length; i++) {
      newData[i] = originalData[originalData.length - 1 - i];
    }
  }
  
  clip.audioBuffer = newBuffer;
  saveState();
  render();
}

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
  
  console.log('Starting playback at', startOffset, 'seconds'); // Debug log
  
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
    
    track.clips.forEach(clip => {
      if (!clip.audioBuffer) return;
      
      const clipStartTime = clip.startTime;
      const clipEndTime = clipStartTime + clip.duration;
      
      // Only play clips that intersect with current playhead position
      if (clipEndTime > startOffset) {
        const source = audioCtx.createBufferSource();
        source.buffer = clip.audioBuffer;
        source.connect(trackGain);
        
        // Calculate when to start playing this clip
        const playDelay = Math.max(0, clipStartTime - startOffset);
        const sourceOffset = Math.max(0, startOffset - clipStartTime) + clip.offset;
        const sourceDuration = Math.min(clip.duration, clipEndTime - Math.max(startOffset, clipStartTime));
        
        if (sourceDuration > 0) {
          console.log('Playing clip:', clip.name, 'delay:', playDelay, 'offset:', sourceOffset, 'duration:', sourceDuration); // Debug log
          
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
    
    // Stop at max time
    if (playheadTime >= MAX_TIME) {
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
  playheadTime = 0;
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

// --- Keyboard Shortcuts (MODIFY EXISTING) ---
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return; // Don't trigger when typing in inputs
  
  switch (e.key) {
    case ' ':
      e.preventDefault();
      console.log('Spacebar pressed, playing:', playing); // Debug log
      if (playing) pauseAll();
      else playAll();
      break;
    case 'r':
    case 'R':
      if (!isRecording) recordBtn.click();
      break;
    case 's':
    case 'S':
      stopBtn.click();
      break;
    case 'z':
    case 'Z':
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
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
  }
});

// --- Timeline Context Menu for Auto-scroll ---
timelineDiv.addEventListener('contextmenu', function(e) {
  e.preventDefault();
  removeContextMenu();
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.left = e.clientX + 'px';
  menu.style.top = e.clientY + 'px';

  let autoScrollItem = document.createElement('div');
  autoScrollItem.className = 'context-menu-item';
  autoScrollItem.innerHTML = `<input type="checkbox" id="autoScrollChk" ${autoScrollEnabled ? 'checked' : ''} style="margin-right:8px;vertical-align:middle;">Auto-scroll during playback`;
  autoScrollItem.onclick = (ev) => {
    ev.stopPropagation();
    autoScrollEnabled = !autoScrollEnabled;
    removeContextMenu();
  };
  menu.appendChild(autoScrollItem);

  document.body.appendChild(menu);
  contextMenuEl = menu;
  document.addEventListener('mousedown', removeContextMenu, {once: true});
});

// Add a single delegated context menu for the tracks area
(function setupDelegatedContextMenu() {
  if (!tracksDiv) return;

  function safeCall(fn, ...args) {
    try { if (typeof fn === 'function') return fn(...args); }
    catch (err) { console.error(err); }
  }

  function positionMenu(menu, x, y) {
    // Get viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const menuRect = menu.getBoundingClientRect();
    
    // Adjust position to keep menu within viewport
    let adjustedX = x;
    let adjustedY = y;
    
    if (x + menuRect.width > viewportWidth) {
      adjustedX = Math.max(0, viewportWidth - menuRect.width - 10);
    }
    
    if (y + menuRect.height > viewportHeight) {
      adjustedY = Math.max(0, viewportHeight - menuRect.height - 10);
    }
    
    menu.style.left = adjustedX + 'px';
    menu.style.top = adjustedY + 'px';
    
    // Add scrolling if menu is still too tall
    const maxHeight = viewportHeight - adjustedY - 20;
    if (menuRect.height > maxHeight) {
      menu.style.maxHeight = maxHeight + 'px';
      menu.style.overflowY = 'auto';
    }
  }

  function makeMenu(items, x, y) {
    removeContextMenu();
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    
    // Temporarily position off-screen to measure
    menu.style.left = '-9999px';
    menu.style.top = '-9999px';
    menu.style.visibility = 'hidden';

    items.forEach(item => {
      if (item.sep) {
        const sep = document.createElement('div');
        sep.className = 'context-menu-sep';
        menu.appendChild(sep);
        return;
      }
      const el = document.createElement('div');
      el.className = 'context-menu-item';
      if (item.disabled) {
        el.classList.add('disabled');
      }
      el.innerText = item.label || '';
      if (item.color) {
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = item.colorValue || '#ffffff';
        colorInput.className = 'color-picker';
        colorInput.onclick = ev => ev.stopPropagation();
        colorInput.oninput = ev => { item.onColor && item.onColor(ev.target.value); removeContextMenu(); };
        el.appendChild(colorInput);
      } else if (!item.disabled) {
        el.onclick = ev => {
          ev.preventDefault();
          ev.stopPropagation();
          item.onClick && item.onClick();
          removeContextMenu();
        };
      }
      menu.appendChild(el);
    });

    document.body.appendChild(menu);
    contextMenuEl = menu;
    
    // Show and position correctly
    menu.style.visibility = 'visible';
    positionMenu(menu, x, y);

    // Delay attaching to avoid immediate close on the same gesture (touch/long-press)
    setTimeout(() => {
      const outsideClose = (ev) => {
        if (contextMenuEl && !contextMenuEl.contains(ev.target)) removeContextMenu();
      };
      const escClose = (ev) => {
        if (ev.key === 'Escape') removeContextMenu();
      };
      document.addEventListener('mousedown', outsideClose, { once: true });
      document.addEventListener('keydown', escClose, { once: true });
    }, 10);
  }

  // Global delegation: only handle right-clicks inside #tracks
  document.addEventListener('contextmenu', (e) => {
    const inTracks = e.target.closest('#tracks');
    if (!inTracks) return; // let browser show its own menu elsewhere
    e.preventDefault();
    e.stopPropagation();

    const clipEl = e.target.closest('.clip');
    const trackEl = e.target.closest('.track');
    if (!trackEl) return;

    const tIdx = parseInt(trackEl.dataset.track, 10);
    if (Number.isNaN(tIdx) || tIdx < 0 || tIdx >= tracks.length) return;

    if (clipEl) {
      const cIdx = parseInt(clipEl.dataset.clip, 10);
      if (Number.isNaN(cIdx) || cIdx < 0 || cIdx >= tracks[tIdx].clips.length) return;

      safeCall(selectClip, tIdx, cIdx);

      const clip = tracks[tIdx].clips[cIdx];
      
      // Check if playhead is within this clip for split option
      const canSplit = playheadTime > clip.startTime && playheadTime < clip.startTime + clip.duration;

      makeMenu([
        { label: 'Copy', onClick: () => safeCall(copySelectedClip) },
        { label: 'Paste', onClick: () => safeCall(pasteClip) },
        { sep: true },
        { 
          label: canSplit ? 'Split at Playhead' : 'Split (playhead not in range)', 
          onClick: canSplit ? () => safeCall(splitClip, tIdx, cIdx, playheadTime) : null,
          disabled: !canSplit
        },
        { label: 'Delete', onClick: () => { tracks[tIdx].clips.splice(cIdx, 1); safeCall(saveState); safeCall(render); } },
        { label: 'Duplicate', onClick: () => safeCall(duplicateClip, tIdx, cIdx) },
        { label: 'Quantize', onClick: () => { safeCall(selectClip, tIdx, cIdx); safeCall(quantizeSelectedClip); } },
        { sep: true },
        { label: 'Fade In', onClick: () => { safeCall(fadeInClip, tIdx, cIdx); safeCall(saveState); } },
        { label: 'Fade Out', onClick: () => { safeCall(fadeOutClip, tIdx, cIdx); safeCall(saveState); } },
        { label: 'Normalize', onClick: () => safeCall(normalizeClip, tIdx, cIdx) },
        { label: 'Reverse', onClick: () => safeCall(reverseClip, tIdx, cIdx) },
        { sep: true },
        { label: 'Rename', onClick: () => safeCall(renameClip, tIdx, cIdx) },
        { label: 'Export', onClick: () => safeCall(exportClip, tIdx, cIdx) },
        { label: 'Move to New Track', onClick: () => safeCall(moveClipToNewTrack, tIdx, cIdx) },
        { sep: true },
        { label: 'Change Color', color: true, colorValue: clip.color, onColor: (color) => { safeCall(changeClipColor, tIdx, cIdx, color); } },
      ], e.clientX, e.clientY);

    } else {
      const track = tracks[tIdx];
      makeMenu([
        { label: track.muted ? 'Unmute' : 'Mute', onClick: () => { track.muted = !track.muted; safeCall(render); } },
        { label: track.solo ? 'Unsolo' : 'Solo', onClick: () => { track.solo = !track.solo; safeCall(render); } },
        { label: 'Rename', onClick: () => safeCall(renameTrack, tIdx) },
        { label: 'Delete Track', onClick: () => {
            if (tracks.length <= 1) { alert('Cannot delete the last track'); return; }
            if (confirm(`Delete track "${track.label}"?`)) {
              tracks.splice(tIdx, 1);
              if (selectedTrackIndex >= tracks.length) selectedTrackIndex = tracks.length - 1;
              safeCall(saveState);
              safeCall(render);
            }
          }
        },
        { label: 'Add Silence Clip', onClick: () => safeCall(addSilenceClip, tIdx) },
        { sep: true },
        { label: 'Paste', onClick: () => safeCall(pasteClip) },
        { label: 'Change Color', color: true, colorValue: track.color, onColor: (color) => { track.color = color; safeCall(saveState); safeCall(render); } },
      ], e.clientX, e.clientY);
    }
  });
})();