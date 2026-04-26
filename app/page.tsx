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

  const badgeStyle: any = {
    background: "#f3f4f6",
    padding: "7px 10px",
    borderRadius: 999,
    fontWeight: 700,
    fontSize: 13,
    display: "inline-flex",
    gap: 4,
    alignItems: "center",
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        fontFamily: "Arial, sans-serif",
        padding: 14,
        maxWidth: 760,
        margin: "0 auto",
      }}
    >
      <section
        style={{
          background: "linear-gradient(135deg,#0f172a,#1e293b)",
          color: "white",
          padding: 22,
          borderRadius: 24,
          marginBottom: 18,
          boxShadow: "0 12px 28px rgba(15,23,42,0.25)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 30 }}>Fuel Finder SA</h1>
        <p style={{ color: "#cbd5e1", fontSize: 16 }}>
          Compare fuel prices, distance and station features.
        </p>

        <button
          onClick={useMyLocation}
          style={{
            background: "#22c55e",
            color: "white",
            padding: "13px 18px",
            borderRadius: 14,
            border: "none",
            fontWeight: 800,
            fontSize: 16,
          }}
        >
          📍 Use My Location
        </button>

        {userLocation && (
          <p style={{ color: "#d1fae5", marginBottom: 0 }}>
            Location loaded. Distances are active.
          </p>
        )}
      </section>

      <section
        style={{
          background: "white",
          borderRadius: 18,
          padding: 14,
          marginBottom: 14,
          boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
        }}
      >
        <select
          value={province}
          onChange={(e) => setProvince(e.target.value)}
          style={{
            width: "100%",
            padding: 13,
            borderRadius: 14,
            border: "1px solid #d1d5db",
            marginBottom: 10,
            fontSize: 16,
          }}
        >
          <option>All</option>
          <option>Gauteng</option>
          <option>Mpumalanga</option>
          <option>Free State</option>
        </select>

        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <label style={{ fontWeight: 700 }}>
            <input
              type="checkbox"
              checked={truckMode}
              onChange={() => setTruckMode(!truckMode)}
            />{" "}
            🚛 Truck Mode
          </label>

          <label style={{ fontWeight: 700 }}>
            <input
              type="checkbox"
              checked={open24}
              onChange={() => setOpen24(!open24)}
            />{" "}
            🕒 Open 24h
          </label>
        </div>
      </section>

      <input
        placeholder="Search station, suburb, city..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: "100%",
          padding: 15,
          borderRadius: 16,
          border: "1px solid #d1d5db",
          marginBottom: 16,
          boxSizing: "border-box",
          fontSize: 16,
          background: "white",
        }}
      />

      {filteredStations.map((s) => (
        <article
          key={s.id}
          style={{
            background: "white",
            borderRadius: 22,
            padding: 18,
            marginBottom: 14,
            border: "1px solid #e5e7eb",
            boxShadow: "0 6px 18px rgba(0,0,0,0.07)",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 22 }}>{s.name}</h2>

          <p style={{ color: "#6b7280", fontSize: 16, marginTop: 6 }}>
            {s.suburb}, {s.city}, {s.province}
          </p>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={badgeStyle}>Diesel: R{s.diesel50}</span>
            {s.petrol93 && <span style={badgeStyle}>Petrol 93: R{s.petrol93}</span>}
            {s.petrol95 && <span style={badgeStyle}>Petrol 95: R{s.petrol95}</span>}
            {s.distanceKm !== null && (
              <span style={{ ...badgeStyle, background: "#dbeafe", color: "#1d4ed8" }}>
                📍 {s.distanceKm.toFixed(1)} km
              </span>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            {s.open24Hours && <span style={badgeStyle}>🕒 Open 24h</span>}
            {s.truckFriendly && <span style={badgeStyle}>🚛 Truck Friendly</span>}
            {s.washBayTruck && <span style={badgeStyle}>🚿 Truck Wash</span>}
            {s.washBayLight && <span style={badgeStyle}>🧽 Car Wash</span>}
            {s.bathrooms && <span style={badgeStyle}>🚻 Bathrooms</span>}
            {s.atmAvailable && <span style={badgeStyle}>🏧 ATM</span>}
            {s.convenienceStore && <span style={badgeStyle}>🛒 Shop</span>}
            {s.foodCourt && <span style={badgeStyle}>🍔 Food Court</span>}
            {s.coffeeShop && <span style={badgeStyle}>☕ Coffee</span>}
          </div>

          {s.openingHours && (
            <p style={{ marginTop: 12 }}>
              <b>Hours:</b> {s.openingHours}
            </p>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button
              onClick={() =>
                window.open(`https://www.google.com/maps?q=${s.lat},${s.lng}`, "_blank")
              }
              style={{
                flex: 1,
                background: "#2563eb",
                color: "white",
                padding: "12px 14px",
                borderRadius: 14,
                border: "none",
                fontWeight: 800,
                fontSize: 15,
              }}
            >
              🧭 Navigate
            </button>

            {s.phoneNumber && (
              <a href={`tel:${s.phoneNumber}`} style={{ flex: 1, textDecoration: "none" }}>
                <button
                  style={{
                    width: "100%",
                    background: "#111827",
                    color: "white",
                    padding: "12px 14px",
                    borderRadius: 14,
                    border: "none",
                    fontWeight: 800,
                    fontSize: 15,
                  }}
                >
                  📞 Call
                </button>
              </a>
            )}
          </div>
        </article>
      ))}
    </main>
  );
}