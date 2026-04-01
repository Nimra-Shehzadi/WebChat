import { useEffect, useRef, useState, useMemo } from 'react';
import SimplePeer from 'simple-peer';
import { useNavigate } from 'react-router-dom';
import {
  doc,
  setDoc,
  onSnapshot,
  deleteDoc,
  serverTimestamp,
  updateDoc,
  arrayUnion,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import {
  joinPool,
  leavePool,
  markBusy,
  findMatch,
  findFilteredMatch,
} from '../utils/matching';
import VideoPanel from '../components/VideoPanel';
import ChatSidebar from '../components/ChatSidebar';
import FilterMenu from '../components/FilterMenu';
import { FiSkipForward, FiBookmark, FiSliders } from 'react-icons/fi';

// STUN + TURN servers — TURN is required for cross-internet connections
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
};

export default function ChatRoom() {
  const { currentUser, isSubscriber } = useAuth();
  const navigate = useNavigate();

  // Stable uid — never changes during this session
  const uid = useMemo(() => {
    if (currentUser?.uid) return currentUser.uid;
    let anonId = sessionStorage.getItem('webchat_anon_uid');
    if (!anonId) {
      anonId = `anon_${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem('webchat_anon_uid', anonId);
    }
    return anonId;
  }, [currentUser]);

  // Profile from session
  const profile = useMemo(
    () => JSON.parse(sessionStorage.getItem('webchat_profile') || '{}'),
    []
  );

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const sessionIdRef = useRef(null);
  const signalUnsubRef = useRef(null);
  const retryTimerRef = useRef(null);
  const isMountedRef = useRef(true);

  const [status, setStatus] = useState('idle');
  const [debugMsg, setDebugMsg] = useState('Starting…');
  const [remoteUser, setRemoteUser] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [showFilter, setShowFilter] = useState(false);
  const [filter, setFilter] = useState({ gender: 'Any', country: 'Any' });
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [saved, setSaved] = useState(false);
  const [cameraErrorMsg, setCameraErrorMsg] = useState('');

  useEffect(() => {
    if (!profile.name) { navigate('/'); return; }
    isMountedRef.current = true;
    startCamera();
    return () => {
      isMountedRef.current = false;
      clearTimeout(retryTimerRef.current);
      destroyPeer();
      leavePool(uid);
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // ── Camera ──────────────────────────────────────────────────────────────────
  async function startCamera() {
    setCameraErrorMsg('');
    setDebugMsg('Requesting camera & mic…');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      setDebugMsg('Camera ready. Joining pool…');
      enterPool();
    } catch (err) {
      console.error('[CAM]', err.name, err.message);
      const msgs = {
        NotAllowedError: 'Permission denied — allow camera & mic then click Retry.',
        NotFoundError: 'No camera/mic found — plug one in then click Retry.',
        NotReadableError: 'Camera in use by another app — close it then click Retry.',
      };
      setCameraErrorMsg(msgs[err.name] || `Error: ${err.message}`);
      setStatus('camera-error');
    }
  }

  // ── Pool + Matching ─────────────────────────────────────────────────────────
  async function enterPool() {
    if (!isMountedRef.current) return;
    setStatus('searching');
    setSaved(false);
    setRemoteUser(null);
    destroyPeer();

    setDebugMsg('Joining matching pool…');
    try {
      await joinPool(uid, {
        name: profile.name,
        gender: profile.gender,
        country: profile.country,
        isSubscriber,
        peerId: uid,
      });
      setDebugMsg('In pool. Looking for a match…');
      console.log('[POOL] Joined as', uid);
    } catch (e) {
      console.error('[POOL] join error:', e);
      setDebugMsg('Error joining pool: ' + e.message);
    }
    doSearch();
  }

  async function doSearch() {
    if (!isMountedRef.current) return;
    try {
      const match = isSubscriber
        ? await findFilteredMatch(uid, filter.gender, filter.country)
        : await findMatch(uid);

      if (!match) {
        setDebugMsg('No one found yet — retrying in 3s…');
        retryTimerRef.current = setTimeout(doSearch, 3000);
        return;
      }

      if (!isMountedRef.current) return;
      console.log('[MATCH] Found:', match.id);
      setDebugMsg(`Matched with ${match.name}! Setting up call…`);
      setRemoteUser(match);

      const sid = [uid, match.id].sort().join('__');
      sessionIdRef.current = sid;
      setSessionId(sid);
      const isInitiator = uid < match.id;

      await markBusy(uid);
      await markBusy(match.id);

      console.log('[PEER] Creating peer. Initiator:', isInitiator);
      setDebugMsg(`Connecting… (${isInitiator ? 'caller' : 'receiver'})`);
      createPeer(isInitiator, sid);
    } catch (e) {
      console.error('[SEARCH] error:', e);
      retryTimerRef.current = setTimeout(doSearch, 3000);
    }
  }

  // ── WebRTC ──────────────────────────────────────────────────────────────────
  function createPeer(isInitiator, sid) {
    const peer = new SimplePeer({
      initiator: isInitiator,
      trickle: true,
      stream: localStreamRef.current,
      config: ICE_SERVERS,
    });
    peerRef.current = peer;

    peer.on('signal', async (data) => {
      const role = isInitiator ? 'offer' : 'answer';
      console.log('[SIGNAL] Sending', role);
      try {
        await setDoc(
          doc(db, 'sessions', sid, 'signals', role),
          { 
            signals: arrayUnion(JSON.stringify(data)),
            ts: serverTimestamp(),
          },
          { merge: true }
        );
        console.log('[SIGNAL] Wrote', role, 'to Firestore');
      } catch (e) {
        console.error('[SIGNAL] Write error:', e);
        setDebugMsg('Signal write error: ' + e.message);
      }
    });

    peer.on('stream', (stream) => {
      console.log('[PEER] Got remote stream!');
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
      if (isMountedRef.current) {
        setStatus('connected');
        setDebugMsg('Connected!');
      }
    });

    peer.on('connect', () => {
      console.log('[PEER] Data channel connected');
      setDebugMsg('Peer data connected…');
    });

    peer.on('error', (err) => {
      console.error('[PEER] Error:', err);
      setDebugMsg('Peer error — retrying… (' + err.message + ')');
      if (isMountedRef.current) enterPool();
    });

    peer.on('close', () => {
      console.log('[PEER] Closed');
      if (isMountedRef.current && status !== 'connected') {
        setDebugMsg('Connection closed — retrying…');
        enterPool();
      }
    });

    // Listen for the remote signal
    const listenFor = isInitiator ? 'answer' : 'offer';
    const signalRef = doc(db, 'sessions', sid, 'signals', listenFor);
    console.log('[SIGNAL] Listening for', listenFor);

    let processedSignals = 0;
    const unsub = onSnapshot(signalRef, (snap) => {
      if (snap.exists() && peerRef.current && !peerRef.current.destroyed) {
        console.log('[SIGNAL] Received', listenFor);
        const signals = snap.data().signals || [];
        for (let i = processedSignals; i < signals.length; i++) {
          try {
            peerRef.current.signal(JSON.parse(signals[i]));
          } catch (e) {
            console.error('[SIGNAL] Signal error:', e);
          }
        }
        processedSignals = signals.length;
      }
    }, (err) => {
      console.error('[SIGNAL] Snapshot error:', err);
      setDebugMsg('Firestore listen error: ' + err.message);
    });
    signalUnsubRef.current = unsub;
  }

  function destroyPeer() {
    signalUnsubRef.current?.();
    signalUnsubRef.current = null;
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
  }

  async function handleNext() {
    clearTimeout(retryTimerRef.current);
    if (sessionIdRef.current) {
      const sid = sessionIdRef.current;
      deleteDoc(doc(db, 'sessions', sid, 'signals', 'offer')).catch(() => {});
      deleteDoc(doc(db, 'sessions', sid, 'signals', 'answer')).catch(() => {});
      sessionIdRef.current = null;
    }
    enterPool();
  }

  async function handleSave() {
    if (!remoteUser) return;
    if (currentUser) {
      updateDoc(doc(db, 'users', uid), {
        savedConnections: [remoteUser.id],
      }).catch(() => {});
    } else {
      const existing = JSON.parse(localStorage.getItem('webchat_saved') || '[]');
      if (!existing.includes(remoteUser.id)) {
        localStorage.setItem('webchat_saved', JSON.stringify([...existing, remoteUser.id]));
      }
    }
    setSaved(true);
  }

  function toggleMute() {
    localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !t.enabled; });
    setMuted((m) => !m);
  }

  function toggleVideo() {
    localStreamRef.current?.getVideoTracks().forEach((t) => { t.enabled = !t.enabled; });
    setVideoOff((v) => !v);
  }

  if (!profile.name) return null;

  return (
    <div className="chatroom">
      <header className="chatroom-header">
        <span className="logo-sm">💬 WebChat</span>
        <span className={`status-pill ${status}`}>
          {status === 'searching' && '🔍 Finding someone…'}
          {status === 'connected' && `✓ Connected to ${remoteUser?.name || 'Stranger'}`}
          {status === 'idle' && '⏸ Idle'}
          {status === 'camera-error' && '⚠ Camera / Mic Error'}
        </span>
        {status === 'camera-error' && (
          <button className="retry-cam-btn" onClick={startCamera}>🔄 Retry Camera</button>
        )}
        <div className="header-actions">
          {isSubscriber && (
            <button className="icon-btn" title="Filters" onClick={() => setShowFilter((s) => !s)}>
              <FiSliders />
            </button>
          )}
        </div>
      </header>

      {/* Debug bar — shows real-time status */}
      <div className="debug-bar">
        🛠 {debugMsg} {cameraErrorMsg && <span className="debug-err"> | {cameraErrorMsg}</span>}
      </div>

      {showFilter && isSubscriber && (
        <FilterMenu filter={filter} onChange={setFilter} />
      )}

      <main className="chatroom-main">
        <VideoPanel
          localRef={localVideoRef}
          remoteRef={remoteVideoRef}
          muted={muted}
          videoOff={videoOff}
          onToggleMute={toggleMute}
          onToggleVideo={toggleVideo}
          status={status}
        />
        <ChatSidebar sessionId={sessionId} uid={uid} />
      </main>

      <footer className="chatroom-footer">
        <button className="btn-next" onClick={handleNext}>
          <FiSkipForward /> Next
        </button>
        <button
          className={`btn-save ${saved ? 'saved' : ''}`}
          onClick={handleSave}
          disabled={!remoteUser || saved}
        >
          <FiBookmark /> {saved ? 'Saved!' : 'Save Connection'}
        </button>
      </footer>
    </div>
  );
}
