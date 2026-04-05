import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import EyeBackground from '../components/EyeBackground';
import { uploadFile } from '../utils/uploadFile';
import UserProfile from './UserProfile';
import CallModal from '../components/CallModal';
import { IconPhone, IconVideoCall, IconAttach, IconSend } from '../components/Icons';

const API = 'https://void-messenger.online';

interface Message {
  from: string;
  to: string;
  content: string;
}

interface User {
  id: number;
  username: string;
  tag: string;
  avatar?: string;
  aura_color?: string;
  aura_style?: string;
}

const Avatar = ({ user, size = 34, showOnline, isOnline }: {
  user: User, size?: number, showOnline?: boolean, isOnline?: boolean
}) => {
  const auraColor = user.aura_color || '#7850ff';
  const auraStyle = user.aura_style || 'solid';

  const getAura = () => {
    switch (auraStyle) {
      case 'pulse': return { boxShadow: `0 0 0 3px ${auraColor}60` };
      case 'neon': return { boxShadow: `0 0 8px 2px ${auraColor}, 0 0 16px 4px ${auraColor}40` };
      case 'rainbow': return { outline: '3px solid transparent', backgroundClip: 'padding-box' };
      default: return { boxShadow: `0 0 0 2px ${auraColor}` };
    }
  };

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      {auraStyle === 'rainbow' && (
        <div style={{
          position: 'absolute', inset: '-3px', borderRadius: '50%', zIndex: 0,
          background: 'conic-gradient(#ff0000, #ff8c00, #ffff00, #00e68a, #00c8ff, #7850ff, #ff0000)'
        }} />
      )}
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: user.avatar ? 'transparent' : 'rgba(120,80,255,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.38, fontWeight: 500, overflow: 'hidden',
        position: 'relative', zIndex: 1, ...getAura()
      }}>
        {user.avatar
          ? <img src={user.avatar} alt="av" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : user.username[0]?.toUpperCase()}
      </div>
      {showOnline && (
        <motion.div
          animate={{ background: isOnline ? 'rgba(80,230,130,1)' : 'rgba(255,255,255,0.2)' }}
          transition={{ duration: 0.5 }}
          style={{
            position: 'absolute', bottom: '1px', right: '1px',
            width: size * 0.24, height: size * 0.24, borderRadius: '50%',
            border: '1.5px solid rgba(15,15,26,1)', zIndex: 2
          }}
        />
      )}
    </div>
  );
};

export default function Chat() {
  const [contacts, setContacts] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [input, setInput] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [searchTag, setSearchTag] = useState('');
  const [searchResult, setSearchResult] = useState<User | null>(null);
  const [searchError, setSearchError] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [viewingUser, setViewingUser] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');

  const [callState, setCallState] = useState<{
    active: boolean;
    incoming: boolean;
    username: string;
    isVideo: boolean;
  } | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const [winW, setWinW] = useState(window.innerWidth);
  const [winH, setWinH] = useState(window.innerHeight);
  useEffect(() => {
    const onResize = () => { setWinW(window.innerWidth); setWinH(window.innerHeight); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  // телефон в портрете: узкий и выше чем шире
  const isMobilePortrait = winW < 768 && winW < winH;
  const [dbg, setDbg] = useState<string[]>([]);
  const log = (msg: string) => setDbg(p => [...p.slice(-8), msg]);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const iceCandidatesBuffer = useRef<RTCIceCandidateInit[]>([]);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const remoteMS = useRef<MediaStream>(new MediaStream());

  const ws = useRef<WebSocket | null>(null);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const myUsername = localStorage.getItem('username');
  const myTag = localStorage.getItem('tag');

  const loadContacts = async () => {
    const res = await axios.get(`${API}/contacts?token=${token}`);
    setContacts(res.data);
  };

  const startCall = async (toUsername: string, isVideo: boolean) => {
    console.log('START CALL CALLED', toUsername, isVideo);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideo ? { facingMode: 'user' } : false,
      });
      setLocalStream(stream);

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          {
            urls: [
              'turn:178.253.45.20:3478?transport=udp',
              'turn:178.253.45.20:3478?transport=tcp',
              'turns:178.253.45.20:5349?transport=tcp',
            ],
            username: 'void',
            credential: 'voidpass123'
          },
          // Публичные TURN серверы как резерв
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
        ]
      });
      peerRef.current = pc;

      pc.onconnectionstatechange = () => log('conn:' + pc.connectionState);
      pc.oniceconnectionstatechange = () => log('ice:' + pc.iceConnectionState);

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      remoteMS.current = new MediaStream();
      pc.ontrack = (e) => {
        log('track:' + e.track.kind);
        remoteMS.current.addTrack(e.track);
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteMS.current;
        if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteMS.current;
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          ws.current?.send(JSON.stringify({ type: 'call_ice', to: toUsername, data: e.candidate }));
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      ws.current?.send(JSON.stringify({ type: 'call_offer', to: toUsername, data: { sdp: offer, isVideo } }));
      setCallState({ active: false, incoming: false, username: toUsername, isVideo });
    } catch (err) {
      console.error('Ошибка доступа к медиа:', err);
    }
  };

  const acceptCall = async (fromUsername: string, offerData: any, isVideo: boolean) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideo ? { facingMode: 'user' } : false,
      });
      setLocalStream(stream);

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          {
            urls: [
              'turn:178.253.45.20:3478?transport=udp',
              'turn:178.253.45.20:3478?transport=tcp',
              'turns:178.253.45.20:5349?transport=tcp',
            ],
            username: 'void',
            credential: 'voidpass123'
          },
          // Публичные TURN серверы как резерв
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
        ]
      });
      peerRef.current = pc;

      pc.onconnectionstatechange = () => console.log('connection state:', pc.connectionState);
      pc.oniceconnectionstatechange = () => console.log('ice state:', pc.iceConnectionState);

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      remoteMS.current = new MediaStream();
      pc.ontrack = (e) => {
        remoteMS.current.addTrack(e.track);
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteMS.current;
        if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteMS.current;
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          ws.current?.send(JSON.stringify({ type: 'call_ice', to: fromUsername, data: e.candidate }));
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(offerData.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      ws.current?.send(JSON.stringify({ type: 'call_answer', to: fromUsername, data: answer }));
      for (const candidate of iceCandidatesBuffer.current) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch {}
      }
      iceCandidatesBuffer.current = [];
      setCallState({ active: true, incoming: false, username: fromUsername, isVideo });
    } catch (err) {
      console.error('Ошибка доступа к медиа:', err);
    }
  };

  const endCall = () => {
    if (callState) {
      ws.current?.send(JSON.stringify({ type: 'call_end', to: callState.username, data: null }));
    }
    const pc = peerRef.current as RTCPeerConnection;
    pc?.close();
    peerRef.current = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    localStream?.getTracks().forEach(t => { t.stop(); t.enabled = false; });
    setLocalStream(null);
    setCallState(null);
  };

  const rejectCall = () => {
    if (callState) {
      ws.current?.send(JSON.stringify({ type: 'call_reject', to: callState.username, data: null }));
    }
    localStream?.getTracks().forEach(t => { t.stop(); t.enabled = false; });
    setLocalStream(null);
    setCallState(null);
  };

  const handleFlipCamera = (newStream: MediaStream) => {
    const newVideoTrack = newStream.getVideoTracks()[0];
    if (newVideoTrack && peerRef.current) {
      const sender = peerRef.current.getSenders().find(s => s.track?.kind === 'video');
      sender?.replaceTrack(newVideoTrack);
    }
    setLocalStream(prev => {
      prev?.getVideoTracks().forEach(t => t.stop());
      return newStream;
    });
  };

  // ontrack может сработать ДО монтирования CallModal (refs ещё null).
  // Когда callState.active становится true — применяем накопленный stream.
  useEffect(() => {
    if (!callState?.active) return;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteMS.current;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteMS.current;
  }, [callState?.active]);

  useEffect(() => {
    loadContacts();
    ws.current = new WebSocket(`wss://void-messenger.online/ws/${token}`);

    ws.current.onmessage = async (e) => {
      const msg = JSON.parse(e.data);

      if (msg.type === 'online_users') {
        setOnlineUsers(msg.users);
        return;
      }

      if (msg.type === 'call_offer') {
        const isVideo = msg.data?.isVideo || false;
        setCallState({ active: false, incoming: true, username: msg.from, isVideo });
        (window as any).__pendingOffer = { fromUsername: msg.from, offerData: msg.data, isVideo };
        return;
      }

      if (msg.type === 'call_answer') {
        const pc = peerRef.current;
        await pc?.setRemoteDescription(new RTCSessionDescription(msg.data));
        for (const candidate of iceCandidatesBuffer.current) {
          try {
            await pc?.addIceCandidate(new RTCIceCandidate(candidate));
          } catch {}
        }
        iceCandidatesBuffer.current = [];
        setCallState(prev => prev ? { ...prev, active: true } : null);
        return;
      }

      if (msg.type === 'call_ice') {
        const pc = peerRef.current;
        if (!pc) {
          // pc ещё не создан — пользователь не принял звонок.
          // Буферизуем кандидат, иначе он потеряется навсегда.
          iceCandidatesBuffer.current.push(msg.data);
          return;
        }
        if (pc.remoteDescription) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(msg.data));
          } catch {}
        } else {
          iceCandidatesBuffer.current.push(msg.data);
        }
        return;
      }

      if (msg.type === 'call_reject' || msg.type === 'call_end') {
        const pc = peerRef.current as RTCPeerConnection;
        pc?.close();
        peerRef.current = null;
        localStream?.getTracks().forEach(t => { t.stop(); t.enabled = false; });
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
        setLocalStream(null);
        setCallState(null);
        return;
      }

      const chatKey = msg.from === myUsername ? msg.to : msg.from;
      setMessages(prev => ({
        ...prev,
        [chatKey]: [...(prev[chatKey] || []), msg]
      }));
      if (msg.from !== myUsername) {
        loadContacts();
        setUnread(prev => ({ ...prev, [msg.from]: (prev[msg.from] || 0) + 1 }));
      }
    };

    return () => {
      if (ws.current?.readyState === WebSocket.OPEN) ws.current.close();
    };
  }, []);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedUser]);

  const searchUser = async () => {
    setSearchError('');
    setSearchResult(null);
    try {
      const res = await axios.get(`${API}/search?tag=${searchTag}`);
      if (res.data.username === myUsername) { setSearchError('Это ты сам'); return; }
      setSearchResult(res.data);
    } catch { setSearchError('Пользователь не найден'); }
  };

  const addContact = async (user: User) => {
    await axios.post(`${API}/contacts`, { token, contact_id: user.id });
    await loadContacts();
    setShowSearch(false);
    setSearchTag('');
    setSearchResult(null);
    setSelectedUser(user);
  };

  const selectUser = async (user: User) => {
    setSelectedUser(user);
    setUnread(prev => ({ ...prev, [user.username]: 0 }));
    if (!messages[user.username]) {
      try {
        const res = await axios.get(`${API}/messages?token=${token}&with_user=${user.username}`);
        setMessages(prev => ({ ...prev, [user.username]: res.data }));
      } catch {}
    }
  };

  const sendMessage = () => {
    if (!input.trim() || !selectedUser || !ws.current) return;
    ws.current.send(JSON.stringify({ to: selectedUser.username, content: input }));
    setInput('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return file.type.startsWith('image/') ? URL.createObjectURL(file) : null; });
    setPreviewFile(file);
    e.target.value = '';
  };

  const sendFile = async () => {
    if (!previewFile || !selectedUser || !ws.current) return;
    setUploading(true);
    try {
      const url = await uploadFile(previewFile);
      const isImage = previewFile.type.startsWith('image/');
      const isVideo = previewFile.type.startsWith('video/');
      const fileContent = isImage ? `__img__${url}` : isVideo ? `__vid__${url}` : `__file__${previewFile.name}__url__${url}`;
      const content = caption ? `${fileContent}__caption__${caption}` : fileContent;
      ws.current.send(JSON.stringify({ to: selectedUser.username, content }));
      setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
      setPreviewFile(null);
      setCaption('');
    } catch { alert('Ошибка загрузки'); }
    setUploading(false);
  };

  const logout = () => { localStorage.clear(); navigate('/auth'); };
  const currentMessages = selectedUser ? (messages[selectedUser.username] || []) : [];

  return (
    <div style={{ display: 'flex', height: '100vh', padding: isMobilePortrait ? '8px' : '20px', gap: isMobilePortrait ? 0 : '16px' }}>
      {(!isMobilePortrait || !selectedUser) && (
      <motion.div
        className="glass"
        initial={{ x: -40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        style={{ width: isMobilePortrait ? '100%' : '240px', display: 'flex', flexDirection: 'column' }}
      >
        <div onClick={() => navigate('/profile')} style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.07)', cursor: 'pointer' }}>
          <div style={{ fontSize: '16px', fontWeight: 500 }}>VOID</div>
          <div style={{ fontSize: '11px', color: 'rgba(120,80,255,0.9)', marginTop: '2px' }}>{myTag}</div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)', marginTop: '4px' }}>← нажми чтобы открыть профиль</div>
        </div>

        <div style={{ padding: '10px' }}>
          <motion.button className="btn" onClick={() => setShowSearch(!showSearch)} style={{ fontSize: '12px', padding: '8px' }} whileTap={{ scale: 0.97 }}>
            {showSearch ? '✕ закрыть' : '+ найти пользователя'}
          </motion.button>
        </div>

        <AnimatePresence>
          {showSearch && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} style={{ overflow: 'hidden', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ padding: '0 10px 10px' }}>
                <div style={{ position: 'relative', marginBottom: '8px' }}>
                  <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(120,80,255,0.9)', fontSize: '13px' }}>@</span>
                  <input className="input" placeholder="тег пользователя" value={searchTag.replace('@', '')} onChange={e => setSearchTag(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchUser()} style={{ paddingLeft: '24px', fontSize: '12px', padding: '7px 10px 7px 24px' }} />
                </div>
                <motion.button className="btn" onClick={searchUser} style={{ fontSize: '12px', padding: '7px' }} whileTap={{ scale: 0.97 }}>найти</motion.button>
                <AnimatePresence>
                  {searchError && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ color: 'rgba(255,80,80,0.9)', fontSize: '11px', marginTop: '6px' }}>{searchError}</motion.p>}
                </AnimatePresence>
                <AnimatePresence>
                  {searchResult && (
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ marginTop: '8px', padding: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Avatar user={searchResult} size={30} />
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 500 }}>{searchResult.username}</div>
                          <div style={{ fontSize: '11px', color: 'rgba(120,80,255,0.8)' }}>{searchResult.tag}</div>
                        </div>
                      </div>
                      <motion.button onClick={() => addContact(searchResult)} whileTap={{ scale: 0.95 }} style={{ background: 'rgba(120,80,255,0.5)', border: '1px solid rgba(120,80,255,0.6)', color: 'white', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '11px' }}>добавить</motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {contacts.length === 0 && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ fontSize: '12px', color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginTop: '20px' }}>найди друзей по тегу</motion.p>}
          <AnimatePresence>
            {contacts.map(user => (
              <motion.div key={user.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }} onClick={() => selectUser(user)} whileHover={{ background: 'rgba(255,255,255,0.05)' }} style={{ padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', background: selectedUser?.id === user.id ? 'rgba(120,80,255,0.25)' : 'transparent', marginBottom: '2px' }}>
                <Avatar user={user} size={34} showOnline isOnline={onlineUsers.includes(user.username)} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.username}</div>
                  <div style={{ fontSize: '11px', color: 'rgba(120,80,255,0.7)' }}>{user.tag}</div>
                </div>
                <AnimatePresence>
                  {(unread[user.username] || 0) > 0 && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} style={{ background: 'rgba(120,80,255,0.9)', color: 'white', fontSize: '10px', fontWeight: 600, borderRadius: '10px', padding: '2px 6px', minWidth: '18px', textAlign: 'center' }}>
                      {unread[user.username]}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div style={{ padding: '12px' }}>
          <motion.button className="btn" onClick={logout} whileTap={{ scale: 0.97 }} style={{ background: 'rgba(255,60,60,0.3)', borderColor: 'rgba(255,60,60,0.4)' }}>выйти</motion.button>
        </div>
      </motion.div>
      )}

      {(!isMobilePortrait || !!selectedUser) && (
      <motion.div className="glass" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <AnimatePresence mode="wait">
          {selectedUser ? (
            <motion.div key={selectedUser.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                {isMobilePortrait && (
                  <motion.button type="button" onClick={() => setSelectedUser(null)} whileTap={{ scale: 0.9 }}
                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: '4px 8px 4px 0', fontSize: '20px', lineHeight: 1, flexShrink: 0 }}>‹</motion.button>
                )}
                <div onClick={() => setViewingUser(selectedUser.username)} style={{ cursor: 'pointer' }}>
                  <Avatar user={selectedUser} size={36} showOnline isOnline={onlineUsers.includes(selectedUser.username)} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: 500 }}>{selectedUser.username}</div>
                  <motion.div animate={{ color: onlineUsers.includes(selectedUser.username) ? 'rgba(80,230,130,0.9)' : 'rgba(255,255,255,0.3)' }} transition={{ duration: 0.5 }} style={{ fontSize: '11px' }}>
                    {onlineUsers.includes(selectedUser.username) ? 'в сети' : 'не в сети'}
                  </motion.div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <motion.button
                    type="button"
                    onClick={() => startCall(selectedUser.username, false)}
                    whileTap={{ scale: 0.93 }}
                    style={{ background: 'rgba(80,230,130,0.2)', border: '1px solid rgba(80,230,130,0.3)', color: 'rgba(80,230,130,0.9)', borderRadius: '8px', padding: '7px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <IconPhone size={18} color="rgba(80,230,130,0.9)" />
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={() => startCall(selectedUser.username, true)}
                    whileTap={{ scale: 0.93 }}
                    style={{ background: 'rgba(120,80,255,0.2)', border: '1px solid rgba(120,80,255,0.3)', color: 'rgba(120,80,255,0.9)', borderRadius: '8px', padding: '7px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <IconVideoCall size={18} color="rgba(120,80,255,0.9)" />
                  </motion.button>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <AnimatePresence initial={false}>
                  {currentMessages.map((msg, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.2, ease: 'easeOut' }} style={{ display: 'flex', justifyContent: msg.from === myUsername ? 'flex-end' : 'flex-start' }}>
                      <div style={{ maxWidth: '65%', padding: '9px 13px', borderRadius: '14px', fontSize: '13px', lineHeight: 1.5, background: msg.from === myUsername ? 'rgba(120,80,255,0.5)' : 'rgba(255,255,255,0.08)', border: msg.from === myUsername ? '1px solid rgba(120,80,255,0.6)' : '1px solid rgba(255,255,255,0.1)', borderBottomRightRadius: msg.from === myUsername ? '4px' : '14px', borderBottomLeftRadius: msg.from === myUsername ? '14px' : '4px' }}>
                        {msg.content.startsWith('__img__') ? (
                          <div>
                            <img src={msg.content.split('__caption__')[0].replace('__img__', '')} alt="img" style={{ maxWidth: '100%', borderRadius: '8px', display: 'block' }} />
                            {msg.content.includes('__caption__') && <div style={{ fontSize: '12px', marginTop: '6px', opacity: 0.8 }}>{msg.content.split('__caption__')[1]}</div>}
                          </div>
                        ) : msg.content.startsWith('__vid__') ? (
                          <div>
                            <video src={msg.content.split('__caption__')[0].replace('__vid__', '')} controls style={{ maxWidth: '100%', borderRadius: '8px', display: 'block' }} />
                            {msg.content.includes('__caption__') && <div style={{ fontSize: '12px', marginTop: '6px', opacity: 0.8 }}>{msg.content.split('__caption__')[1]}</div>}
                          </div>
                        ) : msg.content.startsWith('__file__') ? (
                          <a href={msg.content.split('__url__')[1].split('__caption__')[0]} target="_blank" rel="noreferrer" style={{ color: 'rgba(180,150,255,0.9)', fontSize: '12px' }}>
                            📎 {msg.content.split('__file__')[1].split('__url__')[0]}
                            {msg.content.includes('__caption__') && <span style={{ display: 'block', marginTop: '4px', opacity: 0.8 }}>{msg.content.split('__caption__')[1]}</span>}
                          </a>
                        ) : msg.content}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                <div ref={messagesEnd} />
              </div>

              <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input ref={fileInputRef} type="file" accept="image/*,video/*,.pdf,.doc,.docx,.zip" style={{ display: 'none' }} onChange={handleFileUpload} />
                <motion.button type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()} whileTap={{ scale: 0.93 }} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', borderRadius: '8px', padding: '9px 12px', cursor: uploading ? 'wait' : 'pointer', fontSize: '16px', flexShrink: 0 }}><IconAttach size={18} /></motion.button>
                <input className="input" placeholder="сообщение..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} style={{ flex: 1, minWidth: 0 }} />
                <motion.button className="btn" onClick={sendMessage} whileTap={{ scale: 0.93 }} style={{ width: '80px', flexShrink: 0 }}><IconSend size={18} /></motion.button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '8px', position: 'relative', overflow: 'hidden' }}>
              <EyeBackground contained />
              <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: '14px', position: 'absolute', bottom: '20px', left: 0, right: 0, textAlign: 'center', zIndex: 1 }}>{isMobilePortrait ? 'выбери чат' : 'выбери чат слева'}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      )}

      <AnimatePresence>
        {previewFile && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass" style={{ padding: '20px', width: '400px', maxWidth: '90vw' }}>
              <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '16px' }}>Отправить файл</div>
              {previewUrl && <img src={previewUrl} alt="preview" style={{ width: '100%', borderRadius: '10px', marginBottom: '14px', maxHeight: '260px', objectFit: 'cover' }} />}
              {!previewUrl && (
                <div style={{ padding: '20px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '24px' }}>📎</span>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500 }}>{previewFile.name}</div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{(previewFile.size / 1024 / 1024).toFixed(2)} МБ</div>
                  </div>
                </div>
              )}
              <input className="input" placeholder="добавить подпись..." value={caption} onChange={e => setCaption(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendFile()} style={{ marginBottom: '12px' }} />
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" onClick={() => { setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; }); setPreviewFile(null); setCaption(''); }} style={{ flex: 1, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', borderRadius: '8px', padding: '10px', cursor: 'pointer', fontSize: '13px' }}>отмена</button>
                <motion.button className="btn" onClick={sendFile} whileTap={{ scale: 0.97 }} style={{ flex: 1 }} disabled={uploading}>{uploading ? 'загрузка...' : 'отправить →'}</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {callState && dbg.length > 0 && (
        <div style={{ position: 'fixed', top: 8, left: 8, zIndex: 9999, background: 'rgba(0,0,0,0.9)', color: '#0f0', fontFamily: 'monospace', fontSize: 12, padding: '8px 12px', borderRadius: 8, maxWidth: '90vw' }}>
          {dbg.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}

      {callState && (
        <CallModal
          isIncoming={callState.incoming}
          callerName={callState.username}
          isActive={callState.active}
          isVideo={callState.isVideo}
          localStream={localStream}
          remoteVideoRef={remoteVideoRef}
          remoteAudioRef={remoteAudioRef}
          onAccept={() => {
            const pending = (window as any).__pendingOffer;
            if (pending) acceptCall(pending.fromUsername, pending.offerData, pending.isVideo);
          }}
          onReject={rejectCall}
          onEnd={endCall}
          onFlipCamera={handleFlipCamera}
        />
      )}

      {viewingUser && (
        <UserProfile username={viewingUser} onClose={() => setViewingUser(null)} onMessage={() => setViewingUser(null)} />
      )}
    </div>
  );
}