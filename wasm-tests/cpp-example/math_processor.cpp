#include <emscripten/emscripten.h>
#include <emscripten/bind.h>
#include <iostream>
#include <vector>
#include <cmath>

// Simple C++ functions that will be exposed to JavaScript
EMSCRIPTEN_KEEPALIVE
extern "C" {
    // Basic math functions
    int add_numbers(int a, int b) {
        return a + b;
    }
    
    double multiply_doubles(double a, double b) {
        return a * b;
    }
    
    // Array processing
    double calculate_average(double* arr, int length) {
        if (length == 0) return 0.0;
        
        double sum = 0.0;
        for (int i = 0; i < length; i++) {
            sum += arr[i];
        }
        return sum / length;
    }
}

// Using Embind for more complex C++ features
class MathCalculator {
public:
    MathCalculator() : result(0.0) {}
    
    void setResult(double value) {
        result = value;
    }
    
    double getResult() const {
        return result;
    }
    
    void add(double value) {
        result += value;
    }
    
    void multiply(double value) {
        result *= value;
    }
    
    void power(double exponent) {
        result = std::pow(result, exponent);
    }
    
    void reset() {
        result = 0.0;
    }
    
    // Vector operations
    std::vector<double> processArray(const std::vector<double>& input) {
        std::vector<double> output;
        for (double val : input) {
            output.push_back(val * 2.0 + 1.0); // Simple transformation
        }
        return output;
    }
    
private:
    double result;
};

// Audio processing function example
std::vector<float> processAudioBuffer(const std::vector<float>& input, float gain) {
    std::vector<float> output;
    output.reserve(input.size());
    
    for (float sample : input) {
        // Apply gain and simple saturation
        float processed = sample * gain;
        if (processed > 1.0f) processed = 1.0f;
        if (processed < -1.0f) processed = -1.0f;
        output.push_back(processed);
    }
    
    return output;
}

// DSP filter example (simple low-pass)
class SimpleFilter {
public:
    SimpleFilter(float cutoff = 0.5f) : cutoff_freq(cutoff), prev_output(0.0f) {}
    
    float process(float input) {
        float alpha = cutoff_freq;
        prev_output = alpha * input + (1.0f - alpha) * prev_output;
        return prev_output;
    }
    
    void setCutoff(float cutoff) {
        cutoff_freq = cutoff;
    }
    
    void reset() {
        prev_output = 0.0f;
    }
    
private:
    float cutoff_freq;
    float prev_output;
};

// Bind C++ classes and functions to JavaScript
EMSCRIPTEN_BINDINGS(my_module) {
    emscripten::function("add_numbers", &add_numbers);
    emscripten::function("multiply_doubles", &multiply_doubles);
    emscripten::function("processAudioBuffer", &processAudioBuffer);
    
    emscripten::class_<MathCalculator>("MathCalculator")
        .constructor<>()
        .function("setResult", &MathCalculator::setResult)
        .function("getResult", &MathCalculator::getResult)
        .function("add", &MathCalculator::add)
        .function("multiply", &MathCalculator::multiply)
        .function("power", &MathCalculator::power)
        .function("reset", &MathCalculator::reset)
        .function("processArray", &MathCalculator::processArray);
        
    emscripten::class_<SimpleFilter>("SimpleFilter")
        .constructor<>()
        .constructor<float>()
        .function("process", &SimpleFilter::process)
        .function("setCutoff", &SimpleFilter::setCutoff)
        .function("reset", &SimpleFilter::reset);
        
    emscripten::register_vector<double>("VectorDouble");
    emscripten::register_vector<float>("VectorFloat");
}
