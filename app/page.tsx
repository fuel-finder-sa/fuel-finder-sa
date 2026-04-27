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
  const [province, setProvince] = useState("All");
  const [truckMode, setTruckMode] = useState(false);
  const [open24, setOpen24] = useState(false);
  const [userLocation, setUserLocation] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);

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
      const snap = await getDocs(collection(db, "stations"));
      setStations(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }

    fetchStations();

    navigator.geolocation?.getCurrentPosition((pos) => {
      setUserLocation({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      });
    });
  }, []);

  async function submitStation() {
    if (!newStation.name || !newStation.location) {
      alert("Please fill in station name and location.");
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

    alert("Station submitted for review.");
    setShowForm(false);
  }

  async function reportFuelIssue(station: any) {
    await addDoc(collection(db, "reports"), {
      stationId: station.id,
      stationName: station.name,
      type: "OUT_OF_FUEL",
      diesel50: station.diesel50 ?? null,
      petrol93: station.petrol93 ?? null,
      petrol95: station.petrol95 ?? null,
      createdAt: serverTimestamp(),
    });

    alert("Fuel issue reported. Thank you.");
  }

  async function updateFuelPrice(station: any) {
    const fuelType = prompt("Which fuel?\n\ndiesel50\npetrol93\npetrol95");
    if (!fuelType) return;

    const type = fuelType.trim().toLowerCase();

    const labels: any = {
      diesel50: "Diesel 50ppm",
      petrol93: "Petrol 93",
      petrol95: "Petrol 95",
    };

    if (!labels[type]) {
      alert("Invalid fuel type.");
      return;
    }

    const value = prompt(`Enter new price for ${labels[type]}:`);
    if (!value) return;

    const price = Number(value.replace(",", "."));
    if (Number.isNaN(price) || price <= 0) {
      alert("Invalid price.");
      return;
    }

    await addDoc(collection(db, "priceUpdates"), {
      stationId: station.id,
      stationName: station.name,
      fuelType: type,
      fuelLabel: labels[type],
      oldPrice: station[type] ?? null,
      newPrice: price,
      createdAt: serverTimestamp(),
    });

    alert(`${labels[type]} update submitted. Thank you.`);
  }

  const provinces = [
    "All",
    ...Array.from(new Set(stations.map((s) => s.province).filter(Boolean))),
  ];

  const filtered = stations
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
      const distance =
        userLocation && typeof s.lat === "number" && typeof s.lng === "number"
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

  const badge: React.CSSProperties = {
    background: "#f3f4f6",
    padding: "7px 10px",
    borderRadius: 999,
    fontWeight: 700,
    fontSize: 13,
    display: "inline-block",
    marginRight: 6,
    marginTop: 6,
  };

  const actionButton: React.CSSProperties = {
    border: "none",
    borderRadius: 14,
    padding: "12px 10px",
    color: "white",
    fontWeight: 800,
    fontSize: 14,
    width: "100%",
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        padding: 14,
        maxWidth: 520,
        margin: "0 auto",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <section
        style={{
          background: "linear-gradient(135deg,#0f172a,#1e293b)",
          color: "white",
          padding: 22,
          borderRadius: 26,
          marginBottom: 16,
          boxShadow: "0 12px 26px rgba(15,23,42,0.25)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 30 }}>Fuel Finder SA</h1>
        <p style={{ color: "#cbd5e1", marginTop: 8 }}>
          Find cheapest & safest fuel stops.
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
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
              color: "white",
              padding: "13px 18px",
              borderRadius: 16,
              border: "none",
              fontWeight: 800,
              fontSize: 15,
            }}
          >
            📍 Use My Location
          </button>

          <button
            onClick={() => setShowForm(true)}
            style={{
              background: "#f59e0b",
              color: "white",
              padding: "13px 18px",
              borderRadius: 16,
              border: "none",
              fontWeight: 800,
              fontSize: 15,
            }}
          >
            ➕ Add Station
          </button>
        </div>
      </section>

      {showForm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
            padding: 14,
          }}
        >
          <div
            style={{
              background: "white",
              width: "100%",
              maxWidth: 420,
              padding: 20,
              borderRadius: 22,
            }}
          >
            <h2 style={{ marginTop: 0 }}>Add Station</h2>

            {[
              ["name", "Station Name"],
              ["location", "Location / suburb / town"],
              ["diesel50", "Diesel 50ppm price"],
              ["petrol93", "Petrol 93 price"],
              ["petrol95", "Petrol 95 price"],
              ["features", "Features: ATM, toilets, truck wash, food court"],
            ].map(([field, placeholder]) => (
              <input
                key={field}
                placeholder={placeholder}
                value={(newStation as any)[field]}
                onChange={(e) =>
                  setNewStation({ ...newStation, [field]: e.target.value })
                }
                style={{
                  width: "100%",
                  padding: 12,
                  marginBottom: 10,
                  borderRadius: 12,
                  border: "1px solid #d1d5db",
                  boxSizing: "border-box",
                }}
              />
            ))}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={submitStation}
                style={{
                  ...actionButton,
                  background: "#059669",
                }}
              >
                Submit
              </button>

              <button
                onClick={() => setShowForm(false)}
                style={{
                  ...actionButton,
                  background: "#dc2626",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <section
        style={{
          background: "white",
          borderRadius: 20,
          padding: 14,
          marginBottom: 12,
          boxShadow: "0 5px 14px rgba(0,0,0,0.06)",
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
            fontSize: 15,
          }}
        >
          {provinces.map((p) => (
            <option key={p}>{p}</option>
          ))}
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
          borderRadius: 18,
          border: "1px solid #d1d5db",
          marginBottom: 14,
          boxSizing: "border-box",
          fontSize: 16,
          background: "white",
        }}
      />

      {filtered[0] && (
        <section
          style={{
            background: "#111827",
            color: "white",
            padding: 18,
            borderRadius: 22,
            marginBottom: 14,
            boxShadow: "0 10px 24px rgba(17,24,39,0.18)",
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 18 }}>
            🔥 BEST FUEL NEAR YOU
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, marginTop: 8 }}>
            {filtered[0].name}
          </div>
          <div style={{ marginTop: 8 }}>
            💸 Diesel: <b>R{filtered[0].diesel50}</b>
          </div>
          {filtered[0].distance !== null && (
            <div style={{ marginTop: 4 }}>
              📍 {filtered[0].distance.toFixed(1)} km away
            </div>
          )}
        </section>
      )}

      {filtered.map((s, index) => (
        <article
          key={s.id}
          style={{
            background: "white",
            borderRadius: 24,
            padding: 18,
            marginBottom: 14,
            border: "1px solid #e5e7eb",
            boxShadow: "0 8px 22px rgba(0,0,0,0.07)",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 22 }}>{s.name}</h2>

          <p style={{ color: "#6b7280", fontSize: 15, marginTop: 6 }}>
            {s.suburb}, {s.city}, {s.province}
          </p>

          <div>
            <span style={badge}>Diesel: R{s.diesel50}</span>
            {s.petrol93 && <span style={badge}>Petrol 93: R{s.petrol93}</span>}
            {s.petrol95 && <span style={badge}>Petrol 95: R{s.petrol95}</span>}
            {s.distance !== null && (
              <span
                style={{ ...badge, background: "#bbf7d0", color: "#166534" }}
              >
                📍 {s.distance.toFixed(1)} km
              </span>
            )}
            {index === 0 && (
              <span
                style={{ ...badge, background: "#dcfce7", color: "#166534" }}
              >
                ⭐ Best Option
              </span>
            )}
          </div>

          <div style={{ marginTop: 12 }}>
            {s.truckFriendly && <span style={badge}>🚛 Truck Friendly</span>}
            {s.washBayTruck && <span style={badge}>🚿 Truck Wash</span>}
            {s.washBayLight && <span style={badge}>🧽 Car Wash</span>}
            {s.bathrooms && <span style={badge}>🚻 Toilets</span>}
            {s.atmAvailable && <span style={badge}>🏧 ATM</span>}
            {s.convenienceStore && <span style={badge}>🛒 Shop</span>}
            {s.foodCourt && <span style={badge}>🍔 Food Court</span>}
            {s.coffeeShop && <span style={badge}>☕ Coffee</span>}
            {s.open24Hours && <span style={badge}>🕒 24h</span>}
            {s.truckStopSafe && <span style={badge}>🛑 Safe Stop</span>}
            {s.sleepOverAllowed && <span style={badge}>🌙 Sleep-Over</span>}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              marginTop: 16,
            }}
          >
            <button
              onClick={() =>
                window.open(
                  `https://www.google.com/maps?q=${s.lat},${s.lng}`,
                  "_blank"
                )
              }
              style={{ ...actionButton, background: "#2563eb" }}
            >
              🧭 Navigate
            </button>

            {s.phoneNumber && (
              <a href={`tel:${s.phoneNumber}`}>
                <button style={{ ...actionButton, background: "#111827" }}>
                  📞 Call
                </button>
              </a>
            )}

            <button
              onClick={() => reportFuelIssue(s)}
              style={{ ...actionButton, background: "#dc2626" }}
            >
              ⚠️ Report Fuel Issue
            </button>

            <button
              onClick={() => updateFuelPrice(s)}
              style={{ ...actionButton, background: "#059669" }}
            >
              💸 Update Fuel Price
            </button>
          </div>
        </article>
      ))}
    </main>
  );
}