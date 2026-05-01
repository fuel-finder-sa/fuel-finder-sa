"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
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
  const [priceSubmissions, setPriceSubmissions] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [province, setProvince] = useState("All");
  const [truckMode, setTruckMode] = useState(false);
  const [open24, setOpen24] = useState(false);
  const [userLocation, setUserLocation] = useState<any>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [selectedStation, setSelectedStation] = useState<any>(null);

  const [newStation, setNewStation] = useState({
    name: "",
    location: "",
    diesel50: "",
    petrol93: "",
    petrol95: "",
    features: "",
  });

  const [reportType, setReportType] = useState("OUT_OF_FUEL");
  const [fuelType, setFuelType] = useState("diesel50");
  const [newPrice, setNewPrice] = useState("");

  const isAdmin =
    typeof window !== "undefined" &&
    window.location.search.includes("admin=true");

  useEffect(() => {
    async function fetchData() {
      const snap = await getDocs(collection(db, "stations"));
      setStations(snap.docs.map((d) => ({ id: d.id, ...d.data() })));

      if (isAdmin) {
        const priceSnap = await getDocs(collection(db, "priceUpdates"));
        setPriceSubmissions(
          priceSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
        );
      }

      navigator.geolocation?.getCurrentPosition((pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      });
    }

    fetchData();
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
    setShowAddForm(false);
  }

  async function submitReport() {
    if (!selectedStation) return;

    await addDoc(collection(db, "reports"), {
      stationId: selectedStation.id,
      stationName: selectedStation.name,
      type: reportType,
      createdAt: serverTimestamp(),
    });

    alert("Report submitted. Thank you.");
    setShowReportForm(false);
    setSelectedStation(null);
  }

  async function submitPriceUpdate() {
    if (!selectedStation || !newPrice) {
      alert("Please enter a price.");
      return;
    }

    const price = Number(newPrice.replace(",", "."));

    if (Number.isNaN(price) || price <= 0) {
      alert("Invalid price.");
      return;
    }

    const labels: any = {
      diesel50: "Diesel 50ppm",
      petrol93: "Petrol 93",
      petrol95: "Petrol 95",
    };

    await addDoc(collection(db, "priceUpdates"), {
      stationId: selectedStation.id,
      stationName: selectedStation.name,
      fuelType,
      fuelLabel: labels[fuelType],
      oldPrice: selectedStation[fuelType] ?? null,
      newPrice: price,
      createdAt: serverTimestamp(),
    });

    alert("Price update submitted. Thank you.");
    setShowUpdateForm(false);
    setSelectedStation(null);
    setNewPrice("");
  }

  async function approvePrice(p: any) {
    if (!p.stationId || !p.fuelType) {
      alert("This update is missing station info.");
      return;
    }

    await updateDoc(doc(db, "stations", p.stationId), {
      [p.fuelType]: p.newPrice,
    });

    await deleteDoc(doc(db, "priceUpdates", p.id));

    alert("Approved and updated live.");
    location.reload();
  }

  const provinces = [
    "All",
    ...Array.from(new Set(stations.map((s) => s.province).filter(Boolean))),
  ];

  const filtered = stations
    .filter((s) => {
      const txt = `${s.name || ""} ${s.suburb || ""} ${s.city || ""} ${
        s.province || ""
      }`.toLowerCase();

      return (
        txt.includes(search.toLowerCase()) &&
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

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: 12,
    marginBottom: 10,
    borderRadius: 12,
    border: "1px solid #d1d5db",
    boxSizing: "border-box",
  };

  function Modal({ children }: any) {
    return (
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
          {children}
        </div>
      </div>
    );
  }

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
            style={{ ...actionButton, background: "#22c55e", width: "auto" }}
          >
            📍 Use My Location
          </button>

          <button
            onClick={() => setShowAddForm(true)}
            style={{ ...actionButton, background: "#f59e0b", width: "auto" }}
          >
            ➕ Add Station
          </button>
        </div>
      </section>

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
          <h3>Pending Price Updates</h3>

          {priceSubmissions.length === 0 && <p>No pending updates</p>}

          {priceSubmissions.map((p) => (
            <div
              key={p.id}
              style={{
                background: "#1f2937",
                padding: 10,
                marginTop: 8,
                borderRadius: 10,
              }}
            >
              <b>{p.stationName}</b>
              <div>Fuel: {p.fuelLabel || p.fuelType}</div>
              <div>New Price: R{p.newPrice}</div>

              <button
                onClick={() => approvePrice(p)}
                style={{
                  marginTop: 8,
                  background: "#22c55e",
                  color: "white",
                  padding: 8,
                  borderRadius: 8,
                  border: "none",
                  fontWeight: 800,
                }}
              >
                ✅ Approve
              </button>
            </div>
          ))}
        </section>
      )}

      {showAddForm && (
        <Modal>
          <h2 style={{ marginTop: 0 }}>Add Station</h2>

          <input
            placeholder="Station Name"
            style={inputStyle}
            onChange={(e) =>
              setNewStation({ ...newStation, name: e.target.value })
            }
          />
          <input
            placeholder="Location / suburb / town"
            style={inputStyle}
            onChange={(e) =>
              setNewStation({ ...newStation, location: e.target.value })
            }
          />
          <input
            placeholder="Diesel 50ppm price"
            style={inputStyle}
            onChange={(e) =>
              setNewStation({ ...newStation, diesel50: e.target.value })
            }
          />
          <input
            placeholder="Petrol 93 price"
            style={inputStyle}
            onChange={(e) =>
              setNewStation({ ...newStation, petrol93: e.target.value })
            }
          />
          <input
            placeholder="Petrol 95 price"
            style={inputStyle}
            onChange={(e) =>
              setNewStation({ ...newStation, petrol95: e.target.value })
            }
          />
          <input
            placeholder="Features: ATM, toilets, truck wash, food court"
            style={inputStyle}
            onChange={(e) =>
              setNewStation({ ...newStation, features: e.target.value })
            }
          />

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={submitStation}
              style={{ ...actionButton, background: "#059669" }}
            >
              Submit
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              style={{ ...actionButton, background: "#dc2626" }}
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {showReportForm && selectedStation && (
        <Modal>
          <h2 style={{ marginTop: 0 }}>Report Fuel Issue</h2>
          <p>{selectedStation.name}</p>

          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            style={inputStyle}
          >
            <option value="OUT_OF_FUEL">Out of Fuel</option>
            <option value="DIESEL_UNAVAILABLE">Diesel Unavailable</option>
            <option value="PETROL_UNAVAILABLE">Petrol Unavailable</option>
            <option value="PRICE_WRONG">Price Incorrect</option>
            <option value="OTHER">Other Issue</option>
          </select>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={submitReport}
              style={{ ...actionButton, background: "#dc2626" }}
            >
              Submit Report
            </button>
            <button
              onClick={() => setShowReportForm(false)}
              style={{ ...actionButton, background: "#111827" }}
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {showUpdateForm && selectedStation && (
        <Modal>
          <h2 style={{ marginTop: 0 }}>Update Fuel Price</h2>
          <p>{selectedStation.name}</p>

          <select
            value={fuelType}
            onChange={(e) => setFuelType(e.target.value)}
            style={inputStyle}
          >
            <option value="diesel50">Diesel 50ppm</option>
            <option value="petrol93">Petrol 93</option>
            <option value="petrol95">Petrol 95</option>
          </select>

          <input
            placeholder="New price"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            style={inputStyle}
          />

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={submitPriceUpdate}
              style={{ ...actionButton, background: "#059669" }}
            >
              Submit Price
            </button>
            <button
              onClick={() => setShowUpdateForm(false)}
              style={{ ...actionButton, background: "#111827" }}
            >
              Cancel
            </button>
          </div>
        </Modal>
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
          style={inputStyle}
        >
          {provinces.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => setTruckMode(!truckMode)}
            style={{
              ...actionButton,
              background: truckMode ? "#22c55e" : "#e5e7eb",
              color: truckMode ? "white" : "#111827",
            }}
          >
            🚛 Truck Mode
          </button>

          <button
            onClick={() => setOpen24(!open24)}
            style={{
              ...actionButton,
              background: open24 ? "#22c55e" : "#e5e7eb",
              color: open24 ? "white" : "#111827",
            }}
          >
            🕒 Open 24h
          </button>
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
              onClick={() => {
                setSelectedStation(s);
                setShowReportForm(true);
              }}
              style={{ ...actionButton, background: "#dc2626" }}
            >
              ⚠️ Report Fuel Issue
            </button>

            <button
              onClick={() => {
                setSelectedStation(s);
                setFuelType("diesel50");
                setNewPrice("");
                setShowUpdateForm(true);
              }}
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