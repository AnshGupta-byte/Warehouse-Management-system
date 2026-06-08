'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import Papa from 'papaparse'

interface Props {
  products: any[]
  categories: any[]
  total: number
}

const STATUS_COLORS: Record<string, string> = {
  OK: 'badge-green',
  LOW_STOCK: 'badge-amber',
  OUT_OF_STOCK: 'badge-red',
}

const STATUS_ICONS: Record<string, string> = {
  OK: '✅',
  LOW_STOCK: '⚠️',
  OUT_OF_STOCK: '🔴',
}

export default function InventoryClient({ products: initialProducts, categories, total }: Props) {
  const [products, setProducts] = useState(initialProducts)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importStatus, setImportStatus] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newProduct, setNewProduct] = useState({ sku: '', name: '', categoryId: '', unitPrice: '', reorderPoint: '10', reorderQty: '50' })

  const fetchProducts = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (categoryFilter) params.set('category', categoryFilter)
    if (lowStockOnly) params.set('lowStock', 'true')
    const res = await fetch(`/api/inventory?${params}`)
    const data = await res.json()
    setProducts(data.products || [])
    setLoading(false)
  }

  const handleSearch = () => fetchProducts()

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return
    setImportStatus('Parsing CSV...')

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        setImportStatus(`Uploading ${results.data.length} rows...`)
        const res = await fetch('/api/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: results.data }),
        })
        const data = await res.json()
        setImportStatus(data.message)
        fetchProducts()
      },
    })
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1,
  })

  const handleAddProduct = async () => {
    const res = await fetch('/api/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newProduct,
        unitPrice: parseFloat(newProduct.unitPrice),
        reorderPoint: parseInt(newProduct.reorderPoint),
        reorderQty: parseInt(newProduct.reorderQty),
      }),
    })
    if (res.ok) {
      setShowAddModal(false)
      setNewProduct({ sku: '', name: '', categoryId: '', unitPrice: '', reorderPoint: '10', reorderQty: '50' })
      fetchProducts()
    }
  }

  const getStockStatus = (product: any) => {
    if (product.totalStock === 0) return 'OUT_OF_STOCK'
    if (product.totalStock <= product.reorderPoint) return 'LOW_STOCK'
    return 'OK'
  }

  const getCategoryColor = (name: string) => {
    const colors: Record<string, string> = {
      'Electronics': 'badge-blue',
      'Furniture': 'badge-purple',
      'Clothing': 'badge-red',
      'Food & Beverage': 'badge-amber',
      'Tools & Hardware': 'badge-green',
    }
    return colors[name] || 'badge-gray'
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="page-subtitle">{total} total products across all warehouses</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowImport(!showImport)} id="import-csv-btn">
            📥 Import CSV
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)} id="add-product-btn">
            + Add Product
          </button>
        </div>
      </div>

      {/* CSV Import Panel */}
      {showImport && (
        <div className="card mb-4" style={{ padding: 24, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>📥 Import Products from CSV</div>
          <div
            {...getRootProps()}
            style={{
              border: `2px dashed ${isDragActive ? 'var(--accent-blue)' : 'var(--border)'}`,
              borderRadius: 12,
              padding: '32px',
              textAlign: 'center',
              cursor: 'pointer',
              background: isDragActive ? 'var(--accent-blue-glow)' : 'var(--bg-input)',
              transition: 'var(--transition)',
            }}
          >
            <input {...getInputProps()} id="csv-file-input" />
            <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              {isDragActive ? 'Drop the CSV here...' : 'Drag & drop a CSV file, or click to browse'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
              Columns: sku, name, category, unit_price, reorder_point, reorder_qty, stock_main
            </div>
          </div>
          {importStatus && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(59,130,246,0.1)', borderRadius: 8, fontSize: 13, color: 'var(--accent-blue)' }}>
              {importStatus}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="search-bar" style={{ flex: 1, maxWidth: 320 }}>
          <span className="search-bar-icon">🔍</span>
          <input
            type="text"
            className="input"
            placeholder="Search by name or SKU..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            id="inventory-search-input"
          />
        </div>

        <select
          className="input"
          style={{ width: 180 }}
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          id="category-filter-select"
        >
          <option value="">All Categories</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <button
          className={`btn ${lowStockOnly ? 'btn-danger' : 'btn-secondary'} btn-sm`}
          onClick={() => { setLowStockOnly(!lowStockOnly); setTimeout(fetchProducts, 50) }}
          id="low-stock-filter-btn"
        >
          {lowStockOnly ? '🔴 Low Stock Only' : '⚠️ Low Stock Only'}
        </button>

        <button className="btn btn-primary btn-sm" onClick={handleSearch} id="search-apply-btn">
          Apply
        </button>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product</th>
              <th>Category</th>
              <th>Stock Level</th>
              <th>Unit Price</th>
              <th>Reorder Point</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 40 }}>
                  <div className="spinner" style={{ margin: '0 auto' }} />
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">
                    <div className="empty-state-icon">📦</div>
                    <div className="empty-state-title">No products found</div>
                    <div className="empty-state-desc">Try adjusting your search filters</div>
                  </div>
                </td>
              </tr>
            ) : (
              products.map(product => {
                const status = getStockStatus(product)
                const pct = Math.min(100, Math.round((product.totalStock / Math.max(product.reorderPoint * 5, 1)) * 100))
                const barColor = status === 'OUT_OF_STOCK' ? '#ef4444' : status === 'LOW_STOCK' ? '#f59e0b' : '#10b981'
                return (
                  <tr key={product.id} id={`product-row-${product.sku}`}>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-input)', padding: '3px 8px', borderRadius: 4 }}>
                        {product.sku}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{product.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{product.description || 'No description'}</div>
                    </td>
                    <td>
                      <span className={`badge ${getCategoryColor(product.category?.name)}`}>
                        {product.category?.name}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="progress-bar" style={{ width: 80 }}>
                          <div className="progress-fill" style={{ width: `${pct}%`, background: barColor }} />
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 700, minWidth: 40 }}>
                          {product.totalStock?.toLocaleString() ?? 0}
                        </span>
                      </div>
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      ${product.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{product.reorderPoint}</td>
                    <td>
                      <span className={`badge ${STATUS_COLORS[status]}`}>
                        {STATUS_ICONS[status]} {status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAddModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">Add New Product</span>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="input-group">
                  <label className="input-label">SKU *</label>
                  <input className="input" placeholder="ELEC-011" value={newProduct.sku} onChange={e => setNewProduct({ ...newProduct, sku: e.target.value })} id="new-product-sku" />
                </div>
                <div className="input-group">
                  <label className="input-label">Category *</label>
                  <select className="input" value={newProduct.categoryId} onChange={e => setNewProduct({ ...newProduct, categoryId: e.target.value })} id="new-product-category">
                    <option value="">Select category</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Product Name *</label>
                <input className="input" placeholder="Product name" value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} id="new-product-name" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                <div className="input-group">
                  <label className="input-label">Unit Price ($)</label>
                  <input className="input" type="number" placeholder="0.00" value={newProduct.unitPrice} onChange={e => setNewProduct({ ...newProduct, unitPrice: e.target.value })} id="new-product-price" />
                </div>
                <div className="input-group">
                  <label className="input-label">Reorder Point</label>
                  <input className="input" type="number" value={newProduct.reorderPoint} onChange={e => setNewProduct({ ...newProduct, reorderPoint: e.target.value })} id="new-product-reorder" />
                </div>
                <div className="input-group">
                  <label className="input-label">Reorder Qty</label>
                  <input className="input" type="number" value={newProduct.reorderQty} onChange={e => setNewProduct({ ...newProduct, reorderQty: e.target.value })} id="new-product-reorderqty" />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddProduct} id="save-product-btn">Save Product</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
