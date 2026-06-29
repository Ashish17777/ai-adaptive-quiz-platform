import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../services/api';
import GlassCard from '../components/GlassCard';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  ArrowLeft, Send, BrainCircuit, User, Sparkles,
  BookOpen, Zap, TrendingUp, HelpCircle
} from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const QUICK_PROMPTS = [
  { label: 'What should I study next?', icon: TrendingUp },
  { label: 'Explain my last wrong answer', icon: HelpCircle },
  { label: 'Teach me probability', icon: BookOpen },
  { label: 'Give me a practice tip', icon: Zap },
];

const formatContent = (text: string) => {
  // Convert **bold** markdown to JSX
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-white">{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
};

const AITutor: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chat history
  useEffect(() => {
    const fetchHistory = async () => {
      if (!user) return;
      try {
        const res = await API.get(`/ai/chat/${user._id}`);
        if (res.data.messages && res.data.messages.length > 0) {
          setMessages(res.data.messages);
          setSessionId(res.data.messages[0]?.sessionId || null);
        } else {
          // Welcome message
          setMessages([{
            role: 'assistant',
            content: `Hello ${user.name}! 👋 I'm your AI Study Tutor. I can help you:\n\n**Explain questions** you got wrong\n**Recommend topics** to study next\n**Teach concepts** step by step\n**Generate practice** quizzes for weak areas\n\nWhat would you like to work on today?`,
            timestamp: new Date().toISOString(),
          }]);
        }
      } catch (_e) {
        setMessages([{
          role: 'assistant',
          content: 'Hello! I\'m your AI Study Tutor. How can I help you today?',
          timestamp: new Date().toISOString(),
        }]);
      } finally {
        setLoadingHistory(false);
      }
    };
    fetchHistory();
  }, [user]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (messageText?: string) => {
    const text = (messageText || input).trim();
    if (!text || sending) return;

    const userMsg: Message = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const res = await API.post('/ai/chat', {
        message: text,
        sessionId,
      });
      const newSessionId = res.data.sessionId;
      if (!sessionId) setSessionId(newSessionId);

      const aiMsg: Message = {
        role: 'assistant',
        content: res.data.response.content,
        timestamp: res.data.response.timestamp,
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (e: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I ran into an issue. Please try again.',
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loadingHistory) return <LoadingSpinner fullPage />;

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] max-w-3xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center space-x-2 text-xs font-semibold text-gray-400 hover:text-white mb-1 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </button>
          <h2 className="text-xl font-extrabold text-white flex items-center space-x-2">
            <BrainCircuit className="w-5 h-5 text-indigo-400 animate-pulse" />
            <span>AI Study Tutor</span>
            <span className="text-xs font-normal text-gray-400 ml-1">Powered by Adaptive AI</span>
          </h2>
        </div>
        <button
          onClick={() => navigate('/dashboard/practice')}
          className="flex items-center space-x-1.5 px-3 py-2 text-xs font-bold bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/30 rounded-xl transition-all"
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Practice</span>
        </button>
      </div>

      {/* Quick Prompts */}
      <div className="flex gap-2 flex-wrap mb-4 flex-shrink-0">
        {QUICK_PROMPTS.map((p) => {
          const Icon = p.icon;
          return (
            <button
              key={p.label}
              onClick={() => handleSend(p.label)}
              disabled={sending}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:text-white rounded-lg transition-all disabled:opacity-50"
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{p.label}</span>
            </button>
          );
        })}
      </div>

      {/* Messages Window */}
      <GlassCard className="border border-white/5 flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex items-start space-x-3 animate-in fade-in slide-in-from-bottom-2 duration-200 ${
              msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
            }`}
          >
            {/* Avatar */}
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
              msg.role === 'assistant'
                ? 'bg-indigo-600 text-white'
                : 'bg-white/10 text-gray-300'
            }`}>
              {msg.role === 'assistant'
                ? <BrainCircuit className="w-4 h-4" />
                : <User className="w-4 h-4" />}
            </div>

            {/* Bubble */}
            <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === 'assistant'
                ? 'bg-white/5 border border-white/10 text-gray-200 rounded-tl-none'
                : 'bg-indigo-600/90 text-white rounded-tr-none'
            }`}>
              {msg.role === 'assistant'
                ? <span className="text-gray-200">{formatContent(msg.content)}</span>
                : msg.content}
              <div className={`text-[10px] mt-1.5 opacity-50 ${msg.role === 'user' ? 'text-right' : ''}`}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {sending && (
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center">
              <BrainCircuit className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-none px-4 py-3">
              <div className="flex space-x-1.5">
                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </GlassCard>

      {/* Input Area */}
      <div className="mt-4 flex-shrink-0">
        <div className="flex items-end space-x-3 bg-white/5 border border-white/10 rounded-2xl p-3 focus-within:border-indigo-500/50 transition-colors">
          <Sparkles className="w-4 h-4 text-gray-500 mb-2 flex-shrink-0" />
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask your AI tutor anything… (Enter to send)"
            rows={1}
            className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 resize-none outline-none leading-relaxed max-h-32 overflow-y-auto"
            style={{ minHeight: '24px' }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || sending}
            className="flex-shrink-0 w-9 h-9 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center transition-all shadow-lg shadow-indigo-600/20"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-gray-600 mt-1.5 text-center">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
};

export default AITutor;
