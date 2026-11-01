const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs } = require("firebase/firestore");

const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY_HERE",
  authDomain: "fuel-finder--sa.firebaseapp.com",
  projectId: "fuel-finder--sa",
  storageBucket: "fuel-finder--sa.firebasestorage.app",
  messagingSenderId: "966266239891",
  appId: "1:966266239891:web:dae0f06d6ff00485240666",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function countStations() {
  const snapshot = await getDocs(collection(db, "stations"));

  let total = 0;
  let garages = 0;
  let depots = 0;
  let missingType = 0;

  snapshot.forEach((doc) => {
    const data = doc.data();
    total++;

    if ((data.type || "").toLowerCase() === "garage") garages++;
    else if ((data.type || "").toLowerCase() === "depot") depots++;
    else missingType++;
  });

  console.log("Total stations:", total);
  console.log("Garages:", garages);
  console.log("Depots:", depots);
  console.log("Missing type:", missingType);
}

countStations().catch(console.error);