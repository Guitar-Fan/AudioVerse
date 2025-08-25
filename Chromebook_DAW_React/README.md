# Chromebook DAW – React Wrapper

This React project renders the same DOM structure as your vanilla app and loads your existing scripts (FXPlugins.js and DAW.js) so functionality is preserved while you migrate UI to React incrementally.

## Dev

1. Copy your existing assets into the `public/` folder so the vanilla code can run:
   - `Chromebook_DAW/DAWstyling.css` -> `public/DAWstyling.css`
   - `Chromebook_DAW/FXPlugins.js` -> `public/FXPlugins.js`
   - `Chromebook_DAW/DAW.js` -> `public/DAW.js`

2. Install deps and run the dev server.

```bash
npm install
npm run dev
```

Open the printed local URL. The DAW should behave the same; React is only rendering the markup and mounting your scripts.

## Notes
- As you port features, replace DOM-manipulating parts in DAW.js with React state/effects, one section at a time.
- Keep element IDs stable until their logic is migrated; the vanilla script uses `document.getElementById` heavily.
