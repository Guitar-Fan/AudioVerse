#include <iostream>
#include <cassert>
#include <memory>
#include "AudioBuffer.hpp"
#include "Track.hpp"
#include "Clip.hpp"
#include "BasicFX.hpp"

void testAudioBuffer() {
    std::cout << "Testing AudioBuffer...\n";
    
    // Test creation
    AudioBuffer buffer(2, 512, 44100.0);
    assert(buffer.getNumChannels() == 2);
    assert(buffer.getNumSamples() == 512);
    assert(buffer.getSampleRate() == 44100.0);
    
    // Test clear
    buffer.setSample(0, 100, 0.5f);
    assert(buffer.getSample(0, 100) == 0.5f);
    buffer.clear();
    assert(buffer.getSample(0, 100) == 0.0f);
    
    // Test gain
    buffer.setSample(0, 100, 0.5f);
    buffer.setSample(1, 100, -0.3f);
    buffer.applyGain(2.0f);
    assert(buffer.getSample(0, 100) == 1.0f);
    assert(buffer.getSample(1, 100) == -0.6f);
    
    std::cout << "AudioBuffer tests passed!\n";
}

void testTrack() {
    std::cout << "Testing Track...\n";
    
    Track track("Test Track", 44100.0, 512);
    assert(track.getName() == "Test Track");
    assert(track.getSampleRate() == 44100.0);
    
    // Test volume and pan
    track.setVolume(0.8f);
    track.setPan(-0.5f);
    assert(track.getVolume() == 0.8f);
    assert(track.getPan() == -0.5f);
    
    // Test mute and solo
    track.setMuted(true);
    track.setSoloed(true);
    assert(track.isMuted() == true);
    assert(track.isSoloed() == true);
    
    std::cout << "Track tests passed!\n";
}

void testClip() {
    std::cout << "Testing Clip...\n";
    
    Clip clip("Test Clip", 44100.0);
    assert(clip.getName() == "Test Clip");
    assert(clip.getSampleRate() == 44100.0);
    
    // Test timing
    clip.setStartTime(1.5);
    clip.setDuration(3.0);
    assert(clip.getStartTime() == 1.5);
    assert(clip.getDuration() == 3.0);
    assert(clip.getEndTime() == 4.5);
    
    // Test fades
    clip.setFadeIn(0.5);
    clip.setFadeOut(0.3);
    assert(clip.getFadeIn() == 0.5);
    assert(clip.getFadeOut() == 0.3);
    
    // Test gain
    clip.setGain(1.5f);
    assert(clip.getGain() == 1.5f);
    
    std::cout << "Clip tests passed!\n";
}

void testDelayFX() {
    std::cout << "Testing DelayFX...\n";
    
    DelayFX delay;
    delay.setSampleRate(44100.0);
    
    // Test parameters
    assert(delay.hasParameter("delayTime"));
    assert(delay.hasParameter("feedback"));
    assert(delay.hasParameter("wetLevel"));
    assert(delay.hasParameter("dryLevel"));
    
    delay.setParameter("delayTime", 0.5f);
    assert(delay.getParameter("delayTime") == 0.5f);
    
    // Test processing (basic functionality)
    AudioBuffer buffer(2, 256, 44100.0);
    buffer.setSample(0, 0, 1.0f);
    buffer.setSample(1, 0, 1.0f);
    
    delay.process(buffer, 256);
    // After processing, the signal should be modified
    
    std::cout << "DelayFX tests passed!\n";
}

void testChorusFX() {
    std::cout << "Testing ChorusFX...\n";
    
    ChorusFX chorus;
    chorus.setSampleRate(44100.0);
    
    // Test parameters
    assert(chorus.hasParameter("rate"));
    assert(chorus.hasParameter("depth"));
    assert(chorus.hasParameter("wetLevel"));
    assert(chorus.hasParameter("dryLevel"));
    
    chorus.setParameter("rate", 1.0f);
    assert(chorus.getParameter("rate") == 1.0f);
    
    // Test processing
    AudioBuffer buffer(2, 256, 44100.0);
    buffer.setSample(0, 0, 0.8f);
    buffer.setSample(1, 0, 0.8f);
    
    chorus.process(buffer, 256);
    
    std::cout << "ChorusFX tests passed!\n";
}

void testReverbFX() {
    std::cout << "Testing ReverbFX...\n";
    
    ReverbFX reverb;
    reverb.setSampleRate(44100.0);
    
    // Test parameters
    assert(reverb.hasParameter("roomSize"));
    assert(reverb.hasParameter("damping"));
    assert(reverb.hasParameter("wetLevel"));
    assert(reverb.hasParameter("dryLevel"));
    
    reverb.setParameter("roomSize", 0.7f);
    assert(reverb.getParameter("roomSize") == 0.7f);
    
    // Test processing
    AudioBuffer buffer(2, 256, 44100.0);
    buffer.setSample(0, 0, 0.6f);
    buffer.setSample(1, 0, 0.6f);
    
    reverb.process(buffer, 256);
    
    std::cout << "ReverbFX tests passed!\n";
}

int main() {
    std::cout << "Running C++ DAW Tests...\n\n";
    
    try {
        testAudioBuffer();
        testTrack();
        testClip();
        testDelayFX();
        testChorusFX();
        testReverbFX();
        
        std::cout << "\n✓ All tests passed successfully!\n";
        return 0;
    } catch (const std::exception& e) {
        std::cerr << "Test failed with exception: " << e.what() << "\n";
        return 1;
    } catch (...) {
        std::cerr << "Test failed with unknown exception\n";
        return 1;
    }
}
