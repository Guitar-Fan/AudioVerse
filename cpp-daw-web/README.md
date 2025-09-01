# C++ DAW Web Interface

A modern web-based interface for controlling the C++ DAW engine, built with HTML5, CSS3, and JavaScript, communicating via WebSocket.

## Features

### 🎛️ **Professional DAW Interface**
- **Transport Controls** - Play, Stop, Pause, Record with keyboard shortcuts
- **Multi-Track Management** - Add, remove, mute, solo, and control multiple audio tracks  
- **Real-Time Parameter Control** - Volume, pan, and effect parameters with live feedback
- **Effect Chain Management** - Drag-and-drop effects (Delay, Chorus, Reverb)
- **Timeline Ruler** - Visual time navigation and clip management
- **Master Section** - Tempo control, master volume, and system monitoring

### 🔗 **WebSocket Bridge Architecture**
- **Real-Time Communication** - Instant command execution between web and C++ DAW
- **Bi-Directional Data Flow** - Status updates and feedback from C++ engine
- **Automatic Reconnection** - Robust connection handling with exponential backoff
- **Command Queuing** - Ensures no commands are lost during disconnection

### 🎨 **Modern UI/UX**
- **Dark Theme** - Professional studio-style appearance
- **Responsive Design** - Works on desktop, tablet, and mobile devices
- **Visual Feedback** - Real-time level meters, status indicators, and animations
- **Keyboard Shortcuts** - Spacebar for play/pause, Ctrl+T for new track, etc.

## Architecture

```
┌─────────────────┐    WebSocket    ┌──────────────────┐    CLI Commands    ┌─────────────────┐
│   Web Browser   │ ◄─────────────► │ WebSocket Bridge │ ◄──────────────────► │   C++ DAW CLI   │
│                 │   (Port 8080)   │   (Node.js)      │                    │                 │
│ HTML/CSS/JS     │                 │                  │                    │ ALSA Audio      │
│ Interface       │                 │ Command Parser   │                    │ Processing      │
└─────────────────┘                 └──────────────────┘                    └─────────────────┘
```

## Quick Start

### 1. **Start Everything**
```bash
cd cpp-daw-web
./start-daw.sh
```

This script will:
- ✅ Install Node.js dependencies  
- ✅ Build the C++ DAW if needed
- ✅ Start the WebSocket bridge server
- ✅ Start the HTTP server for the web interface
- ✅ Display access URLs

### 2. **Access the Interface**
- 🌐 **Web Interface**: http://localhost:8000
- 🔌 **WebSocket Bridge**: ws://localhost:8080

### 3. **Start Creating Music**
- Click **"Add Track"** to create new audio tracks
- Use **Transport Controls** to play/stop/record
- Drag **Effects** from the sidebar to tracks
- Adjust **Volume/Pan** with the track controls
- Monitor **System Status** in the right panel

## Manual Setup

If you prefer to start components individually:

### Build C++ DAW
```bash
cd cpp-daw
mkdir -p build && cd build
cmake ..
make -j$(nproc)
```

### Start WebSocket Bridge
```bash
cd cpp-daw-web
npm install
node websocket-bridge.js
```

### Start Web Server
```bash
cd cpp-daw-web
python3 -m http.server 8000
```

## Command Reference

### Transport Commands
- `Spacebar` - Play/Pause toggle
- `Ctrl+S` - Stop playback
- `Ctrl+R` - Toggle record mode

### Track Management  
- `Ctrl+T` - Add new track
- `M` - Mute selected track
- `S` - Solo selected track

### Interface Commands
- `Ctrl+,` - Open settings
- `F1` - Show help

## WebSocket API

The web interface communicates with the C++ DAW through these WebSocket messages:

### Commands to C++ DAW
```javascript
// Transport control
{ "command": "play" }
{ "command": "stop" }
{ "command": "tempo", "data": { "bpm": 120 } }

// Track management  
{ "command": "track" }
{ "command": "volume", "data": { "trackId": 0, "volume": 0.8 } }
{ "command": "fx", "data": { "trackId": 0, "fxType": "reverb" } }
```

### Responses from C++ DAW
```javascript
// Status updates
{ "type": "dawOutput", "data": { "message": "Track added" } }
{ "type": "dawError", "data": { "error": "Invalid command" } }
{ "type": "status", "data": { "connected": true } }
```

## File Structure

```
cpp-daw-web/
├── index.html              # Main web interface
├── daw-interface.css        # Professional DAW styling  
├── daw-interface.js         # Frontend JavaScript logic
├── websocket-bridge.js      # Node.js WebSocket bridge
├── package.json            # Node.js dependencies
├── start-daw.sh            # Startup script
└── README.md               # This file
```

## Dependencies

### Runtime Requirements
- **Node.js** 14+ (for WebSocket bridge)
- **Python 3** (for HTTP server)  
- **Modern Browser** (WebSocket support)

### JavaScript Dependencies
- `ws` - WebSocket server library
- `nodemon` - Development auto-reload (dev only)

### Browser Requirements
- WebSocket API support
- ES6+ JavaScript support  
- CSS Grid and Flexbox support

## Development

### Adding New Features
1. **Frontend**: Modify `daw-interface.js` and add UI elements in `index.html`
2. **Backend**: Add command handlers in `websocket-bridge.js`  
3. **C++ DAW**: Implement corresponding CLI commands in the C++ application

### Styling Changes
- Edit `daw-interface.css` for visual modifications
- Uses CSS custom properties for easy theme adjustments
- Follows professional DAW color schemes and layouts

## Troubleshooting

### Connection Issues
- ❌ **"Disconnected" status**: Check if WebSocket bridge is running on port 8080
- ❌ **"DAW process not available"**: Ensure C++ DAW executable is built and accessible
- ❌ **Port conflicts**: Change ports in `websocket-bridge.js` and `daw-interface.js`

### Audio Issues  
- 🔊 **No audio output**: Check ALSA audio device configuration in C++ DAW
- 🎤 **Recording problems**: Verify audio input device permissions
- ⚡ **High latency**: Adjust buffer size in DAW settings

### Build Issues
- 🔨 **CMake errors**: Ensure ALSA development packages are installed
- 📦 **Missing dependencies**: Run `apt update && apt install libasound2-dev`

## Contributing

This web interface is designed to be extensible:

1. **Add new effects** by modifying the FX library in `daw-interface.js`  
2. **Implement MIDI support** by adding WebSocket message types
3. **Create visual waveforms** using Canvas API or Web Audio API
4. **Add file upload** for audio samples and project files

## License

MIT License - Feel free to use and modify for your projects!

---

**🎵 Happy Music Making! 🎵**
