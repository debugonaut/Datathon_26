import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  setDoc,
  query,
  where,
  serverTimestamp,
  writeBatch,
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

// ─── Hierarchy Reads ────────────────────────────────────────────────────────
export const getBlocks = async (hostelId) => {
  const snap = await getDocs(collection(db, 'hostels', hostelId, 'blocks'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getBuildings = async (hostelId, blockId) => {
  const snap = await getDocs(
    collection(db, 'hostels', hostelId, 'blocks', blockId, 'buildings')
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getFloors = async (hostelId, blockId, buildingId) => {
  const snap = await getDocs(
    collection(db, 'hostels', hostelId, 'blocks', blockId, 'buildings', buildingId, 'floors')
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getRooms = async (hostelId, blockId, buildingId, floorId) => {
  const snap = await getDocs(
    collection(
      db,
      'hostels', hostelId,
      'blocks', blockId,
      'buildings', buildingId,
      'floors', floorId,
      'rooms'
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getAllRooms = async (hostelId) => {
  // Utility for warden dashboard
  // We'll traverse down to get all rooms
  const rooms = [];
  const blocks = await getBlocks(hostelId);
  for (const b of blocks) {
    const buildings = await getBuildings(hostelId, b.id);
    for (const bld of buildings) {
      const floors = await getFloors(hostelId, b.id, bld.id);
      for (const fl of floors) {
        const r = await getRooms(hostelId, b.id, bld.id, fl.id);
        rooms.push(...r.map(room => ({
          ...room,
          blockName: b.name,
          buildingName: bld.name,
          floorNumber: fl.floorNumber
        })));
      }
    }
  }
  return rooms;
};

// ─── Student join ────────────────────────────────────────────────────────────
export const joinHostel = async (uid, hostelId, blockId, buildingId, floorId, roomId, roomNumber) => {
  const batch = writeBatch(db);

  // Update User
  const userRef = doc(db, 'users', uid);
  batch.update(userRef, {
    hostelId,
    blockId,
    buildingId,
    floorId,
    roomId,
    roomNumber,
  });

  // Assign user to Room
  const roomRef = doc(
    db, 'hostels', hostelId, 'blocks', blockId, 'buildings', buildingId, 'floors', floorId, 'rooms', roomId
  );
  // Important: In phase 2, we update studentUid. Prevents double-assignment if checked!
  batch.update(roomRef, { studentUid: uid });

  await batch.commit();
};

// ─── Announcements ───────────────────────────────────────────────────────────
export const getAnnouncements = async (hostelId) => {
  const q = query(collection(db, 'announcements'), where('hostelId', '==', hostelId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
};

export const createAnnouncement = async (hostelId, wardenId, message) => {
  await addDoc(collection(db, 'announcements'), {
    hostelId,
    wardenId,
    message,
    readBy: [],
    createdAt: serverTimestamp(),
  });
};

export const markAnnouncementRead = async (announcementId, uid, currentReadBy = []) => {
  if (currentReadBy.includes(uid)) return;
  await updateDoc(doc(db, 'announcements', announcementId), {
    readBy: [...currentReadBy, uid]
  });
};
