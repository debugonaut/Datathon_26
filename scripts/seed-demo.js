import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env');

const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...values] = line.split('=');
  if (key && values.length > 0) {
    env[key.trim()] = values.join('=').trim().replace(/['"]/g, '');
  }
});

import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, deleteDoc, query, where, Timestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const STUDENT_EMAIL = 'demo.student@fixmyhostel.dev';
const STUDENT_PASS = 'DemoStudent123';
const WARDEN_EMAIL = 'demo.warden@fixmyhostel.dev';
const WARDEN_PASS = 'DemoWarden123';

async function getOrCreateUser(email, password) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    console.log(`Created ${email} -> UID: ${cred.user.uid}`);
    return cred.user.uid;
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      console.log(`Logged into existing ${email} -> UID: ${cred.user.uid}`);
      return cred.user.uid;
    }
    throw err;
  }
}

async function run() {
  console.log('Starting seed...');
  
  const wardenUid = await getOrCreateUser(WARDEN_EMAIL, WARDEN_PASS);
  const studentUid = await getOrCreateUser(STUDENT_EMAIL, STUDENT_PASS);

  // Sign in as warden to make sure we have write access for the whole hierarchy
  await signInWithEmailAndPassword(auth, WARDEN_EMAIL, WARDEN_PASS);

  const hostelId = 'demo-hostel-1';
  const blockId = 'demo-block-A';
  const buildingId = 'demo-building-A1';
  const room204Id = 'demo-room-204';

  console.log('--- CLEANUP: Removing demo hostel ---');
  await deleteDoc(doc(db, 'hostels', hostelId));

  console.log('Seeding user profiles...');
  await setDoc(doc(db, 'users', wardenUid), {
    role: 'warden',
    name: 'Demo Warden',
    email: WARDEN_EMAIL,
    hostelId: hostelId,
    isProfileComplete: true
  });

  await setDoc(doc(db, 'users', studentUid), {
    role: 'student',
    name: 'Demo Student',
    email: STUDENT_EMAIL,
    PRN_hash: '21010112',
    isProfileComplete: true,
    isRegistered: true,
    roomId: room204Id,
    hostelId, blockId, buildingId, floorId: 'demo-floor-2', roomNumber: '204',
    blockName: 'A Block', buildingName: 'A1', floorNumber: 2
  });
  
  console.log('Seeding hostel hierarchy...');

  await setDoc(doc(db, 'hostels', hostelId), {
    name: 'Excellence Boys Hostel',
    collegeName: 'MIT Academy of Engineering',
    wardenId: wardenUid,
    createdAt: Timestamp.now()
  });

  await setDoc(doc(db, 'hostels', hostelId, 'blocks', blockId), { name: 'A Block' });
  await setDoc(doc(db, 'hostels', hostelId, 'blocks', blockId, 'buildings', buildingId), { name: 'A1', blockId });

  const roomDocRefs = [];
  const floors = 4;
  const roomsPerFloor = 6;

  for (let f = 1; f <= floors; f++) {
    const floorId = `demo-floor-${f}`;
    await setDoc(doc(db, 'hostels', hostelId, 'blocks', blockId, 'buildings', buildingId, 'floors', floorId), {
      name: `Floor ${f}`, buildingId, floorNumber: f
    });

    for (let r = 1; r <= roomsPerFloor; r++) {
      const roomNum = f * 100 + r;
      const roomId = `demo-room-${roomNum}`;
      const is204 = roomNum === 204;
      
      const shortCode = roomId.slice(-6).toUpperCase();
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${shortCode}`;

      const rData = {
        roomNumber: String(roomNum),
        floorId,
        buildingId,
        blockId,
        hostelId,
        maxOccupants: 2,
        currentOccupants: is204 ? 1 : 0,
        occupants: is204 ? [{ uid: studentUid, name: 'Demo Student' }] : [],
        score: Math.floor(Math.random() * (100 - 60 + 1) + 60),
        qrCodeUrl,
        buildingName: 'A1',
        floorNumber: f
      };

      const roomRef = doc(db, 'hostels', hostelId, 'blocks', blockId, 'buildings', buildingId, 'floors', floorId, 'rooms', roomId);
      await setDoc(roomRef, rData);
      roomDocRefs.push({ roomId, roomNumber: String(roomNum), floorId });

      if (is204) {
        await setDoc(doc(roomRef, 'history', 'hist1'), {
          title: 'AC Fan Noise',
          category: 'Electrical',
          priority: 'medium',
          status: 'resolved',
          studentUid: 'past-tenant-1',
          createdAt: Timestamp.fromDate(new Date(Date.now() - 90 * 86400000)),
          resolvedAt: Timestamp.fromDate(new Date(Date.now() - 88 * 86400000))
        });
        await setDoc(doc(roomRef, 'history', 'hist2'), {
          title: 'Water pipe leakage',
          category: 'Plumbing',
          priority: 'high',
          status: 'resolved',
          studentUid: 'past-tenant-2',
          createdAt: Timestamp.fromDate(new Date(Date.now() - 40 * 86400000)),
          resolvedAt: Timestamp.fromDate(new Date(Date.now() - 39 * 86400000))
        });
      }
    }
  }

  console.log('Seeding complaints...');
  const complaintsRef = collection(db, 'complaints');
  const now = Date.now();
  const hoursAgo = (h) => Timestamp.fromDate(new Date(now - h * 3600000));

  const complaints = [
    // Room 204
    { hostelId, blockId, buildingId, floorId: 'demo-floor-2', roomId: room204Id, studentUid, studentName: 'Demo Student', roomNumber: '204', reopenCount: 0, status: 'todo', priority: 'high', category: 'Electrical', title: 'Main switch board sparking', description: 'When I use the top socket, there are visible sparks and a burnt smell.', createdAt: hoursAgo(1) },
    { hostelId, blockId, buildingId, floorId: 'demo-floor-2', roomId: room204Id, studentUid, studentName: 'Demo Student', roomNumber: '204', reopenCount: 0, status: 'in_progress', priority: 'medium', category: 'Plumbing', title: 'Sink drain clogged', description: 'Water is draining very slowly in the bathroom sink.', createdAt: hoursAgo(24) },
    { hostelId, blockId, buildingId, floorId: 'demo-floor-2', roomId: room204Id, studentUid, studentName: 'Demo Student', roomNumber: '204', reopenCount: 0, status: 'resolved', priority: 'low', category: 'Furniture', title: 'Loose door handle', description: 'The handle on the balcony door feels like it might fall off.', createdAt: hoursAgo(48), resolvedAt: hoursAgo(20) },

    // Other Rooms
    { hostelId, blockId, buildingId, floorId: 'demo-floor-1', roomId: 'demo-room-101', studentUid: 'student-101', studentName: 'Rahul Kumar', roomNumber: '101', reopenCount: 0, status: 'todo', priority: 'medium', category: 'Cleaning', title: 'Common area dusty', description: 'The corridor outside room 101 hasn\'t been cleaned since 3 days.', createdAt: hoursAgo(5) },
    { hostelId, blockId, buildingId, floorId: 'demo-floor-3', roomId: 'demo-room-305', studentUid: 'student-305', studentName: 'Aditya Shah', roomNumber: '305', reopenCount: 0, status: 'in_progress', priority: 'high', category: 'Electrical', title: 'Fan regulator broken', description: 'Fan is running only at full speed, regulator knob is jammed.', createdAt: hoursAgo(12) },
    { hostelId, blockId, buildingId, floorId: 'demo-floor-4', roomId: 'demo-room-402', studentUid: 'student-402', studentName: 'Sameer Sen', roomNumber: '402', reopenCount: 0, status: 'todo', priority: 'high', category: 'Water', title: 'No water in geyser', description: 'The geyser isn\'t filling or heating water. Urgent for morning.', createdAt: hoursAgo(3) },
    
    // SLA / ETA Examples
    { hostelId, blockId, buildingId, floorId: 'demo-floor-2', roomId: 'demo-room-202', studentUid: 'student-202', studentName: 'Karan Mehra', roomNumber: '202', reopenCount: 0, status: 'todo', priority: 'medium', category: 'Furniture', title: 'Broken cupboard lock', description: 'I cannot lock my cupboard anymore.', createdAt: hoursAgo(8), acknowledgedByWarden: true, estimatedResolutionAt: new Date(now + 24*3600000).toISOString().slice(0, 16) },
    { hostelId, blockId, buildingId, floorId: 'demo-floor-1', roomId: 'demo-room-105', studentUid: 'student-105', studentName: 'Vivek Singh', roomNumber: '105', reopenCount: 0, status: 'todo', priority: 'high', category: 'Plumbing', title: 'Washroom flush broken', description: 'The flush is continuously running and wasting water.', createdAt: hoursAgo(30) }, // Over 24h old high priority
  ];

  for (let c of complaints) {
    const cd = doc(complaintsRef);
    await setDoc(cd, c);
  }

  console.log('✅ Demo seeding complete!');
  process.exit(0);
}

run().catch(console.error);
