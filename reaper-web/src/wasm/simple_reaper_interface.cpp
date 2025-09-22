/*
 * REAPER Web - Minimal WASM Interface
 * Simplified C++ to JavaScript bindings
 */

#include <emscripten/bind.h>
#include <emscripten/emscripten.h>
#include <memory>
#include <vector>
#include <cmath>

using namespace emscripten;

// Simplified audio processing state
struct SimpleReaperEngine {
    double sampleRate = 44100.0;
    int bufferSize = 512;
    int maxChannels = 2;
    bool initialized = false;
    bool playing = false;
    double position = 0.0;
    double tempo = 120.0;
    double masterVolume = 1.0;
    double masterPan = 0.0;
    bool masterMute = false;
    
    // Simple track data
    struct Track {
        int id;
        double volume = 1.0;
        double pan = 0.0;
        bool mute = false;
        bool solo = false;
        bool recordArm = false;
    };
    
    std::vector<Track> tracks;
    int nextTrackId = 1;
};

// Global engine instance
static std::unique_ptr<SimpleReaperEngine> g_engine;

extern "C" {

// Engine lifecycle
EMSCRIPTEN_KEEPALIVE
int reaper_engine_create() {
    try {
        g_engine = std::make_unique<SimpleReaperEngine>();
        return 1; // Success
    } catch (...) {
        return 0; // Failure
    }
}

EMSCRIPTEN_KEEPALIVE
void reaper_engine_destroy() {
    if (g_engine) {
        g_engine.reset();
    }
}

EMSCRIPTEN_KEEPALIVE
int reaper_engine_initialize(double sampleRate, int bufferSize, int maxChannels) {
    if (!g_engine) return 0;
    
    g_engine->sampleRate = sampleRate;
    g_engine->bufferSize = bufferSize;
    g_engine->maxChannels = maxChannels;
    g_engine->initialized = true;
    
    return 1;
}

// Transport controls
EMSCRIPTEN_KEEPALIVE
void reaper_engine_play() {
    if (g_engine) {
        g_engine->playing = true;
    }
}

EMSCRIPTEN_KEEPALIVE
void reaper_engine_stop() {
    if (g_engine) {
        g_engine->playing = false;
        g_engine->position = 0.0;
    }
}

EMSCRIPTEN_KEEPALIVE
void reaper_engine_pause() {
    if (g_engine) {
        g_engine->playing = false;
    }
}

EMSCRIPTEN_KEEPALIVE
void reaper_engine_record() {
    if (g_engine) {
        g_engine->playing = true;
        // Record logic would go here
    }
}

// Position and tempo
EMSCRIPTEN_KEEPALIVE
void reaper_engine_set_position(double seconds) {
    if (g_engine) {
        g_engine->position = seconds;
    }
}

EMSCRIPTEN_KEEPALIVE
double reaper_engine_get_position() {
    return g_engine ? g_engine->position : 0.0;
}

EMSCRIPTEN_KEEPALIVE
void reaper_engine_set_tempo(double bpm) {
    if (g_engine) {
        g_engine->tempo = bpm;
    }
}

EMSCRIPTEN_KEEPALIVE
double reaper_engine_get_tempo() {
    return g_engine ? g_engine->tempo : 120.0;
}

EMSCRIPTEN_KEEPALIVE
void reaper_engine_set_sample_rate(double sampleRate) {
    if (g_engine) {
        g_engine->sampleRate = sampleRate;
    }
}

EMSCRIPTEN_KEEPALIVE
void reaper_engine_set_buffer_size(int bufferSize) {
    if (g_engine) {
        g_engine->bufferSize = bufferSize;
    }
}

// Master controls
EMSCRIPTEN_KEEPALIVE
void reaper_engine_set_master_volume(double volume) {
    if (g_engine) {
        g_engine->masterVolume = std::max(0.0, std::min(2.0, volume));
    }
}

EMSCRIPTEN_KEEPALIVE
void reaper_engine_set_master_pan(double pan) {
    if (g_engine) {
        g_engine->masterPan = std::max(-1.0, std::min(1.0, pan));
    }
}

EMSCRIPTEN_KEEPALIVE
void reaper_engine_toggle_master_mute() {
    if (g_engine) {
        g_engine->masterMute = !g_engine->masterMute;
    }
}

// Track management
EMSCRIPTEN_KEEPALIVE
int track_manager_create_track() {
    if (!g_engine) return -1;
    
    SimpleReaperEngine::Track track;
    track.id = g_engine->nextTrackId++;
    g_engine->tracks.push_back(track);
    
    return track.id;
}

EMSCRIPTEN_KEEPALIVE
void track_manager_delete_track(int trackId) {
    if (!g_engine) return;
    
    g_engine->tracks.erase(
        std::remove_if(g_engine->tracks.begin(), g_engine->tracks.end(),
                      [trackId](const SimpleReaperEngine::Track& t) { return t.id == trackId; }),
        g_engine->tracks.end()
    );
}

EMSCRIPTEN_KEEPALIVE
int track_manager_get_track_count() {
    return g_engine ? static_cast<int>(g_engine->tracks.size()) : 0;
}

EMSCRIPTEN_KEEPALIVE
void track_manager_set_track_volume(int trackId, double volume) {
    if (!g_engine) return;
    
    for (auto& track : g_engine->tracks) {
        if (track.id == trackId) {
            track.volume = std::max(0.0, std::min(2.0, volume));
            break;
        }
    }
}

EMSCRIPTEN_KEEPALIVE
void track_manager_set_track_pan(int trackId, double pan) {
    if (!g_engine) return;
    
    for (auto& track : g_engine->tracks) {
        if (track.id == trackId) {
            track.pan = std::max(-1.0, std::min(1.0, pan));
            break;
        }
    }
}

EMSCRIPTEN_KEEPALIVE
void track_manager_set_track_mute(int trackId, int mute) {
    if (!g_engine) return;
    
    for (auto& track : g_engine->tracks) {
        if (track.id == trackId) {
            track.mute = (mute != 0);
            break;
        }
    }
}

EMSCRIPTEN_KEEPALIVE
void track_manager_set_track_solo(int trackId, int solo) {
    if (!g_engine) return;
    
    for (auto& track : g_engine->tracks) {
        if (track.id == trackId) {
            track.solo = (solo != 0);
            break;
        }
    }
}

EMSCRIPTEN_KEEPALIVE
void track_manager_set_track_record_arm(int trackId, int arm) {
    if (!g_engine) return;
    
    for (auto& track : g_engine->tracks) {
        if (track.id == trackId) {
            track.recordArm = (arm != 0);
            break;
        }
    }
}

// Project management (simplified)
EMSCRIPTEN_KEEPALIVE
void project_manager_new_project() {
    if (g_engine) {
        g_engine->tracks.clear();
        g_engine->position = 0.0;
        g_engine->playing = false;
        g_engine->nextTrackId = 1;
    }
}

EMSCRIPTEN_KEEPALIVE
int project_manager_load_project() {
    // Simplified - just return success
    return 1;
}

EMSCRIPTEN_KEEPALIVE
int project_manager_save_project() {
    // Simplified - just return success
    return 1;
}

// Audio processing (simplified passthrough)
EMSCRIPTEN_KEEPALIVE
void reaper_engine_process_audio(float* inputPtr, float* outputPtr, int numSamples, int numChannels) {
    if (!g_engine || !g_engine->initialized) {
        // Output silence
        for (int i = 0; i < numSamples * numChannels; i++) {
            outputPtr[i] = 0.0f;
        }
        return;
    }
    
    // Simple passthrough with master volume and mute
    if (g_engine->masterMute) {
        for (int i = 0; i < numSamples * numChannels; i++) {
            outputPtr[i] = 0.0f;
        }
    } else {
        float volume = static_cast<float>(g_engine->masterVolume);
        for (int i = 0; i < numSamples * numChannels; i++) {
            outputPtr[i] = inputPtr[i] * volume;
        }
    }
    
    // Update position if playing
    if (g_engine->playing) {
        double timeIncrement = static_cast<double>(numSamples) / g_engine->sampleRate;
        g_engine->position += timeIncrement;
    }
}

} // extern "C"

// Simple main function for WASM
int main() {
    return 0;
}

// Emscripten bindings for C++ interface
EMSCRIPTEN_BINDINGS(reaper_web) {
    // Engine functions
    function("reaper_engine_create", &reaper_engine_create);
    function("reaper_engine_destroy", &reaper_engine_destroy);
    function("reaper_engine_initialize", &reaper_engine_initialize);
    
    // Transport
    function("reaper_engine_play", &reaper_engine_play);
    function("reaper_engine_stop", &reaper_engine_stop);
    function("reaper_engine_pause", &reaper_engine_pause);
    function("reaper_engine_record", &reaper_engine_record);
    
    // Position/tempo
    function("reaper_engine_set_position", &reaper_engine_set_position);
    function("reaper_engine_get_position", &reaper_engine_get_position);
    function("reaper_engine_set_tempo", &reaper_engine_set_tempo);
    function("reaper_engine_get_tempo", &reaper_engine_get_tempo);
    
    // Master controls
    function("reaper_engine_set_master_volume", &reaper_engine_set_master_volume);
    function("reaper_engine_set_master_pan", &reaper_engine_set_master_pan);
    function("reaper_engine_toggle_master_mute", &reaper_engine_toggle_master_mute);
    
    // Track management
    function("track_manager_create_track", &track_manager_create_track);
    function("track_manager_delete_track", &track_manager_delete_track);
    function("track_manager_get_track_count", &track_manager_get_track_count);
    function("track_manager_set_track_volume", &track_manager_set_track_volume);
    function("track_manager_set_track_pan", &track_manager_set_track_pan);
    function("track_manager_set_track_mute", &track_manager_set_track_mute);
    function("track_manager_set_track_solo", &track_manager_set_track_solo);
    function("track_manager_set_track_record_arm", &track_manager_set_track_record_arm);
    
    // Project management
    function("project_manager_new_project", &project_manager_new_project);
    function("project_manager_load_project", &project_manager_load_project);
    function("project_manager_save_project", &project_manager_save_project);
}