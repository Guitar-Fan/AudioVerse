#pragma once

#include "FXPlugin.hpp"
#include <vector>
#include <algorithm>

namespace DAW {

// Equivalent to your JS delay plugin
class DelayPlugin : public FXPlugin {
public:
    DelayPlugin() : FXPlugin("delay", "Stereo Delay", "Ping-pong style delay with feedback and tone") {
        // Add parameters - equivalent to your JS param definitions
        AddParameter(FXParameter::Range("timeL", "Time L", 0.02f, 1.2f, 0.3f, 0.01f));
        AddParameter(FXParameter::Range("timeR", "Time R", 0.02f, 1.2f, 0.45f, 0.01f));
        AddParameter(FXParameter::Range("feedback", "Feedback", 0.0f, 0.95f, 0.35f, 0.01f));
        AddParameter(FXParameter::Range("wet", "Wet", 0.0f, 1.0f, 0.3f, 0.01f));
        AddParameter(FXParameter::Range("tone", "Tone", 500.0f, 8000.0f, 4000.0f, 10.0f));
    }
    
    void Initialize(int sampleRate, int maxBufferSize) override {
        FXPlugin::Initialize(sampleRate, maxBufferSize);
        
        // Initialize delay lines
        int maxDelaySamples = static_cast<int>(1.2f * sampleRate) + 1;
        delayLineL_.resize(maxDelaySamples, 0.0f);
        delayLineR_.resize(maxDelaySamples, 0.0f);
        
        writeIndexL_ = 0;
        writeIndexR_ = 0;
        
        // Initialize tone filter (simple lowpass)
        filterStateL_ = 0.0f;
        filterStateR_ = 0.0f;
    }
    
    void ProcessAudio(AudioBuffer& buffer, int sampleRate) override {
        if (bypassed_) return;
        
        float timeL = GetParameter("timeL");
        float timeR = GetParameter("timeR");
        float feedback = GetParameter("feedback");
        float wet = GetParameter("wet");
        float tone = GetParameter("tone");
        
        // Calculate delay samples
        int delaySamplesL = static_cast<int>(timeL * sampleRate);
        int delaySamplesR = static_cast<int>(timeR * sampleRate);
        
        // Calculate filter coefficient for tone control
        float cutoff = tone / (sampleRate * 0.5f);
        cutoff = std::clamp(cutoff, 0.01f, 0.99f);
        float filterCoeff = cutoff;
        
        int numFrames = buffer.GetNumFrames();
        float* leftChannel = buffer.GetChannelData(0);
        float* rightChannel = buffer.GetChannelData(1);
        
        for (int i = 0; i < numFrames; ++i) {
            // Read from delay lines
            int readIndexL = (writeIndexL_ - delaySamplesL + delayLineL_.size()) % delayLineL_.size();
            int readIndexR = (writeIndexR_ - delaySamplesR + delayLineR_.size()) % delayLineR_.size();
            
            float delayedL = delayLineL_[readIndexL];
            float delayedR = delayLineR_[readIndexR];
            
            // Apply tone filter (simple lowpass)
            filterStateL_ += filterCoeff * (delayedL - filterStateL_);
            filterStateR_ += filterCoeff * (delayedR - filterStateR_);
            delayedL = filterStateL_;
            delayedR = filterStateR_;
            
            // Mix input with cross-fed delay (ping-pong)
            float inputL = leftChannel[i];
            float inputR = rightChannel[i];
            
            float feedbackL = delayedR * feedback; // Cross-feed for ping-pong
            float feedbackR = delayedL * feedback;
            
            // Write to delay lines
            delayLineL_[writeIndexL_] = inputL + feedbackL;
            delayLineR_[writeIndexR_] = inputR + feedbackR;
            
            // Advance write indices
            writeIndexL_ = (writeIndexL_ + 1) % delayLineL_.size();
            writeIndexR_ = (writeIndexR_ + 1) % delayLineR_.size();
            
            // Mix dry and wet signals
            leftChannel[i] = inputL + delayedL * wet;
            rightChannel[i] = inputR + delayedR * wet;
        }
    }
    
    void Reset() override {
        std::fill(delayLineL_.begin(), delayLineL_.end(), 0.0f);
        std::fill(delayLineR_.begin(), delayLineR_.end(), 0.0f);
        writeIndexL_ = 0;
        writeIndexR_ = 0;
        filterStateL_ = 0.0f;
        filterStateR_ = 0.0f;
    }

private:
    std::vector<float> delayLineL_;
    std::vector<float> delayLineR_;
    int writeIndexL_ = 0;
    int writeIndexR_ = 0;
    float filterStateL_ = 0.0f;
    float filterStateR_ = 0.0f;
};

// Equivalent to your JS chorus plugin
class ChorusPlugin : public FXPlugin {
public:
    ChorusPlugin() : FXPlugin("chorus", "Chorus", "Classic chorus using modulated delay") {
        AddParameter(FXParameter::Range("rate", "Rate", 0.05f, 5.0f, 1.2f, 0.01f));
        AddParameter(FXParameter::Range("depth", "Depth", 0.0f, 0.02f, 0.0045f, 0.0001f));
        AddParameter(FXParameter::Range("mix", "Mix", 0.0f, 1.0f, 0.4f, 0.01f));
    }
    
    void Initialize(int sampleRate, int maxBufferSize) override {
        FXPlugin::Initialize(sampleRate, maxBufferSize);
        
        // Initialize delay line for chorus (max 50ms)
        int maxDelaySamples = static_cast<int>(0.05f * sampleRate) + 1;
        delayLine_.resize(maxDelaySamples, 0.0f);
        writeIndex_ = 0;
        lfoPhase_ = 0.0f;
    }
    
    void ProcessAudio(AudioBuffer& buffer, int sampleRate) override {
        if (bypassed_) return;
        
        float rate = GetParameter("rate");
        float depth = GetParameter("depth");
        float mix = GetParameter("mix");
        
        float lfoIncrement = rate * 2.0f * DAW_PI / sampleRate;
        int numFrames = buffer.GetNumFrames();
        
        for (int ch = 0; ch < buffer.GetNumChannels(); ++ch) {
            float* channelData = buffer.GetChannelData(ch);
            float localLfoPhase = lfoPhase_;
            
            for (int i = 0; i < numFrames; ++i) {
                // Calculate LFO modulation
                float lfoValue = std::sin(localLfoPhase);
                float modDelay = depth * sampleRate * (1.0f + lfoValue);
                
                // Read from delay line with interpolation
                float readPos = writeIndex_ - modDelay;
                if (readPos < 0) readPos += delayLine_.size();
                
                int readIndex = static_cast<int>(readPos);
                float frac = readPos - readIndex;
                
                int nextIndex = (readIndex + 1) % delayLine_.size();
                float delayedSample = delayLine_[readIndex] * (1.0f - frac) + delayLine_[nextIndex] * frac;
                
                // Write input to delay line
                if (ch == 0) { // Only write once per frame
                    delayLine_[writeIndex_] = channelData[i];
                }
                
                // Mix dry and wet
                channelData[i] = channelData[i] * (1.0f - mix) + delayedSample * mix;
                
                localLfoPhase += lfoIncrement;
                if (localLfoPhase > 2.0f * DAW_PI) localLfoPhase -= 2.0f * DAW_PI;
            }
        }
        
        // Update global LFO phase and write index
        lfoPhase_ += lfoIncrement * numFrames;
        if (lfoPhase_ > 2.0f * DAW_PI) lfoPhase_ -= 2.0f * DAW_PI;
        writeIndex_ = (writeIndex_ + numFrames) % delayLine_.size();
    }
    
    void Reset() override {
        std::fill(delayLine_.begin(), delayLine_.end(), 0.0f);
        writeIndex_ = 0;
        lfoPhase_ = 0.0f;
    }

private:
    std::vector<float> delayLine_;
    int writeIndex_ = 0;
    float lfoPhase_ = 0.0f;
    
    // Avoid M_PI conflicts
    static constexpr float DAW_PI = 3.14159265358979323846f;
};

// Register the plugins
REGISTER_PLUGIN("delay", DelayPlugin);
REGISTER_PLUGIN("chorus", ChorusPlugin);

} // namespace DAW
