#include "DAWEngine.hpp"
#include "BasicFX.hpp"
#include <iostream>
#include <string>
#include <thread>
#include <chrono>
#include <memory>
#include <sstream>

using namespace DAW;

void printUsage() {
    std::cout << "\n=== C++ DAW - Command Line Interface ===\n";
    std::cout << "Commands:\n";
    std::cout << "  play       - Start playback\n";
    std::cout << "  stop       - Stop playback\n";
    std::cout << "  pause      - Pause playback\n";
    std::cout << "  track      - Add a new track\n";
    std::cout << "  tempo <bpm> - Set tempo (e.g., tempo 120)\n";
    std::cout << "  volume <trackId> <level> - Set track volume (0.0-2.0)\n";
    std::cout << "  pan <trackId> <pan> - Set track pan (-1.0 to 1.0)\n";
    std::cout << "  mute <trackId> - Toggle track mute\n";
    std::cout << "  solo <trackId> - Toggle track solo\n";
    std::cout << "  fx <trackId> <type> - Add FX (delay, chorus, reverb)\n";
    std::cout << "  status     - Show current status\n";
    std::cout << "  help       - Show this help\n";
    std::cout << "  quit       - Exit application\n";
    std::cout << "\nType 'help' for command list.\n";
}

void printStatus(const DAWEngine& engine) {
    std::cout << "\n=== DAW Status ===\n";
    std::cout << "Playing: " << (engine.isPlaying() ? "Yes" : "No") << "\n";
    std::cout << "Current Time: " << engine.getCurrentTime() << "s\n";
    std::cout << "Current Sample: " << engine.getCurrentSample() << "\n";
    std::cout << "Tempo: " << engine.getTempo() << " BPM\n";
    std::cout << "Sample Rate: " << engine.getSampleRate() << " Hz\n";
    std::cout << "Buffer Size: " << engine.getBufferSize() << " samples\n";
    std::cout << "Number of Tracks: " << engine.getNumTracks() << "\n";
    
    for (size_t i = 0; i < engine.getNumTracks(); ++i) {
        const Track* track = engine.getTrack(i);
        if (track) {
            std::cout << "  Track " << i << ": " << track->getName() 
                     << " (Vol: " << track->getVolume() 
                     << ", Pan: " << track->getPan() 
                     << ", Muted: " << (track->isMuted() ? "Yes" : "No")
                     << ", Clips: " << track->getNumClips()
                     << ", FX: " << track->getNumFX() << ")\n";
        }
    }
    std::cout << "\n";
}

int main() {
    std::cout << "=== C++ DAW Application ===\n";
    std::cout << "Initializing audio engine...\n";
    
    DAWEngine engine;
    
    if (!engine.initialize()) {
        std::cerr << "Failed to initialize DAW engine!\n";
        return 1;
    }
    
    std::cout << "DAW engine initialized successfully!\n";
    printUsage();
    
    std::string command;
    while (true) {
        std::cout << "daw> ";
        std::getline(std::cin, command);
        
        if (command.empty()) {
            continue;
        }
        
        // Parse command
        std::istringstream iss(command);
        std::string cmd;
        iss >> cmd;
        
        if (cmd == "quit" || cmd == "exit") {
            break;
        }
        else if (cmd == "help") {
            printUsage();
        }
        else if (cmd == "play") {
            engine.start();
        }
        else if (cmd == "stop") {
            engine.stop();
        }
        else if (cmd == "pause") {
            engine.pause();
        }
        else if (cmd == "track") {
            std::string trackName = "Track " + std::to_string(engine.getNumTracks() + 1);
            size_t trackId = engine.addTrack(trackName);
            std::cout << "Added track: " << trackName << " (ID: " << trackId << ")\n";
        }
        else if (cmd == "tempo") {
            double bpm;
            if (iss >> bpm && bpm > 0 && bpm <= 300) {
                engine.setTempo(bpm);
                std::cout << "Tempo set to " << bpm << " BPM\n";
            } else {
                std::cout << "Invalid tempo. Use: tempo <bpm> (1-300)\n";
            }
        }
        else if (cmd == "volume") {
            size_t trackId;
            float volume;
            if (iss >> trackId >> volume) {
                Track* track = engine.getTrack(trackId);
                if (track) {
                    track->setVolume(volume);
                    std::cout << "Track " << trackId << " volume set to " << volume << "\n";
                } else {
                    std::cout << "Invalid track ID: " << trackId << "\n";
                }
            } else {
                std::cout << "Usage: volume <trackId> <level>\n";
            }
        }
        else if (cmd == "pan") {
            size_t trackId;
            float pan;
            if (iss >> trackId >> pan) {
                Track* track = engine.getTrack(trackId);
                if (track) {
                    track->setPan(pan);
                    std::cout << "Track " << trackId << " pan set to " << pan << "\n";
                } else {
                    std::cout << "Invalid track ID: " << trackId << "\n";
                }
            } else {
                std::cout << "Usage: pan <trackId> <pan> (-1.0 to 1.0)\n";
            }
        }
        else if (cmd == "mute") {
            size_t trackId;
            if (iss >> trackId) {
                Track* track = engine.getTrack(trackId);
                if (track) {
                    track->setMuted(!track->isMuted());
                    std::cout << "Track " << trackId << " mute: " << 
                        (track->isMuted() ? "ON" : "OFF") << "\n";
                } else {
                    std::cout << "Invalid track ID: " << trackId << "\n";
                }
            } else {
                std::cout << "Usage: mute <trackId>\n";
            }
        }
        else if (cmd == "solo") {
            size_t trackId;
            if (iss >> trackId) {
                Track* track = engine.getTrack(trackId);
                if (track) {
                    track->setSoloed(!track->isSoloed());
                    std::cout << "Track " << trackId << " solo: " << 
                        (track->isSoloed() ? "ON" : "OFF") << "\n";
                } else {
                    std::cout << "Invalid track ID: " << trackId << "\n";
                }
            } else {
                std::cout << "Usage: solo <trackId>\n";
            }
        }
        else if (cmd == "fx") {
            size_t trackId;
            std::string fxType;
            if (iss >> trackId >> fxType) {
                Track* track = engine.getTrack(trackId);
                if (track) {
                    std::unique_ptr<FXPlugin> fx;
                    
                    if (fxType == "delay") {
                        fx = std::make_unique<DelayFX>();
                    } else if (fxType == "chorus") {
                        fx = std::make_unique<ChorusFX>();
                    } else if (fxType == "reverb") {
                        fx = std::make_unique<ReverbFX>();
                    } else {
                        std::cout << "Unknown FX type: " << fxType << "\n";
                        std::cout << "Available types: delay, chorus, reverb\n";
                        continue;
                    }
                    
                    if (fx) {
                        fx->setSampleRate(engine.getSampleRate());
                        std::cout << "Added " << fxType << " to track " << trackId << "\n";
                        track->addFX(std::move(fx));
                    }
                } else {
                    std::cout << "Invalid track ID: " << trackId << "\n";
                }
            } else {
                std::cout << "Usage: fx <trackId> <type>\n";
                std::cout << "Available types: delay, chorus, reverb\n";
            }
        }
        else if (cmd == "status") {
            printStatus(engine);
        }
        else {
            std::cout << "Unknown command: " << cmd << "\n";
            std::cout << "Type 'help' for available commands.\n";
        }
        
        // Small delay to prevent overwhelming the terminal
        std::this_thread::sleep_for(std::chrono::milliseconds(10));
    }
    
    std::cout << "Shutting down DAW engine...\n";
    engine.shutdown();
    std::cout << "Goodbye!\n";
    
    return 0;
}
