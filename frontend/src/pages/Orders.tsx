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
  ChevronDown,
  ChevronRight,
  Package,
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

  // Expanded rows
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

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

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'PENDING':   return 'badge badge-amber';
      case 'CONFIRMED': return 'badge badge-blue';
      case 'SHIPPED':   return 'badge badge-purple';
      case 'DELIVERED': return 'badge badge-green';
      case 'CANCELLED': return 'badge badge-red';
      default:          return 'badge badge-gray';
    }
  };

  const steps = ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED'];

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Compact 4-dot pipeline stepper
  const PipelineStepper = ({ status }: { status: string }) => {
    if (status === 'CANCELLED') {
      return <span className="badge badge-red">Cancelled</span>;
    }
    const currentIdx = steps.indexOf(status);
    return (
      <div className="flex items-center gap-0.5" style={{ width: 80 }}>
        {steps.map((s, i) => {
          const done = i <= currentIdx;
          const current = i === currentIdx;
          return (
            <React.Fragment key={s}>
              <div
                title={s}
                className={`h-2 w-2 rounded-full flex-shrink-0 transition-all ${
                  done
                    ? current
                      ? 'bg-[#3b82f6] ring-2 ring-[#3b82f6]/30'
                      : 'bg-[#3b82f6]'
                    : 'bg-[#27272a]'
                }`}
              />
              {i < steps.length - 1 && (
                <div className={`h-px flex-1 ${i < currentIdx ? 'bg-[#3b82f6]' : 'bg-[#27272a]'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* ── Toolbar ─────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-9 text-[12px] rounded-lg px-3"
            style={{ width: 160 }}
          >
            <option value="">All Order Types</option>
            <option value="PURCHASE">PO — Inbound</option>
            <option value="SALES">SO — Outbound</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 text-[12px] rounded-lg px-3"
            style={{ width: 140 }}
          >
            <option value="">All Statuses</option>
            {steps.concat(['CANCELLED']).map((s) => (
              <option key={s} value={s}>{s}</option>
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
          className="btn-primary"
        >
          <Plus className="h-3.5 w-3.5" />
          New Order
        </button>
      </div>

      {/* ── Orders Table ─────────────────────────── */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Order Management</span>
          <span className="badge badge-gray">{orders.length} records</span>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            <div className="skeleton h-4 w-1/3" />
            <div className="skeleton h-10 w-full" />
            <div className="skeleton h-10 w-full" />
            <div className="skeleton h-10 w-full" />
            <div className="skeleton h-10 w-full" />
            <div className="skeleton h-10 w-3/4" />
          </div>
        ) : orders.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <div className="h-12 w-12 rounded-xl bg-[rgba(37,99,235,0.08)] flex items-center justify-center mb-3">
              <Package className="h-6 w-6 text-[var(--accent)]" />
            </div>
            <p className="text-[14px] font-semibold text-[var(--text-primary)]">No orders found</p>
            <p className="text-[12px] text-[var(--text-muted)] mt-1">Try adjusting your filters or create a new order.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 32 }} />
                  <th>Order #</th>
                  <th>Type</th>
                  <th>Partner</th>
                  <th>Date</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Pipeline</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const isExpanded = expandedRows.has(order.id);
                  return (
                    <React.Fragment key={order.id}>
                      <tr
                        className="cursor-pointer"
                        onClick={() => toggleRow(order.id)}
                      >
                        {/* Expand chevron */}
                        <td className="text-center px-2">
                          {isExpanded
                            ? <ChevronDown className="h-3.5 w-3.5 text-[var(--text-muted)] mx-auto" />
                            : <ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)] mx-auto" />
                          }
                        </td>

                        {/* ORDER # */}
                        <td>
                          <span className="mono text-[var(--accent)] font-medium">
                            {order.orderNumber}
                          </span>
                        </td>

                        {/* TYPE */}
                        <td>
                          {order.type === 'PURCHASE'
                            ? <span className="badge badge-blue">PO</span>
                            : <span className="badge badge-purple">SO</span>
                          }
                        </td>

                        {/* PARTNER */}
                        <td className="text-[13px] text-[var(--text-primary)]">
                          {order.type === 'PURCHASE' ? order.supplier : order.customer}
                        </td>

                        {/* DATE */}
                        <td className="text-[12px] text-[var(--text-muted)]">
                          {order.expectedAt
                            ? new Date(order.expectedAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
                            : '—'}
                        </td>

                        {/* TOTAL */}
                        <td>
                          <div className="font-semibold text-lg text-[var(--text-primary)] tabular-nums font-['JetBrains_Mono']">
                            ₹{order.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </td>

                        {/* STATUS */}
                        <td>
                          <span className={getStatusBadgeClass(order.status)}>
                            {order.status}
                          </span>
                        </td>

                        {/* PIPELINE */}
                        <td onClick={(e) => e.stopPropagation()}>
                          <PipelineStepper status={order.status} />
                        </td>

                        {/* ACTIONS */}
                        <td onClick={(e) => e.stopPropagation()}>
                          {order.status !== 'DELIVERED' && order.status !== 'CANCELLED' ? (
                            <button
                              className="btn-ghost text-[12px] text-[var(--accent)] hover:text-[var(--text-primary)]"
                              onClick={() => {
                                setSelectedOrder(order);
                                setStatusUpdate({ status: order.status, warehouseId: warehouses[0]?.id || '' });
                                setShowStatusModal(true);
                              }}
                            >
                              Update
                            </button>
                          ) : (
                            <span className="text-[12px] text-[var(--text-muted)]">—</span>
                          )}
                        </td>
                      </tr>

                      {/* Expanded sub-row: order items */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={9} className="p-0 bg-[var(--bg-root)]">
                            <div className="px-8 py-3 border-t border-[var(--border)]">
                              <p className="section-label mb-2">Line Items</p>
                              <table className="w-full">
                                <thead>
                                  <tr>
                                    <th className="text-left">Product</th>
                                    <th className="text-left">SKU</th>
                                    <th className="text-right">Qty</th>
                                    <th className="text-right">Unit Price</th>
                                    <th className="text-right">Line Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {order.items.map((item: any) => (
                                    <tr key={item.id}>
                                      <td className="text-[var(--text-primary)]">{item.product.name}</td>
                                      <td><span className="mono text-[var(--text-muted)]">{item.product.sku}</span></td>
                                      <td className="text-right tabular-nums">{item.quantity}</td>
                                      <td className="text-right tabular-nums font-['JetBrains_Mono']">₹{item.unitPrice.toFixed(2)}</td>
                                      <td className="text-right tabular-nums font-['JetBrains_Mono'] font-semibold text-[var(--text-primary)]">₹{item.total.toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {order.notes && (
                                <p className="text-[12px] text-[var(--text-muted)] mt-2 pt-2 border-t border-[var(--border)]">
                                  <span className="text-[var(--text-secondary)] font-semibold">Remarks: </span>
                                  {order.notes}
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── New Order Modal ──────────────────────── */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal w-full max-w-xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="modal-header flex-shrink-0">
              <span className="modal-title">Create Order</span>
              <button
                onClick={() => setShowAddModal(false)}
                className="btn-ghost p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleCreateOrder} className="flex flex-col flex-1 overflow-hidden">
              <div className="modal-body flex-1 overflow-y-auto space-y-4">
                {/* Row 1: Type + Partner */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="section-label block mb-1.5">Order Type *</label>
                    <select
                      value={newOrder.type}
                      onChange={(e) => setNewOrder((prev) => ({ ...prev, type: e.target.value }))}
                    >
                      <option value="PURCHASE">Purchase Order (Inbound)</option>
                      <option value="SALES">Sales Order (Outbound)</option>
                    </select>
                  </div>
                  <div>
                    <label className="section-label block mb-1.5">
                      {newOrder.type === 'PURCHASE' ? 'Supplier *' : 'Customer *'}
                    </label>
                    <input
                      type="text"
                      required
                      value={newOrder.partner}
                      onChange={(e) => setNewOrder((prev) => ({ ...prev, partner: e.target.value }))}
                      placeholder={newOrder.type === 'PURCHASE' ? 'e.g. Hansa Pharma Inc' : 'e.g. BestRetail Corp'}
                    />
                  </div>
                </div>

                {/* Row 2: Date + Notes */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="section-label block mb-1.5">Expected Date</label>
                    <input
                      type="date"
                      value={newOrder.expectedAt}
                      onChange={(e) => setNewOrder((prev) => ({ ...prev, expectedAt: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="section-label block mb-1.5">Notes</label>
                    <input
                      type="text"
                      value={newOrder.notes}
                      onChange={(e) => setNewOrder((prev) => ({ ...prev, notes: e.target.value }))}
                      placeholder="e.g. Standard terms, fragile cargo"
                    />
                  </div>
                </div>

                {/* Divider + Line Items */}
                <hr className="divider" />
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="section-label">Line Items</span>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="btn-ghost text-[var(--accent)] hover:text-[var(--text-primary)] text-[12px]"
                    >
                      <Plus className="h-3 w-3" />
                      Add Line Item
                    </button>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {orderItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 bg-[var(--bg-root)] border border-[var(--border)] rounded-lg px-2 py-1.5"
                      >
                        {/* Product select */}
                        <div className="flex-1">
                          <select
                            required
                            value={item.productId}
                            onChange={(e) => handleItemChange(idx, 'productId', e.target.value)}
                            style={{ marginBottom: 0 }}
                          >
                            <option value="">Select product…</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} (₹{p.unitPrice})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Qty */}
                        <div style={{ width: 60 }}>
                          <input
                            type="number"
                            required
                            placeholder="Qty"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                            min="1"
                            className="text-center"
                          />
                        </div>

                        {/* Price */}
                        <div style={{ width: 76 }}>
                          <input
                            type="number"
                            step="0.01"
                            required
                            placeholder="Price"
                            value={item.unitPrice}
                            onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                            className="text-center"
                          />
                        </div>

                        {/* Remove */}
                        {orderItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="btn-ghost p-1 text-[var(--danger)] hover:text-red-300 flex-shrink-0"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="modal-footer flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Place Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Status Update Modal ──────────────────── */}
      {showStatusModal && selectedOrder && (
        <div className="modal-overlay">
          <div className="modal w-full max-w-sm">
            {/* Header */}
            <div className="modal-header">
              <div>
                <span className="modal-title">Update Status</span>
                <p className="mono text-[var(--text-muted)] mt-0.5">{selectedOrder.orderNumber}</p>
              </div>
              <button
                onClick={() => setShowStatusModal(false)}
                className="btn-ghost p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleUpdateStatus}>
              <div className="modal-body space-y-4">
                <div>
                  <label className="section-label block mb-1.5">Pipeline Status *</label>
                  <select
                    value={statusUpdate.status}
                    onChange={(e) => setStatusUpdate((prev) => ({ ...prev, status: e.target.value }))}
                  >
                    <option value="PENDING">PENDING</option>
                    <option value="CONFIRMED">CONFIRMED</option>
                    <option value="SHIPPED">SHIPPED</option>
                    <option value="DELIVERED">DELIVERED — Fulfill &amp; adjust stock</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </div>

                {/* Warehouse picker shown only on DELIVERED */}
                {statusUpdate.status === 'DELIVERED' && (
                  <div className="bg-[var(--bg-root)] border border-[var(--border)] rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2 text-[var(--accent)]">
                      <Truck className="h-3.5 w-3.5" />
                      <span className="section-label text-[var(--accent)]">Stock Receiving Point</span>
                    </div>
                    <p className="text-[12px] text-[var(--text-muted)]">
                      Fulfilling will automatically adjust physical inventory levels.
                    </p>
                    <div>
                      <label className="section-label block mb-1.5">Warehouse</label>
                      <select
                        value={statusUpdate.warehouseId}
                        onChange={(e) => setStatusUpdate((prev) => ({ ...prev, warehouseId: e.target.value }))}
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
              </div>

              {/* Footer */}
              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
