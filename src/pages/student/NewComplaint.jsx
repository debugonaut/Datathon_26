import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { createComplaint } from '../../firebase/firestore';
import { storage } from '../../firebase/config';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { analyzeComplaint } from '../../utils/aiComplaintAnalyzer';

const CATEGORIES = ['Plumbing', 'Electrical', 'Cleaning', 'Furniture', 'Other'];
const PRIORITIES = ['low', 'medium', 'high'];

const LANGUAGES = [
  { label: 'Auto', code: null, whisperLang: null },
  { label: 'English', code: 'en-IN', whisperLang: 'english' },
  { label: 'हिंदी', code: 'hi-IN', whisperLang: 'hindi' },
  { label: 'मराठी', code: 'mr-IN', whisperLang: 'marathi' },
  { label: 'ગુજરાતી', code: 'gu-IN', whisperLang: 'gujarati' },
];

const hasNativeSpeech = !!(window.SpeechRecognition || window.webkitSpeechRecognition);

// ── MyMemory free translation ──────────────────────────────────────────────
const translateToEnglish = async (text, sourceLangCode) => {
  if (!sourceLangCode || sourceLangCode === 'en') return text;
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLangCode}|en`
    );
    const data = await res.json();
    return data.responseData?.translatedText || text;
  } catch {
    return text;
  }
};

export default function NewComplaint() {
  const { user, userDoc } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!userDoc?.roomId) {
      navigate('/student/room-register', { replace: true });
    }
  }, [userDoc, navigate]);

  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('low');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // ── Voice state ────────────────────────────────────────────────────────────
  const [selectedLang, setSelectedLang] = useState(LANGUAGES[0]);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [descriptionOriginal, setDescriptionOriginal] = useState('');
  const [descriptionTranslated, setDescriptionTranslated] = useState('');
  const [detectedLanguage, setDetectedLanguage] = useState('');
  const [voiceBlob, setVoiceBlob] = useState(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const stopRecorderRef = useRef(null);
  const recordingTimerRef = useRef(null);

  // ── AI Auto-fill state ───────────────────────────────────────────────────
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);

  const triggerAIAnalysis = async ({ imageBase64, transcript, typed }) => {
    if (!imageBase64 && !transcript && !typed) return;
    setIsAnalyzing(true);
    try {
      const suggestion = await analyzeComplaint({ imageBase64, transcript, typedText: typed });
      if (suggestion) {
        setAiSuggestion(suggestion);
        if (suggestion.category) {
          const catMatch = CATEGORIES.find(c => c.toLowerCase() === suggestion.category.toLowerCase());
          if (catMatch) setCategory(catMatch);
          else setCategory(suggestion.category);
        }
        if (suggestion.priority) setPriority(suggestion.priority.toLowerCase());
        if (suggestion.title) setTitle(suggestion.title);
        if (suggestion.description && !description) setDescription(suggestion.description);
      }
    } catch (err) {
      console.error('AI analysis failed:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ── Unified mic handler ────────────────────────────────────────────────────
  const handleMicClick = async () => {
    if (isRecording) {
      stopRecorderRef.current?.();
      return;
    }

    if (hasNativeSpeech) {
      try {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = selectedLang?.code || 'en-IN';
        recognition.continuous = false;
        recognition.interimResults = false;
        
        recognition.onresult = async (e) => {
          const spoken = e.results[0][0].transcript;
          const langCode = (selectedLang?.code || 'en-IN').split('-')[0];
          
          setDescriptionOriginal(spoken);
          setDetectedLanguage(selectedLang?.whisperLang || 'english');
          setIsRecording(false);
          
          let translatedText = spoken;
          if (langCode !== 'en') {
            setIsTranslating(true);
            translatedText = await translateToEnglish(spoken, langCode);
            setDescriptionTranslated(translatedText);
            setDescription(translatedText);
            setIsTranslating(false);
          } else {
            setDescriptionTranslated(spoken);
            setDescription(spoken);
          }
          
          // Trigger AI Analysis on voice completion
          triggerAIAnalysis({ transcript: translatedText });
        };
        
        recognition.onerror = (e) => {
          console.error('Speech recognition error:', e.error);
          alert(`Microphone error: ${e.error}. Please check browser permissions.`);
          setIsRecording(false);
        };
        
        recognition.onend = () => setIsRecording(false);
        recognition.start();
        setIsRecording(true);
      } catch (err) {
        console.error('Speech recognition failed:', err);
        alert('Voice recognition failed to start. Please check microphone permissions.');
      }
    } else {
      // Tier 2: Firefox MediaRecorder fallback
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        const audioChunks = [];
        
        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        
        mediaRecorder.onstop = () => {
          stream.getTracks().forEach(t => t.stop());
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          setVoiceBlob(audioBlob);
          setIsRecording(false);
          
          const file = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
          setFiles(prev => [...prev, file]);
        };
        
        mediaRecorder.start();
        setIsRecording(true);
        
        recordingTimerRef.current = setTimeout(() => {
          if (mediaRecorder.state === 'recording') mediaRecorder.stop();
        }, 60000);
        
        stopRecorderRef.current = () => {
          clearTimeout(recordingTimerRef.current);
          if (mediaRecorder.state === 'recording') mediaRecorder.stop();
        };
      } catch (err) {
        console.error('MediaRecorder failed:', err);
        alert('Microphone access denied. Please allow microphone access in your browser settings.');
        setIsRecording(false);
      }
    }
  };

  // ── File handling ──────────────────────────────────────────────────────────
  const handleFileChange = async (e) => {
    const selected = Array.from(e.target.files);
    const valid = selected.filter(f => {
      if (f.size > 50 * 1024 * 1024) {
        alert(`${f.name} is too large. Max 50MB allowed.`);
        return false;
      }
      return true;
    });

    setFiles(prev => [...prev, ...valid]);

    // Send first image to AI analysis if available
    const firstImage = valid.find(f => f.type.startsWith('image/'));
    if (firstImage) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = reader.result.split(',')[1];
        triggerAIAnalysis({ imageBase64: base64Data });
      };
      reader.readAsDataURL(firstImage);
    }
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    // Check if voice blob is among files removed
    if (voiceBlob && !files.filter((_, i) => i !== index).some(f => f.name.startsWith('voice_') && f.type === 'audio/webm')) {
      setVoiceBlob(null);
    }
  };

  const handleDescriptionBlur = () => {
    if (description.trim().length > 10) {
      triggerAIAnalysis({ typed: description.trim() });
    }
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
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
        description: descriptionTranslated || description.trim(),
        descriptionOriginal: descriptionOriginal || description.trim(),
        descriptionTranslated: descriptionTranslated || description.trim(),
        detectedLanguage: detectedLanguage || 'english',
        category,
        priority,
        mediaUrls,
        mediaTypes,
        // Phase 2 + Phase 3 new fields
        acknowledgedAt: null,
        estimatedResolutionAt: null,
        withdrawnAt: null,
        withdrawnReason: '',
        reopenedAt: null,
        reopenReason: '',
        reopenCount: 0,
        internalNotes: [],
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

          {/* AI Banner */}
          {isAnalyzing && (
            <div style={{
              padding: '10px 14px', borderRadius: '8px', marginBottom: '12px',
              background: 'rgba(55,138,221,0.1)', border: '1px solid rgba(55,138,221,0.3)',
              fontSize: '0.82rem', color: '#378ADD',
              display: 'flex', alignItems: 'center', gap: '8px'
            }}>
              <span>⚡</span> AI is analyzing your complaint...
            </div>
          )}
          {aiSuggestion && !isAnalyzing && (
            <div style={{
              padding: '10px 14px', borderRadius: '8px', marginBottom: '12px',
              background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',
              fontSize: '0.82rem', color: '#10b981',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <span>✓ AI filled the form — review and edit anything before submitting</span>
              <button type="button" onClick={() => setAiSuggestion(null)}
                style={{ background: 'none', border: 'none',
                  color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
            </div>
          )}

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
              <label className="form-label mb-1">Details</label>

              {/* Voice section rewrite */}
              <div style={{ marginBottom: '12px' }}>
                {/* Language selector pills */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  {LANGUAGES.map(lang => (
                    <button
                      key={lang.label}
                      type="button"
                      onClick={() => setSelectedLang(lang)}
                      style={{
                        padding: '4px 12px', borderRadius: '20px', fontSize: '0.78rem',
                        border: selectedLang.label === lang.label
                          ? '1px solid #10b981' : '1px solid var(--border)',
                        background: selectedLang.label === lang.label
                          ? 'rgba(16,185,129,0.15)' : 'transparent',
                        color: selectedLang.label === lang.label ? '#10b981' : 'var(--text-muted)',
                        cursor: 'pointer'
                      }}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>

                {/* Mic button */}
                <button
                  type="button"
                  onClick={handleMicClick}
                  disabled={isTranscribing}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '6px 16px', borderRadius: '20px',
                    border: '1px solid var(--border)',
                    background: isRecording ? 'rgba(239,68,68,0.15)' : 'transparent',
                    color: isRecording ? '#ef4444' : 'var(--text-muted)',
                    cursor: 'pointer', fontSize: '0.85rem',
                    animation: isRecording ? 'pulse 1.2s infinite' : 'none'
                  }}
                >
                  {isTranscribing ? '⏳ Transcribing...'
                    : isTranslating ? '🌐 Translating...'
                    : isRecording ? '⏹ Stop Recording'
                    : '🎤 Use Voice'}
                </button>

                {/* Firefox voice status */}
                {!hasNativeSpeech && voiceBlob && (
                  <div style={{ marginTop: '8px', fontSize: '0.78rem',
                    color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#10b981' }}>✓ Voice recorded</span>
                    — please type a brief description above
                  </div>
                )}
                {!hasNativeSpeech && !voiceBlob && (
                  <div style={{ marginTop: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Firefox: voice will be saved as audio attachment
                  </div>
                )}

                {/* Translation toggle — shown when both versions exist and differ */}
                {descriptionOriginal && descriptionTranslated && descriptionOriginal !== descriptionTranslated && (
                  <div style={{
                    marginTop: '10px', padding: '10px 12px', borderRadius: '8px',
                    border: '1px solid var(--border)', fontSize: '0.8rem'
                  }}>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      {[false, true].map(isOrig => (
                        <button
                          key={String(isOrig)}
                          type="button"
                          onClick={() => setShowOriginal(isOrig)}
                          style={{
                            padding: '2px 10px', borderRadius: '12px', fontSize: '0.75rem',
                            border: showOriginal === isOrig
                              ? '1px solid #10b981' : '1px solid var(--border)',
                            background: showOriginal === isOrig
                              ? 'rgba(16,185,129,0.15)' : 'transparent',
                            color: showOriginal === isOrig ? '#10b981' : 'var(--text-muted)',
                            cursor: 'pointer'
                          }}
                        >
                          {isOrig ? `Original (${detectedLanguage})` : 'English'}
                        </button>
                      ))}
                    </div>
                    <div style={{ color: 'var(--text-muted)' }}>
                      {showOriginal ? descriptionOriginal : descriptionTranslated}
                    </div>
                  </div>
                )}
              </div>

              <textarea
                className="form-input"
                rows={4}
                placeholder="Provide specific details about the issue..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                onBlur={handleDescriptionBlur}
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
                    );
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
                    className="btn btn-sm flex-1"
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
