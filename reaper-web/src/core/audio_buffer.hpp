/*
 * REAPER Web - Audio Buffer System
 * High-performance audio buffer management for real-time processing
 * Based on REAPER's audio buffer architecture
 */

#pragma once

#include <vector>
#include <memory>
#include <cstring>
#include <algorithm>

/**
 * AudioBuffer - REAPER-style audio buffer for real-time processing
 * Handles multi-channel audio data with SIMD-friendly alignment
 */
class AudioBuffer {
public:
    AudioBuffer();
    AudioBuffer(int numChannels, int numSamples);
    ~AudioBuffer();
    
    // Buffer management
    void SetSize(int numChannels, int numSamples);
    void Clear();
    void ClearRange(int startSample, int numSamples);
    
    // Data access
    float* GetChannelData(int channel);
    const float* GetChannelData(int channel) const;
    float** GetChannelPointers() { return m_channelPtrs.data(); }
    const float* const* GetChannelPointers() const { return const_cast<const float* const*>(m_channelPtrs.data()); }
    
    // Properties
    int GetChannelCount() const { return m_numChannels; }
    int GetSampleCount() const { return m_numSamples; }
    double GetSampleRate() const { return m_sampleRate; }
    void SetSampleRate(double sampleRate) { m_sampleRate = sampleRate; }
    
    // Audio operations
    void ApplyGain(float gain);
    void ApplyGain(float gain, int startSample, int numSamples);
    void ApplyGainRamp(float startGain, float endGain);
    void ApplyGainRamp(float startGain, float endGain, int startSample, int numSamples);
    
    // Mixing operations
    void AddFrom(const AudioBuffer& source);
    void AddFrom(const AudioBuffer& source, int sourceStartSample, int destStartSample, int numSamples);
    void AddFromWithGain(const AudioBuffer& source, float gain);
    void CopyFrom(const AudioBuffer& source);
    void CopyFrom(const AudioBuffer& source, int sourceStartSample, int destStartSample, int numSamples);
    
    // Channel operations
    void CopyChannel(int sourceChannel, int destChannel);
    void ClearChannel(int channel);
    void ApplyChannelGain(int channel, float gain);
    
    // Utility
    float GetRMSLevel(int channel = -1) const;  // -1 for all channels
    float GetPeakLevel(int channel = -1) const; // -1 for all channels
    void FindMinMax(float& minVal, float& maxVal, int channel = -1) const;
    
    // Memory management
    static void SetDefaultAlignment(size_t alignment) { s_alignment = alignment; }
    static size_t GetDefaultAlignment() { return s_alignment; }
    
private:
    std::vector<float> m_data;          // Interleaved audio data
    std::vector<float*> m_channelPtrs;  // Pointers to channel data
    int m_numChannels = 0;
    int m_numSamples = 0;
    double m_sampleRate = 48000.0;
    
    static size_t s_alignment;          // SIMD alignment (16 bytes default)
    
    void AllocateMemory();
    void SetupChannelPointers();
};

/**
 * AudioBufferPool - Memory pool for audio buffers to avoid real-time allocation
 * Based on REAPER's buffer pool system for low-latency performance
 */
class AudioBufferPool {
public:
    AudioBufferPool(int maxBuffers = 32);
    ~AudioBufferPool();
    
    // Buffer acquisition/release
    AudioBuffer* AcquireBuffer(int numChannels, int numSamples);
    void ReleaseBuffer(AudioBuffer* buffer);
    void ReleaseAll();
    
    // Pool management
    void PreallocateBuffers(int numChannels, int numSamples, int count);
    void ClearUnusedBuffers();
    void SetMaxBuffers(int maxBuffers) { m_maxBuffers = maxBuffers; }
    
    // Statistics
    int GetActiveBuffers() const { return m_activeBuffers; }
    int GetPoolSize() const { return static_cast<int>(m_bufferPool.size()); }
    
private:
    struct PooledBuffer {
        std::unique_ptr<AudioBuffer> buffer;
        bool inUse = false;
        int lastUsedFrame = 0;
    };
    
    std::vector<PooledBuffer> m_bufferPool;
    int m_maxBuffers;
    int m_activeBuffers = 0;
    int m_currentFrame = 0;  // For LRU tracking
    
    AudioBuffer* CreateNewBuffer(int numChannels, int numSamples);
    void CleanupOldBuffers();
};