# AudioVerse

A collection of browser-based audio tools for music production, sound design, and experimentation. No installation required—just open and create.

## Core DAW Workflow

These three tools form a complete production environment (use them together or separately):

### 1. AudioVerse DAW
**Location:** `AudioVerse/AudioVerse.html`

The main production hub. Multi-track recording, mixing console, MIDI sequencing, and effects processing all in one place.

**Features:**
- Multi-track audio recording and editing
- MIDI piano roll with step sequencing
- Built-in effects rack (EQ, compression, reverb, delay)
- Real-time spectrum analysis and metering
- Project save/load system
- Audio export

**Use case:** Your central workspace for arranging, mixing, and producing complete tracks.

### 2. MIDI DAW With Ideas
**Location:** `tools/MIDI_Daw_With_Ideas.html`

MIDI sequencing with intelligent pitch-shifting and sample playback.

**Features:**
- Piano roll interface
- MIDI file import/export
- Auto pitch-shifted keyboard mapping
- Built-in sample library
- Quick melody sketching

**Use case:** Compose melodies and harmonies, then export MIDI to AudioVerse DAW for full production.

### 3. CraftySound
**Location:** `tools/CraftySound.html`

Sound design and synthesis playground (warning: may contain weird noises).

**Features:**
- Advanced synthesis engine
- Modular audio routing
- Effect chaining
- Preset management

**Use case:** Create custom sounds and patches, export audio to use in other tools or your main DAW.

---

## Experimental Tools

The rest of these are for fun, learning, and seeing what's possible in a browser. No particular order—just pick what sounds interesting.

### Parameter Audio Editor
**Location:** `tools/ParameterAudioEditor.html`

Precision waveform editing with visual parameter control. Slice, fade, normalize, and apply effects with sample-accurate control.

### Wavetable Synth
**Location:** `tools/Wavetable_Synth.html`

Build custom wavetables from scratch. Morph between waveforms, design unique timbres, export patches.

### EQ
**Location:** `tools/EQ.html`

Multi-band parametric EQ with live frequency spectrum visualization. Fine-tune your frequency response.

### DrawAudio
**Location:** `tools/DrawAudio.html`

Draw waveforms with your mouse. Literally. Instant playback. Surprisingly useful for creating custom oscillator shapes.

### ReaVerse
**Location:** `reaper-web/ui/ReaVerse.html`

A REAPER-inspired web DAW experiment. Professional routing, JSFX script support, advanced mixing capabilities.

### Tone.js Instruments
**Location:** `tools/TonejsInst.html`

Collection of synthesizers powered by Tone.js: FM, AM, additive synthesis, samplers, and polysynths.

### ToneJS Deep Exploration
**Location:** `tools/ToneJS_Deep_Exploration.html`

Comprehensive showcase of Tone.js capabilities. Complex synthesis techniques, audio analysis, transport control.

### ToneJS Instrument Exhibit
**Location:** `tools/ToneJS_Instrument_Exhibit.html`

Interactive gallery of Tone.js instruments with presets and real-time controls.

### Convolution Reverb
**Location:** `tools/ConvolutionReverb.html`

Upload your own impulse responses. Simulate any acoustic space from your bedroom to a cathedral.

### Reverb Collection
**Location:** `tools/reverb-collection.html`

Curated algorithmic reverbs: plate, spring, hall, room. Adjust decay, damping, and diffusion.

### Algorithmic Reverb
**Location:** `tools/AlgorithmicReverb.html`

Design custom reverb algorithms. For when you want to get nerdy with digital signal processing.

---

## WebAssembly Audio Engines

Performance-critical audio processing compiled to WebAssembly:

- **Rust Audio Synth** (`wasm-tests/rust-audio-synth/`): Polyphonic synthesizer with ADSR envelopes, multi-mode filters, real-time controls
- **C++ Reverb Engine** (`wasm-tests/cpp-reverb/`): High-performance reverb effects
- **Hibiki Reverb** (`wasm-tests/hibiki-reverb/`): Spacious reverb with WebAssembly acceleration
- **Progressive Reverb** (`wasm-tests/prog-reverb/`): Customizable modern ambience

---

## Quick Start

### Option 1: Open Directly
Just open any `.html` file in a modern browser. Works offline.

### Option 2: Local Server (Recommended)
```bash
python3 -m http.server 8000
# Visit: http://localhost:8000/
```

### Option 3: Solar System Navigation
Open `index.html` for an interactive 3D solar system interface (yes, it's unnecessary, but it looks cool).

---

## Technical Notes

- 100% browser-based (HTML, CSS, JavaScript, WebAssembly)
- No server required
- Works offline after first load
- Cross-platform (desktop, tablet, mobile)
- Tested on Chrome, Firefox, Safari

## Browser Requirements

Modern browser with Web Audio API support. Chromebooks work fine.

---

AudioVerse - Because making music in a browser should be this easy.  
Updated January 7, 2026

