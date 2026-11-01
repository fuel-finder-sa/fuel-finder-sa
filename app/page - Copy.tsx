"use client";
import FuelMap from "./components/FuelMap";
import { useEffect, useMemo, useState, useRef } from "react";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";





type Station = {
  id?: string;
  name: string;
  suburb: string;
  province: string;
  diesel50: number;
  petrol93?: number;
  petrol95?: number;
  type?: "garage" | "depot" | "station";
  phoneNumber?: string;
  lat?: number;
lng?: number;
lpgGasPrice?: number;

  atmAvailable?: boolean;
  coffeeShop?: boolean;
  convenienceStore?: boolean;
  bathrooms?: boolean;
  washBayTruck?: boolean;
  washBayLight?: boolean;
  open24Hours?: boolean;
  evCharging?: boolean;
  truckFriendly?: boolean;
  safeOvernight?: boolean;
  featured?: boolean;
  lpgGas?: boolean;

};

export default function Home() {
  const [stations, setStations] = useState<Station[]>([]);
  const [search, setSearch] = useState("");
  const [province, setProvince] = useState("All Provinces");
  const [locationType, setLocationType] = useState<"all" | "garage" | "depot">("all");
  const [autoMode, setAutoMode] = useState(true);
  const [truckOnly, setTruckOnly] = useState(false);
  const [safeOnly, setSafeOnly] = useState(false);
  const [myLocation, setMyLocation] = useState<any>(null);
  const [bestStop, setBestStop] = useState<Station | null>(null);
  const [mapView, setMapView] = useState(false);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    loadStations();
  }, []);
  
  async function loadStations() {
    const snap = await getDocs(collection(db, "stations"));
    

    const list: Station[] = snap.docs.map((d) => {
      const data = d.data() as Station;
      
      

      return {
        id: d.id,
        ...data,
        type: ((data.type || "station").toLowerCase() as Station["type"]),
      };
    });

    setStations(list);
  }

  const provinces = useMemo(() => {
    const list = Array.from(new Set(stations.map((s) => s.province).filter(Boolean)));
    return ["All Provinces", ...list];
  }, [stations]);

  const filtered = useMemo(() => {
    let list = stations.filter((s) =>
      `${s.name} ${s.suburb} ${s.province}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );
    
   


  

    if (province !== "All Provinces") {
      list = list.filter((s) => s.province === province);
    }

    if (locationType !== "all") {
      list = list.filter((s) => s.type === locationType);
    }
if (truckOnly) {
  list = list.filter((s) => s.truckFriendly);
}
if (safeOnly) {
  list = list.filter((s) => s.safeOvernight);
}
   list.sort((a, b) => {
  // 1. FEATURED FIRST
  if (a.featured && !b.featured) return -1;
  if (!a.featured && b.featured) return 1;

  // 2. DISTANCE PRIORITY
  if (myLocation && a.lat && a.lng && b.lat && b.lng) {
    const distA = getDistance(
      myLocation.lat,
      myLocation.lng,
      a.lat,
      a.lng
    );

    const distB = getDistance(
      myLocation.lat,
      myLocation.lng,
      b.lat,
      b.lng
    );

    return distA - distB;
  }

  // 3. FALLBACK PRICE SORT
  return Number(a.diesel50 || 999) - Number(b.diesel50 || 999);
});

    return list;
}, [stations, search, province, locationType, myLocation, truckOnly, safeOnly]);
  
  



  function navigateToStation(s: Station) {
    const q = `${s.name}, ${s.suburb}, ${s.province}`;
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`,
      "_blank"
    );
  }

  function callStation(s: Station) {
    if (!s.phoneNumber) {
      alert("No phone number loaded for this station yet.");
      return;
    }

    window.location.href = `tel:${s.phoneNumber}`;
  }
  const garageCount = stations.filter((s) => s.type === "garage").length;
const depotCount = stations.filter((s) => s.type === "depot").length;
const totalCount = stations.length;
function getDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const R = 6371;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
const cheapest = filtered.length
  ? filtered.reduce((min, s) =>
      s.diesel50 < min.diesel50 ? s : min,
      filtered[0]
    )
  : null;

const closest = myLocation
  ? filtered
      .filter((s) => s.lat && s.lng)
      .sort(
        (a, b) =>
          getDistance(
            myLocation.lat,
            myLocation.lng,
            a.lat!,
            a.lng!
          ) -
          getDistance(
            myLocation.lat,
            myLocation.lng,
            b.lat!,
            b.lng!
          )
      )[0]
  : null;
  const closestDepot = myLocation
  ? filtered
      .filter((s: any) => s.brand === "Diesel Depot" && s.lat && s.lng)
      .sort(
        (a, b) =>
          getDistance(myLocation.lat, myLocation.lng, a.lat!, a.lng!) -
          getDistance(myLocation.lat, myLocation.lng, b.lat!, b.lng!)
      )[0]
  : null;
  const cheapestNearby = myLocation
  ? filtered
      .filter((s) => s.diesel50 && s.lat && s.lng)
      .sort(
        (a, b) =>
          Number(a.diesel50 || 999) -
          Number(b.diesel50 || 999)
      )[0]
  : null;
  const topCheapestNearby = myLocation
  ? filtered
      .filter((s) => s.diesel50 && s.lat && s.lng)
      .sort(
        (a, b) =>
          Number(a.diesel50 || 999) -
          Number(b.diesel50 || 999)
      )
      .slice(0, 5)
  : [];
  useEffect(() => {
  if (!autoMode || !myLocation || filtered.length === 0) return;
const cheapestNearby = myLocation
  ? filtered
      .filter((s) => s.diesel50 && s.lat && s.lng)
      .sort(
        (a, b) =>
          Number(a.diesel50 || 999) - Number(b.diesel50 || 999)
      )[0]
  : null;
  const scored = filtered
    .filter((s) => s.lat && s.lng)
    .map((s) => {
      const distance = getDistance(
        myLocation.lat,
        myLocation.lng,
        s.lat!,
        s.lng!
      );

      const price = Number(s.diesel50 || 999);

      const score = distance * 0.6 + price * 0.4;

      return { ...s, score };
    });

  scored.sort((a, b) => a.score - b.score);

  setBestStop(scored[0]);
}, [myLocation, filtered, autoMode]);
      
  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <h1 style={styles.title}>Fuel Finder SA</h1>
        <p style={styles.subtitle}>Find cheaper fuel stops, garages and diesel depots.</p>
      </section>
<button
  onClick={() => setMapView(!mapView)}
  style={{
    padding: 10,
    marginTop: 10,
    background: "#0ea5e9",
    color: "white",
    border: "none",
    borderRadius: 8,
  }}
>
  🗺 Toggle Map View
</button>
{mapView && (
  <div style={{ height: 400, width: "100%", marginTop: 10 }}>
    <FuelMap
      mapView={mapView}
      myLocation={myLocation}
      filtered={filtered}
      bestStop={bestStop}
    />
  </div>
)}
      <div style={styles.toggleRow}>
        <button
          onClick={() => setLocationType("all")}
          style={locationType === "all" ? styles.activeToggle : styles.toggle}
        >
          All
        </button>

        <button
          onClick={() => setLocationType("garage")}
          style={locationType === "garage" ? styles.activeToggle : styles.toggle}
        >
          Garages
        </button>

        <button
          onClick={() => setLocationType("depot")}
          style={locationType === "depot" ? styles.activeToggle : styles.toggle}
        >
          Depots
        </button>
      </div>
<button
  onClick={() => setTruckOnly(!truckOnly)}
  style={truckOnly ? styles.activeToggle : styles.toggle}
>
  🚚 Truck Friendly
</button>
<button
  onClick={() => setSafeOnly(!safeOnly)}
  style={safeOnly ? styles.activeToggle : styles.toggle}
>
  🌙 Safe Overnight
</button>
      <input
        placeholder="Search station..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={styles.input}
      />
{(truckOnly || safeOnly) && (
  <div
    style={{
      marginTop: 10,
      marginBottom: 10,
      fontWeight: "bold",
      color: "#475569",
    }}
  >
    Active Filters:
    {truckOnly && " 🚚 Truck Friendly"}
    {safeOnly && " 🌙 Safe Overnight"}
  </div>
)}
      <select
        value={province}
        onChange={(e) => setProvince(e.target.value)}
        style={styles.input}
      >
        {provinces.map((p) => (
          <option key={p}>{p}</option>
        ))}
      </select>
      

      
<div style={styles.countBox}>
  
  
  <span>All: {totalCount}</span>
  <span>Garages: {garageCount}</span>
  <span>Depots: {depotCount}</span>
</div>

{/* LOCATION + BEST STOP CONTROLS */}
{!myLocation && (
  <div style={styles.onboardingCard}>
    <h2>📍 Welcome to Fuel Finder SA</h2>
    <p>Enable your location to find:</p>

    <p>✅ Closest Fuel Station</p>
    <p>✅ Cheapest Diesel Nearby</p>
    <p>✅ Closest Diesel Depot</p>
    <p>✅ Truck Friendly Stops</p>
    <p>✅ Safe Overnight Stops</p>
  </div>
)}

<button
  onClick={() => {
    navigator.geolocation.getCurrentPosition((pos) => {
      setMyLocation({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      });

      alert("Location loaded successfully");
    });
  }}
  style={styles.locationBtn}
>
  📍 Use My Location
</button>



{/* SUMMARY BAR */}
<div style={styles.summaryBar}>
  <div>
    {topCheapestNearby.length > 0 && (
  <div style={styles.priceBox}>
    <h3>🏆 Top 5 Cheapest Diesel Nearby</h3>

    {topCheapestNearby.map((s, index) => (
  <div
    key={s.id}
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
      padding: 8,
      background: "#f8fafc",
      borderRadius: 8,
    }}
  >
    <span>
      {index + 1}. {s.name} - R{Number(s.diesel50).toFixed(2)}
    </span>

    <button
      onClick={() => navigateToStation(s)}
      style={{
        background: "#22c55e",
        color: "white",
        border: "none",
        borderRadius: 8,
        padding: "6px 10px",
        cursor: "pointer",
      }}
    >
      Navigate
    </button>
  </div>
))}
  </div>
)}
    📍 Closest:{" "}
    {closest ? `${closest.name} (${closest.suburb})` : "Enable location"}
  </div>
<div>
  <div>
  💰 Cheapest Nearby:{" "}
  {cheapestNearby
    ? `${cheapestNearby.name} - R${Number(cheapestNearby.diesel50).toFixed(2)}`
    : "Enable location"}
</div>
  🛢 Closest Depot:{" "}
  {closestDepot
    ? `${closestDepot.name} (${closestDepot.suburb})`
    : "Enable location"}
</div>
  <div>
    🧠 Recommended:{" "}
    {bestStop ? `${bestStop.name} (${bestStop.suburb})` : "Click Find Best Stop"}
  </div>

  <div>
    🚛 Garages: {garageCount} | 🛢 Depots: {depotCount}
  </div>
</div>
{closestDepot && (
  <button
    onClick={() => navigateToStation(closestDepot)}
    style={styles.locationBtn}
  >
    🛢 Navigate to Closest Depot
  </button>
)}
{cheapestNearby && (
  <button
    onClick={() => navigateToStation(cheapestNearby)}
    style={styles.locationBtn}
  >
    ⛽ Navigate to Cheapest Diesel
  </button>
)}
<button

  onClick={() => setAutoMode(!autoMode)}
  style={{
    ...styles.toggle,
    background: autoMode ? "#22c55e" : "#dbe4ee",
    color: autoMode ? "white" : "black",
  }}
>
  🧠 Auto Mode: {autoMode ? "ON" : "OFF"}
</button>






      {filtered.map((s, i) => (
        <div
          key={s.id}
    style={
  bestStop?.id === s.id
    ? styles.bestCard
    : s.featured
    ? styles.featuredCard
    : styles.card
}
        >
          <div style={styles.cardTop}>
            {bestStop?.id === s.id && (
  <span style={styles.bestBadge}>
    🧠 BEST STOP
  </span>
)}
            <div>
              {s.featured && <span style={styles.featuredBadge}>⭐ FEATURED</span>}
   

              <h2 style={styles.stationName}>{s.name}</h2>
              <p style={styles.suburb}>{s.suburb}, {s.province}</p>
            </div>
            {myLocation && s.lat && s.lng && (
  <p style={styles.distanceText}>
    📍 {getDistance(myLocation.lat, myLocation.lng, s.lat, s.lng).toFixed(1)} km away
  </p>
)}

            <span style={s.type === "depot" ? styles.depotBadge : styles.garageBadge}>
              {s.type === "depot" ? "Diesel Depot" : "Garage"}
            </span>
          </div>

          <div style={styles.priceBox}>
            <p style={styles.priceMain}>⛽ Diesel 50: R{Number(s.diesel50 || 0).toFixed(2)}</p>

            {s.type !== "depot" && (
              <>
                <p>Petrol 93: R{Number(s.petrol93 || 0).toFixed(2)}</p>
                <p>Petrol 95: R{Number(s.petrol95 || 0).toFixed(2)}</p>
              </>
            )}

            {s.type === "depot" && (
              <p style={styles.depotNote}>🛢️ Diesel depot — petrol not listed</p>
            )}
            {s.lpgGasPrice && (
  <p>
    🔥 LPG Price: R{Number(s.lpgGasPrice).toFixed(2)}
  </p>
)}
          </div>
          

          <div style={styles.amenities}>
            {s.truckFriendly && <span style={styles.amenity}>🚚 Truck Friendly</span>}
            {s.safeOvernight && <span style={styles.amenity}>🌙 Safe Overnight</span>}
            {s.open24Hours && <span style={styles.amenity}>🕒 24h</span>}
            {s.atmAvailable && <span style={styles.amenity}>🏧 ATM</span>}
            {s.coffeeShop && <span style={styles.amenity}>☕ Coffee</span>}
            {s.convenienceStore && <span style={styles.amenity}>🏪 Store</span>}
            {s.bathrooms && <span style={styles.amenity}>🚻 Toilets</span>}
            {s.washBayTruck && <span style={styles.amenity}>🚚 Truck Wash</span>}
            {s.washBayLight && <span style={styles.amenity}>🚗 Car Wash</span>}
            {s.evCharging && <span style={styles.amenity}>⚡ EV</span>}
{s.lpgGas && <span style={styles.amenity}>🔥 LPG Available</span>}
          </div>
          

        <div style={styles.actions}>
  <button onClick={() => navigateToStation(s)} style={styles.greenBtn}>
    Navigate
  </button>

  <button onClick={() => callStation(s)} style={styles.darkBtn}>
    Call
  </button>

  <button
    onClick={() =>
      (window.location.href = `/owner?stationId=${s.id}&stationName=${encodeURIComponent(
        s.name
      )}`)
    }
    style={styles.darkBtn}
  >
    🏢 Claim
  </button>

  <button
    onClick={() =>
      (window.location.href = `/report?stationId=${s.id}&stationName=${encodeURIComponent(
        s.name
      )}`)
    }
    style={styles.darkBtn}
  >
    🚫 Report
  </button>
</div>
        </div>
        
      ))}
      
    </main>
  );
}



const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: 20,
    fontFamily: "Arial, sans-serif",
    background: "#eef3f8",
    minHeight: "100vh",
  },
  countBox: {
    
    
    
  display: "flex",
  gap: 20,
  marginBottom: 12,
  color: "#64748b",
  fontWeight: "bold",
  
},
onboardingCard: {
  background: "white",
  padding: 20,
  borderRadius: 20,
  marginBottom: 14,
  boxShadow: "0 6px 18px rgba(15,23,42,0.08)",
  color: "#142033",
},
locationBtn: {
  width: "100%",
  padding: 14,
  borderRadius: 14,
  border: "none",
  background: "#0ea5e9",
  color: "white",
  fontWeight: "bold",
  marginBottom: 12,
},
distanceText: {
  color: "#0ea5e9",
  fontWeight: "bold",
  marginTop: 6,
},
  hero: {
    background: "#142033",
    color: "white",
    padding: 28,
    borderRadius: 24,
    marginBottom: 16,
  },
  title: {
    fontSize: 38,
    margin: 0,
  },
  subtitle: {
    marginTop: 8,
    color: "#cbd5e1",
  },
  toggleRow: {
    display: "flex",
    gap: 10,
    marginBottom: 12,
  },
  toggle: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    border: "none",
    background: "#dbe4ee",
    fontWeight: "bold",
  },
  activeToggle: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    border: "none",
    background: "#22c55e",
    color: "white",
    fontWeight: "bold",
  },
  input: {
    width: "100%",
    padding: 15,
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    marginBottom: 12,
    fontSize: 16,
  },
  count: {
    color: "#64748b",
    fontSize: 14,
    marginBottom: 12,
  },
  card: {
    background: "white",
    padding: 20,
    borderRadius: 20,
    marginBottom: 16,
    boxShadow: "0 6px 18px rgba(15,23,42,0.08)",
  },
  bestCard: {
    background: "#ecfdf5",
    padding: 20,
    borderRadius: 20,
    marginBottom: 16,
    border: "2px solid #22c55e",
    boxShadow: "0 6px 18px rgba(15,23,42,0.08)",
  },
  featuredCard: {
    background: "#fffbeb",
    padding: 20,
    borderRadius: 20,
    marginBottom: 16,
    border: "2px solid #f59e0b",
    boxShadow: "0 6px 18px rgba(15,23,42,0.08)",
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },
  stationName: {
    margin: "10px 0 4px",
  },
  suburb: {
    color: "#64748b",
    margin: 0,
  },
  bestBadge: {
    background: "#22c55e",
    color: "white",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: "bold",
  },
  featuredBadge: {
    background: "#f59e0b",
    color: "white",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: "bold",
  },
  garageBadge: {
    background: "#dbeafe",
    color: "#1e40af",
    padding: "8px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: "bold",
    whiteSpace: "nowrap",
  },
  depotBadge: {
    background: "#fee2e2",
    color: "#991b1b",
    padding: "8px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: "bold",
    whiteSpace: "nowrap",
  },
  priceBox: {
    background: "#f8fafc",
    padding: 14,
    borderRadius: 14,
    marginTop: 14,
  },
  priceMain: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 0,
  },
  depotNote: {
    color: "#991b1b",
    fontWeight: "bold",
  },
  amenities: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  amenity: {
    background: "#e2e8f0",
    padding: "7px 10px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: "bold",
  },
  actions: {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: 8,
  marginTop: 14,
},
  greenBtn: {
  background: "#22c55e",
  color: "white",
  padding: 10,
  borderRadius: 10,
  border: "none",
  fontWeight: "bold",
  fontSize: 13,
},

darkBtn: {
  background: "#142033",
  color: "white",
  padding: 10,
  borderRadius: 10,
  border: "none",
  fontWeight: "bold",
  fontSize: 13,
},
};