# Virtual Instrument DAW - Complete Library Dependencies Plan

## Project Overview
A professional desktop-quality Virtual Instrument DAW built as a web application using modern React and Mantine frameworks.

---

## 📋 Dependency Installation Methods

**Primary Method: NPM (Recommended)**
```bash
npm install <package-name>
```

**Alternative: CDN (for quick prototyping only)**
```html
<script src="https://cdn.jsdelivr.net/npm/<package-name>@<version>"></script>
```

**⚠️ Critical: Avoiding Syntax Errors**
- Always reference official documentation for each library
- Use exact API methods documented in the library's docs
- Check for breaking changes between versions
- Verify code examples in official docs before using

---

## Core Framework & UI

### React Ecosystem
```json
{
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "react-router-dom": "^6.22.0"
}
```

**Installation:**
```bash
npm install react react-dom react-router-dom
```

**Official Documentation:**
- 📘 [React Docs](https://react.dev/) - Complete guide, API reference, hooks documentation
- 📘 [React Router](https://reactrouter.com/) - Routing API, examples, migration guides

**Key Resources:**
- [React Hooks Reference](https://react.dev/reference/react)
- [React Router Tutorial](https://reactrouter.com/en/main/start/tutorial)

- **Why**: Industry standard, massive ecosystem, excellent performance
- **Use**: Core application framework and routing

### Mantine UI Library
```json
{
  "@mantine/core": "^7.5.0",
  "@mantine/hooks": "^7.5.0",
  "@mantine/form": "^7.5.0",
  "@mantine/notifications": "^7.5.0",
  "@mantine/modals": "^7.5.0",
  "@mantine/dropzone": "^7.5.0",
  "@mantine/spotlight": "^7.5.0",
  "@mantine/dates": "^7.5.0",
  "@emotion/react": "^11.11.3",
  "@emotion/styled": "^11.11.0"
}
```

**Installation:**
```bash
npm install @mantine/core @mantine/hooks @mantine/form @mantine/notifications @mantine/modals @mantine/dropzone @mantine/spotlight @mantine/dates @emotion/react @emotion/styled
```

**Official Documentation:**
- 📘 [Mantine](https://mantine.dev/) - Complete component library, theming, customization
- 📘 [Mantine Hooks](https://mantine.dev/hooks/use-hotkeys/) - 50+ custom hooks
- 📘 [Mantine Theming Guide](https://mantine.dev/theming/theme-object/) - Color schemes, dark mode

**Key Resources:**
- [Component Documentation](https://mantine.dev/core/button/) - Every component with props API
- [Mantine Examples](https://mantine.dev/examples/) - Production-ready patterns
- [Migration Guide](https://mantine.dev/changelog/7-0-0/) - Breaking changes v7

- **Why**: 100+ components, excellent theming, desktop-quality controls
- **Use**: All UI components (sliders, knobs, panels, modals, drag-drop)

---

## Audio Processing & Synthesis

### Web Audio & MIDI
```json
{
  "tone": "^14.7.77",
  "standardized-audio-context": "^25.3.55",
  "midi-writer-js": "^2.1.4",
  "webmidi": "^3.1.8",
  "@tonejs/midi": "^2.0.28"
}
```

**Installation:**
```bash
npm install tone standardized-audio-context midi-writer-js webmidi @tonejs/midi
```

**Official Documentation:**
- 📘 [Tone.js](https://tonejs.github.io/) - Complete audio framework with examples
- 📘 [Tone.js API Reference](https://tonejs.github.io/docs/) - All classes, methods, properties
- 📘 [WebMidi.js](https://webmidijs.org/) - MIDI input/output guide
- 📘 [MIDI Writer](https://github.com/grimmdude/MidiWriterJS) - MIDI file creation API

**Key Resources:**
- [Tone.js Examples](https://tonejs.github.io/examples/) - Interactive demos
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) - MDN reference
- [WebMidi API Guide](https://webmidijs.org/docs/getting-started/) - MIDI implementation

**CDN Alternative (Tone.js only):**
```html
<script src="https://cdn.jsdelivr.net/npm/tone@14.7.77/build/Tone.js"></script>
```

- **Tone.js**: High-level Web Audio framework with built-in instruments, effects, and scheduling
- **standardized-audio-context**: Cross-browser Web Audio API compatibility
- **webmidi**: Complete MIDI input/output handling
- **@tonejs/midi**: MIDI file parsing and generation

### Advanced Audio Processing
```json
{
  "pizzicato": "^0.6.4",
  "tuna": "^1.0.3",
  "soundfont-player": "^0.12.0"
}
```

**Installation:**
```bash
npm install pizzicato tuna soundfont-player
```

**Official Documentation:**
- 📘 [Pizzicato](https://alemangui.github.io/pizzicato/) - Effects API, sound creation
- 📘 [Tuna](https://github.com/Theodeus/tuna) - Effects processors reference
- 📘 [soundfont-player](https://github.com/danigb/soundfont-player) - SoundFont loading API

**Key Resources:**
- [Pizzicato Effects](https://alemangui.github.io/pizzicato/#effects) - All available effects
- [Tuna Effects List](https://github.com/Theodeus/tuna#available-effects) - Effect parameters

**CDN Alternatives:**
```html
<script src="https://cdn.jsdelivr.net/npm/pizzicato@0.6.4/distr/Pizzicato.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/soundfont-player@0.12.0/dist/soundfont-player.min.js"></script>
```

- **Pizzicato**: Additional effects library (reverb, delay, distortion)
- **Tuna**: Audio effects library with visual feedback
- **soundfont-player**: Load and play SoundFont instruments

---

## State Management & Data Flow

### State Management
```json
{
  "zustand": "^4.5.0",
  "immer": "^10.0.3",
  "use-immer": "^0.9.0"
}
```

**Installation:**
```bash
npm install zustand immer use-immer
```

**Official Documentation:**
- 📘 [Zustand](https://docs.pmnd.rs/zustand/getting-started/introduction) - Complete guide, API reference
- 📘 [Immer](https://immerjs.github.io/immer/) - Immutable state patterns
- 📘 [use-immer](https://github.com/immerjs/use-immer) - React integration

**Key Resources:**
- [Zustand Recipes](https://docs.pmnd.rs/zustand/guides/practice-with-no-store-actions) - Best practices
- [Immer Tutorial](https://immerjs.github.io/immer/update-patterns) - Update patterns
- [Zustand TypeScript](https://docs.pmnd.rs/zustand/guides/typescript) - Type-safe stores

- **Zustand**: Lightweight, fast state management (perfect for DAW session state)
- **Immer**: Immutable state updates (track history, undo/redo)
- **use-immer**: React hooks for Immer

### Audio Worklet & Web Workers
```json
{
  "workbox-webpack-plugin": "^7.0.0",
  "comlink": "^4.4.1"
}
```

**Installation:**
```bash
npm install workbox-webpack-plugin comlink
```

**Official Documentation:**
- 📘 [Comlink](https://github.com/GoogleChromeLabs/comlink) - Web Worker RPC library
- 📘 [Workbox](https://developer.chrome.com/docs/workbox/) - Service worker tools

**Key Resources:**
- [Audio Worklet Guide](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Using_AudioWorklet) - MDN reference
- [Comlink Examples](https://github.com/GoogleChromeLabs/comlink#examples) - Worker patterns

- **comlink**: Simplified Web Worker communication
- **Use**: Offload DSP processing, sample analysis to workers

---

## Canvas & Visualization

### Waveform & Spectrum Display
```json
{
  "wavesurfer.js": "^7.7.0",
  "konva": "^9.3.0",
  "react-konva": "^18.2.10",
  "d3": "^7.9.0",
  "visx": "^3.10.0"
}
```

**Installation:**
```bash
npm install wavesurfer.js konva react-konva d3 @visx/visx
```

**Official Documentation:**
- 📘 [WaveSurfer.js](https://wavesurfer.xyz/) - Waveform rendering, plugins
- 📘 [Konva](https://konvajs.org/) - Canvas framework, shapes, events
- 📘 [react-konva](https://konvajs.org/docs/react/) - React integration for Konva
- 📘 [D3.js](https://d3js.org/) - Data visualization, scales, shapes
- 📘 [visx](https://airbnb.io/visx/) - React + D3 components

**Key Resources:**
- [WaveSurfer Examples](https://wavesurfer.xyz/examples/) - Interactive demos
- [Konva API Docs](https://konvajs.org/api/Konva.html) - Complete API reference
- [D3 Gallery](https://observablehq.com/@d3/gallery) - Visualization examples
- [visx Components](https://airbnb.io/visx/docs) - Chart library

**CDN Alternative (WaveSurfer only):**
```html
<script src="https://cdn.jsdelivr.net/npm/wavesurfer.js@7.7.0/dist/wavesurfer.min.js"></script>
```

- **wavesurfer.js**: Professional waveform visualization and editing
- **Konva + react-konva**: High-performance canvas rendering for piano roll, automation
- **d3**: Advanced data visualization (spectrum analyzers, meters)
- **visx**: React-friendly visualization components

### Animation & Interactions
```json
{
  "framer-motion": "^11.0.0",
  "react-spring": "^9.7.3"
}
```

**Installation:**
```bash
npm install framer-motion react-spring
```

**Official Documentation:**
- 📘 [Framer Motion](https://www.framer.com/motion/) - Animation library for React
- 📘 [react-spring](https://www.react-spring.dev/) - Spring-physics animations

**Key Resources:**
- [Framer Motion API](https://www.framer.com/motion/component/) - Component docs
- [Framer Motion Examples](https://www.framer.com/motion/examples/) - Animation patterns
- [react-spring Docs](https://www.react-spring.dev/docs) - Hooks, components

- **framer-motion**: Smooth UI animations for panels, modals, transitions
- **react-spring**: Physics-based animations for meter movements, faders

---

## File Handling & Persistence

### File Management
```json
{
  "file-saver": "^2.0.5",
  "jszip": "^3.10.1",
  "idb": "^8.0.0",
  "idb-keyval": "^6.2.1"
}
```

**Installation:**
```bash
npm install file-saver jszip idb idb-keyval
```

**Official Documentation:**
- 📘 [file-saver](https://github.com/eligrey/FileSaver.js) - Client-side file saving
- 📘 [JSZip](https://stuk.github.io/jszip/) - ZIP file creation/reading
- 📘 [idb](https://github.com/jakearchibald/idb) - IndexedDB wrapper
- 📘 [idb-keyval](https://github.com/jakearchibald/idb-keyval) - Simple key-value store

**Key Resources:**
- [JSZip API](https://stuk.github.io/jszip/documentation/api_jszip.html) - All methods
- [idb Usage](https://github.com/jakearchibald/idb#usage) - Database operations

- **file-saver**: Export projects, MIDI, audio files
- **jszip**: Compress/decompress project bundles
- **idb**: IndexedDB wrapper for storing samples, presets, projects
- **idb-keyval**: Simple key-value storage for settings

### Audio File Handling
```json
{
  "lamejs": "^1.2.1",
  "audiobuffer-to-wav": "^1.0.0",
  "web-audio-beat-detector": "^8.2.9"
}
```

**Installation:**
```bash
npm install lamejs audiobuffer-to-wav web-audio-beat-detector
```

**Official Documentation:**
- 📘 [lamejs](https://github.com/zhuker/lamejs) - MP3 encoding in JavaScript
- 📘 [audiobuffer-to-wav](https://github.com/Jam3/audiobuffer-to-wav) - WAV conversion
- 📘 [web-audio-beat-detector](https://github.com/chrisguttandin/web-audio-beat-detector) - Tempo detection

**Key Resources:**
- [lamejs Usage](https://github.com/zhuker/lamejs#usage) - Encoding examples

- **lamejs**: MP3 encoding (export audio)
- **audiobuffer-to-wav**: WAV file export
- **web-audio-beat-detector**: Tempo detection for imported audio

---

## Drag & Drop / Layout Management

### Advanced Layouts
```json
{
  "react-grid-layout": "^1.4.4",
  "react-resizable-panels": "^2.0.0",
  "dnd-kit": "^6.1.0"
}
```

**Installation:**
```bash
npm install react-grid-layout react-resizable-panels @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**Official Documentation:**
- 📘 [react-grid-layout](https://github.com/react-grid-layout/react-grid-layout) - Draggable/resizable grid
- 📘 [react-resizable-panels](https://github.com/bvaughn/react-resizable-panels) - Resizable panel groups
- 📘 [dnd-kit](https://docs.dndkit.com/) - Modern drag-and-drop toolkit

**Key Resources:**
- [react-grid-layout Examples](https://react-grid-layout.github.io/react-grid-layout/examples/0-showcase.html) - Live demos
- [dnd-kit Introduction](https://docs.dndkit.com/introduction/getting-started) - Setup guide
- [dnd-kit Examples](https://master--5fc05e08a4a65d0021ae0bf2.chromatic.com/) - Interactive examples

- **react-grid-layout**: Resizable, draggable panels (mixer, plugins, browser)
- **react-resizable-panels**: Split pane layouts (timeline + piano roll)
- **dnd-kit**: Modern drag-and-drop (tracks, plugins, samples)

---

## Utilities & Helpers

### General Utilities
```json
{
  "lodash-es": "^4.17.21",
  "date-fns": "^3.3.0",
  "uuid": "^9.0.1",
  "color": "^4.2.3"
}
```

**Installation:**
```bash
npm install lodash-es date-fns uuid color
```

**Official Documentation:**
- 📘 [Lodash](https://lodash.com/docs/) - Utility function reference
- 📘 [date-fns](https://date-fns.org/docs/Getting-Started) - Date utility library
- 📘 [uuid](https://github.com/uuidjs/uuid) - UUID generation
- 📘 [color](https://github.com/Qix-/color) - Color manipulation

**Key Resources:**
- [Lodash Common Uses](https://lodash.com/docs/4.17.15) - All functions documented
- [date-fns Format](https://date-fns.org/docs/format) - Date formatting guide

- **lodash-es**: Utility functions (debounce, throttle for audio params)
- **date-fns**: Timestamp handling for automation
- **uuid**: Generate unique IDs for tracks, clips, plugins
- **color**: Color manipulation for track colors, UI themes

### Keyboard & Shortcuts
```json
{
  "react-hotkeys-hook": "^4.5.0",
  "mousetrap": "^1.6.5"
}
```

**Installation:**
```bash
npm install react-hotkeys-hook mousetrap
```

**Official Documentation:**
- 📘 [react-hotkeys-hook](https://github.com/JohannesKlauss/react-hotkeys-hook) - React keyboard shortcuts
- 📘 [Mousetrap](https://craig.is/killing/mice) - Keyboard shortcuts library

**Key Resources:**
- [react-hotkeys-hook API](https://github.com/JohannesKlauss/react-hotkeys-hook#api) - Hook usage
- [Mousetrap Docs](https://craig.is/killing/mice#api) - Key binding patterns

- **react-hotkeys-hook**: Keyboard shortcuts (play, stop, record, undo)
- **mousetrap**: Advanced key binding management

---

## TypeScript & Type Safety

### TypeScript Support
```json
{
  "typescript": "^5.3.3",
  "@types/react": "^18.2.55",
  "@types/react-dom": "^18.2.19",
  "@types/lodash-es": "^4.17.12",
  "@types/color": "^3.0.6",
  "@types/uuid": "^9.0.8"
}
```

**Installation:**
```bash
npm install -D typescript @types/react @types/react-dom @types/lodash-es @types/color @types/uuid
```

**Official Documentation:**
- 📘 [TypeScript](https://www.typescriptlang.org/docs/) - Language reference
- 📘 [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html) - Complete guide
- 📘 [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped) - Type definitions

**Key Resources:**
- [TypeScript with React](https://www.typescriptlang.org/docs/handbook/react.html) - Best practices
- [tsconfig Reference](https://www.typescriptlang.org/tsconfig) - Configuration options

- **Why**: Type safety for complex DAW state, audio parameters
- **Use**: All application code

---

## Build Tools & Development

### Vite Build System
```json
{
  "vite": "^5.1.0",
  "@vitejs/plugin-react": "^4.2.1",
  "vite-plugin-wasm": "^3.3.0",
  "vite-plugin-pwa": "^0.19.0"
}
```

**Installation:**
```bash
npm install -D vite @vitejs/plugin-react vite-plugin-wasm vite-plugin-pwa
```

**Official Documentation:**
- 📘 [Vite](https://vitejs.dev/) - Build tool and dev server
- 📘 [Vite Config](https://vitejs.dev/config/) - Configuration reference
- 📘 [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) - PWA plugin guide

**Key Resources:**
- [Vite Guide](https://vitejs.dev/guide/) - Getting started, features
- [Vite Plugins](https://vitejs.dev/plugins/) - Official plugins
- [PWA Setup](https://vite-pwa-org.netlify.app/guide/) - Offline functionality

- **Vite**: Lightning-fast development server and build
- **vite-plugin-wasm**: Load WebAssembly audio processors
- **vite-plugin-pwa**: Progressive Web App support (offline DAW)

### Code Quality
```json
{
  "eslint": "^8.56.0",
  "prettier": "^3.2.5",
  "@typescript-eslint/eslint-plugin": "^6.21.0",
  "@typescript-eslint/parser": "^6.21.0"
}
```

**Installation:**
```bash
npm install -D eslint prettier @typescript-eslint/eslint-plugin @typescript-eslint/parser
```

**Official Documentation:**
- 📘 [ESLint](https://eslint.org/docs/latest/) - Linting rules, configuration
- 📘 [Prettier](https://prettier.io/docs/en/) - Code formatting
- 📘 [typescript-eslint](https://typescript-eslint.io/) - TypeScript linting

**Key Resources:**
- [ESLint Rules](https://eslint.org/docs/latest/rules/) - All available rules
- [Prettier Options](https://prettier.io/docs/en/options.html) - Formatting config

---

## Testing

### Testing Libraries
```json
{
  "vitest": "^1.2.2",
  "@testing-library/react": "^14.2.1",
  "@testing-library/jest-dom": "^6.4.2",
  "@testing-library/user-event": "^14.5.2"
}
```

**Installation:**
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

**Official Documentation:**
- 📘 [Vitest](https://vitest.dev/) - Vite-native testing framework
- 📘 [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/) - React component testing
- 📘 [jest-dom](https://github.com/testing-library/jest-dom) - Custom DOM matchers

**Key Resources:**
- [Vitest API](https://vitest.dev/api/) - Test functions, assertions
- [Testing Library Queries](https://testing-library.com/docs/queries/about/) - Element selection
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library) - Avoiding pitfalls

- **vitest**: Fast unit testing
- **testing-library**: Component testing
- **Use**: Test audio routing, MIDI handling, state management

---

## Optional Advanced Features

### WebAssembly Audio Processors
```json
{
  "wasm-audio-helper": "^1.0.0"
}
```

**Installation:**
```bash
npm install wasm-audio-helper
```

**Official Documentation:**
- 📘 [WebAssembly](https://webassembly.org/getting-started/developers-guide/) - WASM guide
- 📘 [Emscripten](https://emscripten.org/docs/) - C/C++ to WASM compiler

- For integrating custom C++/Rust audio processors

### Real-time Collaboration (Future)
```json
{
  "socket.io-client": "^4.7.4",
  "yjs": "^13.6.11",
  "y-websocket": "^2.0.0"
}
```

**Installation:**
```bash
npm install socket.io-client yjs y-websocket
```

**Official Documentation:**
- 📘 [Socket.IO](https://socket.io/docs/v4/) - Real-time communication
- 📘 [Yjs](https://docs.yjs.dev/) - CRDT for collaborative editing
- 📘 [y-websocket](https://github.com/yjs/y-websocket) - WebSocket provider

**Key Resources:**
- [Socket.IO Client API](https://socket.io/docs/v4/client-api/) - Events, rooms
- [Yjs Examples](https://docs.yjs.dev/getting-started/a-collaborative-editor) - Collaborative patterns

- For collaborative editing features

### Machine Learning Audio (Future)
```json
{
  "@tensorflow/tfjs": "^4.17.0",
  "@magenta/music": "^1.23.1"
}
```

**Installation:**
```bash
npm install @tensorflow/tfjs @magenta/music
```

**Official Documentation:**
- 📘 [TensorFlow.js](https://www.tensorflow.org/js) - ML in JavaScript
- 📘 [Magenta.js](https://magenta.tensorflow.org/js) - Music and art generation

**Key Resources:**
- [TensorFlow.js Models](https://www.tensorflow.org/js/models) - Pre-trained models
- [Magenta Demos](https://magenta.tensorflow.org/demos) - Music AI examples

- For AI-assisted composition, auto-arrangement

---

## Complete package.json

```json
{
  "name": "virtual-instrument-daw",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "format": "prettier --write \"src/**/*.{ts,tsx,json,css}\""
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.22.0",
    "@mantine/core": "^7.5.0",
    "@mantine/hooks": "^7.5.0",
    "@mantine/form": "^7.5.0",
    "@mantine/notifications": "^7.5.0",
    "@mantine/modals": "^7.5.0",
    "@mantine/dropzone": "^7.5.0",
    "@mantine/spotlight": "^7.5.0",
    "@mantine/dates": "^7.5.0",
    "@emotion/react": "^11.11.3",
    "@emotion/styled": "^11.11.0",
    "tone": "^14.7.77",
    "standardized-audio-context": "^25.3.55",
    "webmidi": "^3.1.8",
    "@tonejs/midi": "^2.0.28",
    "midi-writer-js": "^2.1.4",
    "pizzicato": "^0.6.4",
    "soundfont-player": "^0.12.0",
    "zustand": "^4.5.0",
    "immer": "^10.0.3",
    "use-immer": "^0.9.0",
    "wavesurfer.js": "^7.7.0",
    "konva": "^9.3.0",
    "react-konva": "^18.2.10",
    "d3": "^7.9.0",
    "visx": "^3.10.0",
    "framer-motion": "^11.0.0",
    "react-spring": "^9.7.3",
    "file-saver": "^2.0.5",
    "jszip": "^3.10.1",
    "idb": "^8.0.0",
    "idb-keyval": "^6.2.1",
    "lamejs": "^1.2.1",
    "audiobuffer-to-wav": "^1.0.0",
    "web-audio-beat-detector": "^8.2.9",
    "react-grid-layout": "^1.4.4",
    "react-resizable-panels": "^2.0.0",
    "@dnd-kit/core": "^6.1.0",
    "@dnd-kit/sortable": "^8.0.0",
    "@dnd-kit/utilities": "^3.2.2",
    "lodash-es": "^4.17.21",
    "date-fns": "^3.3.0",
    "uuid": "^9.0.1",
    "color": "^4.2.3",
    "react-hotkeys-hook": "^4.5.0",
    "mousetrap": "^1.6.5",
    "comlink": "^4.4.1"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "@types/react": "^18.2.55",
    "@types/react-dom": "^18.2.19",
    "@types/lodash-es": "^4.17.12",
    "@types/color": "^3.0.6",
    "@types/uuid": "^9.0.8",
    "vite": "^5.1.0",
    "@vitejs/plugin-react": "^4.2.1",
    "vite-plugin-wasm": "^3.3.0",
    "vite-plugin-pwa": "^0.19.0",
    "eslint": "^8.56.0",
    "prettier": "^3.2.5",
    "@typescript-eslint/eslint-plugin": "^6.21.0",
    "@typescript-eslint/parser": "^6.21.0",
    "vitest": "^1.2.2",
    "@testing-library/react": "^14.2.1",
    "@testing-library/jest-dom": "^6.4.2",
    "@testing-library/user-event": "^14.5.2",
    "postcss": "^8.4.35",
    "postcss-preset-mantine": "^1.12.3",
    "postcss-simple-vars": "^7.0.1"
  }
}
```

---

## Project Structure Recommendation

```
virtual-instrument-daw/
├── src/
│   ├── components/          # React components
│   │   ├── Transport/       # Play, stop, record controls
│   │   ├── Mixer/          # Channel strips, faders, meters
│   │   ├── PianoRoll/      # MIDI editor
│   │   ├── Sequencer/      # Timeline/arrangement view
│   │   ├── Browser/        # Sample/preset browser
│   │   ├── Instruments/    # Virtual instrument UIs
│   │   └── Effects/        # Effect plugin UIs
│   ├── audio/              # Audio engine
│   │   ├── AudioEngine.ts  # Core Web Audio setup
│   │   ├── Track.ts        # Audio/MIDI track class
│   │   ├── instruments/    # Instrument implementations
│   │   ├── effects/        # Effect processors
│   │   └── midi/           # MIDI handling
│   ├── store/              # Zustand state management
│   │   ├── projectStore.ts # Project state
│   │   ├── audioStore.ts   # Audio engine state
│   │   └── uiStore.ts      # UI state
│   ├── utils/              # Utility functions
│   ├── workers/            # Web Workers for DSP
│   ├── types/              # TypeScript types
│   ├── hooks/              # Custom React hooks
│   ├── styles/             # Global styles
│   ├── App.tsx             # Root component
│   └── main.tsx            # Entry point
├── public/                 # Static assets
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## Implementation Priority

### Phase 1: Foundation (Week 1-2)
1. Set up Vite + React + TypeScript + Mantine
2. Implement basic layout (header, sidebar, main area)
3. Create Zustand stores (project, audio, UI state)
4. Initialize Tone.js audio engine

### Phase 2: Core DAW Features (Week 3-4)
1. Transport controls (play, stop, record, tempo)
2. Basic sequencer/timeline with Konva
3. MIDI piano roll editor
4. Track management (add, delete, solo, mute)

### Phase 3: Audio & Instruments (Week 5-6)
1. Virtual instruments (synth, sampler)
2. Audio effects chain (EQ, reverb, delay, compression)
3. Mixer with faders, panning, meters
4. MIDI input/output handling

### Phase 4: Polish & Advanced (Week 7-8)
1. Sample browser with drag-drop
2. Preset management (save/load)
3. Project save/load (IndexedDB)
4. Export to MIDI/WAV/MP3
5. Keyboard shortcuts
6. Undo/redo system

---

## Key Design Decisions

### Why This Stack Works

1. **Desktop Performance**: Vite's fast HMR + React's virtual DOM + Zustand's minimal re-renders
2. **Professional UI**: Mantine's components + Framer Motion animations = native-like feel
3. **Audio Power**: Tone.js abstracts Web Audio complexity while remaining extensible
4. **Scalability**: TypeScript + modular architecture allows team growth
5. **Modern**: All libraries actively maintained (2024-2025 releases)

### Trade-offs Considered

- **Tone.js vs Raw Web Audio**: Chose Tone.js for faster development, can drop down to raw API when needed
- **Zustand vs Redux**: Zustand for simplicity, less boilerplate
- **Konva vs raw Canvas**: Konva for easier scene graph management in piano roll
- **Vite vs Webpack**: Vite for speed, modern ESM support

---

## Installation Command

```bash
# Create new Vite project with React and TypeScript
npm create vite@latest virtual-instrument-daw -- --template react-ts
cd virtual-instrument-daw

# Install all core dependencies
npm install react react-dom react-router-dom \
  @mantine/core @mantine/hooks @mantine/form @mantine/notifications @mantine/modals @mantine/dropzone @mantine/spotlight @mantine/dates \
  @emotion/react @emotion/styled \
  tone standardized-audio-context midi-writer-js webmidi @tonejs/midi \
  pizzicato soundfont-player \
  zustand immer use-immer \
  wavesurfer.js konva react-konva d3 @visx/visx \
  framer-motion react-spring \
  file-saver jszip idb idb-keyval \
  lamejs audiobuffer-to-wav web-audio-beat-detector \
  react-grid-layout react-resizable-panels @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities \
  lodash-es date-fns uuid color \
  react-hotkeys-hook mousetrap \
  comlink

# Install all dev dependencies
npm install -D typescript @types/react @types/react-dom @types/lodash-es @types/color @types/uuid \
  vite @vitejs/plugin-react vite-plugin-wasm vite-plugin-pwa \
  eslint prettier @typescript-eslint/eslint-plugin @typescript-eslint/parser \
  vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event \
  postcss postcss-preset-mantine postcss-simple-vars

# Start development server
npm run dev
```

**⚠️ Important Installation Notes:**
1. Always check package documentation for peer dependencies
2. Use exact versions from official docs to avoid breaking changes
3. Run `npm outdated` regularly to check for updates
4. Test thoroughly after updating any audio-related package
5. Refer to official migration guides when upgrading major versions

---

## Additional Resources

### Essential Documentation Links
- 📘 [Mantine Documentation](https://mantine.dev/) - Complete UI component library
- 📘 [Tone.js Examples](https://tonejs.github.io/examples/) - Interactive audio demos
- 📘 [Web Audio API Guide](https://developer.mozilla.org/en-US/Web/API/Web_Audio_API) - Browser audio fundamentals
- 📘 [React Performance Optimization](https://react.dev/learn/render-and-commit) - Rendering best practices
- 📘 [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html) - Language reference
- 📘 [Vite Guide](https://vitejs.dev/guide/) - Build tool documentation

### Audio Development Resources
- 📘 [Web Audio API Spec](https://www.w3.org/TR/webaudio/) - Official W3C specification
- 📘 [Audio Worklet](https://developer.chrome.com/blog/audio-worklet/) - Custom audio processors
- 📘 [Web MIDI API](https://www.w3.org/TR/webmidi/) - MIDI specification

### Community & Learning
- 📘 [Web Audio Weekly](https://www.webaudioweekly.com/) - Newsletter
- 📘 [Stack Overflow - Web Audio](https://stackoverflow.com/questions/tagged/web-audio) - Q&A
- 📘 [GitHub - Web Audio Examples](https://github.com/mdn/webaudio-examples) - Sample code

### Version Verification Commands
```bash
# Check installed versions
npm list react tone @mantine/core zustand

# Check for outdated packages
npm outdated

# View package documentation
npm docs <package-name>

# Check package info from npm
npm info <package-name>
```

---

## Success Metrics

- **Performance**: 60 FPS UI even with 32+ tracks
- **Latency**: <20ms audio latency on modern hardware
- **Load Time**: <3s initial load, <1s project load
- **Bundle Size**: <500KB gzipped (excluding audio samples)
- **Cross-browser**: Works on Chrome, Firefox, Safari, Edge

---

**Next Steps**: Create the Vite project structure and begin Phase 1 implementation.
