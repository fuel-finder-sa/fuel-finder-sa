// Fuel Finder SA: READ-ONLY master import preview. This script NEVER writes to Firebase.
// Run: npm install xlsx   (once), then node importMaster.js
const XLSX = require('xlsx');
const { initializeApp, getApps, getApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');
const firebaseConfig = {
  apiKey: 'AIzaSyBYDEmEQDEfQb7N7AJpPcrWoaYa6Gks4DU',
  authDomain: 'fuel-finder--sa.firebaseapp.com',
  projectId: 'fuel-finder--sa',
  storageBucket: 'fuel-finder--sa.firebasestorage.app',
  messagingSenderId: '966266239891',
  appId: '1:966266239891:web:dae0f06d6ff00485240666'
};
const db = getFirestore(getApps().length ? getApp() : initializeApp(firebaseConfig));
const file = path.join(__dirname, 'FuelFinder_Master_Firebase_Ready(7).xlsx');
const norm = v => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const key = s => [norm(s.name), norm(s.city), norm(s.suburb)].join('|');
const coords = s => {
  const a = Number(s.lat), b = Number(s.lng);
  return s.lat !== '' && s.lng !== '' && s.lat != null && s.lng != null && Number.isFinite(a) && Number.isFinite(b) ? `${a.toFixed(4)}|${b.toFixed(4)}` : '';
};
async function main() {
  if (!fs.existsSync(file)) throw new Error('Excel file not found in project folder: ' + file);
  const wb = XLSX.readFile(file);
  const rows = ['Stations_Clean', 'DEPOTS_Clean'].flatMap(sheet => {
    if (!wb.Sheets[sheet]) throw new Error('Missing worksheet: ' + sheet);
    return XLSX.utils.sheet_to_json(wb.Sheets[sheet], { defval: '', raw: true }).map((data, i) => ({ sheet, excelRow: i + 2, data }));
  });
  console.log(`Reading ${rows.length} Excel records. Fetching existing Firebase stations (READ ONLY)...`);
  const snap = await getDocs(collection(db, 'stations'));
  const existing = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const byId = new Map(existing.map(s => [s.id, s]));
  const byKey = new Map(), byCoords = new Map();
  for (const s of existing) {
    if (norm(s.name)) { const k = key(s); byKey.set(k, [...(byKey.get(k) || []), s.id]); }
    if (coords(s)) { const k = coords(s); byCoords.set(k, [...(byCoords.get(k) || []), s.id]); }
  }
  const seenIds = new Set(), seenKeys = new Set();
  const report = rows.map(({sheet, excelRow, data}) => {
    const id = String(data.id ?? '').trim();
    const k = key(data), c = coords(data);
    let status, detail = '';
    if (!norm(data.name)) { status = 'REVIEW'; detail = 'Missing name'; }
    else if (id && seenIds.has(id)) { status = 'REVIEW'; detail = 'Repeated Firebase ID in Excel'; }
    else if (seenKeys.has(k)) { status = 'REVIEW'; detail = 'Repeated name/city/suburb in Excel'; }
    else if (id && !byId.has(id)) { status = 'REVIEW'; detail = 'Excel ID not found in Firebase'; }
    else if (id) { status = 'UPDATE_CANDIDATE'; detail = 'Matching Firebase document ID'; }
    else {
      const matches = new Set([...(byKey.get(k) || []), ...(c ? byCoords.get(c) || [] : [])]);
      if (matches.size) { status = 'REVIEW'; detail = 'Possible existing station: ' + [...matches].join(', '); }
      else { status = 'NEW_CANDIDATE'; detail = 'No exact name/location or coordinate match'; }
    }
    if (id) seenIds.add(id);
    seenKeys.add(k);
    return { sheet, excelRow, id, name: data.name, city: data.city, suburb: data.suburb, status, detail };
  });
  const counts = report.reduce((a,r) => (a[r.status] = (a[r.status] || 0) + 1, a), {});
  fs.writeFileSync(path.join(__dirname, 'import_preview.json'), JSON.stringify({ firebaseCount: existing.length, excelCount: rows.length, counts, report }, null, 2));
  console.log('Existing Firebase records:', existing.length);
  console.log('Excel records:', rows.length);
  console.log('Preview:', counts);
  console.log('Saved import_preview.json. NO Firebase records were changed.');
  console.log('Note: NEW_CANDIDATE does not guarantee no duplicate; review before any upload.');
}
main().catch(e => { console.error('Preview failed:', e.message); process.exitCode = 1; });
