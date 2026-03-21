document.addEventListener('DOMContentLoaded', () => {
    /* -----------------------------------------
       Left Panel (Satellite Settings) Logic
       ----------------------------------------- */
    const resizerLeft = document.getElementById('dragHandleLeft');
    const panelLeft = document.getElementById('sidePanelLeft');
    const symmetricToggle = document.getElementById('symmetricToggle');
    const apogeePerigeeGroup = document.getElementById('apogeePerigeeGroup');
    const toggleWindowBtn = document.getElementById('toggleWindowBtn');

    function handleSymmetricToggle() {
        if (symmetricToggle.checked) {
            apogeePerigeeGroup.classList.add('faded');
        } else {
            apogeePerigeeGroup.classList.remove('faded');
        }
    }
    if (symmetricToggle) {
        handleSymmetricToggle();
        symmetricToggle.addEventListener('change', handleSymmetricToggle);
    }

    if (toggleWindowBtn && panelLeft) {
        toggleWindowBtn.addEventListener('click', () => {
            panelLeft.classList.toggle('transparent-mode');
        });
    }

    let isResizingLeft = false;
    if (resizerLeft && panelLeft) {
        resizerLeft.addEventListener('mousedown', (e) => {
            isResizingLeft = true;
            resizerLeft.classList.add('active');
            document.body.style.cursor = 'ew-resize';
            document.body.style.userSelect = 'none';
        });
    }

    document.addEventListener('mousemove', (e) => {
        if (isResizingLeft && panelLeft) {
            let newWidth = e.clientX;
            panelLeft.style.width = `${newWidth}px`;
        }
    });

    document.addEventListener('mouseup', () => {
        if (isResizingLeft) {
            isResizingLeft = false;
            if (resizerLeft) resizerLeft.classList.remove('active');
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
        }
    });

    /* -----------------------------------------
       Right Panel (Constellation) Logic
       ----------------------------------------- */
    const setupEyeToggles = () => {
        const eyeToggleButtons = document.querySelectorAll('.eye-toggle-btn');
        eyeToggleButtons.forEach(button => {
            button.onclick = null; 
            button.onclick = function () {
                this.classList.toggle('slashed');
                const section = this.closest('.section');
                if (section && window.orbitManager) {
                    const index = Array.from(section.parentNode.children).indexOf(section);
                    window.orbitManager.toggleConstellationVisibility(index);
                }
            };
        });
    };

    const resizerRight = document.getElementById('dragHandleRight');
    const panelRight = document.getElementById('sidePanelRight');
    let isResizingRight = false;

    if (resizerRight && panelRight) {
        resizerRight.addEventListener('mousedown', (e) => {
            isResizingRight = true;
            resizerRight.classList.add('active');
            document.body.style.cursor = 'ew-resize';
            document.body.style.userSelect = 'none';
        });
    }

    document.addEventListener('mousemove', (e) => {
        if (isResizingRight && panelRight) {
            let newWidth = window.innerWidth - e.clientX;
            panelRight.style.width = `${newWidth}px`;
        }
    });

    document.addEventListener('mouseup', () => {
        if (isResizingRight) {
            isResizingRight = false;
            if (resizerRight) resizerRight.classList.remove('active');
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
        }
    });

    /* -----------------------------------------
       View List Dropdown Logic
       ----------------------------------------- */
    const dropdownContainer = document.getElementById('viewSettingsDropdown');
    const dropdownToggleBtn = document.getElementById('dropdownToggleBtn');

    if (dropdownToggleBtn && dropdownContainer) {
        dropdownToggleBtn.addEventListener('click', () => {
            dropdownContainer.classList.toggle('closed');
        });
    }

    /* -----------------------------------------
       Toolbar Toggle Logic
       ----------------------------------------- */
    const viewToggle = document.getElementById('viewToggle');
    const viewLabel = document.getElementById('viewLabel');

    if (viewToggle) {
        viewToggle.addEventListener('change', () => {
            if (viewToggle.checked) {
                viewLabel.textContent = "3d View";
                if (window.orbitManager) window.orbitManager.setMode('3D');
            } else {
                viewLabel.textContent = "2d View";
                if (window.orbitManager) window.orbitManager.setMode('2D');
            }
        });
    }

    /* -----------------------------------------
       Push Button Logic
       ----------------------------------------- */
    const pushBtn = document.querySelector('.btn-push');
    const focusBtn = document.getElementById('focusBtn');

    if (focusBtn) {
        focusBtn.addEventListener('click', () => {
            if (window.orbitManager) {
                const isFocused = window.orbitManager.focusOnSatellite();
                focusBtn.classList.toggle('active', isFocused);
            }
        });
    }

    if (pushBtn) {
        pushBtn.addEventListener('click', () => {
            const inclination = parseFloat(document.getElementById('input-inclination').value);
            const planes = parseInt(document.getElementById('input-planes').value);
            const satsPerPlane = parseInt(document.getElementById('input-sats-per-plane').value);
            const apogee = parseFloat(document.getElementById('input-apogee').value);
            const perigee = parseFloat(document.getElementById('input-perigee').value);
            const beamQuantity = parseInt(document.getElementById('input-beam-quantity').value);
            const beamSize = parseFloat(document.getElementById('input-beam-size').value);
            
            const settings = {
                inclination,
                planes,
                satsPerPlane,
                apogee,
                perigee,
                beamQuantity,
                beamSize,
                name: "Constellation #" + (document.querySelectorAll('#mainSectionsContainerRight .section').length + 1)
            };
            
            if (window.orbitManager) {
                window.orbitManager.addConstellation(settings);
            }
            addConstellationToList(settings);
        });
    }

    function addConstellationToList(settings) {
        const container = document.querySelector('#mainSectionsContainerRight .sections-wrapper');
        const section = document.createElement('div');
        section.className = 'section';
        section.innerHTML = `
            <div class="section-header">
                <h3>${settings.name}</h3>
                <div class="header-icons">
                    <div class="eye-toggle-btn">
                        <img src="/static/icon/toogleView.svg" alt="Toggle View">
                    </div>
                    <img src="/static/icon/more1.svg" class="delete-btn" alt="Delete" title="Delete Constellation">
                </div>
            </div>
            <div class="form-row">
                <span class="form-label">Sats Amount</span>
                <span class="form-value">${settings.satsPerPlane * settings.planes}</span>
            </div>
            <div class="form-row">
                <span class="form-label">Orbital Planes</span>
                <span class="form-value">${settings.planes}</span>
            </div>
            <div class="form-row">
                <span class="form-label">Inclination</span>
                <span class="form-value">${settings.inclination}</span>
            </div>
            <div class="form-row">
                <span class="form-label">Apogee/Perigee</span>
                <span class="form-value">${settings.apogee}/${settings.perigee} km</span>
            </div>
        `;
        container.appendChild(section);
        setupEyeToggles();

        // Add delete functionality
        const deleteBtn = section.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', () => {
            if (window.orbitManager) {
                const index = Array.from(section.parentNode.children).indexOf(section);
                window.orbitManager.removeConstellation(index);
            }
            section.remove();
        });
    }

    /* -----------------------------------------
       Time Control Logic
       ----------------------------------------- */
    const slowerBtn = document.getElementById('slower-btn');
    const pausePlayBtn = document.getElementById('pause-play-btn');
    const fasterBtn = document.getElementById('faster-btn');
    const utcSyncBtn = document.getElementById('utc-sync-btn');

    if (slowerBtn) {
        slowerBtn.addEventListener('click', () => {
            if (window.orbitManager) {
                window.orbitManager.timeMultiplier = Math.max(0.1, window.orbitManager.timeMultiplier / 2);
                window.orbitManager.syncUTC = false;
                utcSyncBtn.classList.remove('active');
            }
        });
    }

    if (fasterBtn) {
        fasterBtn.addEventListener('click', () => {
            if (window.orbitManager) {
                window.orbitManager.timeMultiplier = Math.min(64, window.orbitManager.timeMultiplier * 2);
                window.orbitManager.syncUTC = false;
                utcSyncBtn.classList.remove('active');
            }
        });
    }

    if (pausePlayBtn) {
        pausePlayBtn.addEventListener('click', () => {
            if (window.orbitManager) {
                window.orbitManager.isPaused = !window.orbitManager.isPaused;
                pausePlayBtn.textContent = window.orbitManager.isPaused ? "▶" : "II";
                pausePlayBtn.classList.toggle('active', window.orbitManager.isPaused);
            }
        });
    }

    /* -----------------------------------------
       Advanced Settings Modal Logic
       ----------------------------------------- */
    const advancedModal = document.getElementById('advancedSettingsModal');
    const openAdvancedBtn = document.getElementById('openAdvancedSettings');

    if (openAdvancedBtn && advancedModal) {
        openAdvancedBtn.addEventListener('click', () => {
            advancedModal.style.display = 'flex';
        });
    }

    // Listen for messages from the iframe
    window.addEventListener('message', (event) => {
        if (event.data.type === 'CONSTELLATION_SAVED') {
            const data = event.data.data;
            console.log('Advanced constellation data received:', data);

            // Funnel into orbit manager
            if (window.orbitManager) {
                // Flatten or map the advanced data to what addConstellation expects
                const settings = {
                    name: data.name,
                    inclination: parseFloat(data.orbit.inclination) || 53,
                    planes: parseInt(data.orbit.orbital_planes) || 20,
                    satsPerPlane: parseInt(data.orbit.sats_per_plane) || 22,
                    apogee: parseFloat(data.orbit.apogee) || 550,
                    perigee: parseFloat(data.orbit.perigee) || 550,
                    beamQuantity: parseInt(data.payload.beam_quantity) || 24,
                    beamSize: parseFloat(data.payload.beam_size) || 300,
                    advanced: data // Keep full data for later
                };
                window.orbitManager.addConstellation(settings);
                addConstellationToList(settings);
            }
            advancedModal.style.display = 'none';
        } else if (event.data.type === 'CLOSE_MODAL') {
            advancedModal.style.display = 'none';
        }
    });

    // Close modal if clicking overlay
    if (advancedModal) {
        advancedModal.addEventListener('click', (e) => {
            if (e.target === advancedModal) {
                advancedModal.style.display = 'none';
            }
        });
    }
});
