#pragma once
#include <vector>
#include <memory>
#include <string>
#include <unordered_map>
#include <chrono>
#include <algorithm>

// Forward declarations
class AudioClip;
class AudioBuffer;

// Time position in samples or seconds
struct TimePosition {
    double seconds;
    int64_t samples;
    
    TimePosition(double s = 0.0, int sampleRate = 44100) 
        : seconds(s), samples(static_cast<int64_t>(s * sampleRate)) {}
    
    TimePosition(int64_t samp, int sampleRate = 44100) 
        : samples(samp), seconds(static_cast<double>(samp) / sampleRate) {}
};

// Track view and zoom management (inspired by Reaper's timeline)
class TimelineView {
public:
    struct ViewState {
        double startTime = 0.0;        // Left edge of view in seconds
        double zoomLevel = 1.0;        // Pixels per second
        double viewWidth = 800.0;      // View width in pixels
        double maxTime = 600.0;        // Maximum timeline in seconds
        
        // Convert time to pixel position
        double timeToPixel(double time) const {
            return (time - startTime) * zoomLevel;
        }
        
        // Convert pixel position to time
        double pixelToTime(double pixel) const {
            return startTime + (pixel / zoomLevel);
        }
        
        // Get visible time range
        double getVisibleDuration() const {
            return viewWidth / zoomLevel;
        }
        
        // Check if time is visible
        bool isTimeVisible(double time) const {
            return time >= startTime && time <= (startTime + getVisibleDuration());
        }
    };
    
private:
    ViewState viewState;
    double minZoom = 0.1;   // Min pixels per second
    double maxZoom = 1000.0; // Max pixels per second
    
public:
    TimelineView(double width = 800.0) {
        viewState.viewWidth = width;
        viewState.zoomLevel = 50.0; // Default: 50 pixels per second
    }
    
    // Zoom controls (Reaper-style)
    void zoomIn(double factor = 1.5, double centerTime = -1) {
        if (centerTime < 0) centerTime = viewState.startTime + viewState.getVisibleDuration() / 2;
        
        double newZoom = std::clamp(viewState.zoomLevel * factor, minZoom, maxZoom);
        double newDuration = viewState.viewWidth / newZoom;
        
        // Keep center time in center
        viewState.startTime = centerTime - newDuration / 2;
        viewState.zoomLevel = newZoom;
        
        clampView();
    }
    
    void zoomOut(double factor = 1.5, double centerTime = -1) {
        zoomIn(1.0 / factor, centerTime);
    }
    
    void zoomToFit(double startTime, double endTime) {
        double duration = endTime - startTime;
        if (duration > 0) {
            viewState.zoomLevel = std::clamp(viewState.viewWidth / duration, minZoom, maxZoom);
            viewState.startTime = startTime;
            clampView();
        }
    }
    
    // Scrolling (Reaper-style)
    void scroll(double deltaTime) {
        viewState.startTime += deltaTime;
        clampView();
    }
    
    void scrollToTime(double time) {
        viewState.startTime = time - viewState.getVisibleDuration() / 2;
        clampView();
    }
    
    // Auto-scroll during playback
    void followPlayhead(double playheadTime) {
        double margin = viewState.getVisibleDuration() * 0.1; // 10% margin
        
        if (playheadTime < viewState.startTime + margin) {
            viewState.startTime = playheadTime - margin;
        } else if (playheadTime > viewState.startTime + viewState.getVisibleDuration() - margin) {
            viewState.startTime = playheadTime - viewState.getVisibleDuration() + margin;
        }
        
        clampView();
    }
    
    // Getters
    const ViewState& getViewState() const { return viewState; }
    double getZoomLevel() const { return viewState.zoomLevel; }
    double getStartTime() const { return viewState.startTime; }
    double getVisibleDuration() const { return viewState.getVisibleDuration(); }
    
    // Setters
    void setViewWidth(double width) { 
        viewState.viewWidth = width; 
        clampView();
    }
    
    void setMaxTime(double maxTime) { 
        viewState.maxTime = maxTime; 
        clampView();
    }
    
private:
    void clampView() {
        // Ensure start time is not negative
        viewState.startTime = std::max(0.0, viewState.startTime);
        
        // Ensure we don't scroll past the end
        double maxStart = viewState.maxTime - viewState.getVisibleDuration();
        if (maxStart > 0) {
            viewState.startTime = std::min(viewState.startTime, maxStart);
        }
    }
};

// Audio clip with Reaper-style properties
class AudioClip {
public:
    struct ClipProperties {
        std::string name;
        std::string filePath;
        TimePosition startTime;
        TimePosition duration;
        TimePosition offset;        // Offset into source audio
        float volume = 1.0f;
        float fadeInTime = 0.0f;
        float fadeOutTime = 0.0f;
        bool isMuted = false;
        int colorIndex = 0;
    };
    
private:
    ClipProperties properties;
    std::shared_ptr<AudioBuffer> audioData;
    int trackId;
    int clipId;
    
public:
    AudioClip(int trackId, int clipId, const std::string& name = "Clip") 
        : trackId(trackId), clipId(clipId) {
        properties.name = name;
    }
    
    // Clip manipulation (Reaper-style)
    void move(const TimePosition& newStartTime) {
        properties.startTime = newStartTime;
    }
    
    void resize(const TimePosition& newDuration) {
        properties.duration = newDuration;
    }
    
    void trim(const TimePosition& newOffset, const TimePosition& newDuration) {
        properties.offset = newOffset;
        properties.duration = newDuration;
    }
    
    AudioClip split(const TimePosition& splitTime) {
        // Create new clip for the right part
        AudioClip rightClip(trackId, clipId + 1000, properties.name + "_split");
        
        // Calculate split point relative to clip start
        double splitRelative = splitTime.seconds - properties.startTime.seconds;
        
        if (splitRelative > 0 && splitRelative < properties.duration.seconds) {
            // Right clip starts at split time
            rightClip.properties.startTime = splitTime;
            rightClip.properties.duration = TimePosition(properties.duration.seconds - splitRelative);
            rightClip.properties.offset = TimePosition(properties.offset.seconds + splitRelative);
            
            // Adjust this clip's duration
            properties.duration = TimePosition(splitRelative);
            
            // Copy other properties
            rightClip.properties.volume = properties.volume;
            rightClip.properties.fadeInTime = properties.fadeInTime;
            rightClip.properties.fadeOutTime = properties.fadeOutTime;
            rightClip.properties.colorIndex = properties.colorIndex;
            rightClip.audioData = audioData;
        }
        
        return rightClip;
    }
    
    AudioClip duplicate() const {
        AudioClip newClip(trackId, clipId + 2000, properties.name + "_copy");
        newClip.properties = properties;
        newClip.audioData = audioData;
        return newClip;
    }
    
    // Property accessors
    const ClipProperties& getProperties() const { return properties; }
    ClipProperties& getProperties() { return properties; }
    
    int getTrackId() const { return trackId; }
    int getClipId() const { return clipId; }
    
    void setAudioData(std::shared_ptr<AudioBuffer> data) { audioData = data; }
    std::shared_ptr<AudioBuffer> getAudioData() const { return audioData; }
    
    // Time queries
    double getStartTime() const { return properties.startTime.seconds; }
    double getEndTime() const { return properties.startTime.seconds + properties.duration.seconds; }
    double getDuration() const { return properties.duration.seconds; }
    
    bool containsTime(double time) const {
        return time >= getStartTime() && time < getEndTime();
    }
    
    bool overlaps(const AudioClip& other) const {
        return !(getEndTime() <= other.getStartTime() || other.getEndTime() <= getStartTime());
    }
};

// Enhanced track with Reaper-style capabilities
class EnhancedTrack {
public:
    struct TrackState {
        int id;
        std::string name;
        float volume = 1.0f;
        float pan = 0.0f;
        bool isMuted = false;
        bool isSoloed = false;
        bool isArmed = false;
        bool isRecording = false;
        int colorIndex = 0;
        int height = 100; // Track height in pixels
    };
    
private:
    TrackState state;
    std::vector<std::unique_ptr<AudioClip>> clips;
    int nextClipId = 1;
    
public:
    EnhancedTrack(int id, const std::string& name) {
        state.id = id;
        state.name = name;
    }
    
    // Clip management
    AudioClip* addClip(const std::string& name, const TimePosition& startTime, const TimePosition& duration) {
        auto clip = std::make_unique<AudioClip>(state.id, nextClipId++, name);
        clip->getProperties().startTime = startTime;
        clip->getProperties().duration = duration;
        
        AudioClip* clipPtr = clip.get();
        clips.push_back(std::move(clip));
        
        return clipPtr;
    }
    
    void removeClip(int clipId) {
        clips.erase(std::remove_if(clips.begin(), clips.end(),
            [clipId](const std::unique_ptr<AudioClip>& clip) {
                return clip->getClipId() == clipId;
            }), clips.end());
    }
    
    AudioClip* findClipAt(double time) {
        for (auto& clip : clips) {
            if (clip->containsTime(time)) {
                return clip.get();
            }
        }
        return nullptr;
    }
    
    std::vector<AudioClip*> getClipsInRange(double startTime, double endTime) {
        std::vector<AudioClip*> result;
        for (auto& clip : clips) {
            if (clip->getEndTime() > startTime && clip->getStartTime() < endTime) {
                result.push_back(clip.get());
            }
        }
        return result;
    }
    
    // Track properties
    const TrackState& getState() const { return state; }
    TrackState& getState() { return state; }
    
    const std::vector<std::unique_ptr<AudioClip>>& getClips() const { return clips; }
    
    double getTrackDuration() const {
        double maxEnd = 0.0;
        for (const auto& clip : clips) {
            maxEnd = std::max(maxEnd, clip->getEndTime());
        }
        return maxEnd;
    }
};

// Main track manager inspired by Reaper's architecture
class AdvancedTrackManager {
private:
    std::vector<std::unique_ptr<EnhancedTrack>> tracks;
    std::unique_ptr<TimelineView> timeline;
    int selectedTrackId = -1;
    int nextTrackId = 1;
    double currentTime = 0.0;
    bool isPlaying = false;
    
public:
    AdvancedTrackManager() {
        timeline = std::make_unique<TimelineView>();
    }
    
    // Track management
    EnhancedTrack* addTrack(const std::string& name) {
        auto track = std::make_unique<EnhancedTrack>(nextTrackId++, name);
        EnhancedTrack* trackPtr = track.get();
        tracks.push_back(std::move(track));
        return trackPtr;
    }
    
    void removeTrack(int trackId) {
        tracks.erase(std::remove_if(tracks.begin(), tracks.end(),
            [trackId](const std::unique_ptr<EnhancedTrack>& track) {
                return track->getState().id == trackId;
            }), tracks.end());
    }
    
    EnhancedTrack* getTrack(int trackId) {
        for (auto& track : tracks) {
            if (track->getState().id == trackId) {
                return track.get();
            }
        }
        return nullptr;
    }
    
    EnhancedTrack* getSelectedTrack() {
        return getTrack(selectedTrackId);
    }
    
    void selectTrack(int trackId) {
        selectedTrackId = trackId;
    }
    
    // Timeline management
    TimelineView* getTimeline() { return timeline.get(); }
    
    void setCurrentTime(double time) {
        currentTime = time;
        if (isPlaying) {
            timeline->followPlayhead(time);
        }
    }
    
    void setPlaying(bool playing) { isPlaying = playing; }
    
    // Project queries
    double getProjectDuration() const {
        double maxDuration = 0.0;
        for (const auto& track : tracks) {
            maxDuration = std::max(maxDuration, track->getTrackDuration());
        }
        return maxDuration;
    }
    
    int getTrackCount() const { return tracks.size(); }
    const std::vector<std::unique_ptr<EnhancedTrack>>& getTracks() const { return tracks; }
    
    // Bulk operations
    void muteAllTracks() {
        for (auto& track : tracks) {
            track->getState().isMuted = true;
        }
    }
    
    void unmuteAllTracks() {
        for (auto& track : tracks) {
            track->getState().isMuted = false;
        }
    }
    
    void soloTrack(int trackId) {
        // Unsolo all tracks first
        for (auto& track : tracks) {
            track->getState().isSoloed = false;
        }
        
        // Solo the selected track
        if (auto track = getTrack(trackId)) {
            track->getState().isSoloed = true;
        }
    }
};