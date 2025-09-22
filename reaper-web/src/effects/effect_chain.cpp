/*
 * REAPER Web - Effects Chain Implementation
 * Processes audio through chain of JSFX effects
 */

#include "effect_chain.hpp"
#include <algorithm>

// EffectChain Implementation

EffectChain::EffectChain() {
}

EffectChain::~EffectChain() {
}

void EffectChain::AddEffect(std::unique_ptr<JSFXEffect> effect) {
    if (effect) {
        m_effects.push_back(std::move(effect));
    }
}

void EffectChain::InsertEffect(size_t index, std::unique_ptr<JSFXEffect> effect) {
    if (effect && index <= m_effects.size()) {
        m_effects.insert(m_effects.begin() + index, std::move(effect));
    }
}

void EffectChain::RemoveEffect(size_t index) {
    if (index < m_effects.size()) {
        m_effects.erase(m_effects.begin() + index);
    }
}

void EffectChain::MoveEffect(size_t fromIndex, size_t toIndex) {
    if (fromIndex < m_effects.size() && toIndex < m_effects.size() && fromIndex != toIndex) {
        auto effect = std::move(m_effects[fromIndex]);
        m_effects.erase(m_effects.begin() + fromIndex);
        
        // Adjust toIndex if we removed an element before it
        if (fromIndex < toIndex) {
            toIndex--;
        }
        
        m_effects.insert(m_effects.begin() + toIndex, std::move(effect));
    }
}

void EffectChain::ClearEffects() {
    m_effects.clear();
}

void EffectChain::ProcessAudio(AudioBuffer& buffer) {
    if (m_bypass || m_effects.empty()) {
        return;
    }
    
    // Process each effect in sequence
    for (auto& effect : m_effects) {
        if (effect && !effect->IsBypassed()) {
            effect->ProcessBuffer(buffer);
        }
    }
}

void EffectChain::ProcessSample(double& left, double& right) {
    if (m_bypass || m_effects.empty()) {
        return;
    }
    
    // Process each effect in sequence
    for (auto& effect : m_effects) {
        if (effect && !effect->IsBypassed()) {
            effect->ProcessSample(left, right);
        }
    }
}

JSFXEffect* EffectChain::GetEffect(size_t index) {
    if (index < m_effects.size()) {
        return m_effects[index].get();
    }
    return nullptr;
}

const JSFXEffect* EffectChain::GetEffect(size_t index) const {
    if (index < m_effects.size()) {
        return m_effects[index].get();
    }
    return nullptr;
}

void EffectChain::SetEffectBypass(size_t index, bool bypass) {
    if (index < m_effects.size()) {
        m_effects[index]->SetBypass(bypass);
    }
}

bool EffectChain::IsEffectBypassed(size_t index) const {
    if (index < m_effects.size()) {
        return m_effects[index]->IsBypassed();
    }
    return false;
}

void EffectChain::UpdateAutomation(double timePosition) {
    // Update automation for all effects
    for (auto& effect : m_effects) {
        if (effect) {
            effect->UpdateAutomation(timePosition);
        }
    }
}

// TrackEffectProcessor Implementation

TrackEffectProcessor::TrackEffectProcessor() {
    m_effectChain = std::make_unique<EffectChain>();
}

TrackEffectProcessor::~TrackEffectProcessor() {
}

void TrackEffectProcessor::SetEffectChain(std::unique_ptr<EffectChain> chain) {
    m_effectChain = std::move(chain);
}

void TrackEffectProcessor::SetBuiltinEffectsManager(std::shared_ptr<BuiltinEffectsManager> manager) {
    m_builtinManager = manager;
}

bool TrackEffectProcessor::AddBuiltinEffect(const std::string& effectName) {
    if (!m_builtinManager || !m_effectChain) {
        return false;
    }
    
    auto effect = m_builtinManager->CreateEffect(effectName);
    if (!effect) {
        return false;
    }
    
    m_effectChain->AddEffect(std::move(effect));
    return true;
}

void TrackEffectProcessor::ProcessTrackAudio(AudioBuffer& buffer, double timePosition) {
    if (!m_effectChain) {
        return;
    }
    
    // Update automation before processing
    m_effectChain->UpdateAutomation(timePosition);
    
    // Process through effect chain
    m_effectChain->ProcessAudio(buffer);
}

void TrackEffectProcessor::SetSendLevel(int sendIndex, double level) {
    if (sendIndex >= 0 && sendIndex < m_sendLevels.size()) {
        m_sendLevels[sendIndex] = level;
    }
}

double TrackEffectProcessor::GetSendLevel(int sendIndex) const {
    if (sendIndex >= 0 && sendIndex < m_sendLevels.size()) {
        return m_sendLevels[sendIndex];
    }
    return 0.0;
}