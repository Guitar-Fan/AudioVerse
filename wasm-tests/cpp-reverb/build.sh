#!/bin/bash

# Build script for C++ WASM reverb
set -e

echo "Building Dragonfly Hall Reverb WASM module..."

# Set Emscripten environment if needed
if [ ! -d "/opt/emsdk" ]; then
    echo "Error: Emscripten SDK not found. Please install Emscripten first."
    exit 1
fi

# Source Emscripten environment
source /opt/emsdk/emsdk_env.sh

# Build the WASM module
emcc main.cpp \
    -I. \
    -O3 \
    -s WASM=1 \
    -s MODULARIZE=1 \
    -s EXPORT_NAME=ReverbModule \
    -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap"]' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s INITIAL_MEMORY=16MB \
    -s MAXIMUM_MEMORY=64MB \
    -s USE_PTHREADS=0 \
    -s ASSERTIONS=0 \
    -s NO_EXIT_RUNTIME=1 \
    -s ENVIRONMENT=web \
    -std=c++17 \
    --bind \
    -o reverb.js

echo "Build completed successfully!"
echo "Generated files:"
echo "  - reverb.js (JavaScript glue code)"
echo "  - reverb.wasm (WebAssembly binary)"

# Check if files were created
if [ -f "reverb.js" ] && [ -f "reverb.wasm" ]; then
    echo ""
    echo "File sizes:"
    ls -lh reverb.js reverb.wasm
else
    echo "Error: Build failed - output files not found"
    exit 1
fi
