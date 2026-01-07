# Tone.js Deep Exploration DAW - User Guide

## Overview
A professional desktop-quality Digital Audio Workstation built with Tone.js, featuring a Figma-like node-based canvas interface for visual audio routing.

## Features

### 🎹 **63+ Audio Nodes Across 9 Categories**

#### **Instruments (10)**
- Synth, AMSynth, FMSynth, MonoSynth, DuoSynth
- MembraneSynth, MetalSynth, NoiseSynth, PluckSynth, PolySynth

#### **Effects (18)**
- AutoFilter, AutoPanner, AutoWah, BitCrusher, Chebyshev
- Chorus, Distortion, FeedbackDelay, Freeverb, FrequencyShifter
- JCReverb, Phaser, PingPongDelay, PitchShift, Reverb
- StereoWidener, Tremolo, Vibrato

#### **Signal Processors (8)**
- Filter, EQ3, Compressor, Limiter, Gate
- MultibandCompressor, MidSideCompressor, Convolver

#### **Modulators (4)**
- LFO, Envelope, FrequencyEnvelope, AmplitudeEnvelope

#### **Analyzers (4)**
- Waveform, FFT, Meter, Follower
- *Features real-time visualization canvases*

#### **Sources (4)**
- Oscillator, Noise, Player, GrainPlayer
- *Includes start/stop controls*

#### **Utilities (9)**
- Gain, Panner, Volume, Channel, Solo
- Split, Merge, Mono, CrossFade

#### **Sequencers (2)**
- Step Sequencer, Pattern
- *Features 16-step grid programming*

#### **I/O (2)**
- MIDI Input (default), Audio Output (default)

---

## Usage Guide

### **Creating Nodes**
1. Drag any plugin from the sidebar onto the canvas
2. Node appears at drop location
3. Double-click to open parameter window

### **Connecting Nodes**
1. Click and drag from OUTPUT port (right side)
2. Drop onto INPUT port (left side) of another node
3. Bezier curve wire appears showing audio path
4. Signal flows: MIDI Input → Instruments → Effects → Audio Output

### **Editing Parameters**
- Double-click any node to open plugin window
- Adjust sliders to modify parameters in real-time
- Values update immediately
- Some nodes have no adjustable parameters (displays message)

### **Special Node Types**

#### **Analyzer Nodes**
- Display live visualization canvas
- Waveform: Oscilloscope view
- FFT: Frequency spectrum bars
- Meter: Level meter with dB readout

#### **Sequencer Nodes**
- 16-step grid interface
- Click steps to toggle on/off
- Cyan = active, gray = inactive

#### **Source Nodes**
- Start/Stop buttons for manual control
- Oscillator, Noise, Player, GrainPlayer
- Must be started before producing sound

### **Keyboard Controls**
- 2-octave virtual MIDI keyboard (C4-B5)
- White and black keys
- Mouse down = note on, mouse up = note off
- Plays through connected instruments

### **Transport**
- Play: Start Tone.js transport
- Stop: Stop transport
- Panic: Release all notes, clear stuck voices

### **Canvas Navigation**
- Pan: Click and drag on empty canvas
- Move nodes: Click and drag node body
- Delete: Click X button on node
- Zoom: (not yet implemented)

---

## Default Setup
On load, you get:
1. **MIDI Input** node (left)
2. **Synth** instrument (center-left)
3. **Audio Output** node (right)
4. Pre-connected signal chain ready to play

---

## Technical Details

### **Libraries Used**
- Tone.js (latest): Audio synthesis and processing
- D3.js 7.8.5: Bezier curve wire rendering
- Lodash 4.17.21: Utilities
- Eruda: Debug console

### **Node Structure**
Each node contains:
- `audioNode`: Actual Tone.js object
- `type`: 'instrument', 'effect', 'processor', etc.
- `inputs`: Array of input port IDs
- `outputs`: Array of output port IDs
- `visualizerData`: For analyzer nodes
- `sequencerPattern`: For sequencer nodes (16 booleans)
- `isSource`: Flag for source nodes

### **Connection System**
- Audio routing uses Tone.js `.connect()` API
- Visual wires rendered with D3.js SVG
- Bezier curves with adaptive control points
- Only allows output → input direction

### **Parameter Mapping**
Each parameter includes:
- `key`: Unique identifier
- `name`: Display label
- `value`: Current value
- `min`/`max`/`step`: Range constraints
- `setValue`: Callback function

---

## Known Issues & Solutions

### **Issue: "dispose is not a function"**
**Fixed**: Now checks if `dispose()` method exists before calling
- Custom sequencer objects don't have dispose
- Falls back to `disconnect()` if available

### **Issue: Some plugins have no parameters**
**Fixed**: Displays "No adjustable parameters available" message
- Analyzer nodes (controlled by visualization)
- Some utility nodes (pass-through)
- MIDI Input/Audio Output

### **Issue: Node won't delete**
Make sure to:
1. Remove all connections first (optional, auto-handled)
2. Click the X button
3. Check console for errors

---

## Advanced Tips

### **Creating Complex Chains**
```
MIDI Input → Synth → Compressor → Reverb → EQ3 → Audio Output
```

### **Using Modulators**
1. Create LFO node
2. Wire LFO → Effect parameter (future feature)
3. Adjust LFO frequency and depth

### **Parallel Processing**
```
MIDI Input → Synth → Split
                      ├→ Distortion → Merge → Output
                      └→ Reverb ────→ Merge
```

### **Visualization Chain**
```
Instrument → Waveform → FFT → Audio Output
```
(Analyzers pass signal through while analyzing)

---

## Performance Notes
- Each node is a live Tone.js object
- Connections create real audio routing
- Visualizers use `requestAnimationFrame`
- Recommended: < 50 nodes for smooth performance
- Use Panic button to clear stuck voices

---

## Keyboard Shortcuts
- Double-click node: Open parameter window
- Click empty canvas: Pan mode
- ESC: Close plugin window (not yet implemented)

---

## Future Enhancements
- [ ] Modulator → Parameter connections
- [ ] Preset save/load system
- [ ] Canvas zoom
- [ ] MIDI file import
- [ ] Node search/filter
- [ ] Multi-select and group operations
- [ ] Undo/redo
- [ ] Plugin preset browser
- [ ] Audio file export

---

## File Location
`/workspaces/AudioVerse/ToneJS_Deep_Exploration.html`

Single HTML file - no build process required!
