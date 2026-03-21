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
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';

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

  console.log('Checking existing user profiles...');
  const studentSnap = await getDoc(doc(db, 'users', studentUid));
  const wardenSnap = await getDoc(doc(db, 'users', wardenUid));

  if (studentSnap.exists() && wardenSnap.exists() && false) { // Force re-seed for metadata fix
    const sData = studentSnap.data();
    const wData = wardenSnap.data();
    if (sData.isProfileComplete && sData.isRegistered && sData.roomId && wData.isProfileComplete && wData.hostelId) {
      console.log('✅ Demo users already fully populated. Exiting early (idempotent skip).');
      process.exit(0);
    }
  }

  console.log('Overwriting/Seeding user profiles...');
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
    PRN: '210101120001',
    isProfileComplete: true,
    isRegistered: true,
    roomId: room204Id,
    hostelId, blockId, buildingId, floorId: 'demo-floor-2', roomNumber: '204',
    buildingName: 'A1', floorNumber: 2
  });
  
  console.log('Seeding hostel hierarchy...');
  // Ensure hostel exists
  await setDoc(doc(db, 'hostels', hostelId), {
    name: 'MITAOE Boys Hostel',
    collegeName: 'MIT Academy of Engineering',
    wardenId: wardenUid,
    createdAt: Timestamp.now()
  });

  // Block
  await setDoc(doc(db, 'hostels', hostelId, 'blocks', blockId), { name: 'A Block' });

  // Building
  await setDoc(doc(db, 'hostels', hostelId, 'buildings', buildingId), { name: 'A1', blockId });

  // Floors & Rooms
  const roomDocRefs = [];

  for (let f = 1; f <= 3; f++) {
    const floorId = `demo-floor-${f}`;
    await setDoc(doc(db, 'hostels', hostelId, 'floors', floorId), {
      name: `Floor ${f}`, buildingId, floorNumber: f
    });

    for (let r = 1; r <= 4; r++) {
      const roomNum = f * 100 + r;
      const roomId = `demo-room-${roomNum}`;
      const is204 = roomNum === 204;
      
      const rData = {
        roomNumber: String(roomNum),
        floorId,
        buildingId,
        blockId,
        hostelId,
        maxOccupants: 2,
        currentOccupants: is204 ? 1 : 0,
        occupants: is204 ? [{ uid: studentUid, name: 'Demo Student' }] : [],
        score: is204 ? 55 : 100
      };

      const roomRef = doc(db, 'hostels', hostelId, 'blocks', blockId, 'buildings', buildingId, 'floors', floorId, 'rooms', roomId);
      await setDoc(roomRef, rData);
      roomDocRefs.push(roomId);

      if (is204) {
        console.log('Adding room history aliases to 204...');
        await setDoc(doc(roomRef, 'history', 'hist1'), {
          title: 'AC totally broken',
          category: 'Electrical',
          priority: 'high',
          status: 'resolved',
          studentUid: 'past-tenant-1',
          createdAt: Timestamp.fromDate(new Date(Date.now() - 90 * 86400000)),
          resolvedAt: Timestamp.fromDate(new Date(Date.now() - 88 * 86400000))
        });
        await setDoc(doc(roomRef, 'history', 'hist2'), {
          title: 'Bed frame squeaky missing screws',
          category: 'Furniture',
          priority: 'low',
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

  const baseComp = {
    hostelId, blockId, buildingId, floorId: 'demo-floor-2', roomId: room204Id,
    studentUid, studentName: 'Demo Student', roomNumber: '204', reopenCount: 0
  };

  const now = Date.now();
  const hoursAgo = (h) => Timestamp.fromDate(new Date(now - h * 3600000));

  const complaints = [
    { ...baseComp, status: 'todo', priority: 'high', category: 'Electrical', title: 'Sparking switchboard in room 204', description: 'When I plug in my laptop the switchboard sparks and smells like burning plastic.', createdAt: hoursAgo(2) },
    { ...baseComp, status: 'todo', priority: 'medium', category: 'Plumbing', title: 'Leaking tap in bathroom', description: 'The sink tap is constantly dripping wasting water.', createdAt: hoursAgo(5) },
    { ...baseComp, status: 'in_progress', priority: 'high', category: 'Electrical', title: 'Power outage on Floor 2', description: 'My room and the hallway have no power since morning.', createdAt: hoursAgo(10) },
    { ...baseComp, status: 'in_progress', priority: 'medium', category: 'Furniture', title: 'Broken study chair', description: 'The backrest of my chair snapped off.', createdAt: hoursAgo(24) },
    { ...baseComp, status: 'resolved', priority: 'high', category: 'Plumbing', title: 'No hot water', description: 'Geyser is broken, only cold water coming out.', createdAt: hoursAgo(48), resolvedAt: hoursAgo(20) },
    { ...baseComp, status: 'resolved', priority: 'low', category: 'Cleaning', title: 'Garbage not collected', description: 'Dustbin is overflowing for two days.', createdAt: hoursAgo(72), resolvedAt: hoursAgo(60) },
    // ETA feature demo
    { ...baseComp, status: 'todo', priority: 'medium', category: 'Other', title: 'Window mesh torn', description: 'Mosquitoes are coming in due to a large tear in the window mesh.', createdAt: hoursAgo(8), acknowledgedByWarden: true, estimatedResolutionAt: new Date(now + 48*3600000).toISOString().slice(0, 16) },
    // SLA Breach demo (25+ hours high priority, not resolved)
    { ...baseComp, status: 'todo', priority: 'high', category: 'Plumbing', title: 'Sewage backup in common washroom', description: 'Water is pooling and smells terrible on the floor 2 common washroom.', createdAt: hoursAgo(26) },
  ];

  for (let c of complaints) {
    const cd = doc(complaintsRef);
    await setDoc(cd, c);
  }

  // Ensure package.json is setup with type module for this run if needed
  console.log('✅ Demo seeding complete!');
  process.exit(0);
}

run().catch(console.error);
