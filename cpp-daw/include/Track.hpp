#pragma once

#include "AudioBuffer.hpp"
#include "Clip.hpp"
#include "FXPlugin.hpp"
#include <vector>
#include <memory>
#include <string>
#include <atomic>
#include <mutex>

namespace DAW {

// Forward declarations
class MixerChannel;

// Equivalent to your track objects in the tracks array
class Track {
public:
    Track(const std::string& name, int index);
    ~Track();
    
    // Track properties - equivalent to your JS track properties
    void SetName(const std::string& name) { name_ = name; }
    const std::string& GetName() const { return name_; }
    
    int GetIndex() const { return index_; }
    
    void SetColor(const std::string& color) { color_ = color; }
    const std::string& GetColor() const { return color_; }
    
    // Track state - equivalent to your track mute/solo/record states
    void SetMuted(bool muted) { muted_ = muted; }
    bool IsMuted() const { return muted_; }
    
    void SetSoloed(bool soloed) { soloed_ = soloed; }
    bool IsSoloed() const { return soloed_; }
    
    void SetRecordArmed(bool armed) { recordArmed_ = armed; }
    bool IsRecordArmed() const { return recordArmed_; }
    
    // Volume and pan - equivalent to your trackGainNodes
    void SetVolume(float volume) { volume_ = volume; } // 0.0 to 1.0+
    float GetVolume() const { return volume_; }
    
    void SetPan(float pan) { pan_ = pan; } // -1.0 (left) to 1.0 (right)
    float GetPan() const { return pan_; }
    
    // Clip management - equivalent to your clip operations
    std::shared_ptr<Clip> CreateClip(double startTime, double duration, const std::string& name = "");
    void AddClip(std::shared_ptr<Clip> clip);
    void RemoveClip(std::shared_ptr<Clip> clip);
    void RemoveClip(int clipIndex);
    std::shared_ptr<Clip> GetClip(int index);
    int GetClipCount() const { return clips_.size(); }
    const std::vector<std::shared_ptr<Clip>>& GetClips() const { return clips_; }
    
    // Find clips at a specific time
    std::vector<std::shared_ptr<Clip>> GetClipsAtTime(double time) const;
    std::shared_ptr<Clip> GetActiveClipAtTime(double time) const;
    
    // FX chain - equivalent to your trackInsertChains
    void AddFX(std::shared_ptr<FXPlugin> fx);
    void RemoveFX(int slotIndex);
    void MoveFX(int fromSlot, int toSlot);
    std::shared_ptr<FXPlugin> GetFX(int slotIndex);
    int GetFXCount() const { return fxChain_.size(); }
    const std::vector<std::shared_ptr<FXPlugin>>& GetFXChain() const { return fxChain_; }
    
    // Audio processing - main render function
    void ProcessAudio(AudioBuffer& outputBuffer, double startTime, double endTime, int sampleRate);
    
    // Recording functionality
    void StartRecording();
    void StopRecording();
    void AddRecordedSample(const AudioBuffer& buffer);
    bool IsRecording() const { return isRecording_; }
    
    // Metering - equivalent to your analyser nodes
    float GetPeakLevel(int channel) const;
    float GetRMSLevel(int channel) const;
    
    // Track type
    enum class Type {
        AUDIO,
        MIDI,
        INSTRUMENT
    };
    
    void SetType(Type type) { type_ = type; }
    Type GetType() const { return type_; }

private:
    // Basic properties
    std::string name_;
    int index_;
    std::string color_;
    Type type_{Type::AUDIO};
    
    // State
    std::atomic<bool> muted_{false};
    std::atomic<bool> soloed_{false};
    std::atomic<bool> recordArmed_{false};
    std::atomic<bool> isRecording_{false};
    
    // Audio properties
    std::atomic<float> volume_{1.0f};
    std::atomic<float> pan_{0.0f};
    
    // Clips
    std::vector<std::shared_ptr<Clip>> clips_;
    mutable std::mutex clipsMutex_;
    
    // FX chain
    std::vector<std::shared_ptr<FXPlugin>> fxChain_;
    mutable std::mutex fxMutex_;
    
    // Recording
    std::vector<AudioBuffer> recordingBuffers_;
    std::mutex recordingMutex_;
    
    // Metering
    mutable std::atomic<float> peakLevels_[2] = {0.0f, 0.0f};
    mutable std::atomic<float> rmsLevels_[2] = {0.0f, 0.0f};
    
    // Internal audio processing
    void ProcessClips(AudioBuffer& buffer, double startTime, double endTime, int sampleRate);
    void ProcessFXChain(AudioBuffer& buffer);
    void UpdateMetering(const AudioBuffer& buffer);
    void ApplyVolumeAndPan(AudioBuffer& buffer);
    
    // Helper for time-to-sample conversion
    int TimeToSamples(double timeInSeconds, int sampleRate) const {
        return static_cast<int>(timeInSeconds * sampleRate);
    }
    
    double SamplesToTime(int samples, int sampleRate) const {
        return static_cast<double>(samples) / sampleRate;
    }
};

} // namespace DAW
