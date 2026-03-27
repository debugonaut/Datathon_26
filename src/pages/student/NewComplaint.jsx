import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { createComplaint } from '../../firebase/firestore';
import { analyzeComplaint } from '../../utils/aiComplaintAnalyzer';

const CATEGORIES = ['Plumbing', 'Electrical', 'Cleaning', 'Furniture', 'Other'];
const PRIORITIES = ['low', 'medium', 'high'];

const LANGUAGES = [
  { label: 'Auto (Highly Recommended)', code: null, whisperLang: null },
  { label: 'English', code: 'en-IN', whisperLang: 'english' },
  { label: 'हिंदी / Hinglish', code: 'hi-IN', whisperLang: 'hindi' },
  { label: 'मराठी', code: 'mr-IN', whisperLang: 'marathi' },
];


// ── MyMemory free translation ──────────────────────────────────────────────
// Legacy translation removed, now handled by AI.

export default function NewComplaint() {
  const { user, userDoc } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!userDoc?.roomId) {
      navigate('/student/room-register', { replace: true });
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get('voice') === 'true') {
      setStep(2); // Jump to details
      setTimeout(() => handleMicClick(), 500); // Trigger mic
    }
  }, [userDoc, navigate]);

  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('low');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [step, setStep] = useState(1);
  const TOTAL_STEPS = 4;
  const canNext1 = !!category;
  const canNext2 = title.trim().length > 0;
  const canNext3 = true;

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

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);

  const isAiDisabled = false; // Always hidden now that keys are verified to work




    const triggerAIAnalysis = async ({ imageBase64, transcript, typed }) => {
      if (!imageBase64 && !transcript && !typed) return;
      console.log('🚀 Triggering AI Analysis with:', { transcript, hasImage: !!imageBase64, typed });
      setIsAnalyzing(true);
      try {
        const suggestion = await analyzeComplaint({ imageBase64, transcript, typedText: typed });
        console.log('🤖 AI Suggestion received:', suggestion);
        if (suggestion) {
          setAiSuggestion(suggestion);
          // Only override category if it's currently empty or set to 'Other'
          if (suggestion.category && (!category || category === 'Other')) {
            const catMatch = CATEGORIES.find(c => c.toLowerCase() === suggestion.category.toLowerCase());
            if (catMatch) setCategory(catMatch);
            else setCategory(suggestion.category);
          }
          if (suggestion.priority) setPriority(suggestion.priority.toLowerCase());
          if (suggestion.title) setTitle(suggestion.title);
          if (suggestion.detectedLanguage) setDetectedLanguage(suggestion.detectedLanguage);
          if (suggestion.description) {
            setDescription(suggestion.description);
            setDescriptionTranslated(suggestion.description);
          }
        } else {
          console.warn('⚠️ AI returned null or empty suggestion.');
          alert('AI Analysis failed to generate a suggestion. Please check your internet connection and API key.');
        }
      } catch (err) {
        console.error('❌ AI analysis failed:', err);
        alert(`AI Feature Error: ${err.message || 'Unknown error occurred during analysis.'}`);
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

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = selectedLang?.code || 'en-IN';
        recognition.continuous = false;
        recognition.interimResults = false;
        
        recognition.onstart = () => {
          setIsRecording(true);
          console.log('Speech recognition started');
        };

        // Ensure we can stop manually
        stopRecorderRef.current = () => {
          recognition.stop();
          setIsRecording(false);
        };

        recognition.onresult = async (e) => {
          const spoken = e.results[0][0].transcript;
          console.log('Speech result:', spoken);
          
          setIsRecording(false);
          setDescriptionOriginal(spoken);
          setDetectedLanguage('Analyzing…');
          
          try {
            setIsTranslating(true);
            await triggerAIAnalysis({ transcript: spoken });
          } finally {
            setIsTranslating(false);
          }
        };
        
        recognition.onerror = (e) => {
          console.error('Speech recognition error:', e.error);
          setIsRecording(false);
          if (e.error === 'not-allowed') {
            alert('Microphone access denied. Please enable microphone permissions in your browser settings.');
          } else {
            console.warn('Falling back to MediaRecorder due to recognition error');
            startMediaRecorderFallback();
          }
        };
        
        recognition.onend = () => setIsRecording(false);
        recognition.start();
      } catch (err) {
        console.error('Speech recognition failed to initialize:', err);
        startMediaRecorderFallback();
      }
    } else {
      startMediaRecorderFallback();
    }
  };

  const startMediaRecorderFallback = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks = [];
      
      mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
      
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        setIsRecording(false);
        
        alert("Live AI transcription isn't supported in this browser. We've attached your recording as a file.");
        const file = new File([audioBlob], `voice_input_${Date.now()}.webm`, { type: 'audio/webm' });
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

  const categoryIcons = {
    Plumbing:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
    Electrical: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
    Cleaning:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>,
    Furniture:  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2M8 7V5a2 2 0 0 1 4 0"/></svg>,
    Other:      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  };

  const categoryDescs = {
    Plumbing: 'Taps, pipes, leaks',
    Electrical: 'Power, switches, fans',
    Cleaning: 'Hygiene, garbage',
    Furniture: 'Beds, chairs, tables',
    Other: 'Anything else',
  };

  const priorityConfig = {
    low:    { color: 'var(--green)',  bg: 'var(--green-soft)',  label: 'Low',    timer: '7 day timer',  desc: 'Non-urgent' },
    medium: { color: 'var(--amber)',  bg: 'var(--amber-soft)',  label: 'Medium', timer: '3 day timer',  desc: 'Needs attention' },
    high:   { color: 'var(--red)',    bg: 'var(--red-soft)',    label: 'High',   timer: '24h timer',    desc: 'Urgent' },
  };

  const stepLabels = ['Category', 'Details', 'Media', 'Review'];

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Navbar />

      <div style={{ maxWidth: 580, margin: '0 auto', padding: '32px 20px 64px' }}>

        {/* ── Progress stepper ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 36 }}>
          {stepLabels.map((label, i) => {
            const n = i + 1;
            const done = step > n;
            const active = step === n;
            return (
              <div key={n} style={{ display: 'flex', alignItems: 'flex-start', flex: n < 4 ? 1 : 'none' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 56 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700,
                    transition: 'all 0.2s',
                    background: done ? 'var(--primary)' : active ? 'transparent' : 'transparent',
                    border: done ? '2px solid var(--primary)' : active ? '2px solid var(--primary)' : '2px solid var(--border-strong)',
                    color: done ? '#fff' : active ? 'var(--primary)' : 'var(--text-3)',
                    fontFamily: 'var(--font-mono)',
                  }}>
                    {done
                      ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6 9 17l-5-5"/></svg>
                      : n
                    }
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                    color: active ? 'var(--primary)' : done ? 'var(--text-2)' : 'var(--text-3)',
                    whiteSpace: 'nowrap',
                  }}>{label}</span>
                </div>
                {n < 4 && (
                  <div style={{
                    flex: 1, height: 2, marginTop: 15, marginLeft: 4, marginRight: 4,
                    background: done ? 'var(--primary)' : 'var(--border)',
                    borderRadius: 1, transition: 'background 0.3s',
                  }} />
                )}
              </div>
            );
          })}
        </div>

        {/* ── Card ── */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
        }}>

          {/* Card top accent — changes color per step */}
          <div style={{
            height: 3,
            background: step === 1 ? 'var(--primary)' : step === 2 ? 'var(--amber)' : step === 3 ? 'var(--green)' : 'var(--primary)',
            transition: 'background 0.3s',
          }} />

          <div style={{ padding: '28px 32px' }}>

            {/* ── Room chip + AI banner ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <div>
                <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', margin: 0, marginBottom: 2 }}>
                  {step === 1 ? 'What type of issue?' : step === 2 ? 'Describe the issue' : step === 3 ? 'Media & priority' : 'Review & submit'}
                </h1>
                <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0 }}>
                  {step === 1 ? 'Select the category that best fits your complaint.' : step === 2 ? 'Add a title and describe what happened.' : step === 3 ? 'Attach photos or voice, then set urgency.' : 'Check your complaint before submitting.'}
                </p>
              </div>
              <div style={{
                background: 'var(--bg-input)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '5px 12px', fontSize: 11.5,
                color: 'var(--text-3)', fontFamily: 'var(--font-mono)',
                display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 16
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                Room {userDoc?.roomNumber}
              </div>
            </div>

            {/* AI banners */}
            {isAnalyzing && (
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', borderRadius:8, marginBottom:16, background:'var(--primary-soft)', border:'1px solid var(--primary-border)', fontSize:12.5, color:'var(--text-2)' }}>
                <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--primary)', animation:'pulse 1s infinite', flexShrink:0 }} />
                AI is analyzing your complaint…
              </div>
            )}
            {aiSuggestion && !isAnalyzing && (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', borderRadius:8, marginBottom:16, background:'var(--primary-soft)', border:'1px solid var(--primary-border)', fontSize:12.5, color:'var(--text-2)' }}>
                <span>AI suggested: <strong style={{ color:'var(--primary)', fontWeight:600 }}>{aiSuggestion.title}</strong></span>
                <button type="button" onClick={() => setAiSuggestion(null)} style={{ background:'none', border:'none', color:'var(--text-3)', cursor:'pointer', fontSize:16, lineHeight:1, padding:0 }}>×</button>
              </div>
            )}



            {error && (
              <div style={{ padding:'10px 14px', borderRadius:8, marginBottom:16, background:'var(--red-soft)', border:'1px solid rgba(239,68,68,0.25)', fontSize:12.5, color:'var(--red)' }}>
                {error}
              </div>
            )}



            {/* ════════════════════════════════════════
                STEP 1 — CATEGORY
            ════════════════════════════════════════ */}
            {step === 1 && (
              <div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:8 }}>
                  {CATEGORIES.map(c => {
                    const active = category === c;
                    return (
                      <button key={c} type="button" onClick={() => setCategory(c)} style={{
                        background: active ? 'rgba(108,99,255,0.06)' : 'var(--bg-input)',
                        border: active ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                        borderRadius: 12, padding: '16px 12px 14px',
                        textAlign: 'center', cursor: 'pointer',
                        transition: 'all 0.15s',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                      }}
                        onMouseOver={e => { if (!active) e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
                        onMouseOut={e => { if (!active) e.currentTarget.style.borderColor = 'var(--border)'; }}
                      >
                        <div style={{
                          width: 40, height: 40, borderRadius: 10,
                          background: active ? 'rgba(108,99,255,0.12)' : 'var(--bg-hover)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: active ? 'var(--primary)' : 'var(--text-2)',
                          transition: 'all 0.15s',
                        }}>
                          {categoryIcons[c]}
                        </div>
                        <div>
                          <div style={{ fontSize:13, fontWeight:600, color: active ? 'var(--primary)' : 'var(--text)', marginBottom:2 }}>{c}</div>
                          <div style={{ fontSize:11, color:'var(--text-3)' }}>{categoryDescs[c]}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════
                STEP 2 — DETAILS
            ════════════════════════════════════════ */}
            {step === 2 && (
              <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

                {/* Title */}
                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--text-2)', marginBottom:8 }}>Title</label>
                  <input
                    value={title} onChange={e => setTitle(e.target.value)} maxLength={100}
                    placeholder="Short description (e.g. Broken ceiling fan)"
                    style={{ width:'100%', padding:'10px 14px', background:'var(--bg-input)', border:'1px solid var(--border-strong)', borderRadius:8, fontSize:13.5, fontFamily:'var(--font)', color:'var(--text)', outline:'none', transition:'border-color 0.15s, box-shadow 0.15s' }}
                    onFocus={e => { e.target.style.borderColor='var(--primary)'; e.target.style.boxShadow='0 0 0 3px var(--primary-soft)'; }}
                    onBlur={e => { e.target.style.borderColor='var(--border-strong)'; e.target.style.boxShadow='none'; }}
                  />
                  <div style={{ fontSize:11, color:'var(--text-3)', textAlign:'right', marginTop:4, fontFamily:'var(--font-mono)' }}>{title.length}/100</div>
                </div>

                {/* Language + voice */}
                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--text-2)', marginBottom:8 }}>Description</label>

                  <div style={{ 
                    padding: description ? '12px' : '24px 16px',
                    borderRadius: 16,
                    background: description ? 'transparent' : 'var(--primary-soft)',
                    border: description ? 'none' : '1px dashed var(--primary)',
                    marginBottom: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 12,
                    textAlign: 'center'
                  }}>
                    {!description && (
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>
                        ✨ Use AI Voice to auto-fill details
                      </div>
                    )}
                    <div style={{ display:'flex', alignItems:'center', gap:8, width: '100%', justifyContent: 'center' }}>
                      <button type="button" onClick={handleMicClick} disabled={isTranscribing} style={{
                        display:'flex', alignItems:'center', gap:10, padding: description ? '7px 13px' : '12px 24px',
                        borderRadius: 12, border: isRecording ? '2px solid var(--red)' : '1px solid var(--border-strong)',
                        background: isRecording ? 'rgba(239,68,68,0.1)' : 'var(--bg-card)', fontSize: description ? '12.5px' : '15px', fontWeight: 600, fontFamily:'var(--font)',
                        color: isRecording ? 'var(--red)' : 'var(--text-2)', cursor:'pointer', transition:'all 0.2s',
                        boxShadow: isRecording ? '0 0 20px rgba(239,68,68,0.3)' : 'var(--shadow-sm)'
                      }}>
                        {isRecording
                          ? <div className="voice-wave" style={{ transform: 'scale(1.2)' }}>
                              <span/><span/><span/><span/><span/>
                            </div>
                          : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="9" y="1" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0014 0"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                        }
                        {isTranscribing ? 'Transcribing…' : isTranslating ? 'Analyzing Ticket…' : isRecording ? 'Speak now…' : 'Tap to Speak'}
                      </button>
                    </div>
                    {!description && (
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap', justifyContent:'center' }}>
                        {LANGUAGES.slice(1).map(lang => (
                          <button key={lang.label} type="button" onClick={() => setSelectedLang(lang)} style={{
                            padding:'4px 10px', fontSize:11, borderRadius:20,
                            border: selectedLang.label === lang.label ? '1px solid var(--primary)' : '1px solid var(--border)',
                            background: selectedLang.label === lang.label ? 'var(--primary-soft)' : 'transparent',
                            color: selectedLang.label === lang.label ? 'var(--primary)' : 'var(--text-3)',
                            cursor:'pointer', transition:'all 0.15s', fontFamily:'var(--font)',
                          }}>{lang.label}</button>
                        ))}
                      </div>
                    )}
                  </div>

                  {descriptionOriginal && descriptionTranslated && descriptionOriginal !== descriptionTranslated && (
                    <button type="button" onClick={() => setShowOriginal(!showOriginal)} style={{ background:'none', border:'none', color:'var(--primary)', fontSize:12, cursor:'pointer', marginBottom:8, padding:0, fontFamily:'var(--font)' }}>
                      {showOriginal ? 'Show translated' : `Show original (${detectedLanguage})`}
                    </button>
                  )}

                  {isTranslating
                    ? <div className="skeleton" style={{ height:96, borderRadius:8 }} />
                    : <textarea
                        value={description} onChange={e => setDescription(e.target.value)}
                        rows={4} placeholder="Provide specific details about the issue…"
                        style={{ width:'100%', padding:'10px 14px', background:'var(--bg-input)', border:'1px solid var(--border-strong)', borderRadius:8, fontSize:13, fontFamily:'var(--font)', color:'var(--text)', outline:'none', resize:'vertical', minHeight:96, lineHeight:1.6, transition:'border-color 0.15s' }}
                        onFocus={e => { e.target.style.borderColor='var(--primary)'; e.target.style.boxShadow='0 0 0 3px var(--primary-soft)'; }}
                        onBlur={e => { e.target.style.borderColor='var(--border-strong)'; e.target.style.boxShadow='none'; handleDescriptionBlur(); }}
                      />
                  }
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════
                STEP 3 — MEDIA + PRIORITY
            ════════════════════════════════════════ */}
            {step === 3 && (
              <div style={{ display:'flex', flexDirection:'column', gap:24 }}>

                {/* Media dropzone */}
                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--text-2)', marginBottom:8 }}>Attach media <span style={{ color:'var(--text-3)', fontWeight:400, textTransform:'none', letterSpacing:0 }}>(optional)</span></label>
                  <label style={{
                    display:'flex', flexDirection:'column', alignItems:'center', gap:10,
                    border:'1.5px dashed var(--border-strong)', borderRadius:12, padding:'28px 20px',
                    textAlign:'center', cursor:'pointer', transition:'border-color 0.15s, background 0.15s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor='var(--primary)'; e.currentTarget.style.background='var(--primary-soft)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border-strong)'; e.currentTarget.style.background='transparent'; }}
                  >
                    <input type="file" multiple accept="image/*,video/*,audio/*" onChange={handleFileChange} style={{ display:'none' }} />
                    <div style={{ width:44, height:44, borderRadius:10, background:'var(--bg-input)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    </div>
                    <div>
                      <div style={{ fontSize:13.5, color:'var(--text)' }}>Drop files or <span style={{ color:'var(--primary)', textDecoration:'underline' }}>browse</span></div>
                      <div style={{ fontSize:11.5, color:'var(--text-3)', marginTop:3, fontFamily:'var(--font-mono)' }}>Max 50MB · Images, videos, audio</div>
                    </div>
                  </label>

                  {files.length > 0 && (
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:12 }}>
                      {files.map((f, idx) => (
                        <div key={idx} style={{ position:'relative', width:68, height:68, borderRadius:10, background:'var(--bg-input)', border:'1px solid var(--border)', overflow:'hidden' }}>
                          {f.type.startsWith('image/')
                            ? <img src={URL.createObjectURL(f)} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                            : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:3 }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.8"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                                <span style={{ fontSize:9, color:'var(--text-3)', fontFamily:'var(--font-mono)' }}>{f.name.split('.').pop()}</span>
                              </div>
                          }
                          <button type="button" onClick={() => removeFile(idx)} style={{ position:'absolute', top:-3, right:-3, width:18, height:18, borderRadius:'50%', background:'var(--red)', color:'#fff', border:'none', fontSize:10, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontWeight:700 }}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Priority */}
                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--text-2)', marginBottom:10 }}>Priority level</label>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
                    {Object.entries(priorityConfig).map(([p, cfg]) => {
                      const active = priority === p;
                      return (
                        <button key={p} type="button" onClick={() => setPriority(p)} style={{
                          border: active ? `1.5px solid ${cfg.color}` : '1px solid var(--border)',
                          background: active ? cfg.bg : 'var(--bg-input)',
                          borderRadius:10, padding:'14px 10px',
                          textAlign:'center', cursor:'pointer', transition:'all 0.15s',
                        }}>
                          <div style={{ fontSize:14, fontWeight:700, color: active ? cfg.color : 'var(--text-2)', marginBottom:3 }}>{cfg.label}</div>
                          <div style={{ fontSize:11.5, color: active ? cfg.color : 'var(--text-3)', fontFamily:'var(--font-mono)', marginBottom:2, opacity: active ? 0.8 : 1 }}>{cfg.timer}</div>
                          <div style={{ fontSize:10.5, color:'var(--text-3)' }}>{cfg.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════
                STEP 4 — REVIEW
            ════════════════════════════════════════ */}
            {step === 4 && (
              <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
                {[
                  ['Category', category || '—', category ? 'var(--text)' : 'var(--text-3)'],
                  ['Title', title || '—', title ? 'var(--text)' : 'var(--text-3)'],
                  ['Priority', priority, priority === 'high' ? 'var(--red)' : priority === 'medium' ? 'var(--amber)' : 'var(--green)'],
                  ['Files', files.length > 0 ? `${files.length} file${files.length > 1 ? 's' : ''} attached` : 'No files', files.length > 0 ? 'var(--text)' : 'var(--text-3)'],
                  ['Room', `Room ${userDoc?.roomNumber}`, 'var(--text)'],
                  ['Language', descriptionTranslated && descriptionOriginal !== descriptionTranslated ? `Auto-translated from ${detectedLanguage}` : 'English', 'var(--text-2)'],
                ].map(([k, v, color]) => (
                  <div key={k} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 0', borderBottom:'1px solid var(--border)' }}>
                    <span style={{ fontSize:13, color:'var(--text-2)', fontWeight:500 }}>{k}</span>
                    <span style={{ fontSize:13, color, fontWeight:600, fontFamily: k === 'Priority' || k === 'Files' || k === 'Room' ? 'var(--font-mono)' : 'var(--font)', maxWidth:260, textAlign:'right' }}>{v}</span>
                  </div>
                ))}

                {description && (
                  <div style={{ padding:'12px 0', borderBottom:'1px solid var(--border)' }}>
                    <div style={{ fontSize:13, color:'var(--text-2)', fontWeight:500, marginBottom:6 }}>Description</div>
                    <div style={{ fontSize:13, color:'var(--text)', lineHeight:1.6, maxHeight:80, overflow:'hidden', maskImage:'linear-gradient(to bottom,black 60%,transparent)', WebkitMaskImage:'linear-gradient(to bottom,black 60%,transparent)' }}>{description}</div>
                  </div>
                )}

                <div style={{ marginTop:20 }}>
                  <button type="button" onClick={handleSubmit} disabled={isSubmitting || !title.trim() || !category} style={{
                    width:'100%', padding:'13px', background:'var(--primary)', color:'#fff', border:'none',
                    borderRadius:10, fontSize:14, fontFamily:'var(--font)', fontWeight:700, cursor:'pointer',
                    transition:'opacity 0.15s', opacity: (isSubmitting || !title.trim() || !category) ? 0.5 : 1,
                    display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                  }}>
                    {isSubmitting
                      ? <><div style={{ width:16, height:16, borderRadius:'50%', border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', animation:'spin 0.6s linear infinite' }} />{submitStatus || 'Submitting…'}</>
                      : <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>Submit complaint</>
                    }
                  </button>
                  <div style={{ textAlign:'center', marginTop:10, fontSize:11.5, color:'var(--text-3)', fontFamily:'var(--font-mono)' }}>
                    Warden will be notified immediately
                  </div>
                </div>
              </div>
            )}

            {/* ── Navigation buttons ── */}
            {step < 4 && (
              <div style={{ display:'flex', justifyContent: step === 1 ? 'flex-end' : 'space-between', marginTop:28, paddingTop:20, borderTop:'1px solid var(--border)' }}>
                {step > 1 && (
                  <button type="button" onClick={() => setStep(s => s - 1)} style={{
                    display:'flex', alignItems:'center', gap:6, padding:'9px 18px',
                    background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:8,
                    fontSize:13.5, fontFamily:'var(--font)', fontWeight:600, color:'var(--text-2)', cursor:'pointer', transition:'all 0.15s',
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
                    Back
                  </button>
                )}
                <button type="button"
                  onClick={() => setStep(s => s + 1)}
                  disabled={step === 1 ? !canNext1 : step === 2 ? !canNext2 : false}
                  style={{
                    display:'flex', alignItems:'center', gap:6, padding:'9px 22px',
                    background:'var(--primary)', color:'#fff', border:'none', borderRadius:8,
                    fontSize:13.5, fontFamily:'var(--font)', fontWeight:700, cursor:'pointer', transition:'opacity 0.15s',
                    opacity: (step === 1 && !canNext1) || (step === 2 && !canNext2) ? 0.4 : 1,
                  }}>
                  {step === 3 ? 'Review' : 'Continue'}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </button>
              </div>
            )}

            {step === 4 && (
              <div style={{ display:'flex', justifyContent:'flex-start', marginTop:16 }}>
                <button type="button" onClick={() => setStep(3)} style={{
                  display:'flex', alignItems:'center', gap:6, padding:'7px 14px',
                  background:'transparent', border:'none', fontSize:12.5, fontFamily:'var(--font)',
                  color:'var(--text-3)', cursor:'pointer',
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
                  Edit
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
