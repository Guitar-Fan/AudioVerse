#include "Clip.hpp"
#include <algorithm>
#include <cmath>

Clip::Clip(const std::string& name, double sampleRate)
    : m_name(name), m_sampleRate(sampleRate), m_startTime(0.0), m_duration(0.0),
      m_fadeInTime(0.0), m_fadeOutTime(0.0), m_gain(1.0f), m_isLooped(false),
      m_loopStart(0.0), m_loopEnd(0.0), m_pitchShift(0.0f), m_isMuted(false) {
}

Clip::~Clip() = default;

// Copy constructor for clip duplication
Clip::Clip(const Clip& other)
    : m_name(other.m_name + " Copy"), m_sampleRate(other.m_sampleRate),
      m_startTime(other.m_startTime), m_duration(other.m_duration),
      m_fadeInTime(other.m_fadeInTime), m_fadeOutTime(other.m_fadeOutTime),
      m_gain(other.m_gain), m_isLooped(other.m_isLooped),
      m_loopStart(other.m_loopStart), m_loopEnd(other.m_loopEnd),
      m_pitchShift(other.m_pitchShift), m_isMuted(other.m_isMuted) {
    
    // Deep copy audio data
    if (other.m_audioData) {
        m_audioData = std::make_unique<AudioBuffer>(*other.m_audioData);
    }
}

void Clip::process(AudioBuffer& outputBuffer, size_t currentSample, size_t numSamples, bool isPlaying) {
    if (!isPlaying || m_isMuted || !m_audioData || m_duration <= 0.0) {
        return;
    }
    
    double currentTimeSeconds = static_cast<double>(currentSample) / m_sampleRate;
    double clipEndTime = m_startTime + m_duration;
    
    // Check if we're within the clip's time range
    if (currentTimeSeconds >= clipEndTime || (currentTimeSeconds + static_cast<double>(numSamples) / m_sampleRate) <= m_startTime) {
        return;
    }
    
    // Calculate sample positions
    size_t startSampleInClip = 0;
    size_t endSampleInClip = numSamples;
    size_t outputStartSample = 0;
    
    // Adjust for clip start time
    if (currentTimeSeconds < m_startTime) {
        double timeDiff = m_startTime - currentTimeSeconds;
        outputStartSample = static_cast<size_t>(timeDiff * m_sampleRate);
        startSampleInClip = 0;
    } else {
        double timeDiff = currentTimeSeconds - m_startTime;
        startSampleInClip = static_cast<size_t>(timeDiff * m_sampleRate);
    }
    
    // Adjust for clip end time
    if ((currentTimeSeconds + static_cast<double>(numSamples) / m_sampleRate) > clipEndTime) {
        double timeDiff = clipEndTime - currentTimeSeconds;
        endSampleInClip = std::min(numSamples, static_cast<size_t>(timeDiff * m_sampleRate));
    }
    
    // Process the audio
    size_t samplesToProcess = endSampleInClip - outputStartSample;
    if (samplesToProcess == 0) {
        return;
    }
    
    processAudioData(outputBuffer, outputStartSample, startSampleInClip, samplesToProcess);
}

void Clip::processAudioData(AudioBuffer& outputBuffer, size_t outputStartSample, 
                           size_t clipStartSample, size_t numSamples) {
    if (!m_audioData) {
        return;
    }
    
    size_t channelsToProcess = std::min(outputBuffer.getNumChannels(), m_audioData->getNumChannels());
    size_t clipSamples = m_audioData->getNumSamples();
    
    for (size_t ch = 0; ch < channelsToProcess; ++ch) {
        const float* clipData = m_audioData->getReadPointer(ch);
        
        for (size_t i = 0; i < numSamples; ++i) {
            size_t clipPos = clipStartSample + i;
            size_t outputPos = outputStartSample + i;
            
            if (outputPos >= outputBuffer.getNumSamples()) {
                break;
            }
            
            // Handle looping
            if (m_isLooped && clipPos >= clipSamples) {
                size_t loopLength = static_cast<size_t>((m_loopEnd - m_loopStart) * m_sampleRate);
                if (loopLength > 0) {
                    clipPos = static_cast<size_t>(m_loopStart * m_sampleRate) + (clipPos % loopLength);
                } else {
                    clipPos = clipPos % clipSamples;
                }
            }
            
            if (clipPos >= clipSamples) {
                break;
            }
            
            float sample = clipData[clipPos] * m_gain;
            
            // Apply fades
            sample *= calculateFadeMultiplier(clipPos);
            
            // Add to output buffer
            outputBuffer.addSample(ch, outputPos, sample);
        }
    }
}

float Clip::calculateFadeMultiplier(size_t samplePosition) const {
    double timePosition = static_cast<double>(samplePosition) / m_sampleRate;
    float multiplier = 1.0f;
    
    // Fade in
    if (m_fadeInTime > 0.0 && timePosition < m_fadeInTime) {
        multiplier *= static_cast<float>(timePosition / m_fadeInTime);
    }
    
    // Fade out
    if (m_fadeOutTime > 0.0) {
        double fadeOutStart = m_duration - m_fadeOutTime;
        if (timePosition > fadeOutStart) {
            double fadeOutProgress = (timePosition - fadeOutStart) / m_fadeOutTime;
            multiplier *= static_cast<float>(1.0 - fadeOutProgress);
        }
    }
    
    return multiplier;
}

void Clip::loadAudioData(std::unique_ptr<AudioBuffer> audioData) {
    m_audioData = std::move(audioData);
    if (m_audioData) {
        // Update duration based on audio data
        m_duration = static_cast<double>(m_audioData->getNumSamples()) / m_sampleRate;
    }
}

void Clip::setStartTime(double startTime) {
    m_startTime = std::max(0.0, startTime);
}

void Clip::setDuration(double duration) {
    m_duration = std::max(0.0, duration);
}

void Clip::setFadeIn(double fadeTime) {
    m_fadeInTime = std::clamp(fadeTime, 0.0, m_duration * 0.5);
}

void Clip::setFadeOut(double fadeTime) {
    m_fadeOutTime = std::clamp(fadeTime, 0.0, m_duration * 0.5);
}

void Clip::setGain(float gain) {
    m_gain = std::clamp(gain, 0.0f, 10.0f);
}

void Clip::setLooped(bool looped) {
    m_isLooped = looped;
    if (m_isLooped && m_loopEnd <= m_loopStart) {
        m_loopStart = 0.0;
        m_loopEnd = m_duration;
    }
}

void Clip::setLoopPoints(double start, double end) {
    m_loopStart = std::clamp(start, 0.0, m_duration);
    m_loopEnd = std::clamp(end, m_loopStart, m_duration);
}

void Clip::setPitchShift(float semitones) {
    m_pitchShift = std::clamp(semitones, -24.0f, 24.0f);
    // TODO: Implement actual pitch shifting algorithm
}

void Clip::setMuted(bool muted) {
    m_isMuted = muted;
}

void Clip::setSampleRate(double sampleRate) {
    if (sampleRate != m_sampleRate && m_audioData) {
        // Recalculate duration based on new sample rate
        double oldDuration = m_duration;
        m_sampleRate = sampleRate;
        m_duration = static_cast<double>(m_audioData->getNumSamples()) / sampleRate;
        
        // Adjust time-based parameters proportionally
        double ratio = m_duration / oldDuration;
        m_fadeInTime *= ratio;
        m_fadeOutTime *= ratio;
        m_loopStart *= ratio;
        m_loopEnd *= ratio;
    } else {
        m_sampleRate = sampleRate;
    }
}

void Clip::reverse() {
    if (!m_audioData) {
        return;
    }
    
    size_t numSamples = m_audioData->getNumSamples();
    for (size_t ch = 0; ch < m_audioData->getNumChannels(); ++ch) {
        float* channelData = m_audioData->getWritePointer(ch);
        std::reverse(channelData, channelData + numSamples);
    }
}

void Clip::normalize(float targetLevel) {
    if (!m_audioData) {
        return;
    }
    
    // Find peak level
    float peakLevel = 0.0f;
    for (size_t ch = 0; ch < m_audioData->getNumChannels(); ++ch) {
        const float* channelData = m_audioData->getReadPointer(ch);
        for (size_t i = 0; i < m_audioData->getNumSamples(); ++i) {
            peakLevel = std::max(peakLevel, std::abs(channelData[i]));
        }
    }
    
    // Apply normalization gain
    if (peakLevel > 0.0f) {
        float normalizationGain = targetLevel / peakLevel;
        m_audioData->applyGain(normalizationGain);
    }
}

AudioBuffer* Clip::getAudioData() {
    return m_audioData.get();
}

const AudioBuffer* Clip::getAudioData() const {
    return m_audioData.get();
}

double Clip::getEndTime() const {
    return m_startTime + m_duration;
}

bool Clip::containsTime(double time) const {
    return time >= m_startTime && time < getEndTime();
}

void Clip::trimToSelection(double selectionStart, double selectionEnd) {
    if (selectionStart >= selectionEnd || !m_audioData) {
        return;
    }
    
    // Convert to sample positions
    size_t startSample = static_cast<size_t>(selectionStart * m_sampleRate);
    size_t endSample = static_cast<size_t>(selectionEnd * m_sampleRate);
    size_t originalSamples = m_audioData->getNumSamples();
    
    startSample = std::min(startSample, originalSamples);
    endSample = std::min(endSample, originalSamples);
    
    if (startSample >= endSample) {
        return;
    }
    
    // Create new trimmed audio buffer
    size_t newLength = endSample - startSample;
    auto newBuffer = std::make_unique<AudioBuffer>(m_audioData->getNumChannels(), newLength, m_sampleRate);
    
    for (size_t ch = 0; ch < m_audioData->getNumChannels(); ++ch) {
        const float* srcData = m_audioData->getReadPointer(ch);
        float* dstData = newBuffer->getWritePointer(ch);
        
        std::copy(srcData + startSample, srcData + endSample, dstData);
    }
    
    // Update clip properties
    m_audioData = std::move(newBuffer);
    m_duration = static_cast<double>(newLength) / m_sampleRate;
    m_startTime += selectionStart;
}
