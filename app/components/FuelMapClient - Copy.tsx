"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

function MapController({ bestStop }: any) {
  const map = useMap();
useEffect(() => {
  delete (L.Icon.Default.prototype as any)._getIconUrl;

  L.Icon.Default.mergeOptions({
    iconRetinaUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}, []);
  useEffect(() => {
    if (!bestStop?.lat || !bestStop?.lng) return;

    map.flyTo([Number(bestStop.lat), Number(bestStop.lng)], 13, {
      duration: 1.2,
    });
  }, [bestStop, map]);

  return null;
}

export default function FuelMapClient({
  mapView,
  myLocation,
  filtered,
  bestStop,
}: any) {
  if (!mapView) return null;

  return (
    <div
      style={{
        height: 400,
        width: "100%",
        marginTop: 15,
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      }}
    >
      <MapContainer
        center={
          myLocation
            ? [Number(myLocation.lat), Number(myLocation.lng)]
            : [-26.2041, 28.0473]
        }
        zoom={10}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        <MapController bestStop={bestStop} />

        {myLocation && (
          <Marker position={[Number(myLocation.lat), Number(myLocation.lng)]}>
            <Popup>📍 You are here</Popup>
          </Marker>
        )}

        {filtered?.map((s: any) => {
          const lat = Number(s.lat);
          const lng = Number(s.lng);

          if (!lat || !lng || lat < -35 || lat > -20 || lng < 15 || lng > 35) {
            return null;
          }

          return (
            <Marker key={s.id} position={[lat, lng]}>
              <Popup>
                <div>
                  <b>{s.name}</b>
                  <br />
                  ⛽ Diesel: R{Number(s.diesel50 || 0)}
                  <br />

                  {bestStop?.id === s.id && (
                    <span style={{ color: "#22c55e", fontWeight: "bold" }}>
                      ⭐ BEST STOP
                    </span>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}