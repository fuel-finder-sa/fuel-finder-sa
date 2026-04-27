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
      const snapshot = await getDocs(collection(db, "stations"));
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setStations(data);

      if (isAdmin) {
        const snap = await getDocs(collection(db, "stationSubmissions"));
        setSubmissions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
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
      alert("Enter name and location");
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

    alert("Submitted 👍");
    setShowAddForm(false);
  }

  async function approveStation(sub: any) {
    await addDoc(collection(db, "stations"), {
      name: sub.name,
      location: sub.location,
      diesel50: sub.diesel50 ?? null,
      petrol93: sub.petrol93 ?? null,
      petrol95: sub.petrol95 ?? null,
    });

    await deleteDoc(doc(db, "stationSubmissions", sub.id));

    alert("Approved ✔");
    location.reload();
  }

  async function reportFuelIssue(station: any) {
    await addDoc(collection(db, "reports"), {
      stationName: station.name,
      type: "OUT_OF_FUEL",
      createdAt: serverTimestamp(),
    });

    alert("Reported 👍");
  }

  async function updateFuelPrice(station: any) {
    const type = prompt("diesel50 / petrol93 / petrol95");
    if (!type) return;

    const value = prompt("Enter price");
    if (!value) return;

    const price = Number(value.replace(",", "."));
    if (isNaN(price)) return alert("Invalid");

    await addDoc(collection(db, "priceUpdates"), {
      stationName: station.name,
      fuelType: type,
      newPrice: price,
      createdAt: serverTimestamp(),
    });

    alert("Updated 👍");
  }

  const filtered = stations
    .filter((s) =>
      `${s.name} ${s.location || ""}`
        .toLowerCase()
        .includes(search.toLowerCase())
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
    <main style={{ maxWidth: 500, margin: "0 auto", padding: 14 }}>
      <h2>Fuel Finder SA</h2>

      <button onClick={() => setShowAddForm(!showAddForm)}>
        ➕ Add Station
      </button>

      {showAddForm && (
        <div style={{ marginTop: 10 }}>
          <input placeholder="Name" onChange={(e) => setNewStation({ ...newStation, name: e.target.value })} />
          <input placeholder="Location" onChange={(e) => setNewStation({ ...newStation, location: e.target.value })} />
          <input placeholder="Diesel" onChange={(e) => setNewStation({ ...newStation, diesel50: e.target.value })} />
          <input placeholder="P93" onChange={(e) => setNewStation({ ...newStation, petrol93: e.target.value })} />
          <input placeholder="P95" onChange={(e) => setNewStation({ ...newStation, petrol95: e.target.value })} />

          <button onClick={submitStation}>Submit</button>
        </div>
      )}

      {isAdmin && (
        <div style={{ marginTop: 20 }}>
          <h3>Admin</h3>
          {submissions.map((s) => (
            <div key={s.id}>
              <b>{s.name}</b>
              <button onClick={() => approveStation(s)}>Approve</button>
            </div>
          ))}
        </div>
      )}

      <input
        placeholder="Search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {filtered.map((s) => (
        <div key={s.id} style={{ marginTop: 10 }}>
          <b>{s.name}</b>

          <div>
            Diesel: R{s.diesel50}
            {s.petrol93 && ` | Petrol 93: R${s.petrol93}`}
            {s.petrol95 && ` | Petrol 95: R${s.petrol95}`}
          </div>

          <button onClick={() => reportFuelIssue(s)}>⚠️ Report</button>
          <button onClick={() => updateFuelPrice(s)}>💸 Update</button>
        </div>
      ))}
    </main>
  );
}