"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../firebase";

type Station = {
  name?: string;
  city?: string;
  suburb?: string;
  diesel50?: number;
  petrol93?: number;
  petrol95?: number;
  lat?: number;
  lng?: number;
  open24Hours?: boolean;
  evCharging?: boolean;
  truckFriendly?: boolean;
  washBayLight?: boolean;
  washBayTruck?: boolean;
  bathrooms?: boolean;
  foodCourt?: boolean;
  atmAvailable?: boolean;
  convenienceStore?: boolean;
  coffeeShop?: boolean;
  phoneNumber?: string;
  openingHours?: string;
};

function isOpenNow(station: Station) {
  const hours = station.openingHours?.toLowerCase().trim();

  if (station.open24Hours || hours === "24 hours" || hours === "24hrs") {
    return true;
  }

  return false;
}

export default function StationPage() {
  const params = useParams();
  const id = params.id as string;

  const [station, setStation] = useState<Station | null>(null);

  useEffect(() => {
    const fetchStation = async () => {
      const docRef = doc(db, "stations", id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setStation(docSnap.data() as Station);
      }
    };

    fetchStation();
  }, [id]);

  if (!station) {
    return <p style={{ padding: 20 }}>Loading...</p>;
  }

  const handleNavigate = () => {
    if (station.lat && station.lng) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lng}`;
      window.open(url, "_blank");
    }
  };

  const card = {
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    backgroundColor: "#fff",
  };

  const badge = {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: "#f3f4f6",
    fontSize: 12,
    fontWeight: 600,
  };

  return (
    <div style={{ padding: 16, maxWidth: 700, margin: "0 auto" }}>
      <h1>{station.name}</h1>
      <p>{station.suburb}, {station.city}</p>

      <div style={{ ...card }}>
        <strong>
          {isOpenNow(station) ? "🟢 Open Now" : "⏰ See Hours"}
        </strong>
        <p style={{ marginTop: 8 }}>
          {station.openingHours || "Not available"}
        </p>
      </div>

      <div style={card}>
        <h3>Fuel Prices</h3>
        <p>Diesel: R{station.diesel50}</p>
        <p>Petrol 93: R{station.petrol93}</p>
        <p>Petrol 95: R{station.petrol95}</p>
      </div>

      <div style={card}>
        <h3>Truck Features</h3>
        <span style={badge}>
          🚛 Truck Friendly: {station.truckFriendly ? "Yes" : "No"}
        </span>
        <span style={badge}>
          🚛 Truck Wash: {station.washBayTruck ? "Yes" : "No"}
        </span>
        <span style={badge}>
          🚻 Bathrooms: {station.bathrooms ? "Yes" : "No"}
        </span>
      </div>

      <div style={card}>
        <h3>General Features</h3>
        <span style={badge}>
          🚿 Car Wash: {station.washBayLight ? "Yes" : "No"}
        </span>
        <span style={badge}>
          🍔 Food Court: {station.foodCourt ? "Yes" : "No"}
        </span>
        <span style={badge}>
          🏧 ATM: {station.atmAvailable ? "Yes" : "No"}
        </span>
        <span style={badge}>
          🛒 Shop: {station.convenienceStore ? "Yes" : "No"}
        </span>
        <span style={badge}>
          ☕ Coffee: {station.coffeeShop ? "Yes" : "No"}
        </span>
      </div>

      <div style={card}>
        <h3>Contact</h3>
        <p>{station.phoneNumber || "Not available"}</p>

        {station.phoneNumber && (
          <a href={`tel:${station.phoneNumber}`}>
            <button style={{ marginRight: 10 }}>📞 Call</button>
          </a>
        )}

        <button onClick={handleNavigate}>📍 Navigate</button>
      </div>
    </div>
  );
}