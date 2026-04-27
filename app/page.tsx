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
  const [showAddForm, setShowAddForm] = useState(false);

  const [newStation, setNewStation] = useState({
    name: "",
    location: "",
    diesel50: "",
    petrol93: "",
    petrol95: "",
    features: "",
  });

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

  async function submitStation() {
    if (!newStation.name || !newStation.location) {
      alert("Please enter station name and location.");
      return;
    }

    await addDoc(collection(db, "stationSubmissions"), {
      ...newStation,
      diesel50: newStation.diesel50 ? Number(newStation.diesel50) : null,
      petrol93: newStation.petrol93 ? Number(newStation.petrol93) : null,
      petrol95: newStation.petrol95 ? Number(newStation.petrol95) : null,
      status: "PENDING",
      createdAt: serverTimestamp(),
    });

    alert("Station submitted. Thank you.");

    setNewStation({
      name: "",
      location: "",
      diesel50: "",
      petrol93: "",
      petrol95: "",
      features: "",
    });

    setShowAddForm(false);
  }

  async function reportFuelIssue(station: any) {
    await addDoc(collection(db, "reports"), {
      stationId: station.id,
      stationName: station.name,
      type: "OUT_OF_FUEL",
      createdAt: serverTimestamp(),
    });

    alert("Fuel issue reported. Thank you.");
  }

  async function updateFuelPrice(station: any) {
    const type = prompt("Which fuel?\ndiesel50\npetrol93\npetrol95");
    if (!type) return;

    const fuelType = type.trim().toLowerCase();

    const validTypes: any = {
      diesel50: "Diesel 50ppm",
      petrol93: "Petrol 93",
      petrol95: "Petrol 95",
    };

    if (!validTypes[fuelType]) {
      alert("Invalid fuel type.");
      return;
    }

    const value = prompt(`Enter new price for ${validTypes[fuelType]}:`);
    if (!value) return;

    const price = Number(value.replace(",", "."));
    if (Number.isNaN(price) || price <= 0) {
      alert("Invalid price.");
      return;
    }

    await addDoc(collection(db, "priceUpdates"), {
      stationId: station.id,
      stationName: station.name,
      fuelType,
      fuelLabel: validTypes[fuelType],
      newPrice: price,
      createdAt: serverTimestamp(),
    });

    alert("Price update submitted. Thank you.");
  }

  const filtered = stations
    .filter((s) =>
      `${s.name || ""} ${s.suburb || ""} ${s.city || ""} ${s.province || ""}`
        .toLowerCase()
        .includes(search.toLowerCase())
    )
    .map((s) => {
      const distance =
        userLocation && typeof s.lat === "number" && typeof s.lng === "number"
          ? getDistanceKm(userLocation.lat, userLocation.lng, s.lat, s.lng)
          : null;

      return { ...s, distance };
    })
    .sort((a, b) => (a.diesel50 ?? 9999) - (b.diesel50 ?? 9999));

  const buttonStyle: React.CSSProperties = {
    border: "none",
    borderRadius: 10,
    padding: 10,
    color: "white",
    fontWeight: 700,
    cursor: "pointer",
  };

  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: 14, fontFamily: "Arial" }}>
      <div style={{ background: "#0f172a", color: "white", padding: 16, borderRadius: 16 }}>
        <h2>Fuel Finder SA</h2>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() =>
              navigator.geolocation.getCurrentPosition((pos) =>
                setUserLocation({
                  lat: pos.coords.latitude,
                  lng: pos.coords.longitude,
                })
              )
            }
            style={{ ...buttonStyle, background: "#22c55e", flex: 1 }}
          >
            📍 Location
          </button>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            style={{ ...buttonStyle, background: "#f59e0b", flex: 1 }}
          >
            ➕ Add Station
          </button>
        </div>
      </div>

      {showAddForm && (
        <div
          style={{
            background: "white",
            padding: 14,
            borderRadius: 14,
            marginTop: 10,
            border: "1px solid #ddd",
          }}
        >
          <h3>Add New Station</h3>

          <input
            placeholder="Station name"
            value={newStation.name}
            onChange={(e) => setNewStation({ ...newStation, name: e.target.value })}
            style={{ width: "100%", padding: 10, marginBottom: 8 }}
          />

          <input
            placeholder="Location / suburb / town"
            value={newStation.location}
            onChange={(e) => setNewStation({ ...newStation, location: e.target.value })}
            style={{ width: "100%", padding: 10, marginBottom: 8 }}
          />

          <input
            placeholder="Diesel 50ppm price"
            value={newStation.diesel50}
            onChange={(e) => setNewStation({ ...newStation, diesel50: e.target.value })}
            style={{ width: "100%", padding: 10, marginBottom: 8 }}
          />

          <input
            placeholder="Petrol 93 price"
            value={newStation.petrol93}
            onChange={(e) => setNewStation({ ...newStation, petrol93: e.target.value })}
            style={{ width: "100%", padding: 10, marginBottom: 8 }}
          />

          <input
            placeholder="Petrol 95 price"
            value={newStation.petrol95}
            onChange={(e) => setNewStation({ ...newStation, petrol95: e.target.value })}
            style={{ width: "100%", padding: 10, marginBottom: 8 }}
          />

          <textarea
            placeholder="Features: truck friendly, toilets, ATM, car wash, etc."
            value={newStation.features}
            onChange={(e) => setNewStation({ ...newStation, features: e.target.value })}
            style={{ width: "100%", padding: 10, marginBottom: 8 }}
          />

          <button
            onClick={submitStation}
            style={{ ...buttonStyle, background: "#059669", width: "100%" }}
          >
            Submit Station
          </button>
        </div>
      )}

      <input
        placeholder="Search station, suburb, city..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: "100%", marginTop: 10, padding: 10, borderRadius: 10 }}
      />

      {filtered[0] && (
        <div style={{ background: "#111827", color: "white", padding: 14, borderRadius: 14, marginTop: 10 }}>
          <b>🔥 BEST FUEL NEAR YOU</b>
          <div>{filtered[0].name}</div>
          <div>💸 Diesel: R{filtered[0].diesel50}</div>
          {filtered[0].distance && <div>📍 {filtered[0].distance.toFixed(1)} km</div>}
        </div>
      )}

      {filtered.map((s) => (
        <div key={s.id} style={{ background: "white", marginTop: 10, padding: 14, borderRadius: 14 }}>
          <b>{s.name}</b>

          <div style={{ marginTop: 6 }}>
            Diesel: R{s.diesel50}
            {s.petrol93 && ` | Petrol 93: R${s.petrol93}`}
            {s.petrol95 && ` | Petrol 95: R${s.petrol95}`}
          </div>

          {s.distance && <div style={{ marginTop: 4 }}>📍 {s.distance.toFixed(1)} km away</div>}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
            <button
              onClick={() => window.open(`https://maps.google.com?q=${s.lat},${s.lng}`)}
              style={{ ...buttonStyle, background: "#2563eb" }}
            >
              🧭 Navigate
            </button>

            {s.phoneNumber && (
              <a href={`tel:${s.phoneNumber}`}>
                <button style={{ ...buttonStyle, background: "#111827", width: "100%" }}>
                  📞 Call
                </button>
              </a>
            )}

            <button
              onClick={() => reportFuelIssue(s)}
              style={{ ...buttonStyle, background: "#dc2626" }}
            >
              ⚠️ Report Issue
            </button>

            <button
              onClick={() => updateFuelPrice(s)}
              style={{ ...buttonStyle, background: "#059669" }}
            >
              💸 Update Price
            </button>
          </div>
        </div>
      ))}
    </main>
  );
}