#include "BasicFX.hpp"
#include <cmath>
#include <algorithm>

namespace DAW {

// DelayFX Implementation
DelayFX::DelayFX() : FXPlugin("Delay") {
    addParameter("delayTime", 0.25f, 0.001f, 2.0f, "Delay Time");
    addParameter("feedback", 0.3f, 0.0f, 0.95f, "Feedback");
    addParameter("wetLevel", 0.3f, 0.0f, 1.0f, "Wet Level");
    addParameter("dryLevel", 0.7f, 0.0f, 1.0f, "Dry Level");
    
    // Initialize with default sample rate
    setSampleRate(44100.0);
}

void DelayFX::setSampleRate(double sampleRate) {
    m_sampleRate = sampleRate;
    
    // Resize delay buffers for maximum delay time (2 seconds)
    size_t maxDelaySamples = static_cast<size_t>(sampleRate * 2.0);
    m_delayBufferL.resize(maxDelaySamples, 0.0f);
    m_delayBufferR.resize(maxDelaySamples, 0.0f);
    
    m_writePosition = 0;
}

void DelayFX::process(AudioBuffer& buffer, size_t numSamples) {
    if (!isEnabled() || buffer.getNumChannels() < 2) {
        return;
    }
    
    float delayTime = getParameter("delayTime");
    float feedback = getParameter("feedback");
    float wetLevel = getParameter("wetLevel");
    float dryLevel = getParameter("dryLevel");
    
    size_t delaySamples = static_cast<size_t>(delayTime * m_sampleRate);
    delaySamples = std::min(delaySamples, m_delayBufferL.size() - 1);
    
    float* leftChannel = buffer.getWritePointer(0);
    float* rightChannel = buffer.getWritePointer(1);
    
    for (size_t i = 0; i < numSamples; ++i) {
        // Calculate read position
        size_t readPosition = (m_writePosition >= delaySamples) ? 
            (m_writePosition - delaySamples) : 
            (m_delayBufferL.size() - delaySamples + m_writePosition);
        
        // Read delayed samples
        float delayedL = m_delayBufferL[readPosition];
        float delayedR = m_delayBufferR[readPosition];
        
        // Input samples
        float inputL = leftChannel[i];
        float inputR = rightChannel[i];
        
        // Write to delay buffer with feedback
        m_delayBufferL[m_writePosition] = inputL + (delayedL * feedback);
        m_delayBufferR[m_writePosition] = inputR + (delayedR * feedback);
        
        // Mix dry and wet signals
        leftChannel[i] = (inputL * dryLevel) + (delayedL * wetLevel);
        rightChannel[i] = (inputR * dryLevel) + (delayedR * wetLevel);
        
        // Advance write position
        m_writePosition = (m_writePosition + 1) % m_delayBufferL.size();
    }
}

void DelayFX::reset() {
    std::fill(m_delayBufferL.begin(), m_delayBufferL.end(), 0.0f);
    std::fill(m_delayBufferR.begin(), m_delayBufferR.end(), 0.0f);
    m_writePosition = 0;
}

// ChorusFX Implementation
ChorusFX::ChorusFX() : FXPlugin("Chorus") {
    addParameter("rate", 0.5f, 0.1f, 5.0f, "Rate");
    addParameter("depth", 0.3f, 0.0f, 1.0f, "Depth");
    addParameter("wetLevel", 0.5f, 0.0f, 1.0f, "Wet Level");
    addParameter("dryLevel", 0.5f, 0.0f, 1.0f, "Dry Level");
    addParameter("voices", 0.5f, 0.0f, 1.0f, "Voices"); // 0.0 = 2 voices, 1.0 = 4 voices
    
    // Initialize with default sample rate
    setSampleRate(44100.0);
    m_phase = 0.0f;
}

void ChorusFX::setSampleRate(double sampleRate) {
    m_sampleRate = sampleRate;
    
    // Resize delay buffers for chorus effect (50ms max delay)
    size_t maxDelaySamples = static_cast<size_t>(sampleRate * 0.05);
    m_delayBufferL.resize(maxDelaySamples, 0.0f);
    m_delayBufferR.resize(maxDelaySamples, 0.0f);
    
    m_writePosition = 0;
}

void ChorusFX::process(AudioBuffer& buffer, size_t numSamples) {
    if (!isEnabled() || buffer.getNumChannels() < 2) {
        return;
    }
    
    float rate = getParameter("rate");
    float depth = getParameter("depth");
    float wetLevel = getParameter("wetLevel");
    float dryLevel = getParameter("dryLevel");
    float voicesParam = getParameter("voices");
    
    int numVoices = (voicesParam < 0.5f) ? 2 : 4;
    float phaseIncrement = (2.0f * M_PI * rate) / static_cast<float>(m_sampleRate);
    
    float* leftChannel = buffer.getWritePointer(0);
    float* rightChannel = buffer.getWritePointer(1);
    
    for (size_t i = 0; i < numSamples; ++i) {
        float inputL = leftChannel[i];
        float inputR = rightChannel[i];
        
        // Write input to delay buffer
        m_delayBufferL[m_writePosition] = inputL;
        m_delayBufferR[m_writePosition] = inputR;
        
        float chorusL = 0.0f;
        float chorusR = 0.0f;
        
        // Generate multiple chorus voices
        for (int voice = 0; voice < numVoices; ++voice) {
            float voicePhase = m_phase + (voice * 2.0f * M_PI / numVoices);
            float lfoValue = std::sin(voicePhase);
            
            // Calculate delay time (5-25ms modulated by LFO)
            float baseDelay = (voice + 1) * 0.005f; // 5ms, 10ms, 15ms, 20ms
            float modulatedDelay = baseDelay + (lfoValue * depth * 0.01f);
            size_t delaySamples = static_cast<size_t>(modulatedDelay * m_sampleRate);
            delaySamples = std::min(delaySamples, m_delayBufferL.size() - 1);
            
            // Calculate read position with interpolation
            size_t readPosition = (m_writePosition >= delaySamples) ?
                (m_writePosition - delaySamples) :
                (m_delayBufferL.size() - delaySamples + m_writePosition);
            
            // Linear interpolation for smoother modulation
            size_t nextPosition = (readPosition + 1) % m_delayBufferL.size();
            float fraction = modulatedDelay * m_sampleRate - delaySamples;
            
            float delayedL = m_delayBufferL[readPosition] * (1.0f - fraction) +
                           m_delayBufferL[nextPosition] * fraction;
            float delayedR = m_delayBufferR[readPosition] * (1.0f - fraction) +
                           m_delayBufferR[nextPosition] * fraction;
            
            chorusL += delayedL / numVoices;
            chorusR += delayedR / numVoices;
        }
        
        // Mix dry and wet signals
        leftChannel[i] = (inputL * dryLevel) + (chorusL * wetLevel);
        rightChannel[i] = (inputR * dryLevel) + (chorusR * wetLevel);
        
        // Advance positions
        m_writePosition = (m_writePosition + 1) % m_delayBufferL.size();
        m_phase += phaseIncrement;
        if (m_phase >= 2.0f * M_PI) {
            m_phase -= 2.0f * M_PI;
        }
    }
}

void ChorusFX::reset() {
    std::fill(m_delayBufferL.begin(), m_delayBufferL.end(), 0.0f);
    std::fill(m_delayBufferR.begin(), m_delayBufferR.end(), 0.0f);
    m_writePosition = 0;
    m_phase = 0.0f;
}

// ReverbFX Implementation
ReverbFX::ReverbFX() : FXPlugin("Reverb") {
    addParameter("roomSize", 0.5f, 0.0f, 1.0f, "Room Size");
    addParameter("damping", 0.5f, 0.0f, 1.0f, "Damping");
    addParameter("wetLevel", 0.3f, 0.0f, 1.0f, "Wet Level");
    addParameter("dryLevel", 0.7f, 0.0f, 1.0f, "Dry Level");
    addParameter("width", 1.0f, 0.0f, 1.0f, "Stereo Width");
    
    setSampleRate(44100.0);
}

void ReverbFX::setSampleRate(double sampleRate) {
    m_sampleRate = sampleRate;
    
    // Initialize comb filters with different delay times (in samples)
    std::vector<size_t> combDelays = {1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116};
    std::vector<size_t> allpassDelays = {225, 556, 441, 341};
    
    m_combFilters.clear();
    m_allpassFilters.clear();
    
    for (size_t delay : combDelays) {
        size_t adjustedDelay = static_cast<size_t>(delay * sampleRate / 44100.0);
        m_combFilters.emplace_back(adjustedDelay);
    }
    
    for (size_t delay : allpassDelays) {
        size_t adjustedDelay = static_cast<size_t>(delay * sampleRate / 44100.0);
        m_allpassFilters.emplace_back(adjustedDelay);
    }
}

void ReverbFX::process(AudioBuffer& buffer, size_t numSamples) {
    if (!isEnabled() || buffer.getNumChannels() < 2) {
        return;
    }
    
    float roomSize = getParameter("roomSize");
    float damping = getParameter("damping");
    float wetLevel = getParameter("wetLevel");
    float dryLevel = getParameter("dryLevel");
    float width = getParameter("width");
    
    float* leftChannel = buffer.getWritePointer(0);
    float* rightChannel = buffer.getWritePointer(1);
    
    for (size_t i = 0; i < numSamples; ++i) {
        float inputL = leftChannel[i];
        float inputR = rightChannel[i];
        float inputMono = (inputL + inputR) * 0.5f;
        
        float reverbL = 0.0f;
        float reverbR = 0.0f;
        
        // Process through comb filters
        for (size_t cf = 0; cf < m_combFilters.size(); ++cf) {
            float combOut = m_combFilters[cf].process(inputMono, roomSize, damping);
            
            // Pan odd/even comb filters left/right
            if (cf % 2 == 0) {
                reverbL += combOut;
            } else {
                reverbR += combOut;
            }
        }
        
        // Process through allpass filters for diffusion
        for (auto& allpass : m_allpassFilters) {
            reverbL = allpass.process(reverbL, 0.5f);
            reverbR = allpass.process(reverbR, 0.5f);
        }
        
        // Apply stereo width
        float mid = (reverbL + reverbR) * 0.5f;
        float side = (reverbL - reverbR) * 0.5f * width;
        reverbL = mid + side;
        reverbR = mid - side;
        
        // Mix with dry signal
        leftChannel[i] = (inputL * dryLevel) + (reverbL * wetLevel);
        rightChannel[i] = (inputR * dryLevel) + (reverbR * wetLevel);
    }
}

void ReverbFX::reset() {
    for (auto& comb : m_combFilters) {
        comb.reset();
    }
    for (auto& allpass : m_allpassFilters) {
        allpass.reset();
    }
}

// CombFilter Implementation
ReverbFX::CombFilter::CombFilter(size_t delayLength) 
    : m_delayLength(delayLength), m_writePos(0), m_filterState(0.0f) {
    m_buffer.resize(delayLength, 0.0f);
}

float ReverbFX::CombFilter::process(float input, float feedback, float damping) {
    float output = m_buffer[m_writePos];
    
    // Apply damping filter (simple lowpass)
    m_filterState = output * (1.0f - damping) + m_filterState * damping;
    
    m_buffer[m_writePos] = input + (m_filterState * feedback);
    m_writePos = (m_writePos + 1) % m_delayLength;
    
    return output;
}

void ReverbFX::CombFilter::reset() {
    std::fill(m_buffer.begin(), m_buffer.end(), 0.0f);
    m_writePos = 0;
    m_filterState = 0.0f;
}

// AllpassFilter Implementation
ReverbFX::AllpassFilter::AllpassFilter(size_t delayLength) 
    : m_delayLength(delayLength), m_writePos(0) {
    m_buffer.resize(delayLength, 0.0f);
}

float ReverbFX::AllpassFilter::process(float input, float feedback) {
    float delayedInput = m_buffer[m_writePos];
    float output = -input * feedback + delayedInput;
    
    m_buffer[m_writePos] = input + (delayedInput * feedback);
    m_writePos = (m_writePos + 1) % m_delayLength;
    
    return output;
}

void ReverbFX::AllpassFilter::reset() {
    }
}

} // namespace DAW
