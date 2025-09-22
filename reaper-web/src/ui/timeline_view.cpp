/*
 * REAPER Web - Timeline View Implementation
 * Based on REAPER's arrange view time handling and zoom system
 */

#include "timeline_view.hpp"
#include "reaper_engine.hpp"
#include <algorithm>
#include <cmath>
#include <sstream>
#include <iomanip>

TimelineView::TimelineView() {
    // Initialize with default REAPER-style settings
    m_viewState.timeStart = 0.0;
    m_viewState.timeEnd = 60.0;
    m_viewState.zoomLevel = 10.0; // 10 pixels per second initially
    m_viewState.trackHeight = 24;
    m_viewState.rulerHeight = 30;
    m_viewState.timeFormat = TimeFormat::MINUTES_SECONDS;
    m_viewState.snapMode = SnapMode::GRID;
    m_viewState.snapValue = 1.0; // 1 second grid
}

TimelineView::~TimelineView() {
    Shutdown();
}

bool TimelineView::Initialize(ReaperEngine* engine, int width, int height) {
    m_engine = engine;
    m_width = width;
    m_height = height;
    
    // Calculate initial zoom to fit view
    if (width > 0) {
        m_viewState.zoomLevel = static_cast<double>(width) / (m_viewState.timeEnd - m_viewState.timeStart);
    }
    
    return true;
}

void TimelineView::Shutdown() {
    m_engine = nullptr;
    m_markers.clear();
}

void TimelineView::SetViewDimensions(int width, int height) {
    if (width <= 0 || height <= 0) return;
    
    // Preserve zoom level and adjust time range
    double oldTimeRange = GetTimeRange();
    m_width = width;
    m_height = height;
    
    // Update time range to maintain zoom level
    double newTimeRange = static_cast<double>(width) / m_viewState.zoomLevel;
    m_viewState.timeEnd = m_viewState.timeStart + newTimeRange;
    
    RequestRedraw();
}

void TimelineView::SetViewport(double startTime, double endTime) {
    if (startTime >= endTime) return;
    
    m_viewState.timeStart = ClampTime(startTime);
    m_viewState.timeEnd = ClampTime(endTime);
    
    // Update zoom level
    if (m_width > 0) {
        m_viewState.zoomLevel = static_cast<double>(m_width) / GetTimeRange();
        m_viewState.zoomLevel = ClampZoom(m_viewState.zoomLevel);
    }
    
    RequestRedraw();
}

void TimelineView::SetZoomLevel(double pixelsPerSecond) {
    pixelsPerSecond = ClampZoom(pixelsPerSecond);
    
    // Calculate new time range centered on current view
    double centerTime = (m_viewState.timeStart + m_viewState.timeEnd) * 0.5;
    double newTimeRange = static_cast<double>(m_width) / pixelsPerSecond;
    
    m_viewState.timeStart = centerTime - newTimeRange * 0.5;
    m_viewState.timeEnd = centerTime + newTimeRange * 0.5;
    m_viewState.zoomLevel = pixelsPerSecond;
    
    RequestRedraw();
}

double TimelineView::PixelToTime(int pixel) const {
    if (m_width <= 0) return 0.0;
    
    double timeRange = GetTimeRange();
    double ratio = static_cast<double>(pixel) / static_cast<double>(m_width);
    return m_viewState.timeStart + ratio * timeRange;
}

int TimelineView::TimeToPixel(double time) const {
    if (GetTimeRange() <= 0.0) return 0;
    
    double ratio = (time - m_viewState.timeStart) / GetTimeRange();
    return static_cast<int>(ratio * m_width);
}

void TimelineView::ZoomIn(double factor) {
    SetZoomLevel(m_viewState.zoomLevel * factor);
}

void TimelineView::ZoomOut(double factor) {
    SetZoomLevel(m_viewState.zoomLevel / factor);
}

void TimelineView::ZoomToFit() {
    // Zoom to fit entire project length
    if (m_engine) {
        double projectLength = 60.0; // Default, would get from project
        SetViewport(0.0, projectLength);
    }
}

void TimelineView::ZoomToSelection() {
    if (HasTimeSelection()) {
        double padding = (m_selectionEnd - m_selectionStart) * 0.1; // 10% padding
        SetViewport(m_selectionStart - padding, m_selectionEnd + padding);
    }
}

void TimelineView::ZoomToTimeRange(double startTime, double endTime) {
    if (startTime < endTime) {
        double padding = (endTime - startTime) * 0.05; // 5% padding
        SetViewport(startTime - padding, endTime + padding);
    }
}

void TimelineView::ScrollTo(double time) {
    double timeRange = GetTimeRange();
    m_viewState.timeStart = time;
    m_viewState.timeEnd = time + timeRange;
    RequestRedraw();
}

void TimelineView::ScrollBy(double deltaTime) {
    m_viewState.timeStart += deltaTime;
    m_viewState.timeEnd += deltaTime;
    RequestRedraw();
}

void TimelineView::ScrollToPlayhead() {
    if (m_engine) {
        double playPos = m_engine->GetTransportState().playPosition.load();
        
        // Scroll to center playhead if it's not visible
        if (playPos < m_viewState.timeStart || playPos > m_viewState.timeEnd) {
            CenterOnTime(playPos);
        }
    }
}

void TimelineView::CenterOnTime(double time) {
    double timeRange = GetTimeRange();
    m_viewState.timeStart = time - timeRange * 0.5;
    m_viewState.timeEnd = time + timeRange * 0.5;
    RequestRedraw();
}

std::string TimelineView::FormatTime(double time) const {
    return FormatTime(time, m_viewState.timeFormat);
}

std::string TimelineView::FormatTime(double time, TimeFormat format) const {
    switch (format) {
        case TimeFormat::SECONDS:
            return FormatSecondsTime(time);
        case TimeFormat::SAMPLES:
            return FormatSamplesTime(time);
        case TimeFormat::MEASURES_BEATS:
            return FormatMeasuresBeatsTime(time);
        case TimeFormat::MINUTES_SECONDS:
            return FormatMinutesSecondsTime(time);
        case TimeFormat::TIMECODE:
            return FormatTimecodeTime(time);
        case TimeFormat::BARS_BEATS_TICKS:
            return FormatBarsBeatsTicksTime(time);
        default:
            return FormatSecondsTime(time);
    }
}

void TimelineView::SetTimeFormat(TimeFormat format) {
    m_viewState.timeFormat = format;
    RequestRedraw();
}

void TimelineView::SetSnapMode(SnapMode mode) {
    m_viewState.snapMode = mode;
}

void TimelineView::SetSnapValue(double value) {
    m_viewState.snapValue = std::max(0.001, value); // Minimum 1ms snap
}

double TimelineView::SnapTime(double time) const {
    if (m_viewState.snapMode == SnapMode::OFF) {
        return time;
    }
    
    switch (m_viewState.snapMode) {
        case SnapMode::GRID:
            return SnapToGrid(time);
        case SnapMode::BEATS:
            return SnapToBeats(time);
        case SnapMode::MEASURES:
            return SnapToMeasures(time);
        case SnapMode::SECONDS:
            return SnapToSeconds(time);
        case SnapMode::SAMPLES:
            return SnapToSamples(time);
        case SnapMode::MARKERS:
            return SnapToMarkers(time);
        case SnapMode::ITEMS:
            return SnapToItems(time);
        default:
            return time;
    }
}

std::vector<TimelineView::GridLine> TimelineView::CalculateGridLines() const {
    std::vector<GridLine> lines;
    
    switch (m_viewState.timeFormat) {
        case TimeFormat::MEASURES_BEATS:
        case TimeFormat::BARS_BEATS_TICKS:
            CalculateBeatsGrid(lines);
            break;
        case TimeFormat::SAMPLES:
            CalculateSamplesGrid(lines);
            break;
        default:
            CalculateSecondsGrid(lines);
            break;
    }
    
    return lines;
}

void TimelineView::AddMarker(double time, const std::string& name, const std::string& color) {
    TimeMarker marker;
    marker.time = time;
    marker.name = name;
    marker.color = color;
    marker.isRegion = false;
    
    m_markers.push_back(marker);
    RequestRedraw();
}

void TimelineView::AddRegion(double startTime, double endTime, const std::string& name, const std::string& color) {
    TimeMarker region;
    region.time = startTime;
    region.regionEnd = endTime;
    region.name = name;
    region.color = color;
    region.isRegion = true;
    
    m_markers.push_back(region);
    RequestRedraw();
}

void TimelineView::SetTimeSelection(double start, double end) {
    if (start > end) std::swap(start, end);
    
    m_hasTimeSelection = true;
    m_selectionStart = start;
    m_selectionEnd = end;
    RequestRedraw();
}

void TimelineView::ClearTimeSelection() {
    m_hasTimeSelection = false;
    RequestRedraw();
}

void TimelineView::SetPlayheadPosition(double time) {
    m_playheadPosition = time;
    RequestRedraw();
}

void TimelineView::SetLoopPoints(double start, double end) {
    if (start > end) std::swap(start, end);
    
    m_hasLoopPoints = true;
    m_loopStart = start;
    m_loopEnd = end;
    RequestRedraw();
}

void TimelineView::UpdateFromEngine() {
    if (!m_engine) return;
    
    // Update playhead position
    const auto& transport = m_engine->GetTransportState();
    SetPlayheadPosition(transport.playPosition.load());
    
    // Update loop points
    if (transport.loop.load()) {
        SetLoopPoints(transport.loopStart.load(), transport.loopEnd.load());
    } else {
        ClearLoopPoints();
    }
}

double TimelineView::GetTimeAtMouse(int mouseX) const {
    return PixelToTime(mouseX);
}

int TimelineView::GetTrackAtMouse(int mouseY) const {
    if (mouseY < m_viewState.rulerHeight) {
        return -1; // In ruler area
    }
    
    int trackY = mouseY - m_viewState.rulerHeight;
    return trackY / m_viewState.trackHeight;
}

bool TimelineView::IsInRuler(int mouseY) const {
    return mouseY >= 0 && mouseY < m_viewState.rulerHeight;
}

// Private helper methods
std::string TimelineView::FormatSecondsTime(double time) const {
    std::ostringstream oss;
    oss << std::fixed << std::setprecision(3) << time << "s";
    return oss.str();
}

std::string TimelineView::FormatMinutesSecondsTime(double time) const {
    int minutes = static_cast<int>(time / 60.0);
    double seconds = fmod(time, 60.0);
    
    std::ostringstream oss;
    oss << minutes << ":" << std::fixed << std::setprecision(3) << std::setfill('0') << std::setw(6) << seconds;
    return oss.str();
}

std::string TimelineView::FormatMeasuresBeatsTime(double time) const {
    if (!m_engine) return "1:1.000";
    
    double tempo = m_engine->GetTransportState().tempo.load();
    double beats = SecondsToBeats(time, tempo);
    int timeSigNum = m_engine->GetTransportState().timeSigNumerator.load();
    
    int measure = static_cast<int>(beats / timeSigNum) + 1;
    double beat = fmod(beats, timeSigNum) + 1.0;
    
    std::ostringstream oss;
    oss << measure << ":" << std::fixed << std::setprecision(3) << beat;
    return oss.str();
}

std::string TimelineView::FormatSamplesTime(double time) const {
    double sampleRate = m_engine ? m_engine->GetGlobalSettings().sampleRate : 48000.0;
    int samples = SecondsToSamples(time, sampleRate);
    return std::to_string(samples);
}

std::string TimelineView::FormatTimecodeTime(double time) const {
    int hours = static_cast<int>(time / 3600.0);
    int minutes = static_cast<int>((time - hours * 3600.0) / 60.0);
    double seconds = fmod(time, 60.0);
    
    std::ostringstream oss;
    oss << std::setfill('0') << std::setw(2) << hours << ":"
        << std::setw(2) << minutes << ":"
        << std::fixed << std::setprecision(3) << std::setw(6) << seconds;
    return oss.str();
}

std::string TimelineView::FormatBarsBeatsTicksTime(double time) const {
    // Similar to measures/beats but with ticks subdivision
    return FormatMeasuresBeatsTime(time);
}

void TimelineView::CalculateSecondsGrid(std::vector<GridLine>& lines) const {
    double spacing = CalculateGridSpacing();
    double startTime = floor(m_viewState.timeStart / spacing) * spacing;
    
    for (double time = startTime; time <= m_viewState.timeEnd + spacing; time += spacing) {
        if (time >= m_viewState.timeStart - spacing && time <= m_viewState.timeEnd + spacing) {
            GridLine line;
            line.time = time;
            line.type = (fmod(time, spacing * 5.0) < 0.001) ? 1 : 0; // Major every 5 units
            line.label = FormatTime(time);
            lines.push_back(line);
        }
    }
}

void TimelineView::CalculateBeatsGrid(std::vector<GridLine>& lines) const {
    if (!m_engine) {
        CalculateSecondsGrid(lines);
        return;
    }
    
    double tempo = m_engine->GetTransportState().tempo.load();
    double beatLength = 60.0 / tempo; // Length of one beat in seconds
    
    double startBeat = floor(m_viewState.timeStart / beatLength);
    double endBeat = ceil(m_viewState.timeEnd / beatLength);
    
    for (double beat = startBeat; beat <= endBeat; beat += 1.0) {
        double time = beat * beatLength;
        if (time >= m_viewState.timeStart && time <= m_viewState.timeEnd) {
            GridLine line;
            line.time = time;
            line.type = (fmod(beat, 4.0) < 0.001) ? 1 : 0; // Major every 4 beats (measure)
            line.label = FormatTime(time);
            lines.push_back(line);
        }
    }
}

void TimelineView::CalculateSamplesGrid(std::vector<GridLine>& lines) const {
    double sampleRate = m_engine ? m_engine->GetGlobalSettings().sampleRate : 48000.0;
    double spacing = CalculateGridSpacing() * sampleRate;
    
    // Round to nearest power of 10 samples
    double logSpacing = log10(spacing);
    spacing = pow(10.0, floor(logSpacing));
    
    double startSample = floor(m_viewState.timeStart * sampleRate / spacing) * spacing;
    
    for (double sample = startSample; sample <= (m_viewState.timeEnd * sampleRate) + spacing; sample += spacing) {
        double time = sample / sampleRate;
        if (time >= m_viewState.timeStart && time <= m_viewState.timeEnd) {
            GridLine line;
            line.time = time;
            line.type = (fmod(sample, spacing * 10.0) < 1.0) ? 1 : 0;
            line.label = std::to_string(static_cast<int>(sample));
            lines.push_back(line);
        }
    }
}

double TimelineView::CalculateGridSpacing() const {
    // Calculate grid spacing to maintain reasonable visual density
    double timeRange = GetTimeRange();
    double targetLines = m_width / 50.0; // Aim for ~50 pixels between lines
    
    double roughSpacing = timeRange / targetLines;
    
    // Round to nice values
    double logSpacing = log10(roughSpacing);
    double baseSpacing = pow(10.0, floor(logSpacing));
    double remainder = roughSpacing / baseSpacing;
    
    if (remainder >= 5.0) return baseSpacing * 10.0;
    if (remainder >= 2.0) return baseSpacing * 5.0;
    if (remainder >= 1.0) return baseSpacing * 2.0;
    return baseSpacing;
}

double TimelineView::SnapToGrid(double time) const {
    return round(time / m_viewState.snapValue) * m_viewState.snapValue;
}

double TimelineView::SnapToSeconds(double time) const {
    return round(time);
}

double TimelineView::SnapToBeats(double time) const {
    if (!m_engine) return time;
    
    double tempo = m_engine->GetTransportState().tempo.load();
    double beatLength = 60.0 / tempo;
    return round(time / beatLength) * beatLength;
}

double TimelineView::ClampZoom(double zoom) const {
    return std::clamp(zoom, MIN_ZOOM, MAX_ZOOM);
}

double TimelineView::ClampTime(double time) const {
    return std::max(0.0, time);
}

void TimelineView::RequestRedraw() {
    if (m_redrawCallback) {
        m_redrawCallback();
    }
}

// Static utility methods
double TimelineView::BeatsToSeconds(double beats, double tempo) {
    return beats * (60.0 / tempo);
}

double TimelineView::SecondsToBeats(double seconds, double tempo) {
    return seconds * (tempo / 60.0);
}

int TimelineView::SecondsToSamples(double seconds, double sampleRate) {
    return static_cast<int>(seconds * sampleRate);
}

double TimelineView::SamplesToSeconds(int samples, double sampleRate) {
    return static_cast<double>(samples) / sampleRate;
}