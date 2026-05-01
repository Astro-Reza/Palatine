/**
 * Ground System Page — Palatine 2.0
 * Ported from Palatine 1.0 terminal.html.
 * Depends on:  /static/js/link-budget.js  (LinkBudgetCalculator class)
 *              chart.js (CDN)
 *              three.js + OrbitControls + OBJLoader (CDN)
 */

document.addEventListener('DOMContentLoaded', () => {

    // ─── State ─────────────────────────────────────────────────────────────
    let charts = {};
    const calculator = new LinkBudgetCalculator();

    // ─── Dropdown Toggle ───────────────────────────────────────────────────
    window.toggleDropdown = function(id) {
        document.getElementById(id).classList.toggle('is-open');
    };

    // ─── Slider live-update ────────────────────────────────────────────────
    document.getElementById('range-altitude').addEventListener('input', (e) => {
        document.getElementById('val-altitude').textContent = e.target.value;
    });

    document.getElementById('range-sat-inclination').addEventListener('input', (e) => {
        document.getElementById('val-sat-inclination').textContent = e.target.value;
    });

    document.getElementById('range-latitude').addEventListener('input', (e) => {
        document.getElementById('val-latitude').textContent = e.target.value;
    });

    document.getElementById('range-elevation').addEventListener('input', (e) => {
        const elevation = parseFloat(e.target.value);
        document.getElementById('val-elevation').textContent = elevation;
        updateBeamVisualization(elevation);
    });

    document.getElementById('range-frequency').addEventListener('input', (e) => {
        document.getElementById('val-frequency').textContent = parseFloat(e.target.value).toFixed(1);
    });

    document.getElementById('range-exceedance').addEventListener('input', (e) => {
        document.getElementById('val-exceedance').textContent = parseFloat(e.target.value).toFixed(2);
    });

    document.getElementById('range-eirp').addEventListener('input', (e) => {
        document.getElementById('val-eirp').textContent = e.target.value;
    });

    document.getElementById('range-gr').addEventListener('input', (e) => {
        document.getElementById('val-gr').textContent = e.target.value;
    });

    document.getElementById('range-required-power').addEventListener('input', (e) => {
        document.getElementById('val-required-power').textContent = e.target.value;
    });

    // ─── Beam Visualisation ────────────────────────────────────────────────
    /**
     * Updates the conic beam visual to reflect the current minimum elevation angle.
     * Arc angle = 180° − (2 × minElevation)
     *   0° elev  → 180° arc (full hemisphere)
     *   90° elev → 0° arc   (zenith only)
     */
    function updateBeamVisualization(elevationDeg) {
        const beam      = document.getElementById('elevation-beam');
        const indicator = document.getElementById('elevation-indicator');
        const arcAngle  = 180 - (2 * elevationDeg);
        beam.style.setProperty('--arc-angle', arcAngle + 'deg');
        indicator.textContent = 'Min Elevation: ' + elevationDeg + '°';
    }

    // Initialise beam on page load
    updateBeamVisualization(10);

    // ─── Chart Helpers ─────────────────────────────────────────────────────
    function createHistogramChart(canvasId, data, color, xLabel, yLabel) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        if (charts[canvasId]) charts[canvasId].destroy();

        const hist   = calculator.createHistogram(data, 30);
        const labels = hist.edges.slice(0, -1).map((e, i) => ((e + hist.edges[i + 1]) / 2).toFixed(1));

        charts[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    data: hist.counts,
                    backgroundColor: color + '99',
                    borderColor: color,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: {
                        ticks: { color: '#ccc', maxTicksLimit: 8 },
                        grid:  { color: '#444' },
                        title: { display: true, text: xLabel, color: '#ccc', font: { size: 11 } }
                    },
                    y: {
                        ticks: { color: '#ccc' },
                        grid:  { color: '#444' },
                        title: { display: true, text: yLabel, color: '#ccc', font: { size: 11 } }
                    }
                }
            }
        });
    }

    function createScatterChart(canvasId, xData, yData, color, xLabel, yLabel) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        if (charts[canvasId]) charts[canvasId].destroy();

        const step   = Math.max(1, Math.floor(xData.length / 500));
        const points = [];
        for (let i = 0; i < xData.length; i += step) {
            points.push({ x: xData[i], y: yData[i] });
        }

        charts[canvasId] = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    data: points,
                    backgroundColor: color + '66',
                    borderColor: color,
                    pointRadius: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: {
                        ticks: { color: '#ccc' },
                        grid:  { color: '#444' },
                        title: { display: true, text: xLabel, color: '#ccc', font: { size: 11 } }
                    },
                    y: {
                        ticks: { color: '#ccc' },
                        grid:  { color: '#444' },
                        title: { display: true, text: yLabel, color: '#ccc', font: { size: 11 } }
                    }
                }
            }
        });
    }

    function createPowerChart(canvasId, data) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        if (charts[canvasId]) charts[canvasId].destroy();

        charts[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Worst', 'Expected', 'Best', 'Required'],
                datasets: [{
                    data: [data.worst_case_pr, data.expected_pr, data.best_case_pr, data.chartData.requiredPower],
                    backgroundColor: ['#f44336', '#4caf50', '#2196f3', '#ff9800'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: '#ccc' }, grid: { color: '#444' }, title: { display: true, text: 'Power (dBW)', color: '#ccc' } },
                    y: { ticks: { color: '#ccc' }, grid: { color: '#444' } }
                }
            }
        });
    }

    function createContactDurationChart(canvasId, tsData) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        if (charts[canvasId]) charts[canvasId].destroy();

        const hist   = calculator.createHistogram(tsData.contactDurations, 25);
        const labels = hist.centers.map(c => c.toFixed(0));

        charts[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    data: hist.counts,
                    backgroundColor: '#00897b99',
                    borderColor: '#00897b',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: {
                        ticks: { color: '#ccc', maxTicksLimit: 8 },
                        grid:  { color: '#444' },
                        title: { display: true, text: 'Duration (seconds)', color: '#ccc', font: { size: 11 } }
                    },
                    y: {
                        ticks: { color: '#ccc' },
                        grid:  { color: '#444' },
                        title: { display: true, text: 'Frequency', color: '#ccc', font: { size: 11 } }
                    }
                }
            }
        });
    }

    function createGammaPdfChart(canvasId, tsData) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        if (charts[canvasId]) charts[canvasId].destroy();

        const hist        = calculator.createHistogram(tsData.visibleTheta, 40);
        const labels      = hist.centers.map(c => c.toFixed(1));
        const pdfLineData = labels.map(l => {
            const x = parseFloat(l);
            return calculator.gammaPDF(x, tsData.gammaParams.alpha, tsData.gammaParams.loc, tsData.gammaParams.beta);
        });

        charts[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        type: 'bar',
                        label: 'Monte Carlo Data',
                        data: hist.density,
                        backgroundColor: '#9e9e9e66',
                        borderColor: '#9e9e9e',
                        borderWidth: 1,
                        order: 2
                    },
                    {
                        type: 'line',
                        label: `Gamma Fit (a=${tsData.gammaParams.alpha.toFixed(2)}, b=${tsData.gammaParams.beta.toFixed(2)})`,
                        data: pdfLineData,
                        borderColor: '#f44336',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.4,
                        pointRadius: 0,
                        order: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true, position: 'top', labels: { color: '#ccc', font: { size: 10 } } }
                },
                scales: {
                    x: {
                        ticks: { color: '#ccc', maxTicksLimit: 8 },
                        grid:  { color: '#444' },
                        title: { display: true, text: 'Elevation Angle (deg)', color: '#ccc', font: { size: 11 } }
                    },
                    y: {
                        ticks: { color: '#ccc' },
                        grid:  { color: '#444' },
                        title: { display: true, text: 'Probability', color: '#ccc', font: { size: 11 } }
                    }
                }
            }
        });
    }

    function createCdfChart(canvasId, tsData) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        if (charts[canvasId]) charts[canvasId].destroy();

        const step           = Math.max(1, Math.floor(tsData.cdfData.x.length / 200));
        const empiricalPoints = [];
        const gammaPoints     = [];

        for (let i = 0; i < tsData.cdfData.x.length; i += step) {
            empiricalPoints.push({ x: tsData.cdfData.x[i], y: tsData.cdfData.empiricalY[i] });
            gammaPoints.push(    { x: tsData.cdfData.x[i], y: tsData.cdfData.gammaY[i] });
        }

        charts[canvasId] = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [
                    {
                        label: 'Empirical CDF',
                        data: empiricalPoints,
                        borderColor: '#2196f3',
                        backgroundColor: '#2196f333',
                        showLine: true,
                        pointRadius: 0,
                        borderWidth: 2,
                        order: 1
                    },
                    {
                        label: 'Gamma Fit CDF',
                        data: gammaPoints,
                        borderColor: '#f44336',
                        backgroundColor: 'transparent',
                        showLine: true,
                        pointRadius: 0,
                        borderWidth: 2,
                        borderDash: [5, 5],
                        order: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true, position: 'top', labels: { color: '#ccc', font: { size: 10 } } }
                },
                scales: {
                    x: {
                        ticks: { color: '#ccc' },
                        grid:  { color: '#444' },
                        title: { display: true, text: 'Elevation (deg)', color: '#ccc', font: { size: 11 } }
                    },
                    y: {
                        ticks: { color: '#ccc' },
                        grid:  { color: '#444' },
                        title: { display: true, text: 'Probability', color: '#ccc', font: { size: 11 } },
                        min: 0,
                        max: 1
                    }
                }
            }
        });
    }

    // ─── Calculate Button ──────────────────────────────────────────────────
    document.getElementById('calculate-btn').addEventListener('click', () => {
        const calcBtn       = document.getElementById('calculate-btn');
        const loadingOverlay= document.getElementById('loading-overlay');
        const resultsPanel  = document.getElementById('results-panel');
        const loaderBody    = document.getElementById('loaderBody');
        const gridContainer = document.getElementById('progressGrid');
        const percentText   = document.getElementById('percentText');

        // Build progress grid
        gridContainer.innerHTML = '';
        const TOTAL_BLOCKS = 20;
        for (let i = 0; i < TOTAL_BLOCKS; i++) {
            const block = document.createElement('div');
            block.className = 'p-block';
            gridContainer.appendChild(block);
        }

        // Show loading state
        calcBtn.disabled = true;
        calcBtn.textContent = 'Calculating...';
        loadingOverlay.classList.add('visible');

        let loadingComplete = false;
        let animationFrameId;
        const DURATION = 3500;
        let startTime = null;

        setTimeout(() => loaderBody.classList.add('is-open'), 100);

        function updateLoader(timestamp) {
            if (!startTime) startTime = timestamp;
            const progress = timestamp - startTime;
            let percent = loadingComplete ? 1 : Math.min(progress / DURATION, 0.95);

            percentText.innerText = `${Math.floor(percent * 100)}%`;
            const blocksToFill = Math.floor(percent * TOTAL_BLOCKS);
            const blocks = gridContainer.children;
            for (let i = 0; i < TOTAL_BLOCKS; i++) {
                blocks[i].classList.toggle('filled', i < blocksToFill);
            }

            if (percent < 1 || !loadingComplete) {
                animationFrameId = requestAnimationFrame(updateLoader);
            } else {
                setTimeout(finish, 500);
            }
        }

        animationFrameId = requestAnimationFrame(updateLoader);

        // Defer heavy calculation so the loader has time to paint
        setTimeout(() => {
            try {
                const params = {
                    altitude:      parseFloat(document.getElementById('range-altitude').value),
                    inclination:   parseFloat(document.getElementById('range-sat-inclination').value),
                    latitude:      parseFloat(document.getElementById('range-latitude').value),
                    minElevation:  parseFloat(document.getElementById('range-elevation').value),
                    frequency:     parseFloat(document.getElementById('range-frequency').value),
                    eirp:          parseFloat(document.getElementById('range-eirp').value),
                    gr:            parseFloat(document.getElementById('range-gr').value),
                    requiredPower: parseFloat(document.getElementById('range-required-power').value)
                };

                const data = calculator.calculate(params);

                if (data.error) {
                    alert('Error: ' + data.error);
                    loadingComplete = true;
                    return;
                }

                // Link margin quick-display
                document.getElementById('link-margin').textContent =
                    data.link_margin_expected.toFixed(1) + ' dB';

                // Metric helper
                const setMetric = (id, value, decimals = 1) => {
                    const el = document.getElementById(id);
                    el.textContent = typeof value === 'number' ? value.toFixed(decimals) : value;
                    el.className   = 'metric-value';
                    if (id.includes('margin')) {
                        el.classList.add(value >= 0 ? 'positive' : 'negative');
                    }
                };

                setMetric('metric-expected-pr',    data.expected_pr);
                setMetric('metric-worst-pr',        data.worst_case_pr);
                setMetric('metric-best-pr',         data.best_case_pr);
                setMetric('metric-margin-expected', data.link_margin_expected);
                setMetric('metric-margin-worst',    data.link_margin_worst);
                setMetric('metric-visibility',      data.visibility_ratio);
                setMetric('metric-std',             data.std_dev_pr);
                document.getElementById('metric-samples').textContent =
                    data.samples_count.toLocaleString();

                // Heatmap
                const beam      = document.getElementById('elevation-beam');
                const legend    = document.getElementById('signal-legend');
                const legendMin = document.getElementById('legend-min');
                const legendMax = document.getElementById('legend-max');

                beam.classList.add('heatmap-active');
                legend.classList.add('visible');
                legendMin.textContent = data.worst_case_pr.toFixed(1) + ' dBW';
                legendMax.textContent = data.best_case_pr.toFixed(1)  + ' dBW';

                // Static charts
                createHistogramChart('chart-elevation-pdf',
                    data.chartData.thetaSamples,       '#00bcd4', 'Elevation Angle (deg)', 'Frequency');
                createPowerChart('chart-power-boxplot', data);
                createScatterChart('chart-range-elevation',
                    data.chartData.thetaSamples, data.chartData.slantRangeSamples,
                    '#ff9800', 'Elevation Angle (deg)', 'Slant Range (km)');
                createHistogramChart('chart-path-loss',
                    data.chartData.fsplSamples,        '#e91e63', 'Total Attenuation (dB)', 'Frequency');

                // Link budget waterfall values
                document.getElementById('lb-val-eirp').textContent = `+${params.eirp.toFixed(1)}`;
                document.getElementById('lb-val-gain').textContent = `+${params.gr.toFixed(1)}`;
                document.getElementById('lb-val-misc').textContent = `-2.0`;
                document.getElementById('lb-val-pr').textContent   = data.expected_pr.toFixed(1);

                if (data.chartData.slantRangeSamples && data.chartData.slantRangeSamples.length > 0) {
                    const avgRange    = data.chartData.slantRangeSamples.reduce((a, b) => a + b, 0) /
                                        data.chartData.slantRangeSamples.length;
                    const avgThetaDeg = data.chartData.thetaSamples.reduce((a, b) => a + b, 0) /
                                        data.chartData.thetaSamples.length;
                    const avgThetaRad = avgThetaDeg * (Math.PI / 180);
                    const avgFSPL     = 92.45 + 20 * Math.log10(avgRange) + 20 * Math.log10(params.frequency);
                    const avgAtmos    = 0.5 / Math.sin(avgThetaRad);
                    document.getElementById('lb-val-path').textContent  = `-${avgFSPL.toFixed(1)}`;
                    document.getElementById('lb-val-atmos').textContent = `-${avgAtmos.toFixed(1)}`;
                } else {
                    document.getElementById('lb-val-path').textContent  = '--';
                    document.getElementById('lb-val-atmos').textContent = '--';
                }

                // Time-series simulation (60 days @ 10 s)
                const tsData = calculator.runTimeSeriesSimulation(params, 60, 10);

                document.getElementById('simulation-info').textContent =
                    `${tsData.days} days @ ${tsData.stepS}s intervals`;

                setMetric('metric-contact-duration', tsData.meanContactDuration);
                document.getElementById('metric-num-contacts').textContent =
                    tsData.numContacts.toLocaleString();

                if (tsData.contactDurations.length > 0) {
                    createContactDurationChart('chart-contact-duration', tsData);
                    createGammaPdfChart('chart-gamma-pdf', tsData);
                    createCdfChart('chart-cdf', tsData);
                }

                // 3D visualiser update (if 3D view was opened)
                if (tsData.passes3D && window.passVisualizer3D) {
                    window.passVisualizer3D.updatePasses(tsData.passes3D);
                }

                document.getElementById('results-timestamp').textContent =
                    'Calculated at ' + new Date().toLocaleTimeString();

                resultsPanel.classList.add('visible');
                setTimeout(() => resultsPanel.scrollIntoView({ behavior: 'smooth' }), 100);

            } catch (error) {
                console.error('Calculation error:', error);
                alert('Calculation failed: ' + error.message);
            } finally {
                loadingComplete = true;
            }
        }, 500);

        function finish() {
            calcBtn.disabled    = false;
            calcBtn.textContent = 'Calculate';
            loadingOverlay.classList.remove('visible');
            loaderBody.classList.remove('is-open');
        }
    });

    // ─── 3D Pass Visualiser ────────────────────────────────────────────────
    class PassVisualizer3D {
        constructor(containerId) {
            this.container   = document.getElementById(containerId);
            if (!this.container) return;

            this.scene    = null;
            this.camera   = null;
            this.renderer = null;
            this.controls = null;
            this.satMesh  = null;
            this.animPoints = null;
            this.animIndex  = 0;

            this.init();
        }

        init() {
            this.scene = new THREE.Scene();
            this.scene.background = null; // transparent — stars visible behind

            const aspect   = this.container.clientWidth / this.container.clientHeight;
            this.camera    = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
            this.camera.position.set(2, 2, 2);
            this.camera.up.set(0, 0, 1); // Z-up

            this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
            this.renderer.setPixelRatio(window.devicePixelRatio);
            this.container.appendChild(this.renderer.domElement);

            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;

            this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
            const dir = new THREE.DirectionalLight(0xffffff, 0.8);
            dir.position.set(5, 5, 10);
            this.scene.add(dir);

            this.createSkyDome();

            window.addEventListener('resize', () => this.handleResize());
            this.animate();
        }

        createSkyDome() {
            // Ground grid
            const gridHelper = new THREE.GridHelper(2, 20, 0x666666, 0x333333);
            gridHelper.rotation.x = Math.PI / 2;
            this.scene.add(gridHelper);

            // Elevation-coloured hemisphere (Red → Yellow → Blue)
            const vertexShader = `
                varying vec3 vPosition;
                varying vec3 vNormal;
                void main() {
                    vPosition = position;
                    vNormal   = normalize(normal);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `;
            const fragmentShader = `
                varying vec3 vPosition;
                varying vec3 vNormal;
                vec3 colormap(float t) {
                    t = clamp(t, 0.0, 1.0);
                    vec3 red    = vec3(0.9, 0.2, 0.2);
                    vec3 yellow = vec3(0.95, 0.9, 0.4);
                    vec3 blue   = vec3(0.2, 0.4, 0.9);
                    return t < 0.5
                        ? mix(red, yellow, t * 2.0)
                        : mix(yellow, blue, (t - 0.5) * 2.0);
                }
                void main() {
                    float el      = vPosition.y;
                    vec3 baseColor = colormap(el);
                    float alpha    = 0.35;
                    vec3 viewDir   = normalize(cameraPosition - vPosition);
                    float fresnel  = pow(1.0 - abs(dot(viewDir, vNormal)), 2.0);
                    alpha += fresnel * 0.3;
                    gl_FragColor = vec4(baseColor, alpha);
                }
            `;

            const domeGeo = new THREE.SphereGeometry(1, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2);
            const domeMat = new THREE.ShaderMaterial({
                vertexShader, fragmentShader,
                transparent: true, side: THREE.DoubleSide, depthWrite: false
            });
            const domeMesh = new THREE.Mesh(domeGeo, domeMat);
            domeMesh.rotation.x = Math.PI / 2;
            this.scene.add(domeMesh);

            ['N', 'S', 'E', 'W'].forEach((label, i) => {
                const positions = [[0, 1.2, 0], [0, -1.2, 0], [1.2, 0, 0], [-1.2, 0, 0]];
                this.addLabel(label, ...positions[i]);
            });
            this.addLabel('Zenith', 0, 0, 1.1, '#00ffff');
        }

        addLabel(text, x, y, z, colorStr = '#ffffff') {
            const canvas  = document.createElement('canvas');
            canvas.width  = 128;
            canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.font          = 'Bold 32px Arial';
            ctx.fillStyle     = colorStr;
            ctx.textAlign     = 'center';
            ctx.textBaseline  = 'middle';
            ctx.fillText(text, 64, 32);

            const texture  = new THREE.CanvasTexture(canvas);
            const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
            const sprite   = new THREE.Sprite(material);
            sprite.position.set(x, y, z);
            sprite.scale.set(0.5, 0.25, 1);
            this.scene.add(sprite);
        }

        updatePasses(passesData) {
            const oldGroup = this.scene.getObjectByName('passes');
            if (oldGroup) this.scene.remove(oldGroup);
            const oldSat = this.scene.getObjectByName('demo-sat');
            if (oldSat) this.scene.remove(oldSat);
            if (!passesData) return;

            const group = new THREE.Group();
            group.name  = 'passes';
            let longestPoints = null;

            const types = [
                { data: passesData.shortest, color: 0xff4444, name: 'Short'  },
                { data: passesData.median,   color: 0x888888, name: 'Median' },
                { data: passesData.longest,  color: 0x00ffff, name: 'Long'   }
            ];

            types.forEach(type => {
                if (!type.data || !type.data.track) return;
                const points = [];
                type.data.track.forEach(pt => {
                    const azRad = pt.az * Math.PI / 180;
                    const elRad = pt.el * Math.PI / 180;
                    const r = 1.02;
                    const x = r * Math.cos(elRad) * Math.sin(azRad);
                    const y = r * Math.cos(elRad) * Math.cos(azRad);
                    const z = r * Math.sin(elRad);
                    points.push(new THREE.Vector3(x, y, z));

                    if (pt === type.data.track[0]) group.add(this.createMarker(x, y, z, type.color, 'cone'));
                    if (pt === type.data.track[type.data.track.length - 1])
                        group.add(this.createMarker(x, y, z, type.color, 'box'));
                });

                if (type.name === 'Long') longestPoints = points;

                const geom = new THREE.BufferGeometry().setFromPoints(points);
                const mat  = new THREE.LineBasicMaterial({ color: type.color, linewidth: 2 });
                group.add(new THREE.Line(geom, mat));
            });

            this.scene.add(group);
            if (longestPoints && longestPoints.length > 1) this.startSatelliteAnimation(longestPoints);
        }

        startSatelliteAnimation(points) {
            const oldSat = this.scene.getObjectByName('demo-sat');
            if (oldSat) this.scene.remove(oldSat);

            const geo = new THREE.SphereGeometry(0.04, 16, 16);
            const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
            this.satMesh      = new THREE.Mesh(geo, mat);
            this.satMesh.name = 'demo-sat';
            this.scene.add(this.satMesh);

            this.animPoints = points;
            this.animIndex  = 0;
        }

        updateAnimation() {
            if (!this.satMesh || !this.animPoints || this.animPoints.length < 2) return;
            this.animIndex += 0.005;
            if (this.animIndex >= this.animPoints.length - 1) this.animIndex = 0;

            const idx  = Math.floor(this.animIndex);
            const t    = this.animIndex - idx;
            const p1   = this.animPoints[idx];
            const p2   = this.animPoints[idx + 1] || this.animPoints[0];
            this.satMesh.position.lerpVectors(p1, p2, t);
            this.satMesh.lookAt(0, 0, 0);
        }

        createMarker(x, y, z, color, shape) {
            const geo  = shape === 'cone'
                ? new THREE.ConeGeometry(0.03, 0.08, 8)
                : new THREE.BoxGeometry(0.05, 0.05, 0.05);
            const mat  = new THREE.MeshBasicMaterial({ color });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(x, y, z);
            mesh.lookAt(0, 0, 0);
            return mesh;
        }

        handleResize() {
            if (!this.camera || !this.renderer || !this.container) return;
            const w = this.container.clientWidth;
            const h = this.container.clientHeight;
            if (window.getComputedStyle(this.container).display === 'none') return;
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();
            if (w > 0 && h > 0) this.renderer.setSize(w, h);
        }

        animate() {
            requestAnimationFrame(() => this.animate());
            if (this.controls) this.controls.update();
            this.updateAnimation();
            if (this.renderer && this.scene && this.camera) {
                this.renderer.render(this.scene, this.camera);
            }
        }
    }

    // ─── 3D View + Toggle ─────────────────────────────────────────────────
    // Small delay to ensure the container has a rendered size before Three.js init
    setTimeout(() => {
        window.passVisualizer3D = new PassVisualizer3D('scene-3d');

        const btn2D   = document.getElementById('btn-2d');
        const btn3D   = document.getElementById('btn-3d');
        const scene2D = document.getElementById('scene-2d');
        const scene3D = document.getElementById('scene-3d');
        const leg2D   = document.getElementById('legend-2d');
        const leg3D   = document.getElementById('legend-3d');

        btn2D.addEventListener('click', () => {
            scene2D.style.display = 'flex';
            scene3D.style.display = 'none';
            leg2D.style.display   = 'flex';
            leg3D.style.display   = 'none';
            btn2D.classList.add('active');
            btn3D.classList.remove('active');
        });

        btn3D.addEventListener('click', () => {
            scene2D.style.display = 'none';
            scene3D.style.display = 'block';
            leg2D.style.display   = 'none';
            leg3D.style.display   = 'flex';
            if (window.passVisualizer3D) window.passVisualizer3D.handleResize();
            btn3D.classList.add('active');
            btn2D.classList.remove('active');
        });
    }, 500);

}); // end DOMContentLoaded