/*
 * REAPER Web - Media Item System
 * Non-destructive audio editing with takes, crossfades, and time stretching
 * Based on REAPER's media item architecture
 */

#pragma once

#include <memory>
#include <vector>
#include <string>
#include <functional>

// Forward declarations
class Track;
class AudioSource;
class AudioBuffer;

/**
 * Media Item - REAPER-style audio item with takes and non-destructive editing
 * Represents an audio clip on a track with all editing capabilities
 */
class MediaItem {
public:
    enum class StretchMode {
        NONE,               // No time stretching
        ELASTIQUE,          // Elastique algorithm (REAPER default)
        RUBBER_BAND,        // Rubber Band algorithm
        SIMPLE,             // Simple linear interpolation
        PRIMITIVE           // Primitive algorithm
    };

    enum class FadeType {
        LINEAR,
        LOGARITHMIC,
        EXPONENTIAL,
        EQUAL_POWER,
        FAST_START,
        FAST_END,
        SLOW_START_END
    };

    /**
     * Take - Individual audio source within a media item
     * REAPER supports multiple takes per item for comping
     */
    struct Take {
        std::string guid;
        std::string name;
        std::shared_ptr<AudioSource> source;
        double sourceOffset = 0.0;     // Offset into source file (seconds)
        double playRate = 1.0;          // Playback rate (1.0 = normal speed)
        double pitch = 0.0;             // Pitch shift in semitones
        bool preservePitch = true;      // Preserve pitch when changing rate
        StretchMode stretchMode = StretchMode::ELASTIQUE;
        double volume = 1.0;            // Take volume (linear)
        bool mute = false;              // Take mute
        bool solo = false;              // Take solo
        bool phase = false;             // Phase invert
        std::string color = "#FFFFFF";  // Take color
        
        // Stretch markers for advanced time stretching
        struct StretchMarker {
            double sourceTime = 0.0;    // Time in source
            double itemTime = 0.0;      // Time in item
        };
        std::vector<StretchMarker> stretchMarkers;
    };

    /**
     * Fade settings for item edges
     */
    struct Fade {
        double length = 0.0;            // Fade length in seconds
        FadeType type = FadeType::EQUAL_POWER;
        double curvature = 0.0;         // Fade curve adjustment (-1 to 1)
        bool enabled = false;           // Fade enabled
    };

    /**
     * Item state for serialization and undo
     */
    struct ItemState {
        std::string guid;
        std::string name;
        double position = 0.0;          // Start position on track (seconds)
        double length = 0.0;            // Item length (seconds)
        double snapOffset = 0.0;        // Snap offset for alignment
        double volume = 1.0;            // Item volume (linear)
        bool mute = false;              // Item mute
        bool locked = false;            // Item locked (cannot be moved/edited)
        bool selected = false;          // Item selected
        std::string color = "#808080";  // Item color
        int trackIndex = 0;             // Track this item belongs to
        
        // Fades
        Fade fadeIn;
        Fade fadeOut;
        
        // Grouping
        int groupId = 0;                // Item group ID (0 = no group)
        
        // Loop source
        bool loopSource = false;        // Loop source if item is longer than source
        
        // Takes
        std::vector<Take> takes;
        int activeTake = 0;             // Index of active take
    };

public:
    MediaItem(Track* track, const std::string& sourceFile = "");
    ~MediaItem();

    // Basic properties
    const std::string& GetGUID() const { return m_state.guid; }
    void SetName(const std::string& name);
    const std::string& GetName() const { return m_state.name; }

    // Position and timing
    void SetPosition(double seconds);
    double GetPosition() const { return m_state.position; }
    void SetLength(double seconds);
    double GetLength() const { return m_state.length; }
    double GetEndPosition() const { return m_state.position + m_state.length; }
    
    // Snap offset for precise alignment
    void SetSnapOffset(double offset);
    double GetSnapOffset() const { return m_state.snapOffset; }

    // Volume and muting
    void SetVolume(double volume);
    double GetVolume() const { return m_state.volume; }
    void SetMute(bool mute);
    bool IsMuted() const { return m_state.mute; }

    // Visual properties
    void SetColor(const std::string& color);
    const std::string& GetColor() const { return m_state.color; }
    void SetSelected(bool selected);
    bool IsSelected() const { return m_state.selected; }

    // Locking
    void SetLocked(bool locked);
    bool IsLocked() const { return m_state.locked; }

    // Grouping
    void SetGroupId(int groupId);
    int GetGroupId() const { return m_state.groupId; }

    // Fades
    void SetFadeIn(double length, FadeType type = FadeType::EQUAL_POWER);
    void SetFadeOut(double length, FadeType type = FadeType::EQUAL_POWER);
    void ClearFadeIn();
    void ClearFadeOut();
    const Fade& GetFadeIn() const { return m_state.fadeIn; }
    const Fade& GetFadeOut() const { return m_state.fadeOut; }

    // Takes management
    int AddTake(const std::string& sourceFile);
    bool RemoveTake(int takeIndex);
    void SetActiveTake(int takeIndex);
    int GetActiveTake() const { return m_state.activeTake; }
    int GetTakeCount() const { return static_cast<int>(m_state.takes.size()); }
    Take* GetTake(int index);
    const Take* GetTake(int index) const;
    Take* GetActiveTakePtr();
    const Take* GetActiveTakePtr() const;

    // Non-destructive editing operations
    bool Split(double time);                    // Split item at time
    bool Trim(double startTime, double endTime); // Trim item to time range
    bool Move(double deltaTime);                // Move item by delta
    bool Stretch(double newLength);             // Stretch item to new length
    bool ChangeRate(double newRate);            // Change playback rate
    bool ChangePitch(double semitones);         // Change pitch

    // Crossfade with adjacent items
    struct Crossfade {
        double length = 0.0;            // Crossfade length
        FadeType type = FadeType::EQUAL_POWER;
        double curvature = 0.0;         // Crossfade curve
        bool enabled = false;
    };
    void SetCrossfadeIn(const Crossfade& crossfade);
    void SetCrossfadeOut(const Crossfade& crossfade);

    // Audio processing
    void ProcessAudio(AudioBuffer& buffer, double startTime, double length);
    
    // Time range queries
    bool ContainsTime(double time) const;
    bool OverlapsTimeRange(double start, double end) const;
    double GetTimeInItem(double globalTime) const;

    // State management
    const ItemState& GetState() const { return m_state; }
    void SetState(const ItemState& state);
    
    // Track ownership
    Track* GetTrack() const { return m_track; }
    void SetTrack(Track* track) { m_track = track; }

    // Utility methods
    static std::string GenerateGUID();
    static double ApplyFadeCurve(double position, FadeType type, double curvature = 0.0);

private:
    Track* m_track;
    ItemState m_state;
    
    // Crossfades with adjacent items
    Crossfade m_crossfadeIn;
    Crossfade m_crossfadeOut;
    
    // Audio processing buffers
    mutable std::unique_ptr<AudioBuffer> m_processBuffer;
    
    // Internal methods
    void UpdateLength();
    void ProcessTake(const Take& take, AudioBuffer& buffer, double startTime, double length);
    void ApplyFades(AudioBuffer& buffer, double itemStartTime, double itemLength);
    void ApplyStretchMarkers(const Take& take, AudioBuffer& buffer);
    float CalculateFadeGain(double position, const Fade& fade) const;
    
    // Time stretching implementations
    void StretchElastique(AudioBuffer& input, AudioBuffer& output, double ratio);
    void StretchRubberBand(AudioBuffer& input, AudioBuffer& output, double ratio);
    void StretchSimple(AudioBuffer& input, AudioBuffer& output, double ratio);
};

/**
 * Audio Source - Represents an audio file or generated audio
 * Handles loading, caching, and providing audio data
 */
class AudioSource {
public:
    enum class SourceType {
        FILE,               // Audio file on disk
        RECORDING,          // Live recording
        GENERATED,          // Generated audio (sine wave, etc.)
        RENDER              // Rendered from other sources
    };

    struct SourceInfo {
        SourceType type = SourceType::FILE;
        std::string filePath;           // File path for file sources
        double length = 0.0;            // Source length in seconds
        double sampleRate = 48000.0;    // Source sample rate
        int channels = 2;               // Number of channels
        int bitDepth = 24;              // Bit depth
        std::string format;             // File format (WAV, FLAC, etc.)
        bool isValid = false;           // Source is valid and can be played
    };

public:
    AudioSource(const std::string& filePath);
    AudioSource(SourceType type);
    ~AudioSource();

    // Source information
    const SourceInfo& GetInfo() const { return m_info; }
    bool IsValid() const { return m_info.isValid; }
    
    // Audio data access
    bool ReadAudio(AudioBuffer& buffer, double startTime, double length);
    bool ReadAudioSamples(AudioBuffer& buffer, int startSample, int numSamples);
    
    // Caching for performance
    void EnableCaching(bool enable) { m_cachingEnabled = enable; }
    void ClearCache();
    
    // Peak data for waveform display
    struct PeakData {
        std::vector<float> minPeaks;
        std::vector<float> maxPeaks;
        int samplesPerPeak = 0;
        int numPeaks = 0;
    };
    const PeakData& GetPeakData(int resolution = 1024);

    // File operations
    bool LoadFromFile(const std::string& filePath);
    bool SaveToFile(const std::string& filePath);
    
    // Analysis
    double DetectTempo();
    std::vector<double> DetectBeats();
    double GetRMSLevel(double startTime = 0.0, double length = -1.0);
    double GetPeakLevel(double startTime = 0.0, double length = -1.0);

private:
    SourceInfo m_info;
    
    // Audio data storage
    std::vector<std::vector<float>> m_audioData; // [channel][sample]
    bool m_dataLoaded = false;
    
    // Caching
    bool m_cachingEnabled = true;
    std::vector<std::unique_ptr<AudioBuffer>> m_cachedBuffers;
    
    // Peak data cache
    std::unordered_map<int, PeakData> m_peakCache;
    
    // File I/O
    bool LoadWAVFile(const std::string& filePath);
    bool LoadFLACFile(const std::string& filePath);
    bool SaveWAVFile(const std::string& filePath);
    
    // Audio processing
    void ResampleIfNeeded(AudioBuffer& buffer, double targetSampleRate);
    void ConvertToTargetFormat(AudioBuffer& buffer);
    
    // Peak calculation
    void CalculatePeakData(int resolution);
    void UpdatePeakCache();
};

/**
 * Media Item Manager - Manages all media items in the project
 * Handles item operations, selection, and coordination
 */
class MediaItemManager {
public:
    MediaItemManager();
    ~MediaItemManager();

    // Item creation
    MediaItem* CreateItem(Track* track, const std::string& sourceFile, double position);
    MediaItem* CreateEmptyItem(Track* track, double position, double length);
    
    // Item management
    bool DeleteItem(MediaItem* item);
    void DeleteAllItems();
    std::vector<MediaItem*> GetItemsOnTrack(Track* track) const;
    std::vector<MediaItem*> GetItemsInTimeRange(double start, double end) const;
    
    // Selection
    void SelectItem(MediaItem* item, bool addToSelection = false);
    void ClearSelection();
    std::vector<MediaItem*> GetSelectedItems() const;
    bool IsItemSelected(MediaItem* item) const;
    
    // Operations on selected items
    void MoveSelectedItems(double deltaTime);
    void StretchSelectedItems(double factor);
    void SetSelectedItemsVolume(double volume);
    void SetSelectedItemsColor(const std::string& color);
    
    // Grouping
    void GroupSelectedItems();
    void UngroupSelectedItems();
    int GetNextGroupId() { return ++m_nextGroupId; }
    
    // Item finding
    MediaItem* GetItemAtTime(Track* track, double time) const;
    std::vector<MediaItem*> GetItemsAtTime(double time) const;
    MediaItem* FindItemByGUID(const std::string& guid) const;
    
    // Cleanup
    void RemoveInvalidItems();
    void OptimizeItems(); // Remove empty items, merge adjacent items, etc.

private:
    std::vector<std::unique_ptr<MediaItem>> m_items;
    std::vector<MediaItem*> m_selectedItems;
    int m_nextGroupId = 1;
    
    // Internal helpers
    void NotifyItemAdded(MediaItem* item);
    void NotifyItemRemoved(MediaItem* item);
    void UpdateItemSelection(MediaItem* item, bool selected);
};