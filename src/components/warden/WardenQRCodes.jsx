import { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { getAllRooms } from '../../firebase/firestore';

export default function WardenQRCodes({ hostelId }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const fetchRooms = async () => {
      const allRooms = await getAllRooms(hostelId);
      setRooms(allRooms);
      setLoading(false);
    };
    fetchRooms();
  }, [hostelId]);

  const groupRooms = () => {
    const groups = {};
    for (const r of rooms) {
      const key = `${r.blockName} > ${r.buildingName} > Floor ${r.floorNumber}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    }
    return groups;
  };

  const handleDownloadAll = async () => {
    setExporting(true);
    try {
      const zip = new JSZip();
      
      for (const r of rooms) {
        if (!r.qrCodeUrl) continue;
        // Data URL format: data:image/png;base64,iVBOR...
        const base64Data = r.qrCodeUrl.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
        const filename = `${r.blockName}-${r.buildingName}-Fl${r.floorNumber}-Rm${r.roomNumber}.png`.replace(/\s+/g, '_');
        zip.file(filename, base64Data, { base64: true });
      }

      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, 'hostel-qr-codes.zip');
    } catch (err) {
      console.error('ZIP Export Error:', err);
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <div className="text-center p-4">Loading QR codes...</div>;
  if (rooms.length === 0) return <div className="text-muted text-center p-4">No rooms have been mapped yet.</div>;

  const grouped = groupRooms();

  return (
    <div className="animation-fade-in">
      <div className="flex align-items-center mb-3" style={{ justifyContent: 'space-between' }}>
        <div>
          <h2 className="font-bold">Room QR Codes</h2>
          <p className="text-muted text-sm">Download these and stick them on room doors for students to scan & join.</p>
        </div>
        <button className="btn btn-primary" onClick={handleDownloadAll} disabled={exporting}>
          {exporting ? 'Zipping...' : '📥 Download All as .ZIP'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {Object.entries(grouped).map(([groupName, groupRooms]) => (
          <div key={groupName} className="card">
            <h3 className="font-bold mb-2" style={{ color: 'var(--primary)' }}>{groupName}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
              {groupRooms.map(r => (
                <div key={r.id} className="card card-sm text-center" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <img src={r.qrCodeUrl} alt={`Room ${r.roomNumber}`} style={{ width: '100%', borderRadius: '8px', marginBottom: '0.5rem' }} />
                  <div className="font-bold">Room {r.roomNumber}</div>
                  <a href={r.qrCodeUrl} download={`Room_${r.roomNumber}_QR.png`} className="btn btn-outline btn-sm mt-1 btn-full">Download</a>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
