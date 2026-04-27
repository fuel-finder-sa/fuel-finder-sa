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

  // 🔴 REPORT FUEL ISSUE
  async function reportFuelIssue(station: any) {
    await addDoc(collection(db, "reports"), {
      stationId: station.id,
      stationName: station.name,
      type: "OUT_OF_FUEL",
      createdAt: serverTimestamp(),
    });

    alert("Fuel issue reported. Thank you.");
  }

  // 💸 MULTI FUEL UPDATE
  async function updateFuelPrice(station: any) {
    const fuelType = prompt(
      "Which fuel?\ndiesel50\npetrol93\npetrol95"
    );

    if (!fuelType) return;

    const type = fuelType.toLowerCase();

    const labels: any = {
      diesel50: "Diesel 50ppm",
      petrol93: "Petrol 93",
      petrol95: "Petrol 95",
    };

    if (!labels[type]) {
      alert("Invalid fuel type");
      return;
    }

    const value = prompt("Enter new price:");
    if (!value) return;

    const price = Number(value.replace(",", "."));

    if (isNaN(price)) {
      alert("Invalid price");
      return;
    }

    await addDoc(collection(db, "priceUpdates"), {
      stationId: station.id,
      stationName: station.name,
      fuelType: type,
      newPrice: price,
      createdAt: serverTimestamp(),
    });

    alert("Price update submitted 👍");
  }

  // 📲 FIXED WHATSAPP
  const handleAddStation = () => {
    const message = encodeURIComponent(
      "Hi, I want to add a fuel station:\n\nName:\nLocation:\nDiesel Price:\nPetrol 93:\nPetrol 95:\nFeatures:"
    );

    window.open(`https://wa.me/27829371858?text=${message}`, "_blank");
  };

  const provinces = [
    "All",
    ...Array.from(new Set(stations.map((s) => s.province).filter(Boolean))),
  ];

  const filteredStations = stations
    .filter((s) => {
      const text = `${s.name || ""} ${s.city || ""}`.toLowerCase();
      return (
        text.includes(search.toLowerCase()) &&
        (province === "All" || s.province === province)
      );
    })
    .map((s) => {
      const distanceKm =
        userLocation && s.lat && s.lng
          ? getDistanceKm(userLocation.lat, userLocation.lng, s.lat, s.lng)
          : null;

      return { ...s, distanceKm };
    })
    .sort((a, b) => (a.diesel50 ?? 9999) - (b.diesel50 ?? 9999));

  const badge = {
    background: "#f3f4f6",
    padding: "6px 10px",
    borderRadius: 999,
    marginRight: 5,
  };

  const button = {
    flex: 1,
    color: "white",
    padding: 10,
    borderRadius: 10,
    border: "none",
  };

  return (
    <main style={{ background: "#f8fafc", padding: 14 }}>
      
      {/* HEADER */}
      <div style={{ background: "#0f172a", color: "white", padding: 20, borderRadius: 20 }}>
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
          style={{ background: "#22c55e", padding: 10, borderRadius: 10, color: "white" }}
        >
          📍 Use My Location
        </button>

        <button
          onClick={handleAddStation}
          style={{ background: "#f59e0b", padding: 10, borderRadius: 10, color: "white", marginLeft: 10 }}
        >
          ➕ Add Station
        </button>
      </div>

      {/* SEARCH */}
      <input
        placeholder="Search..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: "100%", marginTop: 10, padding: 10 }}
      />

      {/* LIST */}
      {filteredStations.map((s) => (
        <div key={s.id} style={{ background: "white", marginTop: 10, padding: 15, borderRadius: 15 }}>
          <h3>{s.name}</h3>

          <span style={badge}>Diesel: R{s.diesel50}</span>
          {s.petrol93 && <span style={badge}>P93: R{s.petrol93}</span>}
          {s.petrol95 && <span style={badge}>P95: R{s.petrol95}</span>}

          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button onClick={() => window.open(`https://maps.google.com?q=${s.lat},${s.lng}`)} style={{ ...button, background: "#2563eb" }}>
              🧭 Navigate
            </button>

            {s.phoneNumber && (
              <a href={`tel:${s.phoneNumber}`}>
                <button style={{ ...button, background: "#111827" }}>
                  📞 Call
                </button>
              </a>
            )}

            <button onClick={() => reportFuelIssue(s)} style={{ ...button, background: "#dc2626" }}>
              ⚠️ Report Fuel Issue
            </button>

            <button onClick={() => updateFuelPrice(s)} style={{ ...button, background: "#059669" }}>
              💸 Update Price
            </button>
          </div>
        </div>
      ))}
    </main>
  );
}