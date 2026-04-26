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
      stationId: station.id,
      stationName: station.name,
      type: "OUT_OF_FUEL",
      diesel50: station.diesel50 ?? null,
      petrol93: station.petrol93 ?? null,
      petrol95: station.petrol95 ?? null,
      suburb: station.suburb ?? "",
      city: station.city ?? "",
      province: station.province ?? "",
      createdAt: serverTimestamp(),
    });

    alert("Out of fuel report submitted. Thank you.");
  }

  async function updateFuelPrice(station: any) {
    const fuelType = prompt(
      `Which fuel price do you want to update?\n\nType one:\ndiesel50\npetrol93\npetrol95`
    );

    if (!fuelType) return;

    const type = fuelType.trim().toLowerCase();

    const fuelLabels: any = {
      diesel50: "Diesel 50ppm",
      petrol93: "Petrol 93",
      petrol95: "Petrol 95",
    };

    if (!fuelLabels[type]) {
      alert("Invalid fuel type. Type diesel50, petrol93, or petrol95.");
      return;
    }

    const value = prompt(`Enter new price for ${fuelLabels[type]}:`, station[type] ? String(station[type]) : "");

    if (!value) return;

    const newPrice = Number(value.replace(",", "."));

    if (Number.isNaN(newPrice) || newPrice <= 0) {
      alert("Please enter a valid price.");
      return;
    }

    await addDoc(collection(db, "priceUpdates"), {
      stationId: station.id,
      stationName: station.name,
      fuelType: type,
      fuelLabel: fuelLabels[type],
      oldPrice: station[type] ?? null,
      newPrice,
      suburb: station.suburb ?? "",
      city: station.city ?? "",
      province: station.province ?? "",
      createdAt: serverTimestamp(),
    });

    alert(`${fuelLabels[type]} update submitted. Thank you.`);
  }

  const handleAddStation = () => {
    const message = encodeURIComponent(
      `Hi, I want to add a fuel station:\n\nName:\nLocation:\nDiesel Price:\nPetrol 93:\nPetrol 95:\nFeatures:`
    );
    window.open(`https://wa.me/?text=${message}`, "_blank");
  };

  const provinces = [
    "All",
    ...Array.from(new Set(stations.map((s) => s.province).filter(Boolean))),
  ];

  const filteredStations = stations
    .filter((s) => {
      const text = `${s.name || ""} ${s.suburb || ""} ${s.city || ""} ${s.province || ""}`.toLowerCase();

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
    minWidth: 125,
    color: "white",
    padding: "11px 12px",
    borderRadius: 12,
    border: "none",
    fontWeight: 800,
    fontSize: 14,
  };

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", padding: 14, maxWidth: 760, margin: "0 auto", fontFamily: "Arial" }}>
      <section style={{ background: "linear-gradient(135deg,#0f172a,#1e293b)", color: "white", padding: 22, borderRadius: 24, marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 30 }}>Fuel Finder SA</h1>
        <p style={{ color: "#cbd5e1" }}>Find cheapest & safest fuel stops.</p>

        <button
          onClick={() => {
            navigator.geolocation.getCurrentPosition((pos) => {
              setUserLocation({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
              });
            });
          }}
          style={{ background: "#22c55e", color: "white", padding: "12px 14px", borderRadius: 12, border: "none", fontWeight: 800, marginRight: 10 }}
        >
          📍 Use My Location
        </button>

        <button
          onClick={handleAddStation}
          style={{ background: "#f59e0b", color: "white", padding: "12px 14px", borderRadius: 12, border: "none", fontWeight: 800 }}
        >
          ➕ Add Station
        </button>
      </section>

      <section style={{ background: "white", borderRadius: 18, padding: 14, marginBottom: 14 }}>
        <select
          value={province}
          onChange={(e) => setProvince(e.target.value)}
          style={{ width: "100%", padding: 13, borderRadius: 14, border: "1px solid #d1d5db", marginBottom: 10 }}
        >
          {provinces.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>

        <label style={{ fontWeight: 700 }}>
          <input type="checkbox" checked={truckMode} onChange={() => setTruckMode(!truckMode)} /> 🚛 Truck Mode
        </label>

        <label style={{ fontWeight: 700, marginLeft: 14 }}>
          <input type="checkbox" checked={open24} onChange={() => setOpen24(!open24)} /> 🕒 Open 24h
        </label>
      </section>

      <input
        placeholder="Search station, suburb, city..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: "100%", padding: 15, borderRadius: 16, border: "1px solid #d1d5db", marginBottom: 16, boxSizing: "border-box" }}
      />

      {filteredStations.length > 0 && (
        <section style={{ background: "#111827", color: "white", padding: 18, borderRadius: 20, marginBottom: 14 }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>🔥 BEST FUEL NEAR YOU</div>
          <div style={{ fontSize: 20, fontWeight: 900, marginTop: 6 }}>{filteredStations[0].name}</div>
          <div style={{ marginTop: 8 }}>💸 Diesel: <b>R{filteredStations[0].diesel50}</b></div>
          {filteredStations[0].distanceKm !== null && (
            <div style={{ marginTop: 4 }}>📍 {filteredStations[0].distanceKm.toFixed(1)} km away</div>
          )}
        </section>
      )}

      {filteredStations.map((s, index) => (
        <article key={s.id} style={{ background: "white", borderRadius: 22, padding: 18, marginBottom: 14, border: "1px solid #e5e7eb", boxShadow: "0 6px 18px rgba(0,0,0,0.07)" }}>
          <h2 style={{ margin: 0, fontSize: 22 }}>{s.name}</h2>

          <p style={{ color: "#6b7280", fontSize: 16, marginTop: 6 }}>
            {s.suburb}, {s.city}, {s.province}
          </p>

          <div>
            <span style={badge}>Diesel: R{s.diesel50}</span>
            {s.petrol93 && <span style={badge}>Petrol 93: R{s.petrol93}</span>}
            {s.petrol95 && <span style={badge}>Petrol 95: R{s.petrol95}</span>}
            {s.distanceKm !== null && <span style={{ ...badge, background: "#bbf7d0", color: "#166534" }}>📍 {s.distanceKm.toFixed(1)} km</span>}
            {index === 0 && <span style={{ ...badge, background: "#dcfce7", color: "#166534" }}>⭐ Best Option</span>}
          </div>

          <div style={{ marginTop: 12 }}>
            {s.truckFriendly && <span style={badge}>🚛 Truck</span>}
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

          <div style={{ display: "flex", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
            <button onClick={() => window.open(`https://www.google.com/maps?q=${s.lat},${s.lng}`, "_blank")} style={{ ...button, background: "#2563eb" }}>
              🧭 Navigate
            </button>

            {s.phoneNumber && (
              <a href={`tel:${s.phoneNumber}`} style={{ flex: 1, minWidth: 125 }}>
                <button style={{ ...button, width: "100%", background: "#111827" }}>📞 Call</button>
              </a>
            )}

            <button onClick={() => reportFuelIssue(s)} style={{ ...button, background: "#dc2626" }}>
              ⚠️ Report Fuel Issue
            </button>

            <button onClick={() => updateFuelPrice(s)} style={{ ...button, background: "#059669" }}>
              💸 Update Price
            </button>
          </div>
        </article>
      ))}
    </main>
  );
}