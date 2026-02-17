const APP_VERSION = 'v1453-35F'; // Performance Optimization & Smooth Drag Fix
const JEO_VERSION = APP_VERSION; // Geriye dönük uyumluluk için
const DB_NAME = 'jeo_pusulasi_db';
const JEO_DB_VERSION = 1;
const JEO_STORE_NAME = 'externalLayers';

// Sürümü UI üzerinde güncelleme fonksiyonu
function updateAppVersionDisplay() {
    const versionElements = document.querySelectorAll('.app-version-display');
    versionElements.forEach(el => {
        el.textContent = APP_VERSION;
    });

    // Özel ID'leri de güncelle (Eski yapıyı desteklemek için)
    const activeVersionEl = document.getElementById('active-version');
    if (activeVersionEl) activeVersionEl.textContent = APP_VERSION;

    const sensorStatusText = document.getElementById('sensor-status-text');
    if (sensorStatusText && sensorStatusText.textContent.includes('v1453')) {
        // Sadece versiyon kısmını güncellemek zor olabilir, bu yüzden manuel bırakabiliriz
        // veya dinamik yapabiliriz. Şimdilik sınıf tabanlı güncelleme yeterli.
    }
}

// v750: Global Security & Stability Kalkanı
window.onerror = function (msg, url, lineNo, columnNo, error) {
    console.error(`GLOBAL ERROR: ${msg} at ${lineNo}:${columnNo}`, error);
    // v1453-06F: Restored polite message after debugging success
    showToast("An unexpected error occurred. The app is still running safely.", 3000);
    return false;
};

window.onunhandledrejection = function (event) {
    console.error('UNHANDLED PROMISE REJECTION:', event.reason);
    showToast("Background process failed. Data is safe.", 3000);
};

// v750: Simple HTML Escape to prevent XSS attacks
function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function openJeoDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, JEO_DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(JEO_STORE_NAME)) {
                db.createObjectStore(JEO_STORE_NAME, { keyPath: 'id' });
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function dbSaveLayers(layers) {
    try {
        const db = await openJeoDB();
        const tx = db.transaction(JEO_STORE_NAME, 'readwrite');
        const store = tx.objectStore(JEO_STORE_NAME);
        await store.clear();
        for (const layer of layers) {
            await store.put({
                id: layer.id,
                name: layer.name,
                geojson: layer.geojson,
                visible: layer.visible,
                filled: layer.filled,
                pointsVisible: layer.pointsVisible,
                areasVisible: layer.areasVisible,
                labelsVisible: layer.labelsVisible
            });
        }
        return new Promise((resolve) => {
            tx.oncomplete = () => resolve();
        });
    } catch (e) {
        console.error("IndexedDB Save Error:", e);
    }
}

async function dbLoadLayers() {
    try {
        const db = await openJeoDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(JEO_STORE_NAME, 'readonly');
            // v546: Transaction abort safety
            tx.onerror = () => reject(new Error("IDB Transaction failed"));
            tx.onabort = () => reject(new Error("IDB Transaction aborted"));

            const store = tx.objectStore(JEO_STORE_NAME);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.error("IndexedDB Load Error:", e);
        return [];
    }
}

function showLoading(text = "Processing file...") {
    const overlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    if (overlay && loadingText) {
        loadingText.textContent = text;
        overlay.style.display = 'flex';
    }
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'none';
}

// App Initialization & Splash Screen
function initApp() {
    // 1. Remove Splash Screen
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.classList.add('hidden');
            setTimeout(() => splash.remove(), 1000);
        }
    }, 1500);

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

// v560: Optimized discovery pattern and periodic table set (Moved to Global for performance)
const ELEMENT_DISCOVERY_PATTERN = /\b[A-Z]{1,3}\b/g;
const PERIODIC_TABLE_SYMBOLS = new Set([
    'H', 'HE', 'LI', 'BE', 'B', 'C', 'N', 'O', 'F', 'NE', 'NA', 'MG', 'AL', 'SI', 'P', 'S', 'CL', 'AR',
    'K', 'CA', 'SC', 'TI', 'V', 'CR', 'MN', 'FE', 'CO', 'NI', 'CU', 'ZN', 'GA', 'GE', 'AS', 'SE', 'BR', 'KR',
    'RB', 'SR', 'Y', 'ZR', 'NB', 'MO', 'TC', 'RU', 'RH', 'PD', 'AG', 'CD', 'IN', 'SN', 'SB', 'TE', 'I', 'XE',
    'CS', 'BA', 'LA', 'CE', 'PR', 'ND', 'PM', 'SM', 'EU', 'GD', 'TB', 'DY', 'HO', 'ER', 'TM', 'YB', 'LU',
    'HF', 'TA', 'W', 'RE', 'OS', 'IR', 'PT', 'AU', 'HG', 'TL', 'PB', 'BI', 'PO', 'AT', 'RN',
    'FR', 'RA', 'AC', 'TH', 'PA', 'U', 'NP', 'PU', 'AM', 'CM', 'BK', 'CF', 'ES', 'FM', 'MD', 'NO', 'LR',
    'RF', 'DB', 'SG', 'BH', 'HS', 'MT', 'DS', 'RG', 'CN', 'NH', 'FL', 'MC', 'LV', 'TS', 'OG',
    'REE', 'PGE'
]);

// v1453-16: Element Aliases (Common Turkish/English Names -> Symbol)
const ELEMENT_ALIASES = {
    // TR
    'ALTIN': 'AU', 'GÜMÜŞ': 'AG', 'BAKIR': 'CU', 'DEMİR': 'FE', 'KURŞUN': 'PB', 'ÇİNKO': 'ZN',
    'CIVA': 'HG', 'KROM': 'CR', 'MANGAN': 'MN', 'MANGANEZ': 'MN', 'NİKEL': 'NI', 'KOBALT': 'CO',
    'MNO': 'MN', 'MNO2': 'MN', // v1453-17: Manganese Oxides
    'ALÜMİNYUM': 'AL', 'ARSENİK': 'AS', 'ANTİMON': 'SB', 'KALAY': 'SN', 'TİTANYUM': 'TI',
    'URANYUM': 'U', 'PLATİN': 'PT', 'PALADYUM': 'PD', 'OSMİYUM': 'OS', 'İRİDYUM': 'IR',
    'RODYUM': 'RH', 'RUTENYUM': 'RU', 'KADMİYUM': 'CD', 'BİZMUT': 'BI', 'MOLİBDEN': 'MO',
    'VOLFRAM': 'W', 'TUNGSTEN': 'W', 'VANADYUM': 'V', 'LİTYUM': 'LI', 'BERİLYUM': 'BE',
    'BOR': 'B', 'FLOR': 'F', 'FOSFOR': 'P', 'KÜKÜRT': 'S', 'SİLİSYUM': 'SI',
    'KALSİYUM': 'CA', 'MAGNEZYUM': 'MG', 'SODYUM': 'NA', 'POTASYUM': 'K',
    'BARYUM': 'BA', 'STRONSİYUM': 'SR', 'ZİRKONYUM': 'ZR', 'KLOR': 'CL', 'KARBON': 'C',
    'OKSİJEN': 'O', 'HİDROJEN': 'H', 'AZOT': 'N', 'LANTAN': 'LA', 'SERYUM': 'CE',
    'NEODİM': 'ND', 'HAFNİYUM': 'HF', 'TANTAL': 'TA', 'RENYUM': 'RE',
    // Common Minerals (TR)
    'PİROLUSİT': 'MN', 'RODOKROSİT': 'MN', 'PSİLOMELAN': 'MN', 'BRAUNİT': 'MN', 'MANGANİT': 'MN',
    'KALKOPİRİT': 'CU', 'MALAHİT': 'CU', 'AZURİT': 'CU', 'KOVELLİN': 'CU', 'BORNİT': 'CU', 'KUPRİT': 'CU',
    'GALEN': 'PB', 'SERÜZİT': 'PB', 'ANGLEZİT': 'PB',
    'SFALERİT': 'ZN', 'SMİTSONİT': 'ZN', 'HEMİMORFİT': 'ZN',
    'HEMATİT': 'FE', 'MANYETİT': 'FE', 'LİMONİT': 'FE', 'SİDERİT': 'FE', 'PİRİT': 'FE', 'GÖTİT': 'FE',
    'KROMİT': 'CR', 'BOKSİT': 'AL', 'KORUND': 'AL',
    'SİNOBAR': 'HG', 'STİBNİT': 'SB', 'ARSENOPİRİT': 'AS', 'KASSİTERİT': 'SN',
    'SCHEELİT': 'W', 'VOLFRAMİT': 'W', 'MOLİBDENİT': 'MO',

    // EN (Common ones that differ from symbol)
    'GOLD': 'AU', 'SILVER': 'AG', 'COPPER': 'CU', 'IRON': 'FE', 'LEAD': 'PB', 'ZINC': 'ZN',
    'MERCURY': 'HG', 'CHROME': 'CR', 'MANGANESE': 'MN', 'NICKEL': 'NI', 'COBALT': 'CO',
    'ALUMINUM': 'AL', 'ARSENIC': 'AS', 'ANTIMONY': 'SB', 'TIN': 'SN', 'TITANIUM': 'TI',
    'URANIUM': 'U', 'PLATINUM': 'PT', 'PALLADIUM': 'PD', 'TUNGSTEN': 'W', 'LITHIUM': 'LI',
    'BERYLLIUM': 'BE', 'BORON': 'B', 'FLUORINE': 'F', 'PHOSPHORUS': 'P', 'SULFUR': 'S',
    'SILICON': 'SI', 'CALCIUM': 'CA', 'MAGNESIUM': 'MG', 'SODIUM': 'NA', 'POTASSIUM': 'K',
    'BARIUM': 'BA', 'STRONTIUM': 'SR', 'ZIRCONIUM': 'ZR', 'CHLORINE': 'CL', 'CARBON': 'C',
    'OXYGEN': 'O', 'HYDROGEN': 'H', 'NITROGEN': 'N', 'LANTHANUM': 'LA', 'CERIUM': 'CE',
    'NEODYMIUM': 'ND', 'HAFNIUM': 'HF', 'TANTALUM': 'TA', 'RHENIUM': 'RE',
    // Common Minerals (EN)
    'PYROLUSITE': 'MN', 'RHODOCHROSITE': 'MN', 'PSILOMELANE': 'MN', 'BRAUNITE': 'MN', 'MANGANITE': 'MN',
    'CHALCOPYRITE': 'CU', 'MALACHITE': 'CU', 'AZURITE': 'CU', 'COVELLITE': 'CU', 'BORNITE': 'CU', 'CUPRITE': 'CU',
    'GALENA': 'PB', 'CERUSSITE': 'PB', 'ANGLESITE': 'PB',
    'SPHALERITE': 'ZN', 'SMITHSONITE': 'ZN', 'HEMIMORPHITE': 'ZN',
    'HEMATITE': 'FE', 'MAGNETITE': 'FE', 'LIMONITE': 'FE', 'SIDERITE': 'FE', 'PYRITE': 'FE', 'GOETHITE': 'FE',
    'CHROMITE': 'CR', 'BAUXITE': 'AL', 'CORUNDUM': 'AL',
    'CINNABAR': 'HG', 'STIBNITE': 'SB', 'ARSENOPYRITE': 'AS', 'CASSITERITE': 'SN',
    'SCHEELITE': 'W', 'WOLFRAMITE': 'W', 'MOLYBDENITE': 'MO'
};

/**
 * v1453-16: Robust Element Extraction from Text
 * Handles: "Au", "Altın", "Bakır-Çinko", "Fe, Mn", "Cu 1.2%"
 */
function extractElements(text) {
    if (!text) return new Set();
    const found = new Set();

    // Normalize: Upper case, replace standard separators with spaces
    // We treat comma, dash, slash, parens as separators
    const normalized = String(text).toUpperCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, " ") // Punctuation to space
        .replace(/\s{2,}/g, " "); // Collapse spaces

    const words = normalized.split(" ");

    words.forEach(w => {
        if (!w) return;

        // 1. Direct Symbol Match
        if (PERIODIC_TABLE_SYMBOLS.has(w)) {
            found.add(w);
            return;
        }

        // 2. Alias Match
        if (ELEMENT_ALIASES[w]) {
            found.add(ELEMENT_ALIASES[w]);
            return;
        }
    });

    return found;
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

    // v1453-05F: Fix for "not rendering" - Clear existing layer before adding new one
    if (heatmapLayer) {
        map.removeLayer(heatmapLayer);
        heatmapLayer = null;
    }

    let points = [];
    let activeGradient = {};

    // Dynamic Monochromatic Gradient (v428 - High Contrast Topo Lines)
    const filterKey = (heatmapFilter || 'ALL').toUpperCase();

    if (filterKey !== 'ALL') {
        const baseColor = getElementColor(filterKey);
        const d1 = shadeColor(baseColor, -0.2); // Tier 2
        const d2 = shadeColor(baseColor, -0.4); // Tier 3
        const d3 = shadeColor(baseColor, -0.6); // Tier 4
        const dCore = shadeColor(baseColor, -0.8); // Tier 5 (Core)
        const line = shadeColor(baseColor, -0.95); // v435: Color-matched dark line
        const ultraDark = shadeColor(baseColor, -0.98); // v436: Pure monochromatic core

        // v436: Themed Transparency (baseColor + 00 alpha) to prevent interpolation shifts
        const transparentBase = baseColor + '00';

        activeGradient = {
            0.0: transparentBase,
            0.15: baseColor,
            0.40: d1,
            0.70: d2,
            0.90: d3,
            1.0: dCore
        };
    } else {
        // v567: High Contrast Professional Gradient (Vivid & Distinct)
        const rainbowTransparent = '#0000AA00'; // Dark Blue transparency base
        activeGradient = {
            0.0: rainbowTransparent,
            0.20: '#0000AA', // Deep Blue (Low)
            0.40: '#00FFFF', // Cyan (Med-Low)
            0.60: '#00FF00', // Lime Green (Medium)
            0.80: '#FFFF00', // Yellow (Med-High)
            0.95: '#FF0000', // Red (High)
            1.00: '#800000'  // Dark Red (Extreme)
        };
    }

    // 1. Gather points from standard records
    const recordPoints = records.filter(r => r.lat && r.lon);

    // v1453-16: Consolidated Logic for Records & KMLs using 'extractElements'

    // A. Records
    recordPoints.forEach(r => {
        if (filterKey === 'ALL') {
            points.push([r.lat, r.lon, 1.0]); // Uniform weight
        } else {
            // Check if record label contains the element (using robust extractor)
            const elements = extractElements(r.label);
            if (elements.has(filterKey)) {
                points.push([r.lat, r.lon, 1.0]);
            }
        }
    });

    // B. External KML Markers (v513)
    allKmlMarkers.forEach(marker => {
        const latlng = marker.getLatLng();

        if (filterKey === 'ALL') {
            points.push([latlng.lat, latlng.lng, 1.0]);
        } else {
            // v1453-16: Check layer's pre-scanned elements OR the marker's own text
            let match = false;

            // 1. Check parent layer properties (if marker belongs to a layer)
            if (marker.jeoLayerId) {
                const parentLayer = externalLayers.find(l => l.id === marker.jeoLayerId);
                if (parentLayer && parentLayer._jeoElements && parentLayer._jeoElements.has(filterKey)) {
                    match = true;
                }
            }

            // 2. Fallback: Check marker tooltip (if any) using robust extractor
            if (!match) {
                const tooltip = marker.getTooltip();
                if (tooltip) {
                    const txt = tooltip.getContent();
                    const elems = extractElements(txt);
                    if (elems.has(filterKey)) match = true;
                }
            }

            if (match) {
                points.push([latlng.lat, latlng.lng, 1.0]);
            }
        }
    });

    // v1453-1: Smart Radius Conversion (Meters to Pixels) - Fix for "Heatmap not working"
    let radiusPixels = 20; // Default
    let blurPixels = 15;   // Default

    if (heatmapRadius > 0) {
        // Calculate pixels from meters at current zoom
        const center = map.getCenter();
        const mapRes = 40075016.686 * Math.abs(Math.cos(center.lat * Math.PI / 180)) / Math.pow(2, map.getZoom() + 8);
        radiusPixels = Math.max(5, Math.round(heatmapRadius / mapRes));
        blurPixels = Math.round(radiusPixels * 0.75);
    } else {
        // v1453-05F: OTO Mode (Dynamic based on point density)
        // Adjust values to be more visible at different zoom levels
        radiusPixels = Math.max(15, 45 - (map.getZoom() * 1.5));
        blurPixels = Math.round(radiusPixels * 0.8);
    }

    if (points.length === 0) return; // v1453-05F: Don't bother if no points

    try {
        heatmapLayer = L.heatLayer(points, {
            radius: radiusPixels,
            blur: blurPixels,
            maxOpacity: 0.95, // v1453-12: Much more vivid (was 0.8)
            minOpacity: 0.4,  // v1453-12: Distinct base visibility (was 0.1)
            gradient: activeGradient,
            max: 1.0
        }).addTo(map);
    } catch (e) {
        console.error("Heatmap Layer Creation Failed:", e);
    }

    // v701: Update Legend
    updateHeatmapLegend(filterKey);
}

// v737: Robust Draggable Heatmap Panels
function initHeatmapPanelDraggable() {
    const radiusPanel = document.getElementById('heatmap-radius-panel');
    if (!radiusPanel) return;

    // v737: Heatmap radius/filter panel now draggable too
    makeDraggable(radiusPanel, 'jeoHeatmapPanelPos');

    // Restore position from localStorage
    const savedPanelPos = localStorage.getItem('jeoHeatmapPanelPos');
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;

    if (savedPanelPos) {
        try {
            const pos = JSON.parse(savedPanelPos);
            const leftNum = parseInt(pos.left);
            const topNum = parseInt(pos.top);

            // v1453-1: Boundary validation to prevent panel from getting lost (invisibility fix)
            if (isNaN(leftNum) || isNaN(topNum) || leftNum < 0 || leftNum > viewW - 100 || topNum < 0 || topNum > viewH - 100) {
                // Fallback to CSS defaults
                radiusPanel.style.removeProperty('top');
                radiusPanel.style.removeProperty('left');
                radiusPanel.style.setProperty('position', 'absolute', 'important');
                radiusPanel.style.setProperty('bottom', viewW > viewH ? '110px' : '95px', 'important');
            } else {
                radiusPanel.style.setProperty('position', 'fixed', 'important');
                radiusPanel.style.setProperty('left', pos.left, 'important');
                radiusPanel.style.setProperty('top', pos.top, 'important');
                radiusPanel.style.setProperty('bottom', 'auto', 'important');
                radiusPanel.style.setProperty('right', 'auto', 'important');
            }
        } catch (e) {
            console.warn("Could not restore Heatmap Panel position", e);
        }
    }
}
// Init on load
if (document.readyState !== 'loading') initHeatmapPanelDraggable();
else document.addEventListener('DOMContentLoaded', initHeatmapPanelDraggable);

// v734: Robust Draggable Heatmap Legend
function initHeatmapLegend() {
    const legend = document.getElementById('heatmap-legend');
    if (!legend) return;

    // v734: Use the unified makeDraggable utility for consistency and persistence
    makeDraggable(legend, 'jeoHeatmapLegendPos');

    // Restore position from localStorage
    const savedPos = localStorage.getItem('jeoHeatmapLegendPos');
    if (savedPos) {
        try {
            const pos = JSON.parse(savedPos);
            const leftNum = parseInt(pos.left);
            const topNum = parseInt(pos.top);
            const viewW = window.innerWidth;
            const viewH = window.innerHeight;

            if (isNaN(leftNum) || isNaN(topNum) || leftNum < 0 || leftNum > viewW - 100 || topNum < 0 || topNum > viewH - 100) {
                // v1453-06F: Specific Magnetic Default (Portrait Stacked)
                if (viewW > viewH) {
                    legend.style.setProperty('left', 'auto', 'important');
                    legend.style.setProperty('right', '1px', 'important');
                    legend.style.setProperty('bottom', '1px', 'important');
                } else {
                    legend.style.setProperty('left', '2px', 'important');
                    legend.style.setProperty('bottom', '42px', 'important');
                    legend.style.setProperty('top', 'auto', 'important');
                }
            } else {
                legend.style.setProperty('left', pos.left, 'important');
                legend.style.setProperty('top', pos.top, 'important');
            }

            legend.style.setProperty('position', 'fixed', 'important');
        } catch (e) {
            console.warn("Could not restore Legend position", e);
        }
    }
}
// Init immediately if ready
if (document.readyState !== 'loading') initHeatmapLegend();
else document.addEventListener('DOMContentLoaded', initHeatmapLegend);


function updateHeatmapLegend(filterKey) {
    const legend = document.getElementById('heatmap-legend');
    const title = document.getElementById('legend-title');
    const bar = document.getElementById('legend-gradient-bar');

    if (!legend || !isHeatmapActive) {
        if (legend) legend.classList.remove('visible');
        return;
    }

    legend.classList.add('visible');

    // Set Title
    if (filterKey === 'ALL') {
        title.textContent = "All Elements";
        // Rainbow Gradient (Bottom-to-Top to match specific heatmap structure if vertical)
        // Actually CSS linear-gradient(to top, ...) maps 0% at bottom to 100% at top.
        // Heatmap: 0.0 (Transparent) -> 0.20 (Blue) -> 0.45 (Green) -> 0.75 (Yellow) -> 0.95 (Red) -> 1.0 (Deep Red)
        // v1453-12: High Contrast Legend Gradient (Matches Heatmap)
        bar.style.background = `linear-gradient(to right, 
            #0000AA 0%, 
            #00FFFF 40%, 
            #00FF00 60%, 
            #FFFF00 80%, 
            #FF0000 95%, 
            #800000 100%)`;
    } else {
        const baseColor = getElementColor(filterKey);

        // v702: Title Case for Element Name (e.g. "MN" -> "Mn")
        const niceName = filterKey.charAt(0).toUpperCase() + filterKey.slice(1).toLowerCase();
        title.textContent = `${niceName} Density`;

        const c1 = shadeColor(baseColor, -0.2);
        const c2 = shadeColor(baseColor, -0.6);
        const c3 = shadeColor(baseColor, -0.98);

        // v702: Horizontal Gradient (Left to Right)
        bar.style.background = `linear-gradient(to right, 
            ${baseColor} 0%, 
            ${c1} 40%, 
            ${c2} 75%, 
            ${c3} 100%)`;
    }
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

    // v560: Lightning-fast aggregation from cached Sets
    const foundElements = new Set();

    // 1. Scan records (usually small set, scan on the fly is safe)
    records.forEach(r => {
        // v1453-16: Use Robust Extraction
        const extracted = extractElements(r.label);
        extracted.forEach(e => foundElements.add(e));
    });

    // 2. Aggregate from pre-scanned KML layers
    externalLayers.forEach(l => {
        if (l.visible && l._jeoElements) {
            l._jeoElements.forEach(el => foundElements.add(el));
        }
    });

    const emojiMap = {
        'MN': '🟣', 'CR': '🟢', 'CU': '🟠', 'NI': '🔵',
        'FE': '🟤', 'AU': '🟡', 'AG': '⚪', 'ZN': '💎', 'PB': '⚫'
    };

    let html = '<option value="ALL">🌈 All Points</option>';
    Array.from(foundElements).sort().forEach(el => {
        const emoji = emojiMap[el] || '⛏️';
        html += `<option value="${el}">${emoji} ${el}</option>`;
    });

    select.innerHTML = html;
    select.value = foundElements.has(currentVal) ? currentVal : "ALL";
}

// v583: Element Filter Loading Feedback (Fixed for click reliability)
function initHeatmapFilterListener() {
    const elFilter = document.getElementById('heatmap-element-filter');
    if (elFilter) {
        // v1453-15: Initialize immediately (No "Preparing" delay)
        updateHeatmapFilterOptions();

        // v1453-14: Changed from 'mousedown' to 'click' for better mobile compatibility
        elFilter.addEventListener('change', (e) => {
            heatmapFilter = e.target.value;
            localStorage.setItem('jeoHeatmapFilter', heatmapFilter);
            updateHeatmap();
        });
    }
}
// Initialize after DOM load
document.addEventListener('DOMContentLoaded', initHeatmapFilterListener);
// Also ensure it works if panel is opened later
if (document.readyState !== 'loading') initHeatmapFilterListener();

function toggleHeatmap() {
    isHeatmapActive = !isHeatmapActive;
    const btn = document.getElementById('btn-heatmap-toggle');
    const panel = document.getElementById('heatmap-radius-panel');

    if (btn) btn.classList.toggle('active', isHeatmapActive);

    // v1453-29F: Smooth Animation Logic (Class Toggle)
    if (panel) {
        if (isHeatmapActive) {
            // Add visible class to trigger CSS transition
            // Small timeout to Ensure DOM render if it was completely removed (though we use opacity now)
            requestAnimationFrame(() => {
                panel.classList.add('panel-visible');
            });

            // v1453-1: Reset inline styles to force fixed CSS positions on toggle
            panel.style.top = '';
            panel.style.left = '';
            panel.style.right = '';
            panel.style.bottom = '';

            const legend = document.getElementById('heatmap-legend');
            if (legend) {
                // Also reset legend styles if needed, or handle its own animation
                legend.style.display = 'block'; // Ensure it's shown if logic requires
                legend.style.top = '';
                legend.style.left = '';
                legend.style.right = '';
                legend.style.bottom = '';
            }
        } else {
            // Remove visible class to trigger fade out/slide down
            panel.classList.remove('panel-visible');
            // v1453-32F: Reset inline display to allow CSS opacity/transform to work
            panel.style.display = '';
            // We do NOT set display: none immediately to allow transition to finish
            // CSS pointer-events: none handles interactions
        }
    }

    if (isHeatmapActive) {
        updateHeatmapFilterOptions();
        updateHeatmap();

        // v1453-31F: Robust Close Logic - Only close if really outside
        panel.addEventListener('click', (e) => e.stopPropagation());

        setTimeout(() => {
            const closeHandler = (e) => {
                const isOutsidePanel = !panel.contains(e.target);
                const isOutsideToggle = e.target.id !== 'btn-heatmap-toggle' && !e.target.closest('#btn-heatmap-toggle');

                if (isOutsidePanel && isOutsideToggle) {
                    // v1453-1: Ensure we don't close if focusing filter inputs
                    if (document.activeElement && (document.activeElement.id === 'heatmap-element-filter' || document.activeElement.tagName === 'SELECT')) return;

                    // v1453-31F: Use Standard Smooth Visibility (Remove Class, No manual Display)
                    isHeatmapActive = false; // State update
                    if (btn) btn.classList.remove('active');
                    if (panel) panel.classList.remove('panel-visible');

                    document.removeEventListener('click', closeHandler);
                }
            };
            document.addEventListener('click', closeHandler);
        }, 300);
    } else {
        isHeatmapActive = false;
        if (btn) btn.classList.remove('active');
        if (panel) panel.classList.remove('panel-visible'); // v1453-31F: Use class
        const legend = document.getElementById('heatmap-legend');
        if (legend) legend.classList.remove('visible');
        localStorage.setItem('jeoHeatmapActive', 'false'); // v563: Persist toggle
        if (heatmapLayer) {
            map.removeLayer(heatmapLayer);
            heatmapLayer = null;
        }
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
let isTracksLocked = true; // İzlekler de varsayılan olarak kilitli başlar
let activeGridColor = localStorage.getItem('jeoGridColor') || '#00ffcc'; // v520/v563: Persisted Grid Color
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

// Heatmap State (v401/v563: Persisted)
let heatmapLayer = null;
let isHeatmapActive = localStorage.getItem('jeoHeatmapActive') === 'true';
// v1453-1: Proper check to maintain '0' (OTO) without falling back to 50
const savedRadius = localStorage.getItem('jeoHeatmapRadius');
let heatmapRadius = savedRadius !== null ? parseInt(savedRadius) : 50;
let heatmapFilter = localStorage.getItem('jeoHeatmapFilter') || 'ALL'; // v403

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

// Grid State (v516/v563: Persisted)
let isGridMode = localStorage.getItem('jeoGridMode') === 'true';
let activeGridInterval = parseInt(localStorage.getItem('jeoGridInterval')) || null;
let currentGridLayer = null;

// KML/KMZ Layers State
let externalLayers = []; // { id, name, layer, filled: true, visible: true, pointsVisible: true, areasVisible: true, labelsVisible: true }
let allKmlMarkers = []; // v545: Flat array for lightning-fast label optimization
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

// v560: Optimized discovery pattern and periodic table set (Moved to Global for performance)


// v556: Smart Color Generator for Dynamic Elements
function getElementColor(symbol) {
    if (ELEMENT_COLORS[symbol]) return ELEMENT_COLORS[symbol];

    // Hash-based color generation for stability
    let hash = 0;
    for (let i = 0; i < symbol.length; i++) {
        hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Convert hash to stable Hex color
    const r = (hash & 0xFF0000) >> 16;
    const g = (hash & 0x00FF00) >> 8;
    const b = hash & 0x0000FF;
    const hex = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    return hex;
}

// Smart Label Placement Utility (v383 - Globals for cross-module access)
let labelOptimizeTimer = null;
function optimizeMapPoints() {
    if (!map) return;
    try {
        if (labelOptimizeTimer) clearTimeout(labelOptimizeTimer);

        labelOptimizeTimer = setTimeout(() => {
            const markers = allKmlMarkers;
            if (markers.length === 0) return;

            const mapBounds = map.getBounds();
            const occupiedRects = []; // Store {top, left, right, bottom} in layer points
            const labelsToPlace = []; // Collect valid labels to process

            // 1. First, treat ALL visible markers (KML + Records) as obstacles
            // This prevents labels from overlapping the "dots" or orientation symbols

            // Collect KML markers that are visible
            markers.forEach(marker => {
                const parentLayer = externalLayers.find(l => l.id === marker.jeoLayerId);
                if (!parentLayer || !parentLayer.visible || !parentLayer.pointsVisible) return;

                const latLng = marker.getLatLng();
                if (!mapBounds.contains(latLng)) return;

                const pos = map.latLngToLayerPoint(latLng);
                const r = 4; // Marker radius in pixels
                occupiedRects.push({
                    left: pos.x - r,
                    top: pos.y - r,
                    right: pos.x + r,
                    bottom: pos.y + r
                });

                if (parentLayer.labelsVisible && marker.getTooltip()) {
                    labelsToPlace.push({ marker, tooltip: marker.getTooltip() });
                }
            });

            // Collect standard record markers
            if (markerGroup) {
                markerGroup.eachLayer(layer => {
                    if (layer instanceof L.Marker) {
                        const latLng = layer.getLatLng();
                        if (mapBounds.contains(latLng)) {
                            const pos = map.latLngToLayerPoint(latLng);
                            const r = 12; // Standard pins are larger
                            occupiedRects.push({
                                left: pos.x - r,
                                top: pos.y - r,
                                right: pos.x + r,
                                bottom: pos.y + r
                            });
                        }
                    }
                });
            }

            // 3. Process Labels (v676: No Hiding)
            labelsToPlace.forEach(({ marker, tooltip }) => {
                marker.openTooltip();
                const tooltipEl = tooltip.getElement();
                if (!tooltipEl) return;

                if ((!tooltip._jeoWidth || tooltip._jeoWidth === 0) && tooltipEl.offsetWidth > 0) {
                    tooltip._jeoWidth = tooltipEl.offsetWidth;
                    tooltip._jeoHeight = tooltipEl.offsetHeight;
                }
                const width = tooltip._jeoWidth || 20;
                const height = tooltip._jeoHeight || 12;

                const markerPos = map.latLngToLayerPoint(marker.getLatLng());

                // Check 8 directions (Center anchor baseline)
                // v1453-05F: Increased padding for better visibility
                const pad = 3;
                const directions = [
                    { x: -width / 2, y: -height / 2 - pad - 6 }, // N
                    { x: pad + 6, y: -height / 2 - pad - 6 },    // NE
                    { x: pad + 8, y: -height / 2 },              // E
                    { x: pad + 6, y: height / 2 + pad + 2 },     // SE
                    { x: -width / 2, y: height / 2 + pad + 2 },      // S
                    { x: -width - pad - 4, y: height / 2 + pad + 2 }, // SW
                    { x: -width - pad - 8, y: -height / 2 },     // W
                    { x: -width - pad - 4, y: -height / 2 - pad - 6 } // NW
                ];

                let bestPos = null;
                for (const dir of directions) {
                    const rect = {
                        left: markerPos.x + dir.x,
                        top: markerPos.y + dir.y,
                        right: markerPos.x + dir.x + width,
                        bottom: markerPos.y + dir.y + height
                    };

                    const hasCollision = occupiedRects.some(occ => {
                        return !(rect.right < occ.left || rect.left > occ.right || rect.bottom < occ.top || rect.top > occ.bottom);
                    });

                    if (!hasCollision) {
                        bestPos = { x: dir.x, y: dir.y, rect: rect };
                        break;
                    }
                }

                if (bestPos) {
                    tooltipEl.style.opacity = "1";
                    tooltipEl.style.visibility = "visible";
                    // Apply offset via margins (Shift from center anchor)
                    tooltipEl.style.marginLeft = `${bestPos.x + width / 2}px`;
                    tooltipEl.style.marginTop = `${bestPos.y + height / 2}px`;
                    occupiedRects.push(bestPos.rect);
                } else {
                    // v676: Fallback to North instead of hiding (User: "No Hiding")
                    const fallbackDir = directions[0];
                    tooltipEl.style.opacity = "1";
                    tooltipEl.style.visibility = "visible";
                    tooltipEl.style.marginLeft = `${fallbackDir.x + width / 2}px`;
                    tooltipEl.style.marginTop = `${fallbackDir.y + height / 2}px`;
                    // Note: We don't push to occupiedRects if it's a fallback collision, 
                    // or we could if we want others to avoid it too. Let's not to avoid cascades.
                }
            });

        }, 50);
    } catch (e) {
        console.error("optimizeMapPoints failed:", e);
    }
}

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
    const keys = ['name', 'Name', 'NAME', 'label', 'Label', 'LABEL', 'mineraller', 'Mineraller', 'id', 'ID'];
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
                    // v516: Heading Line Update
                    if (headingLine) {
                        const lat = currentCoords.lat;
                        const lon = currentCoords.lon;
                        const heading = displayedHeading; // Assuming displayedHeading is available globally or from another source
                        if (lat !== null && lon !== null && heading !== null) {
                            headingLine.setLatLngs([
                                [lat, lon],
                                calculateDestination(lat, lon, 50000, heading) // 50km line
                            ]);
                        }
                    }

                    // v651: Dynamic Navigation Update
                    if (isNavMode) {
                        const lat = currentCoords.lat;
                        const lon = currentCoords.lon;
                        if (lat !== null && lon !== null) {
                            updateRouteStart(lat, lon);
                        }
                    }
                });
                sensor.start();
                return;
            } catch (e) { }
        }
    }
}
initBarometer();

// Z-Priority Helper (v527: Absolute Online Priority)
function getBestAltitude() {
    // Current Coords Alt Hierarchy: Online > Baro > GPS
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

    let dip = Math.abs(currentTilt.beta);
    // v542: Wider 90-degree snap (88.0 - 92.0) to prevent "88 bounce" and ensure stability
    if (dip > 88.0 && dip < 92.0) dip = 90;
    else if (dip > 90) dip = 180 - dip;

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
    // Removed: updateScaleValues(); (v562: Stopped high-frequency updates to fix dancing scale bar)
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
    // v551: Headlight Sync REMOVED from Compass Animation. 
    // The map headlight strictly follows GPS/Travel Direction now.
    // updateHeadlight(displayedHeading); // Disabled to prevent phone-rotation leak
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

    // v1453-1: High Accuracy GPS for Altitude (Z)
    watchId = navigator.geolocation.watchPosition((p) => {
        try {
            // v560: Capture last position before updating smoothedPos for bearing calculation
            const lastPos = (smoothedPos.lat === 0 && smoothedPos.lon === 0) ? null : { lat: smoothedPos.lat, lon: smoothedPos.lon };

            currentCoords.lat = p.coords.latitude;
            currentCoords.lon = p.coords.longitude;
            currentCoords.acc = p.coords.accuracy;
            currentCoords.alt = p.coords.altitude;

            // v738: Fill online coordinates for altitude logic
            onlineMyLat = p.coords.latitude;
            onlineMyLon = p.coords.longitude;

            // v1453-1: Immediate UI update for GPS altitude baseline
            updateScaleValues();

            // v521: Save last known location to localStorage
            localStorage.setItem('jeoLastLat', currentCoords.lat);
            localStorage.setItem('jeoLastLon', currentCoords.lon);

            // v704: Accurate Elevation (Z) Retrieval
            // Open-Meteo API provides Topographic Elevation (MSL) which is better than phone GPS (Ellipsoid)
            const now = Date.now();
            if (now - lastFetches.me > 10000) { // Throttle: 10 seconds
                lastFetches.me = now;
                fetchElevation(currentCoords.lat, currentCoords.lon, (alt) => {
                    if (alt !== null) {
                        onlineMyAlt = alt;
                        updateScaleValues(); // Update UI immediately
                    }
                });
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

                // v549: TRAVEL-ONLY HEADLIGHT
                // The user specifically wants the headlight to ONLY follow the direction of progress.
                // We prioritize GPS Kurs (heading), then fallback to manual calculation if available.
                // We NEVER use the compass sensor (displayedHeading) here anymore.
                const gpsHeading = p.coords.heading;
                const speed = p.coords.speed || 0;
                let targetRot = window.lastMarkerRotation || 0;

                if (gpsHeading !== null && gpsHeading !== undefined && speed > 0.5) {
                    targetRot = gpsHeading;
                } else if (lastPos && speed > 0.5) {
                    // Manual bearing calculation (Backup for devices with null heading)
                    const dLat = smoothedPos.lat - lastPos.lat;
                    const dLon = smoothedPos.lon - lastPos.lon;
                    if (Math.abs(dLat) > 0.00001 || Math.abs(dLon) > 0.00001) {
                        targetRot = (Math.atan2(dLon, dLat) * 180) / Math.PI;
                        if (targetRot < 0) targetRot += 360;
                    }
                }
                // If stationary (speed <= 0.5), targetRot remains lastMarkerRotation.

                // Simple smoothing (v525)
                if (typeof lastMarkerRotation === 'undefined') window.lastMarkerRotation = targetRot;
                let diff = targetRot - lastMarkerRotation;
                while (diff < -180) diff += 360;
                while (diff > 180) diff -= 360;
                lastMarkerRotation += diff * 0.3; // 30% lerp factor

                const markerEl = liveMarker.getElement();
                if (markerEl) {
                    const cone = markerEl.querySelector('.heading-cone');
                    if (cone) {
                        cone.style.transform = `translate(-50%, 0) rotate(${lastMarkerRotation}deg)`;
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
        const q = filter.toLowerCase();
        // Points search
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
            <td>${escapeHTML(r.label) || r.id}</td>
            <td>${r.y}</td>
            <td>${r.x}</td>
            <td>${r.z}</td>
            <td>${r.strike}</td>
            <td>${r.dip}</td>
            <td style="font-size:0.75rem; color:#aaa;">${escapeHTML(r.time) || ''}</td>
            <td style="max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHTML(r.note)}</td>
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
let routingControl = null; // v620: Global Routing Control

function initMap() {
    if (map) return;

    const initialLat = currentCoords.lat || parseFloat(localStorage.getItem('jeoLastLat')) || 39.9334;
    const initialLon = currentCoords.lon || parseFloat(localStorage.getItem('jeoLastLon')) || 32.8597;

    map = L.map('map-container', {
        maxZoom: 25,
        minZoom: 1,
        zoomSnap: 0.1, // v734: Free zoom support
        zoomDelta: 0.1, // v734: Smoother zoom increments
        preferCanvas: true // v543: Essential for handling large KML datasets (10x faster rendering)
    }).setView([initialLat, initialLon], currentCoords.lat ? 17 : 15);

    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 25,
        maxNativeZoom: 19,
        attribution: '© OpenStreetMap'
    });

    // v1453-1: Heatmap-optimized layer (Muted greenery)
    const osmHeatmap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 25,
        maxNativeZoom: 19,
        attribution: '© OpenStreetMap',
        className: 'osm-heatmap-filter'
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
        "Street (HeatMap)": osmHeatmap,
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

    // v680: Safer pane creation (Check if exists first)
    if (!map.getPane('tracking-pane')) {
        map.createPane('tracking-pane');
        map.getPane('tracking-pane').style.zIndex = 650;
        map.getPane('tracking-pane').style.pointerEvents = 'none';
    }

    if (!map.getPane('routing-pane')) {
        map.createPane('routing-pane');
        map.getPane('routing-pane').style.zIndex = 850;
        map.getPane('routing-pane').style.pointerEvents = 'none';
    }

    const overlayMaps = {
        "Live Location": liveLayer
    };

    L.control.layers(baseMaps, overlayMaps).addTo(map);

    // Persist layer selection
    map.on('baselayerchange', (e) => {
        activeMapLayer = e.name; // Update global tracker
        localStorage.setItem('jeoMapLayer', e.name);
    });


    // Map events for Smart Label Positioning
    map.on('zoomend moveend overlayadd baselayerchange', () => {
        optimizeMapPoints();
    });

    // initMapControls(); (v602: Removed first occurrence to fix ghosting)

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
                opacity: 0.8,
                pane: 'tracking-pane'
            }).addTo(map);
        }
    }


    /* REMOVED LOCK SYSTEM (v355) */


    // Map Click Handler for Interactions (v527: Absolute Grid Dominance)
    map.on('click', (e) => {
        // v527: If Grid Mode is active, SHUT DOWN all other interactions
        if (isGridMode && activeGridInterval) {
            if (e.originalEvent) e.originalEvent.stopPropagation();
            map.closePopup();

            let candidates = [];
            const findPolygonsRecursive = (target) => {
                if (!target) return;
                // v532: Most aggressive detection for any closed path/area
                if (target.getLatLngs) {
                    const isPoly = target instanceof L.Polygon;
                    const isClosedLine = target instanceof L.Polyline && (target.options && target.options.fill);
                    const isActiveMeasure = target === measureLine && (typeof isPolygon !== 'undefined' && isPolygon);

                    if ((isPoly || isClosedLine || isActiveMeasure) && target.getBounds) {
                        if (target.getBounds().contains(e.latlng)) {
                            if (isPointInPolygon(e.latlng, target)) {
                                candidates.push(target);
                            }
                        }
                    }
                } else if (target.eachLayer) {
                    target.eachLayer(layer => findPolygonsRecursive(layer));
                }
            };

            // Aggressive search starting from map and specific groups
            findPolygonsRecursive(map);
            if (typeof markerGroup !== 'undefined' && markerGroup) findPolygonsRecursive(markerGroup);

            // v533: Specifically check measurement tool layers (Yellow Area)
            if (typeof measureLine !== 'undefined' && measureLine) {
                // If measureLine is a layerGroup/FeatureGroup, search children
                if (measureLine.eachLayer) {
                    measureLine.eachLayer(l => findPolygonsRecursive(l));
                } else {
                    findPolygonsRecursive(measureLine);
                }
            }

            if (candidates.length > 0) {
                // Priority: Smallest area (most specific)
                const targetLayer = candidates.reduce((prev, curr) => {
                    const prevB = prev.getBounds ? prev.getBounds() : null;
                    const currB = curr.getBounds ? curr.getBounds() : null;
                    if (!prevB) return curr;
                    if (!currB) return prev;
                    const prevArea = (prevB.getNorth() - prevB.getSouth()) * (prevB.getEast() - prevB.getWest());
                    const currArea = (currB.getNorth() - currB.getSouth()) * (currB.getEast() - currB.getWest());
                    return currArea < prevArea ? curr : prev;
                }, candidates[0]);

                createAreaGrid(targetLayer, activeGridInterval, activeGridColor);
                return; // INTERACTION STOPPED: No popups allowed in grid mode
            }
            return; // Even if no polygon found, stop here if grid mode is on (prevents random popups)
        }

        if (isMeasuring) {
            updateMeasurement(e.latlng);
        } else if (isAddingPoint) {
            // Handled by Crosshair
        }
    });




    updateMapMarkers(true);
    loadExternalLayers(true); // v734: Silent load on startup
    initMapControls(); // v604: Single definitive call to ensure stable UI



    // v563: Restore UI States for Heatmap/Grid/Filter/Radius on Startup
    setTimeout(() => {
        // 1. Restore Heatmap Select and Active classes
        const elFilter = document.getElementById('heatmap-element-filter');
        if (elFilter) elFilter.value = heatmapFilter;

        // Update active state in panel buttons
        document.querySelectorAll('.radius-opt').forEach(opt => {
            opt.classList.remove('active');
            if (parseInt(opt.dataset.radius) === heatmapRadius) {
                opt.classList.add('active');
            }
        });

        const btnHeatmap = document.getElementById('btn-heatmap-toggle');
        const heatPanel = document.getElementById('heatmap-radius-panel');
        if (isHeatmapActive) {
            if (btnHeatmap) btnHeatmap.classList.add('active');
            // v1453-31F: Use standard smooth transition class on startup
            if (heatPanel) heatPanel.classList.add('panel-visible');
            updateHeatmap();
        }

        // 2. Restore Grid Select and Active classes
        const btnGrid = document.getElementById('btn-grid-toggle');
        const gridPanel = document.getElementById('grid-interval-panel');
        if (isGridMode) {
            if (btnGrid) btnGrid.classList.add('active');
            if (gridPanel) gridPanel.style.display = 'flex';
        }

        document.querySelectorAll('.grid-opt-btn').forEach(btn => {
            if (parseInt(btn.getAttribute('data-interval')) === activeGridInterval) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        document.querySelectorAll('.grid-color-opt').forEach(btn => {
            if (btn.getAttribute('data-color') === activeGridColor) {
                btn.classList.add('active');
                btn.style.border = "2px solid #fff";
            } else {
                btn.classList.remove('active');
                btn.style.border = "1px solid rgba(255,255,255,0.4)";
            }
        });
    }, 500); // v563: Slight delay to ensure DOM is ready and IDB layers finished loading
}

/** Combined Map Controls (Scale + UTM) **/
function initMapControls() {
    // v604: Robust safeguard to prevent "ghosting" or duplicate controls
    if (document.querySelector('.custom-scale-wrapper')) {
        console.log("Map controls already exist. Skipping init.");
        return;
    }

    const MapControls = L.Control.extend({
        options: { position: 'bottomleft' },
        onAdd: function (map) {
            const wrapper = L.DomUtil.create('div', 'custom-scale-wrapper');
            wrapper.innerHTML = `
                <div class="scale-header-track">
                    <span class="drag-handle">::::</span>
                    <span class="scale-header-placeholder" style="font-size: 0.7rem; font-weight: bold;">Scale</span>
                </div>
                <div class="scale-body">
                    <div class="scale-labels">
                        <span>0</span>
                        <span id="scale-end">...</span>
                    </div>
                    <div class="scale-line">
                        <div class="scale-notch notch-left"></div>
                        <div class="scale-bar"></div>
                        <div class="scale-notch notch-right"></div>
                    </div>
                </div>
            `;
            return wrapper;
        }
    });

    new MapControls().addTo(map);

    // v713: Draggable Scale Bar Logic
    const scaleWrapper = document.querySelector('.custom-scale-wrapper');
    if (scaleWrapper) {
        // v718: Restore visibility from localStorage (default: true)
        const isScaleVisible = JSON.parse(localStorage.getItem('jeoScaleVisible') ?? 'true');
        if (isScaleVisible) {
            scaleWrapper.classList.add('visible');
        } else {
            scaleWrapper.classList.remove('visible');
        }

        // Sync toggle button color
        const btnScale = document.getElementById('btn-scale-toggle');
        if (btnScale) {
            btnScale.style.backgroundColor = isScaleVisible ? 'rgba(76, 175, 80, 0.8)' : 'rgba(0,0,0,0.7)';
        }

        // v1453-1: Reset position key to force alignment update
        makeDraggable(scaleWrapper, 'jeoScalePos_v3');

        // v1453-1: Essential for smooth dragging - prevent click/drag propagation to map
        L.DomEvent.on(scaleWrapper, 'mousedown touchstart', L.DomEvent.stopPropagation);
        L.DomEvent.on(scaleWrapper, 'click', L.DomEvent.stopPropagation);
        L.DomEvent.disableScrollPropagation(scaleWrapper);
        L.DomEvent.disableClickPropagation(scaleWrapper);

        // v1453-05F: Restart-Reset Logic (Always start at defaults on fresh launch)
        // Position is NOT restored from localStorage on startup anymore to ensure CSS baseline.
        const savedPos = localStorage.getItem('jeoScalePos_v3');

        scaleWrapper.style.removeProperty('top');
        scaleWrapper.style.removeProperty('left');
        scaleWrapper.style.removeProperty('bottom');
        scaleWrapper.style.removeProperty('right');
        scaleWrapper.style.setProperty('position', 'fixed', 'important');

        // Ensure standard css doesn't override if no custom position is yet established
        if (!savedPos) {
            scaleWrapper.style.removeProperty('top'); // Double down on bottom bias
        }
    }

    map.on('zoom move zoomend moveend', updateScaleValues);
    // Refresh it on window resize too
    window.addEventListener('resize', updateScaleValues);
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

// v713: Generic Drag Helper
function makeDraggable(element, storageKey) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

    element.onmousedown = dragMouseDown;
    element.ontouchstart = dragMouseDown; // Mobile support

    function dragMouseDown(e) {
        e = e || window.event;
        // v1453-1: Identify if we're clicking a control (button/select/input)
        const target = e.target;
        const isControl = target.tagName === 'BUTTON' || target.tagName === 'SELECT' || target.tagName === 'INPUT' || target.classList.contains('radius-opt') || target.closest('button');

        // v1453-1: If it's a control, allow the click/tap and don't start dragging
        if (isControl) return;

        // v1453-1: Prevent default on mobile for non-controls to stop "page-pull" but allow UI drag
        if (e.type === 'touchstart') e.preventDefault();

        if (e.stopPropagation) e.stopPropagation();
        if (typeof L !== 'undefined' && L.DomEvent) L.DomEvent.stopPropagation(e);

        // v720: Disable map dragging during UI drag
        if (typeof map !== 'undefined' && map && map.dragging) {
            map.dragging.disable();
        }

        // v727: Capture current viewport Grab Offset (Direct Anchor)
        // v1453-1: Force position fixed and lock current top/left IMMEDIATELY to stop "jump"
        const rect = element.getBoundingClientRect();
        element.style.setProperty('position', 'fixed', 'important');
        element.style.setProperty('top', rect.top + 'px', 'important');
        element.style.setProperty('left', rect.left + 'px', 'important');
        element.style.setProperty('bottom', 'auto', 'important');
        element.style.setProperty('right', 'auto', 'important');
        element.style.setProperty('transition', 'none', 'important');

        let clientX, clientY;
        if (e.type === 'touchstart') {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        // v1453-35F: Cache dimensions IMMEDIATELY to avoid lookups in the loop
        element.cachedWidth = rect.width;
        element.cachedHeight = rect.height;

        // Calculate where inside the element we grabbed it (Viewport space)
        element.grabOffsetX = clientX - rect.left;
        element.grabOffsetY = clientY - rect.top;

        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
        document.ontouchend = closeDragElement;
        document.ontouchmove = elementDrag;
    }

    function elementDrag(e) {
        e = e || window.event;
        // v714: Prevent scrolling on mobile to allow vertical drag
        if (e.type === 'touchmove') {
            e.preventDefault();
        }

        let clientX, clientY;
        if (e.type === 'touchmove') {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        // v727: Direct viewport anchor positioning (No calculation drift possible)
        let finalTop = clientY - element.grabOffsetY;
        let finalLeft = clientX - element.grabOffsetX;

        // v1453-35F: Performance Optimization - Use cached rect dimensions to avoid layout thrashing
        const maxTop = window.innerHeight - (element.cachedHeight || 0);
        const maxLeft = window.innerWidth - (element.cachedWidth || 0);

        if (finalTop < 0) finalTop = 0;
        if (finalTop > maxTop) finalTop = maxTop;
        if (finalLeft < 0) finalLeft = 0;
        if (finalLeft > maxLeft) finalLeft = maxLeft;

        element.style.setProperty('top', finalTop + "px", 'important');
        element.style.setProperty('left', finalLeft + "px", 'important');
    }

    function closeDragElement() {
        // stop moving when mouse button is released:
        document.onmouseup = null;
        document.onmousemove = null;
        document.ontouchend = null;
        document.ontouchmove = null;

        // v727: Restore transitions
        element.style.removeProperty('transition');

        // v720: Re-enable map dragging
        if (typeof map !== 'undefined' && map && map.dragging) {
            map.dragging.enable();
        }

        // Save position
        if (storageKey) {
            const pos = {
                left: element.style.left,
                top: element.style.top
            };
            localStorage.setItem(storageKey, JSON.stringify(pos));
        }
    }
}

// v465: Ensure fresh track per session on startup
// If there is leftover track data (e.g. from a crash), save it first.
if (typeof trackPath !== 'undefined' && trackPath.length > 0) {
    saveCurrentTrack();
}

/** Hybrid Elevation Logic **/
let onlineMyAlt = null;
let onlineMyLat = null;
let onlineMyLon = null;
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

// v703: Update scale and UTM values logic
function updateScaleValues() {
    try {
        const scaleWrapper = document.querySelector('.custom-scale-wrapper');
        if (!scaleWrapper || scaleWrapper.style.display === 'none') return;

        if (typeof map !== 'undefined' && map) {
            // v1453-06F: Defensive checks - ensure map has a valid size and view
            if (!map.getCenter || !map._loaded) return;

            let center;
            try {
                center = map.getCenter();
                if (!center || isNaN(center.lat)) return;
            } catch (e) { return; }

            const y = center.lat;
            const x = center.lng;

            // Scale Logic
            const targetWidthCm = 1.42;
            const pxPerCm = 96 / 2.54;
            const targetWidthPx = targetWidthCm * pxPerCm;

            let distMeters = 0;
            try {
                // v1453-06F: Use safer point conversion
                const point1 = map.containerPointToLatLng([0, 0]);
                const point2 = map.containerPointToLatLng([targetWidthPx, 0]);
                if (point1 && point2) {
                    distMeters = point1.distanceTo(point2);
                }
            } catch (e) { return; }

            let displayDist = Math.round(distMeters);
            let unit = "m";
            if (displayDist > 1000) {
                displayDist = (distMeters / 1000).toFixed(1);
                unit = "km";
            }

            // UTM Logic
            let displayLat = null, displayLon = null, displayAlt = "---";

            if (typeof activePoint !== 'undefined' && activePoint) {
                displayLat = activePoint.lat;
                displayLon = activePoint.lng;
                displayAlt = (activePoint.alt !== undefined && activePoint.alt !== null) ? Math.round(activePoint.alt) : "---";
            } else if (isAddingPoint) {
                displayLat = y;
                displayLon = x;
                displayAlt = onlineCenterAlt !== null ? Math.round(onlineCenterAlt) : "---";
            } else if (typeof currentCoords !== 'undefined' && currentCoords.lat !== 0) {
                displayLat = currentCoords.lat;
                displayLon = currentCoords.lon;
                if (onlineMyAlt !== null) {
                    displayAlt = Math.round(onlineMyAlt);
                } else if (currentCoords.alt !== null) {
                    displayAlt = Math.round(currentCoords.alt);
                }
            } else {
                displayLat = y;
                displayLon = x;
            }

            // v1453-06F: Specific coordinate validity check (Strict)
            if (typeof displayLat === 'number' && typeof displayLon === 'number' && !isNaN(displayLat)) {
                const zone = Math.floor((displayLon + 180) / 6) + 1;
                // v1453-06F: Use explicit proj strings to avoid ReferenceErrors for aliases
                const wgs84 = "+proj=longlat +datum=WGS84 +no_defs";
                const utmZoneDef = `+proj=utm +zone=${zone} +ellps=intl +towgs84=-87,-98,-121,0,0,0,0 +units=m +no_defs`;
                try {
                    if (typeof proj4 !== 'function') throw new Error("proj4 is not a function");

                    const [easting, northing] = proj4(wgs84, utmZoneDef, [displayLon, displayLat]);
                    const eastPart = isNaN(easting) ? 0 : Math.round(easting);
                    const northPart = isNaN(northing) ? 0 : Math.round(northing);

                    scaleWrapper.innerHTML = `
                        <div class="drag-handle" style="position:absolute; top:2px; left:10px; font-size:8px; opacity:0.5; pointer-events:none;">::::</div>
                        <div class="info-flex-row" style="display:flex; align-items:center; justify-content:center; gap:15px; height:100%; width:100%;">
                            <div class="scale-body" style="display:flex; align-items:center; justify-content:center;">
                                <div class="scale-row-wrapper" style="display:flex; align-items:center; gap:5px;">
                                    <div class="scale-group-left" style="display:flex; flex-direction:column; align-items:center;">
                                        <div class="scale-labels" style="position:relative; width:1.42cm; height:12px; font-size:10px; margin-bottom:-1px;">
                                            <span class="scale-lbl-0" style="position:absolute; left:0; transform:translateX(-50%); color:#fff;">0</span>
                                            <span class="scale-lbl-val" style="position:absolute; right:0; transform:translateX(50%); color:#fff;">${displayDist}</span>
                                        </div>
                                        <div class="scale-line" style="width:1.42cm; height:5px; position:relative; display:flex; align-items:flex-end;">
                                            <div class="scale-notch notch-left" style="width:2px; height:5px; background:#ffeb3b; position:absolute; left:0; bottom:0;"></div>
                                            <div class="scale-bar" style="width:100%; height:2px; background:#ffeb3b;"></div>
                                            <div class="scale-notch notch-right" style="width:2px; height:5px; background:#ffeb3b; position:absolute; right:0; bottom:0;"></div>
                                        </div>
                                    </div>
                                    <span class="scale-unit-text" style="font-size:10px; color:#ffeb3b; font-weight:bold; margin-top:8px;">${unit}</span>
                                </div>
                            </div>
                            <div class="utm-rows-container" style="display:flex; flex-direction:column; justify-content:center; align-items:flex-start; line-height:1.2;">
                                <div class="utm-row-line">
                                    <span class="utm-lbl">Y:</span><span class="utm-val" style="color:#fff;">${eastPart}</span>
                                </div>
                                <div class="utm-row-line">
                                    <span class="utm-lbl">X:</span><span class="utm-val" style="color:#fff;">${northPart}</span>
                                    <span class="utm-lbl" style="margin-left:5px;">Z:</span><span class="utm-val" style="color:#fff; font-weight:bold;">${displayAlt}m</span>
                                </div>
                            </div>
                        </div>
                    `;
                } catch (e) {
                    console.error("UTM Conversion Error:", e);
                    scaleWrapper.innerHTML = `<span style="font-size:10px;">UTM Syncing...</span>`;
                }
            } else {
                scaleWrapper.innerHTML = `<span style="font-size:10px;">Waiting for location...</span>`;
            }
        }
    } catch (err) {
        console.error("Critical Scale Panel Error:", err);
    }
}

function formatScaleDistParts(d) {
    let val, unit;
    if (d < 1000) {
        // v734: Round to nearest multiple of 5
        val = Math.round(d / 5) * 5;
        if (val === 0 && d > 0) val = 5; // Prevent 0m display for small distances
        unit = "m";
    } else {
        // v734: For km, standard rounding is usually fine but can be adapted if needed
        val = Math.round(d / 1000);
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
                            }).addTo(map);
                        }
                    }
                }

                const popupContent = `
                    <div class="map-popup-container">
                        <b style="font-size: 1.1rem;">Measurement: ${escapeHTML(labelText)}</b>
                        <hr style="border:0; border-top:1px solid #eee; margin:8px 0;">
                        <div style="font-size: 0.95rem; margin-bottom: 8px;">${escapeHTML(r.note) || 'No note'}</div>
                        <div style="background: #f5f5f5; padding: 8px; border-radius: 4px; font-size: 0.85rem; margin-bottom: 10px;">
                            ${r.geomType === 'polygon' ? `<b>Perimeter:</b> ${formatScaleDist(totalLen)}<br><b>Area:</b> ${formatArea(calculateAreaHelper(latlngs.map(p => L.latLng(p[0], p[1]))))}` : `<b>Length:</b> ${formatScaleDist(totalLen)}`}
                        </div>
                        <button onclick="deleteRecordFromMap(${r.id})" style="width: 100%; background: #f44336; color: white; border: none; padding: 6px; border-radius: 4px; cursor: pointer; font-weight: bold;">🗑️ Delete</button>
                    </div>
                `;

                shape.bindPopup(popupContent);
                // v535: Enable Grid Interaction for saved geometries
                shape.on('click', (e) => {
                    if (isGridMode && activeGridInterval) {
                        L.DomEvent.stopPropagation(e);
                        map.fire('click', { latlng: e.latlng, originalEvent: e.originalEvent });
                    }
                });

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
                        <!-- v669: Much larger red dot with thick white border -->
                        <div class="red-dot-symbol" style="
                            width:${20 * scaleFactor}px; 
                            height:${20 * scaleFactor}px; 
                            background-color: ${pinColor}; 
                            border-radius: 50%; 
                            border: ${3 * scaleFactor}px solid white; 
                            box-shadow: 0 0 6px rgba(0,0,0,0.6);
                        "></div>
                        <!-- v669: Adjusted label size and position -->
                        <div class="marker-id-label-v3" style="
                            font-size:${labelFontSize * 1.2}px; 
                            padding: 2px ${5 * scaleFactor}px; 
                            top:-${8 * scaleFactor}px; 
                            right:-${10 * scaleFactor}px;
                        ">${labelText}</div>
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
                    <div style="display: flex; gap: 5px;">
                        <button onclick="startRouting(${r.lat}, ${r.lon})" style="flex: 1; background: #2196f3; color: white; border: none; padding: 8px; border-radius: 4px; cursor: pointer; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 5px;">🧭 Rota</button>
                        <button onclick="deleteRecordFromMap(${r.id})" style="background: #f44336; color: white; border: none; padding: 8px; border-radius: 4px; cursor: pointer; font-weight: bold;">🗑️</button>
                    </div>
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

function renderTracks(filter = '') {
    const tableBody = document.getElementById('tracks-body');
    if (!tableBody) return;

    updateTrackCountBadge();

    // v613: Sync Header Visibility for Tracks
    const selectAllTracksTh = document.getElementById('select-all-tracks-th');
    if (selectAllTracksTh) selectAllTracksTh.classList.toggle('locked-hidden', isTracksLocked);

    let displayTracks = jeoTracks;
    if (filter) {
        const q = filter.toLowerCase();
        displayTracks = jeoTracks.filter(t =>
            (t.name && t.name.toLowerCase().includes(q)) ||
            (t.time && t.time.toLowerCase().includes(q))
        );
    }

    if (displayTracks.length === 0 && !trackPath.length) {
        tableBody.innerHTML = `<tr><td colspan="${isTracksLocked ? 5 : 6}">No tracks found</td></tr>`;
        return;
    }

    const sortedTracks = [...displayTracks].sort((a, b) => b.id - a.id);

    let html = "";
    // v467: Display Live Track row if exists
    if (trackPath.length > 0) {
        const liveStartTime = trackStartTime ? new Date(trackStartTime) : new Date();
        const liveName = `Track ${liveStartTime.toLocaleDateString('en-GB')} ${liveStartTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
        html += `
            <tr class="live-track-row" style="background: rgba(76, 175, 80, 0.1);">
                <td class="${isTracksLocked ? 'locked-hidden' : ''}"></td>
                <td style="color: #4caf50; font-weight: bold;">🔴 ${liveName}</td>
                <td style="font-family:monospace;">${Math.round(calculateTrackLength(trackPath))}m</td>
                <td><div class="track-color-dot" style="background: #ff5722;"></div></td>
                <td><input type="checkbox" checked disabled></td>
                <td style="font-size:0.75rem; color:#4caf50; font-weight:bold;">Kayıtta...</td>
            </tr>
        `;
    }

    html += sortedTracks.map(t => `
        <tr data-id="${t.id}">
            <td class="${isTracksLocked ? 'locked-hidden' : ''}"><input type="checkbox" class="track-select" data-id="${t.id}"></td>
            <td onclick="focusTrack(${t.id})">${escapeHTML(t.name)}</td>
            <td style="font-family:monospace;">${Math.round(t.length || 0)}m</td>
            <td><input type="color" value="${t.color || '#ff5722'}" onchange="updateTrackColor(${t.id}, this.value)" class="track-color-dot"></td>
            <td><input type="checkbox" ${t.visible ? 'checked' : ''} onchange="toggleTrackVisibility(${t.id})"></td>
            <td style="font-size:0.7rem; color:#aaa;">${escapeHTML(t.time)}</td>
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
    updateShareButtonState();
    updateLockUI(); // v538: Sync lock icon for points
});

document.getElementById('tab-tracks').addEventListener('click', () => {
    activeTab = 'tracks';
    document.getElementById('tab-tracks').classList.add('active');
    document.getElementById('tab-points').classList.remove('active');
    document.getElementById('container-tracks').style.display = 'block';
    document.getElementById('container-points').style.display = 'none';
    renderTracks();
    updateShareButtonState();
    updateLockUI(); // v538: Sync lock icon for tracks
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
        const query = e.target.value;
        if (activeTab === 'points') {
            renderRecords(query);
        } else {
            renderTracks(query);
        }
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

// Navigation Logic (v574: Optimized & Deduplicated)
const views = document.querySelectorAll('.view-section');
document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const targetBtn = e.target.closest('.nav-item');
        if (!targetBtn) return;

        const targetId = targetBtn.dataset.target;

        // 1. Remove active state from all nav items
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        targetBtn.classList.add('active');

        // 2. Hide all views and show target
        views.forEach(v => v.classList.remove('active'));
        const targetView = document.getElementById(targetId);
        if (targetView) targetView.classList.add('active');

        // v708: Toggle Map Floating Buttons
        const fabContainer = document.querySelector('.map-fab-container');
        if (fabContainer) {
            fabContainer.style.display = (targetId === 'view-map') ? 'flex' : 'none';
        }

        // 3. Security & State Reset
        isMeasuring = false;
        if (typeof updateMeasureModeUI === 'function') updateMeasureModeUI();

        if (!isRecordsLocked) {
            isRecordsLocked = true;
            try {
                if (typeof updateLockUI === 'function') updateLockUI();
                if (typeof renderRecords === 'function') renderRecords();
            } catch (err) { console.error("Lock reset error:", err); }
        }

        // 4. View-specific Logic (Map / Records)
        if (targetId === 'view-map') {
            setTimeout(() => {
                if (typeof initMap === 'function') initMap();
                if (map) map.invalidateSize();
            }, 150); // v574: Slightly increased delay for stability
        }
    });
});

// v710: Ensure Map Buttons visibility is correct on startup
document.addEventListener('DOMContentLoaded', () => {
    const activeView = document.querySelector('.view-section.active');
    const fabContainer = document.querySelector('.map-fab-container');
    if (activeView && fabContainer) {
        fabContainer.style.display = (activeView.id === 'view-map') ? 'flex' : 'none';
    }
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

// v589: Scale Toggle Logic
const btnScaleToggle = document.getElementById('btn-scale-toggle');
if (btnScaleToggle) {
    btnScaleToggle.addEventListener('click', () => {
        const wrapper = document.querySelector('.custom-scale-wrapper');
        if (wrapper) {
            wrapper.classList.toggle('visible');
            const isVisible = wrapper.classList.contains('visible');
            btnScaleToggle.style.backgroundColor = isVisible ? 'rgba(76, 175, 80, 0.8)' : 'rgba(0,0,0,0.7)';

            // v718: Persist visibility state
            localStorage.setItem('jeoScaleVisible', JSON.stringify(isVisible));

            // v1453-05F: MANDATORY RESET on toggle ON
            // Every time the panel is shown, it snaps to orientation-specific CSS defaults
            if (isVisible) {
                wrapper.style.removeProperty('top');
                wrapper.style.removeProperty('left');
                wrapper.style.removeProperty('bottom');
                wrapper.style.removeProperty('right');
                localStorage.removeItem('jeoScalePos_v3');
            }

            // v718: Remove inline display to prevent conflicts with class
            wrapper.style.removeProperty('display');
        }
    });
}

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

        // v546: Memory Guardrails - Avoid browser crashes on massive files
        const sizeMB = file.size / (1024 * 1024);
        if (sizeMB > 50) {
            alert(`Dosya çok büyük (${sizeMB.toFixed(1)}MB). Tarayıcı çökmesini önlemek için 50MB üzerindeki dosyalar engellendi.`);
            fileImportInput.value = '';
            return;
        }
        if (sizeMB > 10 && !confirm(`Dosya boyutu büyük (${sizeMB.toFixed(1)}MB). İşleme sırasında telefonunuz kısa süreli donabilir. Devam etmek istiyor musunuz?`)) {
            fileImportInput.value = '';
            return;
        }

        showLoading(`${file.name} processing...`);
        // v1453-1: Crucial 200ms delay to allow the 'Lütfen Bekleyin' overlay to physically paint 
        // to the screen before the heavy file parsing blocks the main thread (JS Engine).
        await new Promise(r => setTimeout(r, 200));

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
                await saveExternalLayers(); // Persist (Async v543)
                layersModal.classList.remove('active');
            } else {
                alert("No valid KML found.");
            }
        } catch (err) {
            console.error(err);
            alert("File could not be read: " + err.message);
        } finally {
            hideLoading();
            fileImportInput.value = ''; // Reset
        }
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

// v553: Improved Radius Listeners (Robust Dataset Access)
document.querySelectorAll('.radius-opt').forEach(btn => {
    btn.addEventListener('click', function (e) {
        // Use currentTarget to ensure we point to the button even if sub-elements exist
        const target = e.currentTarget;
        const newRadius = parseInt(target.getAttribute('data-radius'));
        if (isNaN(newRadius)) return;

        heatmapRadius = newRadius;
        localStorage.setItem('jeoHeatmapRadius', newRadius); // v563: Persist radius change

        // UI feedback
        document.querySelectorAll('.radius-opt').forEach(ob => ob.classList.remove('active'));
        target.classList.add('active');

        console.log("Heatmap Radius Updated:", heatmapRadius);
        if (isHeatmapActive) updateHeatmap();
    });
});

const elFilter = document.getElementById('heatmap-element-filter');
if (elFilter) {
    elFilter.addEventListener('change', (e) => {
        heatmapFilter = e.target.value;
        localStorage.setItem('jeoHeatmapFilter', heatmapFilter); // v563: Persist filter change
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
        // v1453-29F: Use smooth transition class removal
        if (panel) panel.classList.remove('panel-visible');
        if (heatmapLayer) {
            map.removeLayer(heatmapLayer);
            heatmapLayer = null;
        }
    });
}

/** Grid Feature Logic (v531: Aggressive Jordan Curve Algorithm) **/
function isPointInPolygon(latlng, polygon) {
    if (!polygon || !polygon.getLatLngs) return false;
    let polyPoints = polygon.getLatLngs();

    const flattenPoints = (arr) => {
        if (!Array.isArray(arr)) return [];
        if (arr.length === 0) return [];
        // Leaflet Polygon default: [ [L, L, L] ]
        // Leaflet Polyline: [ L, L, L ]
        if (arr[0] instanceof L.LatLng || (typeof arr[0].lat === 'number' && typeof arr[0].lng === 'number')) return arr;
        if (Array.isArray(arr[0])) return flattenPoints(arr[0]);
        return arr;
    };

    let flatPoints = flattenPoints(polyPoints);
    if (!flatPoints || flatPoints.length < 3) return false;

    const x = latlng.lng, y = latlng.lat;
    let inside = false;
    for (let i = 0, j = flatPoints.length - 1; i < flatPoints.length; j = i++) {
        let pi = flatPoints[i], pj = flatPoints[j];
        // v531: Force numeric extraction for all possible Leaflet/GeoJSON structures
        let xi = (typeof pi.lng === 'number') ? pi.lng : (pi.lng ? pi.lng : pi[1]);
        let yi = (typeof pi.lat === 'number') ? pi.lat : (pi.lat ? pi.lat : pi[0]);
        let xj = (typeof pj.lng === 'number') ? pj.lng : (pj.lng ? pj.lng : pj[1]);
        let yj = (typeof pj.lat === 'number') ? pj.lat : (pj.lat ? pj.lat : pj[0]);

        let intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

// v1453-12: True North (Geographic) Grid Implementation
function createAreaGrid(polygon, interval, color = '#ffeb3b') {
    if (!map || !polygon) return;
    const bounds = polygon.getBounds();
    const sw = bounds.getSouthWest(), ne = bounds.getNorthEast();

    // v1453-12: Use Geographic Coordinates (Lat/Lon) directly for "True North" alignment
    // We need to convert the meter interval into degrees roughly at the center of the polygon
    const centerLat = (sw.lat + ne.lat) / 2;
    const centerLatRad = centerLat * Math.PI / 180;

    // Approximate conversions
    const latDegPerMeter = 1 / 111320;
    const lonDegPerMeter = 1 / (111320 * Math.cos(centerLatRad));

    const latInterval = interval * latDegPerMeter;
    const lonInterval = interval * lonDegPerMeter;

    // Start from a rounded coordinate to align grid globally (not just to bounds)
    const startLat = Math.floor(sw.lat / latInterval) * latInterval;
    const startLon = Math.floor(sw.lng / lonInterval) * lonInterval;

    if (currentGridLayer) map.removeLayer(currentGridLayer);
    currentGridLayer = L.layerGroup();
    const gridLines = [];

    // Sampling for polyline clipping (checks points along the line)
    // We need enough density to detect if a line enters/exits complex polygons
    // For straight lat/lon lines, 2 points are enough IF we cut them properly,
    // but basic "isPointInPolygon" check requires sampling.
    const steps = 100;

    // Vertical Lines (Meridians) - CONSTANT LONGITUDE
    for (let lng = startLon; lng <= ne.lng + lonInterval; lng += lonInterval) {
        let currentSegment = [];
        for (let i = 0; i <= steps; i++) {
            const lat = sw.lat + (ne.lat - sw.lat) * (i / steps);
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

    // Horizontal Lines (Parallels) - CONSTANT LATITUDE
    for (let lat = startLat; lat <= ne.lat + latInterval; lat += latInterval) {
        let currentSegment = [];
        for (let i = 0; i <= steps; i++) {
            const lng = sw.lng + (ne.lng - sw.lng) * (i / steps);
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
        weight: 1.5, // Check visibility
        opacity: 0.8,
        dashArray: '5, 5',
        interactive: false
    }).addTo(currentGridLayer);

    currentGridLayer.addTo(map);
    showToast(`True North Grid: ${interval}m`, 2000);
}

// v743: Draggable Grid Panel
function toggleGridPanel() {
    isGridMode = !isGridMode; // Sync with isGridMode
    const panel = document.getElementById('grid-interval-panel');
    if (panel) {
        panel.style.display = isGridMode ? 'flex' : 'none';

        // v1453-14: Manage .grid-active class for CSS visibility control in Landscape
        if (isGridMode) {
            panel.classList.add('grid-active');
        } else {
            panel.classList.remove('grid-active');
        }
    }
}
function initGridPanelDraggable() {
    const gridPanel = document.getElementById('grid-interval-panel');
    if (!gridPanel) return;

    makeDraggable(gridPanel, 'jeoGridPanelPos');

    const savedPos = localStorage.getItem('jeoGridPanelPos');
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;

    if (savedPos) {
        try {
            const pos = JSON.parse(savedPos);
            const leftNum = parseInt(pos.left);
            const topNum = parseInt(pos.top);

            if (isNaN(leftNum) || isNaN(topNum) || leftNum < 0 || leftNum > viewW - 50 || topNum < 0 || topNum > viewH - 50) {
                // Fallback to center bottom if saved pos is invalid
                gridPanel.style.left = '';
                gridPanel.style.top = '';
                gridPanel.style.bottom = '85px';
                gridPanel.style.transform = ''; // Reset
                gridPanel.style.margin = '0 auto'; // Center via margin
            } else {
                gridPanel.style.position = 'fixed';
                gridPanel.style.left = pos.left;
                gridPanel.style.top = pos.top;
                gridPanel.style.bottom = 'auto'; // Disable bottom
                gridPanel.style.transform = 'none'; // Disable transform to prevent conflict
                gridPanel.style.margin = '0'; // Disable margin centering
            }
        } catch (e) {
            console.warn("Error restoring grid panel pos", e);
        }
    } else {
        // Default: Centered Bottom (Handled by CSS margin: 0 auto currently)
        // No explicit JS needed for default, as CSS handles it.
        // However, if dragged, makeDraggable will set left/top and we need to clear margin/bottom then.
        // makeDraggable implementation (assumed) usually sets left/top style directly.
    }
}
// Init immediately
if (document.readyState !== 'loading') initGridPanelDraggable();
else document.addEventListener('DOMContentLoaded', initGridPanelDraggable);

// Grid UI Listeners
const btnGridToggle = document.getElementById('btn-grid-toggle');
const gridPanel = document.getElementById('grid-interval-panel');
const btnGridClear = document.getElementById('btn-grid-clear');

if (btnGridToggle) {
    btnGridToggle.addEventListener('click', () => {
        isGridMode = !isGridMode;
        btnGridToggle.classList.toggle('active', isGridMode);
        gridPanel.style.display = isGridMode ? 'flex' : 'none';

        // v1453: Synchronize class for landscape positioning
        if (isGridMode) {
            gridPanel.classList.add('grid-active');
        } else {
            gridPanel.classList.remove('grid-active');
        }

        if (isGridMode) {
            // v1453-05F: Reset inline styles to force CSS defaults on toggle
            gridPanel.style.top = '';
            gridPanel.style.left = '';
            gridPanel.style.bottom = '';
            gridPanel.style.right = '';
        }
        localStorage.setItem('jeoGridMode', isGridMode); // v563: Persist toggle

        // v743: If opening and we have a saved position, ensure it's applied (in case CSS reset it)
        if (isGridMode) {
            const savedPos = localStorage.getItem('jeoGridPanelPos');
            if (savedPos) {
                try {
                    const pos = JSON.parse(savedPos);
                    gridPanel.style.position = 'fixed';
                    gridPanel.style.left = pos.left;
                    gridPanel.style.top = pos.top;
                    gridPanel.style.bottom = 'auto';
                    gridPanel.style.margin = '0';
                } catch (e) { }
            }
            showToast("Grid Mode: ON - Select interval and click on a polygon", 3000);
        } else {
            document.querySelectorAll('.grid-opt-btn').forEach(b => b.classList.remove('active'));
            activeGridInterval = null;
        }
    });
}

// v1453-05F: Global Grid Clear Function for HTML onclick
window.clearGridLayer = function (e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    if (currentGridLayer) {
        map.removeLayer(currentGridLayer);
        currentGridLayer = null;
    }
    document.querySelectorAll('.grid-opt-btn').forEach(b => b.classList.remove('active'));
    activeGridInterval = null;
    showToast("Grid Cleared / Izgara Temizlendi", 1500);
}

if (btnGridClear) {
    // Attach listener via JS as well for redundancy
    btnGridClear.addEventListener('click', window.clearGridLayer);
} else {
    // Fallback if not found regularly
    document.addEventListener('DOMContentLoaded', () => {
        const lateBtn = document.getElementById('btn-grid-clear');
        if (lateBtn) {
            lateBtn.addEventListener('click', window.clearGridLayer);
        }
    });
}

document.querySelectorAll('.grid-opt-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const target = e.currentTarget;
        activeGridInterval = parseInt(target.getAttribute('data-interval'));
        localStorage.setItem('jeoGridInterval', activeGridInterval); // v563: Persist interval
        document.querySelectorAll('.grid-opt-btn').forEach(b => b.classList.remove('active'));
        target.classList.add('active');
        showToast(`Interval set: ${activeGridInterval}m. Click an area!`, 2000);
    });
});

// v534: Grid Color Listeners (Updated class name)
document.querySelectorAll('.grid-color-opt').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const target = e.currentTarget;
        activeGridColor = target.getAttribute('data-color');
        localStorage.setItem('jeoGridColor', activeGridColor); // v563: Persist color
        document.querySelectorAll('.grid-color-opt').forEach(b => {
            b.classList.remove('active');
            b.style.border = "1px solid rgba(255,255,255,0.4)"; // Default border
        });
        e.currentTarget.classList.add('active'); // v1453 Fix: Add active class
        e.currentTarget.style.border = "2px solid #fff"; // Active highlight
        showToast("Grid Color Updated", 1000);
    });
});

function addExternalLayer(name, geojson) {
    if (!map) return;
    if (!geojson || !geojson.features) {
        console.error("Invalid GeoJSON for layer:", name);
        return;
    }

    // Default Style: Blue outline, semi-transparent blue fill
    const style = {
        color: '#2196f3',
        weight: 2,
        opacity: 1,
        fillColor: '#2196f3',
        fillOpacity: 0.4 // Default Filled
    };

    const layerElements = new Set(); // v1453-15: Collect elements during parsing

    try {
        const layer = L.geoJSON(geojson, {
            style: style,
            pointToLayer: (feature, latlng) => {
                // v666: Revert to "Old Style" Simple CircleMarker
                // User requested "Eski hali" (Old state) - usually implies simple vector circle
                const marker = L.circleMarker(latlng, {
                    radius: 4, // v677: Reverted to blue dot (radius 4 as requested)
                    fillColor: '#2196f3',
                    color: '#ffffff',
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 1
                });

                marker.isKmlMarker = true; // v545: Flag for fast identification
                marker.jeoLayerId = layerIdCounter; // v545: Fast Parent Lookup
                allKmlMarkers.push(marker);
                return marker;
            },
            onEachFeature: (feature, layer) => {
                const featureName = getFeatureName(feature.properties);

                // v1453-17: Smart Scanning (Pure Data Aggregation)
                // We scan everything: Name, Description, Properties
                // BUT we do NOT change the visual 'featureName' or labels.

                // 1. Scan Name
                if (featureName) {
                    const extracted = extractElements(featureName);
                    extracted.forEach(e => layerElements.add(e));
                }

                // 2. Scan Description/Notes (if available)
                if (feature.properties) {
                    const desc = feature.properties.description || feature.properties.desc || feature.properties.note;
                    if (desc) {
                        const extracted = extractElements(desc);
                        extracted.forEach(e => layerElements.add(e));
                    }
                }

                // v382: Only show labels for Points to prevent clutter on lines/polygons
                if (featureName && feature.geometry.type === 'Point') {
                    layer.bindTooltip(String(featureName), {
                        permanent: true,
                        direction: 'center', // v673: Reverted to 'center' to allow `optimizeMapPoints` 8-way placement logic to work correctly
                        className: 'kml-label',
                        offset: [0, 0], // v673: Let smart placement handle the offset
                        sticky: false
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
                if (feature.geometry && feature.geometry.type === 'Point') {
                    const [lng, lat] = feature.geometry.coordinates;
                    popupContent += `
                        <div style="margin-top:10px; display:flex; gap:5px;">
                            <button onclick="startRouting(${lat}, ${lng})" style="flex:1; background:#2196f3; color:white; border:none; padding:8px; border-radius:4px; cursor:pointer; font-weight:bold; display:flex; align-items:center; justify-content:center; gap:5px;">🧭 Rota</button>
                        </div>`;
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
            labelsVisible: true,
            _jeoElements: layerElements // v1453-15: Store discovered elements
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

    } catch (e) {
        console.error("Critical error in addExternalLayer:", e);
        alert("Katman eklenirken bir hata oluştu: " + e.message);
    }
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
        item.dataset.id = l.id;
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
        // v674: Support CircleMarker (instanceof L.Path with isKmlMarker flag)
        if (layer instanceof L.Marker || layer.isKmlMarker) {
            const tooltip = layer.getTooltip();
            if (tooltip) {
                if (showLabels) {
                    layer.openTooltip();
                    const container = tooltip.getElement();
                    if (container) {
                        container.style.display = '';
                        container.style.opacity = '1';
                        container.style.visibility = 'visible';
                    }
                } else {
                    layer.closeTooltip();
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
        // v674: Support CircleMarker (Vector layers handle visibility via path style or setStyle)
        if (layer instanceof L.Marker || layer.isKmlMarker) {
            if (showPoints) {
                if (layer.setOpacity) layer.setOpacity(1);
                if (layer.setStyle) layer.setStyle({ opacity: 1, fillOpacity: 1 });
            } else {
                if (layer.setOpacity) layer.setOpacity(0);
                if (layer.setStyle) layer.setStyle({ opacity: 0, fillOpacity: 0 });
                if (layer.getTooltip()) layer.closeTooltip();
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
        // v678: Use setStyle for consistent visibility of paths/polygons (non-markers)
        if (layer instanceof L.Path && !(layer instanceof L.Marker || layer.isKmlMarker)) {
            if (showAreas) {
                layer.setStyle({ opacity: 1, fillOpacity: l.filled ? 0.4 : 0 });
            } else {
                layer.setStyle({ opacity: 0, fillOpacity: 0 });
            }
        }
    });
    saveExternalLayers();
}

function removeLayer(id) {
    const index = externalLayers.findIndex(x => x.id === id);
    if (index === -1) return;
    const l = externalLayers[index];

    // v545: Clean up flat marker array
    l.layer.eachLayer(layer => {
        if (layer instanceof L.Marker) {
            allKmlMarkers = allKmlMarkers.filter(m => m !== layer);
        }
    });

    if (map) map.removeLayer(l.layer);
    externalLayers.splice(index, 1);
    saveExternalLayers();
    renderLayerList();
}

async function saveExternalLayers() {
    // v543: Store in IndexedDB to avoid 5MB localStorage limit
    await dbSaveLayers(externalLayers);
    if (isHeatmapActive) updateHeatmapFilterOptions();
}

async function loadExternalLayers(silent = false) {
    // v650: Restored blocking loading screen as per user request
    if (!silent) showLoading("Loading saved layers...");
    try {
        let data = await dbLoadLayers();

        // v543: Legacy fallback to localStorage (migrate once)
        if (data.length === 0) {
            const legacySaved = localStorage.getItem('jeoExternalLayers');
            if (legacySaved) {
                data = JSON.parse(legacySaved);
                console.log("Migrating legacy layers to IndexedDB...");
                await dbSaveLayers(data);
                localStorage.removeItem('jeoExternalLayers');
            }
        }

        for (const d of data) {
            addExternalLayer(d.name, d.geojson);
            const last = externalLayers[externalLayers.length - 1];
            if (last) {
                last.id = d.id; // Ensure ID persistence
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
        }
        renderLayerList();
    } catch (e) {
        console.error("KML loading error:", e);
        showToast("Error loading layers", 3000);
    } finally {
        hideLoading(); // v650: Correctly hide the overlay
        updateHeatmapFilterOptions(); // v1453-15: Ensure list is populated after load
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

            // v734: Center on current GPS position first
            if (map && typeof liveMarker !== 'undefined' && liveMarker) {
                map.setView(liveMarker.getLatLng(), map.getZoom());
            } else if (map && currentCoords && currentCoords.lat !== 0) {
                map.setView([currentCoords.lat, currentCoords.lon], map.getZoom());
            }

            btnAddPoint.classList.add('active-add-point');
            // Show Crosshair and Confirm Button (Reverted v622)
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

        // v534: Disable popup interaction if Grid Mode is active
        measureLine.bindPopup(popupText, { closeButton: true });
        measureLine.on('click', (e) => {
            if (isGridMode && activeGridInterval) {
                L.DomEvent.stopPropagation(e);
                map.fire('click', { latlng: e.latlng, originalEvent: e.originalEvent });
            }
        });
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
    else text = Math.round(totalDistance / 1000) + " km";

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

// Navigation Logic merged into block around line 2660 (v574)

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
            version: JEO_VERSION, // v737: Use dynamic version
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
        const header = ["Label", "Y", "X", "Z", "Strike", "Dip", "Date", "Note"]; // v737: Added Date column
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
      <description>Strike: ${formatStrike(r.strike)}\nDip: ${r.dip}\nNote: ${r.note || ''}</description>
      <Point>
        <coordinates>${r.lon || 0},${r.lat || 0},${r.z || 0}</coordinates>
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
            version: JEO_VERSION, // v737: Use dynamic version
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
        const fileName = `JeoCompass_Backup_${dateStr}.json`;

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
    const fileName = `${(r.label || r.id).replace(/\s+/g, '_')}_${new Date().getTime()}.kml`;
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
            const header = ["Label", "Y", "X", "Z", "Strike", "Dip", "Date", "Note"]; // v737: Added Date column
            const csvRows = [header.join(',')];
            dataToShare.forEach(r => {
                const row = [r.label || r.id, r.y, r.x, r.z, formatStrike(r.strike), r.dip, r.time || '', r.note];
                csvRows.push(row.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','));
            });
            const csvContent = csvRows.join('\n');
            fileName = dataToShare.length === 1 ? `${(dataToShare[0].label || dataToShare[0].id).replace(/\s+/g, '_')}_${timestamp}.csv` : `Selected_${timestamp}.csv`;
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

    // v737: Helper: Generate Multi-Track KML String
    function generateMultiTrackKML(tracksToExport, docName = "JeoCompass Export") {
        let kml = `<?xml version="1" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${docName}</name>`;

        tracksToExport.forEach(t => {
            kml += `
    <Style id="style-${t.id}">
      <LineStyle>
        <color>ff${t.color.substring(5, 7)}${t.color.substring(3, 5)}${t.color.substring(1, 3)}</color>
        <width>4</width>
      </LineStyle>
    </Style>
    <Placemark>
      <name>${t.name}</name>
      <styleUrl>#style-${t.id}</styleUrl>
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
    </Placemark>`;
        });

        kml += `
  </Document>
</kml>`;
        return kml;
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

// v734: About Modal Controls
function initAboutModal() {
    const aboutMod = document.getElementById('about-modal');
    const showBtn = document.getElementById('btn-show-about');
    const closeBtn = document.getElementById('btn-about-close');

    if (showBtn && aboutMod) {
        showBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (typeof optionsModal !== 'undefined' && optionsModal) {
                optionsModal.classList.remove('active');
            }
            aboutMod.classList.add('active');
        });
    }

    if (closeBtn && aboutMod) {
        closeBtn.addEventListener('click', () => {
            aboutMod.classList.remove('active');
        });
    }
}
initAboutModal();

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
    const currentLocked = (activeTab === 'points') ? isRecordsLocked : isTracksLocked;

    if (currentLocked) {
        btnToggleLock.innerHTML = '🔒';
        btnToggleLock.classList.remove('unlocked');
        btnToggleLock.style.backgroundColor = "";
        btnToggleLock.title = 'Unlock';
    } else {
        btnToggleLock.innerHTML = '🔓';
        btnToggleLock.classList.add('unlocked');
        btnToggleLock.style.backgroundColor = "rgba(76, 175, 80, 0.2)";
        btnToggleLock.title = 'Lock';
    }
}

if (btnToggleLock) {
    btnToggleLock.addEventListener('click', () => {
        if (activeTab === 'points') {
            isRecordsLocked = !isRecordsLocked;
            renderRecords();
            if (isRecordsLocked) {
                document.querySelectorAll('.record-select').forEach(cb => cb.checked = false);
                const selectAllRec = document.getElementById('select-all-records');
                if (selectAllRec) selectAllRec.checked = false;
            }
        } else {
            isTracksLocked = !isTracksLocked;
            renderTracks();
            if (isTracksLocked) {
                document.querySelectorAll('.track-select').forEach(cb => cb.checked = false);
                const selectAllTrack = document.getElementById('select-all-tracks');
                if (selectAllTrack) selectAllTrack.checked = false;
            }
        }
        updateLockUI();
        updateShareButtonState();
        showToast((activeTab === 'points' ? "Records " : "Tracks ") +
            ((activeTab === 'points' ? isRecordsLocked : isTracksLocked) ? "Locked" : "Unlocked"), 1000);
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
        updateAppVersionDisplay(); // v1453-04F: Centralized Version Update

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


// v642: Label Stabilization & CSS Cleanup
// v697: Google Maps Native Integration (Internal Navigation Removed)
function startRouting(targetLat, targetLng) {
    if (!targetLat || !targetLng) {
        showToast("Hedef konum geçersiz.", 2000);
        return;
    }
    // Direct link to Google Maps Navigation
    const url = `https://www.google.com/maps/dir/?api=1&destination=${targetLat},${targetLng}&travelmode=driving`;
    window.open(url, '_blank');
}

// v697: Cleaned up unused routing variables and functions
// (L.Routing.control, OSRM_SERVERS, drawDirectRoute, et al. have been removed)

// v700: Duplicate GPS logic removed as per user request. 
// Relying on the original 'liveMarker' system.

function onLocationError(err) {
    console.warn("GPS Error:", err);
}
