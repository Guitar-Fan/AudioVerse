# C++ Audio Analysis Studio

A high-performance audio analysis application built with C++ and compiled to WebAssembly using Emscripten.

## Features

### Advanced Audio Analysis Tools

1. **Waveform Visualization**
   - Time-domain representation of audio
   - High-resolution waveform display
   - Real-time rendering

2. **FFT Spectrum Analyzer**
   - Frequency-domain analysis using Fast Fourier Transform
   - Color-coded frequency bins (0-24 kHz)
   - Logarithmic magnitude scale

3. **Phase Spectrum**
   - Phase information for each frequency bin
   - Visual representation of phase relationships
   - Useful for audio forensics and quality analysis

4. **Spectrogram (Time-Frequency Analysis)**
   - Real-time spectrogram generation
   - Heat map visualization showing frequency content over time
   - Ideal for identifying transients, harmonics, and spectral patterns

### Audio Metrics

- **Peak Level** - Maximum amplitude in dB
- **RMS Level** - Root Mean Square level in dB (perceived loudness)
- **Dominant Frequency** - Strongest frequency component
- **Spectral Centroid** - "Center of mass" of spectrum (timbral brightness)
- **Spectral Rolloff** - Frequency below which 85% of energy is contained

## Technology

- **C++ Core** - High-performance audio processing
- **WebAssembly** - Near-native performance in browser
- **Emscripten** - C++ to WASM compiler with bindings
- **Custom FFT** - Cooley-Tukey algorithm implementation
- **Canvas 2D** - Hardware-accelerated visualizations

## Performance

- **WASM Module Size**: ~34 KB (uncompressed)
- **JavaScript Glue**: ~47 KB
- **Total Bundle**: <100 KB
- **Processing Speed**: Near real-time FFT analysis
- **Memory Efficient**: Minimal overhead, processes large files

## Building

```bash
./build.sh
```

## Running

```bash
cd web
python3 -m http.server 8080
```

Open http://localhost:8080 in your browser.

## Usage

1. Click "Choose File" and select an audio file (MP3, WAV, OGG, etc.)
2. The browser will decode the audio
3. C++ engine analyzes the audio data
4. All visualizations update automatically
5. Metrics display in real-time

## File Structure

```
cpp-audio-studio/
├── src/
│   ├── AudioAnalyzer.cpp    - Core C++ analysis engine
│   └── bindings.cpp         - Emscripten WASM bindings
├── include/
│   └── AudioAnalyzer.h      - Header file
├── web/
│   ├── index.html           - UI
│   ├── app.js               - JavaScript interface
│   ├── audio-studio.js      - Generated WASM glue code
│   └── audio-studio.wasm    - Compiled C++ module
├── build.sh                 - Build script
└── CMakeLists.txt          - CMake configuration
```

## Why C++ + WASM?

### Advantages over Pure JavaScript:

1. **Performance**: 3-10x faster FFT computation
2. **Memory Control**: Manual memory management for large buffers
3. **Type Safety**: Strong typing prevents runtime errors
4. **Code Reuse**: Same C++ code can be used in native apps
5. **Advanced Algorithms**: Complex DSP algorithms easier to implement

### What JavaScript Cannot Do:

- **SIMD Optimization**: C++ can use vectorized operations
- **Low-level Memory**: Direct buffer manipulation
- **Zero-cost Abstractions**: Template metaprogramming
- **Predictable Performance**: No garbage collection pauses

## Analysis Functions (from notes.txt)

✅ **Implemented:**
- Fast Fourier Transform (FFT)
- Magnitude and Phase Analysis
- Time-Domain Waveform
- Peak and RMS Level Detection
- Spectral Centroid
- Spectral Rolloff
- Spectral Flux (ready for future use)

❌ **Not Implemented (require dependencies):**
- IIR/FIR Filters (could use JUCE)
- Convolution (needs impulse responses)
- Pitch Detection (would need aubio integration)
- Oversampling (JUCE feature)

## Future Enhancements

- Add JUCE DSP integration for professional filters
- Integrate aubio for pitch/tempo detection
- Real-time audio input from microphone
- Export analysis data as JSON/CSV
- Batch processing multiple files
- GPU-accelerated visualizations (WebGL)

## License

Open source - Educational/Research purposes
