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
// New Web Audio API additions
let masterGainNode = null;
let analyserNode = null;
let filterNodes = new Map(); // Per-track filters
let trackGainNodes = new Map(); // Per-track gain nodes
let clipboard = null; // For copy/paste operations
let undoStack = [];
let redoStack = [];

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
  renderTracks();
}

// --- Playback: Stable, true-rate, accurate ---
playBtn.onclick = () => { playAll(); };
pauseBtn.onclick = () => { stopAll(); };

function playAll() {
  initAudioContext();
  stopAll();
  let playStartAudioCtx = audioCtx.currentTime;
  let playStartTime = playheadTime;
  playing = true;

  // Prepare play sources array
  window._playSources = [];

  // Determine which tracks to play (solo logic)
  let soloTracks = tracks.filter(t => t.solo);
  let playTracks = soloTracks.length ? soloTracks : tracks.filter(t => !t.muted);

  // Start all clips with proper audio routing
  playTracks.forEach((track, trackIdx) => {
    const trackGain = getTrackGainNode(trackIdx);
    trackGain.gain.value = track.volume;

    // Ensure gain node is connected to analyser/master
    if (!trackGain._connected) {
      trackGain.disconnect();
      trackGain.connect(analyserNode);
      trackGain._connected = true;
    }

    track.clips.forEach(clip => {
      if (!clip.audioBuffer) return;
      // Only play clips that overlap with playheadTime
      if (clip.startTime + clip.duration <= playheadTime) return;

      let source = audioCtx.createBufferSource();
      source.buffer = clip.audioBuffer;

      // Routing: source -> (optional filter) -> trackGain
      let lastNode = source;
      if (filterNodes.has(trackIdx)) {
        lastNode.connect(filterNodes.get(trackIdx));
        lastNode = filterNodes.get(trackIdx);
      }
      lastNode.connect(trackGain);

      // Calculate when to start and what offset/duration to play
      let startAt = Math.max(clip.startTime, playheadTime);
      let offset = clip.offset + Math.max(0, playheadTime - clip.startTime);
      let duration = Math.min(clip.duration - (offset - clip.offset), clip.audioBuffer.duration - offset);

      // Schedule playback
      if (clip.startTime >= playheadTime) {
        // Starts in the future
        source.start(audioCtx.currentTime + (clip.startTime - playheadTime), clip.offset, clip.duration);
      } else if (clip.startTime + clip.duration > playheadTime) {
        // Already started, play from offset
        source.start(audioCtx.currentTime, offset, duration);
      }

      window._playSources.push(source);
    });
  });

  pauseBtn.disabled = false;
  playBtn.disabled = true;

  function step() {
    let elapsed = audioCtx.currentTime - playStartAudioCtx;
    let t = playStartTime + elapsed;
    updatePlayhead(t);
    if (t > MAX_TIME) { stopAll(); return; }
    if (playing) playRequestId = requestAnimationFrame(step);
  }
  playRequestId = requestAnimationFrame(step);

  if (metronomeEnabled) startMetronome();
  setTimeout(stopAll, (MAX_TIME - playheadTime) * 1000);
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
  saveState();
  render();
}

// Ensure initialization after DOM is loaded
window.onload = init;