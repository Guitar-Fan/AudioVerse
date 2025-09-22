/*
 * Simple REAPER WASM Interface
 * Minimal working implementation for ReaVerse integration
 */

#include <emscripten.h>
#include <emscripten/bind.h>
#include <memory>
#include <vector>
#include <array>
#include <cmath>
#include <algorithm>

using namespace emscripten;

// Simple Track class
class SimpleTrack {
public:
    int id;
    float volume = 1.0f;
    float pan = 0.0f;
    bool muted = false;
    bool soloed = false;
    bool recordArmed = false;
    
    SimpleTrack(int trackId) : id(trackId) {}
    
    void setVolume(float vol) { volume = std::clamp(vol, 0.0f, 2.0f); }
    void setPan(float p) { pan = std::clamp(p, -1.0f, 1.0f); }
    void setMuted(bool m) { muted = m; }
    void setSoloed(bool s) { soloed = s; }
    void setRecordArmed(bool r) { recordArmed = r; }
};

// Simple Audio Engine
class SimpleReaperEngine {
private:
    std::vector<std::unique_ptr<SimpleTrack>> tracks;
    bool playing = false;
    bool recording = false;
    double currentTime = 0.0;
    double tempo = 120.0;
    int sampleRate = 44100;
    int nextTrackId = 1;
    
public:
    bool initialize(int sr, int bufferSize) {
        sampleRate = sr;
        return true;
    }
    
    void shutdown() {
        tracks.clear();
    }
    
    // Transport controls
    void play() { playing = true; }
    void stop() { playing = false; currentTime = 0.0; }
    void pause() { playing = false; }
    void record() { recording = true; playing = true; }
    
    bool isPlaying() const { return playing; }
    bool isRecording() const { return recording; }
    
    void setPosition(double time) { currentTime = time; }
    double getPosition() const { return currentTime; }
    
    void setTempo(double bpm) { tempo = std::clamp(bpm, 20.0, 300.0); }
    double getTempo() const { return tempo; }
    
    // Track management
    int createTrack() {
        int id = nextTrackId++;
        tracks.push_back(std::make_unique<SimpleTrack>(id));
        return id;
    }
    
    void deleteTrack(int trackId) {
        tracks.erase(
            std::remove_if(tracks.begin(), tracks.end(),
                [trackId](const auto& track) { return track->id == trackId; }),
            tracks.end()
        );
    }
    
    SimpleTrack* getTrack(int trackId) {
        auto it = std::find_if(tracks.begin(), tracks.end(),
            [trackId](const auto& track) { return track->id == trackId; });
        return (it != tracks.end()) ? it->get() : nullptr;
    }
    
    int getTrackCount() const { return tracks.size(); }
    
    // Track parameters
    void setTrackVolume(int trackId, float volume) {
        if (auto track = getTrack(trackId)) {
            track->setVolume(volume);
        }
    }
    
    float getTrackVolume(int trackId) {
        if (auto track = getTrack(trackId)) {
            return track->volume;
        }
        return 1.0f;
    }
    
    void setTrackPan(int trackId, float pan) {
        if (auto track = getTrack(trackId)) {
            track->setPan(pan);
        }
    }
    
    float getTrackPan(int trackId) {
        if (auto track = getTrack(trackId)) {
            return track->pan;
        }
        return 0.0f;
    }
    
    void setTrackMuted(int trackId, bool muted) {
        if (auto track = getTrack(trackId)) {
            track->setMuted(muted);
        }
    }
    
    bool getTrackMuted(int trackId) {
        if (auto track = getTrack(trackId)) {
            return track->muted;
        }
        return false;
    }
    
    void setTrackSoloed(int trackId, bool soloed) {
        if (auto track = getTrack(trackId)) {
            track->setSoloed(soloed);
        }
    }
    
    bool getTrackSoloed(int trackId) {
        if (auto track = getTrack(trackId)) {
            return track->soloed;
        }
        return false;
    }
    
    void setTrackRecordArmed(int trackId, bool armed) {
        if (auto track = getTrack(trackId)) {
            track->setRecordArmed(armed);
        }
    }
    
    bool getTrackRecordArmed(int trackId) {
        if (auto track = getTrack(trackId)) {
            return track->recordArmed;
        }
        return false;
    }
    
    // Audio processing
    void processAudio(uintptr_t inputLeftPtr, uintptr_t inputRightPtr,
                     uintptr_t outputLeftPtr, uintptr_t outputRightPtr,
                     int numSamples) {
        
        float* inputLeft = reinterpret_cast<float*>(inputLeftPtr);
        float* inputRight = reinterpret_cast<float*>(inputRightPtr);
        float* outputLeft = reinterpret_cast<float*>(outputLeftPtr);
        float* outputRight = reinterpret_cast<float*>(outputRightPtr);
        
        // Simple passthrough for now
        if (playing) {
            for (int i = 0; i < numSamples; i++) {
                outputLeft[i] = inputLeft[i];
                outputRight[i] = inputRight[i];
            }
            
            // Update playback position
            currentTime += static_cast<double>(numSamples) / sampleRate;
        } else {
            // Output silence when stopped
            std::fill(outputLeft, outputLeft + numSamples, 0.0f);
            std::fill(outputRight, outputRight + numSamples, 0.0f);
        }
    }
};

// Global engine instance
std::unique_ptr<SimpleReaperEngine> g_engine;

// C-style exports for JavaScript
extern "C" {

EMSCRIPTEN_KEEPALIVE
int reaper_initialize(int sampleRate, int bufferSize) {
    g_engine = std::make_unique<SimpleReaperEngine>();
    return g_engine->initialize(sampleRate, bufferSize) ? 1 : 0;
}

EMSCRIPTEN_KEEPALIVE
void reaper_shutdown() {
    if (g_engine) {
        g_engine->shutdown();
        g_engine.reset();
    }
}

EMSCRIPTEN_KEEPALIVE
void reaper_process_audio(uintptr_t inputLeft, uintptr_t inputRight,
                         uintptr_t outputLeft, uintptr_t outputRight,
                         int numSamples) {
    if (g_engine) {
        g_engine->processAudio(inputLeft, inputRight, outputLeft, outputRight, numSamples);
    }
}

// Transport
EMSCRIPTEN_KEEPALIVE
void reaper_play() { if (g_engine) g_engine->play(); }

EMSCRIPTEN_KEEPALIVE
void reaper_stop() { if (g_engine) g_engine->stop(); }

EMSCRIPTEN_KEEPALIVE
void reaper_pause() { if (g_engine) g_engine->pause(); }

EMSCRIPTEN_KEEPALIVE
void reaper_record() { if (g_engine) g_engine->record(); }

EMSCRIPTEN_KEEPALIVE
int reaper_is_playing() { return g_engine ? g_engine->isPlaying() : 0; }

EMSCRIPTEN_KEEPALIVE
int reaper_is_recording() { return g_engine ? g_engine->isRecording() : 0; }

EMSCRIPTEN_KEEPALIVE
void reaper_set_position(double time) { if (g_engine) g_engine->setPosition(time); }

EMSCRIPTEN_KEEPALIVE
double reaper_get_position() { return g_engine ? g_engine->getPosition() : 0.0; }

EMSCRIPTEN_KEEPALIVE
void reaper_set_tempo(double bpm) { if (g_engine) g_engine->setTempo(bpm); }

EMSCRIPTEN_KEEPALIVE
double reaper_get_tempo() { return g_engine ? g_engine->getTempo() : 120.0; }

// Tracks
EMSCRIPTEN_KEEPALIVE
int reaper_create_track() { return g_engine ? g_engine->createTrack() : -1; }

EMSCRIPTEN_KEEPALIVE
void reaper_delete_track(int trackId) { if (g_engine) g_engine->deleteTrack(trackId); }

EMSCRIPTEN_KEEPALIVE
int reaper_get_track_count() { return g_engine ? g_engine->getTrackCount() : 0; }

EMSCRIPTEN_KEEPALIVE
void reaper_set_track_volume(int trackId, float volume) {
    if (g_engine) g_engine->setTrackVolume(trackId, volume);
}

EMSCRIPTEN_KEEPALIVE
float reaper_get_track_volume(int trackId) {
    return g_engine ? g_engine->getTrackVolume(trackId) : 1.0f;
}

EMSCRIPTEN_KEEPALIVE
void reaper_set_track_pan(int trackId, float pan) {
    if (g_engine) g_engine->setTrackPan(trackId, pan);
}

EMSCRIPTEN_KEEPALIVE
float reaper_get_track_pan(int trackId) {
    return g_engine ? g_engine->getTrackPan(trackId) : 0.0f;
}

EMSCRIPTEN_KEEPALIVE
void reaper_set_track_muted(int trackId, int muted) {
    if (g_engine) g_engine->setTrackMuted(trackId, muted != 0);
}

EMSCRIPTEN_KEEPALIVE
int reaper_get_track_muted(int trackId) {
    return g_engine ? g_engine->getTrackMuted(trackId) : 0;
}

EMSCRIPTEN_KEEPALIVE
void reaper_set_track_soloed(int trackId, int soloed) {
    if (g_engine) g_engine->setTrackSoloed(trackId, soloed != 0);
}

EMSCRIPTEN_KEEPALIVE
int reaper_get_track_soloed(int trackId) {
    return g_engine ? g_engine->getTrackSoloed(trackId) : 0;
}

EMSCRIPTEN_KEEPALIVE
void reaper_set_track_record_armed(int trackId, int armed) {
    if (g_engine) g_engine->setTrackRecordArmed(trackId, armed != 0);
}

EMSCRIPTEN_KEEPALIVE
int reaper_get_track_record_armed(int trackId) {
    return g_engine ? g_engine->getTrackRecordArmed(trackId) : 0;
}

} // extern "C"

// Emscripten bindings
EMSCRIPTEN_BINDINGS(simple_reaper) {
    class_<SimpleReaperEngine>("ReaperEngine")
        .constructor()
        .function("initialize", &SimpleReaperEngine::initialize)
        .function("shutdown", &SimpleReaperEngine::shutdown)
        .function("play", &SimpleReaperEngine::play)
        .function("stop", &SimpleReaperEngine::stop)
        .function("pause", &SimpleReaperEngine::pause)
        .function("record", &SimpleReaperEngine::record)
        .function("isPlaying", &SimpleReaperEngine::isPlaying)
        .function("isRecording", &SimpleReaperEngine::isRecording)
        .function("setPosition", &SimpleReaperEngine::setPosition)
        .function("getPosition", &SimpleReaperEngine::getPosition)
        .function("setTempo", &SimpleReaperEngine::setTempo)
        .function("getTempo", &SimpleReaperEngine::getTempo)
        .function("createTrack", &SimpleReaperEngine::createTrack)
        .function("deleteTrack", &SimpleReaperEngine::deleteTrack)
        .function("getTrackCount", &SimpleReaperEngine::getTrackCount)
        .function("setTrackVolume", &SimpleReaperEngine::setTrackVolume)
        .function("getTrackVolume", &SimpleReaperEngine::getTrackVolume)
        .function("setTrackPan", &SimpleReaperEngine::setTrackPan)
        .function("getTrackPan", &SimpleReaperEngine::getTrackPan)
        .function("setTrackMuted", &SimpleReaperEngine::setTrackMuted)
        .function("getTrackMuted", &SimpleReaperEngine::getTrackMuted)
        .function("setTrackSoloed", &SimpleReaperEngine::setTrackSoloed)
        .function("getTrackSoloed", &SimpleReaperEngine::getTrackSoloed)
        .function("setTrackRecordArmed", &SimpleReaperEngine::setTrackRecordArmed)
        .function("getTrackRecordArmed", &SimpleReaperEngine::getTrackRecordArmed)
        .function("processAudio", &SimpleReaperEngine::processAudio, allow_raw_pointers());
}