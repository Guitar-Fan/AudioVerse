#pragma once

#include <array>
#include <vector>
#include <cmath>
#include <algorithm>

// Helper clamp function for C++14 compatibility
template<typename T>
constexpr const T& clamp(const T& v, const T& lo, const T& hi) {
    return (v < lo) ? lo : (hi < v) ? hi : v;
}

// Constants based on Dragonfly Hall reverb
const int BUFFER_SIZE = 256;
const float LATE_GAIN = 2.5f;

// Abstract base class for DSP processing
class AbstractDSP {
public:
    virtual void setParameterValue(int index, float value) = 0;
    virtual void run(const float** inputs, float** outputs, int frames) = 0;
    virtual void mute() = 0;
    virtual ~AbstractDSP() = default;
};

// Simple delay line implementation
class DelayLine {
private:
    std::vector<float> buffer;
    int writePos;
    int size;

public:
    DelayLine() : writePos(0), size(0) {}
    
    void init(int delaySize) {
        size = delaySize;
        buffer.resize(size);
        clear();
    }
    
    void clear() {
        std::fill(buffer.begin(), buffer.end(), 0.0f);
        writePos = 0;
    }
    
    float process(float input) {
        if (size == 0) return input;
        
        // Read delayed output from current position
        float output = buffer[writePos];
        
        // Write input to buffer
        buffer[writePos] = input;
        
        // Advance write position
        writePos = (writePos + 1) % size;
        
        return output;
    }
    
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
};

// All-pass filter implementation
class AllPassFilter {
private:
    DelayLine delay;
    float feedback;
    int delayLength;

public:
    AllPassFilter() : feedback(0.5f), delayLength(0) {}
    
    void init(int delaySize, float fb = 0.5f) {
        delay.init(delaySize);
        feedback = fb;
        delayLength = delaySize;
    }
    
    void clear() {
        delay.clear();
    }
    
    float process(float input) {
        if (delayLength <= 0) return input;
        
        float delayed = delay.read(delayLength - 1);  // Read delayed signal
        float feedbackSignal = input + delayed * feedback;
        delay.write(feedbackSignal);   // Write to delay line
        return delayed * -feedback + input;
    }
};

// Comb filter implementation
class CombFilter {
private:
    DelayLine delay;
    float feedback;
    float damp;
    float lastOutput;
    int delayLength;

public:
    CombFilter() : feedback(0.5f), damp(0.5f), lastOutput(0.0f), delayLength(0) {}
    
    void init(int delaySize, float fb = 0.5f) {
        delay.init(delaySize);
        feedback = fb;
        delayLength = delaySize;
    }
    
    void clear() {
        delay.clear();
        lastOutput = 0.0f;
    }
    
    void setDamp(float d) { damp = clamp(d, 0.0f, 1.0f); }
    void setFeedback(float fb) { feedback = clamp(fb, 0.0f, 0.99f); }
    
    float process(float input) {
        if (delayLength <= 0) return input;
        
        float delayed = delay.read(delayLength - 1);
        float output = delayed;
        
        // Apply damping to the feedback
        lastOutput = output * (1.0f - damp) + lastOutput * damp;
        
        // Write input plus feedback to delay line
        delay.write(input + lastOutput * feedback);
        
        return output;
    }
};

// First-order IIR filter
class IIRFilter {
private:
    float a0, a1, b1;
    float x1, y1;

public:
    IIRFilter() : a0(1.0f), a1(0.0f), b1(0.0f), x1(0.0f), y1(0.0f) {}
    
    void setLowPass(float cutoff, float sampleRate) {
        float omega = 2.0f * M_PI * cutoff / sampleRate;
        float k = std::tan(omega / 2.0f);
        float norm = 1.0f / (1.0f + k);
        
        a0 = k * norm;
        a1 = k * norm;
        b1 = (k - 1.0f) * norm;
    }
    
    void setHighPass(float cutoff, float sampleRate) {
        float omega = 2.0f * M_PI * cutoff / sampleRate;
        float k = std::tan(omega / 2.0f);
        float norm = 1.0f / (1.0f + k);
        
        a0 = norm;
        a1 = -norm;
        b1 = (k - 1.0f) * norm;
    }
    
    void clear() {
        x1 = y1 = 0.0f;
    }
    
    float process(float input) {
        float output = a0 * input + a1 * x1 - b1 * y1;
        x1 = input;
        y1 = output;
        return output;
    }
};

// Early reflections processor
class EarlyReflections {
private:
    std::array<DelayLine, 8> delays;
    std::array<float, 8> gains;
    std::array<int, 8> delaySamples;
    IIRFilter lpf, hpf;
    float width;
    float wet;

public:
    EarlyReflections() : width(0.8f), wet(1.0f) {
        // Initialize early reflection delays (in samples at 44.1kHz)
        delaySamples = {
            190, 440, 640, 890, 1240, 1590, 1890, 2240
        };
        
        // Initialize gains
        gains = {
            0.8f, 0.7f, 0.6f, 0.5f, 0.4f, 0.3f, 0.2f, 0.1f
        };
        
        for (int i = 0; i < 8; i++) {
            delays[i].init(delaySamples[i] + 100);
        }
    }
    
    void setSampleRate(float sampleRate) {
        lpf.setLowPass(8000.0f, sampleRate);
        hpf.setHighPass(20.0f, sampleRate);
    }
    
    void setWidth(float w) { width = clamp(w, 0.0f, 1.0f); }
    void setWet(float w) { wet = clamp(w, 0.0f, 2.0f); }
    
    void setOutputLPF(float freq, float sampleRate) {
        lpf.setLowPass(freq, sampleRate);
    }
    
    void setOutputHPF(float freq, float sampleRate) {
        hpf.setHighPass(freq, sampleRate);
    }
    
    void clear() {
        for (auto& delay : delays) {
            delay.clear();
        }
        lpf.clear();
        hpf.clear();
    }
    
    void processReplace(const float* inputL, const float* inputR, 
                       float* outputL, float* outputR, int frames) {
        for (int i = 0; i < frames; i++) {
            float sumL = 0.0f, sumR = 0.0f;
            
            // Process early reflections
            for (int j = 0; j < 8; j++) {
                float delayed = delays[j].process((inputL[i] + inputR[i]) * 0.5f);
                if (j % 2 == 0) {
                    sumL += delayed * gains[j];
                } else {
                    sumR += delayed * gains[j];
                }
            }
            
            // Apply width control
            float mid = (sumL + sumR) * 0.5f;
            float side = (sumL - sumR) * width * 0.5f;
            sumL = mid + side;
            sumR = mid - side;
            
            // Apply filtering
            outputL[i] = hpf.process(lpf.process(sumL)) * wet;
            outputR[i] = hpf.process(lpf.process(sumR)) * wet;
        }
    }
};

// Late reverb processor (simplified Freeverb-style)
class LateReverb {
private:
    static const int NUM_COMBS = 8;
    static const int NUM_ALLPASS = 4;
    
    std::array<CombFilter, NUM_COMBS> combsL, combsR;
    std::array<AllPassFilter, NUM_ALLPASS> allpassL, allpassR;
    
    IIRFilter lpf, hpf;
    
    float roomSize;
    float damping;
    float width;
    float wet;
    
    // Comb filter delay sizes (in samples)
    std::array<int, NUM_COMBS> combDelaySizes = {
        1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617
    };
    
    // Allpass delay sizes
    std::array<int, NUM_ALLPASS> allpassDelaySizes = {
        556, 441, 341, 225
    };

public:
    LateReverb() : roomSize(0.5f), damping(0.5f), width(1.0f), wet(1.0f) {
        // Initialize comb filters
        for (int i = 0; i < NUM_COMBS; i++) {
            combsL[i].init(combDelaySizes[i]);
            combsR[i].init(combDelaySizes[i] + 23); // Slight offset for stereo
        }
        
        // Initialize allpass filters
        for (int i = 0; i < NUM_ALLPASS; i++) {
            allpassL[i].init(allpassDelaySizes[i]);
            allpassR[i].init(allpassDelaySizes[i] + 23);
        }
        
        updateParameters();
    }
    
    void setSampleRate(float sampleRate) {
        lpf.setLowPass(8000.0f, sampleRate);
        hpf.setHighPass(20.0f, sampleRate);
    }
    
    void setRoomSize(float size) {
        roomSize = clamp(size, 0.0f, 1.0f);
        updateParameters();
    }
    
    void setDamping(float damp) {
        damping = clamp(damp, 0.0f, 1.0f);
        updateParameters();
    }
    
    void setWidth(float w) { width = clamp(w, 0.0f, 1.0f); }
    void setWet(float w) { wet = clamp(w, 0.0f, 2.0f); }
    
    void setOutputLPF(float freq, float sampleRate) {
        lpf.setLowPass(freq, sampleRate);
    }
    
    void setOutputHPF(float freq, float sampleRate) {
        hpf.setHighPass(freq, sampleRate);
    }
    
    void clear() {
        for (auto& comb : combsL) comb.clear();
        for (auto& comb : combsR) comb.clear();
        for (auto& ap : allpassL) ap.clear();
        for (auto& ap : allpassR) ap.clear();
        lpf.clear();
        hpf.clear();
    }
    
    void processReplace(const float* inputL, const float* inputR,
                       float* outputL, float* outputR, int frames) {
        for (int i = 0; i < frames; i++) {
            float combOutL = 0.0f, combOutR = 0.0f;
            
            // Process comb filters
            float inputMono = (inputL[i] + inputR[i]) * 0.5f;
            for (int j = 0; j < NUM_COMBS; j++) {
                combOutL += combsL[j].process(inputMono);
                combOutR += combsR[j].process(inputMono);
            }
            
            // Process allpass filters
            for (int j = 0; j < NUM_ALLPASS; j++) {
                combOutL = allpassL[j].process(combOutL);
                combOutR = allpassR[j].process(combOutR);
            }
            
            // Apply width control
            float mid = (combOutL + combOutR) * 0.5f;
            float side = (combOutL - combOutR) * width * 0.5f;
            combOutL = mid + side;
            combOutR = mid - side;
            
            // Apply filtering and output
            outputL[i] = hpf.process(lpf.process(combOutL)) * wet * LATE_GAIN;
            outputR[i] = hpf.process(lpf.process(combOutR)) * wet * LATE_GAIN;
        }
    }

private:
    void updateParameters() {
        float feedback = 0.28f + roomSize * 0.7f;
        
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

// Parameter indices
enum Parameters {
    PARAM_DRY = 0,
    PARAM_EARLY,
    PARAM_LATE,
    PARAM_SIZE,
    PARAM_WIDTH,
    PARAM_PREDELAY,
    PARAM_DIFFUSE,
    PARAM_LOWCUT,
    PARAM_HIGHCUT,
    PARAM_DECAY,
    PARAM_COUNT
};

// Main Dragonfly Hall reverb implementation
class DragonflyHallReverb : public AbstractDSP {
private:
    std::array<float, PARAM_COUNT> params;
    std::array<float, PARAM_COUNT> oldParams;
    
    float sampleRate;
    float dryLevel, earlyLevel, lateLevel;
    float earlySend;
    
    EarlyReflections early;
    LateReverb late;
    DelayLine preDelayL, preDelayR;
    
    // Processing buffers
    std::array<float, BUFFER_SIZE> earlyOutL, earlyOutR;
    std::array<float, BUFFER_SIZE> lateInL, lateInR;
    std::array<float, BUFFER_SIZE> lateOutL, lateOutR;

public:
    DragonflyHallReverb(float sr) : sampleRate(sr) {
        // Initialize parameters with default values (similar to Dragonfly Hall)
        params[PARAM_DRY] = 100.0f;      // 100%
        params[PARAM_EARLY] = 25.0f;     // 25%
        params[PARAM_LATE] = 40.0f;      // 40%
        params[PARAM_SIZE] = 40.0f;      // 40%
        params[PARAM_WIDTH] = 100.0f;    // 100%
        params[PARAM_PREDELAY] = 0.0f;   // 0ms
        params[PARAM_DIFFUSE] = 70.0f;   // 70%
        params[PARAM_LOWCUT] = 20.0f;    // 20Hz
        params[PARAM_HIGHCUT] = 8000.0f; // 8kHz
        params[PARAM_DECAY] = 2.0f;      // 2.0s
        
        // Initialize oldParams to force update
        std::fill(oldParams.begin(), oldParams.end(), -1.0f);
        
        // Initialize components
        early.setSampleRate(sampleRate);
        late.setSampleRate(sampleRate);
        
        // Initialize pre-delay (max 100ms)
        int maxPreDelayFrames = static_cast<int>(sampleRate * 0.1f);
        preDelayL.init(maxPreDelayFrames);
        preDelayR.init(maxPreDelayFrames);
        
        // Initialize with default send amount
        earlySend = 0.2f; // 20% send from early to late
        
        // Update all parameters
        for (int i = 0; i < PARAM_COUNT; i++) {
            setParameterValue(i, params[i]);
        }
    }
    
    void setParameterValue(int index, float value) override {
        if (index < 0 || index >= PARAM_COUNT) return;
        params[index] = value;
    }
    
    void mute() override {
        early.clear();
        late.clear();
        preDelayL.clear();
        preDelayR.clear();
        std::fill(oldParams.begin(), oldParams.end(), -1.0f);
    }
    
    void run(const float** inputs, float** outputs, int frames) override {
        // Update parameters if changed
        for (int i = 0; i < PARAM_COUNT; i++) {
            if (std::abs(oldParams[i] - params[i]) > 1e-6f) {
                oldParams[i] = params[i];
                updateParameter(i, params[i]);
            }
        }
        
        // Process in chunks
        for (int offset = 0; offset < frames; offset += BUFFER_SIZE) {
            int chunkFrames = std::min(BUFFER_SIZE, frames - offset);
            
            // Process early reflections
            early.processReplace(
                inputs[0] + offset,
                inputs[1] + offset,
                earlyOutL.data(),
                earlyOutR.data(),
                chunkFrames
            );
            
            // Prepare late reverb input (early send + direct)
            for (int i = 0; i < chunkFrames; i++) {
                lateInL[i] = earlySend * earlyOutL[i] + inputs[0][offset + i];
                lateInR[i] = earlySend * earlyOutR[i] + inputs[1][offset + i];
            }
            
            // Process late reverb
            late.processReplace(
                lateInL.data(),
                lateInR.data(),
                lateOutL.data(),
                lateOutR.data(),
                chunkFrames
            );
            
            // Mix output
            for (int i = 0; i < chunkFrames; i++) {
                outputs[0][offset + i] = 
                    dryLevel * inputs[0][offset + i] +
                    earlyLevel * earlyOutL[i] +
                    lateLevel * lateOutL[i];
                    
                outputs[1][offset + i] = 
                    dryLevel * inputs[1][offset + i] +
                    earlyLevel * earlyOutR[i] +
                    lateLevel * lateOutR[i];
            }
        }
    }

private:
    void updateParameter(int index, float value) {
        switch (index) {
            case PARAM_DRY:
                dryLevel = value / 100.0f;
                break;
            case PARAM_EARLY:
                earlyLevel = value / 100.0f;
                break;
            case PARAM_LATE:
                lateLevel = value / 100.0f;
                break;
            case PARAM_SIZE:
                early.setWidth(value / 100.0f);
                late.setRoomSize(value / 100.0f);
                break;
            case PARAM_WIDTH:
                early.setWidth(value / 100.0f);
                late.setWidth(value / 100.0f);
                break;
            case PARAM_PREDELAY:
                // Pre-delay implementation would go here
                break;
            case PARAM_DIFFUSE:
                // Diffusion control would go here
                break;
            case PARAM_LOWCUT:
                early.setOutputHPF(value, sampleRate);
                late.setOutputHPF(value, sampleRate);
                break;
            case PARAM_HIGHCUT:
                early.setOutputLPF(value, sampleRate);
                late.setOutputLPF(value, sampleRate);
                break;
            case PARAM_DECAY:
                late.setRoomSize(std::min(value / 10.0f, 1.0f));
                break;
        }
    }
};
