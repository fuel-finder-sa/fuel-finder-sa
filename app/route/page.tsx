"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase";
import RouteMap from "./RouteMap";

type Point = { lat: number; lng: number };
type Station = {
  id: string;
  name: string;
  brand?: string;
  type: "garage" | "depot" | "bulkSupplier";
  city?: string;
  suburb?: string;
  lat: number;
  lng: number;
  diesel50: number | null;
  priceUpdatedAt?: unknown;
  truckFriendly?: boolean;
  navigable?: boolean;
};
export type RouteStop = Station & { distanceFromRouteKm: number };

type DetourResult =
  | { ok: true; viaKm: number; viaMinutes: number; extraKm: number; extraMinutes: number }
  | { ok: false; message: string };

type RouteInfo = {
  from: Point;
  to: Point;
  polyline: Point[];
  distanceKm: number;
  durationMin: number;
};

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: { country?: string; countrycode?: string; name?: string };
};

function validPoint(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -35 && lat <= -20 && lng >= 15 && lng <= 35;
}

function asBool(v: unknown): boolean {
  return v === true || String(v).toLowerCase() === "true";
}

function stationType(v: unknown): Station["type"] {
  const normalized = String(v ?? "garage").toLowerCase().replace(/[\s_-]/g, "");
  return normalized === "bulksupplier" ? "bulkSupplier" : normalized === "depot" ? "depot" : "garage";
}

function parseDate(v: unknown): Date | null {
  if (!v) return null;
  let date: Date;
  if (typeof v === "string" || typeof v === "number") date = new Date(v);
  else if (typeof v === "object" && v !== null && "toDate" in v && typeof v.toDate === "function") date = v.toDate() as Date;
  else if (typeof v === "object" && v !== null && "seconds" in v && typeof v.seconds === "number") date = new Date(v.seconds * 1000);
  else return null;
  return Number.isNaN(date.getTime()) ? null : date;
}

function freshPrice(s: Station): number | null {
  const p = s.diesel50;
  if (p === null || !Number.isFinite(p) || p <= 0) return null;
  // A database import timestamp is NOT evidence that a diesel price was checked.
  const date = parseDate(s.priceUpdatedAt);
  if (!date) return null;
  const days = (Date.now() - date.getTime()) / 86400000;
  return days >= 0 && days <= 30 ? p : null;
}

// Find a place in South Africa only. For this prototype, Photon is a public demo geocoder.
async function findPoint(place: string): Promise<Point> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(place + ", South Africa")}&bbox=15,-35,35,-20&limit=8`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Place search is unavailable. Please try again.");
  const result = await response.json() as { features?: PhotonFeature[] };
  for (const feature of result.features ?? []) {
    const coordinates = feature.geometry?.coordinates;
    if (!coordinates) continue;
    const [lng, lat] = coordinates;
    if (!validPoint(lat, lng)) continue;
    const country = (feature.properties?.country ?? "").toLowerCase();
    const code = (feature.properties?.countrycode ?? "").toLowerCase();
    if (country && !country.includes("south africa") && code !== "za") continue;
    return { lat, lng };
  }
  throw new Error(`Could not find a South African location for "${place}". Try a town and province.`);
}

async function calculateRoute(start: Point, end: Point): Promise<RouteInfo> {
  // Public OSRM demo is for testing only, not production/truck navigation.
  const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson&steps=false`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Routing service is temporarily unavailable.");
  const data = await response.json() as {
    code?: string;
    routes?: Array<{ distance: number; duration: number; geometry?: { coordinates?: [number, number][] } }>;
  };
  const route = data.routes?.[0];
  if (data.code !== "Ok" || !route?.geometry?.coordinates?.length) {
    throw new Error("No drivable route was found between these locations.");
  }
  return {
    from: start,
    to: end,
    distanceKm: route.distance / 1000,
    durationMin: route.duration / 60,
    polyline: route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
  };
}

// Calculate a *driving-route difference*: start -> selected fuel stop -> destination
// versus the already calculated start -> destination route. This checks the road
// network (not a straight line) but is still only a car-route test, NOT truck-safe.
async function calculateStopDetour(route: RouteInfo, stop: RouteStop): Promise<DetourResult> {
  const coordinates = [route.from, { lat: stop.lat, lng: stop.lng }, route.to]
    .map(p => `${p.lng},${p.lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=false&steps=false`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Road routing service is unavailable. Try again later.");
  const data = await response.json() as {
    code?: string;
    routes?: Array<{ distance: number; duration: number }>;
    waypoints?: Array<{ distance?: number }>;
  };
  const via = data.routes?.[0];
  if (data.code !== "Ok" || !via || !Number.isFinite(via.distance) || !Number.isFinite(via.duration)) {
    throw new Error("No usable driving route could be found via this station.");
  }
  const snapDistance = data.waypoints?.[1]?.distance;
  if (typeof snapDistance !== "number" || !Number.isFinite(snapDistance) || snapDistance > 400) {
    throw new Error("Station GPS is too far from a mapped drivable road. Check its coordinates.");
  }
  const viaKm = via.distance / 1000;
  const viaMinutes = via.duration / 60;
  return {
    ok: true,
    viaKm,
    viaMinutes,
    extraKm: viaKm - route.distanceKm,
    extraMinutes: viaMinutes - route.durationMin,
  };
}

function signedDifference(n: number, digits = 1): string {
  const value = Math.abs(n) < Math.pow(10, -digits) / 2 ? 0 : n;
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(digits)}`;
}

// Approximate shortest straight-line separation from a station to a road-route segment.
// This is NOT the extra driving distance required to leave and rejoin the route.
function distanceToRouteKm(station: Point, line: Point[]): number {
  const scaleX = 111.32 * Math.cos(station.lat * Math.PI / 180);
  const scaleY = 111.32;
  let minimum = Infinity;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i];
    const ax = (a.lng - station.lng) * scaleX;
    const ay = (a.lat - station.lat) * scaleY;
    const bx = (b.lng - station.lng) * scaleX;
    const by = (b.lat - station.lat) * scaleY;
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
    const distance = Math.hypot(ax + t * dx, ay + t * dy);
    minimum = Math.min(minimum, distance);
  }
  return minimum;
}

function directionsUrl(r: RouteInfo, stop?: RouteStop): string {
  const origin = `${r.from.lat},${r.from.lng}`;
  const destination = `${r.to.lat},${r.to.lng}`;
  const waypoints = stop ? `&waypoints=${encodeURIComponent(`${stop.lat},${stop.lng}`)}` : "";
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}${waypoints}&travelmode=driving`;
}

export default function RoutePlannerPage() {
  const [startText, setStartText] = useState("Springs, Gauteng");
  const [endText, setEndText] = useState("Durban, KwaZulu-Natal");
  const [startGps, setStartGps] = useState<Point | null>(null);
  const [endGps, setEndGps] = useState<Point | null>(null);
  const [activeDirection, setActiveDirection] = useState<{ from: string; to: string } | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [radius, setRadius] = useState(10);
  const [category, setCategory] = useState("all");
  const [truckOnly, setTruckOnly] = useState(false);
  const [sort, setSort] = useState("route");
  const [status, setStatus] = useState("Loading fuel stations...");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [detours, setDetours] = useState<Record<string, DetourResult>>({});
  const [checkingStopId, setCheckingStopId] = useState<string | null>(null);
  // Ignore results from requests started for a previous route.
  const routeVersion = useRef(0);
  // The public test router asks users not to exceed one request per second.
  const nextRoutingRequestAt = useRef(0);

  async function reserveDemoRouterSlot() {
    const delay = Math.max(0, nextRoutingRequestAt.current - Date.now());
    nextRoutingRequestAt.current = Date.now() + delay + 1200;
    if (delay) await new Promise<void>(resolve => setTimeout(resolve, delay));
  }

  function invalidateRoute() {
    routeVersion.current += 1;
    setRoute(null);
    setActiveDirection(null);
    setDetours({});
    setCheckingStopId(null);
    setLoading(false);
  }

  // Swapping the trip direction is important for separated carriageways,
  // limited-access highways, legal turnaround points, and one-way service roads.
  // No assumption is made from a station's straight-line position beside the road.
  function reverseJourney() {
    invalidateRoute();
    setError("");
    const previousStart = startText;
    const previousStartGps = startGps;
    setStartText(endText);
    setEndText(previousStart);
    setStartGps(endGps);
    setEndGps(previousStartGps);
  }

  async function checkDetour(stop: RouteStop) {
    if (!route || checkingStopId !== null) return;
    const currentVersion = routeVersion.current;
    const currentRoute = route;
    setCheckingStopId(stop.id);
    try {
      await reserveDemoRouterSlot();
      const result = await calculateStopDetour(currentRoute, stop);
      if (currentVersion === routeVersion.current) {
        setDetours(prev => ({ ...prev, [stop.id]: result }));
      }
    } catch (err) {
      if (currentVersion === routeVersion.current) {
        setDetours(prev => ({ ...prev, [stop.id]: {
          ok: false,
          message: err instanceof Error ? err.message : "Could not calculate driving detour.",
        } }));
      }
    } finally {
      if (currentVersion === routeVersion.current) setCheckingStopId(null);
    }
  }

  useEffect(() => {
    let active = true;
    getDocs(collection(db, "stations"))
      .then(snap => {
        if (!active) return;
        const list: Station[] = snap.docs.map(doc => {
          const s = doc.data();
          const price = s.diesel50 === null || s.diesel50 === undefined || s.diesel50 === "" ? null : Number(s.diesel50);
          return {
            id: doc.id,
            name: String(s.name || "Unnamed station"),
            brand: String(s.brand || ""),
            type: stationType(s.type),
            city: String(s.city || ""),
            suburb: String(s.suburb || ""),
            lat: s.lat == null ? NaN : Number(s.lat),
            lng: s.lng == null ? NaN : Number(s.lng),
            diesel50: price === null || !Number.isFinite(price) || price <= 0 ? null : price,
            priceUpdatedAt: s.diesel50UpdatedAt ?? s.priceUpdatedAt,
            truckFriendly: asBool(s.truckFriendly),
            navigable: s.navigable === false ? false : true,
          };
        });
        setStations(list);
        setStatus(`${list.length} Firebase records loaded. Enter a route to find fuel stops.`);
      })
      .catch(() => { if (active) { setError("Cannot read stations from Firebase. Check Firestore read permissions and internet."); setStatus(""); } });
    return () => { active = false; };
  }, []);

  const routeStops = useMemo(() => {
    if (!route) return [] as RouteStop[];
    const found: RouteStop[] = [];
    for (const s of stations) {
      if (s.type === "bulkSupplier" || s.navigable === false || !validPoint(s.lat, s.lng)) continue;
      if (category !== "all" && s.type !== category) continue;
      if (truckOnly && !s.truckFriendly) continue;
      const distance = distanceToRouteKm({ lat: s.lat, lng: s.lng }, route.polyline);
      if (distance <= radius) found.push({ ...s, distanceFromRouteKm: distance });
    }
    if (sort === "price") {
      found.sort((a, b) => (freshPrice(a) ?? Infinity) - (freshPrice(b) ?? Infinity) || a.distanceFromRouteKm - b.distanceFromRouteKm);
    } else if (sort === "detour") {
      // Only stops that have had a driving detour calculated in the CURRENT
      // journey direction can be ranked by extra road distance.
      found.sort((a, b) => {
        const aResult = detours[a.id];
        const bResult = detours[b.id];
        const aKm = aResult?.ok ? aResult.extraKm : Infinity;
        const bKm = bResult?.ok ? bResult.extraKm : Infinity;
        return aKm - bKm || a.distanceFromRouteKm - b.distanceFromRouteKm;
      });
    } else {
      found.sort((a, b) => a.distanceFromRouteKm - b.distanceFromRouteKm);
    }
    return found;
  }, [stations, route, radius, category, truckOnly, sort, detours]);

  const visibleStops = routeStops.slice(0, 40);
  async function useMyLocation() {
    if (!navigator.geolocation) { setError("Your browser does not support GPS location."); return; }
    setError("");
    navigator.geolocation.getCurrentPosition(
      pos => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (!validPoint(p.lat, p.lng)) { setError("Current location is outside the supported South African map area."); return; }
        invalidateRoute();
        setStartGps(p);
        setStartText("My current location");
      },
      () => setError("Location permission was denied or location was unavailable."),
      { enableHighAccuracy: false, timeout: 10000 }
    );
  }

  async function findRoute() {
    if (!startText.trim() || !endText.trim()) { setError("Enter both a starting point and a destination."); return; }
    invalidateRoute();
    const currentVersion = routeVersion.current;
    setError("");
    setLoading(true);
    try {
      const from = startGps ?? await findPoint(startText.trim());
      const to = endGps ?? await findPoint(endText.trim());
      await reserveDemoRouterSlot();
      const r = await calculateRoute(from, to);
      if (currentVersion === routeVersion.current) {
        setRoute(r);
        setActiveDirection({ from: startText.trim(), to: endText.trim() });
      }
    } catch (err) {
      if (currentVersion === routeVersion.current) {
        setRoute(null);
        setError(err instanceof Error ? err.message : "Unable to calculate route. Try again.");
      }
    } finally {
      if (currentVersion === routeVersion.current) setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 16px 60px", fontFamily: "Arial, sans-serif", color: "#172033" }}>
      <a href="/" style={{ color: "#2563eb", fontWeight: 700 }}>← Back to Fuel Finder SA</a>
      <h1 style={{ marginBottom: 4 }}>🛣 Fuel Finder SA — Route Planner</h1>
      <p style={{ color: "#475569", marginTop: 0 }}>Plan a drive and find nearby garages and diesel depots along the road route.</p>
      <section style={{ border: "1px solid #cbd5e1", borderRadius: 14, padding: 16, background: "#f8fafc" }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <label style={{ flex: "1 1 240px" }}>Start point
            <input style={input} value={startText} onChange={e => { invalidateRoute(); setStartText(e.target.value); setStartGps(null); }} placeholder="e.g. Springs, Gauteng" />
          </label>
          <label style={{ flex: "1 1 240px" }}>Destination
            <input style={input} value={endText} onChange={e => { invalidateRoute(); setEndText(e.target.value); setEndGps(null); }} placeholder="e.g. Durban" />
          </label>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
          <button type="button" style={secondaryButton} onClick={useMyLocation}>📍 Use my location</button>
          <button type="button" style={secondaryButton} onClick={reverseJourney} disabled={loading} title="Swap departure and destination; calculate again to see stops in the opposite direction">⇄ Reverse journey</button>
          <button type="button" style={primaryButton} onClick={findRoute} disabled={loading}>{loading ? "Calculating..." : "Find road route"}</button>
        </div>
        {status && <p style={{ margin: "12px 0 0", color: "#475569" }}>{status}</p>}
        {error && <p role="alert" style={{ color: "#b91c1c", fontWeight: 700 }}>{error}</p>}
      </section>
      {route && <>
        <div style={{ marginTop: 14, background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: 12 }}>
          <strong>Travel direction: {activeDirection?.from || "Start"} → {activeDirection?.to || "Destination"}</strong>
          <div style={{ color: "#475569", fontSize: 13, marginTop: 4 }}>Detours are calculated in this direction using the mapped driving roads. Use <b>Reverse journey</b> and <b>Find road route</b> to check the opposite direction.</div>
        </div>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", margin: "18px 0" }}>
          <strong>Road distance: {route.distanceKm.toFixed(0)} km</strong>
          <strong>Estimated car driving time: {Math.floor(route.durationMin / 60)}h {Math.round(route.durationMin % 60)}m</strong>
          <a href={directionsUrl(route)} target="_blank" rel="noopener noreferrer">Open route in Google Maps</a>
        </div>
        <div style={{ background: "#fff7ed", padding: 12, borderRadius: 10, color: "#7c2d12", marginBottom: 12 }}>
          <b>Testing feature:</b> Road detours can be different in opposite directions due to divided highways and legal turning points. The car-routing demo tries to respect the mapped road network, but may snap a garage pin to the wrong carriageway or miss a private entrance. Always verify the actual access route. It does not check truck height, axle loads or bridge restrictions and is not suitable for commercial launch.
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
          <label>Stops within (straight-line)
            <select style={input} value={radius} onChange={e => setRadius(Number(e.target.value))}>
              <option value={5}>5 km</option><option value={10}>10 km</option><option value={20}>20 km</option><option value={50}>50 km</option>
            </select>
          </label>
          <label>Location type
            <select style={input} value={category} onChange={e => setCategory(e.target.value)}>
              <option value="all">Garages + depots</option><option value="garage">Garages only</option><option value="depot">Diesel depots only</option>
            </select>
          </label>
          <label>Sort by
            <select style={input} value={sort} onChange={e => setSort(e.target.value)}>
              <option value="route">Closest to route (straight-line)</option><option value="price">Lowest recently dated diesel price</option><option value="detour">Shortest checked driving detour</option>
            </select>
          </label>
          <label style={{ paddingBottom: 9 }}><input type="checkbox" checked={truckOnly} onChange={e => setTruckOnly(e.target.checked)} /> Truck friendly only</label>
        </div>
        <RouteMap routeLine={route.polyline} from={route.from} to={route.to} stops={visibleStops} />
        <p style={{ fontSize: 13, color: "#475569" }}>
          {routeStops.length} possible stops within {radius} km straight-line of the mapped road. Showing {visibleStops.length} on the map. Select "Check driving detour" for actual mapped road-distance comparison in the shown direction. Select "Shortest checked driving detour" to rank stops that you have checked. Unchecked stops are shown after checked stops. Prices with recent dates have not necessarily been independently verified.
        </p>
        <div style={{ display: "grid", gap: 10 }}>
          {visibleStops.map(s => {
            const price = freshPrice(s);
            const detour = detours[s.id];
            return <article key={s.id} style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: 12, display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <b>{s.name}</b> <span style={{ color: "#64748b" }}>({s.type === "depot" ? "Depot" : s.brand || "Garage"})</span>
                <div style={{ fontSize: 13, color: "#475569" }}>{[s.suburb, s.city].filter(Boolean).join(", ")} • approx. {s.distanceFromRouteKm.toFixed(1)} km from route</div>
                <div style={{ fontSize: 13 }}>Diesel 50: {price !== null ? `R${price.toFixed(2)} (price dated within 30 days; not independently verified)` : s.diesel50 !== null ? `R${s.diesel50.toFixed(2)} (price not independently verified)` : "Price not available"}</div>
                {detour && (detour.ok ? (
                  <div role="status" style={{ marginTop: 7, fontSize: 13, fontWeight: 700, color: "#166534" }}>
                    Driving detour ({activeDirection?.from || "Start"} → {activeDirection?.to || "Destination"}): {signedDifference(detour.extraKm)} km,
                    {" "}{signedDifference(detour.extraMinutes)} min versus direct car route.
                    <div style={{ fontWeight: 400, color: "#475569" }}>Total via stop: {detour.viaKm.toFixed(1)} km, {Math.round(detour.viaMinutes)} min. Estimates exclude time spent refuelling.</div>
                  </div>
                ) : (
                  <div role="alert" style={{ marginTop: 7, fontSize: 13, color: "#b91c1c" }}>{detour.message}</div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <button type="button" onClick={() => checkDetour(s)} disabled={checkingStopId !== null || loading}
                  style={{ ...secondaryButton, padding: "9px 12px", opacity: checkingStopId !== null && checkingStopId !== s.id ? 0.55 : 1 }}>
                  {checkingStopId === s.id ? "Checking road detour..." : detour ? "Recheck detour" : "Check driving detour"}
                </button>
                <a href={directionsUrl(route, s)} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb", fontWeight: 700 }}>Navigate via stop</a>
              </div>
            </article>;
          })}
        </div>
        {!visibleStops.length && <p>No eligible stations found along this route. Increase the distance filter.</p>}
      </>}
    </main>
  );
}

const input: React.CSSProperties = { display: "block", minWidth: 180, width: "100%", boxSizing: "border-box", marginTop: 6, padding: 11, borderRadius: 9, border: "1px solid #94a3b8", fontSize: 15 };
const primaryButton: React.CSSProperties = { background: "#16a34a", color: "white", border: "none", borderRadius: 10, padding: "12px 18px", fontWeight: 700, cursor: "pointer" };
const secondaryButton: React.CSSProperties = { background: "#e2e8f0", color: "#172033", border: "none", borderRadius: 10, padding: "12px 18px", fontWeight: 700, cursor: "pointer" };
