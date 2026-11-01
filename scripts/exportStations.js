const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs } = require("firebase/firestore");
const fs = require("fs");

const firebaseConfig = {
  apiKey: 'AIzaSyBYDEmEQDEfQb7N7AJpPcrWoaYa6Gks4DU',
  authDomain: "fuel-finder--sa.firebaseapp.com",
  projectId: "fuel-finder--sa",
  storageBucket: "fuel-finder--sa.firebasestorage.app",
  messagingSenderId: "966266239891",
  appId: "1:966266239891:web:dae0f06d6ff00485240666",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function exportStations() {
  const snapshot = await getDocs(collection(db, "stations"));

  const stations = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  fs.writeFileSync(
    "FuelFinder_Backup_Before_531_Import.json",
    JSON.stringify(stations, null, 2)
  );

  console.log(`Exported ${stations.length} stations`);
}

exportStations();