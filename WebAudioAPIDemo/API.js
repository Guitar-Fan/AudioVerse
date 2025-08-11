document.addEventListener('DOMContentLoaded', () => {
    // --- GLOBAL AUDIO CONTEXT & MASTER GAIN ---
    let audioContext;
    let masterGain;
    let isSynthPlaying = false;
    let oscillator;

    const playStopButton = document.getElementById('play-stop-button');
    const masterGainSlider = document.getElementById('master-gain');
    const masterGainValue = document.getElementById('master-gain-value');

    function initAudioContext() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create master gain node
            masterGain = audioContext.createGain();
            masterGain.gain.value = parseFloat(masterGainSlider.value);
            masterGain.connect(audioContext.destination);

            // Setup the rest of the audio graph
            setupAudioGraph();
        }
    }

    // --- AUDIO GRAPH NODES ---
    let adsrGain, filter, panner, convolver, analyser, convolverGain;

    function setupAudioGraph() {
        // ADSR Gain Node (for envelopes)
        adsrGain = audioContext.createGain();
        adsrGain.gain.value = 0; // Start silent

        // Filter Node
        filter = audioContext.createBiquadFilter();
        
        // Panner Node (for spatial audio)
        panner = audioContext.createPanner();
        panner.panningModel = 'HRTF';
        
        // Convolver & its gain (for reverb)
        convolver = audioContext.createConvolver();
        convolverGain = audioContext.createGain();
        convolverGain.gain.value = 0; // Reverb is off by default
        createReverb();

        // Analyser Node (for visualization)
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;

        // Modular Routing:
        // ADSR -> Filter -> Panner -> Master Gain
        adsrGain.connect(filter);
        filter.connect(panner);
        panner.connect(masterGain);

        // Parallel Reverb Channel:
        // Panner -> Convolver -> ConvolverGain -> Master Gain
        panner.connect(convolver);
        convolver.connect(convolverGain);
        convolverGain.connect(masterGain);

        // Connect Master Gain to Analyser (for visualization)
        masterGain.connect(analyser);
    }
    
    // --- 1. OSCILLATOR / SYNTHESIS ---
    const freqSlider = document.getElementById('frequency');
    const freqValue = document.getElementById('frequency-value');
    const waveformButtons = document.querySelectorAll('.waveform-button');
    let currentWaveform = 'sine';

    function toggleSynth() {
        initAudioContext();
        if (isSynthPlaying) {
            // Stop
            if (oscillator) oscillator.stop();
            playStopButton.textContent = 'Play Synth';
            playStopButton.classList.remove('stop');
            isSynthPlaying = false;
        } else {
            // Start
            oscillator = audioContext.createOscillator();
            oscillator.type = currentWaveform;
            oscillator.frequency.value = parseFloat(freqSlider.value);
            oscillator.connect(adsrGain); // Connect to ADSR gain
            oscillator.start();

            // When playing continuously, set ADSR gain to 1
            adsrGain.gain.cancelScheduledValues(audioContext.currentTime);
            adsrGain.gain.setValueAtTime(1, audioContext.currentTime);

            playStopButton.textContent = 'Stop Synth';
            playStopButton.classList.add('stop');
            isSynthPlaying = true;
        }
    }

    playStopButton.addEventListener('click', toggleSynth);
    
    freqSlider.addEventListener('input', (e) => {
        const newFreq = parseFloat(e.target.value);
        if (oscillator) {
            oscillator.frequency.setValueAtTime(newFreq, audioContext.currentTime);
        }
        freqValue.textContent = `${newFreq} Hz`;
    });

    waveformButtons.forEach(button => {
        button.addEventListener('click', () => {
            waveformButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            currentWaveform = button.dataset.wave;
            if (oscillator) {
                oscillator.type = currentWaveform;
            }
        });
    });

    // --- 2. ADSR ENVELOPE ---
    const attackSlider = document.getElementById('attack');
    const decaySlider = document.getElementById('decay');
    const sustainSlider = document.getElementById('sustain');
    const releaseSlider = document.getElementById('release');
    const triggerButton = document.getElementById('trigger-note-button');
    
    function triggerADSR(isNoteOn) {
        initAudioContext();
        if (!isSynthPlaying) { // Ensure synth is on to hear triggered note
            toggleSynth();
        }

        const now = audioContext.currentTime;
        const attackTime = parseFloat(attackSlider.value);
        const decayTime = parseFloat(decaySlider.value);
        const sustainLevel = parseFloat(sustainSlider.value);
        const releaseTime = parseFloat(releaseSlider.value);

        adsrGain.gain.cancelScheduledValues(now);

        if (isNoteOn) { // Note Press
            adsrGain.gain.setValueAtTime(adsrGain.gain.value, now); // Start from current value
            adsrGain.gain.linearRampToValueAtTime(1.0, now + attackTime); // Attack
            adsrGain.gain.linearRampToValueAtTime(sustainLevel, now + attackTime + decayTime); // Decay
        } else { // Note Release
            adsrGain.gain.setValueAtTime(adsrGain.gain.value, now);
            adsrGain.gain.linearRampToValueAtTime(0.0001, now + releaseTime); // Release
        }
    }

    triggerButton.addEventListener('mousedown', () => triggerADSR(true));
    triggerButton.addEventListener('mouseup', () => triggerADSR(false));
    triggerButton.addEventListener('mouseleave', () => {
        // If mouse is still down when leaving button, trigger release
        if (triggerButton.matches(':active')) {
            triggerADSR(false);
        }
    });

    // --- 3. FILTER ---
    const filterFreqSlider = document.getElementById('filter-freq');
    const filterTypeSelect = document.getElementById('filter-type');
    
    filterFreqSlider.addEventListener('input', (e) => {
        if(filter) filter.frequency.setTargetAtTime(parseFloat(e.target.value), audioContext.currentTime, 0.01);
        document.getElementById('filter-freq-value').textContent = `${e.target.value} Hz`;
    });
    
    filterTypeSelect.addEventListener('change', (e) => {
        if(filter) filter.type = e.target.value;
    });

    // --- 4. REVERB ---
    const reverbToggle = document.getElementById('reverb-toggle');

    function createReverb() {
        const sampleRate = audioContext.sampleRate;
        const length = sampleRate * 2; // 2 seconds reverb tail
        const impulse = audioContext.createBuffer(2, length, sampleRate);
        const impulseL = impulse.getChannelData(0);
        const impulseR = impulse.getChannelData(1);

        for (let i = 0; i < length; i++) {
            impulseL[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
            impulseR[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
        }
        convolver.buffer = impulse;
    }

    reverbToggle.addEventListener('change', (e) => {
        const gainValue = e.target.checked ? 1 : 0;
        if (convolverGain) {
            convolverGain.gain.setTargetAtTime(gainValue, audioContext.currentTime, 0.01);
        }
    });
    
    // --- 5. SPATIAL AUDIO ---
    const pannerXSlider = document.getElementById('panner-x');
    const pannerYSlider = document.getElementById('panner-y');
    const pannerZSlider = document.getElementById('panner-z');
    
    pannerXSlider.addEventListener('input', (e) => {
        if(panner) panner.positionX.setTargetAtTime(parseFloat(e.target.value), audioContext.currentTime, 0.01);
        document.getElementById('panner-x-value').textContent = e.target.value;
    });
    pannerYSlider.addEventListener('input', (e) => {
        if(panner) panner.positionY.setTargetAtTime(parseFloat(e.target.value), audioContext.currentTime, 0.01);
        document.getElementById('panner-y-value').textContent = e.target.value;
    });
    pannerZSlider.addEventListener('input', (e) => {
        if(panner) panner.positionZ.setTargetAtTime(parseFloat(e.target.value), audioContext.currentTime, 0.01);
        document.getElementById('panner-z-value').textContent = e.target.value;
    });
    
    // --- 6. LIVE INPUT & VISUALIZER ---
    const micButton = document.getElementById('mic-button');
    const canvas = document.getElementById('visualizer');
    const canvasCtx = canvas.getContext('2d');
    let micStream;
    let isMicOn = false;
    let animationFrameId;

    async function toggleMic() {
        initAudioContext();
        if (!isMicOn) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                micStream = audioContext.createMediaStreamSource(stream);
                micStream.connect(analyser); // Connect mic to analyser
                isMicOn = true;
                micButton.textContent = 'Stop Mic';
                micButton.classList.add('active');
                drawVisualizer();
            } catch (err) {
                console.error('Error accessing microphone:', err);
                alert('Could not access the microphone. Please grant permission.');
            }
        } else {
            micStream.disconnect();
            micStream.mediaStream.getTracks().forEach(track => track.stop());
            isMicOn = false;
            micButton.textContent = 'Start Mic';
            micButton.classList.remove('active');
            cancelAnimationFrame(animationFrameId);
            clearCanvas();
        }
    }

    function drawVisualizer() {
        animationFrameId = requestAnimationFrame(drawVisualizer);
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteTimeDomainData(dataArray);

        canvasCtx.fillStyle = '#1a1a1a';
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = '#00aaff';
        canvasCtx.beginPath();

        const sliceWidth = canvas.width * 1.0 / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * canvas.height / 2;
            if (i === 0) {
                canvasCtx.moveTo(x, y);
            } else {
                canvasCtx.lineTo(x, y);
            }
            x += sliceWidth;
        }

        canvasCtx.lineTo(canvas.width, canvas.height / 2);
        canvasCtx.stroke();
    }

    function clearCanvas() {
        canvasCtx.fillStyle = '#1a1a1a';
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    micButton.addEventListener('click', toggleMic);

    // --- SLIDER VALUE DISPLAYS ---
    function updateSliderDisplay(slider, display, suffix = '') {
        const value = parseFloat(slider.value).toFixed(2);
        display.textContent = `${value}${suffix}`;
    }

    masterGainSlider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        if(masterGain) masterGain.gain.setTargetAtTime(value, audioContext.currentTime, 0.01);
        masterGainValue.textContent = value.toFixed(2);
    });

    attackSlider.addEventListener('input', () => updateSliderDisplay(attackSlider, document.getElementById('attack-value'), 's'));
    decaySlider.addEventListener('input', () => updateSliderDisplay(decaySlider, document.getElementById('decay-value'), 's'));
    sustainSlider.addEventListener('input', () => updateSliderDisplay(sustainSlider, document.getElementById('sustain-value')));
    releaseSlider.addEventListener('input', () => updateSliderDisplay(releaseSlider, document.getElementById('release-value'), 's'));
});