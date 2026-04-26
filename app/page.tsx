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
        userLocation && typeof s.lat === "number" && typeof s.lng === "number"
          ? getDistanceKm(userLocation.lat, userLocation.lng, s.lat, s.lng)
          : null;

      return { ...s, distanceKm };
    })
    .sort((a, b) => {
      const priceA = a.diesel50 ?? 9999;
      const priceB = b.diesel50 ?? 9999;
      const distA = a.distanceKm ?? 100;
      const distB = b.distanceKm ?? 100;

      return priceA + distA * 0.2 - (priceB + distB * 0.2);
    });

  const badge: React.CSSProperties = {
    background: "#f3f4f6",
    padding: "7px 10px",
    borderRadius: 999,
    fontWeight: 700,
    fontSize: 13,
    marginRight: 5,
    marginTop: 5,
    display: "inline-block",
  };

  const button: React.CSSProperties = {
    flex: 1,
    minWidth: 120,
    color: "white",
    padding: "11px 12px",
    borderRadius: 12,
    border: "none",
    fontWeight: 800,
    fontSize: 14,
  };

  // 📲 WhatsApp Add Station
  const handleAddStation = () => {
    const message = encodeURIComponent(
      `Hi, I want to add a fuel station:\n\nName:\nLocation:\nDiesel Price:\nFeatures:`
    );
    window.open(`https://wa.me/?text=${message}`, "_blank");
  };

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", padding: 14, maxWidth: 760, margin: "0 auto" }}>
      
      {/* HEADER */}
      <section style={{ background: "linear-gradient(135deg,#0f172a,#1e293b)", color: "white", padding: 22, borderRadius: 24, marginBottom: 18 }}>
        <h1>Fuel Finder SA</h1>
        <p>Find cheapest & safest fuel stops.</p>

        <button
          onClick={() => {
            navigator.geolocation.getCurrentPosition((pos) => {
              setUserLocation({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
              });
            });
          }}
          style={{ background: "#22c55e", color: "white", padding: 12, borderRadius: 12, border: "none", marginTop: 10 }}
        >
          📍 Use My Location
        </button>

        {/* 🔥 ADD STATION BUTTON */}
        <button
          onClick={handleAddStation}
          style={{
            background: "#f59e0b",
            color: "white",
            padding: 12,
            borderRadius: 12,
            border: "none",
            marginTop: 10,
            marginLeft: 10,
          }}
        >
          ➕ Add Station
        </button>
      </section>

      {/* FILTERS */}
      <select value={province} onChange={(e) => setProvince(e.target.value)}>
        {provinces.map((p) => (
          <option key={p}>{p}</option>
        ))}
      </select>

      {/* SEARCH */}
      <input
        placeholder="Search..."
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

          <span style={badge}>Diesel: R{s.diesel50}</span>

          {/* BUTTONS */}
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button
              onClick={() => window.open(`https://maps.google.com?q=${s.lat},${s.lng}`)}
              style={{ ...button, background: "#2563eb" }}
            >
              🧭 Navigate
            </button>

            {s.phoneNumber && (
              <a href={`tel:${s.phoneNumber}`} style={{ flex: 1 }}>
                <button style={{ ...button, background: "#111827" }}>
                  📞 Call
                </button>
              </a>
            )}

            <button style={{ ...button, background: "#dc2626" }}>
              ⚠️ Out
            </button>

            <button style={{ ...button, background: "#059669" }}>
              💸 Update
            </button>
          </div>
        </div>
      ))}
    </main>
  );
}