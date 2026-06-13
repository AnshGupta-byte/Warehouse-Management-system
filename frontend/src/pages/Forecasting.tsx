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
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#1e2d45] bg-[#0b1120]">
        <div>
          <h1 className="text-[14px] font-semibold text-white leading-tight">
            Demand Forecasting &amp; Replenishment
          </h1>
          <p className="text-[11px] text-[#4a5f7a] mt-0.5">
            XGBoost demand model · Auto-PO replenishment signals · ABC classification
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-semibold tracking-widest text-[#4a5f7a] uppercase px-2 py-1 border border-[#1e2d45] rounded-md bg-[#070d19]">
            AI Engine: XGBoost
          </span>
          <button
            onClick={handleTriggerForecast}
            disabled={triggering}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-[#94a3b8] bg-[#070d19] border border-[#1e2d45] rounded-md hover:border-[#243552] hover:text-white disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${triggering ? 'animate-spin' : ''}`} />
            {triggering ? 'Retraining…' : 'Retrain Models'}
          </button>
        </div>
      </div>

      {/* ── Success bar ── */}
      {successMsg && (
        <div className="flex items-center gap-2 px-5 py-2 bg-[#10b98112] border-b border-[#10b98130] text-[11px] text-[#10b981] font-medium">
          <CheckCircle className="h-3.5 w-3.5 shrink-0" />
          {successMsg}
        </div>
      )}

      <div className="p-5 space-y-5">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#3b82f6] border-t-transparent" />
          </div>
        ) : (
          <>
            {/* ── Main 2-col layout ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

              {/* ── LEFT: Forecast Chart Panel (2/3) ── */}
              <div className="lg:col-span-2 bg-[#0b1120] border border-[#1e2d45] rounded-md overflow-hidden">
                {/* panel-header */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1e2d45] bg-[#0b1120]">
                  <span className="text-[12px] font-semibold text-white">Demand Trajectory</span>
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="bg-[#070d19] border border-[#1e2d45] rounded-md px-2.5 py-1 text-[11px] text-[#94a3b8] focus:outline-none focus:border-[#243552] hover:border-[#243552] transition-colors cursor-pointer"
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
                        <CartesianGrid strokeDasharray="3 3" stroke="#111e35" vertical={false} />
                        <XAxis
                          dataKey="name"
                          stroke="#1e2d45"
                          tick={{ fill: '#4a5f7a', fontSize: 10 }}
                          tickLine={false}
                          axisLine={{ stroke: '#1e2d45' }}
                        />
                        <YAxis
                          stroke="#1e2d45"
                          tick={{ fill: '#4a5f7a', fontSize: 10 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0b1120',
                            borderColor: '#1e2d45',
                            borderRadius: '4px',
                            fontSize: '11px',
                          }}
                          labelStyle={{ color: '#cbd5e1', fontWeight: 600 }}
                          itemStyle={{ color: '#94a3b8' }}
                        />
                        <Legend
                          verticalAlign="top"
                          height={28}
                          iconType="circle"
                          iconSize={6}
                          wrapperStyle={{ fontSize: '11px', color: '#4a5f7a' }}
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
                  <div className="flex items-center gap-2 px-4 py-3 border-t border-[#111e35]">
                    <span className="text-[10px] font-semibold tracking-widest text-[#4a5f7a] uppercase mr-1">Forecast</span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#3b82f608] border border-[#3b82f620] text-[11px] font-medium text-[#3b82f6] tabular-nums">
                      30-Day: <span className="font-semibold">{selectedProductDetails.next30DaysForecast} units</span>
                    </span>
                    {selectedProductDetails.next60DaysForecast != null && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#3b82f608] border border-[#3b82f620] text-[11px] font-medium text-[#3b82f6] tabular-nums">
                        60-Day: <span className="font-semibold">{selectedProductDetails.next60DaysForecast} units</span>
                      </span>
                    )}
                    {selectedProductDetails.next90DaysForecast != null && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#3b82f608] border border-[#3b82f620] text-[11px] font-medium text-[#3b82f6] tabular-nums">
                        90-Day: <span className="font-semibold">{selectedProductDetails.next90DaysForecast} units</span>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* ── RIGHT: Replenishment Signal Panel (1/3) ── */}
              <div className="bg-[#0b1120] border border-[#1e2d45] rounded-md overflow-hidden flex flex-col">
                {/* panel-header */}
                <div className="px-4 py-2.5 border-b border-[#1e2d45] bg-[#0b1120]">
                  <span className="text-[12px] font-semibold text-white">Replenishment Signal</span>
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
                          className={`flex justify-between items-center py-2.5 px-4 ${i < arr.length - 1 ? 'border-b border-[#111e35]' : ''}`}
                        >
                          <span className="text-[11px] text-[#4a5f7a]">{label}</span>
                          <span className="text-[12px] font-medium text-[#cbd5e1] tabular-nums truncate max-w-[140px] text-right">
                            {value}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Status block */}
                    <div className="p-3 border-t border-[#111e35]">
                      {isReorderNeeded ? (
                        <div className="bg-[#f59e0b10] border border-[#f59e0b30] rounded-md p-3 text-center">
                          <span className="inline-block px-2 py-0.5 text-[10px] font-semibold tracking-widest uppercase bg-[#f59e0b15] border border-[#f59e0b40] text-[#f59e0b] rounded-sm mb-2">
                            Replenishment Required
                          </span>
                          <p className="text-[10px] text-[#4a5f7a] mb-1.5">
                            Stock is below reorder point. Recommended PO quantity:
                          </p>
                          <span className="text-[22px] font-bold text-[#f59e0b] tabular-nums leading-none">
                            {selectedProductDetails.recommendedQty}
                          </span>
                          <span className="text-[11px] text-[#f59e0b] ml-1">units</span>
                        </div>
                      ) : (
                        <div className="bg-[#10b98110] border border-[#10b98130] rounded-md p-3 text-center">
                          <span className="inline-block px-2 py-0.5 text-[10px] font-semibold tracking-widest uppercase bg-[#10b98115] border border-[#10b98140] text-[#10b981] rounded-sm mb-2">
                            Stock Optimal
                          </span>
                          <p className="text-[10px] text-[#4a5f7a]">
                            No replenishment action required. Inventory above safety threshold.
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-[11px] text-[#4a5f7a]">
                    Select a product
                  </div>
                )}
              </div>
            </div>

            {/* ── Replenishment Matrix Table ── */}
            <div className="bg-[#0b1120] border border-[#1e2d45] rounded-md overflow-hidden mt-5">
              {/* panel-header */}
              <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-[#1e2d45] bg-[#0b1120]">
                <span className="text-[12px] font-semibold text-white">Auto-PO Replenishment Matrix</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm bg-[#3b82f610] border border-[#3b82f625] text-[10px] font-semibold text-[#3b82f6]">
                  {recommendations.length}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#0b1120] border-b border-[#1e2d45]">
                      <th className="px-4 py-2 text-[10px] font-semibold tracking-widest text-[#4a5f7a] uppercase whitespace-nowrap">Product</th>
                      <th className="px-4 py-2 text-[10px] font-semibold tracking-widest text-[#4a5f7a] uppercase whitespace-nowrap">SKU</th>
                      <th className="px-4 py-2 text-[10px] font-semibold tracking-widest text-[#4a5f7a] uppercase whitespace-nowrap text-right">Current Stock</th>
                      <th className="px-4 py-2 text-[10px] font-semibold tracking-widest text-[#4a5f7a] uppercase whitespace-nowrap text-right">Safety Stock</th>
                      <th className="px-4 py-2 text-[10px] font-semibold tracking-widest text-[#4a5f7a] uppercase whitespace-nowrap text-right">Reorder Pt.</th>
                      <th className="px-4 py-2 text-[10px] font-semibold tracking-widest text-[#4a5f7a] uppercase whitespace-nowrap">ABC</th>
                      <th className="px-4 py-2 text-[10px] font-semibold tracking-widest text-[#4a5f7a] uppercase whitespace-nowrap text-right">30-Day Fcst</th>
                      <th className="px-4 py-2 text-[10px] font-semibold tracking-widest text-[#4a5f7a] uppercase whitespace-nowrap text-right">Required Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recommendations.map((r) => (
                      <tr
                        key={r.productId}
                        onClick={() => setSelectedProductId(r.productId)}
                        className={`border-b border-[#0f1729] cursor-pointer transition-colors hover:bg-[#0f1729] ${
                          r.productId === selectedProductId ? 'bg-[#0f1729]' : ''
                        }`}
                      >
                        <td className="px-4 py-2.5">
                          <span className="text-[12px] font-medium text-[#cbd5e1] leading-tight block">
                            {r.name}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-[11px] font-mono text-[#4a5f7a]">{r.sku}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className="text-[12px] font-medium text-[#cbd5e1] tabular-nums">{r.totalStock}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className="text-[12px] text-[#94a3b8] tabular-nums">{r.safetyStock}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className="text-[12px] text-[#94a3b8] tabular-nums">{r.reorderPoint}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-sm text-[10px] font-semibold border ${
                            r.abcClass === 'A'
                              ? 'bg-[#ef444410] border-[#ef444430] text-[#ef4444]'
                              : r.abcClass === 'B'
                              ? 'bg-[#f59e0b10] border-[#f59e0b30] text-[#f59e0b]'
                              : 'bg-[#1e2d45] border-[#243552] text-[#4a5f7a]'
                          }`}>
                            {r.abcClass}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className="text-[12px] text-[#94a3b8] tabular-nums">{r.next30DaysForecast}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {r.isReorderNeeded ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-semibold bg-[#f59e0b10] border border-[#f59e0b30] text-[#f59e0b] tabular-nums">
                              + {r.recommendedQty} Units
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-semibold bg-[#10b98110] border border-[#10b98130] text-[#10b981]">
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
