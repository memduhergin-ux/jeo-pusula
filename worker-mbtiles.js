/* JeoCompass: MBTiles Background Worker (Phase 3 Research)
   v1453-4-53Ω-Pro: Tier 3 High-Performance Offline Map Storage
   Uses sqlite-wasm with OPFS for near-native performance.
*/

// For research, we use a CDN script. Production should have this local.
self.importScripts('https://cdn.jsdelivr.net/npm/@sqlite.org/sqlite-wasm@3.44.2/sqlite3.js');

let db = null;
let sqlite3 = null;

const init = async () => {
    try {
        console.log("JeoCompass Stealth Disk: Starting SQLite3 Init...");
        const sqlite3Module = await self.sqlite3InitModule();
        sqlite3 = sqlite3Module;
        const { OpfsDb } = sqlite3Module.oo1;

        // Ensure mbtiles directory exists in OPFS
        const root = await navigator.storage.getDirectory();
        await root.getDirectoryHandle('mbtiles', { create: true });

        // Open the mbtiles file. 
        // Note: The file must be copied to OPFS (Tier 3) via the frontend first.
        db = new OpfsDb('/mbtiles/offline-map.mbtiles');
        console.log("JeoCompass Stealth Disk: SQLite/OPFS Initialized.");
        self.postMessage({ type: 'ready' });
    } catch (err) {
        console.error("JeoCompass Stealth Disk: Init Error", err);
        self.postMessage({ type: 'error', error: err.message });
    }
};

self.onmessage = async (e) => {
    const { type, payload } = e.data;

    if (type === 'init') {
        await init();
    } else if (type === 'getMetadata') {
        if (!db) return;
        try {
            const metadata = {};
            db.exec({
                sql: "SELECT name, value FROM metadata",
                callback: (row) => { metadata[row[0]] = row[1]; }
            });
            self.postMessage({ type: 'metadata', payload: metadata });
        } catch (err) {
            console.error("Metadata Fetch Error", err);
            self.postMessage({ type: 'error', error: err.message });
        }
    } else if (type === 'getTile') {
        if (!db) return;
        const { z, x, y } = payload;
        try {
            // MBTiles coordinates vs Leaflet/TMS transformation
            // Standard MBTiles uses TMS (y is flipped): y = (2^z - 1) - y
            const tmsY = (Math.pow(2, z) - 1) - y;

            const rows = [];
            db.exec({
                sql: "SELECT tile_data FROM tiles WHERE zoom_level=? AND tile_column=? AND tile_row=?",
                bind: [z, x, tmsY],
                callback: (row) => rows.push(row[0])
            });

            if (rows.length > 0 && rows[0]) {
                const blob = new Blob([rows[0]], { type: 'image/png' }); // Adjust type if needed
                const url = URL.createObjectURL(blob);
                self.postMessage({ type: 'tileData', payload: { z, x, y, url } });
            } else {
                self.postMessage({ type: 'tileData', payload: { z, x, y, url: null } });
            }
        } catch (err) {
            console.error("Tile Fetch Error", err);
            self.postMessage({ type: 'error', payload: { z, x, y }, error: err.message });
        }
    }
};
