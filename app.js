// App Initialization & Splash Screen
function initApp() {
    // 1. Remove Splash Screen
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.classList.add('hidden');
            setTimeout(() => splash.remove(), 1000);
        }
    }, 2500);

    // 2. Request Wake Lock (Screen On)
    try {
        requestWakeLock();
    } catch (e) {
        console.warn('Wake Lock request failed', e);
    }
}

// Ensure init runs
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// Wake Lock Logic
let wakeLock = null;
async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            // Re-acquire on visibility change
            document.addEventListener('visibilitychange', async () => {
                if (wakeLock !== null && document.visibilityState === 'visible') {
                    wakeLock = await navigator.wakeLock.request('screen');
                }
            });
        } catch (err) {
            console.log(`${err.name}, ${err.message}`);
        }
    }
}

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
const BUFFER_SIZE = 10;
const CACHE_NAME = 'jeocompass-v356';
let isStationary = false;
let lastRotations = [];
const STATIONARY_THRESHOLD = 0.15;
// Tracking State (v354)
let isTracking = false;
let trackPath = [];
let trackPolyline = null;
let savedTrackPath = JSON.parse(localStorage.getItem('jeoTrackPath')) || [];
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
    updateScaleValues();
}

// Simple Toast System for User Feedback
function showToast(message, duration = 3000) {
    let toast = document.getElementById('jeo-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'jeo-toast';
        toast.style.cssText = 'position:fixed; bottom:80px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.8); color:white; padding:10px 20px; border-radius:20px; font-size:0.9rem; z-index:10000; transition:opacity 0.3s; pointer-events:none;';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';

    setTimeout(() => { toast.style.opacity = '0'; }, duration);
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
                requestWakeLock();
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
        requestWakeLock(); // Keep screen on

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
        try {
            currentCoords.lat = p.coords.latitude;
            currentCoords.lon = p.coords.longitude;
            currentCoords.acc = p.coords.accuracy;
            currentCoords.alt = p.coords.altitude;

            // Update Live Marker (Heartbeat Triangle)
            if (map && currentCoords.lat) {
                const livePos = [currentCoords.lat, currentCoords.lon];
                if (!liveMarker) {
                    const liveIcon = L.divIcon({
                        className: 'heartbeat-container',
                        html: '<div class="heartbeat-pulse"></div><div class="heartbeat-triangle"></div>',
                        iconSize: [32, 32],
                        iconAnchor: [16, 16]
                    });
                    liveMarker = L.marker(livePos, { icon: liveIcon, zIndexOffset: 1000 }).addTo(liveLayer);
                } else {
                    liveMarker.setLatLng(livePos);
                }

                if (followMe) {
                    map.panTo(livePos);
                }
            }

            // Background altitude fetch
            const now = Date.now();
            if (onlineMyAlt === null || (now - lastFetches.me > 60000)) {
                fetchElevation(currentCoords.lat, currentCoords.lon, (alt) => {
                    if (alt !== null) {
                        onlineMyAlt = alt;
                        lastFetches.me = Date.now();
                    }
                });
            }

            processHeadingAndDip();
            updateDisplay();
        } catch (e) {
            console.error("WatchPosition error:", e);
        }
    }, (err) => {
        console.error("Konum hatası:", err);
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 });
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
                // Keep the original creation time when editing
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
        const colCount = isRecordsLocked ? 8 : 10;
        tableBody.innerHTML = `<tr><td colspan="${colCount}">${filter ? 'No matching records found' : 'No records yet'}</td></tr>`;
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
let highlightLayer = L.layerGroup(); // Layer for parcel boundaries
let activeMapLayer = "Street (OSM)"; // Track active layer globally
let lastSelectedParcel = null; // Track the last clicked parcel for two-stage check

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


    const openTopo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 23,
        maxNativeZoom: 16, // Tiles exist up to 17, but 16 is safer for all regions
        attribution: 'Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap (CC-BY-SA)'
    });

    const baseMaps = {
        "Street (OSM)": osm,
        "Terrain (Google)": googleTerrain,
        "Satellite (Google)": googleSat,
        "Topographic (OpenTopo)": openTopo
    };

    // Load saved layer preference
    const savedLayerName = localStorage.getItem('jeoMapLayer') || "Street (OSM)";
    activeMapLayer = savedLayerName; // Set global tracker
    let initialLayer = baseMaps[savedLayerName] || osm;
    initialLayer.addTo(map);
    liveLayer.addTo(map);
    highlightLayer.addTo(map);

    const overlayMaps = {
        "Live Location": liveLayer
    };

    L.control.layers(baseMaps, overlayMaps).addTo(map);

    // Persist layer selection
    map.on('baselayerchange', (e) => {
        activeMapLayer = e.name; // Update global tracker
        localStorage.setItem('jeoMapLayer', e.name);
    });

    // Label Collision Prevention & Auto Alignment
    function preventTooltipOverlap() {
        const labels = Array.from(document.querySelectorAll('.kml-label'));
        if (labels.length === 0) return;

        const boxes = [];

        labels.forEach(label => {
            // Reset position/visibility
            label.style.opacity = '1';
            label.style.visibility = 'visible';
            label.style.marginTop = '0px';
            label.style.marginLeft = '0px';

            const scenarios = [
                { mt: 0, ml: 0 },       // Top (Default)
                { mt: 15, ml: 40 },     // Right
                { mt: 35, ml: 0 },      // Bottom
                { mt: 15, ml: -40 }     // Left
            ];

            let success = false;

            for (const s of scenarios) {
                label.style.marginTop = s.mt + 'px';
                label.style.marginLeft = s.ml + 'px';

                const rect = label.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0) continue;

                let currentBox = {
                    top: rect.top - 1,
                    left: rect.left - 1,
                    bottom: rect.bottom + 1,
                    right: rect.right + 1
                };

                let overlap = false;
                for (const box of boxes) {
                    if (!(currentBox.right < box.left ||
                        currentBox.left > box.right ||
                        currentBox.bottom < box.top ||
                        currentBox.top > box.bottom)) {
                        overlap = true;
                        break;
                    }
                }

                if (!overlap) {
                    boxes.push(currentBox);
                    success = true;
                    break;
                }
            }

            if (!success) {
                label.style.opacity = '0';
                label.style.visibility = 'hidden';
            }
        });
    }

    map.on('zoomend moveend', () => {
        // Small delay to allow Leaflet to position tooltips
        setTimeout(preventTooltipOverlap, 100);
    });

    // Also run when layer sets are likely to have changed
    map.on('overlayadd baselayerchange', () => {
        setTimeout(preventTooltipOverlap, 500);
    });

    // Combined Scale and UTM Control (Bottom Left)
    initMapControls();

    markerGroup = L.layerGroup().addTo(map);

    // Zoom listener for scale-based visibility
    map.on('zoomend', () => {
        updateMapMarkers();
    });

    // --- Tracking System (v355 - Single Button) ---
    // Function to check if tracking is active (for map feedback)
    function updateTrackingButton() {
        const btn = document.getElementById('btn-track-toggle');
        if (!btn) return;

        if (isTracking) {
            btn.innerHTML = '<span class="fab-icon" style="color:#ff5252;">⏹</span>'; // Stop Icon
            btn.classList.add('recording');
        } else {
            btn.innerHTML = '<span class="fab-icon">👣</span>'; // Footprint Icon
            btn.classList.remove('recording');
        }
    }

    // Initialize Polyline
    if (savedTrackPath.length > 0) {
        trackPath = savedTrackPath;
        trackPolyline = L.polyline(trackPath, { color: '#ff5722', weight: 4, dashArray: '10, 10' }).addTo(map);
        // If data exists but tracking is off, we are in "Paused/Finished" state but we don't have a UI for it.
        // Let's assume on reload if we have data we show it, but don't resume unless saved state says so.
        // For simplicity, just show it. Button implies "Start New" or if we want to continue?
        // Let's assume button click starts NEW or CONTINUES? 
        // User workflow: Start -> Stop -> Save.
    }

    function updateTrack(lat, lon) {
        if (!isTracking) return;

        // Add point
        trackPath.push([lat, lon]);

        // Update Polyline
        if (!trackPolyline) {
            trackPolyline = L.polyline(trackPath, { color: '#ff5722', weight: 4, dashArray: '10, 10' }).addTo(map);
        } else {
            trackPolyline.setLatLngs(trackPath);
        }

        // Persist
        localStorage.setItem('jeoTrackPath', JSON.stringify(trackPath));
    }

    // Single Toggle Button Logic
    const btnTrackToggle = document.getElementById('btn-track-toggle');
    if (btnTrackToggle) {
        btnTrackToggle.addEventListener('click', () => {
            if (!isTracking) {
                // START
                isTracking = true;
                updateTrackingButton();
                showToast("İz kaydı başladı.");
            } else {
                // STOP Request
                // Ask to save
                if (confirm("Kayıt durdurulsun mu? \n(Tamam: Kaydet ve Bitir / İptal: Devam Et)")) {
                    isTracking = false;
                    updateTrackingButton();

                    // Now ask to export
                    if (confirm("İz dosyası (KML) olarak kaydedilsin mi?")) {
                        exportKML();

                        // Clear map after save?
                        if (confirm("Haritadaki iz temizlensin mi?")) {
                            clearTrack();
                        }
                    } else {
                        // User didn't save. Ask to clear?
                        if (confirm("İz silinsin mi? (Geri alınamaz)")) {
                            clearTrack();
                        }
                    }
                }
            }
        });
    }

    function exportKML() {
        if (trackPath.length === 0) {
            showToast("Kaydedilecek veri yok.");
            return;
        }

        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10);
        const timeStr = now.toTimeString().slice(0, 5).replace(':', '-');
        const filename = `track_${dateStr}_${timeStr}.kml`;

        let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Track ${dateStr} ${timeStr}</name>
    <Style id="dashed">
      <LineStyle>
        <color>ff0000ff</color>
        <width>4</width>
      </LineStyle>
    </Style>
    <Placemark>
      <name>Path</name>
      <styleUrl>#dashed</styleUrl>
      <LineString>
        <tessellate>1</tessellate>
        <coordinates>
`;
        trackPath.forEach(pt => {
            kml += `${pt[1]},${pt[0]},0 `;
        });

        kml += `
        </coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>`;

        const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function clearTrack() {
        if (trackPolyline) {
            map.removeLayer(trackPolyline);
            trackPolyline = null;
        }
        trackPath = [];
        localStorage.removeItem('jeoTrackPath');
        showToast("İz temizlendi.");
    }

    /* REMOVED LOCK SYSTEM (v355) */


    // Map Click Handler for Interactions
    map.on('click', (e) => {
        if (isMeasuring) {
            updateMeasurement(e.latlng);
        } else if (isAddingPoint) {
            // Handled by Crosshair
        } else {
            const clickedLat = e.latlng.lat;
            const clickedLon = e.latlng.lng;

            const isTkgmSelected = activeMapLayer && activeMapLayer.includes("TKGM");

            // If not TKGM, do nothing on map click (as requested in v323)
            if (!isTkgmSelected) return;

            // Show Loading Popup
            const loadingPopup = L.popup()
                .setLatLng(e.latlng)
                .setContent('<div style="padding:10px; text-align:center;"><div class="spinner-small" style="display:inline-block; width:15px; height:15px; border:2px solid #2196f3; border-top-color:transparent; border-radius:50%; animation:spin 1s linear infinite;"></div> Veriler çekiliyor...</div>')
                .openOn(map);

            // Convert to UTM for fallback/display
            let utmY, utmX, zone;
            try {
                zone = Math.floor((clickedLon + 180) / 6) + 1;
                const utmZoneDef = `+proj=utm +zone=${zone} +ellps=intl +towgs84=-87,-98,-121,0,0,0,0 +units=m +no_defs`;
                const utm = proj4('WGS84', utmZoneDef, [clickedLon, clickedLat]);
                utmY = Math.round(utm[0]);
                utmX = Math.round(utm[1]);
            } catch (err) { }

            // Fetch Elevation and Parcel Data
            const tasks = [
                new Promise(resolve => fetchElevation(clickedLat, clickedLon, resolve)),
                fetchParcelData(clickedLat, clickedLon)
            ];

            Promise.all(tasks).then(([alt, parcelResult]) => {
                const zVal = alt !== null ? alt : "-";
                const parcel = parcelResult ? parcelResult.attributes : null;
                const geometry = parcelResult ? parcelResult.geometry : null;

                if (!parcel) {
                    showToast("Parsel bulunamadı.");
                }

                if (parcel && parcelId !== lastSelectedParcel) {
                    showToast("Parsel sınırları yüklendi.");
                    // Stage 1: Show Boundaries
                    highlightLayer.clearLayers();
                    lastSelectedParcel = parcelId;

                    if (geometry && geometry.rings) {
                        const latlngs = geometry.rings[0].map(pt => [pt[1], pt[0]]);
                        L.polygon(latlngs, {
                            color: '#ff0000', // Red border
                            weight: 3,
                            fillColor: '#ff0000', // Red fill
                            fillOpacity: 0.2
                        }).addTo(highlightLayer);

                        // Silent marking: Just close the loading popup
                        map.closePopup();
                    } else {
                        map.closePopup();
                    }
                    return;
                }

                let content = `<div class="map-popup-container" style="min-width: 180px;">`;
                content += `<div style="font-weight:bold; color:#ff0000; font-size:1rem; margin-bottom:8px; border-bottom:1px solid #444; padding-bottom:4px;">🏠 Parsel Bilgileri</div>`;

                if (parcel) {
                    const parcelStr = JSON.stringify(parcel).replace(/"/g, '&quot;');
                    content += `
                        <table style="width:100%; font-size:0.85rem; border-collapse:collapse; margin-bottom:4px;">
                            <tr><td style="color:#aaa; padding:2px 0;">İl/İlçe:</td><td style="text-align:right;">${parcel.IL_AD || '-'} / ${parcel.ILCE_AD || '-'}</td></tr>
                            <tr><td style="color:#aaa; padding:2px 0;">Mahalle:</td><td style="text-align:right;">${parcel.MAHALLE_AD || '-'}</td></tr>
                            <tr><td style="color:#aaa; padding:2px 0;">Ada/Parsel:</td><td style="text-align:right; font-weight:bold; color:#fff;">${parcel.ADA_NO || '-'}/${parcel.PARSEL_NO || '-'}</td></tr>
                            <tr><td style="color:#aaa; padding:2px 0;">Nitelik:</td><td style="text-align:right;">${parcel.OZN_NITELIK || '-'}</td></tr>
                            <tr><td style="color:#aaa; padding:2px 0;">Mevkii:</td><td style="text-align:right;">${parcel.MEVKII || '-'}</td></tr>
                        </table>
                        <div style="font-size:0.75rem; color:#666; margin:8px 0; border-top:1px solid #333; padding-top:4px;">
                            UTM: ${utmY}, ${utmX} (Z: ${zVal}m)
                        </div>
                        <div style="margin-top:10px; display:flex; gap:5px;">
                            <button onclick='saveParcelRecord(${clickedLat}, ${clickedLon}, ${zVal === "-" ? 0 : zVal}, ${parcelStr})' style="flex:1; background:#2196f3; color:white; border:none; padding:8px; border-radius:4px; font-size:0.85rem; cursor:pointer; font-weight:bold;">💾 Kaydet</button>
                            <button onclick="map.closePopup()" style="flex:1; background:#444; color:white; border:none; padding:8px; border-radius:4px; font-size:0.85rem; cursor:pointer;">Kapat</button>
                        </div>
                    `;
                } else {
                    content += `<div style="color:#f44336; font-size:0.85rem; margin-bottom:8px; text-align:center;">Parsel bulunamadı.</div>`;
                    content += `
                        <table style="width:100%; font-size:0.85rem; border-collapse:collapse;">
                            <tr><td style="color:#aaa; padding:2px 0;">Y:</td><td style="text-align:right;">${utmY}</td></tr>
                            <tr><td style="color:#aaa; padding:2px 0;">X:</td><td style="text-align:right;">${utmX}</td></tr>
                            <tr><td style="color:#aaa; padding:2px 0;">Z:</td><td style="text-align:right;">${zVal} m</td></tr>
                        </table>
                        <div style="margin-top:10px;">
                            <button onclick="map.closePopup()" style="width:100%; background:#444; color:white; border:none; padding:8px; border-radius:4px; font-size:0.85rem; cursor:pointer;">Kapat</button>
                        </div>
                    `;
                }
                content += `</div>`;
                loadingPopup.setContent(content);
            }).catch(err => {
                loadingPopup.setContent("Sorgulama hatası.");
            });
        }
    });


    updateMapMarkers();
    loadExternalLayers();
}

/** Combined Map Controls (Scale + UTM) **/
function initMapControls() {
    if (document.querySelector('.custom-scale-wrapper')) return;

    const MapControls = L.Control.extend({
        options: { position: 'bottomleft' },
        onAdd: function (map) {
            const wrapper = L.DomUtil.create('div', 'custom-scale-wrapper');
            wrapper.innerHTML = `
                <div class="custom-scale-control">
                    <div class="scale-labels">
                        <span class="label-zero">0</span>
                        <span id="scale-mid" class="label-mid"></span>
                        <span id="scale-end" class="label-end"></span>
                    </div>
                    <div class="scale-bars">
                        <div class="scale-segment"></div>
                        <div class="scale-segment"></div>
                    </div>
                    <span id="scale-unit" class="scale-unit"></span>
                </div>
                <div class="utm-control-container">
                    <div id="map-utm-coords" class="map-utm-coords-new">Konum bekleniyor...</div>
                </div>
            `;
            return wrapper;
        }
    });

    new MapControls().addTo(map);
    map.on('zoomend moveend move', updateScaleValues);
    map.on('moveend', () => {
        if (isAddingPoint) {
            fetchElevation(map.getCenter().lat, map.getCenter().lng, (alt) => {
                onlineCenterAlt = alt;
                updateScaleValues();
            });
        }
    });
    updateScaleValues();
}

/** Hybrid Elevation Logic **/
let onlineMyAlt = null;
let onlineCenterAlt = null;
let lastFetches = { me: 0, center: 0 };

function fetchElevation(lat, lon, callback) {
    if (!navigator.onLine) return callback(null);

    const url = `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`;
    fetch(url)
        .then(res => res.json())
        .then(data => {
            if (data && data.elevation && data.elevation.length > 0) {
                callback(Math.round(data.elevation[0]));
            } else {
                callback(null);
            }
        })
        .catch(() => callback(null));
}

function updateScaleValues() {
    if (!map) return;
    const scaleContainer = document.querySelector('.scale-bars');
    if (!scaleContainer) return;

    const width = scaleContainer.getBoundingClientRect().width; // Measure actual pixel width of 2cm
    const centerLatLng = map.getCenter();
    const pCenter = map.latLngToContainerPoint(centerLatLng);
    const pEnd = L.point(pCenter.x + width, pCenter.y);
    const latLngEnd = map.containerPointToLatLng(pEnd);
    const distance = map.distance(centerLatLng, latLngEnd);

    let midVal = distance / 2;
    let endVal = distance;

    const midEl = document.getElementById('scale-mid');
    const endEl = document.getElementById('scale-end');
    const unitEl = document.getElementById('scale-unit');
    const utmEl = document.getElementById('map-utm-coords');

    const formattedMid = formatScaleDistParts(midVal);
    const formattedEnd = formatScaleDistParts(endVal);

    if (midEl) midEl.textContent = formattedMid.val;
    if (endEl) endEl.textContent = formattedEnd.val;
    if (unitEl) unitEl.textContent = formattedEnd.unit;

    // Update UTM display (Current or Target?)
    if (utmEl) {
        let displayLat = currentCoords.lat;
        let displayLon = currentCoords.lon;
        // Logic: Online First, then Baro, then GPS
        let myBestAlt = onlineMyAlt !== null ? onlineMyAlt : (currentCoords.baroAlt !== null ? Math.round(currentCoords.baroAlt) : (currentCoords.alt !== null ? Math.round(currentCoords.alt) : 0));
        let displayAlt = myBestAlt;

        if (isAddingPoint && map) {
            const center = map.getCenter();
            displayLat = center.lat;
            displayLon = center.lng;
            displayAlt = onlineCenterAlt !== null ? onlineCenterAlt : myBestAlt;
        }

        if (displayLat) {
            const zone = Math.floor((displayLon + 180) / 6) + 1;
            const utmZoneDef = `+proj=utm +zone=${zone} +ellps=intl +towgs84=-87,-98,-121,0,0,0,0 +units=m +no_defs`;
            try {
                const [easting, northing] = proj4('WGS84', utmZoneDef, [displayLon, displayLat]);
                const eastPart = Math.round(easting);
                const northPart = Math.round(northing);
                const modeLabel = isAddingPoint ? "🎯" : "📍";
                // Simplified display to prevent overflow and ensure icon is visible
                utmEl.innerHTML = `
                    <span style="font-size:0.75em; color:#ddd; margin-right:1px;">Y:</span><span style="margin-right:1mm;">${eastPart}</span>
                    <span style="font-size:0.75em; color:#ddd; margin-right:1px;">X:</span><span style="margin-right:0.5mm;">${northPart}</span>
                    <span style="font-size:0.75em; color:#ddd; margin-right:1px;">Z:</span><span style="margin-right:0mm;">${displayAlt}</span>
                    <span style="font-size:1.1em; vertical-align: middle;">${modeLabel}</span>
                `;
            } catch (e) {
                utmEl.textContent = "UTM Hatası";
            }
        } else {
            utmEl.textContent = "Waiting for location...";
        }
    }
}

function formatScaleDistParts(d) {
    let val, unit;
    if (d < 1000) {
        val = Math.round(d);
        unit = "m";
    } else {
        val = (d / 1000).toFixed(2);
        unit = "km";
    }
    return { val, unit };
}

function formatScaleDist(d) {
    const parts = formatScaleDistParts(d);
    return `${parts.val} ${parts.unit}`;
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

function calculateAreaHelper(latlngs) {
    if (latlngs.length < 3) return 0;
    // Convert to UTM for planar area calculation
    const utmPoints = latlngs.map(p => {
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
    return area;
}

function formatArea(area) {
    if (area < 10000) return Math.round(area) + " m2";
    if (area < 1000000) return (area / 10000).toFixed(2) + " ha";
    return (area / 1000000).toFixed(2) + " km2";
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
                    <div class="map-popup-container">
                        <b style="font-size: 1.1rem;">Measurement: ${labelText}</b>
                        <hr style="border:0; border-top:1px solid #eee; margin:8px 0;">
                        <div style="font-size: 0.95rem; margin-bottom: 8px;">${r.note || 'No note'}</div>
                        <div style="background: #f5f5f5; padding: 8px; border-radius: 4px; font-size: 0.85rem; margin-bottom: 10px;">
                            ${r.geomType === 'polygon' ? `<b>Perimeter:</b> ${formatScaleDist(totalLen)}<br><b>Area:</b> ${formatArea(calculateAreaHelper(latlngs))}` : `<b>Length:</b> ${formatScaleDist(totalLen)}`}
                        </div>
                        <button onclick="deleteRecordFromMap(${r.id})" style="width: 100%; background: #f44336; color: white; border: none; padding: 6px; border-radius: 4px; cursor: pointer; font-weight: bold;">🗑️ Delete</button>
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
                    <div class="pin-container" style="width:${iconBaseSize}px; height:${iconBaseSize}px; display: flex; align-items: center; justify-content: center; position: relative;">
                        <div class="red-dot-symbol" style="width:${12 * scaleFactor}px; height:${12 * scaleFactor}px; background-color: #f44336; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>
                        <div class="marker-id-label-v3" style="font-size:${labelFontSize}px; padding: 1px ${4 * scaleFactor}px; top:-${4 * scaleFactor}px; right:-${6 * scaleFactor}px;">${labelText}</div>
                    </div>
                `,
                iconSize: [iconBaseSize, iconBaseSize],
                iconAnchor: [iconBaseSize / 2, iconBaseSize / 2]
            });

            const marker = L.marker([r.lat, r.lon], { icon: markerIcon });
            marker.bindPopup(`
                <div class="map-popup-container">
                    <b style="font-size: 1.1rem;">Record ${labelText}</b><hr style="border:0; border-top:1px solid #eee; margin:8px 0;">
                    <div style="margin-bottom: 5px;"><b>Strike / Dip:</b> ${r.strike} / ${r.dip}</div>
                    <div style="margin-bottom: 5px;"><b>Coordinate:</b> ${r.y}, ${r.x}</div>
                    <div style="font-size: 0.9rem; color: #666; font-style: italic; margin-bottom: 10px;">"${r.note || 'No note'}"</div>
                    <button onclick="deleteRecordFromMap(${r.id})" style="width: 100%; background: #f44336; color: white; border: none; padding: 6px; border-radius: 4px; cursor: pointer; font-weight: bold;">🗑️ Delete</button>
                </div>
            `);

            // Always-visible label for marker (Tooltip) - REMOVED per user request
            /*
            marker.bindTooltip(labelText.toString(), {
                permanent: true,
                direction: 'bottom',
                offset: [0, 10],
                className: 'marker-label'
            });
            */

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
        if (followMe && currentCoords.lat !== 0) {
            map.panTo([currentCoords.lat, currentCoords.lon]);
        }
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
            let fileName = file.name;
            const extension = file.name.split('.').pop().toLowerCase();
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
        pointToLayer: (feature, latlng) => {
            // Kibar Geological/Pin Icon
            const iconHtml = `
                <div class="kml-marker-pin">
                    <div class="kml-marker-dot"></div>
                </div>
            `;
            const icon = L.divIcon({
                className: 'kml-custom-icon',
                html: iconHtml,
                iconSize: [8, 8], // Even smaller icon size
                iconAnchor: [4, 4]
            });
            return L.marker(latlng, { icon: icon });
        },
        onEachFeature: (feature, layer) => {
            if (feature.properties && feature.properties.name) {
                layer.bindTooltip(feature.properties.name, {
                    permanent: true,
                    direction: 'top',
                    className: 'kml-label',
                    offset: [0, 8], // Fine-tuned offset to look natural (close but not on top)
                    sticky: true
                });
            }
            let popupContent = `<div class="map-popup-container">`;
            if (feature.properties) {
                if (feature.properties.name) {
                    popupContent += `<div style="font-weight:bold; color:#2196f3; font-size:1.1rem; margin-bottom:5px;">${feature.properties.name}</div>`;
                }
                popupContent += `<table style="width:100%; border-collapse:collapse; font-size:0.85rem;">`;
                for (let key in feature.properties) {
                    if (['name', 'styleUrl', 'styleHash', 'styleMapHash', 'description'].indexOf(key) === -1) {
                        popupContent += `<tr style="border-bottom:1px solid #eee;"><td style="padding:4px 0; color:#666; font-weight:bold;">${key}:</td><td style="padding:4px 0; text-align:right;">${feature.properties[key]}</td></tr>`;
                    }
                }

                // Add area for polygons
                if (feature.geometry && (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon')) {
                    try {
                        let latlngs = layer.getLatLngs();
                        if (feature.geometry.type === 'Polygon') latlngs = latlngs[0];
                        else latlngs = latlngs[0][0];
                        const area = calculateAreaHelper(latlngs);
                        popupContent += `<tr style="color:#2196f3; font-weight:bold;"><td style="padding:8px 0;">Area:</td><td style="padding:8px 0; text-align:right;">${formatArea(area)}</td></tr>`;
                    } catch (e) {
                        console.error("GIS Area calculation failed", e);
                    }
                }
                popupContent += `</table>`;
                if (feature.properties.description) {
                    popupContent += `<div style="margin-top:8px; font-size:0.8rem; border-top:1px solid #eee; padding-top:5px; color:#444;">${feature.properties.description}</div>`;
                }
            }
            popupContent += `</div>`;
            layer.bindPopup(popupContent);

            // Pass clicks to map handler if in special modes
            layer.on('click', (e) => {
                const l = externalLayers.find(obj => obj.layer === e.target._eventParents[Object.keys(e.target._eventParents)[0]]);

                // If polygon and not filled, ignore clicks inside
                if (feature.geometry && (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon')) {
                    const layerObj = externalLayers.find(lobj => lobj.layer.hasLayer(layer));
                    if (layerObj && !layerObj.filled) {
                        // Leaflet handles stroke-only clicks automatically if fill: false,
                        // but since we might have generic handlers, we double check.
                        if (e.originalEvent.target.classList.contains('leaflet-interactive') && !e.originalEvent.target.getAttribute('fill')) {
                            // Border click? Continue.
                        } else {
                            // Interior click on a transparent polygon - pass to map
                            L.DomEvent.stopPropagation(e);
                            map.fire('click', e);
                            return;
                        }
                    }
                }

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
        areasVisible: true,
        labelsVisible: true
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
        layersList.innerHTML = '<div style="color: #666; font-style: italic; text-align: center; padding: 20px;">No external layers yet.</div>';
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

        item.style.borderLeft = '4px solid #2196f3'; // Folder-like accent
        item.style.marginBottom = '8px';

        item.innerHTML = `
            <div style="flex:1; overflow:hidden; display:flex; align-items:center; gap:8px;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="#2196f3"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
                <div style="font-weight:bold; color:#2196f3; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; text-transform:uppercase; font-size:0.9rem;">${l.name}</div>
            </div>
            <div style="display:flex; flex-wrap: wrap; gap: 6px; align-items:center;">
                <button class="layer-toggle-vis ${l.visible ? 'active' : ''}" data-id="${l.id}" style="background:${l.visible ? '#2196f3' : '#555'}; border:none; color:white; width:32px; height:32px; border-radius:6px; cursor:pointer;" title="Visibility">
                    ${l.visible ? '👁️' : '🕶️'}
                </button>
                <div style="display:flex; flex-wrap: wrap; background: rgba(0,0,0,0.3); padding: 5px; border-radius: 6px; gap: 8px;">
                     <label style="display:flex; align-items:center; cursor:pointer; gap:2px;"><input type="checkbox" class="layer-points-toggle" data-id="${l.id}" ${l.pointsVisible ? 'checked' : ''}> <span style="font-size:10px; color:#fff">Point</span></label>
                     <label style="display:flex; align-items:center; cursor:pointer; gap:2px;"><input type="checkbox" class="layer-areas-toggle" data-id="${l.id}" ${l.areasVisible ? 'checked' : ''}> <span style="font-size:10px; color:#fff">Area</span></label>
                     <label style="display:flex; align-items:center; cursor:pointer; gap:2px;"><input type="checkbox" class="layer-fill-toggle" data-id="${l.id}" ${l.filled ? 'checked' : ''}> <span style="font-size:10px; color:#fff">Fill</span></label>
                     <label style="display:flex; align-items:center; cursor:pointer; gap:2px;"><input type="checkbox" class="layer-labels-toggle" data-id="${l.id}" ${l.labelsVisible ? 'checked' : ''}> <span style="font-size:10px; color:#fff">Label</span></label>
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
            const l = externalLayers.find(x => x.id === id);
            if (l) {
                toggleLayerVisibility(id, !l.visible);
                renderLayerList(); // Redraw to update icon
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

    document.querySelectorAll('.layer-labels-toggle').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const id = parseInt(e.target.dataset.id);
            toggleLayerLabels(id, e.target.checked);
        });
    });

    document.querySelectorAll('.layer-delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.currentTarget.dataset.id);
            removeLayer(id);
        });
    });
}

function toggleLayerLabels(id, showLabels) {
    const l = externalLayers.find(x => x.id === id);
    if (!l) return;
    l.labelsVisible = showLabels;

    l.layer.eachLayer(layer => {
        const tooltip = layer.getTooltip();
        if (tooltip) {
            if (showLabels) {
                layer.openTooltip();
                const container = tooltip._container;
                if (container) {
                    container.style.display = '';
                    container.style.opacity = '1';
                    container.style.visibility = 'visible';
                }
            } else {
                layer.closeTooltip();
                const container = tooltip._container;
                if (container) {
                    container.style.display = 'none';
                    container.style.opacity = '0';
                    container.style.visibility = 'hidden';
                }
            }
        }
    });
    saveExternalLayers();
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
            if (showPoints) {
                if (layer.getElement()) layer.getElement().style.display = '';
                if (layer._shadow && layer._shadow.style) layer._shadow.style.display = '';
                if (layer.setOpacity) layer.setOpacity(1);
            } else {
                if (layer.getElement()) layer.getElement().style.display = 'none';
                if (layer._shadow && layer._shadow.style) layer._shadow.style.display = 'none';
                if (layer.setOpacity) layer.setOpacity(0);
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
        areasVisible: l.areasVisible,
        labelsVisible: l.labelsVisible
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
                last.labelsVisible = d.labelsVisible !== undefined ? d.labelsVisible : true;
                if (!last.visible) map.removeLayer(last.layer);
                last.layer.setStyle({ fillOpacity: last.filled ? 0.4 : 0 });
                toggleLayerPoints(last.id, last.pointsVisible);
                toggleLayerAreas(last.id, last.areasVisible);
                toggleLayerLabels(last.id, last.labelsVisible);
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
            updateScaleValues(); // Refresh UI labels
        } else {
            btnAddPoint.classList.remove('active-add-point');
            if (crosshair) crosshair.style.display = 'none';
            if (btnConfirmPoint) btnConfirmPoint.style.display = 'none';
            updateScaleValues(); // Refresh UI labels
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
        const gpsAlt = currentCoords.baroAlt !== null ? currentCoords.baroAlt : currentCoords.alt;
        const bestAlt = onlineCenterAlt !== null ? onlineCenterAlt : (onlineMyAlt !== null ? onlineMyAlt : gpsAlt);
        openRecordModalWithCoords(center.lat, center.lng, "Haritadan seçildi (Merkez)", bestAlt);

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
            const gpsAlt = currentCoords.baroAlt !== null ? currentCoords.baroAlt : currentCoords.alt;
            const bestAlt = onlineMyAlt !== null ? onlineMyAlt : gpsAlt;
            openRecordModalWithCoords(currentCoords.lat, currentCoords.lon, "GPS Konumu", bestAlt);
        } else {
            alert("Konum verisi bekleniyor...");
        }
    });
}

function openRecordModalWithCoords(lat, lon, note, alt = null) {
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
    // Use provided alt if available (GPS), otherwise fallback to cached (Map) or 0
    document.getElementById('rec-z').value = alt !== null ? Math.round(alt) : cachedElevation;
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

    // Add Popup to active measure line for "sorgulama"
    if (measureLine) {
        let totalLen = 0;
        for (let i = 0; i < measurePoints.length - 1; i++) {
            totalLen += measurePoints[i].distanceTo(measurePoints[i + 1]);
        }
        if (isPolygon) totalLen += measurePoints[measurePoints.length - 1].distanceTo(measurePoints[0]);

        let popupText = `<div class="map-popup-container">`;
        popupText += `<div style="font-weight:bold; font-size:1rem; margin-bottom:5px;">${isPolygon ? 'Çokgen Ölçümü' : 'Mesafe Ölçümü'}</div>`;
        popupText += `<hr style="border:0; border-top:1px solid #eee; margin:8px 0;">`;
        popupText += `<div style="font-size:0.9rem; margin-bottom:5px;"><b>Çevre:</b> ${formatScaleDist(totalLen)}</div>`;
        if (isPolygon) {
            popupText += `<div style="font-size:0.9rem; color:#2196f3;"><b>Alan:</b> ${formatArea(calculateAreaHelper(measurePoints))}</div>`;
        }
        popupText += `<div style="font-size:0.75rem; color:#999; margin-top:10px; font-style:italic;">(Kaydetmek için alt paneli kullanın)</div>`;
        popupText += `</div>`;

        const popupPos = isPolygon ? measureLine.getBounds().getCenter() : measurePoints[measurePoints.length - 1];
        measureLine.bindPopup(popupText, { closeButton: true });
    }

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

    measureText.innerHTML = text;

    // Show area info also during line drawing if more than 2 points
    if (measurePoints.length > 2) {
        let area = calculateAreaHelper(measurePoints);
        let areaText = formatArea(area);
        measureText.innerHTML += `<br><span style="font-size:0.8em; color:#ddd">${isPolygon ? 'Alan' : 'Hayali Alan'}: ${areaText}</span>`;
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
            if (confirm("Çokgen kapatılsın mı? (Alan hesaplanacak)")) {
                // Close the polygon
                measurePoints.push(measurePoints[0]);
                isPolygon = true;
                redrawMeasurement();
            }
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
        fillOpacity: 1,
        interactive: false // Allow map clicks to pass through to the map for snapping
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
        alert("No records found to export.");
        return;
    }

    const timestamp = new Date().getTime();
    if (type === 'csv') {
        const header = ["Label", "Y", "X", "Z", "Strike", "Dip", "Note"];
        const csvRows = [header.join(',')];
        dataToExport.forEach(r => {
            const row = [r.label || r.id, r.y, r.x, r.z, formatStrike(r.strike), r.dip, r.time || '', r.note];
            csvRows.push(row.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','));
        });
        const finalFileName = dataToExport.length === 1 ? `${dataToExport[0].label || dataToExport[0].id}_${timestamp}.csv` : `${scope === 'all' ? 'Records' : 'Selected'}_${timestamp}.csv`;
        downloadFile(csvRows.join('\n'), finalFileName, 'text/csv');
    } else if (type === 'kml') {
        let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>JeoCompass ${scope === 'all' ? 'Tüm Kayıtlar' : 'Seçilenler'}</name>`;
        dataToExport.forEach(r => {
            kml += `
    <Placemark>
      <name>${r.label || r.id}</name>
      <description>Strike: ${formatStrike(r.strike)}, Dip: ${r.dip}, Time: ${r.time || ''}, Note: ${r.note || ''}</description>
      <Point>
        <coordinates>${r.lon || 0},${r.lat || 0},${r.z || 0}</coordinates>
      </Point>
    </Placemark>`;
        });
        kml += `
  </Document>
</kml>`;
        const finalFileName = dataToExport.length === 1 ? `${dataToExport[0].label || dataToExport[0].id}_${timestamp}.kml` : `${scope === 'all' ? 'Records' : 'Selected'}_${timestamp}.kml`;
        downloadFile(kml, finalFileName, 'application/vnd.google-earth.kml+xml');
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

// Update Share Actions (New Redesign v151)
const chkShareCsv = document.getElementById('chk-share-csv');
const chkShareKml = document.getElementById('chk-share-kml');
const btnShareNext = document.getElementById('btn-share-next');
const btnShareBack = document.getElementById('btn-share-back');
const btnShareAccept = document.getElementById('btn-share-accept');

const shareStep1 = document.getElementById('share-step-1');
const shareStep2 = document.getElementById('share-step-2');
const shareFooter1 = document.getElementById('share-footer-1');
const shareFooter2 = document.getElementById('share-footer-2');

function resetShareModal() {
    if (shareStep1) shareStep1.style.display = 'block';
    if (shareStep2) shareStep2.style.display = 'none';
    if (shareFooter1) shareFooter1.style.display = 'flex';
    if (shareFooter2) shareFooter2.style.display = 'none';
}

if (btnShareNext) {
    btnShareNext.addEventListener('click', () => {
        shareStep1.style.display = 'none';
        shareStep2.style.display = 'block';
        shareFooter1.style.display = 'none';
        shareFooter2.style.display = 'flex';
    });
}

if (btnShareBack) {
    btnShareBack.addEventListener('click', resetShareModal);
}

if (btnShareAccept) {
    btnShareAccept.addEventListener('click', () => socialShare());
}

if (document.getElementById('btn-share-cancel')) {
    document.getElementById('btn-share-cancel').addEventListener('click', () => {
        shareModal.classList.remove('active');
        setTimeout(resetShareModal, 300);
    });
}

// Updated socialShare handles formats based on radio buttons and triggers native share
async function socialShare() {
    const selectedIds = Array.from(document.querySelectorAll('.record-select:checked')).map(cb => parseInt(cb.dataset.id));
    const dataToShare = records.filter(r => selectedIds.includes(r.id));

    if (dataToShare.length === 0) {
        alert("No records selected for sharing. Please select records from the table.");
        return;
    }

    const timestamp = new Date().getTime();
    const isCsv = document.getElementById('chk-share-csv').checked;
    const isKml = document.getElementById('chk-share-kml').checked;

    let fileToShare = null;
    let fileName = "";
    let fileType = "";

    // Prepare File based on selection
    if (isCsv) {
        const header = ["Label", "Y", "X", "Z", "Strike", "Dip", "Note"];
        const csvRows = [header.join(',')];
        dataToShare.forEach(r => {
            const row = [r.label || r.id, r.y, r.x, r.z, formatStrike(r.strike), r.dip, r.time || '', r.note];
            csvRows.push(row.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','));
        });
        const csvContent = csvRows.join('\n');
        fileName = dataToShare.length === 1 ? `${dataToShare[0].label || dataToShare[0].id}_${timestamp}.csv` : `Selected_${timestamp}.csv`;
        fileType = 'text/csv';
        fileToShare = new File([csvContent], fileName, { type: fileType });
    } else if (isKml) {
        let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>JeoCompass Seçilenler</name>`;
        dataToShare.forEach(r => {
            kml += `
    <Placemark>
      <name>${r.label || r.id}</name>
      <description>Strike: ${formatStrike(r.strike)}, Dip: ${r.dip}, Time: ${r.time || ''}, Note: ${r.note || ''}</description>
      <Point>
        <coordinates>${r.lon || 0},${r.lat || 0},${r.z || 0}</coordinates>
      </Point>
    </Placemark>`;
        });
        kml += `
  </Document>
</kml>`;
        fileName = dataToShare.length === 1 ? `${dataToShare[0].label || dataToShare[0].id}_${timestamp}.kml` : `Selected_${timestamp}.kml`;
        fileType = 'application/vnd.google-earth.kml+xml';
        fileToShare = new File([kml], fileName, { type: fileType });
    }

    // Prepare text summary
    let textSummary = `JeoCompass Kayıtları (${dataToShare.length} adet):\n\n`;
    dataToShare.forEach(r => {
        textSummary += `${r.label || r.id} | ${r.strike}/${r.dip} | Y:${r.y} X:${r.x} | ${r.note || ''}\n`;
    });

    if (navigator.share) {
        try {
            const shareData = {
                title: 'JeoCompass Kayıtları',
                text: textSummary
            };

            if (fileToShare && navigator.canShare && navigator.canShare({ files: [fileToShare] })) {
                shareData.files = [fileToShare];
            }

            await navigator.share(shareData);
            shareModal.classList.remove('active');
            setTimeout(resetShareModal, 300);
            return;
        } catch (err) {
            console.error("Navigator share failed", err);
            if (err.name === 'AbortError') return;
        }
    }

    // Traditional download fallback if sharing is not available
    if (fileToShare) {
        const url = URL.createObjectURL(fileToShare);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    shareModal.classList.remove('active');
    setTimeout(resetShareModal, 300);
}

const btnWhatsapp = document.getElementById('btn-share-whatsapp');
const btnTelegram = document.getElementById('btn-share-telegram');
const btnMail = document.getElementById('btn-share-mail');

if (btnWhatsapp) btnWhatsapp.addEventListener('click', () => socialShare('whatsapp'));
if (btnTelegram) btnTelegram.addEventListener('click', () => socialShare('telegram'));
if (btnMail) btnMail.addEventListener('click', () => socialShare('mail'));

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

        if (confirm(`Are you sure you want to delete ${selectedIds.length} records?`)) {
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
    if (confirm(`Record #${id} will be deleted. Are you sure?`)) {
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
        btnToggleLock.title = 'Unlock';
    } else {
        btnToggleLock.innerHTML = '🔓';
        btnToggleLock.classList.add('unlocked');
        btnToggleLock.title = 'Lock';
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
