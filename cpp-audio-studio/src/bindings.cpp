#include <emscripten/bind.h>
#include <emscripten/val.h>
#include "AudioAnalyzer.h"
#include "AudioEditor.h"
#include <vector>

using namespace emscripten;

class AudioStudioEngine {
public:
    AudioStudioEngine(int sampleRate) : analyzer(sampleRate, 2048) {
        audioBuffer.reserve(48000 * 10); // Reserve 10 seconds at 48kHz
    }
    
    void loadAudioData(const val& jsArray) {
        unsigned int length = jsArray["length"].as<unsigned int>();
        audioBuffer.resize(length);
        
        for (unsigned int i = 0; i < length; ++i) {
            audioBuffer[i] = jsArray[i].as<float>();
        }
        
        // Analyze the loaded audio
        analyzer.processAudioBuffer(audioBuffer.data(), audioBuffer.size());
        analyzer.computeFFT(audioBuffer.data(), std::min((int)audioBuffer.size(), 2048));
    }
    
    float getPeakLevel() { return analyzer.getPeakLevel(); }
    float getRMSLevel() { return analyzer.getRMSLevel(); }
    float getDominantFrequency() { return analyzer.getDominantFrequency(); }
    float getSpectralCentroid() { return analyzer.getSpectralCentroid(); }
    float getSpectralRolloff() { return analyzer.getSpectralRolloff(); }
    
    val getMagnitudeSpectrum() {
        const auto& spectrum = analyzer.getMagnitudeSpectrum();
        val result = val::array();
        for (size_t i = 0; i < spectrum.size(); ++i) {
            result.set(i, spectrum[i]);
        }
        return result;
    }
    
    val getPhaseSpectrum() {
        const auto& spectrum = analyzer.getPhaseSpectrum();
        val result = val::array();
        for (size_t i = 0; i < spectrum.size(); ++i) {
            result.set(i, spectrum[i]);
        }
        return result;
    }
    
    val getWaveformData(int numPoints) {
        std::vector<float> waveform(numPoints);
        analyzer.getWaveformData(waveform.data(), numPoints, audioBuffer.data(), audioBuffer.size());
        
        val result = val::array();
        for (int i = 0; i < numPoints; ++i) {
            result.set(i, waveform[i]);
        }
        return result;
    }
    
    val analyzeChunk(int startSample, int chunkSize) {
        if (startSample + chunkSize > (int)audioBuffer.size()) {
            chunkSize = audioBuffer.size() - startSample;
        }
        
        if (chunkSize <= 0) {
            return val::object();
        }
        
        analyzer.computeFFT(audioBuffer.data() + startSample, chunkSize);
        
        val result = val::object();
        result.set("magnitudeSpectrum", getMagnitudeSpectrum());
        result.set("dominantFrequency", analyzer.getDominantFrequency());
        result.set("spectralCentroid", analyzer.getSpectralCentroid());
        
        return result;
    }
    
    int getAudioLength() { return audioBuffer.size(); }
    int getSampleRate() { return analyzer.getSampleRate(); }
    
private:
    AudioAnalyzer analyzer;
    std::vector<float> audioBuffer;
};

// Wrapper for AudioEditor to expose to JavaScript
class AudioEditorWrapper {
public:
    AudioEditorWrapper(int sampleRate) : editor(sampleRate) {}
    
    // Track management
    int addTrack(const std::string& name) { return editor.addTrack(name); }
    void removeTrack(int trackId) { editor.removeTrack(trackId); }
    int getTrackCount() { return editor.getTrackCount(); }
    
    // Load audio (from JS array)
    void loadAudioToTrack(int trackId, const val& jsArray) {
        unsigned int length = jsArray["length"].as<unsigned int>();
        std::vector<float> samples(length);
        for (unsigned int i = 0; i < length; ++i) {
            samples[i] = jsArray[i].as<float>();
        }
        editor.loadAudioToTrack(trackId, samples);
    }
    
    // Get audio (to JS array)
    val getTrackAudio(int trackId, int startSample, int numSamples) {
        auto samples = editor.getTrackAudio(trackId, startSample, numSamples);
        val result = val::array();
        for (size_t i = 0; i < samples.size(); ++i) {
            result.set(i, samples[i]);
        }
        return result;
    }
    
    // Editing operations
    void cutRegion(int trackId, int start, int end) { editor.cutRegion(trackId, start, end); }
    void copyRegion(int trackId, int start, int end) { editor.copyRegion(trackId, start, end); }
    void pasteAtPosition(int trackId, int pos) { editor.pasteAtPosition(trackId, pos); }
    void deleteRegion(int trackId, int start, int end) { editor.deleteRegion(trackId, start, end); }
    void trimTrack(int trackId, int start, int end) { editor.trimTrack(trackId, start, end); }
    
    // Fades
    void applyFadeIn(int trackId, int start, int duration) { editor.applyFadeIn(trackId, start, duration); }
    void applyFadeOut(int trackId, int start, int duration) { editor.applyFadeOut(trackId, start, duration); }
    void applyCrossfade(int trackId, int pos, int duration) { editor.applyCrossfade(trackId, pos, duration); }
    
    // Time/Pitch
    void timeStretch(int trackId, float ratio) { editor.timeStretch(trackId, ratio); }
    void pitchShift(int trackId, float semitones) { editor.pitchShift(trackId, semitones); }
    
    // Effects
    void applyGain(int trackId, float gainDB) { editor.applyGain(trackId, gainDB); }
    void applyNormalize(int trackId) { editor.applyNormalize(trackId); }
    void applyReverse(int trackId) { editor.applyReverse(trackId); }
    void applyLowPassFilter(int trackId, float cutoff) { editor.applyLowPassFilter(trackId, cutoff); }
    void applyHighPassFilter(int trackId, float cutoff) { editor.applyHighPassFilter(trackId, cutoff); }
    void applyCompressor(int trackId, float threshold, float ratio) { 
        editor.applyCompressor(trackId, threshold, ratio); 
    }
    
    // Track properties
    void setTrackGain(int trackId, float gain) { editor.setTrackGain(trackId, gain); }
    void setTrackPan(int trackId, float pan) { editor.setTrackPan(trackId, pan); }
    void setTrackMute(int trackId, bool mute) { editor.setTrackMute(trackId, mute); }
    void setTrackSolo(int trackId, bool solo) { editor.setTrackSolo(trackId, solo); }
    
    // Mix down
    val mixDown() {
        auto mixed = editor.mixDown();
        val result = val::array();
        for (size_t i = 0; i < mixed.size(); ++i) {
            result.set(i, mixed[i]);
        }
        return result;
    }
    
    val renderTrack(int trackId) {
        auto rendered = editor.renderTrack(trackId);
        val result = val::array();
        for (size_t i = 0; i < rendered.size(); ++i) {
            result.set(i, rendered[i]);
        }
        return result;
    }
    
    bool hasClipboard() { return editor.hasClipboard(); }
    void clearClipboard() { editor.clearClipboard(); }
    int getSampleRate() { return editor.getSampleRate(); }
    
private:
    AudioEditor editor;
};

EMSCRIPTEN_BINDINGS(audio_studio) {
    class_<AudioStudioEngine>("AudioStudioEngine")
        .constructor<int>()
        .function("loadAudioData", &AudioStudioEngine::loadAudioData)
        .function("getPeakLevel", &AudioStudioEngine::getPeakLevel)
        .function("getRMSLevel", &AudioStudioEngine::getRMSLevel)
        .function("getDominantFrequency", &AudioStudioEngine::getDominantFrequency)
        .function("getSpectralCentroid", &AudioStudioEngine::getSpectralCentroid)
        .function("getSpectralRolloff", &AudioStudioEngine::getSpectralRolloff)
        .function("getMagnitudeSpectrum", &AudioStudioEngine::getMagnitudeSpectrum)
        .function("getPhaseSpectrum", &AudioStudioEngine::getPhaseSpectrum)
        .function("getWaveformData", &AudioStudioEngine::getWaveformData)
        .function("analyzeChunk", &AudioStudioEngine::analyzeChunk)
        .function("getAudioLength", &AudioStudioEngine::getAudioLength)
        .function("getSampleRate", &AudioStudioEngine::getSampleRate)
        ;
    
    class_<AudioEditorWrapper>("AudioEditor")
        .constructor<int>()
        // Track management
        .function("addTrack", &AudioEditorWrapper::addTrack)
        .function("removeTrack", &AudioEditorWrapper::removeTrack)
        .function("getTrackCount", &AudioEditorWrapper::getTrackCount)
        .function("loadAudioToTrack", &AudioEditorWrapper::loadAudioToTrack)
        .function("getTrackAudio", &AudioEditorWrapper::getTrackAudio)
        // Editing
        .function("cutRegion", &AudioEditorWrapper::cutRegion)
        .function("copyRegion", &AudioEditorWrapper::copyRegion)
        .function("pasteAtPosition", &AudioEditorWrapper::pasteAtPosition)
        .function("deleteRegion", &AudioEditorWrapper::deleteRegion)
        .function("trimTrack", &AudioEditorWrapper::trimTrack)
        // Fades
        .function("applyFadeIn", &AudioEditorWrapper::applyFadeIn)
        .function("applyFadeOut", &AudioEditorWrapper::applyFadeOut)
        .function("applyCrossfade", &AudioEditorWrapper::applyCrossfade)
        // Time/Pitch
        .function("timeStretch", &AudioEditorWrapper::timeStretch)
        .function("pitchShift", &AudioEditorWrapper::pitchShift)
        // Effects
        .function("applyGain", &AudioEditorWrapper::applyGain)
        .function("applyNormalize", &AudioEditorWrapper::applyNormalize)
        .function("applyReverse", &AudioEditorWrapper::applyReverse)
        .function("applyLowPassFilter", &AudioEditorWrapper::applyLowPassFilter)
        .function("applyHighPassFilter", &AudioEditorWrapper::applyHighPassFilter)
        .function("applyCompressor", &AudioEditorWrapper::applyCompressor)
        // Track properties
        .function("setTrackGain", &AudioEditorWrapper::setTrackGain)
        .function("setTrackPan", &AudioEditorWrapper::setTrackPan)
        .function("setTrackMute", &AudioEditorWrapper::setTrackMute)
        .function("setTrackSolo", &AudioEditorWrapper::setTrackSolo)
        // Mix down
        .function("mixDown", &AudioEditorWrapper::mixDown)
        .function("renderTrack", &AudioEditorWrapper::renderTrack)
        // Clipboard
        .function("hasClipboard", &AudioEditorWrapper::hasClipboard)
        .function("clearClipboard", &AudioEditorWrapper::clearClipboard)
        .function("getSampleRate", &AudioEditorWrapper::getSampleRate)
        ;
}

