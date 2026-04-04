import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconEndCall, IconMicOn, IconMicOff, IconVideoCall } from './Icons';

interface Props {
  isIncoming: boolean;
  callerName: string;
  onAccept: () => void;
  onReject: () => void;
  onEnd: () => void;
  isActive: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isVideo: boolean;
}

const IconVideoOff = ({ color = 'white', size = 20 }: { color?: string, size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z" fill={color}/>
  </svg>
);

const IconPhoneAccept = ({ color = 'white', size = 20 }: { color?: string, size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" fill={color}/>
  </svg>
);

export default function CallModal({
  isIncoming, callerName, onAccept, onReject, onEnd,
  isActive, localStream, remoteStream, isVideo
}: Props) {
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const remoteAudio = useRef<HTMLAudioElement>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [remoteSpeaking, setRemoteSpeaking] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (localStream && localVideo.current) {
      localVideo.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (!remoteStream) return;
    const setStream = () => {
      if (remoteVideo.current) remoteVideo.current.srcObject = remoteStream;
      if (remoteAudio.current) remoteAudio.current.srcObject = remoteStream;
    };
    setStream();
    const timer = setTimeout(setStream, 500);
    return () => clearTimeout(timer);
  }, [remoteStream, isActive]);

  useEffect(() => {
    if (!isActive) { setSeconds(0); return; }
    const interval = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isActive]);

  useEffect(() => {
    if (!localStream || !isActive) return;
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const source = ctx.createMediaStreamSource(localStream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const check = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b) / data.length;
      setSpeaking(avg > 15);
      requestAnimationFrame(check);
    };
    check();
    return () => { ctx.close(); };
  }, [localStream, isActive]);

  useEffect(() => {
    if (!remoteStream || !isActive) return;
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(remoteStream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const check = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b) / data.length;
      setRemoteSpeaking(avg > 15);
      requestAnimationFrame(check);
    };
    check();
    return () => { ctx.close(); };
  }, [remoteStream, isActive]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
      setIsMuted(m => !m);
    }
  };

  const toggleCam = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
      setIsCamOff(c => !c);
    }
  };

  const btnStyle = (bg: string, border: string) => ({
    width: '56px', height: '56px', borderRadius: '50%',
    background: bg, border: `1px solid ${border}`,
    cursor: 'pointer', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.2s',
  });

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
        style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'linear-gradient(135deg, #080810 0%, #1a0a2e 50%, #0a1628 100%)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden'
        }}
      >
        <audio ref={remoteAudio} autoPlay playsInline style={{ display: 'none' }} />

        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          background: isActive
            ? 'conic-gradient(from 0deg, #7850ff22, #00c8ff22, #ff509622, #7850ff22)'
            : 'transparent',
          animation: isActive ? 'spin 8s linear infinite' : 'none',
        }} />

        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          @keyframes speakPulse { 0%,100% { box-shadow: 0 0 0 0px #7850ff80; } 50% { box-shadow: 0 0 0 12px #7850ff00; } }
          @keyframes remotePulse { 0%,100% { box-shadow: 0 0 0 0px #00c8ff80; } 50% { box-shadow: 0 0 0 16px #00c8ff00; } }
          .call-btn:hover { filter: brightness(1.3); transform: scale(1.08); }
        `}</style>

        {isVideo && isActive && remoteStream ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              position: 'absolute', inset: '20px',
              borderRadius: '20px', overflow: 'hidden',
              animation: remoteSpeaking ? 'remotePulse 0.6s ease-in-out infinite' : 'none',
              boxShadow: remoteSpeaking ? '0 0 0 3px #00c8ff, 0 0 30px #00c8ff60' : '0 0 0 1px rgba(255,255,255,0.1)',
              zIndex: 1
            }}
          >
            <video ref={remoteVideo} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </motion.div>
        ) : (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={{ position: 'relative', zIndex: 2, marginBottom: '20px' }}
          >
            <div style={{
              width: '110px', height: '110px', borderRadius: '50%',
              background: 'rgba(120,80,255,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '42px', fontWeight: 500, color: 'white',
              animation: remoteSpeaking ? 'remotePulse 0.6s ease-in-out infinite' : 'none',
              boxShadow: remoteSpeaking ? '0 0 0 3px #00c8ff, 0 0 30px #00c8ff60' : '0 0 0 8px rgba(120,80,255,0.15)',
              transition: 'all 0.3s'
            }}>
              {callerName[0]?.toUpperCase()}
            </div>
          </motion.div>
        )}

        {isVideo && isActive && localStream && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            style={{
              position: 'absolute', bottom: '120px', right: '24px',
              width: '130px', height: '180px',
              borderRadius: '16px', overflow: 'hidden', zIndex: 10,
              animation: speaking ? 'speakPulse 0.5s ease-in-out infinite' : 'none',
              boxShadow: speaking ? '0 0 0 3px #7850ff, 0 0 20px #7850ff60' : '0 0 0 2px rgba(120,80,255,0.4)',
              transition: 'box-shadow 0.3s'
            }}
          >
            <video ref={localVideo} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
          </motion.div>
        )}

        {!isVideo && isActive && localStream && (
          <motion.div
            animate={{ scale: speaking ? [1, 1.05, 1] : 1 }}
            transition={{ duration: 0.5, repeat: speaking ? Infinity : 0 }}
            style={{
              position: 'absolute', bottom: '140px',
              width: '60px', height: '60px', borderRadius: '50%',
              background: 'rgba(120,80,255,0.3)',
              boxShadow: speaking ? '0 0 0 8px #7850ff40, 0 0 30px #7850ff60' : 'none',
              transition: 'box-shadow 0.3s', zIndex: 2
            }}
          />
        )}

        {!isActive && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ position: 'relative', zIndex: 2, textAlign: 'center', marginBottom: '16px' }}
          >
            <div style={{ fontSize: '22px', fontWeight: 500, color: 'white', marginBottom: '8px' }}>{callerName}</div>
            <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>
              {isIncoming ? 'входящий звонок...' : 'вызов...'}
            </div>
          </motion.div>
        )}

        {isActive && !isVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ position: 'relative', zIndex: 2, textAlign: 'center', marginBottom: '12px' }}
          >
            <div style={{ fontSize: '20px', fontWeight: 500, color: 'white', marginBottom: '6px' }}>{callerName}</div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>{formatTime(seconds)}</div>
          </motion.div>
        )}

        {isActive && isVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              position: 'absolute', top: '32px', left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)',
              borderRadius: '20px', padding: '6px 16px',
              fontSize: '13px', color: 'rgba(255,255,255,0.7)', zIndex: 10
            }}
          >
            {formatTime(seconds)}
          </motion.div>
        )}

        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          style={{
            position: 'absolute', bottom: '36px', left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex', gap: '16px', alignItems: 'center',
            background: 'rgba(255,255,255,0.07)',
            backdropFilter: 'blur(20px)',
            borderRadius: '50px', padding: '14px 28px',
            border: '1px solid rgba(255,255,255,0.1)',
            zIndex: 10
          }}
        >
          {!isActive && isIncoming && (
            <motion.button
              type="button"
              onClick={onAccept}
              whileTap={{ scale: 0.92 }}
              className="call-btn"
              style={btnStyle('rgba(80,230,130,0.85)', 'rgba(80,230,130,0.5)')}
            >
              <IconPhoneAccept size={22} />
            </motion.button>
          )}

          {isActive && (
            <motion.button
              type="button"
              onClick={toggleMute}
              whileTap={{ scale: 0.92 }}
              className="call-btn"
              style={btnStyle(
                isMuted ? 'rgba(255,60,60,0.4)' : 'rgba(255,255,255,0.12)',
                isMuted ? 'rgba(255,60,60,0.5)' : 'rgba(255,255,255,0.2)'
              )}
            >
              {isMuted ? <IconMicOff size={20} /> : <IconMicOn size={20} />}
            </motion.button>
          )}

          {isActive && isVideo && (
            <motion.button
              type="button"
              onClick={toggleCam}
              whileTap={{ scale: 0.92 }}
              className="call-btn"
              style={btnStyle(
                isCamOff ? 'rgba(255,60,60,0.4)' : 'rgba(255,255,255,0.12)',
                isCamOff ? 'rgba(255,60,60,0.5)' : 'rgba(255,255,255,0.2)'
              )}
            >
              {isCamOff ? <IconVideoOff size={20} /> : <IconVideoCall size={20} />}
            </motion.button>
          )}

          <motion.button
            type="button"
            onClick={isActive ? onEnd : onReject}
            whileTap={{ scale: 0.92 }}
            className="call-btn"
            style={btnStyle('rgba(255,50,50,0.85)', 'rgba(255,50,50,0.5)')}
          >
            <IconEndCall size={22} />
          </motion.button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}