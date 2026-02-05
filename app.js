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

/** Heatmap Logic (v401) **/
// Helper to darken colors for heatmap core (v423)
function shadeColor(color, percent) {
    let f = parseInt(color.slice(1), 16),
        t = percent < 0 ? 0 : 255,
        p = percent < 0 ? percent * -1 : percent,
        R = f >> 16,
        G = f >> 8 & 0x00FF,
        B = f & 0x0000FF;
    return "#" + (0x1000000 + (Math.round((t - R) * p) + R) * 0x10000 + (Math.round((t - G) * p) + G) * 0x100 + (Math.round((t - B) * p) + B)).toString(16).slice(1);
}

function updateHeatmap() {
    if (!map || !isHeatmapActive) return;

    let points = [];
    let activeGradient = {};

    // Dynamic Monochromatic Gradient (v428 - High Contrast Topo Lines)
    const filterKey = (heatmapFilter || 'ALL').toUpperCase();

    if (filterKey !== 'ALL') {
        const baseColor = ELEMENT_COLORS[filterKey] || '#f44336';
        const d1 = shadeColor(baseColor, -0.2); // Tier 2
        const d2 = shadeColor(baseColor, -0.4); // Tier 3
        const d3 = shadeColor(baseColor, -0.6); // Tier 4
        const dCore = shadeColor(baseColor, -0.8); // Tier 5 (Core)
        const line = shadeColor(baseColor, -0.95); // v435: Color-matched dark line
        const ultraDark = shadeColor(baseColor, -0.98); // v436: Pure monochromatic core

        // v436: Themed Transparency (baseColor + 00 alpha) to prevent interpolation shifts
        // This ensures the fade-out stays in the same hue and kills the "green leak"
        const transparentBase = baseColor + '00';

        activeGradient = {
            0.0: transparentBase,
            0.12: transparentBase,
            0.15: baseColor,
            0.20: line, 0.21: d1,
            0.40: line, 0.41: d2,
            0.60: line, 0.61: d3,
            0.80: line, 0.81: dCore,
            0.95: dCore, 1.0: ultraDark
        };
    } else {
        // v436 Geological Rainbow (Harmonized Core)
        const line = '#000000';
        const rainbowTransparent = '#3f51b500'; // Indigo-themed transparency
        activeGradient = {
            0.0: rainbowTransparent,
            0.12: rainbowTransparent,
            0.15: '#3f51b5',        // Deep Indigo
            0.20: line, 0.21: '#ffc107', // Gold
            0.40: line, 0.41: '#ff9800', // Orange
            0.60: line, 0.61: '#f44336', // Red
            0.80: line, 0.81: '#440000', // Crimson
            0.95: '#220000', 1.0: '#110011' // Deep Violet/Nadir Core
        };
    }

    // 1. Gather points from standard records
    const recordPoints = records.filter(r => r.lat && r.lon);

    // 2. Gather points from KML layers
    const kmlPoints = [];
    externalLayers.forEach(l => {
        if (l.visible && l.geojson && l.geojson.features) {
            l.geojson.features.forEach(f => {
                if (f.geometry && f.geometry.type === 'Point' && f.geometry.coordinates) {
                    const label = getFeatureName(f.properties) || '';
                    kmlPoints.push({
                        lat: f.geometry.coordinates[1],
                        lon: f.geometry.coordinates[0],
                        label: label
                    });
                }
            });
        }
    });

    const allSourcePoints = [...recordPoints, ...kmlPoints];

    if (heatmapFilter === 'ALL') {
        points = allSourcePoints.map(p => [p.lat, p.lon, 1]);
    } else {
        const symbol = heatmapFilter.toUpperCase();
        points = allSourcePoints
            .filter(p => (p.label || '').toUpperCase().includes(symbol))
            .map(p => [p.lat, p.lon, 1]);
    }

    if (heatmapLayer) {
        map.removeLayer(heatmapLayer);
    }

    if (points.length === 0) return;

    // Convert meters to pixels (v417: Dynamic Calculation for 1:1 parity with measuring tool)
    const center = map.getCenter();
    const point1 = map.latLngToContainerPoint(center);
    const point2 = L.point(point1.x + 100, point1.y); // Use 100px sample for precision
    const latlng2 = map.containerPointToLatLng(point2);
    const mpp = map.distance(center, latlng2) / 100; // Actual Meters Per Pixel

    // v426 Topo-Style Ratios: More blur (30%) for smoother topographic contour flow.
    const blurRatio = 0.30;
    const radiusRatio = 0.70;

    // Total spread (r+b) always equals Ground Radius.
    const totalPixels = heatmapRadius / mpp;
    const radiusPixels = totalPixels * radiusRatio;
    const blurPixels = totalPixels * blurRatio;

    heatmapLayer = L.heatLayer(points, {
        radius: radiusPixels,
        blur: blurPixels,
        maxOpacity: 0.9,
        minOpacity: 0.2, // v420: Maximum prominence for 25m - 100m zones
        gradient: activeGradient,
        max: 1.0 // v415: Lock intensity to 1.0 to prevent color shifting during zoom/pan
    }).addTo(map);
}

// v439: Robust Headlight Rotation
function updateHeadlight(heading) {
    if (!liveMarker) return;
    const el = liveMarker.getElement();
    if (el) {
        const cone = el.querySelector('.heading-cone');
        if (cone) {
            // Rotate the cone using CSS transform
            // We must keep the translate(-50%, 0) to keep it centered horizontally relative to the marker
            cone.style.transform = `translate(-50%, 0) rotate(${heading}deg)`;
            // Ensure it's visible
            cone.style.opacity = '1';
        }
    }
}

function updateHeatmapFilterOptions() {
    const select = document.getElementById('heatmap-element-filter');
    if (!select) return;
    const currentVal = heatmapFilter;

    // Find all unique elements present in records AND KML layers (v404)
    const foundElements = new Set();

    records.forEach(r => {
        const labelText = (r.label || '').toUpperCase();
        for (const el in ELEMENT_COLORS) {
            if (labelText.includes(el.toUpperCase())) foundElements.add(el);
        }
    });

    externalLayers.forEach(l => {
        if (l.geojson && l.geojson.features) {
            l.geojson.features.forEach(f => {
                const labelText = (getFeatureName(f.properties) || '').toUpperCase();
                for (const el in ELEMENT_COLORS) {
                    if (labelText.includes(el.toUpperCase())) foundElements.add(el);
                }
            });
        }
    });

    const emojiMap = {
        'MN': '🟣', 'CR': '🟢', 'CU': '🟠', 'NI': '🔵',
        'FE': '🟤', 'AU': '🟡', 'AG': '⚪', 'ZN': '💎', 'PB': '⚫'
    };

    let html = '<option value="ALL">🌈 All Points (General)</option>';
    Array.from(foundElements).sort().forEach(el => {
        const emoji = emojiMap[el] || '📍';
        html += `<option value="${el}">${emoji} ${el} Highlights</option>`;
    });

    select.innerHTML = html;
    select.value = foundElements.has(currentVal) ? currentVal : "ALL";
}

function toggleHeatmap() {
    isHeatmapActive = !isHeatmapActive;
    const btn = document.getElementById('btn-heatmap-toggle');
    const panel = document.getElementById('heatmap-radius-panel');

    if (btn) btn.classList.toggle('active', isHeatmapActive);
    if (panel) panel.style.display = isHeatmapActive ? 'block' : 'none';

    if (isHeatmapActive) {
        updateHeatmapFilterOptions();
        updateHeatmap();

        // Add one-time click listener for auto-close (v413 - Improved)
        // We use capture phase or a slight delay to avoid immediate closure if the toggle itself was clicked
        setTimeout(() => {
            const closeHandler = (e) => {
                // If click is outside panel and outside the toggle button
                const isOutsidePanel = !panel.contains(e.target);
                const isOutsideToggle = e.target.id !== 'btn-heatmap-toggle' && !e.target.closest('#btn-heatmap-toggle');

                if (isOutsidePanel && isOutsideToggle) {
                    isHeatmapActive = false;
                    if (btn) btn.classList.remove('active');
                    panel.style.display = 'none';
                    document.removeEventListener('click', closeHandler);
                }
            };
            document.addEventListener('click', closeHandler);
        }, 300); // Increased delay for stability
    } else if (heatmapLayer) {
        map.removeLayer(heatmapLayer);
        heatmapLayer = null;
    }
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
                    try {
                        wakeLock = await navigator.wakeLock.request('screen');
                        console.log("Wake Lock re-acquired");
                    } catch (err) {
                        console.warn("Wake Lock re-acquisition failed", err);
                    }
                }
            });
        } catch (err) {
            console.warn(`Wake Lock acquisition failed: ${err.name}, ${err.message}`);
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
const btnCleanLayers = document.getElementById('btn-clean-layers'); // Existing? checking..
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
let currentMode = 'utm'; // Ekranda varsayÄ±lan gÃ¶rÃ¼nÃ¼m UTM ED50 6 Derece
let currentCoords = { lat: 0, lon: 0, alt: 0, baroAlt: null, acc: 0 };
let targetHeading = 0;
let displayedHeading = 0;
let firstReading = true;
const SMOOTHING_FACTOR = 0.025; // 1.5 saniye oturma sÃ¼resi (Profesyonel Standart)
let currentTilt = { beta: 0, gamma: 0 };
let lockStrike = false;
let lockDip = false;
let manualDeclination = parseFloat(localStorage.getItem('jeoDeclination')) || 0;
let records = JSON.parse(localStorage.getItem('jeoRecords')) || [];
let nextId = parseInt(localStorage.getItem('jeoNextId')) || 1;
let map, markerGroup, liveMarker;
let sensorSource = null; // 'ios', 'absolute', 'relative'
let followMe = false;
let isFirstLocationFix = true; // v515: Track first GPS fix to auto-focus map
let editingRecordId = null;
let isRecordsLocked = true; // KayÄ±tlar varsayÄ±lan olarak kilitli baÅŸlar

// Shape Persistence
let pendingGeometry = null;
let pendingGeometryType = null;
let pendingLat = null;
let pendingLon = null;

// Stabilization Variables
let headingBuffer = [];
let betaBuffer = []; // NEW: Buffer for dip
const BUFFER_SIZE = 10;
const CACHE_NAME = 'jeocompass-v524';
let activeGridColor = '#00ffcc'; // v520: Default Grid Color
let isStationary = false;
let lastRotations = [];
const STATIONARY_THRESHOLD = 0.15;
// Tracking State (v354)
// Tracking State (v354)
// Tracking State (v354)
// v511: Robust initialization for tracking state
let isTracking = true;
try {
    const savedAutoRec = localStorage.getItem('jeoAutoTrackEnabled');
    if (savedAutoRec !== null) {
        isTracking = JSON.parse(savedAutoRec) === true;
    }
} catch (e) {
    console.error("Error loading isTracking:", e);
    isTracking = true;
}
let trackPath = JSON.parse(localStorage.getItem('jeoTrackPath')) || [];
let trackStartTime = localStorage.getItem('jeoTrackStartTime') || null; // v467: track start time
let trackPolyline = null;

// Heatmap State (v401)
let heatmapLayer = null;
let isHeatmapActive = false;
let heatmapRadius = 50; // default meters (v409)
let heatmapFilter = 'ALL'; // v403

// Smoothing state (v400)
let smoothedPos = { lat: 0, lon: 0 };
const SMOOTH_ALPHA = 0.3;
let jeoTracks = JSON.parse(localStorage.getItem('jeoTracks')) || [];
// v466: Hide all saved tracks by default on startup
jeoTracks.forEach(t => { t.visible = false; });
let trackLayers = {}; // Store Leaflet layers for saved tracks by ID
let activeTab = 'points'; // 'points' or 'tracks' (v503 Fix)
const STATIONARY_FRAMES = 10; // ~0.5 saniye sabit kalÄ±rsa kilitlenmeye baÅŸlar

// Track Auto-Recording State (v442)
let trackIdCounter = parseInt(localStorage.getItem('trackIdCounter')) || 1;
const MAX_TRACKS = 20; // Maksimum izlek sayısı
let showLiveTrack = JSON.parse(localStorage.getItem('jeoShowLiveTrack')) !== false; // v510: Default true (boolean)

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

// Grid State (v516)
let isGridMode = false;
let activeGridInterval = null;
let currentGridLayer = null;

// KML/KMZ Layers State
let externalLayers = []; // { id, name, layer, filled: true, visible: true, pointsVisible: true, areasVisible: true }
let layerIdCounter = 1;

// Element Coloring (v401)
const ELEMENT_COLORS = {
    'MN': '#9c27b0', // Purple
    'CR': '#4caf50', // Green
    'CU': '#ff9800', // Orange
    'NI': '#2196f3', // Blue
    'FE': '#795548', // Brown/Red
    'AU': '#ffc107', // Gold
    'AG': '#9e9e9e', // Gray
    'ZN': '#03a9f4', // Light Blue
    'PB': '#607d8b'  // Dark Gray
};

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

function getFeatureName(properties) {
    if (!properties) return null;
    const keys = ['name', 'Name', 'NAME', 'label', 'Label', 'LABEL', 'id', 'ID'];
    for (const key of keys) {
        if (properties[key]) return properties[key];
    }
    // Deep fallback: first non-empty string or number property
    for (const key in properties) {
        const val = properties[key];
        if ((typeof val === 'string' && val.trim().length > 0) || typeof val === 'number') {
            return val;
        }
    }
    return null;
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

// Z-Priority Helper (v524)
function getBestAltitude() {
    // Priority: Online Elevation > Barometer > GPS
    if (onlineMyAlt !== null) return onlineMyAlt;
    if (currentCoords.baroAlt !== null) return Math.round(currentCoords.baroAlt);
    if (currentCoords.alt !== null) return Math.round(currentCoords.alt);
    return 0;
}

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
        valDip.textContent = Math.round(dip) + "\u00B0";
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
                <span class="data-value" style="font-size: 1rem;">${currentCoords.lat.toFixed(6)}Â°</span>
            </div>
            <div class="coord-row">
                <span class="data-label">Boylam</span>
                <span class="data-value" style="font-size: 1rem;">${currentCoords.lon.toFixed(6)}Â°</span>
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
            coordContent.innerHTML = '<div class="data-label">UTM Error</div>';
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
        // --- SENSÃ–R KÄ°LÄ°TLEME MANTIÄI ---
        // Daha kaliteli bir kaynak (ios veya absolute) zaten kilitlenmiÅŸse, 
        // daha dÃ¼ÅŸÃ¼k kaliteli (relative) gelen veriyi yok sayarÄ±z.
        if (sensorSource === 'ios' && currentEventSource !== 'ios') return;
        if (sensorSource === 'absolute' && currentEventSource === 'relative') return;

        // KaynaÄŸÄ± gÃ¼ncelle
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

        // --- STABILIZASYON MANTIÄI ---

        // 1. Median Filter (GÃ¼rÃ¼ltÃ¼ Temizleme)
        // Heading Buffer
        headingBuffer.push(rawHeading);
        if (headingBuffer.length > BUFFER_SIZE) headingBuffer.shift();

        // Beta Buffer (Dip iÃ§in)
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

        // 0-360 geÃ§iÅŸinde (kuzeyde) medyan filtresi sapÄ±tabilir, bunu dÃ¼zelt:
        // EÄŸer deÄŸerler arasÄ±nda Ã§ok fark varsa (Ã¶rn. 359 ve 1), medyanÄ± iptal et ham veriyi kullan
        if (sorted[sorted.length - 1] - sorted[0] > 180) {
            medianHeading = rawHeading;
        }

        // 2. Stationary Lock (Stationary Lock REMOVED for smoothness v441)
        // Always apply smooth update
        if (firstReading) {
            targetHeading = medianHeading;
            displayedHeading = medianHeading;
            firstReading = false;
        } else {
            let diff = medianHeading - targetHeading;
            if (diff > 180) diff -= 360;
            if (diff < -180) diff += 360;
            targetHeading += diff * 0.15; // Smooth factor
        }
    }
}

// Motion Listener (Jiroskop ile Sabitlik AlgÄ±lama)
function handleMotion(event) {
    if (!event.rotationRate) return;

    // Toplam dÃ¶nme hareketi bÃ¼yÃ¼klÃ¼ÄŸÃ¼
    const alpha = event.rotationRate.alpha || 0;
    const beta = event.rotationRate.beta || 0;
    const gamma = event.rotationRate.gamma || 0;
    const magnitude = Math.sqrt(alpha * alpha + beta * beta + gamma * gamma);

    lastRotations.push(magnitude);
    if (lastRotations.length > STATIONARY_FRAMES) lastRotations.shift();

    // Son N karedeki ortalama hareket eÅŸiÄŸin altÄ±ndaysa "SABÄ°T" kabul et
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
        statusEl.textContent = "CONNECTED: High Accuracy (True North)";
        statusEl.style.color = "#4caf50";
        if (permissionBtn) permissionBtn.style.display = 'none';
        if (calibrationWarning) calibrationWarning.style.display = 'none';
    } else if (sensorSource === 'relative') {
        statusEl.textContent = "CONNECTED: Estimated (Calibration Required)";
        statusEl.style.color = "#ff9800";
        if (calibrationWarning) calibrationWarning.style.display = 'block';
    } else {
        statusEl.textContent = "WAITING: Please Click Start Button";
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
    // v437: Sync Headlight with Compass
    updateHeadlight(displayedHeading);
    requestAnimationFrame(animateCompass);
}
requestAnimationFrame(animateCompass);

// Controls
if (btnWgs) btnWgs.addEventListener('click', () => { currentMode = 'wgs'; btnWgs.classList.add('active'); btnUtm.classList.remove('active'); updateDisplay(); });
if (btnUtm) btnUtm.addEventListener('click', () => { currentMode = 'utm'; btnUtm.classList.add('active'); btnWgs.classList.remove('active'); updateDisplay(); });

// Update Save Button State (REC button on Compass)
function updateSaveButtonState() {
    const btnSave = document.getElementById('btn-save');
    if (btnSave) {
        if (lockStrike && lockDip) {
            btnSave.classList.add('ready');
            btnSave.style.opacity = '1';
            btnSave.style.pointerEvents = 'auto';
            btnSave.style.background = '#f44336'; // Active Red
            btnSave.style.color = '#fff';
            btnSave.style.boxShadow = '0 0 15px rgba(244, 67, 54, 0.6)';
        } else {
            btnSave.classList.remove('ready');
            btnSave.style.opacity = '0.5';
            btnSave.style.pointerEvents = 'none';
            btnSave.style.background = ''; // Default
            btnSave.style.color = '';
            btnSave.style.boxShadow = '';
        }
    }
}

// Hold Logic
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

                // v454: Update REC button state after permissions
                updateSaveButtonState();
            }
        }).catch(err => {
            console.error(err);
        });
    } else {
        // Android & Others (Check if sensors active)
        window.addEventListener('deviceorientationabsolute', handleOrientation, true);
        window.addEventListener('deviceorientation', handleOrientation, true);
        if (permissionBtn) permissionBtn.style.display = 'none';

        // v454: Ensure REC button is clickable
        if (btnSave) {
            btnSave.classList.add('ready');
        }
    }
}

// v454: Connect REC button specifically for Measurement Save (Only if both Holds active)
const btnSave = document.getElementById('btn-save');
if (btnSave) {
    // Initial state
    updateSaveButtonState();

    btnSave.addEventListener('click', () => {
        if (lockStrike && lockDip) {
            // v455: Capture exact text from displays ("ekranları kayıt edilir")
            const strikeVal = valStrike ? valStrike.textContent : formatStrike(displayedHeading);
            const dipVal = valDip ? valDip.textContent : "0°";

            const gpsAlt = currentCoords.baroAlt !== null ? currentCoords.baroAlt : currentCoords.alt;
            const bestAlt = onlineMyAlt !== null ? onlineMyAlt : gpsAlt;

            openRecordModalWithCoords(currentCoords.lat, currentCoords.lon, "Compass Measurement", bestAlt, strikeVal, dipVal);
        }
    });
}
if (permissionBtn) {
    permissionBtn.addEventListener('click', () => {
        requestPermissions();
    });
}

// Auto Start Attempt
function autoInitSensors() {
    const isIOS = typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function';

    if (isIOS) {
        if (permissionBtn) {
            permissionBtn.style.display = 'block';
            permissionBtn.textContent = 'Start Compass (Click Here)';
        }
    } else {
        window.addEventListener('deviceorientationabsolute', handleOrientation, true);
        window.addEventListener('deviceorientation', handleOrientation, true);
        requestWakeLock(); // Keep screen on

        setTimeout(() => {
            if (sensorSource === null) {
                if (permissionBtn) {
                    permissionBtn.style.display = 'block';
                    permissionBtn.textContent = 'Start Compass (Click Here)';
                }
            }
        }, 3000);
    }
}
autoInitSensors();

// Robust Geolocation Watcher (v461)
let watchId = null;
function startGeolocationWatch() {
    if (!('geolocation' in navigator)) return;
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);

    watchId = navigator.geolocation.watchPosition((p) => {
        try {
            currentCoords.lat = p.coords.latitude;
            currentCoords.lon = p.coords.longitude;
            currentCoords.acc = p.coords.accuracy;
            currentCoords.alt = p.coords.altitude;

            // v521: Save last known location to localStorage
            if (currentCoords.lat !== 0 || currentCoords.lon !== 0) {
                localStorage.setItem('jeoLastLat', currentCoords.lat);
                localStorage.setItem('jeoLastLon', currentCoords.lon);
            }

            // v464: Prevent (0,0) jump from entering smoothedPos
            if (currentCoords.lat !== 0 || currentCoords.lon !== 0) {
                if (smoothedPos.lat === 0 && smoothedPos.lon === 0) {
                    smoothedPos.lat = currentCoords.lat;
                    smoothedPos.lon = currentCoords.lon;

                    // v515: Auto-focus map on very first GPS success
                    if (isFirstLocationFix && map) {
                        map.setView([currentCoords.lat, currentCoords.lon], 17);
                        isFirstLocationFix = false;
                        console.log("v515: Initial GPS Focus Triggered");
                    }
                } else {
                    smoothedPos.lat = (currentCoords.lat * SMOOTH_ALPHA) + (smoothedPos.lat * (1 - SMOOTH_ALPHA));
                    smoothedPos.lon = (currentCoords.lon * SMOOTH_ALPHA) + (smoothedPos.lon * (1 - SMOOTH_ALPHA));
                }
            }

            // Update GPS Dashboard (v461)
            const gpsAccVal = document.getElementById('gps-acc-val');
            const gpsStatusVal = document.getElementById('gps-status-val');
            const trackPointsVal = document.getElementById('track-points-val');

            if (gpsAccVal) gpsAccVal.textContent = `${Math.round(currentCoords.acc)}m`;
            if (gpsStatusVal) {
                gpsStatusVal.textContent = currentCoords.acc <= 100 ? "GOOD" : "POOR";
                gpsStatusVal.style.color = currentCoords.acc <= 100 ? "#4caf50" : "#ff9800";
            }
            if (trackPointsVal) trackPointsVal.textContent = trackPath.length;

            // Update Live Marker
            if (map && currentCoords.lat) {
                const livePos = [smoothedPos.lat, smoothedPos.lon];
                if (!liveMarker) {
                    const liveIcon = L.divIcon({
                        className: 'heartbeat-container',
                        html: '<div class="heading-cone"></div><div class="heartbeat-pulse"></div><div class="heartbeat-triangle"></div>',
                        iconSize: [32, 32],
                        iconAnchor: [16, 16]
                    });
                    liveMarker = L.marker(livePos, { icon: liveIcon, zIndexOffset: 1000 }).addTo(liveLayer);
                } else {
                    liveMarker.setLatLng(livePos);
                }

                if (followMe) map.panTo(livePos);

                // v468: Rotate headlight (cone) based on GPS heading (course)
                const heading = p.coords.heading;
                const speed = p.coords.speed || 0;
                let rotateDeg = 0; // Default North

                // v469: Improved - use heading if available and moving (lowered threshold to 0.3 m/s)
                if (heading !== null && heading !== undefined && speed > 0.3) {
                    rotateDeg = heading;
                }

                const markerEl = liveMarker.getElement();
                if (markerEl) {
                    const cone = markerEl.querySelector('.heading-cone');
                    if (cone) {
                        cone.style.transform = `translate(-50%, 0) rotate(${rotateDeg}deg)`;
                    }
                }

                // v462: Ensure track line always connects to live marker center
                if (showLiveTrack && trackPolyline && map.hasLayer(trackPolyline)) {
                    trackPolyline.setLatLngs([...trackPath, livePos]);
                }
            }

            // --- TRACKING LOGIC ---
            if (isTracking) {
                const acc = p.coords.accuracy;
                if (acc <= 100 && (smoothedPos.lat !== 0 || smoothedPos.lon !== 0)) {
                    const lastPoint = trackPath.length > 0 ? L.latLng(trackPath[trackPath.length - 1]) : null;
                    const currentPoint = L.latLng(smoothedPos.lat, smoothedPos.lon);
                    const dist = lastPoint ? lastPoint.distanceTo(currentPoint) : 999;

                    if (dist >= 1) {
                        updateTrack(smoothedPos.lat, smoothedPos.lon);
                    }

                    // v465: Periodic "Real Z" fetching for current position (every 15-20 seconds)
                    const now = Date.now();
                    if (now - lastFetches.me > 15000) {
                        lastFetches.me = now;
                        fetchElevation(currentCoords.lat, currentCoords.lon, (alt) => {
                            if (alt !== null) {
                                onlineMyAlt = alt;
                                updateScaleValues(); // Update Map Z display
                            }
                        });
                    }
                } else {
                    if (acc > 100) {
                        console.log("GPS Accuracy Poor:", acc);
                    }
                }
            }
        } catch (e) {
            console.error("WatchPosition internal error:", e);
        }
    }, (err) => {
        console.warn("Location error:", err);
        const gpsStatusVal = document.getElementById('gps-status-val');
        if (gpsStatusVal) {
            gpsStatusVal.textContent = "ERROR: " + err.code;
            gpsStatusVal.style.color = "#f44336";
        }
        // v461: Restart on timeout or lost signal
        if (err.code === 3) { // TIMEOUT
            console.log("Restarting Geolocation due to timeout...");
            startGeolocationWatch();
        }
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
}
startGeolocationWatch();

// Save & Modal
// Save Button Removed - Auto Save Logic Only

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
                time: new Date().toLocaleString('en-GB'), // Added Time (Eng format)
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
        updateMapMarkers(true);
        if (isHeatmapActive) updateHeatmap(); // v414: Dynamic Update
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
    localStorage.setItem('jeoNextId', nextId);
    if (isHeatmapActive) updateHeatmapFilterOptions();
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
            <td style="font-size:0.75rem; color:#aaa;">${r.time || ''}</td>
            <td style="max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${r.note}</td>
            <td class="${isRecordsLocked ? 'locked-hidden' : ''}">
                <div class="action-menu">
                    <button class="action-btn" onclick="toggleActionMenu(${r.id}, event)">⋮</button>
                    <div id="dropdown-${r.id}" class="dropdown-content">
                        <button class="btn-edit-row" data-id="${r.id}" onclick="toggleActionMenu(${r.id}, event)">✏️ Edit</button>
                        <button onclick="exportSingleRecordKML(${r.id})">📤 Share KML</button>
                        <button class="delete-action" onclick="deleteRecordFromMap(${r.id})">🗑️ Delete</button>
                    </div>
                </div>
            </td>
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

    const initialLat = currentCoords.lat || parseFloat(localStorage.getItem('jeoLastLat')) || 39.9334;
    const initialLon = currentCoords.lon || parseFloat(localStorage.getItem('jeoLastLon')) || 32.8597;

    map = L.map('map-container', {
        maxZoom: 25, // Increased from 23 to 25
        minZoom: 1   // Ensure full zoom out flexibility
    }).setView([initialLat, initialLon], currentCoords.lat ? 17 : 15);

    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 25,
        maxNativeZoom: 19,
        attribution: '© OpenStreetMap'
    });

    const googleTerrain = L.tileLayer('https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
        maxZoom: 25,
        maxNativeZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '© Google'
    });

    const googleSat = L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
        maxZoom: 25,
        maxNativeZoom: 21, // Higher native zoom for satellite if available
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '© Google'
    });


    const openTopo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 25,
        maxNativeZoom: 17,
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

    // Create High-Priority Tracking Pane (v397)
    map.createPane('tracking-pane');
    map.getPane('tracking-pane').style.zIndex = 650;
    map.getPane('tracking-pane').style.pointerEvents = 'none';

    const overlayMaps = {
        "Live Location": liveLayer
    };

    L.control.layers(baseMaps, overlayMaps).addTo(map);

    // Persist layer selection
    map.on('baselayerchange', (e) => {
        activeMapLayer = e.name; // Update global tracker
        localStorage.setItem('jeoMapLayer', e.name);
    });


    // Smart Label Placement (v383 - 8-Way Collision Avoidance)
    let labelOptimizeTimer = null;
    function optimizeMapPoints() {
        if (labelOptimizeTimer) clearTimeout(labelOptimizeTimer);

        labelOptimizeTimer = setTimeout(() => {
            // 1. Get all visible KML markers and their tooltips
            const markers = [];
            externalLayers.forEach(l => {
                if (!l.visible || !l.pointsVisible) return;
                l.layer.eachLayer(layer => {
                    if (layer instanceof L.Marker && layer.getElement() && layer.getElement().querySelector(".kml-custom-icon")) {
                        markers.push(layer);
                    }
                });
            });

            if (markers.length === 0) return;

            const mapBounds = map.getBounds();
            const occupiedRects = []; // Store {top, left, right, bottom} of occupied areas
            const labelsToPlace = []; // Collect valid labels to process

            // 2. Pre-process markers: Ensure they are visible and visible on map
            markers.forEach(marker => {
                const el = marker.getElement();
                if (!el) return;

                // Always show marker (User Rule: Never hide markers)
                el.style.display = "block";
                el.style.opacity = "1";

                const latLng = marker.getLatLng();
                if (!mapBounds.contains(latLng)) {
                    // Off-screen optimization
                    if (marker.getTooltip()) {
                        marker.closeTooltip();
                    }
                    return;
                }

                // If on screen, ensure tooltip is open/created
                if (marker.getTooltip()) {
                    if (!map.hasLayer(marker.getTooltip())) {
                        marker.openTooltip();
                    }
                    const tooltip = marker.getTooltip();
                    const tooltipEl = tooltip.getElement();
                    // Add marker rect to occupied list
                    const markerRect = el.getBoundingClientRect();
                    occupiedRects.push({
                        left: markerRect.left,
                        top: markerRect.top,
                        right: markerRect.right,
                        bottom: markerRect.bottom
                    });

                    if (tooltipEl) {
                        labelsToPlace.push({ marker, tooltip, tooltipEl, markerRect });
                    }
                }
            });

            // 3. Smart Placement Algorithm
            // Try 8 positions: Top(N), NE, E, SE, S, SW, W, NW
            const dist = 12;
            const positions = [
                { x: 0, y: -dist }, // N
                { x: dist, y: -dist }, // NE
                { x: dist, y: 0 }, // E
                { x: dist, y: dist }, // SE
                { x: 0, y: dist }, // S
                { x: -dist, y: dist }, // SW
                { x: -dist, y: 0 }, // W
                { x: -dist, y: -dist } // NW
            ];

            labelsToPlace.forEach(item => {
                const { tooltipEl, markerRect } = item;

                // RESET positioning styles to get true anchor (Leaflet controls transform)
                tooltipEl.style.marginLeft = '0px';
                tooltipEl.style.marginTop = '0px';
                tooltipEl.style.transform = ''; // Ensure we don't block Leaflet's updates, though usually it manages this inline

                // Force layout update to get accurate dimensions after reset
                const width = tooltipEl.offsetWidth;
                const height = tooltipEl.offsetHeight;

                // Leaflet places the tooltip anchor at the marker's location.
                // We need to calculate collision based on where it WOULD be.
                // However, without modifying transform, the tooltip stays at the anchor.
                // We use margins to visualy shift it from that anchor point.

                // Current absolute screen position of the marker center
                const markerCenter = {
                    x: markerRect.left + markerRect.width / 2,
                    y: markerRect.top + markerRect.height / 2
                };

                let bestPos = null;

                for (let i = 0; i < positions.length; i++) {
                    const offset = positions[i];

                    // Candidate center position
                    const targetX = markerCenter.x + offset.x;
                    const targetY = markerCenter.y + offset.y;

                    const candidateRect = {
                        left: targetX - width / 2,
                        right: targetX + width / 2,
                        top: targetY - height / 2,
                        bottom: targetY + height / 2
                    };

                    let collision = false;
                    for (const obst of occupiedRects) {
                        if (!(candidateRect.right < obst.left ||
                            candidateRect.left > obst.right ||
                            candidateRect.bottom < obst.top ||
                            candidateRect.top > obst.bottom)) {
                            collision = true;
                            break;
                        }
                    }

                    if (!collision) {
                        bestPos = { x: offset.x, y: offset.y, rect: candidateRect };
                        break;
                    }
                }

                if (bestPos) {
                    tooltipEl.style.opacity = "1";
                    tooltipEl.style.visibility = "visible";
                    // Apply offset via margins (Shift from anchor)
                    tooltipEl.style.marginLeft = `${bestPos.x}px`;
                    tooltipEl.style.marginTop = `${bestPos.y}px`;
                    occupiedRects.push(bestPos.rect);
                } else {
                    tooltipEl.style.opacity = "0";
                    tooltipEl.style.visibility = "hidden";
                }
            });

        }, 50);
    }

    map.on('zoomend moveend', () => {
        optimizeMapPoints();
    });

    map.on('overlayadd baselayerchange', () => {
        optimizeMapPoints();
    });

    // Combined Scale and UTM Control (Bottom Left)
    initMapControls();

    markerGroup = L.layerGroup().addTo(map);

    // Zoom listener for scale-based visibility
    map.on('zoomend', () => {
        updateMapMarkers(false);
        if (isHeatmapActive) updateHeatmap(); // v413: Recalculate metric radius pixels on zoom
    });

    // --- Tracking System MOVED TO GLOBAL SCOPE (v441) ---
    // See bottom of file

    // Initialize Live Track Polyline if points exist
    if (trackPath.length > 0 && map && showLiveTrack) {
        if (!trackPolyline) {
            trackPolyline = L.polyline(trackPath, {
                color: '#ff5722',
                weight: 6,
                pane: 'tracking-pane'
            }).addTo(map);
        }
    }


    /* REMOVED LOCK SYSTEM (v355) */


    // Map Click Handler for Interactions (v519: Optimized for Grid Priority)
    map.on('click', (e) => {
        // v523: Recursive Grid Detection & Priority
        if (isGridMode && activeGridInterval) {
            map.closePopup();
            let candidates = [];

            // Recursive helper to find polygons in any layer group (v523)
            const findPolygons = (target) => {
                if (target instanceof L.Polygon) {
                    if (target.getBounds().contains(e.latlng) && isPointInPolygon(e.latlng, target)) {
                        candidates.push(target);
                    }
                } else if (target.eachLayer) {
                    target.eachLayer(layer => findPolygons(layer));
                }
            };

            findPolygons(map);

            if (candidates.length > 0) {
                const targetLayer = candidates[candidates.length - 1];
                createAreaGrid(targetLayer, activeGridInterval, activeGridColor);
                return;
            }
        }

        if (isMeasuring) {
            updateMeasurement(e.latlng);
        } else if (isAddingPoint) {
            // Handled by Crosshair
        }
    });




    updateMapMarkers(true);
    loadExternalLayers();
    initMapControls();

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
                    <div id="map-utm-coords" class="map-utm-coords-new">Location pending...</div>
                </div>
            `;
            return wrapper;
        }
    });

    new MapControls().addTo(map);
    map.on('zoomend moveend move', updateScaleValues);
    map.on('zoomend', () => {
        if (isHeatmapActive) updateHeatmap();
    });
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

// v465: Ensure fresh track per session on startup
// If there is leftover track data (e.g. from a crash), save it first.
if (typeof trackPath !== 'undefined' && trackPath.length > 0) {
    saveCurrentTrack();
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
        let displayAlt = getBestAltitude();

        if (isAddingPoint && map) {
            const center = map.getCenter();
            displayLat = center.lat;
            displayLon = center.lng;
            displayAlt = onlineCenterAlt !== null ? onlineCenterAlt : getBestAltitude();
        }

        if (displayLat) {
            const zone = Math.floor((displayLon + 180) / 6) + 1;
            const utmZoneDef = `+proj=utm +zone=${zone} +ellps=intl +towgs84=-87,-98,-121,0,0,0,0 +units=m +no_defs`;
            try {
                const [easting, northing] = proj4('WGS84', utmZoneDef, [displayLon, displayLat]);
                const eastPart = Math.round(easting);
                const northPart = Math.round(northing);
                const modeLabel = isAddingPoint ? "📍" : "🎯";
                // Simplified display to prevent overflow and ensure icon is visible
                utmEl.innerHTML = `
                    <span style="font-size:0.75em; color:#ddd; margin-right:1px;">Y:</span><span style="margin-right:1mm;">${eastPart}</span>
                    <span style="font-size:0.75em; color:#ddd; margin-right:1px;">X:</span><span style="margin-right:0.5mm;">${northPart}</span>
                    <span style="font-size:0.75em; color:#ddd; margin-right:1px;">Z:</span><span style="margin-right:0mm;">${displayAlt}</span>
                    <span style="font-size:1.1em; vertical-align: middle;">${modeLabel}</span>
                `;
            } catch (e) {
                utmEl.textContent = "UTM Error";
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

function updateMapMarkers(shouldFitBounds = false) {
    if (!map || !markerGroup) return;
    markerGroup.clearLayers();

    // Clear and Redraw saved tracks
    Object.values(trackLayers).forEach(layer => map.removeLayer(layer));
    trackLayers = {};

    jeoTracks.forEach(t => {
        if (t.visible && t.path && t.path.length > 1) {
            const poly = L.polyline(t.path, {
                color: t.color || '#ff5722',
                weight: 6,
                opacity: 0.8,
                pane: 'tracking-pane'
            }).addTo(map);

            poly.bindPopup(`<b>${t.name}</b><br>${t.time}<br>${formatScaleDist(calculateTrackLength(t.path))}`);
            trackLayers[t.id] = poly;
        }
    });

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
                const latlngs = r.geom.map(p => [p[0], p[1]]);
                let totalLen = 0;
                for (let i = 0; i < latlngs.length - 1; i++) {
                    totalLen += L.latLng(latlngs[i]).distanceTo(L.latLng(latlngs[i + 1]));
                }

                let shape;
                if (r.geomType === 'polygon') {
                    totalLen += L.latLng(latlngs[latlngs.length - 1]).distanceTo(L.latLng(latlngs[0]));
                    shape = L.polygon(latlngs, { color: '#ffeb3b', weight: 4, fillOpacity: 0.3 });

                    // Labelling Polygon Edges
                    for (let i = 0; i < latlngs.length; i++) {
                        const nextIndex = (i + 1) % latlngs.length;
                        const p1 = L.latLng(latlngs[i]);
                        const p2 = L.latLng(latlngs[nextIndex]);
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
                            const p1 = L.latLng(latlngs[i]);
                            const p2 = L.latLng(latlngs[i + 1]);
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
                            ${r.geomType === 'polygon' ? `<b>Perimeter:</b> ${formatScaleDist(totalLen)}<br><b>Area:</b> ${formatArea(calculateAreaHelper(latlngs.map(p => L.latLng(p[0], p[1]))))}` : `<b>Length:</b> ${formatScaleDist(totalLen)}`}
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

            // Element Detection (v401)
            let pinColor = '#f44336'; // Default Red
            const labelStr = labelText.toString().toUpperCase();
            for (const [el, color] of Object.entries(ELEMENT_COLORS)) {
                if (labelStr.includes(el)) {
                    pinColor = color;
                    break;
                }
            }

            const markerIcon = L.divIcon({
                className: 'geology-marker-pin',
                html: `
                    <div class="pin-container" style="width:${iconBaseSize}px; height:${iconBaseSize}px; display: flex; align-items: center; justify-content: center; position: relative;">
                        <div class="red-dot-symbol" style="width:${12 * scaleFactor}px; height:${12 * scaleFactor}px; background-color: ${pinColor}; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>
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

    if (shouldFitBounds && dataToRender.length > 0 && selectedIds.length > 0) {
        const group = new L.featureGroup(markerGroup.getLayers());
        // Add visible tracks to bounds calculation if requested? 
        // For now just keep it to points as before unless requested otherwise
        map.fitBounds(group.getBounds().pad(0.2));
    }

    if (isHeatmapActive) updateHeatmap();
}

function calculateTrackLength(path) {
    let len = 0;
    for (let i = 0; i < path.length - 1; i++) {
        const p1 = L.latLng(path[i][0], path[i][1]);
        const p2 = L.latLng(path[i + 1][0], path[i + 1][1]);
        len += p1.distanceTo(p2);
    }
    return len;
}

function renderTracks() {
    const tableBody = document.getElementById('tracks-body');
    if (!tableBody) return;

    updateTrackCountBadge(); // v442: Update count badge

    if (jeoTracks.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5">No tracks saved yet</td></tr>';
        return;
    }

    // v466: Sort by newest first (descending ID)
    const sortedTracks = [...jeoTracks].sort((a, b) => b.id - a.id);

    let html = "";
    // v467: Display Live Track row if exists
    if (trackPath.length > 0) {
        const liveStartTime = trackStartTime ? new Date(trackStartTime) : new Date();
        const liveName = `Track ${liveStartTime.toLocaleDateString('en-GB')} ${liveStartTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
        html += `
            <tr class="live-track-row" style="background: rgba(76, 175, 80, 0.1);">
                <td></td>
                <td style="color: #4caf50; font-weight: bold;">🔴 ${liveName}</td>
                <td style="font-family:monospace;">${Math.round(calculateTrackLength(trackPath))}m</td>
                <td><div class="track-color-dot" style="background: #ff5722;"></div></td>
                <td><input type="checkbox" checked disabled></td>
                <td style="font-size:0.75rem; color:#4caf50; font-weight:bold;">Kayıtta...</td>
                <td><span style="font-size:0.8rem; color:#888;">Live</span></td>
            </tr>
        `;
    }

    html += sortedTracks.map(t => `
        <tr data-id="${t.id}">
            <td><input type="checkbox" class="track-select" data-id="${t.id}"></td>
            <td onclick="focusTrack(${t.id})">${t.name}</td>
            <td style="font-family:monospace;">${Math.round(t.length || 0)}m</td>
            <td><input type="color" value="${t.color || '#ff5722'}" onchange="updateTrackColor(${t.id}, this.value)" class="track-color-dot"></td>
            <td><input type="checkbox" ${t.visible ? 'checked' : ''} onchange="toggleTrackVisibility(${t.id})"></td>
            <td style="font-size:0.7rem; color:#aaa;">${t.time}</td>
            <td>
                <div class="action-menu">
                    <button class="action-btn" onclick="toggleActionMenu('track-'+${t.id}, event)">⋮</button>
                    <div id="dropdown-track-${t.id}" class="dropdown-content">
                        <button onclick="exportSingleTrackKML(${t.id})">💾 Save KML</button>
                        <button onclick="exportSingleTrackCSV(${t.id})">📊 Save CSV</button>
                        <button class="delete-action" onclick="deleteTrack(${t.id})">🗑️ Delete</button>
                    </div>
                </div>
            </td>
        </tr>
    `).join('');

    tableBody.innerHTML = html;
}

window.updateTrackColor = function (id, color) {
    const track = jeoTracks.find(t => t.id === id);
    if (track) {
        track.color = color;
        localStorage.setItem('jeoTracks', JSON.stringify(jeoTracks));
        updateMapMarkers(false);
    }
};

window.toggleTrackVisibility = function (id) {
    const track = jeoTracks.find(t => t.id === id);
    if (track) {
        track.visible = !track.visible;
        localStorage.setItem('jeoTracks', JSON.stringify(jeoTracks));
        updateMapMarkers(false);
    }
};

window.deleteTrack = function (id) {
    if (confirm("Delete track?")) {
        jeoTracks = jeoTracks.filter(t => t.id !== id);
        localStorage.setItem('jeoTracks', JSON.stringify(jeoTracks));
        renderTracks();
        updateMapMarkers(false);
    }
};

window.focusTrack = function (id) {
    const track = jeoTracks.find(t => t.id === id);
    if (track && track.path && track.path.length > 0) {
        const poly = trackLayers[id];
        if (poly) {
            map.fitBounds(poly.getBounds());
            document.querySelector('[data-target="view-map"]').click(); // Switch to Map
        }
    }
};

window.exportSingleTrackKML = function (id) {
    const t = jeoTracks.find(track => track.id === id);
    if (!t) return;

    let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${t.name}</name>
    <Style id="track-style">
      <LineStyle>
        <color>ff${t.color.substring(5, 7)}${t.color.substring(3, 5)}${t.color.substring(1, 3)}</color>
        <width>4</width>
      </LineStyle>
    </Style>
    <Placemark>
      <name>${t.name}</name>
      <styleUrl>#track-style</styleUrl>
      <LineString>
        <tessellate>1</tessellate>
        <coordinates>
`;
    t.path.forEach(pt => {
        kml += `${pt[1]},${pt[0]},0 `;
    });

    kml += `
        </coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>`;

    downloadFile(kml, `${t.name.replace(/\s+/g, '_')}.kml`, 'application/vnd.google-earth.kml+xml');
};

window.exportSingleTrackCSV = function (id) {
    const t = jeoTracks.find(track => track.id === id);
    if (!t) return;

    let csv = "Y (Easting),X (Northing),Zone,Latitude,Longitude\n";

    t.path.forEach(pt => {
        const lat = pt[0];
        const lon = pt[1];

        try {
            // ED50 6-Degree Conversion
            const zone = Math.floor((lon + 180) / 6) + 1;
            const utmZoneDef = `+proj=utm +zone=${zone} +ellps=intl +towgs84=-87,-98,-121,0,0,0,0 +units=m +no_defs`;
            const utm = proj4('WGS84', utmZoneDef, [lon, lat]);

            const easting = Math.round(utm[0]);
            const northing = Math.round(utm[1]);

            csv += `${easting},${northing},${zone},${lat.toFixed(7)},${lon.toFixed(7)}\n`;
        } catch (e) {
            console.error("Export Projection Error", e);
            csv += `ERR,ERR,ERR,${lat},${lon}\n`;
        }
    });

    downloadFile(csv, `${t.name.replace(/\s+/g, '_')}.csv`, 'text/csv;charset=utf-8;');
};

// Track Auto-Recording Functions (v442)
function updateTrack(lat, lon) {
    if (!isTracking) return;
    if (lat === 0 && lon === 0) return; // v464: Ignore (0,0)

    trackPath.push([lat, lon]);
    // v456: Persist live track path immediately
    localStorage.setItem('jeoTrackPath', JSON.stringify(trackPath));

    // v467: Persist start time if this is the first point
    if (!trackStartTime) {
        trackStartTime = new Date().toISOString();
        localStorage.setItem('jeoTrackStartTime', trackStartTime);
    }

    // Canlı izleği haritada güncelle
    if (showLiveTrack && map) {
        if (!trackPolyline) {
            trackPolyline = L.polyline(trackPath, {
                color: '#ff5722',
                weight: 6,
                opacity: 0.8,
                pane: 'tracking-pane'
            }).addTo(map);
        } else {
            trackPolyline.addLatLng([lat, lon]);
        }
    }
}

// updateLiveTrackVisibility removed from here as it is defined globally above

function saveCurrentTrack() {
    if (trackPath.length === 0) return;

    const now = new Date();
    // v467: Use saved start time for name
    const st = trackStartTime ? new Date(trackStartTime) : now;
    const trackName = `Track ${st.toLocaleDateString('en-GB')} ${st.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;

    const newTrack = {
        id: trackIdCounter++,
        name: trackName,
        path: [...trackPath],
        color: '#ff5722',
        visible: false, // v466: Hide newly saved tracks from map by default
        time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), // v467: Only end time in date column
        length: calculateTrackLength(trackPath) // v466: Save length in meters
    };

    // v456: FIFO: Eğer 20 kayıt varsa, en eskiyi sil (21. kayıt 1.yi siler)
    if (jeoTracks.length >= MAX_TRACKS) {
        jeoTracks.shift(); // İlk elemanı (en eski) çıkar
    }

    jeoTracks.push(newTrack);
    localStorage.setItem('jeoTracks', JSON.stringify(jeoTracks));
    localStorage.setItem('trackIdCounter', trackIdCounter);

    // Canlı izleği temizle
    trackPath = [];
    trackStartTime = null; // v467: Reset start time
    localStorage.removeItem('jeoTrackPath'); // Temizle
    localStorage.removeItem('jeoTrackStartTime'); // Temizle
    if (trackPolyline && map) {
        map.removeLayer(trackPolyline);
        trackPolyline = null;
    }

    renderTracks();
    updateMapMarkers(false);
    updateTrackCountBadge();
}

function toggleTracking() {
    isTracking = !isTracking;

    if (!isTracking) {
        // Tik kaldırıldı: Mevcut kaydı sonlandır ve sessizce kaydet
        saveCurrentTrack();

        // v512: Auto-Rec OFF -> Live Track also OFF
        showLiveTrack = false;
        localStorage.setItem('jeoShowLiveTrack', JSON.stringify(showLiveTrack));
        const chkLive = document.getElementById('chk-show-live-track');
        if (chkLive) chkLive.checked = false;
        updateLiveTrackVisibility();

        showToast('Auto-Recording: OFF', 1000);
    } else {
        // Tik atıldı: Yeni kayıt süreci başlasın
        trackPath = [];
        trackStartTime = new Date().toISOString();

        // v511: Immediate Start - Add current position if available
        if (smoothedPos.lat !== 0 || smoothedPos.lon !== 0) {
            trackPath.push([smoothedPos.lat, smoothedPos.lon]);
        }

        localStorage.setItem('jeoTrackPath', JSON.stringify(trackPath));
        localStorage.setItem('jeoTrackStartTime', trackStartTime);
        showToast('Auto-Recording: ON', 1000);
    }

    // Explicitly Save Setting
    localStorage.setItem('jeoAutoTrackEnabled', JSON.stringify(isTracking));

    // Sync UI
    const chkAutoTrack = document.getElementById('chk-auto-track');
    if (chkAutoTrack) {
        chkAutoTrack.checked = isTracking;
    }

    // Refresh display
    renderTracks();
}

// v464: Robust Save on Exit/Close Logic
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && isTracking && trackPath.length > 0) {
        saveCurrentTrack();
    }
});

window.addEventListener('pagehide', () => {
    if (isTracking && trackPath.length > 0) {
        saveCurrentTrack();
    }
});

// Redundant function removed (Merged with robust version at 1935)

function updateTrackCountBadge() {
    const badge = document.getElementById('track-count');
    if (badge) badge.textContent = `(${jeoTracks.length}/${MAX_TRACKS})`;
}



// Tab Switching
document.getElementById('tab-points').addEventListener('click', () => {
    activeTab = 'points';
    document.getElementById('tab-points').classList.add('active');
    document.getElementById('tab-tracks').classList.remove('active');
    document.getElementById('container-points').style.display = 'block';
    document.getElementById('container-tracks').style.display = 'none';
    updateShareButtonState(); // Update state on switch
});

document.getElementById('tab-tracks').addEventListener('click', () => {
    activeTab = 'tracks';
    document.getElementById('tab-tracks').classList.add('active');
    document.getElementById('tab-points').classList.remove('active');
    document.getElementById('container-tracks').style.display = 'block';
    document.getElementById('container-points').style.display = 'none';
    renderTracks();
    updateShareButtonState(); // Update state on switch
});

if (btnToggleRecords) {
    btnToggleRecords.classList.toggle('active', showRecordsOnMap);
    btnToggleRecords.addEventListener('click', () => {
        showRecordsOnMap = !showRecordsOnMap;
        btnToggleRecords.classList.toggle('active', showRecordsOnMap);
        updateMapMarkers(showRecordsOnMap);
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
    let selectedCount = 0;
    if (activeTab === 'points') {
        selectedCount = document.querySelectorAll('.record-select:checked').length;
    } else {
        selectedCount = document.querySelectorAll('.track-select:checked').length;
    }
    if (btnShare) btnShare.disabled = selectedCount === 0;
}

if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', (e) => {
        const checked = e.target.checked;
        document.querySelectorAll('.record-select').forEach(cb => {
            cb.checked = checked;
            cb.closest('tr').classList.toggle('selected', checked);
        });
        updateMapMarkers(true);
        updateShareButtonState();
    });
}

document.getElementById('records-body').addEventListener('change', (e) => {
    if (e.target.classList.contains('record-select')) {
        e.target.closest('tr').classList.toggle('selected', e.target.checked);
        updateMapMarkers(true);
        updateShareButtonState();
    }
});

const selectAllTracksCheckbox = document.getElementById('select-all-tracks');
if (selectAllTracksCheckbox) {
    selectAllTracksCheckbox.addEventListener('change', (e) => {
        const checked = e.target.checked;
        document.querySelectorAll('.track-select').forEach(cb => {
            cb.checked = checked;
            // Optional: highlight row styling for tracks
            // cb.closest('tr').classList.toggle('selected', checked);
        });
        updateShareButtonState();
    });
}

// Listener for Delete Selected (btnDeleteSelected defined at top)
if (btnDeleteSelected) {
    btnDeleteSelected.addEventListener('click', () => {
        let isTracks = (activeTab === 'tracks');
        if (isTracks) {
            const selectedIds = Array.from(document.querySelectorAll('.track-select:checked')).map(cb => parseInt(cb.dataset.id));
            if (selectedIds.length === 0) {
                alert("No tracks selected to delete.");
                return;
            }
            if (confirm(`Are you sure you want to delete ${selectedIds.length} selected track(s)?`)) {
                jeoTracks = jeoTracks.filter(t => !selectedIds.includes(t.id));
                localStorage.setItem('jeoTracks', JSON.stringify(jeoTracks));
                renderTracks();
                updateMapMarkers(false);
                if (typeof optionsModal !== 'undefined') optionsModal.classList.remove('active');
            }
        } else {
            // Existing Points Delete Logic
            const selectedIds = Array.from(document.querySelectorAll('.record-select:checked')).map(cb => parseInt(cb.dataset.id));
            if (selectedIds.length === 0) {
                alert("No records selected to delete.");
                return;
            }
            if (confirm(`Are you sure you want to delete ${selectedIds.length} selected record(s)?`)) {
                records = records.filter(r => !selectedIds.includes(r.id));
                saveRecords();
                renderRecords();
                updateMapMarkers(true);
                if (typeof optionsModal !== 'undefined') optionsModal.classList.remove('active');
            }
        }
    });
}

document.getElementById('tracks-body').addEventListener('change', (e) => {
    if (e.target.classList.contains('track-select')) {
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
document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
        // Remove active class from all nav items
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        // Add active class to clicked item
        const targetBtn = e.target.closest('.nav-item');
        targetBtn.classList.add('active');

        // Hide all views
        views.forEach(v => v.classList.remove('active'));

        // Show target view
        const targetId = targetBtn.dataset.target;
        const targetView = document.getElementById(targetId);
        if (targetView) targetView.classList.add('active');

        // Map resize fix
        if (targetId === 'view-map' && map) {
            setTimeout(() => {
                map.invalidateSize();
            }, 100);
        }
    });
});

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
                alert("No valid KML found.");
            }
        } catch (err) {
            console.error(err);
            alert("File could not be read: " + err.message);
        }
        fileImportInput.value = ''; // Reset
    });
}

// Heatmap UI Listeners (v401)
const btnHeatmap = document.getElementById('btn-heatmap-toggle');
if (btnHeatmap) {
    btnHeatmap.addEventListener('click', toggleHeatmap);
}

// Track Settings (v444)
const btnTrackSettings = document.getElementById('btn-track-settings');
const trackSettingsModal = document.getElementById('track-settings-modal');
const btnTrackSettingsClose = document.getElementById('btn-track-settings-close');
const chkAutoTrack = document.getElementById('chk-auto-track');
const chkShowLiveTrack = document.getElementById('chk-show-live-track');

// Helper to toggle live track visibility (Global Scope)
function updateLiveTrackVisibility() {
    if (!map) return; // v512: Safety check to prevent error if map not initialized

    if (showLiveTrack) {
        if (trackPath.length > 0) {
            if (trackPolyline) {
                if (!map.hasLayer(trackPolyline)) {
                    trackPolyline.addTo(map);
                }
            } else {
                trackPolyline = L.polyline(trackPath, {
                    color: '#ff5722',
                    weight: 6,
                    opacity: 0.8,
                    pane: 'tracking-pane'
                }).addTo(map);
            }
        }
    } else {
        if (trackPolyline && map.hasLayer(trackPolyline)) {
            map.removeLayer(trackPolyline);
        }
    }
}

// Track Settings Modal Listeners REMOVED (Embedded now)

// REMOVED (v444): btnTrackToggle & btnSaveTrack listeners were here.
// Auto-recording is now the only mode.

// REMOVED: btnLiveTrackVis listener (Moved to Settings Modal)

document.querySelectorAll('.radius-opt').forEach(btn => {
    btn.addEventListener('click', (e) => {
        heatmapRadius = parseInt(e.target.dataset.radius);
        document.querySelectorAll('.radius-opt').forEach(ob => ob.classList.remove('active'));
        e.target.classList.add('active');
        if (isHeatmapActive) updateHeatmap();
    });
});

const elFilter = document.getElementById('heatmap-element-filter');
if (elFilter) {
    elFilter.addEventListener('change', (e) => {
        heatmapFilter = e.target.value;
        if (isHeatmapActive) updateHeatmap();
    });
}

const btnHeatmapOff = document.getElementById('btn-heatmap-off');
if (btnHeatmapOff) {
    btnHeatmapOff.addEventListener('click', () => {
        isHeatmapActive = false;
        const btn = document.getElementById('btn-heatmap-toggle');
        const panel = document.getElementById('heatmap-radius-panel');
        if (btn) btn.classList.remove('active');
        if (panel) panel.style.display = 'none';
        if (heatmapLayer) {
            map.removeLayer(heatmapLayer);
            heatmapLayer = null;
        }
    });
}

/** Grid Feature Logic (v518: Robust Polygon Handling) **/
function isPointInPolygon(latlng, polygon) {
    if (!polygon || !polygon.getLatLngs) return false;
    let polyPoints = polygon.getLatLngs();

    // v518: Recursive flattening for complex Leaflet structures (Holes, MultiPolygons, KML clusters)
    const flattenPoints = (arr) => {
        if (!Array.isArray(arr)) return [];
        if (arr.length > 0 && (arr[0].lat !== undefined || arr[0].lng !== undefined)) return arr;
        return arr.reduce((acc, val) => acc.concat(Array.isArray(val) ? flattenPoints(val) : val), []);
    };

    let flatPoints = flattenPoints(polyPoints);
    if (flatPoints.length === 0) return false;

    const lat = latlng.lat, lng = latlng.lng;
    let isInside = false;
    for (let i = 0, j = flatPoints.length - 1; i < flatPoints.length; j = i++) {
        const xi = flatPoints[i].lng, yi = flatPoints[i].lat;
        const xj = flatPoints[j].lng, yj = flatPoints[j].lat;
        const intersect = ((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
        if (intersect) isInside = !isInside;
    }
    return isInside;
}

function createAreaGrid(polygon, interval, color = '#00ffcc') {
    if (!map || !polygon) return;
    const bounds = polygon.getBounds();
    const sw = bounds.getSouthWest(), ne = bounds.getNorthEast();
    const zone = Math.floor((sw.lng + 180) / 6) + 1;
    const utmZoneDef = `+proj=utm +zone=${zone} +ellps=intl +towgs84=-87,-98,-121,0,0,0,0 +units=m +no_defs`;

    try {
        const [minE, minN] = proj4('WGS84', utmZoneDef, [sw.lng, sw.lat]);
        const [maxE, maxN] = proj4('WGS84', utmZoneDef, [ne.lng, ne.lat]);
        const startE = Math.floor(minE / interval) * interval;
        const startN = Math.floor(minN / interval) * interval;

        if (currentGridLayer) map.removeLayer(currentGridLayer);
        currentGridLayer = L.layerGroup();
        const gridLines = [];

        // Sample density: Check every 5m or 100 points
        const samplingCount = 150;

        // Vertical lines
        for (let e = startE; e <= maxE + interval; e += interval) {
            let currentSegment = [];
            for (let i = 0; i <= samplingCount; i++) {
                const n = minN + (maxN - minN) * (i / samplingCount);
                const [lng, lat] = proj4(utmZoneDef, 'WGS84', [e, n]);
                const pt = L.latLng(lat, lng);
                if (isPointInPolygon(pt, polygon)) {
                    currentSegment.push([lat, lng]);
                } else if (currentSegment.length > 0) {
                    gridLines.push(currentSegment);
                    currentSegment = [];
                }
            }
            if (currentSegment.length > 0) gridLines.push(currentSegment);
        }

        // Horizontal lines
        for (let n = startN; n <= maxN + interval; n += interval) {
            let currentSegment = [];
            for (let i = 0; i <= samplingCount; i++) {
                const e = minE + (maxE - minE) * (i / samplingCount);
                const [lng, lat] = proj4(utmZoneDef, 'WGS84', [e, n]);
                const pt = L.latLng(lat, lng);
                if (isPointInPolygon(pt, polygon)) {
                    currentSegment.push([lat, lng]);
                } else if (currentSegment.length > 0) {
                    gridLines.push(currentSegment);
                    currentSegment = [];
                }
            }
            if (currentSegment.length > 0) gridLines.push(currentSegment);
        }

        L.polyline(gridLines, {
            color: color,
            weight: 1,
            opacity: 0.6,
            dashArray: '5, 5',
            interactive: false
        }).addTo(currentGridLayer);

        currentGridLayer.addTo(map);
        showToast(`Grid Created: ${interval}m`, 2000);
    } catch (e) {
        console.error("Grid generation error:", e);
        showToast("Error generating grid", 3000);
    }
}

// Grid UI Listeners
const btnGridToggle = document.getElementById('btn-grid-toggle');
const gridPanel = document.getElementById('grid-interval-panel');
const btnGridClear = document.getElementById('btn-grid-clear');

if (btnGridToggle) {
    btnGridToggle.addEventListener('click', () => {
        isGridMode = !isGridMode;
        btnGridToggle.classList.toggle('active', isGridMode);
        gridPanel.style.display = isGridMode ? 'flex' : 'none';

        if (isGridMode) {
            showToast("Grid Mode: ON - Select interval and click on a polygon", 3000);
        } else {
            document.querySelectorAll('.grid-opt-btn').forEach(b => b.classList.remove('active'));
            activeGridInterval = null;
        }
    });
}

document.querySelectorAll('.grid-opt-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        activeGridInterval = parseInt(e.target.dataset.interval);
        document.querySelectorAll('.grid-opt-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        showToast(`Interval set: ${activeGridInterval}m. Click an area!`, 2000);
    });
});

// v520: Grid Color Listeners
document.querySelectorAll('.grid-color-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        activeGridColor = e.target.dataset.color;
        document.querySelectorAll('.grid-color-btn').forEach(b => {
            b.classList.remove('active');
            b.style.border = "2px solid transparent";
        });
        e.target.classList.add('active');
        e.target.style.border = "2px solid #fff";
        showToast("Grid Color Updated", 1000);
    });
});

if (btnGridClear) {
    btnGridClear.addEventListener('click', () => {
        if (currentGridLayer) {
            map.removeLayer(currentGridLayer);
            currentGridLayer = null;
            showToast("Grid Cleared", 1500);
        }
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
            const featureName = getFeatureName(feature.properties);
            // v382: Only show labels for Points to prevent clutter on lines/polygons
            if (featureName && feature.geometry.type === 'Point') {
                layer.bindTooltip(String(featureName), {
                    permanent: true,
                    direction: 'top',
                    className: 'kml-label',
                    offset: [0, 0], // v383: Start at center, Smart Label will move it
                    sticky: false // Changed to false for better stability
                });

                // Performance Fix: Attach source layer to tooltip container for collision detection
                layer.on('tooltipopen', (e) => {
                    if (e.tooltip && e.tooltip._container) {
                        e.tooltip._container._sourceLayer = layer;
                    }
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
                // v522: Absolute Grid Priority over KML Popups
                if (isGridMode && activeGridInterval) {
                    L.DomEvent.stopPropagation(e);
                    map.fire('click', { latlng: e.latlng, originalEvent: e.originalEvent });
                    return;
                }

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
    // Optimized trigger
    optimizeMapPoints();
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
                    ${l.visible ? '👁️' : '👁️‍🗨️'}
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
    if (isHeatmapActive) updateHeatmapFilterOptions();
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
        console.error("KML loading error:", e);
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
        openRecordModalWithCoords(center.lat, center.lng, "Selected from Map", bestAlt);

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
            openRecordModalWithCoords(currentCoords.lat, currentCoords.lon, "GPS Position", bestAlt);
        } else {
            alert("Waiting for location data...");
        }
    });
}

function openRecordModalWithCoords(lat, lon, note, alt = null, strike = null, dip = null) {
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
    document.getElementById('rec-strike').value = strike !== null ? strike : 0;
    document.getElementById('rec-dip').value = dip !== null ? dip : 0;
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

function updateMeasureButtons() {
    if (measurePoints.length > 0) {
        btnMeasureUndo.style.display = 'inline-block';
        btnMeasureSave.style.display = 'inline-block';
    } else {
        btnMeasureUndo.style.display = 'none';
        btnMeasureSave.style.display = 'none';
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
        popupText += `<div style="font-weight:bold; font-size:1rem; margin-bottom:5px;">${isPolygon ? 'Polygon Measurement' : 'Distance Measurement'}</div>`;
        popupText += `<hr style="border:0; border-top:1px solid #eee; margin:8px 0;">`;
        popupText += `<div style="font-size:0.9rem; margin-bottom:5px;"><b>Perimeter/Length:</b> ${formatScaleDist(totalLen)}</div>`;
        if (isPolygon) {
            popupText += `<div style="font-size:0.9rem; color:#2196f3;"><b>Area:</b> ${formatArea(calculateAreaHelper(measurePoints))}</div>`;
        }
        popupText += `<div style="font-size:0.75rem; color:#999; margin-top:10px; font-style:italic;">(Use bottom panel to save)</div>`;
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
        measureText.innerHTML += `<br><span style="font-size:0.8em; color:#ddd">${isPolygon ? 'Area' : 'Imaginary Area'}: ${areaText}</span>`;
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
            if (confirm("Close polygon? (Area will be calculated)")) {
                // Close the polygon
                measurePoints.push(measurePoints[0]);
                isPolygon = true;
                redrawMeasurement();
            }
            return;
        }
    }

    if (isPolygon) {
        alert("Area already closed. Use 'Undo' to modify.");
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

    // 1. JSON BACKUP (Full Database)
    if (type === 'json') {
        const backupData = {
            version: '515',
            timestamp: timestamp,
            records: records,
            nextId: nextId,
            declination: manualDeclination,
            tracking: {
                path: trackPath,
                saved: savedTrackPath
            }
        };
        const jsonStr = JSON.stringify(backupData, null, 2);
        const fileName = `JeoComp_Backup_${new Date().toISOString().slice(0, 10)}.json`;
        downloadFile(jsonStr, fileName, 'application/json');
        return;
    }

    // 2. CSV / KML Export (Table Data)
    const finalFileName = dataToExport.length === 1 ? `${dataToExport[0].label || dataToExport[0].id}_${timestamp}.${type}` : `${scope === 'all' ? 'Records' : 'Selected'}_${timestamp}.${type}`;

    if (type === 'csv') {
        const header = ["Label", "Y", "X", "Z", "Strike", "Dip", "Note"];
        const csvRows = [header.join(',')];
        dataToExport.forEach(r => {
            const row = [r.label || r.id, r.y, r.x, r.z, formatStrike(r.strike), r.dip, r.time || '', r.note];
            csvRows.push(row.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','));
        });
        downloadFile(csvRows.join('\n'), finalFileName, 'text/csv');
    } else if (type === 'kml') {
        let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>JeoCompass ${scope === 'all' ? 'All Records' : 'Selected'}</name>`;
        dataToExport.forEach(r => {
            kml += `
    <Placemark>
      <name>${r.label || r.id}</name>
      <description>Strike: ${r.strike}\nDip: ${r.dip}\nNote: ${r.note}</description>
      <Point>
        <coordinates>${r.lon},${r.lat},${r.z}</coordinates>
      </Point>
    </Placemark>`;
        });
        kml += `
  </Document>
</kml>`;
        downloadFile(kml, finalFileName, 'application/vnd.google-earth.kml+xml');
    }
}

function downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
}

// -----------------------------------------------------------------
// BACKUP & RESTORE EVENTS
// -----------------------------------------------------------------
if (document.getElementById('btn-backup-json')) {
    document.getElementById('btn-backup-json').addEventListener('click', async () => {
        // FULL BACKUP
        const backupData = {
            version: '502',
            timestamp: new Date().toISOString(),
            records: records, // Points
            tracks: jeoTracks, // Tracks
            settings: {
                declination: manualDeclination,
                mapLayer: activeMapLayer,
                nextId: nextId,
                // Add other settings if needed
            },
            externalLayers: externalLayers.map(l => ({
                name: l.name,
                geojson: l.geojson,
                visible: l.visible,
                filled: l.filled,
                pointsVisible: l.pointsVisible,
                areasVisible: l.areasVisible,
                labelsVisible: l.labelsVisible
            }))
        };

        const jsonStr = JSON.stringify(backupData, null, 2);
        const dateStr = new Date().toLocaleDateString('tr-TR').replace(/\./g, '-');
        const fileName = `JeoCompass_Yedek_${dateStr}.json`;

        try {
            // Modern File System Access API (Save As)
            if ('showSaveFilePicker' in window) {
                const handle = await window.showSaveFilePicker({
                    suggestedName: fileName,
                    types: [{
                        description: 'JSON Backup File',
                        accept: { 'application/json': ['.json'] },
                    }],
                });
                const writable = await handle.createWritable();
                await writable.write(jsonStr);
                await writable.close();
                showToast("Backup successful (Saved to file)");
            } else {
                // Fallback
                downloadFile(jsonStr, fileName, 'application/json');
                showToast("Backup successful (Downloads folder)");
            }
        } catch (err) {
            console.error("Backup failed", err);
            if (err.name !== 'AbortError') {
                alert("Backup error: " + err.message);
            }
        }
    });
}

// Restore logic moved to Smart Merge section at the bottom.

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
// Helper: Toggle Action Menu
window.toggleActionMenu = function (id, event) {
    if (event) event.stopPropagation();
    // Close others
    document.querySelectorAll('.dropdown-content').forEach(el => {
        if (el.id !== `dropdown-${id}`) el.classList.remove('show');
    });
    const dropdown = document.getElementById(`dropdown-${id}`);
    if (dropdown) dropdown.classList.toggle('show');
};

// Global click to close menus
window.addEventListener('click', (e) => {
    if (!e.target.closest('.action-menu')) {
        document.querySelectorAll('.dropdown-content').forEach(el => el.classList.remove('show'));
    }
});

// Helper: Generate KML String
function generateKML(recordsToExport, docName = "JeoCompass Export") {
    let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${docName}</name>`;

    recordsToExport.forEach(r => {
        kml += `
    <Placemark>
      <name>${r.label || r.id}</name>
      <description>Strike: ${formatStrike(r.strike)}\nDip: ${r.dip}\nTime: ${r.time || ''}\nNote: ${r.note || ''}</description>
      <Point>
        <coordinates>${r.lon || 0},${r.lat || 0},${r.z || 0}</coordinates>
      </Point>
    </Placemark>`;
    });

    kml += `
  </Document>
</kml>`;
    return kml;
}

// Export Single Record KML
window.exportSingleRecordKML = function (id) {
    const r = records.find(rec => rec.id === id);
    if (!r) return;

    const kmlContent = generateKML([r], r.label || `Record ${r.id}`);
    const fileName = `${r.label || r.id}_${new Date().getTime()}.kml`;
    downloadFile(kmlContent, fileName, 'application/vnd.google-earth.kml+xml');

    // Close menu
    const dropdown = document.getElementById(`dropdown-${id}`);
    if (dropdown) dropdown.classList.remove('show');
};

// Updated socialShare handles formats based on radio buttons and triggers native share
async function socialShare(appTarget = null) {
    let dataToShare = [];
    let isTracks = (activeTab === 'tracks');
    const timestamp = new Date().getTime();

    if (isTracks) {
        const selectedIds = Array.from(document.querySelectorAll('.track-select:checked')).map(cb => parseInt(cb.dataset.id));
        dataToShare = jeoTracks.filter(t => selectedIds.includes(t.id));
    } else {
        const selectedIds = Array.from(document.querySelectorAll('.record-select:checked')).map(cb => parseInt(cb.dataset.id));
        dataToShare = records.filter(r => selectedIds.includes(r.id));
    }

    if (dataToShare.length === 0) {
        alert("No items selected for sharing. Please select items from the table.");
        return;
    }

    const isCsv = document.getElementById('chk-share-csv').checked;
    const isKml = document.getElementById('chk-share-kml').checked;

    let fileToShare = null;
    let fileName = "";
    let fileType = "";

    // Prepare File based on selection
    if (isCsv) {
        if (isTracks) {
            // CSV Export for Tracks (Multi-track CSV is tricky, we can combine all points with Track ID)
            const header = ["TrackID", "Name", "Lat", "Lon", "Date"];
            const csvRows = [header.join(',')];
            dataToShare.forEach(t => {
                if (t.path) {
                    t.path.forEach(pt => {
                        // pt is [lat, lon]
                        const row = [t.id, t.name, pt[0], pt[1], t.time];
                        csvRows.push(row.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','));
                    });
                }
            });
            const csvContent = csvRows.join('\n');
            fileName = dataToShare.length === 1 ? `${dataToShare[0].name}_${timestamp}.csv` : `SelectedTracks_${timestamp}.csv`;
            fileType = 'text/csv';
            fileToShare = new File([csvContent], fileName, { type: fileType });

        } else {
            // Points CSV
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
        }

    } else if (isKml) {
        if (isTracks) {
            const kmlContent = generateMultiTrackKML(dataToShare, "JeoCompass Selected Tracks");
            fileName = dataToShare.length === 1 ? `${dataToShare[0].name}_${timestamp}.kml` : `SelectedTracks_${timestamp}.kml`;
            fileType = 'application/vnd.google-earth.kml+xml';
            fileToShare = new File([kmlContent], fileName, { type: fileType });
        } else {
            const kmlContent = generateKML(dataToShare, "JeoCompass Selected");
            fileName = dataToShare.length === 1 ? `${dataToShare[0].label || dataToShare[0].id}_${timestamp}.kml` : `Selected_${timestamp}.kml`;
            fileType = 'application/vnd.google-earth.kml+xml';
            fileToShare = new File([kmlContent], fileName, { type: fileType });
        }
    }

    // Prepare text summary
    let textSummary = `JeoCompass Records (${dataToShare.length} pts):\n\n`;
    dataToShare.forEach(r => {
        textSummary += `${r.label || r.id} | ${r.strike}/${r.dip} | Y:${r.y} X:${r.x} | ${r.note || ''}\n`;
    });

    if (navigator.share) {
        try {
            const shareData = {
                title: 'JeoCompass Records',
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
            updateMapMarkers(false);
            if (isHeatmapActive) updateHeatmap(); // v414: Dynamic Update
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
        updateMapMarkers(false);
        if (isHeatmapActive) updateHeatmap(); // v414: Dynamic Update
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

// Global auto-lock and auto-save on exit (v456)
window.addEventListener('beforeunload', () => {
    isRecordsLocked = true;
    if (isTracking && trackPath.length > 0) {
        saveCurrentTrack();
    }
});

// Handle mobile backgrounding/app switching (v462: Removed auto-save to keep single continuous line)
document.addEventListener('visibilitychange', () => {
    // Session is kept in localStorage trackPath, no need to save to list on every backgrounding
});

// v463: Robust auto-save on exit/tab close
const handleTerminationSave = () => {
    isRecordsLocked = true;
    if (isTracking && trackPath.length > 1) {
        saveCurrentTrack();
    }
};

window.addEventListener('beforeunload', handleTerminationSave);
window.addEventListener('pagehide', handleTerminationSave);

// Initial flow is handled by autoInitSensors() in the mid-section.

// Desktop Sim
setTimeout(() => { if (displayedHeading === 0 && currentTilt.beta === 0) { setInterval(() => { targetHeading = (targetHeading + 1) % 360; }, 50); } }, 2000);

// -----------------------------------------------------------------
// BACKUP & RESTORE EVENTS (Smart Merge)
// -----------------------------------------------------------------


if (document.getElementById('btn-restore-json')) {
    document.getElementById('btn-restore-json').addEventListener('click', () => {
        document.getElementById('restore-file-input').click();
    });
}

if (document.getElementById('restore-file-input')) {
    document.getElementById('restore-file-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);

                // Identify incoming data type
                const incomingRecords = data.records || (Array.isArray(data) ? data : []);
                const incomingTracks = data.tracks || [];
                const incomingLayers = data.externalLayers || [];

                if (incomingRecords.length === 0 && incomingTracks.length === 0 && incomingLayers.length === 0) {
                    alert("No valid records or tracks found in file.");
                    return;
                }

                const msg = `SMART RESTORE MODE\n\n` +
                    `File contains:\n` +
                    `- ${incomingRecords.length} Points\n` +
                    `- ${incomingTracks.length} Tracks\n` +
                    `- ${incomingLayers.length} Layers\n\n` +
                    `Current data will be KEPT. Only NEW unique data will be added.\n` +
                    `Do you want to proceed?`;

                if (confirm(msg)) {
                    let recAdded = 0, recSkipped = 0;
                    let trackAdded = 0, trackSkipped = 0;
                    let layerAdded = 0, layerSkipped = 0;

                    // 1. SMART MERGE RECORDS
                    incomingRecords.forEach(inc => {
                        const exists = inc.time && records.some(r => r.time === inc.time);
                        const existsContent = records.some(r =>
                            r.label === inc.label &&
                            Math.abs(r.lat - inc.lat) < 0.000001 &&
                            Math.abs(r.lon - inc.lon) < 0.000001
                        );

                        if (exists || existsContent) {
                            recSkipped++;
                        } else {
                            const newRec = { ...inc };
                            newRec.id = nextId++;
                            records.push(newRec);
                            recAdded++;
                        }
                    });

                    // 2. SMART MERGE TRACKS
                    incomingTracks.forEach(incT => {
                        const exists = jeoTracks.some(t => t.id === incT.id || t.time === incT.time);
                        if (exists) {
                            trackSkipped++;
                        } else {
                            jeoTracks.push(incT);
                            trackAdded++;
                        }
                    });

                    // 3. SMART MERGE LAYERS
                    incomingLayers.forEach(incL => {
                        const exists = externalLayers.some(l => l.name === incL.name);
                        if (exists) {
                            layerSkipped++;
                        } else {
                            addExternalLayer(incL.name, incL.geojson);
                            const newL = externalLayers[externalLayers.length - 1];
                            if (newL) {
                                newL.visible = incL.visible;
                                newL.filled = incL.filled;
                                newL.pointsVisible = incL.pointsVisible !== undefined ? incL.pointsVisible : true;
                                newL.areasVisible = incL.areasVisible !== undefined ? incL.areasVisible : true;
                                newL.labelsVisible = incL.labelsVisible !== undefined ? incL.labelsVisible : true;
                                if (!newL.visible) map.removeLayer(newL.layer);
                            }
                            layerAdded++;
                        }
                    });

                    // 4. RESTORE SETTINGS (Optional)
                    if (data.settings) {
                        if (manualDeclination === 0 && data.settings.declination) {
                            manualDeclination = data.settings.declination;
                            localStorage.setItem('jeoDeclination', manualDeclination);
                        }
                    }

                    // Save all
                    saveRecords();
                    localStorage.setItem('jeoTracks', JSON.stringify(jeoTracks));
                    localStorage.setItem('jeoNextId', nextId);
                    saveExternalLayers();

                    // Refresh UI
                    renderRecords();
                    renderTracks();
                    renderLayerList();
                    updateMapMarkers(true);

                    alert(`RESTORE COMPLETE\n\n` +
                        `Points: +${recAdded} (Skipped: ${recSkipped})\n` +
                        `Tracks: +${trackAdded} (Skipped: ${trackSkipped})\n` +
                        `Layers: +${layerAdded} (Skipped: ${layerSkipped})\n\n` +
                        `Total Points: ${records.length}`);

                    if (typeof optionsModal !== 'undefined') optionsModal.classList.remove('active');
                }
            } catch (err) {
                alert("Error: Failed to read file!\n" + err.message);
            }
            e.target.value = '';
        };
        reader.readAsText(file);
    });
}
renderTracks();


// v470: Initialize Auto-Rec and Live Track checkbox states from localStorage
// Wrapped in DOMContentLoaded to ensure elements are available
// v505: Consolidated Tracking Settings Initialization
// v511: Improved Settings Initialization
document.addEventListener('DOMContentLoaded', function initTrackingSettings() {
    const chkAuto = document.getElementById('chk-auto-track');
    const chkLive = document.getElementById('chk-show-live-track');

    // v511: Use a small delay to ensure browser auto-fill/restore doesn't override our state
    setTimeout(() => {
        if (chkAuto) {
            chkAuto.checked = isTracking;
            // Remove any existing listeners and re-add (safeguard)
            chkAuto.removeEventListener('change', toggleTracking);
            chkAuto.addEventListener('change', (e) => {
                toggleTracking();
                console.log('Auto-Rec Changed:', isTracking);
            });
        }

        if (chkLive) {
            chkLive.checked = showLiveTrack;
            chkLive.addEventListener('change', (e) => {
                showLiveTrack = e.target.checked;
                localStorage.setItem('jeoShowLiveTrack', JSON.stringify(showLiveTrack));
                updateLiveTrackVisibility();
                console.log('Live Track:', showLiveTrack);
            });
        }
    }, 100);
});


// v441: Hybrid Headlight Logic
let currentSpeed = 0;
let currentCourse = null;

// v454: Headlight Rotation Update (Fixed Direction Priority)
function updateHeadlight(heading) {
    if (typeof liveMarker !== 'undefined' && liveMarker) {
        const el = liveMarker.getElement();
        if (el) {
            const cone = el.querySelector('.heading-cone');
            if (cone) {
                // v454: Improved Hybrid Logic
                // Use GPS Course if moving faster than 0.8 m/s (~2.9 km/h)
                // This prevents North-East issue when traveling East
                let rotation = heading;
                if (currentSpeed > 0.8 && currentCourse !== null) {
                    rotation = currentCourse;
                }

                // Rotate cone (0 = North/Up)
                cone.style.transform = `translate(-50%, 0) rotate(${rotation}deg)`;
                cone.style.opacity = '1';
            }
        }
    }
}

