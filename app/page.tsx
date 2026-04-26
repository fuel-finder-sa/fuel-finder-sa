"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export default function Home() {
  const [stations, setStations] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [userLocation, setUserLocation] = useState<any>(null);

  useEffect(() => {
    async function fetchStations() {
      const snapshot = await getDocs(collection(db, "stations"));
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setStations(data);
    }

    fetchStations();
  }, []);

  function useMyLocation() {
    navigator.geolocation.getCurrentPosition((pos) => {
      setUserLocation({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      });
    });
  }

  const filteredStations = stations
    .filter((s) => {
      const text = `${s.name || ""} ${s.suburb || ""} ${s.city || ""} ${
        s.province || ""
      }`.toLowerCase();

      return text.includes(search.toLowerCase());
    })
    .map((s) => {
      const distanceKm =
        userLocation && typeof s.lat === "number" && typeof s.lng === "number"
          ? getDistanceKm(userLocation.lat, userLocation.lng, s.lat, s.lng)
          : null;

      return { ...s, distanceKm };
    })
    .sort((a, b) => {
      if (a.distanceKm !== null && b.distanceKm !== null) {
        return a.distanceKm - b.distanceKm;
      }
      return (a.diesel50 ?? 9999) - (b.diesel50 ?? 9999);
    });

  return (
    <main
      style={{
        padding: 18,
        fontFamily: "Arial",
        background: "#f8fafc",
        minHeight: "100vh",
        maxWidth: 900,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          background: "#111827",
          color: "white",
          padding: 22,
          borderRadius: 20,
          marginBottom: 18,
        }}
      >
        <h1 style={{ margin: 0 }}>Fuel Finder SA</h1>
        <p>Compare fuel prices, distance and station features.</p>

        <button
          onClick={useMyLocation}
          style={{
            background: "#22c55e",
            color: "white",
            padding: "11px 16px",
            borderRadius: 12,
            border: "none",
            fontWeight: 700,
          }}
        >
          📍 Use My Location
        </button>
      </div>

      <input
        placeholder="Search station, suburb, city..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: "100%",
          padding: 14,
          borderRadius: 14,
          border: "1px solid #d1d5db",
          marginBottom: 16,
          boxSizing: "border-box",
          fontSize: 16,
        }}
      />

      {filteredStations.map((s) => (
        <div
          key={s.id}
          style={{
            background: "white",
            borderRadius: 18,
            padding: 16,
            marginBottom: 12,
            border: "1px solid #e5e7eb",
            boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
          }}
        >
          <h2 style={{ margin: 0 }}>{s.name}</h2>

          <p style={{ color: "#6b7280" }}>
            {s.suburb}, {s.city}, {s.province}
          </p>

          <p>
            Diesel: <b>R{s.diesel50}</b>
          </p>

          {s.distanceKm !== null && (
            <p style={{ color: "#2563eb", fontWeight: 700 }}>
              {s.distanceKm.toFixed(1)} km away
            </p>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={() =>
                window.open(
                  `https://www.google.com/maps?q=${s.lat},${s.lng}`,
                  "_blank"
                )
              }
              style={{
                background: "#2563eb",
                color: "white",
                padding: "9px 13px",
                borderRadius: 10,
                border: "none",
                fontWeight: 700,
              }}
            >
              🧭 Navigate
            </button>

            {s.phoneNumber && (
              <a href={`tel:${s.phoneNumber}`} style={{ textDecoration: "none" }}>
                <button
                  style={{
                    background: "#111827",
                    color: "white",
                    padding: "9px 13px",
                    borderRadius: 10,
                    border: "none",
                    fontWeight: 700,
                  }}
                >
                  📞 Call
                </button>
              </a>
            )}
          </div>
        </div>
      ))}
    </main>
  );
}