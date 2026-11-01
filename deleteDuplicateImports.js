const { initializeApp } = require("firebase/app");
const {
  getFirestore,
  collection,
  getDocs,
  deleteDoc,
  doc,
} = require("firebase/firestore");

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

function makeKey(station) {
  return `${(station.name || "").trim().toLowerCase()}|${station.lat}|${station.lng}`;
}

async function deleteDuplicateImports() {
  const snapshot = await getDocs(collection(db, "stations"));
  const seen = new Map();
  let deleted = 0;

  for (const document of snapshot.docs) {
    const data = document.data();
    const key = makeKey(data);

    if (seen.has(key)) {
      await deleteDoc(doc(db, "stations", document.id));
      deleted++;
      console.log(`Deleted duplicate ${deleted}: ${data.name}`);
    } else {
      seen.set(key, document.id);
    }
  }

  console.log(`Finished. Deleted ${deleted} duplicate records.`);
}

deleteDuplicateImports().catch(console.error);