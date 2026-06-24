import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { BarcodeScanner } from '../components/BarcodeScanner';
import {
  Search,
  Plus,
  ArrowUpDown,
  Barcode,
  FileDown,
  Upload,
  X,
  MapPin,
  Camera,
  Package,
  PackageOpen,
  Pencil,
  Trash2,
} from 'lucide-react';

export const Inventory: React.FC = () => {
  const { user } = useAuth();
  const { subscribe } = useSocket();

  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [minStockFilter, setMinStockFilter] = useState('');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);

  // Modal form states
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    categoryId: '',
    unitPrice: '',
    reorderPoint: '10',
    reorderQty: '50',
    safetyStock: '5',
    sku: '',
    initialWarehouseId: '',
    initialQuantity: '0',
    aisle: 'A',
    shelf: '01',
    bin: '01',
  });

  const [adjustData, setAdjustData] = useState({
    productId: '',
    warehouseId: '',
    type: 'IN',
    quantity: '',
    reason: '',
    aisle: 'A',
    shelf: '01',
    bin: '01',
  });

  const [loading, setLoading] = useState(true);
  const [csvError, setCsvError] = useState('');
  const [csvSuccess, setCsvSuccess] = useState('');
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchInventoryData = async () => {
    try {
      const [prodRes, catRes, whRes] = await Promise.all([
        api.products.list({ search, category: selectedCategory }),
        api.products.categories(),
        api.warehouses.list(),
      ]);

      if (prodRes.success && catRes.success && whRes.success) {
        setProducts(prodRes.products);
        setCategories(catRes.categories);
        setWarehouses(whRes.warehouses);

        // set default initial warehouse
        if (whRes.warehouses.length > 0) {
          setFormData((prev) => ({ ...prev, initialWarehouseId: whRes.warehouses[0].id }));
          setAdjustData((prev) => ({ ...prev, warehouseId: whRes.warehouses[0].id }));
        }
      }
    } catch (err) {
      console.error('[Inventory] Error loading inventory:', err);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchInventoryData().finally(() => setLoading(false));

    // Live Socket sync
    const unsubscribeStock = subscribe('STOCK_UPDATED', () => {
      fetchInventoryData();
    });

    const unsubscribeProductCreated = subscribe('PRODUCT_CREATED', () => {
      fetchInventoryData();
    });

    const unsubscribeProductUpdated = subscribe('PRODUCT_UPDATED', () => {
      fetchInventoryData();
    });

    return () => {
      unsubscribeStock();
      unsubscribeProductCreated();
      unsubscribeProductUpdated();
    };
  }, [search, selectedCategory, subscribe]);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        name: formData.name,
        description: formData.description,
        categoryId: formData.categoryId,
        unitPrice: parseFloat(formData.unitPrice),
        reorderPoint: parseInt(formData.reorderPoint),
        reorderQty: parseInt(formData.reorderQty),
        safetyStock: parseInt(formData.safetyStock),
        sku: formData.sku || undefined,
      };

      if (parseInt(formData.initialQuantity) > 0) {
        payload.initialStocks = [
          {
            warehouseId: formData.initialWarehouseId,
            quantity: parseInt(formData.initialQuantity),
            aisle: formData.aisle,
            shelf: formData.shelf,
            bin: formData.bin,
          },
        ];
      }

      const res = await api.products.create(payload);
      if (res.success) {
        setShowAddModal(false);
        // Reset form
        setFormData({
          name: '',
          description: '',
          categoryId: categories[0]?.id || '',
          unitPrice: '',
          reorderPoint: '10',
          reorderQty: '50',
          safetyStock: '5',
          sku: '',
          initialWarehouseId: warehouses[0]?.id || '',
          initialQuantity: '0',
          aisle: 'A',
          shelf: '01',
          bin: '01',
        });
        fetchInventoryData();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to create product');
    }
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.products.adjustStock({
        productId: adjustData.productId,
        warehouseId: adjustData.warehouseId,
        type: adjustData.type,
        quantity: parseInt(adjustData.quantity),
        reason: adjustData.reason,
        aisle: adjustData.aisle,
        shelf: adjustData.shelf,
        bin: adjustData.bin,
      });

      if (res.success) {
        setShowAdjustModal(false);
        setAdjustData({
          productId: '',
          warehouseId: warehouses[0]?.id || '',
          type: 'IN',
          quantity: '',
          reason: '',
          aisle: 'A',
          shelf: '01',
          bin: '01',
        });
        fetchInventoryData();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to adjust stock');
    }
  };

  // Drag and Drop CSV Parser
  const handleCsvImport = async (file: File) => {
    setCsvError('');
    setCsvSuccess('');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) return;

        const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
        if (lines.length <= 1) {
          setCsvError('CSV file is empty or missing content headers.');
          return;
        }

        const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
        const requiredHeaders = ['name', 'category', 'price'];
        const missing = requiredHeaders.filter((req) => !headers.includes(req));

        if (missing.length > 0) {
          setCsvError(`Missing required headers: ${missing.join(', ')}`);
          return;
        }

        let importedCount = 0;

        // Ensure a default warehouse exists
        const defaultWh = warehouses[0];
        if (!defaultWh) {
          setCsvError('Ensure at least one warehouse is defined before importing.');
          return;
        }

        // Get category lookup map
        const categoriesRes = await api.products.categories();
        const catMap: { [key: string]: string } = {};
        categoriesRes.categories.forEach((c: any) => {
          catMap[c.name.toLowerCase()] = c.id;
        });

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map((c) => c.trim());
          if (cols.length < headers.length) continue;

          // Map columns dynamically
          const row: any = {};
          headers.forEach((h, idx) => {
            row[h] = cols[idx];
          });

          // Resolve or create category
          let categoryId = catMap[row.category?.toLowerCase()];
          if (!categoryId && row.category) {
            const newCat = await api.products.createCategory({ name: row.category });
            categoryId = newCat.category.id;
            catMap[row.category.toLowerCase()] = categoryId;
          }

          if (!categoryId) {
            categoryId = categories[0]?.id;
          }

          const qty = parseInt(row.quantity) || 0;
          const payload: any = {
            name: row.name,
            description: row.description || '',
            categoryId,
            unitPrice: parseFloat(row.price),
            sku: row.sku || undefined,
            reorderPoint: parseInt(row.reorderpoint) || 10,
            reorderQty: parseInt(row.reorderqty) || 50,
            safetyStock: parseInt(row.safetystock) || 5,
          };

          if (qty > 0) {
            payload.initialStocks = [
              {
                warehouseId: defaultWh.id,
                quantity: qty,
                aisle: row.aisle || 'A',
                shelf: row.shelf || '01',
                bin: row.bin || '01',
              },
            ];
          }

          await api.products.create(payload);
          importedCount++;
        }

        setCsvSuccess(`Successfully imported ${importedCount} products into inventory!`);
        fetchInventoryData();
      } catch (err: any) {
        setCsvError(err.message || 'Error processing CSV upload.');
      }
    };

    reader.readAsText(file);
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  // Filtered products for min stock filter (client-side)
  const filteredProducts = minStockFilter
    ? products.filter((p) => {
        const totalStock = p.stockLevels.reduce((sum: number, sl: any) => sum + sl.quantity, 0);
        return totalStock >= parseInt(minStockFilter);
      })
    : products;

  // Input class helpers — zinc design system
  const inputCls =
    "w-full h-10 bg-[var(--bg-root)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13px] text-[var(--text-primary)] placeholder-[#52525b] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/40 focus:border-[var(--accent-light)] transition-colors";
  const selectCls =
    "h-10 bg-[var(--bg-root)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13px] text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/40 focus:border-[var(--accent-light)] transition-colors";
  const labelCls = 'block text-xs font-medium tracking-wide text-[var(--text-muted)] uppercase mb-1.5';

  return (
    <div className="space-y-4">
      {/* ── Page Toolbar ─────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        {/* Left: Title + record count */}
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">Inventory Management</h1>
          <span className="badge badge-blue font-['JetBrains_Mono'] text-[11px] tabular-nums">
            {loading ? '—' : filteredProducts.length} records
          </span>
        </div>

        {/* Right: Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBarcodeScanner(true)}
            className="btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
          >
            <Camera className="h-3.5 w-3.5" />
            Scan Barcode
          </button>
          <button
            onClick={triggerFileSelect}
            className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
          >
            <Upload className="h-3.5 w-3.5" />
            Import CSV
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => e.target.files && handleCsvImport(e.target.files[0])}
            accept=".csv"
            className="hidden"
          />
          <button
            onClick={() => {
              if (categories.length > 0) {
                setFormData((prev) => ({ ...prev, categoryId: categories[0].id }));
              }
              setShowAddModal(true);
            }}
            className="btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Product
          </button>
        </div>
      </div>

      {/* ── CSV feedback ─────────────────────────────────────── */}
      {csvError && (
        <div className="flex items-center gap-2 px-3 py-2 bg-[rgba(239,68,68,0.08)] rounded-lg text-xs text-[var(--danger)]">
          <X className="h-3.5 w-3.5 shrink-0" />
          {csvError}
        </div>
      )}
      {csvSuccess && (
        <div className="flex items-center gap-2 px-3 py-2 bg-[rgba(16,185,129,0.08)] rounded-lg text-xs text-[var(--success)]">
          {csvSuccess}
        </div>
      )}

      {/* ── Barcode Scanner Modal ─────────────────────────────── */}
      {showBarcodeScanner && (
        <BarcodeScanner
          onScan={(code) => {
            setSearch(code);
            setShowBarcodeScanner(false);
          }}
          onClose={() => setShowBarcodeScanner(false)}
        />
      )}

      {/* ── Search Bar ───────────────────────────────────────── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
        <input
          type="text"
          placeholder="Search by product name, SKU, or category..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg pl-10 pr-4 py-2 text-[13px] text-[var(--text-primary)] placeholder-[#52525b] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/40 focus:border-[var(--accent-light)] transition-colors"
        />
      </div>

      {/* ── Products Table Panel ──────────────────────────────── */}
      <div className="panel overflow-hidden">
        {/* Panel Header */}
        <div className="panel-header flex items-center justify-between border-b border-[var(--border)]">
          <span className="panel-title">All Products</span>
          <div className="flex items-center gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-8 bg-[var(--bg-root)] border border-[var(--border)] rounded-lg px-2.5 py-1 text-xs text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/40 focus:border-[var(--accent-light)] transition-colors"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={minStockFilter}
              onChange={(e) => setMinStockFilter(e.target.value)}
              className="h-8 bg-[var(--bg-root)] border border-[var(--border)] rounded-lg px-2.5 py-1 text-xs text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/40 focus:border-[var(--accent-light)] transition-colors"
            >
              <option value="">Min Stock: Any</option>
              <option value="0">Stock ≥ 0</option>
              <option value="10">Stock ≥ 10</option>
              <option value="50">Stock ≥ 50</option>
              <option value="100">Stock ≥ 100</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {['SKU', 'Product Name', 'Category', 'Location', 'Unit Price', 'Stock', 'Reorder Pt', 'Status', 'Actions'].map((col) => (
                  <th
                    key={col}
                    className="px-4 py-2.5 text-xs font-medium tracking-wide text-[var(--text-muted)] uppercase whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                /* ── Skeleton Loading ── */
                <>
                  {[...Array(5)].map((_, i) => (
                    <tr key={i} className="border-b border-[var(--border)]">
                      {[...Array(9)].map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="skeleton h-4 rounded" style={{ width: j === 1 ? '140px' : j === 8 ? '80px' : '60px' }} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-14 w-14 rounded-xl bg-[rgba(37,99,235,0.08)] flex items-center justify-center">
                        <Package className="h-7 w-7 text-[var(--accent)]" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">No products found</p>
                        <p className="text-[13px] text-[var(--text-muted)] mt-0.5">No products match the current filters</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const totalStock = p.stockLevels.reduce((sum: number, sl: any) => sum + sl.quantity, 0);
                  const isLow = totalStock <= p.reorderPoint;
                  // Primary location display
                  const primaryLocation = p.stockLevels[0]
                    ? `${p.stockLevels[0].aisle}-${p.stockLevels[0].shelf}-${p.stockLevels[0].bin}`
                    : '—';
                  // Stock ratio for progress bar
                  const stockRatio = p.reorderPoint > 0 ? Math.min(totalStock / (p.reorderPoint * 3), 1) : 1;

                  return (
                    <tr
                      key={p.id}
                      className="border-b border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors"
                    >
                      {/* SKU */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-['JetBrains_Mono'] text-[11px] text-[var(--accent)]">{p.sku}</span>
                      </td>

                      {/* Product Name */}
                      <td className="px-4 py-3">
                        <div className="text-[13px] font-medium text-[var(--text-primary)] leading-snug">{p.name}</div>
                        {p.description && (
                          <div className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate max-w-[200px]">{p.description}</div>
                        )}
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium"
                          style={{
                            backgroundColor: `${p.category.color}14`,
                            color: p.category.color,
                          }}
                        >
                          {p.category.name}
                        </span>
                      </td>

                      {/* Location */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3 w-3 text-[var(--text-muted)] shrink-0" />
                          <span className="font-['JetBrains_Mono'] text-[11px] text-[var(--text-secondary)]">{primaryLocation}</span>
                          {p.stockLevels.length > 1 && (
                            <span className="text-[10px] text-[var(--text-muted)]">+{p.stockLevels.length - 1}</span>
                          )}
                        </div>
                      </td>

                      {/* Unit Price */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-['JetBrains_Mono'] text-[13px] text-[var(--text-primary)] tabular-nums">
                          ${p.unitPrice.toFixed(2)}
                        </span>
                      </td>

                      {/* Stock qty with progress bar */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-['JetBrains_Mono'] text-[13px] font-semibold tabular-nums ${
                              isLow ? 'text-[var(--danger)]' : 'text-[var(--success)]'
                            }`}
                          >
                            {totalStock}
                          </span>
                          <div className="w-12 h-1.5 rounded-full bg-[#27272a] overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${isLow ? 'bg-[#ef4444]' : 'bg-[#10b981]'}`}
                              style={{ width: `${stockRatio * 100}%` }}
                            />
                          </div>
                        </div>
                        {p.unit && (
                          <span className="text-[10px] text-[var(--text-muted)] ml-1">{p.unit}</span>
                        )}
                      </td>

                      {/* Reorder Point */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-['JetBrains_Mono'] text-[11px] text-[var(--text-muted)] tabular-nums">{p.reorderPoint}</span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isLow ? (
                          <span className="badge badge-danger">
                            Low Stock
                          </span>
                        ) : (
                          <span className="badge badge-success">
                            In Stock
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-0.5">
                          {/* Barcode */}
                          <button
                            onClick={() => {
                              setSelectedProduct(p);
                              setShowCodeModal(true);
                            }}
                            className="btn-ghost p-1.5 rounded-lg"
                            title="View Barcode / QR Code"
                          >
                            <Barcode className="h-4 w-4" />
                          </button>
                          {/* Stock Adjust */}
                          <button
                            onClick={() => {
                              setAdjustData((prev) => ({ ...prev, productId: p.id }));
                              setShowAdjustModal(true);
                            }}
                            className="btn-ghost p-1.5 rounded-lg"
                            title="Adjust Stock"
                          >
                            <PackageOpen className="h-4 w-4" />
                          </button>
                          {/* Edit */}
                          <button
                            onClick={() => {
                              setFormData({
                                name: p.name,
                                description: p.description || '',
                                categoryId: p.category?.id || '',
                                unitPrice: String(p.unitPrice),
                                reorderPoint: String(p.reorderPoint),
                                reorderQty: String(p.reorderQty || 50),
                                safetyStock: String(p.safetyStock || 5),
                                sku: p.sku || '',
                                initialWarehouseId: warehouses[0]?.id || '',
                                initialQuantity: '0',
                                aisle: 'A',
                                shelf: '01',
                                bin: '01',
                              });
                              setShowAddModal(true);
                            }}
                            className="btn-ghost p-1.5 rounded-lg"
                            title="Edit Product"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table footer */}
        {!loading && filteredProducts.length > 0 && (
          <div className="px-4 py-2.5 border-t border-[var(--border)] flex items-center justify-between">
            <span className="text-xs text-[var(--text-muted)]">
              Showing <span className="text-[var(--text-secondary)] font-semibold">{filteredProducts.length}</span> product{filteredProducts.length !== 1 ? 's' : ''}
            </span>
            <span className="text-xs text-[var(--text-muted)] flex items-center gap-1.5">
              Live sync active
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#10b981] animate-pulse" />
            </span>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════
          ADD / EDIT PRODUCT MODAL
      ═══════════════════════════════════════════════════════ */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Add New Product</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="btn-ghost p-1.5 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateProduct} className="overflow-y-auto flex-1">
              <div className="px-5 py-4 space-y-4">
                {/* Row: Name / SKU */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Product Name <span className="text-[var(--danger)]">*</span></label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                      className={inputCls}
                      placeholder="e.g. Mechanical Keyboard"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>SKU <span className="text-[var(--text-muted)] normal-case">(auto if blank)</span></label>
                    <input
                      type="text"
                      value={formData.sku}
                      onChange={(e) => setFormData((prev) => ({ ...prev, sku: e.target.value }))}
                      className={inputCls}
                      placeholder="e.g. MKB-001"
                    />
                  </div>
                </div>

                {/* Row: Category / Description */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Category <span className="text-[var(--danger)]">*</span></label>
                    <select
                      value={formData.categoryId}
                      onChange={(e) => setFormData((prev) => ({ ...prev, categoryId: e.target.value }))}
                      className={`${inputCls}`}
                    >
                      <option value="">Select...</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Description</label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                      className={inputCls}
                      placeholder="Optional notes..."
                    />
                  </div>
                </div>

                {/* Row: Unit Price / Reorder Point */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Unit Price ($) <span className="text-[var(--danger)]">*</span></label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.unitPrice}
                      onChange={(e) => setFormData((prev) => ({ ...prev, unitPrice: e.target.value }))}
                      className={inputCls}
                      placeholder="99.99"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Reorder Point <span className="text-[var(--danger)]">*</span></label>
                    <input
                      type="number"
                      required
                      value={formData.reorderPoint}
                      onChange={(e) => setFormData((prev) => ({ ...prev, reorderPoint: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                </div>

                {/* Row: Reorder Qty / Safety Stock */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Reorder Qty <span className="text-[var(--danger)]">*</span></label>
                    <input
                      type="number"
                      required
                      value={formData.reorderQty}
                      onChange={(e) => setFormData((prev) => ({ ...prev, reorderQty: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Safety Stock <span className="text-[var(--danger)]">*</span></label>
                    <input
                      type="number"
                      required
                      value={formData.safetyStock}
                      onChange={(e) => setFormData((prev) => ({ ...prev, safetyStock: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                </div>

                {/* Initial Stock Placement */}
                <div className="border-t border-[var(--border)] pt-4">
                  <p className="text-xs font-medium tracking-wide text-[var(--text-muted)] uppercase mb-3">
                    Initial Stock Placement
                  </p>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className={labelCls}>Warehouse</label>
                      <select
                        value={formData.initialWarehouseId}
                        onChange={(e) => setFormData((prev) => ({ ...prev, initialWarehouseId: e.target.value }))}
                        className={`${inputCls}`}
                      >
                        {warehouses.map((w) => (
                          <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Intake Quantity</label>
                      <input
                        type="number"
                        value={formData.initialQuantity}
                        onChange={(e) => setFormData((prev) => ({ ...prev, initialQuantity: e.target.value }))}
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className={labelCls}>Aisle</label>
                      <input
                        type="text"
                        value={formData.aisle}
                        onChange={(e) => setFormData((prev) => ({ ...prev, aisle: e.target.value.toUpperCase() }))}
                        className={`${inputCls} text-center font-['JetBrains_Mono']`}
                        maxLength={2}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Shelf</label>
                      <input
                        type="text"
                        value={formData.shelf}
                        onChange={(e) => setFormData((prev) => ({ ...prev, shelf: e.target.value }))}
                        className={`${inputCls} text-center font-['JetBrains_Mono']`}
                        maxLength={3}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Bin</label>
                      <input
                        type="text"
                        value={formData.bin}
                        onChange={(e) => setFormData((prev) => ({ ...prev, bin: e.target.value }))}
                        className={`${inputCls} text-center font-['JetBrains_Mono']`}
                        maxLength={3}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[var(--border)] bg-[var(--bg-surface)]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary px-4 py-2 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary px-4 py-2 text-xs font-medium"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          STOCK ADJUST MODAL
      ═══════════════════════════════════════════════════════ */}
      {showAdjustModal && (
        <div className="modal-overlay">
          <div className="modal w-full max-w-sm flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Adjust Stock</h3>
              <button
                onClick={() => setShowAdjustModal(false)}
                className="btn-ghost p-1.5 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleAdjustStock}>
              <div className="px-5 py-4 space-y-4">
                {/* Product select */}
                <div>
                  <label className={labelCls}>Product <span className="text-[var(--danger)]">*</span></label>
                  <select
                    required
                    value={adjustData.productId}
                    onChange={(e) => setAdjustData((prev) => ({ ...prev, productId: e.target.value }))}
                    className={`${inputCls}`}
                  >
                    <option value="">Select product...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Type + Quantity */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Type <span className="text-[var(--danger)]">*</span></label>
                    <select
                      value={adjustData.type}
                      onChange={(e) => setAdjustData((prev) => ({ ...prev, type: e.target.value }))}
                      className={`${inputCls}`}
                    >
                      <option value="IN">Stock In</option>
                      <option value="OUT">Stock Out</option>
                      <option value="ADJUSTMENT">Adjust (Absolute)</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Quantity <span className="text-[var(--danger)]">*</span></label>
                    <input
                      type="number"
                      required
                      value={adjustData.quantity}
                      onChange={(e) => setAdjustData((prev) => ({ ...prev, quantity: e.target.value }))}
                      className={inputCls}
                      placeholder="e.g. 25"
                    />
                  </div>
                </div>

                {/* Warehouse */}
                <div>
                  <label className={labelCls}>Warehouse <span className="text-[var(--danger)]">*</span></label>
                  <select
                    required
                    value={adjustData.warehouseId}
                    onChange={(e) => setAdjustData((prev) => ({ ...prev, warehouseId: e.target.value }))}
                    className={`${inputCls}`}
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>

                {/* Location coordinates */}
                <div>
                  <label className={labelCls}>Location</label>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Aisle"
                      value={adjustData.aisle}
                      onChange={(e) => setAdjustData((prev) => ({ ...prev, aisle: e.target.value.toUpperCase() }))}
                      className={`${inputCls} text-center font-['JetBrains_Mono']`}
                      maxLength={2}
                    />
                    <input
                      type="text"
                      placeholder="Shelf"
                      value={adjustData.shelf}
                      onChange={(e) => setAdjustData((prev) => ({ ...prev, shelf: e.target.value }))}
                      className={`${inputCls} text-center font-['JetBrains_Mono']`}
                      maxLength={3}
                    />
                    <input
                      type="text"
                      placeholder="Bin"
                      value={adjustData.bin}
                      onChange={(e) => setAdjustData((prev) => ({ ...prev, bin: e.target.value }))}
                      className={`${inputCls} text-center font-['JetBrains_Mono']`}
                      maxLength={3}
                    />
                  </div>
                </div>

                {/* Reason */}
                <div>
                  <label className={labelCls}>Reason</label>
                  <input
                    type="text"
                    value={adjustData.reason}
                    onChange={(e) => setAdjustData((prev) => ({ ...prev, reason: e.target.value }))}
                    className={inputCls}
                    placeholder="e.g. Damaged box, inventory audit"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[var(--border)] bg-[var(--bg-surface)]">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="btn-secondary px-4 py-2 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary px-4 py-2 text-xs font-medium"
                >
                  Apply Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          BARCODE / QR CODE MODAL
      ═══════════════════════════════════════════════════════ */}
      {showCodeModal && selectedProduct && (
        <div className="modal-overlay">
          <div className="modal w-full max-w-sm overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Product Label</h3>
              <button
                onClick={() => setShowCodeModal(false)}
                className="btn-ghost p-1.5 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-5 py-4 space-y-4">
              {/* Product info */}
              <div className="text-center">
                <p className="text-[13px] font-medium text-[var(--text-primary)]">{selectedProduct.name}</p>
                <p className="font-['JetBrains_Mono'] text-[11px] text-[var(--accent)] mt-0.5">{selectedProduct.sku}</p>
              </div>

              {/* Barcode */}
              <div className="bg-white rounded-xl p-4 flex flex-col items-center">
                <div className="flex justify-center items-end h-14 gap-[1px] px-2">
                  {[...Array(24)].map((_, i) => {
                    const isThick = i % 3 === 0 || i % 7 === 0;
                    const isBlank = i % 5 === 0;
                    return (
                      <div
                        key={i}
                        className="bg-black"
                        style={{
                          width: isThick ? '3px' : '1.5px',
                          height: isBlank ? '0px' : '56px',
                        }}
                      />
                    );
                  })}
                </div>
                <div className="text-[10px] font-['JetBrains_Mono'] text-black font-bold tracking-widest mt-2">
                  {selectedProduct.sku}
                </div>
              </div>

              {/* QR Code */}
              <div className="bg-white rounded-xl p-3 flex flex-col items-center max-w-[120px] mx-auto">
                <div className="grid grid-cols-5 gap-0.5">
                  {[...Array(25)].map((_, i) => {
                    const isFilled = i % 2 === 0 || i % 3 === 0 || i === 0 || i === 4 || i === 20 || i === 24;
                    return (
                      <div
                        key={i}
                        className={`h-5 w-5 ${isFilled ? 'bg-black' : 'bg-white'}`}
                      />
                    );
                  })}
                </div>
                <div className="text-[8px] font-['JetBrains_Mono'] text-[var(--text-muted)] mt-1.5 uppercase tracking-widest">
                  Scan QR
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[var(--border)]">
              <button
                onClick={() => window.print()}
                className="btn-secondary inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium"
              >
                <FileDown className="h-3.5 w-3.5" />
                Print Label
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
