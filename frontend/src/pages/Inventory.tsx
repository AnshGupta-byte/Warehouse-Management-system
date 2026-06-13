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

  // Input class helper
  const inputCls =
    'w-full bg-[#070d19] border border-[#1e2d45] rounded-md px-3 py-2 text-sm text-[#cbd5e1] placeholder-[#4a5f7a] focus:outline-none focus:border-[#243552] focus:ring-0 transition-colors';
  const selectCls =
    'bg-[#070d19] border border-[#1e2d45] rounded-md px-3 py-2 text-sm text-[#94a3b8] focus:outline-none focus:border-[#243552] transition-colors';
  const labelCls = 'block text-[10px] font-semibold tracking-widest text-[#4a5f7a] uppercase mb-1.5';

  return (
    <div className="space-y-4">
      {/* ── Page Toolbar ─────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        {/* Left: Title + record count */}
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-white">Inventory Management</h1>
          <span className="inline-flex items-center px-2 py-0.5 rounded border border-[#1e2d45] bg-[#0b1120] text-[10px] font-semibold tracking-widest text-[#4a5f7a] uppercase tabular-nums">
            {loading ? '—' : filteredProducts.length} records
          </span>
        </div>

        {/* Right: Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBarcodeScanner(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#94a3b8] bg-[#0b1120] border border-[#1e2d45] rounded-md hover:border-[#243552] hover:text-white transition-colors"
          >
            <Camera className="h-3.5 w-3.5" />
            Scan Barcode
          </button>
          <button
            onClick={triggerFileSelect}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#94a3b8] bg-[#0b1120] border border-[#1e2d45] rounded-md hover:border-[#243552] hover:text-white transition-colors"
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#3b82f6] border border-[#3b82f6] rounded-md hover:bg-[#2563eb] hover:border-[#2563eb] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Product
          </button>
        </div>
      </div>

      {/* ── CSV feedback ─────────────────────────────────────── */}
      {csvError && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-950/20 border border-red-900/40 rounded-md text-xs text-[#ef4444]">
          <X className="h-3.5 w-3.5 shrink-0" />
          {csvError}
        </div>
      )}
      {csvSuccess && (
        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-950/20 border border-emerald-900/40 rounded-md text-xs text-[#10b981]">
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
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#4a5f7a]" />
        <input
          type="text"
          placeholder="Search by product name, SKU, or category..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[#0b1120] border border-[#1e2d45] rounded-md pl-9 pr-4 py-2 text-sm text-[#cbd5e1] placeholder-[#4a5f7a] focus:outline-none focus:border-[#243552] transition-colors"
        />
      </div>

      {/* ── Products Table Panel ──────────────────────────────── */}
      <div className="bg-[#0b1120] border border-[#1e2d45] rounded-lg overflow-hidden">
        {/* Panel Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2d45]">
          <span className="text-xs font-semibold text-white">All Products</span>
          <div className="flex items-center gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-[#070d19] border border-[#1e2d45] rounded-md px-2.5 py-1 text-[11px] text-[#94a3b8] focus:outline-none focus:border-[#243552] transition-colors"
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
              className="bg-[#070d19] border border-[#1e2d45] rounded-md px-2.5 py-1 text-[11px] text-[#94a3b8] focus:outline-none focus:border-[#243552] transition-colors"
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
              <tr className="border-b border-[#1e2d45] bg-[#0b1120]">
                {['SKU', 'Product Name', 'Category', 'Location', 'Unit Price', 'Stock', 'Reorder Pt', 'Status', 'Actions'].map((col) => (
                  <th
                    key={col}
                    className="px-4 py-2.5 text-[10px] font-semibold tracking-widest text-[#4a5f7a] uppercase whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-5 w-5 border-2 border-[#1e2d45] border-t-[#3b82f6] rounded-full animate-spin" />
                      <span className="text-xs text-[#4a5f7a]">Loading inventory...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="h-8 w-8 text-[#1e2d45]" />
                      <span className="text-xs text-[#4a5f7a]">No products match the current filters</span>
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

                  return (
                    <tr
                      key={p.id}
                      className="border-b border-[#1e2d45] hover:bg-[#0f1729] transition-colors"
                    >
                      {/* SKU */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-mono text-[11px] text-[#60a5fa]">{p.sku}</span>
                      </td>

                      {/* Product Name */}
                      <td className="px-4 py-3">
                        <div className="text-[12px] font-medium text-[#cbd5e1] leading-snug">{p.name}</div>
                        {p.description && (
                          <div className="text-[10px] text-[#4a5f7a] mt-0.5 truncate max-w-[180px]">{p.description}</div>
                        )}
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide border"
                          style={{
                            backgroundColor: `${p.category.color}12`,
                            color: p.category.color,
                            borderColor: `${p.category.color}28`,
                          }}
                        >
                          {p.category.name}
                        </span>
                      </td>

                      {/* Location */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-[#4a5f7a] shrink-0" />
                          <span className="font-mono text-[11px] text-[#4a5f7a]">{primaryLocation}</span>
                          {p.stockLevels.length > 1 && (
                            <span className="text-[10px] text-[#4a5f7a]">+{p.stockLevels.length - 1}</span>
                          )}
                        </div>
                      </td>

                      {/* Unit Price */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-mono text-[12px] text-white tabular-nums">
                          ${p.unitPrice.toFixed(2)}
                        </span>
                      </td>

                      {/* Stock qty */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`font-mono text-[13px] font-semibold tabular-nums ${
                            isLow ? 'text-[#ef4444]' : 'text-[#10b981]'
                          }`}
                        >
                          {totalStock}
                        </span>
                        {p.unit && (
                          <span className="text-[10px] text-[#4a5f7a] ml-1">{p.unit}</span>
                        )}
                      </td>

                      {/* Reorder Point */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-mono text-[11px] text-[#4a5f7a] tabular-nums">{p.reorderPoint}</span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isLow ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-widest uppercase text-[#ef4444] bg-red-950/20 border border-red-900/40">
                            Low Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-widest uppercase text-[#10b981] bg-emerald-950/20 border border-emerald-900/30">
                            In Stock
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          {/* Edit / Barcode */}
                          <button
                            onClick={() => {
                              setSelectedProduct(p);
                              setShowCodeModal(true);
                            }}
                            className="p-1.5 rounded text-[#4a5f7a] hover:text-[#94a3b8] hover:bg-[#0f1729] transition-colors"
                            title="View Barcode / QR Code"
                          >
                            <Barcode className="h-3.5 w-3.5" />
                          </button>
                          {/* Stock Adjust */}
                          <button
                            onClick={() => {
                              setAdjustData((prev) => ({ ...prev, productId: p.id }));
                              setShowAdjustModal(true);
                            }}
                            className="p-1.5 rounded text-[#4a5f7a] hover:text-[#94a3b8] hover:bg-[#0f1729] transition-colors"
                            title="Adjust Stock"
                          >
                            <PackageOpen className="h-3.5 w-3.5" />
                          </button>
                          {/* Edit (stub — opens add modal prefilled) */}
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
                            className="p-1.5 rounded text-[#4a5f7a] hover:text-[#94a3b8] hover:bg-[#0f1729] transition-colors"
                            title="Edit Product"
                          >
                            <Pencil className="h-3.5 w-3.5" />
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
          <div className="px-4 py-2.5 border-t border-[#1e2d45] flex items-center justify-between">
            <span className="text-[10px] text-[#4a5f7a]">
              Showing <span className="text-[#94a3b8] font-semibold">{filteredProducts.length}</span> product{filteredProducts.length !== 1 ? 's' : ''}
            </span>
            <span className="text-[10px] text-[#4a5f7a]">
              Live sync active
              <span className="inline-block ml-1.5 h-1.5 w-1.5 rounded-full bg-[#10b981] animate-pulse" />
            </span>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════
          ADD / EDIT PRODUCT MODAL
      ═══════════════════════════════════════════════════════ */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070d19]/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#0b1120] border border-[#1e2d45] rounded-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2d45]">
              <h3 className="text-sm font-semibold text-white">Add New Product</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded text-[#4a5f7a] hover:text-white hover:bg-[#0f1729] transition-colors"
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
                    <label className={labelCls}>Product Name <span className="text-[#ef4444]">*</span></label>
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
                    <label className={labelCls}>SKU <span className="text-[#4a5f7a] normal-case">(auto if blank)</span></label>
                    <input
                      type="text"
                      value={formData.sku}
                      onChange={(e) => setFormData((prev) => ({ ...prev, sku: e.target.value }))}
                      className={inputCls}
                      placeholder="e.g. MKB-001"
                    />
                  </div>
                </div>

                {/* Row: Category / Location */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Category <span className="text-[#ef4444]">*</span></label>
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
                    <label className={labelCls}>Unit Price ($) <span className="text-[#ef4444]">*</span></label>
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
                    <label className={labelCls}>Reorder Point <span className="text-[#ef4444]">*</span></label>
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
                    <label className={labelCls}>Reorder Qty <span className="text-[#ef4444]">*</span></label>
                    <input
                      type="number"
                      required
                      value={formData.reorderQty}
                      onChange={(e) => setFormData((prev) => ({ ...prev, reorderQty: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Safety Stock <span className="text-[#ef4444]">*</span></label>
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
                <div className="border-t border-[#1e2d45] pt-4">
                  <p className="text-[10px] font-semibold tracking-widest text-[#4a5f7a] uppercase mb-3">
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
                        className={`${inputCls} text-center font-mono`}
                        maxLength={2}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Shelf</label>
                      <input
                        type="text"
                        value={formData.shelf}
                        onChange={(e) => setFormData((prev) => ({ ...prev, shelf: e.target.value }))}
                        className={`${inputCls} text-center font-mono`}
                        maxLength={3}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Bin</label>
                      <input
                        type="text"
                        value={formData.bin}
                        onChange={(e) => setFormData((prev) => ({ ...prev, bin: e.target.value }))}
                        className={`${inputCls} text-center font-mono`}
                        maxLength={3}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#1e2d45] bg-[#0b1120]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#94a3b8] bg-transparent border border-[#1e2d45] rounded-md hover:border-[#243552] hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#3b82f6] border border-[#3b82f6] rounded-md hover:bg-[#2563eb] hover:border-[#2563eb] transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070d19]/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#0b1120] border border-[#1e2d45] rounded-lg shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2d45]">
              <h3 className="text-sm font-semibold text-white">Adjust Stock</h3>
              <button
                onClick={() => setShowAdjustModal(false)}
                className="p-1 rounded text-[#4a5f7a] hover:text-white hover:bg-[#0f1729] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleAdjustStock}>
              <div className="px-5 py-4 space-y-4">
                {/* Product select */}
                <div>
                  <label className={labelCls}>Product <span className="text-[#ef4444]">*</span></label>
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
                    <label className={labelCls}>Type <span className="text-[#ef4444]">*</span></label>
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
                    <label className={labelCls}>Quantity <span className="text-[#ef4444]">*</span></label>
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
                  <label className={labelCls}>Warehouse <span className="text-[#ef4444]">*</span></label>
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
                      className={`${inputCls} text-center font-mono`}
                      maxLength={2}
                    />
                    <input
                      type="text"
                      placeholder="Shelf"
                      value={adjustData.shelf}
                      onChange={(e) => setAdjustData((prev) => ({ ...prev, shelf: e.target.value }))}
                      className={`${inputCls} text-center font-mono`}
                      maxLength={3}
                    />
                    <input
                      type="text"
                      placeholder="Bin"
                      value={adjustData.bin}
                      onChange={(e) => setAdjustData((prev) => ({ ...prev, bin: e.target.value }))}
                      className={`${inputCls} text-center font-mono`}
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
              <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#1e2d45] bg-[#0b1120]">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#94a3b8] bg-transparent border border-[#1e2d45] rounded-md hover:border-[#243552] hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#3b82f6] border border-[#3b82f6] rounded-md hover:bg-[#2563eb] hover:border-[#2563eb] transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070d19]/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#0b1120] border border-[#1e2d45] rounded-lg shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2d45]">
              <h3 className="text-sm font-semibold text-white">Product Label</h3>
              <button
                onClick={() => setShowCodeModal(false)}
                className="p-1 rounded text-[#4a5f7a] hover:text-white hover:bg-[#0f1729] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-5 py-4 space-y-4">
              {/* Product info */}
              <div className="text-center">
                <p className="text-xs font-medium text-[#cbd5e1]">{selectedProduct.name}</p>
                <p className="font-mono text-[11px] text-[#60a5fa] mt-0.5">{selectedProduct.sku}</p>
              </div>

              {/* Barcode */}
              <div className="bg-white rounded-md p-4 flex flex-col items-center border border-[#1e2d45]">
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
                <div className="text-[10px] font-mono text-black font-bold tracking-widest mt-2">
                  {selectedProduct.sku}
                </div>
              </div>

              {/* QR Code */}
              <div className="bg-white rounded-md p-3 flex flex-col items-center border border-[#1e2d45] max-w-[120px] mx-auto">
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
                <div className="text-[8px] font-mono text-[#4a5f7a] mt-1.5 uppercase tracking-widest">
                  Scan QR
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#1e2d45]">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#94a3b8] border border-[#1e2d45] rounded-md hover:border-[#243552] hover:text-white transition-colors"
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
