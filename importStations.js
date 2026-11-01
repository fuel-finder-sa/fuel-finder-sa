const fs = require("fs");
const { initializeApp } = require("firebase/app");
const { getFirestore, collection, addDoc } = require("firebase/firestore");

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

async function importStations() {
  const data = JSON.parse(
    fs.readFileSync("FuelFinderSA_New_Stations_Import_168.json", "utf8")
  );

  let count = 0;

  for (const station of data) {
    await addDoc(collection(db, "stations"), station);
    count++;
    console.log(`Imported ${count}`);
  }

  console.log(`Finished importing ${count} stations`);
}

importStations().catch(console.error);