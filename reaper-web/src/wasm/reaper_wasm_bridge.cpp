/*
 * REAPER Web - WASM Bridge
 * Emscripten interface for C++ REAPER engine
 */

#include <emscripten.h>
#include <emscripten/bind.h>
#include <emscripten/val.h>
#include "../core/reaper_engine.hpp"
#include "../core/audio_engine.hpp"
#include "../core/track_manager.hpp"
#include "../core/project_manager.hpp"
#include "../media/media_item.hpp"
#include "../effects/jsfx_processor.hpp"
#include <memory>
#include <vector>
#include <string>

using namespace emscripten;

// Global REAPER engine instance
std::unique_ptr<ReaperEngine> g_reaperEngine;

// Audio processing buffers for Web Audio API interaction
float* g_inputBuffer = nullptr;
float* g_outputBuffer = nullptr;
int g_bufferSize = 512;
int g_sampleRate = 44100;

extern "C" {

// Engine Initialization
EMSCRIPTEN_KEEPALIVE
int reaper_engine_initialize(int sampleRate, int bufferSize) {
    try {
        g_sampleRate = sampleRate;
        g_bufferSize = bufferSize;
        
        // Create global engine instance
        g_reaperEngine = std::make_unique<ReaperEngine>();
        
        // Initialize audio engine
        AudioEngine::AudioSettings settings;
        settings.sampleRate = sampleRate;
        settings.bufferSize = bufferSize;
        settings.numInputChannels = 2;
        settings.numOutputChannels = 2;
        
        bool success = g_reaperEngine->GetAudioEngine()->Initialize(settings);
        
        // Allocate audio buffers
        g_inputBuffer = new float[bufferSize * 2];
        g_outputBuffer = new float[bufferSize * 2];
        
        return success ? 1 : 0;
    } catch (...) {
        return 0;
    }
}

EMSCRIPTEN_KEEPALIVE
void reaper_engine_shutdown() {
    if (g_reaperEngine) {
        g_reaperEngine->Shutdown();
        g_reaperEngine.reset();
    }
    
    if (g_inputBuffer) {
        delete[] g_inputBuffer;
        g_inputBuffer = nullptr;
    }
    
    if (g_outputBuffer) {
        delete[] g_outputBuffer;
        g_outputBuffer = nullptr;
    }
}

// Real-time Audio Processing
EMSCRIPTEN_KEEPALIVE
void reaper_engine_process_audio(float* inputLeft, float* inputRight, 
                                float* outputLeft, float* outputRight, 
                                int numSamples) {
    if (!g_reaperEngine || !g_reaperEngine->GetAudioEngine()) {
        // Clear output buffers
        for (int i = 0; i < numSamples; i++) {
            outputLeft[i] = 0.0f;
            outputRight[i] = 0.0f;
        }
        return;
    }
    
    // Prepare input buffer (interleaved)
    for (int i = 0; i < numSamples; i++) {
        g_inputBuffer[i * 2] = inputLeft[i];
        g_inputBuffer[i * 2 + 1] = inputRight[i];
    }
    
    // Process audio through REAPER engine
    g_reaperEngine->GetAudioEngine()->ProcessAudio(g_inputBuffer, g_outputBuffer, numSamples);
    
    // Copy to output buffers (de-interleaved)
    for (int i = 0; i < numSamples; i++) {
        outputLeft[i] = g_outputBuffer[i * 2];
        outputRight[i] = g_outputBuffer[i * 2 + 1];
    }
}

// Transport Controls
EMSCRIPTEN_KEEPALIVE
void reaper_transport_play() {
    if (g_reaperEngine) {
        g_reaperEngine->Play();
    }
}

EMSCRIPTEN_KEEPALIVE
void reaper_transport_stop() {
    if (g_reaperEngine) {
        g_reaperEngine->Stop();
    }
}

EMSCRIPTEN_KEEPALIVE
void reaper_transport_pause() {
    if (g_reaperEngine) {
        g_reaperEngine->Pause();
    }
}

EMSCRIPTEN_KEEPALIVE
void reaper_transport_record() {
    if (g_reaperEngine) {
        g_reaperEngine->Record();
    }
}

EMSCRIPTEN_KEEPALIVE
int reaper_transport_is_playing() {
    if (g_reaperEngine) {
        return g_reaperEngine->IsPlaying() ? 1 : 0;
    }
    return 0;
}

EMSCRIPTEN_KEEPALIVE
int reaper_transport_is_recording() {
    if (g_reaperEngine) {
        return g_reaperEngine->IsRecording() ? 1 : 0;
    }
    return 0;
}

EMSCRIPTEN_KEEPALIVE
void reaper_transport_set_position(double timeInSeconds) {
    if (g_reaperEngine) {
        g_reaperEngine->SetPlayPosition(timeInSeconds);
    }
}

EMSCRIPTEN_KEEPALIVE
double reaper_transport_get_position() {
    if (g_reaperEngine) {
        return g_reaperEngine->GetPlayPosition();
    }
    return 0.0;
}

EMSCRIPTEN_KEEPALIVE
void reaper_transport_set_tempo(double bpm) {
    if (g_reaperEngine) {
        g_reaperEngine->SetTempo(bpm);
    }
}

EMSCRIPTEN_KEEPALIVE
double reaper_transport_get_tempo() {
    if (g_reaperEngine) {
        return g_reaperEngine->GetTempo();
    }
    return 120.0;
}

// Track Management
EMSCRIPTEN_KEEPALIVE
int reaper_track_create() {
    if (g_reaperEngine && g_reaperEngine->GetTrackManager()) {
        return g_reaperEngine->GetTrackManager()->CreateTrack();
    }
    return -1;
}

EMSCRIPTEN_KEEPALIVE
void reaper_track_delete(int trackId) {
    if (g_reaperEngine && g_reaperEngine->GetTrackManager()) {
        g_reaperEngine->GetTrackManager()->DeleteTrack(trackId);
    }
}

EMSCRIPTEN_KEEPALIVE
void reaper_track_set_volume(int trackId, float volume) {
    if (g_reaperEngine && g_reaperEngine->GetTrackManager()) {
        auto track = g_reaperEngine->GetTrackManager()->GetTrack(trackId);
        if (track) {
            track->SetVolume(volume);
        }
    }
}

EMSCRIPTEN_KEEPALIVE
float reaper_track_get_volume(int trackId) {
    if (g_reaperEngine && g_reaperEngine->GetTrackManager()) {
        auto track = g_reaperEngine->GetTrackManager()->GetTrack(trackId);
        if (track) {
            return track->GetVolume();
        }
    }
    return 1.0f;
}

EMSCRIPTEN_KEEPALIVE
void reaper_track_set_pan(int trackId, float pan) {
    if (g_reaperEngine && g_reaperEngine->GetTrackManager()) {
        auto track = g_reaperEngine->GetTrackManager()->GetTrack(trackId);
        if (track) {
            track->SetPan(pan);
        }
    }
}

EMSCRIPTEN_KEEPALIVE
float reaper_track_get_pan(int trackId) {
    if (g_reaperEngine && g_reaperEngine->GetTrackManager()) {
        auto track = g_reaperEngine->GetTrackManager()->GetTrack(trackId);
        if (track) {
            return track->GetPan();
        }
    }
    return 0.0f;
}

EMSCRIPTEN_KEEPALIVE
void reaper_track_set_mute(int trackId, int muted) {
    if (g_reaperEngine && g_reaperEngine->GetTrackManager()) {
        auto track = g_reaperEngine->GetTrackManager()->GetTrack(trackId);
        if (track) {
            track->SetMuted(muted != 0);
        }
    }
}

EMSCRIPTEN_KEEPALIVE
int reaper_track_get_mute(int trackId) {
    if (g_reaperEngine && g_reaperEngine->GetTrackManager()) {
        auto track = g_reaperEngine->GetTrackManager()->GetTrack(trackId);
        if (track) {
            return track->IsMuted() ? 1 : 0;
        }
    }
    return 0;
}

EMSCRIPTEN_KEEPALIVE
void reaper_track_set_solo(int trackId, int soloed) {
    if (g_reaperEngine && g_reaperEngine->GetTrackManager()) {
        auto track = g_reaperEngine->GetTrackManager()->GetTrack(trackId);
        if (track) {
            track->SetSoloed(soloed != 0);
        }
    }
}

EMSCRIPTEN_KEEPALIVE
int reaper_track_get_solo(int trackId) {
    if (g_reaperEngine && g_reaperEngine->GetTrackManager()) {
        auto track = g_reaperEngine->GetTrackManager()->GetTrack(trackId);
        if (track) {
            return track->IsSoloed() ? 1 : 0;
        }
    }
    return 0;
}

EMSCRIPTEN_KEEPALIVE
void reaper_track_set_record_armed(int trackId, int armed) {
    if (g_reaperEngine && g_reaperEngine->GetTrackManager()) {
        auto track = g_reaperEngine->GetTrackManager()->GetTrack(trackId);
        if (track) {
            track->SetRecordArmed(armed != 0);
        }
    }
}

EMSCRIPTEN_KEEPALIVE
int reaper_track_get_record_armed(int trackId) {
    if (g_reaperEngine && g_reaperEngine->GetTrackManager()) {
        auto track = g_reaperEngine->GetTrackManager()->GetTrack(trackId);
        if (track) {
            return track->IsRecordArmed() ? 1 : 0;
        }
    }
    return 0;
}

EMSCRIPTEN_KEEPALIVE
int reaper_track_get_count() {
    if (g_reaperEngine && g_reaperEngine->GetTrackManager()) {
        return g_reaperEngine->GetTrackManager()->GetTrackCount();
    }
    return 0;
}

// Effects Management
EMSCRIPTEN_KEEPALIVE
int reaper_track_add_effect(int trackId, const char* effectName) {
    if (g_reaperEngine && g_reaperEngine->GetTrackManager()) {
        auto track = g_reaperEngine->GetTrackManager()->GetTrack(trackId);
        if (track) {
            return track->AddEffect(std::string(effectName));
        }
    }
    return -1;
}

EMSCRIPTEN_KEEPALIVE
void reaper_track_remove_effect(int trackId, int effectId) {
    if (g_reaperEngine && g_reaperEngine->GetTrackManager()) {
        auto track = g_reaperEngine->GetTrackManager()->GetTrack(trackId);
        if (track) {
            track->RemoveEffect(effectId);
        }
    }
}

EMSCRIPTEN_KEEPALIVE
void reaper_effect_set_parameter(int trackId, int effectId, int paramIndex, float value) {
    if (g_reaperEngine && g_reaperEngine->GetTrackManager()) {
        auto track = g_reaperEngine->GetTrackManager()->GetTrack(trackId);
        if (track) {
            track->SetEffectParameter(effectId, paramIndex, value);
        }
    }
}

EMSCRIPTEN_KEEPALIVE
float reaper_effect_get_parameter(int trackId, int effectId, int paramIndex) {
    if (g_reaperEngine && g_reaperEngine->GetTrackManager()) {
        auto track = g_reaperEngine->GetTrackManager()->GetTrack(trackId);
        if (track) {
            return track->GetEffectParameter(effectId, paramIndex);
        }
    }
    return 0.0f;
}

EMSCRIPTEN_KEEPALIVE
void reaper_effect_set_bypass(int trackId, int effectId, int bypassed) {
    if (g_reaperEngine && g_reaperEngine->GetTrackManager()) {
        auto track = g_reaperEngine->GetTrackManager()->GetTrack(trackId);
        if (track) {
            track->SetEffectBypassed(effectId, bypassed != 0);
        }
    }
}

// Media Items
EMSCRIPTEN_KEEPALIVE
int reaper_media_item_create(int trackId, double startTime, double length) {
    if (g_reaperEngine && g_reaperEngine->GetMediaItemManager()) {
        return g_reaperEngine->GetMediaItemManager()->CreateMediaItem(trackId, startTime, length);
    }
    return -1;
}

EMSCRIPTEN_KEEPALIVE
void reaper_media_item_delete(int itemId) {
    if (g_reaperEngine && g_reaperEngine->GetMediaItemManager()) {
        g_reaperEngine->GetMediaItemManager()->DeleteMediaItem(itemId);
    }
}

EMSCRIPTEN_KEEPALIVE
void reaper_media_item_set_position(int itemId, double startTime) {
    if (g_reaperEngine && g_reaperEngine->GetMediaItemManager()) {
        auto item = g_reaperEngine->GetMediaItemManager()->GetMediaItem(itemId);
        if (item) {
            item->SetStartTime(startTime);
        }
    }
}

EMSCRIPTEN_KEEPALIVE
double reaper_media_item_get_position(int itemId) {
    if (g_reaperEngine && g_reaperEngine->GetMediaItemManager()) {
        auto item = g_reaperEngine->GetMediaItemManager()->GetMediaItem(itemId);
        if (item) {
            return item->GetStartTime();
        }
    }
    return 0.0;
}

EMSCRIPTEN_KEEPALIVE
void reaper_media_item_set_length(int itemId, double length) {
    if (g_reaperEngine && g_reaperEngine->GetMediaItemManager()) {
        auto item = g_reaperEngine->GetMediaItemManager()->GetMediaItem(itemId);
        if (item) {
            item->SetLength(length);
        }
    }
}

EMSCRIPTEN_KEEPALIVE
double reaper_media_item_get_length(int itemId) {
    if (g_reaperEngine && g_reaperEngine->GetMediaItemManager()) {
        auto item = g_reaperEngine->GetMediaItemManager()->GetMediaItem(itemId);
        if (item) {
            return item->GetLength();
        }
    }
    return 0.0;
}

// Project Management
EMSCRIPTEN_KEEPALIVE
void reaper_project_new() {
    if (g_reaperEngine && g_reaperEngine->GetProjectManager()) {
        g_reaperEngine->GetProjectManager()->NewProject();
    }
}

EMSCRIPTEN_KEEPALIVE
int reaper_project_save(const char* filename) {
    if (g_reaperEngine && g_reaperEngine->GetProjectManager()) {
        return g_reaperEngine->GetProjectManager()->SaveProject(std::string(filename)) ? 1 : 0;
    }
    return 0;
}

EMSCRIPTEN_KEEPALIVE
int reaper_project_load(const char* filename) {
    if (g_reaperEngine && g_reaperEngine->GetProjectManager()) {
        return g_reaperEngine->GetProjectManager()->LoadProject(std::string(filename)) ? 1 : 0;
    }
    return 0;
}

EMSCRIPTEN_KEEPALIVE
int reaper_project_is_dirty() {
    if (g_reaperEngine && g_reaperEngine->GetProjectManager()) {
        return g_reaperEngine->GetProjectManager()->IsDirty() ? 1 : 0;
    }
    return 0;
}

// Undo/Redo
EMSCRIPTEN_KEEPALIVE
void reaper_undo() {
    if (g_reaperEngine) {
        g_reaperEngine->Undo();
    }
}

EMSCRIPTEN_KEEPALIVE
void reaper_redo() {
    if (g_reaperEngine) {
        g_reaperEngine->Redo();
    }
}

EMSCRIPTEN_KEEPALIVE
int reaper_can_undo() {
    if (g_reaperEngine) {
        return g_reaperEngine->CanUndo() ? 1 : 0;
    }
    return 0;
}

EMSCRIPTEN_KEEPALIVE
int reaper_can_redo() {
    if (g_reaperEngine) {
        return g_reaperEngine->CanRedo() ? 1 : 0;
    }
    return 0;
}

// Performance Monitoring
EMSCRIPTEN_KEEPALIVE
float reaper_get_cpu_usage() {
    if (g_reaperEngine && g_reaperEngine->GetAudioEngine()) {
        return g_reaperEngine->GetAudioEngine()->GetCPUUsage();
    }
    return 0.0f;
}

EMSCRIPTEN_KEEPALIVE
int reaper_get_audio_dropouts() {
    if (g_reaperEngine && g_reaperEngine->GetAudioEngine()) {
        return g_reaperEngine->GetAudioEngine()->GetDropoutCount();
    }
    return 0;
}

EMSCRIPTEN_KEEPALIVE
void reaper_reset_performance_counters() {
    if (g_reaperEngine && g_reaperEngine->GetAudioEngine()) {
        g_reaperEngine->GetAudioEngine()->ResetPerformanceCounters();
    }
}

} // extern "C"

// Emscripten bindings for C++ classes (for more advanced JS interaction)
EMSCRIPTEN_BINDINGS(reaper_engine) {
    // Register basic functions
    function("initialize", &reaper_engine_initialize);
    function("shutdown", &reaper_engine_shutdown);
    function("processAudio", &reaper_engine_process_audio, allow_raw_pointers());
    
    // Transport functions
    function("play", &reaper_transport_play);
    function("stop", &reaper_transport_stop);
    function("pause", &reaper_transport_pause);
    function("record", &reaper_transport_record);
    function("isPlaying", &reaper_transport_is_playing);
    function("isRecording", &reaper_transport_is_recording);
    function("setPosition", &reaper_transport_set_position);
    function("getPosition", &reaper_transport_get_position);
    function("setTempo", &reaper_transport_set_tempo);
    function("getTempo", &reaper_transport_get_tempo);
    
    // Track functions
    function("createTrack", &reaper_track_create);
    function("deleteTrack", &reaper_track_delete);
    function("setTrackVolume", &reaper_track_set_volume);
    function("getTrackVolume", &reaper_track_get_volume);
    function("setTrackPan", &reaper_track_set_pan);
    function("getTrackPan", &reaper_track_get_pan);
    function("setTrackMute", &reaper_track_set_mute);
    function("getTrackMute", &reaper_track_get_mute);
    function("setTrackSolo", &reaper_track_set_solo);
    function("getTrackSolo", &reaper_track_get_solo);
    function("setTrackRecordArmed", &reaper_track_set_record_armed);
    function("getTrackRecordArmed", &reaper_track_get_record_armed);
    function("getTrackCount", &reaper_track_get_count);
    
    // Effects functions
    function("addEffect", &reaper_track_add_effect);
    function("removeEffect", &reaper_track_remove_effect);
    function("setEffectParameter", &reaper_effect_set_parameter);
    function("getEffectParameter", &reaper_effect_get_parameter);
    function("setEffectBypass", &reaper_effect_set_bypass);
    
    // Media item functions
    function("createMediaItem", &reaper_media_item_create);
    function("deleteMediaItem", &reaper_media_item_delete);
    function("setMediaItemPosition", &reaper_media_item_set_position);
    function("getMediaItemPosition", &reaper_media_item_get_position);
    function("setMediaItemLength", &reaper_media_item_set_length);
    function("getMediaItemLength", &reaper_media_item_get_length);
    
    // Project functions
    function("newProject", &reaper_project_new);
    function("saveProject", &reaper_project_save);
    function("loadProject", &reaper_project_load);
    function("isProjectDirty", &reaper_project_is_dirty);
    
    // Undo/Redo functions
    function("undo", &reaper_undo);
    function("redo", &reaper_redo);
    function("canUndo", &reaper_can_undo);
    function("canRedo", &reaper_can_redo);
    
    // Performance monitoring
    function("getCPUUsage", &reaper_get_cpu_usage);
    function("getAudioDropouts", &reaper_get_audio_dropouts);
    function("resetPerformanceCounters", &reaper_reset_performance_counters);
}