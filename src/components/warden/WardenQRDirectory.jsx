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

  if (loading) return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, padding: '2rem 0' }}>
      {[...Array(8)].map((_, i) => <div key={i} className="skeleton" style={{ height: 140 }} />)}
    </div>
  );

  if (rooms.length === 0) return (
    <div style={{ textAlign: 'center', padding: '4rem 0' }}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-ghost)" strokeWidth="1.5" style={{ marginBottom: 12 }}>
        <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/>
      </svg>
      <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 4 }}>No rooms found</div>
      <div style={{ color: 'var(--text-ghost)', fontSize: 12 }}>Set up your hostel first</div>
    </div>
  );

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{ paddingBottom: '3rem' }}>
      
      {/* Header */}
      <div className="data-card hide-on-print" style={{ borderTop: '2px solid var(--violet)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 22, margin: 0, color: 'var(--text-primary)' }}>Print Room QR Codes</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '4px 0 0' }}>Print and physically distribute these codes so students can scan into their rooms.</p>
        </div>
        <button onClick={handlePrint}
          style={{
            background: 'var(--violet)', color: '#fff', border: 'none',
            borderRadius: 'var(--radius-sm)', padding: '10px 20px', fontSize: 13,
            fontFamily: 'var(--font-heading)', fontWeight: 500, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
            transition: 'opacity 0.2s ease'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Print Copies
        </button>
      </div>

      {/* QR Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', 
        gap: 12,
        alignItems: 'start'
      }} className="print-grid">
        
        {rooms.map(r => (
          <div key={r.id} style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border-v2)',
            borderRadius: 10, padding: 14, textAlign: 'center',
            cursor: 'pointer', transition: 'all 0.2s ease'
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-v2)'; e.currentTarget.style.transform = 'none'; }}
          >
            <div style={{ background: '#fff', padding: 4, borderRadius: 6, display: 'inline-block', marginBottom: 8 }}>
              <img src={r.qrCodeUrl} alt={`QR Code for Room ${r.roomNumber}`} style={{ width: 90, height: 90, display: 'block' }} />
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Room {r.roomNumber}</div>
            <div style={{ fontSize: 12, color: 'var(--text-ghost)' }}>{r.buildingName} / Fl {r.floorNumber}</div>
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
          .print-grid > div { background: none !important; border: 1px solid #ccc !important; color: #000 !important; break-inside: avoid; }
        }
      `}} />
    </div>
  );
}
