import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('fmh-theme');
    return saved ? saved === 'dark' : true;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('fmh-theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <button
      onClick={() => setDark(d => !d)}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        width: 52, height: 28, borderRadius: 14, border: '1px solid var(--border)',
        background: dark ? '#1C1F27' : '#E2E8F0',
        cursor: 'pointer', position: 'relative', flexShrink: 0,
        transition: 'background 0.25s ease, border-color 0.25s ease',
        display: 'flex', alignItems: 'center', padding: '0 4px',
      }}
    >
      {/* Track icons */}
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ position: 'absolute', left: 5, opacity: dark ? 0.3 : 1, transition: 'opacity 0.25s' }}>
        <circle cx="12" cy="12" r="5" fill={dark ? '#94A3B8' : '#F59E0B'} />
        <g stroke={dark ? '#94A3B8' : '#F59E0B'} strokeWidth="2" strokeLinecap="round">
          <line x1="12" y1="2" x2="12" y2="4" />
          <line x1="12" y1="20" x2="12" y2="22" />
          <line x1="2" y1="12" x2="4" y2="12" />
          <line x1="20" y1="12" x2="22" y2="12" />
          <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" />
          <line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
          <line x1="4.93" y1="19.07" x2="6.34" y2="17.66" />
          <line x1="17.66" y1="6.34" x2="19.07" y2="4.93" />
        </g>
      </svg>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ position: 'absolute', right: 5, opacity: dark ? 1 : 0.3, transition: 'opacity 0.25s' }}>
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill={dark ? '#6C63FF' : '#94A3B8'} />
      </svg>
      {/* Pill knob */}
      <div style={{
        width: 20, height: 20, borderRadius: '50%',
        background: dark ? '#6C63FF' : '#fff',
        boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
        transform: dark ? 'translateX(24px)' : 'translateX(0px)',
        transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1), background 0.25s ease',
        flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }} />
    </button>
  );
}