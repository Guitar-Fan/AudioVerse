#pragma once

#include <vector>
#include <memory>
#include <string>
#include <map>

class AudioTrack {
public:
    AudioTrack(const std::string& name, int sampleRate);
    
    void setSamples(const std::vector<float>& samples);
    const std::vector<float>& getSamples() const { return buffer; }
    std::vector<float>& getSamples() { return buffer; }
    
    void setGain(float gainDB);
    void setPan(float panValue); // -1.0 (left) to 1.0 (right)
    void setMute(bool muted) { isMuted = muted; }
    void setSolo(bool soloed) { isSoloed = soloed; }
    
    float getGain() const { return gainDB; }
    float getPan() const { return pan; }
    bool isMute() const { return isMuted; }
    bool isSolo() const { return isSoloed; }
    
    std::string getName() const { return trackName; }
    int getSampleRate() const { return sampleRate; }
    size_t getLength() const { return buffer.size(); }
    
private:
    std::string trackName;
    std::vector<float> buffer;
    int sampleRate;
    float gainDB;
    float pan;
    bool isMuted;
    bool isSoloed;
};

class AudioEditor {
public:
    AudioEditor(int sampleRate = 48000);
    ~AudioEditor();
    
    // Track management
    int addTrack(const std::string& name);
    void removeTrack(int trackId);
    int getTrackCount() const { return tracks.size(); }
    
    // Audio data loading
    void loadAudioToTrack(int trackId, const std::vector<float>& samples);
    std::vector<float> getTrackAudio(int trackId, int startSample, int numSamples);
    
    // Editing operations
    void cutRegion(int trackId, int startSample, int endSample);
    void copyRegion(int trackId, int startSample, int endSample);
    void pasteAtPosition(int trackId, int position);
    void deleteRegion(int trackId, int startSample, int endSample);
    void trimTrack(int trackId, int startSample, int endSample);
    
    // Fades and crossfades
    void applyFadeIn(int trackId, int startSample, int duration);
    void applyFadeOut(int trackId, int startSample, int duration);
    void applyCrossfade(int trackId, int position, int duration);
    
    // Time stretching and pitch shifting
    void timeStretch(int trackId, float ratio); // 0.5 = half speed, 2.0 = double speed
    void pitchShift(int trackId, float semitones);
    
    // Effects (custom DSP implementations)
    void applyGain(int trackId, float gainDB);
    void applyNormalize(int trackId);
    void applyReverse(int trackId);
    void applyLowPassFilter(int trackId, float cutoffHz);
    void applyHighPassFilter(int trackId, float cutoffHz);
    void applyCompressor(int trackId, float threshold, float ratio);
    
    // Mix down
    std::vector<float> mixDown();
    std::vector<float> renderTrack(int trackId);
    
    // Track properties
    void setTrackGain(int trackId, float gainDB);
    void setTrackPan(int trackId, float pan);
    void setTrackMute(int trackId, bool mute);
    void setTrackSolo(int trackId, bool solo);
    
    // Clipboard
    bool hasClipboard() const { return !clipboard.empty(); }
    void clearClipboard() { clipboard.clear(); }
    
    // Utility
    int getSampleRate() const { return sampleRate; }
    void setSampleRate(int sr) { sampleRate = sr; }
    
private:
    AudioTrack* getTrack(int trackId);
    void applyFade(std::vector<float>& buffer, int start, int length, bool fadeIn);
    void applyBiquadFilter(std::vector<float>& buffer, float cutoff, bool isHighPass);
    
    std::map<int, std::unique_ptr<AudioTrack>> tracks;
    std::vector<float> clipboard;
    int nextTrackId;
    int sampleRate;
};
