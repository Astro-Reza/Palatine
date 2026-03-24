/**
 * LEO Constellation Visualization V2
 * High-fidelity rendering adapted from Palatine 1.0
 * Updated for dynamic parameter support (Altitude, Beams, etc.)
 */


class Constellation {
    constructor(id, settings, parent) {
        this.id = id;
        this.parent = parent;
        this.settings = {
            inclination: settings.inclination || 53.0,
            satsPerPlane: settings.satsPerPlane || 22,
            planes: settings.planes || 20,
            name: settings.name || "Main Constellation",
            apogee: settings.apogee || 550,
            perigee: settings.perigee || 550,
            beamQuantity: settings.beamQuantity || 16,
            beamSize: settings.beamSize || 30 // Km
        };
        this.visible = true;
        this.totalSats = this.settings.satsPerPlane * this.settings.planes;

        this.avgAltitude = (this.settings.apogee + this.settings.perigee) / 2;
        this.unitScale = 5 / 6371;
        this.orbitRadius = 5 + (this.avgAltitude * this.unitScale);

        this.satPoints = null;
        this.orbitGroup = null;
        this.beamMesh = null;

        this.init3D();
    }

    init3D() {
        const spriteSize = 16;
        const spriteCanvas = document.createElement('canvas');
        spriteCanvas.width = spriteSize;
        spriteCanvas.height = spriteSize;
        const sCtx = spriteCanvas.getContext('2d');
        const center = spriteSize / 2;
        sCtx.fillStyle = '#ffffff';
        sCtx.beginPath();
        sCtx.arc(center, center, 4, 0, Math.PI * 2);
        sCtx.fill();
        const spriteTexture = new THREE.CanvasTexture(spriteCanvas);

        const satGeo = new THREE.BufferGeometry();
        const positions = new Float32Array(this.totalSats * 3);
        satGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const satMat = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.15,
            map: spriteTexture,
            transparent: true,
            depthWrite: false
        });
        this.satPoints = new THREE.Points(satGeo, satMat);
        this.parent.scene.add(this.satPoints);

        this.orbitGroup = new THREE.Group();
        this.parent.scene.add(this.orbitGroup);
        this.update3DOrbits();

        const alignGeometry = new THREE.ConeGeometry(1, 1, 32, 1, true);
        alignGeometry.rotateX(-Math.PI / 2);
        alignGeometry.translate(0, 0, 0.5);
        const beamMat = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            opacity: 0.1,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        this.beamMesh = new THREE.InstancedMesh(alignGeometry, beamMat, this.totalSats);
        this.parent.scene.add(this.beamMesh);
    }

    getSatellitePosition(satIndex, timeOffset) {
        const numPlanes = this.settings.planes;
        const inclination = (this.settings.inclination * Math.PI) / 180;
        const satsPerPlane = this.settings.satsPerPlane;
        const planeIdx = satIndex % numPlanes;
        const satIdxInPlane = Math.floor(satIndex / numPlanes);

        const raan = (planeIdx / numPlanes) * 2 * Math.PI;
        let anomaly = (satIdxInPlane / satsPerPlane) * 2 * Math.PI;
        anomaly += (planeIdx * 0.5);
        anomaly += timeOffset;

        const sinLat = Math.sin(inclination) * Math.sin(anomaly);
        const lat = Math.asin(Math.max(-1, Math.min(1, sinLat)));
        const y = Math.cos(inclination) * Math.sin(anomaly);
        const x = Math.cos(anomaly);
        const lon = Math.atan2(y, x) + raan;

        let lonDeg = (lon * 180) / Math.PI;
        let latDeg = (lat * 180) / Math.PI;

        // Wrap longitude -180 to 180
        lonDeg = ((lonDeg + 180) % 360 + 360) % 360 - 180;

        return {
            lat: latDeg,
            lon: lonDeg
        };
    }

    update3D(timeOffset) {
        if (!this.visible) {
            if (this.satPoints) this.satPoints.visible = false;
            if (this.orbitGroup) this.orbitGroup.visible = false;
            if (this.beamMesh) this.beamMesh.visible = false;
            return;
        }

        const isFocusActive = this.parent.focusedSat !== null;
        const isFocusedConstellation = isFocusActive && this.parent.focusedSat.constellation === this;

        if (this.satPoints) this.satPoints.visible = true;

        // Hide all orbits during focus
        if (this.orbitGroup) {
            this.orbitGroup.visible = !isFocusActive && (this.parent.layers.ascending || this.parent.layers.descending);
        }

        // Handle beam visibility
        if (this.beamMesh) {
            const beamsRequested = this.parent.layers.intra || this.parent.layers.inter;
            if (isFocusActive) {
                // Completely hide standard beams during focus; multi-beam will take over
                this.beamMesh.visible = false;
            } else {
                this.beamMesh.visible = beamsRequested;
            }
        }

        const positions = this.satPoints.geometry.attributes.position.array;
        const dummy = new THREE.Object3D();
        const earthCenter = new THREE.Vector3(0, 0, 0);

        for (let i = 0; i < this.totalSats; i++) {
            const pos = this.getSatellitePosition(i, timeOffset);
            const vec3 = this.parent.latLonToVector3(pos.lat, pos.lon, this.orbitRadius);

            positions[i * 3] = vec3.x;
            positions[i * 3 + 1] = vec3.y;
            positions[i * 3 + 2] = vec3.z;

            if (this.beamMesh && this.beamMesh.visible) {
                // If focus is active, only show the beam for the focused satellite index
                const shouldShowBeam = !isFocusActive || (isFocusedConstellation && i === this.parent.focusedSat.index);

                if (shouldShowBeam) {
                    dummy.position.copy(vec3);
                    dummy.lookAt(earthCenter);
                    const dist = this.orbitRadius - 5;

                    let beamRadiusKm = this.settings.beamSize / 2;
                    if (!isFocusActive) {
                        beamRadiusKm *= Math.sqrt(this.settings.beamQuantity || 1);
                    }
                    const altitudeKm = this.avgAltitude;
                    const angle = Math.atan(beamRadiusKm / altitudeKm);

                    const radius = dist * Math.tan(angle);
                    dummy.scale.set(radius, radius, dist);
                } else {
                    // Hide other beams in the same constellation
                    dummy.scale.set(0, 0, 0);
                }
                dummy.updateMatrix();
                this.beamMesh.setMatrixAt(i, dummy.matrix);
            }
        }
        if (this.satPoints) this.satPoints.geometry.attributes.position.needsUpdate = true;
        if (this.beamMesh && this.beamMesh.visible) this.beamMesh.instanceMatrix.needsUpdate = true;
    }
    update3DOrbits() {
        if (!this.orbitGroup) return;
        while (this.orbitGroup.children.length > 0) {
            const child = this.orbitGroup.children[0];
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
            this.orbitGroup.remove(child);
        }

        const showAsc = this.parent.layers.ascending;
        const showDesc = this.parent.layers.descending;
        if (!showAsc && !showDesc) return;

        const numPlanes = this.settings.planes;
        const inclination = (this.settings.inclination * Math.PI) / 180;
        const steps = 128;
        const ascColor = new THREE.Color(0xcce971);
        const descColor = new THREE.Color(0xffcc00);

        for (let p = 0; p < numPlanes; p++) {
            const raan = (p / numPlanes) * 2 * Math.PI;
            let ascPts = [], descPts = [];

            for (let i = 0; i <= steps; i++) {
                // Shift phase by -PI/2 so ascending (-PI/2 to PI/2) is contiguous
                const anomaly = ((i / steps) * 2 * Math.PI) - (Math.PI / 2);
                const sinLat = Math.sin(inclination) * Math.sin(anomaly);
                const lat = Math.asin(Math.max(-1, Math.min(1, sinLat)));
                const yArg = Math.cos(inclination) * Math.sin(anomaly);
                const xArg = Math.cos(anomaly);
                const lon = Math.atan2(yArg, xArg) + raan;
                const latDeg = (lat * 180) / Math.PI;
                const lonDeg = (lon * 180) / Math.PI;
                const v = this.parent.latLonToVector3(latDeg, lonDeg, this.orbitRadius);

                if (Math.cos(anomaly) > 0) ascPts.push(v);
                else descPts.push(v);
            }

            if (showAsc && ascPts.length > 1) {
                const g = new THREE.BufferGeometry().setFromPoints(ascPts);
                this.orbitGroup.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: ascColor, opacity: 0.5, transparent: true })));
            }
            if (showDesc && descPts.length > 1) {
                const g = new THREE.BufferGeometry().setFromPoints(descPts);
                this.orbitGroup.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: descColor, opacity: 0.5, transparent: true })));
            }
        }
    }

    draw2D(ctx, timeOffset) {
        if (!this.visible) return;

        // Draw Orbits — split by ascending / descending
        const showAsc = this.parent.layers.ascending;
        const showDesc = this.parent.layers.descending;
        if (showAsc || showDesc) {
            const numPlanes = this.settings.planes;
            const inclination = (this.settings.inclination * Math.PI) / 180;
            const steps = 128;
            ctx.lineWidth = 1;
            const ascColor = '#cce971';
            const descColor = '#ffcc00';
            const W = window.innerWidth;

            for (let p = 0; p < numPlanes; p++) {
                const raan = (p / numPlanes) * 2 * Math.PI;
                let ascPts = [], descPts = [];
                let prevXA = -9999, prevXD = -9999;

                for (let i = 0; i <= steps; i++) {
                    // Shift phase by -PI/2 so ascending half is contiguous
                    const anomaly = ((i / steps) * 2 * Math.PI) - (Math.PI / 2);
                    const sinLat = Math.sin(inclination) * Math.sin(anomaly);
                    const lat = Math.asin(Math.max(-1, Math.min(1, sinLat)));
                    const yArg = Math.cos(inclination) * Math.sin(anomaly);
                    const xArg = Math.cos(anomaly);
                    let lon = Math.atan2(yArg, xArg) + raan;
                    lon = (lon + Math.PI) % (2 * Math.PI) - Math.PI;

                    let lonDeg = (lon * 180) / Math.PI;
                    let latDeg = (lat * 180) / Math.PI;
                    lonDeg = ((lonDeg + 180) % 360 + 360) % 360 - 180;

                    const xy = this.parent.latLonToXY(latDeg, lonDeg);
                    const isAsc = Math.cos(anomaly) > 0;

                    if (isAsc) {
                        // Flush descending segment
                        if (showDesc && descPts.length > 1) {
                            ctx.strokeStyle = descColor; ctx.globalAlpha = 0.6; ctx.beginPath();
                            ctx.moveTo(descPts[0][0], descPts[0][1]);
                            for (let k = 1; k < descPts.length; k++) ctx.lineTo(descPts[k][0], descPts[k][1]);
                            ctx.stroke(); ctx.globalAlpha = 1;
                        }
                        descPts = []; prevXD = -9999;
                        // Break ascending on anti-meridian wrap
                        if (Math.abs(xy.x - prevXA) > W / 2 && prevXA !== -9999) {
                            if (showAsc && ascPts.length > 1) {
                                ctx.strokeStyle = ascColor; ctx.globalAlpha = 0.6; ctx.beginPath();
                                ctx.moveTo(ascPts[0][0], ascPts[0][1]);
                                for (let k = 1; k < ascPts.length; k++) ctx.lineTo(ascPts[k][0], ascPts[k][1]);
                                ctx.stroke(); ctx.globalAlpha = 1;
                            }
                            ascPts = [];
                        }
                        ascPts.push([xy.x, xy.y]); prevXA = xy.x;
                    } else {
                        // Flush ascending segment
                        if (showAsc && ascPts.length > 1) {
                            ctx.strokeStyle = ascColor; ctx.globalAlpha = 0.6; ctx.beginPath();
                            ctx.moveTo(ascPts[0][0], ascPts[0][1]);
                            for (let k = 1; k < ascPts.length; k++) ctx.lineTo(ascPts[k][0], ascPts[k][1]);
                            ctx.stroke(); ctx.globalAlpha = 1;
                        }
                        ascPts = []; prevXA = -9999;
                        // Break descending on anti-meridian wrap
                        if (Math.abs(xy.x - prevXD) > W / 2 && prevXD !== -9999) {
                            if (showDesc && descPts.length > 1) {
                                ctx.strokeStyle = descColor; ctx.globalAlpha = 0.6; ctx.beginPath();
                                ctx.moveTo(descPts[0][0], descPts[0][1]);
                                for (let k = 1; k < descPts.length; k++) ctx.lineTo(descPts[k][0], descPts[k][1]);
                                ctx.stroke(); ctx.globalAlpha = 1;
                            }
                            descPts = [];
                        }
                        descPts.push([xy.x, xy.y]); prevXD = xy.x;
                    }
                }
                // Flush remaining segments
                if (showAsc && ascPts.length > 1) {
                    ctx.strokeStyle = ascColor; ctx.globalAlpha = 0.6; ctx.beginPath();
                    ctx.moveTo(ascPts[0][0], ascPts[0][1]);
                    for (let k = 1; k < ascPts.length; k++) ctx.lineTo(ascPts[k][0], ascPts[k][1]);
                    ctx.stroke(); ctx.globalAlpha = 1;
                }
                if (showDesc && descPts.length > 1) {
                    ctx.strokeStyle = descColor; ctx.globalAlpha = 0.6; ctx.beginPath();
                    ctx.moveTo(descPts[0][0], descPts[0][1]);
                    for (let k = 1; k < descPts.length; k++) ctx.lineTo(descPts[k][0], descPts[k][1]);
                    ctx.stroke(); ctx.globalAlpha = 1;
                }
            }
        }

        // Draw Satellites
        const offset = 1.5;
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < this.totalSats; i++) {
            const pos = this.getSatellitePosition(i, timeOffset);
            const xy = this.parent.latLonToXY(pos.lat, pos.lon);
            ctx.fillRect(xy.x - offset, xy.y - offset, offset * 2, offset * 2);
        }
    }
}

class OrbitManager {
    constructor() {
        this.canvas2D = document.getElementById('orbit-canvas');
        this.container3D = document.getElementById('orbit-container-3d');
        this.ctx = this.canvas2D.getContext('2d');
        this.mode = '3D';

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.earthRadius = 5;

        this.constellations = [];
        this.layers = {
            ascending: true,
            descending: true,
            intra: true,
            inter: true,
            borders: false,
            latLonGrid: false
        };

        this.boundaryData = null;

        // Time Management
        this.timeOffset = 0;
        this.timeMultiplier = 1.0;
        this.isPaused = false;
        this.syncUTC = false;
        this.startTime = Date.now();
        this.lastFrameTime = 0;
        this.earthImage = null;

        this.focusedSat = null;
        this.defaultCameraPos = new THREE.Vector3(0, 15, 25);
        this.defaultTarget = new THREE.Vector3(0, 0, 0);

        this.init();
    }

    init() {
        this.init3D();
        this.setupCanvas();
        this.loadAssets();
        this.setMode('3D');

        requestAnimationFrame((t) => this.animate(t));
        window.addEventListener('resize', () => this.handleResize());
    }

    init3D() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 5000);
        this.camera.position.set(0, 15, 25);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container3D.appendChild(this.renderer.domElement);

        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.minDistance = 1; // Allow extreme zoom
        this.controls.maxDistance = 1000;

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
        this.scene.add(ambientLight);

        const sunPos = new THREE.Vector3(-50, 20, -50).normalize();
        const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
        sunLight.position.copy(sunPos).multiplyScalar(100);
        this.scene.add(sunLight);

        const textureLoader = new THREE.TextureLoader();
        const dayTex = textureLoader.load('/static/textures/8k_earth_daymap.jpg');
        const nightTex = textureLoader.load('/static/textures/8k_earth_nightmap.jpg');

        const earthShaderMat = new THREE.ShaderMaterial({
            uniforms: {
                dayTexture: { value: dayTex },
                nightTexture: { value: nightTex },
                sunDirection: { value: sunPos }
            },
            vertexShader: `
                varying vec2 vUv;
                varying vec3 vNormalWorld;
                void main() {
                    vUv = uv;
                    vNormalWorld = normalize(mat3(modelMatrix) * normal);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D dayTexture;
                uniform sampler2D nightTexture;
                uniform vec3 sunDirection;
                varying vec2 vUv;
                varying vec3 vNormalWorld;
                void main() {
                    float intensity = dot(vNormalWorld, sunDirection);
                    float mixVal = smoothstep(-0.2, 0.2, intensity);
                    vec3 dayColor = texture2D(dayTexture, vUv).rgb;
                    vec3 nightColor = texture2D(nightTexture, vUv).rgb;
                    gl_FragColor = vec4(mix(nightColor, dayColor, mixVal), 1.0);
                }
            `
        });

        const earthGeo = new THREE.SphereGeometry(this.earthRadius, 64, 64);
        this.earthMesh = new THREE.Mesh(earthGeo, earthShaderMat);
        this.scene.add(this.earthMesh);

        const starTex = textureLoader.load('/static/textures/8k_stars_milky_way.jpg');
        const starGeo = new THREE.SphereGeometry(2000, 32, 32);
        const starMat = new THREE.MeshBasicMaterial({
            map: starTex,
            side: THREE.BackSide,
            transparent: true,
            opacity: 0.8
        });
        this.scene.add(new THREE.Mesh(starGeo, starMat));

        // Multi-beam visualization for focused satellite
        this.initMultiBeam();

        // Geographic boundaries
        this.boundaryGroup = new THREE.Group();
        this.boundaryGroup.visible = false;
        if (this.earthMesh) {
            this.earthMesh.add(this.boundaryGroup);
        } else {
            this.scene.add(this.boundaryGroup);
        }

        // Lat/Lon Grid
        this.latLonGroup = new THREE.Group();
        this.latLonGroup.visible = false;
        if (this.earthMesh) {
            this.earthMesh.add(this.latLonGroup);
        } else {
            this.scene.add(this.latLonGroup);
        }

        this.loadBoundaries();
        this.buildLatLonGrid();
    }

    async loadBoundaries() {
        // Point this to your new GeoJSON file
        const url = '/static/textures/geoBoundaries.geojson';

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            // Parse the JSON directly into a native JavaScript object
            this.boundaryData = await response.json();

            // Material for the borders (Neon green, slightly transparent)
            const material = new THREE.LineBasicMaterial({
                color: 0xcdfa71,
                opacity: 0.5,
                transparent: true,
                depthWrite: false
            });

            // Iterate through the standard GeoJSON features
            this.boundaryData.features.forEach(feature => {
                const geometry = feature.geometry;

                if (!geometry) return; // Skip features with no geometry

                // GeoJSON Polygons are arrays of LinearRings
                if (geometry.type === 'Polygon') {
                    // geometry.coordinates[0] is the exterior ring
                    this.drawBoundary(geometry.coordinates[0], material);
                }
                // MultiPolygons are arrays of Polygons
                else if (geometry.type === 'MultiPolygon') {
                    geometry.coordinates.forEach(polygon => {
                        this.drawBoundary(polygon[0], material);
                    });
                }
            });

            // Set initial visibility based on your layers setting
            this.boundaryGroup.visible = this.layers.borders;

        } catch (e) {
            console.error("Failed to load geo boundaries:", e);
        }
    }

    drawBoundary(coords, material) {
        const points = [];

        coords.forEach(coord => {
            const lon = coord[0];
            const lat = coord[1];

            // Radius 5.002 ensures the lines float just above your Earth mesh (radius 5.0)
            const vec = this.latLonToVector3(lat, lon, 5.002);
            points.push(vec);
        });

        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geo, material);
        this.boundaryGroup.add(line);
    }

    buildLatLonGrid() {
        const material = new THREE.LineBasicMaterial({
            color: 0xffffff,
            opacity: 0.15,
            transparent: true,
            depthWrite: false
        });

        const radius = 5.001; // Slightly above the earth mesh
        const segments = 64;

        // Latitudes (every 10 degrees)
        for (let lat = -80; lat <= 80; lat += 10) {
            const points = [];
            for (let lon = -180; lon <= 180; lon += 360 / segments) {
                points.push(this.latLonToVector3(lat, lon, radius));
            }
            const geo = new THREE.BufferGeometry().setFromPoints(points);
            this.latLonGroup.add(new THREE.Line(geo, material));
        }

        // Longitudes (every 10 degrees)
        for (let lon = -180; lon < 180; lon += 10) {
            const points = [];
            for (let lat = -90; lat <= 90; lat += 180 / segments) {
                points.push(this.latLonToVector3(lat, lon, radius));
            }
            const geo = new THREE.BufferGeometry().setFromPoints(points);
            this.latLonGroup.add(new THREE.Line(geo, material));
        }
    }

    initMultiBeam() {
        const MXB = 512; // Max beams for one sat
        const bGeo = new THREE.ConeGeometry(1, 1, 16, 1, true);
        bGeo.translate(0, -0.5, 0);
        bGeo.rotateX(-Math.PI / 2);
        const bMat = new THREE.MeshBasicMaterial({
            color: 0x33aaff,
            transparent: true,
            opacity: 0.15,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        this.multiBeamMesh = new THREE.InstancedMesh(bGeo, bMat, MXB);
        this.multiBeamMesh.visible = false;
        this.scene.add(this.multiBeamMesh);

        const fpGeo = new THREE.CircleGeometry(1, 24);
        const fpMat = new THREE.MeshBasicMaterial({
            color: 0x1166aa,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        this.footprintMesh = new THREE.InstancedMesh(fpGeo, fpMat, MXB);
        this.footprintMesh.visible = false;
        this.scene.add(this.footprintMesh);

        // Pre-generate random colors
        this.multiBeamColors = new Float32Array(MXB * 3);
        for (let i = 0; i < MXB; i++) {
            const h = (i * 137.508) % 360;
            const c = new THREE.Color().setHSL(h / 360, 0.8, 0.55);
            this.multiBeamColors[i * 3] = c.r;
            this.multiBeamColors[i * 3 + 1] = c.g;
            this.multiBeamColors[i * 3 + 2] = c.b;
            this.multiBeamMesh.setColorAt(i, c);
            this.footprintMesh.setColorAt(i, c);
        }
    }

    setupCanvas() {
        const dpr = window.devicePixelRatio || 1;
        this.canvas2D.width = window.innerWidth * dpr;
        this.canvas2D.height = window.innerHeight * dpr;
        this.ctx.scale(dpr, dpr);
    }

    loadAssets() {
        this.earthImage = new Image();
        this.earthImage.src = '/static/textures/8k_earth_daymap.jpg';
    }

    addConstellation(settings) {
        const id = this.constellations.length;
        const constellation = new Constellation(id, settings, this);
        this.constellations.push(constellation);
        return constellation;
    }

    removeConstellation(index) {
        if (index < 0 || index >= this.constellations.length) return;
        
        const c = this.constellations[index];
        if (this.scene) {
            this.scene.remove(c.satPoints);
            this.scene.remove(c.orbitGroup);
            this.scene.remove(c.beamMesh);
        }
        
        if (this.focusedSat && this.focusedSat.constellation === c) {
            this.focusOnSatellite(); // This will turn off focus
        }
        
        this.constellations.splice(index, 1);
        // If in 2D mode, redraw to reflect the change immediately
        if (this.mode === '2D') this.draw2D();
    }

    toggleConstellationVisibility(index) {
        if (this.constellations[index]) {
            this.constellations[index].visible = !this.constellations[index].visible;
        }
    }

    toggleLayer(layer, state) {
        if (this.layers.hasOwnProperty(layer)) {
            this.layers[layer] = state;
            // Rebuild 3D orbits when ascending/descending toggles change
            if (layer === 'ascending' || layer === 'descending') {
                this.constellations.forEach(c => c.update3DOrbits());
            }
        }
    }

    setMode(mode) {
        this.mode = mode;
        if (mode === '2D') {
            this.container3D.style.display = 'none';
            this.canvas2D.style.display = 'block';
        } else {
            this.container3D.style.display = 'block';
            this.canvas2D.style.display = 'none';
        }
        this.handleResize();
    }

    focusOnSatellite(constellationIndex = null) {
        if (this.focusedSat) {
            // Turning OFF focus
            this.focusedSat = null;
            this.camera.position.copy(this.defaultCameraPos);
            this.controls.target.copy(this.defaultTarget);
            this.controls.update();
            return false; // Return false to indicate focus is OFF
        }

        if (this.constellations.length === 0) return false;

        let constellation, satIndex;
        if (constellationIndex !== null && this.constellations[constellationIndex]) {
            constellation = this.constellations[constellationIndex];
            satIndex = Math.floor(Math.random() * constellation.totalSats);
        } else {
            // Pick a random constellation and satellite
            constellation = this.constellations[Math.floor(Math.random() * this.constellations.length)];
            satIndex = Math.floor(Math.random() * constellation.totalSats);
        }

        this.focusedSat = { constellation, index: satIndex };

        if (this.mode === '3D') {
            const pos = constellation.getSatellitePosition(satIndex, this.timeOffset);
            const vec3 = this.latLonToVector3(pos.lat, pos.lon, constellation.orbitRadius);

            // Zoom in extremely close
            const camOffset = vec3.clone().normalize().multiplyScalar(0.01);
            const targetPos = vec3.clone().add(camOffset);

            this.camera.position.copy(targetPos);
            this.controls.target.copy(vec3);
            this.controls.update();
        }
        return true;
    }

    latLonToVector3(lat, lon, radius) {
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (lon + 180) * (Math.PI / 180);
        const x = -(radius * Math.sin(phi) * Math.cos(theta));
        const z = (radius * Math.sin(phi) * Math.sin(theta));
        const y = (radius * Math.cos(phi));
        return new THREE.Vector3(x, y, z);
    }

    latLonToXY(lat, lon) {
        const x = ((lon + 180) / 360) * window.innerWidth;
        const y = ((90 - lat) / 180) * window.innerHeight;
        return { x, y };
    }

    handleResize() {
        this.setupCanvas();
        if (this.camera && this.renderer) {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        }
    }

    animate(timestamp) {
        if (!this.lastFrameTime) this.lastFrameTime = timestamp;
        const delta = timestamp - this.lastFrameTime;
        this.lastFrameTime = timestamp;

        if (!this.isPaused) {
            if (this.syncUTC) {
                // timeOffset represents real-world seconds since epoch
                this.timeOffset = Date.now() / 1000;
            } else {
                // timeOffset is simulated seconds elapsed
                this.timeOffset += (delta / 1000) * this.timeMultiplier;
            }
        }

        // Calculate unified satellite angle (1 orbit = 5400s)
        const satAngle = this.timeOffset * (2 * Math.PI / 5400);

        // Update UI
        this.updateUI();

        if (this.mode === '3D') {
            this.constellations.forEach(c => c.update3D(satAngle));
            if (this.earthMesh) {
                // Earth rotates 1 full turn per 86400 seconds
                this.earthMesh.rotation.y = this.timeOffset * (2 * Math.PI / 86400);
            }

            if (this.focusedSat) {
                const pos = this.focusedSat.constellation.getSatellitePosition(this.focusedSat.index, satAngle);
                const vec3 = this.latLonToVector3(pos.lat, pos.lon, this.focusedSat.constellation.orbitRadius);

                // Follow the satellite by moving camera by the same delta as target
                const targetDelta = vec3.clone().sub(this.controls.target);
                this.camera.position.add(targetDelta);
                this.controls.target.copy(vec3);

                // Update multi-beam
                this.updateMultiBeam(vec3, this.focusedSat.constellation);
            } else {
                if (this.multiBeamMesh) this.multiBeamMesh.visible = false;
                if (this.footprintMesh) this.footprintMesh.visible = false;
            }

            // Show boundaries during focus OR if toggled manually
            if (this.boundaryGroup) {
                const shouldShow = this.layers.borders || (this.focusedSat !== null);
                if (this.boundaryGroup.visible !== shouldShow) {
                    this.boundaryGroup.visible = shouldShow;
                }
            }

            if (this.latLonGroup) {
                if (this.latLonGroup.visible !== this.layers.latLonGrid) {
                    this.latLonGroup.visible = this.layers.latLonGrid;
                }
            }

            this.controls.update();
            this.renderer.render(this.scene, this.camera);
        } else {
            this.ctx.fillStyle = '#050505';
            this.ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
            if (this.earthImage.complete) {
                this.ctx.globalAlpha = 0.4;
                this.ctx.drawImage(this.earthImage, 0, 0, window.innerWidth, window.innerHeight);
                this.ctx.globalAlpha = 1.0;
            }

            // Draw boundaries if toggled
            if (this.layers.borders) {
                this.draw2DBoundaries();
            }

            if (this.layers.latLonGrid) {
                this.draw2DLatLonGrid();
            }

            this.constellations.forEach(c => c.draw2D(this.ctx, satAngle));
        }

        requestAnimationFrame((t) => this.animate(t));
    }

    draw2DBoundaries() {
        if (!this.boundaryData) {
            console.warn("Geo boundary data still loading...");
            return;
        }
        this.ctx.strokeStyle = '#cdfa71';
        this.ctx.lineWidth = 1;
        this.ctx.globalAlpha = 0.7;

        this.boundaryData.features.forEach(feature => {
            const geometry = feature.geometry;
            if (geometry.type === 'Polygon') {
                this.draw2DPolygon(geometry.coordinates[0]);
            } else if (geometry.type === 'MultiPolygon') {
                geometry.coordinates.forEach(poly => {
                    this.draw2DPolygon(poly[0]);
                });
            }
        });
        this.ctx.globalAlpha = 1.0;
    }

    draw2DPolygon(coords) {
        this.ctx.beginPath();
        let first = true;
        let prevLon = null;
        coords.forEach(coord => {
            const lon = coord[0];
            const lat = coord[1];
            const xy = this.latLonToXY(lat, lon);
            if (first) {
                this.ctx.moveTo(xy.x, xy.y);
                first = false;
            } else {
                if (prevLon !== null && Math.abs(lon - prevLon) > 180) {
                    this.ctx.moveTo(xy.x, xy.y);
                } else {
                    this.ctx.lineTo(xy.x, xy.y);
                }
            }
            prevLon = lon;
        });
        this.ctx.stroke();
    }

    draw2DLatLonGrid() {
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 1;
        this.ctx.globalAlpha = 0.15;
        this.ctx.beginPath();
        
        // Latitudes
        for (let lat = -80; lat <= 80; lat += 10) {
            const xy1 = this.latLonToXY(lat, -180);
            const xy2 = this.latLonToXY(lat, 180);
            this.ctx.moveTo(xy1.x, xy1.y);
            this.ctx.lineTo(xy2.x, xy2.y);
        }
        
        // Longitudes
        for (let lon = -180; lon <= 180; lon += 10) {
            const xy1 = this.latLonToXY(-90, lon);
            const xy2 = this.latLonToXY(90, lon);
            this.ctx.moveTo(xy1.x, xy1.y);
            this.ctx.lineTo(xy2.x, xy2.y);
        }
        this.ctx.stroke();
        this.ctx.globalAlpha = 1.0;
    }

    updateMultiBeam(satPos, constellation) {
        if (!this.multiBeamMesh || !this.footprintMesh) return;

        const beamsRequested = this.layers.intra || this.layers.inter;
        if (!beamsRequested) {
            this.multiBeamMesh.visible = false;
            this.footprintMesh.visible = false;
            return;
        }

        this.multiBeamMesh.visible = true;
        this.footprintMesh.visible = true;

        const MXB = this.multiBeamMesh.count;
        const nBeams = constellation.settings.beamQuantity || 64;

        // Calculate half-angle from constellation beamSize setting
        const beamRadiusKm = constellation.settings.beamSize / 2;
        const altitudeKm = constellation.avgAltitude;
        const ha = Math.atan(beamRadiusKm / altitudeKm);

        // Hex grid spacing
        const spacingAngle = 2 * ha * 0.87;
        const rowH = spacingAngle * Math.sqrt(3) / 2;
        // Expand field of regard to ensure enough beams can be generated
        const maxAngle = 60 * (Math.PI / 180);

        const hexPts = [];
        // Ensure we calculate enough rings to satisfy nBeams
        const maxRings = Math.max(10, Math.ceil(Math.sqrt(nBeams)));
        for (let row = -maxRings; row <= maxRings; row++) {
            const y = row * rowH;
            const xOff = (row % 2 !== 0) ? spacingAngle / 2 : 0;
            for (let col = -maxRings; col <= maxRings; col++) {
                const x = col * spacingAngle + xOff;
                const r = Math.sqrt(x * x + y * y);
                // Still bound by physics/FOV, but much wider now
                if (r <= maxAngle) hexPts.push({ x, y, r });
            }
        }
        hexPts.sort((a, b) => a.r - b.r);

        const nadirDir = satPos.clone().normalize();
        const up = nadirDir.clone();
        let east = new THREE.Vector3(0, 1, 0).cross(up).normalize();
        if (east.length() < 0.01) east.set(1, 0, 0).cross(up).normalize();
        const north = up.clone().cross(east).normalize();

        const bDum = new THREE.Object3D();
        const fpDum = new THREE.Object3D();
        const hideM = new THREE.Matrix4().makeScale(0, 0, 0);
        const ER = 5; // Scene earth radius

        let activeCount = 0;
        const totalToRender = Math.min(nBeams, hexPts.length, MXB);

        for (let i = 0; i < totalToRender; i++) {
            const hp = hexPts[i];
            const sinOff = Math.sin(hp.r), cosOff = Math.cos(hp.r);
            const azimuth = Math.atan2(hp.x, hp.y);
            const sinAz = Math.sin(azimuth), cosAz = Math.cos(azimuth);

            const dir = new THREE.Vector3()
                .addScaledVector(up, -cosOff)
                .addScaledVector(north, sinOff * cosAz)
                .addScaledVector(east, sinOff * sinAz)
                .normalize();

            const oc2 = satPos.dot(dir);
            const det = oc2 * oc2 - (satPos.lengthSq() - ER * ER);

            // Intersection with Earth
            if (det < 0) {
                this.multiBeamMesh.setMatrixAt(i, hideM);
                this.footprintMesh.setMatrixAt(i, hideM);
                continue;
            }

            const t = -oc2 - Math.sqrt(det);
            const groundPt = satPos.clone().add(dir.clone().multiplyScalar(t));

            // Beam Cone
            bDum.position.copy(satPos);
            bDum.lookAt(groundPt);
            const coneR = Math.tan(ha) * t;
            bDum.scale.set(coneR, coneR, t);
            bDum.updateMatrix();
            this.multiBeamMesh.setMatrixAt(i, bDum.matrix);

            // Footprint
            const gNorm = groundPt.clone().normalize();
            fpDum.position.copy(groundPt.clone().add(gNorm.clone().multiplyScalar(0.01)));
            fpDum.lookAt(fpDum.position.clone().add(gNorm));
            fpDum.scale.set(coneR, coneR, 1);
            fpDum.updateMatrix();
            this.footprintMesh.setMatrixAt(i, fpDum.matrix);

            // Generate stable but distinct colors based on index relative to beam quantity
            // Using a higher saturation and distinct hue steps
            const hue = (i * (360 / Math.min(nBeams, 24))) % 360;
            const c = new THREE.Color().setHSL(hue / 360, 0.9, 0.6);
            this.multiBeamMesh.setColorAt(i, c);
            this.footprintMesh.setColorAt(i, c);

            activeCount++;
        }

        for (let i = activeCount; i < MXB; i++) {
            this.multiBeamMesh.setMatrixAt(i, hideM);
            this.footprintMesh.setMatrixAt(i, hideM);
        }

        this.multiBeamMesh.instanceMatrix.needsUpdate = true;
        this.footprintMesh.instanceMatrix.needsUpdate = true;
        if (this.multiBeamMesh.instanceColor) this.multiBeamMesh.instanceColor.needsUpdate = true;
        if (this.footprintMesh.instanceColor) this.footprintMesh.instanceColor.needsUpdate = true;
    }

    updateUI() {
        const timeDisplay = document.getElementById('time-display');
        const multDisplay = document.getElementById('multiplier-display');
        const satCountDisplay = document.getElementById('sat-count');
        const planeCountDisplay = document.getElementById('plane-count');

        if (multDisplay) multDisplay.textContent = this.isPaused ? "PAUSED" : `${this.timeMultiplier.toFixed(1)}x`;

        if (timeDisplay) {
            if (this.syncUTC) {
                timeDisplay.textContent = new Date().toUTCString().split(' ')[4];
            } else {
                const totalSeconds = Math.floor(this.timeOffset);
                const hrs = Math.floor(totalSeconds / 3600);
                const mins = Math.floor((totalSeconds % 3600) / 60);
                const secs = totalSeconds % 60;
                timeDisplay.textContent = `T+ ${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            }
        }

        if (satCountDisplay || planeCountDisplay) {
            let totalSats = 0;
            let totalPlanes = 0;
            this.constellations.forEach(c => {
                if (c.visible) {
                    totalSats += c.totalSats;
                    totalPlanes += c.settings.planes;
                }
            });
            if (satCountDisplay) satCountDisplay.textContent = totalSats;
            if (planeCountDisplay) planeCountDisplay.textContent = totalPlanes;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.orbitManager = new OrbitManager();

    // 1. Map the UI class names to the layer names in your OrbitManager
    const layerMap = {
        'box-ascending': 'ascending',
        'box-descending': 'descending',
        'box-intra': 'intra',
        'box-inter': 'inter',
        'box-borders': 'borders',
        'box-latlon': 'latLonGrid'
    };

    // 2. Select all the color boxes inside the View Settings menu
    const viewToggles = document.querySelectorAll('.view-list-container .color-box');

    viewToggles.forEach(box => {
        box.addEventListener('click', function () {
            // A. Toggle the visual CSS class (turns the color box black)
            this.classList.toggle('toggled-off');

            // B. Determine if the feature is now active or inactive
            const isActive = !this.classList.contains('toggled-off');

            // C. Figure out which specific layer this box controls
            let targetLayer = null;
            for (const [className, layerName] of Object.entries(layerMap)) {
                if (this.classList.contains(className)) {
                    targetLayer = layerName;
                    break;
                }
            }

            // D. Send the update to the OrbitManager
            if (targetLayer && window.orbitManager) {
                window.orbitManager.toggleLayer(targetLayer, isActive);
            }
        });
    });
});
