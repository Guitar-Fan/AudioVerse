/*
 * REAPER Web - Audio Engine
 * Real-time audio processing engine based on REAPER's architecture
 * Handles low-latency audio I/O, routing, and effects processing
 */

#pragma once

#include "audio_buffer.hpp"
#include <memory>
#include <vector>
#include <atomic>
#include <thread>
#include <mutex>

// Forward declarations
class Track;
class EffectsChain;
class AudioDevice;
class MediaItemManager;
class TrackManager;

/**
 * Real-time Audio Engine
 * Based on REAPER's audio processing architecture and JSFX patterns
 */
class AudioEngine {
public:
    enum class ProcessingMode {
        REALTIME,           // Real-time playback/recording
        OFFLINE,           // Offline rendering
        FREEZE             // Track freezing
    };

    struct AudioSettings {
        double sampleRate = 48000.0;
        int bufferSize = 512;
        int inputChannels = 2;
        int outputChannels = 2;
        int maxChannels = 64;
        bool enablePDC = true;          // Plugin Delay Compensation
        int maxPDCDelay = 8192;         // samples
        ProcessingMode mode = ProcessingMode::REALTIME;
        std::atomic<bool> inputMonitoring{true};
    };

    struct PerformanceStats {
        std::atomic<double> cpuUsage{0.0};
        std::atomic<double> peakCpuUsage{0.0};
        std::atomic<int> dropouts{0};
        std::atomic<int> activePlugins{0};
        std::atomic<long long> samplesProcessed{0};
        std::atomic<double> latencyMs{0.0};
    };

public:
    AudioEngine();
    ~AudioEngine();

    // Initialization - mirrors REAPER's audio system setup
    bool Initialize(double sampleRate, int bufferSize, int maxChannels);
    void Shutdown();
    bool IsInitialized() const { return m_initialized.load(); }

    // Device management
    bool SetAudioDevice(const std::string& deviceName);
    std::vector<std::string> GetAvailableDevices() const;
    
    // Playback control
    void StartPlayback();
    void StopPlayback();
    void PausePlayback();
    void StartRecording();
    void StopRecording();
    bool IsPlaying() const { return m_isPlaying.load(); }
    bool IsRecording() const { return m_isRecording.load(); }

    // Position control
    void SetPlayPosition(double seconds);
    double GetPlayPosition() const { return m_playPosition.load(); }

    // Settings
    void SetSampleRate(double rate);
    void SetBufferSize(int size);
    void SetProcessingMode(ProcessingMode mode) { m_settings.mode = mode; }
    const AudioSettings& GetSettings() const { return m_settings; }

    // Real-time audio processing - the heart of the engine
    void ProcessBlock(float** inputs, float** outputs, int numChannels, int numSamples);
    void ProcessBlock(float** inputs, float** outputs, int numChannels, int numSamples,
                     MediaItemManager* mediaManager, TrackManager* trackManager, 
                     double startTime, double blockLength);
    void ProcessTracks(MediaItemManager* mediaManager, TrackManager* trackManager, 
                      double startTime, double length, AudioBuffer& masterBuffer);
    
    // Track management for audio routing
    void AddTrack(Track* track);
    void RemoveTrack(Track* track);
    void ClearTracks();
    
    // Master bus processing
    void SetMasterVolume(float volume);
    void SetMasterPan(float pan);
    void SetMasterMute(bool mute);
    
    // Plugin Delay Compensation (PDC) - REAPER's automatic latency compensation
    void EnablePDC(bool enable) { m_settings.enablePDC = enable; }
    int CalculatePDCDelay() const;
    void CompensateLatency();
    
    // Performance monitoring
    const PerformanceStats& GetPerformanceStats() const { return m_stats; }
    void ResetPerformanceStats();
    
    // Thread safety for real-time audio
    void SetRealtimeThreadId(std::thread::id id) { m_realtimeThreadId = id; }
    bool IsRealtimeThread() const;
    
    // Buffer allocation for zero-allocation real-time processing
    AudioBuffer* AcquireBuffer(int channels, int samples);
    void ReleaseBuffer(AudioBuffer* buffer);
    AudioBufferPool* GetBufferPool() { return m_bufferPool.get(); }

    // REAPER-style audio utilities
    static float DBToLinear(float db);
    static float LinearToDB(float linear);
    static float PanToGainLeft(float pan);  // -1 to 1 pan position
    static float PanToGainRight(float pan);
    static void ApplyFade(float* buffer, int samples, float startGain, float endGain);
    
    // Sample rate conversion (for different device rates)
    void SetupSampleRateConversion(double inputRate, double outputRate);
    
private:
    AudioSettings m_settings;
    PerformanceStats m_stats;
    
    // Playback state
    std::atomic<bool> m_initialized{false};
    std::atomic<bool> m_isPlaying{false};
    std::atomic<bool> m_isRecording{false};
    std::atomic<double> m_playPosition{0.0};
    
    // Master controls
    std::atomic<float> m_masterVolume{1.0f};
    std::atomic<float> m_masterPan{0.0f};
    std::atomic<bool> m_masterMute{false};
    
    // Track management
    std::vector<Track*> m_tracks;
    mutable std::mutex m_tracksMutex;
    
    // Audio device
    std::unique_ptr<AudioDevice> m_audioDevice;
    
    // Buffer management for real-time processing
    std::unique_ptr<AudioBufferPool> m_bufferPool;
    mutable std::mutex m_bufferMutex;
    
    // Thread safety
    std::thread::id m_realtimeThreadId;
    
    // PDC system
    std::vector<int> m_trackDelays;  // Per-track delay compensation
    int m_masterPDCDelay = 0;
    
    // Performance monitoring
    std::chrono::high_resolution_clock::time_point m_lastStatsUpdate;
    double m_processingTimeAccumulator = 0.0;
    int m_processCallCount = 0;
    
    // Internal processing methods
    void ProcessTracks(AudioBuffer& masterBuffer);
    void ProcessMasterBus(AudioBuffer& buffer);
    void UpdatePerformanceStats(double processingTime);
    void AllocateBufferPool();
    void DeallocateBufferPool();
    
    // Sample rate conversion
    class SampleRateConverter;
    std::unique_ptr<SampleRateConverter> m_srcConverter;
    
    // Zero-allocation helpers for real-time thread
    void ClearBuffer(float* buffer, int samples);
    void MixBuffers(float* dest, const float* src, int samples, float gain);
    void CopyBuffer(float* dest, const float* src, int samples);
};