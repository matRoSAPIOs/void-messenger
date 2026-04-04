import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';

const API = 'http://178.253.45.20:8000';

interface UserData {
  id: number;
  username: string;
  tag: string;
  avatar?: string;
  bio?: string;
  aura_color?: string;
  aura_style?: string;
}

interface Props {
  username: string;
  onClose: () => void;
  onMessage: () => void;
}

export default function UserProfile({ username, onClose, onMessage }: Props) {
  const [user, setUser] = useState<UserData | null>(null);

  useEffect(() => {
    axios.get(`${API}/user/${encodeURIComponent(username)}`).then(res => setUser(res.data));
  }, [username]);

  const getAuraStyle = (color: string, style: string) => {
    switch (style) {
      case 'pulse':
        return { boxShadow: `0 0 0 4px ${color}60` };
      case 'neon':
        return { boxShadow: `0 0 12px 4px ${color}, 0 0 24px 8px ${color}40` };
      case 'rainbow':
        return {};
      default:
        return { boxShadow: `0 0 0 3px ${color}` };
    }
  };

  if (!user) return null;

  const auraColor = user.aura_color || '#7850ff';
  const auraStyle = user.aura_style || 'solid';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200
        }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={e => e.stopPropagation()}
          className="glass"
          style={{ width: '340px', overflow: 'hidden' }}
        >
          <div style={{
            height: '100px',
            background: `linear-gradient(135deg, ${auraColor}40 0%, #0f0f1a 100%)`,
            position: 'relative'
          }}>
            <div style={{
              position: 'absolute', bottom: '-40px', left: '24px',
              width: '80px', height: '80px', borderRadius: '50%',
              background: user.avatar ? 'transparent' : 'rgba(120,80,255,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '28px', fontWeight: 500, overflow: 'hidden',
              border: '3px solid rgba(15,15,26,1)',
              zIndex: 1,
              ...getAuraStyle(auraColor, auraStyle)
            }}>
              {auraStyle === 'rainbow' && (
                <div style={{
                  position: 'absolute', inset: '-3px', borderRadius: '50%',
                  background: 'conic-gradient(#ff0000,#ff8c00,#ffff00,#00e68a,#00c8ff,#7850ff,#ff0000)',
                  zIndex: -1
                }} />
              )}
              {user.avatar
                ? <img src={user.avatar} alt="av" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : user.username[0]?.toUpperCase()
              }
            </div>
          </div>

          <div style={{ padding: '52px 24px 24px' }}>
            <div style={{ fontSize: '18px', fontWeight: 500 }}>{user.username}</div>
            <div style={{ fontSize: '12px', color: 'rgba(120,80,255,0.9)', marginTop: '2px' }}>{user.tag}</div>

            {user.bio && (
              <div style={{
                marginTop: '16px', padding: '12px',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '10px', fontSize: '13px',
                color: 'rgba(255,255,255,0.7)', lineHeight: 1.6
              }}>
                {user.bio}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <motion.button
                type="button"
                onClick={onClose}
                whileTap={{ scale: 0.95 }}
                style={{
                  flex: 1, background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.6)', borderRadius: '8px',
                  padding: '10px', cursor: 'pointer', fontSize: '13px'
                }}
              >
                закрыть
              </motion.button>
              <motion.button
                type="button"
                className="btn"
                onClick={onMessage}
                whileTap={{ scale: 0.95 }}
                style={{ flex: 1 }}
              >
                написать
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
