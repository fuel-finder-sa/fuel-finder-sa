"use client";

import { useEffect, useState } from "react";

import { db } from "../../firebase";
import { collection, getDocs, addDoc } from "firebase/firestore";

type Station = {
  id?: string;
  name: string;
  suburb: string;
  province: string;
  diesel50: number;
  petrol93: number;
  petrol95: number;
};

export default function OwnerPortal() {
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
const [stationIdFromUrl, setStationIdFromUrl] = useState<string | null>(null);
const [stationNameFromUrl, setStationNameFromUrl] = useState<string | null>(null);

useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  setStationIdFromUrl(params.get("stationId"));
  setStationNameFromUrl(params.get("stationName"));
}, []);
  const [diesel50, setDiesel50] = useState("");
  const [petrol93, setPetrol93] = useState("");
  const [petrol95, setPetrol95] = useState("");
  const [lpgGasPrice, setLpgGasPrice] = useState("");

  const [gas9kg, setGas9kg] = useState(false);
  const [gas19kg, setGas19kg] = useState(false);
  const [gas48kg, setGas48kg] = useState(false);
  const [open24h, setOpen24h] = useState(false);
  const [truckFriendly, setTruckFriendly] = useState(false);
  const [safeOvernight, setSafeOvernight] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    loadStations();
  }, []);
useEffect(() => {
  if (stationIdFromUrl) {
    setSelectedId(stationIdFromUrl);
  }
}, [stationIdFromUrl]);
  async function loadStations() {
    const snap = await getDocs(collection(db, "stations"));
    const list: Station[] = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Station),
    }));

    setStations(list);
  }

  async function submitUpdate() {
    if (!selectedId || !ownerName || !contactNumber) {
      alert("Please select station, add your name and contact number.");
      return;
    }

    const station = stations.find((s) => s.id === selectedId);

    if (!station) {
      alert("Station not found.");
      return;
    }

    await addDoc(collection(db, "pendingUpdates"), {
      stationId: selectedId,
      stationName: station.name,
      suburb: station.suburb,
      province: station.province,

      ownerName,
      contactNumber,

      diesel50: Number(diesel50 || station.diesel50),
      petrol93: Number(petrol93 || station.petrol93),
      petrol95: Number(petrol95 || station.petrol95),
      lpgGasPrice: Number(lpgGasPrice || 0),

      gas9kg,
      gas19kg,
      gas48kg,
      open24h,
      truckFriendly,
      safeOvernight,

      notes,
      status: "pending",
      createdAt: new Date(),
    });

    alert("Update submitted for admin approval.");

    setSelectedId("");
    setOwnerName("");
    setContactNumber("");
    setDiesel50("");
    setPetrol93("");
    setPetrol95("");
    setLpgGasPrice("");
    setGas9kg(false);
    setGas19kg(false);
    setGas48kg(false);
    setOpen24h(false);
    setTruckFriendly(false);
    setSafeOvernight(false);
    setNotes("");
  }

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <h1>Fuel Finder SA</h1>
        <p>Garage Owner Update Portal</p>
      </section>
{stationNameFromUrl && (
  <div style={styles.noticeBox}>
    🏢 Claiming listing for: <b>{stationNameFromUrl}</b>
  </div>
)}
      <section style={styles.card}>
        <label>Owner / Manager Name</label>
        <input
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
          placeholder="Your name"
          style={styles.input}
        />

        <label>Contact Number</label>
        <input
          value={contactNumber}
          onChange={(e) => setContactNumber(e.target.value)}
          placeholder="Cell number"
          style={styles.input}
        />

        <label>Select Station</label>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          style={styles.input}
        >
          <option value="">Select station...</option>
          {stations.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} - {s.suburb}
            </option>
          ))}
        </select>

        <h3>Fuel Prices</h3>

        <label>Diesel 50 Price</label>
        <input
          type="number"
          value={diesel50}
          onChange={(e) => setDiesel50(e.target.value)}
          placeholder="Example: 22.95"
          style={styles.input}
        />

        <label>Petrol 93 Price</label>
        <input
          type="number"
          value={petrol93}
          onChange={(e) => setPetrol93(e.target.value)}
          placeholder="Example: 23.10"
          style={styles.input}
        />

        <label>Petrol 95 Price</label>
        <input
          type="number"
          value={petrol95}
          onChange={(e) => setPetrol95(e.target.value)}
          placeholder="Example: 23.45"
          style={styles.input}
        />

        <label>LPG Gas Price</label>
        <input
          type="number"
          value={lpgGasPrice}
          onChange={(e) => setLpgGasPrice(e.target.value)}
          placeholder="Example: 34.99"
          style={styles.input}
        />

        <h3>Gas Availability</h3>

        <label style={styles.checkRow}>
          <input
            type="checkbox"
            checked={gas9kg}
            onChange={(e) => setGas9kg(e.target.checked)}
          />
          9kg Gas Available
        </label>

        <label style={styles.checkRow}>
          <input
            type="checkbox"
            checked={gas19kg}
            onChange={(e) => setGas19kg(e.target.checked)}
          />
          19kg Gas Available
        </label>

        <label style={styles.checkRow}>
          <input
            type="checkbox"
            checked={gas48kg}
            onChange={(e) => setGas48kg(e.target.checked)}
          />
          48kg Gas Available
        </label>

        <h3>Station Services</h3>

        <label style={styles.checkRow}>
          <input
            type="checkbox"
            checked={open24h}
            onChange={(e) => setOpen24h(e.target.checked)}
          />
          Open 24h
        </label>

        <label style={styles.checkRow}>
          <input
            type="checkbox"
            checked={truckFriendly}
            onChange={(e) => setTruckFriendly(e.target.checked)}
          />
          Truck Friendly
        </label>

        <label style={styles.checkRow}>
          <input
            type="checkbox"
            checked={safeOvernight}
            onChange={(e) => setSafeOvernight(e.target.checked)}
          />
          Safe Overnight Request
        </label>

        <label>Notes / Comments</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any additional notes for admin approval..."
          style={styles.textarea}
        />

        <button onClick={submitUpdate} style={styles.greenBtn}>
          Submit for Approval
        </button>
        <button
  onClick={() => (window.location.href = "/")}
  style={styles.backBtn}
>
  ⬅ Back to Fuel Finder
</button>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: "24px",
    fontFamily: "Arial, sans-serif",
    background: "#eef3f8",
    minHeight: "100vh",
  },
  hero: {
    background: "#142033",
    color: "white",
    padding: "28px",
    borderRadius: "24px",
    marginBottom: "20px",
  },
  card: {
    background: "white",
    padding: "22px",
    borderRadius: "18px",
  },
  input: {
    width: "100%",
    padding: "14px",
    margin: "8px 0 16px",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
  },
  textarea: {
    width: "100%",
    minHeight: "100px",
    padding: "14px",
    margin: "8px 0 16px",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
  },
  checkRow: {
    display: "block",
    marginBottom: "12px",
    fontWeight: "bold",
  },
  greenBtn: {
    width: "100%",
    padding: "14px",
    background: "#22c55e",
    color: "white",
    border: "none",
    borderRadius: "12px",
    fontWeight: "bold",
  },
  noticeBox: {
  background: "#ecfdf5",
  padding: "14px",
  borderRadius: "12px",
  marginBottom: "16px",
  color: "#166534",
  fontWeight: "bold",
},
};