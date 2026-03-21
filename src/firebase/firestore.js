import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  setDoc,
  getDoc,
  query,
  where,
  serverTimestamp,
  writeBatch,
  collectionGroup,
  increment,
  runTransaction,
  arrayUnion,
  arrayRemove,
  Timestamp,
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
          blockId: b.id,
          buildingId: bld.id,
          floorId: fl.id,
          blockName: b.name,
          buildingName: bld.name,
          floorNumber: fl.floorNumber
        })));
      }
    }
  }

  // ── 3D VISUALIZER UPGRADE ── Fetch open complaints to attach `topComplaint`
  const compQ = query(
    collection(db, 'complaints'), 
    where('hostelId', '==', hostelId),
    where('status', 'in', ['todo', 'in_progress'])
  );
  const compSnap = await getDocs(compQ);
  
  const roomComplaints = {}; // roomId -> complaint[]
  compSnap.docs.forEach(d => {
    const data = d.data();
    if (!roomComplaints[data.roomId]) roomComplaints[data.roomId] = [];
    roomComplaints[data.roomId].push(data);
  });

  const priorityWeight = { high: 3, medium: 2, low: 1 };

  return rooms.map(room => {
    const comps = roomComplaints[room.id];
    let topC = null;
    if (comps && comps.length > 0) {
      comps.sort((a,b) => {
        const pDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
        if (pDiff !== 0) return pDiff;
        return (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0);
      });
      topC = comps[0].title;
    }
    return { ...room, topComplaint: topC };
  });
};

// Lightweight room counter for analytics (no complaint queries)
export const countAllRooms = async (hostelId) => {
  let count = 0;
  const blocks = await getBlocks(hostelId);
  for (const b of blocks) {
    const buildings = await getBuildings(hostelId, b.id);
    for (const bld of buildings) {
      const floors = await getFloors(hostelId, b.id, bld.id);
      for (const fl of floors) {
        const r = await getRooms(hostelId, b.id, bld.id, fl.id);
        count += r.length;
      }
    }
  }
  return count;
};

// ─── Student join ────────────────────────────────────────────────────────────
export const resolveRoomByCode = async (code) => {
  if (!code || code.length < 6) return null;
  const q = query(collectionGroup(db, 'rooms'));
  const snap = await getDocs(q);
  const targetIdSuffix = code.toLowerCase();
  
  const roomDoc = snap.docs.find(d => d.id.toLowerCase().endsWith(targetIdSuffix));
  if (!roomDoc) return null;

  const path = roomDoc.ref.path; // hostels/HID/blocks/BID/buildings/BLDID/floors/FID/rooms/RID
  const segments = path.split('/');
  return {
    hostelId: segments[1],
    blockId: segments[3],
    buildingId: segments[5],
    floorId: segments[7],
    roomId: segments[9],
    roomNumber: roomDoc.data().roomNumber,
    data: roomDoc.data()
  };
};

export const getRoomOccupancyCount = async (roomId) => {
  const q = query(collection(db, 'users'), where('roomId', '==', roomId));
  const snap = await getDocs(q);
  return snap.size;
};

export const joinRoomWithCodeData = async (uid, roomData) => {
  const max = roomData.data.maxOccupants || 2;
  const current = await getRoomOccupancyCount(roomData.roomId);
  
  if (current >= max) {
    throw new Error("This room is already full. Contact your warden.");
  }

  const batch = writeBatch(db);
  const userRef = doc(db, 'users', uid);
  batch.update(userRef, {
    hostelId: roomData.hostelId,
    blockId: roomData.blockId,
    buildingId: roomData.buildingId,
    floorId: roomData.floorId,
    roomId: roomData.roomId,
    roomNumber: roomData.roomNumber,
  });

  const roomRef = doc(db, 'hostels', roomData.hostelId, 'blocks', roomData.blockId, 'buildings', roomData.buildingId, 'floors', roomData.floorId, 'rooms', roomData.roomId);
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

// ─── Complaints Ticketing System ──────────────────────────────────────────────
export const createComplaint = async (data) => {
  const batch = writeBatch(db);
  const complaintRef = doc(collection(db, 'complaints'));
  
  const compData = {
    ...data,
    id: complaintRef.id,
    status: 'todo',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    resolvedAt: null,
  };
  
  batch.set(complaintRef, compData);

  // Score Logic: Deduct based on priority
  let scoreDrop = 0;
  if (data.priority === 'low') scoreDrop = -5;
  if (data.priority === 'medium') scoreDrop = -15;
  if (data.priority === 'high') scoreDrop = -30;

  const roomRef = doc(db, 'hostels', data.hostelId, 'blocks', data.blockId, 'buildings', data.buildingId, 'floors', data.floorId, 'rooms', data.roomId);
  
  batch.update(roomRef, {
    score: increment(scoreDrop)
  });

  await batch.commit();
  return complaintRef.id;
};

export const updateComplaintStatus = async (complaint, newStatus) => {
  if (complaint.status === newStatus) return;
  
  const batch = writeBatch(db);
  const complaintRef = doc(db, 'complaints', complaint.id);
  
  const updateData = {
    status: newStatus,
    updatedAt: serverTimestamp()
  };
  
  // ── AUTO-DELETION ON ACKNOWLEDGMENT ───────────────────────────────────
  // Acknowledge = move from todo to in_progress
  if (complaint.status === 'todo' && newStatus === 'in_progress') {
    updateData.acknowledgedAt = serverTimestamp();
    
    // Deletion logic (Cloudinary Migration: Just scrub the links from the DB)
    if (complaint.mediaUrls && complaint.mediaUrls.length > 0) {
      updateData.mediaUrls = [];
      updateData.mediaPaths = [];
      updateData.internalNotes = arrayUnion({
        text: "System: Original media attachments scrubbed from complaint view upon acknowledgment to protect privacy.",
        createdAt: Timestamp.now(),
        wardenName: "System"
      });
    }
  }

  const wasOpen = complaint.status !== 'resolved';
  const isNowResolved = newStatus === 'resolved';

  let scoreChange = 0;
  let penalty = 0;
  if (complaint.priority === 'low') penalty = 5;
  if (complaint.priority === 'medium') penalty = 15;
  if (complaint.priority === 'high') penalty = 30;

  if (wasOpen && isNowResolved) {
    scoreChange = penalty; // restore points
    updateData.resolvedAt = serverTimestamp();
  } else if (!wasOpen && !isNowResolved && newStatus !== 'todo') {
    scoreChange = -penalty; // deduct points again
    updateData.resolvedAt = null;
  }

  batch.update(complaintRef, updateData);

  if (scoreChange !== 0) {
    const roomRef = doc(db, 'hostels', complaint.hostelId, 'blocks', complaint.blockId, 'buildings', complaint.buildingId, 'floors', complaint.floorId, 'rooms', complaint.roomId);
    batch.update(roomRef, {
      score: increment(scoreChange)
    });
  }

  await batch.commit();
};

// ─── Phase 6: Profile & Occupancy ─────────────────────────────────────────────

export const checkPRNExists = async (prn) => {
  const q = query(collection(db, 'users'), where('PRN', '==', prn));
  const snap = await getDocs(q);
  return !snap.empty;
};

export const joinRoomTransaction = async (uid, roomData, studentData) => {
  const roomRef = doc(
    db, 'hostels', roomData.hostelId,
    'blocks', roomData.blockId,
    'buildings', roomData.buildingId,
    'floors', roomData.floorId,
    'rooms', roomData.roomId
  );
  const userRef = doc(db, 'users', uid);

  await runTransaction(db, async (transaction) => {
    const roomSnap = await transaction.get(roomRef);
    if (!roomSnap.exists()) throw new Error('Room not found.');

    const room = roomSnap.data();
    const maxOcc = room.maxOccupants || 2;
    const currentOcc = room.currentOccupants || 0;

    if (currentOcc >= maxOcc) {
      throw new Error('This room is full. Please contact your warden.');
    }

    // Check PRN hash uniqueness in this room
    const occupants = room.occupants || [];
    if (occupants.some(o => o.PRN_hash === studentData.PRN_hash)) {
      throw new Error('Your PRN is already registered to this room.');
    }

    transaction.update(roomRef, {
      currentOccupants: increment(1),
      occupants: arrayUnion({
        uid,
        name: studentData.name,
        PRN_hash: studentData.PRN_hash
      })
    });

    transaction.update(userRef, {
      roomId: roomData.roomId,
      hostelId: roomData.hostelId,
      blockId: roomData.blockId,
      buildingId: roomData.buildingId,
      floorId: roomData.floorId,
      roomNumber: roomData.roomNumber,
      buildingName: roomData.buildingName || '',
      floorNumber: roomData.floorNumber || '',
      isRegistered: true,
      registeredAt: serverTimestamp()
    });
  });
};

export const ejectStudentTransaction = async (occupantEntry, roomPath) => {
  // roomPath = { hostelId, blockId, buildingId, floorId, roomId }
  const roomRef = doc(
    db, 'hostels', roomPath.hostelId,
    'blocks', roomPath.blockId,
    'buildings', roomPath.buildingId,
    'floors', roomPath.floorId,
    'rooms', roomPath.roomId
  );
  const userRef = doc(db, 'users', occupantEntry.uid);

  await runTransaction(db, async (transaction) => {
    const roomSnap = await transaction.get(roomRef);
    if (!roomSnap.exists()) throw new Error('Room not found.');

    transaction.update(roomRef, {
      currentOccupants: increment(-1),
      occupants: arrayRemove(occupantEntry)
    });

    transaction.update(userRef, {
      roomId: null,
      hostelId: null,
      blockId: null,
      buildingId: null,
      floorId: null,
      roomNumber: null,
      buildingName: null,
      floorNumber: null,
      isRegistered: false
    });
  });
};

export const getRoomByPath = async (hostelId, blockId, buildingId, floorId, roomId) => {
  const roomRef = doc(db, 'hostels', hostelId, 'blocks', blockId, 'buildings', buildingId, 'floors', floorId, 'rooms', roomId);
  const snap = await getDoc(roomRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
};
