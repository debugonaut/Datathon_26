import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    return (localStorage.getItem('fmh-theme') || 'dark') === 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('fmh-theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <button
      onClick={() => setDark(d => !d)}
      title={dark ? 'Switch to light' : 'Switch to dark'}
      style={{
        position: 'relative',
        width: 52,
        height: 28,
        borderRadius: 999,
        border: '1px solid var(--border-strong)',
        background: dark ? '#1e2230' : '#e2e8f0',
        cursor: 'pointer',
        padding: 0,
        transition: 'background 0.25s, border-color 0.25s',
        flexShrink: 0,
      }}
    >
      {/* Track icons */}
      <span style={{
        position: 'absolute',
        left: 7,
        top: '50%',
        transform: 'translateY(-50%)',
        fontSize: 11,
        opacity: dark ? 0 : 1,
        transition: 'opacity 0.2s',
        lineHeight: 1,
        pointerEvents: 'none',
      }}>
        {/* Sun */}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="2" x2="12" y2="4"/>
          <line x1="12" y1="20" x2="12" y2="22"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="2" y1="12" x2="4" y2="12"/>
          <line x1="20" y1="12" x2="22" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      </span>

      <span style={{
        position: 'absolute',
        right: 7,
        top: '50%',
        transform: 'translateY(-50%)',
        fontSize: 11,
        opacity: dark ? 1 : 0,
        transition: 'opacity 0.2s',
        lineHeight: 1,
        pointerEvents: 'none',
      }}>
        {/* Moon */}
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      </span>

      {/* Sliding thumb */}
      <span style={{
        position: 'absolute',
        top: 3,
        left: dark ? 27 : 3,
        width: 20,
        height: 20,
        borderRadius: '50%',
        background: dark ? '#6C63FF' : '#fff',
        boxShadow: dark ? '0 0 6px rgba(108,99,255,0.5)' : '0 1px 4px rgba(0,0,0,0.15)',
        transition: 'left 0.25s cubic-bezier(0.4,0,0.2,1), background 0.25s, box-shadow 0.25s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }} />
    </button>
  );
}