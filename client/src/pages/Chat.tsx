import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API = 'http://127.0.0.1:8000';

interface Message {
  from: string;
  to: string;
  content: string;
}

interface User {
  id: number;
  username: string;
  tag: string;
}

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
  const ws = useRef<WebSocket | null>(null);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const myUsername = localStorage.getItem('username');
  const myTag = localStorage.getItem('tag');

  const loadContacts = async () => {
    const res = await axios.get(`${API}/contacts?token=${token}`);
    setContacts(res.data);
  };

  useEffect(() => {
    loadContacts();

    ws.current = new WebSocket(`ws://127.0.0.1:8000/ws/${token}`);
    ws.current.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'online_users') {
        setOnlineUsers(msg.users);
        return;
      }
      const chatKey = msg.from === myUsername ? msg.to : msg.from;
      setMessages(prev => ({
        ...prev,
        [chatKey]: [...(prev[chatKey] || []), msg]
      }));
    };

    return () => ws.current?.close();
  }, []);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedUser]);

  const searchUser = async () => {
    setSearchError('');
    setSearchResult(null);
    try {
      const res = await axios.get(`${API}/search?tag=${searchTag}`);
      if (res.data.username === myUsername) {
        setSearchError('Это ты сам');
        return;
      }
      setSearchResult(res.data);
    } catch {
      setSearchError('Пользователь не найден');
    }
  };

  const addContact = async (user: User) => {
    await axios.post(`${API}/contacts`, { token, contact_id: user.id });
    await loadContacts();
    setShowSearch(false);
    setSearchTag('');
    setSearchResult(null);
    setSelectedUser(user);
  };

  const sendMessage = () => {
    if (!input.trim() || !selectedUser || !ws.current) return;
    ws.current.send(JSON.stringify({ to: selectedUser.username, content: input }));
    setInput('');
  };

  const logout = () => {
    localStorage.clear();
    navigate('/auth');
  };

  const currentMessages = selectedUser ? (messages[selectedUser.username] || []) : [];

  return (
    <div style={{ display: 'flex', height: '100vh', padding: '20px', gap: '16px' }}>

      <div className="glass" style={{ width: '240px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ fontSize: '16px', fontWeight: 500 }}>VOID</div>
          <div style={{ fontSize: '11px', color: 'rgba(120,80,255,0.9)', marginTop: '2px' }}>{myTag}</div>
        </div>

        <div style={{ padding: '10px' }}>
          <button
            className="btn"
            onClick={() => setShowSearch(!showSearch)}
            style={{ fontSize: '12px', padding: '8px' }}
          >
            + найти пользователя
          </button>
        </div>

        {showSearch && (
          <div style={{ padding: '0 10px 10px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ position: 'relative', marginBottom: '8px' }}>
              <span style={{
                position: 'absolute', left: '10px', top: '50%',
                transform: 'translateY(-50%)',
                color: 'rgba(120,80,255,0.9)', fontSize: '13px'
              }}>@</span>
              <input
                className="input"
                placeholder="тег пользователя"
                value={searchTag.replace('@', '')}
                onChange={e => setSearchTag(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchUser()}
                style={{ paddingLeft: '24px', fontSize: '12px', padding: '7px 10px 7px 24px' }}
              />
            </div>
            <button className="btn" onClick={searchUser} style={{ fontSize: '12px', padding: '7px' }}>
              найти
            </button>
            {searchError && (
              <p style={{ color: 'rgba(255,80,80,0.9)', fontSize: '11px', marginTop: '6px' }}>{searchError}</p>
            )}
            {searchResult && (
              <div style={{
                marginTop: '8px', padding: '8px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.05)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 500 }}>{searchResult.username}</div>
                  <div style={{ fontSize: '11px', color: 'rgba(120,80,255,0.8)' }}>{searchResult.tag}</div>
                </div>
                <button
                  onClick={() => addContact(searchResult)}
                  style={{
                    background: 'rgba(120,80,255,0.5)', border: '1px solid rgba(120,80,255,0.6)',
                    color: 'white', borderRadius: '6px', padding: '4px 10px',
                    cursor: 'pointer', fontSize: '11px'
                  }}
                >
                  добавить
                </button>
              </div>
            )}
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {contacts.length === 0 && (
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginTop: '20px' }}>
              найди друзей по тегу
            </p>
          )}
          {contacts.map(user => (
            <div
              key={user.id}
              onClick={() => setSelectedUser(user)}
              style={{
                padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '10px',
                background: selectedUser?.id === user.id ? 'rgba(120,80,255,0.25)' : 'transparent',
                marginBottom: '2px'
              }}
            >
              <div style={{ position: 'relative' }}>
                <div style={{
                  width: '34px', height: '34px', borderRadius: '50%',
                  background: 'rgba(120,80,255,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '13px', fontWeight: 500
                }}>
                  {user.username[0].toUpperCase()}
                </div>
                <div style={{
                  position: 'absolute', bottom: '1px', right: '1px',
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: onlineUsers.includes(user.username) ? 'rgba(80,230,130,1)' : 'rgba(255,255,255,0.2)',
                  border: '1.5px solid rgba(15,15,26,1)'
                }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user.username}
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(120,80,255,0.7)' }}>{user.tag}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: '12px' }}>
          <button className="btn" onClick={logout} style={{ background: 'rgba(255,60,60,0.3)', borderColor: 'rgba(255,60,60,0.4)' }}>
            выйти
          </button>
        </div>
      </div>

      <div className="glass" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {selectedUser ? (
          <>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ position: 'relative' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: 'rgba(120,80,255,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '14px', fontWeight: 500
                }}>
                  {selectedUser.username[0].toUpperCase()}
                </div>
                <div style={{
                  position: 'absolute', bottom: '1px', right: '1px',
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: onlineUsers.includes(selectedUser.username) ? 'rgba(80,230,130,1)' : 'rgba(255,255,255,0.2)',
                  border: '1.5px solid rgba(15,15,26,1)'
                }} />
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 500 }}>{selectedUser.username}</div>
                <div style={{ fontSize: '11px', color: onlineUsers.includes(selectedUser.username) ? 'rgba(80,230,130,0.9)' : 'rgba(255,255,255,0.3)' }}>
                  {onlineUsers.includes(selectedUser.username) ? 'в сети' : 'не в сети'}
                </div>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {currentMessages.map((msg, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: msg.from === myUsername ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '65%', padding: '9px 13px', borderRadius: '14px',
                    fontSize: '13px', lineHeight: 1.5,
                    background: msg.from === myUsername ? 'rgba(120,80,255,0.5)' : 'rgba(255,255,255,0.08)',
                    border: msg.from === myUsername ? '1px solid rgba(120,80,255,0.6)' : '1px solid rgba(255,255,255,0.1)',
                    borderBottomRightRadius: msg.from === myUsername ? '4px' : '14px',
                    borderBottomLeftRadius: msg.from === myUsername ? '14px' : '4px',
                  }}>
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={messagesEnd} />
            </div>

            <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '10px' }}>
              <input
                className="input"
                placeholder="сообщение..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
              />
              <button className="btn" onClick={sendMessage} style={{ width: '80px' }}>
                →
              </button>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '14px' }}>
            выбери чат слева
          </div>
        )}
      </div>
    </div>
  );
}