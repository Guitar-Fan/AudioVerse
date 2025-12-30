// lexikan-processor.js

class LexikanProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        
        // --- State variables from JSFX ---
        this.params = {
            slider1: 0, slider2: -6, slider3: 1, slider4: 0,
            slider5: 240, slider6: 2400, slider7: 1, slider11: 20,
            slider12: 5, slider13: 10, slider14: 14, slider15: 18,
            slider16: 4, slider17: 16, slider18: 2, slider19: 10,
            slider20: 5, slider21: 15, slider22: 3, slider25: 37,
            slider26: 0, slider27: 0.5, slider31: 1
        };

        // DSP state
        this.t1 = 0; this.t2 = 0; this.t12 = 0; this.t22 = 0;
        this.Rt1 = 0; this.Rt2 = 0; this.Rt12 = 0; this.Rt22 = 0;

        // Fixed gains from JSFX
        this.g1 = this.g2 = this.g3 = this.g4 = this.g5 = this.g7 = this.g9 = this.g11 = 0.62;
        
        // Calculated parameters
        this.dry = 1.0; this.wet = 0.5;
        this.d = 0; this.d2 = 0; this.f = 0;

        // Buffer and pointers
        const maxBufferSize = sampleRate * 12; // Generous buffer for max delay times
        this.buffer = new Float32Array(maxBufferSize);
        this.p = new Array(13).fill(0); // Left channel pointers
        this.Rp = new Array(13).fill(0); // Right channel pointers
        this.l = new Array(13).fill(100); // Left delay lengths
        this.Rl = new Array(13).fill(100); // Right delay lengths
        this.b = new Array(13).fill(0); // Left buffer offsets
        this.Rb = new Array(13).fill(0); // Right buffer offsets

        this.port.onmessage = this.handleMessage.bind(this);
        this.recalculateNeeded = true;
        this.port.postMessage({ type: 'ready' });
    }

    handleMessage(event) {
        if (event.data.type === 'params') {
            const newParams = event.data.params;
            for (const key in newParams) {
                this.params[key] = newParams[key];
            }
            this.recalculateNeeded = true;
        }
    }

    recalculateCoefficients() {
        if (!this.recalculateNeeded) return;
        
        // --- Ported from @slider section ---
        
        // ALGORITHMS (sets prime number sliders)
        const alg = this.params.slider26;
        if (alg === 0) { // Ambience
            this.params.slider11 = 12; this.params.slider12 = 20; this.params.slider13 = 9; this.params.slider14 = 16;
            this.params.slider15 = 5; this.params.slider16 = 10; this.params.slider17 = 13; this.params.slider18 = 4;
            this.params.slider19 = 18; this.params.slider20 = 4; this.params.slider21 = 3; this.params.slider22 = 10;
        } else if (alg === 1) { // Small Room
            this.params.slider11 = 5; this.params.slider12 = 1; this.params.slider13 = 4; this.params.slider14 = 7;
            this.params.slider15 = 9; this.params.slider16 = 3; this.params.slider17 = 7; this.params.slider18 = 5;
            this.params.slider19 = 7; this.params.slider20 = 5; this.params.slider21 = 6; this.params.slider22 = 5;
        } else if (alg === 2) { // Big Room
            this.params.slider11 = 25; this.params.slider12 = 13; this.params.slider13 = 12; this.params.slider14 = 10;
            this.params.slider15 = 9; this.params.slider16 = 8; this.params.slider17 = 7; this.params.slider18 = 6;
            this.params.slider19 = 5; this.params.slider20 = 4; this.params.slider21 = 3; this.params.slider22 = 1;
        } else if (alg === 3) { // Hall
            this.params.slider11 = 1; this.params.slider12 = 5; this.params.slider13 = 25; this.params.slider14 = 25;
            this.params.slider15 = 14; this.params.slider16 = 17; this.params.slider17 = 11; this.params.slider18 = 6;
            this.params.slider19 = 10; this.params.slider20 = 10; this.params.slider21 = 14; this.params.slider22 = 6;
        } else if (alg === 4) { // Plate
            this.params.slider11 = 20; this.params.slider12 = 25; this.params.slider13 = 25; this.params.slider14 = 18;
            this.params.slider15 = 18; this.params.slider16 = 14; this.params.slider17 = 14; this.params.slider18 = 11;
            this.params.slider19 = 11; this.params.slider20 = 25; this.params.slider21 = 25; this.params.slider22 = 25;
        }

        // Mix to Dry/Wet gain
        if (this.params.slider27 < 0.5) {
            this.params.slider2 = -48 * (1 - (2 * this.params.slider27));
            this.params.slider1 = 0;
        } else {
            this.params.slider1 = -48 * ((this.params.slider27 - 0.5) * 2);
            this.params.slider2 = 0;
        }
        this.dry = this.params.slider1 <= -48.0 ? 0.0 : 10 ** (this.params.slider1 / 20);
        this.wet = this.params.slider2 <= -48.0 ? 0.0 : 10 ** (this.params.slider2 / 20) * 0.5;

        // Damp and feedback
        this.d = Math.exp(-Math.PI * this.params.slider5 / sampleRate);
        this.d2 = Math.exp(-2 * Math.PI * this.params.slider6 / sampleRate);

        // Calculate prime numbers for delay lengths
        const p = [];
        p[0] = (this.params.slider11 - 1) ** 2 + this.params.slider11 + 40;
        p[1] = p[0] + (this.params.slider12 - 1) ** 2 + this.params.slider12 + 40;
        p[2] = p[1] + (this.params.slider13 - 1) ** 2 + this.params.slider13 + 40;
        p[3] = p[2] + (this.params.slider14 - 1) ** 2 + this.params.slider14 + 40;
        p[4] = p[3] + (this.params.slider15 - 1) ** 2 + this.params.slider15 + 40;
        p[5] = p[4] + (this.params.slider16 - 1) ** 2 + this.params.slider16 + 40;
        p[6] = p[5] + (this.params.slider17 - 1) ** 2 + this.params.slider17 + 40;
        p[7] = p[6] + (this.params.slider18 - 1) ** 2 + this.params.slider18 + 40;
        p[8] = p[7] + (this.params.slider19 - 1) ** 2 + this.params.slider19 + 40;
        p[9] = p[8] + (this.params.slider20 - 1) ** 2 + this.params.slider20 + 40;
        p[10] = p[9] + (this.params.slider21 - 1) ** 2 + this.params.slider21 + 40;
        p[11] = p[10] + (this.params.slider22 - 1) ** 2 + this.params.slider22 + 40;
        
        // Delay lengths
        this.l[0] = Math.floor(this.params.slider4 / 1000 * sampleRate) + 1;
        for (let i = 1; i <= 12; i++) {
            this.l[i] = p[i-1];
        }

        this.f = Math.exp(Math.log(0.001) / (this.params.slider3 * sampleRate / (this.l[5] + this.l[6] + this.l[7] + this.l[8])));
        if (isNaN(this.f) || this.params.slider3 === 0) {
            this.f = 0;
        }

        // Right channel delay lengths with offset
        const offset = this.params.slider25;
        this.Rl[0] = this.l[0];
        this.Rl[1] = this.l[1];
        this.Rl[2] = this.l[2] - offset;
        this.Rl[3] = this.l[3] + offset;
        this.Rl[4] = this.l[4] - offset;
        this.Rl[5] = this.l[5] + offset;
        this.Rl[6] = this.l[6] - offset;
        this.Rl[7] = this.l[7] + offset;
        this.Rl[8] = this.l[8] - offset;
        this.Rl[9] = this.l[9] + offset;
        this.Rl[10] = this.l[10] - offset;
        this.Rl[11] = this.l[11] + offset;
        this.Rl[12] = this.l[12] - offset;
        for(let i=0; i < this.Rl.length; i++) {
            this.Rl[i] = Math.max(1, Math.floor(this.Rl[i])); // Ensure positive length
        }

        // Buffer offsets
        this.b[0] = 0;
        for (let i = 1; i < 13; i++) {
            this.b[i] = this.b[i-1] + this.l[i-1];
        }
        
        this.Rb[0] = this.b[12] + this.l[12];
        for (let i = 1; i < 13; i++) {
            this.Rb[i] = this.Rb[i-1] + this.Rl[i-1];
        }
        
        // Final sanity check on buffer sizes
        const totalSize = this.Rb[12] + this.Rl[12];
        if (totalSize > this.buffer.length) {
            console.error(`Required buffer size (${totalSize}) exceeds allocated size (${this.buffer.length}). Some settings may cause issues.`);
        }

        this.recalculateNeeded = false;
    }

    process(inputs, outputs, parameters) {
        this.recalculateCoefficients();

        const input = inputs[0];
        const output = outputs[0];
        const inputL = input[0];
        const inputR = input.length > 1 ? input[1] : input[0];
        const outputL = output[0];
        const outputR = output.length > 1 ? output[1] : output[0];

        let out = 0, Rout = 0;
        let in0, in1, in2, in3, in4, in5, in6, in7, in8, in9, in10, in11, in12;
        let out0, out1, out2, out3, out4, out5, out6, out7, out8, out9, out10, out11, out12;
        let Rin0, Rin1, Rin2, Rin3, Rin4, Rin5, Rin6, Rin7, Rin8, Rin9, Rin10, Rin11, Rin12;
        let Rout0, Rout1, Rout2, Rout3, Rout4, Rout5, Rout6, Rout7, Rout8, Rout9, Rout10, Rout11, Rout12;
        let tmp1, tmp2, Rtmp1, Rtmp2;

        for (let i = 0; i < inputL.length; i++) {
            const spl0 = inputL[i];
            const spl1 = inputR[i];

            if (this.params.slider7 === 0) { // MONO MODE
                const input = (spl0 + spl1) * 0.5;
                
                in0 = input; out0 = this.buffer[this.b[0] + this.p[0]]; this.buffer[this.b[0] + this.p[0]] = in0; this.p[0] = (this.p[0] + 1) % this.l[0];
                in1 = out0; out1 = this.buffer[this.b[1] + this.p[1]] - this.g1 * in1; this.buffer[this.b[1] + this.p[1]] = in1 + this.g1 * out1; this.p[1] = (this.p[1] + 1) % this.l[1];
                in2 = out1; out2 = this.buffer[this.b[2] + this.p[2]] - this.g2 * in2; this.buffer[this.b[2] + this.p[2]] = in2 + this.g2 * out2; this.p[2] = (this.p[2] + 1) % this.l[2];
                in3 = out2; out3 = this.buffer[this.b[3] + this.p[3]] - this.g3 * in3; this.buffer[this.b[3] + this.p[3]] = in3 + this.g3 * out3; this.p[3] = (this.p[3] + 1) % this.l[3];
                in4 = out3; out4 = this.buffer[this.b[4] + this.p[4]] - this.g4 * in4; this.buffer[this.b[4] + this.p[4]] = in4 + this.g4 * out4; this.p[4] = (this.p[4] + 1) % this.l[4];
                
                out12 = this.buffer[this.b[12] + this.p[12]];
                out8 = this.buffer[this.b[8] + this.p[8]];
                
                tmp1 = out4 + out12 * this.f;
                tmp2 = out4 + out8 * this.f;

                tmp1 -= this.t12 = tmp1 + this.d * (this.t12-tmp1);
                tmp2 -= this.t22 = tmp2 + this.d * (this.t22-tmp2);
                tmp1 = this.t1 = tmp1 + this.d2 * (this.t1-tmp1);
                tmp2 = this.t2 = tmp2 + this.d2 * (this.t2-tmp2);

                in5=tmp1; out5=this.buffer[this.b[5] + this.p[5]]-this.g5*in5; this.buffer[this.b[5] + this.p[5]]=in5+this.g5*out5; this.p[5]=(this.p[5]+1)%this.l[5];
                in6=out5; out6=this.buffer[this.b[6] + this.p[6]]; this.buffer[this.b[6] + this.p[6]]=in6; this.p[6]=(this.p[6]+1)%this.l[6];
                in7=out6; out7=this.buffer[this.b[7] + this.p[7]]-this.g7*in7; this.buffer[this.b[7] + this.p[7]]=in7+this.g7*out7; this.p[7]=(this.p[7]+1)%this.l[7];
                in8=out7; out8=this.buffer[this.b[8] + this.p[8]]; this.buffer[this.b[8] + this.p[8]]=in8; this.p[8]=(this.p[8]+1)%this.l[8];
                in9 =tmp2; out9=this.buffer[this.b[9] + this.p[9]]-this.g9*in9; this.buffer[this.b[9] + this.p[9]]=in9+this.g9*out9; this.p[9]=(this.p[9]+1)%this.l[9];
                in10=out9; out10=this.buffer[this.b[10] + this.p[10]]; this.buffer[this.b[10] + this.p[10]]=in10; this.p[10]=(this.p[10]+1)%this.l[10];
                in11=out10; out11=this.buffer[this.b[11] + this.p[11]]-this.g11*in11; this.buffer[this.b[11] + this.p[11]]=in11+this.g11*out11; this.p[11]=(this.p[11]+1)%this.l[11];
                in12=out11; out12=this.buffer[this.b[12] + this.p[12]]; this.buffer[this.b[12] + this.p[12]]=in12; this.p[12]=(this.p[12]+1)%this.l[12];

                out = out5 + out7 + out9 + out11;
                Rout = out;

            } else { // STEREO MODE
                // LEFT CHANNEL
                in0=spl0; out0=this.buffer[this.b[0]+this.p[0]]; this.buffer[this.b[0]+this.p[0]]=in0; this.p[0]=(this.p[0]+1)%this.l[0];
                in1=out0; out1=this.buffer[this.b[1]+this.p[1]]-this.g1*in1; this.buffer[this.b[1]+this.p[1]]=in1+this.g1*out1; this.p[1]=(this.p[1]+1)%this.l[1];
                in2=out1; out2=this.buffer[this.b[2]+this.p[2]]-this.g2*in2; this.buffer[this.b[2]+this.p[2]]=in2+this.g2*out2; this.p[2]=(this.p[2]+1)%this.l[2];
                in3=out2; out3=this.buffer[this.b[3]+this.p[3]]-this.g3*in3; this.buffer[this.b[3]+this.p[3]]=in3+this.g3*out3; this.p[3]=(this.p[3]+1)%this.l[3];
                in4=out3; out4=this.buffer[this.b[4]+this.p[4]]-this.g4*in4; this.buffer[this.b[4]+this.p[4]]=in4+this.g4*out4; this.p[4]=(this.p[4]+1)%this.l[4];
                
                out12 = this.buffer[this.b[12]+this.p[12]];
                out8 = this.buffer[this.b[8]+this.p[8]];
                
                tmp1 = out4 + out12 * this.f;
                tmp2 = out4 + out8 * this.f;

                tmp1 -= this.t12 = tmp1 + this.d * (this.t12 - tmp1);
                tmp2 -= this.t22 = tmp2 + this.d * (this.t22 - tmp2);
                tmp1 = this.t1 = tmp1 + this.d2 * (this.t1 - tmp1);
                tmp2 = this.t2 = tmp2 + this.d2 * (this.t2 - tmp2);

                in5=tmp1; out5=this.buffer[this.b[5]+this.p[5]]-this.g5*in5; this.buffer[this.b[5]+this.p[5]]=in5+this.g5*out5; this.p[5]=(this.p[5]+1)%this.l[5];
                in6=out5; out6=this.buffer[this.b[6]+this.p[6]]; this.buffer[this.b[6]+this.p[6]]=in6; this.p[6]=(this.p[6]+1)%this.l[6];
                in7=out6; out7=this.buffer[this.b[7]+this.p[7]]-this.g7*in7; this.buffer[this.b[7]+this.p[7]]=in7+this.g7*out7; this.p[7]=(this.p[7]+1)%this.l[7];
                in8=out7; out8=this.buffer[this.b[8]+this.p[8]]; this.buffer[this.b[8]+this.p[8]]=in8; this.p[8]=(this.p[8]+1)%this.l[8];
                in9=tmp2; out9=this.buffer[this.b[9]+this.p[9]]-this.g9*in9; this.buffer[this.b[9]+this.p[9]]=in9+this.g9*out9; this.p[9]=(this.p[9]+1)%this.l[9];
                in10=out9; out10=this.buffer[this.b[10]+this.p[10]]; this.buffer[this.b[10]+this.p[10]]=in10; this.p[10]=(this.p[10]+1)%this.l[10];
                in11=out10; out11=this.buffer[this.b[11]+this.p[11]]-this.g11*in11; this.buffer[this.b[11]+this.p[11]]=in11+this.g11*out11; this.p[11]=(this.p[11]+1)%this.l[11];
                in12=out11; out12=this.buffer[this.b[12]+this.p[12]]; this.buffer[this.b[12]+this.p[12]]=in12; this.p[12]=(this.p[12]+1)%this.l[12];
                
                out = out5 + out7 + out9 + out11;

                // RIGHT CHANNEL
                Rin0=spl1; Rout0=this.buffer[this.Rb[0]+this.Rp[0]]; this.buffer[this.Rb[0]+this.Rp[0]]=Rin0; this.Rp[0]=(this.Rp[0]+1)%this.Rl[0];
                Rin1=Rout0; Rout1=this.buffer[this.Rb[1]+this.Rp[1]]-this.g1*Rin1; this.buffer[this.Rb[1]+this.Rp[1]]=Rin1+this.g1*Rout1; this.Rp[1]=(this.Rp[1]+1)%this.Rl[1];
                Rin2=Rout1; Rout2=this.buffer[this.Rb[2]+this.Rp[2]]-this.g2*Rin2; this.buffer[this.Rb[2]+this.Rp[2]]=Rin2+this.g2*Rout2; this.Rp[2]=(this.Rp[2]+1)%this.Rl[2];
                Rin3=Rout2; Rout3=this.buffer[this.Rb[3]+this.Rp[3]]-this.g3*Rin3; this.buffer[this.Rb[3]+this.Rp[3]]=Rin3+this.g3*Rout3; this.Rp[3]=(this.Rp[3]+1)%this.Rl[3];
                Rin4=Rout3; Rout4=this.buffer[this.Rb[4]+this.Rp[4]]-this.g4*Rin4; this.buffer[this.Rb[4]+this.Rp[4]]=Rin4+this.g4*Rout4; this.Rp[4]=(this.Rp[4]+1)%this.Rl[4];

                Rout12 = this.buffer[this.Rb[12]+this.Rp[12]];
                Rout8 = this.buffer[this.Rb[8]+this.Rp[8]];

                Rtmp1 = Rout4 + Rout12 * this.f;
                Rtmp2 = Rout4 + Rout8 * this.f;

                Rtmp1 -= this.Rt12 = Rtmp1 + this.d * (this.Rt12 - Rtmp1);
                Rtmp2 -= this.Rt22 = Rtmp2 + this.d * (this.Rt22 - Rtmp2);
                Rtmp1 = this.Rt1 = Rtmp1 + this.d2 * (this.Rt1 - Rtmp1);
                Rtmp2 = this.Rt2 = Rtmp2 + this.d2 * (this.Rt2 - Rtmp2);

                Rin5=Rtmp1; Rout5=this.buffer[this.Rb[5]+this.Rp[5]]-this.g5*Rin5; this.buffer[this.Rb[5]+this.Rp[5]]=Rin5+this.g5*Rout5; this.Rp[5]=(this.Rp[5]+1)%this.Rl[5];
                Rin6=Rout5; Rout6=this.buffer[this.Rb[6]+this.Rp[6]]; this.buffer[this.Rb[6]+this.Rp[6]]=Rin6; this.Rp[6]=(this.Rp[6]+1)%this.Rl[6];
                Rin7=Rout6; Rout7=this.buffer[this.Rb[7]+this.Rp[7]]-this.g7*Rin7; this.buffer[this.Rb[7]+this.Rp[7]]=Rin7+this.g7*Rout7; this.Rp[7]=(this.Rp[7]+1)%this.Rl[7];
                Rin8=Rout7; Rout8=this.buffer[this.Rb[8]+this.Rp[8]]; this.buffer[this.Rb[8]+this.Rp[8]]=Rin8; this.Rp[8]=(this.Rp[8]+1)%this.Rl[8];
                Rin9=Rtmp2; Rout9=this.buffer[this.Rb[9]+this.Rp[9]]-this.g9*Rin9; this.buffer[this.Rb[9]+this.Rp[9]]=Rin9+this.g9*Rout9; this.Rp[9]=(this.Rp[9]+1)%this.Rl[9];
                Rin10=Rout9; Rout10=this.buffer[this.Rb[10]+this.Rp[10]]; this.buffer[this.Rb[10]+this.Rp[10]]=Rin10; this.Rp[10]=(this.Rp[10]+1)%this.Rl[10];
                Rin11=Rout10; Rout11=this.buffer[this.Rb[11]+this.Rp[11]]-this.g11*Rin11; this.buffer[this.Rb[11]+this.Rp[11]]=Rin11+this.g11*Rout11; this.Rp[11]=(this.Rp[11]+1)%this.Rl[11];
                Rin12=Rout11; Rout12=this.buffer[this.Rb[12]+this.Rp[12]]; this.buffer[this.Rb[12]+this.Rp[12]]=Rin12; this.Rp[12]=(this.Rp[12]+1)%this.Rl[12];
                
                Rout = Rout5 + Rout7 + Rout9 + Rout11;
            }

            outputL[i] = spl0 * this.dry + out * this.wet;
            outputR[i] = spl1 * this.dry + Rout * this.wet;
        }

        return true;
    }
}

registerProcessor('lexikan-processor', LexikanProcessor);