/**
 * 3D Particle Subsystem for Industrial Three-Pass Wet-Back Boiler
 * Includes: Burner Flame, Flue Gas 3-Pass Vectors, Ebullition Bubbles, Saturated Steam, Safety Discharge
 */

class BoilerParticles {
    constructor(scene) {
        this.scene = scene;
        this.particleSystems = {};
        this.initFlame();
        this.initFlueGasVectors();
        this.initBoilingBubbles();
        this.initSteamCushion();
        this.initSafetyVent();
    }

    // Helper to generate high-resolution soft circular particle sprite texture via canvas
    createParticleTexture(type = 'glow') {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        if (type === 'glow') {
            grad.addColorStop(0,    'rgba(255, 255, 255, 1.0)');
            grad.addColorStop(0.18, 'rgba(255, 220, 100, 0.95)');
            grad.addColorStop(0.42, 'rgba(255, 120, 20, 0.65)');
            grad.addColorStop(0.72, 'rgba(230, 45, 0, 0.22)');
            grad.addColorStop(1,    'rgba(0, 0, 0, 0)');
        } else if (type === 'bubble') {
            grad.addColorStop(0,    'rgba(255, 255, 255, 0.95)');
            grad.addColorStop(0.35, 'rgba(210, 235, 255, 0.7)');
            grad.addColorStop(0.75, 'rgba(100, 185, 255, 0.85)');
            grad.addColorStop(0.92, 'rgba(56, 189, 248, 0.5)');
            grad.addColorStop(1,    'rgba(0, 0, 0, 0)');
        } else if (type === 'steam') {
            grad.addColorStop(0,    'rgba(255, 255, 255, 0.75)');
            grad.addColorStop(0.28, 'rgba(240, 248, 255, 0.55)');
            grad.addColorStop(0.60, 'rgba(215, 230, 250, 0.25)');
            grad.addColorStop(0.85, 'rgba(190, 215, 245, 0.08)');
            grad.addColorStop(1,    'rgba(0, 0, 0, 0)');
        }
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 128, 128);

        const texture = new THREE.CanvasTexture(canvas);
        texture.generateMipmaps = true;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        return texture;
    }

    // 1. Primary Burner Flame (Inside Corrugated Furnace Pass 1)
    initFlame() {
        const count = 1200;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const sizes = new Float32Array(count);
        const velocities = new Float32Array(count * 3);
        const lifetimes = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            const z = 1.8 - Math.random() * 2.8; // Along Pass 1 axis
            const angle = Math.random() * Math.PI * 2;
            const radius = (0.05 + (1.8 - z) * 0.18) * Math.random();
            const x = Math.cos(angle) * radius;
            const y = -0.45 + Math.sin(angle) * radius;

            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;

            velocities[i * 3] = (Math.random() - 0.5) * 0.3;
            velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.3 + 0.1;
            velocities[i * 3 + 2] = -1.5 - Math.random() * 2.0; // Moving rearward

            lifetimes[i] = Math.random();
            sizes[i] = 12 + Math.random() * 20;

            colors[i * 3] = 1.0;
            colors[i * 3 + 1] = 0.6;
            colors[i * 3 + 2] = 0.1;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        const material = new THREE.PointsMaterial({
            size: 0.28,
            map: this.createParticleTexture('glow'),
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            vertexColors: true
        });

        const points = new THREE.Points(geometry, material);
        this.scene.add(points);

        this.particleSystems.flame = {
            points,
            count,
            positions,
            colors,
            sizes,
            velocities,
            lifetimes
        };
    }

    // 2. 3-Pass Flue Gas Velocity Vectors (Tracing Pass 1 -> Reversal -> Pass 2 -> Front Box -> Pass 3 -> Economizer)
    initFlueGasVectors() {
        const count = 1800;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const phases = new Float32Array(count); // 0.0 to 1.0 along the full trajectory
        const speeds = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            phases[i] = Math.random();
            speeds[i] = 0.12 + Math.random() * 0.15;
            this.setVectorParticleAtPhase(positions, colors, i, phases[i], 'gas');
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: 0.18,
            map: this.createParticleTexture('glow'),
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            vertexColors: true
        });

        const points = new THREE.Points(geometry, material);
        this.scene.add(points);

        this.particleSystems.vectors = {
            points,
            count,
            positions,
            colors,
            phases,
            speeds
        };
    }

    // Helper: calculate 3D coordinate and color along the 3-pass path
    setVectorParticleAtPhase(positions, colors, idx, p, fuelType) {
        let x = 0, y = 0, z = 0;
        let r = 1, g = 0.5, b = 0.1;

        if (p < 0.28) {
            // Pass 1: Furnace Tube (Front z=+1.8 to Rear z=-1.7, at center y=-0.45, x=0)
            const subP = p / 0.28;
            z = 1.8 - subP * 3.5;
            const spread = 0.35 * (0.3 + subP * 0.7);
            const ang = (idx * 1.618) % (Math.PI * 2);
            x = Math.cos(ang) * spread * 0.8;
            y = -0.45 + Math.sin(ang) * spread * 0.8;
            // Hot orange/yellow
            r = 1.0;
            g = 0.75 - subP * 0.25;
            b = 0.15;
        } else if (p < 0.42) {
            // Wet-Back Reversal Chamber: Turning 180 deg around at z=-1.8 to -2.3
            const subP = (p - 0.28) / 0.14;
            const turnAngle = subP * Math.PI; // 0 to PI
            const radius = 0.45;
            z = -1.75 - Math.sin(turnAngle) * 0.5;
            // Turning laterally and upward to Pass 2 entrance
            x = Math.sin(turnAngle) * 0.4;
            y = -0.45 + subP * 0.4;
            r = 1.0;
            g = 0.45;
            b = 0.1;
        } else if (p < 0.65) {
            // Pass 2: Lower Fire Tubes (Rear z=-1.7 to Front z=+1.8, y=-0.15, offset x)
            const subP = (p - 0.42) / 0.23;
            z = -1.7 + subP * 3.5;
            // Distributed across fire tubes
            const tubeIdx = idx % 12;
            const tubeRow = Math.floor(tubeIdx / 4);
            const tubeCol = tubeIdx % 4;
            x = -0.65 + tubeCol * 0.2 + (idx % 2 === 0 ? 0.9 : 0);
            y = -0.25 + tubeRow * 0.18;
            r = 0.95;
            g = 0.4;
            b = 0.05;
        } else if (p < 0.75) {
            // Front Smoke Box: Turning upward into Pass 3 (z=+1.8 to +2.2)
            const subP = (p - 0.65) / 0.10;
            const turnAngle = subP * Math.PI;
            z = 1.8 + Math.sin(turnAngle) * 0.35;
            x = (Math.random() - 0.5) * 0.7;
            y = -0.1 + subP * 0.5;
            r = 0.85;
            g = 0.35;
            b = 0.05;
        } else if (p < 0.90) {
            // Pass 3: Upper Fire Tubes (Front z=+1.8 to Rear z=-1.7, y=+0.4)
            const subP = (p - 0.75) / 0.15;
            z = 1.8 - subP * 3.5;
            const tubeCol = (idx * 3) % 8;
            x = -0.55 + tubeCol * 0.15;
            y = 0.35 + ((idx % 3) - 1) * 0.12;
            r = 0.75;
            g = 0.3;
            b = 0.1;
        } else {
            // Exhaust Chimney & Economizer Coil: Rising up through stack at z=-1.75, y=0.8 to 2.8
            const subP = (p - 0.90) / 0.10;
            const spiralAngle = subP * Math.PI * 8;
            const spiralR = 0.22;
            x = -0.0 + Math.cos(spiralAngle) * spiralR;
            z = -1.75 + Math.sin(spiralAngle) * spiralR;
            y = 0.9 + subP * 2.2;
            // Cooler exhaust smoke color
            r = 0.6 - subP * 0.3;
            g = 0.5 - subP * 0.25;
            b = 0.45;
        }

        positions[idx * 3] = x;
        positions[idx * 3 + 1] = y;
        positions[idx * 3 + 2] = z;

        colors[idx * 3] = r;
        colors[idx * 3 + 1] = g;
        colors[idx * 3 + 2] = b;
    }

    // 3. Nucleate Boiling Bubbles (Rising in Water Volume)
    initBoilingBubbles() {
        const count = 2200;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const velocities = new Float32Array(count * 3);
        const sizes = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            this.resetBubble(positions, velocities, sizes, i, true);
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        const material = new THREE.PointsMaterial({
            size: 0.08,
            map: this.createParticleTexture('bubble'),
            transparent: true,
            opacity: 0.85,
            blending: THREE.NormalBlending,
            depthWrite: false
        });

        const points = new THREE.Points(geometry, material);
        this.scene.add(points);

        this.particleSystems.bubbles = {
            points,
            count,
            positions,
            velocities,
            sizes
        };
    }

    resetBubble(positions, velocities, sizes, idx, initial = false) {
        // Spawn around furnace tube and fire tubes
        const z = -1.7 + Math.random() * 3.4;
        const angle = Math.random() * Math.PI * 2;
        const r = 0.45 + Math.random() * 0.55;
        const x = Math.cos(angle) * r;
        const minY = -0.9;
        const maxY = 0.2; // approx nominal water level
        const y = initial ? (minY + Math.random() * (maxY - minY)) : minY + Math.random() * 0.3;

        positions[idx * 3] = x;
        positions[idx * 3 + 1] = y;
        positions[idx * 3 + 2] = z;

        velocities[idx * 3] = (Math.random() - 0.5) * 0.08;
        velocities[idx * 3 + 1] = 0.3 + Math.random() * 0.5; // Upward buoyant velocity
        velocities[idx * 3 + 2] = (Math.random() - 0.5) * 0.05;

        sizes[idx] = 6 + Math.random() * 12;
    }

    // 4. Saturated Steam Mist (Upper Drum Steam Space)
    initSteamCushion() {
        const count = 900;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const velocities = new Float32Array(count * 3);
        const opacities = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            this.resetSteamParticle(positions, velocities, opacities, i, true);
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            size: 0.32,
            map: this.createParticleTexture('steam'),
            transparent: true,
            opacity: 0.35,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            color: 0xe8f0f8
        });

        const points = new THREE.Points(geometry, material);
        this.scene.add(points);

        this.particleSystems.steam = {
            points,
            count,
            positions,
            velocities,
            opacities
        };
    }

    resetSteamParticle(positions, velocities, opacities, idx, initial = false) {
        const z = -1.7 + Math.random() * 3.4;
        const r = 0.9 * Math.random();
        const angle = Math.PI * 0.15 + Math.random() * (Math.PI * 0.7); // Upper quadrant
        const x = (Math.random() - 0.5) * 1.5;
        const y = 0.25 + Math.random() * 0.75;

        positions[idx * 3] = x;
        positions[idx * 3 + 1] = y;
        positions[idx * 3 + 2] = z;

        // Gentle rolling circulation in steam space toward central crown valve at (x=0, y=1.2, z=0)
        velocities[idx * 3] = (0 - x) * 0.15 + (Math.random() - 0.5) * 0.1;
        velocities[idx * 3 + 1] = (Math.random() - 0.5) * 0.08;
        velocities[idx * 3 + 2] = (0 - z) * 0.15 + (Math.random() - 0.5) * 0.1;

        opacities[idx] = 0.2 + Math.random() * 0.3;
    }

    // 5. Safety Valve Discharge Plumes (Twin Spring Safety Valves)
    initSafetyVent() {
        const count = 400;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const velocities = new Float32Array(count * 3);
        const sizes = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            positions[i * 3] = 0;
            positions[i * 3 + 1] = -100; // Hidden initially
            positions[i * 3 + 2] = 0;
            velocities[i * 3] = 0;
            velocities[i * 3 + 1] = 0;
            velocities[i * 3 + 2] = 0;
            sizes[i] = 10;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            size: 0.3,
            map: this.createParticleTexture('steam'),
            transparent: true,
            opacity: 0.65,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            color: 0xffffff
        });

        const points = new THREE.Points(geometry, material);
        this.scene.add(points);

        this.particleSystems.safety = {
            points,
            count,
            positions,
            velocities,
            sizes
        };
    }

    update(dt, physics, explodeFactor = 0) {
        // Fade buoyant bubbles and steam cushion during exploded assembly view
        const expFade = Math.max(0, 1.0 - explodeFactor * 0.95);
        if (this.particleSystems.bubbles) {
            this.particleSystems.bubbles.points.material.opacity = 0.85 * expFade;
        }
        if (this.particleSystems.steam) {
            this.particleSystems.steam.points.material.opacity = 0.70 * expFade;
        }

        // 1. Update Flame
        const flame = this.particleSystems.flame;
        if (flame) {
            const firing = physics.flameStatus ? (physics.firingRate / 100.0) : 0;
            flame.points.visible = firing > 0.01;

            if (flame.points.visible) {
                const pos = flame.positions;
                const col = flame.colors;
                const vel = flame.velocities;

                for (let i = 0; i < flame.count; i++) {
                    pos[i * 3] += vel[i * 3] * dt * (0.8 + firing * 0.6);
                    pos[i * 3 + 1] += vel[i * 3 + 1] * dt * (0.8 + firing * 0.6);
                    pos[i * 3 + 2] += vel[i * 3 + 2] * dt * (0.8 + firing * 0.6);

                    // Reset when reaching rear of Pass 1
                    if (pos[i * 3 + 2] < -1.1 || Math.abs(pos[i * 3]) > 0.45) {
                        pos[i * 3 + 2] = 1.75;
                        const ang = Math.random() * Math.PI * 2;
                        const rad = 0.08 * Math.random();
                        pos[i * 3] = Math.cos(ang) * rad;
                        pos[i * 3 + 1] = -0.45 + Math.sin(ang) * rad;
                    }

                    // Gas vs Oil flame colors
                    if (physics.fuelType === 'gas') {
                        // Blue-tinged core transitioning to luminous orange
                        const dist = (1.75 - pos[i * 3 + 2]);
                        if (dist < 0.4) {
                            col[i * 3] = 0.4;
                            col[i * 3 + 1] = 0.7;
                            col[i * 3 + 2] = 1.0; // Blue root
                        } else {
                            col[i * 3] = 1.0;
                            col[i * 3 + 1] = 0.65;
                            col[i * 3 + 2] = 0.1;
                        }
                    } else {
                        // Heavy oil: brilliant radiant golden yellow
                        col[i * 3] = 1.0;
                        col[i * 3 + 1] = 0.85;
                        col[i * 3 + 2] = 0.2;
                    }
                }
                flame.points.geometry.attributes.position.needsUpdate = true;
                flame.points.geometry.attributes.color.needsUpdate = true;
            }
        }

        // 2. Update Flue Gas Vectors
        const vec = this.particleSystems.vectors;
        if (vec) {
            vec.points.visible = physics.flameStatus || physics.tPass1Exit > 100;
            if (vec.points.visible) {
                const pos = vec.positions;
                const col = vec.colors;
                const phases = vec.phases;
                const speeds = vec.speeds;
                const speedMult = 0.4 + (physics.firingRate / 100.0) * 0.8;

                for (let i = 0; i < vec.count; i++) {
                    phases[i] += speeds[i] * dt * speedMult;
                    if (phases[i] > 1.0) phases[i] -= 1.0;
                    this.setVectorParticleAtPhase(pos, col, i, phases[i], physics.fuelType);
                }
                vec.points.geometry.attributes.position.needsUpdate = true;
                vec.points.geometry.attributes.color.needsUpdate = true;
            }
        }

        // 3. Update Boiling Bubbles
        const bub = this.particleSystems.bubbles;
        if (bub) {
            const boilingIntensity = (physics.steamProductionRate / 4000.0);
            const pos = bub.positions;
            const vel = bub.velocities;
            const waterLevelY = -0.15 + (physics.waterLevelMm / 1000.0) * 1.5;

            bub.points.material.opacity = Math.min(0.9, 0.2 + boilingIntensity * 0.7);

            for (let i = 0; i < bub.count; i++) {
                pos[i * 3] += vel[i * 3] * dt;
                pos[i * 3 + 1] += vel[i * 3 + 1] * dt * (0.6 + boilingIntensity * 0.8);
                pos[i * 3 + 2] += vel[i * 3 + 2] * dt;

                // Burst at waterline
                if (pos[i * 3 + 1] >= waterLevelY) {
                    this.resetBubble(pos, vel, bub.sizes, i, false);
                }
            }
            bub.points.geometry.attributes.position.needsUpdate = true;
        }

        // 4. Update Steam Cushion
        const stm = this.particleSystems.steam;
        if (stm) {
            const pos = stm.positions;
            const vel = stm.velocities;
            const waterLevelY = -0.15 + (physics.waterLevelMm / 1000.0) * 1.5;

            stm.points.material.opacity = Math.min(0.7, 0.15 + (physics.pressure / 12.0) * 0.4);

            for (let i = 0; i < stm.count; i++) {
                pos[i * 3] += vel[i * 3] * dt;
                pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
                pos[i * 3 + 2] += vel[i * 3 + 2] * dt;

                if (pos[i * 3 + 1] < waterLevelY || pos[i * 3 + 1] > 1.1 || Math.abs(pos[i * 3]) > 1.05) {
                    this.resetSteamParticle(pos, vel, stm.opacities, i, false);
                    pos[i * 3 + 1] = Math.max(waterLevelY + 0.05, pos[i * 3 + 1]);
                }
            }
            stm.points.geometry.attributes.position.needsUpdate = true;
        }

        // 5. Update Safety Valve Discharge
        const sft = this.particleSystems.safety;
        if (sft) {
            sft.points.visible = physics.safetyValveLifting;
            if (sft.points.visible) {
                const pos = sft.positions;
                const vel = sft.velocities;
                for (let i = 0; i < sft.count; i++) {
                    pos[i * 3] += vel[i * 3] * dt;
                    pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
                    pos[i * 3 + 2] += vel[i * 3 + 2] * dt;

                    if (pos[i * 3 + 1] > 3.2 || pos[i * 3 + 1] < 1.3) {
                        // Spawn at safety valve ports: (x = -0.12 or +0.12, y = 1.38, z = 0.6)
                        const valveSide = i % 2 === 0 ? -0.15 : 0.15;
                        pos[i * 3] = valveSide + (Math.random() - 0.5) * 0.05;
                        pos[i * 3 + 1] = 1.45;
                        pos[i * 3 + 2] = 0.6 + (Math.random() - 0.5) * 0.05;

                        vel[i * 3] = valveSide * 1.5 + (Math.random() - 0.5) * 0.8;
                        vel[i * 3 + 1] = 3.5 + Math.random() * 2.0; // High speed jet
                        vel[i * 3 + 2] = (Math.random() - 0.5) * 0.8;
                    }
                }
                sft.points.geometry.attributes.position.needsUpdate = true;
            }
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = BoilerParticles;
}
