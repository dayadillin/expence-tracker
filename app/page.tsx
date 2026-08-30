"use client";

import { useState, useEffect } from "react";
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  where, 
  orderBy 
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import LoginModal from "../components/LoginModal";
import NicknameModal from "../components/NicknameModal";
import SettingsModal from "../components/SettingsModal";

interface Expense {
  id: string;
  title: string;
  amount: number;
  category: string;
  date: string;
  userId: string;
}

export default function Home() {
  const { user, nickname, loading, logout } = useAuth();
  const [showSettings, setShowSettings] = useState(false);

  // Expense Tracker Form & Data State
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  // Fetch User-Specific Expenses from Firestore
  useEffect(() => {
    if (!user) {
      setExpenses([]);
      return;
    }

    const q = query(
      collection(db, "expenses"),
      where("userId", "==", user.uid),
      orderBy("date", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedExpenses: Expense[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Expense, "id">),
      }));
      setExpenses(fetchedExpenses);
    });

    return () => unsubscribe();
  }, [user]);

  // Add Expense Handler
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim() || !amount) return;

    try {
      await addDoc(collection(db, "expenses"), {
        title: title.trim(),
        amount: parseFloat(amount),
        category,
        date,
        userId: user.uid,
        createdAt: new Date(),
      });

      setTitle("");
      setAmount("");
    } catch (err: any) {
      alert("Error adding expense: " + err.message);
    }
  };

  // Delete Expense Handler
  const handleDeleteExpense = async (id: string) => {
    try {
      await deleteDoc(doc(db, "expenses", id));
    } catch (err: any) {
      alert("Error deleting expense: " + err.message);
    }
  };

  // Calculate Total
  const totalExpense = expenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-white">
        Loading...
      </div>
    );
  }

  // 1. Unauthenticated -> Show Login Screen
  if (!user) return <LoginModal />;

  // 2. Authenticated without Nickname -> Show Nickname Onboarding
  if (!nickname) return <NicknameModal />;

  // 3. Authenticated -> Render Main Application
  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 max-w-4xl mx-auto">
      {/* Navigation Header */}
      <header className="flex justify-between items-center pb-6 mb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold">Expense Tracker</h1>
          <p className="text-sm text-slate-400">
            Welcome back, <span className="text-blue-400 font-semibold">{nickname}</span>!
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-sm transition"
          >
            {showSettings ? "Close Settings" : "Account Settings"}
          </button>
          <button
            onClick={logout}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm font-semibold transition"
          >
            Log Out
          </button>
        </div>
      </header>

      {/* Account Settings Panel */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      {/* Add Expense Form */}
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 mb-8 shadow-md">
        <h2 className="text-lg font-semibold mb-4">Add New Expense</h2>
        <form onSubmit={handleAddExpense} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="Title (e.g. Grocery)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="p-2 bg-slate-800 border border-slate-700 rounded text-white text-sm"
          />
          <input
            type="number"
            step="0.01"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            className="p-2 bg-slate-800 border border-slate-700 rounded text-white text-sm"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="p-2 bg-slate-800 border border-slate-700 rounded text-white text-sm"
          >
            <option value="Food">Food</option>
            <option value="Transport">Transport</option>
            <option value="Utilities">Utilities</option>
            <option value="Entertainment">Entertainment</option>
            <option value="Shopping">Shopping</option>
            <option value="Other">Other</option>
          </select>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="p-2 bg-slate-800 border border-slate-700 rounded text-white text-sm"
          />
          <button
            type="submit"
            className="md:col-span-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-semibold text-sm transition"
          >
            Add Expense
          </button>
        </form>
      </div>

      {/* Total Spent Summary */}
      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 mb-6 flex justify-between items-center">
        <span className="text-slate-400 font-medium">Total Spent</span>
        <span className="text-xl font-bold text-green-400">${totalExpense.toFixed(2)}</span>
      </div>

      {/* Expense Item List */}
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-md">
        <h2 className="text-lg font-semibold mb-4">Your Expenses</h2>
        {expenses.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-4">No expenses recorded yet.</p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {expenses.map((exp) => (
              <li key={exp.id} className="py-3 flex justify-between items-center">
                <div>
                  <p className="font-semibold">{exp.title}</p>
                  <p className="text-xs text-slate-400">
                    {exp.category} • {exp.date}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-bold text-slate-200">${exp.amount.toFixed(2)}</span>
                  <button
                    onClick={() => handleDeleteExpense(exp.id)}
                    className="text-red-400 hover:text-red-300 text-sm font-medium"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}