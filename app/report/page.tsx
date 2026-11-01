"use client";

import { useEffect, useState } from "react";
import { addDoc, collection } from "firebase/firestore";
import { db } from "../../firebase";

export default function ReportPage() {
  const [stationId, setStationId] = useState("");
  const [stationName, setStationName] = useState("");
  const [issue, setIssue] = useState("Diesel 50 Out");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    setStationId(params.get("stationId") || "");
    setStationName(params.get("stationName") || "");
  }, []);

  async function submitReport() {
    await addDoc(collection(db, "fuelReports"), {
      stationId,
      stationName,
      issue,
      status: "pending",
      createdAt: new Date(),
    });

    alert("Report submitted successfully.");
  }

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <h1>🚫 Fuel Issue Report</h1>

        <p>
          <strong>Station:</strong> {stationName}
        </p>

        <label>Select Issue</label>

        <select
          value={issue}
          onChange={(e) => setIssue(e.target.value)}
          style={styles.input}
        >
          <option>Diesel 50 Out</option>
          <option>Petrol 93 Out</option>
          <option>Petrol 95 Out</option>
          <option>LPG Out</option>
        </select>

        <button onClick={submitReport} style={styles.button}>
          Submit Report
        </button>
        <button
  onClick={() => (window.location.href = "/")}
  style={styles.backBtn}
>
  ⬅ Back to Fuel Finder
</button>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: 24,
    background: "#eef3f8",
    minHeight: "100vh",
  },
  card: {
    background: "white",
    padding: 24,
    borderRadius: 20,
  },
  input: {
    width: "100%",
    padding: 12,
    marginTop: 12,
    marginBottom: 20,
  },
 button: {
  width: "100%",
  padding: 14,
  background: "#ef4444",
  color: "white",
  border: "none",
  borderRadius: 12,
  fontWeight: "bold",
},

backBtn: {
  width: "100%",
  padding: 14,
  background: "#142033",
  color: "white",
  border: "none",
  borderRadius: 12,
  fontWeight: "bold",
  marginTop: 12,
},
};