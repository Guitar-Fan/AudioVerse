#include <iostream>
#include <vector>
#include <memory>
#include <atomic>
#include <mutex>
#include <queue>
#include <chrono>
#include <cmath>
#include <algorithm>
#include <string>
#include <map>
#include <emscripten.h>
#include <emscripten/bind.h>

// Include our new advanced systems
#include "advanced_track_manager.hpp"
#include "audio_recording_system.hpp"

// Existing audio processing classes (keeping them)
class AudioBuffer {
public:
    std::vector<float> samples;
    int sampleRate;
    int channels;
    
    AudioBuffer(int size = 1024, int sr = 44100, int ch = 2) 
        : samples(size * ch, 0.0f), sampleRate(sr), channels(ch) {}
    
    void resize(int size) {
        samples.resize(size * channels, 0.0f);
    }
    
    void clear() {
        std::fill(samples.begin(), samples.end(), 0.0f);
    }
    
    float& getSample(int frame, int channel = 0) {
        int index = frame * channels + channel;
        if (index >= 0 && index < static_cast<int>(samples.size())) {
            return samples[index];
        }
        static float dummy = 0.0f;
        return dummy;
    }
    
    int getFrameCount() const {
        return samples.size() / channels;
    }
};

// Enhanced C++ DAW Engine with Reaper-style features
class EnhancedCPPDAWEngine {
private:
    // Core components
    std::unique_ptr<AdvancedTrackManager> trackManager;
    std::unique_ptr<RecordingEngine> recordingEngine;
    AudioBuffer masterBuffer;
    
    // Engine state
    float masterVolume;
    int sampleRate;
    int bufferSize;
    bool isPlaying;
    bool isRecording;
    double currentTime;
    float tempo;
    bool isInitialized;
    
    // Playback state
    std::chrono::high_resolution_clock::time_point playStartTime;
    double playStartPosition;
    
public:
    EnhancedCPPDAWEngine() : masterVolume(0.75f), sampleRate(44100), bufferSize(512), 
                            isPlaying(false), isRecording(false), currentTime(0.0f), 
                            tempo(120.0f), isInitialized(false), masterBuffer(512, 44100, 2) {}
    
    ~EnhancedCPPDAWEngine() = default;
    
    void initialize() {
        trackManager = std::make_unique<AdvancedTrackManager>();
        recordingEngine = std::make_unique<RecordingEngine>();
        isInitialized = true;
        std::cout << "Enhanced DAW Engine initialized with Reaper-style features" << std::endl;
    }
    
    void processAudio() {
        if (!isInitialized || !trackManager) return;
        
        // Update current time if playing
        if (isPlaying) {
            auto now = std::chrono::high_resolution_clock::now();
            auto elapsed = std::chrono::duration<double>(now - playStartTime).count();
            currentTime = playStartPosition + elapsed;
            trackManager->setCurrentTime(currentTime);
        }
        
        masterBuffer.clear();
        
        // Process all tracks (simplified for WASM)
        // In a full implementation, this would process actual audio clips
        for (int i = 0; i < masterBuffer.getFrameCount(); ++i) {
            for (int ch = 0; ch < masterBuffer.channels; ++ch) {
                // Placeholder: actual clip processing would go here
                masterBuffer.getSample(i, ch) *= masterVolume;
            }
        }
    }
    
    // Enhanced transport controls
    void play() { 
        if (!isInitialized) return;
        
        isPlaying = true;
        playStartTime = std::chrono::high_resolution_clock::now();
        playStartPosition = currentTime;
        trackManager->setPlaying(true);
        
        std::cout << "Playing from " << currentTime << " seconds" << std::endl;
    }
    
    void pause() { 
        isPlaying = false;
        if (trackManager) trackManager->setPlaying(false);
        std::cout << "Paused at " << currentTime << " seconds" << std::endl;
    }
    
    void stop() { 
        isPlaying = false; 
        currentTime = 0.0f;
        if (trackManager) {
            trackManager->setCurrentTime(currentTime);
            trackManager->setPlaying(false);
        }
        std::cout << "Stopped" << std::endl;
    }
    
    void setCurrentTime(double time) {
        currentTime = time;
        if (trackManager) trackManager->setCurrentTime(time);
        
        if (isPlaying) {
            playStartTime = std::chrono::high_resolution_clock::now();
            playStartPosition = currentTime;
        }
    }
    
    // Enhanced track management
    int addAdvancedTrack(const std::string& name) {
        if (!trackManager) return -1;
        
        auto track = trackManager->addTrack(name);
        if (track) {
            int trackId = track->getState().id;
            recordingEngine->addTrackRecorder(trackId);
            std::cout << "Added advanced track: " << name << " (ID: " << trackId << ")" << std::endl;
            return trackId;
        }
        return -1;
    }
    
    void removeTrack(int trackId) {
        if (trackManager) {
            trackManager->removeTrack(trackId);
            std::cout << "Removed track ID: " << trackId << std::endl;
        }
    }
    
    void selectTrack(int trackId) {
        if (trackManager) {
            trackManager->selectTrack(trackId);
            std::cout << "Selected track ID: " << trackId << std::endl;
        }
    }
    
    // Enhanced track properties
    void setAdvancedTrackVolume(int trackId, float volume) {
        if (auto track = trackManager->getTrack(trackId)) {
            track->getState().volume = std::clamp(volume, 0.0f, 2.0f);
        }
    }
    
    void setAdvancedTrackPan(int trackId, float pan) {
        if (auto track = trackManager->getTrack(trackId)) {
            track->getState().pan = std::clamp(pan, -1.0f, 1.0f);
        }
    }
    
    void muteAdvancedTrack(int trackId) {
        if (auto track = trackManager->getTrack(trackId)) {
            track->getState().isMuted = !track->getState().isMuted;
            std::cout << "Track " << trackId << " " << (track->getState().isMuted ? "muted" : "unmuted") << std::endl;
        }
    }
    
    void soloAdvancedTrack(int trackId) {
        if (trackManager) {
            trackManager->soloTrack(trackId);
            std::cout << "Soloed track ID: " << trackId << std::endl;
        }
    }
    
    // Timeline and zoom controls
    void zoomIn(double factor) {
        if (trackManager && trackManager->getTimeline()) {
            trackManager->getTimeline()->zoomIn(factor, currentTime);
            std::cout << "Zoomed in by factor " << factor << std::endl;
        }
    }
    
    void zoomOut(double factor) {
        if (trackManager && trackManager->getTimeline()) {
            trackManager->getTimeline()->zoomOut(factor, currentTime);
            std::cout << "Zoomed out by factor " << factor << std::endl;
        }
    }
    
    void zoomToFit(double startTime, double endTime) {
        if (trackManager && trackManager->getTimeline()) {
            trackManager->getTimeline()->zoomToFit(startTime, endTime);
            std::cout << "Zoomed to fit " << startTime << " - " << endTime << " seconds" << std::endl;
        }
    }
    
    void scrollTimeline(double deltaTime) {
        if (trackManager && trackManager->getTimeline()) {
            trackManager->getTimeline()->scroll(deltaTime);
        }
    }
    
    void scrollToTime(double time) {
        if (trackManager && trackManager->getTimeline()) {
            trackManager->getTimeline()->scrollToTime(time);
        }
    }
    
    // Audio clip management
    int addClipToTrack(int trackId, const std::string& clipName, double startTime, double duration) {
        if (auto track = trackManager->getTrack(trackId)) {
            auto clip = track->addClip(clipName, TimePosition(startTime), TimePosition(duration));
            if (clip) {
                std::cout << "Added clip '" << clipName << "' to track " << trackId << 
                            " at " << startTime << "s, duration " << duration << "s" << std::endl;
                return clip->getClipId();
            }
        }
        return -1;
    }
    
    void moveClip(int trackId, int clipId, double newStartTime) {
        if (auto track = trackManager->getTrack(trackId)) {
            auto& clips = track->getClips();
            for (auto& clip : clips) {
                if (clip->getClipId() == clipId) {
                    clip->move(TimePosition(newStartTime));
                    std::cout << "Moved clip " << clipId << " to " << newStartTime << "s" << std::endl;
                    break;
                }
            }
        }
    }
    
    void resizeClip(int trackId, int clipId, double newDuration) {
        if (auto track = trackManager->getTrack(trackId)) {
            auto& clips = track->getClips();
            for (auto& clip : clips) {
                if (clip->getClipId() == clipId) {
                    clip->resize(TimePosition(newDuration));
                    std::cout << "Resized clip " << clipId << " to " << newDuration << "s" << std::endl;
                    break;
                }
            }
        }
    }
    
    int splitClip(int trackId, int clipId, double splitTime) {
        if (auto track = trackManager->getTrack(trackId)) {
            auto& clips = track->getClips();
            for (auto& clip : clips) {
                if (clip->getClipId() == clipId) {
                    auto newClip = clip->split(TimePosition(splitTime));
                    // In a full implementation, add the new clip to the track
                    std::cout << "Split clip " << clipId << " at " << splitTime << "s" << std::endl;
                    return newClip.getClipId();
                }
            }
        }
        return -1;
    }
    
    // Recording controls
    void armTrack(int trackId, bool armed) {
        if (recordingEngine) {
            recordingEngine->armTrack(trackId, armed);
            std::cout << "Track " << trackId << " " << (armed ? "armed" : "disarmed") << " for recording" << std::endl;
        }
    }
    
    bool startRecording() {
        if (recordingEngine && !recordingEngine->getIsGlobalRecording()) {
            bool started = recordingEngine->startGlobalRecording(currentTime);
            if (started) {
                isRecording = true;
                std::cout << "Started recording at " << currentTime << "s" << std::endl;
            }
            return started;
        }
        return false;
    }
    
    void stopRecording() {
        if (recordingEngine && recordingEngine->getIsGlobalRecording()) {
            recordingEngine->stopGlobalRecording();
            isRecording = false;
            std::cout << "Stopped recording" << std::endl;
        }
    }
    
    // Timeline view queries
    double getTimelineZoom() const {
        if (trackManager && trackManager->getTimeline()) {
            return trackManager->getTimeline()->getZoomLevel();
        }
        return 1.0;
    }
    
    double getTimelineStart() const {
        if (trackManager && trackManager->getTimeline()) {
            return trackManager->getTimeline()->getStartTime();
        }
        return 0.0;
    }
    
    double getTimelineVisibleDuration() const {
        if (trackManager && trackManager->getTimeline()) {
            return trackManager->getTimeline()->getVisibleDuration();
        }
        return 10.0;
    }
    
    double getProjectDuration() const {
        if (trackManager) {
            return trackManager->getProjectDuration();
        }
        return 0.0;
    }
    
    // Legacy compatibility methods
    void setTempo(float bpm) { 
        tempo = std::clamp(bpm, 60.0f, 200.0f); 
        std::cout << "Tempo set to " << tempo << " BPM" << std::endl;
    }
    
    void setMasterVolume(float volume) { 
        masterVolume = std::clamp(volume, 0.0f, 1.0f); 
        std::cout << "Master volume set to " << masterVolume << std::endl;
    }
    
    // Getters
    double getCurrentTime() const { return currentTime; }
    float getTempo() const { return tempo; }
    bool getIsPlaying() const { return isPlaying; }
    bool getIsRecording() const { return isRecording; }
    int getTrackCount() const { return trackManager ? trackManager->getTrackCount() : 0; }
    bool getIsInitialized() const { return isInitialized; }
};

// Global enhanced DAW instance
static EnhancedCPPDAWEngine* enhancedDawEngine = nullptr;

// C++ functions exposed to JavaScript
extern "C" {
    // Engine management
    EMSCRIPTEN_KEEPALIVE
    void initializeEnhancedDAW() {
        try {
            std::cout << "Initializing Enhanced DAW Engine with Reaper-style features..." << std::endl;
            if (!enhancedDawEngine) {
                enhancedDawEngine = new EnhancedCPPDAWEngine();
            }
            enhancedDawEngine->initialize();
            std::cout << "Enhanced DAW Engine initialization complete" << std::endl;
        } catch (const std::exception& e) {
            std::cerr << "Error initializing Enhanced DAW: " << e.what() << std::endl;
        } catch (...) {
            std::cerr << "Unknown error initializing Enhanced DAW" << std::endl;
        }
    }
    
    EMSCRIPTEN_KEEPALIVE
    void shutdownEnhancedDAW() {
        if (enhancedDawEngine) {
            delete enhancedDawEngine;
            enhancedDawEngine = nullptr;
            std::cout << "Enhanced DAW Engine shutdown" << std::endl;
        }
    }
    
    // Transport controls
    EMSCRIPTEN_KEEPALIVE
    void enhancedPlay() {
        if (enhancedDawEngine) enhancedDawEngine->play();
    }
    
    EMSCRIPTEN_KEEPALIVE
    void enhancedPause() {
        if (enhancedDawEngine) enhancedDawEngine->pause();
    }
    
    EMSCRIPTEN_KEEPALIVE
    void enhancedStop() {
        if (enhancedDawEngine) enhancedDawEngine->stop();
    }
    
    EMSCRIPTEN_KEEPALIVE
    void enhancedSetCurrentTime(double time) {
        if (enhancedDawEngine) enhancedDawEngine->setCurrentTime(time);
    }
    
    // Track management
    EMSCRIPTEN_KEEPALIVE
    int addEnhancedTrack(const char* name) {
        if (enhancedDawEngine) {
            return enhancedDawEngine->addAdvancedTrack(name ? name : "New Track");
        }
        return -1;
    }
    
    EMSCRIPTEN_KEEPALIVE
    void removeEnhancedTrack(int trackId) {
        if (enhancedDawEngine) enhancedDawEngine->removeTrack(trackId);
    }
    
    EMSCRIPTEN_KEEPALIVE
    void selectEnhancedTrack(int trackId) {
        if (enhancedDawEngine) enhancedDawEngine->selectTrack(trackId);
    }
    
    EMSCRIPTEN_KEEPALIVE
    void setEnhancedTrackVolume(int trackId, float volume) {
        if (enhancedDawEngine) enhancedDawEngine->setAdvancedTrackVolume(trackId, volume);
    }
    
    EMSCRIPTEN_KEEPALIVE
    void setEnhancedTrackPan(int trackId, float pan) {
        if (enhancedDawEngine) enhancedDawEngine->setAdvancedTrackPan(trackId, pan);
    }
    
    EMSCRIPTEN_KEEPALIVE
    void muteEnhancedTrack(int trackId) {
        if (enhancedDawEngine) enhancedDawEngine->muteAdvancedTrack(trackId);
    }
    
    EMSCRIPTEN_KEEPALIVE
    void soloEnhancedTrack(int trackId) {
        if (enhancedDawEngine) enhancedDawEngine->soloAdvancedTrack(trackId);
    }
    
    // Timeline and zoom controls
    EMSCRIPTEN_KEEPALIVE
    void zoomTimelineIn(double factor) {
        if (enhancedDawEngine) enhancedDawEngine->zoomIn(factor);
    }
    
    EMSCRIPTEN_KEEPALIVE
    void zoomTimelineOut(double factor) {
        if (enhancedDawEngine) enhancedDawEngine->zoomOut(factor);
    }
    
    EMSCRIPTEN_KEEPALIVE
    void zoomTimelineToFit(double startTime, double endTime) {
        if (enhancedDawEngine) enhancedDawEngine->zoomToFit(startTime, endTime);
    }
    
    EMSCRIPTEN_KEEPALIVE
    void scrollTimeline(double deltaTime) {
        if (enhancedDawEngine) enhancedDawEngine->scrollTimeline(deltaTime);
    }
    
    EMSCRIPTEN_KEEPALIVE
    void scrollToTime(double time) {
        if (enhancedDawEngine) enhancedDawEngine->scrollToTime(time);
    }
    
    // Clip management
    EMSCRIPTEN_KEEPALIVE
    int addClipToTrack(int trackId, const char* clipName, double startTime, double duration) {
        if (enhancedDawEngine) {
            return enhancedDawEngine->addClipToTrack(trackId, clipName ? clipName : "Clip", startTime, duration);
        }
        return -1;
    }
    
    EMSCRIPTEN_KEEPALIVE
    void moveClip(int trackId, int clipId, double newStartTime) {
        if (enhancedDawEngine) enhancedDawEngine->moveClip(trackId, clipId, newStartTime);
    }
    
    EMSCRIPTEN_KEEPALIVE
    void resizeClip(int trackId, int clipId, double newDuration) {
        if (enhancedDawEngine) enhancedDawEngine->resizeClip(trackId, clipId, newDuration);
    }
    
    EMSCRIPTEN_KEEPALIVE
    int splitClip(int trackId, int clipId, double splitTime) {
        if (enhancedDawEngine) {
            return enhancedDawEngine->splitClip(trackId, clipId, splitTime);
        }
        return -1;
    }
    
    // Recording controls
    EMSCRIPTEN_KEEPALIVE
    void armTrackForRecording(int trackId, bool armed) {
        if (enhancedDawEngine) enhancedDawEngine->armTrack(trackId, armed);
    }
    
    EMSCRIPTEN_KEEPALIVE
    bool startGlobalRecording() {
        if (enhancedDawEngine) {
            return enhancedDawEngine->startRecording();
        }
        return false;
    }
    
    EMSCRIPTEN_KEEPALIVE
    void stopGlobalRecording() {
        if (enhancedDawEngine) enhancedDawEngine->stopRecording();
    }
    
    // Timeline queries
    EMSCRIPTEN_KEEPALIVE
    double getTimelineZoom() {
        return enhancedDawEngine ? enhancedDawEngine->getTimelineZoom() : 1.0;
    }
    
    EMSCRIPTEN_KEEPALIVE
    double getTimelineStart() {
        return enhancedDawEngine ? enhancedDawEngine->getTimelineStart() : 0.0;
    }
    
    EMSCRIPTEN_KEEPALIVE
    double getTimelineVisibleDuration() {
        return enhancedDawEngine ? enhancedDawEngine->getTimelineVisibleDuration() : 10.0;
    }
    
    EMSCRIPTEN_KEEPALIVE
    double getProjectDuration() {
        return enhancedDawEngine ? enhancedDawEngine->getProjectDuration() : 0.0;
    }
    
    // Legacy compatibility
    EMSCRIPTEN_KEEPALIVE
    void enhancedSetTempo(float bpm) {
        if (enhancedDawEngine) enhancedDawEngine->setTempo(bpm);
    }
    
    EMSCRIPTEN_KEEPALIVE
    void enhancedSetMasterVolume(float volume) {
        if (enhancedDawEngine) enhancedDawEngine->setMasterVolume(volume);
    }
    
    // Getters
    EMSCRIPTEN_KEEPALIVE
    double enhancedGetCurrentTime() {
        return enhancedDawEngine ? enhancedDawEngine->getCurrentTime() : 0.0;
    }
    
    EMSCRIPTEN_KEEPALIVE
    float enhancedGetTempo() {
        return enhancedDawEngine ? enhancedDawEngine->getTempo() : 120.0f;
    }
    
    EMSCRIPTEN_KEEPALIVE
    bool enhancedGetIsPlaying() {
        return enhancedDawEngine ? enhancedDawEngine->getIsPlaying() : false;
    }
    
    EMSCRIPTEN_KEEPALIVE
    bool enhancedGetIsRecording() {
        return enhancedDawEngine ? enhancedDawEngine->getIsRecording() : false;
    }
    
    EMSCRIPTEN_KEEPALIVE
    int enhancedGetTrackCount() {
        return enhancedDawEngine ? enhancedDawEngine->getTrackCount() : 0;
    }
    
    EMSCRIPTEN_KEEPALIVE
    bool enhancedGetIsInitialized() {
        return enhancedDawEngine ? enhancedDawEngine->getIsInitialized() : false;
    }
}

int main() {
    std::cout << "AudioVerse Enhanced C++ DAW Engine with Reaper-style features compiled successfully" << std::endl;
    return 0;
}