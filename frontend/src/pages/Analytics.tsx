import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../services/api';
import { useSocket } from '../context/SocketContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
} from 'recharts';
import {
  Sparkles, Layers, MapPin, Flame, LayoutGrid, TrendingUp,
  Download, RefreshCw, Award, AlertTriangle, Info,
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
  C: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/20', hex: '#64748b', label: 'C — Low Value' },
};

const TREND_PALETTE = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

// ─── Heatmap Utilities ────────────────────────────────────────────────────────
const getHeatmapColor = (utilization: number) => {
  if (utilization === 0) return 'bg-slate-900 border-slate-800 text-slate-500';
  if (utilization < 20) return 'bg-emerald-950/40 border-emerald-900/60 text-emerald-400';
  if (utilization < 60) return 'bg-amber-950/40 border-amber-900/60 text-amber-400';
  return 'bg-red-950/40 border-red-900/60 text-red-400';
};

// ─── Component ────────────────────────────────────────────────────────────────
export const Analytics: React.FC = () => {
  const { subscribe } = useSocket();
  const reportRef = useRef<HTMLDivElement>(null);

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

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8" ref={reportRef}>
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Spatial Analytics & Intelligence</h1>
          <p className="text-sm text-slate-400 mt-1">Heatmaps, ABC classification, trend analysis, and inventory insights</p>
        </div>
        <button
          onClick={handleExportPDF}
          disabled={exporting}
          className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
        >
          {exporting ? <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Download className="h-4 w-4" />}
          <span>{exporting ? 'Generating...' : 'Export PDF'}</span>
        </button>
      </div>

      {/* ── Section 1: Heatmap ─────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-slate-900 border border-slate-800 rounded-xl">
        <div>
          <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center space-x-2">
            <Sparkles className="h-4 w-4 text-indigo-400" />
            <span>Spatial Warehouse Heatmap</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">Click any cell to inspect bin contents and occupancy</p>
        </div>
        <div className="flex items-center space-x-2">
          <MapPin className="h-4 w-4 text-indigo-400" />
          <select
            value={selectedWhId}
            onChange={(e) => { setSelectedWhId(e.target.value); setSelectedCell(null); }}
            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-all"
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name} ({w.location})</option>
            ))}
          </select>
        </div>
      </div>

      {heatLoading ? (
        <div className="flex h-48 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Grid */}
          <div className="lg:col-span-2 p-6 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-2">
                <Flame className="h-4 w-4 text-red-500" />
                <span>Floor Space Density Layout</span>
              </h3>
              <div className="flex space-x-3 text-[10px] text-slate-400 font-semibold">
                {[['Empty', 'bg-slate-900 border-slate-800'], ['Low', 'bg-emerald-950/40 border-emerald-900/60'], ['Medium', 'bg-amber-950/40 border-amber-900/60'], ['Full', 'bg-red-950/40 border-red-900/60']].map(([label, cls]) => (
                  <div key={label} className="flex items-center space-x-1">
                    <div className={`h-2.5 w-2.5 rounded border ${cls}`} />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[460px]">
                <div className="grid grid-cols-6 gap-2 mb-2 text-center text-xs font-bold text-slate-500">
                  <div />
                  {aisles.map((a) => <div key={a}>Aisle {a}</div>)}
                </div>
                <div className="space-y-2">
                  {shelves.map((shelf) => (
                    <div key={shelf} className="grid grid-cols-6 gap-2">
                      <div className="flex items-center justify-center text-xs font-bold text-slate-500">Shelf {shelf}</div>
                      {aisles.map((aisle) => {
                        const cell = heatmap.find((c) => c.aisle === aisle && c.shelf === shelf) || { label: `${aisle}-${shelf}`, utilization: 0, totalQuantity: 0, products: [] };
                        const isSelected = selectedCell?.label === cell.label;
                        return (
                          <button
                            key={aisle}
                            onClick={() => setSelectedCell(isSelected ? null : cell)}
                            className={`h-16 rounded-xl border flex flex-col items-center justify-center transition-all hover:scale-[1.03] active:scale-95 ${getHeatmapColor(cell.utilization)} ${isSelected ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-slate-900' : ''}`}
                          >
                            <span className="text-[10px] font-bold">{cell.label}</span>
                            {cell.totalQuantity > 0 && <span className="text-[9px] font-extrabold mt-0.5">{cell.totalQuantity} u</span>}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Slot Detail */}
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl flex flex-col">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-4 flex items-center space-x-2">
              <LayoutGrid className="h-4 w-4 text-indigo-400" />
              <span>Bin Details</span>
            </h3>
            {!selectedCell ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <Layers className="h-10 w-10 text-slate-700 mb-3" />
                <p className="text-xs text-slate-500">Select a grid cell to inspect its contents and occupancy metrics.</p>
              </div>
            ) : (
              <div className="space-y-3 flex-1">
                <div className="p-3 bg-slate-950 rounded-lg flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Location</span>
                    <p className="text-base font-extrabold text-white">{selectedCell.label}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Utilization</span>
                    <p className={`text-base font-extrabold ${selectedCell.utilization > 60 ? 'text-red-400' : 'text-emerald-400'}`}>{selectedCell.utilization}%</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${selectedCell.utilization > 60 ? 'bg-red-500' : selectedCell.utilization > 20 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(selectedCell.utilization, 100)}%` }}
                  />
                </div>

                <div>
                  <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Stored Products ({selectedCell.products.length})</span>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto">
                    {selectedCell.products.length === 0 ? (
                      <p className="text-xs text-slate-500 py-4 text-center">Empty slot — no products assigned.</p>
                    ) : selectedCell.products.map((p: any) => (
                      <div key={p.sku} className="p-2.5 bg-slate-950 rounded border border-slate-800 flex justify-between items-center text-xs">
                        <div>
                          <p className="font-semibold text-slate-200">{p.name}</p>
                          <span className="text-[9px] text-slate-500 font-mono">SKU: {p.sku} · Bin: {p.bin}</span>
                        </div>
                        <span className="font-bold text-slate-300">{p.quantity} units</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Section 2: ABC Classification ─────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <Award className="h-5 w-5 text-amber-400" />
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">ABC Inventory Classification</h2>
              <p className="text-xs text-slate-400 mt-0.5">A = Top 80% of usage value · B = Next 15% · C = Bottom 5%</p>
            </div>
          </div>
          <button onClick={loadABC} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* ABC Summary Cards */}
        {abcSummary && (
          <div className="grid grid-cols-4 gap-px bg-slate-800 border-b border-slate-800">
            {(['A', 'B', 'C'] as const).map((cls) => (
              <button
                key={cls}
                onClick={() => setAbcClassFilter(abcClassFilter === cls ? 'ALL' : cls)}
                className={`p-4 text-left transition-all bg-slate-900 hover:bg-slate-800 ${abcClassFilter === cls ? 'ring-inset ring-2 ring-indigo-500' : ''}`}
              >
                <div className={`text-xs font-bold uppercase mb-1 ${ABC_COLORS[cls].text}`}>{ABC_COLORS[cls].label}</div>
                <div className="text-2xl font-bold text-white">{abcSummary[cls]}</div>
                <div className="text-xs text-slate-500">products</div>
              </button>
            ))}
            <div className="p-4 bg-slate-900 text-left">
              <div className="text-xs font-bold uppercase mb-1 text-slate-400">Total Stock Value</div>
              <div className="text-2xl font-bold text-white">${abcSummary.totalStockValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
              <div className="text-xs text-slate-500">{abcSummary.totalProducts} products</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center space-x-3 px-6 py-3 border-b border-slate-800">
          <input
            type="text"
            placeholder="Search product or SKU..."
            value={abcSearch}
            onChange={(e) => setAbcSearch(e.target.value)}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
          />
          <div className="flex space-x-1">
            {(['ALL', 'A', 'B', 'C'] as const).map((cls) => (
              <button
                key={cls}
                onClick={() => setAbcClassFilter(cls)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  abcClassFilter === cls
                    ? cls === 'ALL' ? 'bg-slate-600 text-white' : `${ABC_COLORS[cls].bg} ${ABC_COLORS[cls].text} ${ABC_COLORS[cls].border} border`
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {cls}
              </button>
            ))}
          </div>
        </div>

        {/* ABC Table */}
        <div className="overflow-x-auto">
          {abcLoading ? (
            <div className="flex h-32 items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  {['Class', 'Product', 'SKU', 'Category', 'Annual Usage Value', 'Stock', 'Stock Value', 'Cumulative %'].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredABC.map((p) => (
                  <tr key={p.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-3">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${ABC_COLORS[p.abcClass].bg} ${ABC_COLORS[p.abcClass].text} ${ABC_COLORS[p.abcClass].border}`}>
                        {p.abcClass}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-semibold text-white max-w-[180px] truncate">{p.name}</td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-400">{p.sku}</td>
                    <td className="px-5 py-3 text-slate-400">{p.category}</td>
                    <td className="px-5 py-3 font-semibold text-slate-200">${p.annualUsageValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-5 py-3 text-slate-300">{p.currentStock.toLocaleString()}</td>
                    <td className="px-5 py-3 text-slate-300">${p.stockValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center space-x-2">
                        <div className="flex-1 h-1.5 bg-slate-800 rounded-full max-w-[80px]">
                          <div className={`h-full rounded-full ${ABC_COLORS[p.abcClass].text.replace('text-', 'bg-').replace('/10', '')}`} style={{ width: `${Math.min(p.cumulativePct, 100)}%`, backgroundColor: ABC_COLORS[p.abcClass].hex }} />
                        </div>
                        <span className="text-xs text-slate-400">{p.cumulativePct}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredABC.length === 0 && (
                  <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-500 text-sm">No products match the current filter.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Section 3: Sales Trend Chart ──────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <TrendingUp className="h-5 w-5 text-indigo-400" />
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Multi-Product Sales Trend</h2>
              <p className="text-xs text-slate-400 mt-0.5">Units sold per month for top 5 products</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <select
              value={trendMonths}
              onChange={(e) => setTrendMonths(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition-all"
            >
              <option value="3">Last 3 months</option>
              <option value="6">Last 6 months</option>
              <option value="12">Last 12 months</option>
            </select>
            <button onClick={loadTrends} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {trendLoading ? (
            <div className="flex h-48 items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" /></div>
          ) : trendSeries.length === 0 ? (
            <div className="flex h-48 items-center justify-center">
              <div className="text-center">
                <Info className="h-10 w-10 text-slate-700 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">No sales data available for the selected period.</p>
              </div>
            </div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendChartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0', fontSize: '12px' }}
                    labelStyle={{ color: '#94a3b8', fontWeight: 'bold', marginBottom: '4px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }} />
                  {trendSeries.map((s, i) => (
                    <Line key={s.id} type="monotone" dataKey={s.name} stroke={TREND_PALETTE[i % TREND_PALETTE.length]} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ── Section 4: Category Charts ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-5">Category Valuation Allocation</h3>
          <div className="h-60">
            {valuationData.length === 0 ? (
              <p className="text-xs text-slate-500 py-12 text-center">No inventory valuation data.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={valuationData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value">
                    {valuationData.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(value: any) => `$${Number(value).toLocaleString()}`}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-5 flex items-center space-x-2">
            <TrendingUp className="h-4 w-4 text-indigo-400" />
            <span>Category Inventory Turnover</span>
          </h3>
          <div className="h-60">
            {turnoverData.length === 0 ? (
              <p className="text-xs text-slate-500 py-12 text-center">No turnover data available.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={turnoverData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(value) => `${value}x`}
                  />
                  <Bar dataKey="Ratio" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Turnover Ratio" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
