#pragma once

#include <atomic>
#include <functional>
#include <algorithm>
#include <cmath>

// Custom clamp implementation for older C++ standards that don't have std::clamp
namespace std {
    template<typename T>
    T clamp(const T& value, const T& low, const T& high) {
        return std::max(low, std::min(value, high));
    }
}

namespace DAW {

// Transport control - equivalent to your play/pause/stop/record functionality
class Transport {
public:
    enum class State {
        STOPPED,
        PLAYING,
        PAUSED,
        RECORDING
    };
    
    Transport() = default;
    
    // Transport control
    void Play() {
        if (state_ == State::PAUSED) {
            // Resume from pause
            state_ = State::PLAYING;
            NotifyStateChange();
        } else if (state_ == State::STOPPED) {
            // Start from beginning or current position
            state_ = State::PLAYING;
            NotifyStateChange();
        }
    }
    
    void Pause() {
        if (state_ == State::PLAYING || state_ == State::RECORDING) {
            state_ = State::PAUSED;
            NotifyStateChange();
        }
    }
    
    void Stop() {
        state_ = State::STOPPED;
        NotifyStateChange();
    }
    
    void Record() {
        if (state_ == State::STOPPED || state_ == State::PAUSED) {
            state_ = State::RECORDING;
            NotifyStateChange();
        }
    }
    
    // State queries
    State GetState() const { return state_.load(); }
    bool IsPlaying() const { return state_.load() == State::PLAYING || state_.load() == State::RECORDING; }
    bool IsRecording() const { return state_.load() == State::RECORDING; }
    bool IsStopped() const { return state_.load() == State::STOPPED; }
    bool IsPaused() const { return state_.load() == State::PAUSED; }
    
    // Position control (in seconds)
    void SetPosition(double seconds) {
        position_ = std::max(0.0, seconds);
        NotifyPositionChange();
    }
    
    double GetPosition() const { return position_; }
    
    // Advance position by given number of samples (called from audio thread)
    void AdvancePosition(int samples, int sampleRate) {
        if (IsPlaying()) {
            double current_pos = position_.load();
            current_pos += static_cast<double>(samples) / sampleRate;
            
            // Check if we hit loop end
            if (loopEnabled_.load() && current_pos >= loopEnd_.load()) {
                current_pos = loopStart_.load();
                NotifyLoopback();
            }
            position_.store(current_pos);
        }
    }
    
    // Loop control
    void SetLoopEnabled(bool enabled) { loopEnabled_ = enabled; }
    bool IsLoopEnabled() const { return loopEnabled_.load(); }
    
    void SetLoopRegion(double start, double end) {
        loopStart_ = std::max(0.0, start);
        loopEnd_ = std::max(loopStart_.load(), end);
    }
    
    std::pair<double, double> GetLoopRegion() const {
        return {loopStart_.load(), loopEnd_.load()};
    }
    
    // Tempo and time signature - equivalent to your BPM controls
    void SetBPM(double bpm) {
        bpm_ = std::clamp(bpm, 20.0, 300.0);
        NotifyTempoChange();
    }
    
    double GetBPM() const { return bpm_; }
    
    void SetTimeSignature(int numerator, int denominator) {
        timeSigNumerator_ = std::clamp(numerator, 1, 32);
        timeSigDenominator_ = std::clamp(denominator, 1, 32);
        NotifyTimeSignatureChange();
    }
    
    std::pair<int, int> GetTimeSignature() const {
        return {timeSigNumerator_.load(), timeSigDenominator_.load()};
    }
    
    // Time conversion utilities
    double SecondsToBeats(double seconds) const {
        return seconds * (bpm_.load() / 60.0);
    }
    
    double BeatsToSeconds(double beats) const {
        return beats / (bpm_.load() / 60.0);
    }
    
    double SecondsToBars(double seconds) const {
        double beats = SecondsToBeats(seconds);
        return beats / timeSigNumerator_.load();
    }
    
    double BarsToSeconds(double bars) const {
        double beats = bars * timeSigNumerator_.load();
        return BeatsToSeconds(beats);
    }
    
    // Get current position in musical time
    struct MusicalPosition {
        int bars;
        int beats;
        int ticks;
        double fractionalTicks;
    };
    
    MusicalPosition GetMusicalPosition(int ticksPerBeat = 960) const {
        double totalBeats = SecondsToBeats(position_.load());
        int bars = static_cast<int>(totalBeats / timeSigNumerator_.load());
        int beats = static_cast<int>(totalBeats) % timeSigNumerator_.load();
        double fractionalBeat = totalBeats - std::floor(totalBeats);
        double totalTicks = fractionalBeat * ticksPerBeat;
        int ticks = static_cast<int>(totalTicks);
        double fractionalTicks = totalTicks - ticks;
        
        return {bars, beats, ticks, fractionalTicks};
    }
    
    // Metronome
    void SetMetronomeEnabled(bool enabled) { metronomeEnabled_ = enabled; }
    bool IsMetronomeEnabled() const { return metronomeEnabled_.load(); }
    
    // Check if we should trigger a metronome click
    bool ShouldTriggerMetronome(int samples, int sampleRate) const {
        if (!metronomeEnabled_ || !IsPlaying()) return false;
        
        double currentTime = position_.load();
        double nextTime = currentTime + static_cast<double>(samples) / sampleRate;
        
        double beatDuration = 60.0 / bpm_.load();
        int currentBeat = static_cast<int>(currentTime / beatDuration);
        int nextBeat = static_cast<int>(nextTime / beatDuration);
        
        return nextBeat > currentBeat;
    }
    
    // Callbacks for UI updates
    using StateChangeCallback = std::function<void(State)>;
    using PositionChangeCallback = std::function<void(double)>;
    using TempoChangeCallback = std::function<void(double)>;
    using TimeSignatureChangeCallback = std::function<void(int, int)>;
    using LoopbackCallback = std::function<void()>;
    
    void SetStateChangeCallback(StateChangeCallback callback) { stateChangeCallback_ = callback; }
    void SetPositionChangeCallback(PositionChangeCallback callback) { positionChangeCallback_ = callback; }
    void SetTempoChangeCallback(TempoChangeCallback callback) { tempoChangeCallback_ = callback; }
    void SetTimeSignatureChangeCallback(TimeSignatureChangeCallback callback) { timeSignatureChangeCallback_ = callback; }
    void SetLoopbackCallback(LoopbackCallback callback) { loopbackCallback_ = callback; }

private:
    std::atomic<State> state_{State::STOPPED};
    std::atomic<double> position_{0.0};
    
    // Loop settings
    std::atomic<bool> loopEnabled_{false};
    std::atomic<double> loopStart_{0.0};
    std::atomic<double> loopEnd_{60.0}; // Default 1 minute loop
    
    // Musical settings
    std::atomic<double> bpm_{120.0};
    std::atomic<int> timeSigNumerator_{4};
    std::atomic<int> timeSigDenominator_{4};
    
    // Metronome
    std::atomic<bool> metronomeEnabled_{false};
    
    // Callbacks
    StateChangeCallback stateChangeCallback_;
    PositionChangeCallback positionChangeCallback_;
    TempoChangeCallback tempoChangeCallback_;
    TimeSignatureChangeCallback timeSignatureChangeCallback_;
    LoopbackCallback loopbackCallback_;
    
    void NotifyStateChange() {
        if (stateChangeCallback_) stateChangeCallback_(state_.load());
    }
    
    void NotifyPositionChange() {
        if (positionChangeCallback_) positionChangeCallback_(position_.load());
    }
    
    void NotifyTempoChange() {
        if (tempoChangeCallback_) tempoChangeCallback_(bpm_.load());
    }
    
    void NotifyTimeSignatureChange() {
        if (timeSignatureChangeCallback_) timeSignatureChangeCallback_(timeSigNumerator_.load(), timeSigDenominator_.load());
    }
    
    void NotifyLoopback() {
        if (loopbackCallback_) loopbackCallback_();
    }
};

} // namespace DAW
