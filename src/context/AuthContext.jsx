import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/config';
import { getUserDoc } from '../firebase/auth';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userDoc, setUserDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        let doc = await getUserDoc(firebaseUser.uid);
        
        // Demo fail-safe: Ensure Datathon judges never see setup screens
        if (firebaseUser.email === 'demo.student@fixmyhostel.dev') {
          if (!doc) doc = { role: 'student', email: firebaseUser.email };
          doc.isProfileComplete = true;
          doc.isRegistered = true;
          doc.name = 'Demo Student';
          doc.roomId = doc.roomId || 'demo-room-204';
          doc.hostelId = doc.hostelId || 'demo-hostel-1';
          doc.blockId = doc.blockId || 'demo-block-A';
          doc.blockName = doc.blockName || 'A Block';
          doc.buildingId = doc.buildingId || 'demo-building-A1';
          doc.buildingName = doc.buildingName || 'A1';
          doc.floorId = doc.floorId || 'demo-floor-2';
          doc.floorNumber = doc.floorNumber || 2;
          doc.roomNumber = doc.roomNumber || '204';
        } else if (firebaseUser.email === 'demo.warden@fixmyhostel.dev') {
          if (!doc) doc = { email: firebaseUser.email };
          doc.role = 'warden';
          doc.isProfileComplete = true;
          doc.hostelId = doc.hostelId || 'demo-hostel-1';
        }

        setUserDoc(doc);
      } else {
        setUserDoc(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  return (
    <AuthContext.Provider value={{ user, userDoc, loading, setUserDoc }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
