/*
 * REAPER Web - Effects Chain
 * Manages chain of audio effects for tracks
 */

#pragma once

#include "../jsfx/jsfx_interpreter.hpp"
#include "reaper_effects.hpp"
#include "../audio/audio_buffer.hpp"
#include <vector>
#include <memory>

/**
 * Effect Chain - Manages multiple effects in series
 * Processes audio through chain of JSFX effects
 */
class EffectChain {
public:
    EffectChain();
    ~EffectChain();
    
    // Effect management
    void AddEffect(std::unique_ptr<JSFXEffect> effect);
    void InsertEffect(size_t index, std::unique_ptr<JSFXEffect> effect);
    void RemoveEffect(size_t index);
    void MoveEffect(size_t fromIndex, size_t toIndex);
    void ClearEffects();
    
    // Processing
    void ProcessAudio(AudioBuffer& buffer);
    void ProcessSample(double& left, double& right);
    
    // Effect access
    size_t GetEffectCount() const { return m_effects.size(); }
    JSFXEffect* GetEffect(size_t index);
    const JSFXEffect* GetEffect(size_t index) const;
    
    // Bypass control
    void SetBypass(bool bypass) { m_bypass = bypass; }
    bool IsBypassed() const { return m_bypass; }
    
    void SetEffectBypass(size_t index, bool bypass);
    bool IsEffectBypassed(size_t index) const;
    
    // Automation
    void UpdateAutomation(double timePosition);
    
private:
    std::vector<std::unique_ptr<JSFXEffect>> m_effects;
    bool m_bypass = false;
};

/**
 * Track Effect Processor - Integrates effects with track system
 * Handles effects processing for individual tracks
 */
class TrackEffectProcessor {
public:
    TrackEffectProcessor();
    ~TrackEffectProcessor();
    
    // Effect management
    void SetEffectChain(std::unique_ptr<EffectChain> chain);
    EffectChain* GetEffectChain() { return m_effectChain.get(); }
    
    // Built-in effects access
    void SetBuiltinEffectsManager(std::shared_ptr<BuiltinEffectsManager> manager);
    bool AddBuiltinEffect(const std::string& effectName);
    
    // Processing
    void ProcessTrackAudio(AudioBuffer& buffer, double timePosition);
    
    // Send/Return support (for future implementation)
    void SetSendLevel(int sendIndex, double level);
    double GetSendLevel(int sendIndex) const;
    
private:
    std::unique_ptr<EffectChain> m_effectChain;
    std::shared_ptr<BuiltinEffectsManager> m_builtinManager;
    
    // Send levels for future send/return implementation
    std::array<double, 8> m_sendLevels = {0.0};
};