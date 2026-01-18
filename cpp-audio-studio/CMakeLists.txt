cmake_minimum_required(VERSION 3.15)
project(AudioStudio CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Source files
set(SOURCES
    src/AudioAnalyzer.cpp
    src/AudioEditor.cpp
    src/PluginUI.cpp
    src/bindings.cpp
)

# Include directories  
include_directories(
    ${CMAKE_SOURCE_DIR}/include
)

# Emscripten settings for WASM build
if(EMSCRIPTEN)
    add_executable(audio-studio ${SOURCES})
    
    set_target_properties(audio-studio PROPERTIES
        LINK_FLAGS "\
            -O3 \
            -s WASM=1 \
            -s MODULARIZE=1 \
            -s EXPORT_NAME='Module' \
            -s ALLOW_MEMORY_GROWTH=1 \
            -s INITIAL_MEMORY=67108864 \
            -s MAXIMUM_MEMORY=1073741824 \
            -s EXPORTED_RUNTIME_METHODS=['ccall','cwrap'] \
            -s ASSERTIONS=0 \
            -s DISABLE_EXCEPTION_CATCHING=0 \
            --bind \
            -s ENVIRONMENT='web' \
            -s SINGLE_FILE=0 \
            --no-entry"
    )
    
    # Set output directory
    set_target_properties(audio-studio PROPERTIES
        RUNTIME_OUTPUT_DIRECTORY ${CMAKE_SOURCE_DIR}/web
    )
    
else()
    # Native build for testing
    add_executable(audio-studio-test ${SOURCES})
    target_compile_options(audio-studio-test PRIVATE -Wall -Wextra)
endif()
