/*
 * REAPER Web Engine - Core Implementation
 * Based on REAPER's architecture and JSFX analysis
 */

#include "reaper_engine.hpp"
#include "audio_engine.hpp"
#include "project_manager.hpp"
#include "track_manager.hpp"
#include "../media/media_item.hpp"
#include <algorithm>
#include <chrono>
#include <cmath>
#include <sstream>
#include <iomanip>

// Global engine instance
ReaperEngine* g_reaperEngine = nullptr;

ReaperEngine::ReaperEngine() {
    // Initialize subsystems in dependency order
    m_audioEngine = std::make_unique<AudioEngine>();
    m_projectManager = std::make_unique<ProjectManager>();
    m_trackManager = std::make_unique<TrackManager>();
    m_mediaItemManager = std::make_unique<MediaItemManager>();
    
    // Reserve undo stack capacity
    m_undoStack.reserve(m_globalSettings.undoLevels);
    m_redoStack.reserve(m_globalSettings.undoLevels);
}

ReaperEngine::~ReaperEngine() {
    Shutdown();
}

bool ReaperEngine::Initialize() {
    GlobalSettings defaultSettings;
    return Initialize(defaultSettings);
}

bool ReaperEngine::Initialize(const GlobalSettings& settings) {
    if (m_initialized.load()) {
        return true;
    }
    
    m_globalSettings = settings;
    
    // Initialize audio engine first - critical for real-time performance
    if (!m_audioEngine->Initialize(settings.sampleRate, settings.bufferSize, settings.maxChannels)) {
        return false;
    }
    
    // Initialize project manager
    if (!m_projectManager->Initialize()) {
        return false;
    }
    
    // Initialize track manager
    if (!m_trackManager->Initialize(m_audioEngine.get())) {
        return false;
    }
    
    // Set up transport state defaults
    m_transportState.playState = PlayState::STOPPED;
    m_transportState.playPosition = 0.0;
    m_transportState.tempo = 120.0;
    m_transportState.timeSigNumerator = 4;
    m_transportState.timeSigDenominator = 4;
    
    // Set up realtime settings
    m_realtimeSettings.masterVolume = 1.0;
    m_realtimeSettings.masterPan = 0.0;
    m_realtimeSettings.monitoring = true;
    
    // Set global instance
    g_reaperEngine = this;
    
    m_initialized = true;
    return true;
}

void ReaperEngine::Shutdown() {
    if (!m_initialized.load()) {
        return;
    }
    
    // Stop any playback/recording
    Stop();
    
    // Shutdown subsystems in reverse order
    if (m_trackManager) {
        m_trackManager->Shutdown();
    }
    
    if (m_projectManager) {
        m_projectManager->Shutdown();
    }
    
    if (m_audioEngine) {
        m_audioEngine->Shutdown();
    }
    
    // Clear global instance
    g_reaperEngine = nullptr;
    
    m_initialized = false;
}

bool ReaperEngine::NewProject() {
    if (!m_initialized.load()) {
        return false;
    }
    
    BeginUndoBlock("New Project");
    
    // Reset transport
    Stop();
    m_transportState.playPosition = 0.0;
    m_transportState.loopStart = 0.0;
    m_transportState.loopEnd = 60.0;
    
    // Clear tracks and reset project state
    m_trackManager->ClearAllTracks();
    m_projectManager->NewProject();
    
    // Reset master controls
    m_realtimeSettings.masterVolume = 1.0;
    m_realtimeSettings.masterPan = 0.0;
    m_realtimeSettings.masterMute = false;
    
    m_currentProjectPath.clear();
    m_projectDirty = false;
    
    EndUndoBlock();
    return true;
}

bool ReaperEngine::LoadProject(const std::string& filePath) {
    if (!m_initialized.load()) {
        return false;
    }
    
    if (!m_projectManager->LoadProject(filePath)) {
        return false;
    }
    
    m_currentProjectPath = filePath;
    m_projectDirty = false;
    
    // Clear undo history for new project
    ClearUndoHistory();
    
    return true;
}

bool ReaperEngine::SaveProject(const std::string& filePath) {
    if (!m_initialized.load()) {
        return false;
    }
    
    std::string savePath = filePath.empty() ? m_currentProjectPath : filePath;
    
    if (savePath.empty()) {
        return false; // Need a path for first save
    }
    
    if (m_projectManager->SaveProject(savePath)) {
        m_currentProjectPath = savePath;
        m_projectDirty = false;
        return true;
    }
    
    return false;
}

void ReaperEngine::Play() {
    if (m_transportState.playState == PlayState::PAUSED) {
        m_transportState.playState = PlayState::PLAYING;
    } else {
        m_transportState.playState = PlayState::PLAYING;
        // Start from current position
    }
    
    m_audioEngine->StartPlayback();
}

void ReaperEngine::Stop() {
    m_transportState.playState = PlayState::STOPPED;
    m_audioEngine->StopPlayback();
    
    // Reset to beginning if not looping or if we hit the end
    if (!m_transportState.loop) {
        // Option: return to start or stay at current position
        // REAPER behavior is configurable
    }
}

void ReaperEngine::Pause() {
    if (m_transportState.playState == PlayState::PLAYING) {
        m_transportState.playState = PlayState::PAUSED;
        m_audioEngine->PausePlayback();
    }
}

void ReaperEngine::Record() {
    m_transportState.playState = PlayState::RECORDING;
    m_audioEngine->StartRecording();
}

void ReaperEngine::TogglePlayPause() {
    switch (m_transportState.playState.load()) {
        case PlayState::STOPPED:
        case PlayState::PAUSED:
            Play();
            break;
        case PlayState::PLAYING:
        case PlayState::RECORDING:
            Pause();
            break;
    }
}

void ReaperEngine::SetPlayPosition(double seconds) {
    m_transportState.playPosition = std::max(0.0, seconds);
    m_audioEngine->SetPlayPosition(seconds);
}

void ReaperEngine::SetLoopPoints(double start, double end) {
    if (start < end) {
        m_transportState.loopStart = start;
        m_transportState.loopEnd = end;
    }
}

void ReaperEngine::SetTempo(double bpm) {
    if (bpm >= 20.0 && bpm <= 999.0) {
        m_transportState.tempo = bpm;
        SetProjectDirty();
    }
}

void ReaperEngine::SetTimeSignature(int numerator, int denominator) {
    if (numerator >= 1 && numerator <= 32 && 
        (denominator == 1 || denominator == 2 || denominator == 4 || 
         denominator == 8 || denominator == 16 || denominator == 32)) {
        m_transportState.timeSigNumerator = numerator;
        m_transportState.timeSigDenominator = denominator;
        SetProjectDirty();
    }
}

double ReaperEngine::BeatsToSeconds(double beats) const {
    double bpm = m_transportState.tempo.load();
    return beats * (60.0 / bpm);
}

double ReaperEngine::SecondsToBeats(double seconds) const {
    double bpm = m_transportState.tempo.load();
    return seconds * (bpm / 60.0);
}

std::string ReaperEngine::FormatTime(double seconds, TimeFormat format) const {
    std::stringstream ss;
    
    switch (format) {
        case TimeFormat::SECONDS:
            ss << std::fixed << std::setprecision(3) << seconds << "s";
            break;
            
        case TimeFormat::SAMPLES:
            ss << static_cast<int64_t>(seconds * m_globalSettings.sampleRate);
            break;
            
        case TimeFormat::MEASURES_BEATS: {
            double beats = SecondsToBeats(seconds);
            int measure = static_cast<int>(beats / m_transportState.timeSigNumerator) + 1;
            double beat = fmod(beats, m_transportState.timeSigNumerator) + 1.0;
            ss << measure << ":" << std::fixed << std::setprecision(3) << beat;
            break;
        }
        
        case TimeFormat::MINUTES_SECONDS: {
            int minutes = static_cast<int>(seconds / 60.0);
            double secs = fmod(seconds, 60.0);
            ss << minutes << ":" << std::fixed << std::setprecision(3) << std::setfill('0') << std::setw(6) << secs;
            break;
        }
        
        case TimeFormat::TIMECODE: {
            int hours = static_cast<int>(seconds / 3600.0);
            int minutes = static_cast<int>((seconds - hours * 3600.0) / 60.0);
            double secs = fmod(seconds, 60.0);
            ss << std::setfill('0') << std::setw(2) << hours << ":"
               << std::setw(2) << minutes << ":"
               << std::fixed << std::setprecision(3) << std::setw(6) << secs;
            break;
        }
    }
    
    return ss.str();
}

void ReaperEngine::SetMasterVolume(double volume) {
    m_realtimeSettings.masterVolume = std::clamp(volume, 0.0, 2.0); // 0 to +6dB
    SetProjectDirty();
}

void ReaperEngine::SetMasterPan(double pan) {
    m_realtimeSettings.masterPan = std::clamp(pan, -1.0, 1.0);
    SetProjectDirty();
}

void ReaperEngine::ToggleMasterMute() {
    m_realtimeSettings.masterMute = !m_realtimeSettings.masterMute.load();
}

void ReaperEngine::SetMetronome(bool enabled) {
    m_realtimeSettings.metronomeEnabled = enabled;
}

void ReaperEngine::ProcessAudioBlock(float** inputs, float** outputs, int numChannels, int numSamples) {
    if (!m_initialized.load() || !m_audioEngine) {
        // Output silence if not initialized
        for (int ch = 0; ch < numChannels; ++ch) {
            std::fill(outputs[ch], outputs[ch] + numSamples, 0.0f);
        }
        return;
    }
    
    // Update playback position
    if (m_transportState.playState == PlayState::PLAYING || 
        m_transportState.playState == PlayState::RECORDING) {
        double deltaTime = static_cast<double>(numSamples) / m_globalSettings.sampleRate;
        double newPosition = m_transportState.playPosition.load() + deltaTime;
        
        // Handle looping
        if (m_transportState.loop && newPosition >= m_transportState.loopEnd) {
            newPosition = m_transportState.loopStart;
        }
        
        m_transportState.playPosition = newPosition;
    }
    
    // Process audio through the engine with track and media item integration
    double blockLength = static_cast<double>(numSamples) / m_globalSettings.sampleRate;
    m_audioEngine->ProcessBlock(inputs, outputs, numChannels, numSamples, 
                               m_mediaItemManager.get(), m_trackManager.get(), 
                               m_transportState.playPosition.load(), blockLength);
    
    // Apply master volume and pan
    double masterVol = m_realtimeSettings.masterVolume.load();
    bool masterMute = m_realtimeSettings.masterMute.load();
    
    if (masterMute) {
        for (int ch = 0; ch < numChannels; ++ch) {
            std::fill(outputs[ch], outputs[ch] + numSamples, 0.0f);
        }
    } else if (masterVol != 1.0) {
        for (int ch = 0; ch < numChannels; ++ch) {
            for (int i = 0; i < numSamples; ++i) {
                outputs[ch][i] *= static_cast<float>(masterVol);
            }
        }
    }
}

void ReaperEngine::BeginUndoBlock(const std::string& description) {
    std::lock_guard<std::mutex> lock(m_undoMutex);
    m_currentUndoBlock++;
    SaveUndoState(description);
}

void ReaperEngine::EndUndoBlock() {
    // Undo block is implicitly ended
    m_currentUndoBlock = -1;
}

bool ReaperEngine::Undo() {
    std::lock_guard<std::mutex> lock(m_undoMutex);
    
    if (m_undoStack.empty()) {
        return false;
    }
    
    UndoState state = m_undoStack.back();
    m_undoStack.pop_back();
    
    // Save current state to redo stack
    UndoState currentState;
    currentState.description = "Redo " + state.description;
    currentState.timestamp = std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::steady_clock::now().time_since_epoch()).count();
    // TODO: Serialize current state
    m_redoStack.push_back(currentState);
    
    // Restore state
    RestoreUndoState(state);
    
    return true;
}

bool ReaperEngine::Redo() {
    std::lock_guard<std::mutex> lock(m_undoMutex);
    
    if (m_redoStack.empty()) {
        return false;
    }
    
    UndoState state = m_redoStack.back();
    m_redoStack.pop_back();
    
    // Save current state to undo stack
    SaveUndoState("Undo " + state.description);
    
    // Restore state
    RestoreUndoState(state);
    
    return true;
}

void ReaperEngine::ClearUndoHistory() {
    std::lock_guard<std::mutex> lock(m_undoMutex);
    m_undoStack.clear();
    m_redoStack.clear();
}

bool ReaperEngine::IsRealtimeThread() const {
    return std::this_thread::get_id() == m_realtimeThreadId;
}

void ReaperEngine::SaveUndoState(const std::string& description) {
    UndoState state;
    state.description = description;
    state.timestamp = std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::steady_clock::now().time_since_epoch()).count();
    
    // TODO: Serialize project state to state.data
    
    m_undoStack.push_back(state);
    
    // Limit undo stack size
    if (m_undoStack.size() > static_cast<size_t>(m_globalSettings.undoLevels)) {
        m_undoStack.erase(m_undoStack.begin());
    }
    
    // Clear redo stack when new action is performed
    m_redoStack.clear();
}

void ReaperEngine::RestoreUndoState(const UndoState& state) {
    // TODO: Deserialize and restore project state from state.data
}

void ReaperEngine::SetProjectDirty(bool dirty) {
    m_projectDirty = dirty;
}