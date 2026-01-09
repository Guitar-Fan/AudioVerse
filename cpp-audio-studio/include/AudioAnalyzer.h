#pragma once

#include <vector>
#include <cmath>
#include <algorithm>
#include <complex>

class AudioAnalyzer {
public:
    AudioAnalyzer(int sampleRate, int fftSize = 2048);
    ~AudioAnalyzer();

    // Core analysis functions
    void processAudioBuffer(const float* samples, int numSamples);
    
    // FFT Analysis
    void computeFFT(const float* samples, int numSamples);
    const std::vector<float>& getMagnitudeSpectrum() const { return magnitudeSpectrum; }
    const std::vector<float>& getPhaseSpectrum() const { return phaseSpectrum; }
    
    // Time-domain analysis
    float getPeakLevel() const { return peakLevel; }
    float getRMSLevel() const { return rmsLevel; }
    void getWaveformData(float* output, int outputSize, const float* samples, int numSamples);
    
    // Frequency analysis
    float getDominantFrequency() const;
    void getFrequencyBins(float* output, int numBins) const;
    
    // Spectral features
    float getSpectralCentroid() const;
    float getSpectralRolloff() const;
    float getSpectralFlux() const;
    
    int getSampleRate() const { return sampleRate; }
    int getFFTSize() const { return fftSize; }
    
private:
    int sampleRate;
    int fftSize;
    
    // FFT data
    std::vector<std::complex<float>> fftComplex;
    std::vector<float> magnitudeSpectrum;
    std::vector<float> phaseSpectrum;
    std::vector<float> previousMagnitude;
    std::vector<float> window;
    
    // Level meters
    float peakLevel;
    float rmsLevel;
    
    // Helper functions
    void createHannWindow();
    void applyWindow(float* samples, int numSamples);
    void performFFT(const float* input, std::complex<float>* output, int n);
    void computeMagnitudePhase();
};
