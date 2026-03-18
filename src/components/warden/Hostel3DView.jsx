import { useState, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { getAllRooms } from '../../firebase/firestore';

// ─── Room Box Component ──────────────────────────────────────────────────────
function RoomBox({ room, position }) {
  const [hovered, setHovered] = useState(false);
  
  // Determine color based on score
  let color = '#94a3b8'; // score 0 or undefined -> empty/gray
  if (room.score > 0) {
    if (room.score <= 40) color = '#ef4444'; // Red
    else if (room.score <= 70) color = '#f59e0b'; // Yellow/Orange
    else color = '#10b981'; // Green
  }

  return (
    <group position={position}>
      <mesh
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={(e) => { e.stopPropagation(); setHovered(false); }}
      >
        <boxGeometry args={[1.8, 1, 1.8]} />
        <meshStandardMaterial 
          color={color} 
          roughness={0.2} 
          metalness={0.1}
          emissive={hovered ? color : '#000000'}
          emissiveIntensity={hovered ? 0.4 : 0}
        />
        
        {/* Outline for better visibility */}
        <lineSegments>
          <edgesGeometry args={[new THREE.BoxGeometry(1.8, 1, 1.8)]} />
          <lineBasicMaterial color="#ffffff" transparent opacity={0.15} />
        </lineSegments>
      </mesh>

      {/* HTML Tooltip overlay on hover */}
      {hovered && (
        <Html position={[0, 1, 0]} center zIndexRange={[100, 0]}>
          <div style={{
            background: 'var(--glass)',
            backdropFilter: 'blur(8px)',
            border: '1px solid var(--border)',
            padding: '8px 12px',
            borderRadius: '8px',
            color: 'white',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            fontSize: '0.8rem',
            pointerEvents: 'none'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px', borderBottom: '1px solid var(--border)', paddingBottom: '2px' }}>
              Room {room.roomNumber}
            </div>
            <div>Score: <strong style={{ color }}>{room.score}</strong></div>
            <div style={{ color: 'var(--text-muted)' }}>Status: {room.studentUid ? 'Occupied' : 'Vacant'}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '4px' }}>
              {room.blockName} • {room.buildingName} • Fl {room.floorNumber}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

// ─── Main 3D Scene Component ─────────────────────────────────────────────────
export default function Warden3DView({ hostelId }) {
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

  // Procedural geometry engine: groups rooms by building & floor, calculating their 3D coords
  const modeledRooms = useMemo(() => {
    if (!rooms.length) return [];

    // 1. Group by Building ID ensuring separation by buildings
    const bldGroups = {};
    for (const r of rooms) {
      if (!bldGroups[r.buildingName]) bldGroups[r.buildingName] = {};
      if (!bldGroups[r.buildingName][r.floorNumber]) bldGroups[r.buildingName][r.floorNumber] = [];
      bldGroups[r.buildingName][r.floorNumber].push(r);
    }

    const sceneData = [];
    let bldXOffset = 0;

    // Margin configurations
    const ROOM_SPACING_X = 2.2;
    const ROOM_SPACING_Z = 2.2;
    const FLOOR_HEIGHT = 1.5;
    const BLD_SPACING = 5;

    Object.keys(bldGroups).forEach(bldName => {
      const floors = bldGroups[bldName];
      let maxRoomsPerRowInBld = 0;

      Object.keys(floors).forEach(floorNumStr => {
        const floorNum = parseInt(floorNumStr, 10);
        const flRooms = floors[floorNumStr].sort((a,b) => a.roomNumber.localeCompare(b.roomNumber, undefined, {numeric: true}));
        
        // Layout rooms in a square grid per floor
        const roomsPerRow = Math.ceil(Math.sqrt(flRooms.length));
        if (roomsPerRow > maxRoomsPerRowInBld) maxRoomsPerRowInBld = roomsPerRow;

        flRooms.forEach((r, idx) => {
          const row = Math.floor(idx / roomsPerRow);
          const col = idx % roomsPerRow;
          
          const x = bldXOffset + (col * ROOM_SPACING_X);
          const y = (floorNum - 1) * FLOOR_HEIGHT;
          const z = (row * ROOM_SPACING_Z);

          sceneData.push({ room: r, position: [x, y, z] });
        });
      });

      // Shift next building to the right by the width of this building + gap
      bldXOffset += (maxRoomsPerRowInBld * ROOM_SPACING_X) + BLD_SPACING;
    });

    // Center the entire cluster around 0,0,0
    if (sceneData.length > 0) {
      let minX = Infinity, maxX = -Infinity;
      let minZ = Infinity, maxZ = -Infinity;
      sceneData.forEach(d => {
        if (d.position[0] < minX) minX = d.position[0];
        if (d.position[0] > maxX) maxX = d.position[0];
        if (d.position[2] < minZ) minZ = d.position[2];
        if (d.position[2] > maxZ) maxZ = d.position[2];
      });
      const centerX = (minX + maxX) / 2;
      const centerZ = (minZ + maxZ) / 2;
      
      sceneData.forEach(d => {
        d.position[0] -= centerX;
        d.position[2] -= centerZ;
      });
    }

    return sceneData;
  }, [rooms]);

  if (loading) return <div className="text-center p-4">Initializing 3D Environment...</div>;
  if (rooms.length === 0) return <div className="text-muted text-center p-4">No rooms have been mapped yet.</div>;

  return (
    <div className="animation-fade-in" style={{ height: '600px', width: '100%', position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)' }}>
      
      {/* 3D Canvas */}
      <Canvas camera={{ position: [10, 15, 20], fov: 45 }}>
        <color attach="background" args={['#0f172a']} />
        
        {/* Lights */}
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 20, 5]} intensity={1} castShadow />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />

        {/* Render Rooms */}
        <group position={[0, 0.5, 0]}>
          {modeledRooms.map((data, idx) => (
            <RoomBox key={`${data.room.id}-${idx}`} room={data.room} position={data.position} />
          ))}
        </group>

        {/* Floor grid & ground shadow */}
        <gridHelper args={[100, 100, '#1e293b', '#1e293b']} position={[0, -0.01, 0]} />
        <ContactShadows position={[0, 0, 0]} opacity={0.4} scale={50} blur={2} far={10} />

        {/* Controls */}
        <OrbitControls makeDefault autoRotate autoRotateSpeed={0.5} minPolarAngle={0} maxPolarAngle={Math.PI / 2 - 0.05} />
      </Canvas>

      {/* UI Overlay Legend */}
      <div style={{
        position: 'absolute', bottom: '1rem', left: '50%', transform: 'translateX(-50%)',
        background: 'var(--glass)', backdropFilter: 'blur(12px)', border: '1px solid var(--border)',
        padding: '0.75rem 1.5rem', borderRadius: '999px', display: 'flex', gap: '1.5rem',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
      }}>
        <div className="flex align-items-center gap-1">
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#94a3b8' }}></div>
          <span className="text-sm font-bold">Unmapped (0)</span>
        </div>
        <div className="flex align-items-center gap-1">
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#10b981' }}></div>
          <span className="text-sm font-bold">Good (71-100)</span>
        </div>
        <div className="flex align-items-center gap-1">
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#f59e0b' }}></div>
          <span className="text-sm font-bold">Warning (41-70)</span>
        </div>
        <div className="flex align-items-center gap-1">
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444' }}></div>
          <span className="text-sm font-bold">Critical (1-40)</span>
        </div>
      </div>
      
      {/* Instructions */}
      <div style={{ position: 'absolute', top: '1rem', left: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem', pointerEvents: 'none' }}>
        Left-click drag to rotate • Scroll to zoom • Right-click drag to pan
      </div>
    </div>
  );
}
