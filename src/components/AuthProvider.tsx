import React, { useEffect } from 'react';
import useAuthStore from '../store/useAuthStore';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { setAuthData } = useAuthStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          setAuthData(user, userSnap.data() as any);
        } else {
          setAuthData(user, null);
        }
      } else {
        setAuthData(null, null);
      }
    });

    return () => unsubscribe();
  }, [setAuthData]);

  return <>{children}</>;
};

export default AuthProvider;
