/**
 * ISL (Inter-Satellite Link) Manager
 * -----------------------------------
 * Manages the ISL tree in the left panel and the detail settings panel.
 */

document.addEventListener('DOMContentLoaded', () => {
    const islTree = document.getElementById('islTree');
    const islAddBtn = document.getElementById('islAddBtn');
    const islEmptyState = document.getElementById('islEmptyState');
    const settingsContent = document.getElementById('islSettingsContent');
    const settingsBody = document.getElementById('islSettingsBody');
    const connectionName = document.getElementById('islConnectionName');
    const pillSource = document.getElementById('islPillSource');
    const pillTarget = document.getElementById('islPillTarget');

    if (!islTree || !islAddBtn) return;

    // ----- Data store -----
    window.islLinks = [];
    let _activeCircle = null; // Currently active circle element

    // ----- Helpers -----

    function getAvailableConstellations() {
        const sections = document.querySelectorAll('#mainSectionsContainerRight .section');
        const names = [];
        sections.forEach(s => {
            const h3 = s.querySelector('.section-header h3');
            if (h3) names.push(h3.textContent.trim());
        });
        return names;
    }

    function getUsedNames(nodes) {
        const used = new Set();
        function walk(list) {
            list.forEach(n => { used.add(n.name); walk(n.children); });
        }
        walk(nodes || window.islLinks);
        return used;
    }

    function refreshEmptyState() {
        if (islEmptyState) {
            islEmptyState.style.display = window.islLinks.length === 0 ? 'block' : 'none';
        }
    }

    // ----- Picker popup -----

    function showPicker(title, exclude, onPick) {
        const existing = document.querySelector('.isl-picker-overlay');
        if (existing) existing.remove();

        const allConstellations = getAvailableConstellations();
        const excludeSet = new Set(exclude);

        const overlay = document.createElement('div');
        overlay.className = 'isl-picker-overlay';

        const picker = document.createElement('div');
        picker.className = 'isl-picker';

        const titlebar = document.createElement('div');
        titlebar.className = 'isl-picker-titlebar';
        titlebar.innerHTML = `
            <span class="isl-picker-title">${title}</span>
            <button class="isl-picker-close" title="Close"></button>
        `;
        picker.appendChild(titlebar);

        const body = document.createElement('div');
        body.className = 'isl-picker-body';

        if (allConstellations.length === 0) {
            body.innerHTML = '<div class="isl-picker-empty">No constellations available.<br>Add one from the right panel first.</div>';
        } else {
            allConstellations.forEach(name => {
                const item = document.createElement('div');
                item.className = 'isl-picker-item';
                if (excludeSet.has(name)) item.classList.add('disabled');
                item.innerHTML = `<span class="isl-picker-item-dot"></span><span>${name}</span>`;
                item.addEventListener('click', () => {
                    if (item.classList.contains('disabled')) return;
                    onPick(name);
                    closePicker();
                });
                body.appendChild(item);
            });
        }

        picker.appendChild(body);
        overlay.appendChild(picker);
        document.body.appendChild(overlay);

        function closePicker() { overlay.remove(); }
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closePicker(); });
        titlebar.querySelector('.isl-picker-close').addEventListener('click', closePicker);
        document.addEventListener('keydown', function escHandler(e) {
            if (e.key === 'Escape') { closePicker(); document.removeEventListener('keydown', escHandler); }
        });
    }

    // ----- Settings Panel -----

    /** Define all setting sections (content from isl-menu2.html). */
    function getSettingsSections() {
        return [
            {
                id: 'sec-tech', label: 'Link Technology', collapsed: false, rows: [
                    { label: 'Type', type: 'select', key: 'tech_type', options: ['Laser / Optical', 'RF Microwave', 'mmWave'], onchange: 'techChange' },
                    { label: 'Wavelength', sublabel: 'Optical band', type: 'select', key: 'wavelength', options: ['1550 nm (C-band)', '1064 nm (Nd:YAG)', '780 nm (Near-IR)', 'Custom'], cond: 'laser' },
                    { label: 'Beam divergence', type: 'number', key: 'beam_divergence', value: 10, min: 1, max: 1000, unit: 'μrad', cond: 'laser' },
                    { label: 'Frequency band', type: 'select', key: 'freq_band', options: ['Ka-band (26–40 GHz)', 'V-band (40–75 GHz)', 'Q-band (33–50 GHz)', 'Ku-band (12–18 GHz)'], cond: 'rf' },
                    { label: 'Duplex mode', type: 'select', key: 'duplex_mode', options: ['FDD (Frequency Division)', 'TDD (Time Division)'], cond: 'rf' },
                    { label: 'Directionality', type: 'select', key: 'directionality', options: ['Bidirectional', 'Simplex (A→B only)'] },
                ]
            },
            {
                id: 'sec-tx', label: 'Transmitter', collapsed: true, rows: [
                    { label: 'TX power', type: 'number', key: 'tx_power', value: 1.0, step: 0.1, min: 0.01, max: 100, unit: 'W' },
                    { label: 'EIRP', sublabel: 'Calculated', type: 'calc', key: 'eirp', value: '34.2 dBW' },
                    { label: 'Telescope aperture', sublabel: 'TX', type: 'number', key: 'tx_aperture', value: 10, min: 1, max: 100, unit: 'cm', cond: 'laser' },
                    { label: 'Antenna gain', sublabel: 'TX', type: 'number', key: 'tx_gain', value: 34, min: 0, max: 80, unit: 'dBi', cond: 'rf' },
                    { label: 'Pointing loss', type: 'number', key: 'pointing_loss', value: 0.5, step: 0.1, min: 0, max: 10, unit: 'dB' },
                ]
            },
            {
                id: 'sec-rx', label: 'Receiver', collapsed: true, rows: [
                    { label: 'Receive aperture', type: 'number', key: 'rx_aperture', value: 10, min: 1, max: 100, unit: 'cm', cond: 'laser' },
                    { label: 'Antenna gain', sublabel: 'RX', type: 'number', key: 'rx_gain', value: 34, min: 0, max: 80, unit: 'dBi', cond: 'rf' },
                    { label: 'Noise temperature', type: 'number', key: 'noise_temp', value: 290, min: 10, max: 1000, unit: 'K' },
                    { label: 'Noise figure', type: 'number', key: 'noise_figure', value: 3.0, step: 0.1, min: 0, max: 20, unit: 'dB' },
                    { label: 'G/T ratio', sublabel: 'Calculated', type: 'calc', key: 'gt_ratio', value: '9.6 dB/K' },
                    { label: 'Min detectable signal', type: 'number', key: 'min_signal', value: -100, min: -150, max: -30, unit: 'dBm' },
                ]
            },
            {
                id: 'sec-budget', label: 'Link Budget & Geometry', collapsed: true, rows: [
                    { label: 'Max operational range', type: 'number', key: 'max_range', value: 5000, min: 100, max: 50000, step: 100, unit: 'km' },
                    { label: 'Minimum range', type: 'number', key: 'min_range', value: 50, min: 1, max: 1000, unit: 'km' },
                    { label: 'FSPL', sublabel: 'At max range — calc.', type: 'calc', key: 'fspl', value: '215.4 dB' },
                    { label: 'Received power', sublabel: 'Calculated', type: 'calc', key: 'prx', value: '–87.2 dBm' },
                    { type: 'divider' },
                    { label: 'Field of regard', type: 'number', key: 'field_of_regard', value: 60, min: 1, max: 180, unit: '°' },
                    { label: 'Solar exclusion angle', type: 'number', key: 'solar_exclusion', value: 10, min: 2, max: 45, unit: '°', cond: 'laser' },
                    { type: 'divider' },
                    { label: 'Required Eb/N₀', type: 'number', key: 'req_ebn0', value: 6.0, step: 0.1, min: 0, max: 30, unit: 'dB' },
                    { label: 'Required link margin', type: 'number', key: 'req_margin', value: 3.0, step: 0.5, min: 0, max: 20, unit: 'dB' },
                    { label: 'Link margin', sublabel: 'Calculated', type: 'margin', key: 'link_margin', value: 7.2 },
                ]
            },
            {
                id: 'sec-mod', label: 'Modulation & Coding', collapsed: true, rows: [
                    { label: 'Modulation', type: 'select', key: 'mod_rf', options: ['BPSK', 'QPSK', '8PSK', '16QAM', '64QAM', '256QAM'], cond: 'rf' },
                    { label: 'Modulation', type: 'select', key: 'mod_laser', options: ['OOK', 'DPSK', 'BPSK', 'QPSK'], cond: 'laser' },
                    { label: 'FEC scheme', type: 'select', key: 'fec', options: ['LDPC', 'Turbo', 'Reed-Solomon', 'Concatenated'] },
                    { label: 'Code rate', type: 'select', key: 'code_rate', options: ['1/2', '2/3', '3/4', '7/8'] },
                    { label: 'Target BER', type: 'select', key: 'target_ber', options: ['10⁻⁶', '10⁻⁹', '10⁻¹²'] },
                ]
            },
            {
                id: 'sec-proto', label: 'Throughput & Protocol', collapsed: true, rows: [
                    { label: 'Raw data rate', type: 'number', key: 'raw_rate', value: 10, min: 0.01, max: 1000, step: 0.1, unit: 'Gbps' },
                    { label: 'Net data rate', sublabel: 'After FEC', type: 'calc', key: 'net_rate', value: '7.5 Gbps' },
                    { label: 'One-way latency', sublabel: 'At max range', type: 'calc', key: 'latency', value: '16.7 ms' },
                    { type: 'divider' },
                    { label: 'Protocol stack', type: 'select', key: 'protocol', options: ['IP / TCP-IP', 'DTN (Bundle)', 'Proprietary'] },
                    { label: 'Max frame size', type: 'number', key: 'frame_size', value: 1500, min: 64, max: 65535, unit: 'bytes' },
                    { label: 'ARQ retries', type: 'number', key: 'arq_retries', value: 3, min: 0, max: 32, unit: 'retries' },
                ]
            },
            {
                id: 'sec-point', label: 'Pointing & Tracking', collapsed: true, rows: [
                    { label: 'Mechanism type', type: 'select', key: 'pointing_mech', options: ['Two-axis gimbal', 'Fast-steering mirror', 'MEMS mirror', 'Phased array (e-steer)'] },
                    { label: 'Pointing accuracy', type: 'number', key: 'point_acc_laser', value: 1.0, step: 0.1, min: 0.01, max: 100, unit: 'μrad', cond: 'laser' },
                    { label: 'Pointing accuracy', type: 'number', key: 'point_acc_rf', value: 0.1, step: 0.01, min: 0.001, max: 5, unit: 'mdeg', cond: 'rf' },
                    { label: 'Acquisition FOV', type: 'number', key: 'acq_fov', value: 1.0, step: 0.1, min: 0.01, max: 30, unit: '°' },
                    { label: 'Acquisition time', type: 'number', key: 'acq_time', value: 15, min: 1, max: 300, unit: 's' },
                    { label: 'Tracking bandwidth', type: 'number', key: 'track_bw', value: 100, min: 1, max: 10000, unit: 'Hz' },
                    { label: 'Re-acquisition time', type: 'number', key: 'reacq_time', value: 5, min: 1, max: 120, unit: 's' },
                ]
            },
            {
                id: 'sec-power', label: 'Power & Mass', collapsed: true, rows: [
                    { label: 'Terminal mass', type: 'number', key: 'mass', value: 2.5, step: 0.1, min: 0.1, max: 200, unit: 'kg' },
                    { label: 'Tracking power', type: 'number', key: 'track_power', value: 25, min: 1, max: 1000, unit: 'W' },
                    { label: 'Standby power', type: 'number', key: 'standby_power', value: 5, min: 0.1, max: 200, unit: 'W' },
                    { label: 'Peak power', type: 'number', key: 'peak_power', value: 50, min: 1, max: 2000, unit: 'W' },
                    { label: 'Design lifetime', type: 'number', key: 'lifetime', value: 7, min: 1, max: 30, unit: 'yr' },
                    { label: 'MTBF', type: 'number', key: 'mtbf', value: 50000, step: 1000, min: 1000, max: 1000000, unit: 'hr' },
                ]
            },
            {
                id: 'sec-avail', label: 'Availability & Topology', collapsed: true, rows: [
                    { label: 'Link availability', sublabel: 'Calculated', type: 'calc', key: 'availability', value: '94.3 %' },
                    { label: 'Handover strategy', type: 'select', key: 'handover', options: ['Seamless (make-before-break)', 'Hard (break-before-make)', 'Fixed (no handover)'] },
                    { label: 'Routing mode', type: 'select', key: 'routing', options: ['Regenerative (OBP)', 'Bent-pipe relay'] },
                    { label: 'Cross-link topology', type: 'select', key: 'topology', options: ['Dynamic (opportunistic)', 'Fixed (persistent pairs)'] },
                    { label: 'Max simultaneous pairs', type: 'number', key: 'max_pairs', value: 4, min: 1, max: 64, unit: 'pairs' },
                ]
            },
        ];
    }

    /** Build the settings panel body HTML from section definitions. */
    function buildSettingsBody(techType) {
        if (!settingsBody) return;
        const isLaser = !techType || techType === 'laser';
        const isRF = techType === 'rf' || techType === 'mmwave';

        settingsBody.innerHTML = '';
        const sections = getSettingsSections();

        sections.forEach(sec => {
            const secDiv = document.createElement('div');
            secDiv.className = 'isl-sec' + (sec.collapsed ? ' collapsed' : '');
            secDiv.id = 'isl-' + sec.id;

            const header = document.createElement('div');
            header.className = 'isl-sec-header';
            header.innerHTML = `<span class="isl-sec-label">${sec.label}</span><span class="isl-sec-chevron"></span>`;
            header.addEventListener('click', () => secDiv.classList.toggle('collapsed'));
            secDiv.appendChild(header);

            const body = document.createElement('div');
            body.className = 'isl-sec-body';

            sec.rows.forEach(row => {
                if (row.type === 'divider') {
                    const d = document.createElement('div');
                    d.className = 'isl-row-divider';
                    body.appendChild(d);
                    return;
                }

                // Conditional visibility
                if (row.cond) {
                    if (row.cond === 'laser' && !isLaser) return;
                    if (row.cond === 'rf' && !isRF) return;
                }

                const rowDiv = document.createElement('div');
                rowDiv.className = 'isl-row';

                const labelSpan = document.createElement('span');
                labelSpan.className = 'isl-row-label';
                labelSpan.textContent = row.label;
                if (row.sublabel) {
                    const small = document.createElement('small');
                    small.textContent = row.sublabel;
                    labelSpan.appendChild(small);
                }
                rowDiv.appendChild(labelSpan);

                const controlDiv = document.createElement('div');
                controlDiv.className = 'isl-row-control';

                if (row.type === 'select') {
                    const sel = document.createElement('select');
                    sel.dataset.key = row.key;
                    row.options.forEach((opt, i) => {
                        const o = document.createElement('option');
                        o.value = opt; o.textContent = opt;
                        sel.appendChild(o);
                    });
                    if (row.onchange === 'techChange') {
                        sel.addEventListener('change', () => {
                            const map = { 'Laser / Optical': 'laser', 'RF Microwave': 'rf', 'mmWave': 'mmwave' };
                            buildSettingsBody(map[sel.value] || 'laser');
                        });
                    }
                    controlDiv.appendChild(sel);
                } else if (row.type === 'number') {
                    const inp = document.createElement('input');
                    inp.type = 'number';
                    inp.dataset.key = row.key;
                    inp.value = row.value;
                    if (row.min !== undefined) inp.min = row.min;
                    if (row.max !== undefined) inp.max = row.max;
                    if (row.step !== undefined) inp.step = row.step;
                    controlDiv.appendChild(inp);
                    if (row.unit) {
                        const unit = document.createElement('span');
                        unit.className = 'isl-unit';
                        unit.textContent = row.unit;
                        controlDiv.appendChild(unit);
                    }
                } else if (row.type === 'calc') {
                    const calc = document.createElement('span');
                    calc.className = 'isl-calc-val';
                    calc.textContent = row.value;
                    controlDiv.appendChild(calc);
                } else if (row.type === 'margin') {
                    const wrap = document.createElement('div');
                    wrap.className = 'isl-margin-bar-wrap';
                    const pct = Math.min(100, Math.max(5, row.value * 6));
                    wrap.innerHTML = `
                        <div class="isl-margin-bar"><div class="isl-margin-fill" style="width:${pct}%"></div></div>
                        <span class="isl-margin-readout">${row.value} dB</span>
                    `;
                    controlDiv.appendChild(wrap);
                }

                rowDiv.appendChild(controlDiv);
                body.appendChild(rowDiv);
            });

            secDiv.appendChild(body);
            settingsBody.appendChild(secDiv);
        });
    }

    // ----- Settings panel open/close -----

    function openSettingsPanel(sourceName, targetName, circleEl) {
        // Toggle: if clicking the same circle again, close the panel
        if (_activeCircle === circleEl) {
            closeSettingsPanel();
            return;
        }

        // Deactivate previous circle
        if (_activeCircle) _activeCircle.classList.remove('active');

        // Activate this circle
        _activeCircle = circleEl;
        circleEl.classList.add('active');

        // Populate connection name and pill
        if (connectionName) connectionName.textContent = sourceName + ' → ' + targetName;
        if (pillSource) pillSource.textContent = sourceName;
        if (pillTarget) pillTarget.textContent = targetName;

        // Build settings content
        buildSettingsBody('laser');

        // Enable the content area
        if (settingsContent) settingsContent.classList.remove('disabled');
    }

    function closeSettingsPanel() {
        if (settingsContent) settingsContent.classList.add('disabled');
        if (connectionName) connectionName.textContent = 'No link selected';
        if (pillSource) pillSource.textContent = '—';
        if (pillTarget) pillTarget.textContent = '—';
        if (_activeCircle) {
            _activeCircle.classList.remove('active');
            _activeCircle = null;
        }
    }

    // ----- Tree rendering -----

    function findParentName(targetNode, roots) {
        for (const root of roots) {
            if (root.children.includes(targetNode)) return root.name;
            const childResult = findParentName(targetNode, root.children);
            if (childResult) return childResult;
        }
        return null;
    }

    function buildNodeElement(node, isRoot) {
        const li = document.createElement('li');

        if (!isRoot) {
            const circle = document.createElement('div');
            circle.className = 'isl-circle';
            circle.title = 'Configure ISL link';
            circle.addEventListener('click', (e) => {
                e.stopPropagation();
                const parentName = findParentName(node, window.islLinks) || '?';
                openSettingsPanel(parentName, node.name, circle);
            });
            li.appendChild(circle);
        }

        const boxContainer = document.createElement('div');
        boxContainer.className = 'isl-box-container';

        const box = document.createElement('div');
        box.className = 'isl-box';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'isl-box-name';
        nameSpan.textContent = node.name;
        box.appendChild(nameSpan);

        const arrow = document.createElement('span');
        arrow.className = 'isl-arrow-down';
        arrow.title = 'Connect to another constellation';
        arrow.addEventListener('click', (e) => {
            e.stopPropagation();
            const usedNames = getUsedNames();
            showPicker('Connect to Constellation', Array.from(usedNames), (chosenName) => {
                node.children.push({ name: chosenName, children: [] });
                renderTree();
            });
        });
        box.appendChild(arrow);

        const removeBtn = document.createElement('span');
        removeBtn.className = 'isl-remove-btn';
        removeBtn.title = 'Remove from ISL tree';
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeNode(node);
            renderTree();
            closeSettingsPanel();
        });
        box.appendChild(removeBtn);

        boxContainer.appendChild(box);
        li.appendChild(boxContainer);

        if (node.children.length > 0) {
            const childUl = document.createElement('ul');
            node.children.forEach(child => {
                childUl.appendChild(buildNodeElement(child, false));
            });
            li.appendChild(childUl);
        }

        return li;
    }

    function removeNode(target) {
        function walkAndRemove(list) {
            for (let i = list.length - 1; i >= 0; i--) {
                if (list[i] === target) { list.splice(i, 1); return true; }
                if (walkAndRemove(list[i].children)) return true;
            }
            return false;
        }
        walkAndRemove(window.islLinks);
    }

    function renderTree() {
        islTree.innerHTML = '';
        window.islLinks.forEach(rootNode => {
            islTree.appendChild(buildNodeElement(rootNode, true));
        });
        refreshEmptyState();
    }

    // ----- Event: top-level "+" button -----
    islAddBtn.addEventListener('click', () => {
        const usedNames = getUsedNames();
        showPicker('Available Constellations', Array.from(usedNames), (chosenName) => {
            window.islLinks.push({ name: chosenName, children: [] });
            renderTree();
        });
    });

    // Initial render
    refreshEmptyState();

    // Expose for external use
    window.islRenderTree = renderTree;

    // ----- Vertical resizer between tree and settings -----
    const vResizer = document.getElementById('islVResizer');
    const container = document.getElementById('mainSectionsContainerLeft');
    const sectionsWrapper = container ? container.querySelector('.sections-wrapper') : null;
    const settingsPanel = document.getElementById('islSettingsPanel');

    if (vResizer && container && sectionsWrapper && settingsPanel) {
        let isResizingV = false;

        vResizer.addEventListener('mousedown', (e) => {
            isResizingV = true;
            vResizer.classList.add('active');
            document.body.style.cursor = 'ns-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizingV) return;
            const containerRect = container.getBoundingClientRect();
            const offsetY = e.clientY - containerRect.top;
            const totalHeight = containerRect.height;

            // Clamp: min 60px for tree, min 80px for settings
            const minTree = 60;
            const minSettings = 80;
            const clampedY = Math.max(minTree, Math.min(totalHeight - minSettings, offsetY));

            sectionsWrapper.style.flex = 'none';
            sectionsWrapper.style.height = clampedY + 'px';
            settingsPanel.style.flex = '1';
        });

        document.addEventListener('mouseup', () => {
            if (isResizingV) {
                isResizingV = false;
                vResizer.classList.remove('active');
                document.body.style.cursor = 'default';
                document.body.style.userSelect = 'auto';
            }
        });
    }
});
