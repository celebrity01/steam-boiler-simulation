/**
 * 3D Procedural CAD Model & Scene Manager
 * Industrial Three-Pass Wet-Back Fire-Tube Steam Boiler
 */

class BoilerScene {
    constructor(container) {
        this.container = container;
        this.interactiveMeshes = [];
        this.cutawayAngle = 0.45; // 45% cutaway default
        this.isXRay = false;

        this.initThree();
        this.initLighting();
        this.buildCADModel();
        this.initRaycaster();
        this.setupResize();
    }

    initThree() {
        this.scene = new THREE.Scene();
        this.isLightMode = true;
        // Crisp, high-contrast industrial CAD studio backdrop (cool slate-grey)
        this.scene.background = new THREE.Color(0xb4c2d0);

        const width = this.container.clientWidth || window.innerWidth;
        const height = this.container.clientHeight || window.innerHeight;

        this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 150);
        this.camera.position.set(8.6, 4.8, 10.8);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.95;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.physicallyCorrectLights = false;   // standard Three.js balanced lighting scale
        this.container.appendChild(this.renderer.domElement);

        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.target.set(1.0, 0.2, 0.0);
        // Allow orbiting below horizontal to inspect bottom blowdown and full underside
        this.controls.maxPolarAngle = Math.PI * 0.98;
        this.controls.minDistance = 1.5;
        this.controls.maxDistance = 45.0;
    }

    initLighting() {
        // ── 1. Hemisphere sky/ground for rich 3D shading ────────────────────────
        this.hemiLight = new THREE.HemisphereLight(
            0xf8fafc,   // sky: crisp daylight
            0x1e293b,   // ground: deep dark slate bounce for clear bottom contrast
            0.65
        );
        this.scene.add(this.hemiLight);

        // ── 2. Primary key sun light (crisp directional light with soft shadow penumbra) ──
        this.keyLight = new THREE.DirectionalLight(0xfffbf5, 1.30);
        this.keyLight.position.set(7.5, 12, 7.5);
        this.keyLight.castShadow = true;
        this.keyLight.shadow.mapSize.width  = 2048;
        this.keyLight.shadow.mapSize.height = 2048;
        this.keyLight.shadow.bias           = -0.0003;
        this.keyLight.shadow.radius         = 2.0;  // soft shadow edges
        this.keyLight.shadow.camera.left   = -7;
        this.keyLight.shadow.camera.right  = 10;
        this.keyLight.shadow.camera.top    =  8;
        this.keyLight.shadow.camera.bottom = -5;
        this.keyLight.shadow.camera.near   =  1;
        this.keyLight.shadow.camera.far    = 35;
        this.scene.add(this.keyLight);

        // ── 3. Soft fill from steam distribution side (right) ───────────────────
        this.fillRight = new THREE.DirectionalLight(0xdbeafe, 0.40);
        this.fillRight.position.set(9, 4, 3);
        this.scene.add(this.fillRight);

        // ── 4. Fill from feedtank side (left) ──────────────────────────────────
        this.fillLeft = new THREE.DirectionalLight(0xfef08a, 0.28);
        this.fillLeft.position.set(-8, 5, 2);
        this.scene.add(this.fillLeft);

        // ── 5. Rim/back light for crisp metal edge silhouettes ──────────────────
        this.rimLight = new THREE.DirectionalLight(0xffffff, 0.55);
        this.rimLight.position.set(-4, 6, -8);
        this.scene.add(this.rimLight);

        // ── 6. Underside bounce & illumination (blowdown, skids, pump base, condensate lines) ───
        this.underLight = new THREE.DirectionalLight(0xb0c4de, 0.90);
        this.underLight.position.set(1.5, -8, 2);
        this.scene.add(this.underLight);

        this.underFill = new THREE.DirectionalLight(0x94a3b8, 0.55);
        this.underFill.position.set(-2.5, -7, -3);
        this.scene.add(this.underFill);

        // ── 7. Warm combustion point light inside furnace (dynamic) ────────────
        this.furnaceLight = new THREE.PointLight(0xff6600, 0, 4.0);
        this.furnaceLight.position.set(0, -0.45, 0.5);
        this.scene.add(this.furnaceLight);

        this.scene.fog = null;

        // ── 8. Industrial shop-floor ground plane (slate grey with high contrast) ─
        const floorGeo = new THREE.PlaneGeometry(50, 50, 1, 1);
        this.floorMat = new THREE.MeshStandardMaterial({
            color:     0x64748b,
            roughness: 0.38,
            metalness: 0.20
        });
        this.floor = new THREE.Mesh(floorGeo, this.floorMat);
        this.floor.rotation.x = -Math.PI / 2;
        this.floor.position.y = -1.54;
        this.floor.receiveShadow = true;
        this.scene.add(this.floor);

        // ── 9. Contact Shadow Occlusion on floor ─────────────────────────────
        this.buildContactShadows();

        // ── 10. Dual-tone CAD alignment grid ──────────────────────────────────
        this.gridMajor = new THREE.GridHelper(40, 40, 0x1e293b, 0x334155);
        this.gridMajor.position.y = -1.535;
        this.gridMajor.material.opacity = 0.45;
        this.gridMajor.material.transparent = true;
        this.scene.add(this.gridMajor);

        this.gridMinor = new THREE.GridHelper(40, 160, 0x334155, 0x475569);
        this.gridMinor.position.y = -1.534;
        this.gridMinor.material.opacity = 0.20;
        this.gridMinor.material.transparent = true;
        this.scene.add(this.gridMinor);
    }

    // Soft contact shadow planes beneath boiler, tanks, and vessels
    buildContactShadows() {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        grad.addColorStop(0,   'rgba(0, 0, 0, 0.65)');
        grad.addColorStop(0.4, 'rgba(0, 0, 0, 0.35)');
        grad.addColorStop(0.8, 'rgba(0, 0, 0, 0.10)');
        grad.addColorStop(1,   'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 128, 128);

        const shadowTex = new THREE.CanvasTexture(canvas);
        const shadowMat = new THREE.MeshBasicMaterial({
            map: shadowTex,
            transparent: true,
            opacity: 0.65,
            depthWrite: false
        });

        // 1. Boiler Skid contact shadow
        const bShadow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 5.0), shadowMat);
        bShadow.rotation.x = -Math.PI / 2;
        bShadow.position.set(0, -1.538, 0);
        this.scene.add(bShadow);

        // 2. Feedtank & pump contact shadow
        const ftShadow = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.6), shadowMat);
        ftShadow.rotation.x = -Math.PI / 2;
        ftShadow.position.set(-2.85, -1.538, 0.3);
        this.scene.add(ftShadow);

        // 3. Steam distribution system contact shadow
        const sdShadow = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 3.2), shadowMat);
        sdShadow.rotation.x = -Math.PI / 2;
        sdShadow.position.set(3.8, -1.538, 0.8);
        this.scene.add(sdShadow);

        this.contactShadows = [bShadow, ftShadow, sdShadow];
    }

    // Traverse all meshes to enable self-shadowing and ambient contact occlusion
    applyShadowsAndReflections() {
        this.boilerGroup.traverse(child => {
            if (child.isMesh) {
                const mat = child.material;
                const isTransparent = mat && (mat.transparent || mat.opacity < 0.95);
                if (!isTransparent) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            }
        });
    }

    // Material Library — calibrated for rich contrast, reflections and CAD readability
    initMaterials() {
        this.materials = {
            brushedSteel: new THREE.MeshStandardMaterial({
                color: 0x5a6a7c,
                roughness: 0.24,
                metalness: 0.86,
                envMapIntensity: 1.1,
                side: THREE.DoubleSide
            }),
            cutawayEdge: new THREE.MeshStandardMaterial({
                color: 0x94a3b8,
                roughness: 0.32,
                metalness: 0.65,
                envMapIntensity: 0.8
            }),
            insulatedJacket: new THREE.MeshStandardMaterial({
                color: 0x334155,
                roughness: 0.38,
                metalness: 0.55,
                envMapIntensity: 0.6
            }),
            corrugatedFurnace: new THREE.MeshStandardMaterial({
                color: 0x475569,
                roughness: 0.32,
                metalness: 0.88,
                envMapIntensity: 1.0
            }),
            fireTubes: new THREE.MeshStandardMaterial({
                color: 0x8a99a8,
                roughness: 0.18,
                metalness: 0.92,
                envMapIntensity: 1.3
            }),
            wetBackChamber: new THREE.MeshStandardMaterial({
                color: 0x27272a,
                roughness: 0.28,
                metalness: 0.85,
                envMapIntensity: 0.9
            }),
            brass: new THREE.MeshStandardMaterial({
                color: 0xd97706,
                roughness: 0.16,
                metalness: 0.92,
                envMapIntensity: 1.4
            }),
            copperCoil: new THREE.MeshStandardMaterial({
                color: 0xb45309,
                roughness: 0.20,
                metalness: 0.88,
                envMapIntensity: 1.2
            }),
            valveRed: new THREE.MeshStandardMaterial({
                color: 0xdc2626,
                roughness: 0.28,
                metalness: 0.30,
                envMapIntensity: 0.5
            }),
            castIron: new THREE.MeshStandardMaterial({
                color: 0x1e293b,
                roughness: 0.60,
                metalness: 0.45,
                envMapIntensity: 0.4
            }),
            water: new THREE.MeshStandardMaterial({
                color: 0x0284c7,
                transparent: true,
                opacity: 0.62,
                roughness: 0.05,
                metalness: 0.08,
                envMapIntensity: 1.2,
                depthWrite: false
            }),
            glass: new THREE.MeshStandardMaterial({
                color: 0x38bdf8,
                transparent: true,
                opacity: 0.32,
                roughness: 0.04,
                metalness: 0.08,
                envMapIntensity: 1.4,
                depthWrite: false
            }),
            chrome: new THREE.MeshStandardMaterial({
                color: 0xf8fafc,
                roughness: 0.05,
                metalness: 0.98,
                envMapIntensity: 2.0
            })
        };
    }

    buildCADModel() {
        this.initMaterials();
        this.boilerGroup = new THREE.Group();
        this.scene.add(this.boilerGroup);

        this.parts = {};
        this.explodeFactor = 0;
        this.isExploded = false;

        const subassemblies = [
            ['foundation',     this.buildFoundationAndSaddles],
            ['shell',          this.buildPressureShell],
            ['furnace',        this.buildPass1CorrugatedFurnace],
            ['wetBack',        this.buildWetBackChamber],
            ['fireTubes',      this.buildFireTubeBundles],
            ['frontSmokeBox',  this.buildFrontSmokeBox],
            ['chimney',        this.buildChimneyAndEconomizer],
            ['burner',         this.buildDualFuelBurner],
            ['water',          this.buildWaterVolume],
            ['topMountings',   this.buildTopMountings],
            ['waterLevelGauge',this.buildWaterLevelGauge],
            ['blowdown',       this.buildBlowdownSystem],
            ['steamSystem',    this.buildSteamSystem],
            ['feedTank',       this.buildFeedTank]
        ];

        const nativeAdd = THREE.Group.prototype.add;

        for (let i = 0; i < subassemblies.length; i++) {
            const [key, buildFn] = subassemblies[i];
            const group = new THREE.Group();
            group.name = key;
            this.parts[key] = group;
            nativeAdd.call(this.boilerGroup, group);

            // Intercept additions during this subassembly build
            this.boilerGroup.add = function(...objs) {
                return nativeAdd.apply(group, objs);
            };

            try {
                buildFn.call(this);
            } catch (err) {
                console.error('Error building ' + key + ':', err);
            }
        }

        // Restore native prototype add method
        this.boilerGroup.add = nativeAdd;

        // Automatically configure soft shadows across all opaque assemblies
        this.applyShadowsAndReflections();
    }

    // 1. Foundation & Saddle Supports
    buildFoundationAndSaddles() {
        const saddleMat = this.materials.castIron;
        const beamMat = this.materials.brushedSteel;

        // Base structural I-beam skid
        const skidGeo = new THREE.BoxGeometry(0.18, 0.16, 4.6);
        const skidLeft = new THREE.Mesh(skidGeo, beamMat);
        skidLeft.position.set(-0.75, -1.45, 0);
        skidLeft.castShadow = true;
        this.boilerGroup.add(skidLeft);

        const skidRight = new THREE.Mesh(skidGeo, beamMat);
        skidRight.position.set(0.75, -1.45, 0);
        skidRight.castShadow = true;
        this.boilerGroup.add(skidRight);

        // Cross beams
        [-1.6, 1.6].forEach(z => {
            const crossGeo = new THREE.BoxGeometry(1.68, 0.16, 0.18);
            const cross = new THREE.Mesh(crossGeo, beamMat);
            cross.position.set(0, -1.45, z);
            this.boilerGroup.add(cross);
        });

        // Curved steel cradle saddles supporting the drum
        [-1.2, 1.2].forEach(z => {
            const saddleShape = new THREE.Shape();
            saddleShape.moveTo(-1.15, -1.37);
            saddleShape.lineTo(1.15, -1.37);
            saddleShape.lineTo(1.15, -0.6);
            saddleShape.absarc(0, 0, 1.15, -Math.PI * 0.18, -Math.PI * 0.82, true);
            saddleShape.lineTo(-1.15, -0.6);
            saddleShape.closePath();

            const extrudeSettings = { depth: 0.22, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.02, bevelThickness: 0.02 };
            const saddleGeo = new THREE.ExtrudeGeometry(saddleShape, extrudeSettings);
            const saddle = new THREE.Mesh(saddleGeo, saddleMat);
            saddle.position.set(0, 0, z - 0.11);
            saddle.castShadow = true;
            this.boilerGroup.add(saddle);

            this.registerInteractive(saddle, {
                name: 'Boiler Saddle Support',
                category: 'Structural',
                description: 'Heavy fabricated carbon steel cradle support designed to ASME Section I / EN 12953, distributing pressure vessel static and hydraulic operating weight.',
                asmeCode: 'ASME BPVC Sec. I Part PG'
            });
        });
    }

    // 2. Pressure Vessel Outer Cylindrical Shell (Sliced Cutaway)
    buildPressureShell() {
        const shellRadius = 1.15;
        const shellLength = 3.6;

        // Procedural cutaway cylinder shell (thetaLength controls opening)
        const thetaStart = Math.PI * 0.55; // Sliced open on front/viewer side
        const thetaLength = Math.PI * 1.45; // ~260 degrees closed, 100 degrees sliced open
        const shellGeo = new THREE.CylinderGeometry(shellRadius, shellRadius, shellLength, 48, 1, true, thetaStart, thetaLength);
        shellGeo.rotateX(Math.PI / 2);

        this.shellMesh = new THREE.Mesh(shellGeo, this.materials.brushedSteel);
        this.shellMesh.castShadow = true;
        this.shellMesh.receiveShadow = true;
        this.boilerGroup.add(this.shellMesh);

        // Visible insulation lagging jacket slightly outside
        const lagGeo = new THREE.CylinderGeometry(shellRadius + 0.04, shellRadius + 0.04, shellLength * 0.98, 48, 1, true, thetaStart + 0.02, thetaLength - 0.04);
        lagGeo.rotateX(Math.PI / 2);
        this.lagMesh = new THREE.Mesh(lagGeo, this.materials.insulatedJacket);
        this.boilerGroup.add(this.lagMesh);

        // Chrome retaining bands
        [-1.3, -0.4, 0.4, 1.3].forEach(z => {
            const bandGeo = new THREE.CylinderGeometry(shellRadius + 0.045, shellRadius + 0.045, 0.05, 48, 1, true, thetaStart, thetaLength);
            bandGeo.rotateX(Math.PI / 2);
            const band = new THREE.Mesh(bandGeo, this.materials.chrome);
            band.position.z = z;
            this.boilerGroup.add(band);
        });

        // Cutaway longitudinal edge bars (highlighting sliced thick steel plate)
        const edgeThickGeo = new THREE.BoxGeometry(0.04, 0.05, shellLength);
        const edge1 = new THREE.Mesh(edgeThickGeo, this.materials.cutawayEdge);
        const ang1 = thetaStart;
        edge1.position.set(Math.cos(ang1) * shellRadius, Math.sin(ang1) * shellRadius, 0);
        this.boilerGroup.add(edge1);

        const edge2 = new THREE.Mesh(edgeThickGeo, this.materials.cutawayEdge);
        const ang2 = thetaStart + thetaLength;
        edge2.position.set(Math.cos(ang2) * shellRadius, Math.sin(ang2) * shellRadius, 0);
        this.boilerGroup.add(edge2);

        // Rear End Tube-Sheet Plate (Thick dished head plate)
        const rearPlateGeo = new THREE.CylinderGeometry(shellRadius, shellRadius, 0.08, 48);
        rearPlateGeo.rotateX(Math.PI / 2);
        this.rearPlate = new THREE.Mesh(rearPlateGeo, this.materials.brushedSteel);
        this.rearPlate.position.z = -shellLength / 2;
        this.boilerGroup.add(this.rearPlate);

        // Front End Tube-Sheet Plate
        const frontPlateGeo = new THREE.CylinderGeometry(shellRadius, shellRadius, 0.08, 48);
        frontPlateGeo.rotateX(Math.PI / 2);
        this.frontPlate = new THREE.Mesh(frontPlateGeo, this.materials.brushedSteel);
        this.frontPlate.position.z = shellLength / 2;
        this.boilerGroup.add(this.frontPlate);

        this.registerInteractive(this.shellMesh, {
            name: 'Cylindrical Pressure Vessel Shell',
            category: 'Pressure Containment',
            description: 'Rolled carbon steel plate (SA-516 Gr 70) full-penetration submerged arc welded. Cutaway exposes the submerged furnace and convection tube passes surrounded by feedwater.',
            asmeCode: 'ASME Sec. I Part PW / EN 12953-3'
        });
    }

    // 3. First Pass: Corrugated Furnace Tube (Morison Profile)
    buildPass1CorrugatedFurnace() {
        const furnaceGroup = new THREE.Group();
        furnaceGroup.position.set(0, -0.45, 0);

        const furnaceRadius = 0.44;
        const furnaceLength = 3.5;
        const corrugations = 26;

        // Build continuous corrugated profile via lathe or repeated segmented ridges
        for (let i = 0; i < corrugations; i++) {
            const z = -furnaceLength / 2 + (i + 0.5) * (furnaceLength / corrugations);
            const torusGeo = new THREE.TorusGeometry(furnaceRadius, 0.026, 12, 32);
            const torus = new THREE.Mesh(torusGeo, this.materials.corrugatedFurnace);
            torus.position.z = z;
            furnaceGroup.add(torus);
        }

        // Inner smooth liner cylinder
        const innerCylGeo = new THREE.CylinderGeometry(furnaceRadius - 0.015, furnaceRadius - 0.015, furnaceLength, 32, 1, true);
        innerCylGeo.rotateX(Math.PI / 2);
        const innerCyl = new THREE.Mesh(innerCylGeo, this.materials.corrugatedFurnace);
        furnaceGroup.add(innerCyl);

        // Front flange connection
        const flangeGeo = new THREE.CylinderGeometry(furnaceRadius + 0.06, furnaceRadius + 0.06, 0.08, 32);
        flangeGeo.rotateX(Math.PI / 2);
        const flange = new THREE.Mesh(flangeGeo, this.materials.castIron);
        flange.position.z = furnaceLength / 2 + 0.04;
        furnaceGroup.add(flange);

        this.boilerGroup.add(furnaceGroup);

        this.registerInteractive(innerCyl, {
            name: '1st Pass: Corrugated Furnace Tube',
            category: 'Combustion & Primary Heat Transfer',
            description: 'Morison-pattern corrugated furnace tube. Absorbs up to 50% of total heat release via high-intensity radiation. Corrugations provide thermal expansion elasticity and prevent collapse under external water pressure.',
            asmeCode: 'ASME Sec. I PFT-14 to PFT-19'
        });
    }

    // 4. Fully Water-Cooled Wet-Back Combustion Reversal Chamber
    buildWetBackChamber() {
        const wetBackGroup = new THREE.Group();
        wetBackGroup.position.set(0, -0.3, -1.82);

        // Wet-back envelope: rear combustion chamber completely submerged in water
        const wbWidth = 1.35;
        const wbHeight = 1.1;
        const wbDepth = 0.55;

        const chamberGeo = new THREE.CylinderGeometry(wbHeight * 0.55, wbHeight * 0.55, wbDepth, 32);
        chamberGeo.rotateZ(Math.PI / 2);
        const chamber = new THREE.Mesh(chamberGeo, this.materials.wetBackChamber);
        wetBackGroup.add(chamber);

        // Front wet-back tube sheet connecting furnace & Pass 2 fire tubes
        const frontWbSheetGeo = new THREE.BoxGeometry(0.06, wbHeight, wbWidth);
        const frontWbSheet = new THREE.Mesh(frontWbSheetGeo, this.materials.wetBackChamber);
        frontWbSheet.position.z = wbDepth / 2;
        wetBackGroup.add(frontWbSheet);

        // Rear inspection access tube through the boiler water space
        const accessTubeGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.35, 24);
        accessTubeGeo.rotateX(Math.PI / 2);
        const accessTube = new THREE.Mesh(accessTubeGeo, this.materials.brushedSteel);
        accessTube.position.set(0, -0.15, -wbDepth / 2 - 0.17);
        wetBackGroup.add(accessTube);

        // Submerged stay-bolts supporting wet-back crown plate against steam pressure
        [-0.35, 0, 0.35].forEach(x => {
            const stayGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.85, 12);
            const stay = new THREE.Mesh(stayGeo, this.materials.brushedSteel);
            stay.position.set(x, 0.55, 0);
            wetBackGroup.add(stay);
        });

        this.boilerGroup.add(wetBackGroup);

        this.registerInteractive(chamber, {
            name: 'Water-Cooled Wet-Back Reversal Chamber',
            category: 'Fireside Reversal Chamber',
            description: 'Fully submerged wet-back combustion chamber turning flue gases 180° into the 2nd pass. Enveloped by boiler water, eliminating refractory maintenance and rear tube-sheet thermal cracking found in dry-back boilers.',
            asmeCode: 'ASME Sec. I PFT-27 / EN 12953-3'
        });
    }

    // 5. Fire Tube Bundles (Second Pass & Third Pass)
    buildFireTubeBundles() {
        const tubesGroup = new THREE.Group();
        const tubeLength = 3.55;
        const tubeRadius = 0.032;
        const tubeMat = this.materials.fireTubes;

        // Second Pass Tubes (Connecting Wet-Back to Front Smoke Box, lower flanks)
        this.pass2Tubes = [];
        const pass2Positions = [
            // Left flank
            [-0.65, -0.32], [-0.78, -0.22], [-0.62, -0.15], [-0.75, -0.05], [-0.58, 0.02], [-0.72, 0.12],
            // Right flank
            [0.65, -0.32], [0.78, -0.22], [0.62, -0.15], [0.75, -0.05], [0.58, 0.02], [0.72, 0.12]
        ];

        pass2Positions.forEach(([x, y]) => {
            const tubeGeo = new THREE.CylinderGeometry(tubeRadius, tubeRadius, tubeLength, 16);
            tubeGeo.rotateX(Math.PI / 2);
            const tube = new THREE.Mesh(tubeGeo, tubeMat);
            tube.position.set(x, y, 0);
            tubesGroup.add(tube);
            this.pass2Tubes.push(tube);
        });

        // Third Pass Tubes (Upper array, connecting Front Smoke Box to Rear Flue Collector)
        this.pass3Tubes = [];
        const pass3Positions = [
            [-0.52, 0.28], [-0.35, 0.28], [-0.18, 0.28], [0.18, 0.28], [0.35, 0.28], [0.52, 0.28],
            [-0.60, 0.42], [-0.42, 0.42], [-0.25, 0.42], [0.25, 0.42], [0.42, 0.42], [0.60, 0.42],
            [-0.50, 0.56], [-0.32, 0.56], [-0.15, 0.56], [0.15, 0.56], [0.32, 0.56], [0.50, 0.56]
        ];

        pass3Positions.forEach(([x, y]) => {
            const tubeGeo = new THREE.CylinderGeometry(tubeRadius, tubeRadius, tubeLength, 16);
            tubeGeo.rotateX(Math.PI / 2);
            const tube = new THREE.Mesh(tubeGeo, tubeMat);
            tube.position.set(x, y, 0);
            tubesGroup.add(tube);
            this.pass3Tubes.push(tube);
        });

        this.boilerGroup.add(tubesGroup);

        this.registerInteractive(this.pass2Tubes[0], {
            name: '2nd Pass Fire-Tube Bank',
            category: 'Convective Heat Transfer',
            description: 'Lower fire-tube bundles directing flue gases from the wet-back chamber forward to the front smoke box. Tubes are rolled and seal-welded into heavy tube sheets.',
            asmeCode: 'ASME Sec. I Part PFT / EN 12953-4'
        });

        this.registerInteractive(this.pass3Tubes[0], {
            name: '3rd Pass Fire-Tube Bank',
            category: 'Convective Heat Transfer',
            description: 'Upper fire-tube bundles transferring gases from the front smoke box rearward to the chimney exhaust. Maximizes convection heat recovery before flue gas leaves the boiler.',
            asmeCode: 'ASME Sec. I Part PFT / EN 12953-4'
        });
    }

    // 6. Front Smoke Box (Gas Turnaround)
    buildFrontSmokeBox() {
        const boxGroup = new THREE.Group();
        boxGroup.position.set(0, 0, 1.85);

        // Flanged outer casing
        const casingGeo = new THREE.CylinderGeometry(1.18, 1.18, 0.45, 32);
        casingGeo.rotateX(Math.PI / 2);
        this.frontSmokeCasing = new THREE.Mesh(casingGeo, this.materials.castIron);
        boxGroup.add(this.frontSmokeCasing);

        // Hinged access doors for tube cleaning & mechanical inspection
        const doorGeo = new THREE.CylinderGeometry(1.15, 1.15, 0.06, 32);
        doorGeo.rotateX(Math.PI / 2);
        this.frontSmokeDoor = new THREE.Mesh(doorGeo, this.materials.brushedSteel);
        this.frontSmokeDoor.position.z = 0.23;
        boxGroup.add(this.frontSmokeDoor);

        // Central burner throat port
        const portGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.12, 32);
        portGeo.rotateX(Math.PI / 2);
        const port = new THREE.Mesh(portGeo, this.materials.castIron);
        port.position.set(0, -0.45, 0.25);
        boxGroup.add(port);

        this.boilerGroup.add(boxGroup);

        this.registerInteractive(this.frontSmokeDoor, {
            name: 'Front Smoke Box & Hinged Doors',
            category: 'Fireside Turnaround & Access',
            description: 'Insulated front manifold turning 2nd-pass gas into 3rd-pass fire tubes. Double-hinged doors provide complete access for tube inspection, cleaning, and ultrasonic thickness testing.',
            asmeCode: 'EN 12953-3'
        });
    }

    // 7. Exhaust Chimney & Economizer Coil
    buildChimneyAndEconomizer() {
        const stackGroup = new THREE.Group();
        stackGroup.position.set(0, 0.95, -1.75);

        // Vertical Flue Stack Pipe (Partially cutaway glass/cut pipe to see coil)
        const stackRadius = 0.32;
        const stackHeight = 2.4;
        const stackGeo = new THREE.CylinderGeometry(stackRadius, stackRadius, stackHeight, 32, 1, true, Math.PI * 0.4, Math.PI * 1.6);
        const stack = new THREE.Mesh(stackGeo, this.materials.brushedSteel);
        stack.position.y = stackHeight / 2;
        stackGroup.add(stack);

        // Helical Economizer Heat-Recovery Coil
        const coilPoints = [];
        const coilTurns = 9;
        const coilR = 0.22;
        const coilH = 1.6;
        for (let i = 0; i <= 200; i++) {
            const t = i / 200;
            const ang = t * Math.PI * 2 * coilTurns;
            const x = Math.cos(ang) * coilR;
            const z = Math.sin(ang) * coilR;
            const y = 0.3 + t * coilH;
            coilPoints.push(new THREE.Vector3(x, y, z));
        }
        const coilCurve = new THREE.CatmullRomCurve3(coilPoints);
        const coilGeo = new THREE.TubeGeometry(coilCurve, 180, 0.022, 10, false);
        const coilMesh = new THREE.Mesh(coilGeo, this.materials.copperCoil);
        stackGroup.add(coilMesh);

        // Feedwater header connection to economizer
        const connGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.45, 16);
        connGeo.rotateZ(Math.PI / 2);
        const conn1 = new THREE.Mesh(connGeo, this.materials.brass);
        conn1.position.set(0.38, 0.35, 0);
        stackGroup.add(conn1);

        const conn2 = new THREE.Mesh(connGeo, this.materials.brass);
        conn2.position.set(0.38, 1.85, 0);
        stackGroup.add(conn2);

        this.boilerGroup.add(stackGroup);

        this.registerInteractive(coilMesh, {
            name: 'Flue Gas Economizer Coil',
            category: 'Waste Heat Recovery',
            description: 'Helical finned-tube economizer extracting sensible heat from 3rd-pass flue gases to preheat incoming feedwater from 60°C to 92°C, boosting overall boiler efficiency by ~4.5%.',
            asmeCode: 'ASME Sec. I Part PEB / EN 12953-11'
        });
    }

    // 8. Front-Mounted Dual-Fuel Burner Assembly
    buildDualFuelBurner() {
        const burnerGroup = new THREE.Group();
        burnerGroup.position.set(0, -0.45, 2.12);

        // Burner mounting blast tube flange
        const flangeGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.08, 32);
        flangeGeo.rotateX(Math.PI / 2);
        const flange = new THREE.Mesh(flangeGeo, this.materials.castIron);
        burnerGroup.add(flange);

        // Main burner air housing body
        const bodyGeo = new THREE.BoxGeometry(0.55, 0.48, 0.65);
        const body = new THREE.Mesh(bodyGeo, this.materials.castIron);
        body.position.set(0, 0, 0.42);
        burnerGroup.add(body);

        // Combustion air fan motor (cylindrical)
        const motorGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.4, 24);
        motorGeo.rotateZ(Math.PI / 2);
        const motor = new THREE.Mesh(motorGeo, this.materials.castIron);
        motor.position.set(0.42, 0.05, 0.42);
        burnerGroup.add(motor);

        // Gas Train Pipe with safety shutoff solenoid
        const gasPipeGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.6, 16);
        const gasPipe = new THREE.Mesh(gasPipeGeo, this.materials.valveRed);
        gasPipe.position.set(-0.35, 0.35, 0.42);
        burnerGroup.add(gasPipe);

        // Oil lance braided flex lines
        const oilLineGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 12);
        oilLineGeo.rotateX(Math.PI / 2);
        const oilLine = new THREE.Mesh(oilLineGeo, this.materials.chrome);
        oilLine.position.set(-0.15, -0.25, 0.6);
        burnerGroup.add(oilLine);

        // Burner Management System (BMS) Control Panel & status lamp
        const bmsBoxGeo = new THREE.BoxGeometry(0.22, 0.28, 0.1);
        const bmsBox = new THREE.Mesh(bmsBoxGeo, this.materials.brushedSteel);
        bmsBox.position.set(-0.35, 0, 0.55);
        burnerGroup.add(bmsBox);

        const lampGeo = new THREE.SphereGeometry(0.03, 16, 16);
        this.burnerStatusLamp = new THREE.Mesh(lampGeo, new THREE.MeshBasicMaterial({ color: 0x22c55e }));
        this.burnerStatusLamp.position.set(-0.35, 0.08, 0.61);
        burnerGroup.add(this.burnerStatusLamp);

        this.boilerGroup.add(burnerGroup);

        this.registerInteractive(body, {
            name: 'Dual-Fuel Burner Assembly (Gas / Oil)',
            category: 'Combustion System',
            description: 'Fully modulating dual-fuel burner with electronic cam air-fuel ratio control, integrated high-pressure blower, flame safeguard scanner, and twin safety shutoff valves.',
            asmeCode: 'NFPA 85 / EN 676 & EN 267'
        });
    }

    // 9. Waterside Liquid Volume (Dynamic Level)
    buildWaterVolume() {
        const shellRadius = 1.12;
        const shellLength = 3.52;
        const thetaStart = Math.PI * 0.55;
        const thetaLength = Math.PI * 1.45;

        // Curved water bottom contour
        const waterGeo = new THREE.CylinderGeometry(shellRadius, shellRadius, shellLength, 48, 1, false, thetaStart, thetaLength);
        waterGeo.rotateX(Math.PI / 2);
        this.waterMesh = new THREE.Mesh(waterGeo, this.materials.water);
        this.boilerGroup.add(this.waterMesh);

        // Top horizontal water plane (surface of the liquid)
        const planeGeo = new THREE.PlaneGeometry(1.85, shellLength, 16, 32);
        planeGeo.rotateX(-Math.PI / 2);
        this.waterSurfaceMesh = new THREE.Mesh(planeGeo, this.materials.water);
        this.waterSurfaceMesh.position.y = -0.15;
        this.boilerGroup.add(this.waterSurfaceMesh);

        this.registerInteractive(this.waterSurfaceMesh, {
            name: 'Boiler Water Level & Ebullition Zone',
            category: 'Thermodynamics & Phase Change',
            description: 'Submerged liquid water volume (approx 66% drum volume). Thermal plumes transfer heat from tube surfaces, creating violent nucleate boiling (ebullition) rising to the steam-water interface.',
            asmeCode: 'ASME Sec. I PG-60'
        });
    }

    // 10. Boiler Mountings & Safety Fittings on Top
    buildTopMountings() {
        const mountGroup = new THREE.Group();

        // A. Main Steam Takeoff: Screw-Down Angle Pattern Crown Valve
        const crownGroup = new THREE.Group();
        crownGroup.position.set(0, 1.15, -0.2);

        // Standpipe nozzle from boiler shell
        const nozzleGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.25, 24);
        const nozzle = new THREE.Mesh(nozzleGeo, this.materials.brushedSteel);
        crownGroup.add(nozzle);

        // Angle pattern valve body
        const valveBodyGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.32, 24);
        const valveBody = new THREE.Mesh(valveBodyGeo, this.materials.brass);
        valveBody.position.y = 0.25;
        crownGroup.add(valveBody);

        // Flanged horizontal steam outlet
        const outletGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.35, 24);
        outletGeo.rotateZ(Math.PI / 2);
        const outlet = new THREE.Mesh(outletGeo, this.materials.brass);
        outlet.position.set(0.24, 0.25, 0);
        crownGroup.add(outlet);

        // Rising stem & Cast Iron Handwheel
        const stemGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.22, 16);
        const stem = new THREE.Mesh(stemGeo, this.materials.chrome);
        stem.position.y = 0.48;
        crownGroup.add(stem);

        const handwheelGeo = new THREE.TorusGeometry(0.18, 0.024, 12, 24);
        handwheelGeo.rotateX(Math.PI / 2);
        this.crownHandwheel = new THREE.Mesh(handwheelGeo, this.materials.valveRed);
        this.crownHandwheel.position.y = 0.58;
        crownGroup.add(this.crownHandwheel);

        mountGroup.add(crownGroup);

        this.registerInteractive(valveBody, {
            name: 'Main Steam Crown Valve (Angle Pattern)',
            category: 'Steam Takeoff & Isolation',
            description: 'Heavy screw-down stop-check angle valve positioned at the highest point of the boiler shell. Isolates the boiler from the steam header and prevents reverse steam flow.',
            asmeCode: 'ASME Sec. I PG-59 / BS EN ISO 4126'
        });

        // B. Dual Spring-Loaded Safety Valves
        [-0.16, 0.16].forEach((x, idx) => {
            const safetyGroup = new THREE.Group();
            safetyGroup.position.set(x, 1.15, 0.65);

            // Mounting flange & base
            const baseGeo = new THREE.CylinderGeometry(0.08, 0.09, 0.18, 20);
            const base = new THREE.Mesh(baseGeo, this.materials.castIron);
            safetyGroup.add(base);

            // Valve spring cage / housing
            const cageGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.32, 20);
            const cage = new THREE.Mesh(cageGeo, this.materials.brushedSteel);
            cage.position.y = 0.22;
            safetyGroup.add(cage);

            // Visible Helical Coil Spring
            const springPoints = [];
            for (let i = 0; i <= 60; i++) {
                const t = i / 60;
                const a = t * Math.PI * 2 * 6;
                springPoints.push(new THREE.Vector3(Math.cos(a) * 0.045, 0.1 + t * 0.22, Math.sin(a) * 0.045));
            }
            const springCurve = new THREE.CatmullRomCurve3(springPoints);
            const springGeo = new THREE.TubeGeometry(springCurve, 50, 0.012, 8, false);
            const springMesh = new THREE.Mesh(springGeo, this.materials.chrome);
            safetyGroup.add(springMesh);

            // Manual lifting easing lever
            const leverGeo = new THREE.BoxGeometry(0.02, 0.03, 0.24);
            const lever = new THREE.Mesh(leverGeo, this.materials.valveRed);
            lever.position.set(0, 0.44, 0.08);
            safetyGroup.add(lever);

            // Discharge exhaust horn
            const hornGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.25, 16);
            hornGeo.rotateX(Math.PI / 2);
            const horn = new THREE.Mesh(hornGeo, this.materials.castIron);
            horn.position.set(0, 0.2, 0.18);
            safetyGroup.add(horn);

            mountGroup.add(safetyGroup);

            this.registerInteractive(cage, {
                name: `Spring-Loaded Safety Valve #${idx + 1}`,
                category: 'Overpressure Protection',
                description: 'Full-lift spring-loaded safety relief valve set at 10.5 bar (152 psi). Dual valves ensure 100% steam discharge capacity to prevent shell rupture under total steam deadheading.',
                asmeCode: 'ASME Sec. I PG-67 to PG-73'
            });
        });

        // C. Pressure Gauge on Pigtail U-Tube Siphon Loop
        const gaugeGroup = new THREE.Group();
        gaugeGroup.position.set(0.35, 1.15, 1.15);

        // U-tube siphon loop (pigtail trap)
        const siphonPoints = [
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0.12, 0),
            new THREE.Vector3(0.08, 0.18, 0),
            new THREE.Vector3(0.12, 0.26, 0),
            new THREE.Vector3(0.08, 0.34, 0),
            new THREE.Vector3(0, 0.38, 0),
            new THREE.Vector3(-0.06, 0.32, 0),
            new THREE.Vector3(-0.02, 0.44, 0),
            new THREE.Vector3(0, 0.52, 0)
        ];
        const siphonCurve = new THREE.CatmullRomCurve3(siphonPoints);
        const siphonGeo = new THREE.TubeGeometry(siphonCurve, 32, 0.014, 8, false);
        const siphon = new THREE.Mesh(siphonGeo, this.materials.chrome);
        gaugeGroup.add(siphon);

        // Gauge circular case
        const gaugeCaseGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.05, 32);
        gaugeCaseGeo.rotateX(Math.PI / 2);
        const gaugeCase = new THREE.Mesh(gaugeCaseGeo, this.materials.brushedSteel);
        gaugeCase.position.set(0, 0.65, 0);
        gaugeGroup.add(gaugeCase);

        // Dial Face with Needle
        const dialGeo = new THREE.CircleGeometry(0.13, 32);
        const dialMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
        const dial = new THREE.Mesh(dialGeo, dialMat);
        dial.position.set(0, 0.65, 0.028);
        gaugeGroup.add(dial);

        // Pointer needle
        const needleGeo = new THREE.BoxGeometry(0.008, 0.1, 0.005);
        this.gaugeNeedle = new THREE.Mesh(needleGeo, this.materials.valveRed);
        this.gaugeNeedle.position.set(0, 0.68, 0.032);
        gaugeGroup.add(this.gaugeNeedle);

        mountGroup.add(gaugeGroup);

        this.registerInteractive(gaugeCase, {
            name: 'Bourdon Dial Pressure Gauge & Siphon',
            category: 'Pressure Measurement',
            description: 'Direct-indicating Bourdon tube pressure gauge. Fitted with a U-tube pigtail siphon that holds condensed water, isolating the delicate gauge internals from high-temperature live steam.',
            asmeCode: 'ASME Sec. I PG-105'
        });

        this.boilerGroup.add(mountGroup);
    }

    // 11. Water Level Gauge Glass Column & Conductivity Probes (LWCO)
    buildWaterLevelGauge() {
        const gaugeColGroup = new THREE.Group();
        gaugeColGroup.position.set(1.22, -0.15, 1.2);

        // Upper and lower brass isolating cocks connecting to boiler shell
        [-0.45, 0.45].forEach(y => {
            const connGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.25, 16);
            connGeo.rotateZ(Math.PI / 2);
            const conn = new THREE.Mesh(connGeo, this.materials.brass);
            conn.position.set(-0.12, y, 0);
            gaugeColGroup.add(conn);

            const cockHandleGeo = new THREE.BoxGeometry(0.015, 0.09, 0.03);
            const cock = new THREE.Mesh(cockHandleGeo, this.materials.valveRed);
            cock.position.set(0.04, y, 0.05);
            gaugeColGroup.add(cock);
        });

        // Vertical Borosilicate Glass Tube with Meniscus
        const glassGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.85, 20);
        const glass = new THREE.Mesh(glassGeo, this.materials.glass);
        gaugeColGroup.add(glass);

        // Dynamic water level liquid inside the glass tube
        const levelLiquidGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.82, 16);
        this.gaugeWaterLevelMesh = new THREE.Mesh(levelLiquidGeo, this.materials.water);
        this.gaugeWaterLevelMesh.position.y = 0;
        gaugeColGroup.add(this.gaugeWaterLevelMesh);

        // Protective brass tie-rods guarding the glass tube
        [-0.045, 0.045].forEach(x => {
            const rodGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.95, 12);
            const rod = new THREE.Mesh(rodGeo, this.materials.brass);
            rod.position.set(x, 0, 0.045);
            gaugeColGroup.add(rod);
        });

        // Conductivity Probe Chamber (LWCO) adjacent
        const lwcoGroup = new THREE.Group();
        lwcoGroup.position.set(1.22, 0.1, 0.4);

        const chamberGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.8, 20);
        const chamber = new THREE.Mesh(chamberGeo, this.materials.brushedSteel);
        lwcoGroup.add(chamber);

        // Electrical terminal enclosure
        const termGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.16, 20);
        const term = new THREE.Mesh(termGeo, this.materials.castIron);
        term.position.y = 0.45;
        lwcoGroup.add(term);

        this.boilerGroup.add(gaugeColGroup);
        this.boilerGroup.add(lwcoGroup);

        this.registerInteractive(glass, {
            name: 'Direct Water Level Gauge Glass Column',
            category: 'Direct Level Indication',
            description: 'High-pressure reflex borosilicate glass gauge with automatic safety ball checks and brass isolating cocks, showing true liquid level in the boiler drum.',
            asmeCode: 'ASME Sec. I PG-60.1'
        });

        this.registerInteractive(chamber, {
            name: 'Conductivity Probe Chamber (LWCO)',
            category: 'Safety Interlocks & Electronic Level Control',
            description: 'Housing high-integrity conductivity electrodes for automatic feed pump modulation, high/low water alarms, and fail-safe Low-Water Cutoff (LWCO) burner trip.',
            asmeCode: 'ASME CSD-1 / EN 12953-9'
        });
    }

    // 12. Bottom Blowdown Piping & Valve System
    buildBlowdownSystem() {
        const blowGroup = new THREE.Group();
        blowGroup.position.set(0, -1.22, -0.6);

        // Shell bottom drain nozzle
        const nozzleGeo = new THREE.CylinderGeometry(0.07, 0.08, 0.22, 16);
        const nozzle = new THREE.Mesh(nozzleGeo, this.materials.brushedSteel);
        blowGroup.add(nozzle);

        // Blowdown valve body
        const valveGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.24, 16);
        valveGeo.rotateZ(Math.PI / 2);
        const valve = new THREE.Mesh(valveGeo, this.materials.valveRed);
        valve.position.set(0.12, -0.15, 0);
        blowGroup.add(valve);

        // Quick-action blowdown lever
        const leverGeo = new THREE.BoxGeometry(0.42, 0.03, 0.04);
        const lever = new THREE.Mesh(leverGeo, this.materials.chrome);
        lever.position.set(0.25, -0.06, 0);
        blowGroup.add(lever);

        // Discharge pipe leading to blowdown vessel
        const pipeGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.8, 16);
        pipeGeo.rotateZ(Math.PI / 2);
        const pipe = new THREE.Mesh(pipeGeo, this.materials.brushedSteel);
        pipe.position.set(0.55, -0.15, 0);
        blowGroup.add(pipe);

        this.boilerGroup.add(blowGroup);

        this.registerInteractive(valve, {
            name: 'Bottom Blowdown Valve & Manifold',
            category: 'Impurity & Sludge Removal',
            description: 'Keyed quick-opening blowdown valve connected to the bottom of the shell. Periodically purged to eject precipitated mineral scale, sludge, and maintain low Total Dissolved Solids (TDS).',
            asmeCode: 'ASME Sec. I PG-59.3'
        });
    }

    // Helper: Register interactive mesh for hover/click tooltips
    registerInteractive(mesh, metadata) {
        mesh.userData = metadata;
        this.interactiveMeshes.push(mesh);
    }

    initRaycaster() {
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2(-9999, -9999);
        this.hoveredObject = null;
        this.hasMouseMoved = false;

        window.addEventListener('mousemove', (e) => {
            this.hasMouseMoved = true;
            const rect = this.renderer.domElement.getBoundingClientRect();
            this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        });

        window.addEventListener('click', () => {
            if (this.hoveredObject && this.onComponentSelected) {
                this.onComponentSelected(this.hoveredObject.userData);
            }
        });
    }

    checkRaycast() {
        if (!this.hasMouseMoved) return;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.interactiveMeshes, true);

        if (intersects.length > 0) {
            const hit = intersects[0].object;
            if (this.hoveredObject !== hit) {
                this.hoveredObject = hit;
                document.body.style.cursor = 'pointer';
                if (this.onComponentHover) {
                    this.onComponentHover(hit.userData);
                }
            }
        } else {
            if (this.hoveredObject !== null) {
                this.hoveredObject = null;
                document.body.style.cursor = 'default';
                if (this.onComponentHover) {
                    this.onComponentHover(null);
                }
            }
        }
    }

    // Update dynamic physical visuals based on simulation state
    update(dt, physics) {
        // 1. Dynamic Water Level in Shell
        // Nominal water surface is at y = -0.15; +/- 80 mm level moves it +/- 0.12 units in 3D
        const waterY = -0.15 + (physics.waterLevelMm / 1000.0) * 1.5;
        if (this.waterSurfaceMesh) {
            this.waterSurfaceMesh.position.y = waterY;
        }

        // 2. Dynamic Water Level in Gauge Glass
        if (this.gaugeWaterLevelMesh) {
            const scaleY = Math.max(0.05, Math.min(1.0, 0.5 + (physics.waterLevelMm / 160.0)));
            this.gaugeWaterLevelMesh.scale.y = scaleY;
            this.gaugeWaterLevelMesh.position.y = -0.41 + (scaleY * 0.82) / 2;
        }

        // 3. Pressure Gauge Pointer Angle
        if (this.gaugeNeedle) {
            // 0 to 14 bar mapped to -135 deg to +135 deg
            const angle = -Math.PI * 0.75 + (physics.pressure / 14.0) * Math.PI * 1.5;
            this.gaugeNeedle.rotation.z = -angle;
        }

        // 4. Burner Status Lamp & Furnace Glow
        if (this.burnerStatusLamp) {
            if (physics.lwcoTripped || physics.eStop) {
                this.burnerStatusLamp.material.color.setHex(0xef4444); // Red trip
            } else if (physics.flameStatus) {
                this.burnerStatusLamp.material.color.setHex(0x22c55e); // Green operating
            } else {
                this.burnerStatusLamp.material.color.setHex(0xf59e0b); // Amber standby
            }
        }

        if (this.furnaceLight) {
            if (physics.flameStatus) {
                const flicker = 1.0 + (Math.random() - 0.5) * 0.15;
                this.furnaceLight.intensity = (1.5 + (physics.firingRate / 100.0) * 2.5) * flicker;
                if (physics.fuelType === 'gas') {
                    this.furnaceLight.color.setHex(0xff7700);
                } else {
                    this.furnaceLight.color.setHex(0xffaa11);
                }
            } else {
                this.furnaceLight.intensity = 0;
            }
        }

        // 5. Crown Valve Handwheel Position
        if (this.crownHandwheel) {
            this.crownHandwheel.rotation.y = (physics.crownValveOpening / 100.0) * Math.PI * 4;
        }

        // 6. Steam Distribution System Glow (warm amber pulsing with steam flow)
        if (this.steamDistLight) {
            const flow = (physics.steamProductionRate / 5000.0) * (physics.crownValveOpening / 100.0);
            const flicker = 1.0 + (Math.random() - 0.5) * 0.08;
            this.steamDistLight.intensity = flow * 1.5 * flicker;
        }

        if (this.gridMajor && this.gridMinor) {
            const isUnder = this.camera.position.y < -1.50;
            this.gridMajor.visible = !isUnder;
            this.gridMinor.visible = !isUnder;
            if (this.contactShadows) {
                for (let i = 0; i < this.contactShadows.length; i++) {
                    this.contactShadows[i].visible = !isUnder;
                }
            }
        }

        this.checkRaycast();
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    setCameraPreset(name) {
        const presets = {
            fullview:    { pos: [8.6, 4.8, 10.8], target: [1.0, 0.2, 0.0] },
            overview:    { pos: [5.6, 2.8, 6.2],  target: [0.0, 0.0, 0.0] },
            burner:      { pos: [0.2, -0.2, 4.4], target: [0, -0.4, 1.8] },
            wetback:     { pos: [-3.8, 1.2, -3.4], target: [0, -0.3, -1.8] },
            topvalves:   { pos: [0.5, 3.2, 1.4], target: [0, 1.2, 0.2] },
            watercolumn: { pos: [2.5, 0.2, 2.2], target: [1.2, 0.0, 1.0] },
            economizer:  { pos: [-2.2, 2.8, -3.2], target: [0, 1.8, -1.75] },
            bottom:      { pos: [2.2, -4.6, 9.0], target: [0.9, -0.3, 0.4] },
            fullbottom:  { pos: [2.2, -4.6, 9.0], target: [0.9, -0.3, 0.4] },
            blowdown:    { pos: [1.2, -1.7, 3.2], target: [0, -0.7, 0] },
            steamdist:   { pos: [5.0, 3.2, 6.5], target: [3.2, 0.0, 0.5] },
            feedtank:    { pos: [-5.8, 1.8, 3.2], target: [-2.6, -0.6, 0.3] }
        };

        const targetPreset = presets[name];
        if (targetPreset) {
            // Smoothly animate camera
            const startPos = this.camera.position.clone();
            const endPos = new THREE.Vector3(...targetPreset.pos);
            const startTarget = this.controls.target.clone();
            const endTarget = new THREE.Vector3(...targetPreset.target);

            let t = 0;
            const anim = () => {
                t += 0.05;
                if (t <= 1.0) {
                    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
                    this.camera.position.lerpVectors(startPos, endPos, ease);
                    this.controls.target.lerpVectors(startTarget, endTarget, ease);
                    requestAnimationFrame(anim);
                }
            };
            anim();
        }
    }

    // ── 3D Exploded Assembly System ──────────────────────────────────
    setExplodeFactor(factor) {
        this.explodeFactor = Math.max(0, Math.min(1, factor));
        this.isExploded = this.explodeFactor > 0.05;

        // Distinct mechanical explosion trajectory for every subsystem
        const explodeOffsets = {
            burner:          new THREE.Vector3( 0.0,  0.0,  3.2),  // Pull forward out of furnace throat
            frontSmokeBox:   new THREE.Vector3( 0.0,  0.1,  1.8),  // Move forward along Z
            chimney:         new THREE.Vector3( 0.0,  2.2, -0.4),  // Lift upward along Y
            topMountings:    new THREE.Vector3( 0.0,  1.6,  0.2),  // Crown and safety valves lift upward
            waterLevelGauge: new THREE.Vector3( 1.4,  0.2,  0.5),  // Slide outward to the right
            blowdown:        new THREE.Vector3( 0.0, -0.9,  0.0),  // Drop downward along -Y
            wetBack:         new THREE.Vector3( 0.0,  0.0, -2.4),  // Reversal chamber pulls rearward
            shell:           new THREE.Vector3(-1.4,  0.6,  0.0),  // Pressure shell slides out to the left
            furnace:         new THREE.Vector3( 0.0, -0.7,  0.8),  // Corrugated tube drops forward/down
            fireTubes:       new THREE.Vector3( 0.5,  0.8,  0.6),  // Tube bundle lifts up & out
            foundation:      new THREE.Vector3( 0.0, -0.2,  0.0),  // Base stays firmly grounded
            steamSystem:     new THREE.Vector3( 2.6,  0.0,  0.6),  // Process vessels & header shift right
            feedTank:        new THREE.Vector3(-2.4,  0.0,  0.0)   // Feedtank & pump shift left
        };

        for (const [key, offset] of Object.entries(explodeOffsets)) {
            if (this.parts && this.parts[key]) {
                this.parts[key].position.copy(offset).multiplyScalar(this.explodeFactor);
            }
        }

        // Fade water liquid so internal firetubes and furnace are completely visible
        if (this.waterMesh && this.waterMesh.material) {
            this.waterMesh.material.opacity = 0.62 * (1.0 - this.explodeFactor * 0.88);
        }
        if (this.waterSurfaceMesh && this.waterSurfaceMesh.material) {
            this.waterSurfaceMesh.material.opacity = 0.62 * (1.0 - this.explodeFactor * 0.88);
        }

        return this.explodeFactor;
    }

    toggleExplodedView() {
        this.isExploded = !this.isExploded;
        const startVal = this.explodeFactor || 0;
        const targetVal = this.isExploded ? 1.0 : 0.0;

        const startTime = performance.now();
        const duration = 750; // ms

        const animateExplosion = (now) => {
            const elapsed = now - startTime;
            const t = Math.min(1.0, elapsed / duration);
            const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
            const current = startVal + (targetVal - startVal) * ease;
            this.setExplodeFactor(current);

            if (this.onExplodeChange) {
                this.onExplodeChange(current);
            }

            if (t < 1.0) {
                requestAnimationFrame(animateExplosion);
            }
        };
        requestAnimationFrame(animateExplosion);
        return this.isExploded;
    }

    // Toggle Transparent / X-Ray Shell View
    toggleTransparentView() {
        this.isXRay = !this.isXRay;
        this.applyTransparentState();
        return this.isXRay;
    }

    applyTransparentState() {
        if (this.isXRay) {
            if (!this.materials.transparentShell) {
                this.materials.transparentShell = new THREE.MeshStandardMaterial({
                    color: 0x93c5fd,
                    transparent: true,
                    opacity: 0.24,
                    roughness: 0.15,
                    metalness: 0.1,
                    side: THREE.DoubleSide,
                    depthWrite: false
                });
                this.materials.transparentJacket = new THREE.MeshStandardMaterial({
                    color: 0x60a5fa,
                    transparent: true,
                    opacity: 0.08,
                    roughness: 0.1,
                    metalness: 0.1,
                    side: THREE.DoubleSide,
                    depthWrite: false
                });
                this.materials.transparentPlate = new THREE.MeshStandardMaterial({
                    color: 0x64748b,
                    transparent: true,
                    opacity: 0.3,
                    roughness: 0.2,
                    metalness: 0.15,
                    side: THREE.DoubleSide,
                    depthWrite: false
                });
            }
            if (this.shellMesh) this.shellMesh.material = this.materials.transparentShell;
            if (this.lagMesh) this.lagMesh.material = this.materials.transparentJacket;
            if (this.rearPlate) this.rearPlate.material = this.materials.transparentPlate;
            if (this.frontPlate) this.frontPlate.material = this.materials.transparentPlate;
            if (this.frontSmokeCasing) this.frontSmokeCasing.material = this.materials.transparentPlate;
            if (this.frontSmokeDoor) this.frontSmokeDoor.material = this.materials.transparentPlate;
        } else {
            if (this.shellMesh) this.shellMesh.material = this.materials.brushedSteel;
            if (this.lagMesh) this.lagMesh.material = this.materials.insulatedJacket;
            if (this.rearPlate) this.rearPlate.material = this.materials.brushedSteel;
            if (this.frontPlate) this.frontPlate.material = this.materials.brushedSteel;
            if (this.frontSmokeCasing) this.frontSmokeCasing.material = this.materials.castIron;
            if (this.frontSmokeDoor) this.frontSmokeDoor.material = this.materials.brushedSteel;
        }
    }

    // Toggle between Light Studio and Dark Studio themes
    toggleStudioTheme() {
        this.isLightMode = !this.isLightMode;
        if (this.isLightMode) {
            this.scene.background.setHex(0xb4c2d0);
            if (this.floorMat) this.floorMat.color.setHex(0x7d8e9f);
            if (this.hemiLight) {
                this.hemiLight.color.setHex(0xf1f5f9);
                this.hemiLight.groundColor.setHex(0x1e293b);
                this.hemiLight.intensity = 0.65;
            }
            if (this.keyLight) this.keyLight.intensity = 1.25;
            if (this.rimLight) this.rimLight.color.setHex(0xffffff);
        } else {
            this.scene.background.setHex(0x0b1120);
            if (this.floorMat) this.floorMat.color.setHex(0x111c30);
            if (this.hemiLight) {
                this.hemiLight.color.setHex(0x38bdf8);
                this.hemiLight.groundColor.setHex(0x0f172a);
                this.hemiLight.intensity = 0.35;
            }
            if (this.keyLight) this.keyLight.intensity = 0.95;
            if (this.rimLight) this.rimLight.color.setHex(0x38bdf8);
        }
        return this.isLightMode;
    }

    // 13. Steam Distribution System — Pans, Process Vessels, Vats, Space Heating (per uploaded diagram)
    buildSteamSystem() {
        const HDR_Y  =  1.08;   // Main steam header elevation
        const HDR_Z  =  0.0;    // Header runs along X at this Z
        const COND_Y = -1.12;   // Condensate return header elevation
        const pipeR  =  0.055;  // Steam header pipe radius
        const brR    =  0.030;  // Branch pipe radius
        const condR  =  0.025;  // Condensate pipe radius

        const pipeMat   = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.22, metalness: 0.88, envMapIntensity: 1.2 });
        const insulMat  = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.78, envMapIntensity: 0.3 });
        const condMat   = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.22, metalness: 0.75, envMapIntensity: 1.0 });
        const vesselMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.20, metalness: 0.70, envMapIntensity: 1.2 });
        const jacketMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.32, metalness: 0.30, envMapIntensity: 0.7 });
        const coilMat   = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.15, metalness: 0.92, envMapIntensity: 1.5 });

        // ── Helpers ──────────────────────────────────────────────────
        const addTrap = (x, y, z) => {
            const tGeo = new THREE.CylinderGeometry(0.038, 0.038, 0.092, 14);
            const trap = new THREE.Mesh(tGeo, this.materials.brass);
            trap.position.set(x, y, z);
            this.boilerGroup.add(trap);
            [-0.055, 0.055].forEach(dy => {
                const fGeo = new THREE.CylinderGeometry(0.050, 0.050, 0.020, 12);
                const f = new THREE.Mesh(fGeo, pipeMat);
                f.position.set(x, y + dy, z);
                this.boilerGroup.add(f);
            });
        };

        const addFlange = (x, y, z) => {
            const fGeo = new THREE.CylinderGeometry(pipeR + 0.026, pipeR + 0.026, 0.04, 16);
            fGeo.rotateZ(Math.PI / 2);
            const f = new THREE.Mesh(fGeo, this.materials.brushedSteel);
            f.position.set(x, y, z);
            this.boilerGroup.add(f);
        };

        const addHanger = (x, y, z) => {
            const sGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.28, 8);
            const s = new THREE.Mesh(sGeo, this.materials.brushedSteel);
            s.position.set(x, y - 0.14, z);
            this.boilerGroup.add(s);
            const uGeo = new THREE.TorusGeometry(pipeR + 0.01, 0.010, 8, 14, Math.PI);
            const u = new THREE.Mesh(uGeo, this.materials.chrome);
            u.position.set(x, y, z);
            u.rotation.z = Math.PI / 2;
            this.boilerGroup.add(u);
        };

        const tube = (pts, r, mat, segs = 30) => {
            const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)));
            const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, segs, r, 10, false), mat);
            this.boilerGroup.add(mesh);
            return mesh;
        };

        // ── Main Steam Header ─────────────────────────────────────────
        // Curve from crown valve outlet → header level → horizontal +X run
        tube([[0.42, 1.40, -0.20], [0.78, 1.28, -0.08], [1.00, HDR_Y, HDR_Z]], pipeR, pipeMat, 18);

        const hdrGeo = new THREE.CylinderGeometry(pipeR, pipeR, 5.08, 16);
        hdrGeo.rotateZ(Math.PI / 2);
        const hdrMesh = new THREE.Mesh(hdrGeo, pipeMat);
        hdrMesh.position.set(3.54, HDR_Y, HDR_Z);
        hdrMesh.castShadow = true;
        this.boilerGroup.add(hdrMesh);

        // Mineral-wool insulation on first 2 m
        const ins1Geo = new THREE.CylinderGeometry(pipeR + 0.022, pipeR + 0.022, 2.0, 14);
        ins1Geo.rotateZ(Math.PI / 2);
        const ins1 = new THREE.Mesh(ins1Geo, insulMat);
        ins1.position.set(2.0, HDR_Y, HDR_Z);
        this.boilerGroup.add(ins1);

        [1.5, 2.2, 3.1, 4.0, 4.85, 5.65].forEach(x => addFlange(x, HDR_Y, HDR_Z));
        [1.75, 2.65, 3.55, 4.45, 5.3].forEach(x => addHanger(x, HDR_Y, HDR_Z));

        // Header end drain pot + cap
        const ecGeo = new THREE.CylinderGeometry(pipeR * 1.25, pipeR * 1.25, 0.08, 14);
        ecGeo.rotateZ(Math.PI / 2);
        const ec = new THREE.Mesh(ecGeo, this.materials.brushedSteel);
        ec.position.set(6.09, HDR_Y, HDR_Z);
        this.boilerGroup.add(ec);
        addTrap(6.05, HDR_Y - 0.14, HDR_Z);

        // ── Condensate Return Header ───────────────────────────────────
        const condGeo2 = new THREE.CylinderGeometry(condR, condR, 5.08, 12);
        condGeo2.rotateZ(Math.PI / 2);
        const condHdr = new THREE.Mesh(condGeo2, condMat);
        condHdr.position.set(3.54, COND_Y, HDR_Z);
        this.boilerGroup.add(condHdr);

        // Condensate return routes left from x=1.0 → feedtank (built in buildFeedTank)

        // ── Steam Branch Helper (vertical drop from header to equipment) ──
        const steamBranch = (bx, bz, topY) => {
            tube([[bx, HDR_Y, HDR_Z], [bx, HDR_Y - 0.20, bz * 0.28],
                  [bx, topY + 0.18, bz * 0.75], [bx, topY + 0.04, bz]], brR, pipeMat, 28);
            addTrap(bx, topY - 0.06, bz);
            tube([[bx, topY - 0.58, bz], [bx, COND_Y + 0.08, bz * 0.45], [bx, COND_Y, HDR_Z]], condR, condMat, 18);
        };

        // ══════════════════════════════════════════════════════════════
        // 1 & 2 — JACKETED STEAM HEATING PANS
        // ══════════════════════════════════════════════════════════════
        [[2.2, 0.0], [3.3, 0.0]].forEach(([panX, panZ], idx) => {
            const panY = 0.08, panR = 0.40, panH = 0.50;

            // Orange steam jacket (open-top cylinder)
            const jGeo = new THREE.CylinderGeometry(panR, panR * 0.90, panH, 32, 1, true);
            const jacket = new THREE.Mesh(jGeo, jacketMat);
            jacket.position.set(panX, panY, panZ);
            jacket.castShadow = true;
            this.boilerGroup.add(jacket);

            // Hemispherical jacket bottom
            const jbGeo = new THREE.SphereGeometry(panR * 0.90, 28, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
            const jb = new THREE.Mesh(jbGeo, jacketMat);
            jb.position.set(panX, panY - panH * 0.5, panZ);
            jb.rotation.x = Math.PI;
            this.boilerGroup.add(jb);

            // Grey inner vessel wall
            const iGeo = new THREE.CylinderGeometry(panR * 0.80, panR * 0.72, panH * 0.90, 28, 1, true);
            const inner = new THREE.Mesh(iGeo, vesselMat);
            inner.position.set(panX, panY + 0.02, panZ);
            this.boilerGroup.add(inner);

            // Green pan contents (like source diagram)
            const cGeo = new THREE.CylinderGeometry(panR * 0.72, panR * 0.65, panH * 0.45, 24);
            const cont = new THREE.Mesh(cGeo, new THREE.MeshStandardMaterial({
                color: 0x16a34a, roughness: 0.18, transparent: true, opacity: 0.82
            }));
            cont.position.set(panX, panY - 0.08, panZ);
            this.boilerGroup.add(cont);

            // Top rim ring
            const rimGeo = new THREE.TorusGeometry(panR, 0.022, 10, 36);
            const rim = new THREE.Mesh(rimGeo, this.materials.brushedSteel);
            rim.position.set(panX, panY + panH * 0.5, panZ);
            rim.rotation.x = Math.PI / 2;
            this.boilerGroup.add(rim);

            // 4 support legs
            [[-0.26, -0.26], [0.26, -0.26], [-0.26, 0.26], [0.26, 0.26]].forEach(([dx, dz2]) => {
                const lGeo = new THREE.CylinderGeometry(0.020, 0.026, 0.52, 8);
                const leg = new THREE.Mesh(lGeo, this.materials.brushedSteel);
                leg.position.set(panX + dx, panY - panH * 0.5 - 0.26, panZ + dz2);
                this.boilerGroup.add(leg);
            });

            steamBranch(panX, panZ, panY + panH * 0.5 + 0.06);

            this.registerInteractive(jacket, {
                name: `Steam-Jacketed Heating Pan ${idx + 1}`,
                category: 'Direct-Jacket Steam Heating',
                description: 'Indirect-steam-jacketed tilting pan. Saturated steam from the main header fills the annular jacket space (orange), condensing to transfer latent heat to the pan contents through the inner wall. Condensate drains continuously via a thermostatic steam trap to the return header.',
                asmeCode: 'PED 2014/68/EU / EN 13445'
            });
        });

        // ══════════════════════════════════════════════════════════════
        // 3 & 4 — VERTICAL PROCESS VESSELS (Shell-and-Tube Heat Exchangers)
        // ══════════════════════════════════════════════════════════════
        [[4.2, 0.0], [5.1, 0.0]].forEach(([pvX, pvZ], idx) => {
            const pvY = -0.18, pvR = 0.20, pvH = 1.05;

            // Outer cylindrical shell
            const shellGeo = new THREE.CylinderGeometry(pvR, pvR, pvH, 26);
            const pvShell = new THREE.Mesh(shellGeo, vesselMat);
            pvShell.position.set(pvX, pvY, pvZ);
            pvShell.castShadow = true;
            this.boilerGroup.add(pvShell);

            // Domed heads top and bottom
            [1, -1].forEach(sign => {
                const hGeo = new THREE.SphereGeometry(pvR, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2);
                const head = new THREE.Mesh(hGeo, vesselMat);
                head.position.set(pvX, pvY + sign * pvH * 0.5, pvZ);
                if (sign < 0) head.rotation.x = Math.PI;
                this.boilerGroup.add(head);
            });

            // Internal helical coil (gold colour, visible as coil inside vessel)
            const cPts = [];
            for (let i = 0; i <= 120; i++) {
                const t = i / 120;
                const ang = t * Math.PI * 2 * 5;
                cPts.push(new THREE.Vector3(
                    pvX + Math.cos(ang) * 0.12,
                    pvY - pvH * 0.44 + t * pvH * 0.88,
                    pvZ + Math.sin(ang) * 0.12
                ));
            }
            const pvCoil = new THREE.Mesh(
                new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cPts), 100, 0.016, 8, false),
                coilMat
            );
            this.boilerGroup.add(pvCoil);

            // Top nozzle (steam in) and bottom nozzle (condensate out)
            const tnGeo = new THREE.CylinderGeometry(brR, brR, 0.20, 10);
            const tn = new THREE.Mesh(tnGeo, pipeMat);
            tn.position.set(pvX, pvY + pvH * 0.5 + 0.10, pvZ);
            this.boilerGroup.add(tn);
            const bnGeo = new THREE.CylinderGeometry(condR, condR, 0.16, 10);
            const bn = new THREE.Mesh(bnGeo, condMat);
            bn.position.set(pvX, pvY - pvH * 0.5 - 0.08, pvZ);
            this.boilerGroup.add(bn);

            // Support skirt + base plate
            const skirtGeo = new THREE.CylinderGeometry(pvR + 0.04, pvR + 0.05, 0.20, 22, 1, true);
            const skirt = new THREE.Mesh(skirtGeo, this.materials.castIron);
            skirt.position.set(pvX, pvY - pvH * 0.5 - 0.10, pvZ);
            this.boilerGroup.add(skirt);
            const bpGeo = new THREE.BoxGeometry(0.52, 0.07, 0.52);
            const bp = new THREE.Mesh(bpGeo, this.materials.castIron);
            bp.position.set(pvX, pvY - pvH * 0.5 - 0.22, pvZ);
            this.boilerGroup.add(bp);

            steamBranch(pvX, pvZ, pvY + pvH * 0.5 + 0.18);

            this.registerInteractive(pvShell, {
                name: `Vertical Process Vessel ${idx + 1} (Shell-and-Tube HX)`,
                category: 'Shell-and-Tube Heat Exchanger',
                description: 'Vertical shell-and-tube heat exchanger. Steam enters the shell side and condenses around the internal helical tube bundle carrying process fluid. Steam traps on the condensate outlet maintain liquid seal and return condensate to the boiler feedwater system.',
                asmeCode: 'ASME Sec. VIII Div.1 / EN 13445'
            });
        });

        // ══════════════════════════════════════════════════════════════
        // 5 & 6 — HORIZONTAL VATS (Internal Coil Steam Heating)
        // ══════════════════════════════════════════════════════════════
        [[2.4, 1.55], [3.5, 1.55]].forEach(([vatX, vatZ], idx) => {
            const vatY = -0.22, vatW = 0.82, vatH = 0.52, vatD = 0.60;

            // Vat outer shell
            const vGeo = new THREE.BoxGeometry(vatW, vatH, vatD);
            const vat = new THREE.Mesh(vGeo, vesselMat);
            vat.position.set(vatX, vatY, vatZ);
            vat.castShadow = true;
            this.boilerGroup.add(vat);

            // S-bend internal coil (3 passes, gold-coloured)
            const vPts = [];
            for (let i = 0; i <= 90; i++) {
                const t = i / 90;
                const seg  = Math.floor(t * 3);
                const segT = (t * 3) % 1;
                const x = (seg % 2 === 0)
                    ? vatX - vatW * 0.33 + segT * vatW * 0.66
                    : vatX + vatW * 0.33 - segT * vatW * 0.66;
                const z2 = vatZ - vatD * 0.24 + seg * vatD * 0.24;
                vPts.push(new THREE.Vector3(x, vatY - 0.06, z2));
            }
            const vatCoil = new THREE.Mesh(
                new THREE.TubeGeometry(new THREE.CatmullRomCurve3(vPts), 75, 0.022, 8, false),
                coilMat
            );
            this.boilerGroup.add(vatCoil);

            // 4 support legs
            [[-vatW*0.33, -vatD*0.23], [vatW*0.33, -vatD*0.23],
             [-vatW*0.33,  vatD*0.23], [vatW*0.33,  vatD*0.23]].forEach(([dx, dz2]) => {
                const lGeo = new THREE.CylinderGeometry(0.018, 0.022, 0.36, 8);
                const leg = new THREE.Mesh(lGeo, this.materials.brushedSteel);
                leg.position.set(vatX + dx, vatY - vatH * 0.5 - 0.18, vatZ + dz2);
                this.boilerGroup.add(leg);
            });

            // Steam supply branch from header (z=0) curving to vat (z=1.55)
            tube([[vatX, HDR_Y, HDR_Z], [vatX, HDR_Y - 0.12, vatZ * 0.38],
                  [vatX - vatW*0.24, vatY + vatH*0.5 + 0.24, vatZ * 0.82],
                  [vatX - vatW*0.24, vatY + vatH*0.5 + 0.12, vatZ]], brR, pipeMat, 32);
            addTrap(vatX - vatW*0.24, vatY + vatH*0.5 + 0.04, vatZ);

            // Condensate drain
            tube([[vatX + vatW*0.24, vatY + vatH*0.5 + 0.12, vatZ],
                  [vatX + vatW*0.24, COND_Y + 0.08, vatZ * 0.5],
                  [vatX, COND_Y, HDR_Z]], condR, condMat, 18);
            addTrap(vatX + vatW*0.24, COND_Y + 0.12, HDR_Z);

            // Inlet/outlet pipe stubs on top of vat
            [[vatX - vatW*0.24, pipeMat], [vatX + vatW*0.24, condMat]].forEach(([sx, mat]) => {
                const sGeo = new THREE.CylinderGeometry(brR, brR, 0.16, 10);
                const s = new THREE.Mesh(sGeo, mat);
                s.position.set(sx, vatY + vatH * 0.5 + 0.08, vatZ);
                this.boilerGroup.add(s);
            });

            this.registerInteractive(vat, {
                name: `Steam-Heated Processing Vat ${idx + 1}`,
                category: 'Internal-Coil Indirect Steam Heating',
                description: 'Stainless steel processing vat with an internal S-bend serpentine steam coil. Steam flows through the tube bundle, condensing to heat the vat contents by conduction and free convection — ideal for blanching, pasteurisation, and batch cooking operations.',
                asmeCode: 'PED 2014/68/EU / EHEDG Guidelines'
            });
        });

        // ══════════════════════════════════════════════════════════════
        // 7 — SPACE HEATING SERPENTINE COIL
        // ══════════════════════════════════════════════════════════════
        const SHX = 6.05, SHY = 0.34, SHZ = 0.95;
        const coilRows = 5, coilH = 0.76, coilSpan = 0.72;

        const shPts = [];
        for (let i = 0; i <= 110; i++) {
            const t = i / 110;
            const row  = Math.floor(t * coilRows);
            const rowT = (t * coilRows) % 1;
            const y = SHY - coilH * 0.5 + row * (coilH / (coilRows - 1));
            const z = (row % 2 === 0)
                ? SHZ + rowT * coilSpan
                : SHZ + coilSpan - rowT * coilSpan;
            shPts.push(new THREE.Vector3(SHX, y, z));
        }
        const shCoilMesh = new THREE.Mesh(
            new THREE.TubeGeometry(new THREE.CatmullRomCurve3(shPts), 100, 0.028, 10, false),
            this.materials.brushedSteel
        );
        this.boilerGroup.add(shCoilMesh);

        // Horizontal mounting rails
        [SHY + coilH * 0.5 + 0.07, SHY - coilH * 0.5 - 0.07].forEach(ry => {
            const rGeo = new THREE.BoxGeometry(0.055, 0.022, coilSpan + 0.12);
            const rail = new THREE.Mesh(rGeo, this.materials.castIron);
            rail.position.set(SHX, ry, SHZ + coilSpan * 0.5);
            this.boilerGroup.add(rail);
        });

        // Steam supply to space heating coil
        tube([[SHX, HDR_Y, HDR_Z], [SHX, HDR_Y * 0.72, SHZ * 0.42],
              [SHX, SHY + coilH * 0.5 + 0.16, SHZ]], brR, pipeMat, 24);
        addTrap(SHX, SHY + coilH * 0.5 + 0.04, SHZ);

        // Condensate drain from space heater
        tube([[SHX, SHY - coilH * 0.5 - 0.04, SHZ + coilSpan],
              [SHX, COND_Y + 0.05, (SHZ + coilSpan + HDR_Z) * 0.4],
              [SHX, COND_Y, HDR_Z]], condR, condMat, 20);
        addTrap(SHX, COND_Y + 0.12, HDR_Z);

        this.registerInteractive(shCoilMesh, {
            name: 'Space Heating Serpentine Steam Coil',
            category: 'HVAC Steam Space Heating',
            description: 'Horizontal fin-and-tube serpentine steam heating coil in the building air-handling unit. Steam condenses through 5 horizontal tube rows, releasing latent heat to the forced-air stream. A float-and-thermostatic trap returns condensate to the boiler feedwater system.',
            asmeCode: 'ASME B31.1 / EN ISO 6946'
        });

        // ── Dynamic ambient light near mid-header ─────────────────────
        this.steamDistLight = new THREE.PointLight(0xfed7aa, 0, 7.0, 1.6);
        this.steamDistLight.position.set(3.5, HDR_Y, HDR_Z);
        this.boilerGroup.add(this.steamDistLight);

        this.registerInteractive(hdrMesh, {
            name: 'Main Steam Distribution Header',
            category: 'Steam Distribution Pipework',
            description: 'DN100 Schedule 40 ASTM A106-B carbon steel steam main, distributing saturated steam from the boiler crown valve to 2 jacketed pans, 2 process vessels, 2 heated vats, and 1 space heating coil. Insulated with 50mm mineral wool and aluminium-sheet cladding. Sloped 1:200 toward end drain pot.',
            asmeCode: 'ASME B31.1 Power Piping / EN 13480'
        });
    }

    // 14. Feedtank & Feedpump System (per uploaded schematic diagram)
    buildFeedTank() {
        const pipeMat   = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.22, metalness: 0.88, envMapIntensity: 1.2 });
        const condMat   = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.22, metalness: 0.75, envMapIntensity: 1.0 });
        const tankMat   = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.32, metalness: 0.65, envMapIntensity: 0.9 });
        const waterMat  = new THREE.MeshStandardMaterial({ color: 0x0284c7, transparent: true, opacity: 0.60, roughness: 0.04, metalness: 0.08, envMapIntensity: 1.1 });
        const makeUpMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.22, metalness: 0.80, envMapIntensity: 1.2 });
        const pumpBodyM = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.20, metalness: 0.80, envMapIntensity: 1.3 });
        const motorMat  = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.32, metalness: 0.45, envMapIntensity: 0.8 });

        const feedR  = 0.028;
        const COND_Y = -1.12;   // must match buildSteamSystem

        const tube = (pts, r, mat, segs = 25) => {
            const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)));
            const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, segs, r, 10, false), mat);
            this.boilerGroup.add(mesh);
            return mesh;
        };
        const addValve = (x, y, z, ax = 'x') => {
            const vGeo = new THREE.CylinderGeometry(0.040, 0.040, 0.095, 16);
            if (ax === 'x') vGeo.rotateZ(Math.PI / 2);
            else if (ax === 'z') vGeo.rotateX(Math.PI / 2);
            const v = new THREE.Mesh(vGeo, this.materials.brass);
            v.position.set(x, y, z);
            this.boilerGroup.add(v);
            // Handwheel
            const hwGeo = new THREE.TorusGeometry(0.052, 0.008, 8, 20);
            const hw = new THREE.Mesh(hwGeo, this.materials.chrome);
            hw.position.set(x, y + 0.065, z);
            hw.rotation.x = Math.PI / 2;
            this.boilerGroup.add(hw);
        };

        // ══════════════════════════════════════════════════════════════
        // FEEDTANK — rectangular atmospheric tank, left of boiler
        // ══════════════════════════════════════════════════════════════
        const FTX = -2.85, FTY = -0.68, FTZ = 0.30;
        const ftW = 1.10, ftH = 0.65, ftD = 0.84;

        // Main tank body
        const ftGeo = new THREE.BoxGeometry(ftW, ftH, ftD);
        const feedTank = new THREE.Mesh(ftGeo, tankMat);
        feedTank.position.set(FTX, FTY, FTZ);
        feedTank.castShadow = true;
        feedTank.receiveShadow = true;
        this.boilerGroup.add(feedTank);

        // Interior water (blue, semi-transparent — condensate + make-up water mix)
        const waterH = ftH * 0.58;
        this.feedTankWater = new THREE.Mesh(
            new THREE.BoxGeometry(ftW - 0.06, waterH, ftD - 0.06),
            waterMat
        );
        this.feedTankWater.position.set(FTX, FTY - ftH * 0.5 + waterH * 0.5 + 0.03, FTZ);
        this.boilerGroup.add(this.feedTankWater);

        // Vented top cover (open atmospheric type — allows condensate flash)
        const lidGeo = new THREE.BoxGeometry(ftW + 0.05, 0.032, ftD + 0.05);
        const lid = new THREE.Mesh(lidGeo, tankMat);
        lid.position.set(FTX, FTY + ftH * 0.5 + 0.016, FTZ);
        this.boilerGroup.add(lid);

        // Atmospheric vent pipe (centre-top)
        const ventGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.38, 12);
        const vent = new THREE.Mesh(ventGeo, pipeMat);
        vent.position.set(FTX, FTY + ftH * 0.5 + 0.22, FTZ - ftD * 0.18);
        this.boilerGroup.add(vent);
        // Vent elbow (turns away from boiler)
        const veGeo = new THREE.TorusGeometry(0.055, 0.026, 10, 14, Math.PI / 2);
        const ve = new THREE.Mesh(veGeo, pipeMat);
        ve.position.set(FTX, FTY + ftH * 0.5 + 0.41, FTZ - ftD * 0.18);
        ve.rotation.z = Math.PI;
        this.boilerGroup.add(ve);

        // Tank support legs ×4
        [[-ftW*0.38, -ftD*0.30], [ftW*0.38, -ftD*0.30],
         [-ftW*0.38,  ftD*0.30], [ftW*0.38,  ftD*0.30]].forEach(([dx, dz]) => {
            const lGeo = new THREE.CylinderGeometry(0.024, 0.030, 0.44, 8);
            const leg = new THREE.Mesh(lGeo, this.materials.brushedSteel);
            leg.position.set(FTX + dx, FTY - ftH * 0.5 - 0.22, FTZ + dz);
            this.boilerGroup.add(leg);
            // Foot pad
            const footGeo = new THREE.CylinderGeometry(0.048, 0.048, 0.025, 12);
            const foot = new THREE.Mesh(footGeo, this.materials.castIron);
            foot.position.set(FTX + dx, FTY - ftH * 0.5 - 0.455, FTZ + dz);
            this.boilerGroup.add(foot);
        });

        // Water level sight glass (right side of tank, gold-framed)
        const sgGeo = new THREE.CylinderGeometry(0.020, 0.020, ftH * 0.78, 12);
        const sg = new THREE.Mesh(sgGeo, new THREE.MeshStandardMaterial({
            color: 0xbae6fd, transparent: true, opacity: 0.45, roughness: 0.04
        }));
        sg.position.set(FTX + ftW * 0.5 + 0.022, FTY - 0.04, FTZ + ftD * 0.22);
        this.boilerGroup.add(sg);
        // Sight glass guard posts
        [-ftH * 0.32, ftH * 0.32].forEach(dy => {
            const pg = new THREE.CylinderGeometry(0.030, 0.030, 0.025, 12);
            const pgm = new THREE.Mesh(pg, this.materials.brass);
            pgm.position.set(FTX + ftW * 0.5 + 0.022, FTY - 0.04 + dy, FTZ + ftD * 0.22);
            this.boilerGroup.add(pgm);
        });

        // Float-valve ball (make-up water auto-control)
        const fbGeo = new THREE.SphereGeometry(0.050, 16, 12);
        const fb = new THREE.Mesh(fbGeo, new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 }));
        fb.position.set(FTX - ftW * 0.30, FTY + 0.05, FTZ);
        this.boilerGroup.add(fb);
        // Float arm
        const faGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.30, 8);
        faGeo.rotateZ(Math.PI / 5);
        const fa = new THREE.Mesh(faGeo, pipeMat);
        fa.position.set(FTX - ftW * 0.14, FTY + 0.08, FTZ);
        this.boilerGroup.add(fa);

        // ══════════════════════════════════════════════════════════════
        // MAKE-UP WATER LINE (mains cold water → feedtank left side)
        // ══════════════════════════════════════════════════════════════
        // Vertical supply drop from above
        tube([
            [FTX - ftW * 0.32, 0.9, FTZ],
            [FTX - ftW * 0.32, FTY + 0.04, FTZ],
            [FTX - ftW * 0.5 - 0.04, FTY + 0.04, FTZ]   // enters left wall
        ], feedR, makeUpMat, 20);

        // Isolation valve on make-up supply
        addValve(FTX - ftW * 0.32, FTY + 0.04 + 0.12, FTZ, 'y');

        // Label pipe: extends left to show "mains water" source
        tube([
            [FTX - ftW * 0.32, 0.9, FTZ],
            [FTX - ftW * 0.32, 0.9, FTZ - 0.3],
            [-4.1, 0.9, FTZ - 0.3],
            [-4.1, 0.9, FTZ]
        ], feedR, makeUpMat, 15);

        // ══════════════════════════════════════════════════════════════
        // CONDENSATE RETURN → FEEDTANK
        // Continues from condensate header (x=1.0, y=COND_Y) to feedtank right side
        // ══════════════════════════════════════════════════════════════
        tube([
            [1.0,           COND_Y,       0.0],
            [-0.2,          COND_Y,       0.0],
            [-1.2,          COND_Y,       FTZ * 0.35],
            [-2.0,          COND_Y,       FTZ * 0.72],
            [-2.35,         COND_Y,       FTZ],          // level run at COND_Y
            [-2.35,         FTY - 0.06,   FTZ],          // rise up to tank height
            [FTX + ftW*0.5 + 0.04, FTY - 0.06, FTZ]     // into right side of tank
        ], feedR, condMat, 60);

        // Check valve on condensate inlet (prevents backflow into header)
        const cvGeo = new THREE.CylinderGeometry(0.042, 0.042, 0.10, 16);
        cvGeo.rotateZ(Math.PI / 2);
        const cv = new THREE.Mesh(cvGeo, this.materials.brass);
        cv.position.set(FTX + ftW * 0.5 + 0.06, FTY - 0.06, FTZ);
        this.boilerGroup.add(cv);

        // Condensate inlet flange on tank
        const cifGeo = new THREE.CylinderGeometry(feedR + 0.015, feedR + 0.015, 0.035, 14);
        cifGeo.rotateZ(Math.PI / 2);
        const cif = new THREE.Mesh(cifGeo, this.materials.brushedSteel);
        cif.position.set(FTX + ftW * 0.5 + 0.018, FTY - 0.06, FTZ);
        this.boilerGroup.add(cif);

        // ══════════════════════════════════════════════════════════════
        // FEEDPUMP — centrifugal pump on base, beside feedtank
        // ══════════════════════════════════════════════════════════════
        const FPX = FTX + ftW * 0.38;   // =  -2.43
        const FPY = -1.35;               // pump shaft centreline height
        const FPZ = FTZ;

        // Pump base plate (on floor)
        const bpGeo = new THREE.BoxGeometry(0.60, 0.06, 0.58);
        const bp = new THREE.Mesh(bpGeo, this.materials.castIron);
        bp.position.set(FPX, -1.51, FPZ);
        bp.receiveShadow = true;
        this.boilerGroup.add(bp);

        // Pump volute / body
        const pvGeo = new THREE.CylinderGeometry(0.145, 0.145, 0.17, 22);
        pvGeo.rotateX(Math.PI / 2);
        this.feedPumpMesh = new THREE.Mesh(pvGeo, pumpBodyM);
        this.feedPumpMesh.position.set(FPX, FPY, FPZ);
        this.feedPumpMesh.castShadow = true;
        this.boilerGroup.add(this.feedPumpMesh);

        // Suction inlet port (bottom, from tank)
        const siGeo = new THREE.CylinderGeometry(feedR + 0.008, feedR + 0.008, 0.09, 14);
        const si = new THREE.Mesh(siGeo, pumpBodyM);
        si.position.set(FPX, FPY - 0.17, FPZ);
        this.boilerGroup.add(si);

        // Discharge outlet port (right-facing)
        const doGeo = new THREE.CylinderGeometry(feedR + 0.006, feedR + 0.006, 0.09, 14);
        doGeo.rotateZ(Math.PI / 2);
        const doMesh = new THREE.Mesh(doGeo, pumpBodyM);
        doMesh.position.set(FPX + 0.155, FPY, FPZ);
        this.boilerGroup.add(doMesh);

        // Electric motor (TEFC, blue frame)
        const emGeo = new THREE.CylinderGeometry(0.125, 0.125, 0.40, 22);
        emGeo.rotateX(Math.PI / 2);
        const em = new THREE.Mesh(emGeo, motorMat);
        em.position.set(FPX, FPY, FPZ + 0.30);
        this.boilerGroup.add(em);

        // Motor cooling fins (4 fins)
        [-0.11, -0.04, 0.04, 0.11].forEach(dz => {
            const finGeo = new THREE.CylinderGeometry(0.140, 0.140, 0.022, 22);
            finGeo.rotateX(Math.PI / 2);
            const fin = new THREE.Mesh(finGeo, motorMat);
            fin.position.set(FPX, FPY, FPZ + 0.30 + dz);
            this.boilerGroup.add(fin);
        });

        // Terminal / connection box on motor top
        const tbGeo = new THREE.BoxGeometry(0.110, 0.095, 0.085);
        const tb = new THREE.Mesh(tbGeo, this.materials.castIron);
        tb.position.set(FPX, FPY + 0.145 + 0.048, FPZ + 0.30);
        this.boilerGroup.add(tb);

        // Non-return check valve on discharge
        const nrvGeo = new THREE.CylinderGeometry(0.044, 0.044, 0.105, 16);
        nrvGeo.rotateZ(Math.PI / 2);
        const nrv = new THREE.Mesh(nrvGeo, this.materials.brass);
        nrv.position.set(FPX + 0.255, FPY, FPZ);
        this.boilerGroup.add(nrv);

        // Isolation valve (suction side)
        addValve(FPX, FPY - 0.3, FPZ, 'y');

        // ── Suction pipe: tank bottom outlet → pump inlet ──────────────
        tube([
            [FTX + ftW * 0.28, FTY - ftH * 0.5 - 0.03, FTZ],   // tank bottom nozzle
            [FTX + ftW * 0.28, FPY - 0.22, FTZ],                  // drop to pump level
            [FPX,              FPY - 0.20, FTZ],                   // horizontal to pump
            [FPX,              FPY - 0.17, FTZ]                    // into pump suction
        ], feedR, pipeMat, 22);

        // Bottom outlet nozzle on tank
        const tonGeo = new THREE.CylinderGeometry(feedR + 0.010, feedR + 0.010, 0.09, 12);
        const ton = new THREE.Mesh(tonGeo, this.materials.brushedSteel);
        ton.position.set(FTX + ftW * 0.28, FTY - ftH * 0.5 - 0.045, FTZ);
        this.boilerGroup.add(ton);

        // ── Pump outlet → Boiler feedwater nozzle ──────────────────────
        // Runs: pump discharge → horizontal right → rises → boiler left side
        tube([
            [FPX + 0.310, FPY,   FPZ],
            [FPX + 0.55,  FPY,   FPZ],
            [-1.55, FPY,          FPZ * 0.55],
            [-1.55, -0.15,        FPZ * 0.18],
            [-1.22, 0.0,          0.05]             // feedwater nozzle on boiler shell
        ], feedR, pipeMat, 45);

        // Isolation valve on feedwater delivery line
        addValve(-1.55, FPY + 0.12, FPZ * 0.35, 'y');

        // Feedwater nozzle stub on boiler shell (left side)
        const fnGeo = new THREE.CylinderGeometry(feedR + 0.010, feedR + 0.010, 0.13, 12);
        fnGeo.rotateZ(Math.PI / 2);
        const fn = new THREE.Mesh(fnGeo, this.materials.brushedSteel);
        fn.position.set(-1.22 - 0.065, 0.0, 0.05);
        this.boilerGroup.add(fn);

        // ── INTERACTIVE REGISTRATIONS ───────────────────────────────────
        this.registerInteractive(feedTank, {
            name: 'Atmospheric Feedwater Tank',
            category: 'Boiler Feedwater System',
            description: 'Open-vented atmospheric feedtank collecting hot condensate returns from all process equipment via the condensate return header. A float-operated ball valve automatically admits cold make-up water to compensate for evaporation and blowdown losses. Preheated feedwater is drawn from the tank bottom by the centrifugal feedpump and delivered to the boiler at operating pressure.',
            asmeCode: 'ASME CSD-1 FW-100 / BS EN 12952-12'
        });

        this.registerInteractive(this.feedPumpMesh, {
            name: 'Centrifugal Boiler Feedpump',
            category: 'Boiler Feedwater System',
            description: 'Close-coupled centrifugal feedpump drawing preheated feedwater from the atmospheric feedtank and delivering it to the boiler drum at operating pressure + 15% minimum margin. Fitted with a non-return check valve on the outlet to prevent backflow on shutdown. Suction-side isolation valve allows pump maintenance without draining the feedtank.',
            asmeCode: 'ASME CSD-1 FW / ISO 5199'
        });
    }

    setupResize() {
        window.addEventListener('resize', () => {
            const w = this.container.clientWidth;
            const h = this.container.clientHeight;
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(w, h);
        });
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = BoilerScene;
}
