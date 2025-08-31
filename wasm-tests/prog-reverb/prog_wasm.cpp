#include <emscripten/emscripten.h>
#include <emscripten/bind.h>
#include <memory>
#include <cmath>
#include <array>
#include "prog_engine.hpp"

class ProGReverbWrapper {
private:
    std::unique_ptr<ProGProcessor> processor;
    float sampleRate;
    static const int BUFFER_SIZE = 4096;
    std::array<float, BUFFER_SIZE> tempBufferL, tempBufferR;

public:
    ProGReverbWrapper() : sampleRate(44100.0f) {
        processor = std::make_unique<ProGProcessor>(sampleRate);
    }

    void setSampleRate(float sr) {
        if (sr > 0 && sr <= 192000) {
            sampleRate = sr;
            processor = std::make_unique<ProGProcessor>(sr);
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
            // Process the audio through ProG reverb
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
        if (presetName == "room") {
            setParameter(0, 85.0f);  // dry
            setParameter(1, 45.0f);  // early
            setParameter(2, 55.0f);  // late
            setParameter(3, 65.0f);  // room size
            setParameter(4, 45.0f);  // damping
            setParameter(5, 75.0f);  // warmth
            setParameter(6, 80.0f);  // ambience
            setParameter(7, 70.0f);  // diffusion
        } else if (presetName == "studio") {
            setParameter(0, 90.0f);  // dry
            setParameter(1, 35.0f);  // early
            setParameter(2, 45.0f);  // late
            setParameter(3, 50.0f);  // room size
            setParameter(4, 60.0f);  // damping
            setParameter(5, 80.0f);  // warmth
            setParameter(6, 70.0f);  // ambience
            setParameter(7, 65.0f);  // diffusion
        } else if (presetName == "warm") {
            setParameter(0, 80.0f);  // dry
            setParameter(1, 50.0f);  // early
            setParameter(2, 60.0f);  // late
            setParameter(3, 70.0f);  // room size
            setParameter(4, 30.0f);  // damping
            setParameter(5, 90.0f);  // warmth
            setParameter(6, 85.0f);  // ambience
            setParameter(7, 75.0f);  // diffusion
        } else if (presetName == "ambient") {
            setParameter(0, 70.0f);  // dry
            setParameter(1, 60.0f);  // early
            setParameter(2, 70.0f);  // late
            setParameter(3, 80.0f);  // room size
            setParameter(4, 25.0f);  // damping
            setParameter(5, 85.0f);  // warmth
            setParameter(6, 90.0f);  // ambience
            setParameter(7, 80.0f);  // diffusion
        } else if (presetName == "tight") {
            setParameter(0, 95.0f);  // dry
            setParameter(1, 30.0f);  // early
            setParameter(2, 35.0f);  // late
            setParameter(3, 40.0f);  // room size
            setParameter(4, 70.0f);  // damping
            setParameter(5, 60.0f);  // warmth
            setParameter(6, 60.0f);  // ambience
            setParameter(7, 50.0f);  // diffusion
        }
    }
};

// Global instance
ProGReverbWrapper g_progReverb;

// C-style API for JavaScript
extern "C" {
    EMSCRIPTEN_KEEPALIVE
    void prog_setSampleRate(float sampleRate) {
        g_progReverb.setSampleRate(sampleRate);
    }

    EMSCRIPTEN_KEEPALIVE
    void prog_setParameter(int index, float value) {
        g_progReverb.setParameter(index, value);
    }

    EMSCRIPTEN_KEEPALIVE
    void prog_processAudioBlock(uintptr_t inputLPtr, uintptr_t inputRPtr,
                               uintptr_t outputLPtr, uintptr_t outputRPtr, int frames) {
        g_progReverb.processAudioBlock(inputLPtr, inputRPtr, outputLPtr, outputRPtr, frames);
    }

    EMSCRIPTEN_KEEPALIVE
    void prog_clear() {
        g_progReverb.clear();
    }

    EMSCRIPTEN_KEEPALIVE
    void prog_loadPreset(const char* presetName) {
        g_progReverb.loadPreset(std::string(presetName));
    }
}

// Emscripten bindings (optional, for more advanced usage)
EMSCRIPTEN_BINDINGS(prog_reverb) {
    emscripten::class_<ProGReverbWrapper>("ProGReverbWrapper")
        .constructor<>()
        .function("setSampleRate", &ProGReverbWrapper::setSampleRate)
        .function("setParameter", &ProGReverbWrapper::setParameter)
        .function("processAudioBlock", &ProGReverbWrapper::processAudioBlock)
        .function("clear", &ProGReverbWrapper::clear)
        .function("loadPreset", &ProGReverbWrapper::loadPreset);
}
