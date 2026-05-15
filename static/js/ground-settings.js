/**
 * Ground Settings Modal Logic
 * Handles the Advanced Ground System Settings modal on the ground-system page.
 */
(function () {
    const modal = document.getElementById('groundSettingsModal');
    if (!modal) return;

    const addBtn = document.getElementById('groundAddBtn');
    const hwContainer = document.querySelector('#mainSectionsContainerRight .sections-wrapper');

    // ── Open / Close ──
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            resetModal();
            modal.style.display = 'flex';
        });
    }

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });

    document.getElementById('gsCloseBtn').addEventListener('click', () => {
        modal.style.display = 'none';
    });

    document.getElementById('gsCancelBtn').addEventListener('click', () => {
        modal.style.display = 'none';
    });

    document.getElementById('gsResetBtn').addEventListener('click', () => {
        resetModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            modal.style.display = 'none';
        }
    });

    // ── Tab switching ──
    document.querySelectorAll('#groundSettingsModal .tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('#groundSettingsModal .tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('#groundSettingsModal .gs-tab-panel').forEach(p => p.style.display = 'none');
            tab.classList.add('active');
            document.getElementById('gs-tab-' + tab.dataset.tab).style.display = 'flex';
        });
    });

    // ── Segmented control ──
    document.querySelectorAll('#groundSettingsModal .gs-seg-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.gs-seg-control').querySelectorAll('.gs-seg-btn')
                .forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // ── EIRP auto-calc ──
    const ptInput = document.getElementById('gs-pt');
    const gtInput = document.getElementById('gs-gt');
    const eirpOutput = document.getElementById('gs-eirp');

    function calcEIRP() {
        const pt = parseFloat(ptInput.value) || 0;
        const gt = parseFloat(gtInput.value) || 0;
        eirpOutput.value = (pt + gt).toFixed(1);
    }
    if (ptInput) ptInput.addEventListener('input', calcEIRP);
    if (gtInput) gtInput.addEventListener('input', calcEIRP);

    // ── Station management (inside Geography tab) ──
    let stations = [];
    const genId = () => 'ID_' + Math.floor(10000000 + Math.random() * 89999999);

    const editSvg = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M11.5 2.5a1.5 1.5 0 0 1 2.121 2.121L5.5 12.743l-3 .757.757-3 8.243-8z"/></svg>`;
    const delSvg = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></svg>`;

    window._gsRemoveStation = function (id) {
        stations = stations.filter(s => s.id !== id);
        renderStations();
    };

    function renderStations() {
        const list = document.getElementById('gs-station-list');
        const count = document.getElementById('gs-station-count');
        const n = stations.length;
        count.textContent = n + ' ground station' + (n !== 1 ? 's' : '') + ' deployed';

        if (n === 0) {
            list.innerHTML = `
                <div class="gs-empty-state">
                    <svg class="gs-empty-icon" viewBox="0 0 40 40" fill="none" stroke="#555" stroke-width="1.5">
                        <circle cx="20" cy="20" r="14"/><circle cx="20" cy="20" r="3"/>
                        <line x1="20" y1="6" x2="20" y2="10"/><line x1="20" y1="30" x2="20" y2="34"/>
                        <line x1="6" y1="20" x2="10" y2="20"/><line x1="30" y1="20" x2="34" y2="20"/>
                    </svg>
                    <span>No ground stations added yet</span>
                </div>`;
            return;
        }

        list.innerHTML = stations.map(s => `
            <div class="gs-station-card">
                <div>
                    <div class="gs-station-id">${s.id}</div>
                    <div class="gs-station-coord">Longitude: <span>${s.lon}</span></div>
                    <div class="gs-station-coord">Latitude:&nbsp; <span>${s.lat}</span></div>
                    <div class="gs-station-coord">Altitude:&nbsp; <span>${s.alt} m</span></div>
                </div>
                <div class="gs-station-actions">
                    <button class="gs-icon-btn" title="Edit">${editSvg}</button>
                    <button class="gs-icon-btn del" title="Delete" onclick="_gsRemoveStation('${s.id}')">${delSvg}</button>
                </div>
            </div>`).join('');
    }

    // Add single station
    document.getElementById('gs-add-station-btn').addEventListener('click', () => {
        const lon = parseFloat(document.getElementById('gs-in-lon').value).toFixed(6);
        const lat = parseFloat(document.getElementById('gs-in-lat').value).toFixed(6);
        const alt = document.getElementById('gs-in-alt').value;
        stations.push({ id: genId(), lon, lat, alt });
        renderStations();
    });

    // Add random stations
    document.getElementById('gs-add-random-btn').addEventListener('click', () => {
        const n = parseInt(document.getElementById('gs-rand-amount').value) || 1;
        for (let i = 0; i < n; i++) {
            stations.push({
                id: genId(),
                lon: (Math.random() * 360 - 180).toFixed(6),
                lat: (Math.random() * 160 - 80).toFixed(6),
                alt: Math.floor(Math.random() * 3000)
            });
        }
        renderStations();
    });

    // ── Reset modal ──
    function resetModal() {
        stations = [];
        renderStations();
        document.getElementById('gs-hw-name').value = '';
        document.getElementById('gs-hw-version').value = '';
        // Reset to System tab
        document.querySelectorAll('#groundSettingsModal .tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('#groundSettingsModal .gs-tab-panel').forEach(p => p.style.display = 'none');
        document.querySelector('#groundSettingsModal .tab[data-tab="system"]').classList.add('active');
        document.getElementById('gs-tab-system').style.display = 'flex';
    }

    // ── Save → add to Ground Hardware list ──
    document.getElementById('gsSaveBtn').addEventListener('click', () => {
        const name = document.getElementById('gs-hw-name').value || 'Untitled Hardware';
        const version = document.getElementById('gs-hw-version').value || 'v1.0';
        const antennaType = document.getElementById('gs-antenna-type').value;
        const stationCount = stations.length;

        addHardwareToList({ name, version, antennaType, stationCount, stations: [...stations] });
        triggerAutoSave();
        modal.style.display = 'none';
    });

    function triggerAutoSave() {
        if (window.SessionManager) window.SessionManager.autoSave();
    }

    // ── Add hardware item to the right panel list ──
    window.addHardwareToList = function(hw) {
        if (!hwContainer) return;
        const section = document.createElement('div');
        section.className = 'section';
        section.dataset.hw = JSON.stringify(hw);
        section.innerHTML = `
            <div class="section-header">
                <div class="collapse-arrow"></div>
                <h3>${hw.name}</h3>
                <div class="header-icons">
                    <div class="eye-toggle-btn">
                        <img src="/static/icon/toogleView.svg" alt="Toggle View">
                    </div>
                    <img src="/static/icon/more1.svg" class="detailed-settings-btn" alt="Settings" title="Detailed Settings">
                </div>
            </div>
            <div class="form-row">
                <span class="form-label">Antenna Type</span>
                <span class="form-value">${hw.antennaType}</span>
            </div>
            <div class="form-row">
                <span class="form-label">Version</span>
                <span class="form-value">${hw.version}</span>
            </div>
            <div class="form-row">
                <span class="form-label">Stations</span>
                <span class="form-value">${hw.stationCount}</span>
            </div>
            <div class="form-row">
                <span class="form-label">Carrier Freq.</span>
                <span class="form-value">20.0 GHz</span>
            </div>
        `;

        hwContainer.appendChild(section);

        // Collapse logic
        const arrow = section.querySelector('.collapse-arrow');
        arrow.addEventListener('click', (e) => {
            e.stopPropagation();
            section.classList.toggle('collapsed');
        });

        // Eye toggle
        const eyeBtn = section.querySelector('.eye-toggle-btn');
        eyeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            eyeBtn.classList.toggle('slashed');
        });

        // Selection logic
        section.addEventListener('click', (e) => {
            if (e.target.closest('.header-icons') || e.target.classList.contains('collapse-arrow')) return;

            if (!e.ctrlKey && !e.metaKey) {
                hwContainer.querySelectorAll('.section').forEach(el => {
                    if (el !== section) el.classList.remove('selected');
                });
                section.classList.toggle('selected');
            } else {
                section.classList.toggle('selected');
            }
            updateThrowButtons();
        });

        // Detailed settings → reopen modal with this hardware's data
        const settingsBtn = section.querySelector('.detailed-settings-btn');
        settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('gs-hw-name').value = hw.name;
            document.getElementById('gs-hw-version').value = hw.version;
            modal.style.display = 'flex';
        });

        setupDragAndDrop(section);
        updateThrowButtons();
        return section;
    }

    // ── Toolbar / Throw Buttons Logic ──
    const throwDeleteBtn = document.getElementById('deleteBtn');
    const focusBtn = document.getElementById('focusBtn');
    const groupBtn = document.getElementById('group-constellations-btn');
    const sectionsWrapper = document.querySelector('#mainSectionsContainerRight .sections-wrapper');

    function updateThrowButtons() {
        const selectedCount = document.querySelectorAll('#mainSectionsContainerRight .selected').length;
        if (selectedCount > 0) {
            if (throwDeleteBtn) throwDeleteBtn.disabled = false;
        } else {
            if (throwDeleteBtn) throwDeleteBtn.disabled = true;
        }
    }

    if (throwDeleteBtn) {
        throwDeleteBtn.addEventListener('click', () => {
            const selectedItems = Array.from(document.querySelectorAll('#mainSectionsContainerRight .selected'));
            if (selectedItems.length === 0) return;

            const sectionsToRemove = [];
            selectedItems.forEach(item => {
                if (item.classList.contains('section')) {
                    sectionsToRemove.push(item);
                } else if (item.classList.contains('group')) {
                    item.querySelectorAll('.section').forEach(s => sectionsToRemove.push(s));
                }
            });

            const uniqueSections = [...new Set(sectionsToRemove)];
            
            // Remove from DOM
            uniqueSections.forEach(section => section.remove());
            
            // Remove empty groups and selected groups
            selectedItems.forEach(item => {
                if (item.classList.contains('group')) item.remove();
            });
            document.querySelectorAll('#mainSectionsContainerRight .group').forEach(group => {
                if (group.querySelector('.group-content').children.length === 0) {
                    group.remove();
                }
            });

            updateThrowButtons();
            triggerAutoSave();
        });
    }

    // ── Group Logic ──
    if (groupBtn) {
        groupBtn.addEventListener('click', () => {
            const container = sectionsWrapper;
            if (!container) return;
            const selectedItems = Array.from(document.querySelectorAll('#mainSectionsContainerRight .selected'));
            if (selectedItems.length === 0) return;

            const topLevelSelected = selectedItems.filter(item => {
                let parent = item.parentElement;
                while (parent && parent !== container) {
                    if (parent.classList.contains('selected')) return false;
                    parent = parent.parentElement;
                }
                return true;
            });

            if (topLevelSelected.length === 0) return;

            const firstItem = topLevelSelected[0];
            const group = window.addGroundGroupToList("New Group", topLevelSelected, firstItem.parentElement, firstItem);
            
            document.querySelectorAll('#mainSectionsContainerRight .selected').forEach(el => el.classList.remove('selected'));
            updateThrowButtons();
            triggerAutoSave();
        });
    }

    window.addGroundGroupToList = function(name = "New Group", children = [], parent = null, referenceNode = null) {
        const container = sectionsWrapper;
        if (!parent) parent = container;

        const group = document.createElement('div');
        group.className = 'group';
        group.draggable = true;
        group.innerHTML = `
            <div class="group-header">
                <div class="collapse-arrow"></div>
                <img src="/static/icon/groupSats.svg" alt="Group">
                <input type="text" class="group-name" value="${name}">
            </div>
            <div class="group-content"></div>
        `;

        if (referenceNode) {
            parent.insertBefore(group, referenceNode);
        } else {
            parent.appendChild(group);
        }

        const content = group.querySelector('.group-content');
        children.forEach(child => {
            content.appendChild(child);
        });

        const arrow = group.querySelector('.collapse-arrow');
        arrow.addEventListener('click', (e) => {
            e.stopPropagation();
            group.classList.toggle('collapsed');
        });

        group.addEventListener('click', (e) => {
            if (e.target.closest('.group-name') || e.target.classList.contains('collapse-arrow')) return;
            if (!e.ctrlKey && !e.metaKey) {
                container.querySelectorAll('.section, .group').forEach(el => {
                    if (el !== group) el.classList.remove('selected');
                });
                group.classList.toggle('selected');
            } else {
                group.classList.toggle('selected');
            }
            updateThrowButtons();
        });

        const nameInput = group.querySelector('.group-name');
        nameInput.addEventListener('click', e => e.stopPropagation());

        setupDragAndDrop(group);
        return group;
    }

    // ── Drag and Drop Logic ──
    let draggedElement = null;

    function setupDragAndDrop(el) {
        el.addEventListener('mousedown', (e) => {
            if (e.target.closest('.section-header') || e.target.closest('.group-header')) {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
                    el.draggable = false;
                } else {
                    el.draggable = true;
                }
            } else {
                el.draggable = false;
            }
        });

        el.addEventListener('dragstart', (e) => {
            if (!el.draggable) {
                e.preventDefault();
                return;
            }
            e.stopPropagation();
            draggedElement = el;
            el.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', '');
        });

        el.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            
            const rect = el.getBoundingClientRect();
            el.classList.remove('drop-target-above', 'drop-target-below', 'drop-target-inside');

            if (el.classList.contains('group')) {
                const threshold = 15;
                if (e.clientY < rect.top + threshold) {
                    el.classList.add('drop-target-above');
                } else if (e.clientY > rect.bottom - threshold) {
                    el.classList.add('drop-target-below');
                } else {
                    el.classList.add('drop-target-inside');
                }
            } else {
                const midpoint = rect.top + rect.height / 2;
                if (e.clientY < midpoint) {
                    el.classList.add('drop-target-above');
                } else {
                    el.classList.add('drop-target-below');
                }
            }
        });

        el.addEventListener('dragleave', () => {
            el.classList.remove('drop-target-above', 'drop-target-below', 'drop-target-inside');
        });

        el.addEventListener('dragend', (e) => {
            e.stopPropagation();
            el.classList.remove('dragging');
            document.querySelectorAll('.drop-target-above, .drop-target-below, .drop-target-inside').forEach(node => {
                node.classList.remove('drop-target-above', 'drop-target-below', 'drop-target-inside');
            });
            if (sectionsWrapper) sectionsWrapper.classList.remove('drag-over-container');
            draggedElement = null;
        });

        el.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            el.classList.remove('drop-target-above', 'drop-target-below', 'drop-target-inside');

            if (!draggedElement || draggedElement === el) return;
            if (draggedElement.contains(el)) return;

            const rect = el.getBoundingClientRect();
            const threshold = 15;

            if (el.classList.contains('group') && 
                e.clientY >= rect.top + threshold && 
                e.clientY <= rect.bottom - threshold) {
                const content = el.querySelector('.group-content');
                content.appendChild(draggedElement);
                el.classList.remove('collapsed');
            } else {
                const midpoint = rect.top + rect.height / 2;
                if (e.clientY < midpoint) {
                    el.parentNode.insertBefore(draggedElement, el);
                } else {
                    el.parentNode.insertBefore(draggedElement, el.nextSibling);
                }
            }
            updateThrowButtons();
            triggerAutoSave();
        });
    }

    if (sectionsWrapper) {
        sectionsWrapper.addEventListener('dragover', (e) => {
            if (e.target === sectionsWrapper) {
                e.preventDefault();
                sectionsWrapper.classList.add('drag-over-container');
            }
        });

        sectionsWrapper.addEventListener('dragleave', (e) => {
            if (e.target === sectionsWrapper) {
                sectionsWrapper.classList.remove('drag-over-container');
            }
        });

        sectionsWrapper.addEventListener('drop', (e) => {
            if (e.target === sectionsWrapper && draggedElement) {
                e.preventDefault();
                sectionsWrapper.classList.remove('drag-over-container');
                sectionsWrapper.appendChild(draggedElement);
                updateThrowButtons();
                triggerAutoSave();
            }
        });
    }

    // Init
    renderStations();
    updateThrowButtons();
})();

