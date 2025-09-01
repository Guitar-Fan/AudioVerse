#pragma once

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <string>
#include "AudioBuffer.hpp"

namespace DAW {

// A Web Audio API wrapper for Emscripten
class WebAudioHandler {
public:
    WebAudioHandler() = default;
    
    // Initialize WebAudio with the given sample rate and buffer size
    bool Initialize(int sampleRate, int bufferSize) {
        // In a real implementation, this would initialize Web Audio API via JavaScript
        // We can use EM_ASM to run JavaScript code from C++
        EM_ASM({
            // Create an AudioContext
            window.dawAudioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: $0
            });
            
            // Create a ScriptProcessorNode for audio processing
            window.dawScriptNode = window.dawAudioContext.createScriptProcessor($1, 2, 2);
            
            // Connect the script node to the audio output
            window.dawScriptNode.connect(window.dawAudioContext.destination);
            
            console.log('Web Audio initialized with sample rate: ' + $0 + 'Hz, buffer size: ' + $1);
        }, sampleRate, bufferSize);
        
        return true;
    }
    
    // Pass audio data to the Web Audio API
    void ProcessAudio(const AudioBuffer& buffer) {
        // In a real implementation, this would copy buffer data to Web Audio API
        // This is a simplified example
        int channels = buffer.GetNumChannels();
        int frames = buffer.GetNumFrames();
        
        // For example, we could copy the buffer data to JavaScript typed arrays
        // and then pass it to Web Audio API
    }
    
    // Shutdown WebAudio
    void Shutdown() {
        EM_ASM({
            if (window.dawScriptNode) {
                window.dawScriptNode.disconnect();
            }
            if (window.dawAudioContext) {
                window.dawAudioContext.close();
            }
            console.log('Web Audio shut down');
        });
    }

private:
    // Add any state needed for Web Audio API interaction
};

} // namespace DAW

#endif // __EMSCRIPTEN__
