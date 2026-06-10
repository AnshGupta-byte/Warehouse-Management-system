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

  return (
    <div className="space-y-8">
      {/* Forecasting Control Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-slate-900 border border-slate-800 rounded-xl shadow-md">
        <div className="text-left">
          <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center space-x-2">
            <Sparkles className="h-4 w-4 text-indigo-400" />
            <span>AI Demand Predictor & Procurement Engine</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Analyze historical stock movements, predict future stockout risks, and optimize safety threshold levels.
          </p>
        </div>
        <div>
          <button
            onClick={handleTriggerForecast}
            disabled={triggering}
            className="flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-all shadow-md shadow-indigo-500/10"
          >
            <RefreshCw className={`h-4 w-4 ${triggering ? 'animate-spin' : ''}`} />
            <span>{triggering ? 'Retraining Models...' : 'Retrain AI Models'}</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-lg bg-emerald-950/20 border border-emerald-900/50 text-xs text-emerald-400 font-semibold flex items-center space-x-2">
          <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
        </div>
      ) : (
        <>
          {/* Main Visual charts panel */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Chart Area */}
            <div className="lg:col-span-2 p-6 bg-slate-900 border border-slate-800 rounded-xl shadow-md text-left">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Demand Forecasting Trajectory</h3>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none"
                >
                  {recommendations.map((r) => (
                    <option key={r.productId} value={r.productId}>
                      {r.name} ({r.sku})
                    </option>
                  ))}
                </select>
              </div>

              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={getProductChartData()} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                      labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                    />
                    <Legend verticalAlign="top" height={36} iconType="circle" />
                    <Line type="monotone" dataKey="Demand" stroke="#4f46e5" strokeWidth={2.5} activeDot={{ r: 6 }} name="Forecasted Cumulative Demand" />
                    <Line type="monotone" dataKey="Confidence" stroke="#10b981" strokeWidth={1.5} strokeDasharray="5 5" name="Confidence Score (%)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Calculations Breakdown Card */}
            {selectedProductDetails && (
              <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl shadow-md text-left flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-4">Smart Reorder Point</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-800">
                      <span className="text-slate-400">Target Item</span>
                      <span className="font-semibold text-slate-200 truncate max-w-[150px]">{selectedProductDetails.name}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-800">
                      <span className="text-slate-400">Current Stock</span>
                      <span className="font-semibold text-slate-200">{selectedProductDetails.totalStock} units</span>
                    </div>
                    <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-800">
                      <span className="text-slate-400">Safety Buffer</span>
                      <span className="font-semibold text-emerald-400 flex items-center space-x-1">
                        <ShieldCheck className="h-3.5 w-3.5 inline text-emerald-500 mr-0.5" />
                        <span>{selectedProductDetails.safetyStock} units</span>
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-800">
                      <span className="text-slate-400">Calculated ROP</span>
                      <span className="font-bold text-amber-500">{selectedProductDetails.reorderPoint} units</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">30-Day Predictive Demand</span>
                      <span className="font-bold text-indigo-400">{selectedProductDetails.next30DaysForecast} units</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800">
                  <div className={`p-4 rounded-lg text-center ${
                    selectedProductDetails.isReorderNeeded
                      ? 'bg-amber-950/20 border border-amber-900/50'
                      : 'bg-emerald-950/10 border border-emerald-900/10'
                  }`}>
                    {selectedProductDetails.isReorderNeeded ? (
                      <>
                        <div className="flex justify-center mb-1 text-amber-400">
                          <AlertTriangle className="h-5 w-5" />
                        </div>
                        <p className="text-xs font-bold text-slate-200">Replenishment Action Required</p>
                        <p className="text-[10px] text-slate-400 mt-1">
                          Current stock level is below ROP. Recommended PO Order quantity is:
                        </p>
                        <span className="inline-block mt-2 px-3 py-1 rounded bg-amber-500 text-slate-950 text-xs font-extrabold">
                          {selectedProductDetails.recommendedQty} Units
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-center mb-1 text-emerald-400">
                          <CheckCircle className="h-5 w-5" />
                        </div>
                        <p className="text-xs font-bold text-slate-200">Stock Levels Healthy</p>
                        <p className="text-[10px] text-slate-400 mt-1">
                          No replenishment necessary. Stock is above reorder thresholds.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Recommendations Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
            <div className="p-4 border-b border-slate-800 bg-slate-900/80">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider text-left">Auto-PO Replenishment Matrix</h3>
            </div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/50">
                  <th className="p-4 text-xs font-bold text-slate-400 uppercase">Product details</th>
                  <th className="p-4 text-xs font-bold text-slate-400 uppercase">Current Stock</th>
                  <th className="p-4 text-xs font-bold text-slate-400 uppercase">Safety Stock</th>
                  <th className="p-4 text-xs font-bold text-slate-400 uppercase">Reorder Point</th>
                  <th className="p-4 text-xs font-bold text-slate-400 uppercase">ABC Class</th>
                  <th className="p-4 text-xs font-bold text-slate-400 uppercase">30-Day Forecast</th>
                  <th className="p-4 text-xs font-bold text-slate-400 uppercase text-right">Replenish Qty</th>
                </tr>
              </thead>
              <tbody>
                {recommendations.map((r) => (
                  <tr key={r.productId} className="border-b border-slate-850 hover:bg-slate-900/30 transition-all">
                    <td className="p-4">
                      <div className="font-semibold text-slate-200">{r.name}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">SKU: {r.sku}</div>
                    </td>
                    <td className="p-4 text-xs text-slate-300 font-semibold">{r.totalStock} units</td>
                    <td className="p-4 text-xs text-slate-400">{r.safetyStock}</td>
                    <td className="p-4 text-xs font-semibold text-slate-300">{r.reorderPoint}</td>
                    <td className="p-4">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                        r.abcClass === 'A'
                          ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                          : r.abcClass === 'B'
                          ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        Class {r.abcClass}
                      </span>
                    </td>
                    <td className="p-4 text-xs text-slate-300 font-semibold">{r.next30DaysForecast}</td>
                    <td className="p-4 text-right">
                      {r.isReorderNeeded ? (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          + {r.recommendedQty} Units
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">Optimal</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
