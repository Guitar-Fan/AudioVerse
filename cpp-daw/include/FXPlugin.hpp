#pragma once

#include "AudioBuffer.hpp"
#include <string>
#include <vector>
#include <map>
#include <memory>
#include <functional>

namespace DAW {

// Parameter definition - equivalent to your JS plugin param objects
struct FXParameter {
    std::string id;
    std::string name;
    enum Type { RANGE, BOOLEAN, CHOICE } type;
    
    // For RANGE type
    float minValue = 0.0f;
    float maxValue = 1.0f;
    float defaultValue = 0.5f;
    float step = 0.01f;
    
    // For CHOICE type
    std::vector<std::string> choices;
    
    // For BOOLEAN type (uses minValue=0, maxValue=1, defaultValue=0/1)
    
    FXParameter(const std::string& id, const std::string& name, Type type)
        : id(id), name(name), type(type) {}
    
    static FXParameter Range(const std::string& id, const std::string& name, 
                           float min, float max, float defaultVal, float stepSize = 0.01f) {
        FXParameter param(id, name, RANGE);
        param.minValue = min;
        param.maxValue = max;
        param.defaultValue = defaultVal;
        param.step = stepSize;
        return param;
    }
    
    static FXParameter Boolean(const std::string& id, const std::string& name, bool defaultVal = false) {
        FXParameter param(id, name, BOOLEAN);
        param.minValue = 0.0f;
        param.maxValue = 1.0f;
        param.defaultValue = defaultVal ? 1.0f : 0.0f;
        param.step = 1.0f;
        return param;
    }
    
    static FXParameter Choice(const std::string& id, const std::string& name, 
                            const std::vector<std::string>& choices, int defaultChoice = 0) {
        FXParameter param(id, name, CHOICE);
        param.choices = choices;
        param.minValue = 0.0f;
        param.maxValue = static_cast<float>(choices.size() - 1);
        param.defaultValue = static_cast<float>(defaultChoice);
        param.step = 1.0f;
        return param;
    }
};

// Base class for all FX plugins - equivalent to your JS plugin structure
class FXPlugin {
public:
    FXPlugin(const std::string& id, const std::string& name, const std::string& description)
        : id_(id), name_(name), description_(description) {}
    
    virtual ~FXPlugin() = default;
    
    // Plugin identification
    const std::string& GetId() const { return id_; }
    const std::string& GetName() const { return name_; }
    const std::string& GetDescription() const { return description_; }
    
    // Parameter management - equivalent to your setParam/getParam
    virtual void SetParameter(const std::string& paramId, float value) {
        parameters_[paramId] = value;
        OnParameterChanged(paramId, value);
    }
    
    virtual float GetParameter(const std::string& paramId) const {
        auto it = parameters_.find(paramId);
        return (it != parameters_.end()) ? it->second : 0.0f;
    }
    
    virtual std::map<std::string, float> GetAllParameters() const { return parameters_; }
    virtual const std::vector<FXParameter>& GetParameterDefinitions() const { return parameterDefs_; }
    
    // Audio processing - main function equivalent to your plugin processing
    virtual void ProcessAudio(AudioBuffer& buffer, int sampleRate) = 0;
    
    // Plugin lifecycle
    virtual void Initialize(int sampleRate, int maxBufferSize) { 
        sampleRate_ = sampleRate; 
        maxBufferSize_ = maxBufferSize;
    }
    virtual void Reset() {}
    virtual void Shutdown() {}
    
    // Bypass
    void SetBypassed(bool bypassed) { bypassed_ = bypassed; }
    bool IsBypassed() const { return bypassed_; }

protected:
    // Called when parameter changes - override for custom behavior
    virtual void OnParameterChanged(const std::string& paramId, float value) {}
    
    // Plugin info
    std::string id_;
    std::string name_;
    std::string description_;
    
    // Parameters
    std::map<std::string, float> parameters_;
    std::vector<FXParameter> parameterDefs_;
    
    // Audio context
    int sampleRate_ = 48000;
    int maxBufferSize_ = 512;
    bool bypassed_ = false;
    
    // Helper to add parameter definitions
    void AddParameter(const FXParameter& param) {
        parameterDefs_.push_back(param);
        parameters_[param.id] = param.defaultValue;
    }
};

// Plugin factory - equivalent to your FX_PLUGINS registry
using PluginCreator = std::function<std::shared_ptr<FXPlugin>()>;

class FXPluginRegistry {
public:
    static FXPluginRegistry& Instance() {
        static FXPluginRegistry instance;
        return instance;
    }
    
    void RegisterPlugin(const std::string& id, PluginCreator creator) {
        creators_[id] = creator;
    }
    
    std::shared_ptr<FXPlugin> CreatePlugin(const std::string& id) {
        auto it = creators_.find(id);
        if (it != creators_.end()) {
            return it->second();
        }
        return nullptr;
    }
    
    std::vector<std::string> GetAvailablePlugins() const {
        std::vector<std::string> ids;
        for (const auto& pair : creators_) {
            ids.push_back(pair.first);
        }
        return ids;
    }

private:
    std::map<std::string, PluginCreator> creators_;
};

// Convenience macro for registering plugins
#define REGISTER_PLUGIN(id, className) \
    namespace { \
        struct className##Registrar { \
            className##Registrar() { \
                FXPluginRegistry::Instance().RegisterPlugin(id, []() -> std::shared_ptr<FXPlugin> { \
                    return std::make_shared<className>(); \
                }); \
            } \
        }; \
        static className##Registrar className##_registrar_; \
    }

} // namespace DAW
