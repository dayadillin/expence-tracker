import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDLV5zIMWxKJhnjalipBRL-qBsu5IejyIA",
  authDomain: "expense-tracker-c49f1.firebaseapp.com",
  projectId: "expense-tracker-c49f1",
  storageBucket: "expense-tracker-c49f1.firebasestorage.app",
  messagingSenderId: "1032565072417",
  appId: "1:1032565072417:web:b333f933f8778f7ef7f960"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();