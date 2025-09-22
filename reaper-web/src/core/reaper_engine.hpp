/*
 * REAPER Web Engine - Core DAW Engine
 * Based on REAPER's architecture patterns and JSFX analysis
 * Handles main DAW operations, project state, and coordination
 */

#pragma once

#include <memory>
#include <vector>
#include <string>
#include <unordered_map>
#include <atomic>
#include <mutex>
#include <thread>

// Forward declarations
class AudioEngine;
class ProjectManager;
class TrackManager;
class MediaItemManager;
class EffectsProcessor;

/**
 * Main REAPER-style DAW Engine
 * Coordinates all subsystems and maintains global state
 * Based on analysis of REAPER's binary structure and JSFX patterns
 */
class ReaperEngine {
public:
    enum class PlayState {
        STOPPED,
        PLAYING, 
        RECORDING,
        PAUSED
    };

    enum class TimeFormat {
        SECONDS,
        SAMPLES,
        MEASURES_BEATS,
        MINUTES_SECONDS,
        TIMECODE
    };

    struct GlobalSettings {
        double sampleRate = 48000.0;
        int bufferSize = 512;
        int maxChannels = 64;
        bool enablePDC = true;          // Plugin Delay Compensation
        bool enablePreRoll = true;
        double preRollTime = 2.0;       // seconds
        int undoLevels = 1000;
        bool autoSave = true;
        int autoSaveInterval = 300;     // seconds
    };

    struct TransportState {
        std::atomic<PlayState> playState{PlayState::STOPPED};
        std::atomic<double> playPosition{0.0};      // in seconds
        std::atomic<double> recordPosition{0.0};
        std::atomic<bool> loop{false};
        std::atomic<double> loopStart{0.0};
        std::atomic<double> loopEnd{60.0};
        std::atomic<bool> metronomeEnabled{false};
        std::atomic<double> tempo{120.0};
        std::atomic<int> timeSigNumerator{4};
        std::atomic<int> timeSigDenominator{4};
    };

    struct RealtimeSettings {
        std::atomic<bool> monitoring{true};
        std::atomic<bool> inputMonitoring{true};
        std::atomic<double> masterVolume{1.0};
        std::atomic<bool> masterMute{false};
        std::atomic<double> masterPan{0.0};
        std::atomic<int> clickVolume{80};          // 0-100
        std::atomic<bool> metronomeEnabled{false};
        std::atomic<bool> countIn{false};
        std::atomic<int> countInBars{1};
    };

public:
    ReaperEngine();
    ~ReaperEngine();

    // Core initialization - mirrors REAPER startup sequence
    bool Initialize();
    bool Initialize(const GlobalSettings& settings);
    void Shutdown();
    
    // Project management
    bool NewProject();
    bool LoadProject(const std::string& filePath);
    bool SaveProject(const std::string& filePath = "");
    void SetProjectDirty(bool dirty = true);
    bool IsProjectDirty() const { return m_projectDirty; }

    // Transport controls - exact REAPER behavior
    void Play();
    void Stop();
    void Pause();
    void Record();
    void TogglePlayPause();
    void Rewind();
    void FastForward();
    void GoToStart();
    void GoToEnd();
    void SetPlayPosition(double seconds);
    void SetLoopPoints(double start, double end);
    
    // Time and tempo
    void SetTempo(double bpm);
    void SetTimeSignature(int numerator, int denominator);
    double BeatsToSeconds(double beats) const;
    double SecondsToBeats(double seconds) const;
    std::string FormatTime(double seconds, TimeFormat format) const;

    // Master controls
    void SetMasterVolume(double volume);
    void SetMasterPan(double pan);
    void ToggleMasterMute();
    void SetMetronome(bool enabled);

    // Audio processing coordination
    void ProcessAudioBlock(float** inputs, float** outputs, int numChannels, int numSamples);
    void SetBufferSize(int samples);
    void SetSampleRate(double rate);

    // Undo/Redo system - REAPER-style unlimited undo
    void BeginUndoBlock(const std::string& description);
    void EndUndoBlock();
    bool Undo();
    bool Redo();
    void ClearUndoHistory();
    
    // Subsystem access
    AudioEngine* GetAudioEngine() const { return m_audioEngine.get(); }
    ProjectManager* GetProjectManager() const { return m_projectManager.get(); }
    TrackManager* GetTrackManager() const { return m_trackManager.get(); }
    MediaItemManager* GetMediaItemManager() const { return m_mediaItemManager.get(); }
    
    // State access
    const TransportState& GetTransportState() const { return m_transportState; }
    const RealtimeSettings& GetRealtimeSettings() const { return m_realtimeSettings; }
    const GlobalSettings& GetGlobalSettings() const { return m_globalSettings; }

    // Performance monitoring - REAPER-style CPU usage
    double GetCpuUsage() const { return m_cpuUsage.load(); }
    double GetDiskUsage() const { return m_diskUsage.load(); }
    int GetActiveVoices() const { return m_activeVoices.load(); }

    // Threading and real-time safety
    bool IsRealtimeThread() const;
    void SetRealtimeThreadId(std::thread::id id) { m_realtimeThreadId = id; }

private:
    // Core subsystems
    std::unique_ptr<AudioEngine> m_audioEngine;
    std::unique_ptr<ProjectManager> m_projectManager;
    std::unique_ptr<TrackManager> m_trackManager;
    std::unique_ptr<MediaItemManager> m_mediaItemManager;
    
    // State
    GlobalSettings m_globalSettings;
    TransportState m_transportState;
    RealtimeSettings m_realtimeSettings;
    
    // Project state
    std::atomic<bool> m_projectDirty{false};
    std::string m_currentProjectPath;
    
    // Undo system
    struct UndoState {
        std::string description;
        std::vector<uint8_t> data;
        double timestamp;
    };
    std::vector<UndoState> m_undoStack;
    std::vector<UndoState> m_redoStack;
    int m_currentUndoBlock = -1;
    mutable std::mutex m_undoMutex;
    
    // Performance monitoring
    std::atomic<double> m_cpuUsage{0.0};
    std::atomic<double> m_diskUsage{0.0};
    std::atomic<int> m_activeVoices{0};
    
    // Threading
    std::thread::id m_realtimeThreadId;
    std::atomic<bool> m_initialized{false};
    
    // Internal methods
    void UpdatePerformanceMetrics();
    void SaveUndoState(const std::string& description);
    void RestoreUndoState(const UndoState& state);
    void ProcessTransportUpdate();
    
    // REAPER-style time calculations
    double CalculateBeatPosition(double seconds) const;
    double CalculateBarPosition(double seconds) const;
    
    // Cleanup
    void CleanupResources();
};

/**
 * Global engine instance access
 * Mirrors REAPER's global state management
 */
extern ReaperEngine* g_reaperEngine;

// Utility macros for REAPER-style development
#define REAPER_ENGINE() (g_reaperEngine)
#define IS_REALTIME_THREAD() (g_reaperEngine && g_reaperEngine->IsRealtimeThread())
#define GET_SAMPLE_RATE() (g_reaperEngine ? g_reaperEngine->GetGlobalSettings().sampleRate : 48000.0)
#define GET_BUFFER_SIZE() (g_reaperEngine ? g_reaperEngine->GetGlobalSettings().bufferSize : 512)