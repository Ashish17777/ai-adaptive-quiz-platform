import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
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
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-gray-900 dark:text-white font-bold">{part.slice(2, -2)}</strong>;
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
            className="flex items-center space-x-2 text-xs font-semibold text-gray-500 hover:text-indigo-600 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </button>
          <h2 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center space-x-2 mt-1">
            <BrainCircuit className="w-5 h-5 text-indigo-600 animate-pulse" />
            <span>AI Study Tutor</span>
            <Badge variant="secondary" className="text-[10px] font-semibold px-2 py-0.5 ml-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              Adaptive AI
            </Badge>
          </h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/dashboard/practice')}
          className="flex items-center space-x-1.5 h-8 font-bold"
        >
          <Zap className="w-3.5 h-3.5 text-indigo-500" />
          <span>Practice</span>
        </Button>
      </div>

      {/* Quick Prompts */}
      <div className="flex gap-2 flex-wrap mb-4 flex-shrink-0">
        {QUICK_PROMPTS.map((p) => {
          const Icon = p.icon;
          return (
            <Button
              key={p.label}
              variant="outline"
              size="sm"
              onClick={() => handleSend(p.label)}
              disabled={sending}
              className="flex items-center space-x-1.5 h-8 text-xs text-gray-600 dark:text-gray-300 font-semibold"
            >
              <Icon className="w-3.5 h-3.5 text-indigo-500" />
              <span>{p.label}</span>
            </Button>
          );
        })}
      </div>

      {/* Messages Window */}
      <Card className="border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex-1 overflow-y-auto min-h-0">
        <CardContent className="p-4 space-y-4">
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
                  : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-zinc-700'
              }`}>
                {msg.role === 'assistant'
                  ? <BrainCircuit className="w-4 h-4" />
                  : <User className="w-4 h-4" />}
              </div>

              {/* Bubble */}
              <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'assistant'
                  ? 'bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-gray-800 dark:text-gray-200 rounded-tl-none font-medium'
                  : 'bg-indigo-600 text-white rounded-tr-none font-semibold'
              }`}>
                {msg.role === 'assistant'
                  ? <span>{formatContent(msg.content)}</span>
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
              <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-2xl rounded-tl-none px-4 py-3">
                <div className="flex space-x-1.5">
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </CardContent>
      </Card>

      {/* Input Area */}
      <div className="mt-4 flex-shrink-0">
        <div className="flex items-end space-x-3 bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-2xl p-3 focus-within:border-indigo-500/50 dark:focus-within:border-indigo-500/50 transition-colors shadow-sm">
          <Sparkles className="w-4 h-4 text-gray-400 mb-2.5 flex-shrink-0" />
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask your AI tutor anything… (Enter to send)"
            rows={1}
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 resize-none outline-none leading-relaxed max-h-32 overflow-y-auto border-0 p-0 focus:ring-0 focus:ring-offset-0"
            style={{ minHeight: '24px' }}
          />
          <Button
            onClick={() => handleSend()}
            disabled={!input.trim() || sending}
            size="icon"
            className="flex-shrink-0 w-8.5 h-8.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl shadow-sm transition-all"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-[10px] text-gray-500 mt-1.5 text-center">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
};

export default AITutor;
