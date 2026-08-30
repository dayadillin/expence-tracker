"use client";

import { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

export default function NicknameModal() {
  const { user, setNickname } = useAuth();
  const [inputNickname, setInputNickname] = useState("");

  const handleSaveNickname = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !inputNickname.trim()) return;

    try {
      await setDoc(doc(db, "users", user.uid), {
        nickname: inputNickname.trim(),
        email: user.email,
        createdAt: new Date(),
      }, { merge: true });

      setNickname(inputNickname.trim());
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-slate-950 text-white p-4">
      <div className="w-full max-w-md p-6 bg-slate-900 rounded-xl shadow-lg border border-slate-800">
        <h2 className="text-2xl font-bold text-center mb-2">Welcome!</h2>
        <p className="text-slate-400 text-center text-sm mb-6">Choose a nickname to use inside the app.</p>
        <form onSubmit={handleSaveNickname} className="space-y-4">
          <input
            type="text"
            placeholder="Your Nickname"
            value={inputNickname}
            onChange={(e) => setInputNickname(e.target.value)}
            required
            className="w-full p-2 bg-slate-800 border border-slate-700 rounded text-white"
          />
          <button
            type="submit"
            className="w-full py-2 bg-green-600 hover:bg-green-700 rounded font-semibold transition"
          >
            Save & Continue
          </button>
        </form>
      </div>
    </div>
  );
}