#pragma once

#include "AudioBuffer.hpp"
#include <string>
#include <memory>
#include <atomic>

namespace DAW {

// Equivalent to your clip objects with audio data
class Clip {
public:
    enum class Type {
        AUDIO,
        MIDI
    };
    
    Clip(const std::string& name, double startTime, double duration, Type type = Type::AUDIO);
    ~Clip();
    
    // Basic properties - equivalent to your JS clip properties
    void SetName(const std::string& name) { name_ = name; }
    const std::string& GetName() const { return name_; }
    
    void SetStartTime(double startTime) { startTime_ = startTime; }
    double GetStartTime() const { return startTime_; }
    
    void SetDuration(double duration) { duration_ = duration; }
    double GetDuration() const { return duration_; }
    
    double GetEndTime() const { return startTime_ + duration_; }
    
    void SetColor(const std::string& color) { color_ = color; }
    const std::string& GetColor() const { return color_; }
    
    Type GetType() const { return type_; }
    
    // Audio data management - equivalent to your audioBuffer handling
    void SetAudioData(std::shared_ptr<AudioBuffer> audioData);
    std::shared_ptr<AudioBuffer> GetAudioData() const { return audioData_; }
    bool HasAudioData() const { return audioData_ != nullptr; }
    
    // Clip offset and trim (for when clip is shorter than audio data)
    void SetOffset(double offset) { offset_ = offset; } // Start offset in original audio
    double GetOffset() const { return offset_; }
    
    // Clip properties - equivalent to your clip manipulation features
    void SetGain(float gain) { gain_ = gain; }
    float GetGain() const { return gain_; }
    
    void SetMuted(bool muted) { muted_ = muted; }
    bool IsMuted() const { return muted_; }
    
    void SetSelected(bool selected) { selected_ = selected; }
    bool IsSelected() const { return selected_; }
    
    // Fade in/out
    void SetFadeIn(double fadeTime) { fadeInTime_ = fadeTime; }
    double GetFadeIn() const { return fadeInTime_; }
    
    void SetFadeOut(double fadeTime) { fadeOutTime_ = fadeTime; }
    double GetFadeOut() const { return fadeOutTime_; }
    
    // Playback speed/pitch (1.0 = normal, 2.0 = double speed, 0.5 = half speed)
    void SetPlaybackRate(double rate) { playbackRate_ = rate; }
    double GetPlaybackRate() const { return playbackRate_; }
    
    // Check if clip is active at a given time
    bool IsActiveAtTime(double time) const {
        return time >= startTime_ && time < GetEndTime();
    }
    
    // Get overlap with a time range
    bool OverlapsWith(double rangeStart, double rangeEnd) const {
        return startTime_ < rangeEnd && GetEndTime() > rangeStart;
    }
    
    // Render audio for this clip at given time range
    void RenderAudio(AudioBuffer& outputBuffer, double renderStartTime, double renderEndTime, int sampleRate) const;
    
    // Clip operations - equivalent to your clip manipulation functions
    std::shared_ptr<Clip> Split(double splitTime);
    void Trim(double newStartTime, double newEndTime);
    std::shared_ptr<Clip> Duplicate() const;
    
    // Quantization (align to grid)
    void Quantize(double gridSize);
    
    // File information (if loaded from file)
    void SetFilePath(const std::string& filePath) { filePath_ = filePath; }
    const std::string& GetFilePath() const { return filePath_; }
    
    // Waveform data for UI display (downsampled audio)
    struct WaveformData {
        std::vector<float> peaks;
        std::vector<float> rms;
        int samplesPerPeak;
        double duration;
    };
    
    const WaveformData& GetWaveformData() const { return waveformData_; }
    void GenerateWaveformData(int resolution = 1000);

private:
    // Basic properties
    std::string name_;
    std::atomic<double> startTime_;
    std::atomic<double> duration_;
    std::string color_;
    Type type_;
    std::string filePath_;
    
    // Audio data
    std::shared_ptr<AudioBuffer> audioData_;
    std::atomic<double> offset_{0.0}; // Offset into the audio data
    
    // Playback properties
    std::atomic<float> gain_{1.0f};
    std::atomic<bool> muted_{false};
    std::atomic<bool> selected_{false};
    std::atomic<double> fadeInTime_{0.0};
    std::atomic<double> fadeOutTime_{0.0};
    std::atomic<double> playbackRate_{1.0};
    
    // Waveform for UI
    WaveformData waveformData_;
    mutable std::mutex waveformMutex_;
    
    // Helper functions
    float CalculateFade(double timeInClip, double clipDuration) const;
    void ApplyFades(AudioBuffer& buffer, double startTimeInClip, int sampleRate) const;
    double ClampTime(double time) const;
    
    // Time conversion helpers
    int TimeToSamples(double timeInSeconds, int sampleRate) const {
        return static_cast<int>(timeInSeconds * sampleRate);
    }
    
    double SamplesToTime(int samples, int sampleRate) const {
        return static_cast<double>(samples) / sampleRate;
    }
};

} // namespace DAW
