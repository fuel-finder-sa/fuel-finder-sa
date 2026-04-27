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
      const snap = await getDocs(collection(db, "stations"));
      setStations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
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
    ...Array.from(new Set(stations.map(s => s.province).filter(Boolean))),
  ];

  const filtered = stations
    .filter(s => {
      const text = `${s.name} ${s.suburb || ""} ${s.city || ""} ${s.province || ""}`.toLowerCase();

      return (
        text.includes(search.toLowerCase()) &&
        (province === "All" || s.province === province) &&
        (!truckMode || s.truckFriendly) &&
        (!open24 || s.open24Hours)
      );
    })
    .map(s => {
      const distance =
        userLocation && s.lat && s.lng
          ? getDistanceKm(userLocation.lat, userLocation.lng, s.lat, s.lng)
          : null;

      return { ...s, distance };
    })
    .sort((a, b) => {
      const priceA = a.diesel50 ?? 9999;
      const priceB = b.diesel50 ?? 9999;
      const distA = a.distance ?? 100;
      const distB = b.distance ?? 100;

      return priceA + distA * 0.2 - (priceB + distB * 0.2);
    });

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: 14 }}>

      {/* HEADER */}
      <div style={{
        background: "#0f172a",
        color: "white",
        padding: 20,
        borderRadius: 20,
        marginBottom: 15
      }}>
        <h1>Fuel Finder SA</h1>

        <button
          onClick={() =>
            navigator.geolocation.getCurrentPosition((pos) =>
              setUserLocation({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
              })
            )
          }
          style={{
            background: "#22c55e",
            padding: 12,
            borderRadius: 12,
            border: "none",
            color: "white",
            fontWeight: 700
          }}
        >
          📍 Use My Location
        </button>
      </div>

      {/* FILTERS */}
      <select value={province} onChange={(e) => setProvince(e.target.value)}>
        {provinces.map(p => <option key={p}>{p}</option>)}
      </select>

      <label>
        <input type="checkbox" onChange={() => setTruckMode(!truckMode)} /> Truck
      </label>

      <label>
        <input type="checkbox" onChange={() => setOpen24(!open24)} /> 24h
      </label>

      {/* SEARCH */}
      <input
        placeholder="Search"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ width: "100%", marginTop: 10, padding: 10 }}
      />

      {/* BEST */}
      {filtered[0] && (
        <div style={{
          background: "#111827",
          color: "white",
          padding: 14,
          borderRadius: 14,
          marginTop: 10
        }}>
          🔥 BEST OPTION
          <div>{filtered[0].name}</div>
          💸 R{filtered[0].diesel50}
          {filtered[0].distance && <div>📍 {filtered[0].distance.toFixed(1)} km</div>}
        </div>
      )}

      {/* LIST */}
      {filtered.map(s => (
        <div key={s.id} style={{
          background: "white",
          padding: 14,
          marginTop: 10,
          borderRadius: 14
        }}>
          <b>{s.name}</b>

          <div>
            Diesel: R{s.diesel50} | Petrol 93: R{s.petrol93} | Petrol 95: R{s.petrol95}
          </div>

          {s.distance && <div>📍 {s.distance.toFixed(1)} km</div>}

          <button onClick={() =>
            window.open(`https://maps.google.com?q=${s.lat},${s.lng}`)
          }>
            🧭 Navigate
          </button>
        </div>
      ))}
    </main>
  );
}