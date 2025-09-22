/*
 * REAPER Web - Media Item System Implementation
 * Non-destructive audio editing with takes, crossfades, and time stretching
 */

#include "media_item.hpp"
#include "../core/audio_engine.hpp"
#include "../core/track_manager.hpp"
#include <algorithm>
#include <random>
#include <sstream>
#include <cmath>
#include <fstream>

// MediaItem Implementation
MediaItem::MediaItem(Track* track, const std::string& sourceFile) : m_track(track) {
    m_state.guid = GenerateGUID();
    m_state.name = sourceFile.empty() ? "Empty Item" : sourceFile;
    m_state.position = 0.0;
    m_state.length = 4.0; // Default 4 second item
    m_state.volume = 1.0;
    m_state.color = "#808080";
    
    // Add initial take if source file provided
    if (!sourceFile.empty()) {
        AddTake(sourceFile);
    }
}

MediaItem::~MediaItem() = default;

void MediaItem::SetName(const std::string& name) {
    m_state.name = name;
}

void MediaItem::SetPosition(double seconds) {
    m_state.position = std::max(0.0, seconds);
}

void MediaItem::SetLength(double seconds) {
    m_state.length = std::max(0.001, seconds); // Minimum 1ms length
}

void MediaItem::SetSnapOffset(double offset) {
    m_state.snapOffset = offset;
}

void MediaItem::SetVolume(double volume) {
    m_state.volume = std::max(0.0, volume);
}

void MediaItem::SetMute(bool mute) {
    m_state.mute = mute;
}

void MediaItem::SetColor(const std::string& color) {
    m_state.color = color;
}

void MediaItem::SetSelected(bool selected) {
    m_state.selected = selected;
}

void MediaItem::SetLocked(bool locked) {
    m_state.locked = locked;
}

void MediaItem::SetGroupId(int groupId) {
    m_state.groupId = groupId;
}

void MediaItem::SetFadeIn(double length, FadeType type) {
    m_state.fadeIn.length = std::max(0.0, std::min(length, m_state.length * 0.5));
    m_state.fadeIn.type = type;
    m_state.fadeIn.enabled = (length > 0.0);
}

void MediaItem::SetFadeOut(double length, FadeType type) {
    m_state.fadeOut.length = std::max(0.0, std::min(length, m_state.length * 0.5));
    m_state.fadeOut.type = type;
    m_state.fadeOut.enabled = (length > 0.0);
}

void MediaItem::ClearFadeIn() {
    m_state.fadeIn.enabled = false;
    m_state.fadeIn.length = 0.0;
}

void MediaItem::ClearFadeOut() {
    m_state.fadeOut.enabled = false;
    m_state.fadeOut.length = 0.0;
}

int MediaItem::AddTake(const std::string& sourceFile) {
    Take take;
    take.guid = GenerateGUID();
    take.name = sourceFile;
    take.source = std::make_shared<AudioSource>(sourceFile);
    
    // Set item length to source length if this is the first take
    if (m_state.takes.empty() && take.source->IsValid()) {
        m_state.length = take.source->GetInfo().length;
    }
    
    m_state.takes.push_back(std::move(take));
    return static_cast<int>(m_state.takes.size()) - 1;
}

bool MediaItem::RemoveTake(int takeIndex) {
    if (takeIndex < 0 || takeIndex >= static_cast<int>(m_state.takes.size())) {
        return false;
    }
    
    // Don't remove the last take
    if (m_state.takes.size() <= 1) {
        return false;
    }
    
    m_state.takes.erase(m_state.takes.begin() + takeIndex);
    
    // Adjust active take index if necessary
    if (m_state.activeTake >= takeIndex) {
        m_state.activeTake = std::max(0, m_state.activeTake - 1);
    }
    
    return true;
}

void MediaItem::SetActiveTake(int takeIndex) {
    if (takeIndex >= 0 && takeIndex < static_cast<int>(m_state.takes.size())) {
        m_state.activeTake = takeIndex;
    }
}

MediaItem::Take* MediaItem::GetTake(int index) {
    if (index >= 0 && index < static_cast<int>(m_state.takes.size())) {
        return &m_state.takes[index];
    }
    return nullptr;
}

const MediaItem::Take* MediaItem::GetTake(int index) const {
    if (index >= 0 && index < static_cast<int>(m_state.takes.size())) {
        return &m_state.takes[index];
    }
    return nullptr;
}

MediaItem::Take* MediaItem::GetActiveTakePtr() {
    return GetTake(m_state.activeTake);
}

const MediaItem::Take* MediaItem::GetActiveTakePtr() const {
    return GetTake(m_state.activeTake);
}

bool MediaItem::Split(double time) {
    if (time <= m_state.position || time >= GetEndPosition()) {
        return false; // Split time is outside item
    }
    
    // Calculate split position within item
    double splitPos = time - m_state.position;
    double originalLength = m_state.length;
    
    // Create new item for the right part
    // This would need to be handled by the MediaItemManager
    // For now, just adjust this item to be the left part
    m_state.length = splitPos;
    
    // Adjust fade out if it extends beyond new length
    if (m_state.fadeOut.enabled && m_state.fadeOut.length > splitPos) {
        m_state.fadeOut.length = splitPos;
    }
    
    return true;
}

bool MediaItem::Trim(double startTime, double endTime) {
    if (startTime >= endTime) return false;
    
    double newPosition = std::max(startTime, m_state.position);
    double newEndPosition = std::min(endTime, GetEndPosition());
    
    if (newPosition >= newEndPosition) return false;
    
    // Adjust source offset for all takes
    double positionDelta = newPosition - m_state.position;
    for (auto& take : m_state.takes) {
        take.sourceOffset += positionDelta / take.playRate;
    }
    
    m_state.position = newPosition;
    m_state.length = newEndPosition - newPosition;
    
    return true;
}

bool MediaItem::Move(double deltaTime) {
    double newPosition = m_state.position + deltaTime;
    if (newPosition < 0.0) return false;
    
    m_state.position = newPosition;
    return true;
}

bool MediaItem::Stretch(double newLength) {
    if (newLength <= 0.0) return false;
    
    double stretchRatio = newLength / m_state.length;
    
    // Update all takes
    for (auto& take : m_state.takes) {
        take.playRate /= stretchRatio;
    }
    
    // Update fades
    if (m_state.fadeIn.enabled) {
        m_state.fadeIn.length *= stretchRatio;
    }
    if (m_state.fadeOut.enabled) {
        m_state.fadeOut.length *= stretchRatio;
    }
    
    m_state.length = newLength;
    return true;
}

bool MediaItem::ChangeRate(double newRate) {
    if (newRate <= 0.0) return false;
    
    auto* activeTake = GetActiveTakePtr();
    if (!activeTake) return false;
    
    double lengthRatio = activeTake->playRate / newRate;
    activeTake->playRate = newRate;
    
    // Adjust item length if not preserving pitch
    if (!activeTake->preservePitch) {
        m_state.length *= lengthRatio;
    }
    
    return true;
}

bool MediaItem::ChangePitch(double semitones) {
    auto* activeTake = GetActiveTakePtr();
    if (!activeTake) return false;
    
    activeTake->pitch = semitones;
    return true;
}

void MediaItem::ProcessAudio(AudioBuffer& buffer, double startTime, double length) {
    if (m_state.mute || m_state.volume <= 0.0) {
        return; // Muted or zero volume
    }
    
    const auto* activeTake = GetActiveTakePtr();
    if (!activeTake || !activeTake->source || !activeTake->source->IsValid()) {
        return; // No valid take
    }
    
    // Check if we need to process any audio in this time range
    double itemStart = m_state.position;
    double itemEnd = itemStart + m_state.length;
    
    if (startTime >= itemEnd || (startTime + length) <= itemStart) {
        return; // No overlap
    }
    
    // Calculate overlap region
    double overlapStart = std::max(startTime, itemStart);
    double overlapEnd = std::min(startTime + length, itemEnd);
    double overlapLength = overlapEnd - overlapStart;
    
    if (overlapLength <= 0.0) return;
    
    // Create process buffer if needed
    if (!m_processBuffer) {
        m_processBuffer = std::make_unique<AudioBuffer>(buffer.GetChannelCount(), 
                                                      static_cast<int>(buffer.GetSampleRate() * overlapLength));
    }
    
    // Process the take
    ProcessTake(*activeTake, *m_processBuffer, overlapStart - itemStart, overlapLength);
    
    // Apply fades
    ApplyFades(*m_processBuffer, overlapStart - itemStart, overlapLength);
    
    // Apply item volume and mix into output buffer
    int startSample = static_cast<int>((overlapStart - startTime) * buffer.GetSampleRate());
    int numSamples = static_cast<int>(overlapLength * buffer.GetSampleRate());
    
    for (int ch = 0; ch < buffer.GetChannelCount(); ++ch) {
        auto* src = m_processBuffer->GetChannelData(ch);
        auto* dst = buffer.GetChannelData(ch) + startSample;
        
        for (int i = 0; i < numSamples; ++i) {
            dst[i] += src[i] * static_cast<float>(m_state.volume);
        }
    }
}

void MediaItem::ProcessTake(const Take& take, AudioBuffer& buffer, double startTime, double length) {
    if (!take.source || !take.source->IsValid()) return;
    
    // Calculate source read position
    double sourceStartTime = take.sourceOffset + (startTime / take.playRate);
    double sourceLength = length / take.playRate;
    
    // Read audio from source
    if (!take.source->ReadAudio(buffer, sourceStartTime, sourceLength)) {
        buffer.Clear(); // Clear buffer if read failed
        return;
    }
    
    // Apply take volume
    if (take.volume != 1.0f) {
        buffer.ApplyGain(static_cast<float>(take.volume));
    }
    
    // Apply phase invert
    if (take.phase) {
        buffer.ApplyGain(-1.0f);
    }
    
    // Apply pitch shift if needed
    if (std::abs(take.pitch) > 0.01) {
        // Pitch shifting would be implemented here
        // This is a complex operation that would require pitch shift algorithms
    }
    
    // Apply time stretching if play rate != 1.0
    if (std::abs(take.playRate - 1.0) > 0.01) {
        // Time stretching implementation based on stretch mode
        switch (take.stretchMode) {
            case StretchMode::ELASTIQUE:
                // StretchElastique(buffer, buffer, take.playRate);
                break;
            case StretchMode::RUBBER_BAND:
                // StretchRubberBand(buffer, buffer, take.playRate);
                break;
            case StretchMode::SIMPLE:
                StretchSimple(buffer, buffer, take.playRate);
                break;
            default:
                break;
        }
    }
}

void MediaItem::ApplyFades(AudioBuffer& buffer, double itemStartTime, double itemLength) {
    int numSamples = buffer.GetSampleCount();
    double sampleRate = buffer.GetSampleRate();
    
    // Apply fade in
    if (m_state.fadeIn.enabled && itemStartTime < m_state.fadeIn.length) {
        int fadeInSamples = static_cast<int>(m_state.fadeIn.length * sampleRate);
        int startSample = static_cast<int>(itemStartTime * sampleRate);
        
        for (int i = 0; i < numSamples; ++i) {
            int globalSample = startSample + i;
            if (globalSample < fadeInSamples) {
                double fadePos = static_cast<double>(globalSample) / fadeInSamples;
                float gain = CalculateFadeGain(fadePos, m_state.fadeIn);
                
                for (int ch = 0; ch < buffer.GetChannelCount(); ++ch) {
                    buffer.GetChannelData(ch)[i] *= gain;
                }
            }
        }
    }
    
    // Apply fade out
    if (m_state.fadeOut.enabled) {
        double fadeOutStart = m_state.length - m_state.fadeOut.length;
        double fadeOutEnd = m_state.length;
        
        if (itemStartTime + itemLength > fadeOutStart) {
            int fadeOutSamples = static_cast<int>(m_state.fadeOut.length * sampleRate);
            int itemEndSample = static_cast<int>(m_state.length * sampleRate);
            int startSample = static_cast<int>(itemStartTime * sampleRate);
            
            for (int i = 0; i < numSamples; ++i) {
                int globalSample = startSample + i;
                int fadeOutSample = itemEndSample - globalSample;
                
                if (fadeOutSample > 0 && fadeOutSample <= fadeOutSamples) {
                    double fadePos = 1.0 - (static_cast<double>(fadeOutSample) / fadeOutSamples);
                    float gain = 1.0f - CalculateFadeGain(fadePos, m_state.fadeOut);
                    
                    for (int ch = 0; ch < buffer.GetChannelCount(); ++ch) {
                        buffer.GetChannelData(ch)[i] *= gain;
                    }
                }
            }
        }
    }
}

float MediaItem::CalculateFadeGain(double position, const Fade& fade) const {
    if (position <= 0.0) return 0.0f;
    if (position >= 1.0) return 1.0f;
    
    double gain = 0.0;
    
    switch (fade.type) {
        case FadeType::LINEAR:
            gain = position;
            break;
            
        case FadeType::LOGARITHMIC:
            gain = std::log(1.0 + position * 9.0) / std::log(10.0);
            break;
            
        case FadeType::EXPONENTIAL:
            gain = (std::exp(position * 3.0) - 1.0) / (std::exp(3.0) - 1.0);
            break;
            
        case FadeType::EQUAL_POWER:
            gain = std::sin(position * M_PI * 0.5);
            break;
            
        case FadeType::FAST_START:
            gain = 1.0 - std::pow(1.0 - position, 2.0);
            break;
            
        case FadeType::FAST_END:
            gain = std::pow(position, 2.0);
            break;
            
        case FadeType::SLOW_START_END:
            gain = 0.5 * (1.0 - std::cos(position * M_PI));
            break;
    }
    
    // Apply curvature adjustment
    if (std::abs(fade.curvature) > 0.01) {
        if (fade.curvature > 0.0) {
            gain = std::pow(gain, 1.0 + fade.curvature);
        } else {
            gain = 1.0 - std::pow(1.0 - gain, 1.0 - fade.curvature);
        }
    }
    
    return static_cast<float>(std::max(0.0, std::min(1.0, gain)));
}

void MediaItem::StretchSimple(AudioBuffer& input, AudioBuffer& output, double ratio) {
    // Simple linear interpolation time stretching
    // This is a basic implementation - professional time stretching is much more complex
    
    int inputSamples = input.GetSampleCount();
    int outputSamples = static_cast<int>(inputSamples * ratio);
    
    output.SetSize(input.GetChannelCount(), outputSamples);
    
    for (int ch = 0; ch < input.GetChannelCount(); ++ch) {
        const float* inputData = input.GetChannelData(ch);
        float* outputData = output.GetChannelData(ch);
        
        for (int i = 0; i < outputSamples; ++i) {
            double sourcePos = i / ratio;
            int sourceIndex = static_cast<int>(sourcePos);
            double fraction = sourcePos - sourceIndex;
            
            if (sourceIndex < inputSamples - 1) {
                // Linear interpolation
                outputData[i] = inputData[sourceIndex] * (1.0f - fraction) + 
                               inputData[sourceIndex + 1] * fraction;
            } else if (sourceIndex < inputSamples) {
                outputData[i] = inputData[sourceIndex];
            } else {
                outputData[i] = 0.0f;
            }
        }
    }
}

bool MediaItem::ContainsTime(double time) const {
    return time >= m_state.position && time < GetEndPosition();
}

bool MediaItem::OverlapsTimeRange(double start, double end) const {
    return !(end <= m_state.position || start >= GetEndPosition());
}

double MediaItem::GetTimeInItem(double globalTime) const {
    return globalTime - m_state.position;
}

const MediaItem::ItemState& MediaItem::GetState() const {
    return m_state;
}

void MediaItem::SetState(const ItemState& state) {
    m_state = state;
}

std::string MediaItem::GenerateGUID() {
    static std::random_device rd;
    static std::mt19937 gen(rd());
    static std::uniform_int_distribution<> dis(0, 15);
    
    std::stringstream ss;
    ss << std::hex;
    
    for (int i = 0; i < 32; ++i) {
        if (i == 8 || i == 12 || i == 16 || i == 20) {
            ss << "-";
        }
        ss << dis(gen);
    }
    
    return ss.str();
}

double MediaItem::ApplyFadeCurve(double position, FadeType type, double curvature) {
    // Static version of fade curve calculation
    MediaItem dummy(nullptr);
    Fade fade;
    fade.type = type;
    fade.curvature = curvature;
    return dummy.CalculateFadeGain(position, fade);
}

// AudioSource Implementation
AudioSource::AudioSource(const std::string& filePath) {
    m_info.type = SourceType::FILE;
    m_info.filePath = filePath;
    LoadFromFile(filePath);
}

AudioSource::AudioSource(SourceType type) {
    m_info.type = type;
    
    switch (type) {
        case SourceType::GENERATED:
            // Initialize for generated audio
            m_info.length = 0.0; // Will be set when generating
            m_info.sampleRate = 48000.0;
            m_info.channels = 2;
            m_info.bitDepth = 32;
            m_info.format = "Generated";
            m_info.isValid = true;
            break;
            
        default:
            m_info.isValid = false;
            break;
    }
}

AudioSource::~AudioSource() = default;

bool AudioSource::ReadAudio(AudioBuffer& buffer, double startTime, double length) {
    if (!m_info.isValid || !m_dataLoaded) {
        return false;
    }
    
    int startSample = static_cast<int>(startTime * m_info.sampleRate);
    int numSamples = static_cast<int>(length * m_info.sampleRate);
    
    return ReadAudioSamples(buffer, startSample, numSamples);
}

bool AudioSource::ReadAudioSamples(AudioBuffer& buffer, int startSample, int numSamples) {
    if (!m_info.isValid || !m_dataLoaded || m_audioData.empty()) {
        return false;
    }
    
    buffer.SetSize(m_info.channels, numSamples);
    
    for (int ch = 0; ch < m_info.channels && ch < buffer.GetChannelCount(); ++ch) {
        float* bufferData = buffer.GetChannelData(ch);
        const auto& channelData = m_audioData[ch];
        
        for (int i = 0; i < numSamples; ++i) {
            int sourceIndex = startSample + i;
            if (sourceIndex >= 0 && sourceIndex < static_cast<int>(channelData.size())) {
                bufferData[i] = channelData[sourceIndex];
            } else {
                bufferData[i] = 0.0f; // Silence for out-of-bounds
            }
        }
    }
    
    return true;
}

void AudioSource::ClearCache() {
    m_cachedBuffers.clear();
    m_peakCache.clear();
}

bool AudioSource::LoadFromFile(const std::string& filePath) {
    m_info.filePath = filePath;
    
    // Determine file type and load accordingly
    std::string extension = filePath.substr(filePath.find_last_of('.') + 1);
    std::transform(extension.begin(), extension.end(), extension.begin(), ::tolower);
    
    bool success = false;
    if (extension == "wav") {
        success = LoadWAVFile(filePath);
    } else if (extension == "flac") {
        success = LoadFLACFile(filePath);
    }
    
    if (success) {
        m_info.isValid = true;
        m_dataLoaded = true;
        UpdatePeakCache();
    }
    
    return success;
}

bool AudioSource::LoadWAVFile(const std::string& filePath) {
    // Simplified WAV loading - in a real implementation, you'd use a proper audio library
    std::ifstream file(filePath, std::ios::binary);
    if (!file.is_open()) {
        return false;
    }
    
    // This is a very basic WAV reader - real implementation would be much more robust
    // For now, just set some default values
    m_info.sampleRate = 48000.0;
    m_info.channels = 2;
    m_info.bitDepth = 24;
    m_info.format = "WAV";
    m_info.length = 10.0; // Default length
    
    // Initialize with silence for now
    int totalSamples = static_cast<int>(m_info.length * m_info.sampleRate);
    m_audioData.resize(m_info.channels);
    for (auto& channel : m_audioData) {
        channel.resize(totalSamples, 0.0f);
    }
    
    return true;
}

bool AudioSource::LoadFLACFile(const std::string& filePath) {
    // FLAC loading would be implemented here using libFLAC
    // For now, return false as it's not implemented
    return false;
}

const AudioSource::PeakData& AudioSource::GetPeakData(int resolution) {
    auto it = m_peakCache.find(resolution);
    if (it != m_peakCache.end()) {
        return it->second;
    }
    
    // Calculate peak data
    CalculatePeakData(resolution);
    return m_peakCache[resolution];
}

void AudioSource::CalculatePeakData(int resolution) {
    if (!m_dataLoaded || m_audioData.empty()) {
        return;
    }
    
    PeakData peakData;
    peakData.samplesPerPeak = resolution;
    
    int totalSamples = static_cast<int>(m_audioData[0].size());
    peakData.numPeaks = (totalSamples + resolution - 1) / resolution;
    
    peakData.minPeaks.resize(peakData.numPeaks);
    peakData.maxPeaks.resize(peakData.numPeaks);
    
    for (int peak = 0; peak < peakData.numPeaks; ++peak) {
        float minVal = 1.0f;
        float maxVal = -1.0f;
        
        int startSample = peak * resolution;
        int endSample = std::min(startSample + resolution, totalSamples);
        
        // Calculate peaks across all channels
        for (int ch = 0; ch < m_info.channels; ++ch) {
            const auto& channelData = m_audioData[ch];
            
            for (int i = startSample; i < endSample; ++i) {
                float sample = channelData[i];
                minVal = std::min(minVal, sample);
                maxVal = std::max(maxVal, sample);
            }
        }
        
        peakData.minPeaks[peak] = minVal;
        peakData.maxPeaks[peak] = maxVal;
    }
    
    m_peakCache[resolution] = std::move(peakData);
}

void AudioSource::UpdatePeakCache() {
    // Clear existing cache and recalculate commonly used resolutions
    m_peakCache.clear();
    
    std::vector<int> commonResolutions = {64, 256, 1024, 4096};
    for (int resolution : commonResolutions) {
        CalculatePeakData(resolution);
    }
}

// MediaItemManager Implementation
MediaItemManager::MediaItemManager() = default;

MediaItemManager::~MediaItemManager() = default;

MediaItem* MediaItemManager::CreateItem(Track* track, const std::string& sourceFile, double position) {
    auto item = std::make_unique<MediaItem>(track, sourceFile);
    item->SetPosition(position);
    
    MediaItem* itemPtr = item.get();
    m_items.push_back(std::move(item));
    
    NotifyItemAdded(itemPtr);
    return itemPtr;
}

MediaItem* MediaItemManager::CreateEmptyItem(Track* track, double position, double length) {
    auto item = std::make_unique<MediaItem>(track);
    item->SetPosition(position);
    item->SetLength(length);
    
    MediaItem* itemPtr = item.get();
    m_items.push_back(std::move(item));
    
    NotifyItemAdded(itemPtr);
    return itemPtr;
}

bool MediaItemManager::DeleteItem(MediaItem* item) {
    auto it = std::find_if(m_items.begin(), m_items.end(),
                          [item](const std::unique_ptr<MediaItem>& ptr) {
                              return ptr.get() == item;
                          });
    
    if (it != m_items.end()) {
        NotifyItemRemoved(item);
        
        // Remove from selection if selected
        auto selIt = std::find(m_selectedItems.begin(), m_selectedItems.end(), item);
        if (selIt != m_selectedItems.end()) {
            m_selectedItems.erase(selIt);
        }
        
        m_items.erase(it);
        return true;
    }
    
    return false;
}

void MediaItemManager::DeleteAllItems() {
    m_selectedItems.clear();
    m_items.clear();
}

std::vector<MediaItem*> MediaItemManager::GetItemsOnTrack(Track* track) const {
    std::vector<MediaItem*> result;
    
    for (const auto& item : m_items) {
        if (item->GetTrack() == track) {
            result.push_back(item.get());
        }
    }
    
    return result;
}

std::vector<MediaItem*> MediaItemManager::GetItemsInTimeRange(double start, double end) const {
    std::vector<MediaItem*> result;
    
    for (const auto& item : m_items) {
        if (item->OverlapsTimeRange(start, end)) {
            result.push_back(item.get());
        }
    }
    
    return result;
}

void MediaItemManager::SelectItem(MediaItem* item, bool addToSelection) {
    if (!addToSelection) {
        ClearSelection();
    }
    
    if (std::find(m_selectedItems.begin(), m_selectedItems.end(), item) == m_selectedItems.end()) {
        m_selectedItems.push_back(item);
        UpdateItemSelection(item, true);
    }
}

void MediaItemManager::ClearSelection() {
    for (auto* item : m_selectedItems) {
        UpdateItemSelection(item, false);
    }
    m_selectedItems.clear();
}

std::vector<MediaItem*> MediaItemManager::GetSelectedItems() const {
    return m_selectedItems;
}

bool MediaItemManager::IsItemSelected(MediaItem* item) const {
    return std::find(m_selectedItems.begin(), m_selectedItems.end(), item) != m_selectedItems.end();
}

void MediaItemManager::MoveSelectedItems(double deltaTime) {
    for (auto* item : m_selectedItems) {
        item->Move(deltaTime);
    }
}

void MediaItemManager::StretchSelectedItems(double factor) {
    for (auto* item : m_selectedItems) {
        item->Stretch(item->GetLength() * factor);
    }
}

void MediaItemManager::SetSelectedItemsVolume(double volume) {
    for (auto* item : m_selectedItems) {
        item->SetVolume(volume);
    }
}

void MediaItemManager::SetSelectedItemsColor(const std::string& color) {
    for (auto* item : m_selectedItems) {
        item->SetColor(color);
    }
}

void MediaItemManager::GroupSelectedItems() {
    if (m_selectedItems.size() < 2) return;
    
    int groupId = GetNextGroupId();
    for (auto* item : m_selectedItems) {
        item->SetGroupId(groupId);
    }
}

void MediaItemManager::UngroupSelectedItems() {
    for (auto* item : m_selectedItems) {
        item->SetGroupId(0);
    }
}

MediaItem* MediaItemManager::GetItemAtTime(Track* track, double time) const {
    for (const auto& item : m_items) {
        if (item->GetTrack() == track && item->ContainsTime(time)) {
            return item.get();
        }
    }
    return nullptr;
}

std::vector<MediaItem*> MediaItemManager::GetItemsAtTime(double time) const {
    std::vector<MediaItem*> result;
    
    for (const auto& item : m_items) {
        if (item->ContainsTime(time)) {
            result.push_back(item.get());
        }
    }
    
    return result;
}

MediaItem* MediaItemManager::FindItemByGUID(const std::string& guid) const {
    for (const auto& item : m_items) {
        if (item->GetGUID() == guid) {
            return item.get();
        }
    }
    return nullptr;
}

void MediaItemManager::NotifyItemAdded(MediaItem* item) {
    // Notify observers that an item was added
    // This would trigger UI updates, etc.
}

void MediaItemManager::NotifyItemRemoved(MediaItem* item) {
    // Notify observers that an item was removed
    // This would trigger UI updates, etc.
}

void MediaItemManager::UpdateItemSelection(MediaItem* item, bool selected) {
    item->SetSelected(selected);
    // Notify UI of selection change
}