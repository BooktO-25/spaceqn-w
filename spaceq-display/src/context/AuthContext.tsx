import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '../lib/firebase';
import { UserRole, Business } from '../types';
import { saveBusiness, findPendingInviteForEmail, markInviteAccepted } from '../services/firebaseService';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  businessId: string; // '' only for SUPER_ADMIN, REGIONAL_ADMIN, or a not-yet-onboarded account
  /** Only set for REGIONAL_ADMIN — the geography label(s) they can manage
   * (matches Business.region). Assigned by a Super Admin, never self-set. */
  assignedRegions?: string[];
  createdAt: string;
}

interface AuthContextType {
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  authError: string | null;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  /** Self-serve signup: always creates a brand-new Business the caller owns. */
  signupWithEmail: (email: string, pass: string, name: string, businessName: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  /** Finishes onboarding a Google/first-time account that has no business yet. */
  completeBusinessOnboarding: (businessName: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function friendlyAuthError(err: any): string {
  const code = err?.code || '';
  switch (code) {
    case 'custom/business-name-required':
      return 'Enter a business name to create your workspace — or leave it blank if you were invited to join an existing team (make sure you use the exact email address the invite was sent to).';
    case 'auth/unauthorized-domain':
      return 'This website\'s domain is not authorized for Google Sign-In yet. In the Firebase Console, go to Authentication → Settings → Authorized domains and add this domain.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google sign-in popup. Trying a full-page redirect instead — please try the Google button again.';
    case 'auth/operation-not-allowed':
      return 'Google Sign-In is not enabled for this Firebase project yet. In the Firebase Console, go to Authentication → Sign-in method → Google, and enable it.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try signing in instead.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return ''; // user just closed it — not a real error, don't show anything
    default: {
      const rawMessage = err?.message || 'Something went wrong. Please try again.';
      // Firebase Auth's persistence layer uses IndexedDB under the hood.
      // On a browser tab that's been suspended/backgrounded, has a lot of
      // other tabs open, or has corrupted/full local storage, that
      // connection can throw errors like "database is closing" or similar
      // low-level IndexedDB messages — these are almost never a real bug in
      // the app, they're the browser's storage state. Give people a real
      // fix instead of a cryptic database error.
      if (/database|indexeddb|idb/i.test(rawMessage)) {
        return "Your browser's local storage had a hiccup (often happens with a lot of tabs open, or after heavy testing in the same browser). Try: close this tab fully and reopen it, or clear this site's data in your browser settings, then sign in again. If it keeps happening, try a different browser or device.";
      }
      return rawMessage;
    }
  }
}

function newBusinessId() {
  return `biz-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

async function createBusinessForUser(uid: string, ownerEmail: string, ownerName: string, businessName: string): Promise<string> {
  const businessId = newBusinessId();
  const business: Business = {
    id: businessId,
    name: businessName || `${ownerName}'s Business`,
    slug: (businessName || 'business').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || businessId,
    brandColor: '#E11D48',
    createdAt: new Date().toISOString(),
    totalStorageUsedMb: 0,
  };
  await saveBusiness(business);
  return businessId;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    // Catch the result of a signInWithRedirect() call (used as a fallback when
    // a popup can't open — common inside embedded/preview iframes or browsers
    // that block third-party popups).
    getRedirectResult(auth).catch((err) => {
      const msg = friendlyAuthError(err);
      if (msg) setAuthError(msg);
    });

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser);
      if (fbUser) {
        try {
          const docRef = doc(db, 'users', fbUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setUserProfile(docSnap.data() as UserProfile);
          } else {
            // First-time sign-in (typically via Google). Before defaulting to
            // "no business yet", check whether a business owner already
            // invited this email — if so, join that business with the
            // invited role instead of showing the onboarding screen.
            const invite = fbUser.email ? await findPendingInviteForEmail(fbUser.email).catch(() => null) : null;

            const newProfile: UserProfile = {
              uid: fbUser.uid,
              email: fbUser.email || 'user@domain.com',
              displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'Business Owner',
              role: invite ? invite.role : 'BUSINESS_OWNER',
              // We deliberately do NOT assign them to an existing business
              // (e.g. 'biz-1') absent an invite — that would silently mix an
              // unrelated new user into another tenant's data. With no invite
              // they land with businessId: '' and see a one-time "name your
              // business" onboarding screen (see completeBusinessOnboarding).
              businessId: invite ? invite.businessId : '',
              createdAt: new Date().toISOString()
            };
            await setDoc(docRef, newProfile);
            if (invite) await markInviteAccepted(invite.id).catch(() => {});
            setUserProfile(newProfile);
          }
        } catch (err) {
          console.warn('Could not fetch user profile from Firestore:', err);
          setUserProfile(null);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const openAuthModal = () => { setAuthError(null); setIsAuthModalOpen(true); };
  const closeAuthModal = () => setIsAuthModalOpen(false);

  const loginWithEmail = async (email: string, pass: string) => {
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      closeAuthModal();
    } catch (err: any) {
      throw new Error(friendlyAuthError(err));
    }
  };

  // Self-signup normally creates a brand-new business the signer-upper owns.
  // But if a business owner already invited this exact email, we honor that
  // invite instead — the person joins the existing team with the assigned
  // role rather than getting their own separate business.
  const signupWithEmail = async (email: string, pass: string, name: string, businessName: string) => {
    setAuthError(null);
    try {
      const invite = await findPendingInviteForEmail(email).catch(() => null);

      if (!invite && !businessName.trim()) {
        throw { code: 'custom/business-name-required' };
      }

      const res = await createUserWithEmailAndPassword(auth, email, pass);
      const businessId = invite ? invite.businessId : await createBusinessForUser(res.user.uid, email, name, businessName);
      const newProfile: UserProfile = {
        uid: res.user.uid,
        email: res.user.email || email,
        displayName: name,
        role: invite ? invite.role : 'BUSINESS_OWNER',
        businessId,
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'users', res.user.uid), newProfile);
      if (invite) await markInviteAccepted(invite.id).catch(() => {});
      setUserProfile(newProfile);
      closeAuthModal();
    } catch (err: any) {
      throw new Error(friendlyAuthError(err));
    }
  };

  const completeBusinessOnboarding = async (businessName: string) => {
    if (!user || !userProfile) return;
    setAuthError(null);
    try {
      const businessId = await createBusinessForUser(user.uid, userProfile.email, userProfile.displayName, businessName);
      const updated: UserProfile = { ...userProfile, businessId };
      await setDoc(doc(db, 'users', user.uid), updated, { merge: true });
      setUserProfile(updated);
    } catch (err: any) {
      throw new Error(friendlyAuthError(err));
    }
  };

  const loginWithGoogle = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      closeAuthModal();
    } catch (err: any) {
      const code = err?.code || '';
      // Popups frequently can't open inside embedded previews / some mobile
      // browsers. Fall back to a full-page redirect rather than just failing.
      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request' ||
        code === 'auth/operation-not-supported-in-this-environment'
      ) {
        try {
          await signInWithRedirect(auth, googleProvider);
          return; // page will navigate away; result handled by getRedirectResult on return
        } catch (redirectErr: any) {
          setAuthError(friendlyAuthError(redirectErr));
          return;
        }
      }
      setAuthError(friendlyAuthError(err));
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('Sign out:', e);
    }
    setUser(null);
    setUserProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        authError,
        isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
        loginWithEmail,
        signupWithEmail,
        loginWithGoogle,
        completeBusinessOnboarding,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
