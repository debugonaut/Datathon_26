import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { checkPRNExists } from '../../firebase/firestore';

const BRANCHES = [
  'Computer Engineering',
  'Computer Engineering (Software Engineering)',
  'Computer Engineering (AIML)',
  'Computer Engineering (DS)',
  'ENTC',
  'Chemical',
  'Civil',
  'Mechanical',
  'Design',
];

export default function ProfileSetup() {
  const { user, setUserDoc } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.displayName || '');
  const [prn, setPrn] = useState('');
  const [branch, setBranch] = useState('');
  const [year, setYear] = useState('');
  const [error, setError] = useState('');
  const [prnError, setPrnError] = useState('');
  const [loading, setLoading] = useState(false);
  const [prnChecking, setPrnChecking] = useState(false);

  const emailPRN = user?.email?.split('@')[0] || '';

  // ── PRN Validation Pipeline ──────────────────────────────────────────────────
  const validatePRN = useCallback((value) => {
    // Step 1: Strip non-digits
    const stripped = value.replace(/\D/g, '');
    if (stripped !== value) {
      setPrnError('PRN must contain only numbers.');
      return false;
    }
    // Step 2: Exactly 12 digits (only enforce on blur/submit)
    if (stripped.length > 0 && stripped.length !== 12) {
      setPrnError(`PRN must be exactly 12 digits. Currently ${stripped.length}/12.`);
      return false;
    }
    if (stripped.length === 0) {
      setPrnError('');
      return false;
    }
    // Step 3: Cannot start with 0
    if (stripped.startsWith('0')) {
      setPrnError('Invalid PRN format.');
      return false;
    }
    // Step 4: Cross-check against email
    if (stripped !== emailPRN) {
      setPrnError('PRN does not match your college email address. Please enter the PRN from your email ID.');
      return false;
    }
    setPrnError('');
    return true;
  }, [emailPRN]);

  const handlePRNChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 12);
    setPrn(val);
    // Live validation (basic checks only during typing)
    if (val.length === 0) { setPrnError(''); return; }
    if (val.replace(/\D/g, '') !== val) { setPrnError('PRN must contain only numbers.'); return; }
    if (val.startsWith('0')) { setPrnError('Invalid PRN format.'); return; }
    if (val.length === 12 && val !== emailPRN) {
      setPrnError('PRN does not match your college email address. Please enter the PRN from your email ID.');
      return;
    }
    if (val.length < 12) {
      setPrnError('');
      return;
    }
    setPrnError('');
  };

  const handlePRNBlur = () => {
    if (prn.length > 0) validatePRN(prn);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Full validation pipeline
    if (!name.trim()) { setError('Please enter your full name.'); return; }
    if (!validatePRN(prn)) return;
    if (!branch) { setError('Please select your branch.'); return; }
    if (!year) { setError('Please select your year.'); return; }

    setLoading(true);

    try {
      // Step 5: Firestore uniqueness check
      setPrnChecking(true);
      const exists = await checkPRNExists(prn);
      setPrnChecking(false);
      if (exists) {
        setPrnError('This PRN is already registered. Contact your warden if this is an error.');
        setLoading(false);
        return;
      }

      const userData = {
        uid: user.uid,
        name: name.trim(),
        PRN: prn,
        email: user.email,
        branch,
        year,
        isProfileComplete: true,
        isRegistered: false,
        roomId: null,
        hostelId: null,
        role: 'student',
        createdAt: serverTimestamp()
      };

      await setDoc(doc(db, 'users', user.uid), userData, { merge: true });
      setUserDoc({ ...userData, createdAt: new Date() });

      // Check for pending room
      const pending = localStorage.getItem('pendingRoomId');
      if (pending) {
        navigate(`/student/room-register?prefill=${pending}`, { replace: true });
      } else {
        navigate('/student/room-register', { replace: true });
      }
    } catch (err) {
      console.error(err);
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const isFormValid = name.trim() && prn.length === 12 && !prnError && branch && year;

  return (
    <div className="page">
      <Navbar />
      <div className="center-page" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
        <div className="auth-card animation-fade-in" style={{ maxWidth: 480 }}>
          <div style={{ fontSize: '2.5rem', textAlign: 'center', marginBottom: '0.5rem' }}>🎓</div>
          <h1 className="auth-title">Complete Your Profile</h1>
          <p className="auth-subtitle mb-3">One-time setup before you can join your room.</p>

          {error && <div className="form-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            {/* Full Name */}
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                className="form-input"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your full name"
                required
              />
            </div>

            {/* PRN */}
            <div className="form-group">
              <label className="form-label">
                PRN (Permanent Registration Number)
                <span className="text-muted text-sm" style={{ marginLeft: '0.5rem' }}>
                  {prn.length}/12 digits
                </span>
              </label>
              <input
                className="form-input"
                type="text"
                inputMode="numeric"
                maxLength={12}
                value={prn}
                onChange={handlePRNChange}
                onBlur={handlePRNBlur}
                placeholder="e.g. 211090100001"
                required
                style={prnError ? { borderColor: '#ef4444' } : {}}
              />
              {prnError && <p className="text-sm mt-1" style={{ color: '#ef4444' }}>{prnError}</p>}
              {prnChecking && <p className="text-sm mt-1 text-muted">Checking uniqueness...</p>}
            </div>

            {/* Email (locked) */}
            <div className="form-group">
              <label className="form-label">College Email</label>
              <input
                className="form-input"
                type="email"
                value={user?.email || ''}
                disabled
                style={{ opacity: 0.6, cursor: 'not-allowed' }}
              />
              <p className="text-sm text-muted mt-1">Verified via Google OAuth. Cannot be changed.</p>
            </div>

            {/* Branch */}
            <div className="form-group">
              <label className="form-label">Branch</label>
              <select
                className="form-input"
                value={branch}
                onChange={e => setBranch(e.target.value)}
                required
              >
                <option value="">Select your branch</option>
                {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            {/* Year */}
            <div className="form-group">
              <label className="form-label mb-1">Year</label>
              <div className="flex gap-1">
                {['1st', '2nd', '3rd', '4th'].map(y => (
                  <button
                    type="button"
                    key={y}
                    className={`btn btn-sm ${year === y ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setYear(y)}
                    style={{ flex: 1 }}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>

            <button
              className="btn btn-primary btn-full mt-2"
              type="submit"
              disabled={!isFormValid || loading}
              style={{ padding: '1rem' }}
            >
              {loading ? 'Saving Profile...' : 'Continue to Room Registration →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
