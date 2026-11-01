"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { getBrandInfo } from "./BrandBadge";

type MapPoint = {
  id: string;
  name: string;
  brand?: string;
  type?: string;
  navigable?: boolean;
  lat?: number | null;
  lng?: number | null;
  suburb?: string;
  city?: string;
  province?: string;
  diesel50?: number | null;
};
type LatLng = { lat: number; lng: number };

type Props = {
  mapView: boolean;
  myLocation: LatLng | null;
  filtered: MapPoint[];
  bestStop: MapPoint | null;
};

function coordinates(s: MapPoint): LatLng | null {
  // Bulk-only suppliers are never map destinations.
  if (s.type === "bulkSupplier" || s.navigable === false) return null;
  if (s.lat == null || s.lng == null) return null;
  const lat = Number(s.lat);
  const lng = Number(s.lng);
  // Broad bounds for South Africa; avoid empty/zero/swapped coordinates.
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -35 || lat > -20 || lng < 15 || lng > 35) return null;
  return { lat, lng };
}

// Use trusted fixed text/colors for map markers, never raw station text in HTML.
const markerCache = new Map<string, L.DivIcon>();
function stationIcon(s: MapPoint): L.DivIcon {
  const info = getBrandInfo(s.brand, s.name, s.type);
  const cached = markerCache.get(info.id);
  if (cached) return cached;
  // Shell, BP and Astron images are loaded from /public/brands on the user's laptop.
  // URLs and label text are fixed BrandInfo entries, not station-provided HTML.
  const hasImage = Boolean(info.imageSrc);
  const width = hasImage ? 42 : 64;
  const height = hasImage ? 42 : 29;
  // A text fallback remains visible behind the image if a local logo is missing.
  const inside = info.imageSrc
    ? `<span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:800 10px Arial,sans-serif;color:${info.foreground}">${info.markerText}</span><img src="${info.imageSrc}" alt="${info.id}" style="position:relative;width:100%;height:100%;object-fit:contain;display:block;background:${info.background};border-radius:7px" />`
    : info.markerText;
  const icon = L.divIcon({
    className: "ffsa-map-brand-icon",
    html: `<div style="background:${info.background};color:${info.foreground};border:2px solid ${info.border};border-radius:9px;width:${width}px;height:${height}px;position:relative;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px #0005;font:800 10px Arial,sans-serif;letter-spacing:.01em;overflow:hidden">${inside}</div>`,
    iconSize: [width + 4, height + 4],
    iconAnchor: [(width + 4) / 2, height + 4],
    popupAnchor: [0, -height],
  });
  markerCache.set(info.id, icon);
  return icon;
}

const clusterIconCache = new Map<number, L.DivIcon>();
function clusterIcon(count: number): L.DivIcon {
  const cached = clusterIconCache.get(count);
  if (cached) return cached;
  const size = count >= 100 ? 52 : count >= 10 ? 46 : 42;
  const icon = L.divIcon({
    className: "ffsa-map-cluster",
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;border:3px solid white;background:#334155;color:white;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px #0007;font:800 15px Arial,sans-serif">${count}</div>`,
    iconSize: [size + 6, size + 6],
    iconAnchor: [(size + 6) / 2, (size + 6) / 2],
    popupAnchor: [0, -(size / 2)],
  });
  clusterIconCache.set(count, icon);
  return icon;
}

const userIcon = L.divIcon({
  className: "ffsa-map-user-icon",
  html: '<div style="background:#16a34a;color:white;border:2px solid white;border-radius:50%;width:30px;height:30px;display:grid;place-items:center;box-shadow:0 2px 5px #0005">📍</div>',
  iconSize: [34, 34], iconAnchor: [17, 17],
});

function MapController({ bestStop, myLocation, locations }: {
  bestStop: MapPoint | null; myLocation: LatLng | null; locations: MapPoint[];
}) {
  const map = useMap();
  useEffect(() => {
    const best = bestStop ? coordinates(bestStop) : null;
    if (best) {
      map.flyTo([best.lat, best.lng], 12, { duration: 1.2 });
    } else if (myLocation) {
      map.setView([myLocation.lat, myLocation.lng], 10);
    } else {
      const gpsLocations = locations.map(coordinates).filter((p): p is LatLng => p !== null);
      if (gpsLocations.length > 1) {
        map.fitBounds(gpsLocations.map(p => [p.lat, p.lng] as [number, number]), { padding: [24, 24], maxZoom: 12 });
      } else if (gpsLocations.length === 1) {
        map.setView([gpsLocations[0].lat, gpsLocations[0].lng], 12);
      }
    }
  }, [map, bestStop, myLocation, locations]);
  return null;
}

type Cluster = {
  key: string;
  lat: number;
  lng: number;
  stations: MapPoint[];
};

/**
 * Project station GPS to screen pixels at the current zoom and group nearby
 * markers into a grid. No new npm packages, external keys or Firebase changes.
 */
function buildClusters(locations: MapPoint[], map: L.Map, zoom: number): Cluster[] {
  // Size accounts for 72px branded markers; clusters naturally separate as users zoom.
  const cellSize = zoom >= 15 ? 48 : zoom >= 11 ? 76 : 88;
  const buckets = new Map<string, { latSum: number; lngSum: number; stations: MapPoint[] }>();
  for (const station of locations) {
    const gps = coordinates(station);
    if (!gps) continue;
    const projected = map.project([gps.lat, gps.lng], zoom);
    const key = `${Math.floor(projected.x / cellSize)}:${Math.floor(projected.y / cellSize)}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.stations.push(station);
      bucket.latSum += gps.lat;
      bucket.lngSum += gps.lng;
    } else {
      buckets.set(key, { latSum: gps.lat, lngSum: gps.lng, stations: [station] });
    }
  }
  return Array.from(buckets.entries(), ([key, b]) => ({
    key,
    lat: b.latSum / b.stations.length,
    lng: b.lngSum / b.stations.length,
    stations: b.stations,
  }));
}

function StationPopup({ station, bestStop }: { station: MapPoint; bestStop: MapPoint | null }) {
  const gps = coordinates(station)!;
  const value = station.diesel50 == null ? NaN : Number(station.diesel50);
  return (
    <div>
      <strong>{station.name}</strong>
      <div>Brand: {getBrandInfo(station.brand, station.name, station.type).label}</div>
      <div>{station.type === "depot" ? "Diesel depot" : "Garage"}</div>
      <div>{[station.suburb, station.city, station.province].filter(Boolean).join(", ")}</div>
      <div>Diesel 50: {Number.isFinite(value) && value > 0 ? `R${value.toFixed(2)} (confirm current price)` : "Price not available"}</div>
      {bestStop?.id === station.id && <strong style={{ color: "#15803d" }}>⭐ BEST STOP</strong>}
      <div><a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${gps.lat},${gps.lng}`)}`} target="_blank" rel="noopener noreferrer">Navigate</a></div>
    </div>
  );
}

function ClusteredStations({ locations, bestStop }: { locations: MapPoint[]; bestStop: MapPoint | null }) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  const clusters = useMemo(() => buildClusters(locations, map, zoom), [locations, map, zoom]);

  return <>
    {clusters.map(cluster => {
      const count = cluster.stations.length;
      if (count === 1) {
        const s = cluster.stations[0];
        const gps = coordinates(s)!;
        return <Marker key={s.id} position={[gps.lat, gps.lng]} icon={stationIcon(s)}>
          <Popup><StationPopup station={s} bestStop={bestStop} /></Popup>
        </Marker>;
      }
      // Clicking a cluster zooms in. At close zoom the popup lists all locations
      // still sharing an area (useful for sites with identical GPS pins).
      return <Marker
        key={`cluster-${zoom}-${cluster.key}`}
        position={[cluster.lat, cluster.lng]}
        icon={clusterIcon(count)}
        eventHandlers={{ click: () => {
          if (map.getZoom() < 16) map.flyTo([cluster.lat, cluster.lng], Math.min(16, map.getZoom() + 2), { duration: 0.5 });
        } }}
      >
        <Popup>
          <div style={{ maxHeight: 220, overflowY: "auto", minWidth: 190 }}>
            <strong>{count} fuel locations</strong>
            <p style={{ margin: "4px 0 8px" }}>{zoom < 16 ? "Click the group to zoom in." : "Multiple locations in this area:"}</p>
            {cluster.stations.slice(0, 20).map(s => <div key={s.id} style={{ paddingBottom: 5 }}>
              {getBrandInfo(s.brand, s.name, s.type).markerText}: {s.name}
            </div>)}
            {count > 20 && <p>And {count - 20} more. Zoom in or filter by brand.</p>}
          </div>
        </Popup>
      </Marker>;
    })}
  </>;
}

export default function FuelMapClient({ mapView, myLocation, filtered, bestStop }: Props) {
  const locations = useMemo(() => filtered.filter(s => coordinates(s) !== null), [filtered]);
  if (!mapView) return null;
  return (
    <div style={{ width: "100%", marginTop: 15, marginBottom: 18 }}>
      <div style={{ fontSize: 13, marginBottom: 8, color: "#334155" }}>
        <strong>Map:</strong> Numbered circles group nearby garages. Click to zoom in and reveal individual brand badges.
        <span style={{ marginLeft: 10, fontWeight: 700, color: "#f9671d" }}>Astron, Shell &amp; BP logos</span>
        <span style={{ marginLeft: 10, fontWeight: 700, color: "#0753a8" }}>ENGEN (blue)</span>
      </div>
      <div style={{ height: 400, width: "100%", borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,.15)" }}>
        <MapContainer center={myLocation ? [myLocation.lat, myLocation.lng] : [-28.5, 24.5]} zoom={6} style={{ height: "100%", width: "100%" }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
          <MapController bestStop={bestStop} myLocation={myLocation} locations={locations} />
          {myLocation && <Marker icon={userIcon} position={[myLocation.lat, myLocation.lng]}><Popup>📍 You are here</Popup></Marker>}
          <ClusteredStations locations={locations} bestStop={bestStop} />
        </MapContainer>
      </div>
    </div>
  );
}
