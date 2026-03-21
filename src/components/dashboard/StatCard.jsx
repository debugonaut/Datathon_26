import React from 'react';

/**
 * StatCard for KPIs
 * Top row of the dashboard
 */
export default function StatCard({ title, value, delta, isPositive, metricLabel }) {
  return (
    <div 
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        transition: 'all 0.2s ease',
        cursor: 'default'
      }}
      className="dash-stat-card"
    >
      <div style={{
        color: 'var(--text-muted)',
        fontSize: '0.7rem',
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        fontFamily: 'var(--font-heading)',
        marginBottom: '0.5rem'
      }}>
        {title}
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '2.4rem',
        color: 'var(--text-primary)',
        fontWeight: '600',
        lineHeight: '1.2'
      }}>
        {value}
      </div>
      
      {/* Delta Badge */}
      <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{
          padding: '2px 8px',
          borderRadius: '999px', /* Allowed pill shape for badges */
          fontSize: '0.75rem',
          fontFamily: 'var(--font-mono)',
          fontWeight: '600',
          backgroundColor: isPositive ? 'rgba(34, 211, 160, 0.15)' : 'rgba(240, 101, 101, 0.15)',
          color: isPositive ? 'var(--accent-green)' : 'var(--accent-red)'
        }}>
          {isPositive ? '+' : ''}{delta}%
        </span>
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
          {metricLabel}
        </span>
      </div>
    </div>
  );
}
