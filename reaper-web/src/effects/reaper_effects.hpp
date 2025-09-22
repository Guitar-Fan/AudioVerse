/*
 * REAPER Web - Built-in Effects Library
 * JSFX-based effects matching REAPER's built-in effects
 */

#pragma once

#include "../jsfx/jsfx_interpreter.hpp"
#include <memory>
#include <vector>
#include <string>

/**
 * Built-in Effects Manager - Provides access to REAPER's standard effects
 * Implements classic effects using JSFX scripts for compatibility
 */
class BuiltinEffectsManager {
public:
    BuiltinEffectsManager();
    ~BuiltinEffectsManager();
    
    // Effect creation
    std::unique_ptr<JSFXEffect> CreateEffect(const std::string& effectName);
    std::vector<std::string> GetAvailableEffects() const;
    
    // Effect categories
    std::vector<std::string> GetDynamicsEffects() const;
    std::vector<std::string> GetFilterEffects() const;
    std::vector<std::string> GetDelayEffects() const;
    std::vector<std::string> GetUtilityEffects() const;
    
    // JSFX script loading
    std::string GetEffectScript(const std::string& effectName) const;
    
private:
    void RegisterBuiltinEffects();
    std::map<std::string, std::string> m_effectScripts;
};

// Built-in effect JSFX scripts - based on REAPER's actual effects

namespace BuiltinJSFX {

// Simple Gain Effect
constexpr const char* SIMPLE_GAIN = R"(
desc:Simple Gain
slider1:0<-60,24,0.1>Gain (dB)

@slider
gain = db2gain(slider1);

@sample
spl0 *= gain;
spl1 *= gain;
)";

// Resonant Low Pass Filter (based on REAPER's resonantlowpass)
constexpr const char* RESONANT_LOWPASS = R"(
desc:Resonant Lowpass Filter
slider1:1000<20,20000>Frequency (Hz)
slider2:0.8<0,1>Resonance

in_pin:left input
in_pin:right input
out_pin:left output
out_pin:right output

@init
ext_tail_size = -1;

@slider
cut_lp = slider1*2 / srate; 
res_lp = slider2;
fb_lp = res_lp + res_lp/(1-cut_lp);

@sample
n3 = n3 + cut_lp*(spl0 - n3 + fb_lp*(n3 - n4));
n4 = n4 + cut_lp*(n3 - n4);
spl0 = n4;

rn3 = rn3 + cut_lp*(spl1 - rn3 + fb_lp*(rn3 - rn4));
rn4 = rn4 + cut_lp*(rn3 - rn4);
spl1 = rn4;
)";

// Simple Delay (based on REAPER's delay effect)
constexpr const char* SIMPLE_DELAY = R"(
desc:Simple Delay
slider1:300<0,4000,20>Delay (ms)
slider2:-5<-120,6,1>Feedback (dB)
slider3:0<-120,6,1>Mix In (dB)
slider4:-6<-120,6,1>Output Wet (dB)
slider5:0<-120,6,1>Output Dry (dB)

in_pin:left input
in_pin:right input
out_pin:left output
out_pin:right output

@init
delaypos = 0;

@slider
delaylen = min(slider1 * srate / 1000, 500000);
feedback = db2gain(slider2);
mix_in = db2gain(slider3);
wet_gain = db2gain(slider4);
dry_gain = db2gain(slider5);

@sample
delaypos >= delaylen ? delaypos = 0;

// Read from delay buffer
delayed_l = delaypos[0];
delayed_r = delaypos[1];

// Write to delay buffer with feedback
delaypos[0] = spl0 * mix_in + delayed_l * feedback;
delaypos[1] = spl1 * mix_in + delayed_r * feedback;

// Output mix
spl0 = spl0 * dry_gain + delayed_l * wet_gain;
spl1 = spl1 * dry_gain + delayed_r * wet_gain;

delaypos += 2;
)";

// Simple Compressor
constexpr const char* SIMPLE_COMPRESSOR = R"(
desc:Simple Compressor
slider1:-12<-60,0,1>Threshold (dB)
slider2:4<1,20,0.1>Ratio
slider3:5<0,200,0.1>Attack (ms)
slider4:250<0,1000,1>Release (ms)
slider5:0<-24,24,1>Makeup Gain (dB)

@init
env = 0;

@slider
threshold = db2gain(slider1);
ratio = slider2;
attack = exp(-1/(slider3 * srate / 1000));
release = exp(-1/(slider4 * srate / 1000));
makeup = db2gain(slider5);

@sample
// Get peak level
peak = max(abs(spl0), abs(spl1));

// Envelope follower
env = peak > env ? peak * (1-attack) + env * attack : peak * (1-release) + env * release;

// Compression
over = env > threshold ? env / threshold : 1;
over = over > 1 ? 1 + (over - 1) / ratio : over;
gain = over > 1 ? 1 / over : 1;

// Apply gain and makeup
spl0 *= gain * makeup;
spl1 *= gain * makeup;
)";

// High Pass Filter
constexpr const char* HIGH_PASS = R"(
desc:High Pass Filter
slider1:80<20,20000>Frequency (Hz)
slider2:0.707<0.1,10>Q

@init
ext_tail_size = -1;

@slider
freq = slider1 / srate;
q = slider2;
w = 2 * $pi * freq;
cosw = cos(w);
sinw = sin(w);
alpha = sinw / (2 * q);

// High pass coefficients
b0 = (1 + cosw) / 2;
b1 = -(1 + cosw);
b2 = (1 + cosw) / 2;
a0 = 1 + alpha;
a1 = -2 * cosw;
a2 = 1 - alpha;

// Normalize
b0 /= a0;
b1 /= a0;
b2 /= a0;
a1 /= a0;
a2 /= a0;

@sample
// Left channel
y = b0*spl0 + b1*x1_l + b2*x2_l - a1*y1_l - a2*y2_l;
x2_l = x1_l;
x1_l = spl0;
y2_l = y1_l;
y1_l = y;
spl0 = y;

// Right channel  
y = b0*spl1 + b1*x1_r + b2*x2_r - a1*y1_r - a2*y2_r;
x2_r = x1_r;
x1_r = spl1;
y2_r = y1_r;
y1_r = y;
spl1 = y;
)";

// DC Remove Filter
constexpr const char* DC_REMOVE = R"(
desc:DC Offset Removal
slider1:5<1,50>Cutoff (Hz)

@slider
cutoff = slider1 * 2 * $pi / srate;

@sample
// High pass filter with very low cutoff
y_l = spl0 - x_l + 0.995 * y_l;
x_l = spl0;
spl0 = y_l;

y_r = spl1 - x_r + 0.995 * y_r;
x_r = spl1;
spl1 = y_r;
)";

} // namespace BuiltinJSFX