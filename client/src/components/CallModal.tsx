import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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

export default function CallModal({
  isIncoming, callerName, onAccept, onReject, onEnd,
  isActive, localStream, remoteStream, isVideo
}: Props) {
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const remoteAudio = useRef<HTMLAudioElement>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (localStream && localVideo.current) {
      localVideo.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (!remoteStream) return;
    if (isVideo && remoteVideo.current) {
      remoteVideo.current.srcObject = remoteStream;
    }
    if (!isVideo && remoteAudio.current) {
      remoteAudio.current.srcObject = remoteStream;
    }
  }, [remoteStream, isVideo]);

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isActive]);

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

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: isVideo && isActive ? 'rgba(0,0,0,0.95)' : 'rgba(8,8,16,0.97)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
      >
        {isVideo && isActive && remoteStream && (
          <video
            ref={remoteVideo}
            autoPlay
            playsInline
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.9 }}
          />
        )}

        {isVideo && isActive && localStream && (
          <video
            ref={localVideo}
            autoPlay
            playsInline
            muted
            style={{
              position: 'absolute', bottom: '100px', right: '20px',
              width: '160px', height: '120px', objectFit: 'cover',
              borderRadius: '12px', border: '2px solid rgba(120,80,255,0.5)'
            }}
          />
        )}

        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          className="glass"
          style={{ padding: '32px', width: '300px', textAlign: 'center', position: 'relative', zIndex: 1 }}
        >
          <div style={{
            width: '72px', height: '72px', borderRadius: '50%',
            background: 'rgba(120,80,255,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '28px', fontWeight: 500, margin: '0 auto 16px',
            boxShadow: '0 0 0 8px rgba(120,80,255,0.15)'
          }}>
            {callerName[0]?.toUpperCase()}
          </div>

          <div style={{ fontSize: '18px', fontWeight: 500, marginBottom: '6px' }}>{callerName}</div>

          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginBottom: '28px' }}>
            {isActive ? formatTime(seconds) : isIncoming ? 'входящий звонок...' : 'вызов...'}
          </div>

          {!isVideo && isActive && (
            <audio ref={remoteAudio} autoPlay playsInline />
          )}

          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
            {!isActive && isIncoming && (
              <motion.button
                type="button"
                onClick={onAccept}
                whileTap={{ scale: 0.95 }}
                style={{
                  width: '56px', height: '56px', borderRadius: '50%',
                  background: 'rgba(80,230,130,0.8)', border: 'none',
                  cursor: 'pointer', fontSize: '22px'
                }}
              >
                📞
              </motion.button>
            )}

            <motion.button
              type="button"
              onClick={isActive ? onEnd : onReject}
              whileTap={{ scale: 0.95 }}
              style={{
                width: '56px', height: '56px', borderRadius: '50%',
                background: 'rgba(255,60,60,0.8)', border: 'none',
                cursor: 'pointer', fontSize: '22px'
              }}
            >
              📵
            </motion.button>

            {isActive && (
              <motion.button
                type="button"
                onClick={toggleMute}
                whileTap={{ scale: 0.95 }}
                style={{
                  width: '56px', height: '56px', borderRadius: '50%',
                  background: isMuted ? 'rgba(255,60,60,0.5)' : 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  cursor: 'pointer', fontSize: '22px'
                }}
              >
                {isMuted ? '🔇' : '🎤'}
              </motion.button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
