/*
 * REAPER Web - Timeline View
 * Timeline rendering and interaction system based on REAPER's arrange view
 * Handles zoom, scroll, time-to-pixel conversion, and visual timeline elements
 */

#pragma once

#include <memory>
#include <vector>
#include <string>
#include <functional>

// Forward declarations
class ReaperEngine;
class Track;
class MediaItem;

/**
 * Timeline View - REAPER-style arrange window
 * Handles time display, zoom, scrolling, and visual timeline elements
 */
class TimelineView {
public:
    enum class TimeFormat {
        SECONDS,
        SAMPLES,
        MEASURES_BEATS,
        MINUTES_SECONDS,
        TIMECODE,
        BARS_BEATS_TICKS
    };

    enum class SnapMode {
        OFF,
        GRID,
        BEATS,
        MEASURES,
        SECONDS,
        SAMPLES,
        MARKERS,
        ITEMS
    };

    struct ViewState {
        double timeStart = 0.0;         // Start time visible (seconds)
        double timeEnd = 60.0;          // End time visible (seconds)
        double zoomLevel = 1.0;         // Zoom level (pixels per second)
        int scrollX = 0;                // Horizontal scroll position
        int scrollY = 0;                // Vertical scroll position
        int trackHeight = 24;           // Height of each track in pixels
        int rulerHeight = 30;           // Height of time ruler
        bool showGrid = true;           // Show time grid
        bool showMarkers = true;        // Show markers/regions
        TimeFormat timeFormat = TimeFormat::MINUTES_SECONDS;
        SnapMode snapMode = SnapMode::GRID;
        double snapValue = 1.0;         // Snap grid value
    };

    struct TimeMarker {
        double time = 0.0;              // Time position in seconds
        std::string name;               // Marker name
        std::string color = "#FF0000";  // Marker color
        bool isRegion = false;          // Is this a region marker?
        double regionEnd = 0.0;         // End time for regions
    };

    struct GridLine {
        double time = 0.0;              // Time position
        int type = 0;                   // 0=minor, 1=major, 2=measure
        std::string label;              // Optional label for major lines
    };

public:
    TimelineView();
    ~TimelineView();

    bool Initialize(ReaperEngine* engine, int width, int height);
    void Shutdown();

    // View management
    void SetViewDimensions(int width, int height);
    void SetViewport(double startTime, double endTime);
    void SetZoomLevel(double pixelsPerSecond);
    void SetScrollPosition(int x, int y);

    // Time conversion - pixel-perfect REAPER-style conversion
    double PixelToTime(int pixel) const;
    int TimeToPixel(double time) const;
    double GetTimeRange() const { return m_viewState.timeEnd - m_viewState.timeStart; }
    double GetPixelsPerSecond() const { return m_viewState.zoomLevel; }

    // Zoom operations
    void ZoomIn(double factor = 2.0);
    void ZoomOut(double factor = 2.0);
    void ZoomToFit();
    void ZoomToSelection();
    void ZoomToTimeRange(double startTime, double endTime);
    void SetZoomToShowTimeRange(double duration);

    // Scroll operations
    void ScrollTo(double time);
    void ScrollBy(double deltaTime);
    void ScrollToPlayhead();
    void CenterOnTime(double time);

    // Time formatting
    std::string FormatTime(double time) const;
    std::string FormatTime(double time, TimeFormat format) const;
    void SetTimeFormat(TimeFormat format);

    // Grid and snapping
    void SetSnapMode(SnapMode mode);
    void SetSnapValue(double value);
    double SnapTime(double time) const;
    bool IsSnapEnabled() const { return m_viewState.snapMode != SnapMode::OFF; }

    // Grid calculation for drawing
    std::vector<GridLine> CalculateGridLines() const;
    std::vector<GridLine> CalculateMajorGridLines() const;
    std::vector<GridLine> CalculateMinorGridLines() const;

    // Markers and regions
    void AddMarker(double time, const std::string& name, const std::string& color = "#FF0000");
    void AddRegion(double startTime, double endTime, const std::string& name, const std::string& color = "#0000FF");
    void RemoveMarker(int index);
    void RemoveAllMarkers();
    const std::vector<TimeMarker>& GetMarkers() const { return m_markers; }

    // Selection
    void SetTimeSelection(double start, double end);
    void ClearTimeSelection();
    bool HasTimeSelection() const { return m_hasTimeSelection; }
    double GetSelectionStart() const { return m_selectionStart; }
    double GetSelectionEnd() const { return m_selectionEnd; }

    // Visual settings
    void SetTrackHeight(int height);
    void SetRulerHeight(int height);
    void SetShowGrid(bool show);
    void SetShowMarkers(bool show);
    const ViewState& GetViewState() const { return m_viewState; }

    // Mouse interaction helpers
    double GetTimeAtMouse(int mouseX) const;
    int GetTrackAtMouse(int mouseY) const;
    bool IsInRuler(int mouseY) const;
    bool IsOverMarker(int mouseX, int mouseY, int& markerIndex) const;

    // Playhead and loop points
    void SetPlayheadPosition(double time);
    void SetLoopPoints(double start, double end);
    void ClearLoopPoints();
    double GetPlayheadPosition() const { return m_playheadPosition; }

    // Drawing callbacks - these would be implemented by the UI layer
    using DrawCallback = std::function<void()>;
    void SetRedrawCallback(DrawCallback callback) { m_redrawCallback = callback; }

    // Update from engine state
    void UpdateFromEngine();

    // Time-based calculations
    static double BeatsToSeconds(double beats, double tempo);
    static double SecondsToBeats(double seconds, double tempo);
    static int SecondsToSamples(double seconds, double sampleRate);
    static double SamplesToSeconds(int samples, double sampleRate);

private:
    ReaperEngine* m_engine = nullptr;
    ViewState m_viewState;

    // View dimensions
    int m_width = 800;
    int m_height = 600;

    // Time selection
    bool m_hasTimeSelection = false;
    double m_selectionStart = 0.0;
    double m_selectionEnd = 0.0;

    // Playhead and loop
    double m_playheadPosition = 0.0;
    bool m_hasLoopPoints = false;
    double m_loopStart = 0.0;
    double m_loopEnd = 0.0;

    // Markers and regions
    std::vector<TimeMarker> m_markers;

    // Callbacks
    DrawCallback m_redrawCallback;

    // Time formatting helpers
    std::string FormatSecondsTime(double time) const;
    std::string FormatSamplesTime(double time) const;
    std::string FormatMeasuresBeatsTime(double time) const;
    std::string FormatMinutesSecondsTime(double time) const;
    std::string FormatTimecodeTime(double time) const;
    std::string FormatBarsBeatsTicksTime(double time) const;

    // Grid calculation helpers
    double CalculateGridSpacing() const;
    double CalculateMajorGridSpacing() const;
    double CalculateMinorGridSpacing() const;
    void CalculateBeatsGrid(std::vector<GridLine>& lines) const;
    void CalculateSecondsGrid(std::vector<GridLine>& lines) const;
    void CalculateSamplesGrid(std::vector<GridLine>& lines) const;

    // Snap calculation helpers
    double SnapToGrid(double time) const;
    double SnapToBeats(double time) const;
    double SnapToMeasures(double time) const;
    double SnapToSeconds(double time) const;
    double SnapToSamples(double time) const;
    double SnapToMarkers(double time) const;
    double SnapToItems(double time) const;

    // Zoom constraints
    static constexpr double MIN_ZOOM = 0.01;   // 0.01 pixels per second
    static constexpr double MAX_ZOOM = 10000.0; // 10000 pixels per second
    static constexpr double MIN_TIME_RANGE = 0.001; // 1ms minimum view
    static constexpr double MAX_TIME_RANGE = 86400.0; // 24 hours maximum view

    // Grid constraints
    static constexpr double MIN_GRID_SPACING = 10.0;  // Minimum pixels between grid lines
    static constexpr double MAX_GRID_SPACING = 200.0; // Maximum pixels between grid lines

    // Helper methods
    void RequestRedraw();
    double ClampZoom(double zoom) const;
    double ClampTime(double time) const;
    void UpdateZoomConstraints();
};

/**
 * Ruler - Time ruler component for the timeline
 * Handles time display, markers, and ruler interactions
 */
class Ruler {
public:
    struct RulerSettings {
        int height = 30;
        TimelineView::TimeFormat timeFormat = TimelineView::TimeFormat::MINUTES_SECONDS;
        bool showMarkers = true;
        bool showRegions = true;
        bool showLoopPoints = true;
        bool showPlayhead = true;
        std::string backgroundColor = "#2D2D2D";
        std::string textColor = "#FFFFFF";
        std::string gridColor = "#404040";
        std::string markerColor = "#FF0000";
        std::string regionColor = "#0000FF";
        std::string playheadColor = "#FFFF00";
    };

public:
    Ruler(TimelineView* timeline);
    ~Ruler();

    void SetSettings(const RulerSettings& settings);
    const RulerSettings& GetSettings() const { return m_settings; }

    // Drawing information for UI layer
    struct DrawInfo {
        std::vector<TimelineView::GridLine> gridLines;
        std::vector<TimelineView::TimeMarker> visibleMarkers;
        double playheadPixel = -1;
        double loopStartPixel = -1;
        double loopEndPixel = -1;
        double selectionStartPixel = -1;
        double selectionEndPixel = -1;
    };

    DrawInfo GetDrawInfo() const;

    // Mouse interaction
    bool HandleMouseClick(int x, int y, bool doubleClick = false);
    bool HandleMouseDrag(int x, int y, int deltaX, int deltaY);
    void HandleMouseWheel(int x, int y, int delta);

private:
    TimelineView* m_timeline;
    RulerSettings m_settings;

    // Interaction state
    bool m_draggingPlayhead = false;
    bool m_draggingMarker = false;
    bool m_draggingLoopStart = false;
    bool m_draggingLoopEnd = false;
    int m_dragStartX = 0;
    int m_draggedMarkerIndex = -1;
};