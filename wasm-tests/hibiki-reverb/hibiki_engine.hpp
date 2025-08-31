#pragma once

#include <array>
#include <vector>
#include <cmath>
#include <algorithm>
#include <random>

// Helper clamp function for C++14 compatibility
template<typename T>
constexpr const T& clamp(const T& v, const T& lo, const T& hi) {
    return (v < lo) ? lo : (hi < v) ? hi : v;
}

// Constants for Hibiki reverb
const int HIBIKI_BUFFER_SIZE = 256;
const float HIBIKI_SCALE = 0.8f;

// Simple delay line implementation
class HibikiDelayLine {
private:
    std::vector<float> buffer;
    int writePos;
    int size;

public:
    HibikiDelayLine() : writePos(0), size(0) {}
    
    void init(int delaySize) {
        size = delaySize;
        buffer.resize(size);
        clear();
    }
    
    void clear() {
        std::fill(buffer.begin(), buffer.end(), 0.0f);
        writePos = 0;
    }
    
    int getSize() const { return size; }
    
    float read(int delaySamples) const {
        if (size == 0 || delaySamples >= size) return 0.0f;
        
        int readPos = (writePos - delaySamples + size) % size;
        return buffer[readPos];
    }
    
    void write(float input) {
        if (size == 0) return;
        buffer[writePos] = input;
        writePos = (writePos + 1) % size;
    }
    
    // Interpolated delay read for smoother modulation
    float readInterp(float delaySamples) const {
        if (size == 0) return 0.0f;
        
        int delay1 = (int)delaySamples;
        int delay2 = delay1 + 1;
        float frac = delaySamples - delay1;
        
        if (delay2 >= size) delay2 = size - 1;
        
        float sample1 = read(delay1);
        float sample2 = read(delay2);
        
        return sample1 + frac * (sample2 - sample1);
    }
};

// Modulated All-pass filter with smooth interpolation
class HibikiAllPass {
private:
    HibikiDelayLine delay;
    float feedback;
    int baseDelay;
    float modAmount;
    float modPhase;
    float modRate;

public:
    HibikiAllPass() : feedback(0.5f), baseDelay(0), modAmount(0.0f), modPhase(0.0f), modRate(0.0f) {}
    
    void init(int delaySize, float fb = 0.5f) {
        delay.init(delaySize + 100); // Extra space for modulation
        feedback = clamp(fb, -0.98f, 0.98f);
        baseDelay = delaySize;
        modPhase = static_cast<float>(rand()) / static_cast<float>(RAND_MAX) * 2.0f * M_PI;
    }
    
    void setModulation(float amount, float rate) {
        modAmount = clamp(amount, 0.0f, 10.0f);
        modRate = clamp(rate, 0.0f, 5.0f);
    }
    
    void clear() {
        delay.clear();
    }
    
    float process(float input, float sampleRate) {
        // Calculate modulated delay
        modPhase += 2.0f * M_PI * modRate / sampleRate;
        if (modPhase > 2.0f * M_PI) modPhase -= 2.0f * M_PI;
        
        float modDelay = baseDelay + modAmount * std::sin(modPhase);
        modDelay = clamp(modDelay, 1.0f, static_cast<float>(delay.getSize() - 1));
        
        float delayed = delay.readInterp(modDelay);
        float output = -feedback * input + delayed;
        delay.write(input + feedback * delayed);
        
        return output;
    }
};

// Nested All-pass structure for dense reverb
class HibikiNestedAllPass {
private:
    static const int NUM_STAGES = 3;
    std::array<HibikiAllPass, NUM_STAGES> stages;
    
public:
    void init(const std::array<int, NUM_STAGES>& delays, const std::array<float, NUM_STAGES>& feedbacks) {
        for (int i = 0; i < NUM_STAGES; i++) {
            stages[i].init(delays[i], feedbacks[i]);
            stages[i].setModulation(0.5f + i * 0.3f, 0.1f + i * 0.05f);
        }
    }
    
    void clear() {
        for (auto& stage : stages) {
            stage.clear();
        }
    }
    
    float process(float input, float sampleRate) {
        float signal = input;
        for (auto& stage : stages) {
            signal = stage.process(signal, sampleRate);
        }
        return signal;
    }
};

// High-quality comb filter with modulation
class HibikiCombFilter {
private:
    HibikiDelayLine delay;
    float feedback;
    float damp;
    float lastOutput;
    int baseDelay;
    float modAmount;
    float modPhase;
    float modRate;

public:
    HibikiCombFilter() : feedback(0.5f), damp(0.5f), lastOutput(0.0f), baseDelay(0), 
                        modAmount(0.0f), modPhase(0.0f), modRate(0.0f) {}
    
    void init(int delaySize, float fb = 0.5f) {
        delay.init(delaySize + 50); // Extra space for modulation
        feedback = clamp(fb, 0.0f, 0.98f);
        baseDelay = delaySize;
        modPhase = static_cast<float>(rand()) / static_cast<float>(RAND_MAX) * 2.0f * M_PI;
    }
    
    void setModulation(float amount, float rate) {
        modAmount = clamp(amount, 0.0f, 5.0f);
        modRate = clamp(rate, 0.0f, 2.0f);
    }
    
    void clear() {
        delay.clear();
        lastOutput = 0.0f;
    }
    
    void setDamp(float d) { damp = clamp(d, 0.0f, 1.0f); }
    void setFeedback(float fb) { feedback = clamp(fb, 0.0f, 0.98f); }
    
    float process(float input, float sampleRate) {
        // Calculate modulated delay
        modPhase += 2.0f * M_PI * modRate / sampleRate;
        if (modPhase > 2.0f * M_PI) modPhase -= 2.0f * M_PI;
        
        float modDelay = baseDelay + modAmount * std::sin(modPhase);
        modDelay = clamp(modDelay, 1.0f, static_cast<float>(delay.getSize() - 1));
        
        float delayed = delay.readInterp(modDelay);
        
        // Apply damping
        lastOutput = delayed * (1.0f - damp) + lastOutput * damp;
        
        // Write input with feedback
        delay.write(input + lastOutput * feedback);
        
        return delayed;
    }
};

// Multi-tap delay for early reflections
class HibikiEarlyReflections {
private:
    static const int NUM_TAPS = 12;
    HibikiDelayLine delay;
    std::array<int, NUM_TAPS> tapDelays;
    std::array<float, NUM_TAPS> tapGains;
    std::array<float, NUM_TAPS> tapPans; // -1 = left, 1 = right
    float roomSize;
    float diffusion;

public:
    HibikiEarlyReflections() : roomSize(0.5f), diffusion(0.7f) {
        // Initialize tap delays (milliseconds at 44.1kHz)
        tapDelays = {
            89, 134, 179, 223, 278, 334, 389, 445, 512, 578, 645, 712
        };
        
        // Initialize tap gains (decreasing with distance)
        tapGains = {
            0.8f, 0.75f, 0.7f, 0.65f, 0.6f, 0.55f,
            0.5f, 0.45f, 0.4f, 0.35f, 0.3f, 0.25f
        };
        
        // Initialize stereo panning
        tapPans = {
            -0.8f, 0.6f, -0.4f, 0.9f, -0.6f, 0.3f,
            0.7f, -0.3f, 0.5f, -0.7f, 0.4f, -0.5f
        };
        
        delay.init(1024); // 1024 samples max delay
    }
    
    void setRoomSize(float size) { 
        roomSize = clamp(size, 0.1f, 2.0f); 
    }
    
    void setDiffusion(float diff) { 
        diffusion = clamp(diff, 0.0f, 1.0f); 
    }
    
    void clear() {
        delay.clear();
    }
    
    void processReplace(const float* input, float* outputL, float* outputR, int frames) {
        for (int i = 0; i < frames; i++) {
            delay.write(input[i]);
            
            float sumL = 0.0f, sumR = 0.0f;
            
            for (int tap = 0; tap < NUM_TAPS; tap++) {
                int scaledDelay = static_cast<int>(tapDelays[tap] * roomSize);
                float tapOutput = delay.read(scaledDelay) * tapGains[tap] * diffusion;
                
                // Apply stereo panning
                if (tapPans[tap] < 0.0f) {
                    sumL += tapOutput * (-tapPans[tap]);
                    sumR += tapOutput * (1.0f + tapPans[tap]);
                } else {
                    sumL += tapOutput * (1.0f - tapPans[tap]);
                    sumR += tapOutput * tapPans[tap];
                }
            }
            
            outputL[i] = sumL;
            outputR[i] = sumR;
        }
    }
};

// Main Hibiki reverb processor
class HibikiHallReverb {
private:
    static const int NUM_COMBS = 8;
    static const int NUM_ALLPASS = 6;
    
    // Comb filter network
    std::array<HibikiCombFilter, NUM_COMBS> combsL, combsR;
    
    // All-pass network
    std::array<HibikiNestedAllPass, NUM_ALLPASS/3> allpassL, allpassR;
    
    // Early reflections
    HibikiEarlyReflections earlyReflections;
    
    float sampleRate;
    float roomSize;
    float damping;
    float diffusion;
    float modulation;
    float stereoWidth;
    float earlyLevel;
    float lateLevel;
    float dryLevel;
    
    // Processing buffers
    std::array<float, HIBIKI_BUFFER_SIZE> tempBufferL, tempBufferR;
    
    // Comb filter delays (in samples at 44.1kHz)
    std::array<int, NUM_COMBS> combDelaysL = {
        1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116
    };
    
    std::array<int, NUM_COMBS> combDelaysR = {
        1580, 1640, 1514, 1445, 1300, 1379, 1211, 1139
    };

public:
    HibikiHallReverb(float sr) : sampleRate(sr), roomSize(0.7f), damping(0.3f), 
                                diffusion(0.8f), modulation(0.5f), stereoWidth(1.0f),
                                earlyLevel(0.3f), lateLevel(0.6f), dryLevel(0.8f) {
        
        // Initialize comb filters
        for (int i = 0; i < NUM_COMBS; i++) {
            float scaledDelayL = combDelaysL[i] * sampleRate / 44100.0f;
            float scaledDelayR = combDelaysR[i] * sampleRate / 44100.0f;
            
            combsL[i].init(static_cast<int>(scaledDelayL));
            combsR[i].init(static_cast<int>(scaledDelayR));
            
            // Set modulation for each comb
            combsL[i].setModulation(modulation * (0.5f + i * 0.1f), 0.1f + i * 0.02f);
            combsR[i].setModulation(modulation * (0.6f + i * 0.1f), 0.12f + i * 0.02f);
        }
        
        // Initialize all-pass networks
        for (int i = 0; i < NUM_ALLPASS/3; i++) {
            std::array<int, 3> delays = {
                static_cast<int>((556 + i * 100) * sampleRate / 44100.0f),
                static_cast<int>((441 + i * 80) * sampleRate / 44100.0f),
                static_cast<int>((341 + i * 60) * sampleRate / 44100.0f)
            };
            std::array<float, 3> feedbacks = {0.5f, 0.4f, 0.3f};
            
            allpassL[i].init(delays, feedbacks);
            
            // Slightly different delays for right channel
            delays[0] += 23;
            delays[1] += 23;
            delays[2] += 23;
            allpassR[i].init(delays, feedbacks);
        }
        
        updateParameters();
    }
    
    void setRoomSize(float size) {
        roomSize = clamp(size, 0.1f, 1.0f);
        earlyReflections.setRoomSize(size);
        updateParameters();
    }
    
    void setDamping(float damp) {
        damping = clamp(damp, 0.0f, 1.0f);
        updateParameters();
    }
    
    void setDiffusion(float diff) {
        diffusion = clamp(diff, 0.0f, 1.0f);
        earlyReflections.setDiffusion(diff);
    }
    
    void setModulation(float mod) {
        modulation = clamp(mod, 0.0f, 1.0f);
    }
    
    void setStereoWidth(float width) {
        stereoWidth = clamp(width, 0.0f, 2.0f);
    }
    
    void setEarlyLevel(float level) {
        earlyLevel = clamp(level, 0.0f, 1.0f);
    }
    
    void setLateLevel(float level) {
        lateLevel = clamp(level, 0.0f, 1.0f);
    }
    
    void setDryLevel(float level) {
        dryLevel = clamp(level, 0.0f, 1.0f);
    }
    
    void clear() {
        for (auto& comb : combsL) comb.clear();
        for (auto& comb : combsR) comb.clear();
        for (auto& ap : allpassL) ap.clear();
        for (auto& ap : allpassR) ap.clear();
        earlyReflections.clear();
    }
    
    void processReplace(const float* inputL, const float* inputR,
                       float* outputL, float* outputR, int frames) {
        for (int offset = 0; offset < frames; offset += HIBIKI_BUFFER_SIZE) {
            int chunkFrames = std::min(HIBIKI_BUFFER_SIZE, frames - offset);
            
            // Process early reflections
            std::array<float, HIBIKI_BUFFER_SIZE> earlyL, earlyR;
            for (int i = 0; i < chunkFrames; i++) {
                float monoInput = (inputL[offset + i] + inputR[offset + i]) * 0.5f;
                tempBufferL[i] = monoInput;
            }
            
            earlyReflections.processReplace(tempBufferL.data(), earlyL.data(), earlyR.data(), chunkFrames);
            
            // Process late reverb
            for (int i = 0; i < chunkFrames; i++) {
                float monoInput = tempBufferL[i];
                
                // Parallel comb filters
                float combSumL = 0.0f, combSumR = 0.0f;
                for (int j = 0; j < NUM_COMBS; j++) {
                    combSumL += combsL[j].process(monoInput, sampleRate);
                    combSumR += combsR[j].process(monoInput, sampleRate);
                }
                
                tempBufferL[i] = combSumL;
                tempBufferR[i] = combSumR;
            }
            
            // All-pass processing
            for (int i = 0; i < chunkFrames; i++) {
                for (int j = 0; j < NUM_ALLPASS/3; j++) {
                    tempBufferL[i] = allpassL[j].process(tempBufferL[i], sampleRate);
                    tempBufferR[i] = allpassR[j].process(tempBufferR[i], sampleRate);
                }
            }
            
            // Final mixing and output
            for (int i = 0; i < chunkFrames; i++) {
                // Apply stereo width
                float mid = (tempBufferL[i] + tempBufferR[i]) * 0.5f;
                float side = (tempBufferL[i] - tempBufferR[i]) * stereoWidth * 0.5f;
                float lateL = mid + side;
                float lateR = mid - side;
                
                // Mix dry, early, and late
                outputL[offset + i] = dryLevel * inputL[offset + i] + 
                                     earlyLevel * earlyL[i] + 
                                     lateLevel * lateL * HIBIKI_SCALE;
                                     
                outputR[offset + i] = dryLevel * inputR[offset + i] + 
                                     earlyLevel * earlyR[i] + 
                                     lateLevel * lateR * HIBIKI_SCALE;
            }
        }
    }

private:
    void updateParameters() {
        float feedback = 0.2f + roomSize * 0.7f;
        
        for (auto& comb : combsL) {
            comb.setFeedback(feedback);
            comb.setDamp(damping);
        }
        for (auto& comb : combsR) {
            comb.setFeedback(feedback);
            comb.setDamp(damping);
        }
    }
};

// Parameter indices for Hibiki reverb
enum HibikiParameters {
    HIBIKI_DRY = 0,
    HIBIKI_EARLY,
    HIBIKI_LATE,
    HIBIKI_ROOM_SIZE,
    HIBIKI_DAMPING,
    HIBIKI_DIFFUSION,
    HIBIKI_MODULATION,
    HIBIKI_STEREO_WIDTH,
    HIBIKI_COUNT
};

// Main processor class
class HibikiProcessor {
private:
    std::array<float, HIBIKI_COUNT> params;
    HibikiHallReverb reverb;
    float sampleRate;

public:
    HibikiProcessor(float sr) : reverb(sr), sampleRate(sr) {
        // Initialize with default parameters
        params[HIBIKI_DRY] = 80.0f;
        params[HIBIKI_EARLY] = 30.0f;
        params[HIBIKI_LATE] = 60.0f;
        params[HIBIKI_ROOM_SIZE] = 70.0f;
        params[HIBIKI_DAMPING] = 30.0f;
        params[HIBIKI_DIFFUSION] = 80.0f;
        params[HIBIKI_MODULATION] = 50.0f;
        params[HIBIKI_STEREO_WIDTH] = 100.0f;
        
        updateAllParameters();
    }
    
    void setParameter(int index, float value) {
        if (index >= 0 && index < HIBIKI_COUNT) {
            params[index] = value;
            updateParameter(index);
        }
    }
    
    void processChannels(const float* inputL, const float* inputR,
                        float* outputL, float* outputR, int frames) {
        reverb.processReplace(inputL, inputR, outputL, outputR, frames);
    }
    
    void clear() {
        reverb.clear();
    }

private:
    void updateParameter(int index) {
        switch (index) {
            case HIBIKI_DRY:
                reverb.setDryLevel(params[index] / 100.0f);
                break;
            case HIBIKI_EARLY:
                reverb.setEarlyLevel(params[index] / 100.0f);
                break;
            case HIBIKI_LATE:
                reverb.setLateLevel(params[index] / 100.0f);
                break;
            case HIBIKI_ROOM_SIZE:
                reverb.setRoomSize(params[index] / 100.0f);
                break;
            case HIBIKI_DAMPING:
                reverb.setDamping(params[index] / 100.0f);
                break;
            case HIBIKI_DIFFUSION:
                reverb.setDiffusion(params[index] / 100.0f);
                break;
            case HIBIKI_MODULATION:
                reverb.setModulation(params[index] / 100.0f);
                break;
            case HIBIKI_STEREO_WIDTH:
                reverb.setStereoWidth(params[index] / 50.0f); // 0-200% -> 0-4x
                break;
        }
    }
    
    void updateAllParameters() {
        for (int i = 0; i < HIBIKI_COUNT; i++) {
            updateParameter(i);
        }
    }
};
