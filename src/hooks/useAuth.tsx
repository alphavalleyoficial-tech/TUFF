import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { localDb } from '../lib/localDb';

interface AuthContextType {
  user: User | null;
  profile: any | null;
  loading: boolean;
  isAuthReady: boolean;
  isGuestAdmin: boolean;
  setGuestAdmin: (val: boolean) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAuthReady: false,
  isGuestAdmin: false,
  setGuestAdmin: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isGuestAdmin, setIsGuestAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          
          // Sync to local DB
          localDb.saveUser({
            id: firebaseUser.uid,
            displayName: data.displayName || firebaseUser.displayName || 'User',
            email: firebaseUser.email || '',
            ativo: data.ativo !== false,
            usageTime: data.usageTime || 0,
            role: data.role || 'user'
          });

          if (data.ativo === false) {
            await auth.signOut();
            setProfile(null);
            setUser(null);
            alert('Sua conta foi bloqueada pelo administrador.');
          } else {
            setProfile(data);
          }
        } else {
          // Create initial profile
          const newProfile = {
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName || 'User',
            photoURL: firebaseUser.photoURL || '',
            weight: 70,
            height: 1.75,
            goal: 'manter',
            targetWeight: 70,
            targetDuration: '3 meses',
            role: firebaseUser.email === 'alphavalleyoficial@gmail.com' ? 'admin' : 'user',
            ativo: true,
            usageTime: 0,
            createdAt: serverTimestamp(),
          };

          // Sync to local DB
          localDb.saveUser({
            id: firebaseUser.uid,
            displayName: newProfile.displayName,
            email: firebaseUser.email || '',
            ativo: true,
            usageTime: 0,
            role: newProfile.role
          });

          await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
          setProfile(newProfile);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAuthReady, isGuestAdmin, setGuestAdmin: setIsGuestAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
