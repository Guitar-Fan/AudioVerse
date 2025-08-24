// Simple JS Audio FX Plugins registry
// Each plugin exposes: id, name, description, create(audioCtx) -> { input, output, nodes, dispose? }

(function(global){
  function generateImpulseResponse(ctx, duration = 2.5, decay = 2.0) {
    const rate = ctx.sampleRate;
    const length = rate * duration;
    const impulse = ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const channelData = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return impulse;
  }

  const FX_PLUGINS = {
    reverb: {
      id: 'reverb',
      name: 'Reverb',
      description: 'Simple convolver reverb',
      params: [
        { id: 'wet', name: 'Wet', type: 'range', min: 0, max: 1, step: 0.01, unit: '' },
        { id: 'time', name: 'Time', type: 'range', min: 0.2, max: 5, step: 0.1, unit: 's' },
        { id: 'decay', name: 'Decay', type: 'range', min: 0.5, max: 4, step: 0.1, unit: '' }
      ],
      create: (ctx) => {
        const input = ctx.createGain();
        const convolver = ctx.createConvolver();
        let params = { wet: 0.35, time: 1.8, decay: 2.5 };
        convolver.buffer = generateImpulseResponse(ctx, params.time, params.decay);
        const wetGain = ctx.createGain();
        wetGain.gain.value = params.wet;
        const dryGain = ctx.createGain();
        dryGain.gain.value = 1.0;

        // routing: input -> [dry] -> merge; input -> convolver -> wet -> merge
        const merger = ctx.createGain();
        input.connect(dryGain).connect(merger);
        input.connect(convolver).connect(wetGain).connect(merger);

        const api = {
          setParam(id, value) {
            switch(id){
              case 'wet': params.wet = value; wetGain.gain.value = value; break;
              case 'time': params.time = value; convolver.buffer = generateImpulseResponse(ctx, params.time, params.decay); break;
              case 'decay': params.decay = value; convolver.buffer = generateImpulseResponse(ctx, params.time, params.decay); break;
            }
          },
          getParam(id) { return params[id]; },
          getParams() { return { ...params }; }
        };
        return { input, output: merger, nodes: [input, convolver, wetGain, dryGain, merger], api };
      }
    },
    eq3: {
      id: 'eq3',
      name: 'EQ (3-Band)',
      description: 'Low-shelf, mid-peak, high-shelf',
      params: [
        { id: 'lowGain', name: 'Low Gain', type: 'range', min: -12, max: 12, step: 0.5, unit: ' dB' },
        { id: 'midGain', name: 'Mid Gain', type: 'range', min: -12, max: 12, step: 0.5, unit: ' dB' },
        { id: 'midFreq', name: 'Mid Freq', type: 'range', min: 200, max: 4000, step: 10, unit: ' Hz' },
        { id: 'midQ', name: 'Mid Q', type: 'range', min: 0.2, max: 4, step: 0.1, unit: '' },
        { id: 'highGain', name: 'High Gain', type: 'range', min: -12, max: 12, step: 0.5, unit: ' dB' }
      ],
      create: (ctx) => {
        const input = ctx.createGain();
        const low = ctx.createBiquadFilter();
        low.type = 'lowshelf';
        low.frequency.value = 120;
        low.gain.value = 2;
        let params = { lowGain: 2, midGain: 1, midFreq: 1000, midQ: 0.7, highGain: 2 };
        const mid = ctx.createBiquadFilter();
        mid.type = 'peaking';
        mid.frequency.value = params.midFreq;
        mid.Q.value = params.midQ;
        mid.gain.value = params.midGain;
        const high = ctx.createBiquadFilter();
        high.type = 'highshelf';
        high.frequency.value = 6000;
        high.gain.value = params.highGain;

        input.connect(low).connect(mid).connect(high);
        const api = {
          setParam(id, value) {
            switch(id){
              case 'lowGain': params.lowGain = value; low.gain.value = value; break;
              case 'midGain': params.midGain = value; mid.gain.value = value; break;
              case 'midFreq': params.midFreq = value; mid.frequency.value = value; break;
              case 'midQ': params.midQ = value; mid.Q.value = value; break;
              case 'highGain': params.highGain = value; high.gain.value = value; break;
            }
          },
          getParam(id) { return params[id]; },
          getParams() { return { ...params }; }
        };
        return { input, output: high, nodes: [input, low, mid, high], api };
      }
    },
    compressor: {
      id: 'compressor',
      name: 'Compressor',
      description: 'Dynamics compressor',
      params: [
        { id: 'threshold', name: 'Threshold', type: 'range', min: -60, max: 0, step: 1, unit: ' dB' },
        { id: 'ratio', name: 'Ratio', type: 'range', min: 1, max: 12, step: 0.1, unit: ':1' },
        { id: 'attack', name: 'Attack', type: 'range', min: 0, max: 1, step: 0.005, unit: ' s' },
        { id: 'release', name: 'Release', type: 'range', min: 0, max: 1, step: 0.005, unit: ' s' },
        { id: 'knee', name: 'Knee', type: 'range', min: 0, max: 40, step: 1, unit: ' dB' }
      ],
      create: (ctx) => {
        const input = ctx.createGain();
        const comp = ctx.createDynamicsCompressor();
        let params = { threshold: -18, knee: 24, ratio: 3, attack: 0.01, release: 0.25 };
        comp.threshold.value = params.threshold;
        comp.knee.value = params.knee;
        comp.ratio.value = params.ratio;
        comp.attack.value = params.attack;
        comp.release.value = params.release;
        input.connect(comp);
        const api = {
          setParam(id, value) {
            switch(id){
              case 'threshold': params.threshold = value; comp.threshold.value = value; break;
              case 'knee': params.knee = value; comp.knee.value = value; break;
              case 'ratio': params.ratio = value; comp.ratio.value = value; break;
              case 'attack': params.attack = value; comp.attack.value = value; break;
              case 'release': params.release = value; comp.release.value = value; break;
            }
          },
          getParam(id) { return params[id]; },
          getParams() { return { ...params }; }
        };
        return { input, output: comp, nodes: [input, comp], api };
      }
    }
  };

  const FXPlugins = {
    list() { return Object.values(FX_PLUGINS); },
    get(id) { return FX_PLUGINS[id]; },
    create(id, ctx) { const def = FX_PLUGINS[id]; return def ? def.create(ctx) : null; },
    getParams(id) { const def = FX_PLUGINS[id]; return def && def.params ? def.params : []; }
  };

  global.FX_PLUGINS = FX_PLUGINS;
  global.FXPlugins = FXPlugins;
})(window);
