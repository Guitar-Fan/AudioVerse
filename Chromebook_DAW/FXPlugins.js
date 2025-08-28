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
    delay: {
      id: 'delay',
      name: 'Stereo Delay',
      description: 'Ping-pong style delay with feedback and tone',
      params: [
        { id: 'timeL', name: 'Time L', type: 'range', min: 0.02, max: 1.2, step: 0.01 },
        { id: 'timeR', name: 'Time R', type: 'range', min: 0.02, max: 1.2, step: 0.01 },
        { id: 'feedback', name: 'Feedback', type: 'range', min: 0, max: 0.95, step: 0.01 },
        { id: 'wet', name: 'Wet', type: 'range', min: 0, max: 1, step: 0.01 },
        { id: 'tone', name: 'Tone', type: 'range', min: 500, max: 8000, step: 10 }
      ],
      create: (ctx) => {
        const input = ctx.createGain();
        const splitter = ctx.createChannelSplitter(2);
        const merger = ctx.createChannelMerger(2);
        const dl = ctx.createDelay(2.0);
        const dr = ctx.createDelay(2.0);
        const fbL = ctx.createGain();
        const fbR = ctx.createGain();
        const wet = ctx.createGain();
        const dry = ctx.createGain();
        const lpL = ctx.createBiquadFilter(); lpL.type = 'lowpass';
        const lpR = ctx.createBiquadFilter(); lpR.type = 'lowpass';
        const params = { timeL: 0.3, timeR: 0.45, feedback: 0.35, wet: 0.3, tone: 4000 };
        dl.delayTime.value = params.timeL; dr.delayTime.value = params.timeR;
        fbL.gain.value = params.feedback; fbR.gain.value = params.feedback;
        wet.gain.value = params.wet; dry.gain.value = 1.0;
        lpL.frequency.value = params.tone; lpR.frequency.value = params.tone;

        // routing
        input.connect(dry);
        input.connect(splitter);
        splitter.connect(dl, 0);
        splitter.connect(dr, 1);
        dl.connect(lpL).connect(fbL).connect(dl); // feedback loop L
        dr.connect(lpR).connect(fbR).connect(dr); // feedback loop R
        dl.connect(merger, 0, 0);
        dr.connect(merger, 0, 1);
        const out = ctx.createGain();
        dry.connect(out);
        merger.connect(wet).connect(out);

        const api = {
          setParam(id, val){
            switch(id){
              case 'timeL': dl.delayTime.value = params.timeL = val; break;
              case 'timeR': dr.delayTime.value = params.timeR = val; break;
              case 'feedback': fbL.gain.value = fbR.gain.value = params.feedback = val; break;
              case 'wet': wet.gain.value = params.wet = val; break;
              case 'tone': lpL.frequency.value = lpR.frequency.value = params.tone = val; break;
            }
          },
          getParam(id){ return params[id]; },
          getParams(){ return { ...params }; }
        };
        return { input, output: out, nodes: [input, splitter, merger, dl, dr, fbL, fbR, wet, dry, lpL, lpR, out], api };
      }
    },
    chorus: {
      id: 'chorus',
      name: 'Chorus',
      description: 'Classic chorus using modulated delay',
      params: [
        { id: 'rate', name: 'Rate', type: 'range', min: 0.05, max: 5, step: 0.01 },
        { id: 'depth', name: 'Depth', type: 'range', min: 0, max: 0.02, step: 0.0001 },
        { id: 'mix', name: 'Mix', type: 'range', min: 0, max: 1, step: 0.01 }
      ],
      create: (ctx) => {
        const input = ctx.createGain();
        const delay = ctx.createDelay(0.05);
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        const wet = ctx.createGain();
        const dry = ctx.createGain();
        const out = ctx.createGain();
        const params = { rate: 1.2, depth: 0.0045, mix: 0.4 };
        lfo.type = 'sine';
        lfo.frequency.value = params.rate;
        lfoGain.gain.value = params.depth;
        wet.gain.value = params.mix;
        dry.gain.value = 1.0;
        input.connect(dry).connect(out);
        input.connect(delay).connect(wet).connect(out);
        lfo.connect(lfoGain).connect(delay.delayTime);
        lfo.start();

        const api = {
          setParam(id, v){
            switch(id){
              case 'rate': lfo.frequency.value = params.rate = v; break;
              case 'depth': lfoGain.gain.value = params.depth = v; break;
              case 'mix': wet.gain.value = params.mix = v; break;
            }
          },
          getParam(id){ return params[id]; },
          getParams(){ return { ...params }; }
        };
        return { input, output: out, nodes: [input, delay, lfo, lfoGain, wet, dry, out], api };
      }
    },
    distortion: {
      id: 'distortion',
      name: 'Distortion',
      description: 'Waveshaper with tone control',
      params: [
        { id: 'drive', name: 'Drive', type: 'range', min: 0, max: 1, step: 0.01 },
        { id: 'tone', name: 'Tone', type: 'range', min: 500, max: 8000, step: 10 },
        { id: 'mix', name: 'Mix', type: 'range', min: 0, max: 1, step: 0.01 }
      ],
      create: (ctx) => {
        const input = ctx.createGain();
        const shaper = ctx.createWaveShaper();
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
        const wet = ctx.createGain(); const dry = ctx.createGain(); const out = ctx.createGain();
        const params = { drive: 0.5, tone: 3500, mix: 0.35 };

        function makeCurve(amount = 0.5){
          const k = amount * 100; const n = 44100; const curve = new Float32Array(n);
          for (let i=0;i<n;i++){ const x = (i / n) * 2 - 1; curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x)); }
          return curve;
        }
        shaper.curve = makeCurve(params.drive);
        shaper.oversample = '4x';
        lp.frequency.value = params.tone;
        wet.gain.value = params.mix; dry.gain.value = 1.0;

        input.connect(dry).connect(out);
        input.connect(shaper).connect(lp).connect(wet).connect(out);

        const api = {
          setParam(id, v){
            switch(id){
              case 'drive': shaper.curve = makeCurve(params.drive = v); break;
              case 'tone': lp.frequency.value = params.tone = v; break;
              case 'mix': wet.gain.value = params.mix = v; break;
            }
          },
          getParam(id){ return params[id]; },
          getParams(){ return { ...params }; }
        };
        return { input, output: out, nodes: [input, shaper, lp, wet, dry, out], api };
      }
    },
    algoverb: {
      id: 'algoverb',
      name: 'Algorithmic Reverb',
      description: 'Simple Schroeder-style reverb (comb + allpass)',
      params: [
        { id: 'room', name: 'Room', type: 'range', min: 0.1, max: 3.0, step: 0.01 },
        { id: 'damp', name: 'Damp', type: 'range', min: 500, max: 10000, step: 10 },
        { id: 'mix', name: 'Mix', type: 'range', min: 0, max: 1, step: 0.01 }
      ],
      create: (ctx) => {
        const input = ctx.createGain();
        const dry = ctx.createGain();
        const wet = ctx.createGain();
        const out = ctx.createGain();
        const params = { room: 1.2, damp: 3000, mix: 0.3 };
        dry.gain.value = 1.0; wet.gain.value = params.mix;

        // Build a tiny network of delays with feedback (very lightweight)
        function comb(time, feedback){
          const d = ctx.createDelay(1.5); d.delayTime.value = time;
          const g = ctx.createGain(); g.gain.value = feedback;
          const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = params.damp;
          d.connect(lp).connect(g).connect(d);
          return { input: d, output: d, tune(room){ d.delayTime.value = time * room; lp.frequency.value = params.damp; } };
        }
        function allpass(time, gain){
          const d = ctx.createDelay(1.0); d.delayTime.value = time;
          const g = ctx.createGain(); g.gain.value = gain;
          const sum = ctx.createGain();
          const diff = ctx.createGain(); diff.gain.value = -1;
          // input -> sum -> delay -> g -> sum out; also input -> diff -> g -> to out
          const apIn = ctx.createGain();
          apIn.connect(sum);
          apIn.connect(diff);
          sum.connect(d).connect(g);
          g.connect(sum);
          g.connect(diff);
          const apOut = ctx.createGain();
          d.connect(apOut); // simplified allpass
          return { input: apIn, output: apOut, tune(room){ d.delayTime.value = time * room; } };
        }

        const c1 = comb(0.0297, 0.805);
        const c2 = comb(0.0371, 0.827);
        const c3 = comb(0.0411, 0.783);
        const c4 = comb(0.0437, 0.764);
        const a1 = allpass(0.005, 0.7);
        const a2 = allpass(0.0017, 0.7);

        // wire
        input.connect(dry).connect(out);
        const sum = ctx.createGain();
        input.connect(c1.input); c1.output.connect(sum);
        input.connect(c2.input); c2.output.connect(sum);
        input.connect(c3.input); c3.output.connect(sum);
        input.connect(c4.input); c4.output.connect(sum);
        sum.connect(a1.input);
        a1.output.connect(a2.input);
        a2.output.connect(wet).connect(out);

        function retune(){
          [c1,c2,c3,c4,a1,a2].forEach(n=>{ if (n.tune) n.tune(params.room); });
        }
        retune();

        const api = {
          setParam(id, v){
            switch(id){
              case 'room': params.room = v; retune(); break;
              case 'damp': params.damp = v; retune(); break;
              case 'mix': wet.gain.value = params.mix = v; break;
            }
          },
          getParam(id){ return params[id]; },
          getParams(){ return { ...params }; }
        };
        return { input, output: out, nodes: [input, dry, wet, out], api };
      }
    },
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
