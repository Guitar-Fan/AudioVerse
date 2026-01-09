#include "AudioEditor.h"
#include <algorithm>
#include <cmath>
#include <stdexcept>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

// ===== AudioTrack Implementation =====

AudioTrack::AudioTrack(const std::string& name, int sr)
    : trackName(name), sampleRate(sr), gainDB(0.0f), pan(0.0f), 
      isMuted(false), isSoloed(false) {
}

void AudioTrack::setSamples(const std::vector<float>& samples) {
    buffer = samples;
}

void AudioTrack::setGain(float gainDecibels) {
    gainDB = gainDecibels;
}

void AudioTrack::setPan(float panValue) {
    pan = std::max(-1.0f, std::min(1.0f, panValue));
}

// ===== AudioEditor Implementation =====

AudioEditor::AudioEditor(int sr) 
    : nextTrackId(1), sampleRate(sr) {
}

AudioEditor::~AudioEditor() = default;

// Track Management

int AudioEditor::addTrack(const std::string& name) {
    int id = nextTrackId++;
    tracks[id] = std::make_unique<AudioTrack>(name, sampleRate);
    return id;
}

void AudioEditor::removeTrack(int trackId) {
    tracks.erase(trackId);
}

void AudioEditor::loadAudioToTrack(int trackId, const std::vector<float>& samples) {
    auto* track = getTrack(trackId);
    if (track) {
        track->setSamples(samples);
    }
}

std::vector<float> AudioEditor::getTrackAudio(int trackId, int startSample, int numSamples) {
    auto* track = getTrack(trackId);
    if (!track) return {};
    
    const auto& samples = track->getSamples();
    int start = std::max(0, startSample);
    int end = std::min(static_cast<int>(samples.size()), startSample + numSamples);
    
    if (start >= end) return {};
    
    return std::vector<float>(samples.begin() + start, samples.begin() + end);
}

// Editing Operations

void AudioEditor::cutRegion(int trackId, int startSample, int endSample) {
    copyRegion(trackId, startSample, endSample);
    deleteRegion(trackId, startSample, endSample);
}

void AudioEditor::copyRegion(int trackId, int startSample, int endSample) {
    auto* track = getTrack(trackId);
    if (!track) return;
    
    const auto& samples = track->getSamples();
    int start = std::max(0, startSample);
    int end = std::min(static_cast<int>(samples.size()), endSample);
    
    if (start < end) {
        clipboard.assign(samples.begin() + start, samples.begin() + end);
    }
}

void AudioEditor::pasteAtPosition(int trackId, int position) {
    if (clipboard.empty()) return;
    
    auto* track = getTrack(trackId);
    if (!track) return;
    
    auto& samples = track->getSamples();
    
    // Insert clipboard data at position
    if (position >= static_cast<int>(samples.size())) {
        samples.insert(samples.end(), clipboard.begin(), clipboard.end());
    } else {
        samples.insert(samples.begin() + position, clipboard.begin(), clipboard.end());
    }
}

void AudioEditor::deleteRegion(int trackId, int startSample, int endSample) {
    auto* track = getTrack(trackId);
    if (!track) return;
    
    auto& samples = track->getSamples();
    int start = std::max(0, startSample);
    int end = std::min(static_cast<int>(samples.size()), endSample);
    
    if (start < end) {
        samples.erase(samples.begin() + start, samples.begin() + end);
    }
}

void AudioEditor::trimTrack(int trackId, int startSample, int endSample) {
    auto* track = getTrack(trackId);
    if (!track) return;
    
    auto& samples = track->getSamples();
    int start = std::max(0, startSample);
    int end = std::min(static_cast<int>(samples.size()), endSample);
    
    if (start < end) {
        std::vector<float> trimmed(samples.begin() + start, samples.begin() + end);
        samples = std::move(trimmed);
    }
}

// Fades

void AudioEditor::applyFadeIn(int trackId, int startSample, int duration) {
    auto* track = getTrack(trackId);
    if (!track) return;
    
    auto& samples = track->getSamples();
    applyFade(samples, startSample, duration, true);
}

void AudioEditor::applyFadeOut(int trackId, int startSample, int duration) {
    auto* track = getTrack(trackId);
    if (!track) return;
    
    auto& samples = track->getSamples();
    applyFade(samples, startSample, duration, false);
}

void AudioEditor::applyCrossfade(int trackId, int position, int duration) {
    auto* track = getTrack(trackId);
    if (!track) return;
    
    auto& samples = track->getSamples();
    
    int halfDuration = duration / 2;
    applyFade(samples, position - halfDuration, halfDuration, false); // Fade out
    applyFade(samples, position, halfDuration, true);                 // Fade in
}

void AudioEditor::applyFade(std::vector<float>& buffer, int start, int length, bool fadeIn) {
    int end = std::min(start + length, static_cast<int>(buffer.size()));
    
    for (int i = start; i < end; ++i) {
        float position = static_cast<float>(i - start) / length;
        float gain = fadeIn ? position : (1.0f - position);
        
        // Apply smooth curve (equal power fade)
        gain = std::sqrt(gain);
        buffer[i] *= gain;
    }
}

// Time Stretching and Pitch Shifting

void AudioEditor::timeStretch(int trackId, float ratio) {
    auto* track = getTrack(trackId);
    if (!track || ratio <= 0.0f) return;
    
    auto& samples = track->getSamples();
    if (samples.empty()) return;
    
    // Simple linear interpolation time stretch
    size_t newSize = static_cast<size_t>(samples.size() * ratio);
    std::vector<float> stretched(newSize);
    
    for (size_t i = 0; i < newSize; ++i) {
        float srcPos = i / ratio;
        int srcIndex = static_cast<int>(srcPos);
        float frac = srcPos - srcIndex;
        
        if (srcIndex + 1 < static_cast<int>(samples.size())) {
            stretched[i] = samples[srcIndex] * (1.0f - frac) + samples[srcIndex + 1] * frac;
        } else if (srcIndex < static_cast<int>(samples.size())) {
            stretched[i] = samples[srcIndex];
        }
    }
    
    samples = std::move(stretched);
}

void AudioEditor::pitchShift(int trackId, float semitones) {
    // Pitch shift = time stretch + resample
    float ratio = std::pow(2.0f, semitones / 12.0f);
    timeStretch(trackId, 1.0f / ratio);
}

// Effects using JUCE DSP

void AudioEditor::applyGain(int trackId, float gainDB) {
    auto* track = getTrack(trackId);
    if (!track) return;
    
    auto& samples = track->getSamples();
    float linearGain = std::pow(10.0f, gainDB / 20.0f);
    
    for (auto& sample : samples) {
        sample *= linearGain;
    }
}

void AudioEditor::applyNormalize(int trackId) {
    auto* track = getTrack(trackId);
    if (!track) return;
    
    auto& samples = track->getSamples();
    
    // Find peak
    float peak = 0.0f;
    for (const auto& sample : samples) {
        peak = std::max(peak, std::abs(sample));
    }
    
    if (peak > 0.0f) {
        float gain = 0.95f / peak; // Normalize to -0.5dB
        for (auto& sample : samples) {
            sample *= gain;
        }
    }
}

void AudioEditor::applyReverse(int trackId) {
    auto* track = getTrack(trackId);
    if (!track) return;
    
    auto& samples = track->getSamples();
    std::reverse(samples.begin(), samples.end());
}

void AudioEditor::applyLowPassFilter(int trackId, float cutoffHz) {
    auto* track = getTrack(trackId);
    if (!track) return;
    
    auto& samples = track->getSamples();
    applyBiquadFilter(samples, cutoffHz, false);
}

void AudioEditor::applyHighPassFilter(int trackId, float cutoffHz) {
    auto* track = getTrack(trackId);
    if (!track) return;
    
    auto& samples = track->getSamples();
    applyBiquadFilter(samples, cutoffHz, true);
}

void AudioEditor::applyBiquadFilter(std::vector<float>& buffer, float cutoff, bool isHighPass) {
    if (buffer.empty()) return;
    
    // Biquad filter coefficients
    float omega = 2.0f * M_PI * cutoff / sampleRate;
    float sinOmega = std::sin(omega);
    float cosOmega = std::cos(omega);
    float alpha = sinOmega / (2.0f * 0.707f); // Q = 0.707 (Butterworth)
    
    float b0, b1, b2, a0, a1, a2;
    
    if (isHighPass) {
        b0 = (1.0f + cosOmega) / 2.0f;
        b1 = -(1.0f + cosOmega);
        b2 = (1.0f + cosOmega) / 2.0f;
    } else {
        b0 = (1.0f - cosOmega) / 2.0f;
        b1 = 1.0f - cosOmega;
        b2 = (1.0f - cosOmega) / 2.0f;
    }
    
    a0 = 1.0f + alpha;
    a1 = -2.0f * cosOmega;
    a2 = 1.0f - alpha;
    
    // Normalize
    b0 /= a0;
    b1 /= a0;
    b2 /= a0;
    a1 /= a0;
    a2 /= a0;
    
    // Apply filter with state variables
    float x1 = 0.0f, x2 = 0.0f;
    float y1 = 0.0f, y2 = 0.0f;
    
    for (auto& sample : buffer) {
        float x = sample;
        float y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
        
        x2 = x1;
        x1 = x;
        y2 = y1;
        y1 = y;
        
        sample = y;
    }
}

void AudioEditor::applyCompressor(int trackId, float threshold, float ratio) {
    auto* track = getTrack(trackId);
    if (!track) return;
    
    auto& samples = track->getSamples();
    
    // Simple peak compressor
    float thresholdLin = std::pow(10.0f, threshold / 20.0f);
    float attack = 0.001f * sampleRate;  // 1ms
    float release = 0.1f * sampleRate;   // 100ms
    float envelope = 0.0f;
    
    for (auto& sample : samples) {
        float input = std::abs(sample);
        
        // Envelope follower
        if (input > envelope) {
            envelope += (input - envelope) / attack;
        } else {
            envelope += (input - envelope) / release;
        }
        
        // Compression
        float gain = 1.0f;
        if (envelope > thresholdLin) {
            float excess = envelope / thresholdLin;
            float compressed = std::pow(excess, 1.0f / ratio - 1.0f);
            gain = compressed;
        }
        
        sample *= gain;
    }
}

// Mix Down

std::vector<float> AudioEditor::mixDown() {
    if (tracks.empty()) return {};
    
    // Find longest track
    size_t maxLength = 0;
    for (const auto& [id, track] : tracks) {
        maxLength = std::max(maxLength, track->getLength());
    }
    
    std::vector<float> mixed(maxLength, 0.0f);
    bool anySolo = false;
    
    // Check if any track is soloed
    for (const auto& [id, track] : tracks) {
        if (track->isSolo()) {
            anySolo = true;
            break;
        }
    }
    
    // Mix tracks
    for (const auto& [id, track] : tracks) {
        if (track->isMute()) continue;
        if (anySolo && !track->isSolo()) continue;
        
        const auto& samples = track->getSamples();
        float linearGain = std::pow(10.0f, track->getGain() / 20.0f);
        float pan = track->getPan();
        float leftGain = linearGain * std::sqrt(std::max(0.0f, 1.0f - pan));
        float rightGain = linearGain * std::sqrt(std::max(0.0f, 1.0f + pan));
        float monoGain = (leftGain + rightGain) / 2.0f; // Average for mono
        
        for (size_t i = 0; i < samples.size() && i < mixed.size(); ++i) {
            mixed[i] += samples[i] * monoGain;
        }
    }
    
    return mixed;
}

std::vector<float> AudioEditor::renderTrack(int trackId) {
    auto* track = getTrack(trackId);
    if (!track) return {};
    
    auto samples = track->getSamples();
    
    // Apply gain
    float linearGain = std::pow(10.0f, track->getGain() / 20.0f);
    for (auto& sample : samples) {
        sample *= linearGain;
    }
    
    return samples;
}

// Track Properties

void AudioEditor::setTrackGain(int trackId, float gainDB) {
    auto* track = getTrack(trackId);
    if (track) {
        track->setGain(gainDB);
    }
}

void AudioEditor::setTrackPan(int trackId, float pan) {
    auto* track = getTrack(trackId);
    if (track) {
        track->setPan(pan);
    }
}

void AudioEditor::setTrackMute(int trackId, bool mute) {
    auto* track = getTrack(trackId);
    if (track) {
        track->setMute(mute);
    }
}

void AudioEditor::setTrackSolo(int trackId, bool solo) {
    auto* track = getTrack(trackId);
    if (track) {
        track->setSolo(solo);
    }
}

// Private Helper

AudioTrack* AudioEditor::getTrack(int trackId) {
    auto it = tracks.find(trackId);
    return (it != tracks.end()) ? it->second.get() : nullptr;
}
