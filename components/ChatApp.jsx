'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import io from 'socket.io-client';

const SOCKET_PATH = '/api/socketio';

const createId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

const ChatApp = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [receiverId, setReceiverId] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [statusBanner, setStatusBanner] = useState({ type: 'info', text: 'Register or login to start chatting.' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [offlineUsers, setOfflineUsers] = useState([]);

  const socketRef = useRef(null);
  const onlineSetRef = useRef(new Set());
  const userMapRef = useRef(new Map());
  const allKnownUsersRef = useRef(new Set());
  const messagesEndRef = useRef(null);

  const setBanner = (text, type = 'info') => setStatusBanner({ text, type });

  const rememberUser = useCallback((id, name) => {
    if (!id) {
      return;
    }
    const normalizedId = String(id);
    if (name) {
      userMapRef.current.set(normalizedId, name);
    }
    allKnownUsersRef.current.add(normalizedId);
  }, []);

  const syncPresenceLists = useCallback(
    (selfId) => {
      const onlineList = Array.from(onlineSetRef.current).map((id) => ({
        id,
        username: userMapRef.current.get(id) || `User ${id.slice(-4)}`,
      }));
      const offlineList = Array.from(allKnownUsersRef.current)
        .filter((id) => id !== String(selfId) && !onlineSetRef.current.has(id))
        .map((id) => ({
          id,
          username: userMapRef.current.get(id) || `User ${id.slice(-4)}`,
        }));
      setOnlineUsers(onlineList);
      setOfflineUsers(offlineList);
    },
    []
  );

  const appendMessage = useCallback((payload) => {
    setMessages((prev) => [
      ...prev,
      {
        id: createId(),
        timestamp: payload.timestamp || new Date().toISOString(),
        ...payload,
      },
    ]);
  }, []);

  const disconnectSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnectedManually = true;
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  const connectSocket = useCallback(
    async (authToken, userInfo) => {
      if (!authToken || !userInfo) {
        return;
      }

      try {
        disconnectSocket();
        await fetch(SOCKET_PATH);

        const socket = io({
          path: SOCKET_PATH,
          auth: {
            token: authToken,
          },
        });

        socketRef.current = socket;

        socket.on('connect', () => {
          appendMessage({ type: 'info', text: 'Connected to realtime server.' });
          onlineSetRef.current.add(String(userInfo.id));
          syncPresenceLists(userInfo.id);
        });

        socket.on('disconnect', () => {
          if (!socket.disconnectedManually) {
            appendMessage({ type: 'error', text: 'Disconnected from server.' });
          }
        });

        socket.on('receive_message', (data) => {
          const msg = data.message;
          const senderId =
            typeof msg.sender === 'object' ? String(msg.sender._id || msg.sender.id) : String(msg.sender);
          const senderName = typeof msg.sender === 'object' ? msg.sender.username : 'Unknown';
          rememberUser(senderId, senderName);
          appendMessage({
            type: 'incoming',
            text: msg.content,
            username: senderName,
            userId: senderId,
            timestamp: msg.createdAt,
          });
          allKnownUsersRef.current.add(senderId);
          syncPresenceLists(userInfo.id);
        });

        socket.on('message_sent', (data) => {
          const msg = data.message;
          const receiverId =
            typeof msg.receiver === 'object' ? String(msg.receiver._id || msg.receiver.id) : String(msg.receiver);
          const receiverName = typeof msg.receiver === 'object' ? msg.receiver.username : 'Unknown';
          rememberUser(receiverId, receiverName);
          appendMessage({
            type: 'outgoing',
            text: msg.content,
            username: receiverName,
            userId: receiverId,
            timestamp: msg.createdAt,
          });
        });

        socket.on('user_status_change', (data) => {
          rememberUser(data.userId, data.username);
          if (data.status === 'online') {
            onlineSetRef.current.add(String(data.userId));
          } else {
            onlineSetRef.current.delete(String(data.userId));
          }
          appendMessage({ type: 'info', text: `${data.username} is now ${data.status}.` });
          syncPresenceLists(userInfo.id);
        });

        socket.on('online_users', (users) => {
          const ids = Array.isArray(users)
            ? users.map((entry) => {
                if (typeof entry === 'string') {
                  return entry;
                }
                rememberUser(entry.userId || entry._id, entry.username);
                return String(entry.userId || entry._id);
              })
            : [];
          onlineSetRef.current = new Set(ids);
          if (userInfo.id) {
            onlineSetRef.current.add(String(userInfo.id));
          }
          syncPresenceLists(userInfo.id);
        });

        socket.on('error', (error) => {
          appendMessage({ type: 'error', text: error.message || 'Socket error' });
        });
      } catch (error) {
        console.error('Socket connection error:', error);
        throw new Error('Unable to initialize realtime connection. Please retry.');
      }
    },
    [appendMessage, disconnectSocket, rememberUser, syncPresenceLists]
  );

  const handleAuth = useCallback(
    async (mode) => {
      if (!username || !password) {
        setBanner('Please fill username and password.', 'error');
        return;
      }

      try {
        setIsSubmitting(true);
        setBanner(`${mode === 'register' ? 'Registering' : 'Logging in'}...`, 'info');
        const response = await fetch(`/api/auth/${mode}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || `Unable to ${mode}.`);
        }

        const data = await response.json();
        setToken(data.token);
        setCurrentUser(data.user);
        rememberUser(data.user.id, data.user.username);
        allKnownUsersRef.current.add(String(data.user.id));
        onlineSetRef.current.add(String(data.user.id));
        syncPresenceLists(data.user.id);
        setBanner(`Welcome ${data.user.username}!`, 'success');
        await connectSocket(data.token, data.user);
      } catch (error) {
        setBanner(error.message, 'error');
      } finally {
        setIsSubmitting(false);
      }
    },
    [connectSocket, password, rememberUser, syncPresenceLists, username]
  );

  const sendMessage = useCallback(() => {
    if (!socketRef.current || !receiverId || !messageInput) {
      setBanner('Receiver and message are required.', 'error');
      return;
    }

    socketRef.current.emit('send_message', {
      receiverId,
      content: messageInput,
    });
    setMessageInput('');
  }, [messageInput, receiverId]);

  const loadHistory = useCallback(async () => {
    if (!token || !currentUser) {
      setBanner('Login is required to load history.', 'error');
      return;
    }
    if (!receiverId) {
      setBanner('Receiver ID is required to load history.', 'error');
      return;
    }
    try {
      setIsHistoryLoading(true);
      setBanner('Fetching chat history...', 'info');
      const res = await fetch(`/api/messages/history/${receiverId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || 'Unable to fetch history.');
      }
      const data = await res.json();
      const normalized = data.messages.map((msg) => {
        const isOwnMessage = String(msg.sender._id) === String(currentUser.id);
        const targetUser = isOwnMessage ? msg.receiver : msg.sender;
        rememberUser(targetUser._id, targetUser.username);
        allKnownUsersRef.current.add(String(targetUser._id));
        return {
          id: msg._id,
          type: isOwnMessage ? 'outgoing' : 'incoming',
          text: msg.content,
          username: targetUser.username,
          userId: targetUser._id,
          timestamp: msg.createdAt,
        };
      });
      setMessages(normalized);
      syncPresenceLists(currentUser.id);
      setBanner(`Loaded ${normalized.length} messages.`, 'success');
    } catch (error) {
      setBanner(error.message, 'error');
    } finally {
      setIsHistoryLoading(false);
    }
  }, [currentUser, receiverId, rememberUser, syncPresenceLists, token]);

  const logout = useCallback(() => {
    disconnectSocket();
    setToken(null);
    setCurrentUser(null);
    setMessages([]);
    setReceiverId('');
    setMessageInput('');
    userMapRef.current.clear();
    allKnownUsersRef.current.clear();
    onlineSetRef.current = new Set();
    setOnlineUsers([]);
    setOfflineUsers([]);
    setBanner('Logged out.', 'info');
  }, [disconnectSocket]);

  useEffect(() => {
    return () => disconnectSocket();
  }, [disconnectSocket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const isAuthenticated = useMemo(() => Boolean(token && currentUser), [token, currentUser]);

  return (
    <div className="chat-container">
      <div className="chat-grid">
        <section className="card">
          <h2 className="heading">Account</h2>
          <div className="input-group">
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              autoComplete="username"
            />
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
            />
            <div className="history-actions">
              <button className="button" disabled={isSubmitting} onClick={() => handleAuth('register')}>
                Register
              </button>
              <button className="button secondary" disabled={isSubmitting} onClick={() => handleAuth('login')}>
                Login
              </button>
            </div>
            {isAuthenticated && (
              <button className="button secondary" onClick={logout}>
                Logout
              </button>
            )}
          </div>
          <div className={`status-banner ${statusBanner.type}`}>
            <strong>Status:</strong> {statusBanner.text}
          </div>
          {isAuthenticated && (
            <div style={{ marginTop: '1rem' }}>
              <div className="status-pill">
                <span className="status-dot online" />
                {currentUser.username} • ID: {currentUser.id}
              </div>
            </div>
          )}
        </section>

        <section className="card">
          <h2 className="heading">Messages</h2>
          <div className="message-inputs">
            <input
              className="input"
              value={receiverId}
              onChange={(e) => setReceiverId(e.target.value)}
              placeholder="Receiver ID"
              disabled={!isAuthenticated}
            />
            <button className="button secondary" disabled={!isAuthenticated || isHistoryLoading} onClick={loadHistory}>
              {isHistoryLoading ? 'Loading...' : 'History'}
            </button>
          </div>
          <div className="message-inputs">
            <input
              className="input"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder="Message"
              disabled={!isAuthenticated}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  sendMessage();
                }
              }}
            />
            <button className="button" disabled={!isAuthenticated} onClick={sendMessage}>
              Send
            </button>
          </div>
          <div className="messages-panel">
            {messages.map((msg) => {
              const presence = onlineSetRef.current.has(String(msg.userId)) ? 'online' : 'offline';
              return (
                <div key={msg.id} className={`message ${msg.type === 'info' ? 'info' : ''} ${msg.type === 'error' ? 'error' : ''}`}>
                  <div>{msg.text}</div>
                  {msg.username && (
                    <div className="message meta">
                      <span className={`status-dot ${presence}`} />
                      {msg.username} • {new Date(msg.timestamp).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </section>
      </div>

      <section className="card" style={{ marginTop: '2rem' }}>
        <h2 className="heading">Presence</h2>
        <div className="lists">
          <div>
            <div className="list-title">Online</div>
            <div className="pill-list">
              {onlineUsers.length
                ? onlineUsers.map((user) => (
                    <span key={user.id} className="pill">
                      {user.username} ({user.id})
                    </span>
                  ))
                : 'No users online'}
            </div>
          </div>
          <div>
            <div className="list-title">Offline</div>
            <div className="pill-list">
              {offlineUsers.length
                ? offlineUsers.map((user) => (
                    <span key={user.id} className="pill">
                      {user.username} ({user.id})
                    </span>
                  ))
                : 'No offline users'}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ChatApp;

