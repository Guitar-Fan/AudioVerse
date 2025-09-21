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
    lexicon480L: {
      id: 'lexicon480L',
      name: 'Lexikon Tukan',
      description: 'Lexikan JSFX reverb algorithm with classic Lexicon styling',
      params: [
        { id: 'algorithm', name: 'Algorithm', type: 'range', min: 0, max: 4, step: 1, unit: '' },
        { id: 'mix', name: 'Mix', type: 'range', min: 0, max: 1, step: 0.01, unit: '' },
        { id: 'length', name: 'Length', type: 'range', min: 0, max: 10, step: 0.01, unit: ' s' },
        { id: 'predelay', name: 'Pre-delay', type: 'range', min: 0, max: 100, step: 1, unit: ' ms' },
        { id: 'lowdamp', name: 'Low Damp', type: 'range', min: 0, max: 1000, step: 1, unit: ' Hz' },
        { id: 'highdamp', name: 'High Damp', type: 'range', min: 1000, max: 10000, step: 1, unit: ' Hz' },
        { id: 'width', name: 'Width', type: 'range', min: 0, max: 100, step: 1, unit: ' %' },
        { id: 'mode', name: 'Mode', type: 'range', min: 0, max: 1, step: 1, unit: '' }
      ],
      customUI: true,
      create: (ctx) => {
        const input = ctx.createGain();
        const output = ctx.createGain();
        
        // Lexikan parameters (mapped from slider names in processor)
        let params = {
          algorithm: 0,    // slider26 (0=Ambience, 1=Small Room, 2=Medium Room, 3=Hall, 4=Plate)
          mix: 0.5,        // slider27 
          length: 1.0,     // slider3
          predelay: 0,     // slider4 (ms)
          lowdamp: 240,    // slider5 (Hz)
          highdamp: 2400,  // slider6 (Hz)
          width: 37,       // slider25 (%)
          mode: 1          // slider7 (0=mono, 1=stereo)
        };

        // Algorithm presets (ported from lexikan-processor.js)
        const algorithms = [
          { name: 'Ambience', delays: [12, 20, 9, 16, 5, 10, 13, 4, 18, 4, 3, 10] },
          { name: 'Small Room', delays: [5, 1, 4, 7, 9, 3, 7, 5, 7, 5, 6, 5] },
          { name: 'Medium Room', delays: [25, 13, 12, 10, 9, 8, 7, 6, 5, 4, 3, 1] },
          { name: 'Hall', delays: [1, 5, 25, 25, 14, 17, 11, 6, 10, 10, 14, 6] },
          { name: 'Plate', delays: [20, 25, 25, 18, 18, 14, 14, 11, 11, 25, 25, 25] }
        ];

        // Create ScriptProcessor for the complex Lexikan algorithm
        const processor = ctx.createScriptProcessor(1024, 2, 2);
        
        // Lexikan DSP state variables
        let t1 = 0, t2 = 0, t12 = 0, t22 = 0;
        let Rt1 = 0, Rt2 = 0, Rt12 = 0, Rt22 = 0;
        const g = 0.62; // Fixed gain from JSFX
        
        // Calculate delay buffer size and allocate
        const maxBufferSize = Math.floor(ctx.sampleRate * 12);
        const buffer = new Float32Array(maxBufferSize);
        const p = new Array(13).fill(0);     // Left pointers
        const Rp = new Array(13).fill(0);    // Right pointers
        const l = new Array(13).fill(100);   // Left lengths
        const Rl = new Array(13).fill(100);  // Right lengths
        const b = new Array(13).fill(0);     // Left buffer offsets
        const Rb = new Array(13).fill(0);    // Right buffer offsets
        
        // Precomputed coefficients
        let dry = 1.0, wet = 0.5, d = 0, d2 = 0, f = 0;
        let needsRecalc = true;

        function calculateCoefficients() {
          if (!needsRecalc) return;
          
          const alg = algorithms[Math.floor(params.algorithm)];
          
          // Mix calculation (from processor)
          if (params.mix < 0.5) {
            const slider2 = -48 * (1 - (2 * params.mix));
            const slider1 = 0;
            dry = slider1 <= -48.0 ? 0.0 : Math.pow(10, slider1 / 20);
            wet = slider2 <= -48.0 ? 0.0 : Math.pow(10, slider2 / 20) * 0.5;
          } else {
            const slider1 = -48 * ((params.mix - 0.5) * 2);
            const slider2 = 0;
            dry = slider1 <= -48.0 ? 0.0 : Math.pow(10, slider1 / 20);
            wet = slider2 <= -48.0 ? 0.0 : Math.pow(10, slider2 / 20) * 0.5;
          }

          // Damping coefficients
          d = Math.exp(-Math.PI * params.lowdamp / ctx.sampleRate);
          d2 = Math.exp(-2 * Math.PI * params.highdamp / ctx.sampleRate);

          // Calculate prime delay lengths (core Lexikan algorithm)
          const primes = [];
          primes[0] = (alg.delays[0] - 1) * (alg.delays[0] - 1) + alg.delays[0] + 40;
          for (let i = 1; i < 12; i++) {
            primes[i] = primes[i-1] + (alg.delays[i] - 1) * (alg.delays[i] - 1) + alg.delays[i] + 40;
          }
          
          // Set delay lengths
          l[0] = Math.floor(params.predelay / 1000 * ctx.sampleRate) + 1;
          for (let i = 1; i <= 12; i++) {
            l[i] = primes[i-1];
          }

          // Feedback coefficient
          f = Math.exp(Math.log(0.001) / (params.length * ctx.sampleRate / (l[5] + l[6] + l[7] + l[8])));
          if (isNaN(f) || params.length === 0) f = 0;

          // Right channel delays with width offset
          const offset = params.width;
          Rl[0] = l[0];
          Rl[1] = l[1];
          for (let i = 2; i <= 12; i++) {
            Rl[i] = i % 2 === 0 ? Math.max(1, l[i] - offset) : l[i] + offset;
          }

          // Buffer offsets
          b[0] = 0;
          for (let i = 1; i < 13; i++) {
            b[i] = b[i-1] + l[i-1];
          }
          
          Rb[0] = b[12] + l[12];
          for (let i = 1; i < 13; i++) {
            Rb[i] = Rb[i-1] + Rl[i-1];
          }

          needsRecalc = false;
        }

        processor.onaudioprocess = (e) => {
          calculateCoefficients();
          
          const inputBuffer = e.inputBuffer;
          const outputBuffer = e.outputBuffer;
          const leftIn = inputBuffer.getChannelData(0);
          const rightIn = inputBuffer.getChannelData(1) || inputBuffer.getChannelData(0);
          const leftOut = outputBuffer.getChannelData(0);
          const rightOut = outputBuffer.getChannelData(1) || outputBuffer.getChannelData(0);

          for (let i = 0; i < leftIn.length; i++) {
            const spl0 = leftIn[i];
            const spl1 = rightIn[i];
            
            let out = 0, Rout = 0;

            if (params.mode === 0) { // MONO MODE
              const input = (spl0 + spl1) * 0.5;
              
              // Lexikan DSP chain (simplified from processor)
              const in0 = input;
              const out0 = buffer[b[0] + p[0]];
              buffer[b[0] + p[0]] = in0;
              p[0] = (p[0] + 1) % l[0];

              // Allpass chain
              let in1 = out0, out1 = buffer[b[1] + p[1]] - g * in1;
              buffer[b[1] + p[1]] = in1 + g * out1;
              p[1] = (p[1] + 1) % l[1];

              let in2 = out1, out2 = buffer[b[2] + p[2]] - g * in2;
              buffer[b[2] + p[2]] = in2 + g * out2;
              p[2] = (p[2] + 1) % l[2];

              let in3 = out2, out3 = buffer[b[3] + p[3]] - g * in3;
              buffer[b[3] + p[3]] = in3 + g * out3;
              p[3] = (p[3] + 1) % l[3];

              let in4 = out3, out4 = buffer[b[4] + p[4]] - g * in4;
              buffer[b[4] + p[4]] = in4 + g * out4;
              p[4] = (p[4] + 1) % l[4];

              // Get feedback taps
              const out12 = buffer[b[12] + p[12]];
              const out8 = buffer[b[8] + p[8]];
              
              // Feedback processing with damping
              let tmp1 = out4 + out12 * f;
              let tmp2 = out4 + out8 * f;

              tmp1 -= t12 = tmp1 + d * (t12 - tmp1);
              tmp2 -= t22 = tmp2 + d * (t22 - tmp2);
              tmp1 = t1 = tmp1 + d2 * (t1 - tmp1);
              tmp2 = t2 = tmp2 + d2 * (t2 - tmp2);

              // Continue delay chain
              let in5 = tmp1, out5 = buffer[b[5] + p[5]] - g * in5;
              buffer[b[5] + p[5]] = in5 + g * out5;
              p[5] = (p[5] + 1) % l[5];

              let in6 = out5, out6 = buffer[b[6] + p[6]];
              buffer[b[6] + p[6]] = in6;
              p[6] = (p[6] + 1) % l[6];

              let in7 = out6, out7 = buffer[b[7] + p[7]] - g * in7;
              buffer[b[7] + p[7]] = in7 + g * out7;
              p[7] = (p[7] + 1) % l[7];

              let in8 = out7;
              buffer[b[8] + p[8]] = in8;
              p[8] = (p[8] + 1) % l[8];

              let in9 = tmp2, out9 = buffer[b[9] + p[9]] - g * in9;
              buffer[b[9] + p[9]] = in9 + g * out9;
              p[9] = (p[9] + 1) % l[9];

              let in10 = out9, out10 = buffer[b[10] + p[10]];
              buffer[b[10] + p[10]] = in10;
              p[10] = (p[10] + 1) % l[10];

              let in11 = out10, out11 = buffer[b[11] + p[11]] - g * in11;
              buffer[b[11] + p[11]] = in11 + g * out11;
              p[11] = (p[11] + 1) % l[11];

              let in12 = out11;
              buffer[b[12] + p[12]] = in12;
              p[12] = (p[12] + 1) % l[12];

              out = out5 + out7 + out9 + out11;
              Rout = out;

            } else { // STEREO MODE (similar but with separate right channel processing)
              // LEFT CHANNEL (same as mono but using spl0)
              const in0 = spl0;
              const out0 = buffer[b[0] + p[0]];
              buffer[b[0] + p[0]] = in0;
              p[0] = (p[0] + 1) % l[0];

              // [Continue similar processing for left channel...]
              // This is a simplified version - the full stereo implementation would
              // include separate right channel processing with different delay lengths
              
              out = spl0 * 0.3; // Placeholder - would be full Lexikan processing
              Rout = spl1 * 0.3;
            }

            leftOut[i] = spl0 * dry + out * wet;
            rightOut[i] = spl1 * dry + Rout * wet;
          }
        };

        // Connect audio graph
        input.connect(processor);
        processor.connect(output);

        const api = {
          setParam(id, value) {
            params[id] = value;
            needsRecalc = true;
          },
          getParam(id) { return params[id]; },
          getParams() { return { ...params }; }
        };

        return { 
          input, 
          output, 
          nodes: [input, processor, output], 
          api 
        };
      },
      
      // Custom UI renderer for Lexikan with Lexicon 480L look
      renderUI: (containerId, instance) => {
        const container = document.getElementById(containerId);
        if (!container || !instance?.api) return;
        
        const params = instance.api.getParams();
        
        // Algorithm preset names for display
        const algorithmNames = ['AMBIENCE', 'SMALL ROOM', 'MEDIUM ROOM', 'HALL', 'PLATE'];
        const algorithmName = algorithmNames[params.algorithm] || 'UNKNOWN';
        
        container.innerHTML = `
          <div class="lexicon-480l-panel">
            <!-- Main Program Display -->
            <div class="lexicon-header">
              <div>♥ ${params.algorithm + 1} ${algorithmName} ........</div>
              <div>♥ ${params.algorithm + 1} LEXIKAN ALGORITHMS</div>
            </div>

            <!-- Lexicon Logo and Algorithm Buttons -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
              <div style="font-size: 24px; font-weight: bold; color: #333;">lexicon</div>
              <div class="lexicon-button-grid" style="flex: 1; margin-left: 20px;">
                <div class="lexicon-button">OPEN</div>
                ${[0,1,2,3,4].map(alg => 
                  `<div class="lexicon-button algorithm-btn ${alg === params.algorithm ? 'active' : ''}" data-algorithm="${alg}">${alg + 1}</div>`
                ).join('')}
                <div class="lexicon-button">A</div>
                <div class="lexicon-button">B</div>
                <div class="lexicon-button">6</div>
                <div class="lexicon-button">7</div>
                <div class="lexicon-button">8</div>
                <div class="lexicon-button">9</div>
                <div class="lexicon-button">0</div>
              </div>
            </div>

            <!-- Function Buttons Row -->
            <div style="display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap;">
              <div class="lexicon-button" style="width: 60px;">MUTE</div>
              <div class="lexicon-button" style="width: 60px;">AUX OUTS</div>
              <div class="lexicon-button" style="width: 60px;">I/O METER</div>
              <div class="lexicon-button" style="width: 60px;">DISP HOLD</div>
              <div class="lexicon-button" style="width: 60px;">MIX DRY</div>
              <div class="lexicon-button" style="width: 60px;">MIX WET></div>
              <div class="lexicon-button" style="width: 60px;">WET SOLO</div>
              <div class="lexicon-button" style="width: 60px;">POWER</div>
            </div>

            <!-- Parameter Display -->
            <div class="lexicon-parameters">
              <div class="lexicon-param-display">
                <span>LEN</span>
                <span>MIX</span>
                <span>PDL</span>
                <span>LDP</span>
                <span>HDP</span>
                <span>WDT</span>
              </div>
              <div class="lexicon-param-display" style="margin-top: 4px;">
                <span>${params.length.toFixed(1)}</span>
                <span>${Math.round(params.mix)}%</span>
                <span>${Math.round(params.predelay)}ms</span>
                <span>${Math.round(params.lowdamp)}%</span>
                <span>${Math.round(params.highdamp)}%</span>
                <span>${Math.round(params.width)}%</span>
              </div>
            </div>

            <!-- Vertical Faders -->
            <div class="lexicon-faders">
              ${[
                { id: 'length', name: 'LENGTH', value: params.length, min: 0.1, max: 10.0, step: 0.1 },
                { id: 'mix', name: 'MIX', value: params.mix, min: 0, max: 100, step: 1 },
                { id: 'predelay', name: 'PREDELAY', value: params.predelay, min: 0, max: 200, step: 1 },
                { id: 'lowdamp', name: 'LOWDAMP', value: params.lowdamp, min: 0, max: 100, step: 1 },
                { id: 'highdamp', name: 'HIGHDAMP', value: params.highdamp, min: 0, max: 100, step: 1 },
                { id: 'width', name: 'WIDTH', value: params.width, min: 0, max: 100, step: 1 }
              ].map(param => {
                const percentage = ((param.value - param.min) / (param.max - param.min)) * 100;
                const knobPosition = 150 - (percentage / 100) * 130; // 150px total height, 130px travel
                return `
                  <div class="lexicon-fader-container">
                    <div class="lexicon-fader" data-param="${param.id}" data-min="${param.min}" data-max="${param.max}" data-step="${param.step}">
                      <div class="lexicon-fader-knob" style="top: ${knobPosition}px;"></div>
                    </div>
                    <div class="lexicon-fader-label">${param.name}</div>
                  </div>
                `;
              }).join('')}
            </div>

            <!-- Bottom Function Buttons -->
            <div class="lexicon-function-buttons">
              <div class="lexicon-function-button">< BANK ></div>
              <div class="lexicon-function-button">< PROGRAM ></div>
              <div class="lexicon-function-button">< PAGE ></div>
            </div>
          </div>
        `;
        
        // Add algorithm button interaction
        const algorithmBtns = container.querySelectorAll('.algorithm-btn');
        algorithmBtns.forEach(btn => {
          btn.addEventListener('click', () => {
            const alg = parseInt(btn.dataset.algorithm);
            instance.api.setParam('algorithm', alg);
            
            // Update UI to show new algorithm
            algorithmBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Update header display
            const algorithmName = algorithmNames[alg] || 'UNKNOWN';
            const headers = container.querySelectorAll('.lexicon-header div');
            if (headers.length >= 2) {
              headers[0].textContent = `♥ ${alg + 1} ${algorithmName} ........`;
              headers[1].textContent = `♥ ${alg + 1} LEXIKAN ALGORITHMS`;
            }
          });
        });
        
        // Add interactive fader behavior
        const faders = container.querySelectorAll('.lexicon-fader');
        faders.forEach(fader => {
          let isDragging = false;
          let startY = 0;
          let startValue = 0;
          
          const paramId = fader.dataset.param;
          const min = parseFloat(fader.dataset.min);
          const max = parseFloat(fader.dataset.max);
          const step = parseFloat(fader.dataset.step);
          const knob = fader.querySelector('.lexicon-fader-knob');
          
          knob.addEventListener('mousedown', (e) => {
            isDragging = true;
            startY = e.clientY;
            startValue = instance.api.getParam(paramId);
            e.preventDefault();
          });
          
          document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const deltaY = e.clientY - startY; // Normal direction for faders
            const range = max - min;
            const sensitivity = range / 130; // 130px travel distance
            let newValue = startValue - (deltaY * sensitivity); // Invert for fader feel
            
            // Constrain to bounds and step
            newValue = Math.max(min, Math.min(max, newValue));
            newValue = Math.round(newValue / step) * step;
            
            instance.api.setParam(paramId, newValue);
            
            // Update fader visual
            const percentage = ((newValue - min) / (max - min)) * 100;
            const knobPosition = 150 - (percentage / 100) * 130;
            knob.style.top = knobPosition + 'px';
            
            // Update parameter display
            const updatedParams = instance.api.getParams();
            const paramDisplays = container.querySelectorAll('.lexicon-param-display span');
            if (paramDisplays.length >= 12) {
              paramDisplays[6].textContent = updatedParams.length.toFixed(1);
              paramDisplays[7].textContent = Math.round(updatedParams.mix) + '%';
              paramDisplays[8].textContent = Math.round(updatedParams.predelay) + 'ms';
              paramDisplays[9].textContent = Math.round(updatedParams.lowdamp) + '%';
              paramDisplays[10].textContent = Math.round(updatedParams.highdamp) + '%';
              paramDisplays[11].textContent = Math.round(updatedParams.width) + '%';
            }
          });
          
          document.addEventListener('mouseup', () => {
            isDragging = false;
          });
        });
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
    },
    convolutionReverb: {
      id: 'convolutionReverb',
      name: 'Convolution Reverb',
      description: 'Convolution reverb with impulse response loading and advanced controls',
      params: [
        { id: 'mix', name: 'Mix', type: 'range', min: 0, max: 100, step: 1, unit: '%' },
        { id: 'predelay', name: 'Pre-Delay', type: 'range', min: 0, max: 500, step: 1, unit: ' ms' },
        { id: 'highpass', name: 'High-Pass', type: 'range', min: 20, max: 1000, step: 1, unit: ' Hz' },
        { id: 'lowpass', name: 'Low-Pass', type: 'range', min: 1000, max: 22000, step: 100, unit: ' Hz' }
      ],
      customUI: true,
      create: (ctx) => {
        const input = ctx.createGain();
        const output = ctx.createGain();
        
        // Audio graph nodes
        const wetGain = ctx.createGain();
        const dryGain = ctx.createGain();
        const convolverNode = ctx.createConvolver();
        const preDelayNode = ctx.createDelay(1.0);
        const lowPassFilter = ctx.createBiquadFilter();
        const highPassFilter = ctx.createBiquadFilter();
        
        // Setup filters
        lowPassFilter.type = 'lowpass';
        highPassFilter.type = 'highpass';
        
        // Initial parameters
        const params = {
          mix: 35,
          predelay: 0,
          highpass: 20,
          lowpass: 20000
        };
        
        // Store impulse response data for persistence
        let currentIR = null;
        let irName = 'No IR loaded';
        
        // Connect the audio graph
        // DRY PATH: input -> dryGain -> output
        input.connect(dryGain);
        dryGain.connect(output);
        
        // WET PATH: input -> preDelay -> convolver -> highPass -> lowPass -> wetGain -> output
        input.connect(preDelayNode);
        preDelayNode.connect(convolverNode);
        convolverNode.connect(highPassFilter);
        highPassFilter.connect(lowPassFilter);
        lowPassFilter.connect(wetGain);
        wetGain.connect(output);
        
        // Create initial silent buffer
        const silentBuffer = ctx.createBuffer(2, 1, ctx.sampleRate);
        convolverNode.buffer = silentBuffer;
        
        // Set initial values
        updateMix(params.mix);
        preDelayNode.delayTime.value = params.predelay / 1000;
        highPassFilter.frequency.value = params.highpass;
        highPassFilter.Q.value = 1;
        lowPassFilter.frequency.value = params.lowpass;
        lowPassFilter.Q.value = 1;
        
        function updateMix(mixValue) {
          const mix = mixValue / 100;
          const dryVal = Math.cos(mix * 0.5 * Math.PI);
          const wetVal = Math.sin(mix * 0.5 * Math.PI);
          dryGain.gain.setTargetAtTime(dryVal, ctx.currentTime, 0.01);
          wetGain.gain.setTargetAtTime(wetVal, ctx.currentTime, 0.01);
        }

        const api = {
          setParam(id, value) {
            params[id] = value;
            switch(id) {
              case 'mix':
                updateMix(value);
                break;
              case 'predelay':
                preDelayNode.delayTime.setTargetAtTime(value / 1000, ctx.currentTime, 0.01);
                break;
              case 'highpass':
                highPassFilter.frequency.setTargetAtTime(value, ctx.currentTime, 0.01);
                break;
              case 'lowpass':
                lowPassFilter.frequency.setTargetAtTime(value, ctx.currentTime, 0.01);
                break;
            }
          },
          getParam(id) { return params[id]; },
          getParams() { return { ...params }; },
          loadImpulseResponse(audioBuffer, fileName = 'IR') {
            convolverNode.buffer = audioBuffer;
            currentIR = audioBuffer;
            irName = fileName;
          },
          getCurrentIR() { return currentIR; },
          getIRName() { return irName; },
          // Method to restore IR after UI rebuild
          restoreIR() {
            if (currentIR) {
              convolverNode.buffer = currentIR;
            }
          }
        };
        
        return { 
          input, 
          output, 
          nodes: [input, output, wetGain, dryGain, convolverNode, preDelayNode, lowPassFilter, highPassFilter], 
          api 
        };
      },
      
      // Custom UI for file loading and knob controls
      renderUI: (containerId, instance) => {
        const container = document.getElementById(containerId);
        if (!container || !instance?.api) return;
        
        const params = instance.api.getParams();
        const currentIRName = instance.api.getIRName();
        const hasIR = instance.api.getCurrentIR() !== null;
        
        container.innerHTML = `
          <div class="convolution-reverb-panel" style="
            background: linear-gradient(135deg, #3a3f4b, #2c313a);
            border-radius: 8px;
            padding: 20px;
            color: #abb2bf;
            font-family: 'Roboto Mono', monospace;
          ">
            <!-- Header -->
            <div style="text-align: center; margin-bottom: 20px; border-bottom: 1px solid #4a505e; padding-bottom: 15px;">
              <h3 style="margin: 0; color: #61afef; font-size: 1.2em;">Convolution Reverb Processor</h3>
              <p style="margin-top: 5px; font-size: 0.8em; opacity: 0.7;">Load an Impulse Response (.wav) to begin</p>
            </div>

            <!-- IR Loading and Visualizer Section -->
            <div style="margin-bottom: 20px;">
              <!-- File Loading -->
              <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                <input type="file" id="ir-file-input-${containerId}" accept=".wav, .wave, audio/wav" style="display: none;">
                <label for="ir-file-input-${containerId}" style="
                  background-color: #e5c07b;
                  color: #282c34;
                  padding: 8px 15px;
                  border-radius: 4px;
                  cursor: pointer;
                  font-weight: bold;
                  transition: background-color 0.2s;
                ">Load IR</label>
                <span id="ir-name-${containerId}" style="font-size: 0.9em; opacity: 0.8; color: ${hasIR ? '#98c379' : '#abb2bf'};">${currentIRName}</span>
              </div>
              
              <!-- IR Visualizer -->
              <div style="
                background: #21252b;
                border: 1px solid #4a505e;
                border-radius: 4px;
                padding: 10px;
                margin-bottom: 10px;
              ">
                <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 8px;">
                  <span style="font-size: 0.8em; color: #98c379; font-weight: bold;">IMPULSE RESPONSE</span>
                  <span id="ir-info-${containerId}" style="font-size: 0.7em; color: #666;">${hasIR ? 'Loaded' : 'No IR'}</span>
                </div>
                <canvas id="ir-visualizer-${containerId}" width="400" height="80" style="
                  width: 100%;
                  height: 80px;
                  background: #1a1e24;
                  border-radius: 3px;
                  display: block;
                "></canvas>
              </div>
            </div>

            <!-- Controls Section -->
            <div style="display: flex; justify-content: space-around; align-items: flex-start; flex-wrap: wrap; gap: 15px; padding: 20px; background-color: #2c313a; border-radius: 6px;">
              ${[
                { id: 'mix', name: 'Mix (%)', value: params.mix, min: 0, max: 100, step: 1 },
                { id: 'predelay', name: 'Pre-Delay (ms)', value: params.predelay, min: 0, max: 500, step: 1 },
                { id: 'highpass', name: 'High-Pass (Hz)', value: params.highpass, min: 20, max: 1000, step: 1 },
                { id: 'lowpass', name: 'Low-Pass (Hz)', value: params.lowpass, min: 1000, max: 22000, step: 100 }
              ].map(param => `
                <div style="display: flex; flex-direction: column; align-items: center; gap: 10px; flex-basis: 100px;">
                  <div class="conv-knob" data-param="${param.id}" data-min="${param.min}" data-max="${param.max}" data-step="${param.step}" style="
                    width: 80px;
                    height: 80px;
                    border-radius: 50%;
                    position: relative;
                    cursor: pointer;
                    background: radial-gradient(circle at 30% 30%, #5a6274, #2c313a);
                    border: 2px solid #4a505e;
                  ">
                    <canvas width="80" height="80" style="border-radius: 50%;"></canvas>
                  </div>
                  <input type="text" class="conv-knob-value" data-param="${param.id}" value="${param.value}" style="
                    width: 60px;
                    text-align: center;
                    background-color: #21252b;
                    border: 1px solid #4a505e;
                    color: #98c379;
                    border-radius: 3px;
                    font-size: 0.8em;
                    padding: 3px;
                  ">
                  <label style="font-size: 0.9em; font-weight: bold; text-align: center;">${param.name}</label>
                </div>
              `).join('')}
            </div>
          </div>
        `;
        
        // IR Visualizer function
        function drawIRVisualizer() {
          const canvas = container.querySelector(`#ir-visualizer-${containerId}`);
          const ctx = canvas.getContext('2d');
          const irInfoSpan = container.querySelector(`#ir-info-${containerId}`);
          
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          const currentIR = instance.api.getCurrentIR();
          if (!currentIR) {
            // Draw empty state
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(0, canvas.height / 2);
            ctx.lineTo(canvas.width, canvas.height / 2);
            ctx.stroke();
            ctx.setLineDash([]);
            
            ctx.fillStyle = '#666';
            ctx.font = '12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('No impulse response loaded', canvas.width / 2, canvas.height / 2 - 5);
            irInfoSpan.textContent = 'No IR';
            return;
          }
          
          // Draw IR waveform
          const channelData = currentIR.getChannelData(0); // Use left channel
          const samples = channelData.length;
          const sampleRate = currentIR.sampleRate;
          const duration = samples / sampleRate;
          
          // Update info
          irInfoSpan.textContent = `${duration.toFixed(2)}s, ${sampleRate}Hz`;
          
          // Draw waveform
          ctx.strokeStyle = '#61afef';
          ctx.lineWidth = 1;
          ctx.beginPath();
          
          const step = Math.max(1, Math.floor(samples / canvas.width));
          let x = 0;
          
          for (let i = 0; i < samples; i += step) {
            const amplitude = channelData[i];
            const y = (canvas.height / 2) + (amplitude * canvas.height / 3); // Scale amplitude
            
            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
            
            x = (i / samples) * canvas.width;
          }
          
          ctx.stroke();
          
          // Draw decay envelope visualization
          ctx.strokeStyle = '#98c379';
          ctx.lineWidth = 0.5;
          ctx.globalAlpha = 0.6;
          ctx.beginPath();
          
          for (let x = 0; x < canvas.width; x++) {
            const progress = x / canvas.width;
            const sampleIndex = Math.floor(progress * samples);
            if (sampleIndex >= samples) break;
            
            // Find peak in local window for envelope
            let peak = 0;
            const windowSize = Math.max(1, Math.floor(step / 4));
            for (let j = Math.max(0, sampleIndex - windowSize); j < Math.min(samples, sampleIndex + windowSize); j++) {
              peak = Math.max(peak, Math.abs(channelData[j]));
            }
            
            const envelopeY = (canvas.height / 2) - (peak * canvas.height / 3);
            if (x === 0) {
              ctx.moveTo(x, envelopeY);
            } else {
              ctx.lineTo(x, envelopeY);
            }
          }
          
          ctx.stroke();
          ctx.globalAlpha = 1.0;
        }
        
        // Add file loading functionality
        const irInput = container.querySelector(`#ir-file-input-${containerId}`);
        const irNameSpan = container.querySelector(`#ir-name-${containerId}`);
        
        irInput.addEventListener('change', (e) => {
          const file = e.target.files[0];
          if (!file) return;
          
          irNameSpan.textContent = file.name;
          irNameSpan.style.color = '#ffd58f';
          
          const reader = new FileReader();
          reader.onload = (e) => {
            const audioContext = instance.input.context;
            audioContext.decodeAudioData(e.target.result, (buffer) => {
              instance.api.loadImpulseResponse(buffer, file.name);
              irNameSpan.style.color = '#98c379';
              drawIRVisualizer(); // Update visualizer immediately
            }, (err) => {
              irNameSpan.textContent = 'Error loading IR';
              irNameSpan.style.color = '#e06c75';
              console.error('Error decoding IR file:', err);
            });
          };
          reader.readAsArrayBuffer(file);
        });
        
        // Restore IR if it exists and draw initial visualizer
        instance.api.restoreIR();
        drawIRVisualizer();
        
        // Add knob functionality
        const knobs = container.querySelectorAll('.conv-knob');
        const valueInputs = container.querySelectorAll('.conv-knob-value');
        
        knobs.forEach(knob => {
          const canvas = knob.querySelector('canvas');
          const ctx = canvas.getContext('2d');
          const paramId = knob.dataset.param;
          const min = parseFloat(knob.dataset.min);
          const max = parseFloat(knob.dataset.max);
          const step = parseFloat(knob.dataset.step);
          
          function drawKnob(value) {
            const angle = -125 + ((value - min) / (max - min)) * 250;
            
            ctx.clearRect(0, 0, 80, 80);
            
            // Background arc
            ctx.beginPath();
            ctx.arc(40, 40, 32, (-125 - 5) * Math.PI / 180, (-125 + 250 + 5) * Math.PI / 180);
            ctx.lineWidth = 6;
            ctx.strokeStyle = '#444';
            ctx.stroke();
            
            // Foreground arc
            ctx.beginPath();
            ctx.arc(40, 40, 32, -125 * Math.PI / 180, angle * Math.PI / 180);
            ctx.lineWidth = 6;
            ctx.strokeStyle = '#98c379';
            ctx.stroke();
            
            // Indicator line
            ctx.save();
            ctx.translate(40, 40);
            ctx.rotate(angle * Math.PI / 180);
            ctx.beginPath();
            ctx.moveTo(0, -26);
            ctx.lineTo(0, -35);
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#FFF';
            ctx.stroke();
            ctx.restore();
          }
          
          function updateValue(val) {
            val = Math.round(val / step) * step;
            val = Math.max(min, Math.min(max, val));
            val = Number.isInteger(step) ? parseInt(val) : parseFloat(val.toFixed(2));
            
            instance.api.setParam(paramId, val);
            drawKnob(val);
            
            const input = container.querySelector(`.conv-knob-value[data-param="${paramId}"]`);
            if (input) input.value = val;
          }
          
          // Initial draw
          drawKnob(instance.api.getParam(paramId));
          
          // Mouse interaction
          let isDragging = false;
          let startY, startVal;
          
          knob.addEventListener('mousedown', (e) => {
            isDragging = true;
            startY = e.clientY;
            startVal = instance.api.getParam(paramId);
            e.preventDefault();
          });
          
          document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            const deltaY = startY - e.clientY;
            const range = max - min;
            const newVal = startVal + (deltaY / 150) * range;
            updateValue(newVal);
          });
          
          document.addEventListener('mouseup', () => {
            isDragging = false;
          });
        });
        
        // Add text input functionality
        valueInputs.forEach(input => {
          input.addEventListener('change', () => {
            const paramId = input.dataset.param;
            const value = parseFloat(input.value);
            if (!isNaN(value)) {
              instance.api.setParam(paramId, value);
              const knob = container.querySelector(`.conv-knob[data-param="${paramId}"]`);
              if (knob) {
                const canvas = knob.querySelector('canvas');
                const ctx = canvas.getContext('2d');
                const min = parseFloat(knob.dataset.min);
                const max = parseFloat(knob.dataset.max);
                
                // Redraw knob
                const angle = -125 + ((value - min) / (max - min)) * 250;
                ctx.clearRect(0, 0, 80, 80);
                
                ctx.beginPath();
                ctx.arc(40, 40, 32, (-125 - 5) * Math.PI / 180, (-125 + 250 + 5) * Math.PI / 180);
                ctx.lineWidth = 6;
                ctx.strokeStyle = '#444';
                ctx.stroke();
                
                ctx.beginPath();
                ctx.arc(40, 40, 32, -125 * Math.PI / 180, angle * Math.PI / 180);
                ctx.lineWidth = 6;
                ctx.strokeStyle = '#98c379';
                ctx.stroke();
                
                ctx.save();
                ctx.translate(40, 40);
                ctx.rotate(angle * Math.PI / 180);
                ctx.beginPath();
                ctx.moveTo(0, -26);
                ctx.lineTo(0, -35);
                ctx.lineWidth = 3;
                ctx.strokeStyle = '#FFF';
                ctx.stroke();
                ctx.restore();
              }
            }
          });
        });
      }
    },
    algorithmicReverb: {
      id: 'algorithmicReverb',
      name: 'Algorithmic Reverb',
      description: 'Algorithmic reverb with plate, hall, and room algorithms',
      params: [
        { id: 'type', name: 'Type', type: 'select', options: [
          { value: 'plate', label: 'Plate' },
          { value: 'hall', label: 'Hall' },
          { value: 'room', label: 'Room' }
        ]},
        { id: 'mix', name: 'Mix', type: 'range', min: 0, max: 100, step: 1, unit: '%' },
        { id: 'decay', name: 'Decay', type: 'range', min: 0.1, max: 10, step: 0.1, unit: ' s' },
        { id: 'predelay', name: 'Pre-Delay', type: 'range', min: 0, max: 200, step: 1, unit: ' ms' },
        { id: 'damping', name: 'Damping', type: 'range', min: 500, max: 15000, step: 100, unit: ' Hz' }
      ],
      customUI: true,
      create: (ctx) => {
        const input = ctx.createGain();
        const output = ctx.createGain();
        const wetGain = ctx.createGain();
        const dryGain = ctx.createGain();
        const convolver = ctx.createConvolver();
        
        // Connect audio graph
        input.connect(dryGain);
        dryGain.connect(output);
        input.connect(convolver);
        convolver.connect(wetGain);
        wetGain.connect(output);
        
        const params = {
          type: 'plate',
          mix: 35,
          decay: 3.0,
          predelay: 20,
          damping: 5000
        };
        
        function updateReverbGains() {
          const mix = params.mix / 100;
          const dryVal = Math.cos(mix * 0.5 * Math.PI);
          const wetVal = Math.sin(mix * 0.5 * Math.PI);
          dryGain.gain.setTargetAtTime(dryVal, ctx.currentTime, 0.01);
          wetGain.gain.setTargetAtTime(wetVal, ctx.currentTime, 0.01);
        }
        
        function generateAndApplyImpulseResponse() {
          const sampleRate = ctx.sampleRate;
          const duration = Math.max(0.1, params.decay);
          const preDelay = Math.max(0, params.predelay / 1000);
          const damping = params.damping;
          
          const length = Math.floor(sampleRate * duration);
          const preDelaySamples = Math.floor(sampleRate * preDelay);
          const impulse = ctx.createBuffer(2, length + preDelaySamples, sampleRate);
          
          const left = impulse.getChannelData(0);
          const right = impulse.getChannelData(1);
          
          for (let i = 0; i < length; i++) {
            const n = i / length;
            let envelope = 1;
            
            if (params.type === 'hall') {
              envelope = Math.pow(1 - n, 2.5);
            } else if (params.type === 'room') {
              envelope = Math.pow(1 - n, 1.8);
            } else { // Plate
              envelope = Math.pow(1 - n, 2);
            }
            
            left[i + preDelaySamples] = (Math.random() * 2 - 1) * envelope;
            right[i + preDelaySamples] = (Math.random() * 2 - 1) * envelope;
          }
          
          // Apply damping (simple one-pole IIR low-pass filter)
          const b1 = Math.exp(-2 * Math.PI * damping / sampleRate);
          let prevL = 0, prevR = 0;
          for (let i = 0; i < impulse.length; i++) {
            left[i] = left[i] * (1 - b1) + b1 * prevL;
            right[i] = right[i] * (1 - b1) + b1 * prevR;
            prevL = left[i];
            prevR = right[i];
          }
          
          convolver.buffer = impulse;
        }
        
        // Initialize
        updateReverbGains();
        generateAndApplyImpulseResponse();
        
        const api = {
          setParam(id, value) {
            params[id] = value;
            switch(id) {
              case 'mix':
                updateReverbGains();
                break;
              case 'type':
              case 'decay':
              case 'predelay':
              case 'damping':
                generateAndApplyImpulseResponse();
                break;
            }
          },
          getParam(id) { return params[id]; },
          getParams() { return { ...params }; }
        };
        
        return { 
          input, 
          output, 
          nodes: [input, output, wetGain, dryGain, convolver], 
          api 
        };
      },
      
      // Custom UI for algorithmic reverb
      renderUI: (containerId, instance) => {
        const container = document.getElementById(containerId);
        if (!container || !instance?.api) return;
        
        const params = instance.api.getParams();
        
        container.innerHTML = `
          <div class="algorithmic-reverb-panel" style="
            background: linear-gradient(135deg, #3a3f4b, #2c313a);
            border-radius: 8px;
            padding: 20px;
            color: #abb2bf;
            font-family: 'Roboto Mono', monospace;
          ">
            <!-- Header -->
            <div style="text-align: center; margin-bottom: 20px; border-bottom: 1px solid #4a505e; padding-bottom: 15px;">
              <h3 style="margin: 0; color: #61afef; font-size: 1.2em;">Algorithmic Reverb Processor</h3>
              <p style="margin-top: 5px; font-size: 0.8em; opacity: 0.7;">Advanced algorithmic reverb with multiple room types</p>
            </div>

            <!-- Main Panel -->
            <div style="display: flex; gap: 20px; padding: 20px; background-color: #2c313a; border-radius: 6px; flex-wrap: wrap;">
              
              <!-- Reverb Type Selector -->
              <div style="display: flex; flex-direction: column; flex-basis: 150px; flex-grow: 1;">
                <h4 style="margin-top: 0;">Reverb Type</h4>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                  ${['plate', 'hall', 'room'].map(type => `
                    <label style="cursor: pointer; display: flex; align-items: center; gap: 5px;">
                      <input type="radio" name="reverb-type-${containerId}" value="${type}" ${params.type === type ? 'checked' : ''} style="margin-right: 5px;">
                      <span>${type.charAt(0).toUpperCase() + type.slice(1)}</span>
                    </label>
                  `).join('')}
                </div>
              </div>
              
              <!-- Controls Section -->
              <div style="display: flex; flex-grow: 2; justify-content: space-around; align-items: flex-start; flex-wrap: wrap; gap: 15px;">
                ${[
                  { id: 'mix', name: 'Mix (%)', value: params.mix, min: 0, max: 100, step: 1 },
                  { id: 'decay', name: 'Decay (s)', value: params.decay, min: 0.1, max: 10, step: 0.1 },
                  { id: 'predelay', name: 'Pre-Delay (ms)', value: params.predelay, min: 0, max: 200, step: 1 },
                  { id: 'damping', name: 'Damping (Hz)', value: params.damping, min: 500, max: 15000, step: 100 }
                ].map(param => `
                  <div style="display: flex; flex-direction: column; align-items: center; gap: 10px; flex-basis: 100px;">
                    <div class="algo-knob" data-param="${param.id}" data-min="${param.min}" data-max="${param.max}" data-step="${param.step}" style="
                      width: 80px;
                      height: 80px;
                      border-radius: 50%;
                      position: relative;
                      cursor: pointer;
                      background: radial-gradient(circle at 30% 30%, #5a6274, #2c313a);
                      border: 2px solid #4a505e;
                    ">
                      <canvas width="80" height="80" style="border-radius: 50%;"></canvas>
                    </div>
                    <input type="text" class="algo-knob-value" data-param="${param.id}" value="${param.value}" style="
                      width: 60px;
                      text-align: center;
                      background-color: #21252b;
                      border: 1px solid #4a505e;
                      color: #98c379;
                      border-radius: 3px;
                      font-size: 0.8em;
                      padding: 3px;
                    ">
                    <label style="font-size: 0.9em; font-weight: bold; text-align: center;">${param.name}</label>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        `;
        
        // Add radio button functionality
        const radioButtons = container.querySelectorAll(`input[name="reverb-type-${containerId}"]`);
        radioButtons.forEach(radio => {
          radio.addEventListener('change', () => {
            instance.api.setParam('type', radio.value);
          });
        });
        
        // Add knob functionality (similar to convolution reverb)
        const knobs = container.querySelectorAll('.algo-knob');
        const valueInputs = container.querySelectorAll('.algo-knob-value');
        
        knobs.forEach(knob => {
          const canvas = knob.querySelector('canvas');
          const ctx = canvas.getContext('2d');
          const paramId = knob.dataset.param;
          const min = parseFloat(knob.dataset.min);
          const max = parseFloat(knob.dataset.max);
          const step = parseFloat(knob.dataset.step);
          
          function drawKnob(value) {
            const angle = -125 + ((value - min) / (max - min)) * 250;
            
            ctx.clearRect(0, 0, 80, 80);
            
            // Background arc
            ctx.beginPath();
            ctx.arc(40, 40, 32, (-125 - 10) * Math.PI / 180, (-125 + 250 + 10) * Math.PI / 180);
            ctx.lineWidth = 6;
            ctx.strokeStyle = '#444';
            ctx.stroke();
            
            // Foreground arc
            ctx.beginPath();
            ctx.arc(40, 40, 32, -125 * Math.PI / 180, angle * Math.PI / 180);
            ctx.lineWidth = 6;
            ctx.strokeStyle = '#98c379';
            ctx.stroke();
            
            // Indicator line
            ctx.save();
            ctx.translate(40, 40);
            ctx.rotate(angle * Math.PI / 180);
            ctx.beginPath();
            ctx.moveTo(0, -24);
            ctx.lineTo(0, -36);
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#98c379';
            ctx.stroke();
            ctx.restore();
          }
          
          function updateValue(val) {
            val = Math.round(val / step) * step;
            val = Math.max(min, Math.min(max, val));
            val = Number.isInteger(step) ? parseInt(val) : parseFloat(val.toFixed(2));
            
            instance.api.setParam(paramId, val);
            drawKnob(val);
            
            const input = container.querySelector(`.algo-knob-value[data-param="${paramId}"]`);
            if (input) input.value = val;
          }
          
          // Initial draw
          drawKnob(instance.api.getParam(paramId));
          
          // Mouse interaction
          let isDragging = false;
          let startY, startVal;
          
          knob.addEventListener('mousedown', (e) => {
            isDragging = true;
            startY = e.clientY;
            startVal = instance.api.getParam(paramId);
            e.preventDefault();
          });
          
          document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            const deltaY = startY - e.clientY;
            const range = max - min;
            const newVal = startVal + (deltaY / 100) * range;
            updateValue(newVal);
          });
          
          document.addEventListener('mouseup', () => {
            isDragging = false;
          });
        });
        
        // Add text input functionality
        valueInputs.forEach(input => {
          input.addEventListener('change', () => {
            const paramId = input.dataset.param;
            const value = parseFloat(input.value);
            if (!isNaN(value)) {
              instance.api.setParam(paramId, value);
              const knob = container.querySelector(`.algo-knob[data-param="${paramId}"]`);
              if (knob) {
                const canvas = knob.querySelector('canvas');
                const ctx = canvas.getContext('2d');
                const min = parseFloat(knob.dataset.min);
                const max = parseFloat(knob.dataset.max);
                
                // Redraw knob
                const angle = -125 + ((value - min) / (max - min)) * 250;
                ctx.clearRect(0, 0, 80, 80);
                
                ctx.beginPath();
                ctx.arc(40, 40, 32, (-125 - 10) * Math.PI / 180, (-125 + 250 + 10) * Math.PI / 180);
                ctx.lineWidth = 6;
                ctx.strokeStyle = '#444';
                ctx.stroke();
                
                ctx.beginPath();
                ctx.arc(40, 40, 32, -125 * Math.PI / 180, angle * Math.PI / 180);
                ctx.lineWidth = 6;
                ctx.strokeStyle = '#98c379';
                ctx.stroke();
                
                ctx.save();
                ctx.translate(40, 40);
                ctx.rotate(angle * Math.PI / 180);
                ctx.beginPath();
                ctx.moveTo(0, -24);
                ctx.lineTo(0, -36);
                ctx.lineWidth = 3;
                ctx.strokeStyle = '#98c379';
                ctx.stroke();
                ctx.restore();
              }
            }
          });
        });
      }
    }
  };

  const FXPlugins = {
    list() { return Object.values(FX_PLUGINS); },
    get(id) { return FX_PLUGINS[id]; },
    create(id, ctx) { const def = FX_PLUGINS[id]; return def ? def.create(ctx) : null; },
    getParams(id) { const def = FX_PLUGINS[id]; return def && def.params ? def.params : []; },
    
    // Helper to get plugin instance from DAW track system
    getInstance(trackIndex, slotIndex) {
      if (!window.trackInsertChains) return null;
      const chain = window.trackInsertChains.get(trackIndex);
      if (!chain || !chain.chain) return null;
      const entry = chain.chain.find(item => item.slotIndex === slotIndex);
      return entry ? entry.instance : null;
    },
    
    // Set parameter on a plugin instance
    setParam(trackIndex, slotIndex, paramId, value) {
      const instance = this.getInstance(trackIndex, slotIndex);
      if (instance && instance.api && instance.api.setParam) {
        try {
          instance.api.setParam(paramId, value);
          return true;
        } catch (e) {
          console.warn('Failed to set parameter:', e);
        }
      }
      return false;
    },
    
    // Get parameter value from a plugin instance
    getParamValue(trackIndex, slotIndex, paramId) {
      const instance = this.getInstance(trackIndex, slotIndex);
      if (instance && instance.api && instance.api.getParams) {
        try {
          const params = instance.api.getParams();
          return params[paramId];
        } catch (e) {
          console.warn('Failed to get parameter:', e);
        }
      }
      return null;
    }
  };

  global.FX_PLUGINS = FX_PLUGINS;
  global.FXPlugins = FXPlugins;
})(window);
