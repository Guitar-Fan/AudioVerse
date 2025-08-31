// main.js
document.addEventListener('DOMContentLoaded', () => {
    // --- Global State ---
    let audioContext;
    let audioBuffer;
    let sourceNode;
    let lexikanNode;

    // --- DOM Elements ---
    const fileInput = document.getElementById('audio-file-input');
    const fileNameDisplay = document.getElementById('file-name');
    const playButton = document.getElementById('play-button');
    const stopButton = document.getElementById('stop-button');
    const downloadButton = document.getElementById('download-button');
    const statusLight = document.getElementById('status-light');
    const statusMessage = document.getElementById('status-message');
    
    // Parameter Controls
    const presetSelect = document.getElementById('preset-select');
    const algorithmSelect = document.getElementById('algorithm-select');
    const mixSlider = document.getElementById('mix-slider');
    const lengthSlider = document.getElementById('length-slider');
    const predelaySlider = document.getElementById('predelay-slider');
    const lowdampSlider = document.getElementById('lowdamp-slider');
    const highdampSlider = document.getElementById('highdamp-slider');
    const widthSlider = document.getElementById('width-slider');
    const modeSelect = document.getElementById('mode-select');

    // Value Displays
    const mixValue = document.getElementById('mix-value');
    const lengthValue = document.getElementById('length-value');
    const predelayValue = document.getElementById('predelay-value');
    const lowdampValue = document.getElementById('lowdamp-value');
    const highdampValue = document.getElementById('highdamp-value');
    const widthValue = document.getElementById('width-value');

    const controls = {
        slider26: algorithmSelect,
        slider27: mixSlider,
        slider3: lengthSlider,
        slider4: predelaySlider,
        slider5: lowdampSlider,
        slider6: highdampSlider,
        slider25: widthSlider,
        slider7: modeSelect,
    };

    // --- Presets (extracted from JSFX) ---
    const presets = [
        { name: "Short Amb", s: { 26: 0, 4: 1.83, 3: 0.0, 5: 183, 6: 2482.3, 25: 36.6, 27: 0.4022 } },
        { name: "Bright Amb", s: { 26: 0, 4: 53.68, 3: 0.2277, 5: 360, 6: 10000, 25: 66.5, 27: 0.3 } },
        { name: "80s Amb", s: { 26: 0, 4: 61, 3: 0.7449, 5: 134, 6: 5772, 25: 52.5, 27: 0.274 } },
        { name: "Reflections", s: { 26: 0, 4: 43.3, 3: 0.07878, 5: 0, 6: 6486, 25: 70, 27: 0.3351 } },
        { name: "Empty Room", s: { 26: 0, 4: 54.25, 3: 0.4277, 5: 543, 6: 8576, 25: 41.5, 27: 0.3351 } },
        { name: "300m2", s: { 26: 1, 4: 59.78, 3: 0.4277, 5: 158, 6: 5600, 25: 66.5, 27: 0.347 } },
        { name: "Stereo Spread", s: { 26: 1, 4: 100, 3: 0, 5: 879, 6: 4016, 25: 70, 27: 0.4 } },
        { name: "From booth", s: { 26: 1, 4: 52.45, 3: 0.45942, 5: 780, 6: 5333, 25: 32.7, 27: 0.3351 } },
        { name: "Amp on stage", s: { 26: 1, 4: 11.58, 3: 0.729, 5: 555, 6: 6980, 25: 49.87, 27: 0.2863 } },
        { name: "Snare & Tom", s: { 26: 1, 4: 16.46, 3: 0.372, 5: 860, 6: 8627, 25: 28, 27: 0.3 } },
        { name: "Rhodes Nice", s: { 26: 2, 4: 0, 3: 0.92, 5: 240, 6: 7027, 25: 58, 27: 0.2682 } },
        { name: "Venue", s: { 26: 2, 4: 45.71, 3: 0.6832, 5: 268.4, 6: 2808, 25: 100, 27: 0.41 } },
        { name: "Livelyness", s: { 26: 2, 4: 11.55, 3: 0, 5: 158.6, 6: 5498, 25: 100, 27: 0.2682 } },
        { name: "Shiny Diamond", s: { 26: 2, 4: 51.81, 3: 3.05, 5: 506, 6: 2317, 25: 73, 27: 0.3656 } },
        { name: "MedDlyRoom", s: { 26: 2, 4: 79.2, 3: 0.8, 5: 690, 6: 4732, 25: 86, 27: 0.445 } },
        { name: "Vocals Hall", s: { 26: 3, 4: 41, 3: 1.763, 5: 268.4, 6: 3580, 25: 100, 27: 0.4451 } },
        { name: "Bright Hall", s: { 26: 3, 4: 21.5, 3: 2.59, 5: 353.4, 6: 5886, 25: 100, 27: 0.441 } },
        { name: "Jazz Hall", s: { 26: 3, 4: 0, 3: 1.03, 5: 353.4, 6: 1603, 25: 32.29, 27: 0.5 } },
        { name: "Auto Park", s: { 26: 3, 4: 63.44, 3: 4.593, 5: 353.4, 6: 2537, 25: 41.44, 27: 0.4634 } },
        { name: "Gothic Hall", s: { 26: 3, 4: 91, 3: 3.617, 5: 170, 6: 1988, 25: 80.48, 27: 0.4756 } },
        { name: "Ballad", s: { 26: 3, 4: 17, 3: 2.732, 5: 232, 6: 5000, 25: 31.7, 27: 0.445 } },
        { name: "The Boxer", s: { 26: 4, 4: 100, 3: 1.9274, 5: 0, 6: 5600, 25: 64.86, 27: 0.441 } },
        { name: "Snare Plate", s: { 26: 4, 4: 39, 3: 1.49, 5: 759, 6: 3138, 25: 100, 27: 0.372 } },
        { name: "Housten", s: { 26: 4, 4: 13.4, 3: 1.92, 5: 566, 6: 4461, 25: 100, 27: 0.41 } },
        { name: "Hot Plate", s: { 26: 4, 4: 61, 3: 1.26, 5: 351, 6: 4015, 25: 62, 27: 0.42 } }
    ];

    // --- Initialization ---
    function init() {
        setupEventListeners();
        populatePresets();
        updateAllDisplays();
    }

    function setupEventListeners() {
        fileInput.addEventListener('change', handleFileSelect);
        playButton.addEventListener('click', playAudio);
        stopButton.addEventListener('click', stopAudio);
        downloadButton.addEventListener('click', downloadAudio);

        Object.values(controls).forEach(control => {
            control.addEventListener('input', () => {
                presetSelect.value = -1; // Set to manual on any change
                sendParamsToWorklet();
            });
        });
        
        presetSelect.addEventListener('change', handlePresetChange);

        mixSlider.addEventListener('input', () => updateAllDisplays());
        lengthSlider.addEventListener('input', () => updateAllDisplays());
        predelaySlider.addEventListener('input', () => updateAllDisplays());
        lowdampSlider.addEventListener('input', () => updateAllDisplays());
        highdampSlider.addEventListener('input', () => updateAllDisplays());
        widthSlider.addEventListener('input', () => updateAllDisplays());
    }
    
    function populatePresets() {
        presets.forEach((preset, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = preset.name;
            presetSelect.appendChild(option);
        });
    }

    // --- AudioContext Management ---
    async function setupAudioContext() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            await audioContext.audioWorklet.addModule('lexikan-processor.js');
        }
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        lexikanNode = new AudioWorkletNode(audioContext, 'lexikan-processor');
        lexikanNode.port.onmessage = (event) => {
            if (event.data.type === 'ready') {
                console.log('Lexikan processor is ready.');
                sendParamsToWorklet(); // Send initial params
            }
        };
    }
    
    // --- UI Update Functions ---
    function updateStatus(message, isProcessing = false) {
        statusMessage.textContent = message;
        statusLight.style.backgroundColor = isProcessing ? 'var(--status-processing)' : 'var(--status-ready)';
    }

    function updateAllDisplays() {
        mixValue.textContent = `${(parseFloat(mixSlider.value) * 100).toFixed(0)}%`;
        lengthValue.textContent = `${parseFloat(lengthSlider.value).toFixed(2)}s`;
        predelayValue.textContent = `${predelaySlider.value}ms`;
        lowdampValue.textContent = `${lowdampSlider.value}Hz`;
        highdampValue.textContent = `${highdampSlider.value}Hz`;
        widthValue.textContent = `${widthSlider.value}%`;
    }

    // --- Event Handlers ---
    async function handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        fileNameDisplay.textContent = file.name;
        playButton.disabled = true;
        stopButton.disabled = true;
        downloadButton.disabled = true;
        updateStatus('Decoding audio file...', true);
        
        try {
            await setupAudioContext();
            const arrayBuffer = await file.arrayBuffer();
            audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            updateStatus('File ready. Press Play.', false);
            playButton.disabled = false;
            downloadButton.disabled = false;
        } catch (error) {
            console.error('Error decoding audio file:', error);
            updateStatus(`Error: ${error.message}`, false);
            fileNameDisplay.textContent = 'Failed to load file.';
        }
    }
    
    function handlePresetChange() {
        const presetIndex = parseInt(presetSelect.value, 10);
        if (presetIndex < 0) return;

        const preset = presets[presetIndex];
        const { s } = preset;
        
        for (const key in s) {
            const sliderId = `slider${key}`;
            if (controls[sliderId]) {
                controls[sliderId].value = s[key];
            }
        }
        
        updateAllDisplays();
        sendParamsToWorklet();
    }

    // --- Core Logic ---
    function collectParams() {
        const params = {};
        for (const key in controls) {
            params[key] = parseFloat(controls[key].value);
        }
        return params;
    }

    function sendParamsToWorklet() {
        if (!lexikanNode) return;
        const params = collectParams();
        lexikanNode.port.postMessage({ type: 'params', params });
    }

    function playAudio() {
        if (!audioBuffer || !lexikanNode) return;
        if (sourceNode) {
            sourceNode.stop();
        }

        sourceNode = audioContext.createBufferSource();
        sourceNode.buffer = audioBuffer;
        
        sourceNode.connect(lexikanNode).connect(audioContext.destination);
        sourceNode.start(0);

        playButton.disabled = true;
        stopButton.disabled = false;
        updateStatus('Playing...', true);

        sourceNode.onended = () => {
            if (playButton.disabled) { // Only reset if not manually stopped
                playButton.disabled = false;
                stopButton.disabled = true;
                updateStatus('Playback finished. Ready.', false);
            }
        };
    }

    function stopAudio() {
        if (sourceNode) {
            sourceNode.stop();
            sourceNode.onended = null; // Prevent onended from firing
        }
        playButton.disabled = false;
        stopButton.disabled = true;
        updateStatus('Stopped. Ready.', false);
    }
    
    async function downloadAudio() {
        if (!audioBuffer) {
            alert("Please load an audio file first.");
            return;
        }
        
        updateStatus('Processing for download...', true);
        downloadButton.disabled = true;

        try {
            const offlineContext = new OfflineAudioContext(
                audioBuffer.numberOfChannels,
                audioBuffer.length,
                audioBuffer.sampleRate
            );
            
            await offlineContext.audioWorklet.addModule('lexikan-processor.js');
            const offlineLexikanNode = new AudioWorkletNode(offlineContext, 'lexikan-processor');
            
            // Send current parameters to the offline node
            const params = collectParams();
            offlineLexikanNode.port.postMessage({ type: 'params', params });

            const bufferSource = offlineContext.createBufferSource();
            bufferSource.buffer = audioBuffer;
            
            bufferSource.connect(offlineLexikanNode).connect(offlineContext.destination);
            bufferSource.start(0);

            const renderedBuffer = await offlineContext.startRendering();
            
            const wavBlob = bufferToWave(renderedBuffer);
            const url = URL.createObjectURL(wavBlob);
            
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `lexikan_${fileNameDisplay.textContent}.wav`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            updateStatus('Download ready! Ready.', false);

        } catch (error) {
            console.error("Failed to render audio:", error);
            updateStatus(`Error during rendering: ${error.message}`, false);
        } finally {
            downloadButton.disabled = false;
        }
    }
    
    // --- Utility: AudioBuffer to WAV ---
    function bufferToWave(abuffer) {
        let numOfChan = abuffer.numberOfChannels,
            length = abuffer.length * numOfChan * 2 + 44,
            buffer = new ArrayBuffer(length),
            view = new DataView(buffer),
            channels = [],
            i, sample,
            offset = 0,
            pos = 0;

        // write WAVE header
        setUint32(0x46464952); // "RIFF"
        setUint32(length - 8); // file length - 8
        setUint32(0x45564157); // "WAVE"

        setUint32(0x20746d66); // "fmt " chunk
        setUint32(16); // length = 16
        setUint16(1); // PCM (uncompressed)
        setUint16(numOfChan);
        setUint32(abuffer.sampleRate);
        setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
        setUint16(numOfChan * 2); // block-align
        setUint16(16); // 16-bit audio

        setUint32(0x61746164); // "data" - chunk
        setUint32(length - pos - 4); // chunk length

        // write interleaved data
        for (i = 0; i < abuffer.numberOfChannels; i++)
            channels.push(abuffer.getChannelData(i));

        while (pos < length) {
            for (i = 0; i < numOfChan; i++) { 
                sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
                sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // scale to 16-bit signed int
                view.setInt16(pos, sample, true); 
                pos += 2;
            }
            offset++
        }

        return new Blob([buffer], { type: "audio/wav" });

        function setUint16(data) {
            view.setUint16(pos, data, true);
            pos += 2;
        }

        function setUint32(data) {
            view.setUint32(pos, data, true);
            pos += 4;
        }
    }


    init();
});