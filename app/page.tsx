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

export default function Home() {
  const [stations, setStations] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [search, setSearch] = useState("");
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
  });

  useEffect(() => {
    async function fetchData() {
      const snap = await getDocs(collection(db, "stations"));
      setStations(snap.docs.map(d => ({ id: d.id, ...d.data() })));

      if (isAdmin) {
        const sub = await getDocs(collection(db, "stationSubmissions"));
        setSubmissions(sub.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    }

    fetchData();
  }, []);

  async function submitStation() {
    await addDoc(collection(db, "stationSubmissions"), {
      ...newStation,
      diesel50: Number(newStation.diesel50),
      petrol93: Number(newStation.petrol93),
      petrol95: Number(newStation.petrol95),
      createdAt: serverTimestamp(),
    });

    alert("Submitted 👍");
    setShowAddForm(false);
  }

  async function approveStation(s: any) {
    await addDoc(collection(db, "stations"), s);
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
    alert("Reported");
  }

  async function updateFuelPrice(s: any) {
    const type = prompt("diesel50 / petrol93 / petrol95");
    if (!type) return;

    const val = prompt("Enter price");
    if (!val) return;

    await addDoc(collection(db, "priceUpdates"), {
      stationName: s.name,
      fuelType: type,
      newPrice: Number(val),
      createdAt: serverTimestamp(),
    });

    alert("Updated");
  }

  const filtered = stations.filter(s =>
    `${s.name}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: 14, fontFamily: "Arial" }}>
      
      {/* HEADER */}
      <div style={{
        background: "#0f172a",
        color: "white",
        padding: 18,
        borderRadius: 18
      }}>
        <h2 style={{ margin: 0 }}>Fuel Finder SA</h2>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          style={{
            marginTop: 10,
            width: "100%",
            padding: 12,
            borderRadius: 12,
            background: "#f59e0b",
            color: "white",
            border: "none",
            fontWeight: 700
          }}
        >
          ➕ Add Station
        </button>
      </div>

      {/* ADD FORM */}
      {showAddForm && (
        <div style={{
          background: "white",
          padding: 14,
          marginTop: 10,
          borderRadius: 14,
          boxShadow: "0 4px 10px rgba(0,0,0,0.1)"
        }}>
          <input placeholder="Name" onChange={e => setNewStation({ ...newStation, name: e.target.value })} style={{ width: "100%", marginBottom: 8, padding: 10 }} />
          <input placeholder="Location" onChange={e => setNewStation({ ...newStation, location: e.target.value })} style={{ width: "100%", marginBottom: 8, padding: 10 }} />
          <input placeholder="Diesel" onChange={e => setNewStation({ ...newStation, diesel50: e.target.value })} style={{ width: "100%", marginBottom: 8, padding: 10 }} />
          <input placeholder="Petrol 93" onChange={e => setNewStation({ ...newStation, petrol93: e.target.value })} style={{ width: "100%", marginBottom: 8, padding: 10 }} />
          <input placeholder="Petrol 95" onChange={e => setNewStation({ ...newStation, petrol95: e.target.value })} style={{ width: "100%", marginBottom: 8, padding: 10 }} />

          <button onClick={submitStation} style={{
            width: "100%",
            background: "#059669",
            color: "white",
            padding: 12,
            borderRadius: 10,
            border: "none",
            fontWeight: 700
          }}>
            Submit Station
          </button>
        </div>
      )}

      {/* ADMIN */}
      {isAdmin && (
        <div style={{
          background: "#111827",
          color: "white",
          padding: 14,
          marginTop: 10,
          borderRadius: 14
        }}>
          <h3>Admin Submissions</h3>
          {submissions.map(s => (
            <div key={s.id} style={{ marginTop: 8 }}>
              {s.name}
              <button
                onClick={() => approveStation(s)}
                style={{
                  marginLeft: 10,
                  background: "#22c55e",
                  color: "white",
                  border: "none",
                  padding: 6,
                  borderRadius: 6
                }}
              >
                Approve
              </button>
            </div>
          ))}
        </div>
      )}

      {/* SEARCH */}
      <input
        placeholder="Search"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          width: "100%",
          marginTop: 10,
          padding: 12,
          borderRadius: 12,
          border: "1px solid #ddd"
        }}
      />

      {/* STATIONS */}
      {filtered.map(s => (
        <div key={s.id} style={{
          background: "white",
          padding: 16,
          marginTop: 10,
          borderRadius: 16,
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)"
        }}>
          <h3 style={{ margin: 0 }}>{s.name}</h3>

          <div style={{ marginTop: 6 }}>
            Diesel: R{s.diesel50} | Petrol 93: R{s.petrol93} | Petrol 95: R{s.petrol95}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button style={{ flex: 1, background: "#dc2626", color: "white", padding: 10, borderRadius: 10 }}>
              ⚠️ Report
            </button>

            <button style={{ flex: 1, background: "#059669", color: "white", padding: 10, borderRadius: 10 }}>
              💸 Update
            </button>
          </div>
        </div>
      ))}
    </main>
  );
}