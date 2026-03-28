import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { searchHostels } from '../firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { signInWithEmailAndPassword, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { getRedirectPath } from '../utils/navigation';

function useTypewriter(words, { typeSpeed = 85, deleteSpeed = 50, pauseAfter = 1900, pauseBefore = 350 } = {}) {
  const [displayed, setDisplayed] = useState('');
  const state = useRef({ wi: 0, ci: 0, deleting: false });
  useEffect(() => {
    let timer;
    function tick() {
      const { wi, ci, deleting } = state.current;
      const word = words[wi];
      if (!deleting) {
        setDisplayed(word.slice(0, ci + 1));
        if (ci + 1 === word.length) {
          state.current = { wi, ci: ci + 1, deleting: true };
          timer = setTimeout(tick, pauseAfter);
        } else {
          state.current = { wi, ci: ci + 1, deleting: false };
          timer = setTimeout(tick, typeSpeed);
        }
      } else {
        setDisplayed(word.slice(0, ci - 1));
        if (ci - 1 === 0) {
          state.current = { wi: (wi + 1) % words.length, ci: 0, deleting: false };
          timer = setTimeout(tick, pauseBefore);
        } else {
          state.current = { wi, ci: ci - 1, deleting: true };
          timer = setTimeout(tick, deleteSpeed);
        }
      }
    }
    timer = setTimeout(tick, typeSpeed);
    return () => clearTimeout(timer);
  }, []);
  return displayed;
}

function useAITyper(lines, charSpeed = 60, linePause = 500, restartPause = 2800) {
  const [text, setText] = useState('');
  const state = useRef({ li: 0, ci: 0 });
  useEffect(() => {
    let timer;
    function tick() {
      const { li, ci } = state.current;
      const line = lines[li];
      const newText = lines.slice(0, li).join('\n') + (li > 0 ? '\n' : '') + line.slice(0, ci + 1);
      setText(newText);
      if (ci + 1 > line.length) {
        if (li < lines.length - 1) {
          state.current = { li: li + 1, ci: 0 };
          timer = setTimeout(tick, linePause);
        } else {
          state.current = { li: 0, ci: 0 };
          timer = setTimeout(() => { setText(''); timer = setTimeout(tick, 400); }, restartPause);
        }
        return;
      }
      state.current = { li, ci: ci + 1 };
      timer = setTimeout(tick, charSpeed);
    }
    timer = setTimeout(tick, 1000);
    return () => clearTimeout(timer);
  }, []);
  return text;
}

function launchConfetti(canvas, originX, originY) {
  const ctx = canvas.getContext('2d');
  const cols = ['#6C63FF', '#10B981', '#3B82F6', '#f59e0b', '#ef4444', '#fff', '#a89fff', '#34d399'];
  const ps = Array.from({ length: 100 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 6 + 1.5;
    return {
      x: originX, y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1,
      w: Math.random() * 9 + 3, h: Math.random() * 5 + 2,
      color: cols[Math.floor(Math.random() * cols.length)],
      rot: Math.random() * 360, vr: (Math.random() - 0.5) * 12,
      alpha: 1,
    };
  });
  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ps.forEach(p => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
      p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.rot += p.vr;
      if (frame > 40) p.alpha -= 0.018;
    });
    frame++;
    if (frame < 115) requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  draw();
}

export default function LandingPage() {
  const { user, userDoc } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const [cardAState, setCardAState] = useState('default');
  const [showResolveBtn, setShowResolveBtn] = useState(false);
  const [showResolvedCard, setShowResolvedCard] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [cursorPos, setCursorPos] = useState({ x: 40, y: 50 });
  const [cursorScale, setCursorScale] = useState(1);

  const rightPanelRef = useRef(null);
  const canvasRef = useRef(null);
  const loopTimer = useRef(null);

  const typeWords = [
    'No more lost complaint slips.',
    'AI sorts it before you blink.',
    'Wardens see it live.',
    '60 seconds to raise anything.',
  ];
  const aiLines = ['Category: Plumbing', 'Priority: High', 'Block B · Floor 3', '3 similar in 7 days', '→ Cluster likely'];

  const typedWord = useTypewriter(typeWords);
  const aiText = useAITyper(aiLines);

  const runLoop = useCallback(() => {
    function delay(ms) {
      return new Promise(res => { loopTimer.current = setTimeout(res, ms); });
    }
    async function sequence() {
      setCursorPos({ x: 60, y: 80 });
      await delay(900);
      setCardAState('hovered');
      setShowResolveBtn(true);
      setCursorPos({ x: 150, y: 132 });
      await delay(800);
      setCursorScale(0.8);
      await delay(150);
      setCursorScale(1);
      await delay(400);
      setShowResolveBtn(false);
      setCardAState('resolved');
      setShowFlash(true);
      const panel = rightPanelRef.current;
      const canvas = canvasRef.current;
      if (panel && canvas) {
        canvas.width = panel.offsetWidth;
        canvas.height = panel.offsetHeight;
        launchConfetti(canvas, panel.offsetWidth * 0.45, 130);
      }
      await delay(400);
      setShowResolvedCard(true);
      await delay(2400);
      setShowFlash(false);
      await delay(3500);
      setCardAState('default');
      setShowResolvedCard(false);
      setCursorPos({ x: 40, y: 50 });
      await delay(1200);
      sequence();
    }
    loopTimer.current = setTimeout(sequence, 2200);
  }, []);

  useEffect(() => {
    runLoop();
    return () => clearTimeout(loopTimer.current);
  }, [runLoop]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setSearched(false);
    const hostels = await searchHostels(query.trim());
    setResults(hostels);
    setSearched(true);
    setLoading(false);
  };

  const handleJoin = (hostelId) => {
    sessionStorage.setItem('selectedHostelId', hostelId);
    if (user) {
      navigate(`/student/join?hostelId=${hostelId}`);
    } else {
      navigate('/register?role=student');
    }
  };

  const cardAStyle = {
    position: 'absolute', top: 32, left: 20, width: 225,
    background: '#1A1D26',
    border: cardAState === 'resolved'
      ? '1px solid rgba(16,185,129,0.45)'
      : cardAState === 'hovered'
        ? '1px solid rgba(108,99,255,0.5)'
        : '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14, padding: '14px 16px',
    boxShadow: cardAState === 'hovered'
      ? '0 0 0 2px #6C63FF, 0 12px 40px rgba(108,99,255,0.3)'
      : cardAState === 'resolved'
        ? '0 0 0 1px #10B981, 0 12px 40px rgba(16,185,129,0.2)'
        : 'none',
    transform: cardAState === 'hovered' ? 'translateY(-2px)' : 'none',
    transition: 'box-shadow 0.4s, transform 0.4s, border-color 0.4s',
    zIndex: 2,
  };

  return (
    <div style={{ fontFamily: "'Sora', 'Inter', sans-serif", background: '#0E1015', color: '#F1F5F9', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* Navbar */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 36px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 700, letterSpacing: '-0.03em' }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <polygon points="16,2 28,9 28,23 16,30 4,23 4,9" stroke="#6C63FF" strokeWidth="1.5" />
            <path d="M16 9 L16 16 L20 19" stroke="#6C63FF" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Fix My Hostel
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 10, letterSpacing: '0.08em', color: '#6C63FF', background: 'rgba(108,99,255,0.1)', border: '1px solid rgba(108,99,255,0.25)', padding: '4px 10px', borderRadius: 5, fontWeight: 700, textTransform: 'uppercase' }}>
            PS-15 · Datathon 2026
          </span>
           {user ? (
            <Link to={getRedirectPath(userDoc)} style={{ height: 34, padding: '0 16px', borderRadius: 8, background: '#6C63FF', border: 'none', color: '#fff', fontSize: 12, fontFamily: 'inherit', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" style={{ height: 34, padding: '0 14px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8', fontSize: 12, fontFamily: 'inherit', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                Login
              </Link>
              <Link to="/register" style={{ height: 34, padding: '0 14px', borderRadius: 8, background: '#6C63FF', border: 'none', color: '#fff', fontSize: 12, fontFamily: 'inherit', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                Register
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', flex: 1, minHeight: 480 }}>

        {/* Left */}
        <div style={{ padding: '50px 36px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative' }}>
          <div style={{ position: 'absolute', width: 340, height: 340, borderRadius: '50%', background: 'radial-gradient(circle, rgba(108,99,255,0.14) 0%, transparent 70%)', top: '50%', left: '40%', transform: 'translate(-50%,-50%)', zIndex: 0, pointerEvents: 'none' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>

            <div style={{ display: 'flex', gap: 6, marginBottom: 22 }}>
              <span style={{ fontSize: 11, padding: '5px 14px', borderRadius: 20, fontWeight: 700, letterSpacing: '0.04em', background: 'rgba(108,99,255,0.15)', color: '#a89fff', border: '1px solid rgba(108,99,255,0.3)' }}>For Students</span>
              <span style={{ fontSize: 11, padding: '5px 14px', borderRadius: 20, fontWeight: 700, letterSpacing: '0.04em', background: 'transparent', color: '#475569', border: '1px solid rgba(255,255,255,0.07)' }}>For Wardens</span>
            </div>

            <h1 style={{ fontSize: 44, fontWeight: 700, lineHeight: 1.06, letterSpacing: '-0.04em', margin: '0 0 6px', fontFamily: "'Sora', sans-serif" }}>
              Raise it once.<br />Get it fixed.
            </h1>

            <div style={{ minHeight: 54, display: 'flex', alignItems: 'center', marginBottom: 2 }}>
              <span style={{ fontSize: 44, fontWeight: 700, letterSpacing: '-0.04em', color: '#6C63FF', fontFamily: "'Sora', sans-serif" }}>{typedWord}</span>
              <span style={{ display: 'inline-block', width: 3, height: 44, background: '#6C63FF', borderRadius: 2, animation: 'fmhBlink 0.9s infinite', marginLeft: 3, verticalAlign: 'middle', flexShrink: 0 }} />
            </div>

            <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.7, maxWidth: 360, margin: '12px 0 28px' }}>
              From water leaks to mess complaints — raise issues in seconds, track them live, and watch wardens resolve them in real time.
            </p>

            <form onSubmit={handleSearch} style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '5px 5px 5px 16px', gap: 6, alignItems: 'center', maxWidth: 420, marginBottom: 12 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search your hostel name…"
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: '#F1F5F9', fontFamily: 'inherit', minWidth: 0, padding: '8px 0' }}
              />
              <button type="submit" disabled={loading} style={{ height: 38, padding: '0 18px', borderRadius: 8, background: '#6C63FF', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                {loading ? '…' : 'Find & Join'}
              </button>
            </form>

            {searched && results.length === 0 && (
              <p style={{ fontSize: 12, color: '#475569', marginBottom: 12 }}>No hostels found. Ask your warden to register first.</p>
            )}
            {results.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 420, marginBottom: 16 }}>
                {results.map(h => (
                  <div key={h.id} style={{ background: '#1A1D26', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: '#F1F5F9' }}>{h.name}</div>
                      <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{h.collegeName}</div>
                    </div>
                    <button onClick={() => handleJoin(h.id)} style={{ height: 32, padding: '0 14px', borderRadius: 8, background: '#6C63FF', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Join →
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                onClick={() => window.open('/demo', '_blank')}
                style={{ height: 46, padding: '0 22px', borderRadius: 23, background: 'linear-gradient(135deg, #10B981, #3B82F6)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                Try Datathon Demo
              </button>
              <Link
                to="/register?role=warden"
                style={{ height: 46, padding: '0 22px', borderRadius: 23, background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: '#94A3B8', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                Warden Registration
              </Link>
            </div>
          </div>
        </div>

        {/* Right — animated panel */}
        <div
          ref={rightPanelRef}
          style={{
            position: 'relative', overflow: 'hidden',
            background: 'rgba(108,99,255,0.04)',
            borderLeft: '1px solid rgba(255,255,255,0.06)',
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        >
          {/* Accent dots */}
          <div style={{ position: 'absolute', top: 20, right: 20, display: 'flex', flexDirection: 'column', gap: 10, zIndex: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6C63FF', boxShadow: '0 0 8px rgba(108,99,255,0.7)' }} />
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981' }} />
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B' }} />
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444' }} />
          </div>

          {/* Card A */}
          <div style={cardAStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#475569' }}>Plumbing · Fl 3</span>
              <span style={{
                fontSize: 10, fontWeight: 700, borderRadius: 6, padding: '3px 8px',
                background: cardAState === 'resolved' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                color: cardAState === 'resolved' ? '#10B981' : '#EF4444',
                transition: 'all 0.5s',
              }}>
                {cardAState === 'resolved' ? 'Resolved' : 'Breached'}
              </span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#E2E8F0', marginBottom: 8 }}>Water leakage in bathroom</div>
            <div style={{ height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2, marginBottom: 8 }}>
              <div style={{ height: 3, borderRadius: 2, background: cardAState === 'resolved' ? '#10B981' : '#EF4444', width: '100%', transition: 'background 0.5s' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#475569' }}>26h ago · High</span>
              {showResolveBtn && (
                <span style={{ fontSize: 11, fontWeight: 700, color: '#10B981', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 6, padding: '4px 10px' }}>
                  ✓ Resolve
                </span>
              )}
            </div>
          </div>

          {/* Card B */}
          <div style={{ position: 'absolute', top: 210, right: 16, width: 210, background: '#1A1D26', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '14px 16px', zIndex: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#475569' }}>Electrical</span>
              <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 6, padding: '3px 8px', background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>In Progress</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#E2E8F0', marginBottom: 8 }}>Fan not working, Rm 214</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ flex: 1, background: 'rgba(245,158,11,0.08)', borderRadius: 7, padding: '6px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2, fontWeight: 700 }}>Timer</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#F59E0B' }}>18h left</div>
              </div>
              <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 7, padding: '6px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2, fontWeight: 700 }}>Priority</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9' }}>Medium</div>
              </div>
            </div>
          </div>

          {/* Card C — AI triage */}
          {!showResolvedCard && (
            <div style={{ position: 'absolute', bottom: 56, left: 20, width: 240, background: '#1A1D26', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '14px 16px', zIndex: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(108,99,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a89fff" strokeWidth="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                </div>
                <span style={{ fontSize: 11, color: '#a89fff', fontWeight: 700, letterSpacing: '0.04em' }}>AI Triage</span>
              </div>
              <div style={{ fontSize: 12, color: '#64748B', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{aiText}</div>
              <span style={{ display: 'inline-block', width: 2, height: 12, background: '#6C63FF', borderRadius: 1, verticalAlign: 'middle', animation: 'fmhBlink 0.85s infinite' }} />
            </div>
          )}

          {/* Resolved confirmation card */}
          <div style={{
            position: 'absolute', bottom: 56, left: 20, width: 240,
            background: '#1A1D26', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '14px 16px',
            opacity: showResolvedCard ? 1 : 0,
            transform: showResolvedCard ? 'translateY(0)' : 'translateY(10px)',
            transition: 'opacity 0.5s, transform 0.5s',
            zIndex: 3, pointerEvents: 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#F1F5F9' }}>Resolved in 14h 22m</div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>Plumbing · Block B · just now</div>
              </div>
            </div>
          </div>

          {/* Cluster alert */}
          <div style={{ position: 'absolute', bottom: 16, right: 16, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, padding: '7px 12px', fontSize: 11, color: '#F59E0B', fontWeight: 700 }}>
            ⚡ 4 plumbing issues · Block B
          </div>

          {/* Ghost cursor */}
          <div style={{
            position: 'absolute', zIndex: 30, pointerEvents: 'none',
            left: cursorPos.x, top: cursorPos.y,
            transform: `scale(${cursorScale})`,
            transition: 'left 0.65s cubic-bezier(0.4,0,0.2,1), top 0.65s cubic-bezier(0.4,0,0.2,1), transform 0.15s',
          }}>
            <svg width="18" height="22" viewBox="0 0 20 24" fill="none">
              <path d="M3 2L17 11L10 13L13 21L10 22L7 14L2 17L3 2Z" fill="rgba(255,255,255,0.92)" stroke="#6C63FF" strokeWidth="1.2" />
            </svg>
          </div>

          {/* Resolve flash overlay */}
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(16,185,129,0.08)',
            opacity: showFlash ? 1 : 0, pointerEvents: 'none', zIndex: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'opacity 0.3s',
          }}>
            <div style={{
              background: '#10B981', color: '#fff', fontSize: 13, fontWeight: 700,
              padding: '10px 20px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8,
              fontFamily: 'inherit',
              transform: showFlash ? 'scale(1)' : 'scale(0.8)', transition: 'transform 0.35s',
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
              Complaint Resolved!
            </div>
          </div>

          {/* Confetti canvas */}
          <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, zIndex: 25, pointerEvents: 'none' }} />
        </div>
      </div>

      {/* Feature strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {[
          { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a89fff" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>, color: 'rgba(108,99,255,0.15)', label: 'AI auto-triage', sub: 'Auto-categorizes every complaint' },
          { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>, color: 'rgba(239,68,68,0.15)', label: 'Timer breach alerts', sub: 'Fires before deadlines are missed' },
          { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><path d="m13 2-2 2.5h3L12 7" /><path d="M10 14 4 5.23A2 2 0 0 1 6 2h12a2 2 0 0 1 1.64 3.14L14 14" /><path d="M8 14v4a2 2 0 0 0 4 0v-4" /></svg>, color: 'rgba(245,158,11,0.15)', label: 'Cluster detection', sub: 'Spots repeat issues across floors' },
          { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg>, color: 'rgba(59,130,246,0.15)', label: 'Warden dashboard', sub: 'Analytics, 3D view & QR directory' },
        ].map(({ icon, color, label, sub }, i) => (
          <div key={label} style={{ padding: '18px 22px', borderRight: i < 3 ? '1px solid rgba(255,255,255,0.06)' : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', marginBottom: 1 }}>{label}</div>
              <div style={{ fontSize: 11, color: '#334155' }}>{sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Demo Modal */}
      <dialog
        id="fmh-demo-modal"
        style={{ padding: 0, border: 'none', background: 'transparent', outline: 'none', margin: 'auto' }}
        onClick={e => { if (e.target.id === 'fmh-demo-modal') e.target.close(); }}
      >
        <div style={{ background: '#1C1F27', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 32, width: 400, maxWidth: '90vw' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9', fontFamily: "'Sora', sans-serif" }}>PS-15 Demo Mode</div>
              <div style={{ fontSize: 12, color: '#475569', marginTop: 3 }}>Open both roles side by side</div>
            </div>
            <button onClick={() => document.getElementById('fmh-demo-modal').close()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 4, display: 'flex' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
          <DemoCardBody />
        </div>
      </dialog>

      <style>{`@keyframes fmhBlink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
    </div>
  );
}

function DemoCardBody() {
  const [loadingRole, setLoadingRole] = useState(null);
  const [error, setError] = useState('');
  const { setUserDoc } = useAuth();

  const handleDemoLogin = async (role) => {
    setLoadingRole(role);
    setError('');
    const email = role === 'student' ? 'demo.student@fixmyhostel.dev' : 'demo.warden@fixmyhostel.dev';
    const password = role === 'student' ? 'DemoStudent123' : 'DemoWarden123';
    try {
      await setPersistence(auth, browserSessionPersistence);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userSnap = await getDoc(doc(db, 'users', userCredential.user.uid));
      if (!userSnap.exists()) throw new Error('User document not found. Run the seed script first.');
      const uDoc = userSnap.data();
      setUserDoc(uDoc);
      window.open(uDoc.role === 'warden' ? '/warden/dashboard' : '/student/dashboard', '_blank');
      setTimeout(async () => { await auth.signOut(); setUserDoc(null); }, 5000);
    } catch (err) {
      console.error(err);
      setError(`Login failed: ${err.message}. Ensure seed script has been run.`);
    } finally {
      setLoadingRole(null);
    }
  };

  return (
    <div>
      <p style={{ fontSize: 13, color: '#64748B', marginBottom: 20, lineHeight: 1.6 }}>
        Experience the full platform instantly. Click a role to enter the populated demo environment.
      </p>
      <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 20, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <svg width="14" height="14" style={{ flexShrink: 0, marginTop: 1 }} viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
        <span style={{ fontSize: 12, color: '#64748B' }}>Each role opens in a new tab — open both to see real-time sync side by side.</span>
      </div>
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#ef4444' }}>{error}</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          onClick={() => handleDemoLogin('student')}
          disabled={loadingRole !== null}
          style={{ height: 48, borderRadius: 12, background: '#6C63FF', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: loadingRole ? 0.7 : 1 }}
        >
          {loadingRole === 'student' ? '…' : (<><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></svg>Enter as Student</>)}
        </button>
        <button
          onClick={() => handleDemoLogin('warden')}
          disabled={loadingRole !== null}
          style={{ height: 48, borderRadius: 12, background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: '#94A3B8', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: loadingRole ? 0.7 : 1 }}
        >
          {loadingRole === 'warden' ? '…' : (<><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>Enter as Warden</>)}
        </button>
      </div>
    </div>
  );
}
