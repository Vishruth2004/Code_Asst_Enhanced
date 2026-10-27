import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './App.css';

/* ─── Icons (inline SVG to avoid extra deps) ──────────────────────────────── */
const SendIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const CopyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

const ImageIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

/* ─── Code block with copy button ─────────────────────────────────────────── */
function CodeBlock({ language, children }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        <span className="code-lang-badge">{language || 'code'}</span>
        <button className="copy-btn" onClick={handleCopy} title="Copy code">
          {copied ? <CheckIcon /> : <CopyIcon />}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
      <SyntaxHighlighter
        style={vscDarkPlus}
        language={language || 'text'}
        PreTag="div"
        customStyle={{ margin: 0, borderRadius: '0 0 10px 10px', fontSize: '0.875rem' }}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  );
}

/* ─── Typing indicator ────────────────────────────────────────────────────── */
function TypingIndicator() {
  return (
    <div className="message bot typing-message">
      <div className="avatar bot-avatar">
        <span>CC</span>
      </div>
      <div className="bubble">
        <div className="typing-dots">
          <span /><span /><span />
        </div>
      </div>
    </div>
  );
}

/* ─── Markdown renderer config ────────────────────────────────────────────── */
// react-markdown v10 removed the `inline` prop from the code component.
// We detect block vs inline by: (a) presence of a language-* class (fenced block)
// OR (b) the code string contains a newline (indented block).
// Everything else is inline — rendered as a styled <code> chip, NOT a card.
const markdownComponents = {
  // Strip the <pre> wrapper — our CodeBlock provides its own container.
  pre: ({ children }) => <>{children}</>,

  code({ node, className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || '');
    const codeStr = String(children).replace(/\n$/, '');
    const isBlock = !!match || codeStr.includes('\n');
    if (isBlock) {
      return <CodeBlock language={match ? match[1] : null}>{codeStr}</CodeBlock>;
    }
    // Inline code — render as a styled chip inside prose
    return <code className="inline-code" {...props}>{children}</code>;
  },
  p: ({ children }) => <p className="md-p">{children}</p>,
  ul: ({ children }) => <ul className="md-ul">{children}</ul>,
  ol: ({ children }) => <ol className="md-ol">{children}</ol>,
  li: ({ children }) => <li className="md-li">{children}</li>,
  strong: ({ children }) => <strong className="md-strong">{children}</strong>,
  h1: ({ children }) => <h1 className="md-h1">{children}</h1>,
  h2: ({ children }) => <h2 className="md-h2">{children}</h2>,
  h3: ({ children }) => <h3 className="md-h3">{children}</h3>,
  blockquote: ({ children }) => <blockquote className="md-blockquote">{children}</blockquote>,
  hr: () => <hr className="md-hr" />,
};

/* ─── Constants ───────────────────────────────────────────────────────────── */
const MAX_REQUESTS = 15;
// In production (Render), set REACT_APP_API_URL to your Flask service URL.
// Locally, Flask runs on 8000 directly — no Node.js proxy needed.
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

/* ─── Main App ────────────────────────────────────────────────────────────── */
export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [file, setFile] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [requestCount, setRequestCount] = useState(0); // global usage from backend

  const chatWindowRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const remaining = MAX_REQUESTS - requestCount;
  const isExhausted = remaining <= 0;

  /* ── Greeting ── */
  useEffect(() => {
    setMessages([{
      id: Date.now(),
      text: "Hey! I'm **CodeCraft** — your senior engineer pair-programmer. Ask me anything: algorithms, debugging, system design, code reviews, or architecture. Paste code, attach a screenshot, or just describe what you need.",
      role: 'bot',
    }]);
  }, []);

  /* ── Fetch quota on mount ── */
  useEffect(() => {
    fetch(`${API_BASE}/quota`)
      .then(r => r.json())
      .then(d => setRequestCount(d.count ?? 0))
      .catch(() => {}); // fail silently — don't block UI
  }, []);

  /* ── Auto-scroll ── */
  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTo({ top: chatWindowRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  /* ── File handling ── */
  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setFilePreviewUrl(URL.createObjectURL(f));
  };

  const removeFile = () => {
    setFile(null);
    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    setFilePreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /* ── Textarea auto-resize ── */
  const handleInputChange = (e) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`;
  };

  /* ── Send ── */
  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if ((!trimmed && !file) || isLoading || isExhausted) return;
    if (remaining <= 0) {
      setError('Global request limit of 15 reached. No further requests can be made.');
      return;
    }

    setError(null);

    // Build conversation history to send (skip the greeting)
    const historyForApi = messages
      .filter(m => m.id !== messages[0]?.id || m.role !== 'bot') // skip greeting
      .map(m => ({ role: m.role === 'bot' ? 'assistant' : 'user', content: typeof m.text === 'string' ? m.text : m.text.join('\n') }));

    // Optimistic user message
    const userMsg = { id: Date.now(), text: trimmed, role: 'user', fileUrl: filePreviewUrl };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    // Reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    try {
      let base64Image = null;
      if (file) {
        base64Image = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result.split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      removeFile();

      const response = await fetch(`${API_BASE}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          image: base64Image,
          history: historyForApi,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || `Server error ${response.status}`);
      }

      setMessages(prev => [...prev, { id: Date.now(), text: data.reply, role: 'bot' }]);
      // Update local count from the server's authoritative value
      if (data.requestCount !== undefined) setRequestCount(data.requestCount);
    } catch (err) {
      setError(err.message || 'Something went wrong. Is the backend running?');
      // Roll back the optimistic user message
      setMessages(prev => prev.filter(m => m.id !== userMsg.id));
    } finally {
      setIsLoading(false);
    }
  }, [input, file, isLoading, isExhausted, remaining, messages, filePreviewUrl]);

  /* ── Enter key (Shift+Enter = newline) ── */
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  /* ── Clear chat ── */
  const discardChat = () => {
    setMessages([{
      id: Date.now(),
      text: "Hey! I'm **CodeCraft** — your senior engineer pair-programmer. Ask me anything: algorithms, debugging, system design, code reviews, or architecture. Paste code, attach a screenshot, or just describe what you need.",
      role: 'bot',
    }]);
    setInput('');
    removeFile();
    setError(null);
  };

  return (
    <div className="app-shell">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">CC</div>
          <div className="logo-text">
            <span className="logo-name">CodeCraft</span>
            <span className="logo-sub">AI Engineer</span>
          </div>
        </div>

        <div className="sidebar-section">
          <p className="sidebar-label">Capabilities</p>
          <ul className="sidebar-caps">
            <li>⚡ Algorithm Design</li>
            <li>🐛 Debug & Fix</li>
            <li>🏗️ System Architecture</li>
            <li>📝 Code Review</li>
            <li>🖼️ Image / Screenshot Analysis</li>
            <li>🔁 Refactoring</li>
          </ul>
        </div>

        <div className="sidebar-tips">
          <p className="sidebar-label">Tips</p>
          <p className="tip-text">Paste your code directly into the chat for instant review.</p>
          <p className="tip-text">Upload a screenshot of an error or UI for visual debugging.</p>
          <p className="tip-text"><kbd>Enter</kbd> to send · <kbd>Shift+Enter</kbd> for newline.</p>
        </div>

        {/* ── Quota meter ── */}
        <div className="quota-block">
          <div className="quota-header">
            <span className="sidebar-label">Global Requests</span>
            <span className={`quota-count ${isExhausted ? 'quota-gone' : remaining <= 20 ? 'quota-low' : ''}`}>
              {isExhausted ? 'Limit reached' : `${remaining} left`}
            </span>
          </div>
          <div className="quota-bar-track">
            <div
              className={`quota-bar-fill ${isExhausted ? 'quota-gone' : remaining <= 20 ? 'quota-low' : ''}`}
              style={{ width: `${Math.max(0, (requestCount / MAX_REQUESTS) * 100)}%` }}
            />
          </div>
          <p className="quota-sub">{requestCount} / {MAX_REQUESTS} used</p>
        </div>

        <button className="new-chat-btn" onClick={discardChat}>
          <TrashIcon /> New Chat
        </button>
      </aside>

      {/* ── Main panel ── */}
      <main className="main-panel">
        {/* Header */}
        <header className="chat-header">
          <div className="header-info">
            <div className="header-status-dot" />
            <span className="header-model">claude-sonnet-4-5</span>
          </div>
          <div className="header-title">
            <h1>CodeCraft</h1>
            <span className="header-subtitle">AI Code Assistant</span>
          </div>
          <button className="header-clear-btn" onClick={discardChat} title="New chat">
            <TrashIcon />
          </button>
        </header>

        {/* Error banner */}
        {error && (
          <div className="error-banner">
            <span>⚠️ {error}</span>
            <button onClick={() => setError(null)}><XIcon /></button>
          </div>
        )}

        {/* Messages */}
        <div className="chat-window" ref={chatWindowRef}>
          {messages.map((msg) => (
            <div key={msg.id} className={`message ${msg.role}`}>
              <div className={`avatar ${msg.role === 'bot' ? 'bot-avatar' : 'user-avatar'}`}>
                {msg.role === 'bot' ? <span>CC</span> : <span>You</span>}
              </div>
              <div className="bubble">
                {msg.fileUrl && (
                  <img src={msg.fileUrl} alt="attachment" className="msg-image" />
                )}
                <ReactMarkdown components={markdownComponents}>
                  {typeof msg.text === 'string' ? msg.text : msg.text.join('\n')}
                </ReactMarkdown>
              </div>
            </div>
          ))}
          {isLoading && <TypingIndicator />}
        </div>

        {/* Input area */}
        <div className="input-area">
          {/* File preview strip */}
          {filePreviewUrl && (
            <div className="file-strip">
              <img src={filePreviewUrl} alt="preview" className="file-thumb" />
              <span className="file-name">{file?.name}</span>
              <button className="file-remove-btn" onClick={removeFile}><XIcon /></button>
            </div>
          )}

          <div className={`input-box ${isExhausted ? 'input-box--locked' : ''}`}>
            <textarea
              ref={textareaRef}
              className="chat-textarea"
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={isExhausted ? 'Request limit reached — no further queries allowed.' : 'Ask CodeCraft anything… (Shift+Enter for new line)'}
              rows={1}
              disabled={isLoading || isExhausted}
            />
            <div className="input-actions">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                id="file-upload"
                style={{ display: 'none' }}
              />
              <label htmlFor="file-upload" className="icon-btn" title="Attach image">
                <ImageIcon />
              </label>
              <button
                className={`send-btn ${isLoading ? 'loading' : ''}`}
                onClick={sendMessage}
                disabled={isLoading || isExhausted || (!input.trim() && !file)}
                title={isExhausted ? 'Request limit reached' : 'Send (Enter)'}
              >
                <SendIcon />
              </button>
            </div>
          </div>
          <p className="input-hint">
            {isExhausted
              ? '⛔ Global limit of 15 requests reached.'
              : 'CodeCraft can make mistakes. Review critical code before deploying.'}
          </p>
        </div>
      </main>
    </div>
  );
}
