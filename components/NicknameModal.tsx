"use client";

import { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { UserRound } from "lucide-react";

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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 via-white to-green-100 p-4">
      <div className="w-full max-w-md rounded-2xl border border-green-200 bg-white p-6 shadow-xl shadow-green-900/5">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 text-green-600">
          <UserRound size={24} />
        </div>
        <h2 className="text-center text-2xl font-bold text-gray-900">Welcome!</h2>
        <p className="mb-6 text-center text-sm text-gray-500">Choose a nickname to use inside the app.</p>
        <form onSubmit={handleSaveNickname} className="space-y-4">
          <input
            type="text"
            placeholder="Your Nickname"
            value={inputNickname}
            onChange={(e) => setInputNickname(e.target.value)}
            required
            className="w-full rounded-xl border border-green-200 bg-green-50/50 px-3 py-2.5 text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
          />
          <button
            type="submit"
            className="w-full rounded-xl bg-green-500 py-2.5 font-semibold text-white shadow-md shadow-green-500/30 transition hover:bg-green-600"
          >
            Save & Continue
          </button>
        </form>
      </div>
    </div>
  );
}
