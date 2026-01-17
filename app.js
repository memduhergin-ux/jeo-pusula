// DOM Elements
const compassNeedle = document.getElementById('compass-needle');
const valStrike = document.getElementById('val-strike');
const valDip = document.getElementById('val-dip');
const levelBubble = document.getElementById('level-bubble');
const btnWgs = document.getElementById('btn-wgs');
const btnUtm = document.getElementById('btn-utm');
const coordContent = document.getElementById('coord-content');
const permissionBtn = document.getElementById('permission-btn');
const calibrationWarning = document.getElementById('calibration-warning');
const ringTicks = document.querySelector('.ring-ticks');
const btnHoldStrike = document.getElementById('btn-hold-strike');
const btnHoldDip = document.getElementById('btn-hold-dip');

// Generate Dial Ticks (Responsive)
function generateTicks() {
    if (!ringTicks) return;
    ringTicks.innerHTML = '';
    for (let i = 0; i < 360; i += 1) {
        const tick = document.createElement('div');
        tick.style.position = 'absolute';
        tick.style.left = '50%';
        tick.style.top = '0';
        tick.style.width = '0px';
        tick.style.height = '50%';
        tick.style.transformOrigin = 'bottom center';
        tick.style.transform = `rotate(-${i}deg)`;

        const mark = document.createElement('div');
        mark.style.position = 'absolute';
        mark.style.top = '0';
        mark.style.left = '50%';
        mark.style.transform = 'translateX(-50%)';
        mark.style.background = '#fff';

        if (i % 10 === 0) {
            mark.style.width = '2px';
            mark.style.height = '14px';
            if (i % 90 !== 0) {
                const label = document.createElement('div');
                label.innerText = i;
                label.className = 'tick-label';
                label.style.position = 'absolute';
                label.style.top = '16px';
                label.style.left = '-15px';
                label.style.width = '30px';
                label.style.textAlign = 'center';
                label.style.transform = 'rotate(180deg)';
                mark.appendChild(label);
            }
        } else if (i % 5 === 0) {
            mark.style.width = '1px';
            mark.style.height = '10px';
            mark.style.background = '#ccc';
        } else {
            mark.style.width = '0.5px';
            mark.style.height = '6px';
            mark.style.background = '#aaa';
            mark.style.opacity = '0.8';
        }
        tick.appendChild(mark);
        ringTicks.appendChild(tick);
    }
}
generateTicks();

// State
let currentMode = 'utm'; // Ekranda varsayılan görünüm UTM ED50 6 Derece
let currentCoords = { lat: 0, lon: 0, alt: 0, baroAlt: null, acc: 0 };
let targetHeading = 0;
let displayedHeading = 0;
let firstReading = true;
const SMOOTHING_FACTOR = 0.025; // 1.5 saniye oturma süresi (Profesyonel Standart)
let currentTilt = { beta: 0, gamma: 0 };
let lockStrike = false;
let lockDip = false;
let manualDeclination = parseFloat(localStorage.getItem('jeoDeclination')) || 0;
let records = JSON.parse(localStorage.getItem('jeoRecords')) || [];
let nextId = parseInt(localStorage.getItem('jeoNextId')) || 1;
let map, markerGroup, liveMarker;
let sensorSource = null; // 'ios', 'absolute', 'relative'
let followMe = false;
let editingRecordId = null;
let isRecordsLocked = true; // Kayıtlar varsayılan olarak kilitli başlar

// Setup Proj4 Definitions
proj4.defs("ED50", "+proj=longlat +ellps=intl +towgs84=-87,-98,-121,0,0,0,0 +no_defs");

// Strike Logic
function formatStrike(heading) {
    let relNorth = -heading;
    while (relNorth <= -180) relNorth += 360;
    while (relNorth > 180) relNorth -= 360;

    let relSouth = (180 - heading);
    while (relSouth <= -180) relSouth += 360;
    while (relSouth > 180) relSouth -= 360;

    let targetRelAngle;
    if (Math.abs(relNorth) <= Math.abs(relSouth)) {
        targetRelAngle = relNorth;
    } else {
        targetRelAngle = relSouth;
    }

    let angle = Math.abs(targetRelAngle);
    let direction = (targetRelAngle < 0) ? "E" : "W";
    return `N${Math.round(angle)}${direction}`;
}

// Barometer
function initBarometer() {
    const sensorClasses = ['PressureSensor', 'Barometer'];
    for (const sensorClass of sensorClasses) {
        if (sensorClass in window) {
            try {
                const sensor = new window[sensorClass]({ frequency: 1 });
                sensor.addEventListener('reading', () => {
                    const p = (sensor.pressure || sensor.value / 100);
                    const p0 = 1013.25;
                    const alt = 44330 * (1 - Math.pow(p / p0, 1 / 5.255));
                    currentCoords.baroAlt = alt;
                });
                sensor.start();
                return;
            } catch (e) { }
        }
    }
}
initBarometer();

function updateDisplay() {
    if (compassNeedle) {
        compassNeedle.style.transform = `translate(-50%, -50%) rotate(${-displayedHeading}deg)`;
    }

    if (!lockStrike && valStrike) {
        valStrike.textContent = formatStrike(displayedHeading);
    }

    let dip = Math.sqrt(currentTilt.beta ** 2 + currentTilt.gamma ** 2);
    dip = Math.min(90, dip);
    if (!lockDip && valDip) {
        valDip.textContent = Math.round(dip);
    }

    if (levelBubble) {
        const maxTilt = 20;
        let xOffset = (currentTilt.gamma / maxTilt) * 18; // Reversed sign to follow tilt
        let yOffset = (currentTilt.beta / maxTilt) * 18;
        const mag = Math.sqrt(xOffset ** 2 + yOffset ** 2);
        if (mag > 18) {
            xOffset = (xOffset / mag) * 18;
            yOffset = (yOffset / mag) * 18;
        }
        levelBubble.style.transform = `translate(calc(-50% + ${Math.round(xOffset)}px), calc(-50% + ${Math.round(yOffset)}px))`;
    }

    renderCoordinates();
}

function renderCoordinates() {
    if (!coordContent) return;
    if (!currentCoords.lat) {
        coordContent.innerHTML = '<div class="data-label">Konum bekleniyor...</div>';
        return;
    }

    const gpsAlt = currentCoords.alt !== null ? Math.round(currentCoords.alt) : 0;
    const baroAlt = currentCoords.baroAlt !== null ? Math.round(currentCoords.baroAlt) : '-';

    if (currentMode === 'wgs') {
        coordContent.innerHTML = `
            <div class="coord-row">
                <span class="data-label">Enlem</span>
                <span class="data-value" style="font-size: 1rem;">${currentCoords.lat.toFixed(6)}°</span>
            </div>
            <div class="coord-row">
                <span class="data-label">Boylam</span>
                <span class="data-value" style="font-size: 1rem;">${currentCoords.lon.toFixed(6)}°</span>
            </div>
            <div class="coord-row">
                <span class="data-label">Z (Uydu)</span>
                <span class="data-value" style="font-size: 1rem;">${gpsAlt} m</span>
            </div>
            <div class="coord-row">
                <span class="data-label">Z (Baro)</span>
                <span class="data-value" style="font-size: 1rem;">${baroAlt} m</span>
            </div>
        `;
    } else {
        const zone = Math.floor((currentCoords.lon + 180) / 6) + 1;
        const hemisphere = currentCoords.lat >= 0 ? 'N' : 'S';
        const utmZoneDef = `+proj=utm +zone=${zone} +ellps=intl +towgs84=-87,-98,-121,0,0,0,0 +units=m +no_defs`;

        try {
            const [easting, northing] = proj4('WGS84', utmZoneDef, [currentCoords.lon, currentCoords.lat]);
            coordContent.innerHTML = `
                <div class="coord-row">
                    <span class="data-label">Zone (ED50)</span>
                    <span class="data-value" style="font-size: 1rem;">${zone}${hemisphere}</span>
                </div>
                <div class="coord-row">
                    <span class="data-label">Y</span>
                    <span class="data-value" style="font-size: 1rem;">${Math.round(easting)}</span>
                </div>
                <div class="coord-row">
                    <span class="data-label">X</span>
                    <span class="data-value" style="font-size: 1rem;">${Math.round(northing)}</span>
                </div>
                <div class="coord-row">
                    <span class="data-label">Z (Uydu)</span>
                    <span class="data-value" style="font-size: 1rem;">${gpsAlt} m</span>
                </div>
                <div class="coord-row">
                    <span class="data-label">Z (Baro)</span>
                    <span class="data-value" style="font-size: 1rem;">${baroAlt} m</span>
                </div>
            `;
        } catch (e) {
            coordContent.innerHTML = '<div class="data-label">UTM Hatası</div>';
        }
    }
}

// Orientation
function handleOrientation(event) {
    let rawHeading = null;
    let currentEventSource = null;

    // 1. iOS Check (Highest Priority)
    if (event.webkitCompassHeading !== undefined && event.webkitCompassHeading !== null) {
        rawHeading = event.webkitCompassHeading;
        currentEventSource = 'ios';
    }
    // 2. Android Absolute Check
    else if (event.absolute === true && event.alpha !== null) {
        rawHeading = 360 - event.alpha;
        currentEventSource = 'absolute';
    }
    // 3. Fallback/Relative (Lowest Priority)
    else if (event.alpha !== null) {
        rawHeading = 360 - event.alpha;
        currentEventSource = 'relative';
    }

    if (rawHeading !== null) {
        // --- SENSÖR KİLİTLEME MANTIĞI ---
        // Daha kaliteli bir kaynak (ios veya absolute) zaten kilitlenmişse, 
        // daha düşük kaliteli (relative) gelen veriyi yok sayarız.
        if (sensorSource === 'ios' && currentEventSource !== 'ios') return;
        if (sensorSource === 'absolute' && currentEventSource === 'relative') return;

        // Kaynağı güncelle
        if (currentEventSource !== sensorSource) {
            sensorSource = currentEventSource;
            updateSensorUI();
        }

        // Apply Screen Orientation Compensation
        let screenAdjustment = 0;
        if (window.screen && window.screen.orientation && window.screen.orientation.angle !== undefined) {
            screenAdjustment = window.screen.orientation.angle;
        } else if (window.orientation !== undefined) {
            screenAdjustment = window.orientation;
        }
        rawHeading = (rawHeading + screenAdjustment) % 360;

        // Apply Manual Declination
        rawHeading = (rawHeading + manualDeclination) % 360;
        if (rawHeading < 0) rawHeading += 360;

        if (firstReading) {
            targetHeading = rawHeading;
            displayedHeading = rawHeading;
            firstReading = false;
        } else {
            let diff = rawHeading - targetHeading;
            if (diff > 180) diff -= 360;
            if (diff < -180) diff += 360;
            targetHeading += diff * 0.15;
        }

        currentTilt.beta = event.beta || 0;
        currentTilt.gamma = event.gamma || 0;
    }
}

function updateSensorUI() {
    const statusEl = document.getElementById('sensor-status-text');
    if (!statusEl) return;

    if (sensorSource === 'ios' || sensorSource === 'absolute') {
        statusEl.textContent = "BAĞLI: Hassas (Manyetik Kuzey)";
        statusEl.style.color = "#4caf50";
    } else {
        statusEl.textContent = "BAĞLI: Tahmini (Kalibrasyon Gerekli)";
        statusEl.style.color = "#ff9800";
    }
}

function animateCompass() {
    let diff = targetHeading - displayedHeading;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    displayedHeading += diff * SMOOTHING_FACTOR;

    if (displayedHeading < 0) displayedHeading += 360;
    if (displayedHeading >= 360) displayedHeading -= 360;

    updateDisplay();
    requestAnimationFrame(animateCompass);
}
requestAnimationFrame(animateCompass);

// Controls
if (btnWgs) btnWgs.addEventListener('click', () => { currentMode = 'wgs'; btnWgs.classList.add('active'); btnUtm.classList.remove('active'); updateDisplay(); });
if (btnUtm) btnUtm.addEventListener('click', () => { currentMode = 'utm'; btnUtm.classList.add('active'); btnWgs.classList.remove('active'); updateDisplay(); });

// Hold Logic
if (btnHoldStrike) {
    btnHoldStrike.addEventListener('click', () => {
        lockStrike = !lockStrike;
        btnHoldStrike.classList.toggle('locked', lockStrike);
    });
}
if (btnHoldDip) {
    btnHoldDip.addEventListener('click', () => {
        lockDip = !lockDip;
        btnHoldDip.classList.toggle('locked', lockDip);
    });
}

function requestPermissions() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        // iOS
        DeviceOrientationEvent.requestPermission().then(r => {
            if (r === 'granted') {
                window.addEventListener('deviceorientation', handleOrientation, true);
                if (permissionBtn) permissionBtn.style.display = 'none';
            } else {
                alert("Sensör izni reddedildi. Sayfayı yenileyip tekrar deneyin.");
            }
        }).catch(err => {
            console.error(err);
            alert("İzin istenirken hata oluştu.");
        });
    } else {
        // Android & Others
        // Bazı tarayıcılar gesture beklediği için hem burada hem load'da deniyoruz
        window.addEventListener('deviceorientationabsolute', handleOrientation, true);
        window.addEventListener('deviceorientation', handleOrientation, true);

        // Android'de pusula izni butonu genelde gerekmez ama butona basılmışsa gizle
        if (permissionBtn) permissionBtn.style.display = 'none';

        // GPS izni de isteyelim hazır basılmışken
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(() => { }, () => { });
        }
    }
}
if (permissionBtn) {
    permissionBtn.addEventListener('click', requestPermissions);
}

// Otomatik Başlatma Denemesi (Android için)
function autoInitSensors() {
    const isIOS = typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function';

    if (isIOS) {
        if (permissionBtn) {
            permissionBtn.style.display = 'block';
            permissionBtn.textContent = 'Pusula Sensörünü Başlat';
        }
    } else {
        // Android: Hemen dinlemeye başla
        window.addEventListener('deviceorientationabsolute', handleOrientation, true);
        window.addEventListener('deviceorientation', handleOrientation, true);

        // 2 saniye bekletip veri gelmezse butonu zorla göster
        setTimeout(() => {
            if (sensorSource === null) {
                if (permissionBtn) {
                    permissionBtn.style.display = 'block';
                    permissionBtn.textContent = 'Pusula Sensörünü Başlat';
                }
            }
        }, 2000);
    }
}
autoInitSensors();

// Geolocation
if ('geolocation' in navigator) {
    navigator.geolocation.watchPosition((p) => {
        currentCoords.lat = p.coords.latitude;
        currentCoords.lon = p.coords.longitude;
        currentCoords.alt = p.coords.altitude;
        if (btnSave) btnSave.classList.add('ready');

        // Update Live Marker (Red Triangle)
        if (map && currentCoords.lat) {
            const livePos = [currentCoords.lat, currentCoords.lon];
            if (!liveMarker) {
                const liveIcon = L.divIcon({
                    className: 'geology-marker',
                    html: '<div class="live-marker"></div>',
                    iconSize: [20, 20],
                    iconAnchor: [10, 10]
                });
                liveMarker = L.marker(livePos, { icon: liveIcon, zIndexOffset: 1000 }).addTo(map);
            } else {
                liveMarker.setLatLng(livePos);
            }
        }

        // Follow-Me logic
        if (followMe && map) {
            map.panTo([currentCoords.lat, currentCoords.lon]);
        }

        updateDisplay();
    }, null, { enableHighAccuracy: true });
}

// Save & Modal
const btnSave = document.getElementById('btn-save');
const recordModal = document.getElementById('record-modal');
const btnCalibrate = document.getElementById('btn-calibrate');
const calibModal = document.getElementById('calibration-modal');

if (btnSave) btnSave.addEventListener('click', () => {
    // Populate Modal Fields (Locked values if active)
    editingRecordId = null; // Reset edit mode
    const currentStrike = formatStrike(displayedHeading);
    const currentDip = Math.round(Math.sqrt(currentTilt.beta ** 2 + currentTilt.gamma ** 2));

    document.getElementById('rec-no').value = nextId;
    document.getElementById('rec-strike').value = currentStrike;
    document.getElementById('rec-dip').value = currentDip;
    document.getElementById('rec-note').value = '';

    if (currentCoords.lat) {
        // Kayıtlar her zaman UTM ED50 formatında saklanır
        const zone = Math.floor((currentCoords.lon + 180) / 6) + 1;
        const utmZoneDef = `+proj=utm +zone=${zone} +ellps=intl +towgs84=-87,-98,-121,0,0,0,0 +units=m +no_defs`;
        try {
            const [easting, northing] = proj4('WGS84', utmZoneDef, [currentCoords.lon, currentCoords.lat]);
            document.getElementById('rec-y').value = Math.round(easting);
            document.getElementById('rec-x').value = Math.round(northing);
        } catch (e) {
            document.getElementById('rec-y').value = currentCoords.lat.toFixed(6);
            document.getElementById('rec-x').value = currentCoords.lon.toFixed(6);
        }
        document.getElementById('rec-z').value = currentCoords.baroAlt !== null ? Math.round(currentCoords.baroAlt) : Math.round(currentCoords.alt || 0);
    }
    recordModal.classList.add('active');
});

if (document.getElementById('btn-modal-cancel')) {
    document.getElementById('btn-modal-cancel').addEventListener('click', () => recordModal.classList.remove('active'));
}

if (document.getElementById('btn-modal-save')) {
    document.getElementById('btn-modal-save').addEventListener('click', () => {
        const id = parseInt(document.getElementById('rec-no').value);
        const y = document.getElementById('rec-y').value;
        const x = document.getElementById('rec-x').value;
        const z = document.getElementById('rec-z').value;
        const strikeLine = document.getElementById('rec-strike').value;
        const dip = document.getElementById('rec-dip').value;
        const note = document.getElementById('rec-note').value;

        if (editingRecordId !== null) {
            // Update existing
            const index = records.findIndex(r => r.id === editingRecordId);
            if (index !== -1) {
                records[index] = { ...records[index], strike: strikeLine, dip, note, y, x, z };
            }
        } else {
            // Create new
            const newRecord = {
                id: id,
                y: y,
                x: x,
                z: z,
                lat: currentCoords.lat,
                lon: currentCoords.lon,
                strike: strikeLine,
                dip: dip,
                note: note
            };

            records.push(newRecord);
            if (id >= nextId) nextId = id + 1;
            localStorage.setItem('jeoNextId', nextId);
        }

        saveRecords();
        renderRecords();
        updateMapMarkers();
        recordModal.classList.remove('active');
        editingRecordId = null;
    });
}

function saveRecords() {
    localStorage.setItem('jeoRecords', JSON.stringify(records));
}

function renderRecords(filter = '') {
    const tableBody = document.getElementById('records-body');
    if (!tableBody) return;

    let displayRecords = records;
    if (filter) {
        const q = filter.toLowerCase();
        displayRecords = records.filter(r =>
            r.id.toString().includes(q) ||
            (r.note && r.note.toLowerCase().includes(q))
        );
    }

    if (displayRecords.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="9">${filter ? 'Eşleşen kayıt bulunamadı' : 'Henüz kayıt yok'}</td></tr>`;
        return;
    }

    tableBody.innerHTML = displayRecords.map(r => `
        <tr data-id="${r.id}">
            <td class="${isRecordsLocked ? 'locked-hidden' : ''}"><input type="checkbox" class="record-select" data-id="${r.id}"></td>
            <td>${r.id}</td>
            <td>${r.y}</td>
            <td>${r.x}</td>
            <td>${r.z}</td>
            <td>${r.strike}</td>
            <td>${r.dip}</td>
            <td style="max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${r.note}</td>
            <td class="${isRecordsLocked ? 'locked-hidden' : ''}"><button class="btn-edit-row" data-id="${r.id}">✏️</button></td>
        </tr>
    `).join('');

    // Update share button if filter results change
    updateShareButtonState();
}
renderRecords();

// Map Logic
function initMap() {
    if (map) return;

    // Default View (Center of Turkey if no GPS)
    const initialLat = currentCoords.lat || 39.9334;
    const initialLon = currentCoords.lon || 32.8597;

    map = L.map('map-container').setView([initialLat, initialLon], 15);

    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    });

    const googleTerrain = L.tileLayer('https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '© Google'
    });

    const googleSat = L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '© Google'
    });

    osm.addTo(map); // Default

    const baseMaps = {
        "Standart (OSM)": osm,
        "Google Arazi": googleTerrain,
        "Google Uydu": googleSat
    };

    L.control.layers(baseMaps).addTo(map);
    markerGroup = L.layerGroup().addTo(map);

    updateMapMarkers();
}

function updateMapMarkers() {
    if (!map || !markerGroup) return;
    markerGroup.clearLayers();

    const selectedIds = Array.from(document.querySelectorAll('.record-select:checked')).map(cb => parseInt(cb.dataset.id));
    const dataToRender = selectedIds.length > 0 ? records.filter(r => selectedIds.includes(r.id)) : records;

    dataToRender.forEach(r => {
        if (r.lat && r.lon) {
            // Create Oriented Icon
            const strikeAngle = parseFloat(r.strike) || 0;
            // Collision Avoidance: Alternate label positions based on ID
            const positions = ['pos-tr', 'pos-tl', 'pos-br', 'pos-bl'];
            const labelPosClass = positions[r.id % 4];

            const iconHtml = `
                <div class="marker-symbol" style="transform: rotate(${strikeAngle}deg)">
                    <div class="marker-strike-line"></div>
                    <div class="marker-dip-tick"></div>
                    <div class="marker-id-label ${labelPosClass}" style="transform: rotate(${-strikeAngle}deg)">#${r.id}</div>
                </div>
            `;

            const geologicalIcon = L.divIcon({
                className: 'geology-marker',
                html: iconHtml,
                iconSize: [40, 40],
                iconAnchor: [20, 20]
            });

            const marker = L.marker([r.lat, r.lon], { icon: geologicalIcon });
            marker.bindPopup(`
                <div style="font-family: 'Inter', sans-serif; color: #333; min-width: 150px;">
                    <b style="color: #2196f3; font-size: 1.1rem;">Kayıt #${r.id}</b><hr style="border:0; border-top:1px solid #eee; margin:8px 0;">
                    <div style="margin-bottom: 5px;"><b>Doğrultu/Eğim:</b> ${r.strike} / ${r.dip}°</div>
                    <div style="margin-bottom: 5px;"><b>Koordinat:</b> ${r.y}, ${r.x}</div>
                    <div style="font-size: 0.9rem; color: #666; font-style: italic;">"${r.note || 'Not yok'}"</div>
                </div>
            `);
            markerGroup.addLayer(marker);
        }
    });

    // Fit bounds if markers exist and were filtered
    if (dataToRender.length > 0 && selectedIds.length > 0) {
        const group = new L.featureGroup(markerGroup.getLayers());
        map.fitBounds(group.getBounds().pad(0.2));
    }
}

// Search Logic
const recordSearch = document.getElementById('record-search');
if (recordSearch) {
    recordSearch.addEventListener('input', (e) => {
        renderRecords(e.target.value);
    });
}

// Follow-Me Logic
const btnFollowMe = document.getElementById('btn-follow-me');
if (btnFollowMe) {
    btnFollowMe.addEventListener('click', () => {
        followMe = !followMe;
        btnFollowMe.classList.toggle('active', followMe);
        if (followMe && currentCoords.lat) {
            map.setView([currentCoords.lat, currentCoords.lon], 17);
        }
    });
}

// Row Edit Logic
document.getElementById('records-body').addEventListener('click', (e) => {
    if (e.target.closest('.btn-edit-row')) {
        const btn = e.target.closest('.btn-edit-row');
        const id = parseInt(btn.dataset.id);
        const record = records.find(r => r.id === id);
        if (record) {
            editingRecordId = id;
            document.getElementById('rec-no').value = record.id;
            document.getElementById('rec-strike').value = record.strike;
            document.getElementById('rec-dip').value = record.dip;
            document.getElementById('rec-note').value = record.note;
            document.getElementById('rec-y').value = record.y;
            document.getElementById('rec-x').value = record.x;
            document.getElementById('rec-z').value = record.z;
            recordModal.classList.add('active');
        }
    }
});

// Selection Logic
function updateShareButtonState() {
    const selectedCount = document.querySelectorAll('.record-select:checked').length;
    const btnShare = document.getElementById('btn-share');
    if (btnShare) btnShare.disabled = selectedCount === 0;
}

const selectAllCheckbox = document.getElementById('select-all-records');
if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', (e) => {
        const checked = e.target.checked;
        document.querySelectorAll('.record-select').forEach(cb => {
            cb.checked = checked;
            cb.closest('tr').classList.toggle('selected', checked);
        });
        updateMapMarkers();
        updateShareButtonState();
    });
}

document.getElementById('records-body').addEventListener('change', (e) => {
    if (e.target.classList.contains('record-select')) {
        e.target.closest('tr').classList.toggle('selected', e.target.checked);
        updateMapMarkers();
        updateShareButtonState();
    }
});

if (btnCalibrate) btnCalibrate.addEventListener('click', () => {
    document.getElementById('declination-input').value = manualDeclination;
    calibModal.classList.add('active');
});

const declinationInput = document.getElementById('declination-input');
if (declinationInput) {
    declinationInput.addEventListener('change', (e) => {
        manualDeclination = parseFloat(e.target.value) || 0;
        localStorage.setItem('jeoDeclination', manualDeclination);
    });
    if (document.getElementById('btn-calibration-close')) document.getElementById('btn-calibration-close').addEventListener('click', () => calibModal.classList.remove('active'));
}

// Navigation Logic
const views = document.querySelectorAll('.view-section');

// View Control
document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
        const target = btn.dataset.target; // Changed from 'view' to 'target' to match existing logic

        // Auto-lock when leaving or entering views (security first)
        if (!isRecordsLocked) {
            isRecordsLocked = true;
            updateLockUI();
            renderRecords();
        }

        // Update Nav UI
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        btn.classList.add('active');

        // Update View Visibility
        views.forEach(v => v.classList.remove('active'));
        const targetView = document.getElementById(target);
        if (targetView) targetView.classList.add('active');

        // Special logic for map initialization
        if (target === 'view-map') {
            setTimeout(() => {
                initMap();
                if (map) map.invalidateSize();
            }, 100);
        }
    });
});

// Export Logic Refactored (Selected only)
function exportData(type) {
    const selectedIds = Array.from(document.querySelectorAll('.record-select:checked')).map(cb => parseInt(cb.dataset.id));
    const dataToExport = records.filter(r => selectedIds.includes(r.id));

    if (dataToExport.length === 0) return;

    if (type === 'csv') {
        const header = ["No", "Y", "X", "Z", "Strike", "Dip", "Note"];
        const csvRows = [header.join(',')];
        dataToExport.forEach(r => {
            const row = [r.id, r.y, r.x, r.z, r.strike, r.dip, r.note];
            csvRows.push(row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
        });
        downloadFile(csvRows.join('\n'), `JeoCompass_Secilenler_${new Date().getTime()}.csv`, 'text/csv');
    } else if (type === 'kml') {
        let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>JeoCompass Secilen Kayitlar</name>`;
        dataToExport.forEach(r => {
            kml += `
    <Placemark>
      <name>Kayıt ${r.id}</name>
      <description>Doğrultu: ${r.strike}, Eğim: ${r.dip}, Not: ${r.note}</description>
      <Point>
        <coordinates>${r.lon},${r.lat},${r.z || 0}</coordinates>
      </Point>
    </Placemark>`;
        });
        kml += `
  </Document>
</kml>`;
        downloadFile(kml, `JeoCompass_Secilenler_${new Date().getTime()}.kml`, 'application/vnd.google-earth.kml+xml');
    }
}

// Share Modal Control
const btnShare = document.getElementById('btn-share');
const shareModal = document.getElementById('share-modal');

if (btnShare) {
    btnShare.addEventListener('click', () => {
        if (!btnShare.disabled) shareModal.classList.add('active');
    });
}

if (document.getElementById('btn-share-cancel')) {
    document.getElementById('btn-share-cancel').addEventListener('click', () => shareModal.classList.remove('active'));
}

// Share Actions
document.getElementById('btn-share-csv').addEventListener('click', () => { exportData('csv'); shareModal.classList.remove('active'); });
document.getElementById('btn-share-kml').addEventListener('click', () => { exportData('kml'); shareModal.classList.remove('active'); });
// Options Modal Control
const btnMoreOptions = document.getElementById('btn-more-options');
const optionsModal = document.getElementById('options-modal');

if (btnMoreOptions) {
    btnMoreOptions.addEventListener('click', () => {
        optionsModal.classList.add('active');
    });
}

if (document.getElementById('btn-options-cancel')) {
    document.getElementById('btn-options-cancel').addEventListener('click', () => optionsModal.classList.remove('active'));
}

// Updated Delete Logic Location (Now inside Options Modal)
const btnDeleteSelected = document.getElementById('btn-delete-selected');
if (btnDeleteSelected) {
    btnDeleteSelected.addEventListener('click', () => {
        const selectedIds = Array.from(document.querySelectorAll('.record-select:checked')).map(cb => parseInt(cb.dataset.id));
        if (selectedIds.length === 0) return;

        if (confirm(`${selectedIds.length} kaydı silmek istediğinize emin misiniz?`)) {
            records = records.filter(r => !selectedIds.includes(r.id));
            saveRecords();
            renderRecords();
            updateMapMarkers();
            if (selectAllCheckbox) selectAllCheckbox.checked = false;
            optionsModal.classList.remove('active');
        }
    });
}

function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type: type });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

// Lock Toggle Logic
const btnToggleLock = document.getElementById('btn-toggle-lock');
function updateLockUI() {
    if (!btnToggleLock) return;
    if (isRecordsLocked) {
        btnToggleLock.innerHTML = '🔒';
        btnToggleLock.classList.remove('unlocked');
        btnToggleLock.title = 'Kilidi Aç';
    } else {
        btnToggleLock.innerHTML = '🔓';
        btnToggleLock.classList.add('unlocked');
        btnToggleLock.title = 'Kilitle';
    }
}

if (btnToggleLock) {
    btnToggleLock.addEventListener('click', () => {
        isRecordsLocked = !isRecordsLocked;
        updateLockUI();
        renderRecords();
        if (isRecordsLocked) {
            // Uncheck all when locking to be safe
            document.querySelectorAll('.record-select').forEach(cb => cb.checked = false);
            const selectAll = document.getElementById('select-all-records');
            if (selectAll) selectAll.checked = false;
            updateShareButtonState();
        }
    });
}

// Global auto-lock on exit
window.addEventListener('beforeunload', () => {
    isRecordsLocked = true;
});

// Initial flow is handled by autoInitSensors() in the mid-section.

// Desktop Sim
setTimeout(() => { if (displayedHeading === 0 && currentTilt.beta === 0) { setInterval(() => { targetHeading = (targetHeading + 1) % 360; }, 50); } }, 2000);
