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

// --- Timeline ---
function getSecPerBeat() { return 60 / bpm; }
function getSecPerBar() { return getSecPerBeat() * timeSigNum; }
function getTotalBars() { return Math.ceil(MAX_TIME / getSecPerBar()); }
function getTimelineWidth() {
  return Math.max(getTotalBars() * getSecPerBar() * PIXELS_PER_SEC, 900);
}

// --- Rendering ---
function render() {
  renderTimeline();
  renderTracks();
}

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