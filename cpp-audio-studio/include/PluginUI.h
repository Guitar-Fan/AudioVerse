#pragma once

#include <emscripten/val.h>
#include <string>
#include <vector>

// Professional Plugin UI using Canvas-based rendering
// Inspired by iPlug2's design patterns but simplified for WebAssembly
class PluginUI {
public:
    struct Color {
        float r, g, b, a;
        Color(float _r = 0, float _g = 0, float _b = 0, float _a = 1.0f) 
            : r(_r), g(_g), b(_b), a(_a) {}
        
        std::string toCSSRGBA() const;
    };
    
    struct Rect {
        float x, y, w, h;
        Rect(float _x = 0, float _y = 0, float _w = 0, float _h = 0)
            : x(_x), y(_y), w(_w), h(_h) {}
    };
    
    // Professional color schemes
    static Color Background() { return Color(0.11f, 0.11f, 0.13f, 1.0f); }
    static Color Panel() { return Color(0.15f, 0.15f, 0.18f, 1.0f); }
    static Color KnobTrack() { return Color(0.25f, 0.25f, 0.28f, 1.0f); }
    static Color KnobFill() { return Color(0.0f, 0.83f, 1.0f, 1.0f); }
    static Color Accent() { return Color(0.0f, 0.83f, 1.0f, 1.0f); }
    static Color Text() { return Color(0.9f, 0.9f, 0.92f, 1.0f); }
    static Color TextDim() { return Color(0.5f, 0.5f, 0.54f, 1.0f); }
    static Color Active() { return Color(0.0f, 1.0f, 0.4f, 1.0f); }
    static Color Warning() { return Color(1.0f, 0.6f, 0.0f, 1.0f); }
    static Color Mute() { return Color(0.8f, 0.2f, 0.2f, 1.0f); }
    
    PluginUI(int width, int height);
    
    // Drawing commands that return JavaScript commands for canvas
    emscripten::val createDrawCommands();
    
    // High-level drawing methods (call these from JavaScript)
    void drawUI(float peak, float rms, emscripten::val waveformJS, emscripten::val spectrumJS);
    void drawKnobAt(float x, float y, float w, float h, float value, const std::string& label);
    void drawFaderAt(float x, float y, float w, float h, float value, const std::string& label);
    void drawButtonAt(float x, float y, float w, float h, const std::string& label, bool active);
    void drawVUMeterAt(float x, float y, float w, float h, float peakL, float peakR);
    void drawWaveformAt(float x, float y, float w, float h, emscripten::val waveformJS);
    void drawSpectrumAt(float x, float y, float w, float h, emscripten::val spectrumJS);
    void drawPanelAt(float x, float y, float w, float h, const std::string& title);
    
private:
    // Control rendering (internal)
    void drawKnob(const Rect& bounds, float value, const std::string& label);
    void drawVUMeter(const Rect& bounds, float peakL, float peakR, float rmsL, float rmsR);
    void drawWaveformDisplay(const Rect& bounds, const std::vector<float>& waveform);
    void drawSpectrumAnalyzer(const Rect& bounds, const std::vector<float>& spectrum);
    void drawButton(const Rect& bounds, const std::string& label, bool active);
    void drawFader(const Rect& bounds, float value, const std::string& label);
    void drawPanel(const Rect& bounds, const std::string& title);
    
    void addCommand(const std::string& cmd);
    void clearCommands();
    
    int mWidth, mHeight;
    std::vector<std::string> mDrawCommands;
};
