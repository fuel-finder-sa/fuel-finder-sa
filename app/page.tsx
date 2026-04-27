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

  // 🔥 DUPLICATE CHECK INCLUDED
  async function submitStation() {
    if (!newStation.name || !newStation.location) {
      alert("Please add station name and location");
      return;
    }

    const existing = stations.find((s) => {
      const nameMatch =
        s.name?.toLowerCase().trim() ===
        newStation.name.toLowerCase().trim();

      const locationMatch =
        (s.suburb || s.city || "")
          .toLowerCase()
          .includes(newStation.location.toLowerCase().trim());

      return nameMatch && locationMatch;
    });

    if (existing) {
      alert("⚠️ This station may already exist.");
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
      stationName: s.name,
      type: "OUT_OF_FUEL",
      createdAt: serverTimestamp(),
    });

    alert("Reported 👍");
  }

  async function updateFuelPrice(s: any) {
    const type = prompt("diesel50 / petrol93 / petrol95");
    if (!type) return;

    const value = prompt("Enter price");
    if (!value) return;

    const price = Number(value.replace(",", "."));
    if (isNaN(price)) return alert("Invalid");

    await addDoc(collection(db, "priceUpdates"), {
      stationName: s.name,
      fuelType: type,
      newPrice: price,
      createdAt: serverTimestamp(),
    });

    alert("Updated 👍");
  }

  const provinces = [
    "All",
    ...Array.from(new Set(stations.map((s) => s.province).filter(Boolean))),
  ];

  const filtered = stations
    .filter((s) => {
      const text = `${s.name} ${s.suburb || ""} ${s.city || ""} ${s.province || ""}`.toLowerCase();

      return (
        text.includes(search.toLowerCase()) &&
        (province === "All" || s.province === province) &&
        (!truckMode || s.truckFriendly) &&
        (!open24 || s.open24Hours)
      );
    })
    .sort((a, b) => (a.diesel50 ?? 9999) - (b.diesel50 ?? 9999));

  const button = {
    color: "white",
    padding: 10,
    borderRadius: 10,
    border: "none",
    fontWeight: 700,
    width: "100%",
  };

  return (
    <main style={{ maxWidth: 700, margin: "0 auto", padding: 14 }}>
      
      {/* HEADER */}
      <div style={{ background: "#0f172a", color: "white", padding: 18, borderRadius: 18 }}>
        <h2>Fuel Finder SA</h2>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          style={{ width: "100%", background: "#f59e0b", padding: 12, borderRadius: 12 }}
        >
          ➕ Add Station
        </button>
      </div>

      {/* ADD FORM */}
      {showAddForm && (
        <div style={{ background: "white", padding: 14, marginTop: 10, borderRadius: 14 }}>
          {["name", "location", "diesel50", "petrol93", "petrol95"].map((f) => (
            <input
              key={f}
              placeholder={f}
              onChange={(e) => setNewStation({ ...newStation, [f]: e.target.value })}
              style={{ width: "100%", marginBottom: 8, padding: 10 }}
            />
          ))}

          <button onClick={submitStation} style={{ ...button, background: "#059669" }}>
            Submit
          </button>
        </div>
      )}

      {/* ADMIN */}
      {isAdmin && (
        <div style={{ background: "#111827", color: "white", padding: 14, marginTop: 10, borderRadius: 14 }}>
          <h3>Admin</h3>
          {submissions.map((s) => (
            <div key={s.id}>
              {s.name}
              <button onClick={() => approveStation(s)}>Approve</button>
            </div>
          ))}
        </div>
      )}

      {/* FILTERS */}
      <select value={province} onChange={(e) => setProvince(e.target.value)}>
        {provinces.map((p) => (
          <option key={p}>{p}</option>
        ))}
      </select>

      <label>
        <input type="checkbox" onChange={() => setTruckMode(!truckMode)} /> Truck
      </label>

      <label>
        <input type="checkbox" onChange={() => setOpen24(!open24)} /> 24h
      </label>

      {/* SEARCH */}
      <input
        placeholder="Search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: "100%", marginTop: 10, padding: 10 }}
      />

      {/* LIST */}
      {filtered.map((s) => (
        <div key={s.id} style={{ background: "white", padding: 14, marginTop: 10, borderRadius: 12 }}>
          <b>{s.name}</b>

          <div>
            Diesel: R{s.diesel50} | Petrol 93: R{s.petrol93} | Petrol 95: R{s.petrol95}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ ...button, background: "#dc2626" }} onClick={() => reportFuelIssue(s)}>
              ⚠️ Report
            </button>

            <button style={{ ...button, background: "#059669" }} onClick={() => updateFuelPrice(s)}>
              💸 Update
            </button>
          </div>
        </div>
      ))}
    </main>
  );
}