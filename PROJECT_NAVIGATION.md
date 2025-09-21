# AudioVerse - Project Navigation

This is a cleaned and organized collection of web audio projects with proper naming conventions.

## 🎵 Main Audio Projects

### **rust-wasm-audio-synth-studio.html** (Premier Project)
- **Location**: `/wasm-tests/rust-audio-synth/rust-wasm-audio-synth-studio.html`
- **Description**: Advanced polyphonic audio synthesizer built with Rust + WebAssembly
- **Features**: Plugin architecture, real-time synthesis, ADSR envelopes, filters, presets
- **Status**: ✅ Complete and fully functional

### **DrawAudio.html**
- **Location**: `/DrawAudio.html`
- **Description**: Original drawing-based audio synthesis interface
- **Status**: Legacy project (replaced by Rust WASM version)

### **MIDI_Daw_With_Ideas.html**
- **Location**: `/MIDI_Daw_With_Ideas.html`
- **Description**: MIDI-based DAW with creative features
- **Status**: Working project

### **Chromebook_DAW/**
- **Location**: `/Chromebook_DAW/chromebook_daw.html`
- **Description**: Browser-based DAW optimized for Chromebooks
- **Status**: Working project

## 🔧 WebAssembly Examples

### **cpp-wasm-math-demo.html**
- **Location**: `/wasm-tests/cpp-example/cpp-wasm-math-demo.html`
- **Description**: C++ compiled to WebAssembly mathematical operations demo
- **Status**: Educational example

### **rust-wasm-basic-demo.html**
- **Location**: `/wasm-tests/rust-example/rust-wasm-basic-demo.html`
- **Description**: Basic Rust WebAssembly integration example
- **Status**: Educational example

### **emscripten-cpp-demo.html**
- **Location**: `/emscripten-cpp-demo.html`
- **Description**: Emscripten-generated C++ to WebAssembly demo
- **Status**: Legacy educational example

## 🎛️ Audio Tools & Utilities

### **EQ.html**
- **Location**: `/EQ.html`
- **Description**: Audio equalizer interface

### **ParameterAudioEditor.html**
- **Location**: `/ParameterAudioEditor.html`
- **Description**: Audio parameter manipulation tools

### **Wavetable_Synth.html**
- **Location**: `/Wavetable_Synth.html`
- **Description**: Wavetable synthesis implementation

### **WebAudioDAWTools.html**
- **Location**: `/WebAudioDAWTools.html`
- **Description**: Collection of Web Audio API tools

### **reverb.html**
- **Location**: `/reverb.html`
- **Description**: Reverb effect implementation

### **WebAudioAPIDemo/**
- **Location**: `/WebAudioAPIDemo/SoundAPI.html`
- **Description**: Web Audio API demonstration and examples

## 🧹 Recent Cleanup (August 31, 2025)

### Removed:
- ❌ `Chromebook_DAW_React/` - React components and node_modules (freed ~50MB)
- ❌ `wasm-tests/rust-audio-synth/target/` - Rust build artifacts (freed ~74MB)
- ❌ `wasm-tests/rust-example/target/` - Rust build artifacts (freed ~44MB)
- ❌ `wasm-tests/wasm.html` - Redundant test file

### Renamed for Clarity:
- 📁 `Index.html` → `emscripten-cpp-demo.html`
- 📁 `wasm-tests/rust-audio-synth/index.html` → `rust-wasm-audio-synth-studio.html`
- 📁 `wasm-tests/cpp-example/index.html` → `cpp-wasm-math-demo.html`
- 📁 `wasm-tests/rust-example/index.html` → `rust-wasm-basic-demo.html`
- 📁 `wasm-tests/rust-audio-synth/test.html` → `rust-wasm-audio-test.html`

### Space Freed: ~170MB total

## 🚀 Quick Start

To run the main audio synthesis studio:
1. Navigate to `/wasm-tests/rust-audio-synth/`
2. Start HTTP server: `python3 -m http.server 8080`
3. Open: `http://localhost:8080/rust-wasm-audio-synth-studio.html`

## 🎯 Recommended Next Steps

1. **Focus on the Rust WASM Audio Synth Studio** - it's your most advanced project
2. **Archive or remove legacy files** if not needed
3. **Consider consolidating** similar audio tools
4. **Add more presets** to the Rust synthesizer
5. **Implement drawing interface** for the Rust synth (to complete the original vision)

---
*Project structure cleaned and optimized on August 31, 2025*
