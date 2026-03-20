import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { auth, db } from './config';

const ALLOWED_DOMAIN = 'mitaoe.ac.in';

export const checkWardenExists = async () => {
  const q = query(collection(db, 'users'), where('role', '==', 'warden'), limit(1));
  const snap = await getDocs(q);
  return !snap.empty;
};

// ─── Google Sign-In (popup with redirect fallback) ────────────────────────────
export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ hd: ALLOWED_DOMAIN });

  try {
    // Try popup first
    const cred = await signInWithPopup(auth, provider);
    const { user } = cred;
    if (!user.email.endsWith(`@${ALLOWED_DOMAIN}`)) {
      await signOut(auth);
      throw new Error(`Only @${ALLOWED_DOMAIN} accounts are allowed.`);
    }
    return user;
  } catch (err) {
    // If popup was blocked or failed, fall back to redirect
    if (
      err.code === 'auth/popup-blocked' ||
      err.code === 'auth/popup-closed-by-user' ||
      err.code === 'auth/internal-error'
    ) {
      await signInWithRedirect(auth, provider);
      return null; // Page will reload; result handled by getGoogleRedirectResult
    }
    throw err;
  }
};

// Call this once on app load to handle the redirect result
export const getGoogleRedirectResult = async () => {
  const result = await getRedirectResult(auth);
  if (!result) return null;
  const { user } = result;
  if (!user.email.endsWith(`@${ALLOWED_DOMAIN}`)) {
    await signOut(auth);
    throw new Error(`Only @${ALLOWED_DOMAIN} accounts are allowed.`);
  }
  return user;
};

// ─── Create Firestore user doc ────────────────────────────────────────────────
export const createUserDoc = async (uid, name, email, role) => {
  await setDoc(doc(db, 'users', uid), {
    uid,
    name,
    email,
    role,
    hostelId: null,
    floorId: null,
    blockId: null,
    roomNumber: null,
    createdAt: new Date(),
  });
};

// ─── Email/Password ───────────────────────────────────────────────────────────
export const registerUser = async (email, password, name, role) => {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await createUserDoc(cred.user.uid, name, email, role);
  return cred.user;
};

export const loginUser = async (email, password) => {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
};

export const logoutUser = () => signOut(auth);

export const getUserDoc = async (uid) => {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
};
