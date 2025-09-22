/*
 * REAPER Web - Audio Buffer Implementation
 * High-performance audio buffer management for real-time processing
 */

#include "audio_buffer.hpp"
#include <cmath>
#include <algorithm>
#include <cstdlib>

// Static member initialization
size_t AudioBuffer::s_alignment = 16; // 16-byte alignment for SIMD

// AudioBuffer Implementation
AudioBuffer::AudioBuffer() = default;

AudioBuffer::AudioBuffer(int numChannels, int numSamples) {
    SetSize(numChannels, numSamples);
}

AudioBuffer::~AudioBuffer() = default;

void AudioBuffer::SetSize(int numChannels, int numSamples) {
    if (numChannels == m_numChannels && numSamples == m_numSamples) {
        return; // No change needed
    }
    
    m_numChannels = std::max(0, numChannels);
    m_numSamples = std::max(0, numSamples);
    
    if (m_numChannels > 0 && m_numSamples > 0) {
        AllocateMemory();
        SetupChannelPointers();
    } else {
        m_data.clear();
        m_channelPtrs.clear();
    }
}

void AudioBuffer::Clear() {
    if (!m_data.empty()) {
        std::fill(m_data.begin(), m_data.end(), 0.0f);
    }
}

void AudioBuffer::ClearRange(int startSample, int numSamples) {
    if (startSample < 0 || startSample >= m_numSamples) return;
    
    int endSample = std::min(startSample + numSamples, m_numSamples);
    int samplesToClear = endSample - startSample;
    
    for (int ch = 0; ch < m_numChannels; ++ch) {
        std::fill(m_channelPtrs[ch] + startSample, 
                 m_channelPtrs[ch] + startSample + samplesToClear, 0.0f);
    }
}

float* AudioBuffer::GetChannelData(int channel) {
    if (channel >= 0 && channel < m_numChannels) {
        return m_channelPtrs[channel];
    }
    return nullptr;
}

const float* AudioBuffer::GetChannelData(int channel) const {
    if (channel >= 0 && channel < m_numChannels) {
        return m_channelPtrs[channel];
    }
    return nullptr;
}

void AudioBuffer::ApplyGain(float gain) {
    if (gain == 1.0f) return; // No change needed
    
    for (int ch = 0; ch < m_numChannels; ++ch) {
        float* channelData = m_channelPtrs[ch];
        for (int i = 0; i < m_numSamples; ++i) {
            channelData[i] *= gain;
        }
    }
}

void AudioBuffer::ApplyGain(float gain, int startSample, int numSamples) {
    if (gain == 1.0f || startSample < 0 || startSample >= m_numSamples) return;
    
    int endSample = std::min(startSample + numSamples, m_numSamples);
    int samplesToProcess = endSample - startSample;
    
    for (int ch = 0; ch < m_numChannels; ++ch) {
        float* channelData = m_channelPtrs[ch] + startSample;
        for (int i = 0; i < samplesToProcess; ++i) {
            channelData[i] *= gain;
        }
    }
}

void AudioBuffer::ApplyGainRamp(float startGain, float endGain) {
    ApplyGainRamp(startGain, endGain, 0, m_numSamples);
}

void AudioBuffer::ApplyGainRamp(float startGain, float endGain, int startSample, int numSamples) {
    if (startSample < 0 || startSample >= m_numSamples) return;
    
    int endSample = std::min(startSample + numSamples, m_numSamples);
    int samplesToProcess = endSample - startSample;
    
    if (samplesToProcess <= 0) return;
    
    float gainDelta = (endGain - startGain) / static_cast<float>(samplesToProcess - 1);
    
    for (int ch = 0; ch < m_numChannels; ++ch) {
        float* channelData = m_channelPtrs[ch] + startSample;
        float currentGain = startGain;
        
        for (int i = 0; i < samplesToProcess; ++i) {
            channelData[i] *= currentGain;
            currentGain += gainDelta;
        }
    }
}

void AudioBuffer::AddFrom(const AudioBuffer& source) {
    int channelsToProcess = std::min(m_numChannels, source.m_numChannels);
    int samplesToProcess = std::min(m_numSamples, source.m_numSamples);
    
    for (int ch = 0; ch < channelsToProcess; ++ch) {
        const float* srcData = source.m_channelPtrs[ch];
        float* dstData = m_channelPtrs[ch];
        
        for (int i = 0; i < samplesToProcess; ++i) {
            dstData[i] += srcData[i];
        }
    }
}

void AudioBuffer::AddFrom(const AudioBuffer& source, int sourceStartSample, int destStartSample, int numSamples) {
    if (sourceStartSample < 0 || destStartSample < 0 ||
        sourceStartSample >= source.m_numSamples || destStartSample >= m_numSamples) {
        return;
    }
    
    int channelsToProcess = std::min(m_numChannels, source.m_numChannels);
    int srcSamplesToProcess = std::min(numSamples, source.m_numSamples - sourceStartSample);
    int dstSamplesToProcess = std::min(numSamples, m_numSamples - destStartSample);
    int samplesToProcess = std::min(srcSamplesToProcess, dstSamplesToProcess);
    
    for (int ch = 0; ch < channelsToProcess; ++ch) {
        const float* srcData = source.m_channelPtrs[ch] + sourceStartSample;
        float* dstData = m_channelPtrs[ch] + destStartSample;
        
        for (int i = 0; i < samplesToProcess; ++i) {
            dstData[i] += srcData[i];
        }
    }
}

void AudioBuffer::AddFromWithGain(const AudioBuffer& source, float gain) {
    int channelsToProcess = std::min(m_numChannels, source.m_numChannels);
    int samplesToProcess = std::min(m_numSamples, source.m_numSamples);
    
    for (int ch = 0; ch < channelsToProcess; ++ch) {
        const float* srcData = source.m_channelPtrs[ch];
        float* dstData = m_channelPtrs[ch];
        
        for (int i = 0; i < samplesToProcess; ++i) {
            dstData[i] += srcData[i] * gain;
        }
    }
}

void AudioBuffer::CopyFrom(const AudioBuffer& source) {
    int channelsToProcess = std::min(m_numChannels, source.m_numChannels);
    int samplesToProcess = std::min(m_numSamples, source.m_numSamples);
    
    for (int ch = 0; ch < channelsToProcess; ++ch) {
        std::copy(source.m_channelPtrs[ch], 
                 source.m_channelPtrs[ch] + samplesToProcess,
                 m_channelPtrs[ch]);
    }
    
    // Clear remaining channels if destination has more channels
    for (int ch = channelsToProcess; ch < m_numChannels; ++ch) {
        std::fill(m_channelPtrs[ch], m_channelPtrs[ch] + m_numSamples, 0.0f);
    }
}

void AudioBuffer::CopyFrom(const AudioBuffer& source, int sourceStartSample, int destStartSample, int numSamples) {
    if (sourceStartSample < 0 || destStartSample < 0 ||
        sourceStartSample >= source.m_numSamples || destStartSample >= m_numSamples) {
        return;
    }
    
    int channelsToProcess = std::min(m_numChannels, source.m_numChannels);
    int srcSamplesToProcess = std::min(numSamples, source.m_numSamples - sourceStartSample);
    int dstSamplesToProcess = std::min(numSamples, m_numSamples - destStartSample);
    int samplesToProcess = std::min(srcSamplesToProcess, dstSamplesToProcess);
    
    for (int ch = 0; ch < channelsToProcess; ++ch) {
        std::copy(source.m_channelPtrs[ch] + sourceStartSample,
                 source.m_channelPtrs[ch] + sourceStartSample + samplesToProcess,
                 m_channelPtrs[ch] + destStartSample);
    }
}

void AudioBuffer::CopyChannel(int sourceChannel, int destChannel) {
    if (sourceChannel < 0 || sourceChannel >= m_numChannels ||
        destChannel < 0 || destChannel >= m_numChannels) {
        return;
    }
    
    if (sourceChannel != destChannel) {
        std::copy(m_channelPtrs[sourceChannel], 
                 m_channelPtrs[sourceChannel] + m_numSamples,
                 m_channelPtrs[destChannel]);
    }
}

void AudioBuffer::ClearChannel(int channel) {
    if (channel >= 0 && channel < m_numChannels) {
        std::fill(m_channelPtrs[channel], m_channelPtrs[channel] + m_numSamples, 0.0f);
    }
}

void AudioBuffer::ApplyChannelGain(int channel, float gain) {
    if (channel >= 0 && channel < m_numChannels && gain != 1.0f) {
        float* channelData = m_channelPtrs[channel];
        for (int i = 0; i < m_numSamples; ++i) {
            channelData[i] *= gain;
        }
    }
}

float AudioBuffer::GetRMSLevel(int channel) const {
    if (m_numSamples == 0) return 0.0f;
    
    double sum = 0.0;
    int channelsToProcess = (channel < 0) ? m_numChannels : 1;
    int startChannel = (channel < 0) ? 0 : channel;
    int endChannel = (channel < 0) ? m_numChannels : channel + 1;
    
    for (int ch = startChannel; ch < endChannel; ++ch) {
        if (ch >= m_numChannels) break;
        
        const float* channelData = m_channelPtrs[ch];
        for (int i = 0; i < m_numSamples; ++i) {
            double sample = static_cast<double>(channelData[i]);
            sum += sample * sample;
        }
    }
    
    double mean = sum / (m_numSamples * channelsToProcess);
    return static_cast<float>(std::sqrt(mean));
}

float AudioBuffer::GetPeakLevel(int channel) const {
    if (m_numSamples == 0) return 0.0f;
    
    float peak = 0.0f;
    int startChannel = (channel < 0) ? 0 : channel;
    int endChannel = (channel < 0) ? m_numChannels : channel + 1;
    
    for (int ch = startChannel; ch < endChannel; ++ch) {
        if (ch >= m_numChannels) break;
        
        const float* channelData = m_channelPtrs[ch];
        for (int i = 0; i < m_numSamples; ++i) {
            peak = std::max(peak, std::abs(channelData[i]));
        }
    }
    
    return peak;
}

void AudioBuffer::FindMinMax(float& minVal, float& maxVal, int channel) const {
    minVal = 0.0f;
    maxVal = 0.0f;
    
    if (m_numSamples == 0) return;
    
    int startChannel = (channel < 0) ? 0 : channel;
    int endChannel = (channel < 0) ? m_numChannels : channel + 1;
    
    bool firstSample = true;
    
    for (int ch = startChannel; ch < endChannel; ++ch) {
        if (ch >= m_numChannels) break;
        
        const float* channelData = m_channelPtrs[ch];
        for (int i = 0; i < m_numSamples; ++i) {
            float sample = channelData[i];
            if (firstSample) {
                minVal = maxVal = sample;
                firstSample = false;
            } else {
                minVal = std::min(minVal, sample);
                maxVal = std::max(maxVal, sample);
            }
        }
    }
}

void AudioBuffer::AllocateMemory() {
    size_t totalSamples = static_cast<size_t>(m_numChannels) * m_numSamples;
    
    // Add padding for alignment
    size_t paddedSize = totalSamples + (s_alignment / sizeof(float));
    m_data.resize(paddedSize);
}

void AudioBuffer::SetupChannelPointers() {
    m_channelPtrs.resize(m_numChannels);
    
    // Align first channel pointer
    uintptr_t dataPtr = reinterpret_cast<uintptr_t>(m_data.data());
    uintptr_t alignedPtr = (dataPtr + s_alignment - 1) & ~(s_alignment - 1);
    float* alignedData = reinterpret_cast<float*>(alignedPtr);
    
    // Set up channel pointers (non-interleaved)
    for (int ch = 0; ch < m_numChannels; ++ch) {
        m_channelPtrs[ch] = alignedData + (ch * m_numSamples);
    }
}

// AudioBufferPool Implementation
AudioBufferPool::AudioBufferPool(int maxBuffers) : m_maxBuffers(maxBuffers) {
    m_bufferPool.reserve(maxBuffers);
}

AudioBufferPool::~AudioBufferPool() = default;

AudioBuffer* AudioBufferPool::AcquireBuffer(int numChannels, int numSamples) {
    m_currentFrame++;
    
    // Look for available buffer with matching size
    for (auto& pooled : m_bufferPool) {
        if (!pooled.inUse && 
            pooled.buffer->GetChannelCount() == numChannels &&
            pooled.buffer->GetSampleCount() == numSamples) {
            
            pooled.inUse = true;
            pooled.lastUsedFrame = m_currentFrame;
            m_activeBuffers++;
            
            // Clear the buffer before returning
            pooled.buffer->Clear();
            return pooled.buffer.get();
        }
    }
    
    // Create new buffer if pool isn't full
    if (static_cast<int>(m_bufferPool.size()) < m_maxBuffers) {
        return CreateNewBuffer(numChannels, numSamples);
    }
    
    // Pool is full, look for least recently used buffer to repurpose
    int oldestIndex = -1;
    int oldestFrame = m_currentFrame + 1;
    
    for (int i = 0; i < static_cast<int>(m_bufferPool.size()); ++i) {
        if (!m_bufferPool[i].inUse && m_bufferPool[i].lastUsedFrame < oldestFrame) {
            oldestFrame = m_bufferPool[i].lastUsedFrame;
            oldestIndex = i;
        }
    }
    
    if (oldestIndex >= 0) {
        auto& pooled = m_bufferPool[oldestIndex];
        pooled.buffer->SetSize(numChannels, numSamples);
        pooled.buffer->Clear();
        pooled.inUse = true;
        pooled.lastUsedFrame = m_currentFrame;
        m_activeBuffers++;
        return pooled.buffer.get();
    }
    
    // No available buffer found
    return nullptr;
}

void AudioBufferPool::ReleaseBuffer(AudioBuffer* buffer) {
    if (!buffer) return;
    
    for (auto& pooled : m_bufferPool) {
        if (pooled.buffer.get() == buffer && pooled.inUse) {
            pooled.inUse = false;
            m_activeBuffers--;
            break;
        }
    }
}

void AudioBufferPool::ReleaseAll() {
    for (auto& pooled : m_bufferPool) {
        pooled.inUse = false;
    }
    m_activeBuffers = 0;
}

void AudioBufferPool::PreallocateBuffers(int numChannels, int numSamples, int count) {
    for (int i = 0; i < count && static_cast<int>(m_bufferPool.size()) < m_maxBuffers; ++i) {
        CreateNewBuffer(numChannels, numSamples);
    }
}

void AudioBufferPool::ClearUnusedBuffers() {
    auto it = std::remove_if(m_bufferPool.begin(), m_bufferPool.end(),
                            [](const PooledBuffer& pooled) {
                                return !pooled.inUse;
                            });
    m_bufferPool.erase(it, m_bufferPool.end());
}

AudioBuffer* AudioBufferPool::CreateNewBuffer(int numChannels, int numSamples) {
    PooledBuffer pooled;
    pooled.buffer = std::make_unique<AudioBuffer>(numChannels, numSamples);
    pooled.inUse = true;
    pooled.lastUsedFrame = m_currentFrame;
    
    AudioBuffer* bufferPtr = pooled.buffer.get();
    m_bufferPool.push_back(std::move(pooled));
    m_activeBuffers++;
    
    return bufferPtr;
}