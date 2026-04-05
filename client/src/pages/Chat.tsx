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
  id?: number;
  from: string;
  to: string;
  content: string;
  timestamp?: string;
  is_read?: boolean;
  is_deleted?: boolean;
  edited_at?: string | null;
  reply_to_id?: number | null;
  reply_preview?: string | null;
  reactions?: Record<string, string[]>;
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

  const [mediaViewer, setMediaViewer] = useState<{ type: 'img' | 'vid'; url: string; caption?: string } | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [contextMenu, setContextMenu] = useState<{ msg: Message; x: number; y: number } | null>(null);
  const [reactionPicker, setReactionPicker] = useState<{ msg: Message; x: number; y: number } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);

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

      if (msg.type === 'typing') {
        setTypingUsers(prev => prev.includes(msg.from) ? prev : [...prev, msg.from]);
        return;
      }
      if (msg.type === 'stop_typing') {
        setTypingUsers(prev => prev.filter(u => u !== msg.from));
        return;
      }
      if (msg.type === 'read') {
        setMessages(prev => {
          const updated = { ...prev };
          for (const key of Object.keys(updated)) {
            updated[key] = updated[key].map(m =>
              m.from === myUsername && m.to === msg.from ? { ...m, is_read: true } : m
            );
          }
          return updated;
        });
        return;
      }
      if (msg.type === 'react') {
        setMessages(prev => {
          const updated = { ...prev };
          for (const key of Object.keys(updated)) {
            updated[key] = updated[key].map(m =>
              m.id === msg.msg_id ? { ...m, reactions: msg.reactions } : m
            );
          }
          return updated;
        });
        return;
      }
      if (msg.type === 'delete_msg') {
        setMessages(prev => {
          const updated = { ...prev };
          for (const key of Object.keys(updated)) {
            updated[key] = updated[key].map(m =>
              m.id === msg.msg_id ? { ...m, is_deleted: true } : m
            );
          }
          return updated;
        });
        return;
      }
      if (msg.type === 'edit_msg') {
        setMessages(prev => {
          const updated = { ...prev };
          for (const key of Object.keys(updated)) {
            updated[key] = updated[key].map(m =>
              m.id === msg.msg_id ? { ...m, content: msg.content, edited_at: msg.edited_at } : m
            );
          }
          return updated;
        });
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
    setReplyTo(null);
    setEditingMsg(null);
    setUnread(prev => ({ ...prev, [user.username]: 0 }));
    ws.current?.send(JSON.stringify({ type: 'read', to: user.username }));
    if (!messages[user.username]) {
      try {
        const res = await axios.get(`${API}/messages?token=${token}&with_user=${user.username}`);
        setMessages(prev => ({ ...prev, [user.username]: res.data }));
      } catch {}
    }
  };

  const sendTyping = () => {
    if (!selectedUser || !ws.current) return;
    ws.current.send(JSON.stringify({ type: 'typing', to: selectedUser.username }));
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      ws.current?.send(JSON.stringify({ type: 'stop_typing', to: selectedUser.username }));
    }, 2000);
  };

  const sendMessage = () => {
    if (editingMsg) {
      if (!input.trim() || !ws.current) return;
      ws.current.send(JSON.stringify({ type: 'edit_msg', msg_id: editingMsg.id, content: input }));
      setEditingMsg(null);
      setInput('');
      return;
    }
    if (!input.trim() || !selectedUser || !ws.current) return;
    ws.current.send(JSON.stringify({
      to: selectedUser.username,
      content: input,
      reply_to_id: replyTo?.id ?? null,
    }));
    setInput('');
    setReplyTo(null);
  };

  const sendReaction = (msg: Message, emoji: string) => {
    ws.current?.send(JSON.stringify({ type: 'react', msg_id: msg.id, emoji }));
    setReactionPicker(null);
    setContextMenu(null);
  };

  const deleteMessage = (msg: Message) => {
    ws.current?.send(JSON.stringify({ type: 'delete_msg', msg_id: msg.id }));
    setContextMenu(null);
  };

  const startEdit = (msg: Message) => {
    setEditingMsg(msg);
    setInput(msg.content);
    setContextMenu(null);
  };

  const startReply = (msg: Message) => {
    setReplyTo(msg);
    setEditingMsg(null);
    setContextMenu(null);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const file = e.clipboardData.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    e.preventDefault();
    setPreviewUrl(URL.createObjectURL(file));
    setPreviewFile(file);
  };

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      voiceChunksRef.current = [];
      recorder.ondataavailable = e => voiceChunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(voiceChunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], 'voice.webm', { type: 'audio/webm' });
        if (!selectedUser || !ws.current) return;
        try {
          const url = await uploadFile(file);
          ws.current.send(JSON.stringify({ to: selectedUser.username, content: `__audio__${url}` }));
        } catch { alert('Ошибка загрузки голосового'); }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch { alert('Нет доступа к микрофону'); }
  };

  const stopVoiceRecording = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
  };

  const formatTimestamp = (ts?: string) => {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();
    const hm = d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
    if (isToday) return hm;
    if (isYesterday) return `вчера ${hm}`;
    return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')} ${hm}`;
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

              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '6px' }}
                onClick={() => { setContextMenu(null); setReactionPicker(null); }}
              >
                <AnimatePresence initial={false}>
                  {currentMessages.map((msg, i) => {
                    const isMine = msg.from === myUsername;
                    const longPressRef = { timer: 0 as any };
                    const openCtx = (x: number, y: number) => setContextMenu({ msg, x, y });
                    const renderContent = () => {
                      if (msg.is_deleted) return <span style={{ opacity: 0.4, fontStyle: 'italic' }}>Сообщение удалено</span>;
                      if (msg.content.startsWith('__img__')) {
                        const url = msg.content.split('__caption__')[0].replace('__img__', '');
                        const cap = msg.content.includes('__caption__') ? msg.content.split('__caption__')[1] : undefined;
                        return <div><img onClick={() => setMediaViewer({ type: 'img', url, caption: cap })} src={url} alt="img" style={{ maxWidth: '100%', borderRadius: '8px', display: 'block', cursor: 'zoom-in' }} />{cap && <div style={{ fontSize: '12px', marginTop: '6px', opacity: 0.8 }}>{cap}</div>}</div>;
                      }
                      if (msg.content.startsWith('__vid__')) {
                        const url = msg.content.split('__caption__')[0].replace('__vid__', '');
                        const cap = msg.content.includes('__caption__') ? msg.content.split('__caption__')[1] : undefined;
                        return <div><div onClick={() => setMediaViewer({ type: 'vid', url, caption: cap })} style={{ position: 'relative', cursor: 'pointer', borderRadius: '8px', overflow: 'hidden', display: 'inline-block', maxWidth: '100%' }}><video src={url} style={{ maxWidth: '100%', display: 'block', pointerEvents: 'none' }} /><div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}><div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg></div></div></div>{cap && <div style={{ fontSize: '12px', marginTop: '6px', opacity: 0.8 }}>{cap}</div>}</div>;
                      }
                      if (msg.content.startsWith('__audio__')) {
                        const url = msg.content.replace('__audio__', '');
                        return <audio controls src={url} style={{ maxWidth: '220px', height: '36px', display: 'block' }} />;
                      }
                      if (msg.content.startsWith('__file__')) {
                        return <a href={msg.content.split('__url__')[1].split('__caption__')[0]} target="_blank" rel="noreferrer" style={{ color: 'rgba(180,150,255,0.9)', fontSize: '12px' }}>📎 {msg.content.split('__file__')[1].split('__url__')[0]}{msg.content.includes('__caption__') && <span style={{ display: 'block', marginTop: '4px', opacity: 0.8 }}>{msg.content.split('__caption__')[1]}</span>}</a>;
                      }
                      return <>{msg.content}</>;
                    };
                    return (
                      <motion.div key={msg.id ?? i} initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.2, ease: 'easeOut' }}
                        style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}
                      >
                        <div style={{ maxWidth: '65%' }}>
                          {/* Цитата */}
                          {msg.reply_to_id && msg.reply_preview && (
                            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.06)', borderLeft: '3px solid rgba(120,80,255,0.7)', borderRadius: '6px', padding: '4px 8px', marginBottom: '4px', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              ↩ {msg.reply_preview}
                            </div>
                          )}
                          {/* Пузырь */}
                          <div
                            onContextMenu={e => { e.preventDefault(); openCtx(e.clientX, e.clientY); }}
                            onTouchStart={e => { longPressRef.timer = setTimeout(() => openCtx(e.touches[0].clientX, e.touches[0].clientY), 500); }}
                            onTouchEnd={() => clearTimeout(longPressRef.timer)}
                            onTouchMove={() => clearTimeout(longPressRef.timer)}
                            style={{ padding: '9px 13px', borderRadius: '14px', fontSize: '13px', lineHeight: 1.5, background: isMine ? 'rgba(120,80,255,0.5)' : 'rgba(255,255,255,0.08)', border: isMine ? '1px solid rgba(120,80,255,0.6)' : '1px solid rgba(255,255,255,0.1)', borderBottomRightRadius: isMine ? '4px' : '14px', borderBottomLeftRadius: isMine ? '14px' : '4px', cursor: 'default' }}
                          >
                            {renderContent()}
                          </div>
                          {/* Реакции */}
                          {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                              {Object.entries(msg.reactions).map(([emoji, users]) => (
                                <button key={emoji} onClick={() => sendReaction(msg, emoji)}
                                  style={{ background: users.includes(myUsername ?? '') ? 'rgba(120,80,255,0.35)' : 'rgba(255,255,255,0.08)', border: users.includes(myUsername ?? '') ? '1px solid rgba(120,80,255,0.5)' : '1px solid rgba(255,255,255,0.12)', borderRadius: '20px', padding: '2px 7px', fontSize: '13px', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                  {emoji} <span style={{ fontSize: '11px', opacity: 0.8 }}>{users.length}</span>
                                </button>
                              ))}
                            </div>
                          )}
                          {/* Время + статус прочтения */}
                          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '3px', textAlign: isMine ? 'right' : 'left', display: 'flex', alignItems: 'center', justifyContent: isMine ? 'flex-end' : 'flex-start', gap: '4px' }}>
                            {msg.edited_at && <span style={{ opacity: 0.6 }}>ред.</span>}
                            {formatTimestamp(msg.timestamp)}
                            {isMine && <span style={{ color: msg.is_read ? 'rgba(120,80,255,0.9)' : 'rgba(255,255,255,0.3)', fontSize: '12px', lineHeight: 1 }}>{msg.is_read ? '✓✓' : '✓'}</span>}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                {/* Индикатор набора */}
                <AnimatePresence>
                  {selectedUser && typingUsers.includes(selectedUser.username) && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
                      style={{ display: 'flex', justifyContent: 'flex-start' }}>
                      <div style={{ padding: '8px 14px', borderRadius: '14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '13px', color: 'rgba(255,255,255,0.4)', display: 'flex', gap: '3px', alignItems: 'center' }}>
                        <span style={{ animation: 'blink 1.2s 0s infinite' }}>•</span>
                        <span style={{ animation: 'blink 1.2s 0.3s infinite' }}>•</span>
                        <span style={{ animation: 'blink 1.2s 0.6s infinite' }}>•</span>
                        <style>{`@keyframes blink { 0%,80%,100%{opacity:0.2} 40%{opacity:1} }`}</style>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div ref={messagesEnd} />
              </div>

              {/* Плашка ответа / редактирования */}
              <AnimatePresence>
                {(replyTo || editingMsg) && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(120,80,255,0.08)', overflow: 'hidden' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '11px', color: 'rgba(120,80,255,0.9)', marginBottom: '2px' }}>{editingMsg ? 'Редактирование' : `↩ Ответ для ${replyTo?.from}`}</div>
                      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(editingMsg ?? replyTo)?.content?.slice(0, 80)}</div>
                    </div>
                    <button type="button" onClick={() => { setReplyTo(null); setEditingMsg(null); setInput(''); }}
                      style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '18px', padding: '0 4px' }}>✕</button>
                  </motion.div>
                )}
              </AnimatePresence>

              <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input ref={fileInputRef} type="file" accept="image/*,video/*,.pdf,.doc,.docx,.zip" style={{ display: 'none' }} onChange={handleFileUpload} />
                <motion.button type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()} whileTap={{ scale: 0.93 }} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', borderRadius: '8px', padding: '9px 12px', cursor: uploading ? 'wait' : 'pointer', flexShrink: 0 }}><IconAttach size={18} /></motion.button>
                <input
                  className="input" placeholder={editingMsg ? 'Редактировать...' : 'сообщение...'} value={input}
                  onChange={e => { setInput(e.target.value); sendTyping(); }}
                  onKeyDown={e => { if (e.key === 'Enter') sendMessage(); if (e.key === 'Escape') { setReplyTo(null); setEditingMsg(null); setInput(''); } }}
                  onPaste={handlePaste}
                  style={{ flex: 1, minWidth: 0 }}
                />
                {/* Голосовое сообщение */}
                <motion.button type="button"
                  onMouseDown={startVoiceRecording} onMouseUp={stopVoiceRecording}
                  onTouchStart={startVoiceRecording} onTouchEnd={stopVoiceRecording}
                  whileTap={{ scale: 0.93 }}
                  style={{ background: isRecording ? 'rgba(255,60,60,0.4)' : 'rgba(255,255,255,0.07)', border: `1px solid ${isRecording ? 'rgba(255,60,60,0.6)' : 'rgba(255,255,255,0.1)'}`, color: 'rgba(255,255,255,0.5)', borderRadius: '8px', padding: '9px 12px', cursor: 'pointer', flexShrink: 0, transition: 'background 0.2s' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/></svg>
                </motion.button>
                <motion.button className="btn" onClick={sendMessage} whileTap={{ scale: 0.93 }} style={{ width: '72px', flexShrink: 0 }}><IconSend size={18} /></motion.button>
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

      {/* Контекстное меню сообщения */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.12 }}
            style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, zIndex: 500, background: 'rgba(20,18,35,0.97)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '6px', minWidth: '160px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Пикер реакций */}
            <div style={{ display: 'flex', gap: '4px', padding: '4px 6px 8px', borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: '4px' }}>
              {['👍','❤️','😂','😮','😢','👏'].map(emoji => (
                <button key={emoji} onClick={() => sendReaction(contextMenu.msg, emoji)}
                  style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', padding: '2px', borderRadius: '6px', transition: 'transform 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.3)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                >{emoji}</button>
              ))}
            </div>
            {/* Ответить */}
            <button onClick={() => startReply(contextMenu.msg)} style={{ width: '100%', background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', padding: '8px 12px', borderRadius: '8px', textAlign: 'left', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >↩ Ответить</button>
            {/* Редактировать / Удалить — только свои */}
            {contextMenu.msg.from === myUsername && !contextMenu.msg.is_deleted && (
              <>
                <button onClick={() => startEdit(contextMenu.msg)} style={{ width: '100%', background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', padding: '8px 12px', borderRadius: '8px', textAlign: 'left', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >✏️ Редактировать</button>
                <button onClick={() => deleteMessage(contextMenu.msg)} style={{ width: '100%', background: 'none', border: 'none', color: 'rgba(255,80,80,0.9)', cursor: 'pointer', padding: '8px 12px', borderRadius: '8px', textAlign: 'left', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,60,60,0.12)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >🗑 Удалить</button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {mediaViewer && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setMediaViewer(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(12px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          >
            <motion.button
              type="button"
              onClick={() => setMediaViewer(null)}
              whileTap={{ scale: 0.9 }}
              style={{ position: 'absolute', top: '20px', right: '20px', width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}
            >✕</motion.button>

            <motion.div
              initial={{ scale: 0.88, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.88, opacity: 0 }}
              transition={{ duration: 0.22 }}
              onClick={e => e.stopPropagation()}
              style={{ maxWidth: '92vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}
            >
              {mediaViewer.type === 'img' ? (
                <img
                  src={mediaViewer.url}
                  alt=""
                  style={{ maxWidth: '100%', maxHeight: '78vh', borderRadius: '14px', objectFit: 'contain', boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}
                />
              ) : (
                <video
                  src={mediaViewer.url}
                  controls
                  autoPlay
                  style={{ maxWidth: '100%', maxHeight: '78vh', borderRadius: '14px', outline: 'none', boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}
                />
              )}
              {mediaViewer.caption && (
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', textAlign: 'center', maxWidth: '500px' }}>{mediaViewer.caption}</div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}