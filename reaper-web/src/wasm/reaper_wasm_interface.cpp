/*
 * REAPER Web - WASM Interface
 * C++ to JavaScript bindings for the REAPER Web engine
 * Optimized for real-time audio performance
 */

#include <emscripten/bind.h>
#include <emscripten/emscripten.h>
#include <emscripten/threading.h>
#include <emscripten/webaudio.h>
#include <memory>
#include <vector>

#include "reaper_engine.hpp"
#include "audio_engine.hpp"
#include "track_manager.hpp"
#include "project_manager.hpp"

using namespace emscripten;

// Global engine instance for C interface
static std::unique_ptr<ReaperEngine> g_engine;

extern "C" {

// Engine lifecycle
EMSCRIPTEN_KEEPALIVE
int reaper_engine_create() {
    try {
        g_engine = std::make_unique<ReaperEngine>();
        return 1; // Success
    } catch (...) {
        return 0; // Failure
    }
}

EMSCRIPTEN_KEEPALIVE
void reaper_engine_destroy() {
    if (g_engine) {
        g_engine->Shutdown();
        g_engine.reset();
    }
}

EMSCRIPTEN_KEEPALIVE
int reaper_engine_initialize(double sampleRate, int bufferSize, int maxChannels) {
    if (!g_engine) return 0;
    
    ReaperEngine::GlobalSettings settings;
    settings.sampleRate = sampleRate;
    settings.bufferSize = bufferSize;
    settings.maxChannels = maxChannels;
    
    return g_engine->Initialize(settings) ? 1 : 0;
}

// Audio processing - critical real-time function
EMSCRIPTEN_KEEPALIVE
void reaper_engine_process_audio(float* inputBuffer, float* outputBuffer, 
                                int numChannels, int numSamples) {
    if (!g_engine) {
        // Output silence if engine not available
        for (int i = 0; i < numChannels * numSamples; ++i) {
            outputBuffer[i] = 0.0f;
        }
        return;
    }
    
    // Convert flat buffers to channel arrays for processing
    static std::vector<float*> inputs, outputs;
    inputs.resize(numChannels);
    outputs.resize(numChannels);
    
    for (int ch = 0; ch < numChannels; ++ch) {
        inputs[ch] = inputBuffer + (ch * numSamples);
        outputs[ch] = outputBuffer + (ch * numSamples);
    }
    
    g_engine->ProcessAudioBlock(inputs.data(), outputs.data(), numChannels, numSamples);
}

// Transport controls
EMSCRIPTEN_KEEPALIVE
void reaper_engine_play() {
    if (g_engine) g_engine->Play();
}

EMSCRIPTEN_KEEPALIVE
void reaper_engine_stop() {
    if (g_engine) g_engine->Stop();
}

EMSCRIPTEN_KEEPALIVE
void reaper_engine_pause() {
    if (g_engine) g_engine->Pause();
}

EMSCRIPTEN_KEEPALIVE
void reaper_engine_record() {
    if (g_engine) g_engine->Record();
}

EMSCRIPTEN_KEEPALIVE
void reaper_engine_toggle_play_pause() {
    if (g_engine) g_engine->TogglePlayPause();
}

// Position and timing
EMSCRIPTEN_KEEPALIVE
void reaper_engine_set_position(double seconds) {
    if (g_engine) g_engine->SetPlayPosition(seconds);
}

EMSCRIPTEN_KEEPALIVE
double reaper_engine_get_position() {
    if (!g_engine) return 0.0;
    return g_engine->GetTransportState().playPosition.load();
}

EMSCRIPTEN_KEEPALIVE
void reaper_engine_set_tempo(double bpm) {
    if (g_engine) g_engine->SetTempo(bpm);
}

EMSCRIPTEN_KEEPALIVE
double reaper_engine_get_tempo() {
    if (!g_engine) return 120.0;
    return g_engine->GetTransportState().tempo.load();
}

EMSCRIPTEN_KEEPALIVE
void reaper_engine_set_loop_points(double start, double end) {
    if (g_engine) g_engine->SetLoopPoints(start, end);
}

// Master controls
EMSCRIPTEN_KEEPALIVE
void reaper_engine_set_master_volume(double volume) {
    if (g_engine) g_engine->SetMasterVolume(volume);
}

EMSCRIPTEN_KEEPALIVE
void reaper_engine_set_master_pan(double pan) {
    if (g_engine) g_engine->SetMasterPan(pan);
}

EMSCRIPTEN_KEEPALIVE
void reaper_engine_toggle_master_mute() {
    if (g_engine) g_engine->ToggleMasterMute();
}

EMSCRIPTEN_KEEPALIVE
void reaper_engine_set_metronome(int enabled) {
    if (g_engine) g_engine->SetMetronome(enabled != 0);
}

// Audio settings
EMSCRIPTEN_KEEPALIVE
void reaper_engine_set_sample_rate(double rate) {
    if (g_engine) g_engine->SetSampleRate(rate);
}

EMSCRIPTEN_KEEPALIVE
void reaper_engine_set_buffer_size(int size) {
    if (g_engine) g_engine->SetBufferSize(size);
}

// Performance monitoring
EMSCRIPTEN_KEEPALIVE
double reaper_engine_get_cpu_usage() {
    if (!g_engine) return 0.0;
    return g_engine->GetCpuUsage();
}

// Track management
EMSCRIPTEN_KEEPALIVE
int track_manager_create_track(const char* name) {
    if (!g_engine) return -1;
    
    TrackManager* trackManager = g_engine->GetTrackManager();
    if (!trackManager) return -1;
    
    Track* track = trackManager->CreateTrack(name ? name : "");
    return track ? trackManager->GetTrackIndex(track) : -1;
}

EMSCRIPTEN_KEEPALIVE
int track_manager_delete_track(int index) {
    if (!g_engine) return 0;
    
    TrackManager* trackManager = g_engine->GetTrackManager();
    if (!trackManager) return 0;
    
    return trackManager->DeleteTrack(index) ? 1 : 0;
}

EMSCRIPTEN_KEEPALIVE
int track_manager_get_track_count() {
    if (!g_engine) return 0;
    
    TrackManager* trackManager = g_engine->GetTrackManager();
    if (!trackManager) return 0;
    
    return trackManager->GetTrackCount();
}

EMSCRIPTEN_KEEPALIVE
void track_manager_set_track_volume(int trackIndex, double volume) {
    if (!g_engine) return;
    
    TrackManager* trackManager = g_engine->GetTrackManager();
    Track* track = trackManager ? trackManager->GetTrack(trackIndex) : nullptr;
    if (track) {
        track->SetVolume(volume);
    }
}

EMSCRIPTEN_KEEPALIVE
void track_manager_set_track_pan(int trackIndex, double pan) {
    if (!g_engine) return;
    
    TrackManager* trackManager = g_engine->GetTrackManager();
    Track* track = trackManager ? trackManager->GetTrack(trackIndex) : nullptr;
    if (track) {
        track->SetPan(pan);
    }
}

EMSCRIPTEN_KEEPALIVE
void track_manager_set_track_mute(int trackIndex, int mute) {
    if (!g_engine) return;
    
    TrackManager* trackManager = g_engine->GetTrackManager();
    Track* track = trackManager ? trackManager->GetTrack(trackIndex) : nullptr;
    if (track) {
        track->SetMute(mute != 0);
    }
}

EMSCRIPTEN_KEEPALIVE
void track_manager_set_track_solo(int trackIndex, int solo) {
    if (!g_engine) return;
    
    TrackManager* trackManager = g_engine->GetTrackManager();
    Track* track = trackManager ? trackManager->GetTrack(trackIndex) : nullptr;
    if (track) {
        track->SetSolo(solo != 0);
    }
}

EMSCRIPTEN_KEEPALIVE
void track_manager_set_track_record_arm(int trackIndex, int armed) {
    if (!g_engine) return;
    
    TrackManager* trackManager = g_engine->GetTrackManager();
    Track* track = trackManager ? trackManager->GetTrack(trackIndex) : nullptr;
    if (track) {
        track->SetRecordArm(armed != 0);
    }
}

// Project management
EMSCRIPTEN_KEEPALIVE
int project_manager_new_project() {
    if (!g_engine) return 0;
    return g_engine->NewProject() ? 1 : 0;
}

EMSCRIPTEN_KEEPALIVE
int project_manager_load_project(const char* filePath) {
    if (!g_engine || !filePath) return 0;
    return g_engine->LoadProject(filePath) ? 1 : 0;
}

EMSCRIPTEN_KEEPALIVE
int project_manager_save_project(const char* filePath) {
    if (!g_engine) return 0;
    return g_engine->SaveProject(filePath ? filePath : "") ? 1 : 0;
}

// Undo/Redo
EMSCRIPTEN_KEEPALIVE
void reaper_engine_begin_undo_block(const char* description) {
    if (g_engine) {
        g_engine->BeginUndoBlock(description ? description : "");
    }
}

EMSCRIPTEN_KEEPALIVE
void reaper_engine_end_undo_block() {
    if (g_engine) g_engine->EndUndoBlock();
}

EMSCRIPTEN_KEEPALIVE
int reaper_engine_undo() {
    if (!g_engine) return 0;
    return g_engine->Undo() ? 1 : 0;
}

EMSCRIPTEN_KEEPALIVE
int reaper_engine_redo() {
    if (!g_engine) return 0;
    return g_engine->Redo() ? 1 : 0;
}

} // extern "C"

// Embind bindings for more complex C++ objects
EMSCRIPTEN_BINDINGS(reaper_web) {
    // Engine state enums
    enum_<ReaperEngine::PlayState>("PlayState")
        .value("STOPPED", ReaperEngine::PlayState::STOPPED)
        .value("PLAYING", ReaperEngine::PlayState::PLAYING)
        .value("RECORDING", ReaperEngine::PlayState::RECORDING)
        .value("PAUSED", ReaperEngine::PlayState::PAUSED);
    
    enum_<ReaperEngine::TimeFormat>("TimeFormat")
        .value("SECONDS", ReaperEngine::TimeFormat::SECONDS)
        .value("SAMPLES", ReaperEngine::TimeFormat::SAMPLES)
        .value("MEASURES_BEATS", ReaperEngine::TimeFormat::MEASURES_BEATS)
        .value("MINUTES_SECONDS", ReaperEngine::TimeFormat::MINUTES_SECONDS)
        .value("TIMECODE", ReaperEngine::TimeFormat::TIMECODE);
    
    // Transport state - read-only access
    value_object<ReaperEngine::TransportState>("TransportState")
        .field("playPosition", &ReaperEngine::TransportState::playPosition)
        .field("tempo", &ReaperEngine::TransportState::tempo)
        .field("loop", &ReaperEngine::TransportState::loop)
        .field("loopStart", &ReaperEngine::TransportState::loopStart)
        .field("loopEnd", &ReaperEngine::TransportState::loopEnd);
    
    // Memory management functions
    function("malloc", &malloc, allow_raw_pointers());
    function("free", &free, allow_raw_pointers());
}

// Threading setup for real-time audio
EM_JS(void, setup_audio_thread, (), {
    if (typeof SharedArrayBuffer !== 'undefined') {
        // Enable high-precision timing for audio thread
        if (Module.ENVIRONMENT_IS_PTHREAD) {
            self.performance = self.performance || {};
            self.performance.now = self.performance.now || function() {
                return Date.now();
            };
        }
    }
});

// Initialize threading when module loads
void initializeThreading() {
    setup_audio_thread();
}

// Module initialization
EMSCRIPTEN_BINDINGS(module_init) {
    emscripten::function("initializeThreading", &initializeThreading);
}