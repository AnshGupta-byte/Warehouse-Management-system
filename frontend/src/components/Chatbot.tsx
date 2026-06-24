import React, { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import {
  MessageSquare, X, Send, Cpu, Table,
  AlertTriangle, Package, BarChart2, ShoppingCart, Boxes,
  Trash2,
} from 'lucide-react';

interface TableData {
  headers: string[];
  rows: (string | number)[][];
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type: 'text' | 'table' | 'alert_list' | 'product_list';
  tableData?: TableData;
  timestamp: Date;
}

const QUICK_QUERIES = [
  { label: 'Low Stock Alerts', icon: AlertTriangle, query: 'Are there any low stock alerts?' },
  { label: 'Reorder Needs', icon: Package, query: 'What products need restocking?' },
  { label: 'Inventory Overview', icon: Boxes, query: 'Show me current inventory stock levels' },
  { label: 'Top Products', icon: BarChart2, query: 'What are the top selling products by revenue?' },
  { label: 'Active Orders', icon: ShoppingCart, query: 'Show me pending and confirmed orders' },
];

const DataTable: React.FC<{ tableData: TableData }> = ({ tableData }) => (
  <div className="mt-2 overflow-x-auto rounded-lg border border-[var(--border)] max-w-full">
    <table className="text-[11px] w-full min-w-max">
      <thead>
        <tr className="bg-[var(--bg-root)]">
          {tableData.headers.map((h, i) => (
            <th
              key={i}
              className="text-left px-3 py-2 text-[10px] font-semibold tracking-widest text-[var(--text-muted)] uppercase whitespace-nowrap border-b border-[var(--border)]"
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {tableData.rows.map((row, ri) => (
          <tr key={ri} className="border-t border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors">
            {row.map((cell, ci) => (
              <td key={ci} className="px-3 py-2 text-[var(--text-secondary)] whitespace-nowrap font-['JetBrains_Mono']">
                {String(cell)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
    <div className="px-3 py-1.5 bg-[var(--bg-root)] text-[10px] text-[var(--text-muted)] border-t border-[var(--border)] tracking-wide">
      {tableData.rows.length} records
    </div>
  </div>
);

const MessageBubble: React.FC<{ msg: Message }> = ({ msg }) => {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
      {!isUser && (
        <span className="mb-1 inline-flex items-center px-2 py-0.5 rounded-full bg-[rgba(37,99,235,0.08)] text-[9px] font-semibold text-[var(--accent)] tracking-widest uppercase">
          AI
        </span>
      )}
      <div
        className={`${
          isUser
            ? 'ml-12 bg-[rgba(37,99,235,0.08)]'
            : 'mr-12 bg-[var(--bg-elevated)] border border-[var(--border)] border-l-2 border-l-[#2563eb]'
        } rounded-xl p-3.5 text-[12px] leading-relaxed max-w-full`}
      >
        {msg.type !== 'text' && msg.tableData && (
          <div className="flex items-center space-x-1.5 mb-2">
            <Table className="h-3 w-3 text-[var(--accent)]" />
            <span className="text-[10px] font-semibold tracking-widest text-[var(--accent)] uppercase">
              Structured Data
            </span>
          </div>
        )}
        <p className={`whitespace-pre-wrap ${isUser ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
          {msg.content}
        </p>
        {msg.tableData && <DataTable tableData={msg.tableData} />}
      </div>
      <p className={`text-[11px] text-[#3f3f46] mt-1 ${isUser ? 'text-right' : ''}`}>
        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  );
};

export const Chatbot: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: `Hi! I'm WarehouseAI 🤖 — your intelligent logistics assistant.\n\nI can show you real-time inventory data, alerts, orders, and recommendations. Try one of the quick queries below or ask me anything!`,
      type: 'text',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
      type: 'text',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.chatbot.query(text.trim());
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: res.response,
        type: res.type || 'text',
        tableData: res.tableData || undefined,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${err.message}`,
        type: 'text',
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-30 h-10 w-10 rounded-xl flex items-center justify-center transition-all shadow-lg shadow-blue-900/20 hover:shadow-blue-900/30 hover:scale-105"
        style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}
        aria-label={open ? 'Close chat' : 'Open AI Assistant'}
      >
        <MessageSquare className="h-5 w-5 text-white" />
      </button>

      {/* Chat Panel */}
      {open && (
        <div className="fixed bottom-20 right-6 z-30 w-[400px] h-[540px] bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in-0 slide-in-from-bottom-2 duration-150">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] flex-shrink-0">
            <div className="flex items-center space-x-2.5">
              <Cpu className="h-4 w-4 text-[var(--accent)] flex-shrink-0" />
              <span className="text-[14px] font-semibold text-[var(--text-primary)] leading-none">
                WarehouseAI Assistant
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[rgba(37,99,235,0.08)] text-[9px] font-semibold text-[var(--accent)] tracking-widest uppercase leading-none">
                Gemini 2.0
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setMessages([messages[0]])}
                className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                title="Clear history"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Quick Chips */}
          <div className="px-3 py-2 border-b border-[var(--border)] flex-shrink-0">
            <div className="flex space-x-1.5 overflow-x-auto pb-0.5 scrollbar-none">
              {QUICK_QUERIES.map((q) => {
                const Icon = q.icon;
                return (
                  <button
                    key={q.label}
                    onClick={() => sendMessage(q.query)}
                    disabled={loading}
                    className="flex items-center space-x-1 text-[10px] font-medium px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] whitespace-nowrap flex-shrink-0 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Icon className="h-3 w-3 flex-shrink-0" />
                    <span>{q.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}

            {/* Typing Indicator */}
            {loading && (
              <div className="flex flex-col items-start">
                <span className="mb-1 inline-flex items-center px-2 py-0.5 rounded-full bg-[rgba(37,99,235,0.08)] text-[9px] font-semibold text-[var(--accent)] tracking-widest uppercase">
                  AI
                </span>
                <div className="mr-12 bg-[var(--bg-elevated)] border border-[var(--border)] border-l-2 border-l-[#2563eb] rounded-xl px-4 py-3">
                  <div className="flex space-x-1.5 items-center">
                    <div className="h-1.5 w-1.5 bg-[var(--accent)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="h-1.5 w-1.5 bg-[var(--accent)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="h-1.5 w-1.5 bg-[var(--accent)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-[var(--border)] flex-shrink-0">
            <form onSubmit={handleSubmit} className="flex items-center space-x-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about inventory, orders, alerts..."
                className="flex-1 h-10 bg-[var(--bg-elevated)] border border-[var(--border)] focus:border-[var(--accent)] rounded-lg px-3 text-[13px] text-[var(--text-primary)] placeholder-[#52525b] focus:outline-none focus:ring-1 focus:ring-[#2563eb] transition-colors"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-blue-900/20"
                style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}
              >
                <Send className="h-3.5 w-3.5 text-white" />
              </button>
            </form>
          </div>

        </div>
      )}
    </>
  );
};
