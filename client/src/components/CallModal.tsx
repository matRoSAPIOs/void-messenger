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

  useEffect(() => {
    if (localStream && localVideo.current) {
      localVideo.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (!remoteStream) return;
    const set = () => {
      if (remoteVideo.current) remoteVideo.current.srcObject = remoteStream;
      if (remoteAudio.current) remoteAudio.current.srcObject = remoteStream;
    };
    set();
    const t = setTimeout(set, 500);
    return () => clearTimeout(t);
  }, [remoteStream, isActive]);

  useEffect(() => {
    if (!isActive) { setSeconds(0); return; }
    const interval = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isActive]);

  useEffect(() => {
    if (!localStream || !isActive) return;
    let animId: number;
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(localStream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const check = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      setSpeaking(avg > 15);
      animId = requestAnimationFrame(check);
    };
    animId = requestAnimationFrame(check);
    return () => { cancelAnimationFrame(animId); ctx.close(); };
  }, [localStream, isActive]);

  useEffect(() => {
    if (!remoteStream || !isActive) return;
    let animId: number;
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(remoteStream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const check = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      setRemoteSpeaking(avg > 15);
      animId = requestAnimationFrame(check);
    };
    animId = requestAnimationFrame(check);
    return () => { cancelAnimationFrame(animId); ctx.close(); };
  }, [remoteStream, isActive]);

  const formatTime = (s: number) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;

  const toggleMute = () => {
    localStream?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsMuted(m => !m);
  };

  const toggleCam = () => {
    localStream?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsCamOff(c => !c);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: '#080810',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <style>{`
          @keyframes speakRing {
            0%,100% { box-shadow: 0 0 0 0px rgba(120,80,255,0.6); }
            50% { box-shadow: 0 0 0 10px rgba(120,80,255,0); }
          }
          @keyframes remoteRing {
            0%,100% { box-shadow: 0 0 0 0px rgba(0,200,255,0.6); }
            50% { box-shadow: 0 0 0 14px rgba(0,200,255,0); }
          }
          .call-btn { transition: filter 0.2s, transform 0.15s; }
          .call-btn:hover { filter: brightness(1.4); transform: scale(1.1); }
        `}</style>

        <audio ref={remoteAudio} autoPlay playsInline style={{ display: 'none' }} />

        {isVideo && isActive ? (
          <>
            <div style={{
              position: 'absolute', inset: '16px',
              borderRadius: '20px', overflow: 'hidden',
              boxShadow: remoteSpeaking
                ? '0 0 0 3px rgba(0,200,255,0.8), 0 0 30px rgba(0,200,255,0.4)'
                : '0 0 0 1px rgba(255,255,255,0.08)',
              transition: 'box-shadow 0.3s'
            }}>
              <video ref={remoteVideo} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>

            {localStream && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                  position: 'absolute', bottom: '110px', right: '28px',
                  width: '120px', height: '170px',
                  borderRadius: '14px', overflow: 'hidden', zIndex: 10,
                  boxShadow: speaking
                    ? '0 0 0 3px rgba(120,80,255,0.9), 0 0 20px rgba(120,80,255,0.5)'
                    : '0 0 0 2px rgba(120,80,255,0.3)',
                  transition: 'box-shadow 0.3s'
                }}
              >
                <video ref={localVideo} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
              </motion.div>
            )}

            <div style={{
              position: 'absolute', top: '28px', left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)',
              borderRadius: '20px', padding: '5px 14px',
              fontSize: '13px', color: 'rgba(255,255,255,0.8)', zIndex: 10
            }}>
              {formatTime(seconds)}
            </div>
          </>
        ) : (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', marginBottom: '40px' }}
          >
            <div style={{
              width: '110px', height: '110px', borderRadius: '50%',
              background: 'rgba(120,80,255,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '42px', fontWeight: 500, color: 'white',
              animation: isActive && remoteSpeaking ? 'remoteRing 0.6s ease-in-out infinite' : 'none',
              boxShadow: isActive && remoteSpeaking
                ? '0 0 0 3px rgba(0,200,255,0.8)'
                : '0 0 0 8px rgba(120,80,255,0.15)',
              transition: 'box-shadow 0.3s'
            }}>
              {callerName[0]?.toUpperCase()}
            </div>
            <div style={{ fontSize: '22px', fontWeight: 500, color: 'white' }}>{callerName}</div>
            <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>
              {isActive ? formatTime(seconds) : isIncoming ? 'входящий звонок...' : 'вызов...'}
            </div>
            {isActive && speaking && (
              <div style={{
                fontSize: '12px', color: 'rgba(120,80,255,0.9)',
                animation: 'speakRing 0.5s ease-in-out infinite'
              }}>
                говоришь...
              </div>
            )}
          </motion.div>
        )}

        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          transition={{ duration: 0.3 }}
          style={{
            position: 'absolute', bottom: '36px', left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex', gap: '14px', alignItems: 'center',
            background: 'rgba(255,255,255,0.07)',
            backdropFilter: 'blur(20px)',
            borderRadius: '50px', padding: '14px 28px',
            border: '1px solid rgba(255,255,255,0.1)',
            zIndex: 20
          }}
        >
          {!isActive && isIncoming && (
            <motion.button type="button" onClick={onAccept} whileTap={{ scale: 0.9 }} className="call-btn"
              style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(80,230,130,0.85)', border: '1px solid rgba(80,230,130,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconPhoneAccept size={22} />
            </motion.button>
          )}

          {isActive && (
            <motion.button type="button" onClick={toggleMute} whileTap={{ scale: 0.9 }} className="call-btn"
              style={{ width: '52px', height: '52px', borderRadius: '50%', background: isMuted ? 'rgba(255,60,60,0.4)' : 'rgba(255,255,255,0.12)', border: `1px solid ${isMuted ? 'rgba(255,60,60,0.5)' : 'rgba(255,255,255,0.2)'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isMuted ? <IconMicOff size={20} /> : <IconMicOn size={20} />}
            </motion.button>
          )}

          {isActive && isVideo && (
            <motion.button type="button" onClick={toggleCam} whileTap={{ scale: 0.9 }} className="call-btn"
              style={{ width: '52px', height: '52px', borderRadius: '50%', background: isCamOff ? 'rgba(255,60,60,0.4)' : 'rgba(255,255,255,0.12)', border: `1px solid ${isCamOff ? 'rgba(255,60,60,0.5)' : 'rgba(255,255,255,0.2)'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isCamOff ? <IconVideoOff size={20} /> : <IconVideoCall size={20} />}
            </motion.button>
          )}

          <motion.button type="button" onClick={isActive ? onEnd : onReject} whileTap={{ scale: 0.9 }} className="call-btn"
            style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(255,50,50,0.85)', border: '1px solid rgba(255,50,50,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconEndCall size={22} />
          </motion.button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}