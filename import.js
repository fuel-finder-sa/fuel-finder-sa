const { initializeApp } = require("firebase/app");
const { getFirestore, collection, addDoc } = require("firebase/firestore");
const rawData = require("./stations_cleaned.json");

// 🔥 Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBYDEmEQDEfQb7N7AJpPcrWoaYa6Gks4DU",
  authDomain: "fuel-finder--sa.firebaseapp.com",
  projectId: "fuel-finder--sa",
  storageBucket: "fuel-finder--sa.firebasestorage.app",
  messagingSenderId: "966266239891",
  appId: "1:966266239891:web:dae0f06d6ff00485240666",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 🔧 Helpers
function toBool(value) {
  return String(value).toUpperCase() === "TRUE";
}

function toNumber(value) {
  if (value === "" || value === undefined || value === null) return null;
  return Number(String(value).replace(",", ""));
}

function cleanPhone(value) {
  if (!value) return "";
  const phone = String(value).trim();
  return phone.startsWith("0") ? phone : "0" + phone;
}

// 🚀 Upload function
async function upload() {
  const stations = rawData.filter((s) => s.Name && s.Name.trim() !== "");

  for (const s of stations) {
    const station = {
      name: s.Name,
      suburb: s.Suburb,
      city: s.City,
      province:
        s.Province === "Pretoria"
          ? "Gauteng"
          : s.Province === "eMalahleni"
          ? "Mpumalanga"
          : s.Province,

      diesel50: toNumber(s["Diesel 50ppm"]),
      petrol93: toNumber(s["Petrol 93"]),
      petrol95: toNumber(s["Petrol 95"]),

      lat: toNumber(s.Latitude),
      lng: toNumber(s.Longitude),

      truckFriendly: toBool(s["Truck Friendly"]),
      washBayTruck: toBool(s["Truck Wash"]),
      washBayLight: toBool(s["Car Wash"]),
      bathrooms: toBool(s.Bathrooms),
      atmAvailable: toBool(s.ATM),

      convenienceStore: toBool(s.Shop),
      coffeeShop: toBool(s.Coffee),
      foodCourt: toBool(s["Food Court"]),
      open24Hours: toBool(s["Open 24 Hours"]),

      phoneNumber: cleanPhone(s.Phone),
      openingHours: s["Opening Hours"] || "",
      notes: s.Notes || "",

      updatedAt: new Date(),
    };

    await addDoc(collection(db, "stations"), station);
    console.log("Added:", station.name);
  }

  console.log("DONE ✅ Added", stations.length, "stations");
}

// ▶️ Run
upload();