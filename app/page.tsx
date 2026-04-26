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
  const [province, setProvince] = useState("All");
  const [truckMode, setTruckMode] = useState(false);
  const [open24, setOpen24] = useState(false);
  const [userLocation, setUserLocation] = useState<any>(null);

  // 🔥 AUTO LOAD LOCATION + DATA
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

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      });
    }
  }, []);

  const filteredStations = stations
    .filter((s) => {
      const text = `${s.name || ""} ${s.suburb || ""} ${s.city || ""} ${
        s.province || ""
      }`.toLowerCase();

      const matchesSearch = text.includes(search.toLowerCase());
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

      return { ...s, distanceKm };
    })
    .sort((a, b) => {
      if (a.distanceKm !== null && b.distanceKm !== null) {
        return a.distanceKm - b.distanceKm;
      }
      return (a.diesel50 ?? 9999) - (b.diesel50 ?? 9999);
    });

  const badge = {
    background: "#f3f4f6",
    padding: "7px 10px",
    borderRadius: 999,
    fontWeight: 700,
    fontSize: 13,
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        padding: 14,
        maxWidth: 760,
        margin: "0 auto",
        fontFamily: "Arial",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          background: "linear-gradient(135deg,#0f172a,#1e293b)",
          color: "white",
          padding: 22,
          borderRadius: 24,
          marginBottom: 18,
        }}
      >
        <h1 style={{ margin: 0 }}>Fuel Finder SA</h1>
        <p style={{ color: "#cbd5e1" }}>
          Find nearby stations, prices and features
        </p>
      </div>

      {/* FILTERS */}
      <div
        style={{
          background: "white",
          borderRadius: 16,
          padding: 12,
          marginBottom: 14,
        }}
      >
        <select
          value={province}
          onChange={(e) => setProvince(e.target.value)}
          style={{ width: "100%", padding: 10, marginBottom: 10 }}
        >
          <option>All</option>
          <option>Gauteng</option>
          <option>Mpumalanga</option>
          <option>Free State</option>
        </select>

        <label>
          <input
            type="checkbox"
            checked={truckMode}
            onChange={() => setTruckMode(!truckMode)}
          />{" "}
          🚛 Truck Mode
        </label>

        <label style={{ marginLeft: 10 }}>
          <input
            type="checkbox"
            checked={open24}
            onChange={() => setOpen24(!open24)}
          />{" "}
          🕒 Open 24h
        </label>
      </div>

      {/* SEARCH */}
      <input
        placeholder="Search..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: "100%",
          padding: 12,
          borderRadius: 12,
          border: "1px solid #ccc",
          marginBottom: 14,
        }}
      />

      {/* LIST */}
      {filteredStations.map((s) => (
        <div
          key={s.id}
          style={{
            background: "white",
            borderRadius: 18,
            padding: 16,
            marginBottom: 12,
            boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
          }}
        >
          <h3>{s.name}</h3>

          <p style={{ color: "#6b7280" }}>
            {s.suburb}, {s.city}, {s.province}
          </p>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span style={badge}>Diesel: R{s.diesel50}</span>
            {s.petrol93 && <span style={badge}>P93: R{s.petrol93}</span>}
            {s.petrol95 && <span style={badge}>P95: R{s.petrol95}</span>}
            {s.distanceKm !== null && (
              <span style={{ ...badge, background: "#dbeafe" }}>
                📍 {s.distanceKm.toFixed(1)} km
              </span>
            )}
          </div>

          {/* FEATURES */}
          <div style={{ marginTop: 8 }}>
            {s.truckFriendly && <span style={badge}>🚛 Truck</span>}
            {s.washBayTruck && <span style={badge}>🚿 Truck Wash</span>}
            {s.washBayLight && <span style={badge}>🧽 Car Wash</span>}
            {s.bathrooms && <span style={badge}>🚻 Toilets</span>}
            {s.atmAvailable && <span style={badge}>🏧 ATM</span>}
            {s.foodCourt && <span style={badge}>🍔 Food</span>}
            {s.open24Hours && <span style={badge}>🕒 24h</span>}
          </div>

          {/* BUTTONS */}
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button
              onClick={() =>
                window.open(
                  `https://www.google.com/maps?q=${s.lat},${s.lng}`,
                  "_blank"
                )
              }
              style={{
                flex: 1,
                background: "#2563eb",
                color: "white",
                padding: 10,
                borderRadius: 10,
                border: "none",
              }}
            >
              🧭 Navigate
            </button>

            {s.phoneNumber && (
              <a href={`tel:${s.phoneNumber}`} style={{ flex: 1 }}>
                <button
                  style={{
                    width: "100%",
                    background: "#111827",
                    color: "white",
                    padding: 10,
                    borderRadius: 10,
                    border: "none",
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