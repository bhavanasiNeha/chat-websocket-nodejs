import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import './App.css';
import { Auth } from './components/Auth';
import './components/Auth.css';

interface Message {
  id: string;
  user: string;
  text: string;
  timestamp: number;
}

interface User {
  id: string;
  username: string;
  email: string;
}

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [message, setMessage] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [userTyping, setUserTyping] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // API configuration
  const API_BASE_URL = "wss://chat-websocket-backend-t59q.onrender.com";
  // const API_BASE_URL = "http://localhost:3001";

  // Check for existing user session on load
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error('Failed to parse stored user:', error);
        localStorage.removeItem('user');
      }
    }
  }, []);

  // Initialize socket connection when user is authenticated
  useEffect(() => {
    if (!user) return; // Only connect when user is authenticated
    
    // Create socket with connection options
    const newSocket = io(`${API_BASE_URL}/`, {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling'] // Try WebSocket first, then fall back to polling
    });
    
    setSocket(newSocket);

    // Connection handlers
    newSocket.on('connect', () => {
      console.log('Connected to server');
      setIsConnected(true);
      setConnectionError(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setConnectionError(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason);
      setIsConnected(false);
    });

    // Get existing messages
    newSocket.on('get-messages', (allMessages: Message[]) => {
      console.log('Received messages:', allMessages);
      setMessages(allMessages);
    });

    // Handle new messages
    newSocket.on('new-message', (newMessage: Message) => {
      console.log('New message received:', newMessage);
      setMessages(prev => [...prev, newMessage]);
      // Reset typing indicator when a message is received
      setUserTyping(null);
    });

    // Handle typing indicators
    newSocket.on('user-typing', (typingUser: string) => {
      setUserTyping(typingUser);
      // Clear typing indicator after 2 seconds
      setTimeout(() => setUserTyping(null), 2000);
    });

    return () => {
      console.log('Disconnecting socket');
      newSocket.disconnect();
    };
  }, [user, API_BASE_URL]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle sending a message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && socket && socket.connected && user) {
      console.log('Sending message:', message);
      socket.emit('send-message', {
        user: user.username,
        text: message
      });
      setMessage('');
    } else if (!socket?.connected) {
      alert('You are not connected to the server');
    }
  };

  // Handle typing indicator
  const handleTyping = () => {
    if (socket && socket.connected && user) {
      socket.emit('typing', user.username);
    }
  };

  // Handle signing out
  const handleSignOut = () => {
    localStorage.removeItem('user');
    setUser(null);
    socket?.disconnect();
    setSocket(null);
    setMessages([]);
  };

  // Handle successful sign-in
  const handleSignIn = (userData: User) => {
    setUser(userData);
  };

  // Format timestamp
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Show auth screen if not signed in
  if (!user) {
    return <Auth onSignIn={handleSignIn} />;
  }

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h1>Chat App</h1>
        <div className="user-actions">
          <span className="username-display">
            {user.username}
          </span>
          <button onClick={handleSignOut} className="signout-button">
            Sign Out
          </button>
        </div>
        <span className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      {connectionError && (
        <div className="error-banner">
          Unable to connect to the chat server. Please make sure the server is running.
        </div>
      )}

      <div className="messages-container">
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`message ${msg.user === user.username ? 'own-message' : 'other-message'}`}
          >
            <div className="message-header">
              <span className="username">{msg.user}</span>
              <span className="timestamp">{formatTime(msg.timestamp)}</span>
            </div>
            <p>{msg.text}</p>
          </div>
        ))}
        {userTyping && (
          <div className="typing-indicator">
            {userTyping} is typing...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="message-form">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleTyping}
          placeholder="Type a message..."
          disabled={!isConnected}
        />
        <button type="submit" disabled={!isConnected}>Send</button>
      </form>
    </div>
  );
}

export default App; 