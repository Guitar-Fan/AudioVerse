#include "DAWEngine.hpp"
#include <algorithm>
#include <chrono>
#include <iostream>
#include <alsa/asoundlib.h>

namespace DAW {

DAWEngine::DAWEngine() 
    : initialized_(false), playState_(PlayState::Stopped), position_(0.0),
      sampleRate_(44100), bufferSize_(512), bpm_(120.0), 
      timeSigNum_(4), timeSigDen_(4), selectedTrackIndex_(0) {
    
    settings_.outputDevice = "default";
    settings_.inputDevice = "default";
    settings_.sampleRate = 44100;
    settings_.bufferSize = 512;
    
    // Initialize output buffer
    outputBuffer_ = std::make_unique<AudioBuffer>();
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
    
    // Initialize ALSA - simplified version
    std::cout << "🎵 DAW Engine Initialized" << std::endl;
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
    initialized_ = false;
    
    std::cout << "🎵 DAW Engine Shutdown" << std::endl;
}

void DAWEngine::Play() {
    if (!initialized_) {
        std::cerr << "⚠️ DAW Engine not initialized!" << std::endl;
        return;
    }
    
    if (playState_ == PlayState::Playing) {
        return;
    }
    
    playState_ = PlayState::Playing;
    std::cout << "▶️ Playing" << std::endl;
}

void DAWEngine::Pause() {
    if (playState_ == PlayState::Playing) {
        playState_ = PlayState::Paused;
        std::cout << "⏸️ Paused" << std::endl;
    }
}

void DAWEngine::Stop() {
    if (playState_ != PlayState::Stopped) {
        playState_ = PlayState::Stopped;
        position_ = 0.0;
        std::cout << "⏹️ Stopped" << std::endl;
    }
}

void DAWEngine::Record() {
    if (!initialized_) {
        return;
    }
    
    playState_ = PlayState::Recording;
    std::cout << "🔴 Recording" << std::endl;
}

void DAWEngine::SetPosition(double seconds) {
    position_ = std::max(0.0, seconds);
}

double DAWEngine::GetPosition() const {
    return position_;
}

std::shared_ptr<Track> DAWEngine::CreateTrack(const std::string& name) {
    std::string trackName = name.empty() ? "Track " + std::to_string(tracks_.size() + 1) : name;
    
    auto track = std::make_shared<Track>(trackName, sampleRate_, bufferSize_);
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
    if (playState_ != PlayState::Playing && playState_ != PlayState::Recording) {
        return;
    }
    
    // Process all tracks
    for (auto& track : tracks_) {
        if (track) {
            track->Process(bufferSize_);
        }
    }
    
    // Update position based on sample rate
    double deltaTime = static_cast<double>(bufferSize_) / sampleRate_;
    position_ += deltaTime;
}

} // namespace DAW
