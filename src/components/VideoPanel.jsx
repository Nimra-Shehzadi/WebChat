import { FiMic, FiMicOff, FiVideo, FiVideoOff } from 'react-icons/fi';

export default function VideoPanel({
  localRef,
  remoteRef,
  muted,
  videoOff,
  onToggleMute,
  onToggleVideo,
  status,
}) {
  return (
    <div className="video-panel">
      {/* Remote – large */}
      <div className="remote-wrap">
        <video
          ref={remoteRef}
          autoPlay
          playsInline
          className={`remote-video ${status !== 'connected' ? 'hidden' : ''}`}
        />
        {status !== 'connected' && (
          <div className="remote-placeholder">
            {status === 'searching' ? (
              <>
                <div className="spinner" />
                <p>Finding someone…</p>
              </>
            ) : status === 'camera-error' ? (
              <p>⚠ Camera / mic access required</p>
            ) : (
              <p>Start a chat to connect</p>
            )}
          </div>
        )}
      </div>

      {/* Self – PiP */}
      <div className="self-wrap">
        <video
          ref={localRef}
          autoPlay
          playsInline
          muted
          className={`self-video ${videoOff ? 'off' : ''}`}
        />
        {videoOff && <div className="video-off-overlay">📷 Off</div>}
      </div>

      {/* Controls */}
      <div className="video-controls">
        <button
          className={`vc-btn ${muted ? 'active' : ''}`}
          onClick={onToggleMute}
          title={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <FiMicOff /> : <FiMic />}
        </button>
        <button
          className={`vc-btn ${videoOff ? 'active' : ''}`}
          onClick={onToggleVideo}
          title={videoOff ? 'Camera on' : 'Camera off'}
        >
          {videoOff ? <FiVideoOff /> : <FiVideo />}
        </button>
      </div>
    </div>
  );
}
