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
      name: 'Lexicon 480L',
      description: 'Classic digital reverb processor with lush, dense tails',
      params: [
        { id: 'size', name: 'Size', type: 'range', min: 0.1, max: 4.0, step: 0.01, unit: '' },
        { id: 'decay', name: 'Decay', type: 'range', min: 0.1, max: 25.0, step: 0.1, unit: ' s' },
        { id: 'diffusion', name: 'Diffusion', type: 'range', min: 0, max: 100, step: 1, unit: ' %' },
        { id: 'damping', name: 'Damping', type: 'range', min: 0, max: 100, step: 1, unit: ' %' },
        { id: 'predelay', name: 'Pre-delay', type: 'range', min: 0, max: 250, step: 1, unit: ' ms' },
        { id: 'spread', name: 'Spread', type: 'range', min: 0, max: 100, step: 1, unit: ' %' },
        { id: 'shape', name: 'Shape', type: 'range', min: -1, max: 1, step: 0.01, unit: '' },
        { id: 'mix', name: 'Mix', type: 'range', min: 0, max: 100, step: 1, unit: ' %' }
      ],
      customUI: true,
      create: (ctx) => {
        const input = ctx.createGain();
        const predelayNode = ctx.createDelay(0.25);
        const dry = ctx.createGain();
        const wet = ctx.createGain();
        const output = ctx.createGain();
        
        // 480L-style parameters
        let params = { 
          size: 1.8, decay: 4.2, diffusion: 75, damping: 45, 
          predelay: 35, spread: 85, shape: 0.3, mix: 35 
        };
        
        // Initial setup
        predelayNode.delayTime.value = params.predelay / 1000;
        dry.gain.value = (100 - params.mix) / 100;
        wet.gain.value = params.mix / 100;

        // Create 480L-inspired tank structure with multiple delay networks
        // Early reflections network (characteristic 480L early pattern)
        const earlyTaps = [
          { time: 0.0043, gain: 0.841, pan: -0.4 },
          { time: 0.0215, gain: 0.504, pan: 0.6 },
          { time: 0.0225, gain: 0.491, pan: -0.6 },
          { time: 0.0268, gain: 0.379, pan: 0.8 },
          { time: 0.0270, gain: 0.380, pan: -0.2 },
          { time: 0.0298, gain: 0.346, pan: 0.4 },
          { time: 0.0458, gain: 0.289, pan: -0.8 },
          { time: 0.0485, gain: 0.272, pan: 0.2 }
        ];

        const earlySum = ctx.createGain();
        const earlyDelays = earlyTaps.map(tap => {
          const delay = ctx.createDelay(0.1);
          const gain = ctx.createGain();
          const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
          
          delay.delayTime.value = tap.time * params.size;
          gain.gain.value = tap.gain * (params.diffusion / 100);
          if (panner.pan) panner.pan.value = tap.pan * (params.spread / 100);
          
          predelayNode.connect(delay);
          delay.connect(gain);
          if (panner.pan) gain.connect(panner).connect(earlySum);
          else gain.connect(earlySum);
          
          return { delay, gain, panner, baseTime: tap.time, baseGain: tap.gain, basePan: tap.pan };
        });

        // Fixed feedback implementation based on your guidance
        const tankInput = ctx.createGain();
        const tankSum = ctx.createGain();
        
        // Multiple delay lines with controlled feedback (FDN approach)
        const delayTimes = [0.0297, 0.0371, 0.0411, 0.0437, 0.0527, 0.0617, 0.0707, 0.0797];
        const delays = [];
        const feedbacks = [];
        const filters = [];
        const modLfos = [];
        const modDepths = [];
        
        delayTimes.forEach((baseTime, i) => {
          const delay = ctx.createDelay(2.0);
          const feedback = ctx.createGain();
          const filter = ctx.createBiquadFilter();
          const modLfo = ctx.createOscillator();
          const modDepth = ctx.createGain();
          
          // Safe feedback settings - always less than 1.0
          delay.delayTime.value = baseTime * params.size;
          feedback.gain.value = Math.min(0.85, Math.pow(0.001, baseTime * params.size / params.decay));
          
          filter.type = 'lowpass';
          filter.frequency.value = 20000 - (params.damping * 180);
          
          // Subtle modulation to prevent metallic artifacts
          modLfo.type = 'sine';
          modLfo.frequency.value = 0.1 + (i * 0.05); // Staggered LFO rates
          modDepth.gain.value = 0.00005 * (params.diffusion / 100); // Very small modulation
          
          // Safe feedback routing: input -> delay -> filter -> feedback -> back to delay
          tankInput.connect(delay);
          delay.connect(filter);
          filter.connect(feedback);
          feedback.connect(delay); // Controlled feedback loop
          filter.connect(tankSum); // Output from filter (not feedback loop)
          
          // Modulation connection
          modLfo.connect(modDepth);
          modDepth.connect(delay.delayTime);
          modLfo.start();
          
          delays.push(delay);
          feedbacks.push(feedback);
          filters.push(filter);
          modLfos.push(modLfo);
          modDepths.push(modDepth);
        });
        
        // Cross-feedback between delay lines for complexity (like real 480L)
        delays.forEach((delay, i) => {
          const nextIndex = (i + 1) % delays.length;
          const crossFeed = ctx.createGain();
          crossFeed.gain.value = 0.1 * (params.diffusion / 100); // Very low cross-feed
          filters[i].connect(crossFeed);
          crossFeed.connect(delays[nextIndex]);
        });

        // Series allpass filters for diffusion (480L characteristic)
        const allpassTimes = [0.005, 0.0017, 0.0083, 0.0031];
        let allpassChain = tankSum;
        
        const allpasses = allpassTimes.map(time => {
          const delay = ctx.createDelay(0.1);
          const feedback = ctx.createGain();
          const feedforward = ctx.createGain();
          const sum1 = ctx.createGain();
          const sum2 = ctx.createGain();
          
          delay.delayTime.value = time * params.size;
          feedback.gain.value = 0.7 * (params.diffusion / 100);
          feedforward.gain.value = -0.7 * (params.diffusion / 100);
          
          // Allpass structure: input -> delay -> feedback -> input summing
          allpassChain.connect(sum1);
          allpassChain.connect(feedforward).connect(sum2);
          sum1.connect(delay).connect(feedback).connect(sum1);
          delay.connect(sum2);
          
          allpassChain = sum2;
          return { delay, feedback, feedforward, sum1, sum2, baseTime: time };
        });

        // Shape control (frequency tilt characteristic of 480L)
        const shapeFilter = ctx.createBiquadFilter();
        shapeFilter.type = 'highshelf';
        shapeFilter.frequency.value = 2000;
        shapeFilter.gain.value = params.shape * 6; // -6 to +6 dB shelf

        // Final connections
        input.connect(dry).connect(output);
        input.connect(predelayNode).connect(tankInput);
        
        earlySum.connect(shapeFilter);
        allpassChain.connect(shapeFilter);
        shapeFilter.connect(wet).connect(output);

        // Parameter update functions
        function updateSize() {
          earlyDelays.forEach((tap, i) => {
            tap.delay.delayTime.value = tap.baseTime * params.size;
          });
          delays.forEach((delay, i) => {
            delay.delayTime.value = delayTimes[i] * params.size;
          });
          allpasses.forEach(ap => {
            ap.delay.delayTime.value = ap.baseTime * params.size;
          });
        }

        function updateDecay() {
          feedbacks.forEach((feedback, i) => {
            // Ensure feedback gain never exceeds 0.9 to prevent runaway
            const calculatedGain = Math.pow(0.001, delayTimes[i] * params.size / params.decay);
            feedback.gain.value = Math.min(0.9, calculatedGain);
          });
        }

        function updateDiffusion() {
          earlyDelays.forEach(tap => {
            tap.gain.gain.value = tap.baseGain * (params.diffusion / 100);
          });
          modDepths.forEach(modDepth => {
            modDepth.gain.value = 0.00005 * (params.diffusion / 100);
          });
          allpasses.forEach(ap => {
            ap.feedback.gain.value = Math.min(0.8, 0.7 * (params.diffusion / 100));
            ap.feedforward.gain.value = Math.max(-0.8, -0.7 * (params.diffusion / 100));
          });
        }

        function updateDamping() {
          filters.forEach(filter => {
            filter.frequency.value = 20000 - (params.damping * 180);
          });
        }

        function updateSpread() {
          earlyDelays.forEach(tap => {
            if (tap.panner.pan) {
              tap.panner.pan.value = tap.basePan * (params.spread / 100);
            }
          });
        }

        const api = {
          setParam(id, value) {
            switch(id) {
              case 'size': 
                params.size = value; 
                updateSize(); 
                updateDecay(); 
                break;
              case 'decay': 
                params.decay = value; 
                updateDecay(); 
                break;
              case 'diffusion': 
                params.diffusion = value; 
                updateDiffusion(); 
                break;
              case 'damping': 
                params.damping = value; 
                updateDamping(); 
                break;
              case 'predelay': 
                params.predelay = value; 
                predelayNode.delayTime.value = value / 1000; 
                break;
              case 'spread': 
                params.spread = value; 
                updateSpread(); 
                break;
              case 'shape': 
                params.shape = value; 
                shapeFilter.gain.value = value * 6; 
                break;
              case 'mix': 
                params.mix = value; 
                dry.gain.value = (100 - value) / 100; 
                wet.gain.value = value / 100; 
                break;
            }
          },
          getParam(id) { return params[id]; },
          getParams() { return { ...params }; }
        };

        return { 
          input, 
          output, 
          nodes: [input, predelayNode, dry, wet, output, earlySum, tankInput, tankSum, shapeFilter], 
          api 
        };
      },
      
      // Custom UI renderer for authentic Lexicon 480L look
      renderUI: (containerId, instance) => {
        const container = document.getElementById(containerId);
        if (!container || !instance?.api) return;
        
        const params = instance.api.getParams();
        
        container.innerHTML = `
          <div class="lexicon-480l-panel">
            <!-- Main Program Display -->
            <div class="lexicon-header">
              <div>♥ 1 MEDIUM RAND HALL ........</div>
              <div>♥ 1 RANDOM HALLS</div>
            </div>

            <!-- Lexicon Logo and Button Grid -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
              <div style="font-size: 24px; font-weight: bold; color: #333;">lexicon</div>
              <div class="lexicon-button-grid" style="flex: 1; margin-left: 20px;">
                <div class="lexicon-button">OPEN</div>
                <div class="lexicon-button">1</div>
                <div class="lexicon-button">2</div>
                <div class="lexicon-button">3</div>
                <div class="lexicon-button">4</div>
                <div class="lexicon-button">5</div>
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
                <span>RTM</span>
                <span>SHP</span>
                <span>SPR</span>
                <span>SIZ</span>
                <span>HFC</span>
                <span>P1L</span>
              </div>
              <div class="lexicon-param-display" style="margin-top: 4px;">
                <span>${params.decay.toFixed(1)}</span>
                <span>${params.shape.toFixed(1)}</span>
                <span>${Math.round(params.spread)}</span>
                <span>${params.size.toFixed(1)}</span>
                <span>${(params.damping/10).toFixed(1)}K</span>
                <span>0MS</span>
              </div>
            </div>

            <!-- Vertical Faders -->
            <div class="lexicon-faders">
              ${[
                { id: 'decay', name: 'DECAY', value: params.decay, min: 0.1, max: 25.0, step: 0.1 },
                { id: 'shape', name: 'SHAPE', value: params.shape, min: -1, max: 1, step: 0.01 },
                { id: 'spread', name: 'SPREAD', value: params.spread, min: 0, max: 100, step: 1 },
                { id: 'size', name: 'SIZE', value: params.size, min: 0.1, max: 4.0, step: 0.01 },
                { id: 'damping', name: 'HFC', value: params.damping, min: 0, max: 100, step: 1 },
                { id: 'mix', name: 'MIX', value: params.mix, min: 0, max: 100, step: 1 }
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
            if (paramDisplays.length >= 6) {
              paramDisplays[4].textContent = updatedParams.decay.toFixed(1);
              paramDisplays[5].textContent = updatedParams.shape.toFixed(1);
              paramDisplays[6].textContent = Math.round(updatedParams.spread);
              paramDisplays[7].textContent = updatedParams.size.toFixed(1);
              paramDisplays[8].textContent = (updatedParams.damping/10).toFixed(1) + 'K';
              paramDisplays[9].textContent = Math.round(updatedParams.mix) + '%';
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
