import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useSocket } from '../context/SocketContext';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Sparkles,
  TrendingUp,
  RefreshCw,
  AlertTriangle,
  Layers,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
} from 'lucide-react';

export const Forecasting: React.FC = () => {
  const { subscribe } = useSocket();

  const [forecasts, setForecasts] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const loadForecastingData = async () => {
    try {
      const [foreRes, recRes] = await Promise.all([
        api.forecasting.list(),
        api.forecasting.reorderRecommendations(),
      ]);

      if (foreRes.success && recRes.success) {
        setForecasts(foreRes.forecasts);
        setRecommendations(recRes.recommendations);
        
        if (recRes.recommendations.length > 0 && !selectedProductId) {
          setSelectedProductId(recRes.recommendations[0].productId);
        }
      }
    } catch (err) {
      console.error('[Forecasting] Error loading forecasts:', err);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadForecastingData().finally(() => setLoading(false));

    // Live Socket listener
    const unsubscribeForecasts = subscribe('FORECASTS_REFRESHED', () => {
      loadForecastingData();
    });

    return () => {
      unsubscribeForecasts();
    };
  }, [subscribe]);

  const handleTriggerForecast = async () => {
    setTriggering(true);
    setSuccessMsg('');
    try {
      const res = await api.forecasting.trigger();
      if (res.success) {
        setSuccessMsg('Python forecasting model successfully retrained! Updated 30/60/90 day demand targets.');
        loadForecastingData();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to trigger forecasting pipeline.');
    } finally {
      setTriggering(false);
    }
  };

  // Format charts data for selected product
  const getProductChartData = () => {
    const selectedProd = recommendations.find((r) => r.productId === selectedProductId);
    if (!selectedProd) return [];

    const prodForecasts = forecasts.filter((f) => f.productId === selectedProductId);
    
    // Sort forecasts by date
    const sorted = [...prodForecasts].sort((a, b) => 
      new Date(a.forecastDate).getTime() - new Date(b.forecastDate).getTime()
    );

    // Mock historical daily average usage (anchor point for t=0)
    const baseStock = selectedProd.totalStock;
    const historyAvg = selectedProd.next30DaysForecast / 30;

    const chart = [
      { name: 'Current Stock', Demand: baseStock, Confidence: 100 },
    ];

    sorted.forEach((f) => {
      const diffDays = Math.ceil((new Date(f.forecastDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      chart.push({
        name: `Day ${diffDays}`,
        Demand: parseFloat(f.predictedQty.toFixed(2)),
        Confidence: Math.round(f.confidence * 100),
      });
    });

    return chart;
  };

  const selectedProductDetails = recommendations.find((r) => r.productId === selectedProductId);

  const isReorderNeeded = selectedProductDetails?.isReorderNeeded;

  return (
    <div className="space-y-0">
      {/* ── Page Toolbar ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-surface)]">
        <div>
          <h1 className="text-lg font-semibold text-[var(--text-primary)] leading-tight">
            Demand Forecasting &amp; Replenishment
          </h1>
          <p className="text-[13px] text-[var(--text-muted)] mt-0.5">
            XGBoost demand model · Auto-PO replenishment signals · ABC classification
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium tracking-wide text-[var(--text-muted)] uppercase px-2.5 py-1 border border-[var(--border)] rounded-lg bg-[var(--bg-root)]">
            AI Engine: XGBoost
          </span>
          <button
            onClick={handleTriggerForecast}
            disabled={triggering}
            className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] bg-[var(--bg-root)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${triggering ? 'animate-spin' : ''}`} />
            {triggering ? 'Retraining…' : 'Retrain Models'}
          </button>
        </div>
      </div>

      {/* ── Success bar ── */}
      {successMsg && (
        <div className="flex items-center gap-2 px-6 py-2.5 bg-[rgba(16,185,129,0.08)] border-b border-[var(--border)] text-[13px] text-[var(--success)] font-medium">
          <CheckCircle className="h-4 w-4 shrink-0" />
          {successMsg}
        </div>
      )}

      <div className="p-6 space-y-6">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent-light)] border-t-transparent" />
          </div>
        ) : (
          <>
            {/* ── Main 2-col layout ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* ── LEFT: Forecast Chart Panel (2/3) ── */}
              <div className="lg:col-span-2 panel">
                {/* panel-header */}
                <div className="panel-header flex items-center justify-between">
                  <span className="panel-title">Demand Trajectory</span>
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="bg-[var(--bg-root)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-[13px] text-[var(--text-secondary)] focus:outline-none focus:ring-1 focus:ring-[#2563eb] hover:border-[var(--border-strong)] transition-colors cursor-pointer"
                  >
                    {recommendations.map((r) => (
                      <option key={r.productId} value={r.productId}>
                        {r.name} ({r.sku})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Chart */}
                <div className="px-4 pt-4 pb-2">
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={getProductChartData()} margin={{ top: 4, right: 12, left: -16, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                        <XAxis
                          dataKey="name"
                          stroke="#27272a"
                          tick={{ fill: '#52525b', fontSize: 10 }}
                          tickLine={false}
                          axisLine={{ stroke: '#27272a' }}
                        />
                        <YAxis
                          stroke="#27272a"
                          tick={{ fill: '#52525b', fontSize: 10 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#18181b',
                            borderColor: '#27272a',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                          labelStyle={{ color: '#fafafa', fontWeight: 600 }}
                          itemStyle={{ color: '#a1a1aa' }}
                        />
                        <Legend
                          verticalAlign="top"
                          height={28}
                          iconType="circle"
                          iconSize={6}
                          wrapperStyle={{ fontSize: '12px', color: '#52525b' }}
                        />
                        <Line
                          type="monotone"
                          dataKey="Demand"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4, fill: '#3b82f6' }}
                          name="Forecasted Demand"
                        />
                        <Line
                          type="monotone"
                          dataKey="Confidence"
                          stroke="#10b981"
                          strokeWidth={1.5}
                          strokeDasharray="5 4"
                          dot={false}
                          name="Confidence (%)"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Metric pills below chart */}
                {selectedProductDetails && (
                  <div className="flex items-center gap-2.5 px-4 py-3 border-t border-[var(--border)]">
                    <span className="text-xs font-medium tracking-wide text-[var(--text-muted)] uppercase mr-1">Forecast</span>
                    <span className="badge badge-blue font-['JetBrains_Mono'] text-xs tabular-nums">
                      30d: <span className="font-semibold">{selectedProductDetails.next30DaysForecast} units</span>
                    </span>
                    {selectedProductDetails.next60DaysForecast != null && (
                      <span className="badge badge-blue font-['JetBrains_Mono'] text-xs tabular-nums">
                        60d: <span className="font-semibold">{selectedProductDetails.next60DaysForecast} units</span>
                      </span>
                    )}
                    {selectedProductDetails.next90DaysForecast != null && (
                      <span className="badge badge-blue font-['JetBrains_Mono'] text-xs tabular-nums">
                        90d: <span className="font-semibold">{selectedProductDetails.next90DaysForecast} units</span>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* ── RIGHT: Replenishment Signal Panel (1/3) ── */}
              <div className="panel flex flex-col">
                {/* panel-header */}
                <div className="panel-header">
                  <span className="panel-title">Replenishment Signal</span>
                </div>

                {selectedProductDetails ? (
                  <>
                    {/* Key-value rows */}
                    <div className="flex-1">
                      {[
                        { label: 'Product Name', value: selectedProductDetails.name },
                        { label: 'Current Stock', value: `${selectedProductDetails.totalStock} units` },
                        { label: 'Safety Stock', value: `${selectedProductDetails.safetyStock} units` },
                        { label: 'Reorder Point', value: `${selectedProductDetails.reorderPoint} units` },
                        { label: '30-Day Forecast', value: `${selectedProductDetails.next30DaysForecast} units` },
                      ].map(({ label, value }, i, arr) => (
                        <div
                          key={label}
                          className={`flex justify-between items-center py-3 px-4 ${i < arr.length - 1 ? 'border-b border-[var(--border)]' : ''}`}
                        >
                          <span className="text-[13px] text-[var(--text-muted)]">{label}</span>
                          <span className="text-[13px] font-medium text-[var(--text-primary)] font-['JetBrains_Mono'] tabular-nums truncate max-w-[140px] text-right">
                            {value}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Status block */}
                    <div className="p-4 border-t border-[var(--border)]">
                      {isReorderNeeded ? (
                        <div className="rounded-xl border-l-4 border-l-[#f59e0b] bg-[rgba(245,158,11,0.08)] p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="h-8 w-8 rounded-full bg-[rgba(245,158,11,0.15)] flex items-center justify-center">
                              <AlertTriangle className="h-4 w-4 text-[var(--warning)]" />
                            </div>
                            <span className="text-xs font-semibold tracking-wide uppercase text-[var(--warning)]">
                              Replenishment Required
                            </span>
                          </div>
                          <p className="text-[13px] text-[var(--text-muted)] mb-2">
                            Stock is below reorder point. Recommended PO quantity:
                          </p>
                          <span className="text-[28px] font-bold text-[var(--warning)] font-['JetBrains_Mono'] tabular-nums leading-none">
                            {selectedProductDetails.recommendedQty}
                          </span>
                          <span className="text-[13px] text-[var(--warning)] ml-1.5">units</span>
                        </div>
                      ) : (
                        <div className="rounded-xl border-l-4 border-l-[#10b981] bg-[rgba(16,185,129,0.08)] p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="h-8 w-8 rounded-full bg-[rgba(16,185,129,0.15)] flex items-center justify-center">
                              <ShieldCheck className="h-4 w-4 text-[var(--success)]" />
                            </div>
                            <span className="text-xs font-semibold tracking-wide uppercase text-[var(--success)]">
                              Stock Optimal
                            </span>
                          </div>
                          <p className="text-[13px] text-[var(--text-muted)]">
                            No replenishment action required. Inventory above safety threshold.
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-[13px] text-[var(--text-muted)]">
                    Select a product
                  </div>
                )}
              </div>
            </div>

            {/* ── Replenishment Matrix Table ── */}
            <div className="panel mt-6">
              {/* panel-header */}
              <div className="panel-header flex items-center gap-2.5">
                <span className="panel-title">Auto-PO Replenishment Matrix</span>
                <span className="badge badge-blue text-xs font-semibold font-['JetBrains_Mono']">
                  {recommendations.length}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="px-4 py-3 text-xs font-medium tracking-wide text-[var(--text-muted)] uppercase whitespace-nowrap">Product</th>
                      <th className="px-4 py-3 text-xs font-medium tracking-wide text-[var(--text-muted)] uppercase whitespace-nowrap">SKU</th>
                      <th className="px-4 py-3 text-xs font-medium tracking-wide text-[var(--text-muted)] uppercase whitespace-nowrap text-right">Current Stock</th>
                      <th className="px-4 py-3 text-xs font-medium tracking-wide text-[var(--text-muted)] uppercase whitespace-nowrap text-right">Safety Stock</th>
                      <th className="px-4 py-3 text-xs font-medium tracking-wide text-[var(--text-muted)] uppercase whitespace-nowrap text-right">Reorder Pt.</th>
                      <th className="px-4 py-3 text-xs font-medium tracking-wide text-[var(--text-muted)] uppercase whitespace-nowrap">ABC</th>
                      <th className="px-4 py-3 text-xs font-medium tracking-wide text-[var(--text-muted)] uppercase whitespace-nowrap text-right">30-Day Fcst</th>
                      <th className="px-4 py-3 text-xs font-medium tracking-wide text-[var(--text-muted)] uppercase whitespace-nowrap text-right">Required Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recommendations.map((r) => (
                      <tr
                        key={r.productId}
                        onClick={() => setSelectedProductId(r.productId)}
                        className={`border-b border-[var(--border)] cursor-pointer transition-colors hover:bg-[var(--bg-hover)] ${
                          r.productId === selectedProductId ? 'bg-[var(--bg-elevated)]' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <span className="text-[13px] font-medium text-[var(--text-primary)] leading-tight block">
                            {r.name}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[13px] font-['JetBrains_Mono'] text-[var(--text-muted)]">{r.sku}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-[13px] font-medium text-[var(--text-primary)] font-['JetBrains_Mono'] tabular-nums">{r.totalStock}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-[13px] text-[var(--text-secondary)] font-['JetBrains_Mono'] tabular-nums">{r.safetyStock}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-[13px] text-[var(--text-secondary)] font-['JetBrains_Mono'] tabular-nums">{r.reorderPoint}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`badge ${
                            r.abcClass === 'A'
                              ? 'badge-red'
                              : r.abcClass === 'B'
                              ? 'badge-amber'
                              : 'badge-gray'
                          }`}>
                            {r.abcClass}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-[13px] text-[var(--text-secondary)] font-['JetBrains_Mono'] tabular-nums">{r.next30DaysForecast}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {r.isReorderNeeded ? (
                            <span className="badge badge-amber font-['JetBrains_Mono'] tabular-nums">
                              + {r.recommendedQty} Units
                            </span>
                          ) : (
                            <span className="badge badge-green">
                              Optimal
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
