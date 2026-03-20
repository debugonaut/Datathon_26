import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { createComplaint } from '../../firebase/firestore';
import { storage } from '../../firebase/config';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const CATEGORIES = ['Plumbing', 'Electrical', 'Cleaning', 'Furniture', 'Other'];
const PRIORITIES = ['low', 'medium', 'high'];

export default function NewComplaint() {
  const { user, userDoc } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // If a user maliciously navigated here without a room, bounce them back.
  useEffect(() => {
    if (!userDoc?.roomId) {
      navigate('/student/join', { replace: true });
    }
  }, [userDoc, navigate]);

  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('low');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState([]);
  
  const [isRecording, setIsRecording] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setDescription((prev) => prev ? prev + ' ' + finalTranscript : finalTranscript);
        }
      };
      recognition.onerror = (e) => console.error("Speech error", e);
      recognition.onend = () => setIsRecording(false);
      recognitionRef.current = recognition;
    } else {
      setVoiceSupported(false);
    }
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) return;
    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files);
    // Cap at 50MB per file
    const valid = selected.filter(f => {
      if (f.size > 50 * 1024 * 1024) {
        alert(`${f.name} is too large. Max 50MB allowed.`);
        return false;
      }
      return true;
    });
    setFiles(prev => [...prev, ...valid]);
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !category) return;
    
    setIsSubmitting(true);
    setError('');

    try {
      const mediaUrls = [];
      const mediaTypes = [];

      for (const file of files) {
        const timestamp = Date.now();
        const extension = file.name.split('.').pop() || '';
        const fileName = `${timestamp}_${Math.random().toString(36).substring(7)}.${extension}`;
        const filePath = `complaints/${userDoc.hostelId}/${userDoc.roomId}/${fileName}`;
        
        const storageRef = ref(storage, filePath);
        const snapshot = await uploadBytes(storageRef, file);
        const downloadUrl = await getDownloadURL(snapshot.ref);
        
        mediaUrls.push(downloadUrl);
        // Determine basic type for UI
        if (file.type.startsWith('image/')) mediaTypes.push('image');
        else if (file.type.startsWith('video/')) mediaTypes.push('video');
        else if (file.type.startsWith('audio/')) mediaTypes.push('audio');
        else mediaTypes.push('document');
      }

      const complaintData = {
        hostelId: userDoc.hostelId,
        blockId: userDoc.blockId,
        buildingId: userDoc.buildingId,
        floorId: userDoc.floorId,
        roomId: userDoc.roomId,
        roomNumber: userDoc.roomNumber,
        studentUid: user.uid,
        studentName: userDoc.name,
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        mediaUrls,
        mediaTypes,
        voiceTranscript: isRecording ? description.trim() : '', // optional logic flag
      };

      const complaintId = await createComplaint(complaintData);
      navigate('/complaint/confirmation', { state: { complaintId }, replace: true });
      
    } catch (err) {
      console.error(err);
      setError('Failed to submit complaint. ' + err.message);
      setIsSubmitting(false);
    }
  };

  if (!userDoc?.roomId) return null;

  return (
    <div className="page" style={{ paddingBottom: '4rem' }}>
      <Navbar />
      <div className="center-page animation-fade-in" style={{ alignItems: 'flex-start', paddingTop: '2rem' }}>
        <div className="auth-card" style={{ maxWidth: '600px', width: '100%' }}>
          
          <div className="flex align-items-center justify-content-between mb-3 border-bottom pb-2">
            <h1 className="auth-title m-0">Report Issue</h1>
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: '4px 12px', borderRadius: '999px', fontSize: '0.85rem' }}>
              Locked: <strong>Room {userDoc.roomNumber}</strong>
            </div>
          </div>

          {error && <div className="form-error">{error}</div>}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Category */}
            <div>
              <label className="form-label">Category</label>
              <div className="flex gap-2 flex-wrap">
                {CATEGORIES.map(c => (
                  <button
                    type="button"
                    key={c}
                    className={`btn btn-sm ${category === c ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setCategory(c)}
                    style={{ borderRadius: '999px', padding: '0.4rem 1rem' }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="form-label">Title</label>
              <input
                className="form-input"
                placeholder="Short description (e.g. Broken ceiling fan)"
                value={title}
                onChange={e => setTitle(e.target.value)}
                maxLength={60}
                required
              />
            </div>

            {/* Description & Voice */}
            <div>
              <div className="flex justify-content-between align-items-center mb-1">
                <label className="form-label m-0">Details</label>
                {voiceSupported && (
                  <button 
                    type="button" 
                    onClick={toggleRecording}
                    style={{
                      background: 'none', border: 'none', 
                      color: isRecording ? '#ef4444' : 'var(--text-muted)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                      fontSize: '0.85rem', fontWeight: 600
                    }}
                  >
                    {isRecording ? (
                      <><span className="pulsing-dot" style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#ef4444', animation: 'pulse 1.5s infinite' }}></span> Listening...</>
                    ) : '🎤 Use Voice'}
                  </button>
                )}
              </div>
              {!voiceSupported && <div className="text-sm text-muted mb-1">Voice dictation not supported in this browser.</div>}
              
              <textarea
                className="form-input"
                rows={4}
                placeholder="Provide specific details about the issue..."
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>

            {/* File Uploads */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--border)', borderRadius: '8px', padding: '1rem' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}>
                📎 Attach Media 
                <input 
                  type="file" 
                  multiple 
                  accept="image/*,video/*,audio/*" 
                  onChange={handleFileChange} 
                  style={{ display: 'none' }} 
                />
                <span className="btn btn-sm btn-outline">Browse</span>
              </label>
              <p className="text-xs text-muted mb-2">Max 50MB per file. Images, short videos, or audio.</p>
              
              {files.length > 0 && (
                <div className="flex gap-2 flex-wrap mt-2">
                  {files.map((f, idx) => {
                    const isImg = f.type.startsWith('image/');
                    return (
                      <div key={idx} style={{ position: 'relative', width: 64, height: 64, borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)', background: '#1f2937' }}>
                        {isImg ? (
                          <img src={URL.createObjectURL(f)} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div className="flex align-items-center justify-content-center" style={{ width: '100%', height: '100%', fontSize: '0.7rem', color: '#9ca3af', textAlign: 'center', padding: 2, wordBreak: 'break-all' }}>
                            {f.name.split('.').pop()}
                          </div>
                        )}
                        <button 
                          type="button" 
                          onClick={() => removeFile(idx)}
                          style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.7)', color: 'white', border: 'none', borderRadius: '50%', width: 18, height: 18, fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        >✕</button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Priority */}
            <div>
              <label className="form-label">Priority Level</label>
              <div className="flex gap-2">
                {PRIORITIES.map(p => (
                  <button
                    type="button"
                    key={p}
                    className={`btn btn-sm flex-1`}
                    style={{
                      border: priority === p ? 'none' : '1px solid var(--border)',
                      background: priority === p 
                        ? (p === 'low' ? '#10b981' : p === 'medium' ? '#f59e0b' : '#ef4444') 
                        : 'transparent',
                      color: priority === p ? '#fff' : 'var(--text-muted)'
                    }}
                    onClick={() => setPriority(p)}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary btn-full mt-2" 
              disabled={isSubmitting || !title.trim() || !category}
              style={{ padding: '1rem', fontSize: '1.1rem' }}
            >
              {isSubmitting ? 'Uploading & Submitting...' : 'Submit Complaint'}
            </button>

          </form>

        </div>
      </div>
    </div>
  );
}
