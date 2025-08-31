use wasm_bindgen::prelude::*;
use web_sys::{AudioContext, GainNode, OscillatorNode, AudioParam};
use js_sys::{Array, Float32Array};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global allocator
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
extern "C" {
    fn alert(s: &str);
    
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[wasm_bindgen]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}

// Macro for console logging
macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

// Plugin system traits and structures
#[wasm_bindgen]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AudioPlugin {
    id: String,
    name: String,
    plugin_type: String,
    parameters: HashMap<String, f64>,
}

#[wasm_bindgen]
impl AudioPlugin {
    #[wasm_bindgen(constructor)]
    pub fn new(id: String, name: String, plugin_type: String) -> AudioPlugin {
        AudioPlugin {
            id,
            name,
            plugin_type,
            parameters: HashMap::new(),
        }
    }
    
    #[wasm_bindgen]
    pub fn set_parameter(&mut self, name: &str, value: f64) {
        self.parameters.insert(name.to_string(), value);
    }
    
    #[wasm_bindgen]
    pub fn get_parameter(&self, name: &str) -> Option<f64> {
        self.parameters.get(name).copied()
    }
    
    #[wasm_bindgen(getter)]
    pub fn id(&self) -> String {
        self.id.clone()
    }
    
    #[wasm_bindgen(getter)]
    pub fn name(&self) -> String {
        self.name.clone()
    }
    
    #[wasm_bindgen(getter)]
    pub fn plugin_type(&self) -> String {
        self.plugin_type.clone()
    }
}

// Advanced oscillator types
#[wasm_bindgen]
#[derive(Clone, Copy, Debug)]
pub enum WaveShape {
    Sine = 0,
    Saw = 1,
    Square = 2,
    Triangle = 3,
    Noise = 4,
    Custom = 5,
}

// Complex wave generator
#[wasm_bindgen]
pub struct WaveGenerator {
    sample_rate: f32,
    phase: f32,
    frequency: f32,
    amplitude: f32,
    shape: WaveShape,
    custom_harmonics: Vec<f32>,
}

#[wasm_bindgen]
impl WaveGenerator {
    #[wasm_bindgen(constructor)]
    pub fn new(sample_rate: f32) -> WaveGenerator {
        WaveGenerator {
            sample_rate,
            phase: 0.0,
            frequency: 440.0,
            amplitude: 1.0,
            shape: WaveShape::Sine,
            custom_harmonics: vec![1.0, 0.5, 0.25, 0.125], // Default harmonic series
        }
    }
    
    #[wasm_bindgen]
    pub fn set_frequency(&mut self, freq: f32) {
        self.frequency = freq;
    }
    
    #[wasm_bindgen]
    pub fn set_amplitude(&mut self, amp: f32) {
        self.amplitude = amp;
    }
    
    #[wasm_bindgen]
    pub fn set_wave_shape(&mut self, shape: WaveShape) {
        self.shape = shape;
    }
    
    #[wasm_bindgen]
    pub fn set_custom_harmonics(&mut self, harmonics: Vec<f32>) {
        self.custom_harmonics = harmonics;
    }
    
    #[wasm_bindgen]
    pub fn generate_sample(&mut self) -> f32 {
        let sample = match self.shape {
            WaveShape::Sine => (self.phase * 2.0 * std::f32::consts::PI).sin(),
            WaveShape::Saw => 2.0 * (self.phase - (self.phase + 0.5).floor()) - 1.0,
            WaveShape::Square => if self.phase < 0.5 { 1.0 } else { -1.0 },
            WaveShape::Triangle => {
                if self.phase < 0.5 {
                    4.0 * self.phase - 1.0
                } else {
                    3.0 - 4.0 * self.phase
                }
            },
            WaveShape::Noise => js_sys::Math::random() as f32 * 2.0 - 1.0,
            WaveShape::Custom => {
                let mut sample = 0.0;
                for (i, &harmonic) in self.custom_harmonics.iter().enumerate() {
                    let harmonic_freq = (i + 1) as f32;
                    sample += harmonic * (self.phase * harmonic_freq * 2.0 * std::f32::consts::PI).sin();
                }
                sample / self.custom_harmonics.len() as f32
            }
        };
        
        self.phase += self.frequency / self.sample_rate;
        if self.phase >= 1.0 {
            self.phase -= 1.0;
        }
        
        sample * self.amplitude
    }
    
    #[wasm_bindgen]
    pub fn generate_buffer(&mut self, length: usize) -> Vec<f32> {
        (0..length).map(|_| self.generate_sample()).collect()
    }
}

// Advanced envelope generator (ADSR)
#[wasm_bindgen]
pub struct EnvelopeGenerator {
    attack: f32,
    decay: f32,
    sustain: f32,
    release: f32,
    sample_rate: f32,
    state: EnvelopeState,
    time: f32,
    value: f32,
}

#[derive(Clone, Copy, Debug)]
enum EnvelopeState {
    Idle,
    Attack,
    Decay,
    Sustain,
    Release,
}

#[wasm_bindgen]
impl EnvelopeGenerator {
    #[wasm_bindgen(constructor)]
    pub fn new(sample_rate: f32) -> EnvelopeGenerator {
        EnvelopeGenerator {
            attack: 0.1,
            decay: 0.2,
            sustain: 0.7,
            release: 0.5,
            sample_rate,
            state: EnvelopeState::Idle,
            time: 0.0,
            value: 0.0,
        }
    }
    
    #[wasm_bindgen]
    pub fn set_adsr(&mut self, attack: f32, decay: f32, sustain: f32, release: f32) {
        self.attack = attack;
        self.decay = decay;
        self.sustain = sustain;
        self.release = release;
    }
    
    #[wasm_bindgen]
    pub fn note_on(&mut self) {
        self.state = EnvelopeState::Attack;
        self.time = 0.0;
    }
    
    #[wasm_bindgen]
    pub fn note_off(&mut self) {
        self.state = EnvelopeState::Release;
        self.time = 0.0;
    }
    
    #[wasm_bindgen]
    pub fn get_value(&mut self) -> f32 {
        let dt = 1.0 / self.sample_rate;
        
        match self.state {
            EnvelopeState::Idle => {
                self.value = 0.0;
            },
            EnvelopeState::Attack => {
                self.value = self.time / self.attack;
                if self.time >= self.attack {
                    self.state = EnvelopeState::Decay;
                    self.time = 0.0;
                    self.value = 1.0;
                }
            },
            EnvelopeState::Decay => {
                let decay_amount = (1.0 - self.sustain) * (self.time / self.decay);
                self.value = 1.0 - decay_amount;
                if self.time >= self.decay {
                    self.state = EnvelopeState::Sustain;
                    self.value = self.sustain;
                }
            },
            EnvelopeState::Sustain => {
                self.value = self.sustain;
            },
            EnvelopeState::Release => {
                self.value = self.sustain * (1.0 - self.time / self.release);
                if self.time >= self.release || self.value <= 0.0 {
                    self.state = EnvelopeState::Idle;
                    self.value = 0.0;
                }
            },
        }
        
        self.time += dt;
        self.value.max(0.0).min(1.0)
    }
    
    #[wasm_bindgen]
    pub fn is_active(&self) -> bool {
        !matches!(self.state, EnvelopeState::Idle)
    }
}

// Advanced filter implementation
#[wasm_bindgen]
pub struct Filter {
    cutoff: f32,
    resonance: f32,
    filter_type: FilterType,
    x1: f32,
    x2: f32,
    y1: f32,
    y2: f32,
    sample_rate: f32,
}

#[wasm_bindgen]
#[derive(Clone, Copy, Debug)]
pub enum FilterType {
    LowPass = 0,
    HighPass = 1,
    BandPass = 2,
    Notch = 3,
}

#[wasm_bindgen]
impl Filter {
    #[wasm_bindgen(constructor)]
    pub fn new(sample_rate: f32) -> Filter {
        Filter {
            cutoff: 1000.0,
            resonance: 1.0,
            filter_type: FilterType::LowPass,
            x1: 0.0,
            x2: 0.0,
            y1: 0.0,
            y2: 0.0,
            sample_rate,
        }
    }
    
    #[wasm_bindgen]
    pub fn set_cutoff(&mut self, cutoff: f32) {
        self.cutoff = cutoff.max(20.0).min(self.sample_rate * 0.5);
    }
    
    #[wasm_bindgen]
    pub fn set_resonance(&mut self, resonance: f32) {
        self.resonance = resonance.max(0.1).min(40.0);
    }
    
    #[wasm_bindgen]
    pub fn set_type(&mut self, filter_type: FilterType) {
        self.filter_type = filter_type;
    }
    
    #[wasm_bindgen]
    pub fn process(&mut self, input: f32) -> f32 {
        let omega = 2.0 * std::f32::consts::PI * self.cutoff / self.sample_rate;
        let sin_omega = omega.sin();
        let cos_omega = omega.cos();
        let alpha = sin_omega / (2.0 * self.resonance);
        
        let (b0, b1, b2, a0, a1, a2) = match self.filter_type {
            FilterType::LowPass => {
                let b0 = (1.0 - cos_omega) / 2.0;
                let b1 = 1.0 - cos_omega;
                let b2 = (1.0 - cos_omega) / 2.0;
                let a0 = 1.0 + alpha;
                let a1 = -2.0 * cos_omega;
                let a2 = 1.0 - alpha;
                (b0, b1, b2, a0, a1, a2)
            },
            FilterType::HighPass => {
                let b0 = (1.0 + cos_omega) / 2.0;
                let b1 = -(1.0 + cos_omega);
                let b2 = (1.0 + cos_omega) / 2.0;
                let a0 = 1.0 + alpha;
                let a1 = -2.0 * cos_omega;
                let a2 = 1.0 - alpha;
                (b0, b1, b2, a0, a1, a2)
            },
            FilterType::BandPass => {
                let b0 = alpha;
                let b1 = 0.0;
                let b2 = -alpha;
                let a0 = 1.0 + alpha;
                let a1 = -2.0 * cos_omega;
                let a2 = 1.0 - alpha;
                (b0, b1, b2, a0, a1, a2)
            },
            FilterType::Notch => {
                let b0 = 1.0;
                let b1 = -2.0 * cos_omega;
                let b2 = 1.0;
                let a0 = 1.0 + alpha;
                let a1 = -2.0 * cos_omega;
                let a2 = 1.0 - alpha;
                (b0, b1, b2, a0, a1, a2)
            },
        };
        
        let output = (b0 * input + b1 * self.x1 + b2 * self.x2 - a1 * self.y1 - a2 * self.y2) / a0;
        
        self.x2 = self.x1;
        self.x1 = input;
        self.y2 = self.y1;
        self.y1 = output;
        
        output
    }
    
    #[wasm_bindgen]
    pub fn process_buffer(&mut self, buffer: &mut [f32]) {
        for sample in buffer.iter_mut() {
            *sample = self.process(*sample);
        }
    }
}

// Voice class for polyphonic synthesis
#[wasm_bindgen]
pub struct Voice {
    generator: WaveGenerator,
    envelope: EnvelopeGenerator,
    filter: Filter,
    note: u8,
    velocity: f32,
    is_active: bool,
}

#[wasm_bindgen]
impl Voice {
    #[wasm_bindgen(constructor)]
    pub fn new(sample_rate: f32) -> Voice {
        Voice {
            generator: WaveGenerator::new(sample_rate),
            envelope: EnvelopeGenerator::new(sample_rate),
            filter: Filter::new(sample_rate),
            note: 60,
            velocity: 1.0,
            is_active: false,
        }
    }
    
    #[wasm_bindgen]
    pub fn note_on(&mut self, note: u8, velocity: f32) {
        self.note = note;
        self.velocity = velocity;
        self.is_active = true;
        
        // Convert MIDI note to frequency
        let frequency = 440.0 * 2.0_f32.powf((note as f32 - 69.0) / 12.0);
        self.generator.set_frequency(frequency);
        self.generator.set_amplitude(velocity);
        self.envelope.note_on();
    }
    
    #[wasm_bindgen]
    pub fn note_off(&mut self) {
        self.envelope.note_off();
    }
    
    #[wasm_bindgen]
    pub fn generate_sample(&mut self) -> f32 {
        if !self.is_active {
            return 0.0;
        }
        
        let sample = self.generator.generate_sample();
        let envelope_value = self.envelope.get_value();
        let filtered_sample = self.filter.process(sample * envelope_value);
        
        if !self.envelope.is_active() {
            self.is_active = false;
        }
        
        filtered_sample
    }
    
    #[wasm_bindgen]
    pub fn is_active(&self) -> bool {
        self.is_active
    }
    
    #[wasm_bindgen]
    pub fn set_wave_shape(&mut self, shape: WaveShape) {
        self.generator.set_wave_shape(shape);
    }
    
    #[wasm_bindgen]
    pub fn set_envelope(&mut self, attack: f32, decay: f32, sustain: f32, release: f32) {
        self.envelope.set_adsr(attack, decay, sustain, release);
    }
    
    #[wasm_bindgen]
    pub fn set_filter(&mut self, cutoff: f32, resonance: f32, filter_type: FilterType) {
        self.filter.set_cutoff(cutoff);
        self.filter.set_resonance(resonance);
        self.filter.set_type(filter_type);
    }
}

// Main synthesizer engine
#[wasm_bindgen]
pub struct AudioSynthesizer {
    sample_rate: f32,
    voices: Vec<Voice>,
    max_voices: usize,
    master_volume: f32,
    plugins: HashMap<String, AudioPlugin>,
}

#[wasm_bindgen]
impl AudioSynthesizer {
    #[wasm_bindgen(constructor)]
    pub fn new(sample_rate: f32, max_voices: usize) -> AudioSynthesizer {
        let mut voices = Vec::with_capacity(max_voices);
        for _ in 0..max_voices {
            voices.push(Voice::new(sample_rate));
        }
        
        AudioSynthesizer {
            sample_rate,
            voices,
            max_voices,
            master_volume: 0.8,
            plugins: HashMap::new(),
        }
    }
    
    #[wasm_bindgen]
    pub fn note_on(&mut self, note: u8, velocity: f32) {
        // Find an inactive voice or steal the oldest one
        let voice_index = self.voices.iter()
            .position(|v| !v.is_active())
            .unwrap_or(0);
            
        self.voices[voice_index].note_on(note, velocity);
    }
    
    #[wasm_bindgen]
    pub fn note_off(&mut self, note: u8) {
        for voice in &mut self.voices {
            if voice.note == note && voice.is_active {
                voice.note_off();
                break;
            }
        }
    }
    
    #[wasm_bindgen]
    pub fn all_notes_off(&mut self) {
        for voice in &mut self.voices {
            voice.note_off();
        }
    }
    
    #[wasm_bindgen]
    pub fn generate_sample(&mut self) -> f32 {
        let mut sample = 0.0;
        let mut active_voices = 0;
        
        for voice in &mut self.voices {
            if voice.is_active() {
                sample += voice.generate_sample();
                active_voices += 1;
            }
        }
        
        // Normalize by number of active voices to prevent clipping
        if active_voices > 0 {
            sample = sample / (active_voices as f32).sqrt();
        }
        
        sample * self.master_volume
    }
    
    #[wasm_bindgen]
    pub fn generate_buffer(&mut self, length: usize) -> Vec<f32> {
        (0..length).map(|_| self.generate_sample()).collect()
    }
    
    #[wasm_bindgen]
    pub fn set_master_volume(&mut self, volume: f32) {
        self.master_volume = volume.max(0.0).min(1.0);
    }
    
    #[wasm_bindgen]
    pub fn set_global_wave_shape(&mut self, shape: WaveShape) {
        for voice in &mut self.voices {
            voice.set_wave_shape(shape);
        }
    }
    
    #[wasm_bindgen]
    pub fn set_global_envelope(&mut self, attack: f32, decay: f32, sustain: f32, release: f32) {
        for voice in &mut self.voices {
            voice.set_envelope(attack, decay, sustain, release);
        }
    }
    
    #[wasm_bindgen]
    pub fn set_global_filter(&mut self, cutoff: f32, resonance: f32, filter_type: FilterType) {
        for voice in &mut self.voices {
            voice.set_filter(cutoff, resonance, filter_type);
        }
    }
    
    #[wasm_bindgen]
    pub fn add_plugin(&mut self, plugin: AudioPlugin) {
        self.plugins.insert(plugin.id.clone(), plugin);
    }
    
    #[wasm_bindgen]
    pub fn get_active_voice_count(&self) -> usize {
        self.voices.iter().filter(|v| v.is_active()).count()
    }
}

// Utility functions for drawing and visualization
#[wasm_bindgen]
pub fn generate_waveform_data(wave_shape: WaveShape, length: usize, frequency: f32, sample_rate: f32) -> Vec<f32> {
    let mut generator = WaveGenerator::new(sample_rate);
    generator.set_frequency(frequency);
    generator.set_wave_shape(wave_shape);
    generator.generate_buffer(length)
}

#[wasm_bindgen]
pub fn apply_window_function(mut buffer: Vec<f32>, window_type: &str) -> Vec<f32> {
    let length = buffer.len();
    for (i, sample) in buffer.iter_mut().enumerate() {
        let window_value = match window_type {
            "hann" => 0.5 * (1.0 - (2.0 * std::f32::consts::PI * i as f32 / (length - 1) as f32).cos()),
            "hamming" => 0.54 - 0.46 * (2.0 * std::f32::consts::PI * i as f32 / (length - 1) as f32).cos(),
            "blackman" => 0.42 - 0.5 * (2.0 * std::f32::consts::PI * i as f32 / (length - 1) as f32).cos() + 0.08 * (4.0 * std::f32::consts::PI * i as f32 / (length - 1) as f32).cos(),
            _ => 1.0, // rectangular window
        };
        *sample *= window_value;
    }
    buffer
}

#[wasm_bindgen]
pub fn calculate_fft_magnitude(buffer: Vec<f32>) -> Vec<f32> {
    // Simple magnitude calculation for visualization
    // In a real implementation, you'd use a proper FFT library
    let mut magnitudes = Vec::new();
    let chunk_size = 4;
    
    for chunk in buffer.chunks(chunk_size) {
        let magnitude = chunk.iter().map(|x| x * x).sum::<f32>().sqrt() / chunk.len() as f32;
        magnitudes.push(magnitude);
    }
    
    magnitudes
}

// Preset management
#[wasm_bindgen]
#[derive(Serialize, Deserialize)]
pub struct SynthPreset {
    name: String,
    wave_shape: u8,
    attack: f32,
    decay: f32,
    sustain: f32,
    release: f32,
    filter_cutoff: f32,
    filter_resonance: f32,
    filter_type: u8,
}

#[wasm_bindgen]
impl SynthPreset {
    #[wasm_bindgen(constructor)]
    pub fn new(name: String) -> SynthPreset {
        SynthPreset {
            name,
            wave_shape: 0, // Sine
            attack: 0.1,
            decay: 0.2,
            sustain: 0.7,
            release: 0.5,
            filter_cutoff: 1000.0,
            filter_resonance: 1.0,
            filter_type: 0, // LowPass
        }
    }
    
    #[wasm_bindgen]
    pub fn apply_to_synth(&self, synth: &mut AudioSynthesizer) {
        let wave_shape = match self.wave_shape {
            0 => WaveShape::Sine,
            1 => WaveShape::Saw,
            2 => WaveShape::Square,
            3 => WaveShape::Triangle,
            4 => WaveShape::Noise,
            _ => WaveShape::Custom,
        };
        
        let filter_type = match self.filter_type {
            0 => FilterType::LowPass,
            1 => FilterType::HighPass,
            2 => FilterType::BandPass,
            _ => FilterType::Notch,
        };
        
        synth.set_global_wave_shape(wave_shape);
        synth.set_global_envelope(self.attack, self.decay, self.sustain, self.release);
        synth.set_global_filter(self.filter_cutoff, self.filter_resonance, filter_type);
    }
    
    #[wasm_bindgen(getter)]
    pub fn name(&self) -> String {
        self.name.clone()
    }
}

// Create some default presets
#[wasm_bindgen]
pub fn create_default_presets() -> Vec<JsValue> {
    let presets = vec![
        {
            let mut preset = SynthPreset::new("Classic Lead".to_string());
            preset.wave_shape = 1; // Saw
            preset.attack = 0.01;
            preset.decay = 0.3;
            preset.sustain = 0.6;
            preset.release = 0.2;
            preset.filter_cutoff = 2000.0;
            preset.filter_resonance = 2.0;
            preset
        },
        {
            let mut preset = SynthPreset::new("Warm Pad".to_string());
            preset.wave_shape = 0; // Sine
            preset.attack = 1.0;
            preset.decay = 0.5;
            preset.sustain = 0.8;
            preset.release = 2.0;
            preset.filter_cutoff = 800.0;
            preset.filter_resonance = 1.2;
            preset
        },
        {
            let mut preset = SynthPreset::new("Bass".to_string());
            preset.wave_shape = 2; // Square
            preset.attack = 0.01;
            preset.decay = 0.1;
            preset.sustain = 0.9;
            preset.release = 0.1;
            preset.filter_cutoff = 400.0;
            preset.filter_resonance = 1.5;
            preset
        },
        {
            let mut preset = SynthPreset::new("Pluck".to_string());
            preset.wave_shape = 3; // Triangle
            preset.attack = 0.001;
            preset.decay = 0.8;
            preset.sustain = 0.0;
            preset.release = 0.1;
            preset.filter_cutoff = 3000.0;
            preset.filter_resonance = 0.8;
            preset
        },
    ];
    
    presets.into_iter().map(|p| serde_wasm_bindgen::to_value(&p).unwrap()).collect()
}
