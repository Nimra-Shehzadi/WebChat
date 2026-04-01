import { useEffect, useRef, useState } from 'react';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { FiSend } from 'react-icons/fi';

export default function ChatSidebar({ sessionId, uid }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!sessionId) return;
    const q = query(
      collection(db, 'sessions', sessionId, 'messages'),
      orderBy('timestamp', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    const trimmed = text.trim();
    if (!trimmed || !sessionId) return;
    setText('');
    await addDoc(collection(db, 'sessions', sessionId, 'messages'), {
      sender: uid,
      text: trimmed,
      timestamp: serverTimestamp(),
    });
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <aside className="chat-sidebar">
      <div className="chat-header">Chat</div>
      <div className="chat-messages">
        {!sessionId && (
          <p className="chat-hint">Connect with someone to start chatting…</p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`chat-msg ${msg.sender === uid ? 'mine' : 'theirs'}`}
          >
            <span className="bubble">{msg.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="chat-input-row">
        <input
          type="text"
          placeholder="Type a message…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKey}
          disabled={!sessionId}
        />
        <button onClick={send} disabled={!sessionId || !text.trim()}>
          <FiSend />
        </button>
      </div>
    </aside>
  );
}
