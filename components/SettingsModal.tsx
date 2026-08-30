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
    <div className="mb-8 max-w-md rounded-2xl border border-green-200 bg-white p-6 shadow-xl">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Account Settings</h2>
        <button onClick={onClose} className="text-sm text-gray-500 transition hover:text-gray-900">✕ Close</button>
      </div>

      <form onSubmit={handleChangePassword} className="mb-6 space-y-3">
        <label className="block text-sm text-gray-500">Change Password</label>
        <input
          type="password"
          placeholder="New Password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full rounded-xl border border-green-200 bg-green-50/50 px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:outline-none"
        />
        <button
          type="submit"
          className="w-full rounded-xl bg-green-500 py-2 text-sm font-semibold text-white transition hover:bg-green-600"
        >
          Update Password
        </button>
      </form>
      {statusMessage && <p className="mb-4 text-sm text-green-600">{statusMessage}</p>}

      <div className="border-t border-green-100 pt-4">
        <label className="mb-2 block text-sm font-medium text-gray-900">Danger Zone</label>
        <button
          onClick={handleDeleteAccount}
          className="w-full rounded-xl border border-gray-300 bg-gray-50 py-2 text-sm font-semibold text-gray-900 transition hover:bg-gray-100"
        >
          Delete Account
        </button>
      </div>
    </div>
  );
}
