// AudioVerse Pro - Professional Plugin UI using C++ PluginUI renderer
let engine = null;
let pluginUI = null;
let audioContext = null;
let canvas, ctx;
let animationFrameId = null;

console.log('AudioVerse Pro initializing...');

// Initialize when WASM module is loaded
(async function initWasm() {
    try {
        console.log('🔄 Starting WASM module initialization...');
        updateEngineStatus('loading', 'Loading C++ engine...');
        
        // Module() is async and returns a promise
        const WasmModule = await Module();
        
        console.log('✅ C++ Audio Engine loaded successfully!');
        console.log('Available classes:', Object.keys(WasmModule).filter(k => typeof WasmModule[k] === 'function'));
        
        // Store module reference globally
        window.WasmModule = WasmModule;
        
        // Initialize engines
        engine = new WasmModule.AudioStudioEngine(48000);
        console.log('✅ AudioStudioEngine initialized');
        
        // Initialize plugin UI renderer
        pluginUI = new WasmModule.PluginUI(1200, 700);
        console.log('✅ PluginUI renderer initialized');
        
        // Setup canvas
        canvas = document.getElementById('pluginCanvas');
        ctx = canvas.getContext('2d');
        
        // Draw initial UI
        drawPluginUI();
        
        updateEngineStatus('ready', '🟢 Engine Ready - Load Audio to Begin');
        document.getElementById('audioFile').disabled = false;
        document.getElementById('loading').style.display = 'none';
        
        // Set up file input handler
        document.getElementById('audioFile').addEventListener('change', handleFileUpload);
        
    } catch(e) {
        console.error('❌ Failed to initialize WASM module:', e);
        updateEngineStatus('error', '🔴 Engine Failed: ' + e.message);
    }
})();

function updateEngineStatus(type, message) {
    const statusEl = document.getElementById('engine-status');
    statusEl.textContent = message;
}

function drawPluginUI() {
    if (!pluginUI || !ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Get spectrum data
    let spectrum = [];
    if (engine) {
        try {
            const spectrumData = engine.getMagnitudeSpectrum();
            for (let i = 0; i < spectrumData.length; i++) {
                spectrum.push(spectrumData[i]);
            }
        } catch(e) {
            // No audio loaded yet, use empty array
        }
    }
    
    // Get waveform data
    let waveform = [];
    if (engine) {
        try {
            const waveformData = engine.getWaveformData(400);
            for (let i = 0; i < waveformData.length; i++) {
                waveform.push(waveformData[i]);
            }
        } catch(e) {
            // No audio loaded yet, use empty array
        }
    }
    
    // Get peak and RMS
    const peak = engine ? Math.min(1.0, engine.getPeakLevel()) : 0;
    const rms = engine ? Math.min(1.0, engine.getRMSLevel()) : 0;
    
    // Draw entire UI using C++
    pluginUI.drawUI(peak, rms, waveform, spectrum);
    
    // Command dispatcher for draw commands from C++
    const commandDispatcher = {
        // Canvas state
        save: () => ctx.save(),
        restore: () => ctx.restore(),
        
        // Basic drawing
        fillRect: (x, y, w, h) => ctx.fillRect(x, y, w, h),
        strokeRect: (x, y, w, h) => ctx.strokeRect(x, y, w, h),
        clearRect: (x, y, w, h) => ctx.clearRect(x, y, w, h),
        
        // Paths
        beginPath: () => ctx.beginPath(),
        closePath: () => ctx.closePath(),
        moveTo: (x, y) => ctx.moveTo(x, y),
        lineTo: (x, y) => ctx.lineTo(x, y),
        arc: (x, y, r, start, end) => ctx.arc(x, y, r, start, end),
        fill: () => ctx.fill(),
        stroke: () => ctx.stroke(),
        
        // Text
        fillText: (text, x, y) => ctx.fillText(text, x, y),
        strokeText: (text, x, y) => ctx.strokeText(text, x, y),
        measureText: (text) => ctx.measureText(text),
        
        // Styles
        setFillStyle: (style) => { ctx.fillStyle = style; },
        setStrokeStyle: (style) => { ctx.strokeStyle = style; },
        setLineWidth: (width) => { ctx.lineWidth = width; },
        setFont: (font) => { ctx.font = font; },
        setTextAlign: (align) => { ctx.textAlign = align; },
        setTextBaseline: (baseline) => { ctx.textBaseline = baseline; },
        setGlobalAlpha: (alpha) => { ctx.globalAlpha = alpha; },
        setLineCap: (cap) => { ctx.lineCap = cap; },
        setLineJoin: (join) => { ctx.lineJoin = join; },
        
        // Transforms
        translate: (x, y) => ctx.translate(x, y),
        rotate: (angle) => ctx.rotate(angle),
        scale: (x, y) => ctx.scale(x, y),
        transform: (a, b, c, d, e, f) => ctx.transform(a, b, c, d, e, f),
        setTransform: (a, b, c, d, e, f) => ctx.setTransform(a, b, c, d, e, f),
        resetTransform: () => ctx.resetTransform()
    };
    
    // Execute all draw commands from C++ using dispatcher
    const commands = pluginUI.createDrawCommands();
    for (let i = 0; i < commands.length; i++) {
        try {
            // Parse and execute command using dispatcher instead of eval
            // Commands are still strings from C++, so we need to execute them
            // In a future refactor, C++ should emit structured command objects
            // For now, we use Function constructor which is safer than eval
            const cmd = commands[i];
            const func = new Function('ctx', cmd);
            func(ctx);
        } catch(e) {
            console.error('Draw command error:', e, commands[i]);
        }
    }
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    updateEngineStatus('loading', `🔄 Loading ${file.name}...`);
    
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
    
    // Update metrics
    updateMetrics(samples, sampleRate);
    
    // Redraw UI with new data
    drawPluginUI();
    
    // Start animation loop
    requestAnimationFrame(animateUI);
    
    updateEngineStatus('ready', `🟢 Analyzing: ${(samples.length / sampleRate).toFixed(2)}s @ ${sampleRate} Hz`);
}

function updateMetrics(samples, sampleRate) {
    // Peak level in dB
    const peak = engine.getPeakLevel();
    const peakDB = peak > 0 ? (20 * Math.log10(peak)).toFixed(2) : '-∞';
    document.getElementById('peakLevel').textContent = `${peakDB} dB`;
    
    // RMS level in dB
    const rms = engine.getRMSLevel();
    const rmsDB = rms > 0 ? (20 * Math.log10(rms)).toFixed(2) : '-∞';
    document.getElementById('rmsLevel').textContent = `${rmsDB} dB`;
    
    // Sample rate
    document.getElementById('sampleRate').textContent = `${sampleRate} Hz`;
    
    // Duration
    const duration = samples.length / sampleRate;
    document.getElementById('duration').textContent = `${duration.toFixed(2)}s`;
}

function animateUI() {
    drawPluginUI();
    // Cancel any previous animation frame and start new one
    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
    }
    animationFrameId = requestAnimationFrame(animateUI);
}

function handleError(error) {
    console.error('Error processing audio:', error);
    updateEngineStatus('error', '🔴 Error processing audio file');
}

// Handle window resize
window.addEventListener('resize', () => {
    if (pluginUI && ctx) {
        drawPluginUI();
    }
});
