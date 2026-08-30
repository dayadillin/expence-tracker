"use client";

import { useState } from "react";
import { updatePassword, deleteUser } from "firebase/auth";
import { doc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newPassword) return;

    try {
      await updatePassword(user, newPassword);
      setStatusMessage("Password updated successfully!");
      setNewPassword("");
    } catch (err: any) {
      alert("Requires recent login. Please log out and log back in to change your password.");
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || !confirm("Are you sure you want to delete your account? This action cannot be undone.")) return;

    try {
      await deleteDoc(doc(db, "users", user.uid));
      await deleteUser(user);
      alert("Account deleted.");
    } catch (err: any) {
      alert("Requires recent login. Please log out and log back in before deleting your account.");
    }
  };

  return (
    <div className="mb-8 p-6 bg-slate-900 rounded-xl border border-slate-800 max-w-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold">Account Settings</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-white text-sm">✕ Close</button>
      </div>

      {/* Change Password */}
      <form onSubmit={handleChangePassword} className="space-y-3 mb-6">
        <label className="block text-sm text-slate-400">Change Password</label>
        <input
          type="password"
          placeholder="New Password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full p-2 bg-slate-800 border border-slate-700 rounded text-white text-sm"
        />
        <button
          type="submit"
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-semibold transition"
        >
          Update Password
        </button>
      </form>
      {statusMessage && <p className="text-sm text-green-400 mb-4">{statusMessage}</p>}

      {/* Delete Account */}
      <div className="pt-4 border-t border-slate-800">
        <label className="block text-sm text-red-400 mb-2">Danger Zone</label>
        <button
          onClick={handleDeleteAccount}
          className="w-full py-2 bg-red-950 text-red-400 border border-red-800 hover:bg-red-900 rounded text-sm font-semibold transition"
        >
          Delete Account
        </button>
      </div>
    </div>
  );
}