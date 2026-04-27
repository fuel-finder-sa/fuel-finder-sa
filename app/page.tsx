"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  deleteDoc,
  doc,
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
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [province, setProvince] = useState("All");
  const [truckMode, setTruckMode] = useState(false);
  const [open24, setOpen24] = useState(false);
  const [userLocation, setUserLocation] = useState<any>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const isAdmin =
    typeof window !== "undefined" &&
    window.location.search.includes("admin=true");

  const [newStation, setNewStation] = useState({
    name: "",
    location: "",
    diesel50: "",
    petrol93: "",
    petrol95: "",
    features: "",
  });

  useEffect(() => {
    async function fetchData() {
      const snap = await getDocs(collection(db, "stations"));
      setStations(snap.docs.map((d) => ({ id: d.id, ...d.data() })));

      if (isAdmin) {
        const sub = await getDocs(collection(db, "stationSubmissions"));
        setSubmissions(sub.docs.map((d) => ({ id: d.id, ...d.data() })));
      }
    }

    fetchData();

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
      alert("Please add station name and location");
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

    alert("Station submitted 👍");
    setShowAddForm(false);
  }

  async function approveStation(s: any) {
    await addDoc(collection(db, "stations"), {
      name: s.name,
      suburb: s.location,
      city: s.location,
      province: "Gauteng",
      diesel50: s.diesel50 ?? null,
      petrol93: s.petrol93 ?? null,
      petrol95: s.petrol95 ?? null,
    });

    await deleteDoc(doc(db, "stationSubmissions", s.id));
    alert("Approved ✔");
    location.reload();
  }

  async function reportFuelIssue(s: any) {
    await addDoc(collection(db, "reports"), {
      stationId: s.id,
      stationName: s.name,
      type: "OUT_OF_FUEL",
      diesel50: s.diesel50 ?? null,
      petrol93: s.petrol93 ?? null,
      petrol95: s.petrol95 ?? null,
      suburb: s.suburb ?? "",
      city: s.city ?? "",
      province: s.province ?? "",
      createdAt: serverTimestamp(),
    });

    alert("Fuel issue reported 👍");
  }

  async function updateFuelPrice(s: any) {
    const fuelType = prompt("Which fuel?\n\ndiesel50\npetrol93\npetrol95");
    if (!fuelType) return;

    const type = fuelType.trim().toLowerCase();

    const labels: any = {
      diesel50: "Diesel 50ppm",
      petrol93: "Petrol 93",
      petrol95: "Petrol 95",
    };

    if (!labels[type]) {
      alert("Invalid fuel type");
      return;
    }

    const value = prompt(`Enter new price for ${labels[type]}:`);
    if (!value) return;

    const price = Number(value.replace(",", "."));
    if (Number.isNaN(price) || price <= 0) {
      alert("Invalid price");
      return;
    }

    await addDoc(collection(db, "priceUpdates"), {
      stationId: s.id,
      stationName: s.name,
      fuelType: type,
      fuelLabel: labels[type],
      oldPrice: s[type] ?? null,
      newPrice: price,
      suburb: s.suburb ?? "",
      city: s.city ?? "",
      province: s.province ?? "",
      createdAt: serverTimestamp(),
    });

    alert("Price update submitted 👍");
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
    marginRight: 5,
    marginTop: 5,
    display: "inline-block",
  };

  const button: React.CSSProperties = {
    color: "white",
    padding: "11px 12px",
    borderRadius: 12,
    border: "none",
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
        maxWidth: 760,
        margin: "0 auto",
        fontFamily: "Arial",
      }}
    >
      <section
        style={{
          background: "linear-gradient(135deg,#0f172a,#1e293b)",
          color: "white",
          padding: 22,
          borderRadius: 24,
          marginBottom: 18,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 30 }}>Fuel Finder SA</h1>
        <p style={{ color: "#cbd5e1" }}>
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
              padding: "12px 14px",
              borderRadius: 12,
              border: "none",
              fontWeight: 800,
            }}
          >
            📍 Use My Location
          </button>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            style={{
              background: "#f59e0b",
              color: "white",
              padding: "12px 14px",
              borderRadius: 12,
              border: "none",
              fontWeight: 800,
            }}
          >
            ➕ Add Station
          </button>
        </div>
      </section>

      {showAddForm && (
        <section
          style={{
            background: "white",
            padding: 14,
            borderRadius: 18,
            marginBottom: 14,
            boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
          }}
        >
          <h3>Add New Station</h3>

          {["name", "location", "diesel50", "petrol93", "petrol95", "features"].map(
            (field) => (
              <input
                key={field}
                placeholder={field}
                value={(newStation as any)[field]}
                onChange={(e) =>
                  setNewStation({ ...newStation, [field]: e.target.value })
                }
                style={{
                  width: "100%",
                  padding: 12,
                  marginBottom: 8,
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                  boxSizing: "border-box",
                }}
              />
            )
          )}

          <button
            onClick={submitStation}
            style={{
              ...button,
              background: "#059669",
            }}
          >
            Submit Station
          </button>
        </section>
      )}

      {isAdmin && (
        <section
          style={{
            background: "#111827",
            color: "white",
            padding: 14,
            borderRadius: 18,
            marginBottom: 14,
          }}
        >
          <h3>Admin Submissions</h3>

          {submissions.map((s) => (
            <div
              key={s.id}
              style={{
                background: "#1f2937",
                padding: 10,
                borderRadius: 10,
                marginTop: 8,
              }}
            >
              <b>{s.name}</b>
              <div>{s.location}</div>
              <div>Diesel: R{s.diesel50}</div>
              <button
                onClick={() => approveStation(s)}
                style={{
                  marginTop: 8,
                  background: "#22c55e",
                  color: "white",
                  border: "none",
                  padding: 8,
                  borderRadius: 8,
                }}
              >
                ✅ Approve
              </button>
            </div>
          ))}
        </section>
      )}

      <section
        style={{
          background: "white",
          borderRadius: 18,
          padding: 14,
          marginBottom: 14,
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
          }}
        >
          {provinces.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>

        <label style={{ fontWeight: 700 }}>
          <input
            type="checkbox"
            checked={truckMode}
            onChange={() => setTruckMode(!truckMode)}
          />{" "}
          🚛 Truck Mode
        </label>

        <label style={{ fontWeight: 700, marginLeft: 14 }}>
          <input
            type="checkbox"
            checked={open24}
            onChange={() => setOpen24(!open24)}
          />{" "}
          🕒 Open 24h
        </label>
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
        }}
      />

      {filtered.length > 0 && (
        <section
          style={{
            background: "#111827",
            color: "white",
            padding: 18,
            borderRadius: 20,
            marginBottom: 14,
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 18 }}>
            🔥 BEST FUEL NEAR YOU
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, marginTop: 6 }}>
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
            {s.foodCourt && <span style={badge}>🍔 Food</span>}
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
              marginTop: 14,
            }}
          >
            <button
              onClick={() =>
                window.open(
                  `https://www.google.com/maps?q=${s.lat},${s.lng}`,
                  "_blank"
                )
              }
              style={{ ...button, background: "#2563eb" }}
            >
              🧭 Navigate
            </button>

            {s.phoneNumber && (
              <a href={`tel:${s.phoneNumber}`}>
                <button
                  style={{ ...button, background: "#111827" }}
                >
                  📞 Call
                </button>
              </a>
            )}

            <button
              onClick={() => reportFuelIssue(s)}
              style={{ ...button, background: "#dc2626" }}
            >
              ⚠️ Report Fuel Issue
            </button>

            <button
              onClick={() => updateFuelPrice(s)}
              style={{ ...button, background: "#059669" }}
            >
              💸 Update Price
            </button>
          </div>
        </article>
      ))}
    </main>
  );
}