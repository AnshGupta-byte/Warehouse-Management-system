import React, { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import {
  MessageSquare, X, Send, Sparkles, ChevronDown,
  Bot, User, Table, AlertTriangle, Package,
  BarChart2, ShoppingCart, Boxes,
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
  <div className="mt-2 overflow-x-auto rounded-lg border border-slate-700 max-w-full">
    <table className="text-xs w-full min-w-max">
      <thead>
        <tr className="bg-slate-800/80">
          {tableData.headers.map((h, i) => (
            <th key={i} className="text-left px-3 py-2 text-slate-400 font-semibold uppercase tracking-wider whitespace-nowrap">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {tableData.rows.map((row, ri) => (
          <tr key={ri} className="border-t border-slate-700/50 hover:bg-slate-700/20 transition-colors">
            {row.map((cell, ci) => (
              <td key={ci} className="px-3 py-2 text-slate-300 whitespace-nowrap">{String(cell)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
    <div className="px-3 py-1.5 bg-slate-800/50 text-[10px] text-slate-500 border-t border-slate-700">
      {tableData.rows.length} records
    </div>
  </div>
);

const MessageBubble: React.FC<{ msg: Message }> = ({ msg }) => {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 animate-in fade-in-0 slide-in-from-bottom-2`}>
      {!isUser && (
        <div className="h-7 w-7 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
          <Bot className="h-3.5 w-3.5 text-indigo-400" />
        </div>
      )}
      <div className={`max-w-[85%] ${isUser ? 'order-1' : ''}`}>
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-indigo-600 text-white rounded-br-sm'
            : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-bl-sm'
        }`}>
          {msg.type !== 'text' && msg.tableData && (
            <div className="flex items-center space-x-1.5 mb-2 text-indigo-400">
              <Table className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold uppercase tracking-wider">Structured Data</span>
            </div>
          )}
          <p className="whitespace-pre-wrap">{msg.content}</p>
          {msg.tableData && <DataTable tableData={msg.tableData} />}
        </div>
        <p className={`text-[10px] text-slate-600 mt-1 ${isUser ? 'text-right' : ''}`}>
          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
      {isUser && (
        <div className="h-7 w-7 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center ml-2 flex-shrink-0 mt-1">
          <User className="h-3.5 w-3.5 text-slate-300" />
        </div>
      )}
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
        className={`fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 ${
          open ? 'bg-slate-700 border-slate-600' : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/30'
        } border`}
        aria-label={open ? 'Close chat' : 'Open AI Assistant'}
      >
        {open ? (
          <ChevronDown className="h-6 w-6 text-white" />
        ) : (
          <div className="relative">
            <MessageSquare className="h-6 w-6 text-white" />
            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-400 animate-pulse ring-2 ring-slate-950" />
          </div>
        )}
      </button>

      {/* Chat Window */}
      {open && (
        <div className="fixed bottom-24 right-6 z-40 w-[420px] max-h-[620px] bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in-0 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm flex-shrink-0">
            <div className="flex items-center space-x-3">
              <div className="relative h-8 w-8 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-indigo-400" />
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-1 ring-slate-900" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">WarehouseAI Assistant</p>
                <p className="text-[10px] text-emerald-400 font-medium">● Online · Gemini Powered</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setMessages([messages[0]])}
                className="text-[10px] text-slate-500 hover:text-slate-300 px-2 py-1 rounded hover:bg-slate-800 transition-all"
              >
                Clear
              </button>
              <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-0 min-h-0" style={{ maxHeight: '380px' }}>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
            {loading && (
              <div className="flex justify-start mb-4">
                <div className="h-7 w-7 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mr-2 flex-shrink-0">
                  <Bot className="h-3.5 w-3.5 text-indigo-400" />
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-sm px-4 py-3">
                  <div className="flex space-x-1.5 items-center">
                    <div className="h-1.5 w-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="h-1.5 w-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="h-1.5 w-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Query Chips */}
          <div className="px-4 pb-2 flex-shrink-0">
            <div className="flex space-x-2 overflow-x-auto pb-1 scrollbar-thin">
              {QUICK_QUERIES.map((q) => {
                const Icon = q.icon;
                return (
                  <button
                    key={q.label}
                    onClick={() => sendMessage(q.query)}
                    disabled={loading}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 hover:border-indigo-500/50 hover:bg-slate-700 text-xs text-slate-300 hover:text-white transition-all whitespace-nowrap flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Icon className="h-3 w-3 text-indigo-400" />
                    <span>{q.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Input */}
          <div className="px-4 pb-4 flex-shrink-0">
            <form onSubmit={handleSubmit} className="flex items-center space-x-2 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/20 transition-all">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about inventory, orders, alerts..."
                className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="h-7 w-7 rounded-lg bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
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
