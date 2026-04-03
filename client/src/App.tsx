import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import Auth from './pages/Auth';
import Chat from './pages/Chat';
import Profile from './pages/Profile';

function App() {
  const token = localStorage.getItem('token');

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/chat" element={token ? <Chat /> : <Navigate to="/auth" />} />
        <Route path="/profile" element={token ? <Profile /> : <Navigate to="/auth" />} />
        <Route path="*" element={<Navigate to={token ? "/chat" : "/auth"} />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;