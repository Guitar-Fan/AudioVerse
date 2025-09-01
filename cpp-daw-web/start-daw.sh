#!/bin/bash

# C++ DAW Web Interface Startup Script

echo "🎵 Starting C++ DAW Web Interface..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Navigate to web interface directory
cd "$(dirname "$0")"

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing Node.js dependencies..."
    npm install
fi

# Check if C++ DAW is built
CPP_DAW_BUILD="../cpp-daw/build/cppdaw"
if [ ! -f "$CPP_DAW_BUILD" ]; then
    echo "⚠️  C++ DAW executable not found. Building C++ DAW..."
    cd ../cpp-daw
    if [ ! -d "build" ]; then
        mkdir build
    fi
    cd build
    cmake ..
    make -j$(nproc)
    cd ../../cpp-daw-web
    
    if [ ! -f "$CPP_DAW_BUILD" ]; then
        echo "❌ Failed to build C++ DAW. Please check the build process."
        exit 1
    fi
fi

# Start the WebSocket bridge in the background
echo "🌐 Starting WebSocket bridge server..."
node websocket-bridge.js &
WEBSOCKET_PID=$!

# Start HTTP server for static files
echo "🌍 Starting HTTP server for web interface..."
python3 -m http.server 8000 &
HTTP_PID=$!

echo ""
echo "✅ C++ DAW Web Interface is now running!"
echo ""
echo "🎛️  WebSocket Bridge: ws://localhost:8080"
echo "🌐 Web Interface: http://localhost:8000"
echo ""
echo "Open your browser and go to: http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop all servers"

# Function to cleanup background processes
cleanup() {
    echo ""
    echo "🛑 Shutting down servers..."
    kill $WEBSOCKET_PID 2>/dev/null
    kill $HTTP_PID 2>/dev/null
    echo "✅ All servers stopped"
    exit 0
}

# Trap Ctrl+C
trap cleanup INT

# Wait for user to stop
wait
