/**
 * Main Application Orchestrator & SCADA HMI Interface
 * Industrial Three-Pass Wet-Back Fire-Tube Steam Boiler
 */

window.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Subsystems
    const container = document.getElementById('viewport-container');
    const physics = new BoilerPhysics();
    const scene = new BoilerScene(container);
    const particles = new BoilerParticles(scene.scene);
    const audio = new BoilerAudio();

    // Global references for debugging & direct interactive access
    window.scene = scene;
    window.physics = physics;
    window.particles = particles;

    // Unlock Web Audio on first user interaction
    const unlockAudio = () => {
        audio.init();
        window.removeEventListener('click', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
    };
    window.addEventListener('click', unlockAudio);
    window.addEventListener('keydown', unlockAudio);

    // 2. UI Element References
    const el = {
        // Digital Readouts
        pressureBar: document.getElementById('val-pressure-bar'),
        pressurePsi: document.getElementById('val-pressure-psi'),
        waterTemp: document.getElementById('val-water-temp'),
        waterLevelMm: document.getElementById('val-water-level-mm'),
        waterLevelBar: document.getElementById('gauge-water-level-fill'),
        waterLevelIndicator: document.getElementById('water-level-indicator'),
        steamFlow: document.getElementById('val-steam-flow'),
        steamDemand: document.getElementById('val-steam-demand'),
        efficiency: document.getElementById('val-efficiency'),
        firingRateVal: document.getElementById('val-firing-rate'),
        flameTemp: document.getElementById('val-flame-temp'),
        stackTemp: document.getElementById('val-stack-temp'),
        econTemp: document.getElementById('val-econ-temp'),
        totalSteam: document.getElementById('val-total-steam'),

        // Pass Temperatures Strip
        tempPass1: document.getElementById('temp-pass1'),
        tempWetBack: document.getElementById('temp-wetback'),
        tempPass2: document.getElementById('temp-pass2'),
        tempPass3: document.getElementById('temp-pass3'),
        tempStack: document.getElementById('temp-stack'),

        // Controls
        sliderFiring: document.getElementById('slider-firing'),
        btnAutoMod: document.getElementById('btn-auto-mod'),
        fuelSelector: document.getElementById('fuel-selector'),
        sliderCrown: document.getElementById('slider-crown'),
        valCrown: document.getElementById('val-crown'),
        btnPumpAuto: document.getElementById('btn-pump-auto'),
        btnPumpOn: document.getElementById('btn-pump-on'),
        btnPumpOff: document.getElementById('btn-pump-off'),
        btnBlowdown: document.getElementById('btn-blowdown'),
        btnSafetyTest: document.getElementById('btn-safety-test'),
        btnEStop: document.getElementById('btn-estop'),
        btnResetLwco: document.getElementById('btn-reset-lwco'),

        // Alarms & Status Banners
        bannerLwco: document.getElementById('banner-lwco'),
        bannerOverpressure: document.getElementById('banner-overpressure'),
        bannerHighWater: document.getElementById('banner-high-water'),
        statusBurner: document.getElementById('status-burner'),
        statusFeedPump: document.getElementById('status-feed-pump'),
        statusSafety: document.getElementById('status-safety'),

        // 3D Visual Toggles
        toggleVectors: document.getElementById('toggle-vectors'),
        toggleBubbles: document.getElementById('toggle-bubbles'),
        toggleSteam: document.getElementById('toggle-steam'),
        toggleSound: document.getElementById('toggle-sound'),
        btnToggleTransparent: document.getElementById('btn-toggle-transparent'),
        transparentIndicator: document.getElementById('transparent-indicator'),
        transparentLabel: document.getElementById('transparent-label'),
        btnToggleExplode: document.getElementById('btn-toggle-explode'),
        explodeIndicator: document.getElementById('explode-indicator'),
        explodeLabel: document.getElementById('explode-label'),
        sliderExplode: document.getElementById('slider-explode'),
        valExplode: document.getElementById('val-explode'),
        btnToggleTheme: document.getElementById('btn-toggle-theme'),
        themeIcon: document.getElementById('theme-icon'),
        themeLabel: document.getElementById('theme-label'),

        // UI & Write-Up Panels
        mainHeader: document.getElementById('main-header'),
        panelLeft: document.getElementById('panel-left'),
        panelRight: document.getElementById('panel-right'),
        btnToggleUi: document.getElementById('btn-toggle-ui'),
        uiToggleIcon: document.getElementById('ui-toggle-icon'),
        uiToggleLabel: document.getElementById('ui-toggle-label'),

        // Inspector Card
        inspectorCard: document.getElementById('inspector-card'),
        inspectorTitle: document.getElementById('inspector-title'),
        inspectorCategory: document.getElementById('inspector-category'),
        inspectorDesc: document.getElementById('inspector-desc'),
        inspectorAsme: document.getElementById('inspector-asme'),
        inspectorTelemetry: document.getElementById('inspector-telemetry')
    };

    // 3. Setup Component Inspection Callbacks
    scene.onComponentHover = (data) => {
        if (!data || !writeUpVisible) {
            return;
        }
        showInspector(data);
    };

    scene.onComponentSelected = (data) => {
        if (data) {
            showInspector(data, true);
            audio.playSwitchClick();
        }
    };

    function showInspector(data, pin = false) {
        el.inspectorCard.classList.remove('hidden');
        el.inspectorTitle.textContent = data.name;
        el.inspectorCategory.textContent = data.category;
        el.inspectorDesc.textContent = data.description;
        el.inspectorAsme.textContent = data.asmeCode;

        // Generate contextual telemetry for the inspected component
        let telemHtml = '';
        if (data.name.includes('Furnace')) {
            telemHtml = `<span class="text-amber-400">Exit Temp:</span> ${physics.tPass1Exit.toFixed(0)} °C | <span class="text-amber-400">Heat Share:</span> ~48%`;
        } else if (data.name.includes('Wet-Back')) {
            telemHtml = `<span class="text-amber-400">Chamber Temp:</span> ${physics.tReversal.toFixed(0)} °C | <span class="text-blue-400">Water Cooled:</span> 100% Submerged`;
        } else if (data.name.includes('2nd Pass')) {
            telemHtml = `<span class="text-amber-400">Pass 2 Exit:</span> ${physics.tPass2Exit.toFixed(0)} °C | <span class="text-slate-400">Tube Count:</span> 12 Submerged`;
        } else if (data.name.includes('3rd Pass')) {
            telemHtml = `<span class="text-amber-400">Pass 3 Exit:</span> ${physics.tPass3Exit.toFixed(0)} °C | <span class="text-slate-400">Tube Count:</span> 18 Submerged`;
        } else if (data.name.includes('Crown Valve')) {
            telemHtml = `<span class="text-emerald-400">Opening:</span> ${physics.crownValveOpening.toFixed(0)}% | <span class="text-emerald-400">Mass Flow:</span> ${physics.steamDemandRate.toFixed(0)} kg/h`;
        } else if (data.name.includes('Safety Valve')) {
            telemHtml = `<span class="text-red-400">Status:</span> ${physics.safetyValveLifting ? 'POPPED / DISCHARGING' : 'SEATED & SEALED'} | <span class="text-slate-400">Set:</span> 10.5 bar`;
        } else if (data.name.includes('Economizer')) {
            telemHtml = `<span class="text-emerald-400">Feedwater Out:</span> ${physics.tFeedwaterEconOut.toFixed(0)} °C | <span class="text-amber-400">Stack Gas:</span> ${physics.tFlueStack.toFixed(0)} °C`;
        } else if (data.name.includes('Level Gauge') || data.name.includes('Conductivity')) {
            telemHtml = `<span class="text-sky-400">Waterline:</span> ${physics.waterLevelMm > 0 ? '+' : ''}${physics.waterLevelMm.toFixed(1)} mm NWWL | <span class="text-slate-400">State:</span> ${physics.lwcoTripped ? 'TRIP' : 'NORMAL'}`;
        } else {
            telemHtml = `<span class="text-slate-400">Drum Pressure:</span> ${physics.pressure.toFixed(2)} bar (${(physics.pressure * 14.5038).toFixed(1)} psi)`;
        }
        el.inspectorTelemetry.innerHTML = telemHtml;
    }

    // 4. Setup Control Event Listeners
    el.sliderFiring.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        physics.setFiringRate(val);
        el.btnAutoMod.classList.remove('bg-emerald-600', 'text-white');
        el.btnAutoMod.classList.add('bg-slate-800', 'text-slate-400');
        el.btnAutoMod.textContent = 'Auto: OFF';
    });

    el.btnAutoMod.addEventListener('click', () => {
        physics.autoModulation = !physics.autoModulation;
        audio.playSwitchClick();
        if (physics.autoModulation) {
            el.btnAutoMod.classList.add('bg-emerald-600', 'text-white');
            el.btnAutoMod.classList.remove('bg-slate-800', 'text-slate-400');
            el.btnAutoMod.textContent = 'Auto: ON';
        } else {
            el.btnAutoMod.classList.remove('bg-emerald-600', 'text-white');
            el.btnAutoMod.classList.add('bg-slate-800', 'text-slate-400');
            el.btnAutoMod.textContent = 'Auto: OFF';
        }
    });

    el.fuelSelector.addEventListener('change', (e) => {
        physics.fuelType = e.target.value;
        audio.playSwitchClick();
    });

    el.sliderCrown.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        physics.setCrownValve(val);
        el.valCrown.textContent = `${val.toFixed(0)}%`;
    });

    // Feed pump 3-position mode
    function setPumpMode(mode) {
        physics.feedPumpMode = mode;
        audio.playSwitchClick();
        el.btnPumpAuto.className = mode === 'auto' ? 'px-2 py-1 text-xs rounded bg-sky-600 text-white font-semibold' : 'px-2 py-1 text-xs rounded bg-slate-800 text-slate-400 hover:bg-slate-700';
        el.btnPumpOn.className = mode === 'manual_on' ? 'px-2 py-1 text-xs rounded bg-emerald-600 text-white font-semibold' : 'px-2 py-1 text-xs rounded bg-slate-800 text-slate-400 hover:bg-slate-700';
        el.btnPumpOff.className = mode === 'manual_off' ? 'px-2 py-1 text-xs rounded bg-red-600 text-white font-semibold' : 'px-2 py-1 text-xs rounded bg-slate-800 text-slate-400 hover:bg-slate-700';
    }
    el.btnPumpAuto.addEventListener('click', () => setPumpMode('auto'));
    el.btnPumpOn.addEventListener('click', () => setPumpMode('manual_on'));
    el.btnPumpOff.addEventListener('click', () => setPumpMode('manual_off'));

    // Blowdown momentary button
    el.btnBlowdown.addEventListener('mousedown', () => {
        physics.blowdownActive = true;
        audio.playSwitchClick();
    });
    el.btnBlowdown.addEventListener('mouseup', () => { physics.blowdownActive = false; });
    el.btnBlowdown.addEventListener('mouseleave', () => { physics.blowdownActive = false; });
    el.btnBlowdown.addEventListener('touchstart', (e) => { e.preventDefault(); physics.blowdownActive = true; audio.playSwitchClick(); });
    el.btnBlowdown.addEventListener('touchend', (e) => { e.preventDefault(); physics.blowdownActive = false; });

    // Safety Valve manual test
    el.btnSafetyTest.addEventListener('mousedown', () => {
        physics.safetyValveManualLift = true;
        audio.playSwitchClick();
    });
    el.btnSafetyTest.addEventListener('mouseup', () => { physics.safetyValveManualLift = false; });
    el.btnSafetyTest.addEventListener('mouseleave', () => { physics.safetyValveManualLift = false; });
    el.btnSafetyTest.addEventListener('touchstart', (e) => { e.preventDefault(); physics.safetyValveManualLift = true; audio.playSwitchClick(); });
    el.btnSafetyTest.addEventListener('touchend', (e) => { e.preventDefault(); physics.safetyValveManualLift = false; });

    // Emergency Stop
    el.btnEStop.addEventListener('click', () => {
        physics.triggerEmergencyStop();
        audio.playSwitchClick();
        if (physics.eStop) {
            el.btnEStop.classList.remove('bg-red-700');
            el.btnEStop.classList.add('bg-red-500', 'animate-pulse');
            el.btnEStop.textContent = 'E-STOP TRIPPED (CLICK TO RESET)';
            audio.playAlarmBeep();
        } else {
            el.btnEStop.classList.remove('bg-red-500', 'animate-pulse');
            el.btnEStop.classList.add('bg-red-700');
            el.btnEStop.textContent = 'EMERGENCY SHUTDOWN (E-STOP)';
            physics.burnerRunning = true;
        }
    });

    // Reset LWCO
    el.btnResetLwco.addEventListener('click', () => {
        physics.resetLwco();
        audio.playSwitchClick();
        if (!physics.lwcoTripped) {
            physics.burnerRunning = true;
            el.bannerLwco.classList.add('hidden');
        }
    });

    // ── Write-Up & SCADA Dashboard Visibility Controller ────────
    let writeUpVisible = true;

    function setWriteUpVisible(visible) {
        writeUpVisible = visible;
        if (visible) {
            if (el.panelLeft) {
                el.panelLeft.classList.remove('opacity-0', 'pointer-events-none', '-translate-x-12', 'hidden');
            }
            if (el.panelRight) {
                el.panelRight.classList.remove('opacity-0', 'pointer-events-none', 'translate-x-12', 'hidden');
            }
            if (el.mainHeader) {
                el.mainHeader.classList.remove('-translate-y-full', 'hidden');
            }
            if (el.uiToggleLabel) el.uiToggleLabel.textContent = 'Hide Write-Up';
            if (el.uiToggleIcon) el.uiToggleIcon.textContent = '👁️';
            if (el.btnToggleUi) {
                el.btnToggleUi.classList.remove('bg-blue-600', 'text-white');
                el.btnToggleUi.classList.add('bg-slate-800', 'text-slate-300');
            }
        } else {
            if (el.panelLeft) {
                el.panelLeft.classList.add('opacity-0', 'pointer-events-none', '-translate-x-12', 'hidden');
            }
            if (el.panelRight) {
                el.panelRight.classList.add('opacity-0', 'pointer-events-none', 'translate-x-12', 'hidden');
            }
            if (el.mainHeader) {
                el.mainHeader.classList.add('-translate-y-full', 'hidden');
            }
            if (el.inspectorCard) {
                el.inspectorCard.classList.add('hidden');
            }
            if (el.uiToggleLabel) el.uiToggleLabel.textContent = 'Show Write-Up';
            if (el.uiToggleIcon) el.uiToggleIcon.textContent = '📑';
            if (el.btnToggleUi) {
                el.btnToggleUi.classList.remove('bg-slate-800', 'text-slate-300');
                el.btnToggleUi.classList.add('bg-blue-600', 'text-white');
            }
        }
        // Notify Three.js to adjust to full viewport dimensions
        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 80);
    }

    if (el.btnToggleUi) {
        el.btnToggleUi.addEventListener('click', () => {
            audio.playSwitchClick();
            setWriteUpVisible(!writeUpVisible);
        });
    }

    // Keyboard shortcut 'H' or 'U' to toggle write-ups & panels
    window.addEventListener('keydown', (e) => {
        if (e.target.tagName !== 'INPUT' && (e.key === 'h' || e.key === 'H' || e.key === 'u' || e.key === 'U')) {
            setWriteUpVisible(!writeUpVisible);
        }
    });

    // Camera preset buttons
    document.querySelectorAll('[data-camera-preset]').forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = btn.getAttribute('data-camera-preset');
            scene.setCameraPreset(preset);
            audio.playSwitchClick();
            document.querySelectorAll('[data-camera-preset]').forEach(b => b.classList.remove('bg-blue-600', 'text-white'));
            btn.classList.add('bg-blue-600', 'text-white');

            // "the full view should only display view of the system and hiding any other write up"
            if (preset === 'fullview' || preset === 'bottom' || preset === 'fullbottom') {
                setWriteUpVisible(false);
            } else {
                setWriteUpVisible(true);
            }
        });
    });

    // Visual Toggles
    el.toggleVectors.addEventListener('change', (e) => {
        if (particles.particleSystems.vectors) {
            particles.particleSystems.vectors.points.visible = e.target.checked;
        }
    });
    el.toggleBubbles.addEventListener('change', (e) => {
        if (particles.particleSystems.bubbles) {
            particles.particleSystems.bubbles.points.visible = e.target.checked;
        }
    });
    el.toggleSteam.addEventListener('change', (e) => {
        if (particles.particleSystems.steam) {
            particles.particleSystems.steam.points.visible = e.target.checked;
        }
    });
    el.toggleSound.addEventListener('change', (e) => {
        if (audio.masterGain && audio.ctx) {
            audio.masterGain.gain.setValueAtTime(e.target.checked ? 0.4 : 0.0, audio.ctx.currentTime);
        }
    });

    // Toggle Light / Dark Studio Background Theme
    if (el.btnToggleTheme) {
        el.btnToggleTheme.addEventListener('click', () => {
            const isLight = scene.toggleStudioTheme();
            audio.playSwitchClick();
            if (isLight) {
                el.themeIcon.textContent = '☀️';
                el.themeLabel.textContent = 'Light Background';
                el.btnToggleTheme.classList.remove('bg-slate-700', 'text-amber-300');
                el.btnToggleTheme.classList.add('bg-slate-800', 'text-slate-200');
            } else {
                el.themeIcon.textContent = '🌙';
                el.themeLabel.textContent = 'Dark Background';
                el.btnToggleTheme.classList.add('bg-slate-700', 'text-amber-300');
                el.btnToggleTheme.classList.remove('bg-slate-800', 'text-slate-200');
            }
        });
    }

    // Toggle Transparent / X-Ray Shell View
    if (el.btnToggleTransparent) {
        el.btnToggleTransparent.addEventListener('click', () => {
            const isXRay = scene.toggleTransparentView();
            audio.playSwitchClick();
            if (isXRay) {
                el.btnToggleTransparent.classList.add('bg-cyan-600', 'border-cyan-200', 'shadow-cyan-400/50');
                el.btnToggleTransparent.classList.remove('bg-cyan-950');
                el.transparentIndicator.className = 'w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping';
                el.transparentLabel.textContent = 'Transparent View: ON';
            } else {
                el.btnToggleTransparent.classList.remove('bg-cyan-600', 'border-cyan-200', 'shadow-cyan-400/50');
                el.btnToggleTransparent.classList.add('bg-cyan-950');
                el.transparentIndicator.className = 'w-2.5 h-2.5 rounded-full bg-slate-500';
                el.transparentLabel.textContent = 'Transparent View';
            }
        });
    }

    // Toggle & Control 3D Exploded Assembly View
    function updateExplodeUI(factor) {
        const pct = Math.round(factor * 100);
        if (el.sliderExplode) el.sliderExplode.value = pct;
        if (el.valExplode) el.valExplode.textContent = `${pct}%`;
        if (el.btnToggleExplode) {
            if (pct > 5) {
                el.btnToggleExplode.classList.add('bg-amber-600', 'border-amber-200', 'shadow-amber-400/50');
                el.btnToggleExplode.classList.remove('bg-amber-950');
                if (el.explodeIndicator) el.explodeIndicator.className = 'w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping';
                if (el.explodeLabel) el.explodeLabel.textContent = `Exploded: ${pct}%`;
            } else {
                el.btnToggleExplode.classList.remove('bg-amber-600', 'border-amber-200', 'shadow-amber-400/50');
                el.btnToggleExplode.classList.add('bg-amber-950');
                if (el.explodeIndicator) el.explodeIndicator.className = 'w-2.5 h-2.5 rounded-full bg-slate-500';
                if (el.explodeLabel) el.explodeLabel.textContent = '💥 Exploded View';
            }
        }
    }

    scene.onExplodeChange = (factor) => {
        updateExplodeUI(factor);
    };

    if (el.btnToggleExplode) {
        el.btnToggleExplode.addEventListener('click', () => {
            audio.playSwitchClick();
            scene.toggleExplodedView();
        });
    }

    if (el.sliderExplode) {
        el.sliderExplode.addEventListener('input', (e) => {
            const factor = parseFloat(e.target.value) / 100.0;
            scene.setExplodeFactor(factor);
            updateExplodeUI(factor);
        });
    }

    // 5. Main Simulation & Animation Loop
    let lastTime = performance.now();
    let alarmTick = 0;

    function animate(currentTime) {
        requestAnimationFrame(animate);

        const dt = Math.min(0.1, (currentTime - lastTime) / 1000);
        lastTime = currentTime;

        // Step physics
        physics.update(dt);

        // Step particles (fade during exploded assembly view)
        particles.update(dt, physics, scene.explodeFactor);

        // Step 3D scene
        scene.update(dt, physics);

        // Step procedural audio
        audio.update(physics);

        // Periodic alarm sound
        alarmTick += dt;
        if (alarmTick > 1.2) {
            alarmTick = 0;
            if (physics.lwcoTripped || physics.overpressureAlarm) {
                audio.playAlarmBeep();
            }
        }

        // Update UI displays
        updateTelemetryDisplays();
    }

    function updateTelemetryDisplays() {
        // Digital Gauges
        el.pressureBar.textContent = physics.pressure.toFixed(2);
        el.pressurePsi.textContent = (physics.pressure * 14.5038).toFixed(1);
        el.waterTemp.textContent = physics.waterTemp.toFixed(1);
        el.waterLevelMm.textContent = (physics.waterLevelMm > 0 ? '+' : '') + physics.waterLevelMm.toFixed(1);
        el.steamFlow.textContent = physics.steamProductionRate.toFixed(0);
        el.steamDemand.textContent = physics.steamDemandRate.toFixed(0);
        el.efficiency.textContent = physics.thermalEfficiency.toFixed(1) + '%';
        el.flameTemp.textContent = physics.tFlame.toFixed(0);
        el.stackTemp.textContent = physics.tFlueStack.toFixed(0);
        el.econTemp.textContent = physics.tFeedwaterEconOut.toFixed(0);
        el.totalSteam.textContent = (physics.totalSteamGenerated / 1000.0).toFixed(2);

        // Firing slider sync if auto-modulating
        if (physics.autoModulation) {
            el.sliderFiring.value = physics.firingRate;
        }
        el.firingRateVal.textContent = `${physics.firingRate.toFixed(0)}%`;

        // Water level bar indicator (-80 mm to +80 mm -> 0% to 100% height)
        const levelPct = Math.max(0, Math.min(100, 50 + (physics.waterLevelMm / 160.0) * 100));
        el.waterLevelBar.style.height = `${levelPct}%`;
        el.waterLevelIndicator.style.bottom = `${levelPct}%`;

        // Pass Temperatures Strip
        el.tempPass1.textContent = `${physics.tPass1Exit.toFixed(0)}°C`;
        el.tempWetBack.textContent = `${physics.tReversal.toFixed(0)}°C`;
        el.tempPass2.textContent = `${physics.tPass2Exit.toFixed(0)}°C`;
        el.tempPass3.textContent = `${physics.tPass3Exit.toFixed(0)}°C`;
        el.tempStack.textContent = `${physics.tFlueStack.toFixed(0)}°C`;

        // Status indicators
        if (physics.flameStatus) {
            el.statusBurner.textContent = `FIRING (${physics.fuelType.toUpperCase()})`;
            el.statusBurner.className = 'font-bold text-emerald-400';
        } else if (physics.lwcoTripped) {
            el.statusBurner.textContent = 'TRIPPED (LOW WATER)';
            el.statusBurner.className = 'font-bold text-red-400 animate-pulse';
        } else if (physics.eStop) {
            el.statusBurner.textContent = 'E-STOPPED';
            el.statusBurner.className = 'font-bold text-red-400';
        } else {
            el.statusBurner.textContent = 'STANDBY';
            el.statusBurner.className = 'font-bold text-amber-400';
        }

        el.statusFeedPump.textContent = physics.feedPumpRunning ? 'RUNNING' : 'OFF';
        el.statusFeedPump.className = physics.feedPumpRunning ? 'font-bold text-emerald-400' : 'font-bold text-slate-400';

        if (physics.safetyValveLifting) {
            el.statusSafety.textContent = 'POPPED / BLOWING';
            el.statusSafety.className = 'font-bold text-red-400 animate-pulse';
        } else {
            el.statusSafety.textContent = 'SEATED (NORMAL)';
            el.statusSafety.className = 'font-bold text-slate-300';
        }

        // Alarm Banners
        if (physics.lwcoTripped) {
            el.bannerLwco.classList.remove('hidden');
        } else {
            el.bannerLwco.classList.add('hidden');
        }

        if (physics.overpressureAlarm || physics.safetyValveLifting) {
            el.bannerOverpressure.classList.remove('hidden');
        } else {
            el.bannerOverpressure.classList.add('hidden');
        }

        if (physics.highWaterAlarm) {
            el.bannerHighWater.classList.remove('hidden');
        } else {
            el.bannerHighWater.classList.add('hidden');
        }
    }

    // Default to clean Full View on initial start (hiding write-ups)
    setWriteUpVisible(false);

    // Support URL parameter navigation (e.g., ?view=bottom or ?view=fullview)
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const requestedView = urlParams.get('view') || window.location.hash.replace('#', '');
        if (requestedView) {
            const matchingBtn = document.querySelector(`[data-camera-preset="${requestedView}"]`);
            if (matchingBtn) {
                matchingBtn.click();
            } else {
                scene.setCameraPreset(requestedView);
            }
        }
    } catch (e) {
        console.warn('URL preset init error:', e);
    }

    // Start simulation loop
    requestAnimationFrame(animate);
});
