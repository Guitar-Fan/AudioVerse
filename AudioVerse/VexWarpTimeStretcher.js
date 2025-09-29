/*
  VexWarp TimeStretcher - Standalone version for AudioVerse
  Based on VexWarp by Mohit Cheppudira (0xfe)
  
  STFT, Phase Vocoder implementations for time stretching and pitch shifting.
*/

// VexWarp Tools (simplified version without RequireJS)
const VexWarpTools = {
  merge: function(destination, source) {
    for (var property in source)
      destination[property] = source[property];
    return destination;
  },

  onProgress: function(details, message) {
    if (details.complete) {
      console.log(message, "Done.");
    } else {
      var per_stage_factor = 0;
      var stage_factor = 0;
      if (details.total_stages > 0) {
        per_stage_factor = 1 / details.total_stages;
        stage_factor = (details.current_stage - 1) / details.total_stages;
      }
      var progress_pct = parseInt((details.current_window / details.total_windows) * 100);
      
      // Log every 10%
      if ((this.last_pct != progress_pct) && (progress_pct % 10 == 0)) {
        var total_pct = (stage_factor * 100) + (per_stage_factor * progress_pct);

        if (details.total_stages == 0) {
          console.log(message, "Progress:", details.current_window,
            "/", details.total_windows, "("+progress_pct+"%)");
          this.last_pct = progress_pct;
        } else {
          console.log(message, "Stage:", details.current_stage,
            "/", details.total_stages,
            "Progress:", details.current_window,
            "/", details.total_windows, "("+total_pct+"%)");
          this.last_pct = progress_pct;
        }
      }
    }
  },

  interpolateArray: function(data, newData, fitCount) {
    var springFactor = new Number((data.length - 1) / (fitCount - 1));
    newData[0] = data[0];
    
    for (var i = 1; i < fitCount - 1; i++) {
      var tmp = i * springFactor;
      var before = Math.floor(tmp);
      var after = Math.ceil(tmp);
      var atPoint = tmp - before;
      newData[i] = data[before] + (data[after] - data[before]) * atPoint;
    }

    newData[fitCount - 1] = data[data.length - 1];
    return newData;
  }
};

// VexWarp TimeStretcher class
class VexWarpTimeStretcher {
  constructor(sampleRateOrOptions = {}, numberOfChannels = 1, extraOptions = {}) {
    // Handle different constructor signatures
    if (typeof sampleRateOrOptions === 'object') {
      // Called with options object only
      this.init(sampleRateOrOptions);
    } else {
      // Called with sampleRate, numberOfChannels, options (DAW style)
      const options = {
        sampleRate: sampleRateOrOptions,
        numberOfChannels: numberOfChannels,
        ...extraOptions
      };
      this.init(options);
    }
  }

  init(options) {
    this.options = {
      vocode: true,             // Enable Phase Vocoder for better quality
      stftBins: 8192,           // Number of bins used by FFT
      stftHop: 1/4,             // Hop size for STFT (25%)
      stretchFactor: 1.5,       // Stretch factor (1.5x)
      sampleRate: 44100,        // PCM sample rate (44KHz)
      numberOfChannels: 1,      // Default mono
      algorithm: 'psola',       // Default algorithm
      frameSize: 2048,          // Frame size for analysis
      hopSize: 512,             // Hop size for analysis
      preserveFormants: true,   // Preserve formants
      progressCallback: VexWarpTools.onProgress
    };

    VexWarpTools.merge(this.options, options);
    this.stretched_buffer = null;
    this.resampled_buffer = null;
    return this;
  }

  setBuffer(buffer, sampleRate) {
    this.buffer = buffer;
    this.stretched_buffer = null;
    this.resampled_buffer = null;
    if (sampleRate) this.options.sampleRate = sampleRate;
    return this;
  }

  getBuffer() {
    return this.buffer;
  }

  getStretchFactor() {
    return this.options.stretchFactor;
  }

  getStretchedBuffer() {
    return this.stretched_buffer;
  }

  getPitchShiftedBuffer() {
    return this.resampled_buffer;
  }

  getOptions() {
    return this.options;
  }

  phase(fft, bin) {
    return Math.atan2(fft.imag[bin], fft.real[bin]);
  }

  // New method signature expected by DAW code
  stretch(inputData, outputData, stretchRatio) {
    try {
      console.log('VexWarp stretch called:', {
        inputLength: inputData.length,
        outputLength: outputData.length,
        stretchRatio: stretchRatio,
        sampleRate: this.options.sampleRate
      });
      
      this.setBuffer(inputData, this.options.sampleRate);
      this.options.stretchFactor = stretchRatio;
      const stretcherResult = this.stretchInternal();
      
      // Extract the actual audio data from the stretcher
      const result = this.getStretchedBuffer();
      
      console.log('VexWarp stretch result:', {
        stretcherResultType: typeof stretcherResult,
        resultLength: result ? result.length : 'null',
        resultType: typeof result,
        isArray: Array.isArray(result),
        isFloat32Array: result instanceof Float32Array
      });
      
      if (!result || (!Array.isArray(result) && !(result instanceof Float32Array))) {
        console.warn('VexWarp stretch returned invalid result, using fallback');
        // Fallback: simple linear interpolation
        return this.fallbackStretch(inputData, outputData, stretchRatio);
      }
      
      // Copy result to output buffer
      const minLength = Math.min(outputData.length, result.length);
      for (let i = 0; i < minLength; i++) {
        outputData[i] = result[i];
      }
      
      console.log('Copied', minLength, 'samples from VexWarp result');
      
      console.log('VexWarp stretch completed successfully');
      return outputData;
    } catch (error) {
      console.error('VexWarp stretch error:', error);
      console.log('Falling back to simple stretch');
      return this.fallbackStretch(inputData, outputData, stretchRatio);
    }
  }
  
  // Fallback stretch method using simple interpolation
  fallbackStretch(inputData, outputData, stretchRatio) {
    console.log('Using fallback stretch method');
    
    for (let i = 0; i < outputData.length; i++) {
      const sourceIndex = (i / outputData.length) * inputData.length;
      const index1 = Math.floor(sourceIndex);
      const index2 = Math.min(index1 + 1, inputData.length - 1);
      const fraction = sourceIndex - index1;
      
      outputData[i] = inputData[index1] * (1 - fraction) + inputData[index2] * fraction;
    }
    
    return outputData;
  }

  // Original stretch method renamed
  stretchInternal() {
    if (!this.buffer) {
      throw "Error: VexWarpTimeStretcher.setBuffer() must be called before stretch()";
    }

    if (this.stretched_buffer) return this.stretched_buffer;

    const that = this;
    function progress(stage, window, total_windows, complete) {
      that.options.progressCallback({
        current_stage: stage,
        total_stages: 2,
        current_window: window,
        total_windows: total_windows,
        complete: (complete == true)
      }, "VexWarp Time Stretching: ");
    }

    const points = this.options.stftBins;
    const vocode = this.options.vocode;
    const hop = parseInt(points * this.options.stftHop);
    const hop_synthesis = parseInt(hop * this.options.stretchFactor);
    const freq = this.options.sampleRate;
    const data = this.buffer;

    const t = 1 / freq;
    const length = data.length;
    const hanning = new WindowFunction(DSP.HANN);
    const stretch_amount = this.options.stretchFactor;

    console.log("VexWarp: Starting time stretch ("+ (stretch_amount) +"x). Buffer size: " + length);

    let frames_processed = 0;
    const output_frames = [];

    // Analysis Phase: Perform STFT, and calculate phase adjustments.
    for (let start = 0; start < (length - points); start += hop) {
      const section = new Float32Array(points);
      section.set(data.subarray(start, start + points));
      if (section.length < points) break;

      if (vocode) {
        const fft = new FFT(points, freq);
        fft.forward(hanning.process(section));
        output_frames.push(fft);
        const this_frame = fft;
        frames_processed++;

        if (frames_processed > 1) {
          const last_frame = output_frames[frames_processed - 2];
          // For each bin
          for (let bin = 0; bin < points; ++bin) {
            const phase_shift = this.phase(this_frame, bin) - this.phase(last_frame, bin);
            const freq_deviation = (phase_shift / (hop / freq)) - fft.getBandFrequency(bin);
            const wrapped_deviation = ((freq_deviation + Math.PI) % (2 * Math.PI)) - Math.PI;
            const true_freq = fft.getBandFrequency(bin) + wrapped_deviation;
            const new_phase = this.phase(last_frame, bin) + ((hop_synthesis / freq) * true_freq);

            // Calculate new spectrum
            const new_mag = Math.sqrt(
              (this_frame.real[bin] * this_frame.real[bin]) +
              (this_frame.imag[bin] * this_frame.imag[bin]));

            this_frame.real[bin] = new_mag * Math.cos(new_phase);
            this_frame.imag[bin] = new_mag * Math.sin(new_phase);
          }
        }
      } else {
        output_frames.push(hanning.process(section));
        frames_processed++;
      }

      progress(1, frames_processed, parseInt(((length - points) / hop)));
    }

    console.log("VexWarp: Analysis complete: " + frames_processed + " frames.");

    // Synthesis Phase
    const final_buffer = new Float32Array(parseInt(length * stretch_amount));
    let overlap_pointer = 0;
    let total_output = 0;
    
    for (let i = 0; i < output_frames.length; ++i) {
      const fft = output_frames[i];
      const buffer = vocode ? hanning.process(fft.inverse()) : fft;

      for (let j = 0; j < buffer.length; ++j) {
        final_buffer[overlap_pointer + j] += buffer[j];
      }
      total_output += buffer.length;
      overlap_pointer += hop_synthesis;
      progress(2, i + 1, output_frames.length);
    }

    progress(2, output_frames.length, output_frames.length, true);
    this.stretched_buffer = final_buffer;
    return this;
  }

  resize(size) {
    const buffer = this.stretched_buffer;
    const newBuffer = new Float32Array(size);
    this.resampled_buffer = VexWarpTools.interpolateArray(buffer, newBuffer, size);
    return this;
  }

  // Convenience method for time stretching audio data
  static async timeStretchAudio(audioBuffer, stretchFactor, progressCallback) {
    return new Promise((resolve, reject) => {
      try {
        console.log('VexWarp: Time stretching audio with factor:', stretchFactor);
        
        // Convert AudioBuffer to Float32Array
        const channelData = audioBuffer.getChannelData(0);
        
        const stretcher = new VexWarpTimeStretcher({
          stretchFactor: stretchFactor,
          sampleRate: audioBuffer.sampleRate,
          vocode: true, // Use phase vocoder for better quality
          progressCallback: progressCallback || VexWarpTools.onProgress
        });

        stretcher.setBuffer(channelData, audioBuffer.sampleRate);
        stretcher.stretchInternal();
        
        const stretchedData = stretcher.getStretchedBuffer();
        
        // Create new AudioBuffer with stretched data
        const stretchedBuffer = new AudioBuffer({
          numberOfChannels: audioBuffer.numberOfChannels,
          length: stretchedData.length,
          sampleRate: audioBuffer.sampleRate
        });
        
        // Copy stretched data to all channels
        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
          if (channel === 0) {
            stretchedBuffer.copyToChannel(stretchedData, channel);
          } else {
            // For other channels, apply the same stretch to the original data
            const originalChannelData = audioBuffer.getChannelData(channel);
            const channelStretcher = new VexWarpTimeStretcher({
              stretchFactor: stretchFactor,
              sampleRate: audioBuffer.sampleRate,
              vocode: true
            });
            
            channelStretcher.setBuffer(originalChannelData, audioBuffer.sampleRate);
            channelStretcher.stretchInternal();
            const channelStretchedData = channelStretcher.getStretchedBuffer();
            stretchedBuffer.copyToChannel(channelStretchedData, channel);
          }
        }
        
        resolve(stretchedBuffer);
      } catch (error) {
        console.error('VexWarp time stretch error:', error);
        reject(error);
      }
    });
  }
}

// Export for use in other modules
window.VexWarpTimeStretcher = VexWarpTimeStretcher;
window.VexWarpTools = VexWarpTools;

// Create VexWarp namespace for compatibility
window.VexWarp = window.VexWarp || {};
window.VexWarp.TimeStretcher = VexWarpTimeStretcher;
window.VexWarp.Tools = VexWarpTools;

console.log('VexWarp TimeStretcher loaded successfully');