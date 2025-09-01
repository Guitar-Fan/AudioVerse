#include "DAWEngine.hpp"
#include <algorithm>
#include <chrono>
#include <iostream>
#include <alsa/asoundlib.h>

namespace DAW {

DAWEngine::DAWEngine() 
    : m_isInitialized(false), m_isPlaying(false), m_sampleRate(44100.0), 
      m_bufferSize(512), m_alsaDevice(nullptr) {
    
    m_settings.outputDevice = "default";
    m_settings.inputDevice = "default";
    m_settings.sampleRate = 44100;
    m_settings.bufferSize = 512;
    
    // Initialize with stereo output
    m_outputBuffer = std::make_unique<AudioBuffer>(2, m_bufferSize, m_sampleRate);
}

DAWEngine::~DAWEngine() {
    shutdown();
}

bool DAWEngine::initialize() {
    if (m_isInitialized) {
        return true;
    }
    
    // Initialize ALSA
    if (!initializeAudio()) {
        std::cerr << "Failed to initialize audio system" << std::endl;
        return false;
    }
    
    // Initialize transport
    m_transport.setSampleRate(m_sampleRate);
    m_transport.setTempo(120.0);
    
    m_isInitialized = true;
    std::cout << "DAW Engine initialized successfully" << std::endl;
    std::cout << "Sample Rate: " << m_sampleRate << " Hz" << std::endl;
    std::cout << "Buffer Size: " << m_bufferSize << " samples" << std::endl;
    
    return true;
}

void DAWEngine::shutdown() {
    if (!m_isInitialized) {
        return;
    }
    
    stop();
    
    // Shutdown ALSA
    if (m_alsaDevice) {
        snd_pcm_close(static_cast<snd_pcm_t*>(m_alsaDevice));
        m_alsaDevice = nullptr;
    }
    
    m_tracks.clear();
    m_isInitialized = false;
    
    std::cout << "DAW Engine shut down" << std::endl;
}

bool DAWEngine::initializeAudio() {
    snd_pcm_t* pcm_handle;
    snd_pcm_hw_params_t* hw_params;
    
    // Open PCM device for playback
    int err = snd_pcm_open(&pcm_handle, m_settings.outputDevice.c_str(), 
                          SND_PCM_STREAM_PLAYBACK, 0);
    if (err < 0) {
        std::cerr << "Cannot open audio device: " << snd_strerror(err) << std::endl;
        return false;
    }
    
    // Allocate hardware parameters object
    snd_pcm_hw_params_alloca(&hw_params);
    
    // Initialize hardware parameters
    snd_pcm_hw_params_any(pcm_handle, hw_params);
    
    // Set access type
    snd_pcm_hw_params_set_access(pcm_handle, hw_params, SND_PCM_ACCESS_RW_INTERLEAVED);
    
    // Set sample format
    snd_pcm_hw_params_set_format(pcm_handle, hw_params, SND_PCM_FORMAT_FLOAT_LE);
    
    // Set sample rate
    unsigned int sample_rate = static_cast<unsigned int>(m_settings.sampleRate);
    snd_pcm_hw_params_set_rate_near(pcm_handle, hw_params, &sample_rate, 0);
    m_sampleRate = sample_rate;
    
    // Set number of channels
    snd_pcm_hw_params_set_channels(pcm_handle, hw_params, 2);
    
    // Set buffer size
    snd_pcm_uframes_t buffer_size = m_settings.bufferSize * 4; // 4x buffer for safety
    snd_pcm_hw_params_set_buffer_size_near(pcm_handle, hw_params, &buffer_size);
    
    // Set period size
    snd_pcm_uframes_t period_size = m_settings.bufferSize;
    snd_pcm_hw_params_set_period_size_near(pcm_handle, hw_params, &period_size, 0);
    
    // Apply hardware parameters
    err = snd_pcm_hw_params(pcm_handle, hw_params);
    if (err < 0) {
        std::cerr << "Cannot set hardware parameters: " << snd_strerror(err) << std::endl;
        snd_pcm_close(pcm_handle);
        return false;
    }
    
    // Prepare device
    err = snd_pcm_prepare(pcm_handle);
    if (err < 0) {
        std::cerr << "Cannot prepare audio device: " << snd_strerror(err) << std::endl;
        snd_pcm_close(pcm_handle);
        return false;
    }
    
    m_alsaDevice = pcm_handle;
    m_bufferSize = period_size;
    
    // Update output buffer size
    m_outputBuffer->resize(2, m_bufferSize);
    
    return true;
}

void DAWEngine::processAudio() {
    if (!m_isInitialized || !m_alsaDevice) {
        return;
    }
    
    snd_pcm_t* pcm_handle = static_cast<snd_pcm_t*>(m_alsaDevice);
    
    while (m_isPlaying) {
        // Clear output buffer
        m_outputBuffer->clear();
        
        // Update transport
        m_transport.process(m_bufferSize);
        
        // Process all tracks
        for (auto& track : m_tracks) {
            track->process(*m_outputBuffer, m_transport.getSamplePosition(), 
                          m_bufferSize, m_transport.isPlaying());
        }
        
        // Convert to interleaved format for ALSA
        std::vector<float> interleavedData(m_bufferSize * 2);
        const float* leftChannel = m_outputBuffer->getReadPointer(0);
        const float* rightChannel = m_outputBuffer->getReadPointer(1);
        
        for (size_t i = 0; i < m_bufferSize; ++i) {
            interleavedData[i * 2] = leftChannel[i];
            interleavedData[i * 2 + 1] = rightChannel[i];
        }
        
        // Write to ALSA device
        snd_pcm_sframes_t frames_written = snd_pcm_writei(pcm_handle, 
            interleavedData.data(), m_bufferSize);
        
        if (frames_written < 0) {
            if (frames_written == -EPIPE) {
                // Buffer underrun
                std::cerr << "Buffer underrun occurred" << std::endl;
                snd_pcm_prepare(pcm_handle);
            } else {
                std::cerr << "Write error: " << snd_strerror(frames_written) << std::endl;
            }
        }
    }
}

void DAWEngine::start() {
    if (!m_isInitialized) {
        std::cerr << "Engine not initialized" << std::endl;
        return;
    }
    
    if (m_isPlaying) {
        return;
    }
    
    m_transport.play();
    m_isPlaying = true;
    
    // Start audio processing thread
    m_audioThread = std::thread(&DAWEngine::processAudio, this);
    
    std::cout << "Playback started" << std::endl;
}

void DAWEngine::stop() {
    if (!m_isPlaying) {
        return;
    }
    
    m_transport.stop();
    m_isPlaying = false;
    
    // Wait for audio thread to finish
    if (m_audioThread.joinable()) {
        m_audioThread.join();
    }
    
    std::cout << "Playback stopped" << std::endl;
}

void DAWEngine::pause() {
    if (m_isPlaying) {
        m_transport.pause();
    }
}

size_t DAWEngine::addTrack(const std::string& name) {
    auto track = std::make_unique<Track>(name, m_sampleRate, m_bufferSize);
    size_t trackId = m_tracks.size();
    m_tracks.push_back(std::move(track));
    
    std::cout << "Added track: " << name << " (ID: " << trackId << ")" << std::endl;
    return trackId;
}

Track* DAWEngine::getTrack(size_t trackId) {
    return (trackId < m_tracks.size()) ? m_tracks[trackId].get() : nullptr;
}

void DAWEngine::removeTrack(size_t trackId) {
    if (trackId < m_tracks.size()) {
        m_tracks.erase(m_tracks.begin() + trackId);
        std::cout << "Removed track ID: " << trackId << std::endl;
    }
}

bool DAWEngine::loadAudioFile(const std::string& filepath, size_t trackId) {
    // Placeholder for audio file loading
    // In a real implementation, this would use a library like libsndfile
    // to load WAV, FLAC, OGG, etc. files
    
    Track* track = getTrack(trackId);
    if (!track) {
        std::cerr << "Invalid track ID: " << trackId << std::endl;
        return false;
    }
    
    std::cout << "Loading audio file: " << filepath << " to track " << trackId << std::endl;
    // TODO: Implement actual file loading
    return true;
}

void DAWEngine::setSampleRate(double sampleRate) {
    if (m_isPlaying) {
        std::cerr << "Cannot change sample rate while playing" << std::endl;
        return;
    }
    
    m_sampleRate = sampleRate;
    m_settings.sampleRate = static_cast<int>(sampleRate);
    m_transport.setSampleRate(sampleRate);
    
    // Update all tracks
    for (auto& track : m_tracks) {
        track->setSampleRate(sampleRate);
    }
}

void DAWEngine::setBufferSize(size_t bufferSize) {
    if (m_isPlaying) {
        std::cerr << "Cannot change buffer size while playing" << std::endl;
        return;
    }
    
    m_bufferSize = bufferSize;
    m_settings.bufferSize = bufferSize;
    m_outputBuffer->resize(2, bufferSize);
    
    // Update all tracks
    for (auto& track : m_tracks) {
        track->setBufferSize(bufferSize);
    }
}

double DAWEngine::getCurrentTime() const {
    return m_transport.getTimeSeconds();
}

size_t DAWEngine::getCurrentSample() const {
    return m_transport.getSamplePosition();
}

void DAWEngine::setTempo(double bpm) {
    m_transport.setTempo(bpm);
}

double DAWEngine::getTempo() const {
    return m_transport.getTempo();
}

void DAWEngine::setLooping(bool shouldLoop, double loopStart, double loopEnd) {
    m_transport.setLooping(shouldLoop);
    m_transport.setLoopPoints(loopStart, loopEnd);
}

void DAWEngine::setPosition(double timeSeconds) {
    m_transport.setPosition(timeSeconds);
}

} // namespace DAW
