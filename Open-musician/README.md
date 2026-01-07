# Open Musician

Open Musician is a Mantine + React audio workstation that runs entirely in the browser. It combines Tone.js, Zustand, and a modern component architecture to deliver a desktop-quality DAW feel for virtual instruments, sequencing, and effects routing.

## Tech Stack

- React 18 + TypeScript + Vite
- Mantine 7 for UI/UX
- Tone.js, standardized-audio-context, Web MIDI
- Zustand for project/audio/UI state
- Konva, WaveSurfer, visx for visualization

## Getting Started

```bash
cd open-musician
npm install
npm run dev  # opens http://localhost:5173 and serves index.html
```

To build for production:

```bash
npm run build
npm run preview  # serves dist/index.html
```

## Project Structure

- `src/components` – Transport, mixer, piano roll, arrangement, browser, instruments, effects
- `src/audio` – Audio engine, track/effect presets, MIDI clips
- `src/store` – Zustand stores for project/audio/UI state
- `src/styles` – Global styling + piano roll grid helpers
- `index.html` – SPA entry for dev/preview/build

## License

MIT. Contributions welcome!
