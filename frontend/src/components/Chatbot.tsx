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
  <div className="mt-2 overflow-x-auto rounded-md border border-[#1e2d45] max-w-full">
    <table className="text-[11px] w-full min-w-max">
      <thead>
        <tr className="bg-[#0b1120]">
          {tableData.headers.map((h, i) => (
            <th
              key={i}
              className="text-left px-3 py-2 text-[10px] font-semibold tracking-widest text-[#4a5f7a] uppercase whitespace-nowrap border-b border-[#1e2d45]"
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {tableData.rows.map((row, ri) => (
          <tr key={ri} className="border-t border-[#1a2840] hover:bg-[#0f1729] transition-colors">
            {row.map((cell, ci) => (
              <td key={ci} className="px-3 py-2 text-[#cbd5e1] whitespace-nowrap font-mono">
                {String(cell)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
    <div className="px-3 py-1.5 bg-[#0b1120] text-[10px] text-[#4a5f7a] border-t border-[#1e2d45] tracking-wide">
      {tableData.rows.length} records
    </div>
  </div>
);

const MessageBubble: React.FC<{ msg: Message }> = ({ msg }) => {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
      {!isUser && (
        <span className="mb-1 inline-flex items-center px-1.5 py-0.5 rounded-sm bg-[#1d4ed820] border border-[#1d4ed840] text-[9px] font-semibold text-[#3b82f6] tracking-widest uppercase">
          AI
        </span>
      )}
      <div
        className={`${
          isUser
            ? 'ml-8 bg-[#1d4ed820] border border-[#1d4ed840]'
            : 'mr-8 bg-[#0f1729] border border-[#1e2d45]'
        } rounded-lg p-3 text-[12px] leading-relaxed max-w-full`}
      >
        {msg.type !== 'text' && msg.tableData && (
          <div className="flex items-center space-x-1.5 mb-2">
            <Table className="h-3 w-3 text-[#3b82f6]" />
            <span className="text-[10px] font-semibold tracking-widest text-[#3b82f6] uppercase">
              Structured Data
            </span>
          </div>
        )}
        <p className={`whitespace-pre-wrap ${isUser ? 'text-[#cbd5e1]' : 'text-[#94a3b8]'}`}>
          {msg.content}
        </p>
        {msg.tableData && <DataTable tableData={msg.tableData} />}
      </div>
      <p className={`text-[9px] text-[#2d4060] mt-1 ${isUser ? 'text-right' : ''}`}>
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
        className="fixed bottom-6 right-6 z-30 h-7 w-7 rounded-md bg-[#1d4ed8] hover:bg-[#2563eb] border border-[#2563eb] flex items-center justify-center transition-colors"
        aria-label={open ? 'Close chat' : 'Open AI Assistant'}
      >
        <MessageSquare className="h-4 w-4 text-white" />
      </button>

      {/* Chat Panel */}
      {open && (
        <div className="fixed bottom-[72px] right-6 z-30 w-96 h-[520px] bg-[#0b1120] border border-[#1e2d45] rounded-lg shadow-2xl flex flex-col overflow-hidden animate-in fade-in-0 slide-in-from-bottom-2 duration-150">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2d45] flex-shrink-0">
            <div className="flex items-center space-x-2">
              <Cpu className="h-4 w-4 text-[#3b82f6] flex-shrink-0" />
              <span className="text-[13px] font-semibold text-white leading-none">
                WarehouseAI Assistant
              </span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm bg-[#1d4ed820] border border-[#1d4ed840] text-[9px] font-semibold text-[#3b82f6] tracking-widest uppercase leading-none">
                Gemini 2.0 Flash
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setMessages([messages[0]])}
                className="p-1.5 rounded-md hover:bg-[#0f1729] text-[#4a5f7a] hover:text-[#94a3b8] transition-colors"
                title="Clear history"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-md hover:bg-[#0f1729] text-[#4a5f7a] hover:text-[#94a3b8] transition-colors"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Quick Chips */}
          <div className="px-3 py-2 border-b border-[#111e35] flex-shrink-0">
            <div className="flex space-x-1.5 overflow-x-auto pb-0.5 scrollbar-none">
              {QUICK_QUERIES.map((q) => {
                const Icon = q.icon;
                return (
                  <button
                    key={q.label}
                    onClick={() => sendMessage(q.query)}
                    disabled={loading}
                    className="flex items-center space-x-1 text-[10px] font-medium px-2.5 py-1 rounded-sm border border-[#1e2d45] bg-[#0f1729] text-[#94a3b8] hover:border-[#3b82f6] hover:text-[#60a5fa] whitespace-nowrap flex-shrink-0 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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
                <span className="mb-1 inline-flex items-center px-1.5 py-0.5 rounded-sm bg-[#1d4ed820] border border-[#1d4ed840] text-[9px] font-semibold text-[#3b82f6] tracking-widest uppercase">
                  AI
                </span>
                <div className="mr-8 bg-[#0f1729] border border-[#1e2d45] rounded-lg px-4 py-3">
                  <div className="flex space-x-1.5 items-center">
                    <div className="h-1.5 w-1.5 bg-[#3b82f6] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="h-1.5 w-1.5 bg-[#3b82f6] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="h-1.5 w-1.5 bg-[#3b82f6] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-[#1e2d45] flex-shrink-0">
            <form onSubmit={handleSubmit} className="flex items-center space-x-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about inventory, orders, alerts..."
                className="flex-1 bg-[#070d19] border border-[#1e2d45] focus:border-[#243552] rounded-md px-3 py-2 text-[12px] text-white placeholder-[#4a5f7a] focus:outline-none transition-colors"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="h-8 w-8 rounded-md bg-[#1d4ed8] hover:bg-[#2563eb] border border-[#2563eb] flex items-center justify-center flex-shrink-0 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
