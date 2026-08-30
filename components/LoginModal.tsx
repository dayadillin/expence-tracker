"use client";

import { useState } from "react";
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth, googleProvider } from "../firebase";

export default function LoginModal() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-slate-950 text-white p-4">
      <div className="w-full max-w-md p-6 bg-slate-900 rounded-xl shadow-lg border border-slate-800">
        <h2 className="text-2xl font-bold text-center mb-6">
          {isSignUp ? "Create an Account" : "Sign In to Expense Tracker"}
        </h2>

        <button
          onClick={handleGoogleSignIn}
          className="w-full py-2 px-4 mb-4 bg-white text-black font-semibold rounded-lg hover:bg-slate-200 transition"
        >
          Continue with Google
        </button>

        <div className="flex items-center my-4">
          <div className="flex-1 border-t border-slate-700"></div>
          <span className="px-3 text-sm text-slate-400">OR</span>
          <div className="flex-1 border-t border-slate-700"></div>
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-4">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full p-2 bg-slate-800 border border-slate-700 rounded text-white"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full p-2 bg-slate-800 border border-slate-700 rounded text-white"
          />
          <button
            type="submit"
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded font-semibold transition"
          >
            {isSignUp ? "Sign Up" : "Log In"}
          </button>
        </form>

        <p className="text-sm text-center text-slate-400 mt-4">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-blue-400 underline"
          >
            {isSignUp ? "Log In" : "Sign Up"}
          </button>
        </p>
      </div>
    </div>
  );
}