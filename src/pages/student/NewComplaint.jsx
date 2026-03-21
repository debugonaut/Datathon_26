import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { createComplaint } from '../../firebase/firestore';
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLangCode}|en`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);
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
  const [submitStatus, setSubmitStatus] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !category) return;
    if (!userDoc?.hostelId || !userDoc?.roomId) {
      setError('Your room profile is incomplete. Please re-login.');
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('Preparing submission...');
    setError('');

    try {
      const uploadPromises = files.map(async (file, index) => {
        setSubmitStatus(`Uploading media ${index + 1}/${files.length}...`);
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', 'aadesh'); // User provided preset

        const res = await fetch('https://api.cloudinary.com/v1_1/dgqwct6f2/auto/upload', {
          method: 'POST',
          body: formData
        });
        
        if (!res.ok) {
          throw new Error(`Media upload failed (${res.status})`);
        }
        
        const data = await res.json();
        return data.secure_url;
      });

      const mediaUrls = await Promise.all(uploadPromises);
      const mediaTypes = files.map(file => {
        if (file.type.startsWith('image/')) return 'image';
        if (file.type.startsWith('video/')) return 'video';
        if (file.type.startsWith('audio/')) return 'audio';
        return 'document';
      });

      setSubmitStatus('Writing to database...');
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
        mediaPaths: [], // Retaining empty array for schema compatibility
        mediaTypes,
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
      setSubmitStatus('Done!');
      navigate('/complaint/confirmation', { state: { complaintId }, replace: true });

    } catch (err) {
      console.error('Submission error:', err);
      let msg = err.message;
      if (err.code === 'storage/unauthorized') msg = 'Storage permission denied. Ensure you are signed in.';
      if (err.code === 'storage/canceled') msg = 'Upload was canceled.';
      setError('Failed to submit complaint: ' + msg);
      setIsSubmitting(false);
      setSubmitStatus('');
    }
  };

  if (!userDoc?.roomId) return null;

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: 560, margin: '32px auto', padding: '0 16px' }}>
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border-v2)',
          borderRadius: 'var(--radius)', padding: '28px 32px',
          borderTop: '2px solid var(--violet)'
        }}>

          {/* ── Header ────────────────────────────────────────── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 22, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Report Issue
            </h1>
            <div style={{
              background: 'var(--bg-raised)', border: '1px solid var(--border-v2)',
              borderRadius: 6, padding: '5px 12px', fontSize: 12,
              color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)',
              display: 'flex', alignItems: 'center', gap: 6
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              Room {userDoc?.roomNumber}
            </div>
          </div>

          {/* ── Error ─────────────────────────────────────────── */}
          {error && (
            <div style={{
              background: 'rgba(240,101,101,0.1)', border: '1px solid rgba(240,101,101,0.3)',
              borderRadius: 'var(--radius-sm)', padding: '10px 14px',
              color: 'var(--red)', fontSize: 12, marginBottom: 12
            }}>{error}</div>
          )}

          {/* ── AI Banners ────────────────────────────────────── */}
          {isAnalyzing && (
            <div style={{
              padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: 16,
              background: 'rgba(124,110,250,0.08)', border: '1px solid rgba(124,110,250,0.2)',
              fontSize: 12, color: 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', gap: 8
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--violet)" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              AI is analyzing your complaint...
            </div>
          )}
          {aiSuggestion && !isAnalyzing && (
            <div style={{
              padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: 16,
              background: 'rgba(124,110,250,0.08)', border: '1px solid rgba(124,110,250,0.2)',
              fontSize: 12, color: 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <span>AI suggested: <strong style={{ color: 'var(--violet)' }}>{aiSuggestion.title}</strong></span>
              <button type="button" onClick={() => setAiSuggestion(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-ghost)', cursor: 'pointer', fontSize: 14 }}>x</button>
            </div>
          )}

          <form onSubmit={handleSubmit}>

            {/* ── Category ──────────────────────────────────── */}
            <div style={{ marginBottom: 20 }}>
              <div className="section-label">Category</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {CATEGORIES.map(c => (
                  <button type="button" key={c} onClick={() => setCategory(c)}
                    style={{
                      background: category === c ? 'rgba(124,110,250,0.08)' : 'var(--bg-raised)',
                      color: category === c ? 'var(--violet)' : 'var(--text-ghost)',
                      border: category === c ? '1px solid rgba(124,110,250,0.35)' : '1px solid var(--border-v2)',
                      borderLeft: category === c ? '2px solid var(--violet)' : undefined,
                      borderRadius: 7, padding: '7px 14px', fontSize: 13,
                      fontFamily: 'var(--font-body)', cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >{c}</button>
                ))}
              </div>
            </div>

            {/* ── Title ─────────────────────────────────────── */}
            <div style={{ marginBottom: 20 }}>
              <div className="section-label">Title</div>
              <input
                value={title} onChange={e => setTitle(e.target.value)} maxLength={100} required
                placeholder="Short description (e.g. Broken ceiling fan)"
                style={{
                  width: '100%', background: 'var(--bg-raised)', border: '1px solid var(--border-v2)',
                  borderRadius: 'var(--radius-sm)', padding: '11px 14px', fontSize: 13,
                  fontFamily: 'var(--font-body)', color: 'var(--text-primary)', outline: 'none',
                  transition: 'border-color 0.2s ease'
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(124,110,250,0.4)'}
                onBlur={e => e.target.style.borderColor = 'var(--border-v2)'}
              />
              <div style={{ fontSize: 12, color: 'var(--text-ghost)', textAlign: 'right', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                {title.length}/100
              </div>
            </div>

            {/* ── Description ───────────────────────────────── */}
            <div style={{ marginBottom: 20 }}>
              <div className="section-label">Description</div>

              {/* Language pills */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                {LANGUAGES.map(lang => (
                  <button key={lang.label} type="button" onClick={() => setSelectedLang(lang)}
                    style={{
                      padding: '5px 10px', fontSize: 12, borderRadius: 7, cursor: 'pointer',
                      background: selectedLang.label === lang.label ? 'rgba(124,110,250,0.08)' : 'var(--bg-raised)',
                      border: selectedLang.label === lang.label ? '1px solid rgba(124,110,250,0.35)' : '1px solid var(--border-v2)',
                      color: selectedLang.label === lang.label ? 'var(--violet)' : 'var(--text-ghost)',
                      fontFamily: 'var(--font-body)', transition: 'all 0.2s ease'
                    }}
                  >{lang.label}</button>
                ))}
              </div>

              {/* Mic button */}
              <button type="button" onClick={handleMicClick} disabled={isTranscribing}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 14px', borderRadius: 7, fontSize: 13,
                  background: 'transparent',
                  border: isRecording ? '1px solid var(--red)' : '1px solid var(--border-v2)',
                  color: isRecording ? 'var(--red)' : 'var(--text-secondary)',
                  cursor: 'pointer', fontFamily: 'var(--font-body)',
                  marginBottom: 10, transition: 'all 0.2s ease'
                }}
              >
                {isRecording && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', animation: 'pulse 1s infinite', display: 'inline-block' }} />}
                {!isRecording && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="1" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0014 0"/><line x1="12" y1="17" x2="12" y2="21"/></svg>}
                {isTranscribing ? 'Transcribing...' : isTranslating ? 'Translating...' : isRecording ? 'Recording...' : 'Use Voice'}
              </button>

              {/* Firefox fallback hints */}
              {!hasNativeSpeech && voiceBlob && (
                <div style={{ fontSize: 12, color: 'var(--green)', marginBottom: 8 }}>Voice recorded — type a brief description above</div>
              )}

              {/* Translation toggle */}
              {descriptionOriginal && descriptionTranslated && descriptionOriginal !== descriptionTranslated && (
                <button type="button" onClick={() => setShowOriginal(!showOriginal)}
                  style={{ background: 'none', border: 'none', color: 'var(--violet)', fontSize: 12, cursor: 'pointer', marginBottom: 8, padding: 0, fontFamily: 'var(--font-body)' }}>
                  {showOriginal ? 'Show translated' : `Show original (${detectedLanguage})`}
                </button>
              )}

              {/* Textarea */}
              {isTranslating ? (
                <div className="skeleton" style={{ height: 60, width: '100%' }} />
              ) : (
                <textarea
                  value={description} onChange={e => setDescription(e.target.value)} onBlur={handleDescriptionBlur}
                  rows={4} placeholder="Provide specific details about the issue..."
                  style={{
                    width: '100%', background: 'var(--bg-raised)', border: '1px solid var(--border-v2)',
                    borderRadius: 'var(--radius-sm)', padding: '11px 14px', fontSize: 13,
                    fontFamily: 'var(--font-body)', color: 'var(--text-primary)', outline: 'none',
                    minHeight: 100, resize: 'vertical', transition: 'border-color 0.2s ease'
                  }}
                  onFocus={e => e.target.style.borderColor = 'rgba(124,110,250,0.4)'}
                />
              )}
            </div>

            {/* ── Media ─────────────────────────────────────── */}
            <div style={{ marginBottom: 24 }}>
              <div className="section-label">Attach Media</div>
              <label style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                border: '1.5px dashed #252A38', borderRadius: 10, padding: 24,
                textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.2s ease'
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hover)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#252A38'}
              >
                <input type="file" multiple accept="image/*,video/*,audio/*" onChange={handleFileChange} style={{ display: 'none' }} />
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-ghost)" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
                <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                  Attach Media <span style={{ color: 'var(--violet)', textDecoration: 'underline' }}>Browse</span>
                </span>
                <span style={{ color: 'var(--text-ghost)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                  Max 50MB per file. Images, videos, audio.
                </span>
              </label>

              {files.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                  {files.map((f, idx) => {
                    const isImg = f.type.startsWith('image/');
                    return (
                      <div key={idx} style={{
                        position: 'relative', width: 64, height: 64, borderRadius: 8,
                        background: 'var(--bg-raised)', border: '1px solid var(--border-v2)', overflow: 'hidden'
                      }}>
                        {isImg ? (
                          <img src={URL.createObjectURL(f)} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--text-ghost)', wordBreak: 'break-all', padding: 4 }}>
                            {f.name.split('.').pop()}
                          </div>
                        )}
                        <button type="button" onClick={() => removeFile(idx)}
                          style={{
                            position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%',
                            background: 'var(--red)', color: '#fff', border: 'none', fontSize: 10,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                          }}>x</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Priority ──────────────────────────────────── */}
            <div style={{ marginBottom: 24 }}>
              <div className="section-label">Priority Level</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {PRIORITIES.map(p => {
                  const colors = { low: 'var(--green)', medium: 'var(--amber)', high: 'var(--red)' };
                  const isActive = priority === p;
                  return (
                    <button type="button" key={p} onClick={() => setPriority(p)}
                      style={{
                        flex: 1, padding: '8px 14px', borderRadius: 7, fontSize: 13,
                        fontFamily: 'var(--font-body)', cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        background: isActive ? `${colors[p]}15` : 'var(--bg-raised)',
                        border: isActive ? `1px solid ${colors[p]}40` : '1px solid var(--border-v2)',
                        color: isActive ? colors[p] : 'var(--text-ghost)'
                      }}
                    >{p.charAt(0).toUpperCase() + p.slice(1)}</button>
                  );
                })}
              </div>
            </div>

            {/* ── Submit ────────────────────────────────────── */}
            <button type="submit" disabled={isSubmitting || !title.trim() || !category}
              style={{
                width: '100%', background: 'var(--violet)', color: '#fff', border: 'none',
                borderRadius: 9, padding: 12, fontSize: 13, fontFamily: 'var(--font-heading)',
                fontWeight: 500, cursor: 'pointer', transition: 'opacity 0.2s ease',
                opacity: (isSubmitting || !title.trim() || !category) ? 0.5 : 1,
                marginTop: 8
              }}
            >
              {isSubmitting ? (submitStatus || 'Submitting...') : 'Submit Complaint'}
            </button>
            <div style={{ textAlign: 'center', marginTop: 8, fontSize: 12, color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)' }}>
              Warden will be notified immediately
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}
