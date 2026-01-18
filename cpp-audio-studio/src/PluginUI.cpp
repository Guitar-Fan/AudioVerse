#include "PluginUI.h"
#include <cmath>
#include <sstream>
#include <iomanip>

// Helper function to escape JavaScript strings
static std::string escapeJS(const std::string& str) {
    std::string result;
    result.reserve(str.length());
    for (char c : str) {
        switch (c) {
            case '\\': result += "\\\\"; break;
            case '\'': result += "\\'"; break;
            case '\"': result += "\\\""; break;
            case '\n': result += "\\n"; break;
            case '\r': result += "\\r"; break;
            case '\t': result += "\\t"; break;
            default: result += c;
        }
    }
    return result;
}

std::string PluginUI::Color::toCSSRGBA() const {
    std::ostringstream oss;
    oss << "rgba(" 
        << static_cast<int>(r * 255) << "," 
        << static_cast<int>(g * 255) << "," 
        << static_cast<int>(b * 255) << "," 
        << a << ")";
    return oss.str();
}

PluginUI::PluginUI(int width, int height) 
    : mWidth(width), mHeight(height) {
    clearCommands();
}

void PluginUI::addCommand(const std::string& cmd) {
    mDrawCommands.push_back(cmd);
}

void PluginUI::clearCommands() {
    mDrawCommands.clear();
}

emscripten::val PluginUI::createDrawCommands() {
    emscripten::val arr = emscripten::val::array();
    for (size_t i = 0; i < mDrawCommands.size(); ++i) {
        arr.set(i, mDrawCommands[i]);
    }
    clearCommands();
    return arr;
}

// Wrapper methods that take simple parameters instead of Rect objects
void PluginUI::drawKnobAt(float x, float y, float w, float h, float value, const std::string& label) {
    drawKnob(Rect(x, y, w, h), value, label);
}

void PluginUI::drawFaderAt(float x, float y, float w, float h, float value, const std::string& label) {
    drawFader(Rect(x, y, w, h), value, label);
}

void PluginUI::drawButtonAt(float x, float y, float w, float h, const std::string& label, bool active) {
    drawButton(Rect(x, y, w, h), label, active);
}

void PluginUI::drawVUMeterAt(float x, float y, float w, float h, float peakL, float peakR) {
    drawVUMeter(Rect(x, y, w, h), peakL, peakR, 0.0f, 0.0f);
}

void PluginUI::drawWaveformAt(float x, float y, float w, float h, emscripten::val waveformJS) {
    // Convert JS array to C++ vector
    std::vector<float> waveform;
    unsigned int length = waveformJS["length"].as<unsigned int>();
    waveform.reserve(length);
    for (unsigned int i = 0; i < length; ++i) {
        waveform.push_back(waveformJS[i].as<float>());
    }
    drawWaveformDisplay(Rect(x, y, w, h), waveform);
}

void PluginUI::drawSpectrumAt(float x, float y, float w, float h, emscripten::val spectrumJS) {
    // Convert JS array to C++ vector
    std::vector<float> spectrum;
    unsigned int length = spectrumJS["length"].as<unsigned int>();
    spectrum.reserve(length);
    for (unsigned int i = 0; i < length; ++i) {
        spectrum.push_back(spectrumJS[i].as<float>());
    }
    drawSpectrumAnalyzer(Rect(x, y, w, h), spectrum);
}

void PluginUI::drawPanelAt(float x, float y, float w, float h, const std::string& title) {
    drawPanel(Rect(x, y, w, h), title);
}

void PluginUI::drawUI(float peak, float rms, emscripten::val waveformJS, emscripten::val spectrumJS) {
    // Convert JS arrays to C++ vectors
    std::vector<float> waveform;
    unsigned int waveLen = waveformJS["length"].as<unsigned int>();
    waveform.reserve(waveLen);
    for (unsigned int i = 0; i < waveLen; ++i) {
        waveform.push_back(waveformJS[i].as<float>());
    }
    
    std::vector<float> spectrum;
    unsigned int specLen = spectrumJS["length"].as<unsigned int>();
    spectrum.reserve(specLen);
    for (unsigned int i = 0; i < specLen; ++i) {
        spectrum.push_back(spectrumJS[i].as<float>());
    }
    // Draw main panel
    drawPanel(Rect(0, 0, mWidth, mHeight), "");
    
    // Draw analyzer section
    drawPanel(Rect(20, 20, 760, 300), "SPECTRUM ANALYZER");
    drawSpectrumAnalyzer(Rect(30, 60, 740, 240), spectrum);
    
    // Draw waveform section
    drawPanel(Rect(20, 340, 760, 340), "WAVEFORM");
    drawWaveformDisplay(Rect(30, 380, 740, 280), waveform);
    
    // Draw controls section
    drawPanel(Rect(800, 20, 380, 660), "CONTROLS");
    
    // Draw knobs
    drawKnob(Rect(820, 80, 100, 100), 0.75f, "GAIN");
    drawKnob(Rect(940, 80, 100, 100), 0.5f, "PAN");
    drawKnob(Rect(1060, 80, 100, 100), 0.8f, "FILTER");
    
    // Draw faders
    drawFader(Rect(820, 220, 60, 200), 0.7f, "L");
    drawFader(Rect(900, 220, 60, 200), 0.7f, "R");
    
    // Draw buttons
    drawButton(Rect(820, 450, 100, 40), "SOLO", false);
    drawButton(Rect(940, 450, 100, 40), "MUTE", false);
    drawButton(Rect(820, 510, 100, 40), "ANALYZE", true);
    drawButton(Rect(940, 510, 100, 40), "EFFECTS", false);
    
    // Draw VU Meters
    drawVUMeter(Rect(820, 580, 340, 80), peak, peak, rms, rms);
}

void PluginUI::drawPanel(const Rect& bounds, const std::string& title) {
    std::ostringstream cmd;
    
    // Draw panel background with gradient
    cmd << "ctx.fillStyle='" << Panel().toCSSRGBA() << "';"
        << "ctx.fillRect(" << bounds.x << "," << bounds.y << "," 
        << bounds.w << "," << bounds.h << ");";
    
    // Draw border
    cmd << "ctx.strokeStyle='" << KnobTrack().toCSSRGBA() << "';"
        << "ctx.lineWidth=1;"
        << "ctx.strokeRect(" << bounds.x << "," << bounds.y << "," 
        << bounds.w << "," << bounds.h << ");";
    
    // Draw title
    if (!title.empty()) {
        cmd << "ctx.fillStyle='" << Text().toCSSRGBA() << "';"
            << "ctx.font='bold 14px Arial';"
            << "ctx.textAlign='center';"
            << "ctx.fillText('" << escapeJS(title) << "'," 
            << (bounds.x + bounds.w / 2) << "," << (bounds.y + 20) << ");";
    }
    
    addCommand(cmd.str());
}

void PluginUI::drawKnob(const Rect& bounds, float value, const std::string& label) {
    std::ostringstream cmd;
    
    float centerX = bounds.x + bounds.w / 2;
    float centerY = bounds.y + bounds.h / 2;
    float radius = std::min(bounds.w, bounds.h) / 2 - 5;
    
    // Clamp value 0-1
    value = std::max(0.0f, std::min(1.0f, value));
    
    // Draw background circle
    cmd << "ctx.beginPath();"
        << "ctx.arc(" << centerX << "," << centerY << "," << radius << ",0,2*Math.PI);"
        << "ctx.fillStyle='" << KnobTrack().toCSSRGBA() << "';"
        << "ctx.fill();";
    
    // Draw value arc (270 degrees total, starting at -135 degrees)
    float startAngle = -2.356f; // -135 degrees in radians
    float endAngle = startAngle + (value * 4.712f); // 270 degrees sweep
    
    cmd << "ctx.beginPath();"
        << "ctx.arc(" << centerX << "," << centerY << "," << radius - 4 << "," 
        << startAngle << "," << endAngle << ");"
        << "ctx.strokeStyle='" << KnobFill().toCSSRGBA() << "';"
        << "ctx.lineWidth=6;"
        << "ctx.lineCap='round';"
        << "ctx.stroke();";
    
    // Draw indicator dot
    float dotAngle = startAngle + (value * 4.712f);
    float dotX = centerX + (radius - 12) * std::cos(dotAngle);
    float dotY = centerY + (radius - 12) * std::sin(dotAngle);
    
    cmd << "ctx.beginPath();"
        << "ctx.arc(" << dotX << "," << dotY << ",4,0,2*Math.PI);"
        << "ctx.fillStyle='" << Accent().toCSSRGBA() << "';"
        << "ctx.fill();";
    
    // Draw label
    if (!label.empty()) {
        cmd << "ctx.fillStyle='" << Text().toCSSRGBA() << "';"
            << "ctx.font='11px Arial';"
            << "ctx.textAlign='center';"
            << "ctx.fillText('" << label << "'," << centerX << "," 
            << (bounds.y + bounds.h + 15) << ");";
    }
    
    // Draw value text
    cmd << "ctx.fillStyle='" << TextDim().toCSSRGBA() << "';"
        << "ctx.font='bold 12px monospace';"
        << "ctx.textAlign='center';"
        << "ctx.fillText('" << std::fixed << std::setprecision(2) << value << "'," 
        << centerX << "," << centerY << ");";
    
    addCommand(cmd.str());
}

void PluginUI::drawFader(const Rect& bounds, float value, const std::string& label) {
    std::ostringstream cmd;
    
    // Clamp value 0-1
    value = std::max(0.0f, std::min(1.0f, value));
    
    float trackX = bounds.x + bounds.w / 2 - 3;
    float trackWidth = 6;
    float trackHeight = bounds.h - 40;
    float trackY = bounds.y + 20;
    
    // Draw track background
    cmd << "ctx.fillStyle='" << KnobTrack().toCSSRGBA() << "';"
        << "ctx.fillRect(" << trackX << "," << trackY << "," 
        << trackWidth << "," << trackHeight << ");";
    
    // Draw filled portion
    float fillHeight = trackHeight * value;
    cmd << "ctx.fillStyle='" << KnobFill().toCSSRGBA() << "';"
        << "ctx.fillRect(" << trackX << "," << (trackY + trackHeight - fillHeight) << "," 
        << trackWidth << "," << fillHeight << ");";
    
    // Draw handle
    float handleY = trackY + trackHeight - (fillHeight);
    float handleW = 20;
    float handleH = 8;
    float handleX = bounds.x + bounds.w / 2 - handleW / 2;
    
    cmd << "ctx.fillStyle='" << Text().toCSSRGBA() << "';"
        << "ctx.fillRect(" << handleX << "," << handleY << "," 
        << handleW << "," << handleH << ");";
    
    // Draw label
    if (!label.empty()) {
        cmd << "ctx.fillStyle='" << Text().toCSSRGBA() << "';"
            << "ctx.font='11px Arial';"
            << "ctx.textAlign='center';"
            << "ctx.fillText('" << label << "'," << (bounds.x + bounds.w / 2) << "," 
            << (bounds.y + 12) << ");";
    }
    
    addCommand(cmd.str());
}

void PluginUI::drawButton(const Rect& bounds, const std::string& label, bool active) {
    std::ostringstream cmd;
    
    Color bgColor = active ? Accent() : Panel();
    Color textColor = active ? Background() : Text();
    
    // Draw button background
    cmd << "ctx.fillStyle='" << bgColor.toCSSRGBA() << "';"
        << "ctx.fillRect(" << bounds.x << "," << bounds.y << "," 
        << bounds.w << "," << bounds.h << ");";
    
    // Draw border
    cmd << "ctx.strokeStyle='" << (active ? Accent() : KnobTrack()).toCSSRGBA() << "';"
        << "ctx.lineWidth=2;"
        << "ctx.strokeRect(" << bounds.x << "," << bounds.y << "," 
        << bounds.w << "," << bounds.h << ");";
    
    // Draw label
    cmd << "ctx.fillStyle='" << textColor.toCSSRGBA() << "';"
        << "ctx.font='bold 12px Arial';"
        << "ctx.textAlign='center';"
        << "ctx.textBaseline='middle';"
        << "ctx.fillText('" << label << "'," 
        << (bounds.x + bounds.w / 2) << "," << (bounds.y + bounds.h / 2) << ");";
    
    addCommand(cmd.str());
}

void PluginUI::drawVUMeter(const Rect& bounds, float peakL, float peakR, float rmsL, float rmsR) {
    std::ostringstream cmd;
    
    float meterWidth = bounds.w - 20;
    float meterHeight = 8;
    float spacing = 5;
    
    // Draw L channel
    float lY = bounds.y + 20;
    cmd << "ctx.fillStyle='" << KnobTrack().toCSSRGBA() << "';"
        << "ctx.fillRect(" << bounds.x << "," << lY << "," << meterWidth << "," << meterHeight << ");";
    
    // Peak L
    float peakLWidth = meterWidth * std::min(1.0f, peakL);
    Color peakLColor = peakL > 0.9f ? Warning() : peakL > 0.7f ? Active() : Accent();
    cmd << "ctx.fillStyle='" << peakLColor.toCSSRGBA() << "';"
        << "ctx.fillRect(" << bounds.x << "," << lY << "," << peakLWidth << "," << meterHeight << ");";
    
    // Draw R channel
    float rY = lY + meterHeight + spacing;
    cmd << "ctx.fillStyle='" << KnobTrack().toCSSRGBA() << "';"
        << "ctx.fillRect(" << bounds.x << "," << rY << "," << meterWidth << "," << meterHeight << ");";
    
    // Peak R
    float peakRWidth = meterWidth * std::min(1.0f, peakR);
    Color peakRColor = peakR > 0.9f ? Warning() : peakR > 0.7f ? Active() : Accent();
    cmd << "ctx.fillStyle='" << peakRColor.toCSSRGBA() << "';"
        << "ctx.fillRect(" << bounds.x << "," << rY << "," << peakRWidth << "," << meterHeight << ");";
    
    // Labels
    cmd << "ctx.fillStyle='" << Text().toCSSRGBA() << "';"
        << "ctx.font='10px monospace';"
        << "ctx.textAlign='left';"
        << "ctx.fillText('L'," << (bounds.x - 15) << "," << (lY + meterHeight / 2 + 3) << ");"
        << "ctx.fillText('R'," << (bounds.x - 15) << "," << (rY + meterHeight / 2 + 3) << ");";
    
    addCommand(cmd.str());
}

void PluginUI::drawWaveformDisplay(const Rect& bounds, const std::vector<float>& waveform) {
    std::ostringstream cmd;
    
    // Draw background
    cmd << "ctx.fillStyle='" << Background().toCSSRGBA() << "';"
        << "ctx.fillRect(" << bounds.x << "," << bounds.y << "," 
        << bounds.w << "," << bounds.h << ");";
    
    if (waveform.empty()) {
        addCommand(cmd.str());
        return;
    }
    
    // Draw waveform
    cmd << "ctx.beginPath();"
        << "ctx.strokeStyle='" << Accent().toCSSRGBA() << "';"
        << "ctx.lineWidth=1.5;";
    
    float scaleX = bounds.w / static_cast<float>(waveform.size());
    float centerY = bounds.y + bounds.h / 2;
    float scaleY = bounds.h / 2;
    
    for (size_t i = 0; i < waveform.size(); ++i) {
        float x = bounds.x + i * scaleX;
        float y = centerY - waveform[i] * scaleY;
        
        if (i == 0) {
            cmd << "ctx.moveTo(" << x << "," << y << ");";
        } else {
            cmd << "ctx.lineTo(" << x << "," << y << ");";
        }
    }
    
    cmd << "ctx.stroke();";
    
    // Draw center line
    cmd << "ctx.strokeStyle='" << TextDim().toCSSRGBA() << "';"
        << "ctx.lineWidth=1;"
        << "ctx.setLineDash([2,2]);"
        << "ctx.beginPath();"
        << "ctx.moveTo(" << bounds.x << "," << centerY << ");"
        << "ctx.lineTo(" << (bounds.x + bounds.w) << "," << centerY << ");"
        << "ctx.stroke();"
        << "ctx.setLineDash([]);";
    
    addCommand(cmd.str());
}

void PluginUI::drawSpectrumAnalyzer(const Rect& bounds, const std::vector<float>& spectrum) {
    std::ostringstream cmd;
    
    // Draw background
    cmd << "ctx.fillStyle='" << Background().toCSSRGBA() << "';"
        << "ctx.fillRect(" << bounds.x << "," << bounds.y << "," 
        << bounds.w << "," << bounds.h << ");";
    
    if (spectrum.empty()) {
        addCommand(cmd.str());
        return;
    }
    
    // Find max for normalization
    float maxVal = 0.0f;
    for (float val : spectrum) {
        maxVal = std::max(maxVal, val);
    }
    
    if (maxVal <= 0.0f) {
        addCommand(cmd.str());
        return;
    }
    
    // Draw spectrum bars
    float barWidth = bounds.w / static_cast<float>(spectrum.size());
    
    for (size_t i = 0; i < spectrum.size(); ++i) {
        float normalized = spectrum[i] / maxVal;
        float barHeight = normalized * bounds.h;
        
        // Color gradient based on frequency
        float hue = (static_cast<float>(i) / spectrum.size()) * 240.0f;
        cmd << "ctx.fillStyle='hsl(" << hue << ",100%,50%)';"
            << "ctx.fillRect(" << (bounds.x + i * barWidth) << "," 
            << (bounds.y + bounds.h - barHeight) << "," 
            << (barWidth - 1) << "," << barHeight << ");";
    }
    
    addCommand(cmd.str());
}
