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
