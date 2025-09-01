cmake_minimum_required(VERSION 3.16)
project(CPPDAW VERSION 1.0.0)

# Set C++ standard
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Set build type to Debug if not specified
if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Debug)
endif()

# Compiler flags
set(CMAKE_CXX_FLAGS_DEBUG "-g -O0 -Wall -Wextra")
set(CMAKE_CXX_FLAGS_RELEASE "-O3 -DNDEBUG")

# Find required packages
find_package(PkgConfig REQUIRED)

# Check if we're building for Emscripten
if(EMSCRIPTEN)
  # We're compiling with Emscripten for WASM
  set(USING_EMSCRIPTEN TRUE)
  add_definitions(-D__EMSCRIPTEN__)
  message(STATUS "Building for WebAssembly with Emscripten")
else()
  # Native build, check for ALSA (Linux audio)
  pkg_check_modules(ALSA REQUIRED alsa)
  message(STATUS "Building for native platform with ALSA")
endif()

# Include directories
include_directories(${CMAKE_CURRENT_SOURCE_DIR}/include)
include_directories(${CMAKE_CURRENT_SOURCE_DIR}/plugins)

# Source files
set(CORE_SOURCES
    src/DAWEngine.cpp
    src/Track.cpp
    src/Clip.cpp
    src/AudioBuffer.cpp
)

# Plugin sources
set(PLUGIN_SOURCES
    plugins/BasicFX.cpp
)

# Headers
set(HEADERS
    include/DAWEngine.hpp
    include/Track.hpp
    include/Clip.hpp
    include/AudioBuffer.hpp
    include/FXPlugin.hpp
    include/Transport.hpp
    plugins/BasicFX.hpp
)

# Create static library for DAW core
add_library(dawcore STATIC ${CORE_SOURCES})
target_include_directories(dawcore PUBLIC include)

# Create static library for plugins
add_library(dawplugins STATIC ${PLUGIN_SOURCES})
target_include_directories(dawplugins PUBLIC include plugins)

# Main DAW application
add_executable(cppdaw src/main.cpp)

# Link libraries conditionally based on platform
if(USING_EMSCRIPTEN)
  # Emscripten/WASM specific libraries
  target_link_libraries(dawcore)
  target_link_libraries(cppdaw dawcore dawplugins)
  # Emscripten flags for audio support
  set(CMAKE_EXECUTABLE_SUFFIX ".html")
  set_target_properties(cppdaw PROPERTIES LINK_FLAGS "-s WASM=1 -s USE_SDL=2 -s USE_WEB_AUDIO=1 -s EXPORTED_RUNTIME_METHODS=['ccall','cwrap'] -s EXPORTED_FUNCTIONS=['_main','_processAudio'] -s ALLOW_MEMORY_GROWTH=1")
else()
  # Native platform libraries (ALSA)
  target_link_libraries(dawcore ${ALSA_LIBRARIES})
  target_link_libraries(cppdaw dawcore dawplugins ${ALSA_LIBRARIES} pthread)
endif()

# Test executable
add_executable(dawtest tests/test_main.cpp)
target_link_libraries(dawtest dawcore dawplugins)

# Install targets
install(TARGETS cppdaw DESTINATION bin)
install(FILES ${HEADERS} DESTINATION include/cppdaw)

# Create test directory
file(MAKE_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/tests)

# Compiler-specific options
if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
    target_compile_options(dawcore PRIVATE -Wall -Wextra -Wpedantic)
    target_compile_options(dawplugins PRIVATE -Wall -Wextra -Wpedantic)
endif()

# Optional: Find and link additional libraries
# For JACK support (if available)
pkg_check_modules(JACK jack)
if(JACK_FOUND)
    target_link_libraries(dawcore ${JACK_LIBRARIES})
    target_compile_definitions(dawcore PRIVATE HAVE_JACK)
endif()

# For PulseAudio support (if available)
pkg_check_modules(PULSEAUDIO libpulse-simple)
if(PULSEAUDIO_FOUND)
    target_link_libraries(dawcore ${PULSEAUDIO_LIBRARIES})
    target_compile_definitions(dawcore PRIVATE HAVE_PULSEAUDIO)
endif()

# Print configuration summary
message(STATUS "")
message(STATUS "C++ DAW Configuration:")
message(STATUS "  Build type: ${CMAKE_BUILD_TYPE}")
message(STATUS "  Compiler: ${CMAKE_CXX_COMPILER_ID}")
if(USING_EMSCRIPTEN)
  message(STATUS "  Platform: WebAssembly/Emscripten")
else()
  message(STATUS "  Platform: Native")
  message(STATUS "  ALSA found: ${ALSA_FOUND}")
  message(STATUS "  JACK found: ${JACK_FOUND}")
  message(STATUS "  PulseAudio found: ${PULSEAUDIO_FOUND}")
endif()
message(STATUS "")

# Custom targets for development
add_custom_target(format
    COMMAND find ${CMAKE_CURRENT_SOURCE_DIR}/src ${CMAKE_CURRENT_SOURCE_DIR}/include ${CMAKE_CURRENT_SOURCE_DIR}/plugins -name "*.cpp" -o -name "*.hpp" | xargs clang-format -i
    COMMENT "Formatting source code"
)

add_custom_target(clean-all
    COMMAND ${CMAKE_BUILD_TOOL} clean
    COMMAND rm -rf ${CMAKE_CURRENT_BINARY_DIR}/CMakeCache.txt
    COMMAND rm -rf ${CMAKE_CURRENT_BINARY_DIR}/CMakeFiles
    COMMENT "Deep clean build directory"
)
