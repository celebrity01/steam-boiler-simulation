/**
 * Thermodynamic and Hydraulic Physics Engine
 * Industrial Three-Pass Wet-Back Fire-Tube Steam Boiler
 */

class BoilerPhysics {
    constructor() {
        this.reset();
    }

    reset() {
        // Physical Specifications
        this.totalVolume = 10.0; // m³ total drum internal volume
        this.waterVolumeNominal = 6.6; // m³ (approx 66% full)
        this.designPressure = 12.0; // bar gauge
        this.safetyValveSetPressure = 10.5; // bar gauge pop setpoint
        this.safetyValveReseatPressure = 9.8; // bar gauge reseat
        this.maxBurnerPower = 3500; // kW thermal at 100% firing rate

        // State Variables
        this.pressure = 8.5; // bar gauge (initial warm operating pressure)
        this.waterMass = 6200; // kg of water
        this.waterTemp = 175.0; // °C
        this.steamMass = 18.5; // kg
        this.waterLevelMm = 0.0; // Normal Working Water Level (NWWL = 0 mm, range -80 to +80 mm)
        this.waterLevelPct = 66.0; // % of total shell height

        // Combustion & Heat Transfer
        this.firingRate = 65.0; // 0% to 100%
        this.fuelType = 'gas'; // 'gas' or 'oil'
        this.burnerRunning = true;
        this.flameStatus = true;
        this.autoModulation = true;
        this.targetPressure = 9.0; // bar gauge setpoint for auto modulation

        // Temperatures (°C)
        this.tFlame = 1250; // Core flame temperature
        this.tPass1Exit = 860; // Exit of corrugated furnace tube
        this.tReversal = 810; // Wet-back chamber
        this.tPass2Exit = 420; // Exit of 2nd pass into front smoke box
        this.tSmokeBox = 400; // Front smoke box
        this.tPass3Exit = 220; // Exit of 3rd pass into rear flue
        this.tFluePreEcon = 210; // Flue gas before economizer
        this.tFlueStack = 135; // Flue gas exiting stack after economizer
        this.tFeedwaterIn = 60; // Inlet feedwater temp (°C)
        this.tFeedwaterEconOut = 92; // Preheated feedwater temp (°C)
        this.thermalEfficiency = 89.4; // %

        // Mass Flows (kg/h)
        this.steamProductionRate = 3200; // kg/h
        this.steamDemandRate = 3200; // kg/h
        this.feedwaterFlowRate = 3200; // kg/h
        this.blowdownFlowRate = 0; // kg/h

        // Actuators & Controls
        this.crownValveOpening = 55.0; // 0% to 100%
        this.feedPumpMode = 'auto'; // 'auto', 'manual_on', 'manual_off'
        this.feedPumpRunning = true;
        this.feedPumpCapacity = 6000; // kg/h max flow
        this.blowdownActive = false;
        this.safetyValveManualLift = false;
        this.safetyValveLifting = false;

        // Safety Interlocks
        this.lwcoTripped = false; // Low Water Cutoff Lockout
        this.highWaterAlarm = false;
        this.lowWaterAlarm = false;
        this.overpressureAlarm = false;
        this.eStop = false;

        // Accumulators for statistics
        this.totalSteamGenerated = 0; // kg
        this.totalFuelConsumed = 0; // m³ or liters
        this.operatingSeconds = 0;
    }

    // Saturation temperature approximation for saturated steam (bar gauge to °C)
    getSaturationTemp(pBarG) {
        const pAbs = Math.max(0.5, pBarG + 1.013);
        // Antoine equation correlation for water saturation 1 - 25 bar
        return 100 + 28.5 * Math.pow(Math.max(0.01, pAbs - 1.013), 0.655);
    }

    // Latent heat of vaporization h_fg (kJ/kg) as a function of pressure
    getLatentHeat(pBarG) {
        return Math.max(1900, 2257 - 26.5 * pBarG);
    }

    update(dt) {
        this.operatingSeconds += dt;

        // 1. Handle Safety Interlocks & Trips
        if (this.eStop) {
            this.burnerRunning = false;
        }

        // Low Water Cutoff Check
        if (this.waterLevelMm <= -50.0) {
            this.lwcoTripped = true;
            this.burnerRunning = false;
        }

        // Alarm states
        this.lowWaterAlarm = this.waterLevelMm <= -30.0;
        this.highWaterAlarm = this.waterLevelMm >= 50.0;
        this.overpressureAlarm = this.pressure >= 10.2;

        // Auto burner modulation logic
        if (this.autoModulation && this.burnerRunning && !this.lwcoTripped && !this.eStop) {
            const pError = this.targetPressure - this.pressure;
            const targetFiring = 50.0 + pError * 35.0;
            const clampedFiring = Math.max(20.0, Math.min(100.0, targetFiring));
            // Slew rate limit burner modulation
            this.firingRate += (clampedFiring - this.firingRate) * Math.min(1.0, dt * 0.8);
        }

        // 2. Combustion & Flame Power
        let activePower = 0;
        if (this.burnerRunning && !this.lwcoTripped && !this.eStop) {
            this.flameStatus = true;
            const fuelFactor = this.fuelType === 'gas' ? 1.0 : 1.05; // Oil slightly higher radiant emissivity
            activePower = (this.firingRate / 100.0) * this.maxBurnerPower * fuelFactor;
        } else {
            this.flameStatus = false;
            activePower = 0;
            // Cooldown firing rate visual
            this.firingRate = Math.max(0, this.firingRate - dt * 25.0);
        }

        // 3. Flue Gas Temperatures along Passes
        if (this.flameStatus) {
            const loadRatio = this.firingRate / 100.0;
            this.tFlame = 950 + 400 * loadRatio;
            this.tPass1Exit = 650 + 260 * loadRatio;
            this.tReversal = 600 + 240 * loadRatio;
            this.tPass2Exit = 320 + 130 * loadRatio;
            this.tSmokeBox = 300 + 120 * loadRatio;
            this.tPass3Exit = 170 + 60 * loadRatio;
            this.tFluePreEcon = this.tPass3Exit - 10;
            this.tFlueStack = 100 + 45 * loadRatio;
            this.thermalEfficiency = 88.0 + 3.5 * (1.0 - loadRatio * 0.3); // High turn-down efficiency with econ
        } else {
            // Decay toward ambient / water temp
            this.tFlame += (this.waterTemp - this.tFlame) * Math.min(1.0, dt * 0.2);
            this.tPass1Exit += (this.waterTemp - this.tPass1Exit) * Math.min(1.0, dt * 0.2);
            this.tReversal += (this.waterTemp - this.tReversal) * Math.min(1.0, dt * 0.2);
            this.tPass2Exit += (this.waterTemp - this.tPass2Exit) * Math.min(1.0, dt * 0.2);
            this.tSmokeBox += (this.waterTemp - this.tSmokeBox) * Math.min(1.0, dt * 0.2);
            this.tPass3Exit += (this.waterTemp - this.tPass3Exit) * Math.min(1.0, dt * 0.2);
            this.tFlueStack += (40 - this.tFlueStack) * Math.min(1.0, dt * 0.1);
            this.thermalEfficiency = 0;
        }

        // 4. Heat Transfer to Water & Steam Generation
        const tSat = this.getSaturationTemp(this.pressure);
        const hFg = this.getLatentHeat(this.pressure); // kJ/kg

        // Useful heat absorbed by boiler water (approx 85% of burner power)
        const usefulHeatKw = activePower * 0.85;

        // If water is below saturation, heat warms water; if at saturation, evaporates steam
        let evapRateKgS = 0;
        if (this.waterTemp < tSat - 0.2) {
            // Sensible heating of water mass
            const specificHeatWater = 4.2; // kJ/kg·K
            const deltaT = (usefulHeatKw / (this.waterMass * specificHeatWater)) * dt;
            this.waterTemp += deltaT;
            evapRateKgS = 0.05 * (usefulHeatKw / hFg); // Minor surface evaporation
        } else {
            this.waterTemp = tSat;
            // Nucleate boiling and steam generation
            evapRateKgS = usefulHeatKw / hFg; // kg/s
        }

        this.steamProductionRate = evapRateKgS * 3600; // kg/h

        // 5. Steam Outflow through Crown Valve
        // Flow is proportional to valve opening and sqrt of pressure difference to header (assume header at 6 bar)
        const headerPressure = 6.0;
        const deltaP = Math.max(0, this.pressure - headerPressure);
        const maxValveFlow = 6500; // kg/h at full open and 4 bar dP
        const valveFraction = this.crownValveOpening / 100.0;
        const actualDemandKgH = valveFraction * maxValveFlow * Math.sqrt(deltaP / 4.0);
        this.steamDemandRate = actualDemandKgH;
        const steamOutflowKgS = actualDemandKgH / 3600;

        // 6. Safety Relief Valve Operation
        let safetyDischargeKgS = 0;
        if (this.safetyValveManualLift || this.pressure >= this.safetyValveSetPressure) {
            this.safetyValveLifting = true;
        } else if (this.safetyValveLifting && this.pressure <= this.safetyValveReseatPressure && !this.safetyValveManualLift) {
            this.safetyValveLifting = false;
        }

        if (this.safetyValveLifting) {
            // Sized for 100% MCR discharge
            safetyDischargeKgS = (this.maxBurnerPower * 0.85 / hFg) * 1.25; // 125% of max steam capacity
        }

        // 7. Pressure Dynamics in Steam Space
        // Net steam mass rate = evaporation - outflow - safety vent
        const netSteamRateKgS = evapRateKgS - steamOutflowKgS - safetyDischargeKgS;
        // Steam drum compliance: dP/dt = netRate / (V_steam * dRho/dP)
        const pressureDerivative = netSteamRateKgS * 0.038;
        this.pressure = Math.max(0.1, this.pressure + pressureDerivative * dt);

        // 8. Feedwater Pump & Level Control
        let feedFlowKgS = 0;
        if (this.feedPumpMode === 'auto') {
            const levelErrorMm = 0.0 - this.waterLevelMm; // target NWWL is 0 mm
            if (levelErrorMm > 2.0) {
                this.feedPumpRunning = true;
                const flowFraction = Math.min(1.0, Math.max(0.2, (levelErrorMm + 15) / 35.0));
                feedFlowKgS = (this.feedPumpCapacity / 3600) * flowFraction;
            } else if (levelErrorMm < -8.0) {
                this.feedPumpRunning = false;
                feedFlowKgS = 0;
            } else {
                this.feedPumpRunning = true;
                feedFlowKgS = evapRateKgS;
            }
        } else if (this.feedPumpMode === 'manual_on') {
            this.feedPumpRunning = true;
            feedFlowKgS = this.feedPumpCapacity / 3600;
        } else {
            this.feedPumpRunning = false;
            feedFlowKgS = 0;
        }
        this.feedwaterFlowRate = feedFlowKgS * 3600;

        // 9. Bottom Blowdown Flow
        let blowdownKgS = 0;
        if (this.blowdownActive) {
            blowdownKgS = 18.0; // 18 kg/s heavy sludge purge
            this.blowdownFlowRate = blowdownKgS * 3600;
            this.pressure = Math.max(0.1, this.pressure - dt * 0.12);
        } else {
            this.blowdownFlowRate = 0;
        }

        // 10. Water Mass & Level Calculation
        const netWaterChangeKg = (feedFlowKgS - evapRateKgS - blowdownKgS) * dt;
        this.waterMass += netWaterChangeKg;

        const waterDensity = 1000 - 0.55 * (this.waterTemp - 20);
        const actualWaterVol = this.waterMass / waterDensity;
        const surfaceAreaM2 = 8.5;
        const deltaVolM3 = actualWaterVol - this.waterVolumeNominal;
        const swellingMm = (this.firingRate / 100.0) * (this.pressure / 10.0) * 12.0;

        this.waterLevelMm = (deltaVolM3 / surfaceAreaM2) * 1000.0 + swellingMm;
        this.waterLevelMm = Math.max(-95.0, Math.min(95.0, this.waterLevelMm));
        this.waterLevelPct = 66.0 + (this.waterLevelMm / 350.0) * 34.0;

        // Cumulative totals
        this.totalSteamGenerated += evapRateKgS * dt;
        if (this.flameStatus) {
            this.totalFuelConsumed += (this.firingRate / 100.0) * (this.fuelType === 'gas' ? 0.08 : 0.075) * dt;
        }
    }

    setFiringRate(val) {
        this.firingRate = Math.max(0, Math.min(100, val));
        this.autoModulation = false;
    }

    setCrownValve(val) {
        this.crownValveOpening = Math.max(0, Math.min(100, val));
    }

    setTargetPressure(val) {
        this.targetPressure = Math.max(3.0, Math.min(11.5, val));
    }

    toggleBurner() {
        if (this.lwcoTripped) return;
        this.burnerRunning = !this.burnerRunning;
    }

    resetLwco() {
        if (this.waterLevelMm > -40.0) {
            this.lwcoTripped = false;
        }
    }

    triggerEmergencyStop() {
        this.eStop = !this.eStop;
        if (this.eStop) {
            this.burnerRunning = false;
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = BoilerPhysics;
}
