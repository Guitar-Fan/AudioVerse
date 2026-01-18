# AudioVerse SoundFont Player

An advanced SoundFont player for the AudioVerse project, inspired by and referencing [SpessaSynth](https://github.com/spessasus/SpessaSynth). This player provides professional-grade MIDI playback with SoundFont2 (.sf2), SoundFont3 (.sf3), and DLS support.

## Features

### Core Functionality
- **SoundFont Support**: Load and play SF2, SF3, and DLS files
- **MIDI Playback**: Full MIDI file playback with real-time visualization
- **Web Audio API**: High-quality audio synthesis using modern web standards
- **Real-time Performance**: Optimized for low-latency audio playback

### User Interface
- **Drag & Drop**: Intuitive file loading for both SoundFonts and MIDI files
- **Virtual Keyboard**: Interactive piano keyboard with mouse and touch support
- **Playback Controls**: Standard transport controls (play, pause, stop, seek)
- **Progress Visualization**: Real-time playback progress with clickable seeking
- **Volume Control**: Master volume adjustment with visual feedback

### Advanced Features
- **Web MIDI API**: Support for external MIDI controllers and keyboards
- **Computer Keyboard**: Play notes using computer keyboard (A-K for white keys, W-I for black keys)
- **Settings Panel**: Adjustable voice limits, reverb, and chorus effects
- **Status Display**: Real-time logging and error reporting
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## Installation

1. **Clone SpessaSynth** (already done):
   ```bash
   git clone https://github.com/spessasus/SpessaSynth.git
   ```

2. **Open the Player**:
   Simply open `index.html` in a modern web browser. No server required for basic functionality!

3. **For Advanced Features** (optional):
   If you want to use the full SpessaSynth integration, you'll need to:
   ```bash
   cd SpessaSynth
   npm install
   npm run build
   ```

## Usage

### Getting Started
1. **Load a SoundFont**: 
   - Drag and drop a .sf2, .sf3, or .dls file onto the SoundFont upload area
   - Or click "Choose SoundFont" to browse for files
   - The player includes support for compressed SoundFonts (.sf3)

2. **Load a MIDI File**:
   - Drag and drop a .mid, .midi, .kar, or .rmi file onto the MIDI upload area
   - Or click "Choose MIDI" to browse for files

3. **Start Playing**:
   - Click the play button to start playback
   - Use the progress bar to seek to different positions
   - Adjust volume and settings as needed

### Virtual Keyboard
- **Mouse/Touch**: Click or tap keys to play notes
- **Computer Keyboard**: 
  - White keys: A, S, D, F, G, H, J, K
  - Black keys: W, E, T, Y, U, O, P
- **Drag Playing**: Hold down mouse button and drag across keys

### Settings
- **Max Voices**: Control polyphony (32-512 voices)
- **Reverb**: Adjust reverb effect level (0-100%)
- **Chorus**: Adjust chorus effect level (0-100%)
- **Reset**: Restore all settings to defaults

## Technical Details

### Architecture
The player is built with a modular architecture:

- **`soundfont-player.js`**: Basic SoundFont player implementation
- **`advanced-player.js`**: Advanced player with full MIDI parsing and sequencing
- **`ui-controller.js`**: User interface management and event handling  
- **`keyboard.js`**: Virtual keyboard implementation
- **`player-styles.css`**: Modern, responsive styling

### Browser Compatibility
- **Chrome/Chromium**: Full support (recommended)
- **Firefox**: Full support (recommended for large SoundFonts)
- **Safari**: Basic support (some limitations with Web Audio API)
- **Edge**: Full support

### Supported Formats
- **SoundFonts**: .sf2, .sf3 (compressed), .dls
- **MIDI Files**: .mid, .midi, .kar (karaoke), .rmi (with embedded fonts)

### Web APIs Used
- **Web Audio API**: Core audio synthesis and processing
- **Web MIDI API**: External MIDI device support (Chrome/Edge)
- **File API**: Drag and drop file handling
- **AudioWorklet**: High-performance audio processing (when available)

## SpessaSynth Integration

This player is inspired by and references the excellent [SpessaSynth](https://github.com/spessasus/SpessaSynth) project by spessasus. Key architectural decisions and approaches were adapted from SpessaSynth:

### What We Learned from SpessaSynth
- **SF2 Parsing**: Approach to parsing SoundFont2 file format
- **MIDI Sequencing**: Real-time MIDI event scheduling and processing
- **Audio Worklet Usage**: High-performance audio synthesis architecture
- **User Interface Patterns**: Best practices for MIDI player UI/UX

### Differences from SpessaSynth
- **Simplified Architecture**: Focused on core functionality for AudioVerse integration
- **Custom Styling**: Tailored visual design matching AudioVerse aesthetic
- **Modular Structure**: Designed for easy integration into larger projects
- **Educational Focus**: Extensively commented code for learning purposes

## File Structure

```
soundfont-player/
├── index.html              # Main application interface
├── css/
│   └── player-styles.css   # Responsive styling
├── js/
│   ├── soundfont-player.js # Basic player implementation
│   ├── advanced-player.js  # Advanced MIDI sequencing
│   ├── ui-controller.js    # UI management
│   └── keyboard.js         # Virtual keyboard
├── soundfonts/             # Place your SoundFont files here
└── README.md              # This file
```

## Sample Files

### SoundFonts
- **GeneralUser GS**: Available from [S. Christian Collins](https://schristiancollins.com/generaluser.php)
- **FluidSynth GM**: Available from [FluidSynth project](https://github.com/FluidSynth/fluidsynth/wiki/SoundFont)
- **Musyng Kite**: Available from [Musical Artifacts](https://musical-artifacts.com/artifacts/1176)

### MIDI Files
- Use any standard MIDI file (.mid)
- Karaoke files (.kar) are supported for lyrics display
- RMIDI files (.rmi) with embedded SoundFonts work great

## Development

### Adding New Features
The modular structure makes it easy to extend:

1. **Audio Effects**: Add to the `advanced-player.js` audio graph
2. **UI Components**: Extend `ui-controller.js` with new interface elements
3. **File Format Support**: Modify parsers in the player classes
4. **Visualization**: Add canvas-based visualizers to the interface

### Debugging
- Open browser developer console for detailed logging
- Status display shows real-time operation information
- Error messages appear in both console and status display

## Performance Tips

### For Large SoundFonts
- Use Firefox for better memory handling
- Close other browser tabs to free up RAM
- Consider using compressed SoundFonts (.sf3)

### For Complex MIDI Files
- Reduce max voices setting if experiencing audio dropouts
- Disable reverb/chorus effects for better performance
- Use a higher sample rate audio interface if available

## Credits

- **SpessaSynth**: Inspiration and architectural guidance by [spessasus](https://github.com/spessasus)
- **AudioVerse**: Integration into the AudioVerse digital audio workstation project
- **Web Audio API**: Mozilla and Google for the amazing web audio standards
- **SoundFont Technology**: Creative Technology Ltd. for the SoundFont standard

## License

This project follows the same Apache-2.0 license as SpessaSynth, ensuring compatibility and open source collaboration.

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes with proper documentation
4. Test thoroughly across different browsers
5. Submit a pull request with detailed description

## Support

For issues or questions:
1. Check the browser console for error messages
2. Verify your SoundFont and MIDI files are valid
3. Test with a different browser if experiencing issues
4. Ensure your browser supports Web Audio API

---

*Built with ❤️ for the AudioVerse project, inspired by the excellent SpessaSynth synthesizer.*