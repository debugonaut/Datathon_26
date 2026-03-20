import { useState, useEffect } from 'react';
import { getAllRooms } from '../../firebase/firestore';

export default function WardenQRDirectory({ hostelId }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRooms = async () => {
      try {
        const data = await getAllRooms(hostelId);
        // Sort by Building, then Floor, then Room Number
        data.sort((a, b) => {
          if (a.buildingName !== b.buildingName) return a.buildingName.localeCompare(b.buildingName);
          if (a.floorNumber !== b.floorNumber) return a.floorNumber - b.floorNumber;
          return a.roomNumber - b.roomNumber;
        });
        setRooms(data);
      } catch (err) {
        console.error("Error loading rooms", err);
      } finally {
        setLoading(false);
      }
    };
    loadRooms();
  }, [hostelId]);

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}><div className="spinner" /></div>;
  if (rooms.length === 0) return <div style={{ padding: '2rem', textAlign: 'center' }}>No rooms found.</div>;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="animation-fade-in" style={{ paddingBottom: '3rem' }}>
      
      <div className="card mb-3 flex justify-content-between align-items-center hide-on-print">
        <div>
          <h2 className="m-0">Print Room QR Codes</h2>
          <p className="text-muted m-0">Print and physical distribute these codes so students can scan into their rooms.</p>
        </div>
        <button className="btn btn-primary" onClick={handlePrint}>
          🖨️ Print Physical Copies
        </button>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', 
        gap: '1.5rem',
        alignItems: 'start'
      }} className="print-grid">
        
        {rooms.map(r => (
          <div key={r.id} className="card text-center flex flex-column align-items-center" style={{ padding: '1rem', border: '2px solid var(--border)' }}>
            <h3 className="m-0 mb-1" style={{ fontSize: '1.4rem' }}>Room {r.roomNumber}</h3>
            <div className="text-muted text-sm mb-3">
              {r.buildingName} • Fl {r.floorNumber}
            </div>
            
            <div style={{ background: '#fff', padding: '0.5rem', borderRadius: '8px', display: 'inline-block', border: '1px solid #e5e7eb' }}>
              <img src={r.qrCodeUrl} alt={`QR Code for Room ${r.roomNumber}`} style={{ width: '160px', height: '160px', display: 'block' }} />
            </div>

            <div className="mt-3 text-xs" style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px', letterSpacing: '1px', fontSize: '0.8rem' }}>
              CODE: <strong style={{ color: 'var(--primary)' }}>{r.id.slice(-6).toUpperCase()}</strong>
            </div>
            
            <p className="text-muted" style={{ fontSize: '0.7rem', marginTop: '0.5rem', marginBottom: 0 }}>
              Scan to onboard or log complaint.
            </p>
          </div>
        ))}
        
      </div>
      
      {/* Print Styles injection */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          .hide-on-print { display: none !important; }
          .print-grid, .print-grid * { visibility: visible; }
          .print-grid { 
            position: absolute; left: 0; top: 0; 
            width: 100%; display: grid; 
            grid-template-columns: repeat(3, 1fr) !important; 
            gap: 1rem !important; 
          }
          .card { background: none !important; border: 1px solid #ccc !important; color: #000 !important; break-inside: avoid; }
          .card h3 { color: #000 !important; }
          .text-muted { color: #555 !important; }
        }
      `}} />
    </div>
  );
}
