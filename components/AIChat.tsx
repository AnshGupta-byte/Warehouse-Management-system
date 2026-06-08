'use client'

import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTED = [
  'Which products are running low on stock?',
  'What should I reorder this week?',
  'Show me the highest value products',
]

export default function AIChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '👋 Hello! I\'m your AI warehouse assistant. I have access to your live inventory data. Ask me anything about your stock levels, orders, or what to reorder!',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text?: string) => {
    const msg = text || input.trim()
    if (!msg || loading) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setLoading(true)

    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      })
      const data = await res.json()
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: data.response || data.error || 'Sorry, I could not get a response.' },
      ])
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Connection error. Please check your setup.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ai-chat-panel">
      {open && (
        <div className="ai-chat-window">
          <div className="chat-header">
            <div className="chat-avatar">🤖</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>AI Assistant</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Powered by Gemini</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer' }}
              id="ai-chat-close-btn"
            >
              ✕
            </button>
          </div>

          <div className="chat-messages">
            {messages.map((m, i) => (
              <div key={i} className={`chat-message ${m.role}`}>
                {m.content}
              </div>
            ))}
            {loading && (
              <div className="chat-message assistant" style={{ display: 'flex', gap: 4 }}>
                <span style={{ animation: 'pulse 1s infinite' }}>●</span>
                <span style={{ animation: 'pulse 1s infinite 0.2s' }}>●</span>
                <span style={{ animation: 'pulse 1s infinite 0.4s' }}>●</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions */}
          {messages.length <= 1 && (
            <div style={{ padding: '0 12px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {SUGGESTED.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s)}
                  id={`chat-suggestion-${i}`}
                  style={{
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '6px 10px',
                    color: 'var(--text-secondary)',
                    fontSize: 12,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'var(--transition)',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className="chat-input-area">
            <input
              type="text"
              className="input"
              placeholder="Ask about inventory..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              id="ai-chat-input"
            />
            <button
              className="btn btn-primary btn-icon"
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              id="ai-chat-send-btn"
            >
              ➤
            </button>
          </div>
        </div>
      )}

      <button
        className="ai-chat-trigger"
        onClick={() => setOpen(!open)}
        id="ai-chat-trigger-btn"
        title="AI Assistant"
      >
        {open ? '✕' : '🤖'}
      </button>
    </div>
  )
}
