#pragma once

#include <vector>
#include <memory>
#include <cstring>
#include <cmath>

namespace DAW {

using SampleType = float;

// Equivalent to your Web Audio API AudioBuffer
class AudioBuffer {
public:
    AudioBuffer(int numChannels, int numFrames)
        : numChannels_(numChannels), numFrames_(numFrames) {
        channels_.resize(numChannels);
        for (auto& channel : channels_) {
            channel.resize(numFrames, 0.0f);
        }
    }
    
    AudioBuffer(int numChannels, int numFrames, SampleType* interleavedData)
        : AudioBuffer(numChannels, numFrames) {
        // Convert interleaved to planar
        for (int frame = 0; frame < numFrames; ++frame) {
            for (int ch = 0; ch < numChannels; ++ch) {
                channels_[ch][frame] = interleavedData[frame * numChannels + ch];
            }
        }
    }
    
    // Access channel data
    SampleType* GetChannelData(int channel) {
        if (channel >= 0 && channel < numChannels_) {
            return channels_[channel].data();
        }
        return nullptr;
    }
    
    const SampleType* GetChannelData(int channel) const {
        if (channel >= 0 && channel < numChannels_) {
            return channels_[channel].data();
        }
        return nullptr;
    }
    
    // Buffer properties
    int GetNumChannels() const { return numChannels_; }
    int GetNumFrames() const { return numFrames_; }
    
    // Clear all channels
    void Clear() {
        for (auto& channel : channels_) {
            std::fill(channel.begin(), channel.end(), 0.0f);
        }
    }
    
    // Copy from another buffer
    void CopyFrom(const AudioBuffer& other, int startFrame = 0) {
        int framesToCopy = std::min(numFrames_ - startFrame, other.numFrames_);
        int channelsToCopy = std::min(numChannels_, other.numChannels_);
        
        for (int ch = 0; ch < channelsToCopy; ++ch) {
            std::memcpy(
                channels_[ch].data() + startFrame,
                other.channels_[ch].data(),
                framesToCopy * sizeof(SampleType)
            );
        }
    }
    
    // Mix from another buffer (add)
    void MixFrom(const AudioBuffer& other, float gain = 1.0f, int startFrame = 0) {
        int framesToMix = std::min(numFrames_ - startFrame, other.numFrames_);
        int channelsToMix = std::min(numChannels_, other.numChannels_);
        
        for (int ch = 0; ch < channelsToMix; ++ch) {
            for (int frame = 0; frame < framesToMix; ++frame) {
                channels_[ch][startFrame + frame] += other.channels_[ch][frame] * gain;
            }
        }
    }
    
    // Apply gain to all channels
    void ApplyGain(float gain) {
        for (auto& channel : channels_) {
            for (auto& sample : channel) {
                sample *= gain;
            }
        }
    }
    
    // Get peak level for metering
    float GetPeakLevel(int channel) const {
        if (channel >= 0 && channel < numChannels_) {
            float peak = 0.0f;
            for (auto sample : channels_[channel]) {
                peak = std::max(peak, std::abs(sample));
            }
            return peak;
        }
        return 0.0f;
    }
    
    // Get RMS level for metering
    float GetRMSLevel(int channel) const {
        if (channel >= 0 && channel < numChannels_) {
            float sum = 0.0f;
            for (auto sample : channels_[channel]) {
                sum += sample * sample;
            }
            return std::sqrt(sum / numFrames_);
        }
        return 0.0f;
    }
    
    // Resize buffer (clears existing data)
    void Resize(int numChannels, int numFrames) {
        numChannels_ = numChannels;
        numFrames_ = numFrames;
        channels_.resize(numChannels);
        for (auto& channel : channels_) {
            channel.resize(numFrames, 0.0f);
        }
    }

private:
    int numChannels_;
    int numFrames_;
    std::vector<std::vector<SampleType>> channels_;
};

// Helper for creating temporary buffers
class TempAudioBuffer : public AudioBuffer {
public:
    TempAudioBuffer(int numChannels, int numFrames) 
        : AudioBuffer(numChannels, numFrames) {}
    
    // Automatically clears on destruction for clean reuse
    ~TempAudioBuffer() {
        Clear();
    }
};

} // namespace DAW
