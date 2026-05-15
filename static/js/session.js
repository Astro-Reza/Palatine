/**
 * session.js — Project / Session Manager for Palatine 2.0
 * 
 * Manages New / Open / Save / Export through the logo dropdown menu.
 * Session state is persisted as YAML files via the Flask backend.
 */

(function () {
    'use strict';

    // ── Internal state ──
    let _currentFilename = null;   // YAML filename on disk (null = unsaved)
    let _lastLoadedState = null;   // Holds the last fetched project state
    let _projectMeta = {
        name: 'Untitled Project',
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        version: '2.0.0'
    };

    // ── Helpers ──

    /** Collect the hierarchical layout of constellations and groups. */
    function collectHierarchy(container) {
        const hierarchy = [];
        const children = Array.from(container.children);
        
        children.forEach(child => {
            if (child.classList.contains('section')) {
                const allSections = Array.from(document.querySelectorAll('#mainSectionsContainerRight .section'));
                hierarchy.push({
                    type: 'constellation',
                    index: allSections.indexOf(child)
                });
            } else if (child.classList.contains('group')) {
                const groupName = child.querySelector('.group-name').value;
                const groupContent = child.querySelector('.group-content');
                hierarchy.push({
                    type: 'group',
                    name: groupName,
                    children: collectHierarchy(groupContent)
                });
            }
        });
        return hierarchy;
    }

    /** Collect all constellation data currently in the app. */
    function collectConstellations() {
        const constellations = [];
        // We still collect them in DOM order to match how they are added back
        const sections = document.querySelectorAll('#mainSectionsContainerRight .section');
        sections.forEach((section, idx) => {
            const nameEl = section.querySelector('.section-header h3');
            
            // Try to get from orbitManager first (has full params)
            let data = {};
            if (window.orbitManager && window.orbitManager.constellations[idx]) {
                const c = window.orbitManager.constellations[idx];
                
                // Ensure stable ID
                if (!c.settings.id) c.settings.id = 'const_' + Math.random().toString(36).substr(2, 9);
                
                data = JSON.parse(JSON.stringify(c.settings.advanced || {}));
                data.id = c.settings.id;
                
                // Ensure name and basic orbit params are sync'd
                data.name = nameEl ? nameEl.textContent : c.settings.name;
                if (!data.orbit) data.orbit = {};
                data.orbit.inclination = c.settings.inclination;
                data.orbit.orbital_planes = c.settings.planes;
                data.orbit.sats_per_plane = c.settings.satsPerPlane;
                data.orbit.apogee = c.settings.apogee;
                data.orbit.perigee = c.settings.perigee;
            } else {
                // Fallback: minimal data
                data = {
                    id: 'const_' + Math.random().toString(36).substr(2, 9),
                    name: nameEl ? nameEl.textContent : `Constellation ${idx + 1}`,
                    orbit: {},
                    payload: {}
                };
            }
            constellations.push(data);
        });
        return constellations;
    }

    /** Convert the frontend window.islLinks tree into a flat graph of edges using constellation IDs. */
    function collectISLLinks() {
        if (!window.islLinks) return [];
        const edges = [];
        const constellations = collectConstellations(); // Already has stable IDs
        
        // Helper to find ID by name
        function getIdByName(name) {
            const c = constellations.find(c => c.name === name);
            return c ? c.id : null;
        }

        function traverse(node) {
            const sourceId = getIdByName(node.name);
            if (!sourceId) return;
            
            node.children.forEach(child => {
                const targetId = getIdByName(child.name);
                if (targetId) {
                    edges.push({
                        id: 'isl_' + Math.random().toString(36).substr(2, 9),
                        source: sourceId,
                        target: targetId,
                        type: 'laser',
                        max_range_km: 5000,
                        data_rate_gbps: 10,
                        bidirectional: true
                    });
                }
                traverse(child);
            });
        }
        
        window.islLinks.forEach(rootNode => traverse(rootNode));
        return edges;
    }

    function collectGroundStations() {
        const stations = [];
        const sections = document.querySelectorAll('#mainSectionsContainerRight .section');
        sections.forEach(section => {
            if (section.dataset.hw) {
                try {
                    stations.push(JSON.parse(section.dataset.hw));
                } catch (e) {
                    console.error("Error parsing ground hardware dataset", e);
                }
            }
        });
        return stations;
    }

    /** Build a full project state object for saving. */
    function collectSessionState() {
        const isGroundSystem = window.location.pathname.includes('ground-system');
        const isSpaceSystem = !isGroundSystem;
        const wrapper = document.querySelector('#mainSectionsContainerRight .sections-wrapper');

        // Start from last loaded state or a fresh skeleton
        let state = _lastLoadedState ? JSON.parse(JSON.stringify(_lastLoadedState)) : {
            project: {
                name: _projectMeta.name,
                created: _projectMeta.created,
                modified: new Date().toISOString(),
                version: _projectMeta.version
            },
            constellations: [],
            hierarchy: [],
            isl_links: [],
            ground_stations: [],
            simulation: {},
            analysis_results: {}
        };

        state.project.name = _projectMeta.name;
        state.project.modified = new Date().toISOString();
        state._filename = _currentFilename;

        if (isSpaceSystem) {
            state.constellations = collectConstellations();
            if (wrapper) state.hierarchy = collectHierarchy(wrapper);
            state.isl_links = collectISLLinks();
        } else if (isGroundSystem) {
            state.ground_stations = collectGroundStations();
            if (wrapper) state.ground_hierarchy = collectHierarchy(wrapper);
        }

        return state;
    }

    /** Clear all constellations from the scene and the right panel. */
    function clearCurrentSession() {
        // Clear orbit manager
        if (window.orbitManager) {
            window.orbitManager.constellations = [];
            if (window.orbitManager.scene) {
                // Find and remove all constellation-related objects
                const toRemove = [];
                window.orbitManager.scene.traverse(obj => {
                    if (obj.isPoints || obj.isGroup || obj.isInstancedMesh) {
                        // This is a bit aggressive, but orbitManager should have better cleanup
                    }
                });
                // Re-init scene is safer if removeConstellation isn't enough
                // But let's use the provided removeConstellation if possible
            }
            // Better way: use existing removeConstellation until empty
            while (window.orbitManager.constellations.length > 0) {
                window.orbitManager.removeConstellation(0);
            }
        }
        // Clear DOM
        const wrapper = document.querySelector('#mainSectionsContainerRight .sections-wrapper');
        if (wrapper) wrapper.innerHTML = '';
    }

    /** Load project data into the app. */
    function applySessionState(projectData) {
        window._isApplyingSession = true;
        _lastLoadedState = JSON.parse(JSON.stringify(projectData));
        clearCurrentSession();

        _projectMeta = projectData.project || _projectMeta;
        _currentFilename = projectData._filename || null;

        const isGroundSystem = window.location.pathname.includes('ground-system');
        const isSpaceSystem = !isGroundSystem;

        if (isSpaceSystem) {
            // 1. Add all constellations to orbitManager first
            const constellations = projectData.constellations || [];
            constellations.forEach(c => {
                const settings = {
                    inclination: parseFloat(c.orbit?.inclination ?? 53),
                    planes: parseInt(c.orbit?.orbital_planes ?? 20),
                    satsPerPlane: parseInt(c.orbit?.sats_per_plane ?? 22),
                    apogee: parseFloat(c.orbit?.apogee ?? 550),
                    perigee: parseFloat(c.orbit?.perigee ?? 550),
                    beamQuantity: parseInt(c.payload?.beam_quantity ?? 24),
                    beamSize: parseFloat(c.payload?.beam_size ?? 300),
                    name: c.name || 'Unnamed',
                    advanced: c
                };

                if (window.orbitManager) {
                    window.orbitManager.addConstellation(settings);
                }
            });

            // 2. Rebuild DOM hierarchy
            const wrapper = document.querySelector('#mainSectionsContainerRight .sections-wrapper');
            const hierarchy = projectData.hierarchy || [];

            if (hierarchy.length > 0) {
                rebuildHierarchyDOM(hierarchy, wrapper, constellations);
            } else {
                // Fallback for old projects without hierarchy
                constellations.forEach((c, idx) => {
                    if (window.addConstellationToList) {
                        const constellationObj = window.orbitManager.constellations[idx];
                        const settings = constellationObj.settings;
                        window.addConstellationToList(settings, constellationObj);
                    }
                });
            }

            // 3. Reconstruct ISL tree from flat edge list
            if (window.islLinks && typeof window.islRenderTree === 'function') {
                const edges = projectData.isl_links || [];
                window.islLinks.length = 0; // Clear array
                
                // Helper to get name by ID
                function getNameById(id) {
                    const c = constellations.find(c => c.id === id);
                    return c ? c.name : null;
                }
                
                // Build tree from edges
                const nodeMap = {};
                
                // Create nodes
                edges.forEach(edge => {
                    const sourceName = getNameById(edge.source);
                    const targetName = getNameById(edge.target);
                    
                    if (sourceName && targetName) {
                        if (!nodeMap[sourceName]) nodeMap[sourceName] = { name: sourceName, children: [] };
                        if (!nodeMap[targetName]) nodeMap[targetName] = { name: targetName, children: [] };
                        
                        // Prevent circular references in tree representation
                        const isAlreadyDescendant = (parent, childName) => {
                            if (parent.name === childName) return true;
                            return parent.children.some(c => isAlreadyDescendant(c, childName));
                        };
                        
                        if (!isAlreadyDescendant(nodeMap[targetName], sourceName)) {
                            nodeMap[sourceName].children.push(nodeMap[targetName]);
                        }
                    }
                });
                
                // Find root nodes (nodes that are never targets)
                const targets = new Set(edges.map(e => getNameById(e.target)).filter(Boolean));
                Object.values(nodeMap).forEach(node => {
                    if (!targets.has(node.name)) {
                        window.islLinks.push(node);
                    }
                });
                
                window.islRenderTree();
            }
        } else if (isGroundSystem) {
            // Rebuild Ground Stations
            const groundStations = projectData.ground_stations || [];
            const wrapper = document.querySelector('#mainSectionsContainerRight .sections-wrapper');
            const hierarchy = projectData.ground_hierarchy || [];
            
            if (window.addHardwareToList) {
                if (hierarchy.length > 0 && wrapper) {
                    rebuildGroundHierarchyDOM(hierarchy, wrapper, groundStations);
                } else {
                    groundStations.forEach(hw => {
                        window.addHardwareToList(hw);
                    });
                }
            }
        }

        // Update document title and UI
        document.title = `${_projectMeta.name} — Palatine 2.0`;
        const nameInput = document.getElementById('projectNameInput');
        if (nameInput) nameInput.value = _projectMeta.name;
        
        window._isApplyingSession = false;
    }

    function rebuildGroundHierarchyDOM(items, parent, groundStations) {
        items.forEach(item => {
            if (item.type === 'constellation') { // Reuse same type logic from collectHierarchy
                const hw = groundStations[item.index];
                if (hw && window.addHardwareToList) {
                    const section = window.addHardwareToList(hw);
                    parent.appendChild(section);
                }
            } else if (item.type === 'group') {
                if (window.addGroundGroupToList) {
                    const group = window.addGroundGroupToList(item.name, [], parent);
                    const groupContent = group.querySelector('.group-content');
                    rebuildGroundHierarchyDOM(item.children, groupContent, groundStations);
                }
            }
        });
    }

    function rebuildHierarchyDOM(items, parent, constellations) {
        items.forEach(item => {
            if (item.type === 'constellation') {
                const c = constellations[item.index];
                if (c && window.addConstellationToList) {
                    const constellationObj = window.orbitManager.constellations[item.index];
                    const settings = constellationObj.settings;
                    const section = createConstellationSection(settings, constellationObj);
                    parent.appendChild(section);
                }
            } else if (item.type === 'group') {
                if (window.addGroupToList) {
                    const group = window.addGroupToList(item.name, [], parent);
                    const groupContent = group.querySelector('.group-content');
                    rebuildHierarchyDOM(item.children, groupContent, constellations);
                }
            }
        });
    }

    /** Helper to create a section without adding it to the default container immediately. */
    function createConstellationSection(settings, constellationObj) {
        const originalContainer = document.querySelector('#mainSectionsContainerRight .sections-wrapper');
        window.addConstellationToList(settings, constellationObj);
        const section = originalContainer.lastElementChild;
        return section;
    }

    /** Show a brief toast notification. */
    function showToast(message, duration = 2500) {
        let toast = document.getElementById('session-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'session-toast';
            toast.className = 'session-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.classList.add('visible');
        setTimeout(() => toast.classList.remove('visible'), duration);
    }

    // ── Custom Async Modals ──

    function createDialogOverlay(id) {
        let overlay = document.getElementById(id);
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = id;
            overlay.className = 'project-modal-overlay';
            overlay.style.display = 'none';
            overlay.style.zIndex = '4000';
            document.body.appendChild(overlay);
        }
        return overlay;
    }

    function showConfirm(title, message, yesText = "Save", noText = "Don't Save") {
        return new Promise(resolve => {
            const overlay = createDialogOverlay('sessionConfirmModal');
            overlay.innerHTML = `
                <div class="project-modal" style="width: 380px; min-height: auto;">
                    <div class="project-modal-header">
                        <span class="project-modal-title">${title}</span>
                        <button class="project-modal-close" id="confCloseBtn">&times;</button>
                    </div>
                    <div class="project-modal-body" style="padding: 20px;">
                        <p style="color: #ccc; font-size: 14px; margin-bottom: 20px;">${message}</p>
                        <div style="display: flex; justify-content: flex-end; gap: 10px;">
                            <button class="btn btn-delete" id="confNoBtn" style="padding: 6px 16px;">${noText}</button>
                            <button class="btn btn-delete" id="confCancelBtn" style="background: none; border: 1px solid #555; color: #ccc;">Cancel</button>
                            <button class="btn btn-push" id="confYesBtn" style="padding: 6px 16px;">${yesText}</button>
                        </div>
                    </div>
                </div>
            `;
            const close = (val) => { overlay.style.display = 'none'; resolve(val); };
            overlay.querySelector('#confCloseBtn').onclick = () => close('cancel');
            overlay.querySelector('#confCancelBtn').onclick = () => close('cancel');
            overlay.querySelector('#confNoBtn').onclick = () => close('no');
            overlay.querySelector('#confYesBtn').onclick = () => close('yes');
            overlay.style.display = 'flex';
        });
    }

    function showPrompt(title, defaultValue = '') {
        return new Promise(resolve => {
            const overlay = createDialogOverlay('sessionPromptModal');
            overlay.innerHTML = `
                <div class="project-modal" style="width: 380px; min-height: auto;">
                    <div class="project-modal-header">
                        <span class="project-modal-title">${title}</span>
                        <button class="project-modal-close" id="pmptCloseBtn">&times;</button>
                    </div>
                    <div class="project-modal-body" style="padding: 20px;">
                        <input type="text" id="pmptInput" class="form-input" value="${defaultValue}" style="width: 100%; margin-bottom: 20px; font-size: 14px; padding: 8px;">
                        <div style="display: flex; justify-content: flex-end; gap: 10px;">
                            <button class="btn btn-delete" id="pmptCancelBtn" style="background: none; border: 1px solid #555; color: #ccc;">Cancel</button>
                            <button class="btn btn-push" id="pmptOkBtn" style="padding: 6px 16px;">OK</button>
                        </div>
                    </div>
                </div>
            `;
            const input = overlay.querySelector('#pmptInput');
            const close = (val) => { overlay.style.display = 'none'; resolve(val); };
            overlay.querySelector('#pmptCloseBtn').onclick = () => close(null);
            overlay.querySelector('#pmptCancelBtn').onclick = () => close(null);
            overlay.querySelector('#pmptOkBtn').onclick = () => {
                const val = input.value.trim();
                if (val) close(val);
            };
            input.onkeydown = (e) => { 
                if (e.key === 'Enter') {
                    const val = input.value.trim();
                    if (val) close(val);
                } else if (e.key === 'Escape') {
                    close(null);
                }
            };
            overlay.style.display = 'flex';
            input.focus();
            input.select();
        });
    }

    function showConfirmSimple(title, message) {
        return new Promise(resolve => {
            const overlay = createDialogOverlay('sessionConfirmSimpleModal');
            overlay.innerHTML = `
                <div class="project-modal" style="width: 380px; min-height: auto;">
                    <div class="project-modal-header">
                        <span class="project-modal-title">${title}</span>
                        <button class="project-modal-close" id="simCloseBtn">&times;</button>
                    </div>
                    <div class="project-modal-body" style="padding: 20px;">
                        <p style="color: #ccc; font-size: 14px; margin-bottom: 20px;">${message}</p>
                        <div style="display: flex; justify-content: flex-end; gap: 10px;">
                            <button class="btn btn-delete" id="simCancelBtn" style="background: none; border: 1px solid #555; color: #ccc;">Cancel</button>
                            <button class="btn btn-push" id="simYesBtn" style="padding: 6px 16px;">Delete</button>
                        </div>
                    </div>
                </div>
            `;
            const close = (val) => { overlay.style.display = 'none'; resolve(val); };
            overlay.querySelector('#simCloseBtn').onclick = () => close(false);
            overlay.querySelector('#simCancelBtn').onclick = () => close(false);
            overlay.querySelector('#simYesBtn').onclick = () => close(true);
            overlay.style.display = 'flex';
        });
    }

    // ── Public API ──

    const SessionManager = {

        /** AutoSave: quietly save the current project state */
        async autoSave() {
            if (window._isApplyingSession) return false;
            if (!_currentFilename) return false;
            const state = collectSessionState();
            try {
                const resp = await fetch('/api/project/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(state)
                });
                if (resp.ok) {
                    const result = await resp.json();
                    _currentFilename = result.filename;
                    localStorage.setItem('activeProjectFilename', _currentFilename);
                    return true;
                }
            } catch (err) {
                console.error('autoSave error:', err);
            }
            return false;
        },

        /** Initialize the session on page load */
        async initSession() {
            const activeProject = localStorage.getItem('activeProjectFilename');
            if (activeProject) {
                try {
                    const r = await fetch(`/api/project/open/${encodeURIComponent(activeProject)}`);
                    if (r.ok) {
                        const data = await r.json();
                        applySessionState(data);
                        return;
                    }
                } catch (e) {
                    console.error("Failed to restore active project", e);
                }
            }

            // If no active project or restore failed, create one automatically
            const defaultName = `Project ${new Date().toLocaleDateString().replace(/\//g, '-')}`;
            try {
                const resp = await fetch('/api/project/new', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: defaultName })
                });
                const result = await resp.json();
                if (resp.ok) {
                    clearCurrentSession();
                    _currentFilename = result.filename;
                    _projectMeta = result.project.project;
                    document.title = `${_projectMeta.name} — Palatine 2.0`;
                    
                    const nameInput = document.getElementById('projectNameInput');
                    if (nameInput) nameInput.value = _projectMeta.name;
                    
                    localStorage.setItem('activeProjectFilename', _currentFilename);
                }
            } catch (err) {
                console.error('initSession error:', err);
            }
        },

        /** Check if unsaved changes exist and prompt user. Returns false if cancelled. */
        async checkUnsavedChanges() {
            // With mandatory auto-save, we can just save it.
            if (_currentFilename) {
                await SessionManager.autoSave();
            }
            return true;
        },

        /** Create a new empty project. */
        async newProject() {
            const canProceed = await SessionManager.checkUnsavedChanges();
            if (!canProceed) return;

            const name = await showPrompt('New Project Name:', 'Untitled Project');
            if (!name) return;

            try {
                const resp = await fetch('/api/project/new', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name })
                });
                const result = await resp.json();

                if (resp.ok) {
                    clearCurrentSession();
                    _currentFilename = result.filename;
                    _projectMeta = result.project.project;
                    document.title = `${_projectMeta.name} — Palatine 2.0`;
                    showToast(`Created "${name}"`);
                } else {
                    alert('Error: ' + (result.error || 'Unknown error'));
                }
            } catch (err) {
                console.error('newProject error:', err);
                alert('Failed to create project. Is the server running?');
            }
        },

        /** Save current session to its existing YAML file, or prompt for a name. */
        async saveProject() {
            if (!_currentFilename) {
                const name = await showPrompt('Save project as:', _projectMeta.name);
                if (!name) return false;
                _projectMeta.name = name;
            }

            const state = collectSessionState();

            try {
                const resp = await fetch('/api/project/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(state)
                });
                const result = await resp.json();

                if (resp.ok) {
                    _currentFilename = result.filename;
                    showToast('Project saved');
                    return true;
                } else {
                    alert('Save error: ' + (result.error || 'Unknown error'));
                    return false;
                }
            } catch (err) {
                console.error('saveProject error:', err);
                alert('Failed to save. Is the server running?');
                return false;
            }
        },

        /** Show the open-project modal with a list of saved projects. */
        async showOpenDialog() {
            const modal = document.getElementById('openProjectModal');
            const listEl = document.getElementById('projectList');

            if (!modal || !listEl) return;

            listEl.innerHTML = '<div class="project-list-loading">Loading...</div>';
            modal.style.display = 'flex';

            try {
                const resp = await fetch('/api/projects');
                const projects = await resp.json();

                if (!projects.length) {
                    listEl.innerHTML = '<div class="project-list-empty">No saved projects found.</div>';
                    return;
                }

                listEl.innerHTML = '';
                projects.forEach(p => {
                    const item = document.createElement('div');
                    item.className = 'project-list-item';

                    const modified = p.modified ? new Date(p.modified).toLocaleString() : '—';

                    item.innerHTML = `
                        <div class="project-item-info">
                            <span class="project-item-name">${p.name}</span>
                            <span class="project-item-meta">${p.constellation_count} constellation(s) · ${modified}</span>
                        </div>
                        <div class="project-item-actions">
                            <button class="project-open-btn" data-file="${p.filename}">Open</button>
                            <button class="project-delete-btn" data-file="${p.filename}" title="Delete">&times;</button>
                        </div>
                    `;
                    listEl.appendChild(item);
                });

                // Wire open buttons
                listEl.querySelectorAll('.project-open-btn').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const canProceed = await SessionManager.checkUnsavedChanges();
                        if (!canProceed) return;

                        const fname = btn.dataset.file;
                        try {
                            const r = await fetch(`/api/project/open/${encodeURIComponent(fname)}`);
                            const data = await r.json();
                            if (r.ok) {
                                applySessionState(data);
                                modal.style.display = 'none';
                                showToast(`Opened "${data.project.name}"`);
                            } else {
                                alert('Open error: ' + data.error);
                            }
                        } catch (err) {
                            alert('Failed to open project.');
                        }
                    });
                });

                // Wire delete buttons
                listEl.querySelectorAll('.project-delete-btn').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const fname = btn.dataset.file;
                        const confirmed = await showConfirmSimple('Delete Project', `Are you sure you want to delete "${fname}"? This cannot be undone.`);
                        if (!confirmed) return;
                        
                        try {
                            await fetch(`/api/project/${encodeURIComponent(fname)}`, { method: 'DELETE' });
                            btn.closest('.project-list-item').remove();
                            if (!listEl.children.length) {
                                listEl.innerHTML = '<div class="project-list-empty">No saved projects found.</div>';
                            }
                        } catch (err) {
                            alert('Delete failed.');
                        }
                    });
                });
            } catch (err) {
                listEl.innerHTML = '<div class="project-list-empty">Failed to load projects.</div>';
            }
        },

        /** Export current project as a downloadable YAML file. */
        exportProject() {
            const state = collectSessionState();
            // Remove internal keys
            delete state._filename;

            // Convert to a simple YAML-like representation for download
            const yamlStr = jsonToYaml(state);
            const blob = new Blob([yamlStr], { type: 'application/x-yaml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = (_projectMeta.name || 'project').replace(/\s+/g, '_').toLowerCase() + '.yaml';
            a.click();
            URL.revokeObjectURL(url);
            showToast('Exported as YAML');
        },

        /** Get current project metadata. */
        getMeta() {
            return { ..._projectMeta, filename: _currentFilename };
        }
    };

    /**
     * Simple JSON-to-YAML converter for export (no dependency needed).
     * Handles nested objects, arrays, and scalars.
     */
    function jsonToYaml(obj, indent = 0) {
        const pad = '  '.repeat(indent);
        let out = '';

        if (Array.isArray(obj)) {
            if (obj.length === 0) return '[]';
            obj.forEach(item => {
                if (typeof item === 'object' && item !== null) {
                    out += `${pad}-\n${jsonToYaml(item, indent + 1)}`;
                } else {
                    out += `${pad}- ${formatScalar(item)}\n`;
                }
            });
        } else if (typeof obj === 'object' && obj !== null) {
            Object.entries(obj).forEach(([key, val]) => {
                if (val === null || val === undefined) {
                    out += `${pad}${key}:\n`;
                } else if (Array.isArray(val)) {
                    if (val.length === 0) {
                        out += `${pad}${key}: []\n`;
                    } else {
                        out += `${pad}${key}:\n`;
                        out += jsonToYaml(val, indent + 1);
                    }
                } else if (typeof val === 'object') {
                    if (Object.keys(val).length === 0) {
                        out += `${pad}${key}: {}\n`;
                    } else {
                        out += `${pad}${key}:\n`;
                        out += jsonToYaml(val, indent + 1);
                    }
                } else {
                    out += `${pad}${key}: ${formatScalar(val)}\n`;
                }
            });
        }
        return out;
    }

    function formatScalar(v) {
        if (typeof v === 'string') return `"${v}"`;
        return String(v);
    }

    // ── Wire up DOM events ──
    document.addEventListener('DOMContentLoaded', () => {
        SessionManager.initSession();

        const modal = document.getElementById('openProjectModal');
        const closeBtn = document.getElementById('closeOpenModal');

        if (closeBtn && modal) {
            closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });
        }
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.style.display = 'none';
            });
        }

        const nameInput = document.getElementById('projectNameInput');
        if (nameInput) {
            nameInput.addEventListener('blur', () => {
                const val = nameInput.value.trim();
                if (val !== '' && val !== _projectMeta.name) {
                    _projectMeta.name = val;
                    document.title = `${_projectMeta.name} — Palatine 2.0`;
                    SessionManager.autoSave();
                } else {
                    nameInput.value = _projectMeta.name;
                }
            });
            nameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') nameInput.blur();
            });
        }
    });

    // Expose globally
    window.SessionManager = SessionManager;

})();
