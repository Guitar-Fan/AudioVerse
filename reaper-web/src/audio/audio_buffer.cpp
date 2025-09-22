/*
 * REAPER Web - Audio Buffer Implementation
 * Efficient audio buffer management for real-time processing
 */

#include "audio_engine.hpp"
#include <algorithm>
#include <cstring>
#include <cmath>

// AudioBuffer implementation
AudioEngine::AudioBuffer::AudioBuffer(int channels, int samples) {
    Allocate(channels, samples);
}

AudioEngine::AudioBuffer::~AudioBuffer() {
    if (channels) {
        for (int i = 0; i < numChannels; ++i) {
            delete[] channels[i];
        }
        delete[] channels;
    }
}

void AudioEngine::AudioBuffer::Allocate(int channels, int samples) {
    // Clean up existing allocation
    if (this->channels) {
        for (int i = 0; i < numChannels; ++i) {
            delete[] this->channels[i];
        }
        delete[] this->channels;
    }
    
    numChannels = channels;
    numSamples = samples;
    
    if (channels > 0 && samples > 0) {
        this->channels = new float*[channels];
        for (int i = 0; i < channels; ++i) {
            this->channels[i] = new float[samples];
            std::fill(this->channels[i], this->channels[i] + samples, 0.0f);
        }
        isValid = true;
    } else {
        this->channels = nullptr;
        isValid = false;
    }
}

void AudioEngine::AudioBuffer::Clear() {
    if (!isValid) return;
    
    for (int ch = 0; ch < numChannels; ++ch) {
        std::fill(channels[ch], channels[ch] + numSamples, 0.0f);
    }
}

void AudioEngine::AudioBuffer::CopyFrom(const AudioBuffer& other) {
    if (!isValid || !other.isValid) return;
    
    int copyChannels = std::min(numChannels, other.numChannels);
    int copySamples = std::min(numSamples, other.numSamples);
    
    for (int ch = 0; ch < copyChannels; ++ch) {
        std::copy(other.channels[ch], other.channels[ch] + copySamples, channels[ch]);
    }
}

void AudioEngine::AudioBuffer::AddFrom(const AudioBuffer& other, float gain) {
    if (!isValid || !other.isValid) return;
    
    int copyChannels = std::min(numChannels, other.numChannels);
    int copySamples = std::min(numSamples, other.numSamples);
    
    for (int ch = 0; ch < copyChannels; ++ch) {
        for (int i = 0; i < copySamples; ++i) {
            channels[ch][i] += other.channels[ch][i] * gain;
        }
    }
}