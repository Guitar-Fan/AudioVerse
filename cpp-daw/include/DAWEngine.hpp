#pragma once

#include <vector>
#include <memory>
#include <string>
#include <map>
#include <functional>
#include <atomic>
#include <mutex>
#include <thread>
#include "AudioBuffer.hpp"
#include "Track.hpp"
#include "Transport.hpp"

#ifdef __EMSCRIPTEN__
#include "WebAudioHandler.hpp"
#endif

namespace DAW {

// Forward declarations
class Clip;
class FXPlugin;
class MixerChannel;

// Constants from your JS DAW
constexpr int DEFAULT_SAMPLE_RATE = 48000;
constexpr int DEFAULT_BUFFER_SIZE = 512;
constexpr int DEFAULT_BPM = 120;
constexpr int DEFAULT_TIME_SIG_NUM = 4;
constexpr int DEFAULT_TIME_SIG_DEN = 4;
constexpr int MAX_TRACKS = 64;
constexpr double MAX_TIME_SECONDS = 600.0; // 10 minutes
constexpr int MAX_BARS = 500;

// Audio types
using SampleType = float;
using ChannelData = std::vector<SampleType>;

// Engine state
enum class PlayState {
    STOPPED,
    PLAYING,
    PAUSED,
    RECORDING
};

// Core audio engine class - equivalent to your global audioCtx and state
class DAWEngine {
public:
    DAWEngine();
    ~DAWEngine();
    
    // Core engine control
    bool Initialize(int sampleRate = DEFAULT_SAMPLE_RATE, int bufferSize = DEFAULT_BUFFER_SIZE);
    void Shutdown();
    bool IsInitialized() const { return initialized_; }
    
    // Transport control - equivalent to your play/pause/stop/record functions
    void Play();
    void Pause();
    void Stop();
    void Record();
    void SetPosition(double seconds);
    double GetPosition() const;
    Transport::State GetPlayState() const { return transport_.GetState(); }
    
    // Project settings - equivalent to your bpm, timeSig, etc.
    void SetBPM(double bpm) { bpm_ = bpm; }
    double GetBPM() const { return bpm_; }
    void SetTimeSignature(int numerator, int denominator) { 
        timeSigNum_ = numerator; 
        timeSigDen_ = denominator; 
    }
    std::pair<int, int> GetTimeSignature() const { return {timeSigNum_, timeSigDen_}; }
    
    // Track management - equivalent to your tracks array and functions
    std::shared_ptr<Track> CreateTrack(const std::string& name = "");
    void DeleteTrack(int trackIndex);
    std::shared_ptr<Track> GetTrack(int index);
    int GetTrackCount() const;
    void SetSelectedTrack(int index) { selectedTrackIndex_ = index; }
    int GetSelectedTrack() const { return selectedTrackIndex_; }
    
    // Audio processing - main render loop
    void ProcessAudio(AudioBuffer& buffer);
    void ProcessAudio();
    
    // Audio file management
    bool LoadAudioFile(const std::string& filepath, int trackIndex);
    
    // Settings equivalent to your settings object
    struct Settings {
        bool autoScroll = true;
        bool snapToGrid = true;
        bool showTriplets = true;
        bool confirmDelete = false;
        std::string faderCurve = "db"; // "db" or "linear"
        bool metronomeEnabled = false;
        std::string outputDevice = "default";
        std::string inputDevice = "default";
        int sampleRate = DEFAULT_SAMPLE_RATE;
        int bufferSize = DEFAULT_BUFFER_SIZE;
    };
    
    Settings& GetSettings() { return settings_; }
    const Settings& GetSettings() const { return settings_; }
    
    // Audio context info
    int GetSampleRate() const { return sampleRate_; }
    int GetBufferSize() const { return bufferSize_; }
    
    // Master audio chain - equivalent to your masterGainNode, analyserNode
    void SetMasterVolume(float volume);
    float GetMasterVolume() const { return masterVolume_; }
    
    // Callback for UI updates (equivalent to your DOM manipulation)
    using UIUpdateCallback = std::function<void(const std::string& event, const std::string& data)>;
    void SetUIUpdateCallback(UIUpdateCallback callback) { uiCallback_ = callback; }

private:
    // Core state
    std::atomic<bool> initialized_{false};
    Transport transport_;
    
    // Audio settings
    int sampleRate_{DEFAULT_SAMPLE_RATE};
    int bufferSize_{DEFAULT_BUFFER_SIZE};
    
    #ifdef __EMSCRIPTEN__
    // Web Audio handler when compiling for WASM
    WebAudioHandler webAudio_;
    #endif
    
    // Project settings
    double bpm_{DEFAULT_BPM};
    int timeSigNum_{DEFAULT_TIME_SIG_NUM};
    int timeSigDen_{DEFAULT_TIME_SIG_DEN};
    
    // Track management
    std::vector<std::shared_ptr<Track>> tracks_;
    int selectedTrackIndex_{0};
    std::mutex tracksMutex_;
    
    // Audio processing
    std::atomic<float> masterVolume_{1.0f};
    std::unique_ptr<AudioBuffer> outputBuffer_;
    Settings settings_;
    
    // UI communication
    UIUpdateCallback uiCallback_;
    
    // Audio thread
    std::thread audioThread_;
    std::atomic<bool> shouldStop_{false};
    
    void AudioThreadFunc();
    void NotifyUI(const std::string& event, const std::string& data = "");
};

} // namespace DAW
