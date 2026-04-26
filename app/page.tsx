"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
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

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      });
    }
  }, []);

  // 🔥 REPORT
  async function reportOutOfFuel(station: any) {
    await addDoc(collection(db, "reports"), {
      stationName: station.name,
      type: "OUT_OF_FUEL",
      createdAt: serverTimestamp(),
    });

    alert("Fuel issue reported 👍");
  }

  // 🔥 MULTI FUEL UPDATE
  async function updateFuelPrice(station: any) {
    const fuelType = prompt(
      "Type fuel:\ndiesel50\npetrol93\npetrol95"
    );

    if (!fuelType) return;

    const type = fuelType.toLowerCase();

    const value = prompt("Enter new price:");
    if (!value) return;

    const price = Number(value.replace(",", "."));
    if (isNaN(price)) {
      alert("Invalid price");
      return;
    }

    await addDoc(collection(db, "priceUpdates"), {
      stationName: station.name,
      fuelType: type,
      newPrice: price,
      createdAt: serverTimestamp(),
    });

    alert("Price update saved 👍");
  }

  const filtered = stations
    .filter((s) =>
      `${s.name} ${s.city}`.toLowerCase().includes(search.toLowerCase())
    )
    .map((s) => {
      const distance =
        userLocation && s.lat && s.lng
          ? getDistanceKm(userLocation.lat, userLocation.lng, s.lat, s.lng)
          : null;

      return { ...s, distance };
    })
    .sort((a, b) => (a.diesel50 ?? 999) - (b.diesel50 ?? 999));

  const handleAddStation = () => {
    const msg = encodeURIComponent(
      "Hi, I want to add a station:\nName:\nLocation:\nDiesel Price:"
    );
    window.open(`https://wa.me/?text=${msg}`);
  };

  return (
    <main
      style={{
        background: "#f8fafc",
        minHeight: "100vh",
        padding: 14,
        maxWidth: 700,
        margin: "0 auto",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          background: "#0f172a",
          color: "white",
          padding: 20,
          borderRadius: 20,
        }}
      >
        <h1>Fuel Finder SA</h1>
        <p>Find cheapest & safest fuel stops</p>

        <div style={{ display: "flex", gap: 10 }}>
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
              padding: 10,
              borderRadius: 10,
              border: "none",
              color: "white",
            }}
          >
            📍 Use My Location
          </button>

          <button
            onClick={handleAddStation}
            style={{
              background: "#f59e0b",
              padding: 10,
              borderRadius: 10,
              border: "none",
              color: "white",
            }}
          >
            ➕ Add Station
          </button>
        </div>
      </div>

      {/* SEARCH */}
      <input
        placeholder="Search..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: "100%",
          marginTop: 10,
          padding: 12,
          borderRadius: 10,
        }}
      />

      {/* BEST */}
      {filtered[0] && (
        <div
          style={{
            background: "#111827",
            color: "white",
            padding: 15,
            borderRadius: 15,
            marginTop: 10,
          }}
        >
          🔥 BEST FUEL NEAR YOU
          <h3>{filtered[0].name}</h3>
          💸 R{filtered[0].diesel50}
          {filtered[0].distance && (
            <div>📍 {filtered[0].distance.toFixed(1)} km</div>
          )}
        </div>
      )}

      {/* LIST */}
      {filtered.map((s) => (
        <div
          key={s.id}
          style={{
            background: "white",
            padding: 15,
            borderRadius: 15,
            marginTop: 10,
          }}
        >
          <h3>{s.name}</h3>

          <div style={{ marginBottom: 8 }}>
            Diesel: <b>R{s.diesel50}</b>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={() =>
                window.open(`https://maps.google.com?q=${s.lat},${s.lng}`)
              }
              style={{
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
              <a href={`tel:${s.phoneNumber}`}>
                <button
                  style={{
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

            <button
              onClick={() => reportOutOfFuel(s)}
              style={{
                background: "#dc2626",
                color: "white",
                padding: 10,
                borderRadius: 10,
                border: "none",
              }}
            >
              ⚠️ Out
            </button>

            <button
              onClick={() => updateFuelPrice(s)}
              style={{
                background: "#059669",
                color: "white",
                padding: 10,
                borderRadius: 10,
                border: "none",
              }}
            >
              💸 Update
            </button>
          </div>
        </div>
      ))}
    </main>
  );
}