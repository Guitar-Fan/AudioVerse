#!/bin/bash

# REAPER Web DAW - Emscripten Build Script
# Optimized for real-time audio processing and WASM performance

set -e

# Configuration
PROJECT_NAME="reaper-web"
SRC_DIR="../src"
OUTPUT_DIR="."
WASM_DIR="../js"

# Emscripten configuration for audio processing
EMCC_FLAGS=(
    # Optimization for audio processing
    -O3                                 # Maximum optimization
    -msimd128                          # Enable SIMD for DSP
    -msse                              # SSE instructions
    -msse2                             # SSE2 instructions
    -ffast-math                        # Fast math for audio DSP
    
    # Memory configuration
    -s TOTAL_MEMORY=256MB              # Large memory for audio buffers
    -s ALLOW_MEMORY_GROWTH=1           # Allow dynamic memory growth
    -s MAXIMUM_MEMORY=1GB              # Maximum memory limit
    
    # Threading for real-time audio
    -s USE_PTHREADS=1                  # Enable threading
    -s PTHREAD_POOL_SIZE=4             # Thread pool size
    -s PROXY_TO_PTHREAD=1              # Proxy main thread to worker
    
    # Audio-specific settings
    -s EXPORTED_FUNCTIONS="[
        '_malloc',
        '_free',
        '_main',
        '_reaper_engine_create',
        '_reaper_engine_destroy',
        '_reaper_engine_initialize',
        '_reaper_engine_process_audio',
        '_reaper_engine_set_sample_rate',
        '_reaper_engine_set_buffer_size',
        '_reaper_engine_play',
        '_reaper_engine_stop',
        '_reaper_engine_pause',
        '_reaper_engine_record',
        '_reaper_engine_set_position',
        '_reaper_engine_get_position',
        '_reaper_engine_set_tempo',
        '_reaper_engine_get_tempo',
        '_reaper_engine_set_master_volume',
        '_reaper_engine_set_master_pan',
        '_reaper_engine_toggle_master_mute',
        '_track_manager_create_track',
        '_track_manager_delete_track',
        '_track_manager_get_track_count',
        '_track_manager_set_track_volume',
        '_track_manager_set_track_pan',
        '_track_manager_set_track_mute',
        '_track_manager_set_track_solo',
        '_track_manager_set_track_record_arm',
        '_project_manager_new_project',
        '_project_manager_load_project',
        '_project_manager_save_project'
    ]"
    
    # WASM-specific optimizations
    -s WASM=1                          # Generate WASM
    -s WASM_BIGINT=1                   # Support for 64-bit integers
    -s MODULARIZE=1                    # Generate modular output
    -s EXPORT_NAME="ReaperWebModule"   # Module name
    
    # Development vs Production
    $([[ "$1" == "debug" ]] && echo "-g -s ASSERTIONS=1 -s SAFE_HEAP=1" || echo "-s ASSERTIONS=0")
    
    # File system for project files
    -s FORCE_FILESYSTEM=1              # Enable file system
    -s EXPORTED_RUNTIME_METHODS="['FS', 'ccall', 'cwrap']"
    
    # Audio buffer optimization
    -s INITIAL_MEMORY=64MB             # Initial memory for audio buffers
    -s STACK_SIZE=2MB                  # Large stack for audio processing
    
    # Disable features not needed for audio
    -s DISABLE_EXCEPTION_CATCHING=1    # No exceptions in real-time audio
    -s NO_EXIT_RUNTIME=1               # Keep runtime alive
    
    # Emscripten-specific audio settings
    -s WEBAUDIO=1                      # Enable Web Audio API support
    
    # Linking settings
    --bind                             # Enable embind for C++ binding
    --pre-js ../js/reaper_web_pre.js   # Pre-JavaScript file
    --post-js ../js/reaper_web_post.js # Post-JavaScript file
    
    # Output settings
    -o ${OUTPUT_DIR}/${PROJECT_NAME}.js
)

# Source files - core REAPER Web engine
SOURCE_FILES=(
    "${SRC_DIR}/core/reaper_engine.cpp"
    "${SRC_DIR}/core/audio_engine.cpp"
    "${SRC_DIR}/core/audio_buffer.cpp"
    "${SRC_DIR}/core/project_manager.cpp"
    "${SRC_DIR}/core/track_manager.cpp"
    "${SRC_DIR}/media/media_item.cpp"
        "src/jsfx/jsfx_interpreter.cpp"
    "src/effects/reaper_effects.cpp"
    "src/effects/effect_chain.cpp"
)
    "${SRC_DIR}/wasm/reaper_wasm_interface.cpp"
    "${SRC_DIR}/effects/reaper_effects.cpp"
    "${SRC_DIR}/audio/audio_device.cpp"
)

# Include directories
INCLUDE_DIRS=(
    -I"${SRC_DIR}/core"
    -I"${SRC_DIR}/media"
    -I"${SRC_DIR}/wasm" 
    -I"${SRC_DIR}/jsfx"
    -I"${SRC_DIR}/effects"
    -I"${SRC_DIR}/audio"
    -I"${SRC_DIR}/utils"
)

echo "Building REAPER Web DAW with Emscripten..."
echo "Mode: $([[ "$1" == "debug" ]] && echo "Debug" || echo "Release")"
echo "Target: ${PROJECT_NAME}.wasm"

# Check if emcc is available
if ! command -v emcc &> /dev/null; then
    echo "Error: Emscripten (emcc) not found in PATH"
    echo "Please install Emscripten: https://emscripten.org/docs/getting_started/downloads.html"
    exit 1
fi

# Create output directories
mkdir -p ${OUTPUT_DIR}
mkdir -p ${WASM_DIR}

# Build command
echo "Building with emcc..."
emcc "${EMCC_FLAGS[@]}" "${INCLUDE_DIRS[@]}" "${SOURCE_FILES[@]}"

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo "Output files:"
    echo "  - ${OUTPUT_DIR}/${PROJECT_NAME}.js"
    echo "  - ${OUTPUT_DIR}/${PROJECT_NAME}.wasm"
    
    # Copy files to web directory
    if [ -d "${WASM_DIR}" ]; then
        cp ${OUTPUT_DIR}/${PROJECT_NAME}.js ${WASM_DIR}/
        cp ${OUTPUT_DIR}/${PROJECT_NAME}.wasm ${WASM_DIR}/
        echo "  - Copied to ${WASM_DIR}/"
    fi
    
    # Show file sizes
    echo ""
    echo "File sizes:"
    ls -lh ${OUTPUT_DIR}/${PROJECT_NAME}.js ${OUTPUT_DIR}/${PROJECT_NAME}.wasm
    
    # Performance hints
    echo ""
    echo "Performance tips:"
    echo "  - Serve files with gzip compression"
    echo "  - Use SharedArrayBuffer for best audio performance"
    echo "  - Enable CORS headers for threading"
    echo "  - Use HTTPS for SharedArrayBuffer support"
    
else
    echo "❌ Build failed!"
    exit 1
fi