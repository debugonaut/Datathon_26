import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './config';

// ─── Hostel ─────────────────────────────────────────────────────────────────
export const createHostel = async (wardenId, name, collegeName) => {
  const ref = await addDoc(collection(db, 'hostels'), {
    wardenId,
    name,
    collegeName,
    createdAt: serverTimestamp(),
  });
  return ref.id;
};

export const searchHostels = async (searchTerm) => {
  const snap = await getDocs(collection(db, 'hostels'));
  const term = searchTerm.toLowerCase();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((h) => h.name.toLowerCase().includes(term));
};

export const getWardenHostel = async (wardenId) => {
  const q = query(collection(db, 'hostels'), where('wardenId', '==', wardenId));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
};

// ─── Floors ──────────────────────────────────────────────────────────────────
export const addFloor = async (hostelId, floorName) => {
  const ref = await addDoc(collection(db, 'hostels', hostelId, 'floors'), {
    name: floorName,
    createdAt: serverTimestamp(),
  });
  return ref.id;
};

export const getFloors = async (hostelId) => {
  const snap = await getDocs(collection(db, 'hostels', hostelId, 'floors'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// ─── Blocks ──────────────────────────────────────────────────────────────────
export const addBlock = async (hostelId, floorId, blockName) => {
  const ref = await addDoc(
    collection(db, 'hostels', hostelId, 'floors', floorId, 'blocks'),
    { name: blockName, createdAt: serverTimestamp() }
  );
  return ref.id;
};

export const getBlocks = async (hostelId, floorId) => {
  const snap = await getDocs(
    collection(db, 'hostels', hostelId, 'floors', floorId, 'blocks')
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// ─── Rooms ────────────────────────────────────────────────────────────────────
export const addRoom = async (hostelId, floorId, blockId, roomNumber) => {
  const ref = await addDoc(
    collection(
      db,
      'hostels', hostelId,
      'floors', floorId,
      'blocks', blockId,
      'rooms'
    ),
    { roomNumber, createdAt: serverTimestamp() }
  );
  return ref.id;
};

export const getRooms = async (hostelId, floorId, blockId) => {
  const snap = await getDocs(
    collection(
      db,
      'hostels', hostelId,
      'floors', floorId,
      'blocks', blockId,
      'rooms'
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// ─── Student join ────────────────────────────────────────────────────────────
export const joinHostel = async (uid, hostelId, floorId, blockId, roomNumber) => {
  await updateDoc(doc(db, 'users', uid), {
    hostelId,
    floorId,
    blockId,
    roomNumber,
  });
};
