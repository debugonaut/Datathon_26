import { useState, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { getAllRooms } from '../../firebase/firestore';

// ─── Room Box Component ──────────────────────────────────────────────────────
function RoomBox({ room, position }) {
  const [hovered, setHovered] = useState(false);
  
  // Determine window color based on score
  let windowColor = '#4FA3F7'; // Unmapped -> Blue
  if (room.score > 0) {
    if (room.score <= 40) windowColor = '#F06565'; // Red
    else if (room.score <= 70) windowColor = '#F5A623'; // Amber
    else windowColor = '#22D3A0'; // Green
  }

    const meshRef = useRef();

    useFrame(() => {
      if (meshRef.current) {
        const target = hovered ? 1.04 : 1.0;
        meshRef.current.scale.lerp(new THREE.Vector3(target, target, target), 0.12);
      }
    });

  const wallColor = '#deb99a'; 
  const corniceColor = '#c9a080';
  const balconyColor = '#82e0aa';

  return (
    <group position={position}>
      {/* Main Room Cube */}
      <mesh
        ref={meshRef}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={(e) => { e.stopPropagation(); setHovered(false); }}
      >
        <boxGeometry args={[1.92, 1.55, 1.92]} />
        <meshStandardMaterial color={wallColor} roughness={0.9} />
      </mesh>

      {/* Top Cornice */}
      <mesh position={[0, 0.8, 0]}>
        <boxGeometry args={[2.05, 0.22, 2.05]} />
        <meshStandardMaterial color={corniceColor} roughness={0.9} />
      </mesh>
      
      {/* Front Window (+Z) */}
      <mesh position={[0, 0.1, 0.97]}>
        <boxGeometry args={[0.8, 0.9, 0.1]} />
        <meshStandardMaterial color={windowColor} emissive={windowColor} emissiveIntensity={hovered ? 1.2 : 0.6} />
      </mesh>

      {/* Side Window (+X) */}
      <mesh position={[0.97, 0.1, 0]}>
        <boxGeometry args={[0.1, 0.9, 0.8]} />
        <meshStandardMaterial color={windowColor} emissive={windowColor} emissiveIntensity={hovered ? 1.2 : 0.6} />
      </mesh>

      <pointLight position={[0, 0.1, 1.1]} color={windowColor} intensity={hovered ? 1.2 : 0.4} distance={3} />

      {/* HTML Tooltip overlay on hover */}
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
              <span style={{ color: '#454D65', fontWeight: 'normal', fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>{room.id.slice(-6).toUpperCase()}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'JetBrains Mono', monospace" }}>
              Score: <strong style={{ color: windowColor }}>{room.score}</strong>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: windowColor }} />
            </div>
            <div style={{ color: '#7A82A0', fontSize: 12 }}>
              Status: {(room.currentOccupants > 0 || (room.occupants && room.occupants.length > 0)) ? 'Occupied' : 'Vacant'}
            </div>
            {room.topComplaint && (
              <div style={{ color: windowColor, marginTop: 2, fontWeight: 'bold', fontSize: 12 }}>
                {room.topComplaint}
              </div>
            )}
            <div style={{ color: '#454D65', fontSize: 12, marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>
              {room.blockName} / {room.buildingName} / Fl {room.floorNumber}
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

    const sceneData = { rooms: [], buildings: [] };
    let bldXOffset = 0;

    // Margin configurations
    const ROOM_SIZE = 2;
    const FLOOR_HEIGHT = 1.6;
    const BLD_SPACING = 5;

    Object.keys(bldGroups).forEach(bldName => {
      const floors = bldGroups[bldName];
      let maxRoomsPerRowInBld = 0;
      let maxFloors = Object.keys(floors).length;

      // Calculate Bounding areas for the building envelope
      let bldMinX = Infinity, bldMaxX = -Infinity;
      let bldMinZ = Infinity, bldMaxZ = -Infinity;

      Object.keys(floors).forEach(floorNumStr => {
        const floorNum = parseInt(floorNumStr, 10);
        const flRooms = floors[floorNumStr].sort((a,b) => a.roomNumber.localeCompare(b.roomNumber, undefined, {numeric: true}));
        
        // Layout rooms in a square grid per floor
        const roomsPerRow = Math.ceil(Math.sqrt(flRooms.length));
        if (roomsPerRow > maxRoomsPerRowInBld) maxRoomsPerRowInBld = roomsPerRow;

        flRooms.forEach((r, idx) => {
          const row = Math.floor(idx / roomsPerRow);
          const col = idx % roomsPerRow;
          
          const x = bldXOffset + (col * ROOM_SIZE);
          const y = (floorNum - 1) * FLOOR_HEIGHT;
          const z = (row * ROOM_SIZE);

          sceneData.rooms.push({ room: r, position: [x, y, z] });

          if (x < bldMinX) bldMinX = x;
          if (x > bldMaxX) bldMaxX = x;
          if (z < bldMinZ) bldMinZ = z;
          if (z > bldMaxZ) bldMaxZ = z;
        });
      });

      // Generate Building Foundation / Roof Structure
      if (bldMinX !== Infinity) {
        const pad = 1.2;
        const width = (bldMaxX - bldMinX) + ROOM_SIZE + (pad * 2);
        const depth = (bldMaxZ - bldMinZ) + ROOM_SIZE + (pad * 2);

        const centerX = (bldMinX + bldMaxX) / 2;
        const centerZ = (bldMinZ + bldMaxZ) / 2;
        
        // Base Foundation
        sceneData.buildings.push({
          position: [centerX, -0.9, centerZ],
          args: [width, 0.4, depth],
          name: bldName,
          type: 'base',
          color: '#c9a090'
        });

        Object.keys(floors).forEach(floorNumStr => {
          const floorNum = parseInt(floorNumStr, 10);
          const slabY = (floorNum - 1) * FLOOR_HEIGHT - 0.1;
          sceneData.buildings.push({
            position: [centerX, slabY, centerZ],
            args: [width, 0.18, depth],
            type: 'slab',
            color: '#c4956e'
          });
        });

        // Roof
        const roofY = (maxFloors - 1) * FLOOR_HEIGHT + 0.85 + 0.12;
        const roofWidth = (bldMaxX - bldMinX) + ROOM_SIZE;
        const roofDepth = (bldMaxZ - bldMinZ) + ROOM_SIZE;
        sceneData.buildings.push({
          position: [centerX, roofY, centerZ],
          args: [roofWidth, 0.35, roofDepth],
          type: 'roof',
          color: '#e3b5a4'
        });

        // Parapet Ring
        const pHeight = 0.6;
        const pThick = 0.3;
        // Front & Back
        sceneData.buildings.push({ position: [centerX, roofY + 0.17 + pHeight/2, centerZ + roofDepth/2], args: [roofWidth, pHeight, pThick], type: 'parapet', color: '#d4a090' });
        sceneData.buildings.push({ position: [centerX, roofY + 0.17 + pHeight/2, centerZ - roofDepth/2], args: [roofWidth, pHeight, pThick], type: 'parapet', color: '#d4a090' });
        // Left & Right
        sceneData.buildings.push({ position: [centerX + roofWidth/2, roofY + 0.17 + pHeight/2, centerZ], args: [pThick, pHeight, roofDepth], type: 'parapet', color: '#d4a090' });
        sceneData.buildings.push({ position: [centerX - roofWidth/2, roofY + 0.17 + pHeight/2, centerZ], args: [pThick, pHeight, roofDepth], type: 'parapet', color: '#d4a090' });
      }

      // Shift next building to the right by the width of this building + gap
      bldXOffset += (maxRoomsPerRowInBld * ROOM_SIZE) + BLD_SPACING;
    });

    // Center the entire cluster around 0,0,0
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
      
      sceneData.rooms.forEach(d => {
        d.position[0] -= centerX;
        d.position[2] -= centerZ;
      });
      sceneData.buildings.forEach(b => {
        b.position[0] -= centerX;
        b.position[2] -= centerZ;
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
        
        {/* Cinematic Lights */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[15, 25, 10]} intensity={1.4} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
        <directionalLight position={[-8, 10, -5]} intensity={0.3} color="#b0c4de" />
        <hemisphereLight skyColor="#1e3a5f" groundColor="#3d2010" intensity={0.4} />

        {/* Render Structural Buildings (Base, Roof, Parapet, Slab) */}
        <group position={[0, 0.5, 0]} renderOrder={0}>
          {modeledRooms.buildings.map((b, i) => (
            <mesh key={`bld-${i}`} position={b.position} castShadow receiveShadow>
              <boxGeometry args={b.args} />
              <meshStandardMaterial color={b.color} roughness={0.9} />
              
              {/* Building Name Tag on the Base */}
              {b.type === 'base' && (
                <Html position={[0, -0.2, (b.args[2]/2) + 0.5]} center style={{ pointerEvents: 'none' }}>
                  <div style={{ 
                    color: 'white', background: 'rgba(0,0,0,0.6)', padding: '4px 12px', borderRadius: '4px',
                    fontWeight: 'bold', fontSize: '0.8rem', whiteSpace: 'nowrap'
                  }}>
                    {b.name}
                  </div>
                </Html>
              )}
            </mesh>
          ))}
        </group>

        {/* Render Rooms */}
        <group position={[0, 0.5, 0]} renderOrder={1}>
          {modeledRooms.rooms.map((data, idx) => (
            <RoomBox key={`${data.room.id}-${idx}`} room={data.room} position={data.position} />
          ))}
        </group>

        {/* Solid Ground Plane */}
        <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, -0.7, 0]} receiveShadow>
          <planeGeometry args={[80, 80]} />
          <meshStandardMaterial color="#0a1628" roughness={1} />
        </mesh>

        <ContactShadows
          position={[0, -0.68, 0]}
          opacity={0.6}
          scale={40}
          blur={2.5}
          far={12}
          color="#000820"
        />

        {/* Controls */}
        <OrbitControls makeDefault autoRotate autoRotateSpeed={0.5} minPolarAngle={0} maxPolarAngle={Math.PI / 2 - 0.05} />
      </Canvas>

      {/* UI Overlay Legend */}
      <div style={{
        position: 'absolute', bottom: 24, left: 24,
        background: 'rgba(19,22,30,0.9)', border: '1px solid #2E3448',
        borderRadius: 10, padding: '12px 16px',
        display: 'flex', flexDirection: 'column', gap: 8
      }}>
        {[
          { color: '#22D3A0', label: 'Good (71-100)' },
          { color: '#F5A623', label: 'Warning (41-70)' },
          { color: '#F06565', label: 'Critical (1-40)' },
          { color: '#4FA3F7', label: 'Unmapped (0)' }
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: item.color, flexShrink: 0 }} />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#454D65' }}>{item.label}</span>
          </div>
        ))}
      </div>
      
      {/* Instructions */}
      <div style={{
        position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
        background: 'var(--bg-raised)', borderRadius: 'var(--radius-sm)',
        padding: '8px 16px', fontSize: 12, color: 'var(--text-ghost)',
        fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap'
      }}>
        Left-drag → rotate · Scroll → zoom · Right-drag → pan
      </div>
    </div>
  );
}
