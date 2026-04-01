import {
  collection,
  query,
  where,
  getDocs,
  limit,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

const POOL = 'matching_pool';

/** Add current user to the matching pool */
export async function joinPool(uid, { name, gender, country, isSubscriber, peerId }) {
  await setDoc(doc(db, POOL, uid), {
    uid,
    name,
    gender,
    country,
    isSubscriber,
    peerId,
    status: 'available',
    timestamp: serverTimestamp(),
  });
}

/** Mark user as busy */
export async function markBusy(uid) {
  try {
    await updateDoc(doc(db, POOL, uid), { status: 'busy' });
  } catch (_) {}
}

/** Remove user from pool */
export async function leavePool(uid) {
  try {
    await deleteDoc(doc(db, POOL, uid));
  } catch (_) {}
}

/** Free user – random global match */
export async function findMatch(uid) {
  const q = query(
    collection(db, POOL),
    where('status', '==', 'available'),
    limit(10)
  );
  const snap = await getDocs(q);
  const others = snap.docs.filter((d) => d.id !== uid);
  if (others.length === 0) return null;
  const picked = others[Math.floor(Math.random() * others.length)];
  return { id: picked.id, ...picked.data() };
}

/** Subscriber – filtered match by gender and/or country */
export async function findFilteredMatch(uid, filterGender, filterCountry) {
  let q = query(
    collection(db, POOL),
    where('status', '==', 'available'),
    limit(20)
  );
  const snap = await getDocs(q);
  let others = snap.docs
    .filter((d) => d.id !== uid)
    .map((d) => ({ id: d.id, ...d.data() }));

  if (filterGender && filterGender !== 'Any') {
    others = others.filter((u) => u.gender === filterGender);
  }
  if (filterCountry && filterCountry !== 'Any') {
    others = others.filter((u) => u.country === filterCountry);
  }
  if (others.length === 0) return null;
  return others[Math.floor(Math.random() * others.length)];
}
