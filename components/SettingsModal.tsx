"use client";

import { useState } from "react";
import { updatePassword, deleteUser } from "firebase/auth";
import { doc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { Moon, Sun } from "lucide-react";

export default function SettingsModal({
  onClose,
  darkMode,
  setDarkMode,
}: {
  onClose: () => void;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
}) {
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
    <div className="w-full max-w-sm rounded-3xl border border-green-200 dark:border-green-800/60 bg-white dark:bg-[#121c15] p-6 shadow-2xl text-gray-900 dark:text-gray-100">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">Account & Preferences</h2>
        <button onClick={onClose} className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition">✕ Close</button>
      </div>

      <div className="mb-6 flex items-center justify-between p-3 rounded-2xl bg-green-50/50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/40">
        <div className="flex items-center gap-2">
          {darkMode ? <Moon size={18} className="text-green-400" /> : <Sun size={18} className="text-green-600" />}
          <div>
            <p className="text-xs font-semibold">Dark Theme</p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">Night mode display</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDarkMode(!darkMode)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            darkMode ? "bg-green-500" : "bg-gray-300 dark:bg-gray-700"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              darkMode ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      <form onSubmit={handleChangePassword} className="mb-6 space-y-3">
        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400">Change Password</label>
        <input
          type="password"
          placeholder="New Password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full rounded-xl border border-green-200 dark:border-green-800/60 bg-green-50/50 dark:bg-[#0a110c] px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
        />
        <button
          type="submit"
          className="w-full rounded-xl bg-green-500 py-2.5 text-xs font-bold text-white transition hover:bg-green-600 shadow-md shadow-green-500/20"
        >
          Update Password
        </button>
      </form>
      {statusMessage && <p className="mb-4 text-xs text-green-600 dark:text-green-400">{statusMessage}</p>}

      <div className="border-t border-green-100 dark:border-green-900/50 pt-4">
        <label className="mb-2 block text-xs font-semibold text-red-500">Danger Zone</label>
        <button
          onClick={handleDeleteAccount}
          className="w-full rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 py-2.5 text-xs font-bold text-red-600 dark:text-red-400 transition hover:bg-red-100"
        >
          Delete Account
        </button>
      </div>
    </div>
  );
}

