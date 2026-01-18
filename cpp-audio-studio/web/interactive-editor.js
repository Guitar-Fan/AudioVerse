// Interactive Low-Level Audio Editor
// Features: Harmonic dragging, waveform peak editing, frequency manipulation

class InteractiveAudioEditor {
    constructor() {
        this.audioData = null;
        this.sampleRate = 48000;
        this.harmonics = [];
        this.waveformPeaks = [];
        this.frequencyBins = [];
        this.amplitudeEnvelope = [];
        
        // Mouse interaction state
        this.isDragging = false;
        this.dragTarget = null;
        this.dragType = null; // 'harmonic', 'peak', 'frequency', 'amplitude'
        this.dragIndex = -1;
        
        // Canvas references
        this.canvases = {};
        this.contexts = {};
        
        // Real-time FFT analysis
        this.fftSize = 4096;
        this.hopSize = 1024;
        this.spectrogram = [];
        
        // Editing history for undo/redo
        this.history = [];
        this.historyIndex = -1;
        
        // Grid snapping
        this.snapToGrid = false;
        this.gridSize = 10;
    }
    
    // Initialize with audio data
    loadAudio(samples, sampleRate) {
        this.audioData = new Float32Array(samples);
        this.sampleRate = sampleRate;
        this.analyzeAudio();
        this.saveHistory();
    }
    
    // Comprehensive audio analysis
    analyzeAudio() {
        if (!this.audioData) return;
        
        // Detect peaks for waveform editing
        this.detectPeaks();
        
        // Harmonic analysis using FFT
        this.extractHarmonics();
        
        // Frequency spectrum analysis
        this.analyzeFrequencySpectrum();
        
        // Amplitude envelope extraction
        this.extractAmplitudeEnvelope();
        
        // Generate spectrogram
        this.generateSpectrogram();
    }
    
    // Detect waveform peaks
    detectPeaks() {
        this.waveformPeaks = [];
        const threshold = 0.1;
        const minDistance = 100; // samples
        
        for (let i = 1; i < this.audioData.length - 1; i++) {
            const current = Math.abs(this.audioData[i]);
            const prev = Math.abs(this.audioData[i - 1]);
            const next = Math.abs(this.audioData[i + 1]);
            
            if (current > threshold && current > prev && current > next) {
                // Check minimum distance from last peak
                if (this.waveformPeaks.length === 0 || 
                    i - this.waveformPeaks[this.waveformPeaks.length - 1].index > minDistance) {
                    this.waveformPeaks.push({
                        index: i,
                        value: this.audioData[i],
                        time: i / this.sampleRate
                    });
                }
            }
        }
    }
    
    // Extract harmonics using FFT
    extractHarmonics() {
        this.harmonics = [];
        
        // Perform FFT on the entire signal (or a representative chunk)
        const fftData = this.performFFT(this.audioData.slice(0, this.fftSize));
        
        // Find peaks in frequency spectrum (harmonics)
        const magnitudes = fftData.magnitudes;
        const threshold = Math.max(...magnitudes) * 0.1; // 10% of max
        
        for (let i = 5; i < magnitudes.length / 2; i++) { // Skip DC and very low freq
            if (magnitudes[i] > threshold) {
                const prev = magnitudes[i - 1] || 0;
                const next = magnitudes[i + 1] || 0;
                
                // Local maximum
                if (magnitudes[i] > prev && magnitudes[i] > next) {
                    const frequency = (i * this.sampleRate) / this.fftSize;
                    this.harmonics.push({
                        bin: i,
                        frequency: frequency,
                        magnitude: magnitudes[i],
                        phase: fftData.phases[i]
                    });
                }
            }
        }
        
        // Sort by magnitude and keep top 20 harmonics
        this.harmonics.sort((a, b) => b.magnitude - a.magnitude);
        this.harmonics = this.harmonics.slice(0, 20);
    }
    
    // Analyze frequency spectrum
    analyzeFrequencySpectrum() {
        const fftData = this.performFFT(this.audioData.slice(0, this.fftSize));
        this.frequencyBins = fftData.magnitudes.slice(0, fftData.magnitudes.length / 2);
    }
    
    // Extract amplitude envelope
    extractAmplitudeEnvelope() {
        this.amplitudeEnvelope = [];
        const windowSize = 1024;
        const hopSize = 512;
        
        for (let i = 0; i < this.audioData.length - windowSize; i += hopSize) {
            let sum = 0;
            for (let j = 0; j < windowSize; j++) {
                sum += this.audioData[i + j] * this.audioData[i + j];
            }
            const rms = Math.sqrt(sum / windowSize);
            this.amplitudeEnvelope.push({
                index: i,
                value: rms,
                time: i / this.sampleRate
            });
        }
    }
    
    // Generate spectrogram
    generateSpectrogram() {
        this.spectrogram = [];
        
        for (let i = 0; i < this.audioData.length - this.fftSize; i += this.hopSize) {
            const chunk = this.audioData.slice(i, i + this.fftSize);
            const fftData = this.performFFT(chunk);
            this.spectrogram.push(fftData.magnitudes.slice(0, fftData.magnitudes.length / 2));
        }
    }
    
    // Perform FFT analysis using a more efficient approach
    performFFT(samples) {
        // Use Web Audio API's AnalyserNode for performant FFT
        // This is much faster than O(n²) DFT and suitable for real-time use
        const N = samples.length;
        
        // For offline processing, we'll use a simple but faster radix-2 FFT
        // First, ensure N is a power of 2
        let fftSize = 1;
        while (fftSize < N) fftSize *= 2;
        
        const real = new Float32Array(fftSize);
        const imag = new Float32Array(fftSize);
        
        // Copy samples and apply Hanning window
        for (let i = 0; i < N; i++) {
            const window = 0.5 * (1 - Math.cos(2 * Math.PI * i / N));
            real[i] = samples[i] * window;
            imag[i] = 0;
        }
        // Pad with zeros if needed
        for (let i = N; i < fftSize; i++) {
            real[i] = 0;
            imag[i] = 0;
        }
        
        // Cooley-Tukey FFT algorithm (radix-2)
        // Bit-reverse reordering
        for (let i = 0; i < fftSize; i++) {
            let j = 0;
            for (let k = 0, m = i; k < Math.log2(fftSize); k++) {
                j = (j << 1) | (m & 1);
                m >>= 1;
            }
            if (j > i) {
                [real[i], real[j]] = [real[j], real[i]];
                [imag[i], imag[j]] = [imag[j], imag[i]];
            }
        }
        
        // FFT computation
        for (let len = 2; len <= fftSize; len *= 2) {
            const halfLen = len / 2;
            const angle = -2 * Math.PI / len;
            for (let i = 0; i < fftSize; i += len) {
                for (let j = 0; j < halfLen; j++) {
                    const wr = Math.cos(angle * j);
                    const wi = Math.sin(angle * j);
                    const tr = real[i + j + halfLen] * wr - imag[i + j + halfLen] * wi;
                    const ti = real[i + j + halfLen] * wi + imag[i + j + halfLen] * wr;
                    real[i + j + halfLen] = real[i + j] - tr;
                    imag[i + j + halfLen] = imag[i + j] - ti;
                    real[i + j] += tr;
                    imag[i + j] += ti;
                }
            }
        }
        
        // Compute magnitudes and phases
        const magnitudes = new Float32Array(fftSize);
        const phases = new Float32Array(fftSize);
        
        for (let k = 0; k < fftSize; k++) {
            magnitudes[k] = Math.sqrt(real[k] * real[k] + imag[k] * imag[k]) / fftSize;
            phases[k] = Math.atan2(imag[k], real[k]);
        }
        
        return { magnitudes, phases };
    }
    
    // Setup interactive canvas
    setupCanvas(canvasId, type) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        this.canvases[type] = canvas;
        this.contexts[type] = canvas.getContext('2d');
        
        // Mouse event handlers
        canvas.addEventListener('mousedown', (e) => this.onMouseDown(e, type));
        canvas.addEventListener('mousemove', (e) => this.onMouseMove(e, type));
        canvas.addEventListener('mouseup', (e) => this.onMouseUp(e, type));
        canvas.addEventListener('mouseleave', (e) => this.onMouseUp(e, type));
        
        // Touch support
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            canvas.dispatchEvent(mouseEvent);
        });
        
        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            canvas.dispatchEvent(mouseEvent);
        });
        
        canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            const mouseEvent = new MouseEvent('mouseup', {});
            canvas.dispatchEvent(mouseEvent);
        });
        
        // Render initial state
        this.render(type);
    }
    
    // Mouse event handlers
    onMouseDown(e, type) {
        const rect = this.canvases[type].getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Find what we're clicking on
        const target = this.findTargetAt(x, y, type);
        
        if (target) {
            this.isDragging = true;
            this.dragType = type;
            this.dragTarget = target;
            this.dragIndex = target.index;
            this.canvases[type].style.cursor = 'grabbing';
        }
    }
    
    onMouseMove(e, type) {
        const rect = this.canvases[type].getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        if (this.isDragging && this.dragType === type) {
            // Update the dragged element
            this.updateDragTarget(x, y, type);
            this.render(type);
            
            // Real-time audio update (optional - can be expensive)
            if (type === 'waveform' || type === 'amplitude') {
                this.applyEdits();
            }
        } else {
            // Change cursor if hovering over draggable element
            const target = this.findTargetAt(x, y, type);
            this.canvases[type].style.cursor = target ? 'grab' : 'crosshair';
        }
    }
    
    onMouseUp(e, type) {
        if (this.isDragging) {
            this.isDragging = false;
            this.dragTarget = null;
            this.dragType = null;
            this.dragIndex = -1;
            this.canvases[type].style.cursor = 'crosshair';
            
            // Save to history
            this.saveHistory();
            
            // Apply final edits
            this.applyEdits();
        }
    }
    
    // Find what element is at mouse position
    findTargetAt(x, y, type) {
        const canvas = this.canvases[type];
        const width = canvas.width / window.devicePixelRatio;
        const height = canvas.height / window.devicePixelRatio;
        const hitRadius = 10; // pixels
        
        if (type === 'harmonics') {
            // Check harmonics
            for (let i = 0; i < this.harmonics.length; i++) {
                const h = this.harmonics[i];
                const xPos = (h.frequency / (this.sampleRate / 2)) * width;
                const yPos = height - (h.magnitude / this.getMaxMagnitude()) * height;
                
                const distance = Math.sqrt((x - xPos) ** 2 + (y - yPos) ** 2);
                if (distance < hitRadius) {
                    return { type: 'harmonic', index: i, harmonic: h };
                }
            }
        } else if (type === 'waveform') {
            // Check waveform peaks
            for (let i = 0; i < this.waveformPeaks.length; i++) {
                const peak = this.waveformPeaks[i];
                const xPos = (peak.index / this.audioData.length) * width;
                const yPos = height / 2 - peak.value * (height / 2);
                
                const distance = Math.sqrt((x - xPos) ** 2 + (y - yPos) ** 2);
                if (distance < hitRadius) {
                    return { type: 'peak', index: i, peak: peak };
                }
            }
        } else if (type === 'frequency') {
            // Check frequency bins
            const binWidth = width / this.frequencyBins.length;
            const binIndex = Math.floor(x / binWidth);
            
            if (binIndex >= 0 && binIndex < this.frequencyBins.length) {
                const binHeight = (this.frequencyBins[binIndex] / Math.max(...this.frequencyBins)) * height;
                if (Math.abs(y - (height - binHeight)) < hitRadius) {
                    return { type: 'frequency', index: binIndex };
                }
            }
        } else if (type === 'amplitude') {
            // Check amplitude envelope points
            for (let i = 0; i < this.amplitudeEnvelope.length; i++) {
                const env = this.amplitudeEnvelope[i];
                const xPos = (env.index / this.audioData.length) * width;
                const yPos = height - env.value * height;
                
                const distance = Math.sqrt((x - xPos) ** 2 + (y - yPos) ** 2);
                if (distance < hitRadius) {
                    return { type: 'amplitude', index: i, envelope: env };
                }
            }
        }
        
        return null;
    }
    
    // Update dragged element position
    updateDragTarget(x, y, type) {
        const canvas = this.canvases[type];
        const width = canvas.width / window.devicePixelRatio;
        const height = canvas.height / window.devicePixelRatio;
        
        if (type === 'harmonics' && this.dragTarget.type === 'harmonic') {
            const h = this.harmonics[this.dragIndex];
            
            // Update frequency
            h.frequency = (x / width) * (this.sampleRate / 2);
            h.frequency = Math.max(20, Math.min(this.sampleRate / 2, h.frequency));
            
            // Update magnitude
            const maxMag = this.getMaxMagnitude();
            h.magnitude = ((height - y) / height) * maxMag;
            h.magnitude = Math.max(0, h.magnitude);
            
        } else if (type === 'waveform' && this.dragTarget.type === 'peak') {
            const peak = this.waveformPeaks[this.dragIndex];
            
            // Update amplitude
            const newValue = (height / 2 - y) / (height / 2);
            peak.value = Math.max(-1, Math.min(1, newValue));
            
            // Update actual audio data at peak location
            this.audioData[peak.index] = peak.value;
            
            // Smooth surrounding samples
            this.smoothAroundPeak(peak.index, 50);
            
        } else if (type === 'frequency' && this.dragTarget.type === 'frequency') {
            const binIndex = this.dragIndex;
            const maxMag = Math.max(...this.frequencyBins);
            
            // Update frequency bin magnitude
            this.frequencyBins[binIndex] = ((height - y) / height) * maxMag;
            this.frequencyBins[binIndex] = Math.max(0, this.frequencyBins[binIndex]);
            
        } else if (type === 'amplitude' && this.dragTarget.type === 'amplitude') {
            const env = this.amplitudeEnvelope[this.dragIndex];
            
            // Update envelope value
            env.value = (height - y) / height;
            env.value = Math.max(0, Math.min(1, env.value));
        }
    }
    
    // Smooth waveform around a peak
    smoothAroundPeak(index, radius) {
        const startIdx = Math.max(0, index - radius);
        const endIdx = Math.min(this.audioData.length - 1, index + radius);
        
        for (let i = startIdx; i <= endIdx; i++) {
            if (i === index) continue;
            
            const distance = Math.abs(i - index);
            const weight = 1 - (distance / radius);
            
            // Interpolate between original and peak value
            const targetValue = this.audioData[index] * weight;
            this.audioData[i] = this.audioData[i] * (1 - weight * 0.5) + targetValue * (weight * 0.5);
        }
    }
    
    // Apply edits to reconstruct audio from modified parameters
    applyEdits() {
        if (!this.audioData) return;
        
        // This could involve:
        // 1. Inverse FFT to reconstruct from modified harmonics
        // 2. Apply modified amplitude envelope
        // 3. Update waveform from peaks
        
        // For now, we've been directly modifying audioData
        // In a full implementation, you would use IFFT to reconstruct from modified frequency domain
        
        // Notify analyzer engine if it exists
        if (typeof analyzerEngine !== 'undefined' && analyzerEngine) {
            analyzerEngine.loadAudioData(Array.from(this.audioData));
        }
    }
    
    // Render visualization
    render(type) {
        const canvas = this.canvases[type];
        const ctx = this.contexts[type];
        
        if (!canvas || !ctx) return;
        
        canvas.width = canvas.offsetWidth * window.devicePixelRatio;
        canvas.height = canvas.offsetHeight * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        
        const width = canvas.offsetWidth;
        const height = canvas.offsetHeight;
        
        ctx.clearRect(0, 0, width, height);
        
        // Dark background
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, width, height);
        
        // Grid
        this.drawGrid(ctx, width, height);
        
        if (type === 'harmonics') {
            this.renderHarmonics(ctx, width, height);
        } else if (type === 'waveform') {
            this.renderWaveformWithPeaks(ctx, width, height);
        } else if (type === 'frequency') {
            this.renderFrequencySpectrum(ctx, width, height);
        } else if (type === 'amplitude') {
            this.renderAmplitudeEnvelope(ctx, width, height);
        } else if (type === 'spectrogram') {
            this.renderSpectrogram(ctx, width, height);
        }
    }
    
    // Draw grid
    drawGrid(ctx, width, height) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        
        // Vertical lines
        for (let x = 0; x < width; x += 50) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        
        // Horizontal lines
        for (let y = 0; y < height; y += 50) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        // Center line
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
    }
    
    // Render harmonics
    renderHarmonics(ctx, width, height) {
        if (this.harmonics.length === 0) return;
        
        const maxMag = this.getMaxMagnitude();
        
        // Draw harmonic stems
        this.harmonics.forEach((h, idx) => {
            const x = (h.frequency / (this.sampleRate / 2)) * width;
            const y = height - (h.magnitude / maxMag) * height;
            
            // Stem
            ctx.strokeStyle = `hsl(${(idx / this.harmonics.length) * 360}, 70%, 50%)`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x, height);
            ctx.lineTo(x, y);
            ctx.stroke();
            
            // Draggable point
            const isActive = this.isDragging && this.dragIndex === idx && this.dragType === 'harmonics';
            ctx.fillStyle = isActive ? '#00ff00' : `hsl(${(idx / this.harmonics.length) * 360}, 70%, 60%)`;
            ctx.beginPath();
            ctx.arc(x, y, isActive ? 8 : 6, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Label
            ctx.fillStyle = '#fff';
            ctx.font = '10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`${h.frequency.toFixed(0)}Hz`, x, y - 12);
        });
        
        // Legend
        ctx.fillStyle = '#999';
        ctx.font = '12px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('Drag points to adjust harmonic frequency & magnitude', 10, 20);
    }
    
    // Render waveform with peaks
    renderWaveformWithPeaks(ctx, width, height) {
        if (!this.audioData) return;
        
        // Draw waveform
        ctx.strokeStyle = 'rgba(0, 212, 255, 0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        
        const downsample = Math.max(1, Math.floor(this.audioData.length / (width * 2)));
        
        for (let i = 0; i < this.audioData.length; i += downsample) {
            const x = (i / this.audioData.length) * width;
            const y = height / 2 - this.audioData[i] * (height / 2);
            
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        
        ctx.stroke();
        
        // Draw peaks
        this.waveformPeaks.forEach((peak, idx) => {
            const x = (peak.index / this.audioData.length) * width;
            const y = height / 2 - peak.value * (height / 2);
            
            const isActive = this.isDragging && this.dragIndex === idx && this.dragType === 'waveform';
            
            // Peak point
            ctx.fillStyle = isActive ? '#00ff00' : '#ff0066';
            ctx.beginPath();
            ctx.arc(x, y, isActive ? 8 : 5, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Crosshair
            if (isActive) {
                ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();
            }
        });
        
        // Legend
        ctx.fillStyle = '#999';
        ctx.font = '12px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`Drag peak points to reshape waveform (${this.waveformPeaks.length} peaks detected)`, 10, 20);
    }
    
    // Render frequency spectrum
    renderFrequencySpectrum(ctx, width, height) {
        if (this.frequencyBins.length === 0) return;
        
        const barWidth = width / this.frequencyBins.length;
        const maxMag = Math.max(...this.frequencyBins);
        
        this.frequencyBins.forEach((mag, idx) => {
            const x = idx * barWidth;
            const barHeight = (mag / maxMag) * height;
            const y = height - barHeight;
            
            const isActive = this.isDragging && this.dragIndex === idx && this.dragType === 'frequency';
            
            // Bar
            const hue = (idx / this.frequencyBins.length) * 240;
            ctx.fillStyle = isActive ? '#00ff00' : `hsl(${hue}, 80%, 50%)`;
            ctx.fillRect(x, y, barWidth - 1, barHeight);
            
            // Highlight bar on hover/drag
            if (isActive) {
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.strokeRect(x, y, barWidth - 1, barHeight);
            }
        });
        
        // Frequency labels
        ctx.fillStyle = '#999';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        
        const labelPositions = [0, 0.25, 0.5, 0.75, 1];
        labelPositions.forEach(pos => {
            const x = pos * width;
            const freq = (pos * this.sampleRate / 2).toFixed(0);
            ctx.fillText(`${freq}Hz`, x, height - 5);
        });
        
        // Legend
        ctx.fillStyle = '#999';
        ctx.font = '12px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('Drag frequency bars to adjust spectrum shape', 10, 20);
    }
    
    // Render amplitude envelope
    renderAmplitudeEnvelope(ctx, width, height) {
        if (this.amplitudeEnvelope.length === 0) return;
        
        // Draw envelope curve
        ctx.strokeStyle = '#ff6ec7';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        this.amplitudeEnvelope.forEach((env, idx) => {
            const x = (env.index / this.audioData.length) * width;
            const y = height - env.value * height;
            
            if (idx === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        
        ctx.stroke();
        
        // Draw control points
        this.amplitudeEnvelope.forEach((env, idx) => {
            const x = (env.index / this.audioData.length) * width;
            const y = height - env.value * height;
            
            const isActive = this.isDragging && this.dragIndex === idx && this.dragType === 'amplitude';
            
            ctx.fillStyle = isActive ? '#00ff00' : '#ff6ec7';
            ctx.beginPath();
            ctx.arc(x, y, isActive ? 7 : 4, 0, Math.PI * 2);
            ctx.fill();
            
            if (isActive) {
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        });
        
        // Legend
        ctx.fillStyle = '#999';
        ctx.font = '12px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('Drag envelope points to reshape amplitude over time', 10, 20);
    }
    
    // Render spectrogram
    renderSpectrogram(ctx, width, height) {
        if (this.spectrogram.length === 0) return;
        
        const timeStep = width / this.spectrogram.length;
        const freqStep = height / (this.spectrogram[0].length);
        
        this.spectrogram.forEach((frame, timeIdx) => {
            const maxMag = Math.max(...frame);
            
            frame.forEach((mag, freqIdx) => {
                const x = timeIdx * timeStep;
                const y = height - (freqIdx + 1) * freqStep;
                
                const intensity = mag / maxMag;
                const r = Math.floor(intensity * 255);
                const g = Math.floor(intensity * 128);
                const b = Math.floor((1 - intensity) * 255);
                
                ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                ctx.fillRect(x, y, timeStep + 1, freqStep + 1);
            });
        });
        
        // Legend
        ctx.fillStyle = '#fff';
        ctx.font = '12px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('Spectrogram: Time vs Frequency vs Magnitude', 10, 20);
    }
    
    // Utility: Get maximum magnitude
    getMaxMagnitude() {
        return Math.max(...this.harmonics.map(h => h.magnitude), 1);
    }
    
    // History management
    saveHistory() {
        // Remove any history after current index
        this.history = this.history.slice(0, this.historyIndex + 1);
        
        // Save current state
        this.history.push({
            audioData: new Float32Array(this.audioData),
            harmonics: JSON.parse(JSON.stringify(this.harmonics)),
            waveformPeaks: JSON.parse(JSON.stringify(this.waveformPeaks)),
            frequencyBins: new Float32Array(this.frequencyBins),
            amplitudeEnvelope: JSON.parse(JSON.stringify(this.amplitudeEnvelope))
        });
        
        this.historyIndex++;
        
        // Limit history size
        if (this.history.length > 50) {
            this.history.shift();
            this.historyIndex--;
        }
    }
    
    // Undo
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            const state = this.history[this.historyIndex];
            this.restoreState(state);
        }
    }
    
    // Redo
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            const state = this.history[this.historyIndex];
            this.restoreState(state);
        }
    }
    
    // Restore state
    restoreState(state) {
        this.audioData = new Float32Array(state.audioData);
        this.harmonics = JSON.parse(JSON.stringify(state.harmonics));
        this.waveformPeaks = JSON.parse(JSON.stringify(state.waveformPeaks));
        this.frequencyBins = new Float32Array(state.frequencyBins);
        this.amplitudeEnvelope = JSON.parse(JSON.stringify(state.amplitudeEnvelope));
        
        // Re-render all
        Object.keys(this.canvases).forEach(type => this.render(type));
        
        // Update audio
        this.applyEdits();
    }
    
    // Export edited audio
    getEditedAudio() {
        return Array.from(this.audioData);
    }
}

// Global instance
let interactiveEditor = null;

// Initialize interactive editor
function initInteractiveEditor() {
    interactiveEditor = new InteractiveAudioEditor();
    console.log('Interactive Audio Editor initialized');
}

// Show interactive editor view
function showInteractiveView() {
    const content = document.getElementById('tabContent');
    content.innerHTML = `
        <div class="interactive-controls" style="margin-bottom: 20px; display: flex; gap: 10px; flex-wrap: wrap;">
            <button class="btn btn-secondary" onclick="interactiveEditor.undo()">↶ Undo</button>
            <button class="btn btn-secondary" onclick="interactiveEditor.redo()">↷ Redo</button>
            <button class="btn btn-secondary" onclick="interactiveReanalyze()">🔄 Re-analyze</button>
            <button class="btn btn-secondary" onclick="exportEditedAudio()">💾 Export</button>
            <button class="btn" onclick="applyInteractiveEdits()">✓ Apply to Track</button>
        </div>
        
        <div class="analysis-grid">
            <div class="viz-card">
                <div class="viz-title">🎯 Interactive Harmonics Editor</div>
                <canvas id="interactiveHarmonics" style="cursor: crosshair;"></canvas>
            </div>
            <div class="viz-card">
                <div class="viz-title">🌊 Interactive Waveform Editor</div>
                <canvas id="interactiveWaveform" style="cursor: crosshair;"></canvas>
            </div>
            <div class="viz-card">
                <div class="viz-title">📊 Interactive Frequency Editor</div>
                <canvas id="interactiveFrequency" style="cursor: crosshair;"></canvas>
            </div>
            <div class="viz-card">
                <div class="viz-title">📈 Interactive Amplitude Envelope</div>
                <canvas id="interactiveAmplitude" style="cursor: crosshair;"></canvas>
            </div>
        </div>
        
        <div class="viz-card" style="margin-top: 15px;">
            <div class="viz-title">🎨 Spectrogram (Read-only)</div>
            <canvas id="interactiveSpectrogram"></canvas>
        </div>
        
        <div style="margin-top: 20px; padding: 15px; background: rgba(0,212,255,0.1); border-radius: 8px;">
            <h3 style="font-size: 14px; margin-bottom: 10px; color: #00d4ff;">💡 Interactive Editing Guide</h3>
            <ul style="font-size: 12px; line-height: 1.8; color: #999;">
                <li><strong>Harmonics:</strong> Drag colored points to adjust frequency and magnitude of each harmonic</li>
                <li><strong>Waveform:</strong> Drag red peak points to reshape the waveform amplitude</li>
                <li><strong>Frequency:</strong> Drag spectrum bars to sculpt the frequency content</li>
                <li><strong>Amplitude:</strong> Drag envelope points to reshape dynamics over time</li>
                <li><strong>Undo/Redo:</strong> Full history tracking for all edits</li>
            </ul>
        </div>
    `;
    
    setTimeout(() => {
        if (!interactiveEditor) {
            initInteractiveEditor();
        }
        
        // Setup all interactive canvases
        interactiveEditor.setupCanvas('interactiveHarmonics', 'harmonics');
        interactiveEditor.setupCanvas('interactiveWaveform', 'waveform');
        interactiveEditor.setupCanvas('interactiveFrequency', 'frequency');
        interactiveEditor.setupCanvas('interactiveAmplitude', 'amplitude');
        interactiveEditor.setupCanvas('interactiveSpectrogram', 'spectrogram');
        
        // Load current audio if available
        if (analyzerEngine && analyzerEngine.getAudioLength() > 0) {
            const samples = analyzerEngine.getWaveformData(analyzerEngine.getAudioLength());
            interactiveEditor.loadAudio(samples, analyzerEngine.getSampleRate());
        }
    }, 100);
}

// Re-analyze current audio
function interactiveReanalyze() {
    if (!interactiveEditor || !interactiveEditor.audioData) return;
    
    interactiveEditor.analyzeAudio();
    
    // Re-render all canvases
    Object.keys(interactiveEditor.canvases).forEach(type => {
        interactiveEditor.render(type);
    });
    
    console.log('Re-analysis complete');
}

// Apply interactive edits to main track
function applyInteractiveEdits() {
    if (!interactiveEditor) {
        console.error('Interactive editor not initialized');
        document.getElementById('engineStatus').textContent = '⚠️ Interactive editor not initialized';
        return;
    }
    
    if (!currentTrackId) {
        console.error('No track selected');
        document.getElementById('engineStatus').textContent = '⚠️ No track selected';
        return;
    }
    
    // Check for required engine dependencies
    if (typeof editorEngine === 'undefined' || !editorEngine) {
        console.error('Editor engine not available');
        document.getElementById('engineStatus').textContent = '⚠️ Editor engine not available';
        return;
    }
    
    if (typeof analyzerEngine === 'undefined' || !analyzerEngine) {
        console.error('Analyzer engine not available');
        document.getElementById('engineStatus').textContent = '⚠️ Analyzer engine not available';
        return;
    }
    
    const editedAudio = interactiveEditor.getEditedAudio();
    if (!editedAudio || editedAudio.length === 0) {
        console.error('No edited audio data available');
        document.getElementById('engineStatus').textContent = '⚠️ No edited audio data available';
        return;
    }
    
    try {
        editorEngine.loadAudioToTrack(currentTrackId, editedAudio);
        analyzerEngine.loadAudioData(editedAudio);
        
        // Update analysis view
        if (typeof updateAnalysisView === 'function') {
            updateAnalysisView();
        }
        
        document.getElementById('engineStatus').textContent = '✓ Interactive edits applied to track';
        console.log('Interactive edits applied');
    } catch (error) {
        console.error('Error applying edits:', error);
        document.getElementById('engineStatus').textContent = '⚠️ Error applying edits: ' + error.message;
    }
}

// Export edited audio
function exportEditedAudio() {
    if (!interactiveEditor) {
        console.error('Interactive editor not initialized');
        return;
    }
    
    if (typeof audioContext === 'undefined' || !audioContext) {
        console.error('Audio context not available');
        alert('Audio context not available. Please load an audio file first.');
        return;
    }
    
    const editedAudio = interactiveEditor.getEditedAudio();
    if (!editedAudio || editedAudio.length === 0) {
        console.error('No edited audio data to export');
        alert('No edited audio data to export.');
        return;
    }
    
    if (!interactiveEditor.sampleRate) {
        console.error('Sample rate not available');
        alert('Sample rate information missing.');
        return;
    }
    
    try {
        // Create WAV file
        const audioBuffer = audioContext.createBuffer(1, editedAudio.length, interactiveEditor.sampleRate);
        audioBuffer.copyToChannel(new Float32Array(editedAudio), 0);
        
        // Convert to WAV
        const wavBlob = bufferToWave(audioBuffer);
        const url = URL.createObjectURL(wavBlob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'edited-audio.wav';
        a.click();
        
        console.log('Audio exported');
    } catch (error) {
        console.error('Error exporting audio:', error);
        alert('Error exporting audio: ' + error.message);
    }
}

// Convert AudioBuffer to WAV blob
function bufferToWave(audioBuffer) {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    
    let length = audioBuffer.length * numChannels * 2;
    let buffer = new ArrayBuffer(44 + length);
    let view = new DataView(buffer);
    
    // WAV header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, length, true);
    
    // Write audio data
    let offset = 44;
    for (let i = 0; i < audioBuffer.length; i++) {
        for (let channel = 0; channel < numChannels; channel++) {
            let sample = audioBuffer.getChannelData(channel)[i];
            sample = Math.max(-1, Math.min(1, sample));
            view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
            offset += 2;
        }
    }
    
    return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

console.log('Interactive Editor module loaded');
