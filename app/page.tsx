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

  async function reportOutOfFuel(station: any) {
    await addDoc(collection(db, "reports"), {
      stationId: station.id,
      stationName: station.name,
      type: "OUT_OF_FUEL",
      createdAt: serverTimestamp(),
    });

    alert("Fuel issue reported. Thank you.");
  }

  // 🔥 MULTI FUEL UPDATE
  async function updateFuelPrice(station: any) {
    const fuelType = prompt(
      `Which fuel price do you want to update?\n\ndiesel50\npetrol93\npetrol95`
    );

    if (!fuelType) return;

    const cleanFuelType = fuelType.trim().toLowerCase();

    const allowedTypes: any = {
      diesel50: "Diesel 50ppm",
      petrol93: "Petrol 93",
      petrol95: "Petrol 95",
    };

    if (!allowedTypes[cleanFuelType]) {
      alert("Invalid fuel type.");
      return;
    }

    const oldPrice = station[cleanFuelType];

    const value = prompt(
      `Enter new price for ${allowedTypes[cleanFuelType]}:`,
      oldPrice ? String(oldPrice) : ""
    );

    if (!value) return;

    const newPrice = Number(value.replace(",", "."));

    if (Number.isNaN(newPrice)) {
      alert("Invalid price.");
      return;
    }

    await addDoc(collection(db, "priceUpdates"), {
      stationId: station.id,
      stationName: station.name,
      fuelType: cleanFuelType,
      oldPrice: oldPrice ?? null,
      newPrice,
      createdAt: serverTimestamp(),
    });

    alert("Price update submitted.");
  }

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
    .sort((a, b) => {
      return (a.diesel50 ?? 9999) - (b.diesel50 ?? 9999);
    });

  const badge = {
    background: "#f3f4f6",
    padding: "6px 10px",
    borderRadius: 999,
    marginRight: 5,
  };

  const handleAddStation = () => {
    const msg = encodeURIComponent(
      "Hi, I want to add a station:\nName:\nLocation:\nDiesel Price:"
    );
    window.open(`https://wa.me/?text=${msg}`);
  };

  return (
    <main style={{ padding: 14 }}>
      <h1>Fuel Finder SA</h1>

      <button onClick={handleAddStation}>➕ Add Station</button>

      <input
        placeholder="Search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {filteredStations.map((s) => (
        <div key={s.id} style={{ marginTop: 10 }}>
          <h3>{s.name}</h3>

          <span style={badge}>Diesel: R{s.diesel50}</span>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() =>
                window.open(`https://maps.google.com?q=${s.lat},${s.lng}`)
              }
            >
              Navigate
            </button>

            {s.phoneNumber && (
              <a href={`tel:${s.phoneNumber}`}>
                <button>Call</button>
              </a>
            )}

            <button onClick={() => reportOutOfFuel(s)}>Out</button>

            <button onClick={() => updateFuelPrice(s)}>Update</button>
          </div>
        </div>
      ))}
    </main>
  );
}