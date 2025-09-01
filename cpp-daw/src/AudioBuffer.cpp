#include "AudioBuffer.hpp"
#include <algorithm>
#include <cstring>

namespace DAW {

AudioBuffer::AudioBuffer(size_t numChannels, size_t numSamples, double sampleRate)
    : m_numChannels(numChannels), m_numSamples(numSamples), m_sampleRate(sampleRate) {
    
    m_data.resize(m_numChannels);
    for (size_t ch = 0; ch < m_numChannels; ++ch) {
        m_data[ch].resize(m_numSamples, 0.0f);
    }
}

void AudioBuffer::resize(size_t numChannels, size_t numSamples) {
    m_numChannels = numChannels;
    m_numSamples = numSamples;
    
    m_data.resize(m_numChannels);
    for (size_t ch = 0; ch < m_numChannels; ++ch) {
        m_data[ch].resize(m_numSamples, 0.0f);
    }
}

void AudioBuffer::clear() {
    for (auto& channel : m_data) {
        std::fill(channel.begin(), channel.end(), 0.0f);
    }
}

void AudioBuffer::clear(size_t channel) {
    if (channel < m_numChannels) {
        std::fill(m_data[channel].begin(), m_data[channel].end(), 0.0f);
    }
}

void AudioBuffer::clearRange(size_t startSample, size_t numSamples) {
    size_t endSample = std::min(startSample + numSamples, m_numSamples);
    for (auto& channel : m_data) {
        std::fill(channel.begin() + startSample, channel.begin() + endSample, 0.0f);
    }
}

float* AudioBuffer::getWritePointer(size_t channel) {
    return (channel < m_numChannels) ? m_data[channel].data() : nullptr;
}

const float* AudioBuffer::getReadPointer(size_t channel) const {
    return (channel < m_numChannels) ? m_data[channel].data() : nullptr;
}

float AudioBuffer::getSample(size_t channel, size_t sample) const {
    if (channel < m_numChannels && sample < m_numSamples) {
        return m_data[channel][sample];
    }
    return 0.0f;
}

void AudioBuffer::setSample(size_t channel, size_t sample, float value) {
    if (channel < m_numChannels && sample < m_numSamples) {
        m_data[channel][sample] = value;
    }
}

void AudioBuffer::addSample(size_t channel, size_t sample, float value) {
    if (channel < m_numChannels && sample < m_numSamples) {
        m_data[channel][sample] += value;
    }
}

void AudioBuffer::addFrom(const AudioBuffer& other) {
    size_t channelsToProcess = std::min(m_numChannels, other.m_numChannels);
    size_t samplesToProcess = std::min(m_numSamples, other.m_numSamples);
    
    for (size_t ch = 0; ch < channelsToProcess; ++ch) {
        for (size_t s = 0; s < samplesToProcess; ++s) {
            m_data[ch][s] += other.m_data[ch][s];
        }
    }
}

void AudioBuffer::addFrom(const AudioBuffer& other, size_t startSample, size_t numSamples) {
    size_t channelsToProcess = std::min(m_numChannels, other.m_numChannels);
    size_t endSample = std::min(startSample + numSamples, m_numSamples);
    
    for (size_t ch = 0; ch < channelsToProcess; ++ch) {
        for (size_t s = startSample; s < endSample; ++s) {
            if (s < other.m_numSamples) {
                m_data[ch][s] += other.m_data[ch][s];
            }
        }
    }
}

void AudioBuffer::copyFrom(const AudioBuffer& other) {
    size_t channelsToProcess = std::min(m_numChannels, other.m_numChannels);
    size_t samplesToProcess = std::min(m_numSamples, other.m_numSamples);
    
    for (size_t ch = 0; ch < channelsToProcess; ++ch) {
        std::copy(other.m_data[ch].begin(), 
                 other.m_data[ch].begin() + samplesToProcess,
                 m_data[ch].begin());
    }
}

void AudioBuffer::applyGain(float gain) {
    for (auto& channel : m_data) {
        for (auto& sample : channel) {
            sample *= gain;
        }
    }
}

void AudioBuffer::applyGain(size_t channel, float gain) {
    if (channel < m_numChannels) {
        for (auto& sample : m_data[channel]) {
            sample *= gain;
        }
    }
}

void AudioBuffer::applyGainRamp(float startGain, float endGain) {
    if (m_numSamples == 0) return;
    
    float gainIncrement = (endGain - startGain) / static_cast<float>(m_numSamples - 1);
    
    for (auto& channel : m_data) {
        float currentGain = startGain;
        for (auto& sample : channel) {
            sample *= currentGain;
            currentGain += gainIncrement;
        }
    }
}

float AudioBuffer::getMagnitude() const {
    float magnitude = 0.0f;
    for (const auto& channel : m_data) {
        for (float sample : channel) {
            magnitude += sample * sample;
        }
    }
    return std::sqrt(magnitude / (m_numChannels * m_numSamples));
}

float AudioBuffer::getRMSLevel(size_t channel) const {
    if (channel >= m_numChannels || m_numSamples == 0) {
        return 0.0f;
    }
    
    float sum = 0.0f;
    for (float sample : m_data[channel]) {
        sum += sample * sample;
    }
    
    return std::sqrt(sum / m_numSamples);
}

} // namespace DAW
