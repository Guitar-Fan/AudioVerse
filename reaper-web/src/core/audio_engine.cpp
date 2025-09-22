/*
 * REAPER Web - Audio Engine Implementation
 * Based on REAPER's real-time audio processing patterns
 */

#include "audio_engine.hpp"
#include "track_manager.hpp"
#include "../media/media_item.hpp"
#include <algorithm>
#include <chrono>
#include <cmath>

AudioEngine::AudioEngine() {
    // Initialize performance stats
    m_stats.cpuUsage = 0.0;
    m_stats.peakCpuUsage = 0.0;
    m_stats.dropouts = 0;
    m_stats.activePlugins = 0;
    m_stats.samplesProcessed = 0;
    m_stats.latencyMs = 0.0;
    
    // Initialize buffer pool
    m_bufferPool = std::make_unique<AudioBufferPool>(32); // 32 buffer max pool
}

AudioEngine::~AudioEngine() {
    Shutdown();
}

bool AudioEngine::Initialize(double sampleRate, int bufferSize, int maxChannels) {
    if (m_initialized.load()) {
        return true;
    }
    
    m_settings.sampleRate = sampleRate;
    m_settings.bufferSize = bufferSize;
    m_settings.maxChannels = maxChannels;
    m_settings.inputChannels = 2;
    m_settings.outputChannels = 2;
    
    // Allocate buffer pool for real-time processing
    AllocateBufferPool();
    
    // Initialize PDC system
    m_trackDelays.resize(64, 0); // Support up to 64 tracks initially
    
    // Set latency calculation
    m_stats.latencyMs = (static_cast<double>(bufferSize) / sampleRate) * 1000.0;
    
    m_initialized = true;
    return true;
}

void AudioEngine::Shutdown() {
    if (!m_initialized.load()) {
        return;
    }
    
    StopPlayback();
    StopRecording();
    
    // Clear tracks
    {
        std::lock_guard<std::mutex> lock(m_tracksMutex);
        m_tracks.clear();
    }
    
    // Deallocate buffer pool
    DeallocateBufferPool();
    
    m_initialized = false;
}

void AudioEngine::StartPlayback() {
    m_isPlaying = true;
}

void AudioEngine::StopPlayback() {
    m_isPlaying = false;
}

void AudioEngine::PausePlayback() {
    // In REAPER, pause keeps the position
    m_isPlaying = false;
}

void AudioEngine::StartRecording() {
    m_isRecording = true;
    m_isPlaying = true; // Recording implies playback
}

void AudioEngine::StopRecording() {
    m_isRecording = false;
}

void AudioEngine::SetPlayPosition(double seconds) {
    m_playPosition = std::max(0.0, seconds);
}

void AudioEngine::ProcessBlock(float** inputs, float** outputs, int numChannels, int numSamples) {
    auto startTime = std::chrono::high_resolution_clock::now();
    
    if (!m_initialized.load()) {
        // Output silence if not initialized
        for (int ch = 0; ch < numChannels; ++ch) {
            std::fill(outputs[ch], outputs[ch] + numSamples, 0.0f);
        }
        return;
    }
    
    // Acquire buffer for processing
    AudioBuffer* masterBuffer = AcquireBuffer(numChannels, numSamples);
    if (!masterBuffer) {
        // Fallback: output silence
        for (int ch = 0; ch < numChannels; ++ch) {
            std::fill(outputs[ch], outputs[ch] + numSamples, 0.0f);
        }
        m_stats.dropouts++;
        return;
    }
    
    // Clear master buffer
    masterBuffer->Clear();
    
    // Copy input to master buffer if monitoring
    if (inputs && m_settings.inputMonitoring.load()) {
        for (int ch = 0; ch < std::min(numChannels, masterBuffer->GetChannelCount()); ++ch) {
            std::copy(inputs[ch], inputs[ch] + numSamples, masterBuffer->GetChannelData(ch));
        }
    }
    
    // Process all tracks
    ProcessTracks(*masterBuffer);
    
    // Process master bus
    ProcessMasterBus(*masterBuffer);
    
    // Copy to outputs
    for (int ch = 0; ch < std::min(numChannels, masterBuffer->GetChannelCount()); ++ch) {
        std::copy(masterBuffer->GetChannelData(ch), 
                 masterBuffer->GetChannelData(ch) + numSamples, outputs[ch]);
    }
    
    // Release buffer
    ReleaseBuffer(masterBuffer);
    
    // Update performance stats
    auto endTime = std::chrono::high_resolution_clock::now();
    auto duration = std::chrono::duration_cast<std::chrono::microseconds>(endTime - startTime);
    double processingTime = duration.count() / 1000.0; // Convert to milliseconds
    
    UpdatePerformanceStats(processingTime);
    
    // Update sample counter
    m_stats.samplesProcessed += numSamples;
}

void AudioEngine::ProcessBlock(float** inputs, float** outputs, int numChannels, int numSamples,
                             MediaItemManager* mediaManager, TrackManager* trackManager, 
                             double startTime, double blockLength) {
    auto processingStartTime = std::chrono::high_resolution_clock::now();
    
    if (!m_initialized.load()) {
        // Output silence if not initialized
        for (int ch = 0; ch < numChannels; ++ch) {
            std::fill(outputs[ch], outputs[ch] + numSamples, 0.0f);
        }
        return;
    }
    
    // Acquire buffer for processing
    AudioBuffer* masterBuffer = AcquireBuffer(numChannels, numSamples);
    if (!masterBuffer) {
        // Fallback: output silence
        for (int ch = 0; ch < numChannels; ++ch) {
            std::fill(outputs[ch], outputs[ch] + numSamples, 0.0f);
        }
        m_stats.dropouts++;
        return;
    }
    
    // Clear master buffer
    masterBuffer->Clear();
    
    // Copy input to master buffer if monitoring
    if (inputs && m_settings.inputMonitoring.load()) {
        for (int ch = 0; ch < std::min(numChannels, masterBuffer->GetChannelCount()); ++ch) {
            std::copy(inputs[ch], inputs[ch] + numSamples, masterBuffer->GetChannelData(ch));
        }
    }
    
    // Process all tracks with media items
    ProcessTracks(mediaManager, trackManager, startTime, blockLength, *masterBuffer);
    
    // Process master bus
    ProcessMasterBus(*masterBuffer);
    
    // Copy to outputs
    for (int ch = 0; ch < std::min(numChannels, masterBuffer->GetChannelCount()); ++ch) {
        std::copy(masterBuffer->GetChannelData(ch), 
                 masterBuffer->GetChannelData(ch) + numSamples, outputs[ch]);
    }
    
    // Release buffer
    ReleaseBuffer(masterBuffer);
    
    // Update performance stats
    auto endTime = std::chrono::high_resolution_clock::now();
    auto duration = std::chrono::duration_cast<std::chrono::microseconds>(endTime - processingStartTime);
    double processingTime = duration.count() / 1000.0; // Convert to milliseconds
    
    UpdatePerformanceStats(processingTime);
    
    // Update sample counter
    m_stats.samplesProcessed += numSamples;
}

void AudioEngine::ProcessTracks(MediaItemManager* mediaManager, TrackManager* trackManager, 
                              double startTime, double length, AudioBuffer& masterBuffer) {
    if (!mediaManager || !trackManager) return;
    
    // Get all tracks
    auto tracks = trackManager->GetAllTracks();
    
    for (Track* track : tracks) {
        if (!track) continue;
        
        // Get a buffer for this track
        AudioBuffer* trackBuffer = AcquireBuffer(masterBuffer.GetChannelCount(), masterBuffer.GetSampleCount());
        if (!trackBuffer) continue;
        
        // Clear track buffer
        trackBuffer->Clear();
        
        // Get media items on this track
        auto trackItems = mediaManager->GetItemsOnTrack(track);
        
        // Process each media item
        for (MediaItem* item : trackItems) {
            if (!item) continue;
            
            // Check if item overlaps with current time range
            if (item->OverlapsTimeRange(startTime, startTime + length)) {
                // Process audio from this media item
                item->ProcessAudio(*trackBuffer, startTime, length);
            }
        }
        
        // Apply track volume, pan, mute, solo, and effects
        // (Track processing would be implemented here)
        
        // Mix track into master buffer
        masterBuffer.AddFrom(*trackBuffer);
        
        // Release track buffer
        ReleaseBuffer(trackBuffer);
    }
}
        
        // Mix into master buffer
        masterBuffer.AddFrom(*trackBuffer, 1.0f);
        
        ReleaseBuffer(trackBuffer);
    }
}

void AudioEngine::ProcessMasterBus(AudioBuffer& buffer) {
    if (!buffer.isValid) return;
    
    // Apply master volume
    float masterVol = m_masterVolume.load();
    bool masterMute = m_realtimeSettings.masterMute.load();
    
    if (masterMute) {
        buffer.Clear();
        return;
    }
    
    if (masterVol != 1.0f) {
        for (int ch = 0; ch < buffer.numChannels; ++ch) {
            for (int i = 0; i < buffer.numSamples; ++i) {
                buffer.channels[ch][i] *= masterVol;
            }
        }
    }
    
    // Apply master pan (for stereo)
    if (buffer.numChannels >= 2) {
        float pan = m_masterPan.load();
        if (pan != 0.0f) {
            float leftGain = PanToGainLeft(pan);
            float rightGain = PanToGainRight(pan);
            
            for (int i = 0; i < buffer.numSamples; ++i) {
                buffer.channels[0][i] *= leftGain;
                buffer.channels[1][i] *= rightGain;
            }
        }
    }
}

void AudioEngine::AddTrack(Track* track) {
    std::lock_guard<std::mutex> lock(m_tracksMutex);
    m_tracks.push_back(track);
}

void AudioEngine::RemoveTrack(Track* track) {
    std::lock_guard<std::mutex> lock(m_tracksMutex);
    auto it = std::find(m_tracks.begin(), m_tracks.end(), track);
    if (it != m_tracks.end()) {
        m_tracks.erase(it);
    }
}

void AudioEngine::ClearTracks() {
    std::lock_guard<std::mutex> lock(m_tracksMutex);
    m_tracks.clear();
}

AudioBuffer* AudioEngine::AcquireBuffer(int channels, int samples) {
    return m_bufferPool->AcquireBuffer(channels, samples);
}

void AudioEngine::ReleaseBuffer(AudioBuffer* buffer) {
    m_bufferPool->ReleaseBuffer(buffer);
}

void AudioEngine::AllocateBufferPool() {
    std::lock_guard<std::mutex> lock(m_bufferMutex);
    
    // Allocate a pool of buffers for real-time use
    const int poolSize = 16; // Number of buffers in pool
    
    for (int i = 0; i < poolSize; ++i) {
        auto buffer = std::make_unique<AudioBuffer>(m_settings.maxChannels, m_settings.bufferSize * 2);
        m_availableBuffers.push_back(buffer.get());
        m_bufferPool.push_back(std::move(buffer));
    }
}

void AudioEngine::DeallocateBufferPool() {
    std::lock_guard<std::mutex> lock(m_bufferMutex);
    m_availableBuffers.clear();
    m_bufferPool.clear();
}

void AudioEngine::UpdatePerformanceStats(double processingTime) {
    m_processingTimeAccumulator += processingTime;
    m_processCallCount++;
    
    auto now = std::chrono::high_resolution_clock::now();
    
    // Update stats every 100ms
    if (std::chrono::duration_cast<std::chrono::milliseconds>(now - m_lastStatsUpdate).count() > 100) {
        double avgProcessingTime = m_processingTimeAccumulator / m_processCallCount;
        double blockTime = (static_cast<double>(m_settings.bufferSize) / m_settings.sampleRate) * 1000.0;
        double cpuUsage = (avgProcessingTime / blockTime) * 100.0;
        
        m_stats.cpuUsage = std::min(cpuUsage, 100.0);
        m_stats.peakCpuUsage = std::max(m_stats.peakCpuUsage.load(), cpuUsage);
        
        // Reset counters
        m_processingTimeAccumulator = 0.0;
        m_processCallCount = 0;
        m_lastStatsUpdate = now;
    }
}

bool AudioEngine::IsRealtimeThread() const {
    return std::this_thread::get_id() == m_realtimeThreadId;
}

// Static utility functions
float AudioEngine::DBToLinear(float db) {
    return std::pow(10.0f, db / 20.0f);
}

float AudioEngine::LinearToDB(float linear) {
    return 20.0f * std::log10(std::max(linear, 0.000001f));
}

float AudioEngine::PanToGainLeft(float pan) {
    // REAPER-style pan law (-3dB center)
    return std::sqrt((1.0f - pan) * 0.5f);
}

float AudioEngine::PanToGainRight(float pan) {
    // REAPER-style pan law (-3dB center)
    return std::sqrt((1.0f + pan) * 0.5f);
}

void AudioEngine::ApplyFade(float* buffer, int samples, float startGain, float endGain) {
    if (samples <= 0) return;
    
    float gainStep = (endGain - startGain) / static_cast<float>(samples - 1);
    float currentGain = startGain;
    
    for (int i = 0; i < samples; ++i) {
        buffer[i] *= currentGain;
        currentGain += gainStep;
    }
}