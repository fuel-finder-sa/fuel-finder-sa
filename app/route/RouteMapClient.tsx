"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { RouteStop } from "./page";
import { getBrandInfo } from "../components/BrandBadge";

type Point = { lat: number; lng: number };
type Props = { routeLine: Point[]; from: Point; to: Point; stops: RouteStop[] };

function marker(symbol: string, bg: string): L.DivIcon {
  return L.divIcon({
    className: "ffsa-route-marker",
    html: `<div style="background:${bg};color:white;width:30px;height:30px;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px #0007;display:grid;place-items:center;font:bold 14px Arial">${symbol}</div>`,
    iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -17],
  });
}
const startIcon = marker("A", "#16a34a");
const endIcon = marker("B", "#dc2626");
const iconCache = new Map<string, L.DivIcon>();
function stopIcon(stop: RouteStop): L.DivIcon {
  const info = getBrandInfo(stop.brand, stop.name, stop.type);
  const cached = iconCache.get(info.id);
  if (cached) return cached;
  const image = info.imageSrc ? `<img src="${info.imageSrc}" style="width:100%;height:100%;object-fit:contain" alt=""/>` : info.markerText;
  const icon = L.divIcon({
    className: "ffsa-route-stop",
    html: `<div style="width:52px;height:34px;display:grid;place-items:center;overflow:hidden;background:${info.background};color:${info.foreground};border:2px solid ${info.border};border-radius:7px;box-shadow:0 2px 5px #0006;font:bold 9px Arial">${image}</div>`,
    iconSize: [56, 38], iconAnchor: [28, 38], popupAnchor: [0, -38],
  });
  iconCache.set(info.id, icon);
  return icon;
}
function FitRoute({ routeLine }: { routeLine: Point[] }) {
  const map = useMap();
  useEffect(() => {
    if (routeLine.length > 1) {
      map.fitBounds(L.latLngBounds(routeLine.map(p => [p.lat, p.lng])), { padding: [30, 30] });
    }
  }, [map, routeLine]);
  return null;
}

export default function RouteMapClient({ routeLine, from, to, stops }: Props) {
  return <div style={{ height: 440, width: "100%", borderRadius: 12, overflow: "hidden", marginTop: 15, border: "1px solid #cbd5e1" }}>
    <MapContainer center={[from.lat, from.lng]} zoom={9} style={{ height: "100%", width: "100%" }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
      <FitRoute routeLine={routeLine} />
      <Polyline positions={routeLine.map(p => [p.lat, p.lng] as [number, number])} pathOptions={{ color: "#2563eb", weight: 5 }} />
      <Marker position={[from.lat, from.lng]} icon={startIcon}><Popup>Route start</Popup></Marker>
      <Marker position={[to.lat, to.lng]} icon={endIcon}><Popup>Destination</Popup></Marker>
      {stops.map(s => <Marker key={s.id} position={[s.lat, s.lng]} icon={stopIcon(s)}>
        <Popup><strong>{s.name}</strong><div>{s.type === "depot" ? "Diesel depot" : "Garage"}</div><div>About {s.distanceFromRouteKm.toFixed(1)} km straight-line from route</div><div>Diesel 50: {s.diesel50 ? `R${s.diesel50.toFixed(2)} (confirm price)` : "Price unavailable"}</div></Popup>
      </Marker>)}
    </MapContainer>
  </div>;
}
