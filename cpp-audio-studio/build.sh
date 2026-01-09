#!/bin/bash

# C++ Audio Studio Build Script
set -e

echo "===================================="
echo "  C++ Audio Analysis Studio Build"
echo "===================================="
echo ""

# Source Emscripten environment
source /workspaces/AudioVerse/emsdk/emsdk_env.sh

# Clean previous build
echo "Cleaning previous build..."
rm -rf build
mkdir -p build

# Configure with CMake
echo "Configuring with CMake..."
cd build
emcmake cmake .. -DCMAKE_BUILD_TYPE=Release

# Build
echo "Building WASM module..."
emmake make -j4

echo ""
echo "===================================="
echo "  Build Complete!"
echo "===================================="
echo ""
echo "Output files:"
echo "  - web/audio-studio.js"
echo "  - web/audio-studio.wasm"
echo ""
echo "To run:"
echo "  cd web"
echo "  python3 -m http.server 8080"
echo "  Then open: http://localhost:8080"
echo ""
