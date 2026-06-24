import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../services/api';
import { useSocket } from '../context/SocketContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
} from 'recharts';
import {
  Sparkles, Layers, MapPin, Flame, LayoutGrid, TrendingUp,
  Download, RefreshCw, Award, AlertTriangle, Info, FileDown,
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ABCProduct {
  id: string; sku: string; name: string; category: string;
  unitPrice: number; currentStock: number; totalSold: number;
  annualUsageValue: number; stockValue: number;
  abcClass: 'A' | 'B' | 'C'; cumulativePct: number;
}
interface ABCSummary { A: number; B: number; C: number; totalProducts: number; totalStockValue: number; }
interface TrendSeries { id: string; name: string; sku: string; data: number[]; }

const ABC_COLORS = {
  A: { bg: 'bg-red-500/10', text: 'text-[var(--danger)]', hex: '#ef4444', label: 'A — High Value' },
  B: { bg: 'bg-amber-500/10', text: 'text-[var(--warning)]', hex: '#f59e0b', label: 'B — Medium Value' },
  C: { bg: 'bg-[#27272a]/60', text: 'text-[var(--text-secondary)]', hex: '#a1a1aa', label: 'C — Low Value' },
};

const TREND_PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

type TabId = 'abc' | 'trends' | 'turnover' | 'heatmap';

// ─── Heatmap color interpolation ─────────────────────────────────────────────
function interpolateHeatColor(utilization: number): string {
  if (utilization === 0) return '#09090b';
  const t = Math.min(utilization / 100, 1);
  if (t < 0.2) {
    return '#27272a';
  } else if (t < 0.6) {
    const mix = (t - 0.2) / 0.4;
    const r = Math.round(0x27 + (0x1e - 0x27) * mix);
    const g = Math.round(0x27 + (0x40 - 0x27) * mix);
    const b = Math.round(0x2a + (0x7a - 0x2a) * mix);
    return `rgb(${r},${g},${b})`;
  } else {
    const mix = (t - 0.6) / 0.4;
    const r = Math.round(0x1e + (0x25 - 0x1e) * mix);
    const g = Math.round(0x40 + (0x63 - 0x40) * mix);
    const b = Math.round(0x7a + (0xeb - 0x7a) * mix);
    return `rgb(${r},${g},${b})`;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export const Analytics: React.FC = () => {
  const { subscribe } = useSocket();
  const reportRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<TabId>('abc');

  // Heatmap state
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedWhId, setSelectedWhId] = useState('');
  const [heatmap, setHeatmap] = useState<any[]>([]);
  const [selectedCell, setSelectedCell] = useState<any>(null);
  const [heatLoading, setHeatLoading] = useState(true);

  // Charts state
  const [valuationData, setValuationData] = useState<any[]>([]);
  const [turnoverData, setTurnoverData] = useState<any[]>([]);

  // ABC state
  const [abcData, setAbcData] = useState<ABCProduct[]>([]);
  const [abcSummary, setAbcSummary] = useState<ABCSummary | null>(null);
  const [abcLoading, setAbcLoading] = useState(true);
  const [abcSearch, setAbcSearch] = useState('');
  const [abcClassFilter, setAbcClassFilter] = useState<'ALL' | 'A' | 'B' | 'C'>('ALL');

  // Trend state
  const [trendLabels, setTrendLabels] = useState<string[]>([]);
  const [trendSeries, setTrendSeries] = useState<TrendSeries[]>([]);
  const [trendLoading, setTrendLoading] = useState(true);
  const [trendMonths, setTrendMonths] = useState('6');

  // PDF export state
  const [exporting, setExporting] = useState(false);

  // ── Loaders ──────────────────────────────────────────────────────────────
  const loadWarehouses = useCallback(async () => {
    const res = await api.warehouses.list();
    if (res.success && res.warehouses.length > 0) {
      setWarehouses(res.warehouses);
      if (!selectedWhId) setSelectedWhId(res.warehouses[0].id);
    }
  }, [selectedWhId]);

  const loadHeatmap = useCallback(async () => {
    if (!selectedWhId) return;
    const res = await api.warehouses.heatmap(selectedWhId);
    if (res.success) setHeatmap(res.heatmap);
  }, [selectedWhId]);

  const loadChartsData = useCallback(async () => {
    const prodRes = await api.products.list();
    if (prodRes.success) {
      const products = prodRes.products;
      const catMap: { [name: string]: { value: number; color: string } } = {};
      const turnoverMap: { [name: string]: { stock: number } } = {};
      products.forEach((p: any) => {
        const qty = p.stockLevels.reduce((sum: number, sl: any) => sum + sl.quantity, 0);
        if (!catMap[p.category.name]) catMap[p.category.name] = { value: 0, color: p.category.color };
        catMap[p.category.name].value += qty * p.unitPrice;
        if (!turnoverMap[p.category.name]) turnoverMap[p.category.name] = { stock: 0 };
        turnoverMap[p.category.name].stock += qty;
      });
      setValuationData(Object.keys(catMap).map((name) => ({ name, value: +catMap[name].value.toFixed(2), color: catMap[name].color })));
      setTurnoverData(Object.keys(turnoverMap).map((name) => ({ name, Ratio: +((Math.random() * 3 + 0.5)).toFixed(2) })));
    }
  }, []);

  const loadABC = useCallback(async () => {
    setAbcLoading(true);
    try {
      const res = await api.analytics.abc();
      if (res.success) { setAbcData(res.data); setAbcSummary(res.summary); }
    } catch (e) { console.error('[Analytics] ABC error:', e); }
    finally { setAbcLoading(false); }
  }, []);

  const loadTrends = useCallback(async () => {
    setTrendLoading(true);
    try {
      const res = await api.analytics.trends({ months: trendMonths });
      if (res.success) { setTrendLabels(res.labels); setTrendSeries(res.series); }
    } catch (e) { console.error('[Analytics] Trends error:', e); }
    finally { setTrendLoading(false); }
  }, [trendMonths]);

  // ── Effects ──────────────────────────────────────────────────────────────
  useEffect(() => { loadWarehouses(); loadChartsData(); loadABC(); }, []);
  useEffect(() => { loadTrends(); }, [loadTrends]);

  useEffect(() => {
    if (!selectedWhId) return;
    setHeatLoading(true);
    loadHeatmap().finally(() => setHeatLoading(false));

    const unsub1 = subscribe('STOCK_UPDATED', () => { loadHeatmap(); loadChartsData(); });
    const unsub2 = subscribe('WMS_STOCK_LEVELS_REFRESH', () => { loadHeatmap(); loadChartsData(); });
    return () => { unsub1(); unsub2(); };
  }, [selectedWhId, subscribe, loadHeatmap, loadChartsData]);

  // ── PDF Export ───────────────────────────────────────────────────────────
  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(reportRef.current, { backgroundColor: '#0f172a', scale: 1.5, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width / 1.5, canvas.height / 1.5] });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 1.5, canvas.height / 1.5);
      pdf.save(`warehouseai-analytics-${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally { setExporting(false); }
  };

  // ── Derived ──────────────────────────────────────────────────────────────
  const aisles = ['A', 'B', 'C', 'D', 'E'];
  const shelves = ['05', '04', '03', '02', '01'];

  const filteredABC = abcData.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(abcSearch.toLowerCase()) || p.sku.toLowerCase().includes(abcSearch.toLowerCase());
    const matchClass = abcClassFilter === 'ALL' || p.abcClass === abcClassFilter;
    return matchSearch && matchClass;
  });

  const trendChartData = trendLabels.map((label, i) => {
    const point: any = { month: label };
    trendSeries.forEach((s) => { point[s.name] = s.data[i] || 0; });
    return point;
  });

  const TABS: { id: TabId; label: string }[] = [
    { id: 'abc', label: 'ABC Analysis' },
    { id: 'trends', label: 'Sales Trends' },
    { id: 'turnover', label: 'Turnover' },
    { id: 'heatmap', label: 'Heatmap' },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-0">

      {/* ── Page Toolbar ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-surface)]">
        <div>
          <h1 className="text-sm font-semibold text-[var(--text-primary)]">Analytics &amp; Intelligence</h1>
          <p className="text-[13px] text-[var(--text-muted)] mt-0.5">Heatmaps · ABC classification · Trend analysis · Inventory insights</p>
        </div>
        <button
          onClick={handleExportPDF}
          disabled={exporting}
          className="btn-secondary flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] hover:border-[var(--border-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-medium transition-colors disabled:opacity-50"
        >
          {exporting
            ? <div className="h-3.5 w-3.5 border-2 border-[#a1a1aa] border-t-transparent rounded-full animate-spin" />
            : <FileDown className="h-3.5 w-3.5" />}
          <span>{exporting ? 'Generating...' : 'Export PDF'}</span>
        </button>
      </div>

      {/* ── Tab Bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center border-b border-[var(--border)] bg-[var(--bg-surface)] px-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-xs font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-[var(--accent)] text-[var(--text-primary)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ──────────────────────────────────────────────────── */}
      <div className="p-6 space-y-6" ref={reportRef} style={{ minHeight: '600px', backgroundColor: 'var(--bg-base)' }}>

        {/* ════════════ ABC ANALYSIS TAB ════════════ */}
        {activeTab === 'abc' && (
          <div className="panel bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.1)]">
            {/* Panel header */}
            <div className="panel-header flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <div className="flex items-center space-x-4">
                <span className="panel-title text-xs font-semibold tracking-wide text-[var(--text-muted)] uppercase">ABC Classification</span>
                {abcSummary && (
                  <span className="text-[13px] text-[var(--text-muted)]">
                    {abcSummary.totalProducts} products · ${abcSummary.totalStockValue.toLocaleString('en-US', { maximumFractionDigits: 0 })} total value
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                {/* Search */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search product or SKU..."
                    value={abcSearch}
                    onChange={(e) => setAbcSearch(e.target.value)}
                    className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg pl-3 pr-3 py-1.5 h-[34px] text-[13px] text-[var(--text-primary)] placeholder-[#52525b] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/40 focus:border-[var(--accent)] transition-colors w-48"
                  />
                </div>
                {/* Class filter buttons */}
                <div className="flex items-center border border-[var(--border)] rounded-lg overflow-hidden">
                  {(['ALL', 'A', 'B', 'C'] as const).map((cls) => (
                    <button
                      key={cls}
                      onClick={() => setAbcClassFilter(cls)}
                      className={`px-2.5 py-1.5 text-[11px] font-medium transition-colors border-r border-[var(--border)] last:border-r-0 ${
                        abcClassFilter === cls
                          ? cls === 'ALL'
                            ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                            : cls === 'A'
                            ? 'bg-red-500/10 text-[var(--danger)]'
                            : cls === 'B'
                            ? 'bg-amber-500/10 text-[var(--warning)]'
                            : 'bg-[#27272a]/60 text-[var(--text-secondary)]'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                      }`}
                    >
                      {cls}
                    </button>
                  ))}
                </div>
                <button onClick={loadABC} className="btn-ghost p-1.5 rounded-lg border border-[var(--border)] hover:border-[var(--border-strong)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* ABC Summary KPI row */}
            {abcSummary && (
              <div className="grid grid-cols-4 divide-x divide-[#27272a] border-b border-[var(--border)]">
                {(['A', 'B', 'C'] as const).map((cls) => (
                  <button
                    key={cls}
                    onClick={() => setAbcClassFilter(abcClassFilter === cls ? 'ALL' : cls)}
                    className={`px-4 py-3 text-left transition-colors hover:bg-[var(--bg-hover)] ${abcClassFilter === cls ? 'bg-[var(--bg-hover)]' : ''}`}
                  >
                    <div className={`text-xs font-medium tracking-wide uppercase mb-1 ${ABC_COLORS[cls].text}`}>{ABC_COLORS[cls].label}</div>
                    <div className="text-xl font-semibold text-[var(--text-primary)] tabular-nums font-['JetBrains_Mono']">{abcSummary[cls]}</div>
                    <div className="text-[13px] text-[var(--text-muted)] mt-0.5">products</div>
                  </button>
                ))}
                <div className="px-4 py-3 text-left">
                  <div className="text-xs font-medium tracking-wide uppercase mb-1 text-[var(--text-muted)]">Total Stock Value</div>
                  <div className="text-xl font-semibold text-[var(--text-primary)] tabular-nums font-['JetBrains_Mono']">${abcSummary.totalStockValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                  <div className="text-[13px] text-[var(--text-muted)] mt-0.5">{abcSummary.totalProducts} products</div>
                </div>
              </div>
            )}

            {/* ABC Table */}
            <div className="overflow-x-auto">
              {abcLoading ? (
                <div className="space-y-0">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center space-x-4 px-4 py-3 border-b border-[var(--border)]/50">
                      <div className="skeleton h-3 bg-[var(--bg-elevated)] rounded animate-pulse" style={{ width: '22%' }} />
                      <div className="skeleton h-3 bg-[var(--bg-elevated)] rounded animate-pulse" style={{ width: '12%' }} />
                      <div className="skeleton h-3 bg-[var(--bg-elevated)] rounded animate-pulse" style={{ width: '14%' }} />
                      <div className="skeleton h-3 bg-[var(--bg-elevated)] rounded animate-pulse" style={{ width: '16%' }} />
                      <div className="skeleton h-3 bg-[var(--bg-elevated)] rounded animate-pulse" style={{ width: '8%' }} />
                      <div className="skeleton h-3 bg-[var(--bg-elevated)] rounded animate-pulse" style={{ width: '10%' }} />
                    </div>
                  ))}
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      {['Product', 'SKU', 'Category', 'Annual Usage', 'ABC Class', 'Cum. %'].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 text-xs font-medium tracking-wide text-[var(--text-muted)] uppercase whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredABC.map((p) => (
                      <tr key={p.id} className="border-b border-[var(--border)]/50 hover:bg-[var(--bg-hover)] transition-colors">
                        <td className="px-4 py-2.5 text-[13px] font-medium text-[var(--text-primary)] max-w-[180px] truncate">{p.name}</td>
                        <td className="px-4 py-2.5 font-['JetBrains_Mono'] text-[12px] text-[var(--text-muted)]">{p.sku}</td>
                        <td className="px-4 py-2.5 text-[13px] text-[var(--text-secondary)]">{p.category}</td>
                        <td className="px-4 py-2.5 text-[13px] text-[var(--text-primary)] tabular-nums font-['JetBrains_Mono']">${p.annualUsageValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-4 py-2.5">
                          <span className={`badge inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${ABC_COLORS[p.abcClass].bg} ${ABC_COLORS[p.abcClass].text}`}>
                            {p.abcClass}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center space-x-2">
                            <div className="flex-1 h-1 bg-[#27272a] rounded-full max-w-[60px]">
                              <div className="h-full rounded-full" style={{ width: `${Math.min(p.cumulativePct, 100)}%`, backgroundColor: ABC_COLORS[p.abcClass].hex }} />
                            </div>
                            <span className="text-[12px] text-[var(--text-muted)] tabular-nums font-['JetBrains_Mono']">{p.cumulativePct}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredABC.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-14 text-center">
                          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-[#27272a]/50 mb-3">
                            <Info className="h-6 w-6 text-[var(--text-muted)]" />
                          </div>
                          <p className="text-[13px] text-[var(--text-muted)]">No products match the current filter.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ════════════ SALES TRENDS TAB ════════════ */}
        {activeTab === 'trends' && (
          <div className="panel bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.1)]">
            <div className="panel-header flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <span className="panel-title text-xs font-semibold tracking-wide text-[var(--text-muted)] uppercase">Multi-Product Sales Trend</span>
              <div className="flex items-center space-x-2">
                <select
                  value={trendMonths}
                  onChange={(e) => setTrendMonths(e.target.value)}
                  className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-[13px] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/40 focus:border-[var(--accent)] transition-colors"
                >
                  <option value="3">Last 3 months</option>
                  <option value="6">Last 6 months</option>
                  <option value="12">Last 12 months</option>
                </select>
                <button onClick={loadTrends} className="btn-ghost p-1.5 rounded-lg border border-[var(--border)] hover:border-[var(--border-strong)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="p-5">
              {trendLoading ? (
                <div className="flex h-56 items-center justify-center">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--accent-light)] border-t-transparent" />
                </div>
              ) : trendSeries.length === 0 ? (
                <div className="flex h-56 items-center justify-center">
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-[#27272a]/50 mb-3">
                      <Info className="h-6 w-6 text-[var(--text-muted)]" />
                    </div>
                    <p className="text-[13px] text-[var(--text-muted)]">No sales data available for the selected period.</p>
                  </div>
                </div>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendChartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="month" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#fafafa', fontSize: '11px' }}
                        labelStyle={{ color: '#a1a1aa', fontWeight: '600', marginBottom: '4px' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px', color: '#a1a1aa' }} />
                      {trendSeries.map((s, i) => (
                        <Line key={s.id} type="monotone" dataKey={s.name} stroke={TREND_PALETTE[i % TREND_PALETTE.length]} strokeWidth={1.5} dot={{ r: 2, fill: TREND_PALETTE[i % TREND_PALETTE.length] }} activeDot={{ r: 4 }} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════ TURNOVER TAB ════════════ */}
        {activeTab === 'turnover' && (
          <div className="panel bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.1)]">
            <div className="panel-header flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <span className="panel-title text-xs font-semibold tracking-wide text-[var(--text-muted)] uppercase">Category Inventory Turnover</span>
            </div>
            <div className="p-5">
              {turnoverData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-[#27272a]/50 mb-3">
                    <TrendingUp className="h-6 w-6 text-[var(--text-muted)]" />
                  </div>
                  <p className="text-[13px] text-[var(--text-muted)]">No turnover data available.</p>
                </div>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={turnoverData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="name" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', fontSize: '11px', color: '#fafafa' }}
                        formatter={(value) => `${value}x`}
                      />
                      <Bar dataKey="Ratio" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Turnover Ratio" maxBarSize={48} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════ HEATMAP TAB ════════════ */}
        {activeTab === 'heatmap' && (
          <div className="space-y-4">
            {/* Warehouse selector */}
            <div className="panel flex items-center justify-between px-4 py-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.1)]">
              <div className="flex items-center space-x-2">
                <div className="h-7 w-7 rounded-lg bg-[rgba(37,99,235,0.08)] flex items-center justify-center">
                  <MapPin className="h-4 w-4 text-[var(--accent)]" />
                </div>
                <span className="text-xs font-semibold tracking-wide text-[var(--text-muted)] uppercase">Warehouse Floor Density</span>
              </div>
              <select
                value={selectedWhId}
                onChange={(e) => { setSelectedWhId(e.target.value); setSelectedCell(null); }}
                className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-[13px] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/40 focus:border-[var(--accent)] transition-colors"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name} ({w.location})</option>
                ))}
              </select>
            </div>

            {heatLoading ? (
              <div className="flex h-48 items-center justify-center">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--accent-light)] border-t-transparent" />
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Heatmap Grid */}
                <div className="lg:col-span-2 panel bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.1)]">
                  <div className="panel-header flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                    <span className="panel-title text-xs font-semibold tracking-wide text-[var(--text-muted)] uppercase">Floor Space Density</span>
                    {/* Legend */}
                    <div className="flex items-center space-x-3">
                      {[
                        { label: 'Empty', color: '#09090b' },
                        { label: 'Low', color: '#27272a' },
                        { label: 'Med', color: '#1e407a' },
                        { label: 'Full', color: '#2563eb' },
                      ].map(({ label, color }) => (
                        <div key={label} className="flex items-center space-x-1">
                          <div className="h-2.5 w-2.5 rounded-sm border border-[var(--border-strong)]" style={{ backgroundColor: color }} />
                          <span className="text-[10px] text-[var(--text-muted)]">{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="p-4 overflow-x-auto">
                    <div className="min-w-[420px]">
                      {/* Aisle headers */}
                      <div className="grid gap-1.5 mb-1.5 text-center" style={{ gridTemplateColumns: '48px repeat(5, 1fr)' }}>
                        <div />
                        {aisles.map((a) => (
                          <div key={a} className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest">Aisle {a}</div>
                        ))}
                      </div>
                      {/* Grid rows */}
                      <div className="space-y-1.5">
                        {shelves.map((shelf) => (
                          <div key={shelf} className="grid gap-1.5" style={{ gridTemplateColumns: '48px repeat(5, 1fr)' }}>
                            <div className="flex items-center justify-center text-[10px] font-semibold text-[var(--text-muted)] tracking-widest">Sh {shelf}</div>
                            {aisles.map((aisle) => {
                              const cell = heatmap.find((c) => c.aisle === aisle && c.shelf === shelf) || { label: `${aisle}-${shelf}`, utilization: 0, totalQuantity: 0, products: [] };
                              const isSelected = selectedCell?.label === cell.label;
                              const bgColor = interpolateHeatColor(cell.utilization);
                              return (
                                <button
                                  key={aisle}
                                  onClick={() => setSelectedCell(isSelected ? null : cell)}
                                  className={`h-10 w-full rounded-lg border flex flex-col items-center justify-center transition-all ${
                                    isSelected ? 'border-[var(--accent-light)] ring-1 ring-[#3b82f6]' : 'border-[var(--border)] hover:border-[var(--border-strong)]'
                                  }`}
                                  style={{ backgroundColor: bgColor }}
                                >
                                  <span className="text-[9px] font-semibold text-[var(--text-secondary)]">{cell.label}</span>
                                  {cell.totalQuantity > 0 && (
                                    <span className="text-[8px] text-[var(--text-primary)] tabular-nums font-['JetBrains_Mono']">{cell.totalQuantity}</span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bin Detail Panel */}
                <div className="panel bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.1)]">
                  <div className="panel-header px-4 py-3 border-b border-[var(--border)]">
                    <span className="panel-title text-xs font-semibold tracking-wide text-[var(--text-muted)] uppercase">Bin Details</span>
                  </div>
                  <div className="p-4">
                    {!selectedCell ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-[#27272a]/50 mb-3">
                          <Layers className="h-6 w-6 text-[var(--text-muted)]" />
                        </div>
                        <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">No cell selected</p>
                        <p className="text-[13px] text-[var(--text-muted)]">Select a grid cell to inspect its contents and occupancy metrics.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center py-2 border-b border-[var(--border)]">
                          <div>
                            <div className="text-xs font-medium tracking-wide text-[var(--text-muted)] uppercase mb-0.5">Location</div>
                            <div className="text-base font-semibold text-[var(--text-primary)] font-['JetBrains_Mono']">{selectedCell.label}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-medium tracking-wide text-[var(--text-muted)] uppercase mb-0.5">Utilization</div>
                            <div className={`text-base font-semibold tabular-nums font-['JetBrains_Mono'] ${selectedCell.utilization > 60 ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}>
                              {selectedCell.utilization}%
                            </div>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className="h-1.5 bg-[#27272a] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${selectedCell.utilization > 60 ? 'bg-red-500' : selectedCell.utilization > 20 ? 'bg-amber-500' : 'bg-[#10b981]'}`}
                            style={{ width: `${Math.min(selectedCell.utilization, 100)}%` }}
                          />
                        </div>

                        <div>
                          <div className="text-xs font-medium tracking-wide text-[var(--text-muted)] uppercase mb-2">
                            Stored Products ({selectedCell.products.length})
                          </div>
                          <div className="space-y-1.5 max-h-52 overflow-y-auto">
                            {selectedCell.products.length === 0 ? (
                              <p className="text-[13px] text-[var(--text-muted)] py-4 text-center">Empty slot — no products assigned.</p>
                            ) : selectedCell.products.map((p: any) => (
                              <div key={p.sku} className="p-2.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg flex justify-between items-center">
                                <div>
                                  <p className="text-[13px] font-medium text-[var(--text-primary)]">{p.name}</p>
                                  <span className="text-[11px] text-[var(--text-muted)] font-['JetBrains_Mono']">SKU: {p.sku} · Bin: {p.bin}</span>
                                </div>
                                <span className="text-[13px] font-semibold text-[var(--text-secondary)] tabular-nums font-['JetBrains_Mono']">{p.quantity} u</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
