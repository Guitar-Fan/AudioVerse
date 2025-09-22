#!/bin/bash

# REAPER Web Engine - WASM Build Script
# Compiles C++ REAPER engine to WebAssembly

set -e

echo "Building REAPER Web Engine WASM Module..."

# Configuration
BUILD_DIR="/workspaces/AudioVerse/reaper-web/build"
SRC_DIR="/workspaces/AudioVerse/reaper-web/src"
OUTPUT_DIR="/workspaces/AudioVerse/reaper-web/ui"
WASM_NAME="reaperengine"

# Create build directory
mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"

# Emscripten compiler flags
EMSCRIPTEN_FLAGS=(
    # Optimization
    -O3
    -flto
    
    # WASM specific
    -s WASM=1
    -s ALLOW_MEMORY_GROWTH=1
    -s MAXIMUM_MEMORY=512MB
    -s STACK_SIZE=1MB
    
    # Export settings
    -s EXPORTED_FUNCTIONS='[
        "_reaper_engine_initialize",
        "_reaper_engine_shutdown", 
        "_reaper_engine_process_audio",
        "_reaper_transport_play",
        "_reaper_transport_stop", 
        "_reaper_transport_pause",
        "_reaper_transport_record",
        "_reaper_transport_is_playing",
        "_reaper_transport_is_recording",
        "_reaper_transport_set_position",
        "_reaper_transport_get_position",
        "_reaper_transport_set_tempo",
        "_reaper_transport_get_tempo",
        "_reaper_track_create",
        "_reaper_track_delete",
        "_reaper_track_set_volume",
        "_reaper_track_get_volume",
        "_reaper_track_set_pan",
        "_reaper_track_get_pan",
        "_reaper_track_set_mute",
        "_reaper_track_get_mute",
        "_reaper_track_set_solo",
        "_reaper_track_get_solo",
        "_reaper_track_set_record_armed",
        "_reaper_track_get_record_armed",
        "_reaper_track_get_count",
        "_reaper_track_add_effect",
        "_reaper_track_remove_effect",
        "_reaper_effect_set_parameter",
        "_reaper_effect_get_parameter",
        "_reaper_effect_set_bypass",
        "_reaper_media_item_create",
        "_reaper_media_item_delete",
        "_reaper_media_item_set_position",
        "_reaper_media_item_get_position",
        "_reaper_media_item_set_length",
        "_reaper_media_item_get_length",
        "_reaper_project_new",
        "_reaper_project_save",
        "_reaper_project_load",
        "_reaper_project_is_dirty",
        "_reaper_undo",
        "_reaper_redo",
        "_reaper_can_undo",
        "_reaper_can_redo",
        "_reaper_get_cpu_usage",
        "_reaper_get_audio_dropouts",
        "_reaper_reset_performance_counters",
        "_malloc",
        "_free"
    ]'
    
    # Runtime settings
    -s EXPORTED_RUNTIME_METHODS='["ccall", "cwrap", "getValue", "setValue", "UTF8ToString", "stringToUTF8"]'
    -s MODULARIZE=1
    -s EXPORT_NAME="ReaperEngineModule"
    -s ENVIRONMENT="web"
    
    # Audio worklet support
    -s AUDIO_WORKLET=1
    
    # Threading support (optional for future use)
    -s USE_PTHREADS=0
    
    # File system support for project loading
    -s FORCE_FILESYSTEM=1
    
    # Embind for C++ class bindings
    --bind
    
    # Debug symbols (remove for production)
    -g
    -s ASSERTIONS=1
    
    # Enable exceptions for error handling
    -s DISABLE_EXCEPTION_CATCHING=0
    
    # Memory management
    -s TOTAL_MEMORY=67108864  # 64MB initial
    -s ALLOW_MEMORY_GROWTH=1
)

# Source files to compile
SOURCES=(
    # Core engine files
    "$SRC_DIR/core/reaper_engine.cpp"
    "$SRC_DIR/core/audio_engine.cpp"
    "$SRC_DIR/core/track_manager.cpp"
    "$SRC_DIR/core/audio_buffer.cpp"
    
    # Audio processing
    "$SRC_DIR/audio/audio_buffer.cpp"
    
    # Effects processing
    "$SRC_DIR/effects/reaper_effects.cpp"
    "$SRC_DIR/effects/effect_chain.cpp"
    
    # JSFX interpreter
    "$SRC_DIR/jsfx/jsfx_interpreter.cpp"
    
    # Media handling
    "$SRC_DIR/media/media_item.cpp"
    
    # UI components
    "$SRC_DIR/ui/timeline_view.cpp"
    
    # WASM bridge
    "$SRC_DIR/wasm/reaper_wasm_bridge.cpp"
)

# Include directories
INCLUDES=(
    "-I$SRC_DIR"
    "-I$SRC_DIR/core"
    "-I$SRC_DIR/audio"
    "-I$SRC_DIR/effects"
    "-I$SRC_DIR/media"
    "-I$SRC_DIR/wasm"
)

echo "Compiling with Emscripten..."
echo "Sources: ${#SOURCES[@]} files"
echo "Output: $OUTPUT_DIR/$WASM_NAME.js"

# Check if emcc is available
if ! command -v emcc &> /dev/null; then
    echo "Error: Emscripten (emcc) not found!"
    echo "Please install Emscripten and source the environment:"
    echo "  git clone https://github.com/emscripten-core/emsdk.git"
    echo "  cd emsdk"
    echo "  ./emsdk install latest"
    echo "  ./emsdk activate latest"
    echo "  source ./emsdk_env.sh"
    exit 1
fi

# Compile to WASM
emcc "${EMSCRIPTEN_FLAGS[@]}" "${INCLUDES[@]}" "${SOURCES[@]}" \
    -o "$OUTPUT_DIR/$WASM_NAME.js"

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
    echo "🎉 REAPER Web Engine WASM module ready!"
    echo "Include in ReaVerse.html with:"
    echo '  <script src="reaperengine.js"></script>'
    
else
    echo "❌ WASM compilation failed!"
    exit 1
fi