#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <memory>
#include <vector>
#include <iostream>
#include "reverb_engine.hpp"

using namespace emscripten;

class ReverbProcessor {
private:
    std::unique_ptr<DragonflyHallReverb> reverb;
    float sampleRate;
    std::vector<float> inputBufferL, inputBufferR;
    std::vector<float> outputBufferL, outputBufferR;

public:
    ReverbProcessor(float sr = 44100.0f) : sampleRate(sr) {
        reverb = std::make_unique<DragonflyHallReverb>(sampleRate);
        
        // Pre-allocate buffers
        const int maxBufferSize = 4096;
        inputBufferL.resize(maxBufferSize);
        inputBufferR.resize(maxBufferSize);
        outputBufferL.resize(maxBufferSize);
        outputBufferR.resize(maxBufferSize);
    }
    
    // Set reverb parameter
    void setParameter(int paramIndex, float value) {
        if (reverb) {
            reverb->setParameterValue(paramIndex, value);
        }
    }
    
    // Process audio buffer
    val processBuffer(const val& inputArray) {
        if (!reverb) {
            return val::null();
        }
        
        // Get input array from JavaScript
        int length = inputArray["length"].as<int>();
        if (length % 2 != 0) {
            std::cout << "Error: Input array length must be even (stereo interleaved)" << std::endl;
            return val::null();
        }
        
        int frames = length / 2;
        if (frames > static_cast<int>(inputBufferL.size())) {
            std::cout << "Error: Buffer too large. Max frames: " << inputBufferL.size() << std::endl;
            return val::null();
        }
        
        // De-interleave input (JavaScript sends interleaved stereo)
        for (int i = 0; i < frames; i++) {
            inputBufferL[i] = inputArray[i * 2].as<float>();
            inputBufferR[i] = inputArray[i * 2 + 1].as<float>();
        }
        
        // Clear output buffers
        std::fill(outputBufferL.begin(), outputBufferL.begin() + frames, 0.0f);
        std::fill(outputBufferR.begin(), outputBufferR.begin() + frames, 0.0f);
        
        // Process audio
        const float* inputs[2] = { inputBufferL.data(), inputBufferR.data() };
        float* outputs[2] = { outputBufferL.data(), outputBufferR.data() };
        
        reverb->run(inputs, outputs, frames);
        
        // Create output array (interleaved stereo)
        val outputArray = val::global("Float32Array").new_(length);
        for (int i = 0; i < frames; i++) {
            outputArray.set(i * 2, outputBufferL[i]);
            outputArray.set(i * 2 + 1, outputBufferR[i]);
        }
        
        return outputArray;
    }
    
    // Process audio with separate channels (more efficient)
    val processChannels(const val& leftChannel, const val& rightChannel) {
        if (!reverb) {
            return val::null();
        }
        
        int frames = leftChannel["length"].as<int>();
        if (frames != rightChannel["length"].as<int>()) {
            std::cout << "Error: Left and right channel lengths must match" << std::endl;
            return val::null();
        }
        
        if (frames > static_cast<int>(inputBufferL.size())) {
            std::cout << "Error: Buffer too large. Max frames: " << inputBufferL.size() << std::endl;
            return val::null();
        }
        
        // Copy input data
        for (int i = 0; i < frames; i++) {
            inputBufferL[i] = leftChannel[i].as<float>();
            inputBufferR[i] = rightChannel[i].as<float>();
        }
        
        // Clear output buffers
        std::fill(outputBufferL.begin(), outputBufferL.begin() + frames, 0.0f);
        std::fill(outputBufferR.begin(), outputBufferR.begin() + frames, 0.0f);
        
        // Process audio
        const float* inputs[2] = { inputBufferL.data(), inputBufferR.data() };
        float* outputs[2] = { outputBufferL.data(), outputBufferR.data() };
        
        reverb->run(inputs, outputs, frames);
        
        // Return processed channels
        val outputLeft = val::global("Float32Array").new_(frames);
        val outputRight = val::global("Float32Array").new_(frames);
        
        for (int i = 0; i < frames; i++) {
            outputLeft.set(i, outputBufferL[i]);
            outputRight.set(i, outputBufferR[i]);
        }
        
        val result = val::object();
        result.set("left", outputLeft);
        result.set("right", outputRight);
        return result;
    }
    
    // Reset reverb state
    void reset() {
        if (reverb) {
            reverb->mute();
        }
    }
    
    // Get parameter info
    val getParameterInfo() {
        val params = val::array();
        
        // Define parameter information
        val dry = val::object();
        dry.set("name", "Dry Level");
        dry.set("min", 0.0f);
        dry.set("max", 100.0f);
        dry.set("default", 100.0f);
        dry.set("unit", "%");
        params.call<void>("push", dry);
        
        val early = val::object();
        early.set("name", "Early Reflections");
        early.set("min", 0.0f);
        early.set("max", 100.0f);
        early.set("default", 25.0f);
        early.set("unit", "%");
        params.call<void>("push", early);
        
        val late = val::object();
        late.set("name", "Late Reverb");
        late.set("min", 0.0f);
        late.set("max", 100.0f);
        late.set("default", 40.0f);
        late.set("unit", "%");
        params.call<void>("push", late);
        
        val size = val::object();
        size.set("name", "Size");
        size.set("min", 0.0f);
        size.set("max", 100.0f);
        size.set("default", 40.0f);
        size.set("unit", "%");
        params.call<void>("push", size);
        
        val width = val::object();
        width.set("name", "Width");
        width.set("min", 0.0f);
        width.set("max", 100.0f);
        width.set("default", 100.0f);
        width.set("unit", "%");
        params.call<void>("push", width);
        
        val predelay = val::object();
        predelay.set("name", "Pre-delay");
        predelay.set("min", 0.0f);
        predelay.set("max", 100.0f);
        predelay.set("default", 0.0f);
        predelay.set("unit", "ms");
        params.call<void>("push", predelay);
        
        val diffuse = val::object();
        diffuse.set("name", "Diffusion");
        diffuse.set("min", 0.0f);
        diffuse.set("max", 100.0f);
        diffuse.set("default", 70.0f);
        diffuse.set("unit", "%");
        params.call<void>("push", diffuse);
        
        val lowcut = val::object();
        lowcut.set("name", "Low Cut");
        lowcut.set("min", 20.0f);
        lowcut.set("max", 1000.0f);
        lowcut.set("default", 20.0f);
        lowcut.set("unit", "Hz");
        params.call<void>("push", lowcut);
        
        val highcut = val::object();
        highcut.set("name", "High Cut");
        highcut.set("min", 1000.0f);
        highcut.set("max", 20000.0f);
        highcut.set("default", 8000.0f);
        highcut.set("unit", "Hz");
        params.call<void>("push", highcut);
        
        val decay = val::object();
        decay.set("name", "Decay Time");
        decay.set("min", 0.1f);
        decay.set("max", 10.0f);
        decay.set("default", 2.0f);
        decay.set("unit", "s");
        params.call<void>("push", decay);
        
        return params;
    }
};

// Preset management
class PresetManager {
private:
    std::vector<std::vector<float>> presets;
    std::vector<std::string> presetNames;

public:
    PresetManager() {
        // Add default presets based on Dragonfly Hall
        addPreset("Small Hall", {
            80.0f,   // Dry
            30.0f,   // Early
            45.0f,   // Late
            25.0f,   // Size
            80.0f,   // Width
            5.0f,    // Pre-delay
            60.0f,   // Diffuse
            50.0f,   // Low cut
            6000.0f, // High cut
            1.5f     // Decay
        });
        
        addPreset("Medium Hall", {
            70.0f,   // Dry
            25.0f,   // Early
            50.0f,   // Late
            40.0f,   // Size
            90.0f,   // Width
            10.0f,   // Pre-delay
            70.0f,   // Diffuse
            40.0f,   // Low cut
            7000.0f, // High cut
            2.5f     // Decay
        });
        
        addPreset("Large Hall", {
            60.0f,   // Dry
            20.0f,   // Early
            55.0f,   // Late
            60.0f,   // Size
            100.0f,  // Width
            15.0f,   // Pre-delay
            80.0f,   // Diffuse
            30.0f,   // Low cut
            8000.0f, // High cut
            4.0f     // Decay
        });
        
        addPreset("Cathedral", {
            50.0f,   // Dry
            15.0f,   // Early
            65.0f,   // Late
            80.0f,   // Size
            100.0f,  // Width
            25.0f,   // Pre-delay
            90.0f,   // Diffuse
            25.0f,   // Low cut
            6000.0f, // High cut
            6.0f     // Decay
        });
        
        addPreset("Plate", {
            75.0f,   // Dry
            35.0f,   // Early
            40.0f,   // Late
            15.0f,   // Size
            70.0f,   // Width
            0.0f,    // Pre-delay
            50.0f,   // Diffuse
            80.0f,   // Low cut
            10000.0f,// High cut
            1.2f     // Decay
        });
    }
    
    void addPreset(const std::string& name, const std::vector<float>& params) {
        presetNames.push_back(name);
        presets.push_back(params);
    }
    
    val getPresets() {
        val presetArray = val::array();
        
        for (size_t i = 0; i < presetNames.size(); i++) {
            val preset = val::object();
            preset.set("name", presetNames[i]);
            preset.set("index", static_cast<int>(i));
            
            val params = val::array();
            for (float param : presets[i]) {
                params.call<void>("push", param);
            }
            preset.set("parameters", params);
            
            presetArray.call<void>("push", preset);
        }
        
        return presetArray;
    }
    
    val getPreset(int index) {
        if (index < 0 || index >= static_cast<int>(presets.size())) {
            return val::null();
        }
        
        val preset = val::object();
        preset.set("name", presetNames[index]);
        preset.set("index", index);
        
        val params = val::array();
        for (float param : presets[index]) {
            params.call<void>("push", param);
        }
        preset.set("parameters", params);
        
        return preset;
    }
};

// Bind classes and functions to JavaScript
EMSCRIPTEN_BINDINGS(reverb_module) {
    class_<ReverbProcessor>("ReverbProcessor")
        .constructor<float>()
        .function("setParameter", &ReverbProcessor::setParameter)
        .function("processBuffer", &ReverbProcessor::processBuffer)
        .function("processChannels", &ReverbProcessor::processChannels)
        .function("reset", &ReverbProcessor::reset)
        .function("getParameterInfo", &ReverbProcessor::getParameterInfo);
        
    class_<PresetManager>("PresetManager")
        .constructor<>()
        .function("getPresets", &PresetManager::getPresets)
        .function("getPreset", &PresetManager::getPreset);
        
    // Export parameter constants
    constant("PARAM_DRY", PARAM_DRY);
    constant("PARAM_EARLY", PARAM_EARLY);
    constant("PARAM_LATE", PARAM_LATE);
    constant("PARAM_SIZE", PARAM_SIZE);
    constant("PARAM_WIDTH", PARAM_WIDTH);
    constant("PARAM_PREDELAY", PARAM_PREDELAY);
    constant("PARAM_DIFFUSE", PARAM_DIFFUSE);
    constant("PARAM_LOWCUT", PARAM_LOWCUT);
    constant("PARAM_HIGHCUT", PARAM_HIGHCUT);
    constant("PARAM_DECAY", PARAM_DECAY);
}
