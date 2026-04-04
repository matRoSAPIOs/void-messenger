import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const API = 'http://178.253.45.20:8000';

const AURA_STYLES = [
  { id: 'solid', label: 'Обычная' },
  { id: 'pulse', label: 'Пульс' },
  { id: 'rainbow', label: 'Радуга' },
  { id: 'neon', label: 'Неон' },
];

const AURA_COLORS = [
  '#7850ff', '#00c8ff', '#ff5096', '#00e68a',
  '#ff8c00', '#ff3c3c', '#c800ff', '#ffffff'
];

export default function Profile() {
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [auraColor, setAuraColor] = useState('#7850ff');
  const [auraStyle, setAuraStyle] = useState('solid');
  const [tag, setTag] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  useEffect(() => {
    axios.get(`${API}/profile?token=${token}`).then(res => {
      setUsername(res.data.username);
      setTag(res.data.tag);
      setBio(res.data.bio || '');
      setAvatar(res.data.avatar || null);
      setAuraColor(res.data.aura_color || '#7850ff');
      setAuraStyle(res.data.aura_style || 'solid');
    });
  }, []);

  const handleAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAvatar(reader.result as string);
    reader.readAsDataURL(file);
  };

  const save = async () => {
    setError('');
    try {
      const res = await axios.post(`${API}/profile`, {
        token, username, bio, avatar, aura_color: auraColor, aura_style: auraStyle
      });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('username', res.data.username);
      localStorage.setItem('tag', res.data.tag);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Ошибка');
    }
  };

  const getAuraStyle = () => {
    const base = {
      position: 'absolute' as const,
      inset: '-4px',
      borderRadius: '50%',
      zIndex: 0,
    };
    switch (auraStyle) {
      case 'pulse':
        return { ...base, boxShadow: `0 0 0 4px ${auraColor}60`, animation: 'pulse 2s ease-in-out infinite' };
      case 'rainbow':
        return { ...base, background: 'conic-gradient(#ff0000, #ff8c00, #ffff00, #00e68a, #00c8ff, #7850ff, #ff0000)', padding: '3px', borderRadius: '50%' };
      case 'neon':
        return { ...base, boxShadow: `0 0 8px 3px ${auraColor}, 0 0 20px 6px ${auraColor}60` };
      default:
        return { ...base, boxShadow: `0 0 0 3px ${auraColor}` };
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 4px ${auraColor}60; }
          50% { box-shadow: 0 0 0 8px ${auraColor}20; }
        }
      `}</style>

      <motion.div
        className="glass"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ padding: '32px', width: '420px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 500 }}>Профиль</div>
            <div style={{ fontSize: '12px', color: 'rgba(120,80,255,0.9)', marginTop: '2px' }}>{tag}</div>
          </div>
          <motion.button
            onClick={() => navigate('/chat')}
            whileTap={{ scale: 0.95 }}
            style={{
              background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.6)', borderRadius: '8px', padding: '6px 14px',
              cursor: 'pointer', fontSize: '13px'
            }}
          >
            ← назад
          </motion.button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '28px' }}>
          <div style={{ position: 'relative', width: '90px', height: '90px', marginBottom: '12px' }}>
            <div style={getAuraStyle()} />
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                width: '90px', height: '90px', borderRadius: '50%',
                background: avatar ? 'transparent' : 'rgba(120,80,255,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', overflow: 'hidden', position: 'relative', zIndex: 1,
                fontSize: '32px', fontWeight: 500
              }}
            >
              {avatar
                ? <img src={avatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : username[0]?.toUpperCase()
              }
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatar} style={{ display: 'none' }} />
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>нажми на аватар чтобы изменить</div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>никнейм</div>
          <input className="input" value={username} onChange={e => setUsername(e.target.value)} />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>описание</div>
          <textarea
            className="input"
            value={bio}
            onChange={e => setBio(e.target.value)}
            placeholder="расскажи о себе..."
            rows={3}
            style={{ resize: 'none', lineHeight: 1.5 }}
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '10px' }}>цвет ауры</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {AURA_COLORS.map(color => (
              <motion.div
                key={color}
                onClick={() => setAuraColor(color)}
                whileTap={{ scale: 0.9 }}
                style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: color, cursor: 'pointer',
                  border: auraColor === color ? '2px solid white' : '2px solid transparent',
                  boxShadow: auraColor === color ? `0 0 8px ${color}` : 'none'
                }}
              />
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '28px' }}>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '10px' }}>стиль ауры</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {AURA_STYLES.map(style => (
              <motion.button
                key={style.id}
                onClick={() => setAuraStyle(style.id)}
                whileTap={{ scale: 0.95 }}
                style={{
                  padding: '6px 12px', borderRadius: '8px', cursor: 'pointer',
                  fontSize: '12px', border: '1px solid',
                  background: auraStyle === style.id ? 'rgba(120,80,255,0.4)' : 'rgba(255,255,255,0.05)',
                  borderColor: auraStyle === style.id ? 'rgba(120,80,255,0.8)' : 'rgba(255,255,255,0.1)',
                  color: 'white'
                }}
              >
                {style.label}
              </motion.button>
            ))}
          </div>
        </div>

        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ color: 'rgba(255,80,80,0.9)', fontSize: '13px', marginBottom: '12px' }}
          >
            {error}
          </motion.p>
        )}

        <motion.button
          className="btn"
          onClick={save}
          whileTap={{ scale: 0.97 }}
        >
          {saved ? '✓ сохранено' : 'сохранить'}
        </motion.button>
      </motion.div>
    </div>
  );
}