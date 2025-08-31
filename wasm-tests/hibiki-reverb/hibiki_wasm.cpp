#include <emscripten/emscripten.h>
#include <emscripten/bind.h>
#include <memory>
#include <cmath>
#include <array>
#include "hibiki_engine.hpp"

class HibikiReverbWrapper {
private:
    std::unique_ptr<HibikiProcessor> processor;
    float sampleRate;
    static const int BUFFER_SIZE = 4096;
    std::array<float, BUFFER_SIZE> tempBufferL, tempBufferR;

public:
    HibikiReverbWrapper() : sampleRate(44100.0f) {
        processor = std::make_unique<HibikiProcessor>(sampleRate);
    }

    void setSampleRate(float sr) {
        if (sr > 0 && sr <= 192000) {
            sampleRate = sr;
            processor = std::make_unique<HibikiProcessor>(sr);
        }
    }

    void setParameter(int index, float value) {
        if (processor) {
            processor->setParameter(index, value);
        }
    }

    void processAudioBlock(uintptr_t inputLPtr, uintptr_t inputRPtr,
                          uintptr_t outputLPtr, uintptr_t outputRPtr, int frames) {
        if (!processor || frames <= 0 || frames > BUFFER_SIZE) return;

        const float* inputL = reinterpret_cast<const float*>(inputLPtr);
        const float* inputR = reinterpret_cast<const float*>(inputRPtr);
        float* outputL = reinterpret_cast<float*>(outputLPtr);
        float* outputR = reinterpret_cast<float*>(outputRPtr);

        // Safety checks
        if (!inputL || !inputR || !outputL || !outputR) return;

        try {
            // Process the audio through Hibiki reverb
            processor->processChannels(inputL, inputR, outputL, outputR, frames);

            // Clamp outputs to prevent overflow
            for (int i = 0; i < frames; i++) {
                outputL[i] = std::fmax(-2.0f, std::fmin(2.0f, outputL[i]));
                outputR[i] = std::fmax(-2.0f, std::fmin(2.0f, outputR[i]));
            }
        } catch (...) {
            // On any error, copy input to output
            for (int i = 0; i < frames; i++) {
                outputL[i] = inputL[i];
                outputR[i] = inputR[i];
            }
        }
    }

    void clear() {
        if (processor) {
            processor->clear();
        }
    }

    // Preset management
    void loadPreset(const std::string& presetName) {
        if (presetName == "hall") {
            setParameter(0, 70.0f);  // dry
            setParameter(1, 40.0f);  // early
            setParameter(2, 80.0f);  // late
            setParameter(3, 85.0f);  // room size
            setParameter(4, 25.0f);  // damping
            setParameter(5, 85.0f);  // diffusion
            setParameter(6, 60.0f);  // modulation
            setParameter(7, 120.0f); // stereo width
        } else if (presetName == "chamber") {
            setParameter(0, 80.0f);  // dry
            setParameter(1, 50.0f);  // early
            setParameter(2, 65.0f);  // late
            setParameter(3, 60.0f);  // room size
            setParameter(4, 40.0f);  // damping
            setParameter(5, 70.0f);  // diffusion
            setParameter(6, 40.0f);  // modulation
            setParameter(7, 100.0f); // stereo width
        } else if (presetName == "plate") {
            setParameter(0, 75.0f);  // dry
            setParameter(1, 60.0f);  // early
            setParameter(2, 70.0f);  // late
            setParameter(3, 45.0f);  // room size
            setParameter(4, 60.0f);  // damping
            setParameter(5, 90.0f);  // diffusion
            setParameter(6, 80.0f);  // modulation
            setParameter(7, 80.0f);  // stereo width
        } else if (presetName == "cathedral") {
            setParameter(0, 60.0f);  // dry
            setParameter(1, 30.0f);  // early
            setParameter(2, 90.0f);  // late
            setParameter(3, 95.0f);  // room size
            setParameter(4, 15.0f);  // damping
            setParameter(5, 85.0f);  // diffusion
            setParameter(6, 70.0f);  // modulation
            setParameter(7, 140.0f); // stereo width
        } else if (presetName == "vintage") {
            setParameter(0, 85.0f);  // dry
            setParameter(1, 45.0f);  // early
            setParameter(2, 55.0f);  // late
            setParameter(3, 55.0f);  // room size
            setParameter(4, 70.0f);  // damping
            setParameter(5, 60.0f);  // diffusion
            setParameter(6, 90.0f);  // modulation
            setParameter(7, 90.0f);  // stereo width
        }
    }
};

// Global instance
HibikiReverbWrapper g_hibikiReverb;

// C-style API for JavaScript
extern "C" {
    EMSCRIPTEN_KEEPALIVE
    void hibiki_setSampleRate(float sampleRate) {
        g_hibikiReverb.setSampleRate(sampleRate);
    }

    EMSCRIPTEN_KEEPALIVE
    void hibiki_setParameter(int index, float value) {
        g_hibikiReverb.setParameter(index, value);
    }

    EMSCRIPTEN_KEEPALIVE
    void hibiki_processAudioBlock(uintptr_t inputLPtr, uintptr_t inputRPtr,
                                 uintptr_t outputLPtr, uintptr_t outputRPtr, int frames) {
        g_hibikiReverb.processAudioBlock(inputLPtr, inputRPtr, outputLPtr, outputRPtr, frames);
    }

    EMSCRIPTEN_KEEPALIVE
    void hibiki_clear() {
        g_hibikiReverb.clear();
    }

    EMSCRIPTEN_KEEPALIVE
    void hibiki_loadPreset(const char* presetName) {
        g_hibikiReverb.loadPreset(std::string(presetName));
    }
}

// Emscripten bindings (optional, for more advanced usage)
EMSCRIPTEN_BINDINGS(hibiki_reverb) {
    emscripten::class_<HibikiReverbWrapper>("HibikiReverbWrapper")
        .constructor<>()
        .function("setSampleRate", &HibikiReverbWrapper::setSampleRate)
        .function("setParameter", &HibikiReverbWrapper::setParameter)
        .function("processAudioBlock", &HibikiReverbWrapper::processAudioBlock)
        .function("clear", &HibikiReverbWrapper::clear)
        .function("loadPreset", &HibikiReverbWrapper::loadPreset);
}
