import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { signInWithGoogle, signOutUser } from '../firebase';
import { FiMapPin, FiUser, FiLogIn, FiLogOut } from 'react-icons/fi';

const REVERSE_GEO_URL =
  'https://api.bigdatacloud.net/data/reverse-geocode-client';

export default function Onboarding() {
  const { currentUser, isSubscriber } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [gender, setGender] = useState('');
  const [country, setCountry] = useState('');
  const [geoError, setGeoError] = useState('');
  const [locLoading, setLocLoading] = useState(false);

  const canStart = name.trim() && gender && country && !geoError;

  useEffect(() => {
    detectLocation();
  }, []);

  async function detectLocation() {
    setLocLoading(true);
    setGeoError('');
    if (!navigator.geolocation) {
      setGeoError('Geolocation not supported by your browser.');
      setLocLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `${REVERSE_GEO_URL}?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&localityLanguage=en`
          );
          const data = await res.json();
          setCountry(data.countryName || 'Unknown');
        } catch {
          setGeoError('Could not detect country. Please allow location access.');
        } finally {
          setLocLoading(false);
        }
      },
      () => {
        setGeoError('Location permission denied. Please allow to continue.');
        setLocLoading(false);
      }
    );
  }

  function handleStart() {
    if (!canStart) return;
    const profile = { name: name.trim(), gender, country, isSubscriber };
    sessionStorage.setItem('webchat_profile', JSON.stringify(profile));
    navigate('/chat');
  }

  async function handleGoogleAuth() {
    if (currentUser) {
      await signOutUser();
    } else {
      await signInWithGoogle();
    }
  }

  return (
    <div className="onboarding-bg">
      <div className="onboarding-card">
        {/* Logo / Brand */}
        <div className="brand">
          <span className="brand-icon">💬</span>
          <h1 className="brand-name">WebChat</h1>
          <p className="brand-tagline">Meet people from around the world</p>
        </div>

        {/* Auth strip */}
        <button className="auth-btn" onClick={handleGoogleAuth}>
          {currentUser ? (
            <>
              <FiLogOut />
              <span>Sign out ({currentUser.displayName?.split(' ')[0]})</span>
              {isSubscriber && <span className="badge">PRO</span>}
            </>
          ) : (
            <>
              <FiLogIn />
              <span>Sign in with Google</span>
            </>
          )}
        </button>

        {/* Form */}
        <div className="form-group">
          <label htmlFor="ob-name">Your name</label>
          <div className="input-wrap">
            <FiUser className="input-icon" />
            <input
              id="ob-name"
              type="text"
              placeholder="Enter your name…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={32}
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="ob-gender">Gender</label>
          <select
            id="ob-gender"
            value={gender}
            onChange={(e) => setGender(e.target.value)}
          >
            <option value="">Select gender…</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="ob-country">Location (auto-detected)</label>
          <div className="input-wrap location-input">
            <FiMapPin className="input-icon" />
            <input
              id="ob-country"
              type="text"
              value={locLoading ? 'Detecting…' : country}
              readOnly
              className="locked"
              placeholder="Waiting for location permission…"
            />
            {geoError && (
              <button className="retry-btn" onClick={detectLocation}>
                Retry
              </button>
            )}
          </div>
          {geoError && <p className="geo-error">{geoError}</p>}
        </div>

        <button
          className="start-btn"
          disabled={!canStart}
          onClick={handleStart}
        >
          {canStart ? 'Start Chatting →' : 'Fill in all fields to continue'}
        </button>

        <p className="disclaimer">
          By continuing you agree to our community guidelines. Be respectful.
        </p>
      </div>
    </div>
  );
}
