import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles, X, Send, RefreshCw, ChevronDown,
  Zap, AlertTriangle, Bot, User as UserIcon,
  Minimize2, Maximize2, RotateCcw,
} from 'lucide-react';
import api from '../api/axios';

// ── Message bubble ────────────────────────────────────────────────
const MessageBubble = ({ msg }) => {
  const isUser = msg.role === 'user';
  const isError = msg.role === 'error';

  if (isError) {
    return (
      <div className="flex items-start gap-2 px-1">
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-rose-100 mt-0.5">
          <AlertTriangle size={13} className="text-rose-600" />
        </div>
        <div className="rounded-2xl rounded-tl-sm bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs text-rose-700 max-w-[85%]">
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-end gap-2 px-1 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full mb-0.5 ${
        isUser
          ? 'bg-blue-600 text-white'
          : 'bg-gradient-to-br from-violet-500 to-purple-600 text-white'
      }`}>
        {isUser ? <UserIcon size={13} /> : <Sparkles size={13} />}
      </div>

      {/* Bubble */}
      <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
        isUser
          ? 'bg-blue-600 text-white rounded-br-sm'
          : 'bg-white border border-ink-100 text-ink-800 rounded-bl-sm shadow-sm'
      }`}>
        {/* Render markdown-like formatting */}
        {msg.content.split('\n').map((line, i) => {
          // Bold: **text**
          const formatted = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
          // Bullet points
          if (line.startsWith('• ') || line.startsWith('- ')) {
            return (
              <div key={i} className="flex items-start gap-1.5 my-0.5">
                <span className={`mt-1 h-1.5 w-1.5 rounded-full flex-shrink-0 ${isUser ? 'bg-blue-200' : 'bg-violet-400'}`} />
                <span dangerouslySetInnerHTML={{ __html: formatted.replace(/^[•\-] /, '') }} />
              </div>
            );
          }
          if (line.trim() === '') return <div key={i} className="h-1.5" />;
          return <p key={i} dangerouslySetInnerHTML={{ __html: formatted }} />;
        })}
      </div>
    </div>
  );
};

// ── Typing indicator ──────────────────────────────────────────────
const TypingIndicator = () => (
  <div className="flex items-end gap-2 px-1">
    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600">
      <Sparkles size={13} className="text-white" />
    </div>
    <div className="rounded-2xl rounded-bl-sm bg-white border border-ink-100 px-4 py-3 shadow-sm">
      <div className="flex items-center gap-1">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-violet-400"
            style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
          />
        ))}
      </div>
    </div>
  </div>
);

// ── Suggestion chip ───────────────────────────────────────────────
const SuggestionChip = ({ text, onClick }) => (
  <button
    onClick={() => onClick(text)}
    className="rounded-xl border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-[11px] font-medium text-violet-700 hover:bg-violet-100 transition text-left leading-tight"
  >
    {text}
  </button>
);

// ── INITIAL GREETING ──────────────────────────────────────────────
const GREETING = `Hi! I'm **MEGA** — your Five Stop AI Resource Assistant 🌟

I have live access to your entire stock system right now. Ask me anything like:
• "What items are out of stock?"
• "Show me this month's purchase summary"
• "Which materials need restocking?"

What would you like to know?`;

// ════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════
export default function AiChat() {
  const [open,        setOpen]        = useState(false);
  const [minimized,   setMinimized]   = useState(false);
  const [messages,    setMessages]    = useState([
    { role: 'assistant', content: GREETING, id: 'welcome' },
  ]);
  const [input,       setInput]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [analyzed,    setAnalyzed]    = useState(null);
  const [unread,      setUnread]      = useState(0);

  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);
  const openedOnce = useRef(false);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (open && !minimized) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading, open, minimized]);

  // Load suggestions on first open
  useEffect(() => {
    if (open && !openedOnce.current) {
      openedOnce.current = true;
      loadSuggestions();
      runAnalysis();
      inputRef.current?.focus();
    }
  }, [open]);

  const loadSuggestions = async () => {
    try {
      const res = await api.get('/ai/quick-suggestions');
      setSuggestions(res.data.suggestions || []);
    } catch { /* silent */ }
  };

  const runAnalysis = async () => {
    try {
      const res = await api.get('/ai/analyze');
      setAnalyzed(res.data);
      // Show critical alerts as a system message
      const criticals = (res.data.alerts || []).filter(a => a.level === 'critical');
      if (criticals.length > 0) {
        const alertMsg = `⚠️ **Automated Alert**\n\n${criticals.map(a => `**${a.title}:** ${a.message}\n→ ${a.action}`).join('\n\n')}`;
        setMessages(prev => [...prev, { role: 'assistant', content: alertMsg, id: `alert-${Date.now()}` }]);
      }
    } catch { /* silent */ }
  };

  const sendMessage = useCallback(async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    setInput('');
    const userMsg = { role: 'user', content: msg, id: `u-${Date.now()}` };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    // Build history from current messages (exclude welcome + alerts)
    const history = messages
      .filter(m => ['user', 'assistant'].includes(m.role) && m.id !== 'welcome')
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await api.post('/ai/chat', { message: msg, history });
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.data.reply,
        id: `a-${Date.now()}`,
      }]);
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Sorry, I couldn\'t process that. Please check your GEMINI_API_KEY is set on the server.';
      setMessages(prev => [...prev, { role: 'error', content: errMsg, id: `e-${Date.now()}` }]);
    } finally {
      setLoading(false);
    }
  }, [input, messages, loading]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([{ role: 'assistant', content: GREETING, id: 'welcome' }]);
    setAnalyzed(null);
    openedOnce.current = false;
  };

  const handleOpen = () => {
    setOpen(true);
    setMinimized(false);
    setUnread(0);
  };

  // Score color
  const scoreColor = analyzed?.score >= 80 ? 'text-emerald-600' : analyzed?.score >= 60 ? 'text-amber-600' : 'text-rose-600';

  return (
    <>
      {/* ── Bounce keyframe ── */}
      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
        @keyframes faraSlideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* ── Floating trigger button ── */}
      {!open && (
        <button
          onClick={handleOpen}
          className="fixed bottom-6 right-6 z-[998] flex items-center gap-2.5 rounded-2xl shadow-2xl px-4 py-3 text-white font-bold text-sm transition-all hover:scale-105 active:scale-95"
          style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 60%, #1a56db 100%)' }}
          title="Open MEGA — AI Assistant"
        >
          <div className="relative">
            <Sparkles size={18} />
            {unread > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black">
                {unread}
              </span>
            )}
          </div>
          <span>Ask MEGA</span>
          {analyzed && (
            <span className={`text-xs font-normal opacity-80`}>
              · Score {analyzed.score}/100
            </span>
          )}
        </button>
      )}

      {/* ── Chat panel ── */}
      {open && (
        <div
          className={`fixed right-6 z-[999] flex flex-col rounded-3xl overflow-hidden shadow-2xl border border-white/20 transition-all duration-300 ${
            minimized ? 'bottom-6 h-14 w-72' : 'bottom-6 w-[380px]'
          }`}
          style={{
            height: minimized ? 56 : 560,
            animation: 'faraSlideUp 0.25s ease-out',
            background: 'linear-gradient(180deg, #fafbff 0%, #ffffff 100%)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 flex-shrink-0 cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 60%, #1a56db 100%)' }}
            onClick={() => setMinimized(v => !v)}
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20">
                <Sparkles size={16} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-black text-white leading-tight">MEGA</p>
                <p className="text-[10px] text-purple-200 leading-tight">Five Stop AI Assistant</p>
              </div>
              {analyzed && (
                <div className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white">
                  {analyzed.score}/100
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={(e) => { e.stopPropagation(); clearChat(); }}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 hover:bg-white/25 text-white transition"
                title="Clear chat"
              >
                <RotateCcw size={13} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setMinimized(v => !v); }}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 hover:bg-white/25 text-white transition"
                title={minimized ? 'Expand' : 'Minimize'}
              >
                {minimized ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setOpen(false); }}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 hover:bg-white/25 text-white transition"
                title="Close"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {!minimized && (
            <>
              {/* Analysis bar */}
              {analyzed && analyzed.alerts?.some(a => a.level !== 'info') && (
                <div className={`px-4 py-2 text-[11px] font-semibold flex items-center gap-2 flex-shrink-0 ${
                  analyzed.alerts.some(a => a.level === 'critical')
                    ? 'bg-rose-50 text-rose-700 border-b border-rose-100'
                    : 'bg-amber-50 text-amber-700 border-b border-amber-100'
                }`}>
                  <AlertTriangle size={11} className="flex-shrink-0" />
                  {analyzed.summary}
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
                {messages.map(msg => (
                  <MessageBubble key={msg.id} msg={msg} />
                ))}
                {loading && <TypingIndicator />}
                <div ref={bottomRef} />
              </div>

              {/* Suggestions — always visible */}
              {suggestions.length > 0 && (
                <div className="px-3 pb-2 flex-shrink-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-1.5 px-1">
                    Quick questions
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.slice(0, 4).map((s, i) => (
                      <SuggestionChip key={i} text={s} onClick={sendMessage} />
                    ))}
                  </div>
                </div>
              )}

              {/* Input */}
              <div className="flex-shrink-0 border-t border-ink-100 bg-white px-3 py-3">
                <div className="flex items-end gap-2 rounded-2xl border border-ink-200 bg-ink-50/60 px-3 py-2 focus-within:border-violet-400 focus-within:ring-1 focus-within:ring-violet-200 transition">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about stock, purchases, suppliers..."
                    rows={1}
                    className="flex-1 bg-transparent text-xs text-ink-900 placeholder-ink-400 outline-none resize-none max-h-24"
                    style={{ lineHeight: '1.5' }}
                    disabled={loading}
                  />
                  <button
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || loading}
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 text-white transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {loading
                      ? <RefreshCw size={12} className="animate-spin" />
                      : <Send size={12} />
                    }
                  </button>
                </div>
                <p className="text-center text-[10px] text-ink-300 mt-1.5">
                  MEGA · Powered by Google Gemini · Live system data
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
