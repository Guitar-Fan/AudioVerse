# AudioVerse - Web Audio Workstation Collection

A collection of browser-based digital audio workstation tools and synthesizers, featuring advanced WebAssembly-powered audio synthesis.

## 🎵 Featured Project: Rust WASM Audio Synthesis Studio

Location: `/wasm-tests/rust-audio-synth/rust-wasm-audio-synth-studio.html`

Our flagship polyphonic synthesizer built with Rust + WebAssembly:
- Plugin Architecture: Extensible audio processing system
- Professional Synthesis: Multi-voice polyphony with ADSR envelopes
- Advanced Filtering: Low/High/Band Pass filters with resonance control
- Real-time Control: Responsive parameter adjustment and visualization
- Preset System: Professional presets with instant recall
- Modern UI: Sleek interface with spectrum analysis and waveform display

## 🎛️ Core DAW Tools

Web Browser DAW (`Chromebook_DAW/chromebook_daw.html`):  
Multi-track audio workstation with recording, editing, mixing, and export capabilities. Upload and play multiple audio files, record via microphone, split/copy/paste clips, quantize, fade, normalize, reverse, and export. Includes mixer view with volume, pan, and EQ per track.

MIDI DAW (`MIDI_Daw_With_Ideas.html`):  
MIDI-based workstation with built-in synthesizer. Upload MIDI files and play with native synth. Custom sampling: upload your own audio samples and the system automatically pitch-shifts and maps them across the keyboard for MIDI playback.

## 🔧 Audio Processing Tools

EQ Tool (`EQ.html`):  
Professional equalizer with real-time frequency band adjustment. Upload audio files and modify frequency regions with adjustable bands. Right-click to create new bands and change shapes (low shelf, high shelf, bell). Export your EQ'd audio.

Parameter Audio Editor (`ParameterAudioEditor.html`):  
Comprehensive audio editor with visualization, EQ tweaking, envelope shaping, and pitch adjustment. Upload, visualize, edit, and export as WAV.

Wavetable Synth (`Wavetable_Synth.html`):  
Modern wavetable synthesizer for sound design and synthesis. Create and export custom sounds as WAV files.

Reverb Tool (`reverb.html`):  
Dedicated reverb effect processor for spatial audio enhancement.

Reverb Collection (`reverb-collection.html`):
Collection of reverb effects and spatial audio tools.

WebAudio DAW Tools (`WebAudioDAWTools.html`):  
Collection of Web Audio API utilities and tools for development.

## 🧪 WebAssembly Reverb Engines

C++ Reverb Engine (`wasm-tests/cpp-reverb/`):  
High-performance reverb effects compiled from C++ to WebAssembly for professional audio processing.

Hibiki Reverb (`wasm-tests/hibiki-reverb/`):  
Advanced reverb algorithms with WebAssembly acceleration.

Progressive Reverb (`wasm-tests/prog-reverb/`):  
Modern reverb processing with customizable parameters.

Rust Audio Synth (`wasm-tests/rust-audio-synth/`):  
Complete audio synthesis framework built in Rust with WebAssembly compilation.

## 🚀 Quick Start

1. For the main audio synthesizer:
   ```bash
   cd wasm-tests/rust-audio-synth
   python3 -m http.server 8080
   # Open: http://localhost:8080/rust-wasm-audio-synth-studio.html
   ```

2. For other tools: Open HTML files directly in a modern web browser

## 🎯 Browser Compatibility

All tools are designed to work locally on Chromebooks and modern web browsers using only HTML, CSS, JavaScript, and WebAssembly (no server required).

---
Updated September 21, 2025 - Repository cleaned and renamed to AudioVerse

Used Github Copilot for development. Feel free to download the files you want to run from the repo (make sure to download the related .js and .css files along with the HTML files to ensure the webpage works properly).

