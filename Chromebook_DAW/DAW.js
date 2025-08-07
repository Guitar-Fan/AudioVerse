// --- DAW Constants ---
const BASE_PIXELS_PER_SEC = 110;
const MIN_CLIP_WIDTH = 36;
const DEFAULT_TRACKS = 2;
const DEFAULT_BPM = 120;
const DEFAULT_SIG_NUM = 4;
const DEFAULT_SIG_DEN = 4;
const MAX_TIME = 180; // seconds
const MAX_BARS = 128;
const CLIP_COLORS = [
  "#1de9b6", "#42a5f5", "#ffb300", "#ec407a", "#ffd600", "#8bc34a",
  "#00bcd4", "#ba68c8", "#ff7043", "#90caf9", "#cddc39"
];
const TRACK_COLORS = [
  "#374151", "#232b36", "#2d3748", "#3b4252", "#223",
];

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
function getTotalBars() { return Math.ceil(MAX_TIME / getSecPerBar()); }
function getTimelineWidth() {
  return Math.max(getTotalBars() * getSecPerBar() * PIXELS_PER_SEC, 900);
}

function renderTimeline() {
  timelineDiv.innerHTML = '';
  timelineDiv.style.width = getTimelineWidth() + 'px';
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
    let left = bar * secPerBar * PIXELS_PER_SEC;
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
        let bleft = left + beat * secPerBeat * PIXELS_PER_SEC;
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
  playhead.style.left = (playheadTime * PIXELS_PER_SEC) + 'px';
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

    // Render Clips
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

      // Waveform Canvas
      let canvas = document.createElement('canvas');
      canvas.className = 'waveform-canvas';
      canvas.width = width - 8;
      canvas.height = 62;
      drawWaveform(canvas, clip.audioBuffer, clip.offset, clip.duration, false);
      clipDiv.appendChild(canvas);

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

      // Right click: context menu
      clipDiv.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showClipContextMenu(e, tIdx, cIdx, clipDiv);
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

    // Track right-click context menu
    trackDiv.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showTrackContextMenu(e, tIdx, trackDiv);
    });
    
    // Add width to track area to match timeline
    trackDiv.style.minWidth = getTimelineWidth() + 'px';

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
  
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  let stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
  recordedChunks = [];
  liveRecordingBuffer = [];
  liveRecordingStart = playheadTime;
  let inputNode = audioCtx.createMediaStreamSource(stream);

  // Live preview using ScriptProcessorNode for waveform
  let processor = audioCtx.createScriptProcessor(4096, 1, 1);
  inputNode.connect(processor);
  processor.connect(audioCtx.destination);
  processor.onaudioprocess = (e) => {
    let input = e.inputBuffer.getChannelData(0);
    liveRecordingBuffer.push(...input);
    if (liveRecordingBuffer.length > audioCtx.sampleRate * 300) {
      processor.disconnect();
      inputNode.disconnect();
    }
    render();
  };

  mediaRecorder.ondataavailable = e => { recordedChunks.push(e.data); };
  mediaRecorder.onstop = async () => {
    processor.disconnect();
    inputNode.disconnect();
    if (recordedChunks.length === 0) { isRecording = false; recordBtn.disabled = false; stopBtn.disabled = true; return; }
    const blob = new Blob(recordedChunks, { type: 'audio/webm' });
    const arrayBuffer = await blob.arrayBuffer();
    audioCtx.decodeAudioData(arrayBuffer, (buffer) => {
      // Add to armed tracks or selected track
      let targetTracks = tracks.filter(t => t.armed);
      if (targetTracks.length === 0) targetTracks = [tracks[selectedTrackIndex]];
      
      targetTracks.forEach(track => {
        let trackIndex = tracks.indexOf(track);
        addClipToTrack(trackIndex, buffer, liveRecordingStart, buffer.duration);
      });
      
      liveRecordingBuffer = [];
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

// --- Timeline and Playhead ---
timelineDiv.onclick = (e) => {
  let rawTime = e.offsetX / PIXELS_PER_SEC;
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

  playheadTime = snapTime;
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

// --- Context Menus ---
function showClipContextMenu(e, tIdx, cIdx, clipDiv) {
  removeContextMenu();
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.left = e.clientX + 'px';
  menu.style.top = e.clientY + 'px';

  let actions = [
    {label: 'Split at cursor', fn: () => splitClip(tIdx, cIdx, ((e.offsetX-8)/clipDiv.offsetWidth)) },
    {label: 'Delete', fn: () => { tracks[tIdx].clips.splice(cIdx,1); render(); }},
    {label: 'Duplicate', fn: () => { duplicateClip(tIdx, cIdx); }},
    {label: 'Rename', fn: () => { renameClip(tIdx, cIdx); }},
    {label: 'Reverse', fn: () => { reverseClip(tIdx, cIdx); }},
    {label: 'Normalize', fn: () => { normalizeClip(tIdx, cIdx); }},
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
function splitClip(tIdx, cIdx, relPos) {
  let clip = tracks[tIdx].clips[cIdx];
  const splitSec = clip.duration * relPos;
  if (splitSec < 0.01 || splitSec > clip.duration - 0.01) return;
  let first = createClip(clip.audioBuffer, clip.startTime, splitSec, clip.offset, clip.color, clip.name);
  let second = createClip(clip.audioBuffer, clip.startTime + splitSec, clip.duration - splitSec, clip.offset + splitSec, clip.color, clip.name);
  tracks[tIdx].clips.splice(cIdx, 1, first, second);
  render();
}
function duplicateClip(tIdx, cIdx) {
  let orig = tracks[tIdx].clips[cIdx];
  let dup = createClip(orig.audioBuffer, orig.startTime + orig.duration + 0.15, orig.duration, orig.offset, orig.color, orig.name + " Copy");
  tracks[tIdx].clips.push(dup);
  render();
}
function renameClip(tIdx, cIdx) {
  let newName = prompt("Enter new name for clip:", tracks[tIdx].clips[cIdx].name);
  if (newName) { tracks[tIdx].clips[cIdx].name = newName; render(); }
}
function reverseClip(tIdx, cIdx) {
  let clip = tracks[tIdx].clips[cIdx];
  let ch = clip.audioBuffer.getChannelData(0);
  let reversed = new Float32Array(ch.length);
  for(let i=0; i<ch.length; i++) reversed[i] = ch[ch.length-1-i];
  let buffer = audioCtx.createBuffer(1, ch.length, clip.audioBuffer.sampleRate);
  buffer.copyToChannel(reversed, 0);
  clip.audioBuffer = buffer;
  render();
}
function normalizeClip(tIdx, cIdx) {
  let clip = tracks[tIdx].clips[cIdx];
  let ch = clip.audioBuffer.getChannelData(0);
  let peak = Math.max(...ch.map(Math.abs));
  if (peak < 0.01) return;
  for(let i=0; i<ch.length; i++) ch[i] /= peak;
  render();
}
function changeClipColor(tIdx, cIdx, color) {
  tracks[tIdx].clips[cIdx].color = color;
  render();
}
function exportClip(tIdx, cIdx) {
  let clip = tracks[tIdx].clips[cIdx];
  let wav = audioBufferToWav(clip.audioBuffer, clip.offset, clip.duration);
  let blob = new Blob([wav], {type: 'audio/wav'});
  let url = URL.createObjectURL(blob);
  let a = document.createElement('a');
  a.href = url;
  a.download = (clip.name||"Clip") + ".wav";
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}
function moveClipToNewTrack(tIdx, cIdx) {
  let clip = tracks[tIdx].clips.splice(cIdx, 1)[0];
  let tr = createTrack();
  tr.clips.push(clip);
  tracks.push(tr);
  render();
}
// --- Track DAW Actions ---
function renameTrack(tIdx) {
  let newName = prompt("Enter new track name:", tracks[tIdx].label);
  if (newName) { tracks[tIdx].label = newName; render(); }
}
function addSilenceClip(tIdx) {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  let dur = 2;
  let buffer = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate*dur), audioCtx.sampleRate);
  tracks[tIdx].clips.push(createClip(buffer, 0, dur, 0, undefined, "Silence"));
  render();
}

// --- Waveform Drawing ---
function drawWaveform(canvas, audioBufferOrBuffer, offset, duration, isRawBuffer) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle = isRawBuffer ? "rgba(255,60,60,1)" : 'rgba(50,50,70,0.99)';
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

// --- Rendering ---
function render() {
  renderTimeline();
  renderTracks();
}

// --- Playback: Stable, true-rate, accurate ---
playBtn.onclick = () => { playAll(); };
pauseBtn.onclick = () => { stopAll(); };

function playAll() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  stopAll();
  let playStartAudioCtx = audioCtx.currentTime;
  let playStartTime = playheadTime;
  playing = true;
  function step() {
    let elapsed = audioCtx.currentTime - playStartAudioCtx;
    let t = playStartTime + elapsed;
    updatePlayhead(t);
    if (t > MAX_TIME) { stopAll(); return; }
    if (playing) playRequestId = requestAnimationFrame(step);
  }
  // Start all clips on all tracks, honoring mute/solo
  let soloTracks = tracks.filter(t=>t.solo);
  let playTracks = soloTracks.length ? soloTracks : tracks.filter(t=>!t.muted);
  playTracks.forEach(track => {
    track.clips.forEach(clip => {
      if (clip.startTime+clip.duration < playheadTime) return;
      let source = audioCtx.createBufferSource();
      source.buffer = clip.audioBuffer;
      let offset = Math.max(0, playheadTime - clip.startTime) + clip.offset;
      let duration = Math.min(clip.duration - (offset - clip.offset), clip.audioBuffer.duration - offset);
      source.connect(audioCtx.destination);
      if (clip.startTime >= playheadTime) {
        source.start(audioCtx.currentTime + (clip.startTime - playheadTime), clip.offset, clip.duration);
      } else if (clip.startTime + clip.duration > playheadTime) {
        source.start(audioCtx.currentTime, offset, duration);
      }
      if (!window._playSources) window._playSources = [];
      window._playSources.push(source);
    });
  });
  // Animate playhead
  pauseBtn.disabled = false;
  playBtn.disabled = true;
  playRequestId = requestAnimationFrame(step);
  if (metronomeEnabled) startMetronome();
  setTimeout(stopAll, (MAX_TIME-playheadTime)*1000);
}

function stopAll() {
  if (window._playSources) {
    window._playSources.forEach(src => { try { src.stop(); } catch{} });
    window._playSources = [];
  }
  playing = false;
  if (playRequestId) cancelAnimationFrame(playRequestId);
  pauseBtn.disabled = true;
  playBtn.disabled = false;
  stopMetronome();
}

// --- File Upload ---
fileInput.onchange = async (e) => {
  const files = e.target.files;
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  for (let file of files) {
    const arrayBuffer = await file.arrayBuffer();
    await new Promise((resolve) => {
      audioCtx.decodeAudioData(arrayBuffer, (buffer) => {
        addClipToFirstTrack(buffer, 0, buffer.duration, undefined, undefined, file.name.split(".")[0]);
        resolve();
      });
    });
  }
  fileInput.value = '';
};

// --- Add Track ---
addTrackBtn.onclick = () => {
  tracks.push(createTrack());
  render();
};

// --- Metronome ---
metronomeBtn.onclick = () => {
  metronomeEnabled = !metronomeEnabled;
  if (metronomeEnabled) {
    metronomeBtn.classList.add('metronome-on');
    metronomeBtn.innerText = "Metronome On";
    if ((isRecording || playing)) startMetronome();
  } else {
    metronomeBtn.classList.remove('metronome-on');
    metronomeBtn.innerText = "Metronome Off";
    stopMetronome();
  }
};
function startMetronome() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (!metronomeTickBuffer) createMetronomeBuffers();
  let beatCount = 0;
  let nextTick = audioCtx.currentTime + 0.1;
  function schedule() {
    while (nextTick < audioCtx.currentTime + 0.4) {
      let source = audioCtx.createBufferSource();
      if (beatCount % timeSigNum === 0) {
        source.buffer = metronomeAccentBuffer;
      } else {
        source.buffer = metronomeTickBuffer;
      }
      source.connect(audioCtx.destination);
      source.start(nextTick);
      beatCount++;
      nextTick += getSecPerBeat();
    }
    if (playing || isRecording) metronomeTimeout = setTimeout(schedule, 100);
  }
  schedule();
}
function stopMetronome() { clearTimeout(metronomeTimeout); }
function createMetronomeBuffers() {
  const sr = audioCtx.sampleRate;
  let tick = audioCtx.createBuffer(1, sr*0.07, sr);
  let tdata = tick.getChannelData(0);
  for (let i = 0; i < tdata.length; i++) tdata[i] = Math.sin(2*Math.PI*1800*i/sr) * Math.exp(-i/(sr*0.03));
  metronomeTickBuffer = tick;
  let tickA = audioCtx.createBuffer(1, sr*0.1, sr);
  let tdataA = tickA.getChannelData(0);
  for (let i = 0; i < tdataA.length; i++) tdataA[i] = Math.sin(2*Math.PI*1100*i/sr) * Math.exp(-i/(sr*0.04));
  metronomeAccentBuffer = tickA;
}

// --- Controls for BPM & Time Signature ---
bpmInput.onchange = () => {
  let newBPM = parseInt(bpmInput.value);
  if (isNaN(newBPM) || newBPM < 20 || newBPM > 300) bpmInput.value = bpm;
  else bpm = newBPM;
  render();
}
tsNumInput.onchange = () => { timeSigNum = parseInt(tsNumInput.value); render(); }
tsDenInput.onchange = () => { timeSigDen = parseInt(tsDenInput.value); render(); }

// --- Zoom ---
function setZoom(newZoom) {
  zoomLevel = Math.max(0.2, Math.min(2.8, newZoom));
  PIXELS_PER_SEC = BASE_PIXELS_PER_SEC * zoomLevel;
  render();
}
zoomInBtn.onclick = () => setZoom(zoomLevel*1.25);
zoomOutBtn.onclick = () => setZoom(zoomLevel/1.25);
// Mousewheel zoom on timeline
timelineDiv.addEventListener('wheel', e => {
  e.preventDefault();
  setZoom(zoomLevel * (e.deltaY < 0 ? 1.13 : 0.89));
});
// Horizontal scroll with shift+wheel
workspace.addEventListener('wheel', e => {
  if (e.shiftKey) {
    workspace.scrollLeft += e.deltaY;
  }
});

// --- Init ---
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
  render();
}
window.onload = init;

// Hide context menu on resize/scroll/click
window.addEventListener('resize', removeContextMenu);
window.addEventListener('scroll', removeContextMenu);
document.body.addEventListener('mousedown', (e) => {
  if (contextMenuEl && !contextMenuEl.contains(e.target)) removeContextMenu();
  if (!e.target.className.includes('clip')) deselectAllClips(), render();
});