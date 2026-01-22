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
const btnSave = document.getElementById('btn-save');
const btnFollowMe = document.getElementById('btn-follow-me');
const btnMoreOptions = document.getElementById('btn-more-options');
const btnShare = document.getElementById('btn-share');
const btnToggleLock = document.getElementById('btn-toggle-lock');
const btnToggleRecords = document.getElementById('btn-toggle-records');
const recordModal = document.getElementById('record-modal');
const optionsModal = document.getElementById('options-modal');
const shareModal = document.getElementById('share-modal');
const calibModal = document.getElementById('calibration-modal');
const btnCalibrate = document.getElementById('btn-calibrate');
const recordSearch = document.getElementById('record-search');
const selectAllCheckbox = document.getElementById('select-all-records');
const btnDeleteSelected = document.getElementById('btn-delete-selected');

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

// Shape Persistence
let pendingGeometry = null;
let pendingGeometryType = null;
let pendingLat = null;
let pendingLon = null;

// Stabilization Variables
let headingBuffer = [];
let betaBuffer = []; // NEW: Buffer for dip
const CACHE_NAME = 'jeocompass-v34';
let isStationary = false;
let lastRotations = [];
const STATIONARY_THRESHOLD = 0.15; // deg/s (Jiroskop hassasiyeti)

const STATIONARY_FRAMES = 10; // ~0.5 saniye sabit kalırsa kilitlenmeye başlar

// Measurement State
let isMeasuring = false;
let measurePoints = [];
let measureMarkers = [];
let measureLine = null;
let activeMeasureLabels = []; // Track segment labels during active measurement
let isPolygon = false;
let measureMode = 'line'; // 'line' or 'polygon'

// Add Point State
let isAddingPoint = false;

// KML/KMZ Layers State
let externalLayers = []; // { id, name, layer, filled: true, visible: true, pointsVisible: true, areasVisible: true }
let layerIdCounter = 1;

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

    let dip = Math.abs(currentTilt.beta); // currentTilt.beta is now stabilized in handleOrientation
    if (dip > 90) dip = 180 - dip;

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

        // currentTilt.beta = event.beta || 0; // REMOVED: Managed below
        currentTilt.gamma = event.gamma || 0;

        // --- STABILIZASYON MANTIĞI ---

        // 1. Median Filter (Gürültü Temizleme)
        // Heading Buffer
        headingBuffer.push(rawHeading);
        if (headingBuffer.length > BUFFER_SIZE) headingBuffer.shift();

        // Beta Buffer (Dip için)
        let rawBeta = event.beta || 0;
        betaBuffer.push(rawBeta);
        if (betaBuffer.length > BUFFER_SIZE) betaBuffer.shift();

        // Heading Medyan
        let sorted = [...headingBuffer].sort((a, b) => a - b);
        let medianHeading = sorted[Math.floor(sorted.length / 2)];

        // Beta Medyan
        let sortedBeta = [...betaBuffer].sort((a, b) => a - b);
        let medianBeta = sortedBeta[Math.floor(sortedBeta.length / 2)];

        // Update Global Beta State with Stabilized Value
        currentTilt.beta = medianBeta;

        // 0-360 geçişinde (kuzeyde) medyan filtresi sapıtabilir, bunu düzelt:
        // Eğer değerler arasında çok fark varsa (örn. 359 ve 1), medyanı iptal et ham veriyi kullan
        if (sorted[sorted.length - 1] - sorted[0] > 180) {
            medianHeading = rawHeading;
        }

        // 2. Stationary Lock (Sabitlik Kilidi)
        if (isStationary) {
            // Cihaz "sabit" modundaysa, pusulayı çok yavaş hareket ettir (Low Pass Filter)
            // Sadece gerçekten büyük bir değişim varsa tepki ver
            let diff = medianHeading - targetHeading;
            if (diff > 180) diff -= 360;
            if (diff < -180) diff += 360;

            if (Math.abs(diff) > 2.0) {
                // Büyük hareket (kullanıcı döndü), kilidi hemen aç
                targetHeading = medianHeading;
            } else {
                // Küçük hareket (titreme), çok agresif yumuşat
                targetHeading += diff * 0.05;
            }
        } else {
            // Cihaz hareketli, normal tepki ver
            if (firstReading) {
                targetHeading = medianHeading;
                displayedHeading = medianHeading;
                firstReading = false;
            } else {
                let diff = medianHeading - targetHeading;
                if (diff > 180) diff -= 360;
                if (diff < -180) diff += 360;
                targetHeading += diff * 0.15;
            }
        }
    }
}

// Motion Listener (Jiroskop ile Sabitlik Algılama)
function handleMotion(event) {
    if (!event.rotationRate) return;

    // Toplam dönme hareketi büyüklüğü
    const alpha = event.rotationRate.alpha || 0;
    const beta = event.rotationRate.beta || 0;
    const gamma = event.rotationRate.gamma || 0;
    const magnitude = Math.sqrt(alpha * alpha + beta * beta + gamma * gamma);

    lastRotations.push(magnitude);
    if (lastRotations.length > STATIONARY_FRAMES) lastRotations.shift();

    // Son N karedeki ortalama hareket eşiğin altındaysa "SABİT" kabul et
    const avgMotion = lastRotations.reduce((a, b) => a + b, 0) / lastRotations.length;

    if (avgMotion < STATIONARY_THRESHOLD) {
        if (!isStationary) {
            // console.log("Stationary Lock ENGAGED");
            isStationary = true;
        }
    } else {
        if (isStationary) {
            // console.log("Stationary Lock RELEASED");
            isStationary = false;
        }
    }
}

if (window.DeviceMotionEvent) {
    window.addEventListener('devicemotion', handleMotion, true);
}

function updateSensorUI() {
    const statusEl = document.getElementById('sensor-status-text');
    if (!statusEl) return;

    if (sensorSource === 'ios' || sensorSource === 'absolute') {
        statusEl.textContent = "BAĞLI: Hassas (Manyetik Kuzey)";
        statusEl.style.color = "#4caf50";
        if (permissionBtn) permissionBtn.style.display = 'none';
        if (calibrationWarning) calibrationWarning.style.display = 'none';
    } else if (sensorSource === 'relative') {
        statusEl.textContent = "BAĞLI: Tahmini (Kalibrasyon Gerekli)";
        statusEl.style.color = "#ff9800";
        if (calibrationWarning) calibrationWarning.style.display = 'block';
    } else {
        statusEl.textContent = "BEKLENİYOR: Lütfen Butona Basın";
        statusEl.style.color = "#f44336";
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

// Update Save Button State
function updateSaveButtonState() {
    if (!btnSave) return;
    if (lockStrike && lockDip) {
        btnSave.classList.add('ready');
    } else {
        btnSave.classList.remove('ready');
    }
}

// Hold Logic
if (btnHoldStrike) {
    btnHoldStrike.addEventListener('click', () => {
        lockStrike = !lockStrike;
        btnHoldStrike.classList.toggle('locked', lockStrike);
        updateSaveButtonState();
    });
}
if (btnHoldDip) {
    btnHoldDip.addEventListener('click', () => {
        lockDip = !lockDip;
        btnHoldDip.classList.toggle('locked', lockDip);
        updateSaveButtonState();
    });
}

function requestPermissions() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        // iOS
        DeviceOrientationEvent.requestPermission().then(r => {
            if (r === 'granted') {
                window.addEventListener('deviceorientation', handleOrientation, true);
                if (permissionBtn) permissionBtn.style.display = 'none';
            }
        }).catch(err => {
            console.error(err);
        });
    } else {
        // Android & Others
        window.addEventListener('deviceorientationabsolute', handleOrientation, true);
        window.addEventListener('deviceorientation', handleOrientation, true);
        if (permissionBtn) permissionBtn.style.display = 'none';
    }
}
if (permissionBtn) {
    permissionBtn.addEventListener('click', () => {
        requestPermissions();
    });
}

// Otomatik Başlatma Denemesi (Android için)
function autoInitSensors() {
    const isIOS = typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function';

    if (isIOS) {
        if (permissionBtn) {
            permissionBtn.style.display = 'block';
            permissionBtn.textContent = 'Pusulayı Başlat (Tıklayın)';
        }
    } else {
        window.addEventListener('deviceorientationabsolute', handleOrientation, true);
        window.addEventListener('deviceorientation', handleOrientation, true);

        setTimeout(() => {
            if (sensorSource === null) {
                if (permissionBtn) {
                    permissionBtn.style.display = 'block';
                    permissionBtn.textContent = 'Pusulayı Başlat (Tıklayın)';
                }
            }
        }, 3000);
    }
}
autoInitSensors();

// Geolocation
if ('geolocation' in navigator) {
    navigator.geolocation.watchPosition((p) => {
        currentCoords.lat = p.coords.latitude;
        currentCoords.lon = p.coords.longitude;
        currentCoords.alt = p.coords.altitude;

        // Update Live Marker (Heartbeat Triangle)
        if (map && currentCoords.lat) {
            const livePos = [currentCoords.lat, currentCoords.lon];
            if (!liveMarker) {
                const liveIcon = L.divIcon({
                    className: 'heartbeat-container',
                    html: '<div class="heartbeat-pulse"></div><div class="heartbeat-triangle"></div>',
                    iconSize: [32, 32],
                    iconAnchor: [16, 16] // Center
                });
                liveMarker = L.marker(livePos, { icon: liveIcon, zIndexOffset: 1000 }).addTo(liveLayer);
            } else {
                liveMarker.setLatLng(livePos);
                // Also ensure icon is correct if returning users have old marker? No need, simple refresh.
            }

            if (followMe) {
                map.panTo(livePos);
            }

            // Show/Hide triangle based on followMe
            const el = liveMarker.getElement();
            if (el) {
                const triangle = el.querySelector('.live-marker');
                if (triangle) {
                    if (followMe) triangle.classList.add('visible');
                    else triangle.classList.remove('visible');
                }
            }
        }

        // Consolidated Follow-Me logic
        if (followMe && map && currentCoords.lat) {
            map.panTo([currentCoords.lat, currentCoords.lon]);
        }

        updateDisplay();
    }, (err) => {
        console.error("Konum hatası:", err);
    }, { enableHighAccuracy: true });
}

// Save & Modal
if (btnSave) btnSave.addEventListener('click', () => {
    // Populate Modal Fields (Locked values if active)
    editingRecordId = null; // Reset edit mode
    const currentStrike = lockStrike ? valStrike.textContent : formatStrike(displayedHeading);

    let calcDip = Math.abs(currentTilt.beta); // Uses stabilized beta
    if (calcDip > 90) calcDip = 180 - calcDip;
    const currentDip = lockDip ? parseInt(valDip.textContent) : Math.round(calcDip);

    // Label Logic: Use existing nextId for new, or existing label for edit
    if (editingRecordId === null) {
        document.getElementById('rec-label').value = nextId;
    } else {
        // This part is handled in the edit click handler, but for safety in reset:
        const currentRec = records.find(r => r.id === editingRecordId);
        document.getElementById('rec-label').value = currentRec ? (currentRec.label || currentRec.id) : nextId;
    }

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
        // ID is internal only now, Label is user-facing
        const label = document.getElementById('rec-label').value;
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
                records[index] = { ...records[index], label, strike: strikeLine, dip, note, y, x, z };
            }
        } else {
            // Create new
            const id = nextId; // Use current nextId global

            // If we have pending coords (from measurement or pin drop), use them.
            // Otherwise use live GPS.
            const recordLat = pendingLat !== null ? pendingLat : currentCoords.lat;
            const recordLon = pendingLon !== null ? pendingLon : currentCoords.lon;

            const newRecord = {
                id: id,
                label: label || id.toString(), // Fallback
                y: y,
                x: x,
                z: z,
                lat: recordLat,
                lon: recordLon,
                strike: strikeLine,
                dip: dip,
                note: note,
                geom: pendingGeometry, // Saved shape
                geomType: pendingGeometryType
            };

            records.push(newRecord);
            // Reset pending
            pendingGeometry = null;
            pendingGeometryType = null;
            pendingLat = null;
            pendingLon = null;
            // Only increment ID if we used the global counter for a new record
            nextId++;
            localStorage.setItem('jeoNextId', nextId);
        }

        saveRecords();
        renderRecords();
        updateMapMarkers();
        recordModal.classList.remove('active');
        editingRecordId = null;

        // Clear measurement state if we just saved one
        if (measurePoints.length > 0) {
            clearMeasurement();
            isMeasuring = false;
            updateMeasureModeUI();
        }
    });
}

function saveRecords() {
    localStorage.setItem('jeoRecords', JSON.stringify(records));
}

function renderRecords(filter = '') {
    const tableBody = document.getElementById('records-body');
    const selectAllTh = document.getElementById('select-all-th');
    const editTh = document.getElementById('edit-th');
    if (!tableBody) return;

    // Sync Header Visibility
    if (selectAllTh) selectAllTh.classList.toggle('locked-hidden', isRecordsLocked);
    if (editTh) editTh.classList.toggle('locked-hidden', isRecordsLocked);

    let displayRecords = records;
    if (filter) {
        // Global Search: Check all values in the record
        const q = filter.toLowerCase();
        displayRecords = records.filter(r => {
            return Object.values(r).some(val =>
                String(val).toLowerCase().includes(q)
            );
        });
    }

    if (displayRecords.length === 0) {
        const colCount = isRecordsLocked ? 7 : 9;
        tableBody.innerHTML = `<tr><td colspan="${colCount}">${filter ? 'Eşleşen kayıt bulunamadı' : 'Henüz kayıt yok'}</td></tr>`;
        return;
    }

    tableBody.innerHTML = displayRecords.map(r => `
        <tr data-id="${r.id}">
            <td class="${isRecordsLocked ? 'locked-hidden' : ''}"><input type="checkbox" class="record-select" data-id="${r.id}"></td>
            <td>${r.label || r.id}</td>
            <td>${r.y}</td>
            <td>${r.x}</td>
            <td>${r.z}</td>
            <td>${r.strike}</td>
            <td>${r.dip}</td>
            <td style="max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${r.note}</td>
            <td class="${isRecordsLocked ? 'locked-hidden' : ''}"><button class="btn-edit-row" data-id="${r.id}">✏️</button></td>
        </tr>
    `).join('');

    updateShareButtonState();
}
renderRecords();

// Map Logic
let liveLayer = L.layerGroup(); // Layer for live location

function initMap() {
    if (map) return;

    const initialLat = currentCoords.lat || 39.9334;
    const initialLon = currentCoords.lon || 32.8597;

    map = L.map('map-container', {
        maxZoom: 23 // Allow zooming way in (digital zoom)
    }).setView([initialLat, initialLon], currentCoords.lat ? 17 : 15);

    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 23,
        maxNativeZoom: 19, // Tiles stop at 19, stretch after that
        attribution: '© OpenStreetMap'
    });

    const googleTerrain = L.tileLayer('https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
        maxZoom: 23,
        maxNativeZoom: 20, // Google typically goes to 20-21
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '© Google'
    });

    const googleSat = L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
        maxZoom: 23,
        maxNativeZoom: 20, // Stretch satellite tiles beyond 20
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '© Google'
    });

    osm.addTo(map);
    liveLayer.addTo(map);

    const baseMaps = {
        "Sokak (OSM)": osm,
        "Arazi (Google)": googleTerrain,
        "Uydu (Google)": googleSat
    };

    const overlayMaps = {
        "Canlı Konumum": liveLayer
    };

    L.control.layers(baseMaps, overlayMaps).addTo(map);

    // Custom Scale Control (Bottom Left)
    initCustomScale();

    markerGroup = L.layerGroup().addTo(map);

    // Zoom listener for scale-based visibility
    map.on('zoomend', () => {
        updateMapMarkers();
    });

    // Map Click Handler for Interactions
    map.on('click', (e) => {
        if (isMeasuring) {
            updateMeasurement(e.latlng);
        } else if (isAddingPoint) {
            // Open Modal with Clicked Coordinates
            const clickedLat = e.latlng.lat;
            const clickedLon = e.latlng.lng;

            // Convert to UTM
            let utmY, utmX;
            try {
                const zone = Math.floor((clickedLon + 180) / 6) + 1;
                const utmZoneDef = `+proj=utm +zone=${zone} +ellps=intl +towgs84=-87,-98,-121,0,0,0,0 +units=m +no_defs`;
                const utm = proj4('WGS84', utmZoneDef, [clickedLon, clickedLat]);
                utmY = Math.round(utm[0]); // Easting (Y in UI?) - Checks UI labels. UI says Y/X usually Easting/Northing.
                utmX = Math.round(utm[1]); // Northing
            } catch (err) {
                console.error("UTM conversion failed", err);
                utmY = clickedLon.toFixed(6);
                utmX = clickedLat.toFixed(6);
            }

            // Populate Modal Manually
            editingRecordId = null; // Ensure new record mode

            // We need to trigger the modal opening logic but override values.
            // Simplified: Just set values and open.

            // 1. Reset/Init Label
            document.getElementById('rec-label').value = nextId;

            // 2. Set Coords
            document.getElementById('rec-y').value = utmY;
            document.getElementById('rec-x').value = utmX;
            document.getElementById('rec-z').value = 0; // Default elevation

            // 3. Set Strike/Dip (Default or 0)
            document.getElementById('rec-strike').value = 0;
            document.getElementById('rec-dip').value = 0;

            // 4. Note
            document.getElementById('rec-note').value = "Haritadan seçildi";

            // Open Modal
            recordModal.classList.add('active');

            // Old map click logic for Add Point removed/disabled in favor of Center Crosshair
            // If we want to keep tap-to-add as secondary, we can leave it.
            // But user requested "no touching screen".
            // Let's disable this block effectively.
            /* 
            // Open Modal with Clicked Coordinates
            const clickedLat = e.latlng.lat;
            const clickedLon = e.latlng.lng;
            openRecordModalWithCoords(clickedLat, clickedLon, "Haritadan seçildi (Tıklama)");
             */
            // Reset mode if they tap map? No, usually annoying.
        }
    });

    updateMapMarkers();
    loadExternalLayers();
}

/** Custom Scale Control (0 - X m style) **/
function initCustomScale() {
    const CustomScale = L.Control.extend({
        options: { position: 'bottomleft' },
        onAdd: function (map) {
            const div = L.DomUtil.create('div', 'custom-scale-control');
            div.innerHTML = `
                <div class="scale-labels">
                    <span class="label-zero">0</span>
                    <span id="scale-mid" class="label-mid"></span>
                    <span id="scale-end" class="label-end"></span>
                </div>
                <div class="scale-bars">
                    <div class="scale-segment"></div>
                    <div class="scale-segment"></div>
                </div>
            `;
            return div;
        }
    });
    new CustomScale().addTo(map);
    map.on('zoomend moveend', updateScaleValues);
    updateScaleValues();
}

function updateScaleValues() {
    if (!map) return;
    const width = 140; // Total width in pixels
    const centerLatLng = map.getCenter();
    const pCenter = map.latLngToContainerPoint(centerLatLng);
    const pEnd = L.point(pCenter.x + width, pCenter.y);
    const latLngEnd = map.containerPointToLatLng(pEnd);
    const distance = map.distance(centerLatLng, latLngEnd);

    let midVal = distance / 2;
    let endVal = distance;

    const midEl = document.getElementById('scale-mid');
    const endEl = document.getElementById('scale-end');
    if (midEl) midEl.textContent = formatScaleDist(midVal);
    if (endEl) endEl.textContent = formatScaleDist(endVal);
}

function formatScaleDist(d) {
    if (d < 1) return d.toFixed(1) + " m";
    if (d < 1000) return Math.round(d) + " m";
    return (d / 1000).toFixed(2) + " km";
}

// Show/Hide Records State
let showRecordsOnMap = true;

/** Parallel Labeling Helpers **/
function getSegmentAngle(p1, p2) {
    const p1Container = map.latLngToContainerPoint(p1);
    const p2Container = map.latLngToContainerPoint(p2);
    const angle = Math.atan2(p2Container.y - p1Container.y, p2Container.x - p1Container.x) * 180 / Math.PI;
    // Normalize to [-90, 90] to keep text from being upside down
    if (angle > 90) return angle - 180;
    if (angle < -90) return angle + 180;
    return angle;
}

function getSegmentMidpoint(p1, p2) {
    return L.latLng((p1.lat + p2.lat) / 2, (p1.lng + p2.lng) / 2);
}

function updateMapMarkers() {
    if (!map || !markerGroup) return;
    markerGroup.clearLayers();

    if (!showRecordsOnMap) return;

    // Remove fixed zoom limit, we will use dynamic scaling instead
    const zoom = map.getZoom();

    // Scale factor: normal size at zoom 17+, smaller at lower zooms
    // Zoom 10 -> factor 0.3, Zoom 14 -> factor 0.6, Zoom 17 -> factor 1.0
    let scaleFactor = 1.0;
    if (zoom < 17) {
        scaleFactor = Math.max(0.2, (zoom - 6) / 11);
    }
    const iconBaseSize = 32 * scaleFactor;
    const labelFontSize = Math.max(8, 10 * scaleFactor);

    const selectedIds = Array.from(document.querySelectorAll('.record-select:checked')).map(cb => parseInt(cb.dataset.id));
    const dataToRender = selectedIds.length > 0 ? records.filter(r => selectedIds.includes(r.id)) : records;

    dataToRender.forEach(r => {
        if (r.lat && r.lon) {
            const labelText = r.label || r.id;

            // 1. Draw Geometry (if exists)
            if (r.geom && r.geom.length > 0) {
                const latlngs = r.geom.map(p => L.latLng(p[0], p[1]));
                let totalLen = 0;
                for (let i = 0; i < latlngs.length - 1; i++) {
                    totalLen += latlngs[i].distanceTo(latlngs[i + 1]);
                }

                let shape;
                if (r.geomType === 'polygon') {
                    totalLen += latlngs[latlngs.length - 1].distanceTo(latlngs[0]);
                    shape = L.polygon(latlngs, { color: '#ffeb3b', weight: 4, fillOpacity: 0.3 });

                    // Labelling Polygon Edges
                    for (let i = 0; i < latlngs.length; i++) {
                        const nextIndex = (i + 1) % latlngs.length;
                        const p1 = latlngs[i];
                        const p2 = latlngs[nextIndex];
                        const dist = p1.distanceTo(p2);
                        const mid = getSegmentMidpoint(p1, p2);
                        const angle = getSegmentAngle(p1, p2);

                        const edgeLabel = L.marker(mid, {
                            icon: L.divIcon({
                                className: 'segment-label-container',
                                html: `<div class="segment-label" style="transform: rotate(${angle}deg)">${formatScaleDist(dist)}</div>`,
                                iconSize: [1, 1],
                                iconAnchor: [0, 0]
                            }),
                            interactive: false
                        });
                        markerGroup.addLayer(edgeLabel);
                    }
                } else {
                    shape = L.polyline(latlngs, { color: '#ffeb3b', weight: 4 });

                    // Labelling Total Length for Polyline (at the middle of the path)
                    // DRAW SEGMENT LABELS FOR POLYLINE
                    if (r.geomType === 'polyline') {
                        for (let i = 0; i < latlngs.length - 1; i++) {
                            const p1 = latlngs[i];
                            const p2 = latlngs[i + 1];
                            const dist = map.distance(p1, p2);
                            const mid = L.latLng((p1.lat + p2.lat) / 2, (p1.lng + p2.lng) / 2);

                            // Calculate angle for labels
                            const point1 = map.latLngToContainerPoint(p1);
                            const point2 = map.latLngToContainerPoint(p2);
                            let angle = Math.atan2(point2.y - point1.y, point2.x - point1.x) * 180 / Math.PI;
                            if (angle > 90 || angle < -90) angle += 180;

                            const segmentLabel = L.marker(mid, {
                                icon: L.divIcon({
                                    className: 'segment-label-container',
                                    html: `<div class="segment-label" style="transform: rotate(${angle}deg)">${formatScaleDist(dist)}</div>`,
                                    iconSize: [1, 1],
                                    iconAnchor: [0, 0]
                                }),
                                interactive: false
                            });
                            markerGroup.addLayer(segmentLabel);
                        }
                    }
                }

                let popupContent = `
                    <div style="font-family: 'Inter', sans-serif; color: #333; min-width: 180px;">
                        <b style="color: #2196f3; font-size: 1.1rem;">Ölçüm: ${labelText}</b>
                        <hr style="border:0; border-top:1px solid #eee; margin:8px 0;">
                        <div style="font-size: 0.95rem; margin-bottom: 8px;">${r.note || 'Not yok'}</div>
                        <div style="background: #f5f5f5; padding: 8px; border-radius: 4px; font-size: 0.85rem; margin-bottom: 10px;">
                            ${r.geomType === 'polygon' ? `<b>Çevre:</b> ${formatScaleDist(totalLen)}` : `<b>Uzunluk:</b> ${formatScaleDist(totalLen)}`}
                        </div>
                        <button onclick="deleteRecordFromMap(${r.id})" style="width: 100%; background: #f44336; color: white; border: none; padding: 6px; border-radius: 4px; cursor: pointer; font-weight: bold;">🗑️ Sil</button>
                    </div>
                `;

                shape.bindPopup(popupContent);

                markerGroup.addLayer(shape);
                // SKIP THE PIN for geometries as requested
                return;
            }

            // 2. Draw Marker (Only for Point Records)
            const strikeAngle = parseFloat(r.strike) || 0;
            const markerIcon = L.divIcon({
                className: 'geology-marker-pin',
                html: `
                    <div class="pin-container" style="width:${iconBaseSize}px; height:${iconBaseSize}px;">
                        <span class="pin-icon" style="font-size:${24 * scaleFactor}px; transform: rotate(${strikeAngle}deg)">📍</span>
                        <div class="marker-id-label-v3" style="font-size:${labelFontSize}px; padding: 1px ${4 * scaleFactor}px; top:-${5 * scaleFactor}px; right:-${8 * scaleFactor}px;">#${labelText}</div>
                    </div>
                `,
                iconSize: [iconBaseSize, iconBaseSize],
                iconAnchor: [iconBaseSize / 2, iconBaseSize / 2]
            });

            const marker = L.marker([r.lat, r.lon], { icon: markerIcon });
            marker.bindPopup(`
                <div style="font-family: 'Inter', sans-serif; color: #333; min-width: 150px;">
                    <b style="color: #2196f3; font-size: 1.1rem;">Kayıt ${labelText}</b><hr style="border:0; border-top:1px solid #eee; margin:8px 0;">
                    <div style="margin-bottom: 5px;"><b>Doğrultu/Eğim:</b> ${r.strike} / ${r.dip}°</div>
                    <div style="margin-bottom: 5px;"><b>Koordinat:</b> ${r.y}, ${r.x}</div>
                    <div style="font-size: 0.9rem; color: #666; font-style: italic; margin-bottom: 10px;">"${r.note || 'Not yok'}"</div>
                    <button onclick="deleteRecordFromMap(${r.id})" style="width: 100%; background: #f44336; color: white; border: none; padding: 6px; border-radius: 4px; cursor: pointer; font-weight: bold;">🗑️ Sil</button>
                </div>
            `);

            // Always-visible label for marker (Tooltip)
            marker.bindTooltip(labelText.toString(), {
                permanent: true,
                direction: 'bottom',
                offset: [0, 10],
                className: 'marker-label'
            });

            markerGroup.addLayer(marker);
        }
    });

    if (dataToRender.length > 0 && selectedIds.length > 0) {
        const group = new L.featureGroup(markerGroup.getLayers());
        map.fitBounds(group.getBounds().pad(0.2));
    }
}

if (btnToggleRecords) {
    btnToggleRecords.classList.toggle('active', showRecordsOnMap);
    btnToggleRecords.addEventListener('click', () => {
        showRecordsOnMap = !showRecordsOnMap;
        btnToggleRecords.classList.toggle('active', showRecordsOnMap);
        updateMapMarkers();
    });
}

// Search Logic
if (recordSearch) {
    recordSearch.addEventListener('input', (e) => {
        renderRecords(e.target.value);
    });
}

// Follow-Me Logic
if (btnFollowMe) {
    btnFollowMe.addEventListener('click', () => {
        followMe = !followMe;
        btnFollowMe.classList.toggle('active', followMe);

        // Update live marker triangle visibility immediately
        if (liveMarker) {
            const el = liveMarker.getElement();
            if (el) {
                const triangle = el.querySelector('.live-marker');
                if (triangle) {
                    if (followMe) triangle.classList.add('visible');
                    else triangle.classList.remove('visible');
                }
            }
        }

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
            document.getElementById('rec-label').value = record.label || record.id;
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
    if (btnShare) btnShare.disabled = selectedCount === 0;
}

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

// --------------------------------------------------------------------------
// KML/KMZ Import & Layer Management
// --------------------------------------------------------------------------

// DOM Elements
const btnLayers = document.getElementById('btn-layers');
const layersModal = document.getElementById('layers-modal');
const btnLayersClose = document.getElementById('btn-layers-close');
const btnImportLayerTrigger = document.getElementById('btn-import-layer-trigger');
const fileImportInput = document.getElementById('file-import-input');
const layersList = document.getElementById('layers-list');

if (btnLayers) {
    btnLayers.addEventListener('click', () => {
        renderLayerList();
        layersModal.classList.add('active');
    });
}

if (btnLayersClose) {
    btnLayersClose.addEventListener('click', () => {
        layersModal.classList.remove('active');
    });
}

if (btnImportLayerTrigger) {
    btnImportLayerTrigger.addEventListener('click', () => {
        fileImportInput.click();
    });
}

if (fileImportInput) {
    fileImportInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const fileName = file.name;
            const extension = fileName.split('.').pop().toLowerCase();
            let geojsonData = null;

            if (extension === 'kml') {
                const text = await file.text();
                const parser = new DOMParser();
                const kml = parser.parseFromString(text, 'text/xml');
                geojsonData = toGeoJSON.kml(kml);
            } else if (extension === 'kmz') {
                const zip = await JSZip.loadAsync(file);
                // Find the first .kml file in the zip
                const kmlFile = Object.values(zip.files).find(f => f.name.toLowerCase().endsWith('.kml'));
                if (kmlFile) {
                    const text = await kmlFile.async('string');
                    const parser = new DOMParser();
                    const kml = parser.parseFromString(text, 'text/xml');
                    geojsonData = toGeoJSON.kml(kml);
                }
            }

            if (geojsonData) {
                addExternalLayer(fileName, geojsonData);
                saveExternalLayers(); // Persist
                layersModal.classList.remove('active');
            } else {
                alert("Geçerli bir KML bulunamadı.");
            }
        } catch (err) {
            console.error(err);
            alert("Dosya okunamadı: " + err.message);
        }
        fileImportInput.value = ''; // Reset
    });
}

function addExternalLayer(name, geojson) {
    if (!map) return;

    // Default Style: Blue outline, semi-transparent blue fill
    const style = {
        color: '#2196f3',
        weight: 2,
        opacity: 1,
        fillColor: '#2196f3',
        fillOpacity: 0.4 // Default Filled
    };

    const layer = L.geoJSON(geojson, {
        style: style,
        onEachFeature: (feature, layer) => {
            if (feature.properties && feature.properties.name) {
                layer.bindPopup(feature.properties.name);
            }

            // Pass clicks to map handler if in special modes
            layer.on('click', (e) => {
                if (isMeasuring) {
                    L.DomEvent.stopPropagation(e); // Stop popup
                    updateMeasurement(e.latlng);
                } else if (isAddingPoint) {
                    L.DomEvent.stopPropagation(e); // Stop popup
                    // We need to trigger the same logic as map click.
                    // Since the map click handler is anonymous, let's extract it or copy the logic.
                    // Copying logic for stability (or we could fire a map click event?)
                    // e.target.closePopup();

                    // Trigger map click logic manually or refactor. 
                    // Simpler: Fire a synthetic click on the map?
                    // map.fire('click', e); -> This might cause loop if not careful, but Leaflet usually handles it.
                    // Let's just run the logic directly or fire map click.
                    map.fire('click', { latlng: e.latlng, originalEvent: e.originalEvent });
                }
            });
        }
    }).addTo(map);

    const layerObj = {
        id: layerIdCounter++,
        name: name,
        layer: layer,
        geojson: geojson, // Store for persistence
        filled: true,
        visible: true,
        pointsVisible: true,
        areasVisible: true
    };
    externalLayers.push(layerObj);

    // Zoom to layer
    try {
        map.fitBounds(layer.getBounds());
    } catch (e) {
        // Empty layer
    }

    saveExternalLayers();
    renderLayerList();
}

function renderLayerList() {
    layersList.innerHTML = '';

    if (externalLayers.length === 0) {
        layersList.innerHTML = '<div style="color: #666; font-style: italic; text-align: center; padding: 20px;">Henüz harici katman yok.</div>';
        return;
    }

    externalLayers.forEach(l => {
        const item = document.createElement('div');
        item.className = 'layer-item';
        item.style.background = '#333';
        item.style.padding = '10px';
        item.style.borderRadius = '8px';
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.gap = '10px';
        item.style.border = '1px solid #444';

        item.innerHTML = `
            <div style="flex:1; overflow:hidden;">
                <div style="font-weight:bold; color:#2196f3; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:flex; align-items:center; gap:5px;">
                    <span>📁</span> ${l.name}
                </div>
            </div>
            <div style="display:flex; flex-wrap: wrap; gap: 6px; align-items:center;">
                <button class="layer-toggle-vis ${l.visible ? 'active' : ''}" data-id="${l.id}" style="background:${l.visible ? '#2196f3' : '#555'}; border:none; color:white; width:32px; height:32px; border-radius:6px; cursor:pointer;" title="Görünürlük">
                    ${l.visible ? '👁️' : '🕶️'}
                </button>
                <div style="display:flex; background: rgba(0,0,0,0.3); padding: 5px; border-radius: 6px; gap: 8px;">
                     <label style="display:flex; align-items:center; cursor:pointer; gap:2px;"><input type="checkbox" class="layer-points-toggle" data-id="${l.id}" ${l.pointsVisible ? 'checked' : ''}> <span style="font-size:10px; color:#fff">Nokta</span></label>
                     <label style="display:flex; align-items:center; cursor:pointer; gap:2px;"><input type="checkbox" class="layer-areas-toggle" data-id="${l.id}" ${l.areasVisible ? 'checked' : ''}> <span style="font-size:10px; color:#fff">Alan</span></label>
                     <label style="display:flex; align-items:center; cursor:pointer; gap:2px;"><input type="checkbox" class="layer-fill-toggle" data-id="${l.id}" ${l.filled ? 'checked' : ''}> <span style="font-size:10px; color:#fff">Dolgu</span></label>
                </div>
                <button class="layer-delete-btn" data-id="${l.id}" style="background:#f44336; border:none; color:white; width:30px; height:30px; border-radius:4px; cursor:pointer;">🗑️</button>
            </div>
        `;
        layersList.appendChild(item);
    });

    // Attach listeners
    document.querySelectorAll('.layer-toggle-vis').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.currentTarget.dataset.id);
            l = externalLayers.find(x => x.id === id);
            if (l) {
                toggleLayerVisibility(id, !l.visible);
                renderLayerList(); // Redraw to update eye icon
            }
        });
    });

    document.querySelectorAll('.layer-fill-toggle').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const id = parseInt(e.target.dataset.id);
            toggleLayerFill(id, e.target.checked);
        });
    });

    document.querySelectorAll('.layer-points-toggle').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const id = parseInt(e.target.dataset.id);
            toggleLayerPoints(id, e.target.checked);
        });
    });

    document.querySelectorAll('.layer-areas-toggle').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const id = parseInt(e.target.dataset.id);
            toggleLayerAreas(id, e.target.checked);
        });
    });

    document.querySelectorAll('.layer-delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.currentTarget.dataset.id);
            removeLayer(id);
        });
    });
}

function toggleLayerVisibility(id, isVisible) {
    const l = externalLayers.find(x => x.id === id);
    if (!l) return;
    l.visible = isVisible;
    if (l.visible) {
        l.layer.addTo(map);
        // Reapply sub-layer visibility based on their individual toggles
        toggleLayerPoints(id, l.pointsVisible);
        toggleLayerAreas(id, l.areasVisible);
    } else {
        map.removeLayer(l.layer);
    }
    saveExternalLayers();
    // No need to re-render list, just update the internal state
}

function toggleLayerFill(id, isFilled) {
    const l = externalLayers.find(x => x.id === id);
    if (!l) return;
    l.filled = isFilled;
    l.layer.setStyle({ fillOpacity: isFilled ? 0.4 : 0 });
    saveExternalLayers();
}

function toggleLayerPoints(id, showPoints) {
    const l = externalLayers.find(x => x.id === id);
    if (!l) return;
    l.pointsVisible = showPoints;

    l.layer.eachLayer(layer => {
        if (layer instanceof L.Marker || layer instanceof L.CircleMarker) {
            if (layer.getElement()) {
                layer.getElement().style.display = showPoints ? '' : 'none';
            }
            // Also handle shadows if any (Leaflet standard markers)
            if (layer._shadow && layer._shadow.style) {
                layer._shadow.style.display = showPoints ? '' : 'none';
            }
        }
    });
    saveExternalLayers();
}

function toggleLayerAreas(id, showAreas) {
    const l = externalLayers.find(x => x.id === id);
    if (!l) return;
    l.areasVisible = showAreas;

    l.layer.eachLayer(layer => {
        // Check if it's a path (polyline, polygon) and not a marker/circlemarker
        if (layer instanceof L.Path && !(layer instanceof L.Marker || layer instanceof L.CircleMarker)) {
            if (layer.getElement()) {
                layer.getElement().style.display = showAreas ? '' : 'none';
            }
        }
    });
    saveExternalLayers();
}

function removeLayer(id) {
    const index = externalLayers.findIndex(x => x.id === id);
    if (index === -1) return;
    const l = externalLayers[index];
    if (map) map.removeLayer(l.layer);
    externalLayers.splice(index, 1);
    saveExternalLayers();
    renderLayerList();
}

function saveExternalLayers() {
    const dataToSave = externalLayers.map(l => ({
        name: l.name,
        geojson: l.geojson,
        visible: l.visible,
        filled: l.filled,
        pointsVisible: l.pointsVisible,
        areasVisible: l.areasVisible
    }));
    localStorage.setItem('jeoExternalLayers', JSON.stringify(dataToSave));
}

function loadExternalLayers() {
    const saved = localStorage.getItem('jeoExternalLayers');
    if (!saved) return;
    try {
        const data = JSON.parse(saved);
        data.forEach(d => {
            addExternalLayer(d.name, d.geojson);
            const last = externalLayers[externalLayers.length - 1];
            if (last) {
                last.visible = d.visible;
                last.filled = d.filled;
                last.pointsVisible = d.pointsVisible !== undefined ? d.pointsVisible : true;
                last.areasVisible = d.areasVisible !== undefined ? d.areasVisible : true;
                if (!last.visible) map.removeLayer(last.layer);
                last.layer.setStyle({ fillOpacity: last.filled ? 0.4 : 0 });
                toggleLayerPoints(last.id, last.pointsVisible);
                toggleLayerAreas(last.id, last.areasVisible);
            }
        });
        renderLayerList();
    } catch (e) {
        console.error("KML yükleme hatası:", e);
    }
}

// --------------------------------------------------------------------------
// Measurement Tool Logic
// --------------------------------------------------------------------------
const btnMeasure = document.getElementById('btn-measure');
const btnPolygon = document.getElementById('id-btn-polygon');
const btnAddPoint = document.getElementById('btn-add-point');
const measureInfo = document.getElementById('measure-info');
const measureText = document.getElementById('measure-text');
const btnMeasureClear = document.getElementById('btn-measure-clear');

if (btnAddPoint) {
    btnAddPoint.addEventListener('click', () => {
        const btnConfirmPoint = document.getElementById('btn-confirm-point');
        const crosshair = document.getElementById('map-center-crosshair');

        isAddingPoint = !isAddingPoint;

        if (isAddingPoint) {
            // Disable measure mode if active
            if (isMeasuring) {
                isMeasuring = false;
                if (btnMeasure) btnMeasure.style.background = '';
                if (measureInfo) measureInfo.style.display = 'none';
                if (map) map.getContainer().style.cursor = '';
            }

            btnAddPoint.classList.add('active-add-point');
            // Show Crosshair and Confirm Button
            if (crosshair) crosshair.style.display = 'block';
            if (btnConfirmPoint) btnConfirmPoint.style.display = 'block';
        } else {
            btnAddPoint.classList.remove('active-add-point');
            if (crosshair) crosshair.style.display = 'none';
            if (btnConfirmPoint) btnConfirmPoint.style.display = 'none';
        }
    });
}

const btnConfirmPoint = document.getElementById('btn-confirm-point');
const crosshair = document.getElementById('map-center-crosshair');
const btnAddGps = document.getElementById('btn-add-gps');

if (btnConfirmPoint) {
    btnConfirmPoint.addEventListener('click', () => {
        if (!map) return;
        const center = map.getCenter();
        openRecordModalWithCoords(center.lat, center.lng, "Haritadan seçildi (Merkez)");

        // Reset Mode
        isAddingPoint = false;
        btnAddPoint.classList.remove('active-add-point');
        if (crosshair) crosshair.style.display = 'none';
        if (btnConfirmPoint) btnConfirmPoint.style.display = 'none';
    });
}

if (btnAddGps) {
    btnAddGps.addEventListener('click', () => {
        if (currentCoords.lat !== 0) {
            openRecordModalWithCoords(currentCoords.lat, currentCoords.lon, "GPS Konumu");
        } else {
            alert("Konum verisi bekleniyor...");
        }
    });
}

function openRecordModalWithCoords(lat, lon, note) {
    // Save pending coords for modal save
    pendingLat = lat;
    pendingLon = lon;

    // Convert to UTM
    let utmY, utmX;
    try {
        const zone = Math.floor((lon + 180) / 6) + 1;
        const utmZoneDef = `+proj=utm +zone=${zone} +ellps=intl +towgs84=-87,-98,-121,0,0,0,0 +units=m +no_defs`;
        const utm = proj4('WGS84', utmZoneDef, [lon, lat]);
        utmY = Math.round(utm[0]);
        utmX = Math.round(utm[1]);
    } catch (err) {
        console.error("UTM conversion failed", err);
        return;
    }

    editingRecordId = null;
    document.getElementById('rec-label').value = nextId;
    document.getElementById('rec-y').value = utmY;
    document.getElementById('rec-x').value = utmX;
    document.getElementById('rec-z').value = 0;
    document.getElementById('rec-strike').value = 0;
    document.getElementById('rec-dip').value = 0;
    document.getElementById('rec-note').value = note;

    recordModal.classList.add('active');
}

if (btnMeasure) {
    btnMeasure.addEventListener('click', () => {
        if (isMeasuring && measureMode === 'line') {
            isMeasuring = false;
        } else {
            isMeasuring = true;
            measureMode = 'line';
        }

        updateMeasureModeUI();
    });
}

if (btnPolygon) {
    btnPolygon.addEventListener('click', () => {
        if (isMeasuring && measureMode === 'polygon') {
            isMeasuring = false;
        } else {
            isMeasuring = true;
            measureMode = 'polygon';
        }

        updateMeasureModeUI();
    });
}

function updateMeasureModeUI() {
    // Reset buttons
    if (btnMeasure) btnMeasure.style.background = '';
    if (btnPolygon) btnPolygon.style.background = '';
    if (btnAddPoint) btnAddPoint.classList.remove('active-add-point');
    if (crosshair) crosshair.style.display = 'none';
    if (btnConfirmPoint) btnConfirmPoint.style.display = 'none';
    isAddingPoint = false;

    if (isMeasuring) {
        if (measureMode === 'line') {
            btnMeasure.style.background = '#f44336'; // Active Red
        } else {
            btnPolygon.style.background = '#f44336'; // Active Red
        }
        measureInfo.style.display = 'flex';
        map.dragging.enable();
    } else {
        measureInfo.style.display = 'none';
    }
}

// New Buttons
const btnMeasureUndo = document.getElementById('btn-measure-undo');
const btnMeasureSave = document.getElementById('btn-measure-save');

if (btnMeasureUndo) {
    btnMeasureUndo.addEventListener('click', undoMeasurement);
}

if (btnMeasureSave) {
    btnMeasureSave.addEventListener('click', saveMeasurement);
}

if (btnMeasureClear) {
    btnMeasureClear.addEventListener('click', () => {
        clearMeasurement();
    });
}

function clearMeasurement() {
    measurePoints = [];
    if (measureLine) {
        map.removeLayer(measureLine);
        measureLine = null;
    }
    measureMarkers.forEach(m => map.removeLayer(m));
    measureMarkers = [];
    measurePoints = [];
    isPolygon = false;

    // Clear Labels
    activeMeasureLabels.forEach(l => map.removeLayer(l));
    activeMeasureLabels = [];

    measureText.textContent = "0 m";
    updateMeasureButtons();
}

function updateMeasureButtons() {
    if (measurePoints.length > 0) {
        btnMeasureUndo.style.display = 'inline-block';
        btnMeasureSave.style.display = 'inline-block';
    } else {
        btnMeasureUndo.style.display = 'none';
        btnMeasureSave.style.display = 'none';
    }
}

function undoMeasurement() {
    if (measurePoints.length === 0) return;

    // Remove last point
    measurePoints.pop();

    // Remove last marker
    const lastMarker = measureMarkers.pop();
    if (lastMarker) map.removeLayer(lastMarker);

    // If it was a polygon, it's now a line (or less)
    if (isPolygon) {
        isPolygon = false;
        // The last point popped was the duplicate of the first.
        // We need to re-render as polyline.
        if (measureLine) map.removeLayer(measureLine);
        measureLine = null; // Will be created in redraw
    }

    redrawMeasurement();
}

function redrawMeasurement() {
    if (!map) return;

    // Clear Line
    if (measureLine) {
        map.removeLayer(measureLine);
        measureLine = null;
    }

    if (measurePoints.length === 0) {
        measureText.textContent = "0 m";
        updateMeasureButtons();
        return;
    }

    // Re-draw Polyline or Polygon
    if (isPolygon) {
        const style = { color: '#ffeb3b', weight: 4, fillOpacity: 0.3 };
        measureLine = L.polygon(measurePoints, style).addTo(map);
    } else {
        measureLine = L.polyline(measurePoints, { color: '#ffeb3b', weight: 4 }).addTo(map);
    }

    // DRAW SEGMENT LABELS (For both Line and Polygon)
    // Clear old labels first
    activeMeasureLabels.forEach(l => map.removeLayer(l));
    activeMeasureLabels = [];

    if (measurePoints.length > 1) {
        for (let i = 0; i < measurePoints.length - 1; i++) {
            const p1 = measurePoints[i];
            const p2 = measurePoints[i + 1];
            const dist = map.distance(p1, p2);
            const mid = L.latLng((p1.lat + p2.lat) / 2, (p1.lng + p2.lng) / 2);

            const point1 = map.latLngToContainerPoint(p1);
            const point2 = map.latLngToContainerPoint(p2);
            let angle = Math.atan2(point2.y - point1.y, point2.x - point1.x) * 180 / Math.PI;
            if (angle > 90 || angle < -90) angle += 180;

            const lab = L.marker(mid, {
                icon: L.divIcon({
                    className: 'segment-label-container',
                    html: `<div class="segment-label" style="transform: rotate(${angle}deg)">${formatScaleDist(dist)}</div>`,
                    iconSize: [1, 1],
                    iconAnchor: [0, 0]
                }),
                interactive: false
            }).addTo(map);
            activeMeasureLabels.push(lab);
        }

        // If polygon and closed, add the closing segment label
        if (isPolygon) {
            const p1 = measurePoints[measurePoints.length - 1];
            const p2 = measurePoints[0];
            const dist = map.distance(p1, p2);
            const mid = L.latLng((p1.lat + p2.lat) / 2, (p1.lng + p2.lng) / 2);

            const point1 = map.latLngToContainerPoint(p1);
            const point2 = map.latLngToContainerPoint(p2);
            let angle = Math.atan2(point2.y - point1.y, point2.x - point1.x) * 180 / Math.PI;
            if (angle > 90 || angle < -90) angle += 180;

            const lab = L.marker(mid, {
                icon: L.divIcon({
                    className: 'segment-label-container',
                    html: `<div class="segment-label" style="transform: rotate(${angle}deg)">${formatScaleDist(dist)}</div>`,
                    iconSize: [1, 1],
                    iconAnchor: [0, 0]
                }),
                interactive: false
            }).addTo(map);
            activeMeasureLabels.push(lab);
        }
    }

    calculateAndDisplayMeasurement();
    updateMeasureButtons();
}

function calculateAndDisplayMeasurement() {
    // Total Distance (Perimeter)
    let totalDistance = 0;
    for (let i = 0; i < measurePoints.length - 1; i++) {
        totalDistance += measurePoints[i].distanceTo(measurePoints[i + 1]);
    }

    let text = "";
    if (totalDistance < 1000) text = Math.round(totalDistance) + " m";
    else text = (totalDistance / 1000).toFixed(2) + " km";

    if (isPolygon) {
        // Calculate Area using UTM (Planar) approximation
        // Convert all points to UTM
        const utmPoints = measurePoints.map(p => {
            const zone = Math.floor((p.lng + 180) / 6) + 1;
            const utmZoneDef = `+proj=utm +zone=${zone} +ellps=intl +towgs84=-87,-98,-121,0,0,0,0 +units=m +no_defs`;
            return proj4('WGS84', utmZoneDef, [p.lng, p.lat]);
        });

        // Shoelace Formula
        let area = 0;
        let j = utmPoints.length - 1;
        for (let i = 0; i < utmPoints.length; i++) {
            area += (utmPoints[j][0] + utmPoints[i][0]) * (utmPoints[j][1] - utmPoints[i][1]);
            j = i;
        }
        area = Math.abs(area / 2.0);

        // Append Area Text
        let areaText = "";
        if (area < 10000) areaText = Math.round(area) + " m²";
        else if (area < 1000000) areaText = (area / 10000).toFixed(2) + " ha";
        else areaText = (area / 1000000).toFixed(2) + " km²";

        measureText.innerHTML = `${text}<br><span style="font-size:0.8em; color:#ddd">Alan: ${areaText}</span>`;
    } else {
        measureText.textContent = text;
    }
}

function saveMeasurement() {
    if (measurePoints.length === 0) return;

    // Save geometry for persistence
    pendingGeometry = measurePoints.map(p => [p.lat, p.lng]);
    pendingGeometryType = isPolygon ? 'polygon' : 'polyline';

    // Open Modal
    editingRecordId = null;
    document.getElementById('rec-label').value = nextId;

    // Coords: Use Last Point
    const lastP = measurePoints[measurePoints.length - 1];

    // UTM Conversion
    const zone = Math.floor((lastP.lng + 180) / 6) + 1;
    const utmZoneDef = `+proj=utm +zone=${zone} +ellps=intl +towgs84=-87,-98,-121,0,0,0,0 +units=m +no_defs`;
    const utm = proj4('WGS84', utmZoneDef, [lastP.lng, lastP.lat]);

    document.getElementById('rec-y').value = Math.round(utm[0]);
    document.getElementById('rec-x').value = Math.round(utm[1]);
    document.getElementById('rec-z').value = 0;
    document.getElementById('rec-strike').value = 0;
    document.getElementById('rec-dip').value = 0;

    // Note
    let note = measureText.innerText.replace(/\n/g, ", ");
    document.getElementById('rec-note').value = note;

    recordModal.classList.add('active');
}

function updateMeasurement(latlng) {
    if (!map) return;

    // Check Snapping (Close Polygon)
    if (measurePoints.length > 2) {
        const startPoint = measurePoints[0];
        const dist = map.distance(latlng, startPoint);

        // Snapping Tolerance: 30 meters or significant pixel distance
        // Depends on zoom, but 30m is usually good for outdoors. 
        // For polygon mode, we want it to be snappy.
        if (dist < 30) {
            // Close Loop automatically if clicked near start
            isPolygon = true;
            redrawMeasurement();
            return;
        }
    }

    if (isPolygon) {
        alert("Alan zaten kapalı. Değiştirmek için 'Geri Al' kullanın.");
        return;
    }

    // Force polygon mode to close if second point matches start (not applicable)
    // Add Point
    measurePoints.push(latlng);

    // If we are in line mode, we only allow 2 points? No, ruler can have multiple segments too.
    // If user intended 'polygon', they should use polygon button.
    if (measureMode === 'polygon' && measurePoints.length > 2) {
        // Just keep adding, user will close it by clicking start.
    }

    // Add Marker
    const marker = L.circleMarker(latlng, {
        radius: 4,
        color: '#ffeb3b',
        fillColor: '#ffeb3b',
        fillOpacity: 1
    }).addTo(map);
    measureMarkers.push(marker);

    redrawMeasurement();
}

// View Control
document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
        const target = btn.dataset.target; // Changed from 'view' to 'target' to match existing logic

        // Auto-lock when leaving or entering views (security first)
        isMeasuring = false;
        updateMeasureModeUI();

        if (!isRecordsLocked) {
            isRecordsLocked = true;
            try {
                updateLockUI();
                renderRecords();
            } catch (e) { console.error("Lock error", e); }
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

// Export Logic Refactored (Scope: 'all' or 'selected')
function exportData(type, scope = 'selected') {
    let dataToExport = [];
    if (scope === 'all') {
        dataToExport = records;
    } else {
        const selectedIds = Array.from(document.querySelectorAll('.record-select:checked')).map(cb => parseInt(cb.dataset.id));
        dataToExport = records.filter(r => selectedIds.includes(r.id));
    }

    if (dataToExport.length === 0) {
        alert("Dışa aktarılacak kayıt bulunamadı.");
        return;
    }

    const timestamp = new Date().getTime();
    if (type === 'csv') {
        const header = ["No", "Y", "X", "Z", "Strike", "Dip", "Note"];
        const csvRows = [header.join(',')];
        dataToExport.forEach(r => {
            const row = [r.id, r.y, r.x, r.z, r.strike, r.dip, r.note];
            csvRows.push(row.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','));
        });
        downloadFile(csvRows.join('\n'), `JeoCompass_${scope === 'all' ? 'Tum_Kayitlar' : 'Secilenler'}_${timestamp}.csv`, 'text/csv');
    } else if (type === 'kml') {
        let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>JeoCompass ${scope === 'all' ? 'Tüm Kayıtlar' : 'Seçilenler'}</name>`;
        dataToExport.forEach(r => {
            kml += `
    <Placemark>
      <name>Kayıt ${r.id}</name>
      <description>Doğrultu: ${r.strike}, Eğim: ${r.dip}, Not: ${r.note || ''}</description>
      <Point>
        <coordinates>${r.lon || 0},${r.lat || 0},${r.z || 0}</coordinates>
      </Point>
    </Placemark>`;
        });
        kml += `
  </Document>
</kml>`;
        downloadFile(kml, `JeoCompass_${scope === 'all' ? 'Tum_Kayitlar' : 'Secilenler'}_${timestamp}.kml`, 'application/vnd.google-earth.kml+xml');
    }
}

// Share Modal Control
if (btnShare) {
    btnShare.addEventListener('click', () => {
        if (!btnShare.disabled) shareModal.classList.add('active');
    });
}

if (document.getElementById('btn-share-cancel')) {
    document.getElementById('btn-share-cancel').addEventListener('click', () => shareModal.classList.remove('active'));
}

// Share Actions (Fixed Button IDs)
const btnShareAllCsv = document.getElementById('btn-share-all-csv');
const btnShareAllKml = document.getElementById('btn-share-all-kml');
const btnShareSelCsv = document.getElementById('btn-share-sel-csv');
const btnShareSelKml = document.getElementById('btn-share-sel-kml');

if (btnShareAllCsv) btnShareAllCsv.addEventListener('click', () => { exportData('csv', 'all'); shareModal.classList.remove('active'); });
if (btnShareAllKml) btnShareAllKml.addEventListener('click', () => { exportData('kml', 'all'); shareModal.classList.remove('active'); });
if (btnShareSelCsv) btnShareSelCsv.addEventListener('click', () => { exportData('csv', 'selected'); shareModal.classList.remove('active'); });
if (btnShareSelKml) btnShareSelKml.addEventListener('click', () => { exportData('kml', 'selected'); shareModal.classList.remove('active'); });
// Options Modal Control
if (btnMoreOptions) {
    btnMoreOptions.addEventListener('click', () => {
        optionsModal.classList.add('active');
    });
}

if (document.getElementById('btn-options-cancel')) {
    document.getElementById('btn-options-cancel').addEventListener('click', () => optionsModal.classList.remove('active'));
}

// Updated Delete Logic Location (Now inside Options Modal)
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

/** Global delete helper for Map Popups **/
window.deleteRecordFromMap = function (id) {
    if (confirm(`Kayıt #${id} silinecek. Emin misiniz?`)) {
        records = records.filter(r => r.id !== id);
        saveRecords();
        renderRecords();
        updateMapMarkers();
        if (selectAllCheckbox) selectAllCheckbox.checked = false;
    }
};

function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type: type });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

// Lock Toggle Logic
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
