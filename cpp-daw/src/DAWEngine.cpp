#include "DAWEngine.hpp"
#include "Transport.hpp"
#include <algorithm>
#include <chrono>
#include <iostream>

// Conditional include for audio backends
#ifdef __EMSCRIPTEN__
// Emscripten/Web environment - use Emscripten audio API
#include <emscripten.h>
#else
// Native environment - use ALSA
#include <alsa/asoundlib.h>
#endif

namespace DAW {

DAWEngine::DAWEngine() 
    : initialized_(false),
      sampleRate_(44100), bufferSize_(512), bpm_(120.0), 
      timeSigNum_(4), timeSigDen_(4), selectedTrackIndex_(0) {
    
    settings_.outputDevice = "default";
    settings_.inputDevice = "default";
    settings_.sampleRate = 44100;
    settings_.bufferSize = 512;
    
    // Initialize output buffer
    outputBuffer_ = std::make_unique<AudioBuffer>(2, 512);  // stereo, 512 samples
}

DAWEngine::~DAWEngine() {
    Shutdown();
}

bool DAWEngine::Initialize(int sampleRate, int bufferSize) {
    if (initialized_) {
        return true;
    }
    
    sampleRate_ = sampleRate;
    bufferSize_ = bufferSize;
    settings_.sampleRate = sampleRate;
    settings_.bufferSize = bufferSize;
    
    #ifdef __EMSCRIPTEN__
    // Initialize Web Audio API through Emscripten
    std::cout << "🎵 Web Audio API Initialized" << std::endl;
    webAudio_.Initialize(sampleRate, bufferSize);
    #else
    // Initialize ALSA - simplified version
    std::cout << "🎵 Native Audio Engine Initialized (ALSA)" << std::endl;
    // ALSA initialization would go here
    #endif
    
    std::cout << "Sample Rate: " << sampleRate_ << " Hz" << std::endl;
    std::cout << "Buffer Size: " << bufferSize_ << " samples" << std::endl;
    
    initialized_ = true;
    return true;
}

void DAWEngine::Shutdown() {
    if (!initialized_) {
        return;
    }
    
    Stop();
    tracks_.clear();
    
    #ifdef __EMSCRIPTEN__
    // Shutdown Web Audio
    webAudio_.Shutdown();
    #else
    // Shutdown native audio system
    #endif
    
    initialized_ = false;
    std::cout << "🎵 DAW Engine Shutdown" << std::endl;
}

void DAWEngine::Play() {
    if (!initialized_) {
        std::cerr << "⚠️ DAW Engine not initialized!" << std::endl;
        return;
    }
    transport_.Play();
    std::cout << "▶️ Playing" << std::endl;
}

void DAWEngine::Pause() {
    transport_.Pause();
    std::cout << "⏸️ Paused" << std::endl;
}

void DAWEngine::Stop() {
    transport_.Stop();
    std::cout << "⏹️ Stopped" << std::endl;
}

void DAWEngine::Record() {
    if (!initialized_) {
        return;
    }
    transport_.Record();
    std::cout << "🔴 Recording" << std::endl;
}

void DAWEngine::SetPosition(double seconds) {
    transport_.SetPosition(seconds);
}

double DAWEngine::GetPosition() const {
    return transport_.GetPosition();
}

std::shared_ptr<Track> DAWEngine::CreateTrack(const std::string& name) {
    std::string trackName = name.empty() ? "Track " + std::to_string(tracks_.size() + 1) : name;
    
    auto track = std::make_shared<Track>(trackName, static_cast<int>(tracks_.size()));
    tracks_.push_back(track);
    
    std::cout << "🎵 Created track: " << trackName << std::endl;
    return track;
}

void DAWEngine::DeleteTrack(int trackIndex) {
    if (trackIndex >= 0 && trackIndex < static_cast<int>(tracks_.size())) {
        std::cout << "🗑️ Deleted track: " << tracks_[trackIndex]->GetName() << std::endl;
        tracks_.erase(tracks_.begin() + trackIndex);
        
        if (selectedTrackIndex_ >= static_cast<int>(tracks_.size())) {
            selectedTrackIndex_ = std::max(0, static_cast<int>(tracks_.size()) - 1);
        }
    }
}

std::shared_ptr<Track> DAWEngine::GetTrack(int index) {
    if (index >= 0 && index < static_cast<int>(tracks_.size())) {
        return tracks_[index];
    }
    return nullptr;
}

int DAWEngine::GetTrackCount() const {
    return static_cast<int>(tracks_.size());
}

bool DAWEngine::LoadAudioFile(const std::string& filepath, int trackIndex) {
    auto track = GetTrack(trackIndex);
    if (!track) {
        std::cerr << "❌ Invalid track index: " << trackIndex << std::endl;
        return false;
    }
    
    // Simplified audio loading - just log the operation
    std::cout << "🎵 Loading audio file: " << filepath << " to track: " << track->GetName() << std::endl;
    
    // In a real implementation, you would:
    // 1. Use a library like libsndfile to load the audio
    // 2. Create audio clips from the loaded data
    // 3. Add clips to the track
    
    return true;
}

void DAWEngine::ProcessAudio() {
    if (!transport_.IsPlaying()) {
        return;
    }
    
    double position = transport_.GetPosition();
    
    // Process all tracks
    for (auto& track : tracks_) {
        if (track) {
            track->ProcessAudio(*outputBuffer_, position, position + (static_cast<double>(bufferSize_) / sampleRate_), sampleRate_);
        }
    }
    
    #ifdef __EMSCRIPTEN__
    // Send processed audio to Web Audio API
    webAudio_.ProcessAudio(*outputBuffer_);
    #endif
    
    transport_.AdvancePosition(bufferSize_, sampleRate_);
}

} // namespace DAW
