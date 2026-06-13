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
  A: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20', hex: '#ef4444', label: 'A — High Value' },
  B: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', hex: '#f59e0b', label: 'B — Medium Value' },
  C: { bg: 'bg-[#1e2d45]/60', text: 'text-[#4a5f7a]', border: 'border-[#1e2d45]', hex: '#4a5f7a', label: 'C — Low Value' },
};

const TREND_PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

type TabId = 'abc' | 'trends' | 'turnover' | 'heatmap';

// ─── Heatmap color interpolation ─────────────────────────────────────────────
function interpolateHeatColor(utilization: number): string {
  if (utilization === 0) return '#0b1120';
  // low (#1e2d45) → mid (#1d4ed8 at 60%) → full (#1d4ed8)
  const t = Math.min(utilization / 100, 1);
  if (t < 0.2) {
    // empty → low: #1e2d45
    return '#1e2d45';
  } else if (t < 0.6) {
    // low → medium
    const mix = (t - 0.2) / 0.4;
    const r = Math.round(0x1e + (0x1e - 0x1e) * mix);
    const g = Math.round(0x2d + (0x4a - 0x2d) * mix);
    const b = Math.round(0x45 + (0x6e - 0x45) * mix);
    return `rgb(${r},${g},${b})`;
  } else {
    // medium → full: #1d4ed8
    const mix = (t - 0.6) / 0.4;
    const r = Math.round(0x1e + (0x1d - 0x1e) * mix);
    const g = Math.round(0x4a + (0x4e - 0x4a) * mix);
    const b = Math.round(0x6e + (0xd8 - 0x6e) * mix);
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
    <div className="space-y-0" ref={reportRef}>

      {/* ── Page Toolbar ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2d45] bg-[#0b1120]">
        <div>
          <h1 className="text-sm font-semibold text-white">Analytics &amp; Intelligence</h1>
          <p className="text-[11px] text-[#4a5f7a] mt-0.5">Heatmaps · ABC classification · Trend analysis · Inventory insights</p>
        </div>
        <button
          onClick={handleExportPDF}
          disabled={exporting}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md border border-[#1e2d45] bg-[#0f1729] hover:border-[#243552] text-[#94a3b8] hover:text-white text-xs font-medium transition-colors disabled:opacity-50"
        >
          {exporting
            ? <div className="h-3.5 w-3.5 border-2 border-[#94a3b8] border-t-transparent rounded-full animate-spin" />
            : <FileDown className="h-3.5 w-3.5" />}
          <span>{exporting ? 'Generating...' : 'Export PDF'}</span>
        </button>
      </div>

      {/* ── Tab Bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center border-b border-[#1e2d45] bg-[#0b1120] px-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-xs font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-[#3b82f6] text-white'
                : 'border-transparent text-[#4a5f7a] hover:text-[#94a3b8]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ──────────────────────────────────────────────────── */}
      <div className="p-6 space-y-6">

        {/* ════════════ ABC ANALYSIS TAB ════════════ */}
        {activeTab === 'abc' && (
          <div className="bg-[#0b1120] border border-[#1e2d45] rounded-md overflow-hidden">
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2d45] bg-[#0b1120]">
              <div className="flex items-center space-x-4">
                <span className="text-[10px] font-semibold tracking-widest text-[#4a5f7a] uppercase">ABC Classification</span>
                {abcSummary && (
                  <span className="text-[10px] text-[#4a5f7a]">
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
                    className="bg-[#0f1729] border border-[#1e2d45] rounded-md pl-3 pr-3 py-1 text-[11px] text-white placeholder-[#4a5f7a] focus:outline-none focus:border-[#243552] transition-colors w-48"
                  />
                </div>
                {/* Class filter buttons */}
                <div className="flex items-center border border-[#1e2d45] rounded-md overflow-hidden">
                  {(['ALL', 'A', 'B', 'C'] as const).map((cls) => (
                    <button
                      key={cls}
                      onClick={() => setAbcClassFilter(cls)}
                      className={`px-2.5 py-1 text-[11px] font-medium transition-colors border-r border-[#1e2d45] last:border-r-0 ${
                        abcClassFilter === cls
                          ? cls === 'ALL'
                            ? 'bg-[#0f1729] text-white'
                            : cls === 'A'
                            ? 'bg-red-500/10 text-red-400'
                            : cls === 'B'
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-[#1e2d45]/60 text-[#94a3b8]'
                          : 'text-[#4a5f7a] hover:text-[#94a3b8]'
                      }`}
                    >
                      {cls}
                    </button>
                  ))}
                </div>
                <button onClick={loadABC} className="p-1.5 rounded-md border border-[#1e2d45] hover:border-[#243552] text-[#4a5f7a] hover:text-[#94a3b8] transition-colors">
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* ABC Summary KPI row */}
            {abcSummary && (
              <div className="grid grid-cols-4 divide-x divide-[#1e2d45] border-b border-[#1e2d45]">
                {(['A', 'B', 'C'] as const).map((cls) => (
                  <button
                    key={cls}
                    onClick={() => setAbcClassFilter(abcClassFilter === cls ? 'ALL' : cls)}
                    className={`px-4 py-3 text-left transition-colors hover:bg-[#0f1729] ${abcClassFilter === cls ? 'bg-[#0f1729]' : ''}`}
                  >
                    <div className={`text-[10px] font-semibold tracking-widest uppercase mb-1 ${ABC_COLORS[cls].text}`}>{ABC_COLORS[cls].label}</div>
                    <div className="text-xl font-semibold text-white tabular-nums">{abcSummary[cls]}</div>
                    <div className="text-[10px] text-[#4a5f7a] mt-0.5">products</div>
                  </button>
                ))}
                <div className="px-4 py-3 text-left">
                  <div className="text-[10px] font-semibold tracking-widest uppercase mb-1 text-[#4a5f7a]">Total Stock Value</div>
                  <div className="text-xl font-semibold text-white tabular-nums">${abcSummary.totalStockValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                  <div className="text-[10px] text-[#4a5f7a] mt-0.5">{abcSummary.totalProducts} products</div>
                </div>
              </div>
            )}

            {/* ABC Table */}
            <div className="overflow-x-auto">
              {abcLoading ? (
                <div className="flex h-32 items-center justify-center">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#3b82f6] border-t-transparent" />
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#1e2d45] bg-[#0b1120]">
                      {['Product', 'SKU', 'Category', 'Annual Usage', 'ABC Class', 'Cum. %'].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold tracking-widest text-[#4a5f7a] uppercase whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredABC.map((p) => (
                      <tr key={p.id} className="border-b border-[#1e2d45]/50 hover:bg-[#0f1729] transition-colors">
                        <td className="px-4 py-2.5 text-[12px] font-medium text-[#cbd5e1] max-w-[180px] truncate">{p.name}</td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-[#4a5f7a]">{p.sku}</td>
                        <td className="px-4 py-2.5 text-[11px] text-[#94a3b8]">{p.category}</td>
                        <td className="px-4 py-2.5 text-[12px] text-[#cbd5e1] tabular-nums">${p.annualUsageValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${ABC_COLORS[p.abcClass].bg} ${ABC_COLORS[p.abcClass].text} ${ABC_COLORS[p.abcClass].border}`}>
                            {p.abcClass}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center space-x-2">
                            <div className="flex-1 h-1 bg-[#1e2d45] rounded-full max-w-[60px]">
                              <div className="h-full rounded-full" style={{ width: `${Math.min(p.cumulativePct, 100)}%`, backgroundColor: ABC_COLORS[p.abcClass].hex }} />
                            </div>
                            <span className="text-[11px] text-[#4a5f7a] tabular-nums">{p.cumulativePct}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredABC.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-[11px] text-[#4a5f7a]">No products match the current filter.</td>
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
          <div className="bg-[#0b1120] border border-[#1e2d45] rounded-md overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2d45]">
              <span className="text-[10px] font-semibold tracking-widest text-[#4a5f7a] uppercase">Multi-Product Sales Trend</span>
              <div className="flex items-center space-x-2">
                <select
                  value={trendMonths}
                  onChange={(e) => setTrendMonths(e.target.value)}
                  className="bg-[#0f1729] border border-[#1e2d45] rounded-md px-2.5 py-1 text-[11px] text-[#cbd5e1] focus:outline-none focus:border-[#243552] transition-colors"
                >
                  <option value="3">Last 3 months</option>
                  <option value="6">Last 6 months</option>
                  <option value="12">Last 12 months</option>
                </select>
                <button onClick={loadTrends} className="p-1.5 rounded-md border border-[#1e2d45] hover:border-[#243552] text-[#4a5f7a] hover:text-[#94a3b8] transition-colors">
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="p-5">
              {trendLoading ? (
                <div className="flex h-56 items-center justify-center">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#3b82f6] border-t-transparent" />
                </div>
              ) : trendSeries.length === 0 ? (
                <div className="flex h-56 items-center justify-center">
                  <div className="text-center">
                    <Info className="h-8 w-8 text-[#1e2d45] mx-auto mb-2" />
                    <p className="text-[11px] text-[#4a5f7a]">No sales data available for the selected period.</p>
                  </div>
                </div>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendChartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" />
                      <XAxis dataKey="month" stroke="#4a5f7a" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#4a5f7a" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0b1120', border: '1px solid #1e2d45', borderRadius: '4px', color: '#cbd5e1', fontSize: '11px' }}
                        labelStyle={{ color: '#94a3b8', fontWeight: '600', marginBottom: '4px' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px', color: '#94a3b8' }} />
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
          <div className="bg-[#0b1120] border border-[#1e2d45] rounded-md overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2d45]">
              <span className="text-[10px] font-semibold tracking-widest text-[#4a5f7a] uppercase">Category Inventory Turnover</span>
            </div>
            <div className="p-5">
              {turnoverData.length === 0 ? (
                <p className="text-[11px] text-[#4a5f7a] py-12 text-center">No turnover data available.</p>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={turnoverData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" />
                      <XAxis dataKey="name" stroke="#4a5f7a" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#4a5f7a" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0b1120', border: '1px solid #1e2d45', borderRadius: '4px', fontSize: '11px', color: '#cbd5e1' }}
                        formatter={(value) => `${value}x`}
                      />
                      <Bar dataKey="Ratio" fill="#3b82f6" radius={[2, 2, 0, 0]} name="Turnover Ratio" maxBarSize={48} />
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
            <div className="flex items-center justify-between px-4 py-3 bg-[#0b1120] border border-[#1e2d45] rounded-md">
              <div className="flex items-center space-x-2">
                <MapPin className="h-3.5 w-3.5 text-[#4a5f7a]" />
                <span className="text-[10px] font-semibold tracking-widest text-[#4a5f7a] uppercase">Warehouse Floor Density</span>
              </div>
              <select
                value={selectedWhId}
                onChange={(e) => { setSelectedWhId(e.target.value); setSelectedCell(null); }}
                className="bg-[#0f1729] border border-[#1e2d45] rounded-md px-2.5 py-1 text-[11px] text-[#cbd5e1] focus:outline-none focus:border-[#243552] transition-colors"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name} ({w.location})</option>
                ))}
              </select>
            </div>

            {heatLoading ? (
              <div className="flex h-48 items-center justify-center">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#3b82f6] border-t-transparent" />
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Heatmap Grid */}
                <div className="lg:col-span-2 bg-[#0b1120] border border-[#1e2d45] rounded-md overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2d45]">
                    <span className="text-[10px] font-semibold tracking-widest text-[#4a5f7a] uppercase">Floor Space Density</span>
                    {/* Legend */}
                    <div className="flex items-center space-x-3">
                      {[
                        { label: 'Empty', color: '#0b1120' },
                        { label: 'Low', color: '#1e2d45' },
                        { label: 'Med', color: '#1e4a6e' },
                        { label: 'Full', color: '#1d4ed8' },
                      ].map(({ label, color }) => (
                        <div key={label} className="flex items-center space-x-1">
                          <div className="h-2.5 w-2.5 rounded-sm border border-[#1e2d45]" style={{ backgroundColor: color }} />
                          <span className="text-[9px] text-[#4a5f7a]">{label}</span>
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
                          <div key={a} className="text-[9px] font-semibold text-[#4a5f7a] uppercase tracking-widest">Aisle {a}</div>
                        ))}
                      </div>
                      {/* Grid rows */}
                      <div className="space-y-1.5">
                        {shelves.map((shelf) => (
                          <div key={shelf} className="grid gap-1.5" style={{ gridTemplateColumns: '48px repeat(5, 1fr)' }}>
                            <div className="flex items-center justify-center text-[9px] font-semibold text-[#4a5f7a] tracking-widest">Sh {shelf}</div>
                            {aisles.map((aisle) => {
                              const cell = heatmap.find((c) => c.aisle === aisle && c.shelf === shelf) || { label: `${aisle}-${shelf}`, utilization: 0, totalQuantity: 0, products: [] };
                              const isSelected = selectedCell?.label === cell.label;
                              const bgColor = interpolateHeatColor(cell.utilization);
                              return (
                                <button
                                  key={aisle}
                                  onClick={() => setSelectedCell(isSelected ? null : cell)}
                                  className={`h-10 w-full rounded-sm border flex flex-col items-center justify-center transition-all ${
                                    isSelected ? 'border-[#3b82f6] ring-1 ring-[#3b82f6]' : 'border-[#1e2d45] hover:border-[#243552]'
                                  }`}
                                  style={{ backgroundColor: bgColor }}
                                >
                                  <span className="text-[9px] font-semibold text-[#94a3b8]">{cell.label}</span>
                                  {cell.totalQuantity > 0 && (
                                    <span className="text-[8px] text-[#cbd5e1] tabular-nums">{cell.totalQuantity}</span>
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
                <div className="bg-[#0b1120] border border-[#1e2d45] rounded-md overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#1e2d45]">
                    <span className="text-[10px] font-semibold tracking-widest text-[#4a5f7a] uppercase">Bin Details</span>
                  </div>
                  <div className="p-4">
                    {!selectedCell ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Layers className="h-8 w-8 text-[#1e2d45] mb-3" />
                        <p className="text-[11px] text-[#4a5f7a]">Select a grid cell to inspect its contents and occupancy metrics.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center py-2 border-b border-[#1e2d45]">
                          <div>
                            <div className="text-[10px] font-semibold tracking-widest text-[#4a5f7a] uppercase mb-0.5">Location</div>
                            <div className="text-base font-semibold text-white font-mono">{selectedCell.label}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] font-semibold tracking-widest text-[#4a5f7a] uppercase mb-0.5">Utilization</div>
                            <div className={`text-base font-semibold tabular-nums ${selectedCell.utilization > 60 ? 'text-red-400' : 'text-[#10b981]'}`}>
                              {selectedCell.utilization}%
                            </div>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className="h-1 bg-[#1e2d45] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${selectedCell.utilization > 60 ? 'bg-red-500' : selectedCell.utilization > 20 ? 'bg-amber-500' : 'bg-[#10b981]'}`}
                            style={{ width: `${Math.min(selectedCell.utilization, 100)}%` }}
                          />
                        </div>

                        <div>
                          <div className="text-[10px] font-semibold tracking-widest text-[#4a5f7a] uppercase mb-2">
                            Stored Products ({selectedCell.products.length})
                          </div>
                          <div className="space-y-1 max-h-52 overflow-y-auto">
                            {selectedCell.products.length === 0 ? (
                              <p className="text-[11px] text-[#4a5f7a] py-4 text-center">Empty slot — no products assigned.</p>
                            ) : selectedCell.products.map((p: any) => (
                              <div key={p.sku} className="p-2 bg-[#0f1729] border border-[#1e2d45] rounded-sm flex justify-between items-center">
                                <div>
                                  <p className="text-[11px] font-medium text-[#cbd5e1]">{p.name}</p>
                                  <span className="text-[9px] text-[#4a5f7a] font-mono">SKU: {p.sku} · Bin: {p.bin}</span>
                                </div>
                                <span className="text-[11px] font-semibold text-[#94a3b8] tabular-nums">{p.quantity} u</span>
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
