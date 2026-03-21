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
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';

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

const TEST_STUDENT = { email: 'test.student@fixmyhostel.dev', pass: 'TestStudent123' };
const TEST_WARDEN = { email: 'test.warden@fixmyhostel.dev', pass: 'TestWarden123' };

async function getOrCreateUser(email, password) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    console.log(`Created ${email} -> UID: ${cred.user.uid}`);
    return cred.user.uid;
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      console.log(`Using existing ${email} -> UID: ${cred.user.uid}`);
      return cred.user.uid;
    }
    throw err;
  }
}

async function run() {
  console.log('Creating Test Accounts...');
  
  const wUid = await getOrCreateUser(TEST_WARDEN.email, TEST_WARDEN.pass);
  const sUid = await getOrCreateUser(TEST_STUDENT.email, TEST_STUDENT.pass);

  // WARDEN - Pre-setup profile
  await setDoc(doc(db, 'users', wUid), {
    email: TEST_WARDEN.email,
    name: 'Test Warden',
    role: 'warden',
    isProfileComplete: true,
    createdAt: serverTimestamp()
  });

  // STUDENT - Pre-setup profile (but no room yet so they can test joining)
  await setDoc(doc(db, 'users', sUid), {
    email: TEST_STUDENT.email,
    name: 'Test Student',
    role: 'student',
    PRN: '999999999999',
    isProfileComplete: true,
    isRegistered: false,
    createdAt: serverTimestamp()
  });

  console.log('\n✅ Test Accounts Created Successfully!');
  console.log('------------------------------------');
  console.log('Warden: ', TEST_WARDEN.email, ' / ', TEST_WARDEN.pass);
  console.log('Student:', TEST_STUDENT.email, ' / ', TEST_STUDENT.pass);
  console.log('------------------------------------');
  process.exit(0);
}

run().catch(console.error);
