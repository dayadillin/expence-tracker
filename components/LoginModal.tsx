"use client";

import { useState } from "react";
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth, googleProvider } from "../firebase";
import FlyingMoney from "./FlyingMoney";
import { Wallet } from "lucide-react";

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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-green-50 via-white to-green-100 p-4">
      <FlyingMoney />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,197,94,0.12),transparent_40%),radial-gradient(circle_at_80%_80%,rgba(34,197,94,0.08),transparent_35%)]" />

      <div className="relative z-10 w-full max-w-md animate-scale-in">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500 text-white shadow-lg shadow-green-500/25">
            <Wallet size={28} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">KeepNotes & Finance</h1>
          <p className="mt-1 text-sm text-gray-500">Track income, expenses & tuition in one place</p>
        </div>

        <div className="rounded-2xl border border-green-200 bg-white/95 p-6 shadow-2xl shadow-green-900/10 backdrop-blur-md">
          <h2 className="mb-6 text-center text-lg font-semibold text-gray-900">
            {isSignUp ? "Create an Account" : "Welcome Back"}
          </h2>

          <button
            onClick={handleGoogleSignIn}
            className="mb-4 w-full rounded-xl border border-gray-200 bg-white py-2.5 px-4 font-medium text-gray-900 shadow-sm transition hover:border-green-300 hover:bg-green-50"
          >
            Continue with Google
          </button>

          <div className="my-4 flex items-center">
            <div className="flex-1 border-t border-green-200" />
            <span className="px-3 text-xs font-medium uppercase tracking-wider text-gray-400">or</span>
            <div className="flex-1 border-t border-green-200" />
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-3">
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-green-200 bg-green-50/50 px-3 py-2.5 text-gray-900 placeholder:text-gray-400 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-green-200 bg-green-50/50 px-3 py-2.5 text-gray-900 placeholder:text-gray-400 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-green-500 py-2.5 font-semibold text-white shadow-md shadow-green-500/30 transition hover:bg-green-600"
            >
              {isSignUp ? "Sign Up" : "Log In"}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-500">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="font-medium text-green-600 hover:text-green-700"
            >
              {isSignUp ? "Log In" : "Sign Up"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
