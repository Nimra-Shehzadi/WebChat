import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAOLcz9KoZammoughozgDdn8h_n3sAVQcg",
  authDomain: "webchat-4cad4.firebaseapp.com",
  projectId: "webchat-4cad4",
  storageBucket: "webchat-4cad4.firebasestorage.app",
  messagingSenderId: "454722546836",
  appId: "1:454722546836:web:a62c46f86965d5f7b45881",
  measurementId: "G-RKCDE2D0RV"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

/** Open Google sign-in popup */
export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

/** Sign out current user */
export function signOutUser() {
  return signOut(auth);
}

/**
 * Check whether the signed-in user is a subscriber.
 * Returns { isSubscriber: boolean, emailVerified: boolean }
 */
export async function checkSubscriber(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return { isSubscriber: false, emailVerified: false };
  const data = snap.data();
  return {
    isSubscriber: !!data.subscriber,
    emailVerified: !!data.email_verified,
  };
}

/**
 * Create or update the user document in Firestore after first login.
 */
export async function upsertUser(uid, payload) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      subscriber: false,
      savedConnections: [],
      createdAt: serverTimestamp(),
      ...payload,
    });
  } else {
    await updateDoc(ref, payload);
  }
}

export { onAuthStateChanged };
