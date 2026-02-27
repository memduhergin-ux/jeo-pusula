$lines = Get-Content "c:\Users\memdu\Contacts\JeolojiPusulasi\app.js" -Encoding UTF8
$startIdx = -1
$endIdx = -1

for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "^\s*function processFileData\(rows\) \{") {
        $startIdx = $i
    }
    if ($startIdx -ne -1 -and $i -gt $startIdx -and $lines[$i] -match "^\s*showFilePreview\(\);\s*$") {
        # The function ends at the next line "    }"
        $endIdx = $i + 1
        break
    }
}

if ($startIdx -ne -1 -and $endIdx -ne -1) {
    Write-Host "Found function from line $($startIdx+1) to $($endIdx+1). Replacing..."
    $newFunc = @'
    function processFileData(rows) {
        if (!rows || rows.length === 0) return;
        const fmt = formatSel ? formatSel.value : 'utm';
        parsedRows = [];
        rows.forEach((row, idx) => {
            // Trim keys for reliable exact matching
            const keys = Object.keys(row).map(k => ({ k, kl: String(k).toLowerCase().trim() }));

            // Robust find function evaluating exact, prefixed, then substring matches
            const find = (...names) => {
                let m = keys.find(({ kl }) => names.includes(kl));
                if (!m) m = keys.find(({ kl }) => names.some(n => kl.startsWith(n + ' ') || kl.startsWith(n + '(') || kl.startsWith(n + '_')));
                if (!m) m = keys.find(({ kl }) => names.some(n => n.length > 2 && kl.includes(n)));
                return m ? row[m.k] : undefined;
            };

            // Fallback for Netcad Standard Excel Structure: 
            // 0: Nokta Adi, 1: Y Kolonu, 2: X Kolonu, 3: Z Kolonu
            const getVal = (index) => keys.length > index ? row[keys[index].k] : undefined;
            
            let lat, lng;
            
            let labelVal = find('label', 'nokta', 'ad', 'name', 'id', 'noktano');
            if (labelVal === undefined) labelVal = getVal(0);
            const label = String(labelVal || `P${idx + 1}`);

            let zVal = find('z', 'rakım', 'rakm', 'kot', 'alt', 'elev', 'elevation');
            if (zVal === undefined) zVal = getVal(3);
            const Z = parseFloat(zVal) || 0;

            const Note = String(find('note', 'not', 'açıklama', 'aciklama', 'desc', 'description') || '').trim();

            if (fmt === 'utm') {
                let yVal = find('y', 'e', 'east', 'easting', 'doğu', 'dogu', 'sağa', 'saga');
                if (yVal === undefined) yVal = getVal(1);

                let xVal = find('x', 'n', 'north', 'northing', 'kuzey', 'yukarı', 'yukari');
                if (xVal === undefined) xVal = getVal(2);
                
                const Y = parseFloat(yVal);
                const X = parseFloat(xVal);

                let zone = parseInt(zoneInput ? zoneInput.value : 0) || parseInt(find('zone', 'zon', 'dilim')) || 0;
                if (!zone && !isNaN(Y)) zone = autoZoneFromE(Y);
                const datum = datumSel ? datumSel.value : 'ed50';

                if (!isNaN(Y) && !isNaN(X) && zone) {
                    const ll = utmToLatLng(Y, X, zone, datum);
                    lat = ll.lat; lng = ll.lng;
                    parsedRows.push({ lat, lng, label, origY: Y, origX: X, origZ: Z, zone, fmt, note: Note });
                }
            } else {
                let latVal = find('lat', 'latitude', 'enlem', 'y');
                if (latVal === undefined) latVal = getVal(1);

                let lngVal = find('lon', 'lng', 'longitude', 'boylam', 'x');
                if (lngVal === undefined) lngVal = getVal(2);

                lat = parseFloat(latVal);
                lng = parseFloat(lngVal);

                if (!isNaN(lat) && !isNaN(lng)) {
                    parsedRows.push({ lat, lng, label, origY: lat, origX: lng, origZ: Z, zone: 0, fmt, note: Note });
                }
            }
        });
        showFilePreview();
    }
'@

    $newFuncLines = $newFunc -split "`n"
    # Remove the carriage return character if present
    $newFuncLines = $newFuncLines | ForEach-Object { $_.TrimEnd("`r") }

    $before = $lines[0..($startIdx - 1)]
    $after = $lines[($endIdx + 1)..($lines.Count - 1)]

    $newContent = $before + $newFuncLines + $after
    $newContent | Set-Content "c:\Users\memdu\Contacts\JeolojiPusulasi\app.js" -Encoding UTF8
    Write-Host "Replaced successfully."
} else {
    Write-Host "Could not find the function boundaries."
}
