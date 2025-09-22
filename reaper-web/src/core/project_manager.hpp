/*
 * REAPER Web - Project Manager
 * Handles .rpp project file format and project state management
 * Based on REAPER's project file structure analysis
 */

#pragma once

#include <string>
#include <vector>
#include <memory>
#include <unordered_map>

// Forward declarations
class Track;
class ReaperEngine;

/**
 * Project Manager - handles REAPER .rpp project files
 * Based on analysis of REAPER's project file format
 */
class ProjectManager {
public:
    struct ProjectInfo {
        std::string title;
        std::string author;
        std::string notes;
        double length = 0.0;        // Project length in seconds
        double sampleRate = 48000.0;
        int channels = 2;
        std::string timebase = "beats"; // beats, time
        double tempo = 120.0;
        int timeSigNumerator = 4;
        int timeSigDenominator = 4;
        std::string projectPath;
        bool hasUnsavedChanges = false;
    };

    struct MediaItem {
        std::string guid;
        std::string name;
        double position = 0.0;      // Start position in seconds
        double length = 0.0;        // Length in seconds
        double fadeIn = 0.0;
        double fadeOut = 0.0;
        double volume = 1.0;        // Linear volume
        bool mute = false;
        bool locked = false;
        std::string sourceFile;
        double sourceOffset = 0.0;  // Offset into source file
        int trackIndex = 0;
        
        // Take system (multiple takes per item)
        struct Take {
            std::string name;
            std::string sourceFile;
            double sourceOffset = 0.0;
            double playRate = 1.0;   // Time stretching
            double pitch = 0.0;      // Pitch shifting in semitones
            bool preservePitch = true;
            std::string stretchMode = "elastique"; // elastique, rubber band, etc.
        };
        std::vector<Take> takes;
        int activeTake = 0;
    };

    struct ProjectTrack {
        std::string guid;
        std::string name;
        double volume = 1.0;
        double pan = 0.0;
        bool mute = false;
        bool solo = false;
        bool recordArm = false;
        bool inputMonitor = false;
        int inputChannel = -1;      // -1 for stereo input
        std::string inputDevice;
        
        // Effects chain
        std::vector<std::string> effects; // Plugin identifiers
        
        // Automation envelopes
        struct Envelope {
            std::string parameter;   // volume, pan, plugin parameter
            bool visible = false;
            bool armed = false;
            std::vector<std::pair<double, double>> points; // time, value pairs
        };
        std::vector<Envelope> envelopes;
        
        // Track items
        std::vector<MediaItem> items;
        
        // Track routing
        struct Send {
            int destTrack = -1;      // -1 for master
            double volume = 1.0;
            double pan = 0.0;
            bool mute = false;
            bool postFader = true;
        };
        std::vector<Send> sends;
        
        // Folder structure
        bool isFolder = false;
        int folderDepth = 0;
        bool folderCompact = false;
    };

public:
    ProjectManager();
    ~ProjectManager();

    bool Initialize();
    void Shutdown();

    // Project operations
    bool NewProject();
    bool LoadProject(const std::string& filePath);
    bool SaveProject(const std::string& filePath);
    bool SaveProjectAs(const std::string& filePath);
    
    // Auto-save functionality
    void EnableAutoSave(bool enable, int intervalSeconds = 300);
    void AutoSave();
    
    // Project information
    const ProjectInfo& GetProjectInfo() const { return m_projectInfo; }
    void SetProjectInfo(const ProjectInfo& info);
    
    // Track management
    std::vector<ProjectTrack>& GetTracks() { return m_tracks; }
    const std::vector<ProjectTrack>& GetTracks() const { return m_tracks; }
    ProjectTrack* GetTrack(int index);
    ProjectTrack* AddTrack(const std::string& name = "");
    bool RemoveTrack(int index);
    bool MoveTrack(int fromIndex, int toIndex);
    
    // Media item management
    MediaItem* AddMediaItem(int trackIndex, const std::string& sourceFile, double position);
    bool RemoveMediaItem(int trackIndex, const std::string& itemGuid);
    MediaItem* GetMediaItem(const std::string& guid);
    
    // Template system
    bool SaveAsTemplate(const std::string& templateName);
    bool LoadTemplate(const std::string& templateName);
    std::vector<std::string> GetAvailableTemplates() const;
    
    // Recent projects
    void AddToRecentProjects(const std::string& filePath);
    std::vector<std::string> GetRecentProjects() const;
    
    // Project statistics
    double GetProjectLength() const;
    int GetTrackCount() const { return static_cast<int>(m_tracks.size()); }
    int GetMediaItemCount() const;
    
    // Backup and recovery
    bool CreateBackup(const std::string& backupPath = "");
    std::vector<std::string> GetAvailableBackups() const;
    bool RestoreFromBackup(const std::string& backupPath);

private:
    ProjectInfo m_projectInfo;
    std::vector<ProjectTrack> m_tracks;
    
    // Auto-save
    bool m_autoSaveEnabled = false;
    int m_autoSaveInterval = 300; // seconds
    std::chrono::steady_clock::time_point m_lastAutoSave;
    
    // Recent projects
    std::vector<std::string> m_recentProjects;
    static constexpr int MAX_RECENT_PROJECTS = 20;
    
    // File parsing
    bool ParseRPPFile(const std::string& filePath);
    bool WriteRPPFile(const std::string& filePath);
    
    // RPP format helpers
    std::string ParseRPPLine(const std::string& line, const std::string& key);
    std::vector<std::string> ParseRPPArray(const std::string& line);
    double ParseRPPDouble(const std::string& value);
    int ParseRPPInt(const std::string& value);
    bool ParseRPPBool(const std::string& value);
    
    // Track parsing
    bool ParseTrack(const std::vector<std::string>& lines, int& lineIndex, ProjectTrack& track);
    bool ParseItem(const std::vector<std::string>& lines, int& lineIndex, MediaItem& item);
    bool ParseSource(const std::vector<std::string>& lines, int& lineIndex, MediaItem::Take& take);
    
    // Writing helpers
    void WriteRPPHeader(std::ofstream& file);
    void WriteRPPTrack(std::ofstream& file, const ProjectTrack& track, int indent = 1);
    void WriteRPPItem(std::ofstream& file, const MediaItem& item, int indent = 2);
    void WriteRPPSource(std::ofstream& file, const MediaItem::Take& take, int indent = 3);
    std::string IndentString(int level) const;
    
    // GUID generation for items and tracks
    std::string GenerateGUID() const;
    
    // Path utilities
    std::string GetProjectDirectory() const;
    std::string GetBackupDirectory() const;
    std::string GetTemplateDirectory() const;
    std::string MakeRelativePath(const std::string& filePath) const;
    std::string MakeAbsolutePath(const std::string& relativePath) const;
    
    // File utilities
    bool FileExists(const std::string& filePath) const;
    bool CreateDirectory(const std::string& dirPath) const;
    std::string GetFileExtension(const std::string& filePath) const;
    std::string GetFileName(const std::string& filePath) const;
    std::string GetFileDirectory(const std::string& filePath) const;
};