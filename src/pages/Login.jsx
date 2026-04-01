import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { signInWithGoogle } from '../firebase';
import { FiLogIn } from 'react-icons/fi';

export default function Login() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser) navigate('/chat');
  }, [currentUser, navigate]);

  async function handleLogin() {
    try {
      await signInWithGoogle();
      navigate('/chat');
    } catch (err) {
      console.error('Login failed:', err);
    }
  }

  return (
    <div className="login-bg">
      <div className="login-card">
        <h2>Sign in to WebChat</h2>
        <p>Use your Google account to access all features.</p>
        <button className="google-btn" onClick={handleLogin}>
          <FiLogIn />
          Continue with Google
        </button>
      </div>
    </div>
  );
}
