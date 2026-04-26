import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBYDEmEQDEfQb7N7AJpPcrWoaYa6Gks4DU",
  authDomain: "fuel-finder--sa.firebaseapp.com",
  projectId: "fuel-finder--sa",
  storageBucket: "fuel-finder--sa.firebasestorage.app",
  messagingSenderId: "966266239891",
  appId: "1:966266239891:web:dae0f06d6ff00485240666",
  measurementId: "G-JEJSWBZBKD",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app);