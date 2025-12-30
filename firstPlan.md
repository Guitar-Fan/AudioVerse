# Open Musician – Master Feature Plan

## Vision
Deliver a web-first Digital Audio Workstation that feels indistinguishable from a polished desktop DAW. Open Musician must combine Tone.js-driven synthesis, Mantine-powered UI, and precision visual tooling to create a “super, super sick” experience that surprises users with how much power can live inside a browser tab.

## Experience Pillars
1. **Desktop-Grade Interaction** – Movable/resizable panes, cascading menus, custom-drawn icons, zero accidental text selection, buttery drag/drop with auto-scroll and easing.
2. **Tone.js Firepower** – Deep library of synthesizers, samplers, and modular effects with tweakable parameters and routable chains per track and on the master bus.
3. **Visual Clarity** – FL-style piano roll, timeline markers stretching the full height, zoom everywhere, high-resolution meters/spectrograms/waveforms, and precise clip boundaries.
4. **Fluid Workflow** – Track/mixer/step-sequencer/score views, clip-based editing (copy, split, merge, consolidate), robust transport + tempo automation, export to WAV/MP3/MIDI.
5. **Playability** – Virtual MIDI keyboard, musical typing, WebMIDI in/out, responsive latency, per-track monitoring options.

---

## Phase 0 – Foundation Hardening
| Step | Description | Key Files |
| --- | --- | --- |
| 0.1 | Refine `AudioEngine` with Tone.js context, master bus, metronome oscillator, tempo automation curve, and transport API (`play`, `pause`, `stop`, `locate`, `setBpm`, `tapTempo`). | `open-musician/src/audio/AudioEngine.ts` |
| 0.2 | Extend `useAudioStore` with derived selectors (`isPlaying`, `position`, `loopRegion`) and actions hooking to the engine. | `open-musician/src/store/audioStore.ts` |
| 0.3 | Introduce project schema (tracks, clips, automation lanes, instrument presets) plus undo/redo timeline using Immer patches. | `open-musician/src/store/projectStore.ts`, `open-musician/src/types/index.ts` |
| 0.4 | Persist sessions via IndexedDB (`ProjectRepository` service) with versioned migrations and serialization helpers. | `open-musician/src/utils/index.ts`, new `src/services/projectRepository.ts` |
| 0.5 | Build layout shell with Mantine `AppShell`, resizable panels, detachable windows (use `react-resizable-panels` + custom docking manager). | `open-musician/src/App.tsx`, `open-musician/src/components` |

**Success Metrics:** Reliable transport, project autosave, glitch-free panel resizing, <10ms pointer latency.

---

## Phase 1 – Track + Clip Workflow
1. **Track Types & Headers**
   - Audio, MIDI, Instrument, Master, Return.
   - Each header exposes mute/solo/arm, color swatch, instrument/effect badges, quick routing.
   - Files: `src/components/Mixer/MixerPanel.tsx`, `src/components/Sequencer/ArrangeView.tsx`, `src/audio/Track.ts`.

2. **Clip Engine**
   - Data model: `Clip { id, trackId, type: 'midi' | 'audio', start, length, loop, payload }`.
   - Actions: add, duplicate, slip edit, resize (quantized + free), split, merge, consolidate, ghost copy.
   - Drag gestures: custom overlay showing start/end, snap indicators, SHIFT to disable snapping.
   - Files: `projectStore`, `ArrangeView`, `styles/global.css` (pointer cursors, no text select).

3. **Timeline & Markers**
   - Absolute ruler with beats+bars, tempo/time-signature change lanes, loop region, playhead.
   - Markers span full height with gradient lines for readability.
   - Zoom: pinch trackpad, CTRL+scroll, dedicated slider.
   - Files: `ArrangeView`, new `TimelineRuler` component using Konva or SVG.

4. **Step Sequencer + Score View**
   - Step sequencer grid for drum programming (per-track toggle).
   - Score view (Noteflight-inspired) for printable notation (use VexFlow).
   - Files: `src/components/Sequencer/StepSequencer.tsx`, `ScoreEditor.tsx`.

---

## Phase 2 – Piano Roll Excellence
1. **Konva Canvas Piano Roll**
   - Infinite scrollable grid, FL-colored accents, ghost notes for selected clips.
   - Multi-selection, marquee, lasso, velocity handles, note tail editing, humanize/randomize tools.
   - Auto-scroll when dragging near edges; horizontal/vertical zoom decoupled.
   - Files: `PianoRoll/PianoRollEditor.tsx`, new `usePianoRollController.ts` hook.

2. **MIDI Tooling**
   - Quantize presets, scale highlighting, chord guides, strum/arpeggiate macros.
   - WebMIDI in/out routing for live capture (without audio recording).
   - Files: `audio/midi/index.ts`, `hooks/useMidiInput.ts`.

3. **Virtual Keyboard + Musical Typing**
   - Floating keyboard (React Konva) + QWERTY bindings (use `react-hotkeys-hook`).
   - Velocity layers via key velocity or mouse wheel.
   - Files: `components/Instruments/VirtualKeyboard.tsx`.

---

## Phase 3 – Instrument & Effect Ecosystem
1. **Instrument Rack**
   - Tone.js presets (AMSynth, FMSynth, DuoSynth, Sampler, MonoSynth, Pluck, Membrane, Noise).
   - UI cards show waveform preview, macro knobs, preset browse, save/share user patches.
   - Use dynamic import for heavy modules, WebAssembly for future DSP.
   - Files: `audio/instruments`, `components/Instruments/InstrumentsPanel.tsx`, new `InstrumentEditor.tsx`.

2. **Effect Chains**
   - Drag/drop effects per track, reorder with smooth animation, bypass toggle, wet/dry mix.
   - Built-in: EQ3, Compressor, Limiter, Reverb (Lexikan), Delay, Chorus, Distortion, Phaser, Bitcrusher.
   - Visual analyzers (spectrum, spectrogram) built with visx/canvas.
   - Files: `audio/effects`, `components/Effects/EffectsRack.tsx`, `components/Mixer/MixerPanel.tsx` (insert/send slots).

3. **Routing & Modulation**
   - Matrix router (track -> bus -> master) and modulation sources (LFO, envelopes) assignable to any parameter.
   - Automation lanes per clip + global track lanes.
   - Files: new `components/Automation/AutomationLane.tsx`, updates to `projectStore` for automation envelopes.

---

## Phase 4 – Visualization, Export, Media
1. **Meters + Visualizers**
   - Per-track LUFS meter, master spectrum, waveform preview, stereo vectorscope.
   - Use `waveSurfer.js` + WebGL shaders for crisp rendering.
   - Files: `components/Mixer/MixerPanel.tsx`, `components/Visualization/`.

2. **Audio Clip Upload/Playback**
   - Drag files into browser, analyze BPM/key, place on timeline as audio clips (no recording).
   - Normalize, fade handles, reverse, time-stretch (phase vocoder from repository).
   - Files: `components/Browser/ResourceBrowser.tsx`, `audio/AudioEngine.ts` (buffer players), integrate `phase-vocoder`.

3. **Export Suite**
   - Render buses offline using Tone.js transport scheduling; export WAV/MP3 via `audiobuffer-to-wav` + `lamejs`.
   - MIDI export (entire project or selected clips) using `@tonejs/midi` + `midi-writer-js`.
   - Preset/project sharing via ZIP (JSZip).
   - Files: `audio/export.ts`, `components/Transport/TransportControls.tsx` (export dropdown), UI notifications.

---

## Phase 5 – Ultra-Polish & Desktop Illusion
1. **Windowing System**
   - Floating inspectors, detachable mixer, plugin windows, snapping guides, cascade/tile commands.
   - Custom title bars with icons (SVG), no emojis. Support keyboard shortcuts for layout recall.
   - Files: new `components/Layout/WindowManager.tsx`, `hooks/useWindowManager.ts`.

2. **Menus + Command Palette**
   - Classic cascading menu (File/Edit/View/Tools/Help) built with Mantine `Menu` + custom styling.
   - Spotlight-style command launcher for quick actions.
   - Files: `components/Layout/AppMenu.tsx`, integrate `@mantine/spotlight`.

3. **Animation & Interaction Polish**
   - Drag easing (Framer Motion spring), shimmer feedback, cross-fade clip previews, timeline follow camera.
   - Disable text selection globally during drags; implement auto-scroll once cursor enters hot zones.
   - Files: `styles/global.css`, various components hooking into `react-spring`/`framer-motion`.

4. **Accessibility & Shortcuts**
   - Full keyboard navigation, ARIA labels, color contrast checks.
   - Shortcut overlay (press `?`) listing commands.
   - Files: `hooks/useHotkeys.ts`, `components/Help/ShortcutOverlay.tsx`.

---

## Stretch Goals & Nice-to-Haves
- **Collaboration:** Realtime cursor + clip sync via WebRTC + Yjs (future).
- **AI Helpers:** Tone.js macro generator, groove humanizer, auto-mix suggestions using wasm DSP.
- **Theming:** Multiple studio skins (dark, neon, retro) with Mantine theme overrides.
- **Performance Budgets:** 60 FPS UI, <20ms audio latency, <3s project load, memory guard for large sessions.

---

## Implementation Notes
- Enforce custom icon set (SVG) and forbid emoji usage through lint rule or component wrapper.
- Use `PointerEvents` for drag logic; wrap content with `user-select: none` when dragging to avoid accidental highlights.
- Document every major feature in `/open-musician/docs/` for future contributors (architecture, audio routing, state shape).
- After each phase, run `npm run build` and manual smoke tests; monitor VS Code Problems panel.

This plan is intentionally ambitious—tackle in order, ship incremental milestones, and keep the UX “super super sick.”
