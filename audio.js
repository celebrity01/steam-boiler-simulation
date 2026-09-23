/**
 * Procedural Industrial Audio Synthesizer (Web Audio API)
 * Generates combustion roar, steam flow hiss, safety relief blowoff, feed pump motor, and alarms.
 */

class BoilerAudio {
    constructor() {
        this.ctx = null;
        this.enabled = false;
        this.burnerGain = null;
        this.steamGain = null;
        this.pumpGain = null;
        this.safetyGain = null;
    }

    init() {
        if (this.ctx) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            this.buildAudioGraph();
            this.enabled = true;
        } catch (e) {
            console.warn('Web Audio not supported or blocked:', e);
        }
    }

    buildAudioGraph() {
        if (!this.ctx) return;

        // Master Volume
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);

        // 1. Burner Combustion Roar (Filtered Noise + Low Drone)
        this.initBurnerRoar();

        // 2. Steam Flow Hiss
        this.initSteamHiss();

        // 3. Feedwater Pump Electric Motor Hum
        this.initPumpHum();

        // 4. Safety Valve Blowdown Burst
        this.initSafetyDischarge();
    }

    // Helper: Create continuous white/pink noise buffer
    createNoiseBuffer(seconds = 3) {
        const bufferSize = this.ctx.sampleRate * seconds;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = buffer.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            // Pink noise filtering
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            b3 = 0.86650 * b3 + white * 0.3104856;
            b4 = 0.55000 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.0168980;
            output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
            b6 = white * 0.115926;
        }
        return buffer;
    }

    initBurnerRoar() {
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.createNoiseBuffer(4);
        noise.loop = true;

        this.burnerFilter = this.ctx.createBiquadFilter();
        this.burnerFilter.type = 'lowpass';
        this.burnerFilter.frequency.setValueAtTime(140, this.ctx.currentTime);
        this.burnerFilter.Q.setValueAtTime(3.0, this.ctx.currentTime);

        this.burnerGain = this.ctx.createGain();
        this.burnerGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

        noise.connect(this.burnerFilter);
        this.burnerFilter.connect(this.burnerGain);
        this.burnerGain.connect(this.masterGain);
        noise.start();

        // 60Hz hum
        this.burnerHumOsc = this.ctx.createOscillator();
        this.burnerHumOsc.type = 'triangle';
        this.burnerHumOsc.frequency.setValueAtTime(65, this.ctx.currentTime);
        const humGain = this.ctx.createGain();
        humGain.gain.setValueAtTime(0.04, this.ctx.currentTime);
        this.burnerHumOsc.connect(humGain);
        humGain.connect(this.burnerGain);
        this.burnerHumOsc.start();
    }

    initSteamHiss() {
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.createNoiseBuffer(3);
        noise.loop = true;

        this.steamFilter = this.ctx.createBiquadFilter();
        this.steamFilter.type = 'bandpass';
        this.steamFilter.frequency.setValueAtTime(1800, this.ctx.currentTime);
        this.steamFilter.Q.setValueAtTime(1.5, this.ctx.currentTime);

        this.steamGain = this.ctx.createGain();
        this.steamGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

        noise.connect(this.steamFilter);
        this.steamFilter.connect(this.steamGain);
        this.steamGain.connect(this.masterGain);
        noise.start();
    }

    initPumpHum() {
        this.pumpOsc = this.ctx.createOscillator();
        this.pumpOsc.type = 'sawtooth';
        this.pumpOsc.frequency.setValueAtTime(120, this.ctx.currentTime);

        const pumpFilter = this.ctx.createBiquadFilter();
        pumpFilter.type = 'lowpass';
        pumpFilter.frequency.setValueAtTime(220, this.ctx.currentTime);

        this.pumpGain = this.ctx.createGain();
        this.pumpGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

        this.pumpOsc.connect(pumpFilter);
        pumpFilter.connect(this.pumpGain);
        this.pumpGain.connect(this.masterGain);
        this.pumpOsc.start();
    }

    initSafetyDischarge() {
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.createNoiseBuffer(3);
        noise.loop = true;

        this.safetyFilter = this.ctx.createBiquadFilter();
        this.safetyFilter.type = 'highpass';
        this.safetyFilter.frequency.setValueAtTime(800, this.ctx.currentTime);

        this.safetyGain = this.ctx.createGain();
        this.safetyGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

        noise.connect(this.safetyFilter);
        this.safetyFilter.connect(this.safetyGain);
        this.safetyGain.connect(this.masterGain);
        noise.start();
    }

    playSwitchClick() {
        if (!this.enabled || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.frequency.setValueAtTime(800, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.04);
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.05);
    }

    playAlarmBeep() {
        if (!this.enabled || !this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(960, now);
        osc.frequency.setValueAtTime(740, now + 0.12);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.25);
    }

    update(physics) {
        if (!this.enabled || !this.ctx) return;
        const t = this.ctx.currentTime;

        // Burner sound modulation
        if (this.burnerGain && this.burnerFilter) {
            if (physics.flameStatus) {
                const targetGain = 0.05 + (physics.firingRate / 100.0) * 0.25;
                const targetCutoff = 100 + (physics.firingRate / 100.0) * 220;
                this.burnerGain.gain.setTargetAtTime(targetGain, t, 0.1);
                this.burnerFilter.frequency.setTargetAtTime(targetCutoff, t, 0.1);
            } else {
                this.burnerGain.gain.setTargetAtTime(0.0, t, 0.2);
            }
        }

        // Steam flow hiss
        if (this.steamGain) {
            const flowFactor = Math.min(1.0, physics.steamDemandRate / 5000.0);
            const targetGain = flowFactor * 0.18;
            this.steamGain.gain.setTargetAtTime(targetGain, t, 0.1);
        }

        // Feed pump motor hum
        if (this.pumpGain) {
            const targetGain = physics.feedPumpRunning ? 0.06 : 0.0;
            this.pumpGain.gain.setTargetAtTime(targetGain, t, 0.1);
        }

        // Safety valve blowoff
        if (this.safetyGain) {
            const targetGain = physics.safetyValveLifting ? 0.45 : 0.0;
            this.safetyGain.gain.setTargetAtTime(targetGain, t, 0.05);
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = BoilerAudio;
}
