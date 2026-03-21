import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

const saved = localStorage.getItem('fmh-theme') || 'dark';
document.documentElement.setAttribute('data-theme', saved);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
