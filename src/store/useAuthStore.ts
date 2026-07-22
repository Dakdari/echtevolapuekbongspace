import { create } from 'zustand';
import { auth, db } from '../lib/firebase';
import { GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

interface UserProfile {
  uid: string;
  email: string | null;
  nickname: string;
  odong: number;
  role: 'admin' | 'user';
  isBanned: boolean;
  banUntil?: number | null; // Unix timestamp
  appealStatus?: 'none' | 'pending' | 'rejected';
  items?: string[];
  purchasedStickers?: string[];
}

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  setAuthData: (user: User | null, profile: UserProfile | null) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
}

const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  loading: true,

  setAuthData: (user, profile) => set({ user, profile, loading: false }),
  updateProfile: (updates) => set((state) => ({ 
    profile: state.profile ? { ...state.profile, ...updates } : null 
  })),

  signInWithGoogle: async () => {
    set({ loading: true });
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if user profile exists in Firestore
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      let profile: UserProfile;

      if (!userSnap.exists()) {
        // Create new user profile with random stems nickname '봉황nnnnnnn'
        const stems = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
        let randomStems = '';
        for (let i = 0; i < 7; i++) {
          randomStems += stems[Math.floor(Math.random() * stems.length)];
        }
        
        profile = {
          uid: user.uid,
          email: user.email,
          nickname: `봉황${randomStems}`,
          odong: 0,
          role: user.email === 'jusigmaeniae1@gmail.com' ? 'admin' : 'user',
          isBanned: false,
        };
        await setDoc(userRef, {
          ...profile,
          createdAt: serverTimestamp(),
        });
      } else {
        profile = userSnap.data() as UserProfile;
        let needsUpdate = false;
        
        // Ensure email is saved for existing users
        if (!profile.email && user.email) {
          profile.email = user.email;
          needsUpdate = true;
        }

        // Auto-upgrade jusigmaeniae1@gmail.com to admin if they are somehow not admin
        if (user.email === 'jusigmaeniae1@gmail.com' && profile.role !== 'admin') {
          profile.role = 'admin';
          needsUpdate = true;
        }

        if (needsUpdate) {
          await setDoc(userRef, { role: profile.role, email: profile.email }, { merge: true });
        }
      }

      set({ user, profile, loading: false });
    } catch (error) {
      console.error('Google Sign In Error:', error);
      set({ loading: false });
      throw error;
    }
  },

  signOut: async () => {
    set({ loading: true });
    try {
      await firebaseSignOut(auth);
      set({ user: null, profile: null, loading: false });
    } catch (error) {
      console.error('Sign Out Error:', error);
      set({ loading: false });
    }
  },
}));

export default useAuthStore;
