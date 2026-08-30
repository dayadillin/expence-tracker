import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDLV5zIMWxKJhnjalipBRL-qBsu5IejyIA",
  authDomain: "expense-tracker-c49f1.firebaseapp.com",
  projectId: "expense-tracker-c49f1",
  storageBucket: "expense-tracker-c49f1.firebasestorage.app",
  messagingSenderId: "1032565072417",
  appId: "1:1032565072417:web:b333f933f8778f7ef7f960"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);