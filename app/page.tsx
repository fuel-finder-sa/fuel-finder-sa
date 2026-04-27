"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
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

  async function reportFuelIssue(station: any) {
    await addDoc(collection(db, "reports"), {
      stationName: station.name,
      type: "OUT_OF_FUEL",
      createdAt: serverTimestamp(),
    });
    alert("Fuel issue reported 👍");
  }

  async function updateFuelPrice(station: any) {
    const type = prompt("diesel50 / petrol93 / petrol95");
    if (!type) return;

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

  // 🔥 FIXED WHATSAPP
  const handleAddStation = () => {
    const msg = encodeURIComponent(
      "Hi, I want to add a station:\n\nName:\nLocation:\nDiesel Price:\nPetrol 93:\nPetrol 95:\nFeatures:"
    );

    window.open(`https://wa.me/27829371858?text=${msg}`, "_blank");
  };

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

  return (
    <main
      style={{
        maxWidth: 500,
        margin: "0 auto",
        padding: 14,
        fontFamily: "Arial",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          background: "#0f172a",
          color: "white",
          padding: 16,
          borderRadius: 16,
        }}
      >
        <h2>Fuel Finder SA</h2>

        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
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
              flex: 1,
              background: "#22c55e",
              borderRadius: 10,
              padding: 10,
              border: "none",
              color: "white",
            }}
          >
            📍 Location
          </button>

          <button
            onClick={handleAddStation}
            style={{
              flex: 1,
              background: "#f59e0b",
              borderRadius: 10,
              padding: 10,
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
          padding: 10,
          borderRadius: 10,
        }}
      />

      {/* LIST */}
      {filtered.map((s) => (
        <div
          key={s.id}
          style={{
            background: "#fff",
            marginTop: 10,
            padding: 14,
            borderRadius: 14,
          }}
        >
          <b>{s.name}</b>

          <div style={{ marginTop: 6 }}>
            Diesel: R{s.diesel50}
            {s.petrol93 && ` | Petrol 93: R${s.petrol93}`}
            {s.petrol95 && ` | Petrol 95: R${s.petrol95}`}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginTop: 10,
            }}
          >
            <button
              onClick={() =>
                window.open(`https://maps.google.com?q=${s.lat},${s.lng}`)
              }
              style={{ background: "#2563eb", color: "white", borderRadius: 8, padding: 8 }}
            >
              🧭 Navigate
            </button>

            {s.phoneNumber && (
              <a href={`tel:${s.phoneNumber}`}>
                <button
                  style={{
                    background: "#111827",
                    color: "white",
                    borderRadius: 8,
                    padding: 8,
                    width: "100%",
                  }}
                >
                  📞 Call
                </button>
              </a>
            )}

            <button
              onClick={() => reportFuelIssue(s)}
              style={{ background: "#dc2626", color: "white", borderRadius: 8, padding: 8 }}
            >
              ⚠️ Report Issue
            </button>

            <button
              onClick={() => updateFuelPrice(s)}
              style={{ background: "#059669", color: "white", borderRadius: 8, padding: 8 }}
            >
              💸 Update Price
            </button>
          </div>
        </div>
      ))}
    </main>
  );
}