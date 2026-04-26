"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

type Location = {
  lat: number;
  lng: number;
};

function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export default function Home() {
  const [stations, setStations] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [province, setProvince] = useState("All");
  const [truckMode, setTruckMode] = useState(false);
  const [open24, setOpen24] = useState(false);
  const [userLocation, setUserLocation] = useState<Location | null>(null);

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

  function cleanPhone(phone: string) {
    if (!phone) return "";
    return phone.replace(/\s/g, "");
  }

  const filteredStations = stations
    .filter((s) => {
      const term = search.toLowerCase();

      const matchesSearch =
        s.name?.toLowerCase().includes(term) ||
        s.city?.toLowerCase().includes(term) ||
        s.suburb?.toLowerCase().includes(term);

      const matchesProvince = province === "All" || s.province === province;
      const matchesTruck = !truckMode || s.truckFriendly === true;
      const matchesOpen24 = !open24 || s.open24Hours === true;

      return matchesSearch && matchesProvince && matchesTruck && matchesOpen24;
    })
    .map((s) => {
      const distanceKm =
        userLocation && typeof s.lat === "number" && typeof s.lng === "number"
          ? getDistanceKm(userLocation.lat, userLocation.lng, s.lat, s.lng)
          : null;

      const bestScore =
        distanceKm !== null && s.diesel50
          ? s.diesel50 + distanceKm * 0.3
          : s.diesel50 ?? 9999;

      return { ...s, distanceKm, bestScore };
    })
    .sort((a, b) => {
      if (userLocation && a.distanceKm !== null && b.distanceKm !== null) {
        return a.distanceKm - b.distanceKm;
      }

      return (a.diesel50 ?? 9999) - (b.diesel50 ?? 9999);
    });

  const cheapestStation = filteredStations.reduce((min, s) => {
    if (!s.diesel50) return min;
    if (!min || s.diesel50 < min.diesel50) return s;
    return min;
  }, null as any);

  const bestStation = filteredStations.reduce((best, s) => {
    if (!s.diesel50) return best;
    if (!best || s.bestScore < best.bestScore) return s;
    return best;
  }, null as any);

  return (
    <main
      style={{
        padding: 18,
        fontFamily: "Arial, sans-serif",
        background: "#f8fafc",
        minHeight: "100vh",
        maxWidth: 900,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          background: "linear-gradient(135deg,#0f172a,#1e293b)",
          color: "white",
          padding: 22,
          borderRadius: 20,
          marginBottom: 18,
          boxShadow: "0 12px 28px rgba(15,23,42,0.25)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 30 }}>Fuel Finder SA</h1>
        <p style={{ marginTop: 8, color: "#cbd5e1" }}>
          Compare fuel prices, distance and station features.
        </p>

        <button
          onClick={useMyLocation}
          style={{
            background: "#22c55e",
            color: "white",
            padding: "11px 16px",
            borderRadius: 12,
            border: "none",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          📍 Use My Location
        </button>

        {userLocation && (
          <p style={{ marginBottom: 0, color: "#d1fae5" }}>
            Location loaded. Distances are active.
          </p>
        )}
      </div>

      <div
        style={{
          background: "white",
          padding: 16,
          borderRadius: 16,
          marginBottom: 16,
          boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
          alignItems: "center",
        }}
      >
        <select
          value={province}
          onChange={(e) => setProvince(e.target.value)}
          style={{
            padding: 12,
            borderRadius: 12,
            border: "1px solid #d1d5db",
          }}
        >
          <option>All</option>
          <option>Gauteng</option>
          <option>Mpumalanga</option>
          <option>Free State</option>
        </select>

        <label style={{ fontWeight: 600 }}>
          <input
            type="checkbox"
            checked={truckMode}
            onChange={() => setTruckMode(!truckMode)}
          />{" "}
          Truck Mode
        </label>

        <label style={{ fontWeight: 600 }}>
          <input
            type="checkbox"
            checked={open24}
            onChange={() => setOpen24(!open24)}
          />{" "}
          Open 24h
        </label>
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

      {bestStation && (
        <div
          style={{
            background: "linear-gradient(135deg,#fff7ed,#ffedd5)",
            border: "2px solid #f59e0b",
            borderRadius: 18,
            padding: 18,
            marginBottom: 14,
            boxShadow: "0 8px 20px rgba(245,158,11,0.15)",
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 6 }}>
            {truckMode ? "🚛 Best Truck Stop" : "🔥 Best Option"}
          </div>

          <div style={{ fontSize: 20, fontWeight: 800 }}>
            {bestStation.name}
          </div>

          <div style={{ color: "#6b7280", marginTop: 4 }}>
            {bestStation.suburb}, {bestStation.city}, {bestStation.province}
          </div>

          <div style={{ marginTop: 8 }}>
            Diesel: <b>R{bestStation.diesel50}</b>
          </div>

          {bestStation.distanceKm !== null && (
            <div style={{ color: "#2563eb", marginTop: 5, fontWeight: 700 }}>
              {bestStation.distanceKm.toFixed(1)} km away
            </div>
          )}
        </div>
      )}

      {cheapestStation && (
        <div
          style={{
            background: "#ecfdf5",
            border: "1px solid #10b981",
            borderRadius: 18,
            padding: 18,
            marginBottom: 14,
            boxShadow: "0 8px 20px rgba(16,185,129,0.12)",
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 6 }}>
            💸 Cheapest Diesel
          </div>

          <div style={{ fontSize: 18, fontWeight: 800 }}>
            {cheapestStation.name}
          </div>

          <div style={{ color: "#6b7280", marginTop: 4 }}>
            {cheapestStation.suburb}, {cheapestStation.city},{" "}
            {cheapestStation.province}
          </div>

          <div style={{ marginTop: 8 }}>
            R{cheapestStation.diesel50}
          </div>
        </div>
      )}

      {filteredStations.map((s) => (
        <div
          key={s.id}
          style={{
            background: "white",
            borderRadius: 18,
            padding: 16,
            marginBottom: 12,
            boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
            border: "1px solid #e5e7eb",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 17 }}>{s.name}</div>

          <div style={{ color: "#6b7280", marginTop: 4 }}>
            {s.suburb}, {s.city}, {s.province}
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span
              style={{
                background: "#f3f4f6",
                padding: "6px 10px",
                borderRadius: 999,
                fontWeight: 700,
              }}
            >
              Diesel: R{s.diesel50}
            </span>

            {s.distanceKm !== null && (
              <span
                style={{
                  background: "#dbeafe",
                  color: "#1d4ed8",
                  padding: "6px 10px",
                  borderRadius: 999,
                  fontWeight: 700,
                }}
              >
                {s.distanceKm.toFixed(1)} km
              </span>
            )}

            {s.open24Hours && (
              <span
                style={{
                  background: "#dcfce7",
                  color: "#166534",
                  padding: "6px 10px",
                  borderRadius: 999,
                  fontWeight: 700,
                }}
              >
                24h
              </span>
            )}

            {s.truckFriendly && (
              <span
                style={{
                  background: "#fef3c7",
                  color: "#92400e",
                  padding: "6px 10px",
                  borderRadius: 999,
                  fontWeight: 700,
                }}
              >
                🚛 Truck Friendly
              </span>
            )}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
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
                cursor: "pointer",
              }}
            >
              🧭 Navigate
            </button>

            {s.phoneNumber && (
              <a
                href={`tel:${cleanPhone(s.phoneNumber)}`}
                style={{ textDecoration: "none" }}
              >
                <button
                  style={{
                    background: "#111827",
                    color: "white",
                    padding: "9px 13px",
                    borderRadius: 10,
                    border: "none",
                    fontWeight: 700,
                    cursor: "pointer",
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