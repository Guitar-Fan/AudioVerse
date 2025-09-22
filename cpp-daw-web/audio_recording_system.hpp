#pragma once
#include <vector>
#include <memory>
#include <string>
#include <fstream>
#include <atomic>
#include <queue>
#include <functional>

// Audio file writing system (inspired by Reaper's file handling)
class AudioFileWriter {
public:
    enum class Format {
        WAV_16BIT,
        WAV_24BIT,
        WAV_32BIT_FLOAT
    };
    
    struct AudioFormat {
        int sampleRate = 44100;
        int channels = 2;
        Format format = Format::WAV_32BIT_FLOAT;
    };
    
private:
    std::string filename;
    AudioFormat format;
    std::ofstream file;
    bool isOpen = false;
    int64_t samplesWritten = 0;
    
    // WAV header structure
    struct WAVHeader {
        char riff[4] = {'R', 'I', 'F', 'F'};
        uint32_t fileSize = 0;
        char wave[4] = {'W', 'A', 'V', 'E'};
        char fmt[4] = {'f', 'm', 't', ' '};
        uint32_t fmtSize = 16;
        uint16_t audioFormat = 1; // PCM
        uint16_t numChannels = 2;
        uint32_t sampleRate = 44100;
        uint32_t byteRate = 176400;
        uint16_t blockAlign = 4;
        uint16_t bitsPerSample = 16;
        char data[4] = {'d', 'a', 't', 'a'};
        uint32_t dataSize = 0;
    };
    
public:
    AudioFileWriter(const std::string& filename, const AudioFormat& fmt) 
        : filename(filename), format(fmt) {}
    
    ~AudioFileWriter() {
        close();
    }
    
    bool open() {
        if (isOpen) return true;
        
        file.open(filename, std::ios::binary);
        if (!file.is_open()) return false;
        
        // Write WAV header (will be updated on close)
        WAVHeader header;
        header.numChannels = format.channels;
        header.sampleRate = format.sampleRate;
        
        switch (format.format) {
            case Format::WAV_16BIT:
                header.bitsPerSample = 16;
                header.audioFormat = 1; // PCM
                break;
            case Format::WAV_24BIT:
                header.bitsPerSample = 24;
                header.audioFormat = 1; // PCM
                break;
            case Format::WAV_32BIT_FLOAT:
                header.bitsPerSample = 32;
                header.audioFormat = 3; // IEEE float
                break;
        }
        
        header.blockAlign = (header.bitsPerSample / 8) * header.numChannels;
        header.byteRate = header.sampleRate * header.blockAlign;
        
        file.write(reinterpret_cast<const char*>(&header), sizeof(header));
        
        isOpen = true;
        samplesWritten = 0;
        return true;
    }
    
    void writeInterleavedSamples(const float* samples, int numFrames) {
        if (!isOpen || !samples) return;
        
        for (int i = 0; i < numFrames * format.channels; ++i) {
            float sample = std::clamp(samples[i], -1.0f, 1.0f);
            
            switch (format.format) {
                case Format::WAV_16BIT: {
                    int16_t intSample = static_cast<int16_t>(sample * 32767.0f);
                    file.write(reinterpret_cast<const char*>(&intSample), sizeof(intSample));
                    break;
                }
                case Format::WAV_24BIT: {
                    int32_t intSample = static_cast<int32_t>(sample * 8388607.0f);
                    // Write 24-bit (3 bytes)
                    file.write(reinterpret_cast<const char*>(&intSample), 3);
                    break;
                }
                case Format::WAV_32BIT_FLOAT: {
                    file.write(reinterpret_cast<const char*>(&sample), sizeof(sample));
                    break;
                }
            }
        }
        
        samplesWritten += numFrames;
    }
    
    void close() {
        if (!isOpen) return;
        
        // Update WAV header with correct sizes
        int bytesPerSample = 0;
        switch (format.format) {
            case Format::WAV_16BIT: bytesPerSample = 2; break;
            case Format::WAV_24BIT: bytesPerSample = 3; break;
            case Format::WAV_32BIT_FLOAT: bytesPerSample = 4; break;
        }
        
        uint32_t dataSize = samplesWritten * format.channels * bytesPerSample;
        uint32_t fileSize = dataSize + sizeof(WAVHeader) - 8;
        
        // Seek back and update header
        file.seekp(4);
        file.write(reinterpret_cast<const char*>(&fileSize), sizeof(fileSize));
        file.seekp(40);
        file.write(reinterpret_cast<const char*>(&dataSize), sizeof(dataSize));
        
        file.close();
        isOpen = false;
    }
    
    bool getIsOpen() const { return isOpen; }
    int64_t getSamplesWritten() const { return samplesWritten; }
};

// Audio recording buffer (circular buffer for real-time recording)
class RecordingBuffer {
private:
    std::vector<float> buffer;
    std::atomic<int> writePos;
    std::atomic<int> readPos;
    int bufferSize;
    int channels;
    
public:
    RecordingBuffer(int size, int numChannels) 
        : bufferSize(size), channels(numChannels), writePos(0), readPos(0) {
        buffer.resize(size * channels, 0.0f);
    }
    
    void write(const float* samples, int numFrames) {
        int wp = writePos.load();
        
        for (int frame = 0; frame < numFrames; ++frame) {
            for (int ch = 0; ch < channels; ++ch) {
                int index = (wp * channels + ch) % buffer.size();
                buffer[index] = samples[frame * channels + ch];
            }
            wp = (wp + 1) % (bufferSize);
        }
        
        writePos.store(wp);
    }
    
    int read(float* samples, int maxFrames) {
        int rp = readPos.load();
        int wp = writePos.load();
        
        int available;
        if (wp >= rp) {
            available = wp - rp;
        } else {
            available = bufferSize - rp + wp;
        }
        
        int framesToRead = std::min(maxFrames, available);
        
        for (int frame = 0; frame < framesToRead; ++frame) {
            for (int ch = 0; ch < channels; ++ch) {
                int index = (rp * channels + ch) % buffer.size();
                samples[frame * channels + ch] = buffer[index];
            }
            rp = (rp + 1) % bufferSize;
        }
        
        readPos.store(rp);
        return framesToRead;
    }
    
    void clear() {
        writePos.store(0);
        readPos.store(0);
        std::fill(buffer.begin(), buffer.end(), 0.0f);
    }
    
    int getAvailableFrames() const {
        int wp = writePos.load();
        int rp = readPos.load();
        
        if (wp >= rp) {
            return wp - rp;
        } else {
            return bufferSize - rp + wp;
        }
    }
};

// Track recording state and management
class TrackRecorder {
public:
    enum class RecordMode {
        OVERDUB,        // Add to existing audio
        REPLACE,        // Replace existing audio
        PUNCH_IN_OUT    // Record only in specified range
    };
    
    struct RecordingState {
        bool isArmed = false;
        bool isRecording = false;
        RecordMode mode = RecordMode::OVERDUB;
        double punchInTime = 0.0;
        double punchOutTime = 0.0;
        std::string recordingPath;
        double recordingStartTime = 0.0;
    };
    
private:
    int trackId;
    RecordingState state;
    std::unique_ptr<RecordingBuffer> buffer;
    std::unique_ptr<AudioFileWriter> fileWriter;
    AudioFileWriter::AudioFormat audioFormat;
    
public:
    TrackRecorder(int id, int bufferSize = 8192, int channels = 2) 
        : trackId(id) {
        buffer = std::make_unique<RecordingBuffer>(bufferSize, channels);
        audioFormat.channels = channels;
    }
    
    bool startRecording(const std::string& filename, double startTime) {
        if (state.isRecording || !state.isArmed) return false;
        
        state.recordingPath = filename;
        state.recordingStartTime = startTime;
        
        fileWriter = std::make_unique<AudioFileWriter>(filename, audioFormat);
        if (!fileWriter->open()) {
            fileWriter.reset();
            return false;
        }
        
        buffer->clear();
        state.isRecording = true;
        
        return true;
    }
    
    void stopRecording() {
        if (!state.isRecording) return;
        
        // Flush remaining buffer to file
        if (fileWriter) {
            flushBufferToFile();
            fileWriter->close();
            fileWriter.reset();
        }
        
        state.isRecording = false;
    }
    
    void processAudio(const float* inputSamples, int numFrames, double currentTime) {
        if (!state.isRecording) return;
        
        // Check punch in/out times for punch recording
        if (state.mode == RecordMode::PUNCH_IN_OUT) {
            if (currentTime < state.punchInTime || currentTime > state.punchOutTime) {
                return; // Outside punch range
            }
        }
        
        // Write to recording buffer
        buffer->write(inputSamples, numFrames);
        
        // Periodically flush to file to avoid buffer overflow
        if (buffer->getAvailableFrames() > 4096) {
            flushBufferToFile();
        }
    }
    
    // Recording state management
    void armForRecording(bool armed) { state.isArmed = armed; }
    bool isArmed() const { return state.isArmed; }
    bool isRecording() const { return state.isRecording; }
    
    void setRecordMode(RecordMode mode) { state.mode = mode; }
    void setPunchTimes(double inTime, double outTime) {
        state.punchInTime = inTime;
        state.punchOutTime = outTime;
    }
    
    void setAudioFormat(const AudioFileWriter::AudioFormat& format) {
        audioFormat = format;
    }
    
    const RecordingState& getState() const { return state; }
    
private:
    void flushBufferToFile() {
        if (!fileWriter || !buffer) return;
        
        const int maxFrames = 1024;
        std::vector<float> tempBuffer(maxFrames * audioFormat.channels);
        
        int framesRead;
        while ((framesRead = buffer->read(tempBuffer.data(), maxFrames)) > 0) {
            fileWriter->writeInterleavedSamples(tempBuffer.data(), framesRead);
        }
    }
};

// Main recording engine coordinating all track recording
class RecordingEngine {
private:
    std::vector<std::unique_ptr<TrackRecorder>> trackRecorders;
    std::string recordingDirectory;
    bool isGlobalRecording = false;
    double recordingStartTime = 0.0;
    int recordingTakeNumber = 1;
    
public:
    RecordingEngine(const std::string& recordDir = "./recordings/") 
        : recordingDirectory(recordDir) {}
    
    TrackRecorder* getTrackRecorder(int trackId) {
        for (auto& recorder : trackRecorders) {
            if (recorder && trackId < trackRecorders.size()) {
                return trackRecorders[trackId].get();
            }
        }
        return nullptr;
    }
    
    void addTrackRecorder(int trackId) {
        if (trackId >= trackRecorders.size()) {
            trackRecorders.resize(trackId + 1);
        }
        
        trackRecorders[trackId] = std::make_unique<TrackRecorder>(trackId);
    }
    
    bool startGlobalRecording(double currentTime) {
        if (isGlobalRecording) return false;
        
        recordingStartTime = currentTime;
        isGlobalRecording = true;
        
        // Start recording on all armed tracks
        for (int i = 0; i < trackRecorders.size(); ++i) {
            auto& recorder = trackRecorders[i];
            if (recorder && recorder->isArmed()) {
                std::string filename = generateRecordingFilename(i);
                recorder->startRecording(filename, currentTime);
            }
        }
        
        return true;
    }
    
    void stopGlobalRecording() {
        if (!isGlobalRecording) return;
        
        // Stop recording on all tracks
        for (auto& recorder : trackRecorders) {
            if (recorder && recorder->isRecording()) {
                recorder->stopRecording();
            }
        }
        
        isGlobalRecording = false;
        recordingTakeNumber++;
    }
    
    void processAudioInput(int trackId, const float* inputSamples, int numFrames, double currentTime) {
        if (trackId < trackRecorders.size() && trackRecorders[trackId]) {
            trackRecorders[trackId]->processAudio(inputSamples, numFrames, currentTime);
        }
    }
    
    // Utility functions
    void armTrack(int trackId, bool armed) {
        if (auto recorder = getTrackRecorder(trackId)) {
            recorder->armForRecording(armed);
        }
    }
    
    bool isTrackArmed(int trackId) const {
        if (trackId < trackRecorders.size() && trackRecorders[trackId]) {
            return trackRecorders[trackId]->isArmed();
        }
        return false;
    }
    
    bool isTrackRecording(int trackId) const {
        if (trackId < trackRecorders.size() && trackRecorders[trackId]) {
            return trackRecorders[trackId]->isRecording();
        }
        return false;
    }
    
    bool getIsGlobalRecording() const { return isGlobalRecording; }
    
private:
    std::string generateRecordingFilename(int trackId) {
        return recordingDirectory + "track_" + std::to_string(trackId) + 
               "_take_" + std::to_string(recordingTakeNumber) + ".wav";
    }
};