// AudioVerse Pro Editor - Professional Plugin-Style Interface
let analyzerEngine = null;
let editorEngine = null;
let audioContext = null;
let currentTrackId = null;
let tracks = [];

console.log('Editor App loading...');

// Initialize WASM modules
(async function initWasm() {
    try {
        console.log('Starting WASM module initialization...');
        document.getElementById('engineStatus').textContent = 'Loading C++ Engine...';
        
        const WasmModule = await Module();
        
        console.log('✅ C++ Audio Engine loaded successfully!');
        
        // Initialize both engines
        analyzerEngine = new WasmModule.AudioStudioEngine(48000);
        editorEngine = new WasmModule.AudioEditor(48000);
        
        console.log('✅ Analyzer and Editor initialized');
        
        document.getElementById('engineStatus').textContent = '✓ C++ Engine Ready';
        window.WasmModule = WasmModule;
        
        // Set up file input handler
        document.getElementById('audioFile').addEventListener('change', handleFileUpload);
        
        // Initialize UI
        showAnalysisView();
        
    } catch(e) {
        console.error('❌ Failed to initialize WASM:', e);
        document.getElementById('engineStatus').textContent = '✗ Engine Load Failed';
    }
})();

// File Upload
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    document.getElementById('engineStatus').textContent = `Loading ${file.name}...`;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        audioContext.decodeAudioData(e.target.result, processAudioBuffer, handleError);
    };
    reader.readAsArrayBuffer(file);
}

function processAudioBuffer(buffer) {
    const channelData = buffer.getChannelData(0);
    const samples = Array.from(channelData);
    
    // Load into analyzer
    analyzerEngine = new window.WasmModule.AudioStudioEngine(buffer.sampleRate);
    analyzerEngine.loadAudioData(samples);
    
    // Add first track automatically
    if (tracks.length === 0) {
        addTrack('Main Audio');
    }
    
    // Load into first track
    editorEngine.loadAudioToTrack(tracks[0].id, samples);
    currentTrackId = tracks[0].id;
    
    // Update UI
    updateTrackList();
    updateAnalysisView();
    
    document.getElementById('engineStatus').textContent = `✓ Loaded ${(samples.length / buffer.sampleRate).toFixed(2)}s @ ${buffer.sampleRate}Hz`;
}

function handleError(error) {
    console.error('Decoding error:', error);
    document.getElementById('engineStatus').textContent = '✗ Load Failed';
}

// Track Management
function addTrack(name) {
    const trackId = editorEngine.addTrack(name || `Track ${tracks.length + 1}`);
    tracks.push({
        id: trackId,
        name: name || `Track ${tracks.length + 1}`,
        mute: false,
        solo: false,
        gain: 0,
        pan: 0
    });
    updateTrackList();
    return trackId;
}

function updateTrackList() {
    const list = document.getElementById('trackList');
    list.innerHTML = tracks.map((track, idx) => `
        <div class="track-item ${track.id === currentTrackId ? 'active' : ''}" onclick="selectTrack(${track.id})">
            <div class="track-name">${track.name}</div>
            <div class="track-controls">
                <button class="track-btn ${track.mute ? 'active' : ''}" onclick="event.stopPropagation(); toggleMute(${track.id})">M</button>
                <button class="track-btn ${track.solo ? 'active' : ''}" onclick="event.stopPropagation(); toggleSolo(${track.id})">S</button>
            </div>
        </div>
    `).join('');
}

function selectTrack(trackId) {
    currentTrackId = trackId;
    updateTrackList();
    updateEditorView();
}

function toggleMute(trackId) {
    const track = tracks.find(t => t.id === trackId);
    if (track) {
        track.mute = !track.mute;
        editorEngine.setTrackMute(trackId, track.mute);
        updateTrackList();
    }
}

function toggleSolo(trackId) {
    const track = tracks.find(t => t.id === trackId);
    if (track) {
        track.solo = !track.solo;
        editorEngine.setTrackSolo(trackId, track.solo);
        updateTrackList();
    }
}

// Tab Switching
function switchTab(tabName) {
    // Remove active class from all tabs
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    
    // Find and activate the tab matching tabName
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        const tabText = tab.textContent.toLowerCase();
        if (tabText.includes(tabName.toLowerCase())) {
            tab.classList.add('active');
        }
    });
    
    // Show appropriate content
    if (tabName === 'analysis') showAnalysisView();
    else if (tabName === 'interactive') showInteractiveView();
    else if (tabName === 'editor') showEditorView();
    else if (tabName === 'effects') showEffectsView();
}

// Analysis View
function showAnalysisView() {
    const content = document.getElementById('tabContent');
    content.innerHTML = `
        <div class="metrics">
            <div class="metric-card">
                <div class="metric-label">Peak Level</div>
                <div class="metric-value" id="peakLevel">-∞ dB</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">RMS Level</div>
                <div class="metric-value" id="rmsLevel">-∞ dB</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Dominant Freq</div>
                <div class="metric-value" id="dominantFreq">0 Hz</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Spectral Centroid</div>
                <div class="metric-value" id="spectralCentroid">0 Hz</div>
            </div>
        </div>
        
        <div class="analysis-grid">
            <div class="viz-card">
                <div class="viz-title">Waveform</div>
                <canvas id="waveformCanvas"></canvas>
            </div>
            <div class="viz-card">
                <div class="viz-title">Spectrum</div>
                <canvas id="spectrumCanvas"></canvas>
            </div>
            <div class="viz-card">
                <div class="viz-title">Phase</div>
                <canvas id="phaseCanvas"></canvas>
            </div>
            <div class="viz-card">
                <div class="viz-title">Spectrogram</div>
                <canvas id="spectrogramCanvas"></canvas>
            </div>
        </div>
    `;
    
    setTimeout(() => {
        if (analyzerEngine && analyzerEngine.getAudioLength() > 0) {
            updateAnalysisView();
        }
    }, 100);
}

function updateAnalysisView() {
    if (!analyzerEngine) return;
    
    // Update metrics
    const peak = analyzerEngine.getPeakLevel();
    const peakDB = peak > 0 ? (20 * Math.log10(peak)).toFixed(2) : '-∞';
    document.getElementById('peakLevel').textContent = `${peakDB} dB`;
    
    const rms = analyzerEngine.getRMSLevel();
    const rmsDB = rms > 0 ? (20 * Math.log10(rms)).toFixed(2) : '-∞';
    document.getElementById('rmsLevel').textContent = `${rmsDB} dB`;
    
    const freq = analyzerEngine.getDominantFrequency();
    document.getElementById('dominantFreq').textContent = `${freq.toFixed(1)} Hz`;
    
    const centroid = analyzerEngine.getSpectralCentroid();
    document.getElementById('spectralCentroid').textContent = `${centroid.toFixed(1)} Hz`;
    
    // Draw visualizations
    drawWaveform();
    drawSpectrum();
    drawPhase();
    drawSpectrogram();
}

function drawWaveform() {
    const canvas = document.getElementById('waveformCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    
    ctx.clearRect(0, 0, width, height);
    
    const waveform = analyzerEngine.getWaveformData(width * 2);
    
    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    for (let i = 0; i < waveform.length; i++) {
        const x = (i / waveform.length) * width;
        const y = ((1 - waveform[i]) / 2) * height;
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    
    ctx.stroke();
}

function drawSpectrum() {
    const canvas = document.getElementById('spectrumCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    
    ctx.clearRect(0, 0, width, height);
    
    const spectrum = analyzerEngine.getMagnitudeSpectrum();
    const barWidth = width / spectrum.length;
    
    let maxMag = Math.max(...spectrum);
    
    for (let i = 0; i < spectrum.length; i++) {
        const normalizedMag = maxMag > 0 ? spectrum[i] / maxMag : 0;
        const barHeight = normalizedMag * height;
        
        const hue = (i / spectrum.length) * 240;
        ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
        ctx.fillRect(i * barWidth, height - barHeight, barWidth - 1, barHeight);
    }
}

function drawPhase() {
    const canvas = document.getElementById('phaseCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    
    ctx.clearRect(0, 0, width, height);
    
    const phaseSpectrum = analyzerEngine.getPhaseSpectrum();
    const barWidth = width / phaseSpectrum.length;
    
    for (let i = 0; i < phaseSpectrum.length; i++) {
        const phase = phaseSpectrum[i];
        const normalizedPhase = (phase + Math.PI) / (2 * Math.PI);
        const barHeight = normalizedPhase * height;
        
        const hue = 180 + normalizedPhase * 60;
        ctx.fillStyle = `hsl(${hue}, 80%, 50%)`;
        ctx.fillRect(i * barWidth, height - barHeight, barWidth - 1, barHeight);
    }
}

function drawSpectrogram() {
    const canvas = document.getElementById('spectrogramCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#444';
    ctx.fillRect(0, 0, width, height);
    
    // Simplified spectrogram placeholder
    ctx.fillStyle = '#666';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Spectrogram', width/2, height/2);
}

// Editor View
function showEditorView() {
    const content = document.getElementById('tabContent');
    content.innerHTML = `
        <div class="editor-controls">
            <div class="control-group">
                <div class="control-label">Selection</div>
                <button class="btn btn-secondary" onclick="cutRegion()">✂️ Cut</button>
                <button class="btn btn-secondary" onclick="copyRegion()">📋 Copy</button>
                <button class="btn btn-secondary" onclick="pasteRegion()">📌 Paste</button>
                <button class="btn btn-secondary" onclick="deleteRegion()">🗑️ Delete</button>
            </div>
            
            <div class="control-group">
                <div class="control-label">Fades</div>
                <button class="btn btn-secondary" onclick="applyFadeIn()">↗ Fade In</button>
                <button class="btn btn-secondary" onclick="applyFadeOut()">↘ Fade Out</button>
            </div>
            
            <div class="control-group">
                <div class="control-label">Processing</div>
                <button class="btn btn-secondary" onclick="normalizeAudio()">📊 Normalize</button>
                <button class="btn btn-secondary" onclick="reverseAudio()">⏪ Reverse</button>
            </div>
        </div>
        
        <div class="control-group">
            <div class="control-label">Time Stretch</div>
            <input type="range" id="timeStretchRatio" min="0.5" max="2" step="0.1" value="1" oninput="updateTimeStretchLabel()">
            <div class="param-label">
                <span>Ratio:</span>
                <span class="param-value" id="timeStretchLabel">1.0x</span>
            </div>
            <button class="btn" onclick="applyTimeStretch()">Apply Time Stretch</button>
        </div>
        
        <div class="control-group">
            <div class="control-label">Pitch Shift</div>
            <input type="range" id="pitchShift" min="-12" max="12" step="1" value="0" oninput="updatePitchShiftLabel()">
            <div class="param-label">
                <span>Semitones:</span>
                <span class="param-value" id="pitchShiftLabel">0</span>
            </div>
            <button class="btn" onclick="applyPitchShift()">Apply Pitch Shift</button>
        </div>
    `;
}

function updateEditorView() {
    // Refresh if needed
}

function updateTimeStretchLabel() {
    const value = document.getElementById('timeStretchRatio').value;
    document.getElementById('timeStretchLabel').textContent = `${value}x`;
}

function updatePitchShiftLabel() {
    const value = document.getElementById('pitchShift').value;
    document.getElementById('pitchShiftLabel').textContent = value > 0 ? `+${value}` : value;
}

// Editor Functions
function cutRegion() {
    if (!currentTrackId) return;
    editorEngine.cutRegion(currentTrackId, 0, 48000); // Example: first second
    updateAnalysisView();
}

function copyRegion() {
    if (!currentTrackId) return;
    editorEngine.copyRegion(currentTrackId, 0, 48000);
}

function pasteRegion() {
    if (!currentTrackId) return;
    editorEngine.pasteAtPosition(currentTrackId, 0);
    updateAnalysisView();
}

function deleteRegion() {
    if (!currentTrackId) return;
    editorEngine.deleteRegion(currentTrackId, 0, 48000);
    updateAnalysisView();
}

function applyFadeIn() {
    if (!currentTrackId) return;
    editorEngine.applyFadeIn(currentTrackId, 0, 24000);
    updateAnalysisView();
}

function applyFadeOut() {
    if (!currentTrackId) return;
    const samples = editorEngine.getTrackAudio(currentTrackId, 0, 1000000);
    editorEngine.applyFadeOut(currentTrackId, Math.max(0, samples.length - 24000), 24000);
    updateAnalysisView();
}

function normalizeAudio() {
    if (!currentTrackId) return;
    editorEngine.applyNormalize(currentTrackId);
    updateAnalysisView();
}

function reverseAudio() {
    if (!currentTrackId) return;
    editorEngine.applyReverse(currentTrackId);
    updateAnalysisView();
}

function applyTimeStretch() {
    if (!currentTrackId) return;
    const ratio = parseFloat(document.getElementById('timeStretchRatio').value);
    editorEngine.timeStretch(currentTrackId, ratio);
    updateAnalysisView();
}

function applyPitchShift() {
    if (!currentTrackId) return;
    const semitones = parseFloat(document.getElementById('pitchShift').value);
    editorEngine.pitchShift(currentTrackId, semitones);
    updateAnalysisView();
}

// Effects View
function showEffectsView() {
    const content = document.getElementById('tabContent');
    content.innerHTML = `
        <div class="effects-grid">
            <div class="effect-card">
                <div class="effect-title">🔊 Gain</div>
                <div class="param">
                    <div class="param-label">
                        <span>Amount (dB)</span>
                        <span class="param-value" id="gainValue">0</span>
                    </div>
                    <input type="range" id="gainSlider" min="-24" max="24" step="0.1" value="0" oninput="updateGainLabel()">
                </div>
                <button class="btn" onclick="applyGainEffect()">Apply Gain</button>
            </div>
            
            <div class="effect-card">
                <div class="effect-title">🔽 Low Pass Filter</div>
                <div class="param">
                    <div class="param-label">
                        <span>Cutoff (Hz)</span>
                        <span class="param-value" id="lpfValue">1000</span>
                    </div>
                    <input type="range" id="lpfSlider" min="20" max="20000" step="10" value="1000" oninput="updateLPFLabel()">
                </div>
                <button class="btn" onclick="applyLowPass()">Apply Filter</button>
            </div>
            
            <div class="effect-card">
                <div class="effect-title">🔼 High Pass Filter</div>
                <div class="param">
                    <div class="param-label">
                        <span>Cutoff (Hz)</span>
                        <span class="param-value" id="hpfValue">100</span>
                    </div>
                    <input type="range" id="hpfSlider" min="20" max="20000" step="10" value="100" oninput="updateHPFLabel()">
                </div>
                <button class="btn" onclick="applyHighPass()">Apply Filter</button>
            </div>
            
            <div class="effect-card">
                <div class="effect-title">🎚️ Compressor</div>
                <div class="param">
                    <div class="param-label">
                        <span>Threshold (dB)</span>
                        <span class="param-value" id="compThreshValue">-12</span>
                    </div>
                    <input type="range" id="compThresh" min="-60" max="0" step="1" value="-12" oninput="updateCompThreshLabel()">
                </div>
                <div class="param">
                    <div class="param-label">
                        <span>Ratio</span>
                        <span class="param-value" id="compRatioValue">4</span>
                    </div>
                    <input type="range" id="compRatio" min="1" max="20" step="0.5" value="4" oninput="updateCompRatioLabel()">
                </div>
                <button class="btn" onclick="applyCompressor()">Apply Compressor</button>
            </div>
        </div>
    `;
}

function updateGainLabel() {
    const value = document.getElementById('gainSlider').value;
    document.getElementById('gainValue').textContent = value;
}

function updateLPFLabel() {
    const value = document.getElementById('lpfSlider').value;
    document.getElementById('lpfValue').textContent = value;
}

function updateHPFLabel() {
    const value = document.getElementById('hpfSlider').value;
    document.getElementById('hpfValue').textContent = value;
}

function updateCompThreshLabel() {
    const value = document.getElementById('compThresh').value;
    document.getElementById('compThreshValue').textContent = value;
}

function updateCompRatioLabel() {
    const value = document.getElementById('compRatio').value;
    document.getElementById('compRatioValue').textContent = value;
}

function applyGainEffect() {
    if (!currentTrackId) return;
    const gain = parseFloat(document.getElementById('gainSlider').value);
    editorEngine.applyGain(currentTrackId, gain);
    updateAnalysisView();
}

function applyLowPass() {
    if (!currentTrackId) return;
    const cutoff = parseFloat(document.getElementById('lpfSlider').value);
    editorEngine.applyLowPassFilter(currentTrackId, cutoff);
    updateAnalysisView();
}

function applyHighPass() {
    if (!currentTrackId) return;
    const cutoff = parseFloat(document.getElementById('hpfSlider').value);
    editorEngine.applyHighPassFilter(currentTrackId, cutoff);
    updateAnalysisView();
}

function applyCompressor() {
    if (!currentTrackId) return;
    const threshold = parseFloat(document.getElementById('compThresh').value);
    const ratio = parseFloat(document.getElementById('compRatio').value);
    editorEngine.applyCompressor(currentTrackId, threshold, ratio);
    updateAnalysisView();
}

console.log('Editor App loaded');
