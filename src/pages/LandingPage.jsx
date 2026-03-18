import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { searchHostels } from '../firebase/firestore';
import { useAuth } from '../context/AuthContext';

export default function LandingPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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
    // Store selection in sessionStorage so JoinHostel can pre-select it
    sessionStorage.setItem('selectedHostelId', hostelId);
    if (user) {
      navigate(`/student/join?hostelId=${hostelId}`);
    } else {
      navigate('/register?role=student');
    }
  };

  return (
    <div className="page">
      <Navbar />
      <section className="hero container">
        <div className="hero-badge">
          <span>🏠</span> MITAOE Hostel Management
        </div>
        <h1 className="hero-title">
          Your Hostel,<br />
          <span className="gradient-text">Managed Smart</span>
        </h1>
        <p className="hero-sub">
          Search for your hostel, join with your <strong>@mitaoe.ac.in</strong> email,
          and get settled in. Wardens can map entire hostel blocks with a few clicks.
        </p>

        <form className="search-bar" onSubmit={handleSearch} style={{ width: '100%' }}>
          <input
            className="search-input"
            type="text"
            placeholder="Search for your hostel (e.g. Boys Hostel A) …"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ borderRadius: 0 }}>
            {loading ? '…' : '🔍 Search'}
          </button>
        </form>

        {searched && results.length === 0 && (
          <p className="text-muted text-sm mt-2">
            No hostels found. Is your warden registered? Ask them to create your hostel first.
          </p>
        )}

        {results.length > 0 && (
          <div className="hostels-grid" style={{ maxWidth: 800 }}>
            {results.map((h) => (
              <div key={h.id} className="hostel-result-card">
                <h3>🏠 {h.name}</h3>
                <p>{h.collegeName}</p>
                <button className="btn btn-primary btn-sm w-full" onClick={() => handleJoin(h.id)}>
                  Join Hostel
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="hero-divider mt-3">— or —</div>
        <Link to="/register?role=warden" className="btn btn-outline">
          🔑 I'm a Warden — Register My Hostel
        </Link>
      </section>
    </div>
  );
}
