// Audio Studio Application
let engine = null;
let audioContext = null;
let spectrogramData = [];

console.log('App.js loaded - initializing WASM module...');

// The Module is an async function that returns a promise
(async function initWasm() {
    try {
        console.log('Starting WASM module initialization...');
        updateStatus('loading', 'Loading C++ audio engine...');
        
        // Module() is async and returns a promise
        const WasmModule = await Module();
        
        console.log('✅ C++ Audio Analysis Engine loaded successfully!');
        console.log('Module object:', WasmModule);
        console.log('Available classes:', Object.keys(WasmModule).filter(k => typeof WasmModule[k] === 'function'));
        
        updateStatus('ready', 'Ready! Upload an audio file to analyze');
        document.getElementById('audioFile').disabled = false;
        
        // Initialize engine with default sample rate
        engine = new WasmModule.AudioStudioEngine(48000);
        console.log('✅ AudioStudioEngine initialized');
        
        // Store module reference globally
        window.WasmModule = WasmModule;
        
        // Set up file input handler
        document.getElementById('audioFile').addEventListener('change', handleFileUpload);
        
        // Initialize canvases
        initializeCanvases();
    } catch(e) {
        console.error('❌ Failed to initialize WASM module:', e);
        updateStatus('error', 'Failed to load WASM: ' + e.message);
    }
})();

function updateStatus(type, message) {
    const statusEl = document.getElementById('status');
    statusEl.className = `status ${type}`;
    statusEl.textContent = message;
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    updateStatus('loading', `Loading ${file.name}...`);
    
    const reader = new FileReader();
    reader.onload = function(e) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        audioContext.decodeAudioData(e.target.result, processAudioBuffer, handleError);
    };
    reader.readAsArrayBuffer(file);
}

function processAudioBuffer(buffer) {
    // Get mono channel data
    const channelData = buffer.getChannelData(0);
    const samples = new Float32Array(channelData);
    
    // Update engine sample rate if different
    const sampleRate = buffer.sampleRate;
    engine = new window.WasmModule.AudioStudioEngine(sampleRate);
    
    // Convert to JS array for passing to WASM
    const jsArray = [];
    for (let i = 0; i < samples.length; i++) {
        jsArray.push(samples[i]);
    }
    
    // Load into C++ engine
    engine.loadAudioData(jsArray);
    
    // Update all visualizations and metrics
    updateMetrics();
    drawWaveform();
    drawSpectrum();
    drawPhaseSpectrum();
    generateSpectrogram(samples, sampleRate);
    
    updateStatus('ready', `Analyzing ${(samples.length / sampleRate).toFixed(2)}s of audio at ${sampleRate} Hz`);
}

function updateMetrics() {
    // Peak level in dB
    const peak = engine.getPeakLevel();
    const peakDB = peak > 0 ? (20 * Math.log10(peak)).toFixed(2) : '-∞';
    document.getElementById('peakLevel').textContent = `${peakDB} dB`;
    
    // RMS level in dB
    const rms = engine.getRMSLevel();
    const rmsDB = rms > 0 ? (20 * Math.log10(rms)).toFixed(2) : '-∞';
    document.getElementById('rmsLevel').textContent = `${rmsDB} dB`;
    
    // Dominant frequency
    const domFreq = engine.getDominantFrequency();
    document.getElementById('dominantFreq').textContent = `${domFreq.toFixed(1)} Hz`;
    
    // Spectral centroid
    const centroid = engine.getSpectralCentroid();
    document.getElementById('spectralCentroid').textContent = `${centroid.toFixed(1)} Hz`;
    
    // Spectral rolloff
    const rolloff = engine.getSpectralRolloff();
    document.getElementById('spectralRolloff').textContent = `${rolloff.toFixed(1)} Hz`;
    
    // Sample rate
    const sr = engine.getSampleRate();
    document.getElementById('sampleRate').textContent = `${sr} Hz`;
}

function initializeCanvases() {
    const canvases = ['waveformCanvas', 'spectrumCanvas', 'phaseCanvas', 'spectrogramCanvas'];
    canvases.forEach(id => {
        const canvas = document.getElementById(id);
        canvas.width = canvas.offsetWidth * window.devicePixelRatio;
        canvas.height = canvas.offsetHeight * window.devicePixelRatio;
        const ctx = canvas.getContext('2d');
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    });
}

function drawWaveform() {
    const canvas = document.getElementById('waveformCanvas');
    const ctx = canvas.getContext('2d');
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    
    ctx.clearRect(0, 0, width, height);
    
    // Get waveform data from C++ (returns JS array)
    const waveform = engine.getWaveformData(width * 2);
    
    // Draw waveform
    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    for (let i = 0; i < waveform.length; i++) {
        const x = (i / waveform.length) * width;
        const y = ((1 - waveform[i]) / 2) * height;
        
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    
    ctx.stroke();
    
    // Draw center line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
}

function drawSpectrum() {
    const canvas = document.getElementById('spectrumCanvas');
    const ctx = canvas.getContext('2d');
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    
    ctx.clearRect(0, 0, width, height);
    
    // Get magnitude spectrum from C++ (returns JS array)
    const spectrum = engine.getMagnitudeSpectrum();
    const barWidth = width / spectrum.length;
    
    // Find max for normalization
    let maxMag = 0;
    for (let i = 0; i < spectrum.length; i++) {
        maxMag = Math.max(maxMag, spectrum[i]);
    }
    
    // Draw spectrum bars
    for (let i = 0; i < spectrum.length; i++) {
        const mag = spectrum[i];
        const normalizedMag = maxMag > 0 ? mag / maxMag : 0;
        const barHeight = normalizedMag * height;
        
        // Color gradient based on frequency
        const hue = (i / spectrum.length) * 240; // Blue to red
        ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
        
        ctx.fillRect(i * barWidth, height - barHeight, barWidth - 1, barHeight);
    }
    
    // Draw frequency labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '10px monospace';
    const sampleRate = engine.getSampleRate();
    const nyquist = sampleRate / 2;
    
    for (let i = 0; i <= 4; i++) {
        const freq = (i / 4) * nyquist;
        const x = (i / 4) * width;
        ctx.fillText(`${(freq / 1000).toFixed(1)}k`, x, height - 5);
    }
}

function drawPhaseSpectrum() {
    const canvas = document.getElementById('phaseCanvas');
    const ctx = canvas.getContext('2d');
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    
    ctx.clearRect(0, 0, width, height);
    
    // Get phase spectrum from C++ (returns JS array)
    const phaseSpectrum = engine.getPhaseSpectrum();
    const barWidth = width / phaseSpectrum.length;
    
    // Draw phase spectrum
    for (let i = 0; i < phaseSpectrum.length; i++) {
        const phase = phaseSpectrum[i];
        const normalizedPhase = (phase + Math.PI) / (2 * Math.PI); // Normalize to 0-1
        const barHeight = normalizedPhase * height;
        
        // Color from purple to cyan
        const hue = 180 + normalizedPhase * 60;
        ctx.fillStyle = `hsl(${hue}, 80%, 50%)`;
        
        ctx.fillRect(i * barWidth, height - barHeight, barWidth - 1, barHeight);
    }
    
    // Draw reference lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    
    // π line
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    
    ctx.setLineDash([]);
}

function generateSpectrogram(samples, sampleRate) {
    const canvas = document.getElementById('spectrogramCanvas');
    const ctx = canvas.getContext('2d');
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    
    ctx.clearRect(0, 0, width, height);
    
    const fftSize = 2048;
    const hopSize = 512;
    const numFrames = Math.floor((samples.length - fftSize) / hopSize);
    
    spectrogramData = [];
    
    // Compute FFT for each time frame using C++ engine
    for (let frame = 0; frame < numFrames && frame < width; frame++) {
        const startSample = frame * hopSize;
        const result = engine.analyzeChunk(startSample, fftSize);
        
        if (result.magnitudeSpectrum) {
            const mag = result.magnitudeSpectrum; // JS array from C++
            const frameData = [];
            for (let i = 0; i < mag.length; i++) {
                frameData.push(mag[i]);
            }
            spectrogramData.push(frameData);
        }
    }
    
    // Draw spectrogram
    if (spectrogramData.length > 0) {
        const frameWidth = width / spectrogramData.length;
        const binHeight = height / spectrogramData[0].length;
        
        // Find global max for normalization
        let maxMag = 0;
        for (const frame of spectrogramData) {
            for (const mag of frame) {
                maxMag = Math.max(maxMag, mag);
            }
        }
        
        for (let frame = 0; frame < spectrogramData.length; frame++) {
            const frameData = spectrogramData[frame];
            
            for (let bin = 0; bin < frameData.length; bin++) {
                const mag = frameData[bin];
                const normalizedMag = maxMag > 0 ? mag / maxMag : 0;
                
                // Use logarithmic scale for better visibility
                const logMag = normalizedMag > 0 ? Math.log10(1 + normalizedMag * 9) : 0;
                
                // Heat map color scheme
                const intensity = logMag * 255;
                ctx.fillStyle = `rgb(${intensity}, ${intensity * 0.5}, ${255 - intensity})`;
                
                const x = frame * frameWidth;
                const y = height - (bin * binHeight);
                ctx.fillRect(x, y, Math.ceil(frameWidth), Math.ceil(binHeight));
            }
        }
    }
}

function handleError(error) {
    console.error('Error decoding audio:', error);
    updateStatus('error', 'Error loading audio file. Please try a different file.');
}

// Handle window resize
window.addEventListener('resize', () => {
    if (engine && engine.getAudioLength() > 0) {
        initializeCanvases();
        drawWaveform();
        drawSpectrum();
        drawPhaseSpectrum();
        // Spectrogram redraw would be expensive, skip on resize
    }
});
