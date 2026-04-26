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

  const provinces = [
    "All",
    ...Array.from(new Set(stations.map((s) => s.province).filter(Boolean))),
  ];

  const filteredStations = stations
    .filter((s) => {
      const text = `${s.name || ""} ${s.suburb || ""} ${s.city || ""} ${
        s.province || ""
      }`.toLowerCase();

      return (
        text.includes(search.toLowerCase()) &&
        (province === "All" || s.province === province) &&
        (!truckMode || s.truckFriendly) &&
        (!open24 || s.open24Hours)
      );
    })
    .map((s) => {
      const distanceKm =
        userLocation && s.lat && s.lng
          ? getDistanceKm(userLocation.lat, userLocation.lng, s.lat, s.lng)
          : null;

      return { ...s, distanceKm };
    })
    .sort((a, b) => {
      const priceA = a.diesel50 ?? 9999;
      const priceB = b.diesel50 ?? 9999;

      const distA = a.distanceKm ?? 100;
      const distB = b.distanceKm ?? 100;

      const scoreA = priceA + distA * 0.2;
      const scoreB = priceB + distB * 0.2;

      return scoreA - scoreB;
    });

  const badge = {
    background: "#f3f4f6",
    padding: "7px 10px",
    borderRadius: 999,
    fontWeight: 700,
    fontSize: 13,
    marginRight: 5,
    marginTop: 5,
    display: "inline-block",
  };

  return (
    <main style={{ padding: 14, maxWidth: 760, margin: "0 auto" }}>
      {/* HEADER */}
      <div style={{ background: "#0f172a", color: "white", padding: 20, borderRadius: 20 }}>
        <h1>Fuel Finder SA</h1>
        <p>Find cheapest & safest fuel stops</p>

        <button
          onClick={() => {
            navigator.geolocation.getCurrentPosition((pos) => {
              setUserLocation({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
              });
            });
          }}
          style={{
            background: "#22c55e",
            color: "white",
            padding: 10,
            borderRadius: 10,
            border: "none",
            marginTop: 10,
          }}
        >
          📍 Use My Location
        </button>
      </div>

      {/* FILTERS */}
      <div style={{ marginTop: 10 }}>
        <select value={province} onChange={(e) => setProvince(e.target.value)}>
          {provinces.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>

        <label>
          <input type="checkbox" onChange={() => setTruckMode(!truckMode)} /> 🚛 Truck Mode
        </label>

        <label>
          <input type="checkbox" onChange={() => setOpen24(!open24)} /> 🕒 Open 24h
        </label>
      </div>

      {/* SEARCH */}
      <input
        placeholder="Search station, suburb, city..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: "100%", marginTop: 10, padding: 10 }}
      />

      {/* TOP BAR */}
      {filteredStations.length > 0 && (
        <div style={{ background: "#111827", color: "white", padding: 15, borderRadius: 16, marginTop: 12 }}>
          <h3>⭐ Best Option</h3>
          <p>{filteredStations[0].name}</p>
          <p>💸 R{filteredStations[0].diesel50}</p>
        </div>
      )}

      {/* LIST */}
      {filteredStations.map((s, index) => (
        <div key={s.id} style={{ background: "#fff", marginTop: 10, padding: 15, borderRadius: 15 }}>
          <h3>{s.name}</h3>

          <p>{s.suburb}, {s.city}</p>

          <div>
            <span style={badge}>Diesel: R{s.diesel50}</span>
            {s.distanceKm && <span style={{ ...badge, background: "#bbf7d0" }}>📍 {s.distanceKm.toFixed(1)} km</span>}
            {index === 0 && <span style={{ ...badge, background: "#dcfce7" }}>⭐ Best</span>}
          </div>

          {/* NEW BADGES */}
          <div>
            {s.truckStopSafe && <span style={badge}>🛑 Safe Stop</span>}
            {s.sleepOverAllowed && <span style={badge}>🌙 Sleep-Over</span>}
          </div>

          {/* BUTTONS */}
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button onClick={() => window.open(`https://maps.google.com?q=${s.lat},${s.lng}`)}>
              🧭 Navigate
            </button>

            <button onClick={() => alert("Report submitted (phase 2 coming)")}>
              ⚠️ Out of Fuel
            </button>

            <button onClick={() => alert("Update feature coming soon")}>
              💸 Update Price
            </button>
          </div>
        </div>
      ))}
    </main>
  );
}