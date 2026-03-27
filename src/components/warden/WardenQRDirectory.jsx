import { useState, useEffect } from 'react';
import { getAllRooms } from '../../firebase/firestore';

export default function WardenQRDirectory({ hostelId }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState(null);

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
      <div className="data-card hide-on-print" style={{ borderTop: '2px solid var(--primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 22, margin: 0, color: 'var(--text-primary)' }}>Print Room QR Codes</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '4px 0 0' }}>Print and physically distribute these codes so students can scan into their rooms.</p>
        </div>
        <button onClick={handlePrint}
          className="btn-print-qr"
          style={{
            background: 'var(--primary)', 
            color: '#fff', 
            border: 'none',
            borderRadius: 'var(--radius-sm)', 
            padding: '12px 24px', 
            fontSize: 13,
            fontFamily: 'var(--font-heading)', 
            fontWeight: 600, 
            cursor: 'pointer',
            display: 'flex', 
            alignItems: 'center', 
            gap: 8,
            boxShadow: '0 4px 12px rgba(108,99,255,0.25)',
            transition: 'all 0.2s ease'
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
        gap: 16,
        alignItems: 'start'
      }} className="print-grid">
        
        {rooms.map(r => (
          <div key={r.id} 
            onClick={() => setSelectedRoom(r)}
            style={{
              background: 'var(--bg-card)', 
              border: '1px solid var(--border)',
              borderRadius: 12, 
              padding: 16, 
              textAlign: 'center',
              cursor: 'pointer', 
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseEnter={e => { 
              e.currentTarget.style.borderColor = 'var(--primary)'; 
              e.currentTarget.style.transform = 'scale(1.08) translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.15)';
              e.currentTarget.style.zIndex = '10';
            }}
            onMouseLeave={e => { 
              e.currentTarget.style.borderColor = 'var(--border)'; 
              e.currentTarget.style.transform = 'none'; 
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.zIndex = '1';
            }}
          >
            <div style={{ background: '#fff', padding: 6, borderRadius: 8, display: 'inline-block', marginBottom: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <img src={r.qrCodeUrl} alt={`QR Code for Room ${r.roomNumber}`} style={{ width: 90, height: 90, display: 'block' }} />
            </div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Room {r.roomNumber}</div>
            <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}>{r.buildingName} / Fl {r.floorNumber}</div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
              color: 'var(--primary)', letterSpacing: '0.05em', marginTop: 8,
              background: 'var(--primary-soft)', border: '1px solid var(--primary-border)',
              borderRadius: 6, padding: '4px 10px', display: 'inline-block'
            }}>
              {r.id.slice(-6).toUpperCase()}
            </div>
          </div>
        ))}
        
      </div>

      {/* Maximize Modal */}
      {selectedRoom && (
        <div 
          onClick={() => setSelectedRoom(null)}
          style={{
            position: 'fixed', inset: 0, 
            background: 'rgba(0,0,0,0.85)', 
            backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000,
            animation: 'fadeIn 0.2s ease'
          }}
        >
          <div 
            onClick={e => e.stopPropagation()}
            style={{
              width: '90%', maxWidth: '500px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-strong)',
              borderRadius: 24, padding: 32,
              textAlign: 'center',
              boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
              animation: 'modalZoom 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div style={{ textAlign: 'left' }}>
                <h3 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: 'var(--text)' }}>Room {selectedRoom.roomNumber}</h3>
                <p style={{ color: 'var(--text-2)', margin: '4px 0 0', fontSize: 14 }}>{selectedRoom.buildingName} · Floor {selectedRoom.floorNumber}</p>
              </div>
              <button 
                onClick={() => setSelectedRoom(null)}
                style={{ background: 'var(--bg-input)', border: 'none', color: 'var(--text-2)', width: 36, height: 36, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            
            <div style={{ background: '#fff', padding: 16, borderRadius: 16, display: 'inline-block', marginBottom: 24, boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
              <img 
                src={selectedRoom.qrCodeUrl} 
                alt="QR Code" 
                style={{ width: '100%', maxWidth: 280, height: 'auto', display: 'block' }} 
              />
            </div>

            <div style={{ 
              background: 'var(--bg-input)', 
              borderRadius: 12, 
              padding: 16, 
              display: 'flex', 
              flexDirection: 'column', 
              gap: 8,
              border: '1px solid var(--border)'
            }}>
              <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Unique Identification Code</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 800, color: 'var(--primary)', letterSpacing: '0.2em' }}>
                {selectedRoom.id.slice(-6).toUpperCase()}
              </div>
            </div>

            <button 
              onClick={() => { window.print(); setSelectedRoom(null); }}
              style={{
                width: '100%', marginTop: 24,
                background: 'var(--primary)', color: '#fff',
                border: 'none', borderRadius: 12, padding: '16px',
                fontSize: 15, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Print This QR Code
            </button>
          </div>
        </div>
      )}
      
      {/* Dynamic Styles injection */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes modalZoom {
          from { opacity: 0; transform: scale(0.9) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @media print {
          body * { visibility: hidden; }
          .hide-on-print { display: none !important; }
          .print-grid, .print-grid * { visibility: visible; }
          .print-grid { 
            position: absolute; left: 0; top: 0; 
            width: 100%; display: grid; 
            grid-template-columns: repeat(3, 1fr) !important; 
            gap: 1.5rem !important; 
          }
          .print-grid > div { 
            background: none !important; 
            border: 1px solid #ddd !important; 
            color: #000 !important; 
            break-inside: avoid;
            box-shadow: none !important;
            transform: none !important;
          }
        }
      `}} />
    </div>
  );
}

