#pragma once

#include "AudioBuffer.hpp"
#include <vector>
#include <memory>
#include <string>
#include <cmath>
#include <map>
#include <algorithm>

namespace DAW {

class FXPlugin {
public:
    explicit FXPlugin(const std::string& name) : m_name(name), m_enabled(true) {}
    virtual ~FXPlugin() = default;

    // Core processing
    virtual void process(AudioBuffer& buffer, size_t numSamples) = 0;
    virtual void setSampleRate(double sampleRate) = 0;
    virtual void reset() = 0;

    // Parameter management
    struct Parameter {
        std::string name;
        float value;
        float minValue;
        float maxValue;
        std::string displayName;
        
        Parameter(const std::string& n, float val, float minVal, float maxVal, const std::string& dispName)
            : name(n), value(val), minValue(minVal), maxValue(maxVal), displayName(dispName) {}
    };

    void addParameter(const std::string& name, float defaultValue, float minValue, float maxValue, const std::string& displayName) {
        m_parameters[name] = Parameter(name, defaultValue, minValue, maxValue, displayName);
    }

    void setParameter(const std::string& name, float value) {
        auto it = m_parameters.find(name);
        if (it != m_parameters.end()) {
            it->second.value = std::clamp(value, it->second.minValue, it->second.maxValue);
            onParameterChanged(name, it->second.value);
        }
    }

    float getParameter(const std::string& name) const {
        auto it = m_parameters.find(name);
        return (it != m_parameters.end()) ? it->second.value : 0.0f;
    }

    bool hasParameter(const std::string& name) const {
        return m_parameters.find(name) != m_parameters.end();
    }

    // Control
    void setEnabled(bool enabled) { m_enabled = enabled; }
    bool isEnabled() const { return m_enabled; }
    const std::string& getName() const { return m_name; }

protected:
    virtual void onParameterChanged(const std::string& paramId, float value) {}

private:
    std::string m_name;
    bool m_enabled;
    std::map<std::string, Parameter> m_parameters;
};

} // namespace DAW
