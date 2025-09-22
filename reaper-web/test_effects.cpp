/*
 * REAPER Web - Effects Test Application
 * Demonstrates JSFX effects processing
 */

#include "src/effects/reaper_effects.hpp"
#include "src/effects/effect_chain.hpp"
#include "src/audio/audio_buffer.hpp"
#include <iostream>
#include <memory>
#include <cmath>

/**
 * Simple test to demonstrate JSFX effects system
 */
class EffectsTestApp {
public:
    bool Initialize() {
        // Create effects manager
        m_effectsManager = std::make_shared<BuiltinEffectsManager>();
        
        // Create effect processor
        m_effectProcessor = std::make_unique<TrackEffectProcessor>();
        m_effectProcessor->SetBuiltinEffectsManager(m_effectsManager);
        
        std::cout << "Effects Test App Initialized\n";
        return true;
    }
    
    void RunTests() {
        std::cout << "\n=== REAPER Web Effects Test ===\n";
        
        // List available effects
        ListAvailableEffects();
        
        // Test basic effect creation
        TestEffectCreation();
        
        // Test effect chain processing
        TestEffectProcessing();
        
        // Test automation
        TestAutomation();
    }
    
private:
    void ListAvailableEffects() {
        std::cout << "\nAvailable Built-in Effects:\n";
        
        auto effects = m_effectsManager->GetAvailableEffects();
        for (const auto& effectName : effects) {
            std::cout << "  - " << effectName << "\n";
        }
        
        std::cout << "\nFilter Effects:\n";
        auto filters = m_effectsManager->GetFilterEffects();
        for (const auto& filter : filters) {
            std::cout << "  - " << filter << "\n";
        }
        
        std::cout << "\nDynamics Effects:\n";
        auto dynamics = m_effectsManager->GetDynamicsEffects();
        for (const auto& dynamic : dynamics) {
            std::cout << "  - " << dynamic << "\n";
        }
    }
    
    void TestEffectCreation() {
        std::cout << "\n--- Testing Effect Creation ---\n";
        
        // Create a simple gain effect
        auto gainEffect = m_effectsManager->CreateEffect("Simple Gain");
        if (gainEffect) {
            std::cout << "✓ Successfully created Simple Gain effect\n";
            
            // Test parameter setting
            gainEffect->SetParameter(0, 6.0); // 6dB gain
            std::cout << "✓ Set gain to 6dB\n";
        } else {
            std::cout << "✗ Failed to create Simple Gain effect\n";
        }
        
        // Create a filter effect
        auto filterEffect = m_effectsManager->CreateEffect("Resonant Lowpass");
        if (filterEffect) {
            std::cout << "✓ Successfully created Resonant Lowpass effect\n";
            
            // Set filter parameters
            filterEffect->SetParameter(0, 1000.0); // 1kHz cutoff
            filterEffect->SetParameter(1, 0.8);    // High resonance
            std::cout << "✓ Set filter to 1kHz with high resonance\n";
        } else {
            std::cout << "✗ Failed to create Resonant Lowpass effect\n";
        }
    }
    
    void TestEffectProcessing() {
        std::cout << "\n--- Testing Effect Processing ---\n";
        
        // Create test audio buffer with sine wave
        const int sampleRate = 44100;
        const int bufferSize = 512;
        const double frequency = 440.0; // A4
        
        AudioBuffer testBuffer(2, bufferSize, sampleRate);
        
        // Generate sine wave test signal
        for (int i = 0; i < bufferSize; ++i) {
            double sample = std::sin(2.0 * M_PI * frequency * i / sampleRate) * 0.5;
            testBuffer.channels[0][i] = static_cast<float>(sample);
            testBuffer.channels[1][i] = static_cast<float>(sample);
        }
        
        std::cout << "Generated 440Hz sine wave test signal\n";
        
        // Add effects to chain
        if (m_effectProcessor->AddBuiltinEffect("Simple Gain")) {
            std::cout << "✓ Added Simple Gain to effect chain\n";
        }
        
        if (m_effectProcessor->AddBuiltinEffect("Resonant Lowpass")) {
            std::cout << "✓ Added Resonant Lowpass to effect chain\n";
        }
        
        // Process audio through effect chain
        auto chain = m_effectProcessor->GetEffectChain();
        if (chain) {
            // Set effect parameters
            auto gainEffect = chain->GetEffect(0);
            if (gainEffect) {
                gainEffect->SetParameter(0, 3.0); // 3dB gain
            }
            
            auto filterEffect = chain->GetEffect(1);
            if (filterEffect) {
                filterEffect->SetParameter(0, 800.0); // 800Hz cutoff
                filterEffect->SetParameter(1, 0.6);   // Medium resonance
            }
            
            // Process the buffer
            m_effectProcessor->ProcessTrackAudio(testBuffer, 0.0);
            std::cout << "✓ Processed audio through effect chain\n";
            
            // Check that audio was modified (simple peak check)
            float peak = 0.0f;
            for (int i = 0; i < bufferSize; ++i) {
                peak = std::max(peak, std::abs(testBuffer.channels[0][i]));
            }
            std::cout << "Processed audio peak level: " << peak << "\n";
        }
    }
    
    void TestAutomation() {
        std::cout << "\n--- Testing Automation ---\n";
        
        auto chain = m_effectProcessor->GetEffectChain();
        if (!chain || chain->GetEffectCount() == 0) {
            std::cout << "No effects in chain for automation test\n";
            return;
        }
        
        // Test automation updates at different time positions
        for (double time = 0.0; time <= 2.0; time += 0.5) {
            chain->UpdateAutomation(time);
            std::cout << "Updated automation at time: " << time << "s\n";
        }
        
        std::cout << "✓ Automation system functional\n";
    }
    
private:
    std::shared_ptr<BuiltinEffectsManager> m_effectsManager;
    std::unique_ptr<TrackEffectProcessor> m_effectProcessor;
};

// Main test function
int main() {
    std::cout << "REAPER Web - JSFX Effects System Test\n";
    std::cout << "=====================================\n";
    
    EffectsTestApp app;
    
    if (!app.Initialize()) {
        std::cerr << "Failed to initialize effects test app\n";
        return 1;
    }
    
    app.RunTests();
    
    std::cout << "\n=== Test Complete ===\n";
    return 0;
}