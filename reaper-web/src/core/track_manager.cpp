/*
 * REAPER Web - Track Manager Implementation
 * Based on REAPER's track management system
 */

#include "track_manager.hpp"
#include "audio_engine.hpp"
#include "../effects/effect_chain.hpp"
#include <algorithm>
#include <chrono>
#include <random>
#include <sstream>
#include <iomanip>

// TrackManager Implementation
TrackManager::TrackManager() {
    // Reserve capacity for tracks
    m_tracks.reserve(128);
}

TrackManager::~TrackManager() {
    Shutdown();
}

bool TrackManager::Initialize(AudioEngine* audioEngine) {
    m_audioEngine = audioEngine;
    
    // Create master track
    m_masterTrack = std::make_unique<Track>(this, "Master");
    m_masterTrack->SetFolder(false, 0);
    
    return true;
}

void TrackManager::Shutdown() {
    std::lock_guard<std::mutex> lock(m_tracksMutex);
    
    // Clear selection
    ClearSelection();
    
    // Clear solo state
    ClearAllSolo();
    
    // Stop recording
    StopRecording();
    
    // Clear all tracks
    m_tracks.clear();
    m_masterTrack.reset();
    
    m_audioEngine = nullptr;
}

Track* TrackManager::CreateTrack(const std::string& name, TrackType type) {
    std::lock_guard<std::mutex> lock(m_tracksMutex);
    
    // Generate unique name if empty
    std::string trackName = name;
    if (trackName.empty()) {
        trackName = "Track " + std::to_string(m_tracks.size() + 1);
    }
    
    // Create new track
    auto track = std::make_unique<Track>(this, trackName);
    Track* trackPtr = track.get();
    
    // Set track type properties
    switch (type) {
        case TrackType::FOLDER:
            track->SetFolder(true, 0);
            break;
        case TrackType::AUDIO:
        default:
            track->SetFolder(false, 0);
            break;
    }
    
    // Add to tracks list
    m_tracks.push_back(std::move(track));
    
    // Notify audio engine
    if (m_audioEngine) {
        m_audioEngine->AddTrack(trackPtr);
    }
    
    UpdateTrackNumbers();
    NotifyTrackAdded(trackPtr);
    
    return trackPtr;
}

Track* TrackManager::CreateFolderTrack(const std::string& name) {
    return CreateTrack(name.empty() ? "Folder" : name, TrackType::FOLDER);
}

bool TrackManager::DeleteTrack(int index) {
    std::lock_guard<std::mutex> lock(m_tracksMutex);
    
    if (index < 0 || index >= static_cast<int>(m_tracks.size())) {
        return false;
    }
    
    Track* track = m_tracks[index].get();
    
    // Remove from selection
    auto selIt = std::find(m_selectedTracks.begin(), m_selectedTracks.end(), track);
    if (selIt != m_selectedTracks.end()) {
        m_selectedTracks.erase(selIt);
    }
    
    // Remove from solo list
    auto soloIt = std::find(m_soloedTracks.begin(), m_soloedTracks.end(), track);
    if (soloIt != m_soloedTracks.end()) {
        m_soloedTracks.erase(soloIt);
        UpdateSoloState();
    }
    
    // Remove from armed tracks
    auto armedIt = std::find(m_armedTracks.begin(), m_armedTracks.end(), track);
    if (armedIt != m_armedTracks.end()) {
        m_armedTracks.erase(armedIt);
    }
    
    // Notify audio engine
    if (m_audioEngine) {
        m_audioEngine->RemoveTrack(track);
    }
    
    NotifyTrackRemoved(track);
    
    // Remove from tracks list
    m_tracks.erase(m_tracks.begin() + index);
    
    UpdateTrackNumbers();
    
    return true;
}

bool TrackManager::DeleteTrack(Track* track) {
    if (!track) return false;
    
    int index = GetTrackIndex(track);
    return index >= 0 ? DeleteTrack(index) : false;
}

Track* TrackManager::GetTrack(int index) const {
    std::lock_guard<std::mutex> lock(m_tracksMutex);
    
    if (index < 0 || index >= static_cast<int>(m_tracks.size())) {
        return nullptr;
    }
    
    return m_tracks[index].get();
}

int TrackManager::GetTrackIndex(Track* track) const {
    if (!track) return -1;
    
    std::lock_guard<std::mutex> lock(m_tracksMutex);
    
    for (size_t i = 0; i < m_tracks.size(); ++i) {
        if (m_tracks[i].get() == track) {
            return static_cast<int>(i);
        }
    }
    
    return -1;
}

bool TrackManager::MoveTrack(int fromIndex, int toIndex) {
    std::lock_guard<std::mutex> lock(m_tracksMutex);
    
    if (fromIndex < 0 || fromIndex >= static_cast<int>(m_tracks.size()) ||
        toIndex < 0 || toIndex >= static_cast<int>(m_tracks.size()) ||
        fromIndex == toIndex) {
        return false;
    }
    
    // Move track in vector
    auto track = std::move(m_tracks[fromIndex]);
    m_tracks.erase(m_tracks.begin() + fromIndex);
    
    // Adjust toIndex if necessary
    if (toIndex > fromIndex) {
        toIndex--;
    }
    
    m_tracks.insert(m_tracks.begin() + toIndex, std::move(track));
    
    UpdateTrackNumbers();
    UpdateFolderStructure();
    
    return true;
}

bool TrackManager::MoveTrack(Track* track, int newIndex) {
    int currentIndex = GetTrackIndex(track);
    return currentIndex >= 0 ? MoveTrack(currentIndex, newIndex) : false;
}

void TrackManager::ClearAllTracks() {
    std::lock_guard<std::mutex> lock(m_tracksMutex);
    
    // Clear selection and solo
    ClearSelection();
    ClearAllSolo();
    
    // Notify audio engine
    if (m_audioEngine) {
        for (auto& track : m_tracks) {
            m_audioEngine->RemoveTrack(track.get());
        }
    }
    
    // Clear tracks
    m_tracks.clear();
    m_armedTracks.clear();
}

void TrackManager::SelectTrack(Track* track, bool addToSelection) {
    if (!track) return;
    
    std::lock_guard<std::mutex> lock(m_selectionMutex);
    
    if (!addToSelection) {
        m_selectedTracks.clear();
    }
    
    // Add to selection if not already selected
    if (std::find(m_selectedTracks.begin(), m_selectedTracks.end(), track) == m_selectedTracks.end()) {
        m_selectedTracks.push_back(track);
    }
}

void TrackManager::SelectTrack(int index, bool addToSelection) {
    Track* track = GetTrack(index);
    if (track) {
        SelectTrack(track, addToSelection);
    }
}

void TrackManager::ClearSelection() {
    std::lock_guard<std::mutex> lock(m_selectionMutex);
    m_selectedTracks.clear();
}

std::vector<Track*> TrackManager::GetSelectedTracks() const {
    std::lock_guard<std::mutex> lock(m_selectionMutex);
    return m_selectedTracks;
}

bool TrackManager::IsTrackSelected(Track* track) const {
    std::lock_guard<std::mutex> lock(m_selectionMutex);
    return std::find(m_selectedTracks.begin(), m_selectedTracks.end(), track) != m_selectedTracks.end();
}

void TrackManager::SetTrackSolo(Track* track, bool solo) {
    if (!track) return;
    
    std::lock_guard<std::mutex> lock(m_soloMutex);
    
    track->SetSolo(solo);
    
    auto it = std::find(m_soloedTracks.begin(), m_soloedTracks.end(), track);
    
    if (solo) {
        if (it == m_soloedTracks.end()) {
            m_soloedTracks.push_back(track);
        }
    } else {
        if (it != m_soloedTracks.end()) {
            m_soloedTracks.erase(it);
        }
    }
    
    UpdateSoloState();
}

void TrackManager::ClearAllSolo() {
    std::lock_guard<std::mutex> lock(m_soloMutex);
    
    for (Track* track : m_soloedTracks) {
        track->SetSolo(false);
    }
    
    m_soloedTracks.clear();
    UpdateSoloState();
}

void TrackManager::ProcessAllTracks(AudioBuffer& masterBuffer) {
    // This would be called by the audio engine during processing
    // Implementation depends on the specific audio routing architecture
}

void TrackManager::StartRecording() {
    m_isRecording = true;
    
    // Get list of armed tracks
    std::lock_guard<std::mutex> lock(m_tracksMutex);
    m_armedTracks.clear();
    
    for (auto& track : m_tracks) {
        if (track->IsRecordArmed()) {
            m_armedTracks.push_back(track.get());
        }
    }
}

void TrackManager::StopRecording() {
    m_isRecording = false;
}

std::vector<Track*> TrackManager::GetArmedTracks() const {
    std::lock_guard<std::mutex> lock(m_tracksMutex);
    return m_armedTracks;
}

void TrackManager::UpdateSoloState() {
    m_hasSoloedTracks = !m_soloedTracks.empty();
}

void TrackManager::UpdateTrackNumbers() {
    // Update track numbering - could be used for display
    for (size_t i = 0; i < m_tracks.size(); ++i) {
        // Track numbers start from 1 in REAPER
        // Could add track number property if needed
    }
}

void TrackManager::NotifyTrackAdded(Track* track) {
    // Placeholder for track added notifications
}

void TrackManager::NotifyTrackRemoved(Track* track) {
    // Placeholder for track removed notifications
}

void TrackManager::UpdateFolderStructure() {
    // Update folder depth and structure
    // This would handle the folder hierarchy logic
}

// Track Implementation
Track::Track(TrackManager* manager, const std::string& name) 
    : m_manager(manager) {
    m_state.name = name;
    m_state.guid = GenerateGUID();
    
    // Initialize with default settings
    m_state.volume = 1.0;
    m_state.pan = 0.0;
    m_state.mute = false;
    m_state.solo = false;
    m_state.recordArm = false;
    m_state.inputMonitor = false;
    m_state.freeze = false;
    m_state.phase = false;
    m_state.inputChannel = 0;
    m_state.outputChannel = 0;
    m_state.color = "#808080";
    m_state.isFolder = false;
    m_state.folderDepth = 0;
    m_state.folderOpen = true;
    
    // Create effects processor
    m_effectProcessor = std::make_unique<TrackEffectProcessor>();
}

Track::~Track() {
    // Cleanup
}

void Track::SetName(const std::string& name) {
    m_state.name = name;
}

void Track::SetVolume(double volume) {
    m_state.volume = std::clamp(volume, 0.0, 4.0); // 0 to +12dB
}

void Track::SetPan(double pan) {
    m_state.pan = std::clamp(pan, -1.0, 1.0);
}

void Track::SetMute(bool mute) {
    m_state.mute = mute;
}

void Track::SetSolo(bool solo) {
    m_state.solo = solo;
    
    // Notify track manager
    if (m_manager) {
        m_manager->SetTrackSolo(this, solo);
    }
}

void Track::SetRecordArm(bool armed) {
    m_state.recordArm = armed;
}

void Track::SetInputMonitor(bool monitor) {
    m_state.inputMonitor = monitor;
}

void Track::SetInputChannel(int channel) {
    m_state.inputChannel = channel;
}

void Track::SetOutputChannel(int channel) {
    m_state.outputChannel = channel;
}

void Track::SetColor(const std::string& color) {
    m_state.color = color;
}

void Track::SetFolder(bool isFolder, int depth) {
    m_state.isFolder = isFolder;
    m_state.folderDepth = depth;
}

void Track::SetFolderOpen(bool open) {
    m_state.folderOpen = open;
}

void Track::ProcessAudio(AudioBuffer& inputBuffer, AudioBuffer& outputBuffer) {
    // Copy input to output
    outputBuffer.CopyFrom(inputBuffer);
    
    // Apply volume and pan
    ApplyVolumeAndPan(outputBuffer);
    
    // Process effects chain
    ProcessEffects(outputBuffer);
    
    // Apply mute
    if (m_state.mute) {
        outputBuffer.Clear();
    }
}

void Track::SetState(const TrackState& state) {
    m_state = state;
}

void Track::SetFreeze(bool freeze) {
    m_state.freeze = freeze;
}

EffectChain* Track::GetEffectsChain() const {
    if (m_effectProcessor) {
        return m_effectProcessor->GetEffectChain();
    }
    return nullptr;
}

std::string Track::GenerateGUID() const {
    // Generate a REAPER-style GUID
    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_int_distribution<> dis(0, 15);
    std::uniform_int_distribution<> dis2(8, 11);
    
    std::stringstream ss;
    ss << std::hex;
    
    for (int i = 0; i < 8; i++) {
        ss << dis(gen);
    }
    ss << "-";
    for (int i = 0; i < 4; i++) {
        ss << dis(gen);
    }
    ss << "-4";
    for (int i = 0; i < 3; i++) {
        ss << dis(gen);
    }
    ss << "-";
    ss << dis2(gen);
    for (int i = 0; i < 3; i++) {
        ss << dis(gen);
    }
    ss << "-";
    for (int i = 0; i < 12; i++) {
        ss << dis(gen);
    }
    
    return ss.str();
}

void Track::ApplyVolumeAndPan(AudioBuffer& buffer) {
    if (!buffer.isValid) return;
    
    // Apply volume
    float volume = static_cast<float>(m_state.volume);
    if (volume != 1.0f) {
        for (int ch = 0; ch < buffer.numChannels; ++ch) {
            for (int i = 0; i < buffer.numSamples; ++i) {
                buffer.channels[ch][i] *= volume;
            }
        }
    }
    
    // Apply pan (for stereo tracks)
    if (buffer.numChannels >= 2 && m_state.pan != 0.0) {
        float pan = static_cast<float>(m_state.pan);
        float leftGain = std::sqrt((1.0f - pan) * 0.5f);
        float rightGain = std::sqrt((1.0f + pan) * 0.5f);
        
        for (int i = 0; i < buffer.numSamples; ++i) {
            buffer.channels[0][i] *= leftGain;
            buffer.channels[1][i] *= rightGain;
        }
    }
}

void Track::ProcessEffects(AudioBuffer& buffer) {
    // Process through effects processor
    if (m_effectProcessor) {
        // Get current time position from manager or audio engine
        double timePosition = 0.0; // TODO: Get actual time position
        m_effectProcessor->ProcessTrackAudio(buffer, timePosition);
    }
}