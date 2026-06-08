'use client'

import { useState } from 'react'

interface Order {
  id: string
  orderNumber: string
  type: string
  status: string
  supplier: string | null
  totalAmount: number
  orderDate: string
  expectedAt: string | null
  items: any[]
}

interface Props {
  orders: Order[]
  total: number
  products: any[]
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'badge-amber',
  CONFIRMED: 'badge-blue',
  SHIPPED: 'badge-purple',
  DELIVERED: 'badge-green',
  CANCELLED: 'badge-gray',
}

const STATUS_ICON: Record<string, string> = {
  PENDING: '🕐',
  CONFIRMED: '✅',
  SHIPPED: '🚚',
  DELIVERED: '📦',
  CANCELLED: '❌',
}

export default function OrdersClient({ orders: initialOrders, total, products }: Props) {
  const [orders, setOrders] = useState(initialOrders)
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [showNewOrder, setShowNewOrder] = useState(false)
  const [newOrder, setNewOrder] = useState({
    type: 'PURCHASE',
    supplier: '',
    expectedAt: '',
    notes: '',
    items: [{ productId: '', quantity: 1, unitPrice: 0 }],
  })

  const fetchOrders = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (typeFilter) params.set('type', typeFilter)
    if (statusFilter) params.set('status', statusFilter)
    const res = await fetch(`/api/orders?${params}`)
    const data = await res.json()
    setOrders(data.orders || [])
    setLoading(false)
  }

  const updateStatus = async (id: string, status: string) => {
    const res = await fetch('/api/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status, deliveredAt: status === 'DELIVERED' ? new Date().toISOString() : undefined }),
    })
    if (res.ok) fetchOrders()
  }

  const createOrder = async () => {
    const validItems = newOrder.items.filter(i => i.productId && i.quantity > 0)
    if (!validItems.length) return

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newOrder, items: validItems }),
    })
    if (res.ok) {
      setShowNewOrder(false)
      fetchOrders()
    }
  }

  const addOrderItem = () => {
    setNewOrder({ ...newOrder, items: [...newOrder.items, { productId: '', quantity: 1, unitPrice: 0 }] })
  }

  const updateItem = (idx: number, field: string, value: any) => {
    const items = [...newOrder.items]
    items[idx] = { ...items[idx], [field]: value }
    if (field === 'productId') {
      const prod = products.find(p => p.id === value)
      if (prod) items[idx].unitPrice = prod.unitPrice
    }
    setNewOrder({ ...newOrder, items })
  }

  const NEXT_STATUS: Record<string, string> = {
    PENDING: 'CONFIRMED',
    CONFIRMED: 'SHIPPED',
    SHIPPED: 'DELIVERED',
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Orders</h1>
          <p className="page-subtitle">{total} total orders — purchase & sales</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNewOrder(true)} id="new-order-btn">
          + New Order
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <select className="input" style={{ width: 160 }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)} id="order-type-filter">
          <option value="">All Types</option>
          <option value="PURCHASE">Purchase</option>
          <option value="SALES">Sales</option>
        </select>
        <select className="input" style={{ width: 180 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)} id="order-status-filter">
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="SHIPPED">Shipped</option>
          <option value="DELIVERED">Delivered</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <button className="btn btn-secondary btn-sm" onClick={fetchOrders} id="orders-filter-btn">Apply Filters</button>
      </div>

      {/* Order Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Pending', count: orders.filter(o => o.status === 'PENDING').length, color: '#f59e0b' },
          { label: 'In Transit', count: orders.filter(o => o.status === 'SHIPPED').length, color: '#8b5cf6' },
          { label: 'Delivered', count: orders.filter(o => o.status === 'DELIVERED').length, color: '#10b981' },
          { label: 'Purchase Orders', count: orders.filter(o => o.type === 'PURCHASE').length, color: '#3b82f6' },
        ].map((s, i) => (
          <div key={i} className="card" style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.count}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Order #</th>
              <th>Type</th>
              <th>Supplier / Customer</th>
              <th>Items</th>
              <th>Total</th>
              <th>Order Date</th>
              <th>Expected</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }} /></td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={9}><div className="empty-state"><div className="empty-state-icon">🛒</div><div className="empty-state-title">No orders found</div></div></td></tr>
            ) : orders.map(order => (
              <tr key={order.id} id={`order-row-${order.orderNumber}`}>
                <td><span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13 }}>{order.orderNumber}</span></td>
                <td>
                  <span className={`badge ${order.type === 'PURCHASE' ? 'badge-blue' : 'badge-teal'}`}>
                    {order.type === 'PURCHASE' ? '🛍️' : '📤'} {order.type}
                  </span>
                </td>
                <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{order.supplier || '—'}</td>
                <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{order.items?.length ?? 0} items</td>
                <td style={{ fontWeight: 700 }}>${order.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{new Date(order.orderDate).toLocaleDateString()}</td>
                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {order.expectedAt ? new Date(order.expectedAt).toLocaleDateString() : '—'}
                </td>
                <td>
                  <span className={`badge ${STATUS_BADGE[order.status]}`}>
                    {STATUS_ICON[order.status]} {order.status}
                  </span>
                </td>
                <td>
                  {NEXT_STATUS[order.status] && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => updateStatus(order.id, NEXT_STATUS[order.status])}
                      id={`advance-order-${order.orderNumber}`}
                      style={{ fontSize: 11 }}
                    >
                      → {NEXT_STATUS[order.status]}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New Order Modal */}
      {showNewOrder && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowNewOrder(false)}>
          <div className="modal" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <span className="modal-title">Create New Order</span>
              <button onClick={() => setShowNewOrder(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="input-group">
                  <label className="input-label">Order Type</label>
                  <select className="input" value={newOrder.type} onChange={e => setNewOrder({ ...newOrder, type: e.target.value })} id="new-order-type">
                    <option value="PURCHASE">Purchase Order</option>
                    <option value="SALES">Sales Order</option>
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Supplier / Customer</label>
                  <input className="input" placeholder="Company name" value={newOrder.supplier} onChange={e => setNewOrder({ ...newOrder, supplier: e.target.value })} id="new-order-supplier" />
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Expected Date</label>
                <input type="date" className="input" value={newOrder.expectedAt} onChange={e => setNewOrder({ ...newOrder, expectedAt: e.target.value })} id="new-order-expected" />
              </div>

              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Order Items</div>
              {newOrder.items.map((item, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, marginBottom: 8 }}>
                  <select className="input" value={item.productId} onChange={e => updateItem(idx, 'productId', e.target.value)} id={`order-item-product-${idx}`}>
                    <option value="">Select product</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input type="number" className="input" style={{ width: 80 }} placeholder="Qty" min={1} value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value))} id={`order-item-qty-${idx}`} />
                  <span style={{ display: 'flex', alignItems: 'center', fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    ${(item.unitPrice * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
              <button className="btn btn-secondary btn-sm" onClick={addOrderItem} id="add-order-item-btn">+ Add Item</button>

              <div style={{ padding: '12px 0', borderTop: '1px solid var(--border)', marginTop: 8, fontWeight: 700, fontSize: 15 }}>
                Total: ${newOrder.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0).toFixed(2)}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowNewOrder(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createOrder} id="create-order-btn">Create Order</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
