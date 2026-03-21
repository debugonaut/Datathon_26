import React, { useState } from 'react';
import StatCard from './StatCard';
import { LayoutGrid, Maximize, ArrowLeft, ArrowRight } from 'lucide-react';
import { LineChartOverview, BarChartPeakHours, DonutChartCategories, RadarChartStatus } from './Charts';
import ComplaintTimeline from './ComplaintTimeline';

export default function AnalyticsDashboard() {
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'focus'
  const [focusIndex, setFocusIndex] = useState(0);

  const charts = [
    { component: <LineChartOverview />, id: 'trends' },
    { component: <BarChartPeakHours />, id: 'peak' },
    { component: <DonutChartCategories />, id: 'categories' },
    { component: <RadarChartStatus />, id: 'status' }
  ];

  const handleFocusNext = () => setFocusIndex((i) => (i + 1) % charts.length);
  const handleFocusPrev = () => setFocusIndex((i) => (i - 1 + charts.length) % charts.length);

  return (
    <div style={{ padding: '0 0 2rem 0', fontFamily: 'var(--font-primary)' }}>
      {/* Top Header & Toggles */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '2rem' 
      }}>
        <h2 style={{ 
          margin: 0, 
          fontFamily: 'var(--font-heading)', 
          fontSize: '1.5rem', 
          fontWeight: '600', 
          letterSpacing: '-0.02em',
          color: 'var(--text-primary)'
        }}>
          Analytics Overview
        </h2>
        
        {/* Toggle View Mode */}
        <div style={{
          display: 'flex',
          background: 'var(--surface-raised)',
          padding: '4px',
          borderRadius: '999px',
          border: '1px solid var(--border)'
        }}>
          <button
            onClick={() => setViewMode('grid')}
            style={{
              background: viewMode === 'grid' ? 'var(--bg)' : 'transparent',
              border: 'none',
              borderRadius: '999px',
              padding: '6px 12px',
              color: viewMode === 'grid' ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem',
              fontWeight: 500,
              boxShadow: viewMode === 'grid' ? '0 0 0 1px var(--border)' : 'none',
              transition: 'all 0.2s ease',
              position: 'relative'
            }}
          >
            <LayoutGrid size={16} /> Grid
            {viewMode === 'grid' && (
              <div style={{
                position: 'absolute', bottom: '-4px', left: '15%', right: '15%', height: '2px',
                background: 'var(--accent-primary)',
                borderRadius: '2px',
                boxShadow: '0 0 8px var(--accent-primary)'
              }} />
            )}
          </button>
          
          <button
            onClick={() => setViewMode('focus')}
            style={{
              background: viewMode === 'focus' ? 'var(--bg)' : 'transparent',
              border: 'none',
              borderRadius: '999px',
              padding: '6px 12px',
              color: viewMode === 'focus' ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem',
              fontWeight: 500,
              boxShadow: viewMode === 'focus' ? '0 0 0 1px var(--border)' : 'none',
              transition: 'all 0.2s ease',
              position: 'relative'
            }}
          >
            <Maximize size={16} /> Focus
            {viewMode === 'focus' && (
              <div style={{
                position: 'absolute', bottom: '-4px', left: '15%', right: '15%', height: '2px',
                background: 'var(--accent-primary)',
                borderRadius: '2px',
                boxShadow: '0 0 8px var(--accent-primary)'
              }} />
            )}
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '24px',
        marginBottom: '2rem'
      }}>
        <StatCard title="Complaint Volume" value="142" delta={14.5} isPositive={true} metricLabel="vs last month" />
        <StatCard title="Resolution Rate" value="94.2%" delta={3.1} isPositive={true} metricLabel="vs last month" />
        <StatCard title="High Priority" value="12" delta={-2} isPositive={false} metricLabel="vs last week" />
        <StatCard title="Avg. Time" value="4h 12m" delta={-18} isPositive={true} metricLabel="vs last month" />
      </div>

      {/* Main Content Area: Charts + Timeline */}
      <div style={{ display: 'flex', gap: '24px', flexDirection: 'row', flexWrap: 'wrap' }}>
        
        {/* Charts Section */}
        <div style={{ flex: 1, minWidth: '60%' }}>
          {viewMode === 'grid' ? (
            /* GRID VIEW */
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '24px'
            }}>
              {charts.map((curr) => (
                <div key={curr.id}>{curr.component}</div>
              ))}
            </div>
          ) : (
            /* FOCUS VIEW */
            <div style={{ position: 'relative', width: '100%', height: '70vh', background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
              
              {/* Controls */}
              <button onClick={handleFocusPrev} style={{
                position: 'absolute', top: '50%', left: '16px', transform: 'translateY(-50%)', zIndex: 10,
                background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(8px)', border: '1px solid var(--border)', borderRadius: '50%', width: '48px', height: '48px',
                color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
                opacity: 0.5
              }} className="hover-focus-btn">
                <ArrowLeft size={24} />
              </button>
              
              <button onClick={handleFocusNext} style={{
                position: 'absolute', top: '50%', right: '16px', transform: 'translateY(-50%)', zIndex: 10,
                background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(8px)', border: '1px solid var(--border)', borderRadius: '50%', width: '48px', height: '48px',
                color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
                opacity: 0.5
              }} className="hover-focus-btn">
                <ArrowRight size={24} />
              </button>

              <div style={{ width: '100%', height: '100%', padding: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ width: '100%', maxWidth: '800px', height: '100%', animation: 'fadeIn 0.3s ease-in-out' }}>
                  {charts[focusIndex].component}
                </div>
              </div>

              {/* Dots */}
              <div style={{ position: 'absolute', bottom: '24px', left: '0', right: '0', display: 'flex', justifyContent: 'center', gap: '8px' }}>
                {charts.map((_, i) => (
                  <div key={i} style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: i === focusIndex ? 'var(--accent-primary)' : 'var(--text-muted)',
                    transition: 'all 0.3s ease'
                  }} />
                ))}
              </div>

            </div>
          )}
        </div>

        {/* Sidebar: Timeline */}
        <div style={{ width: '320px', flexShrink: 0 }}>
          <ComplaintTimeline />
        </div>

      </div>
    </div>
  );
}
