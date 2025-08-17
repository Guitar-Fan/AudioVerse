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
const arrangeViewBtn = document.getElementById('arrangeViewBtn');
const mixerViewBtn = document.getElementById('mixerViewBtn');
const arrangementWindow = document.getElementById('arrangementWindow');
const mixerWindow = document.getElementById('mixerWindow');
const mixerChannels = document.getElementById('mixerChannels');

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

    // Render Clips with context menus
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
  
  arrangeViewBtn.classList.add('bg-orange-500', 'text-black');
  arrangeViewBtn.classList.remove('bg-gray-600', 'text-white');
  mixerViewBtn.classList.add('bg-gray-600', 'text-white');
  mixerViewBtn.classList.remove('bg-orange-500', 'text-black');
}

function showMixerView() {
  currentView = 'mixer';
  mixerWindow.classList.remove('hidden');
  mixerWindow.classList.add('active');
  arrangementWindow.classList.add('hidden');
  arrangementWindow.classList.remove('active');
  
  mixerViewBtn.classList.add('bg-orange-500', 'text-black');
  mixerViewBtn.classList.remove('bg-gray-600', 'text-white');
  arrangeViewBtn.classList.add('bg-gray-600', 'text-white');
  arrangeViewBtn.classList.remove('bg-orange-500', 'text-black');
  
  renderMixer();
}

// Event listeners for window switching
arrangeViewBtn.onclick = showArrangementView;
mixerViewBtn.onclick = showMixerView;

// Mixer Channel Creation and Management
function createMixerChannel(trackIndex, track) {
  const channelId = `mixer-channel-${trackIndex}`;
  
  return `
    <div id="${channelId}" class="mixer-channel bg-gray-800 rounded-lg p-4 w-24 min-h-full border border-gray-700 shadow-lg">
      <!-- Channel Header -->
      <div class="text-center mb-4">
        <div class="text-xs text-gray-400 mb-1">CH ${trackIndex + 1}</div>
        <div class="text-sm font-semibold text-white truncate" title="${track.label}">${track.label}</div>
      </div>
      
      <!-- Input Level Meter -->
      <div class="mb-4">
        <div class="text-xs text-gray-400 mb-1 text-center">IN</div>
        <div class="input-meter bg-gray-900 rounded h-16 w-4 mx-auto relative overflow-hidden">
          <div class="meter-fill bg-gradient-to-t from-green-500 via-yellow-500 to-red-500 w-full absolute bottom-0 transition-all duration-75" style="height: 0%"></div>
        </div>
      </div>
      
      <!-- High EQ Knob -->
      <div class="knob-container mb-3">
        <div class="text-xs text-gray-400 text-center mb-1">HIGH</div>
        <div class="knob-wrapper mx-auto w-12 h-12 relative">
          <svg class="knob-svg w-full h-full" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="20" fill="#374151" stroke="#4B5563" stroke-width="2"/>
            <circle cx="24" cy="24" r="16" fill="#1F2937" stroke="#6B7280" stroke-width="1"/>
            <path class="knob-indicator" d="M24 8 L24 16" stroke="#F97316" stroke-width="2" stroke-linecap="round" transform="rotate(0 24 24)"/>
            <circle cx="24" cy="24" r="2" fill="#F97316"/>
          </svg>
          <input type="range" class="knob-input opacity-0 absolute inset-0 w-full h-full cursor-pointer" min="-12" max="12" value="0" step="0.5" data-track="${trackIndex}" data-param="high">
        </div>
      </div>
      
      <!-- Mid EQ Knob -->
      <div class="knob-container mb-3">
        <div class="text-xs text-gray-400 text-center mb-1">MID</div>
        <div class="knob-wrapper mx-auto w-12 h-12 relative">
          <svg class="knob-svg w-full h-full" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="20" fill="#374151" stroke="#4B5563" stroke-width="2"/>
            <circle cx="24" cy="24" r="16" fill="#1F2937" stroke="#6B7280" stroke-width="1"/>
            <path class="knob-indicator" d="M24 8 L24 16" stroke="#F97316" stroke-width="2" stroke-linecap="round" transform="rotate(0 24 24)"/>
            <circle cx="24" cy="24" r="2" fill="#F97316"/>
          </svg>
          <input type="range" class="knob-input opacity-0 absolute inset-0 w-full h-full cursor-pointer" min="-12" max="12" value="0" step="0.5" data-track="${trackIndex}" data-param="mid">
        </div>
      </div>
      
      <!-- Low EQ Knob -->
      <div class="knob-container mb-4">
        <div class="text-xs text-gray-400 text-center mb-1">LOW</div>
        <div class="knob-wrapper mx-auto w-12 h-12 relative">
          <svg class="knob-svg w-full h-full" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="20" fill="#374151" stroke="#4B5563" stroke-width="2"/>
            <circle cx="24" cy="24" r="16" fill="#1F2937" stroke="#6B7280" stroke-width="1"/>
            <path class="knob-indicator" d="M24 8 L24 16" stroke="#F97316" stroke-width="2" stroke-linecap="round" transform="rotate(0 24 24)"/>
            <circle cx="24" cy="24" r="2" fill="#F97316"/>
          </svg>
          <input type="range" class="knob-input opacity-0 absolute inset-0 w-full h-full cursor-pointer" min="-12" max="12" value="0" step="0.5" data-track="${trackIndex}" data-param="low">
        </div>
      </div>
      
      <!-- Pan Knob -->
      <div class="knob-container mb-4">
        <div class="text-xs text-gray-400 text-center mb-1">PAN</div>
        <div class="knob-wrapper mx-auto w-12 h-12 relative">
          <svg class="knob-svg w-full h-full" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="20" fill="#374151" stroke="#4B5563" stroke-width="2"/>
            <circle cx="24" cy="24" r="16" fill="#1F2937" stroke="#6B7280" stroke-width="1"/>
            <path class="knob-indicator" d="M24 8 L24 16" stroke="#10B981" stroke-width="2" stroke-linecap="round" transform="rotate(0 24 24)"/>
            <circle cx="24" cy="24" r="2" fill="#10B981"/>
          </svg>
          <input type="range" class="knob-input opacity-0 absolute inset-0 w-full h-full cursor-pointer" min="-100" max="100" value="${track.pan * 100}" step="1" data-track="${trackIndex}" data-param="pan">
        </div>
      </div>
      
      <!-- Volume Fader -->
      <div class="fader-container mb-4 h-32">
        <div class="text-xs text-gray-400 text-center mb-2">VOLUME</div>
        <div class="fader-track bg-gray-900 w-6 h-24 mx-auto relative rounded">
          <input type="range" class="volume-fader absolute inset-0 w-full h-full opacity-0 cursor-pointer" min="0" max="1" value="${track.volume}" step="0.01" data-track="${trackIndex}" data-param="volume" orient="vertical">
          <div class="fader-handle absolute w-6 h-3 bg-orange-500 rounded shadow-lg transition-all duration-75" style="bottom: ${track.volume * 100}%; transform: translateY(50%);"></div>
               </div>
        <div class="text-xs text-center mt-1 text-gray-300 volume-display">${Math.round(track.volume * 100)}</div>
      </div>
      
      <!-- Solo/Mute Buttons -->
      <div class="button-group flex gap-1 mb-4">
        <button class="solo-btn flex-1 px-2 py-1 text-xs rounded font-semibold transition-colors ${track.solo ? 'bg-yellow-500 text-black' : 'bg-gray-700 text-gray-300 hover:bg-yellow-600'}" data-track="${trackIndex}">S</button>
        <button class="mute-btn flex-1 px-2 py-1 text-xs rounded font-semibold transition-colors ${track.muted ? 'bg-red-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-red-600'}" data-track="${trackIndex}">M</button>
      </div>
      
      <!-- Output Level Meter -->
      <div class="mb-2">
        <div class="text-xs text-gray-400 mb-1 text-center">OUT</div>
        <div class="output-meter bg-gray-900 rounded h-16 w-4 mx-auto relative overflow-hidden">
          <div class="meter-fill bg-gradient-to-t from-green-500 via-yellow-500 to-red-500 w-full absolute bottom-0 transition-all duration-75" style="height: 0%"></div>
        </div>
      </div>
    </div>
  `;
}

function renderMixer() {
  if (!mixerChannels) return;
  
  let mixerHTML = '';
  tracks.forEach((track, index) => {
    mixerHTML += createMixerChannel(index, track);
  });
  
  mixerChannels.innerHTML = mixerHTML;
  
  // Add event listeners for mixer controls
  setupMixerEventListeners();
}

function setupMixerEventListeners() {
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
      const value = parseFloat(e.target.value);
      
      updateFaderVisualization(e.target, value);
      setTrackVolume(trackIndex, value);
    });
  });
  
  // Solo buttons
  document.querySelectorAll('.solo-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const trackIndex = parseInt(e.target.dataset.track);
      toggleTrackSolo(trackIndex);
      renderMixer(); // Re-render to update button states
    });
  });
  
  // Mute buttons
  document.querySelectorAll('.mute-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const trackIndex = parseInt(e.target.dataset.track);
      toggleTrackMute(trackIndex);
      renderMixer(); // Re-render to update button states
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

function updateFaderVisualization(faderInput, value) {
  const faderHandle = faderInput.parentElement.querySelector('.fader-handle');
  const volumeDisplay = faderInput.parentElement.parentElement.querySelector('.volume-display');
  
  if (faderHandle) {
    faderHandle.style.bottom = `${value * 100}%`;
  }
  
  if (volumeDisplay) {
    volumeDisplay.textContent = Math.round(value * 100);
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
  
  document.querySelectorAll('.meter-fill').forEach((meter, index) => {
    // Simulate random levels for demo
    const level = Math.random() * (playing ? 80 : 10);
    meter.style.height = `${level}%`;
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
  
  switch (e.key) {
    case ' ':
      e.preventDefault();
      if (playing) pauseAll();
      else playAll();
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
        tracks[trackIndex].clips.splice(clipIndex, 1);
        selectedClip = null;
        saveState();
        render();
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