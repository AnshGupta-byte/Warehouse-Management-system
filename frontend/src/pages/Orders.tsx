import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import {
  Search,
  Plus,
  ArrowRight,
  Truck,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
} from 'lucide-react';

export const Orders: React.FC = () => {
  const { user } = useAuth();
  const { subscribe } = useSocket();

  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  // New Order Form
  const [newOrder, setNewOrder] = useState({
    type: 'PURCHASE',
    partner: '', // supplier or customer
    expectedAt: '',
    notes: '',
  });

  const [orderItems, setOrderItems] = useState<any[]>([
    { productId: '', quantity: '1', unitPrice: '0' },
  ]);

  // Status update
  const [statusUpdate, setStatusUpdate] = useState({
    status: '',
    warehouseId: '',
  });

  const fetchOrdersData = async () => {
    try {
      const [orderRes, prodRes, whRes] = await Promise.all([
        api.orders.list({ type: typeFilter, status: statusFilter }),
        api.products.list(),
        api.warehouses.list(),
      ]);

      if (orderRes.success && prodRes.success && whRes.success) {
        setOrders(orderRes.orders);
        setProducts(prodRes.products);
        setWarehouses(whRes.warehouses);
        if (whRes.warehouses.length > 0) {
          setStatusUpdate((prev) => ({ ...prev, warehouseId: whRes.warehouses[0].id }));
        }
      }
    } catch (err) {
      console.error('[Orders] Error fetching orders:', err);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchOrdersData().finally(() => setLoading(false));

    // Live Socket listener
    const unsubscribeOrderCreated = subscribe('ORDER_CREATED', () => {
      fetchOrdersData();
    });

    const unsubscribeOrderUpdated = subscribe('ORDER_UPDATED', () => {
      fetchOrdersData();
    });

    return () => {
      unsubscribeOrderCreated();
      unsubscribeOrderUpdated();
    };
  }, [typeFilter, statusFilter, subscribe]);

  const handleAddItem = () => {
    setOrderItems((prev) => [...prev, { productId: '', quantity: '1', unitPrice: '0' }]);
  };

  const handleRemoveItem = (idx: number) => {
    setOrderItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx: number, field: string, val: string) => {
    setOrderItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        
        let updated = { ...item, [field]: val };
        
        // Auto-populate price if product changes
        if (field === 'productId' && val) {
          const prod = products.find((p) => p.id === val);
          if (prod) {
            updated.unitPrice = prod.unitPrice.toString();
          }
        }
        
        return updated;
      })
    );
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        type: newOrder.type,
        expectedAt: newOrder.expectedAt || undefined,
        notes: newOrder.notes,
        items: orderItems.map((item) => ({
          productId: item.productId,
          quantity: parseInt(item.quantity),
          unitPrice: parseFloat(item.unitPrice),
        })),
      };

      if (newOrder.type === 'PURCHASE') {
        payload.supplier = newOrder.partner;
      } else {
        payload.customer = newOrder.partner;
      }

      const res = await api.orders.create(payload);
      if (res.success) {
        setShowAddModal(false);
        // Reset forms
        setNewOrder({ type: 'PURCHASE', partner: '', expectedAt: '', notes: '' });
        setOrderItems([{ productId: '', quantity: '1', unitPrice: '0' }]);
        fetchOrdersData();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to place order.');
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    try {
      const res = await api.orders.updateStatus(
        selectedOrder.id,
        statusUpdate.status,
        statusUpdate.status === 'DELIVERED' ? statusUpdate.warehouseId : undefined
      );

      if (res.success) {
        setShowStatusModal(false);
        setSelectedOrder(null);
        fetchOrdersData();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update order status');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'CONFIRMED':
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
      case 'SHIPPED':
        return 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20';
      case 'DELIVERED':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'CANCELLED':
        return 'bg-red-500/10 text-red-400 border border-red-500/20';
      default:
        return 'bg-slate-800 text-slate-400';
    }
  };

  const steps = ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED'];

  return (
    <div className="space-y-6">
      {/* Filters and Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap gap-3">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Order Types</option>
            <option value="PURCHASE">PO (Inbound Purchases)</option>
            <option value="SALES">SO (Outbound Sales)</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Statuses</option>
            {steps.concat(['CANCELLED']).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => {
            if (products.length > 0) {
              setOrderItems([{ productId: products[0].id, quantity: '1', unitPrice: products[0].unitPrice.toString() }]);
            }
            setShowAddModal(true);
          }}
          className="flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-all shadow-lg shadow-indigo-500/10"
        >
          <Plus className="h-4 w-4" />
          <span>New Order Entry</span>
        </button>
      </div>

      {/* Order List */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-8 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-xl">Loading orders list...</div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-xl">No orders logged in this cycle.</div>
        ) : (
          orders.map((order) => {
            const currentStepIdx = steps.indexOf(order.status);
            return (
              <div
                key={order.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md hover:border-slate-700 transition-all text-left"
              >
                {/* Info Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-4">
                  <div>
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-bold text-slate-200">{order.orderNumber}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        order.type === 'PURCHASE' ? 'bg-indigo-950/40 text-indigo-400 border border-indigo-900/50' : 'bg-pink-950/40 text-pink-400 border border-pink-900/50'
                      }`}>
                        {order.type === 'PURCHASE' ? 'PO Inbound' : 'SO Outbound'}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${getStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5">
                      {order.type === 'PURCHASE' ? `Supplier: ${order.supplier}` : `Customer: ${order.customer}`}
                      {order.expectedAt && ` • Estimated delivery: ${new Date(order.expectedAt).toLocaleDateString()}`}
                    </p>
                  </div>

                  <div className="flex items-center space-x-6">
                    <div className="text-right">
                      <span className="text-xs font-semibold text-slate-400">Total Value</span>
                      <p className="text-lg font-extrabold text-white">${order.totalAmount.toLocaleString()}</p>
                    </div>
                    {order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
                      <button
                        onClick={() => {
                          setSelectedOrder(order);
                          setStatusUpdate({ status: order.status, warehouseId: warehouses[0]?.id || '' });
                          setShowStatusModal(true);
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-all shadow-md"
                      >
                        Update Status
                      </button>
                    )}
                  </div>
                </div>

                {/* Stepper Pipeline */}
                {order.status !== 'CANCELLED' && (
                  <div className="my-6 hidden md:block">
                    <div className="relative flex items-center justify-between">
                      <div className="absolute left-0 right-0 h-0.5 bg-slate-800 z-0"></div>
                      <div
                        className="absolute left-0 h-0.5 bg-indigo-500 transition-all duration-300 z-0"
                        style={{ width: `${(Math.max(0, currentStepIdx) / (steps.length - 1)) * 100}%` }}
                      ></div>

                      {steps.map((step, idx) => {
                        const isDone = idx <= currentStepIdx;
                        const isCurrent = idx === currentStepIdx;
                        return (
                          <div key={step} className="relative z-10 flex flex-col items-center">
                            <div
                              className={`h-7 w-7 rounded-full flex items-center justify-center border transition-all ${
                                isDone
                                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                                  : 'bg-slate-900 border-slate-800 text-slate-500'
                              } ${isCurrent ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-slate-900' : ''}`}
                            >
                              {isDone && idx < currentStepIdx ? (
                                <CheckCircle2 className="h-4 w-4" />
                              ) : (
                                <span className="text-xs font-bold">{idx + 1}</span>
                              )}
                            </div>
                            <span className={`text-[10px] font-bold mt-2 ${isDone ? 'text-indigo-400' : 'text-slate-500'}`}>
                              {step}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Items Detail Dropdown */}
                <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/80 mt-4">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Order Items</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {order.items.map((item: any) => (
                      <div key={item.id} className="flex justify-between items-center text-xs border-b border-slate-900 pb-2 last:border-0 last:pb-0">
                        <div className="text-slate-300 font-semibold">{item.product.name} <span className="text-[10px] text-slate-500">({item.product.sku})</span></div>
                        <div className="text-slate-400">
                          {item.quantity} Qty @ ${item.unitPrice.toFixed(2)} = <span className="font-bold text-slate-200">${item.total.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {order.notes && (
                    <div className="text-[10px] text-slate-500 border-t border-slate-900 pt-3 mt-3">
                      <strong>Remarks: </strong> {order.notes}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* New Order Entry Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-left max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-6 pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                <Sparkles className="h-4 w-4 text-indigo-400" />
                <span>Create Order Intake / Dispatch Entry</span>
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-4 overflow-y-auto flex-1 pr-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Order Pipeline *</label>
                  <select
                    value={newOrder.type}
                    onChange={(e) => setNewOrder((prev) => ({ ...prev, type: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none"
                  >
                    <option value="PURCHASE">Purchase Order (Inbound PO)</option>
                    <option value="SALES">Sales Order (Outbound SO)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    {newOrder.type === 'PURCHASE' ? 'Supplier Name *' : 'Customer Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={newOrder.partner}
                    onChange={(e) => setNewOrder((prev) => ({ ...prev, partner: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-650 focus:outline-none"
                    placeholder={newOrder.type === 'PURCHASE' ? 'e.g. Hansa Pharma Inc' : 'e.g. BestRetail Corp'}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Target Completion Date</label>
                  <input
                    type="date"
                    value={newOrder.expectedAt}
                    onChange={(e) => setNewOrder((prev) => ({ ...prev, expectedAt: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Order Memo Notes</label>
                  <input
                    type="text"
                    value={newOrder.notes}
                    onChange={(e) => setNewOrder((prev) => ({ ...prev, notes: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none"
                    placeholder="e.g. Standard terms, fragile cargo"
                  />
                </div>
              </div>

              {/* Order Items Table Builder */}
              <div className="border-t border-slate-800 pt-4">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Order Items list</span>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                  >
                    + Add item row
                  </button>
                </div>

                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {orderItems.map((item, idx) => (
                    <div key={idx} className="flex items-center space-x-3 bg-slate-950/40 p-2.5 rounded-lg border border-slate-850">
                      <div className="flex-1">
                        <select
                          required
                          value={item.productId}
                          onChange={(e) => handleItemChange(idx, 'productId', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-300 focus:outline-none"
                        >
                          <option value="">Select product...</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} (${p.unitPrice})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="w-20">
                        <input
                          type="number"
                          required
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-100 text-center focus:outline-none"
                          min="1"
                        />
                      </div>

                      <div className="w-24">
                        <input
                          type="number"
                          step="0.01"
                          required
                          placeholder="Price"
                          value={item.unitPrice}
                          onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-100 text-center focus:outline-none"
                        />
                      </div>

                      {orderItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex justify-end space-x-3 border-t border-slate-800 bg-slate-900">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Place Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Update Order Status Modal */}
      {showStatusModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-left">
            <div className="flex justify-between items-center mb-6 pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Update Order Pipeline Status</h3>
              <button onClick={() => setShowStatusModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateStatus} className="space-y-4">
              <div>
                <p className="text-xs text-slate-400">Updating status for order:</p>
                <h4 className="text-sm font-bold text-slate-200 mt-0.5">{selectedOrder.orderNumber}</h4>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Pipeline State *</label>
                <select
                  value={statusUpdate.status}
                  onChange={(e) => setStatusUpdate((prev) => ({ ...prev, status: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none"
                >
                  {/* Stepper values */}
                  <option value="PENDING">PENDING</option>
                  <option value="CONFIRMED">CONFIRMED</option>
                  <option value="SHIPPED">SHIPPED</option>
                  <option value="DELIVERED">DELIVERED (Fulfill & adjust stock)</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>

              {/* Fulfill details if DELIVERED */}
              {statusUpdate.status === 'DELIVERED' && (
                <div className="bg-slate-950/40 p-4 rounded-xl border border-indigo-500/10 space-y-3">
                  <div className="flex items-center space-x-2 text-indigo-400">
                    <Truck className="h-4 w-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Stock Receiving / Dispatch Point</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Fulfilling this order will automatically adjust physical inventory levels. Choose the warehouse to balance.
                  </p>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Select Warehouse</label>
                    <select
                      value={statusUpdate.warehouseId}
                      onChange={(e) => setStatusUpdate((prev) => ({ ...prev, warehouseId: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none"
                    >
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({w.location})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="pt-4 flex justify-end space-x-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Save Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
