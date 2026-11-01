/**
 * FUEL FINDER SA — CAUTIOUS MASTER IMPORT
 *
 * PREVIEW (READ ONLY): node .\importMasterSafe.js
 * APPLY (ONLY AFTER REVIEW): node .\importMasterSafe.js --apply --confirm=<TOKEN>
 *
 * Default workbook in the same folder: FuelFinder_Master_Firebase_Ready(7).xlsx
 * Optional: --file="another workbook.xlsx"
 * Requires: npm install firebase xlsx
 *
 * This program DOES NOT delete any Firebase records.
 * It uses existing Firestore document IDs for updates, deterministic IDs for additions,
 * and skips possible duplicate or inconsistent rows instead of guessing.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const XLSX = require('xlsx');
const { initializeApp } = require('firebase/app');
const {
  getFirestore, collection, getDocs, doc, writeBatch
} = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'AIzaSyBYDEmEQDEfQb7N7AJpPcrWoaYa6Gks4DU',
  authDomain: 'fuel-finder--sa.firebaseapp.com',
  projectId: 'fuel-finder--sa',
  storageBucket: 'fuel-finder--sa.firebasestorage.app',
  messagingSenderId: '966266239891',
  appId: '1:966266239891:web:dae0f06d6ff00485240666'
};

const argv = process.argv.slice(2);
const isApply = argv.includes('--apply');
const allowSkips = argv.includes('--allow-skips');
const fileArg = argv.find(s => s.startsWith('--file='));
const confirmArg = argv.find(s => s.startsWith('--confirm='));
const excelName = fileArg ? fileArg.slice('--file='.length) : 'FuelFinder_Master_Firebase_Ready(7).xlsx';
const excelPath = path.resolve(process.cwd(), excelName);
const previewPath = path.resolve(process.cwd(), 'import_safe_preview.json');
const conflictsPath = path.resolve(process.cwd(), 'import_safe_conflicts.json');

function sha(data) { return crypto.createHash('sha256').update(data).digest('hex'); }
function str(v) { return (v === null || v === undefined) ? '' : String(v).trim(); }
function key(v) { return str(v).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim(); }
function finiteCoord(v, max) {
  if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null;
  const n = Number(v);
  return Number.isFinite(n) && Math.abs(n) <= max ? n : null;
}
function asDate(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
  }
  const s = str(v).slice(0,10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}
function distanceMeters(a,b) {
  if (a.lat === null || a.lng === null || b.lat === null || b.lng === null) return Infinity;
  const rad = x => x * Math.PI / 180;
  const dlat = rad(b.lat-a.lat), dlng = rad(b.lng-a.lng);
  const t = Math.sin(dlat/2)**2 + Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dlng/2)**2;
  return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(t)));
}
function label(r) { return `${r.name || '?'} — ${r.city || '?'} (${r.sheet || 'Firebase'} row ${r.excelRow || '-'})`; }
function isPotentialDuplicate(a,b) {
  if (a === b) return false;
  if (a.id && b.id && a.id === b.id) return true;
  const an=key(a.name), bn=key(b.name), ac=key(a.city), bc=key(b.city);
  if (!an || !bn) return false;
  const d = distanceMeters(a,b);
  if (Number.isFinite(d)) {
    if (d <= 30) return true; // effectively the same map pin
    if (d <= 250 && an === bn && ac === bc) return true;
    // Rebranded/nearby stations are REVIEWED, not automatically merged
    if (d <= 100 && key(a.brand) === key(b.brand) && ac === bc && key(a.brand)) return true;
    return false; // names matching across a city can be distinct branches
  }
  // When GPS is missing, only an unusually strong text match can trigger review.
  return an === bn && ac === bc && key(a.suburb) && key(a.suburb) === key(b.suburb);
}
function isBlank(v) { return v === null || v === undefined || (typeof v === 'string' && !v.trim()); }
function toPayload(source, forUpdate) {
  const out = {};
  const meta = { pricesHeld: [], falseHeld: [] };
  const reserved = new Set(['id','phoneCheck','parkingRate per 24 hours','updatedAt','sheet','excelRow']);
  const protect = new Set(['featured','verified','claimed']);
  const priceFields = new Set(['diesel50','diesel10ppm','petrol93','petrol95','petrol95coastal','dieselcoastal','lpgGasPrice']);
  const sourceDate = asDate(source.updatedAt);
  // Prices older than 30 days are not published automatically.
  const cutoff = new Date(Date.now()-30*86400000).toISOString().slice(0,10);
  const stalePrice = !sourceDate || sourceDate < cutoff;
  for (const [k,v] of Object.entries(source)) {
    if (reserved.has(k) || protect.has(k) || isBlank(v)) continue;
    if (k === 'website' && str(v).includes('@')) continue; // email is not a website
    if (k === 'depotType' && v === false) continue;
    if (k === 'premiumFuels' && v === false) continue;
    if (priceFields.has(k) && stalePrice) { if (v !== false) meta.pricesHeld.push(k); continue; }
    if (priceFields.has(k) && typeof v === 'boolean') continue;
    if (forUpdate && v === false) { meta.falseHeld.push(k); continue; } // protect live TRUE flags
    if (k === 'dieselAvailable' && v === false && source.type !== 'garage') continue;
    if (k === 'lpgGasPrice' && v === false) continue;
    const val = (k === 'lat' || k === 'lng') ? finiteCoord(v,k==='lat'?90:180) : v;
    if (val === null) continue;
    out[k] = val;
  }
  if (!forUpdate) {
    out.featured = false; out.verified = false; out.claimed = false;
  }
  if (source.type === 'bulkSupplier') {
    out.type = 'bulkSupplier'; out.depotType = 'bulkSupplier';
    out.navigable = false; out.bulkDelivery = true;
    // Business office coordinates may not be a safe route/fuelling destination.
    delete out.lat; delete out.lng;
  } else if (source.type === 'depot') {
    out.type = 'depot'; out.depotType = 'depot'; out.navigable = true;
  } else {
    out.type = 'garage'; out.navigable = true;
  }
  if (sourceDate) out.sourceUpdatedAt = sourceDate;
  if (!forUpdate && source.website && str(source.website).includes('@')) out.contactEmail = str(source.website);
  return { out, meta };
}
function publicSummary(r) {
  return {
    sheet:r.sheet, excelRow:r.excelRow, id:r.id || '', name:r.name,
    brand:r.brand, city:r.city, suburb:r.suburb, lat:r.lat, lng:r.lng, type:r.type
  };
}
function loadWorkbook() {
  if (!fs.existsSync(excelPath)) throw Error('Excel file missing: '+excelPath);
  const bytes = fs.readFileSync(excelPath);
  const wb = XLSX.read(bytes, {type:'buffer'});
  const sheets = ['Stations_Clean','DEPOTS_Clean'];
  const rows=[];
  for(const name of sheets) {
    if(!wb.Sheets[name]) throw Error('Required Excel tab missing: '+name);
    const entries=XLSX.utils.sheet_to_json(wb.Sheets[name], {defval:null, raw:true});
    entries.forEach((entry,i)=>{
      if(!str(entry.name)) return;
      rows.push({...entry, sheet:name, excelRow:i+2, id:str(entry.id),
        name:str(entry.name), brand:str(entry.brand), city:str(entry.city), suburb:str(entry.suburb),
        lat:finiteCoord(entry.lat,90), lng:finiteCoord(entry.lng,180), type:str(entry.type)});
    });
  }
  return {rows, workbookHash:sha(bytes)};
}
async function getFirebaseState(db) {
  const snapshot=await getDocs(collection(db,'stations'));
  const existing=snapshot.docs.map(d=>({ ...d.data(), id:d.id,
    name:str(d.data().name), brand:str(d.data().brand),city:str(d.data().city),
    suburb:str(d.data().suburb), lat:finiteCoord(d.data().lat,90),
    lng:finiteCoord(d.data().lng,180), sheet:'Firebase', excelRow:null }));
  const fingerprint=sha(JSON.stringify(existing.map(r=>[r.id,r.name,r.brand,r.city,r.suburb,r.lat,r.lng]).sort((a,b)=>a[0].localeCompare(b[0]))));
  return {existing,fingerprint};
}
function createPlan(rows, existing) {
  const byId = new Map(existing.map(r=>[r.id,r]));
  const workbookIds=new Set();
  const seenNew=new Map();
  const plan=[];
  for (const r of rows) {
    const problems=[];
    if (r.id) {
      if (workbookIds.has(r.id)) problems.push('Duplicate Firebase ID inside spreadsheet');
      workbookIds.add(r.id);
      if (!byId.has(r.id)) problems.push('Excel Firebase ID not found in live Firebase');
    }
    if (!r.city) problems.push('Missing city');
    if (r.type !== 'bulkSupplier' && (r.lat === null || r.lng === null)) problems.push('No valid coordinates for navigable location');
    if (!['garage','depot','bulkSupplier'].includes(r.type)) problems.push('Unknown type: '+r.type);
    let candidates=[];
    if (!r.id) {
      candidates=existing.filter(e=>isPotentialDuplicate(r,e)).map(e=>({name:e.name,id:e.id,meters:Math.round(distanceMeters(r,e))}));
      if(candidates.length) problems.push('Possible existing Firebase match');
    }
    const deterministicId='ffsa_'+sha([key(r.brand),key(r.name),key(r.city),r.lat,r.lng,r.type].join('|')).slice(0,24);
    if (!r.id && byId.has(deterministicId)) {
      problems.push('Already imported / deterministic document ID already in Firebase');
    }
    const pay=toPayload(r, Boolean(r.id));
    plan.push({r,id:r.id || deterministicId, candidates,problems,payload:pay.out,protected:pay.meta,
      status:problems.length?'SKIP_REVIEW':r.id?'UPDATE':'ADD'});
  }
  // Check new-vs-new and new-vs-updated records in the same workbook.
  for(let i=0;i<plan.length;i++) for(let j=i+1;j<plan.length;j++) {
    const a=plan[i],b=plan[j];
    if(a.r.id && b.r.id && a.r.id !== b.r.id) continue; // two tracked established sites
    if(!isPotentialDuplicate(a.r,b.r)) continue;
    const msgA=`Possible spreadsheet duplicate: ${label(b.r)}`;
    const msgB=`Possible spreadsheet duplicate: ${label(a.r)}`;
    if(!a.r.id && !a.problems.includes(msgA)) a.problems.push(msgA);
    if(!b.r.id && !b.problems.includes(msgB)) b.problems.push(msgB);
    if(!a.r.id) a.status='SKIP_REVIEW';
    if(!b.r.id) b.status='SKIP_REVIEW';
  }
  return plan;
}
async function main() {
  if (!fs.existsSync(excelPath)) throw Error('Cannot find workbook: '+excelPath);
  const {rows,workbookHash}=loadWorkbook();
  console.log(`Reading ${rows.length} Excel entries from ${path.basename(excelPath)} ...`);
  const app=initializeApp(firebaseConfig,'fuelFinderSafeImporter');
  const db=getFirestore(app);
  const {existing,fingerprint}=await getFirebaseState(db);
  const plan=createPlan(rows,existing);
  const counts={UPDATE:0,ADD:0,SKIP_REVIEW:0};
  for(const p of plan) counts[p.status]++;
  const preview={
    createdAt:new Date().toISOString(), file:path.basename(excelPath), workbookSha256:workbookHash,
    firebaseSnapshotFingerprint:fingerprint, firebaseCount:existing.length, excelCount:rows.length,
    counts, token:sha(workbookHash+fingerprint+JSON.stringify(counts)).slice(0,10),
    policy:'Older than 30-day fuel prices excluded; existing FALSE booleans and privileged verified/claimed/featured fields protected; bulk suppliers non-navigable',
    rows:plan.map(p=>({status:p.status,...publicSummary(p.r),firestoreId:p.id,
      matches:p.candidates, problems:p.problems, heldPriceFields:p.protected.pricesHeld,
      heldFalseFields:p.protected.falseHeld}))
  };
  if (!isApply) {
    fs.writeFileSync(previewPath,JSON.stringify(preview,null,2));
    fs.writeFileSync(conflictsPath,JSON.stringify(preview.rows.filter(r=>r.status==='SKIP_REVIEW'),null,2));
    console.log(`Firebase existing: ${existing.length} | Excel: ${rows.length}`);
    console.log(`UPDATE: ${counts.UPDATE} | ADD: ${counts.ADD} | SKIP_REVIEW: ${counts.SKIP_REVIEW}`);
    console.log('Reports: import_safe_preview.json and import_safe_conflicts.json');
    console.log('READ ONLY. No Firebase records changed.');
    console.log(`Safety confirmation token (do NOT use yet): ${preview.token}`);
    return;
  }
  // APPLY IS EXPLICIT, REQUIRES THE CURRENT PREVIEW AND THE SAME WORKBOOK/DB STATE.
  if(!confirmArg) throw Error('APPLY BLOCKED: --confirm=<TOKEN> required after checking preview');
  if(!fs.existsSync(previewPath)) throw Error('APPLY BLOCKED: run preview first');
  const approved=JSON.parse(fs.readFileSync(previewPath,'utf8'));
  if(approved.workbookSha256!==workbookHash || approved.firebaseSnapshotFingerprint!==fingerprint)
    throw Error('APPLY BLOCKED: Workbook/Firebase changed since last preview; rerun preview');
  if(approved.token!==confirmArg.slice('--confirm='.length)) throw Error('APPLY BLOCKED: confirmation token mismatch');
  if(counts.SKIP_REVIEW && !allowSkips)
    throw Error(`APPLY BLOCKED: ${counts.SKIP_REVIEW} records need review. Use --allow-skips only if you explicitly intend to leave those unimported.`);
  const work=plan.filter(p=>p.status!=='SKIP_REVIEW');
  console.log(`APPLY: updating ${counts.UPDATE}, adding ${counts.ADD}, skipping ${counts.SKIP_REVIEW}`);
  let done=0;
  for(let i=0;i<work.length;i+=200) {
    const batch=writeBatch(db);
    for(const p of work.slice(i,i+200)) {
      const ref=doc(db,'stations',p.id);
      if(p.status==='UPDATE') batch.update(ref,p.payload);
      else batch.set(ref,p.payload);
    }
    await batch.commit();
    done+=Math.min(200,work.length-i);
    console.log(`Committed ${done}/${work.length} operations`);
  }
  const log={at:new Date().toISOString(),file:path.basename(excelPath),workbookSha256:workbookHash,counts,committed:done};
  fs.writeFileSync(path.resolve(process.cwd(),'import_safe_applied.json'),JSON.stringify(log,null,2));
  console.log('COMPLETE. Saved import_safe_applied.json. Re-run preview to verify counts.');
}
main().catch(err=>{console.error('IMPORT STOPPED:',err.message);process.exitCode=1;});
