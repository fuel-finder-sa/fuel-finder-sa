"use client";

import FuelMap from "./components/FuelMap";
import BrandBadge, { GARAGE_BRANDS, getBrandInfo } from "./components/BrandBadge";
import { useCallback, useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";

// Homepage: read-only. Does not change any Firebase documents.
// Preserve the Firestore document ID when displaying and linking a station.
type LocationType = "garage" | "depot" | "bulkSupplier";
type ViewType = "all" | LocationType;
type LatLng = { lat: number; lng: number };

export type Station = {
  id: string;
  name: string;
  brand?: string;
  type: LocationType;
  suburb?: string;
  city?: string;
  province?: string;
  phoneNumber?: string;
  lat?: number | null;
  lng?: number | null;
  navigable?: boolean;
  diesel50?: number | null;
  diesel10ppm?: number | null;
  petrol93?: number | null;
  petrol95?: number | null;
  lpgGasPrice?: number | null;
  sourceUpdatedAt?: unknown;
  updatedAt?: unknown;
  truckFriendly?: boolean;
  safeOvernight?: boolean;
  featured?: boolean;
  open24Hours?: boolean;
  atmAvailable?: boolean;
  coffeeShop?: boolean;
  convenienceStore?: boolean;
  toilets?: boolean;
  bathrooms?: boolean;
  washBayTruck?: boolean;
  washBayLight?: boolean;
  evCharging?: boolean;
  lpgGas?: boolean;
  bulkDelivery?: boolean;
};

function normalizeType(value: unknown): LocationType {
  const text = String(value ?? "").toLowerCase().replace(/[\s_-]/g, "");
  if (text === "depot") return "depot";
  if (text === "bulksupplier") return "bulkSupplier";
  return "garage"; // Legacy "station" records remain visible as garages.
}

function validCoordinates(s: Station): LatLng | null {
  const lat = Number(s.lat);
  const lng = Number(s.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (s.lat === null || s.lng === null || s.lat === undefined || s.lng === undefined) return null;
  // Broad South African map bounds; excludes accidentally swapped or zero coordinates.
  if (lat < -35 || lat > -20 || lng < 15 || lng > 35) return null;
  return { lat, lng };
}

function canNavigate(s: Station): boolean {
  return s.type !== "bulkSupplier" && s.navigable !== false && validCoordinates(s) !== null;
}

function dateFromValue(value: unknown): Date | null {
  if (!value) return null;
  let date: Date;
  if (value instanceof Date) date = value;
  else if (typeof value === "string" || typeof value === "number") date = new Date(value);
  else if (typeof value === "object" && value !== null && "toDate" in value && typeof value.toDate === "function") {
    date = value.toDate() as Date;
  } else if (typeof value === "object" && value !== null && "seconds" in value && typeof value.seconds === "number") {
    date = new Date(value.seconds * 1000);
  } else return null;
  return Number.isNaN(date.getTime()) ? null : date;
}

// Only compare prices with an explicit, recent source date; never rank R0.00 as cheapest.
function verifiedDieselPrice(s: Station): number | null {
  if (s.type === "bulkSupplier") return null;
  const value = Number(s.diesel50);
  if (s.diesel50 === null || s.diesel50 === undefined || !Number.isFinite(value) || value <= 0) return null;
  const date = dateFromValue(s.sourceUpdatedAt ?? s.updatedAt);
  if (!date) return null;
  const age = Date.now() - date.getTime();
  if (age < -86400000 || age > 30 * 86400000) return null;
  return value;
}

function displayPrice(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not available";
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? `R${n.toFixed(2)}` : "Not available";
}

function distanceKm(a: LatLng, b: LatLng): number {
  const rad = (x: number) => x * Math.PI / 180;
  const dlat = rad(b.lat - a.lat);
  const dlng = rad(b.lng - a.lng);
  const h = Math.sin(dlat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dlng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function stationLocation(s: Station): string {
  return [s.suburb, s.city, s.province].filter(Boolean).join(", ");
}

function navigateToStation(s: Station): void {
  const gps = validCoordinates(s);
  if (!canNavigate(s) || !gps) return;
  const destination = `${gps.lat},${gps.lng}`;
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`, "_blank", "noopener,noreferrer");
}

export default function Home() {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [province, setProvince] = useState("All Provinces");
  const [brandFilter, setBrandFilter] = useState("all");
  const [locationType, setLocationType] = useState<ViewType>("all");
  const [truckOnly, setTruckOnly] = useState(false);
  const [safeOnly, setSafeOnly] = useState(false);
  const [myLocation, setMyLocation] = useState<LatLng | null>(null);
  const [locationError, setLocationError] = useState("");
  const [mapView, setMapView] = useState(false);
  const [autoMode, setAutoMode] = useState(true);
  const [manualBestStopId, setManualBestStopId] = useState<string | null>(null);

  const loadStations = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const snap = await getDocs(collection(db, "stations"));
      const list: Station[] = snap.docs.map((d) => {
        const raw = d.data();
        return {
          ...raw,
          id: d.id, // Always trust the actual Firestore document ID.
          name: String(raw.name || "Unnamed station"),
          type: normalizeType(raw.type),
        } as Station;
      });
      setStations(list);
    } catch (error) {
      console.error("Cannot load Fuel Finder SA stations:", error);
      setLoadError("Could not load garages from Firebase. Check your internet connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadStations(); }, [loadStations]);

  const provinces = useMemo(() => [
    "All Provinces",
    ...Array.from(new Set(stations.map(s => s.province).filter((p): p is string => Boolean(p)))).sort(),
  ], [stations]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const results = stations.filter(s => {
      if (locationType !== "all" && s.type !== locationType) return false;
      if (province !== "All Provinces" && s.province !== province) return false;
      if (brandFilter !== "all" && (s.type !== "garage" || getBrandInfo(s.brand, s.name, s.type).id !== brandFilter)) return false;
      if (truckOnly && !s.truckFriendly) return false;
      if (safeOnly && !s.safeOvernight) return false;
      if (query && !`${s.name} ${s.brand ?? ""} ${s.suburb ?? ""} ${s.city ?? ""} ${s.province ?? ""}`.toLowerCase().includes(query)) return false;
      return true;
    });
    return results.sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      if (myLocation) {
        const ac = validCoordinates(a), bc = validCoordinates(b);
        const ad = ac ? distanceKm(myLocation, ac) : Infinity;
        const bd = bc ? distanceKm(myLocation, bc) : Infinity;
        if (ad !== bd) return ad - bd;
      }
      return a.name.localeCompare(b.name);
    });
  }, [stations, search, province, brandFilter, locationType, truckOnly, safeOnly, myLocation]);

  const counts = useMemo(() => ({
    all: stations.length,
    garage: stations.filter(s => s.type === "garage").length,
    depot: stations.filter(s => s.type === "depot").length,
    bulkSupplier: stations.filter(s => s.type === "bulkSupplier").length,
  }), [stations]);

  const nearby = useMemo(() => {
    if (!myLocation) return [] as { station: Station; km: number }[];
    return filtered.filter(canNavigate).map(station => ({
      station, km: distanceKm(myLocation, validCoordinates(station)!),
    })).sort((a, b) => a.km - b.km);
  }, [filtered, myLocation]);

  const closest = nearby[0]?.station ?? null;
  const closestDepot = nearby.find(item => item.station.type === "depot")?.station ?? null;
  // "Nearby" has a clear 50 km (straight-line) boundary.
  const pricedNearby = useMemo(() => nearby.filter(item => item.km <= 50 && verifiedDieselPrice(item.station) !== null)
    .sort((a, b) => verifiedDieselPrice(a.station)! - verifiedDieselPrice(b.station)!), [nearby]);
  const topCheapestNearby = pricedNearby.slice(0, 5);
  const cheapestNearby = topCheapestNearby[0]?.station ?? null;

  const recommended = useMemo(() => {
    if (!nearby.length) return null;
    const candidates = nearby.filter(item => item.km <= 100);
    if (!candidates.length) return nearby[0].station;
    const priced = candidates.filter(item => verifiedDieselPrice(item.station) !== null);
    if (!priced.length) return candidates[0].station; // nearest when no reliable price exists
    const minPrice = Math.min(...priced.map(item => verifiedDieselPrice(item.station)!));
    // R1 difference corresponds to ~8 km in the score; indicative, not a fuel-saving guarantee.
    priced.sort((a, b) => (a.km + 8 * (verifiedDieselPrice(a.station)! - minPrice)) -
      (b.km + 8 * (verifiedDieselPrice(b.station)! - minPrice)));
    return priced[0].station;
  }, [nearby]);

  const bestStop = autoMode ? recommended : (filtered.find(s => s.id === manualBestStopId) ?? null);

  function requestLocation() {
    setLocationError("");
    if (!navigator.geolocation) {
      setLocationError("Location is not available in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setLocationError("Location permission denied or unavailable. You can still search by town or province."),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }

  function selectBestStop() {
    if (!myLocation) { requestLocation(); return; }
    if (!recommended) { window.alert("No navigable fuel stop is available in the selected results."); return; }
    setManualBestStopId(recommended.id);
    setAutoMode(false);
    setMapView(true);
  }

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <h1 style={styles.title}>Fuel Finder SA</h1>
        <p style={styles.subtitle}>Find garages, diesel depots and fuel services across South Africa.</p>
      </section>

      <div style={styles.countBox}>
        <span>All: {counts.all}</span><span>Garages: {counts.garage}</span>
        <span>Depots: {counts.depot}</span><span>Bulk suppliers: {counts.bulkSupplier}</span>
      </div>
      {loading && <p role="status">Loading stations from Firebase…</p>}
      {loadError && <div role="alert" style={styles.warning}>{loadError} <button onClick={() => void loadStations()}>Retry</button></div>}

      <div style={styles.toggleRow}>
        {([
          ["all", "All"], ["garage", "Garages"], ["depot", "Depots"], ["bulkSupplier", "Bulk suppliers"],
        ] as const).map(([value, label]) => (
          <button key={value} onClick={() => { setLocationType(value); if (value === "depot" || value === "bulkSupplier") setBrandFilter("all"); }} style={locationType === value ? styles.activeToggle : styles.toggle}>{label}</button>
        ))}
      </div>
      <div style={styles.toggleRow}>
        <button onClick={() => setTruckOnly(v => !v)} aria-pressed={truckOnly} style={truckOnly ? styles.activeToggle : styles.toggle}>🚚 Truck Friendly</button>
        <button onClick={() => setSafeOnly(v => !v)} aria-pressed={safeOnly} style={safeOnly ? styles.activeToggle : styles.toggle}>🌙 Safe Overnight</button>
        <button onClick={() => setMapView(v => !v)} aria-pressed={mapView} style={mapView ? styles.activeToggle : styles.toggle}>🗺 {mapView ? "Hide Map" : "Show Map"}</button>
      </div>
      <input aria-label="Search stations" placeholder="Search garage, town, suburb or brand…" value={search} onChange={e => setSearch(e.target.value)} style={styles.input} />
      <select aria-label="Choose province" value={province} onChange={e => setProvince(e.target.value)} style={styles.input}>
        {provinces.map(p => <option key={p} value={p}>{p}</option>)}
      </select>
      {(locationType === "all" || locationType === "garage") && <select
        aria-label="Choose garage brand" value={brandFilter} onChange={e => setBrandFilter(e.target.value)} style={styles.input}
      >
        <option value="all">All Garage Brands</option>
        {GARAGE_BRANDS.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
      </select>}
      <p style={styles.small}>Showing {filtered.length} results. Bulk suppliers are listed for enquiries only and are not mapped as fuel stops.</p>

      <FuelMap mapView={mapView} myLocation={myLocation} filtered={filtered} bestStop={bestStop} />

      <div style={styles.summaryBar}>
        <button style={styles.locationBtn} onClick={requestLocation}>📍 Use My Location</button>
        {locationError && <p role="alert" style={styles.warning}>{locationError}</p>}
        <button style={styles.locationBtn} onClick={selectBestStop}>🧠 Find Best Stop</button>
        <button style={autoMode ? styles.activeToggle : styles.toggle} onClick={() => setAutoMode(v => !v)}>Auto Mode: {autoMode ? "ON" : "OFF"}</button>
        <p>📍 Closest: {closest ? `${closest.name} (${stationLocation(closest)})` : "Enable location"}</p>
        <p>🛢 Closest depot: {closestDepot ? closestDepot.name : "None nearby / enable location"}</p>
        <p>💰 Cheapest verified diesel within 50 km: {cheapestNearby ? `${cheapestNearby.name} — ${displayPrice(verifiedDieselPrice(cheapestNearby))}` : "No recently verified prices available"}</p>
        <p>🧠 Recommended: {bestStop ? bestStop.name : "Enable location to calculate"}</p>
        <p style={styles.small}>Distances are straight-line estimates, not driving distance. Best Stop considers distance and recently verified diesel prices when available.</p>
        {closestDepot && <button style={styles.greenBtn} onClick={() => navigateToStation(closestDepot)}>Navigate to Closest Depot</button>}
        {cheapestNearby && <button style={styles.greenBtn} onClick={() => navigateToStation(cheapestNearby)}>Navigate to Cheapest Verified Diesel</button>}
      </div>

      {myLocation && <section style={styles.card}>
        <h2>🏆 Top 5 Cheapest Verified Diesel Within 50 km</h2>
        {topCheapestNearby.length ? topCheapestNearby.map(({ station, km }, index) => (
          <div key={station.id} style={styles.priceRow}>
            <span>{index + 1}. {station.name} — {displayPrice(verifiedDieselPrice(station))} · {km.toFixed(1)} km</span>
            <button style={styles.greenBtn} onClick={() => navigateToStation(station)}>Navigate</button>
          </div>
        )) : <p>No stations with a recently verified diesel price in this area.</p>}
      </section>}

      {filtered.map(s => {
        const gps = validCoordinates(s);
        const km = myLocation && gps ? distanceKm(myLocation, gps) : null;
        const diesel = verifiedDieselPrice(s);
        const hasDiesel = s.diesel50 !== null && s.diesel50 !== undefined && Number(s.diesel50) > 0;
        return (
          <section key={s.id} style={bestStop?.id === s.id ? styles.bestCard : s.featured ? styles.featuredCard : styles.card}>
            <div style={styles.cardTop}>
              <div>
                {bestStop?.id === s.id && <span style={styles.bestBadge}>🧠 BEST STOP</span>}
                {s.featured && <span style={styles.featuredBadge}>⭐ FEATURED</span>}
                <div style={styles.brandHeading}><BrandBadge brand={s.brand} name={s.name} type={s.type} /><h2 style={styles.stationName}>{s.name}</h2></div>
                <p style={styles.suburb}>{stationLocation(s) || "Location not provided"}</p>
                {km !== null && <p style={styles.distanceText}>📍 {km.toFixed(1)} km straight-line</p>}
              </div>
              <span style={s.type === "depot" ? styles.depotBadge : styles.garageBadge}>
                {s.type === "bulkSupplier" ? "Bulk Supplier" : s.type === "depot" ? "Diesel Depot" : "Garage"}
              </span>
            </div>
            <div style={styles.priceBox}>
              {s.type === "bulkSupplier" ? <p>Bulk supply enquiries — not a public refuelling location.</p> : <>
                <p style={styles.priceMain}>⛽ Diesel 50: {hasDiesel ? displayPrice(s.diesel50) : "Price not available"}</p>
                {hasDiesel && diesel === null && <p style={styles.warning}>Price not recently verified — confirm with station before travelling.</p>}
                {s.type !== "depot" && <><p>Petrol 93: {displayPrice(s.petrol93)}</p><p>Petrol 95: {displayPrice(s.petrol95)}</p></>}
                {s.type === "depot" && <p style={styles.depotNote}>🛢 Diesel depot — petrol not listed</p>}
                {Number(s.lpgGasPrice) > 0 && <p>🔥 LPG price: {displayPrice(s.lpgGasPrice)}</p>}
              </>}
            </div>
            <div style={styles.amenities}>
              {s.truckFriendly && <span style={styles.amenity}>🚚 Truck Friendly</span>}
              {s.safeOvernight && <span style={styles.amenity}>🌙 Safe Overnight</span>}
              {s.open24Hours && <span style={styles.amenity}>🕒 Open 24h</span>}
              {s.atmAvailable && <span style={styles.amenity}>🏧 ATM</span>}
              {s.coffeeShop && <span style={styles.amenity}>☕ Coffee</span>}
              {s.convenienceStore && <span style={styles.amenity}>🏪 Store</span>}
              {(s.toilets || s.bathrooms) && <span style={styles.amenity}>🚻 Toilets</span>}
              {s.washBayTruck && <span style={styles.amenity}>🚚 Truck Wash</span>}
              {s.washBayLight && <span style={styles.amenity}>🚗 Car Wash</span>}
              {s.evCharging && <span style={styles.amenity}>⚡ EV Charging</span>}
              {s.lpgGas && <span style={styles.amenity}>🔥 LPG Available</span>}
              {s.bulkDelivery && <span style={styles.amenity}>🚛 Bulk Delivery</span>}
            </div>
            <div style={styles.actions}>
              {canNavigate(s) && <button onClick={() => navigateToStation(s)} style={styles.greenBtn}>Navigate</button>}
              <button style={styles.darkBtn} onClick={() => {
                if (!s.phoneNumber) { window.alert("No telephone number listed for this station."); return; }
                window.location.href = `tel:${s.phoneNumber}`;
              }}>Call</button>
              <button style={styles.darkBtn} onClick={() => { window.location.href = `/owner?stationId=${encodeURIComponent(s.id)}&stationName=${encodeURIComponent(s.name)}`; }}>🏢 Claim</button>
              <button style={styles.darkBtn} onClick={() => { window.location.href = `/report?stationId=${encodeURIComponent(s.id)}&stationName=${encodeURIComponent(s.name)}`; }}>🚫 Report</button>
            </div>
          </section>
        );
      })}
      {!loading && !loadError && filtered.length === 0 && <p>No matching stations. Try clearing one of the filters.</p>}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: 20, fontFamily: "Arial, sans-serif", background: "#eef3f8", minHeight: "100vh" },
  hero: { background: "#142033", color: "white", padding: 28, borderRadius: 24, marginBottom: 16 },
  title: { fontSize: 38, margin: 0 },
  subtitle: { marginTop: 8, color: "#cbd5e1" },
  countBox: { display: "flex", gap: 20, marginBottom: 14, color: "#475569", fontWeight: "bold", flexWrap: "wrap" },
  toggleRow: { display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" },
  toggle: { flex: "1 1 130px", padding: 14, borderRadius: 14, border: "none", background: "#dbe4ee", fontWeight: "bold", cursor: "pointer" },
  activeToggle: { flex: "1 1 130px", padding: 14, borderRadius: 14, border: "none", background: "#22c55e", color: "white", fontWeight: "bold", cursor: "pointer" },
  input: { width: "100%", padding: 15, borderRadius: 14, border: "1px solid #cbd5e1", marginBottom: 12, fontSize: 16, boxSizing: "border-box" },
  card: { background: "white", padding: 20, borderRadius: 20, marginBottom: 16, boxShadow: "0 6px 18px rgba(15,23,42,.08)" },
  bestCard: { background: "#ecfdf5", padding: 20, borderRadius: 20, marginBottom: 16, border: "2px solid #22c55e" },
  featuredCard: { background: "#fffbeb", padding: 20, borderRadius: 20, marginBottom: 16, border: "2px solid #f59e0b" },
  cardTop: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" },
  stationName: { margin: "0" },
  brandHeading: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", margin: "10px 0 4px" },
  suburb: { color: "#64748b", margin: 0 },
  bestBadge: { background: "#22c55e", color: "white", padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: "bold" },
  featuredBadge: { background: "#f59e0b", color: "white", padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: "bold" },
  garageBadge: { background: "#dbeafe", color: "#1e40af", padding: "8px 10px", borderRadius: 999, fontSize: 12, fontWeight: "bold" },
  depotBadge: { background: "#fee2e2", color: "#991b1b", padding: "8px 10px", borderRadius: 999, fontSize: 12, fontWeight: "bold" },
  priceBox: { background: "#f8fafc", padding: 14, borderRadius: 14, marginTop: 14 },
  priceMain: { fontSize: 18, fontWeight: "bold", marginTop: 0 },
  depotNote: { color: "#991b1b", fontWeight: "bold" },
  amenities: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 },
  amenity: { background: "#e2e8f0", padding: "7px 10px", borderRadius: 999, fontSize: 13, fontWeight: "bold" },
  actions: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 },
  greenBtn: { background: "#22c55e", color: "white", padding: "10px 14px", borderRadius: 10, border: "none", fontWeight: "bold", cursor: "pointer" },
  darkBtn: { background: "#142033", color: "white", padding: "10px 14px", borderRadius: 10, border: "none", fontWeight: "bold", cursor: "pointer" },
  locationBtn: { background: "#0ea5e9", color: "white", padding: 12, borderRadius: 12, border: "none", marginRight: 10, fontWeight: "bold", cursor: "pointer" },
  distanceText: { color: "#0284c7", fontWeight: "bold" },
  small: { color: "#64748b", fontSize: 13 },
  warning: { color: "#92400e", fontSize: 13 },
  summaryBar: { padding: 15, background: "white", borderRadius: 16, marginBottom: 16 },
  priceRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: 8, borderBottom: "1px solid #e2e8f0", flexWrap: "wrap" },
};
