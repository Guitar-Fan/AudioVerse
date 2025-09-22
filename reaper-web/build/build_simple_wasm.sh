#!/bin/bash

# Simple REAPER WASM Build Script
# Builds minimal working WASM module for ReaVerse

set -e

echo "Building Simple REAPER WASM Module..."

# Configuration
SRC_DIR="/workspaces/AudioVerse/reaper-web/src"
OUTPUT_DIR="/workspaces/AudioVerse/reaper-web/ui"
WASM_NAME="reaperengine"

# Emscripten compiler flags
EMSCRIPTEN_FLAGS=(
    # Optimization
    -O3
    
    # WASM specific
    -s WASM=1
    -s ALLOW_MEMORY_GROWTH=1
    -s INITIAL_MEMORY=16MB
    
    # Export settings
    -s EXPORTED_FUNCTIONS='[
        "_reaper_initialize",
        "_reaper_shutdown", 
        "_reaper_process_audio",
        "_reaper_play",
        "_reaper_stop", 
        "_reaper_pause",
        "_reaper_record",
        "_reaper_is_playing",
        "_reaper_is_recording",
        "_reaper_set_position",
        "_reaper_get_position",
        "_reaper_set_tempo",
        "_reaper_get_tempo",
        "_reaper_create_track",
        "_reaper_delete_track",
        "_reaper_get_track_count",
        "_reaper_set_track_volume",
        "_reaper_get_track_volume",
        "_reaper_set_track_pan",
        "_reaper_get_track_pan",
        "_reaper_set_track_muted",
        "_reaper_get_track_muted",
        "_reaper_set_track_soloed",
        "_reaper_get_track_soloed",
        "_reaper_set_track_record_armed",
        "_reaper_get_track_record_armed",
        "_malloc",
        "_free"
    ]'
    
    # Runtime settings
    -s EXPORTED_RUNTIME_METHODS='["ccall", "cwrap", "getValue", "setValue"]'
    -s MODULARIZE=1
    -s EXPORT_NAME="ReaperEngineModule"
    -s ENVIRONMENT="web"
    
    # Embind for C++ class bindings
    --bind
    
    # Enable exceptions for error handling
    -s DISABLE_EXCEPTION_CATCHING=0
)

# Source file
SOURCE="$SRC_DIR/wasm/simple_reaper_wasm.cpp"

echo "Compiling with Emscripten..."
echo "Source: $SOURCE"
echo "Output: $OUTPUT_DIR/$WASM_NAME.js"

# Check if emcc is available
if ! command -v emcc &> /dev/null; then
    echo "Error: Emscripten (emcc) not found!"
    echo "Please source the environment: source /workspaces/AudioVerse/emsdk/emsdk_env.sh"
    exit 1
fi

# Compile to WASM
emcc "${EMSCRIPTEN_FLAGS[@]}" "$SOURCE" -o "$OUTPUT_DIR/$WASM_NAME.js"

if [ $? -eq 0 ]; then
    echo "✅ WASM compilation successful!"
    echo "Generated files:"
    echo "  📄 $OUTPUT_DIR/$WASM_NAME.js (JavaScript glue code)"
    echo "  🔧 $OUTPUT_DIR/$WASM_NAME.wasm (WebAssembly binary)"
    
    # Show file sizes
    if [ -f "$OUTPUT_DIR/$WASM_NAME.js" ]; then
        JS_SIZE=$(du -h "$OUTPUT_DIR/$WASM_NAME.js" | cut -f1)
        echo "  JavaScript size: $JS_SIZE"
    fi
    
    if [ -f "$OUTPUT_DIR/$WASM_NAME.wasm" ]; then
        WASM_SIZE=$(du -h "$OUTPUT_DIR/$WASM_NAME.wasm" | cut -f1)
        echo "  WASM binary size: $WASM_SIZE"
    fi
    
    echo ""
    echo "🎉 Simple REAPER WASM module ready!"
    echo "Include in ReaVerse.html with:"
    echo '  <script src="reaperengine.js"></script>'
    
else
    echo "❌ WASM compilation failed!"
    exit 1
fi