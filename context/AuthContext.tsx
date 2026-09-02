"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

interface AuthContextType {
  user: User | null;
  nickname: string | null;
  loading: boolean;
  setNickname: (name: string) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  nickname: null,
  loading: true,
  setNickname: () => {},
  logout: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        if (currentUser) {
          const uid = currentUser.uid;
          setUser(currentUser);
          try {
            const userDoc = await getDoc(doc(db, "users", uid));
            if (cancelled || auth.currentUser?.uid !== uid) return;
            if (userDoc.exists() && userDoc.data().nickname) {
              setNickname(userDoc.data().nickname);
            } else {
              setNickname(null);
            }
          } catch (error) {
            if (!cancelled && auth.currentUser?.uid === uid) {
              console.error("Error fetching user profile:", error);
              setNickname(null);
            }
          }
        } else {
          setUser(null);
          setNickname(null);
        }
      } catch (error) {
        console.error("Error in auth state change:", error);
        setUser(null);
        setNickname(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const logout = async () => {
    try {
      setNickname(null);
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, nickname, loading, setNickname, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);