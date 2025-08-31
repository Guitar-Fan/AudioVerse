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

// Constants for ProG reverb
const int PROG_BUFFER_SIZE = 256;
const float PROG_SCALE = 0.85f;

// Simple delay line implementation
class ProGDelayLine {
private:
    std::vector<float> buffer;
    int writePos;
    int size;

public:
    ProGDelayLine() : writePos(0), size(0) {}
    
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
    
    // Smooth interpolated delay read
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

// Warm-sounding all-pass filter for ProG character
class ProGAllPass {
private:
    ProGDelayLine delay;
    float feedback;
    float warmth; // Low-pass filtering for warmth
    float lastOutput;

public:
    ProGAllPass() : feedback(0.5f), warmth(0.8f), lastOutput(0.0f) {}
    
    void init(int delaySize, float fb = 0.5f) {
        delay.init(delaySize);
        feedback = clamp(fb, -0.95f, 0.95f);
    }
    
    void setWarmth(float w) {
        warmth = clamp(w, 0.0f, 1.0f);
    }
    
    void clear() {
        delay.clear();
        lastOutput = 0.0f;
    }
    
    float process(float input) {
        float delayed = delay.read(delay.getSize() - 1);
        
        // Apply warmth (simple low-pass)
        delayed = delayed * (1.0f - warmth) + lastOutput * warmth;
        lastOutput = delayed;
        
        float output = -feedback * input + delayed;
        delay.write(input + feedback * delayed);
        
        return output;
    }
};

// Room-characteristic comb filter
class ProGCombFilter {
private:
    ProGDelayLine delay;
    float feedback;
    float damp;
    float roomTone; // Adds subtle room character
    float lastOutput;
    float tonePhase;

public:
    ProGCombFilter() : feedback(0.5f), damp(0.5f), roomTone(0.2f), 
                      lastOutput(0.0f), tonePhase(0.0f) {}
    
    void init(int delaySize, float fb = 0.5f) {
        delay.init(delaySize);
        feedback = clamp(fb, 0.0f, 0.95f);
        tonePhase = static_cast<float>(rand()) / static_cast<float>(RAND_MAX) * 2.0f * M_PI;
    }
    
    void clear() {
        delay.clear();
        lastOutput = 0.0f;
    }
    
    void setDamp(float d) { damp = clamp(d, 0.0f, 1.0f); }
    void setFeedback(float fb) { feedback = clamp(fb, 0.0f, 0.95f); }
    void setRoomTone(float tone) { roomTone = clamp(tone, 0.0f, 0.5f); }
    
    float process(float input, float sampleRate) {
        float delayed = delay.read(delay.getSize() - 1);
        
        // Apply damping for natural decay
        lastOutput = delayed * (1.0f - damp) + lastOutput * damp;
        
        // Add subtle room tone modulation
        tonePhase += 2.0f * M_PI * 0.1f / sampleRate; // Very slow modulation
        if (tonePhase > 2.0f * M_PI) tonePhase -= 2.0f * M_PI;
        
        float toneMod = roomTone * std::sin(tonePhase) * 0.05f;
        float modifiedFeedback = feedback + toneMod;
        modifiedFeedback = clamp(modifiedFeedback, 0.0f, 0.95f);
        
        delay.write(input + lastOutput * modifiedFeedback);
        
        return delayed;
    }
};

// Early reflections for room ambience
class ProGEarlyReflections {
private:
    static const int NUM_TAPS = 8;
    ProGDelayLine delay;
    std::array<int, NUM_TAPS> tapDelays;
    std::array<float, NUM_TAPS> tapGains;
    std::array<float, NUM_TAPS> tapPans;
    float roomSize;
    float ambience;

public:
    ProGEarlyReflections() : roomSize(0.5f), ambience(0.6f) {
        // Room-like tap delays (smaller, more intimate than hall)
        tapDelays = {
            67, 101, 142, 189, 234, 278, 334, 401
        };
        
        // Natural decay for room reflections
        tapGains = {
            0.7f, 0.65f, 0.6f, 0.55f, 0.5f, 0.45f, 0.4f, 0.35f
        };
        
        // Subtle stereo spread
        tapPans = {
            -0.5f, 0.3f, -0.2f, 0.6f, -0.4f, 0.2f, 0.5f, -0.3f
        };
        
        delay.init(512);
    }
    
    void setRoomSize(float size) { 
        roomSize = clamp(size, 0.1f, 1.5f); 
    }
    
    void setAmbience(float amb) { 
        ambience = clamp(amb, 0.0f, 1.0f); 
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
                float tapOutput = delay.read(scaledDelay) * tapGains[tap] * ambience;
                
                // Apply stereo panning
                if (tapPans[tap] < 0.0f) {
                    sumL += tapOutput * (-tapPans[tap] + 0.5f);
                    sumR += tapOutput * (1.0f + tapPans[tap] * 0.5f);
                } else {
                    sumL += tapOutput * (1.0f - tapPans[tap] * 0.5f);
                    sumR += tapOutput * (tapPans[tap] + 0.5f);
                }
            }
            
            outputL[i] = sumL;
            outputR[i] = sumR;
        }
    }
};

// Main ProG room reverb processor
class ProGRoomReverb {
private:
    static const int NUM_COMBS = 6;
    static const int NUM_ALLPASS = 4;
    
    // Comb filter network (fewer than hall for room character)
    std::array<ProGCombFilter, NUM_COMBS> combsL, combsR;
    
    // All-pass network for diffusion
    std::array<ProGAllPass, NUM_ALLPASS> allpassL, allpassR;
    
    // Early reflections
    ProGEarlyReflections earlyReflections;
    
    float sampleRate;
    float roomSize;
    float damping;
    float warmth;
    float ambience;
    float diffusion;
    float earlyLevel;
    float lateLevel;
    float dryLevel;
    
    // Processing buffers
    std::array<float, PROG_BUFFER_SIZE> tempBufferL, tempBufferR;
    
    // Comb filter delays (in samples at 44.1kHz) - smaller for room character
    std::array<int, NUM_COMBS> combDelaysL = {
        1116, 1188, 1277, 1356, 1422, 1491
    };
    
    std::array<int, NUM_COMBS> combDelaysR = {
        1139, 1211, 1300, 1379, 1445, 1514
    };
    
    // All-pass delays for diffusion
    std::array<int, NUM_ALLPASS> allpassDelays = {
        225, 341, 441, 556
    };

public:
    ProGRoomReverb(float sr) : sampleRate(sr), roomSize(0.6f), damping(0.4f), 
                              warmth(0.7f), ambience(0.8f), diffusion(0.7f),
                              earlyLevel(0.4f), lateLevel(0.5f), dryLevel(0.9f) {
        
        // Initialize comb filters
        for (int i = 0; i < NUM_COMBS; i++) {
            float scaledDelayL = combDelaysL[i] * sampleRate / 44100.0f;
            float scaledDelayR = combDelaysR[i] * sampleRate / 44100.0f;
            
            combsL[i].init(static_cast<int>(scaledDelayL));
            combsR[i].init(static_cast<int>(scaledDelayR));
            
            // Set room tone for natural character
            combsL[i].setRoomTone(0.1f + i * 0.05f);
            combsR[i].setRoomTone(0.15f + i * 0.05f);
        }
        
        // Initialize all-pass filters
        for (int i = 0; i < NUM_ALLPASS; i++) {
            float scaledDelay = allpassDelays[i] * sampleRate / 44100.0f;
            
            allpassL[i].init(static_cast<int>(scaledDelay), 0.5f - i * 0.1f);
            allpassR[i].init(static_cast<int>(scaledDelay + 23), 0.5f - i * 0.1f);
            
            allpassL[i].setWarmth(warmth);
            allpassR[i].setWarmth(warmth);
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
    
    void setWarmth(float w) {
        warmth = clamp(w, 0.0f, 1.0f);
        for (auto& ap : allpassL) ap.setWarmth(warmth);
        for (auto& ap : allpassR) ap.setWarmth(warmth);
    }
    
    void setAmbience(float amb) {
        ambience = clamp(amb, 0.0f, 1.0f);
        earlyReflections.setAmbience(amb);
    }
    
    void setDiffusion(float diff) {
        diffusion = clamp(diff, 0.0f, 1.0f);
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
        for (int offset = 0; offset < frames; offset += PROG_BUFFER_SIZE) {
            int chunkFrames = std::min(PROG_BUFFER_SIZE, frames - offset);
            
            // Process early reflections
            std::array<float, PROG_BUFFER_SIZE> earlyL, earlyR;
            for (int i = 0; i < chunkFrames; i++) {
                float monoInput = (inputL[offset + i] + inputR[offset + i]) * 0.5f;
                tempBufferL[i] = monoInput;
            }
            
            earlyReflections.processReplace(tempBufferL.data(), earlyL.data(), earlyR.data(), chunkFrames);
            
            // Process late reverb through comb filters
            for (int i = 0; i < chunkFrames; i++) {
                float monoInput = tempBufferL[i];
                
                // Parallel comb filters
                float combSumL = 0.0f, combSumR = 0.0f;
                for (int j = 0; j < NUM_COMBS; j++) {
                    combSumL += combsL[j].process(monoInput, sampleRate);
                    combSumR += combsR[j].process(monoInput, sampleRate);
                }
                
                tempBufferL[i] = combSumL * diffusion;
                tempBufferR[i] = combSumR * diffusion;
            }
            
            // All-pass processing for smooth diffusion
            for (int i = 0; i < chunkFrames; i++) {
                for (int j = 0; j < NUM_ALLPASS; j++) {
                    tempBufferL[i] = allpassL[j].process(tempBufferL[i]);
                    tempBufferR[i] = allpassR[j].process(tempBufferR[i]);
                }
            }
            
            // Final mixing and output
            for (int i = 0; i < chunkFrames; i++) {
                // Mix dry, early, and late
                outputL[offset + i] = dryLevel * inputL[offset + i] + 
                                     earlyLevel * earlyL[i] + 
                                     lateLevel * tempBufferL[i] * PROG_SCALE;
                                     
                outputR[offset + i] = dryLevel * inputR[offset + i] + 
                                     earlyLevel * earlyR[i] + 
                                     lateLevel * tempBufferR[i] * PROG_SCALE;
            }
        }
    }

private:
    void updateParameters() {
        float feedback = 0.3f + roomSize * 0.5f; // More controlled feedback for room
        
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

// Parameter indices for ProG reverb
enum ProGParameters {
    PROG_DRY = 0,
    PROG_EARLY,
    PROG_LATE,
    PROG_ROOM_SIZE,
    PROG_DAMPING,
    PROG_WARMTH,
    PROG_AMBIENCE,
    PROG_DIFFUSION,
    PROG_COUNT
};

// Main processor class
class ProGProcessor {
private:
    std::array<float, PROG_COUNT> params;
    ProGRoomReverb reverb;
    float sampleRate;

public:
    ProGProcessor(float sr) : reverb(sr), sampleRate(sr) {
        // Initialize with default parameters
        params[PROG_DRY] = 90.0f;
        params[PROG_EARLY] = 40.0f;
        params[PROG_LATE] = 50.0f;
        params[PROG_ROOM_SIZE] = 60.0f;
        params[PROG_DAMPING] = 40.0f;
        params[PROG_WARMTH] = 70.0f;
        params[PROG_AMBIENCE] = 80.0f;
        params[PROG_DIFFUSION] = 70.0f;
        
        updateAllParameters();
    }
    
    void setParameter(int index, float value) {
        if (index >= 0 && index < PROG_COUNT) {
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
            case PROG_DRY:
                reverb.setDryLevel(params[index] / 100.0f);
                break;
            case PROG_EARLY:
                reverb.setEarlyLevel(params[index] / 100.0f);
                break;
            case PROG_LATE:
                reverb.setLateLevel(params[index] / 100.0f);
                break;
            case PROG_ROOM_SIZE:
                reverb.setRoomSize(params[index] / 100.0f);
                break;
            case PROG_DAMPING:
                reverb.setDamping(params[index] / 100.0f);
                break;
            case PROG_WARMTH:
                reverb.setWarmth(params[index] / 100.0f);
                break;
            case PROG_AMBIENCE:
                reverb.setAmbience(params[index] / 100.0f);
                break;
            case PROG_DIFFUSION:
                reverb.setDiffusion(params[index] / 100.0f);
                break;
        }
    }
    
    void updateAllParameters() {
        for (int i = 0; i < PROG_COUNT; i++) {
            updateParameter(i);
        }
    }
};
