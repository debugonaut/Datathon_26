import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { createComplaint } from '../../firebase/firestore';
import { storage } from '../../firebase/config';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

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

// ── MyMemory free translation (Tier 1 only) ─────────────────────────────────
const translateToEnglish = async (text, sourceLangCode) => {
  if (!sourceLangCode || sourceLangCode === 'en') return text;
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLangCode}|en`
    );
    const data = await res.json();
    return data.responseData.translatedText || text;
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

  // ── Voice state ──────────────────────────────────────────────────────────────
  const [selectedLang, setSelectedLang] = useState(LANGUAGES[0]);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [descriptionOriginal, setDescriptionOriginal] = useState('');
  const [descriptionTranslated, setDescriptionTranslated] = useState('');
  const [detectedLanguage, setDetectedLanguage] = useState('');
  const [showOriginal, setShowOriginal] = useState(false);
  const transcriber = useRef(null);
  const stopRecorderRef = useRef(null);
  const recordingTimerRef = useRef(null);

  // ── Load Whisper model on mount (Firefox only) ─────────────────────────────
  useEffect(() => {
    if (!hasNativeSpeech) {
      setModelLoading(true);
      import('@xenova/transformers').then(({ pipeline }) => {
        pipeline('automatic-speech-recognition', 'Xenova/whisper-small')
          .then(p => {
            transcriber.current = p;
            setModelReady(true);
            setModelLoading(false);
          })
          .catch(() => setModelLoading(false));
      });
    }
  }, []);

  // ── Tier 1: Chrome/Safari/Edge — Web Speech API + MyMemory ─────────────────
  const startNativeSpeech = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = selectedLang.code || 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = async (e) => {
      const spoken = e.results[0][0].transcript;
      const langCode = (selectedLang.code || 'en-IN').split('-')[0];
      const langName = selectedLang.whisperLang || 'english';

      setDescriptionOriginal(spoken);
      setDetectedLanguage(langName);
      setIsRecording(false);

      if (langCode === 'en') {
        setDescriptionTranslated(spoken);
        setDescription(spoken);
      } else {
        setIsTranslating(true);
        const translated = await translateToEnglish(spoken, langCode);
        setDescriptionTranslated(translated);
        setDescription(translated);
        setIsTranslating(false);
      }
    };

    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);
    recognition.start();
    setIsRecording(true);
  };

  // ── Tier 2: Firefox — Whisper in-browser ───────────────────────────────────
  const startWhisperRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks = [];

      mediaRecorder.ondataavailable = e => audioChunks.push(e.data);

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setIsRecording(false);
        setIsTranscribing(true);

        try {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          const arrayBuffer = await audioBlob.arrayBuffer();
          const audioContext = new AudioContext({ sampleRate: 16000 });
          const decoded = await audioContext.decodeAudioData(arrayBuffer);
          const audioData = decoded.getChannelData(0);

          const whisperLang = selectedLang.whisperLang || undefined;

          // Transcribe in original language
          const transcribeResult = await transcriber.current(audioData, {
            task: 'transcribe',
            language: whisperLang,
          });
          const original = transcribeResult.text;

          // Translate to English
          let translated = original;
          if (!whisperLang || whisperLang !== 'english') {
            const translateResult = await transcriber.current(audioData, {
              task: 'translate',
              language: whisperLang,
            });
            translated = translateResult.text;
          }

          setDescriptionOriginal(original);
          setDescriptionTranslated(translated);
          setDetectedLanguage(whisperLang || 'auto');
          setDescription(translated);

        } catch {
          // silent fallback
        } finally {
          setIsTranscribing(false);
        }
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

    } catch {
      alert('Microphone access denied. Please type your description instead.');
      setIsRecording(false);
    }
  };

  // ── Unified mic handler ────────────────────────────────────────────────────
  const handleMicClick = () => {
    if (isRecording) {
      stopRecorderRef.current?.();
      return;
    }
    if (hasNativeSpeech) {
      startNativeSpeech();
    } else {
      startWhisperRecording();
    }
  };

  // ── File handling ──────────────────────────────────────────────────────────
  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files);
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
              <label className="form-label mb-1">Details</label>

              {/* Voice section */}
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

                {/* Model loading — Firefox only */}
                {!hasNativeSpeech && modelLoading && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Loading voice engine for your browser... (one-time only)
                  </div>
                )}

                {/* Mic button */}
                <button
                  type="button"
                  onClick={handleMicClick}
                  disabled={isTranscribing || isTranslating || (!hasNativeSpeech && !modelReady)}
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

                {/* Translation result toggle */}
                {descriptionOriginal && descriptionTranslated && descriptionOriginal !== descriptionTranslated && (
                  <div style={{
                    marginTop: '10px', padding: '10px 12px', borderRadius: '8px',
                    border: '1px solid var(--border)', fontSize: '0.8rem'
                  }}>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setShowOriginal(false)}
                        style={{
                          padding: '2px 10px', borderRadius: '12px', fontSize: '0.75rem',
                          border: !showOriginal ? '1px solid #10b981' : '1px solid var(--border)',
                          background: !showOriginal ? 'rgba(16,185,129,0.15)' : 'transparent',
                          color: !showOriginal ? '#10b981' : 'var(--text-muted)', cursor: 'pointer'
                        }}>
                        English
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowOriginal(true)}
                        style={{
                          padding: '2px 10px', borderRadius: '12px', fontSize: '0.75rem',
                          border: showOriginal ? '1px solid #10b981' : '1px solid var(--border)',
                          background: showOriginal ? 'rgba(16,185,129,0.15)' : 'transparent',
                          color: showOriginal ? '#10b981' : 'var(--text-muted)', cursor: 'pointer'
                        }}>
                        Original ({detectedLanguage})
                      </button>
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
