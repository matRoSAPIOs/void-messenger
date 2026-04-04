import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import EyeBackground from '../components/EyeBackground';

const API = 'http://void-messenger.online:8000';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [tag, setTag] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async () => {
    try {
      if (isLogin) {
        const res = await axios.post(`${API}/login`, { username, password });
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('username', res.data.username);
        localStorage.setItem('tag', res.data.tag);
      } else {
        if (!tag) return setError('Введи тег');
        const res = await axios.post(`${API}/register`, { username, password, tag });
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('username', res.data.username);
        localStorage.setItem('tag', res.data.tag);
      }
      navigate('/chat');
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Ошибка');
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <EyeBackground />
      <div className="glass" style={{ padding: '40px', width: '360px' }}>
        <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>VOID</h1>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginBottom: '32px' }}>
          {isLogin ? 'вход в аккаунт' : 'создать аккаунт'}
        </p>

        <input
          className="input"
          placeholder="логин"
          value={username}
          onChange={e => setUsername(e.target.value)}
          style={{ marginBottom: '12px' }}
        />

        {!isLogin && (
          <div style={{ marginBottom: '12px', position: 'relative' }}>
            <span style={{
              position: 'absolute', left: '14px', top: '50%',
              transform: 'translateY(-50%)',
              color: 'rgba(120,80,255,0.9)', fontSize: '14px', pointerEvents: 'none'
            }}>@</span>
            <input
              className="input"
              placeholder="твой_тег"
              value={tag.replace('@', '')}
              onChange={e => setTag(e.target.value.replace('@', ''))}
              style={{ paddingLeft: '28px' }}
            />
          </div>
        )}

        <input
          className="input"
          placeholder="пароль"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          style={{ marginBottom: '20px' }}
        />

        {error && (
          <p style={{ color: 'rgba(255,80,80,0.9)', fontSize: '13px', marginBottom: '12px' }}>
            {error}
          </p>
        )}

        <button className="btn" onClick={handleSubmit}>
          {isLogin ? 'войти' : 'зарегистрироваться'}
        </button>

        <p
          onClick={() => { setIsLogin(!isLogin); setError(''); }}
          style={{
            textAlign: 'center',
            marginTop: '16px',
            fontSize: '13px',
            color: 'rgba(120,80,255,0.9)',
            cursor: 'pointer'
          }}
        >
          {isLogin ? 'нет аккаунта? создать' : 'уже есть аккаунт? войти'}
        </p>
      </div>
    </div>
  );
}