/*
 * REAPER Web - Built-in Effects Library Implementation
 * Provides factory for creating REAPER's standard effects
 */

#include "reaper_effects.hpp"
#include <map>

BuiltinEffectsManager::BuiltinEffectsManager() {
    RegisterBuiltinEffects();
}

BuiltinEffectsManager::~BuiltinEffectsManager() {
}

void BuiltinEffectsManager::RegisterBuiltinEffects() {
    // Register all built-in effects with their JSFX scripts
    m_effectScripts["Simple Gain"] = BuiltinJSFX::SIMPLE_GAIN;
    m_effectScripts["Resonant Lowpass"] = BuiltinJSFX::RESONANT_LOWPASS;
    m_effectScripts["Simple Delay"] = BuiltinJSFX::SIMPLE_DELAY;
    m_effectScripts["Simple Compressor"] = BuiltinJSFX::SIMPLE_COMPRESSOR;
    m_effectScripts["High Pass Filter"] = BuiltinJSFX::HIGH_PASS;
    m_effectScripts["DC Remove"] = BuiltinJSFX::DC_REMOVE;
}

std::unique_ptr<JSFXEffect> BuiltinEffectsManager::CreateEffect(const std::string& effectName) {
    auto it = m_effectScripts.find(effectName);
    if (it == m_effectScripts.end()) {
        return nullptr;
    }
    
    // Create JSFX effect from script
    auto effect = std::make_unique<JSFXEffect>();
    if (!effect->LoadFromScript(it->second)) {
        return nullptr;
    }
    
    return effect;
}

std::vector<std::string> BuiltinEffectsManager::GetAvailableEffects() const {
    std::vector<std::string> effects;
    for (const auto& pair : m_effectScripts) {
        effects.push_back(pair.first);
    }
    return effects;
}

std::vector<std::string> BuiltinEffectsManager::GetDynamicsEffects() const {
    return {
        "Simple Compressor"
    };
}

std::vector<std::string> BuiltinEffectsManager::GetFilterEffects() const {
    return {
        "Resonant Lowpass",
        "High Pass Filter",
        "DC Remove"
    };
}

std::vector<std::string> BuiltinEffectsManager::GetDelayEffects() const {
    return {
        "Simple Delay"
    };
}

std::vector<std::string> BuiltinEffectsManager::GetUtilityEffects() const {
    return {
        "Simple Gain",
        "DC Remove"
    };
}

std::string BuiltinEffectsManager::GetEffectScript(const std::string& effectName) const {
    auto it = m_effectScripts.find(effectName);
    if (it != m_effectScripts.end()) {
        return it->second;
    }
    return "";
}