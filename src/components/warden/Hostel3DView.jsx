import { useState, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { getAllRooms } from '../../firebase/firestore';

// ─── Room Box Component ──────────────────────────────────────────────────────
function RoomBox({ room, position, activeComplaints = [] }) {
  const [hovered, setHovered] = useState(false);
  const meshRef = useRef();
  
  // Determine if there's an active complaint and its max priority
  const hasActive = activeComplaints.length > 0;
  const maxPriority = useMemo(() => {
    if (!hasActive) return null;
    if (activeComplaints.some(c => c.priority === 'high')) return 'high';
    if (activeComplaints.some(c => c.priority === 'medium')) return 'medium';
    return 'low';
  }, [activeComplaints, hasActive]);

  // Determine window color
  let windowColor = '#4FA3F7'; // Default Blue
  if (hasActive) {
    if (maxPriority === 'high') windowColor = '#F06565';   // Red
    else if (maxPriority === 'medium') windowColor = '#F5A623'; // Amber
    else windowColor = '#22D3A0'; // Green
  } else if (room.score > 0) {
    if (room.score <= 40) windowColor = '#F06565';
    else if (room.score <= 70) windowColor = '#F5A623';
    else windowColor = '#22D3A0';
  }

  // Pulsating effect for active complaints
  useFrame((state) => {
    if (meshRef.current) {
      const baseScale = hovered ? 1.04 : 1.0;
      let pulse = 0;
      if (hasActive) {
        const speed = maxPriority === 'high' ? 4 : maxPriority === 'medium' ? 2 : 1;
        pulse = Math.sin(state.clock.elapsedTime * speed) * 0.02;
      }
      meshRef.current.scale.lerp(new THREE.Vector3(baseScale + pulse, baseScale + pulse, baseScale + pulse), 0.12);
    }
  });

  const wallColor = '#deb99a'; 
  const corniceColor = '#c9a080';

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={(e) => { e.stopPropagation(); setHovered(false); }}
      >
        <boxGeometry args={[1.92, 1.55, 1.92]} />
        <meshStandardMaterial color={wallColor} roughness={0.9} />
      </mesh>

      <mesh position={[0, 0.8, 0]}>
        <boxGeometry args={[2.05, 0.22, 2.05]} />
        <meshStandardMaterial color={corniceColor} roughness={0.9} />
      </mesh>
      
      <mesh position={[0, 0.1, 0.97]}>
        <boxGeometry args={[0.8, 0.9, 0.1]} />
        <meshStandardMaterial 
          color={windowColor} 
          emissive={windowColor} 
          emissiveIntensity={hasActive ? (hovered ? 2 : 1.2) : (hovered ? 1.2 : 0.6)} 
        />
      </mesh>

      <mesh position={[0.97, 0.1, 0]}>
        <boxGeometry args={[0.1, 0.9, 0.8]} />
        <meshStandardMaterial 
          color={windowColor} 
          emissive={windowColor} 
          emissiveIntensity={hasActive ? (hovered ? 2 : 1.2) : (hovered ? 1.2 : 0.6)} 
        />
      </mesh>

      <pointLight position={[0, 0.1, 1.1]} color={windowColor} intensity={hasActive ? 1.5 : (hovered ? 1.2 : 0.4)} distance={3} />

      {hovered && (
        <Html position={[0, 1.5, 0]} center zIndexRange={[100, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{
            background: '#1C2030', border: '1px solid #2E3448',
            padding: '10px 14px', borderRadius: '8px', color: '#EDF0FA', whiteSpace: 'nowrap',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)', fontSize: '13px', pointerEvents: 'none',
            minWidth: 160
          }}>
            <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 500, fontSize: 13, marginBottom: 4, borderBottom: '1px solid #2E3448', paddingBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
              <span>Room {room.roomNumber}</span>
              <span style={{ color: '#454D65', fontWeight: 'normal', fontSize: 11 }}>{room.blockName}</span>
            </div>
            
            {hasActive ? (
              <div style={{ color: windowColor, fontWeight: 'bold', fontSize: 12, marginBottom: 4 }}>
                <span className="material-icons-round" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 4 }}>warning</span>
                {activeComplaints.length} Active {activeComplaints.length > 1 ? 'Issues' : 'Issue'}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                Score: <strong style={{ color: windowColor }}>{room.score}</strong>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: windowColor }} />
              </div>
            )}
            
            <div style={{ color: '#7A82A0', fontSize: 11 }}>
              {room.currentOccupants || 0} / {room.maxOccupants || 2} Occupied
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

// ─── Main 3D Scene Component ─────────────────────────────────────────────────
export default function Warden3DView({ hostelId, complaints = [] }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRooms = async () => {
      const allRooms = await getAllRooms(hostelId);
      setRooms(allRooms);
      setLoading(false);
    };
    fetchRooms();
  }, [hostelId]);

  const modeledRooms = useMemo(() => {
    if (!rooms.length) return [];
    const bldGroups = {};
    for (const r of rooms) {
      if (!bldGroups[r.buildingName]) bldGroups[r.buildingName] = {};
      if (!bldGroups[r.buildingName][r.floorNumber]) bldGroups[r.buildingName][r.floorNumber] = [];
      bldGroups[r.buildingName][r.floorNumber].push(r);
    }
    const sceneData = { rooms: [], buildings: [] };
    let bldXOffset = 0;
    const ROOM_SIZE = 2;
    const FLOOR_HEIGHT = 1.6;
    const BLD_SPACING = 5;

    Object.keys(bldGroups).forEach(bldName => {
      const floors = bldGroups[bldName];
      let maxRoomsPerRowInBld = 0;
      let maxFloors = Object.keys(floors).length;
      let bldMinX = Infinity, bldMaxX = -Infinity;
      let bldMinZ = Infinity, bldMaxZ = -Infinity;

      Object.keys(floors).forEach(floorNumStr => {
        const floorNum = parseInt(floorNumStr, 10);
        const flRooms = floors[floorNumStr].sort((a,b) => a.roomNumber.localeCompare(b.roomNumber, undefined, {numeric: true}));
        const roomsPerRow = Math.ceil(Math.sqrt(flRooms.length));
        if (roomsPerRow > maxRoomsPerRowInBld) maxRoomsPerRowInBld = roomsPerRow;

        flRooms.forEach((r, idx) => {
          const row = Math.floor(idx / roomsPerRow);
          const col = idx % roomsPerRow;
          const x = bldXOffset + (col * ROOM_SIZE);
          const y = (floorNum - 1) * FLOOR_HEIGHT;
          const z = (row * ROOM_SIZE);

          const roomActiveComplaints = complaints.filter(c => c.roomId === r.id && c.status !== 'resolved');
          sceneData.rooms.push({ room: r, position: [x, y, z], activeComplaints: roomActiveComplaints });

          if (x < bldMinX) bldMinX = x;
          if (x > bldMaxX) bldMaxX = x;
          if (z < bldMinZ) bldMinZ = z;
          if (z > bldMaxZ) bldMaxZ = z;
        });
      });

      if (bldMinX !== Infinity) {
        const pad = 1.2;
        const width = (bldMaxX - bldMinX) + ROOM_SIZE + (pad * 2);
        const depth = (bldMaxZ - bldMinZ) + ROOM_SIZE + (pad * 2);
        const centerX = (bldMinX + bldMaxX) / 2;
        const centerZ = (bldMinZ + bldMaxZ) / 2;
        sceneData.buildings.push({ position: [centerX, -0.9, centerZ], args: [width, 0.4, depth], name: bldName, type: 'base', color: '#c9a090' });
        Object.keys(floors).forEach(floorNumStr => {
          const floorNum = parseInt(floorNumStr, 10);
          const slabY = (floorNum - 1) * FLOOR_HEIGHT - 0.1;
          sceneData.buildings.push({ position: [centerX, slabY, centerZ], args: [width, 0.18, depth], type: 'slab', color: '#c4956e' });
        });
        const roofY = (maxFloors - 1) * FLOOR_HEIGHT + 0.85 + 0.12;
        const roofWidth = (bldMaxX - bldMinX) + ROOM_SIZE;
        const roofDepth = (bldMaxZ - bldMinZ) + ROOM_SIZE;
        sceneData.buildings.push({ position: [centerX, roofY, centerZ], args: [roofWidth, 0.35, roofDepth], type: 'roof', color: '#e3b5a4' });
      }
      bldXOffset += (maxRoomsPerRowInBld * ROOM_SIZE) + BLD_SPACING;
    });

    if (sceneData.rooms.length > 0) {
      let minX = Infinity, maxX = -Infinity;
      let minZ = Infinity, maxZ = -Infinity;
      sceneData.rooms.forEach(d => {
        if (d.position[0] < minX) minX = d.position[0];
        if (d.position[0] > maxX) maxX = d.position[0];
        if (d.position[2] < minZ) minZ = d.position[2];
        if (d.position[2] > maxZ) maxZ = d.position[2];
      });
      const centerX = (minX + maxX) / 2;
      const centerZ = (minZ + maxZ) / 2;
      sceneData.rooms.forEach(d => { d.position[0] -= centerX; d.position[2] -= centerZ; });
      sceneData.buildings.forEach(b => { b.position[0] -= centerX; b.position[2] -= centerZ; });
    }
    return sceneData;
  }, [rooms, complaints]);

  if (loading) return <div className="text-center p-4">Initializing 3D Environment...</div>;
  if (rooms.length === 0) return <div className="text-secondary text-center p-4">No rooms have been mapped yet.</div>;

  return (
    <div className="animation-fade-in" style={{ height: '600px', width: '100%', position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)' }}>
      <Canvas camera={{ position: [10, 15, 20], fov: 45 }}>
        <color attach="background" args={['#0f172a']} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[15, 25, 10]} intensity={1.4} castShadow />
        <directionalLight position={[-8, 10, -5]} intensity={0.3} color="#b0c4de" />
        <hemisphereLight skyColor="#1e3a5f" groundColor="#3d2010" intensity={0.4} />

        <group position={[0, 0.5, 0]}>
          {modeledRooms.buildings.map((b, i) => (
            <mesh key={`bld-${i}`} position={b.position} castShadow receiveShadow>
              <boxGeometry args={b.args} />
              <meshStandardMaterial color={b.color} roughness={0.9} />
              {b.type === 'base' && (
                <Html position={[0, -0.2, (b.args[2]/2) + 0.5]} center style={{ pointerEvents: 'none' }}>
                  <div style={{ color: 'white', background: 'rgba(0,0,0,0.6)', padding: '4px 12px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.8rem' }}>{b.name}</div>
                </Html>
              )}
            </mesh>
          ))}
          {modeledRooms.rooms.map((data, idx) => (
            <RoomBox key={`${data.room.id}-${idx}`} room={data.room} position={data.position} activeComplaints={data.activeComplaints} />
          ))}
        </group>

        <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, -0.7, 0]} receiveShadow>
          <planeGeometry args={[80, 80]} />
          <meshStandardMaterial color="#0a1628" roughness={1} />
        </mesh>
        <ContactShadows position={[0, -0.68, 0]} opacity={0.6} scale={40} blur={2.5} far={12} color="#000820" />
        <OrbitControls makeDefault autoRotate autoRotateSpeed={0.5} minPolarAngle={0} maxPolarAngle={Math.PI/2 - 0.05} />
      </Canvas>

      <div style={{ position: 'absolute', bottom: 24, left: 24, background: 'rgba(19,22,30,0.9)', border: '1px solid #2E3448', borderRadius: 10, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.05em', marginBottom: 4 }}>URGENCY INDICATORS</div>
        {[
          { color: '#F06565', label: 'High Priority (Pulsing)' },
          { color: '#F5A623', label: 'Medium Priority' },
          { color: '#22D3A0', label: 'Low Priority' },
          { color: '#4FA3F7', label: 'No Active Issues' }
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: item.color }} />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#7A82A0' }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
