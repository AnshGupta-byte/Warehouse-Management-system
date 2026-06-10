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
  QrCode,
  FileDown,
  Upload,
  X,
  MapPin,
  Sparkles,
  Camera,
} from 'lucide-react';

export const Inventory: React.FC = () => {
  const { user } = useAuth();
  const { subscribe } = useSocket();

  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  
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

  return (
    <div className="space-y-6">
      {/* Header and Import Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* CSV Drop Zone Container */}
        <div className="flex-1 max-w-xl">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files.length > 0) {
                handleCsvImport(e.dataTransfer.files[0]);
              }
            }}
            onClick={triggerFileSelect}
            className="border-2 border-dashed border-slate-800 hover:border-indigo-500/50 bg-slate-900/40 rounded-xl p-4 flex items-center justify-center space-x-3 cursor-pointer transition-all"
          >
            <Upload className="h-5 w-5 text-indigo-400 shrink-0" />
            <div className="text-left">
              <p className="text-xs font-semibold text-slate-300">
                Drag-and-Drop inventory CSV here or <span className="text-indigo-400 hover:underline">browse</span>
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">Required fields: SKU, Name, Category, Price, Quantity</p>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => e.target.files && handleCsvImport(e.target.files[0])}
              accept=".csv"
              className="hidden"
            />
          </div>
          {csvError && <p className="text-xs font-semibold text-red-400 mt-2">{csvError}</p>}
          {csvSuccess && <p className="text-xs font-semibold text-emerald-400 mt-2">{csvSuccess}</p>}
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3">
          <button
            onClick={() => setShowBarcodeScanner(true)}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 transition-all"
            title="Scan barcode to search product"
          >
            <Camera className="h-4 w-4" />
            <span>Scan</span>
          </button>
          <button
            onClick={() => {
              if (categories.length > 0) {
                setFormData((prev) => ({ ...prev, categoryId: categories[0].id }));
              }
              setShowAddModal(true);
            }}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-lg shadow-indigo-500/10"
          >
            <Plus className="h-4 w-4" />
            <span>Add Product</span>
          </button>
          <button
            onClick={() => setShowAdjustModal(true)}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 transition-all"
          >
            <ArrowUpDown className="h-4 w-4" />
            <span>Adjust Stock</span>
          </button>
        </div>
      </div>

      {/* Barcode Scanner Modal */}
      {showBarcodeScanner && (
        <BarcodeScanner
          onScan={(code) => {
            setSearch(code);
            setShowBarcodeScanner(false);
          }}
          onClose={() => setShowBarcodeScanner(false)}
        />
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search products by SKU or Name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Product Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/80">
              <th className="p-4 text-xs font-bold text-slate-400 uppercase">Product details</th>
              <th className="p-4 text-xs font-bold text-slate-400 uppercase">SKU</th>
              <th className="p-4 text-xs font-bold text-slate-400 uppercase">Category</th>
              <th className="p-4 text-xs font-bold text-slate-400 uppercase">Price</th>
              <th className="p-4 text-xs font-bold text-slate-400 uppercase text-center">Warehouse placement</th>
              <th className="p-4 text-xs font-bold text-slate-400 uppercase text-right">In Stock</th>
              <th className="p-4 text-xs font-bold text-slate-400 uppercase text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500">Loading inventory list...</td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500">No products matching filters.</td>
              </tr>
            ) : (
              products.map((p) => {
                const totalStock = p.stockLevels.reduce((sum: number, sl: any) => sum + sl.quantity, 0);
                const isLow = totalStock <= p.reorderPoint;
                
                return (
                  <tr key={p.id} className="border-b border-slate-800/60 hover:bg-slate-900/30 transition-all">
                    <td className="p-4">
                      <div className="font-semibold text-slate-200">{p.name}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{p.description || 'No description'}</div>
                    </td>
                    <td className="p-4 font-mono text-xs text-indigo-400 font-semibold">{p.sku}</td>
                    <td className="p-4">
                      <span
                        className="inline-block px-2 py-0.5 rounded text-[10px] font-bold"
                        style={{ backgroundColor: `${p.category.color}15`, color: p.category.color, border: `1px solid ${p.category.color}30` }}
                      >
                        {p.category.name}
                      </span>
                    </td>
                    <td className="p-4 text-xs text-slate-300 font-semibold">${p.unitPrice.toFixed(2)}</td>
                    <td className="p-4">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        {p.stockLevels.length === 0 ? (
                          <span className="text-[10px] text-slate-600">Unallocated</span>
                        ) : (
                          p.stockLevels.map((sl: any) => (
                            <span key={sl.id} className="inline-flex items-center space-x-1 text-[10px] bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-slate-400">
                              <MapPin className="h-3 w-3 text-indigo-500 shrink-0" />
                              <span>{sl.warehouse.name.split(' ')[0]} : Slot {sl.aisle}-{sl.shelf}-{sl.bin} ({sl.quantity} qty)</span>
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <span className={`inline-block font-extrabold text-xs px-2.5 py-0.5 rounded ${
                        isLow
                          ? 'bg-red-950/40 text-red-400 border border-red-900/50'
                          : 'bg-emerald-950/20 text-emerald-400 border border-emerald-900/20'
                      }`}>
                        {totalStock} {p.unit}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button
                        onClick={() => {
                          setSelectedProduct(p);
                          setShowCodeModal(true);
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition-all inline-flex"
                        title="Display Barcode/QR Code"
                      >
                        <Barcode className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          setAdjustData((prev) => ({ ...prev, productId: p.id }));
                          setShowAdjustModal(true);
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition-all inline-flex"
                        title="Adjust Stock"
                      >
                        <ArrowUpDown className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                <Sparkles className="h-4 w-4 text-indigo-400" />
                <span>Add New Product to Inventory</span>
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="p-6 space-y-4 overflow-y-auto flex-1 text-left">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="e.g. Mechanical Keyboard"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Product SKU (Optional)</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData((prev) => ({ ...prev, sku: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="Auto-generated if blank"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 h-20 resize-none"
                  placeholder="Detail notes..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Category *</label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => setFormData((prev) => ({ ...prev, categoryId: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">Select...</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Unit Price ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.unitPrice}
                    onChange={(e) => setFormData((prev) => ({ ...prev, unitPrice: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="99.99"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Safety Stock *</label>
                  <input
                    type="number"
                    required
                    value={formData.safetyStock}
                    onChange={(e) => setFormData((prev) => ({ ...prev, safetyStock: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Reorder Alert Trigger *</label>
                  <input
                    type="number"
                    required
                    value={formData.reorderPoint}
                    onChange={(e) => setFormData((prev) => ({ ...prev, reorderPoint: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Standard Reorder Quantity *</label>
                  <input
                    type="number"
                    required
                    value={formData.reorderQty}
                    onChange={(e) => setFormData((prev) => ({ ...prev, reorderQty: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Initial Warehouse Placement */}
              <div className="border-t border-slate-800 pt-4 mt-4">
                <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-3">Initial Stock Placement</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Select Warehouse</label>
                    <select
                      value={formData.initialWarehouseId}
                      onChange={(e) => setFormData((prev) => ({ ...prev, initialWarehouseId: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Intake Quantity</label>
                    <input
                      type="number"
                      value={formData.initialQuantity}
                      onChange={(e) => setFormData((prev) => ({ ...prev, initialQuantity: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mt-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">Aisle Slot</label>
                    <input
                      type="text"
                      value={formData.aisle}
                      onChange={(e) => setFormData((prev) => ({ ...prev, aisle: e.target.value.toUpperCase() }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-center"
                      maxLength={2}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">Shelf Level</label>
                    <input
                      type="text"
                      value={formData.shelf}
                      onChange={(e) => setFormData((prev) => ({ ...prev, shelf: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-center"
                      maxLength={3}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">Bin Identifier</label>
                    <input
                      type="text"
                      value={formData.bin}
                      onChange={(e) => setFormData((prev) => ({ ...prev, bin: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-center"
                      maxLength={3}
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-800 pt-4 flex justify-end space-x-3 bg-slate-900">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-md"
                >
                  Create Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-left">
            <div className="flex justify-between items-center mb-6 pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Adjust Inventory Stock Levels</h3>
              <button onClick={() => setShowAdjustModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAdjustStock} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Select Product *</label>
                <select
                  required
                  value={adjustData.productId}
                  onChange={(e) => setAdjustData((prev) => ({ ...prev, productId: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Select product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Target Warehouse *</label>
                <select
                  required
                  value={adjustData.warehouseId}
                  onChange={(e) => setAdjustData((prev) => ({ ...prev, warehouseId: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Adjustment Type *</label>
                  <select
                    value={adjustData.type}
                    onChange={(e) => setAdjustData((prev) => ({ ...prev, type: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="IN">Intake (Stock In)</option>
                    <option value="OUT">Dispatch (Stock Out)</option>
                    <option value="ADJUSTMENT">Override (Absolute)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Quantity *</label>
                  <input
                    type="number"
                    required
                    value={adjustData.quantity}
                    onChange={(e) => setAdjustData((prev) => ({ ...prev, quantity: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="e.g. 25"
                  />
                </div>
              </div>

              {/* Spatial placement coords */}
              <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/80">
                <span className="block text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-2">Location Coordinates</span>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Aisle"
                    value={adjustData.aisle}
                    onChange={(e) => setAdjustData((prev) => ({ ...prev, aisle: e.target.value.toUpperCase() }))}
                    className="bg-slate-950 border border-slate-850 rounded px-2 py-1 text-xs text-slate-100 text-center"
                    maxLength={2}
                  />
                  <input
                    type="text"
                    placeholder="Shelf"
                    value={adjustData.shelf}
                    onChange={(e) => setAdjustData((prev) => ({ ...prev, shelf: e.target.value }))}
                    className="bg-slate-950 border border-slate-850 rounded px-2 py-1 text-xs text-slate-100 text-center"
                    maxLength={3}
                  />
                  <input
                    type="text"
                    placeholder="Bin"
                    value={adjustData.bin}
                    onChange={(e) => setAdjustData((prev) => ({ ...prev, bin: e.target.value }))}
                    className="bg-slate-950 border border-slate-850 rounded px-2 py-1 text-xs text-slate-100 text-center"
                    maxLength={3}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Reason for Adjustment</label>
                <input
                  type="text"
                  value={adjustData.reason}
                  onChange={(e) => setAdjustData((prev) => ({ ...prev, reason: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="e.g. Damaged box, inventory audit"
                />
              </div>

              <div className="pt-4 flex justify-end space-x-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-all"
                >
                  Submit Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Code Modal (Barcode & QR) */}
      {showCodeModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-center">
            <div className="flex justify-between items-center mb-6 pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Product Barcode & QR Code</h3>
              <button onClick={() => setShowCodeModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <h4 className="text-xs font-bold text-slate-400 mb-1">{selectedProduct.name}</h4>
                <span className="text-xs font-mono text-indigo-400 font-semibold">{selectedProduct.sku}</span>
              </div>

              {/* Barcode block */}
              <div className="bg-white p-4 rounded-xl flex flex-col items-center border border-slate-800">
                {/* Simulated clean barcode layout using lines */}
                <div className="flex justify-center items-end h-16 space-x-0.5 bg-white px-2">
                  {[...Array(24)].map((_, i) => {
                    const isThick = i % 3 === 0 || i % 7 === 0;
                    const isBlank = i % 5 === 0;
                    return (
                      <div
                        key={i}
                        className="bg-black"
                        style={{
                          width: isThick ? '3px' : '1.5px',
                          height: isBlank ? '0px' : '64px',
                        }}
                      />
                    );
                  })}
                </div>
                <div className="text-[10px] font-mono text-black font-extrabold tracking-widest mt-2">
                  {selectedProduct.sku}
                </div>
              </div>

              {/* QR Code Block */}
              <div className="bg-white p-4 rounded-xl flex flex-col items-center border border-slate-800 max-w-[150px] mx-auto">
                <div className="grid grid-cols-5 gap-0.5 bg-white p-1">
                  {[...Array(25)].map((_, i) => {
                    const isFilled = i % 2 === 0 || i % 3 === 0 || i === 0 || i === 4 || i === 20 || i === 24;
                    return (
                      <div
                        key={i}
                        className={`h-6 w-6 border border-white ${isFilled ? 'bg-black' : 'bg-white'}`}
                      />
                    );
                  })}
                </div>
                <div className="text-[8px] font-mono text-slate-500 mt-2">
                  SCAN DETAILS
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800">
                <button
                  onClick={() => window.print()}
                  className="w-full flex items-center justify-center space-x-2 py-2 px-4 rounded-lg bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 font-semibold text-sm transition-all"
                >
                  <FileDown className="h-4 w-4" />
                  <span>Print Label (SKU & Coords)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
