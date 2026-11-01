"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "../../firebase";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  deleteDoc,
} from "firebase/firestore";

type Station = {
  id?: string;
  name: string;
  suburb: string;
  province: string;
  diesel50: number;
  petrol93: number;
  petrol95: number;
  truckFriendly?: boolean;
  safeOvernight?: boolean;
  featured?: boolean;
  open24h?: boolean;
  lpgGasPrice?: number;
  gas9kg?: boolean;
  gas19kg?: boolean;
  gas48kg?: boolean;

};

type Report = {
  stationId: string;
  type: "out" | "queue" | "closed" | "safe" | "notSafe";
};

type PendingUpdate = {
  id?: string;
  stationId: string;
  stationName: string;
  suburb: string;
  province?: string;
  ownerName: string;
  contactNumber?: string;
  diesel50?: number;
  petrol93?: number;
  petrol95?: number;
  lpgGasPrice?: number;
  gas9kg?: boolean;
  gas19kg?: boolean;
  gas48kg?: boolean;
  open24h?: boolean;
  truckFriendly?: boolean;
  safeOvernight?: boolean;
  notes?: string;
  status?: string;
};

const CACHE_KEY = "fuelStationsCache";

export default function AdminPage() {
  const [stations, setStations] = useState<Station[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [pendingUpdates, setPendingUpdates] = useState<PendingUpdate[]>([]);
  const [search, setSearch] = useState("");
  const [admin, setAdmin] = useState(false);
  const [pin, setPin] = useState("");

  useEffect(() => {
  console.log("LOAD STATIONS STARTING");
  loadStations(true);
}, []);

  async function loadStations(force = false) {
    const cached = localStorage.getItem(CACHE_KEY);

    if (cached && !force) {
      setStations(JSON.parse(cached));
      return;
    }

    const snap = await getDocs(collection(db, "stations"));
    const list = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Station),
    }));
console.log(
  "BAD GPS STATIONS:",
  list.filter((s: any) => {
    const lat = Number(s.lat);
    const lng = Number(s.lng);

    return (
      !lat ||
      !lng ||
      lat < -35 ||
      lat > -20 ||
      lng < 15 ||
      lng > 35
    );
  })
);
alert("TOTAL STATIONS: " + list.length);
    setStations(list);
    localStorage.setItem(CACHE_KEY, JSON.stringify(list));
  }

  async function loadReports() {
    const snap = await getDocs(collection(db, "reports"));
    setReports(snap.docs.map((d) => d.data() as Report));
  }

  async function loadPendingUpdates() {
    const snap = await getDocs(collection(db, "pendingUpdates"));
    const list = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as PendingUpdate),
    }));

    setPendingUpdates(list.filter((u) => u.status !== "approved" && u.status !== "rejected"));
  }

  function login() {
    if (pin === "1234") {
      setAdmin(true);
      setPin("");
    } else {
      alert("Wrong PIN");
    }
  }

  function getCount(id: string, type: Report["type"]) {
    return reports.filter((r) => r.stationId === id && r.type === type).length;
  }

  async function updateField(id: string, field: string, value: any) {
    await updateDoc(doc(db, "stations", id), {
      [field]: value,
    });

    localStorage.removeItem(CACHE_KEY);
    loadStations(true);
  }

  async function resetReports(stationId: string, type?: Report["type"]) {
    const snap = await getDocs(collection(db, "reports"));

    const matching = snap.docs.filter((d) => {
      const data = d.data() as Report;

      if (type) {
        return data.stationId === stationId && data.type === type;
      }

      return data.stationId === stationId;
    });

    for (const r of matching) {
      await deleteDoc(doc(db, "reports", r.id));
    }

    alert("Reports reset.");
    loadReports();
  }

  async function approveUpdate(update: PendingUpdate) {
    if (!update.stationId || !update.id) {
      alert("Missing station/update ID.");
      return;
    }

    await updateDoc(doc(db, "stations", update.stationId), {
      diesel50: Number(update.diesel50 || 0),
      petrol93: Number(update.petrol93 || 0),
      petrol95: Number(update.petrol95 || 0),
      lpgGasPrice: Number(update.lpgGasPrice || 0),
      gas9kg: !!update.gas9kg,
      gas19kg: !!update.gas19kg,
      gas48kg: !!update.gas48kg,
      open24h: !!update.open24h,
      truckFriendly: !!update.truckFriendly,
      safeOvernight: !!update.safeOvernight,
    });

    await updateDoc(doc(db, "pendingUpdates", update.id), {
      status: "approved",
    });

    localStorage.removeItem(CACHE_KEY);
    await loadStations(true);
    await loadPendingUpdates();

    alert("Owner update approved and station updated.");
  }

  async function rejectUpdate(updateId: string) {
    await updateDoc(doc(db, "pendingUpdates", updateId), {
      status: "rejected",
    });

    await loadPendingUpdates();
    alert("Update rejected.");
  }

  const filtered = useMemo(() => {
    return stations.filter((s) =>
      `${s.name} ${s.suburb}`.toLowerCase().includes(search.toLowerCase())
    );
  }, [stations, search]);

  return (
    <main style={styles.page}>
      <h1 style={styles.title}>Fuel Finder SA - Admin</h1>

      {!admin && (
        <div style={styles.loginBox}>
          <input
            type="password"
            placeholder="Admin PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            style={styles.input}
          />

          <button onClick={login} style={styles.greenBtn}>
            Login
          </button>
        </div>
      )}

      {admin && (
        <>
          <section style={styles.pendingBox}>
            <h2>Pending Owner Updates</h2>

            {pendingUpdates.length === 0 && <p>No pending updates.</p>}

            {pendingUpdates.map((u) => (
              <div key={u.id} style={styles.pendingCard}>
                <h3>{u.stationName}</h3>
                <p>{u.suburb}</p>
                <p>
                  Owner: <b>{u.ownerName}</b>
                </p>
                <p>Contact: {u.contactNumber || "Not provided"}</p>

                <p>Diesel 50: R{Number(u.diesel50 || 0).toFixed(2)}</p>
                <p>Petrol 93: R{Number(u.petrol93 || 0).toFixed(2)}</p>
                <p>Petrol 95: R{Number(u.petrol95 || 0).toFixed(2)}</p>
                <p>LPG Gas: R{Number(u.lpgGasPrice || 0).toFixed(2)}</p>

                <p>
                  Gas: 9kg {u.gas9kg ? "YES" : "NO"} | 19kg{" "}
                  {u.gas19kg ? "YES" : "NO"} | 48kg{" "}
                  {u.gas48kg ? "YES" : "NO"}
                </p>

                <p>Open 24h: {u.open24h ? "YES" : "NO"}</p>
                <p>Truck Friendly: {u.truckFriendly ? "YES" : "NO"}</p>
                <p>Safe Overnight: {u.safeOvernight ? "YES" : "NO"}</p>

                {u.notes && <p>Notes: {u.notes}</p>}

                <button onClick={() => approveUpdate(u)} style={styles.greenBtn}>
                  Approve
                </button>

                <button
                  onClick={() => rejectUpdate(u.id!)}
                  style={styles.redBtn}
                >
                  Reject
                </button>
              </div>
            ))}
          </section>

          <input
            placeholder="Search station..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.input}
          />

          {filtered.map((s) => (
            <div
              key={s.id}
              style={{
                ...styles.card,
                border: s.featured ? "2px solid gold" : "1px solid #ccc",
              }}
            >
              <h3>
                {s.name} {s.featured && "⭐ FEATURED"}
              </h3>

              <p>{s.suburb}</p>

              <p style={styles.small}>
                Reports: Out {getCount(s.id!, "out")} | Queue{" "}
                {getCount(s.id!, "queue")} | Closed{" "}
                {getCount(s.id!, "closed")} | Safe{" "}
                {getCount(s.id!, "safe")} | Not Safe{" "}
                {getCount(s.id!, "notSafe")}
              </p>

              <div>
                Diesel:
                <input
                  type="number"
                  value={s.diesel50}
                  onChange={(e) =>
                    updateField(s.id!, "diesel50", Number(e.target.value))
                  }
                />
              </div>

              <div>
                Petrol 93:
                <input
                  type="number"
                  value={s.petrol93}
                  onChange={(e) =>
                    updateField(s.id!, "petrol93", Number(e.target.value))
                  }
                />
              </div>

              <div>
                Petrol 95:
                <input
                  type="number"
                  value={s.petrol95}
                  onChange={(e) =>
                    updateField(s.id!, "petrol95", Number(e.target.value))
                  }
                />
              </div>

              <div style={{ marginTop: 10 }}>
                <button
                  onClick={() =>
                    updateField(s.id!, "truckFriendly", !s.truckFriendly)
                  }
                >
                  🚚 Truck: {s.truckFriendly ? "YES" : "NO"}
                </button>

                <button
                  onClick={() =>
                    updateField(s.id!, "safeOvernight", !s.safeOvernight)
                  }
                  style={{ marginLeft: 10 }}
                >
                  🌙 Safe: {s.safeOvernight ? "YES" : "NO"}
                </button>

                <button
                  onClick={() => updateField(s.id!, "featured", !s.featured)}
                  style={{ marginLeft: 10 }}
                >
                  ⭐ Featured: {s.featured ? "YES" : "NO"}
                </button>

                <div style={{ marginTop: 12 }}>
                  <button
                    onClick={() => resetReports(s.id!, "out")}
                    style={{ marginRight: 8 }}
                  >
                    Reset Out
                  </button>

                  <button
                    onClick={() => resetReports(s.id!, "queue")}
                    style={{ marginRight: 8 }}
                  >
                    Reset Queue
                  </button>

                  <button
                    onClick={() => resetReports(s.id!, "closed")}
                    style={{ marginRight: 8 }}
                  >
                    Reset Closed
                  </button>

                  <button
                    onClick={() => resetReports(s.id!)}
                    style={{
                      background: "red",
                      color: "white",
                    }}
                  >
                    Reset ALL
                  </button>
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: "20px",
    fontFamily: "Arial",
    background: "#f1f5f9",
    minHeight: "100vh",
  },
  title: {
    fontSize: "28px",
    marginBottom: "20px",
  },
  loginBox: {
    display: "flex",
    gap: "10px",
    marginBottom: "20px",
  },
  input: {
    padding: "10px",
    width: "100%",
    marginBottom: "10px",
  },
  pendingBox: {
    background: "#fff7ed",
    padding: "18px",
    borderRadius: "14px",
    marginBottom: "20px",
  },
  pendingCard: {
    background: "white",
    padding: "15px",
    marginBottom: "15px",
    borderRadius: "10px",
    border: "1px solid #f59e0b",
  },
  card: {
    padding: "15px",
    marginBottom: "15px",
    borderRadius: "10px",
    background: "white",
  },
  greenBtn: {
    padding: "10px",
    background: "#22c55e",
    color: "white",
    border: "none",
    borderRadius: "8px",
    marginRight: "8px",
  },
  redBtn: {
    padding: "10px",
    background: "#ef4444",
    color: "white",
    border: "none",
    borderRadius: "8px",
  },
  small: {
    fontSize: "12px",
    color: "#555",
  },
};