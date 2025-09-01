#include "Track.hpp"
#include <algorithm>
#include <iostream>
#include <cmath>

namespace DAW {

Track::Track(const std::string& name, int index)
    : name_(name), index_(index), type_(Type::AUDIO) {
    std::cout << "Track created: " << name_ << " at index " << index_ << std::endl;
}

Track::~Track() {
    std::cout << "Track destroyed: " << name_ << std::endl;
}

void Track::AddClip(std::shared_ptr<Clip> clip) {
    if (clip) {
        std::lock_guard<std::mutex> lock(clipsMutex_);
        clips_.push_back(clip);
    }
}

void Track::RemoveClip(std::shared_ptr<Clip> clip) {
    if (clip) {
        std::lock_guard<std::mutex> lock(clipsMutex_);
        clips_.erase(std::remove(clips_.begin(), clips_.end(), clip), clips_.end());
    }
}

void Track::RemoveClip(int clipIndex) {
    std::lock_guard<std::mutex> lock(clipsMutex_);
    if (clipIndex >= 0 && static_cast<size_t>(clipIndex) < clips_.size()) {
        clips_.erase(clips_.begin() + clipIndex);
    }
}

std::shared_ptr<Clip> Track::GetClip(int index) {
    std::lock_guard<std::mutex> lock(clipsMutex_);
    if (index >= 0 && static_cast<size_t>(index) < clips_.size()) {
        return clips_[index];
    }
    return nullptr;
}

std::vector<std::shared_ptr<Clip>> Track::GetClipsAtTime(double time) const {
    // Placeholder
    return {};
}

std::shared_ptr<Clip> Track::GetActiveClipAtTime(double time) const {
    // Placeholder
    return nullptr;
}

void Track::AddFX(std::shared_ptr<FXPlugin> fx) {
    if (fx) {
        std::lock_guard<std::mutex> lock(fxMutex_);
        fxChain_.push_back(fx);
    }
}

void Track::RemoveFX(int slotIndex) {
    std::lock_guard<std::mutex> lock(fxMutex_);
    if (slotIndex >= 0 && static_cast<size_t>(slotIndex) < fxChain_.size()) {
        fxChain_.erase(fxChain_.begin() + slotIndex);
    }
}

void Track::MoveFX(int fromSlot, int toSlot) {
    std::lock_guard<std::mutex> lock(fxMutex_);
    if (fromSlot >= 0 && static_cast<size_t>(fromSlot) < fxChain_.size() && toSlot >= 0 && static_cast<size_t>(toSlot) < fxChain_.size() && fromSlot != toSlot) {
        auto fx = fxChain_[fromSlot];
        fxChain_.erase(fxChain_.begin() + fromSlot);
        fxChain_.insert(fxChain_.begin() + toSlot, fx);
    }
}

std::shared_ptr<FXPlugin> Track::GetFX(int slotIndex) {
    std::lock_guard<std::mutex> lock(fxMutex_);
    if (slotIndex >= 0 && static_cast<size_t>(slotIndex) < fxChain_.size()) {
        return fxChain_[slotIndex];
    }
    return nullptr;
}

void Track::ProcessAudio(AudioBuffer& outputBuffer, double startTime, double endTime, int sampleRate) {
    std::lock_guard<std::mutex> lock(clipsMutex_);
    std::lock_guard<std::mutex> fxLock(fxMutex_);

    AudioBuffer trackBuffer(outputBuffer.GetNumChannels(), outputBuffer.GetNumFrames());

    ProcessClips(trackBuffer, startTime, endTime, sampleRate);
    ProcessFXChain(trackBuffer);
    ApplyVolumeAndPan(trackBuffer);
    UpdateMetering(trackBuffer);

    if (!muted_.load()) {
        for (int ch = 0; ch < outputBuffer.GetNumChannels(); ++ch) {
            auto* out = outputBuffer.GetChannelData(ch);
            const auto* in = trackBuffer.GetChannelData(ch);
            for (int i = 0; i < outputBuffer.GetNumFrames(); ++i) {
                out[i] += in[i];
            }
        }
    }
}

void Track::StartRecording() {
    if (recordArmed_.load()) {
        isRecording_ = true;
        std::lock_guard<std::mutex> lock(recordingMutex_);
        recordingBuffers_.clear();
        std::cout << "Track " << name_ << " started recording." << std::endl;
    }
}

void Track::StopRecording() {
    if (isRecording_.load()) {
        isRecording_ = false;
        std::cout << "Track " << name_ << " stopped recording." << std::endl;
    }
}

void Track::AddRecordedSample(const AudioBuffer& buffer) {
    if (isRecording_.load()) {
        std::lock_guard<std::mutex> lock(recordingMutex_);
        recordingBuffers_.push_back(buffer);
    }
}

void Track::ProcessClips(AudioBuffer& buffer, double startTime, double endTime, int sampleRate) {
    // Placeholder
}

void Track::ProcessFXChain(AudioBuffer& buffer) {
    for (auto& fx : fxChain_) {
        if (fx) {
            fx->Process(buffer);
        }
    }
}

void Track::UpdateMetering(const AudioBuffer& buffer) {
    // Placeholder
}

void Track::ApplyVolumeAndPan(AudioBuffer& buffer) {
    float vol = volume_.load();
    float pan = pan_.load();

    float panLeft = std::cos((pan + 1.0f) * 0.25f * M_PI) * vol;
    float panRight = std::sin((pan + 1.0f) * 0.25f * M_PI) * vol;

    if (buffer.GetNumChannels() >= 2) {
        auto* left = buffer.GetChannelData(0);
        auto* right = buffer.GetChannelData(1);
        for (int i = 0; i < buffer.GetNumFrames(); ++i) {
            left[i] *= panLeft;
            right[i] *= panRight;
        }
    } else if (buffer.GetNumChannels() == 1) {
        auto* mono = buffer.GetChannelData(0);
        for (int i = 0; i < buffer.GetNumFrames(); ++i) {
            mono[i] *= vol;
        }
    }
}

std::shared_ptr<Clip> Track::CreateClip(double startTime, double duration, const std::string& name) {
    // Placeholder
    return nullptr;
}

} // namespace DAW
