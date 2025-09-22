/*
 * REAPER Web - Track Manager
 * Manages audio tracks, routing, and mixing
 * Based on REAPER's track architecture
 */

#pragma once

#include <memory>
#include <vector>
#include <string>
#include <atomic>
#include <mutex>

// Forward declarations
class AudioEngine;
class Track;
class EffectChain;
class TrackEffectProcessor;
class AudioBuffer;

/**
 * Track Manager - coordinates all tracks and audio routing
 * Based on REAPER's track management system
 */
class TrackManager {
public:
    enum class TrackType {
        AUDIO,
        FOLDER,
        MASTER
    };

    struct TrackSettings {
        TrackType type = TrackType::AUDIO;
        std::string name;
        double volume = 1.0;        // Linear volume (0.0 to 2.0+)
        double pan = 0.0;           // -1.0 (left) to 1.0 (right)
        bool mute = false;
        bool solo = false;
        bool recordArm = false;
        bool inputMonitor = false;
        int inputChannel = 0;       // Input channel selection
        std::string color = "#808080"; // Track color
        
        // Folder track specific
        bool folderOpen = true;
        int folderDepth = 0;
        
        // Performance
        bool freeze = false;        // Track freezing for CPU savings
        bool phase = false;         // Phase invert
    };

public:
    TrackManager();
    ~TrackManager();

    bool Initialize(AudioEngine* audioEngine);
    void Shutdown();

    // Track creation and management
    Track* CreateTrack(const std::string& name = "", TrackType type = TrackType::AUDIO);
    Track* CreateFolderTrack(const std::string& name = "");
    bool DeleteTrack(int index);
    bool DeleteTrack(Track* track);
    
    // Track access
    Track* GetTrack(int index) const;
    Track* GetMasterTrack() const { return m_masterTrack.get(); }
    int GetTrackCount() const { return static_cast<int>(m_tracks.size()); }
    int GetTrackIndex(Track* track) const;
    
    // Track organization
    bool MoveTrack(int fromIndex, int toIndex);
    bool MoveTrack(Track* track, int newIndex);
    void ClearAllTracks();
    
    // Track selection
    void SelectTrack(Track* track, bool addToSelection = false);
    void SelectTrack(int index, bool addToSelection = false);
    void ClearSelection();
    std::vector<Track*> GetSelectedTracks() const;
    bool IsTrackSelected(Track* track) const;
    
    // Solo system - REAPER's exclusive solo behavior
    void SetTrackSolo(Track* track, bool solo);
    void ClearAllSolo();
    bool HasSoloedTracks() const { return m_hasSoloedTracks.load(); }
    
    // Track templates
    bool SaveTrackTemplate(Track* track, const std::string& templateName);
    bool LoadTrackTemplate(const std::string& templateName, int insertAtIndex = -1);
    std::vector<std::string> GetAvailableTrackTemplates() const;
    
    // Folder system
    void SetTrackFolder(Track* track, bool isFolder, int depth = 0);
    std::vector<Track*> GetFolderChildren(Track* folderTrack) const;
    Track* GetParentFolder(Track* track) const;
    
    // Audio routing and processing
    void ProcessAllTracks(AudioBuffer& masterBuffer);
    void ProcessTrackChain(Track* startTrack, AudioBuffer& buffer);
    
    // Track freezing (rendering to audio for CPU savings)
    bool FreezeTrack(Track* track);
    bool UnfreezeTrack(Track* track);
    bool IsTrackFrozen(Track* track) const;
    
    // Performance monitoring
    struct TrackStats {
        double cpuUsage = 0.0;
        int activePlugins = 0;
        bool isProcessing = false;
        double peakLevel = 0.0;
    };
    TrackStats GetTrackStats(Track* track) const;
    double GetTotalCpuUsage() const;
    
    // Track I/O configuration
    void SetTrackInput(Track* track, int inputChannel);
    void SetTrackOutput(Track* track, int outputChannel);
    void SetTrackRecordArm(Track* track, bool armed);
    void SetTrackInputMonitor(Track* track, bool monitor);
    
    // Recording
    void StartRecording();
    void StopRecording();
    bool IsRecording() const { return m_isRecording.load(); }
    std::vector<Track*> GetArmedTracks() const;

private:
    AudioEngine* m_audioEngine = nullptr;
    
    // Track storage
    std::vector<std::unique_ptr<Track>> m_tracks;
    std::unique_ptr<Track> m_masterTrack;
    
    // Track selection
    std::vector<Track*> m_selectedTracks;
    mutable std::mutex m_selectionMutex;
    
    // Solo system
    std::atomic<bool> m_hasSoloedTracks{false};
    std::vector<Track*> m_soloedTracks;
    mutable std::mutex m_soloMutex;
    
    // Recording state
    std::atomic<bool> m_isRecording{false};
    std::vector<Track*> m_armedTracks;
    
    // Performance tracking
    mutable std::mutex m_statsMutex;
    std::unordered_map<Track*, TrackStats> m_trackStats;
    
    // Thread safety
    mutable std::mutex m_tracksMutex;
    
    // Internal helpers
    void UpdateSoloState();
    void UpdateTrackNumbers();
    void NotifyTrackAdded(Track* track);
    void NotifyTrackRemoved(Track* track);
    
    // Folder management helpers
    void UpdateFolderStructure();
    int CalculateFolderDepth(Track* track) const;
    
    // Template system
    std::string GetTrackTemplateDirectory() const;
    bool SaveTrackState(Track* track, const std::string& filePath);
    bool LoadTrackState(Track* track, const std::string& filePath);
};

/**
 * Individual Track Class
 * Represents a single audio track with effects, routing, and automation
 */
class Track {
public:
    friend class TrackManager;
    
    struct TrackState {
        std::string name;
        std::string guid;
        double volume = 1.0;
        double pan = 0.0;
        bool mute = false;
        bool solo = false;
        bool recordArm = false;
        bool inputMonitor = false;
        bool freeze = false;
        bool phase = false;
        int inputChannel = 0;
        int outputChannel = 0;
        std::string color = "#808080";
        
        // Folder properties
        bool isFolder = false;
        int folderDepth = 0;
        bool folderOpen = true;
    };

    explicit Track(TrackManager* manager, const std::string& name = "");
    ~Track();

    // Basic properties
    void SetName(const std::string& name);
    const std::string& GetName() const { return m_state.name; }
    const std::string& GetGUID() const { return m_state.guid; }
    
    // Volume and pan
    void SetVolume(double volume);
    double GetVolume() const { return m_state.volume; }
    void SetPan(double pan);
    double GetPan() const { return m_state.pan; }
    
    // Mute and solo
    void SetMute(bool mute);
    bool IsMuted() const { return m_state.mute; }
    void SetSolo(bool solo);
    bool IsSoloed() const { return m_state.solo; }
    
    // Recording
    void SetRecordArm(bool armed);
    bool IsRecordArmed() const { return m_state.recordArm; }
    void SetInputMonitor(bool monitor);
    bool IsInputMonitoring() const { return m_state.inputMonitor; }
    
    // I/O
    void SetInputChannel(int channel);
    int GetInputChannel() const { return m_state.inputChannel; }
    void SetOutputChannel(int channel);
    int GetOutputChannel() const { return m_state.outputChannel; }
    
    // Effects chain
    EffectChain* GetEffectsChain() const;
    TrackEffectProcessor* GetEffectProcessor() const { return m_effectProcessor.get(); }
    
    // Visual properties
    void SetColor(const std::string& color);
    const std::string& GetColor() const { return m_state.color; }
    
    // Folder properties
    void SetFolder(bool isFolder, int depth = 0);
    bool IsFolder() const { return m_state.isFolder; }
    int GetFolderDepth() const { return m_state.folderDepth; }
    void SetFolderOpen(bool open);
    bool IsFolderOpen() const { return m_state.folderOpen; }
    
    // Processing
    void ProcessAudio(AudioBuffer& inputBuffer, AudioBuffer& outputBuffer);
    
    // State management
    const TrackState& GetState() const { return m_state; }
    void SetState(const TrackState& state);
    
    // Performance
    void SetFreeze(bool freeze);
    bool IsFrozen() const { return m_state.freeze; }

private:
    TrackManager* m_manager;
    TrackState m_state;
    std::unique_ptr<TrackEffectProcessor> m_effectProcessor;
    
    // Audio buffers for processing
    std::unique_ptr<AudioBuffer> m_inputBuffer;
    std::unique_ptr<AudioBuffer> m_outputBuffer;
    
    // Performance monitoring
    mutable std::mutex m_processingMutex;
    std::atomic<bool> m_isProcessing{false};
    
    // GUID generation
    std::string GenerateGUID() const;
    
    // Internal processing helpers
    void ApplyVolumeAndPan(AudioBuffer& buffer);
    void ProcessEffects(AudioBuffer& buffer);
};