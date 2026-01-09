#include "AudioAnalyzer.h"
#include <cstring>
#include <numeric>

AudioAnalyzer::AudioAnalyzer(int sr, int size) 
    : sampleRate(sr), fftSize(size), peakLevel(0.0f), rmsLevel(0.0f) {
    
    fftComplex.resize(fftSize);
    magnitudeSpectrum.resize(fftSize / 2 + 1);
    phaseSpectrum.resize(fftSize / 2 + 1);
    previousMagnitude.resize(fftSize / 2 + 1, 0.0f);
    window.resize(fftSize);
    
    createHannWindow();
}

AudioAnalyzer::~AudioAnalyzer() {
}

void AudioAnalyzer::createHannWindow() {
    for (int i = 0; i < fftSize; ++i) {
        window[i] = 0.5f * (1.0f - std::cos(2.0f * M_PI * i / (fftSize - 1)));
    }
}

void AudioAnalyzer::applyWindow(float* samples, int numSamples) {
    int size = std::min(numSamples, fftSize);
    for (int i = 0; i < size; ++i) {
        samples[i] *= window[i];
    }
}

void AudioAnalyzer::performFFT(const float* input, std::complex<float>* output, int n) {
    // Simple Cooley-Tukey FFT implementation
    // For production, use a library like KissFFT or JUCE's FFT
    
    // Copy input to output
    for (int i = 0; i < n; ++i) {
        output[i] = std::complex<float>(input[i], 0.0f);
    }
    
    // Bit-reversal permutation
    int j = 0;
    for (int i = 0; i < n - 1; ++i) {
        if (i < j) {
            std::swap(output[i], output[j]);
        }
        int k = n / 2;
        while (k <= j) {
            j -= k;
            k /= 2;
        }
        j += k;
    }
    
    // FFT computation
    for (int size = 2; size <= n; size *= 2) {
        float angle = -2.0f * M_PI / size;
        std::complex<float> wn(std::cos(angle), std::sin(angle));
        
        for (int i = 0; i < n; i += size) {
            std::complex<float> w(1.0f, 0.0f);
            
            for (int j = 0; j < size / 2; ++j) {
                std::complex<float> t = w * output[i + j + size / 2];
                std::complex<float> u = output[i + j];
                
                output[i + j] = u + t;
                output[i + j + size / 2] = u - t;
                w *= wn;
            }
        }
    }
}

void AudioAnalyzer::computeMagnitudePhase() {
    for (size_t i = 0; i < magnitudeSpectrum.size(); ++i) {
        float real = fftComplex[i].real();
        float imag = fftComplex[i].imag();
        
        magnitudeSpectrum[i] = std::sqrt(real * real + imag * imag);
        phaseSpectrum[i] = std::atan2(imag, real);
    }
}

void AudioAnalyzer::processAudioBuffer(const float* samples, int numSamples) {
    // Compute peak level
    peakLevel = 0.0f;
    for (int i = 0; i < numSamples; ++i) {
        float absVal = std::abs(samples[i]);
        if (absVal > peakLevel) {
            peakLevel = absVal;
        }
    }
    
    // Compute RMS level
    float sumSquares = 0.0f;
    for (int i = 0; i < numSamples; ++i) {
        sumSquares += samples[i] * samples[i];
    }
    rmsLevel = std::sqrt(sumSquares / numSamples);
}

void AudioAnalyzer::computeFFT(const float* samples, int numSamples) {
    // Prepare buffer
    std::vector<float> buffer(fftSize, 0.0f);
    int copySize = std::min(numSamples, fftSize);
    std::memcpy(buffer.data(), samples, copySize * sizeof(float));
    
    // Apply window
    applyWindow(buffer.data(), fftSize);
    
    // Perform FFT
    performFFT(buffer.data(), fftComplex.data(), fftSize);
    
    // Compute magnitude and phase
    computeMagnitudePhase();
}

void AudioAnalyzer::getWaveformData(float* output, int outputSize, const float* samples, int numSamples) {
    if (outputSize >= numSamples) {
        std::memcpy(output, samples, numSamples * sizeof(float));
        // Pad with zeros if needed
        if (outputSize > numSamples) {
            std::memset(output + numSamples, 0, (outputSize - numSamples) * sizeof(float));
        }
    } else {
        // Downsample
        float ratio = static_cast<float>(numSamples) / outputSize;
        for (int i = 0; i < outputSize; ++i) {
            int index = static_cast<int>(i * ratio);
            output[i] = samples[index];
        }
    }
}

float AudioAnalyzer::getDominantFrequency() const {
    if (magnitudeSpectrum.empty()) return 0.0f;
    
    auto maxIt = std::max_element(magnitudeSpectrum.begin(), magnitudeSpectrum.end());
    int binIndex = std::distance(magnitudeSpectrum.begin(), maxIt);
    
    float binFrequency = binIndex * (sampleRate / 2.0f) / magnitudeSpectrum.size();
    return binFrequency;
}

void AudioAnalyzer::getFrequencyBins(float* output, int numBins) const {
    int copySize = std::min(numBins, static_cast<int>(magnitudeSpectrum.size()));
    std::memcpy(output, magnitudeSpectrum.data(), copySize * sizeof(float));
    
    if (numBins > copySize) {
        std::memset(output + copySize, 0, (numBins - copySize) * sizeof(float));
    }
}

float AudioAnalyzer::getSpectralCentroid() const {
    float weightedSum = 0.0f;
    float sum = 0.0f;
    
    for (size_t i = 0; i < magnitudeSpectrum.size(); ++i) {
        float frequency = i * (sampleRate / 2.0f) / magnitudeSpectrum.size();
        weightedSum += frequency * magnitudeSpectrum[i];
        sum += magnitudeSpectrum[i];
    }
    
    return (sum > 0.0f) ? (weightedSum / sum) : 0.0f;
}

float AudioAnalyzer::getSpectralRolloff() const {
    float totalEnergy = 0.0f;
    for (float mag : magnitudeSpectrum) {
        totalEnergy += mag;
    }
    
    float threshold = 0.85f * totalEnergy;
    float cumulativeEnergy = 0.0f;
    
    for (size_t i = 0; i < magnitudeSpectrum.size(); ++i) {
        cumulativeEnergy += magnitudeSpectrum[i];
        if (cumulativeEnergy >= threshold) {
            return i * (sampleRate / 2.0f) / magnitudeSpectrum.size();
        }
    }
    
    return sampleRate / 2.0f;
}

float AudioAnalyzer::getSpectralFlux() const {
    float flux = 0.0f;
    
    for (size_t i = 0; i < magnitudeSpectrum.size(); ++i) {
        float diff = magnitudeSpectrum[i] - previousMagnitude[i];
        flux += diff * diff;
    }
    
    return std::sqrt(flux);
}
