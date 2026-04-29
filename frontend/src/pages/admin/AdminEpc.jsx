import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useRecordsStore from '../../store/useRecordsStore';
import useEpcStore from '../../store/useEpcStore';
import { useT } from '../../i18n/useT';
import EpcGeneratePanel from '../../components/admin/epc/EpcGeneratePanel';
import EpcBulkPanel from '../../components/admin/epc/EpcBulkPanel';

function formatDate(input) {
  if (!input) return '';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function normalizeSkuCode(skuOrCode) {
  const raw = String(skuOrCode || '').trim();
  const digits = raw.replace(/\D+/g, '');
  if (!digits) return '00';
  const last2 = digits.length >= 2 ? digits.slice(-2) : digits.padStart(2, '0');
  return last2;
}

export default function AdminEpc() {
  const { t } = useT();
  const navigate = useNavigate();

  const { products, fetchProducts } = useRecordsStore((s) => ({
    products: s.products,
    fetchProducts: s.fetchProducts
  }));

  const {
    corpCodes,
    batches,
    batchTotal,
    items,
    itemTotal,
    loading,
    error,
    lastGenerated,
    fetchCorpCodes,
    fetchBatches,
    fetchItems,
    generateBatch,
    exportBatchXlsx,
    clearLastGenerated
  } = useEpcStore((s) => ({
    corpCodes: s.corpCodes,
    batches: s.batches,
    batchTotal: s.batchTotal,
    items: s.items,
    itemTotal: s.itemTotal,
    loading: s.loading,
    error: s.error,
    lastGenerated: s.lastGenerated,
    fetchCorpCodes: s.fetchCorpCodes,
    fetchBatches: s.fetchBatches,
    fetchItems: s.fetchItems,
    generateBatch: s.generateBatch,
    exportBatchXlsx: s.exportBatchXlsx,
    clearLastGenerated: s.clearLastGenerated
  }));

  const [tab, setTab] = useState('items');
  const [showGenerate, setShowGenerate] = useState(false);

  const [corpPrefix, setCorpPrefix] = useState('');
  const [productId, setProductId] = useState('');
  const [batchName, setBatchName] = useState('');
  const [batchQty, setBatchQty] = useState(1);
  const [remark, setRemark] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');

  const [filterCorp, setFilterCorp] = useState('');
  const [filterProductId, setFilterProductId] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const [batchLimit, setBatchLimit] = useState(10);
  const [batchPage, setBatchPage] = useState(1);
  const [itemLimit, setItemLimit] = useState(10);
  const [itemPage, setItemPage] = useState(1);

  useEffect(() => {
    void fetchProducts();
    void fetchCorpCodes();
    void fetchBatches({ limit: batchLimit, offset: 0 });
    void fetchItems({ limit: itemLimit, offset: 0 });
  }, [fetchProducts, fetchCorpCodes, fetchBatches, fetchItems]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [tab]);

  const productOptions = useMemo(() => {
    const list = Array.isArray(products) ? products : [];
    return list
      .slice()
      .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')))
      .map((p) => ({
        id: String(p.id),
        sku: p.sku || '',
        name: p.name || '',
        category: p.category || ''
      }));
  }, [products]);

  const productCategoryById = useMemo(() => {
    const map = new Map();
    for (const p of productOptions) {
      if (!p?.id) continue;
      map.set(String(p.id), String(p.category || '').trim().toLowerCase());
    }
    return map;
  }, [productOptions]);

  const categoryOptions = useMemo(() => {
    const set = new Set();
    for (const p of productOptions) {
      const c = String(p.category || '').trim();
      if (c) set.add(c);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [productOptions]);

  const filteredItems = useMemo(() => {
    const from = dateFrom ? new Date(dateFrom) : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59.999`) : null;
    const corp = String(filterCorp || '').trim();
    const prodId = String(filterProductId || '').trim();
    const cat = String(filterCategory || '').trim().toLowerCase();

    const selectedProduct = prodId ? productOptions.find((p) => p.id === prodId) : null;
    const skuCode = selectedProduct ? normalizeSkuCode(selectedProduct.sku) : '';

    return (Array.isArray(items) ? items : []).filter((it) => {
      if (corp && String(it?.batch?.corpPrefix || '').trim() !== corp) return false;
      if (prodId && String(it?.batch?.product?.id || '') !== prodId) return false;
      if (cat) {
        const rowProdId = String(it?.batch?.product?.id || '');
        const rowCat = productCategoryById.get(rowProdId) || '';
        if (rowCat !== cat) return false;
      }
      if (skuCode && !String(it?.epcCode || '').includes(skuCode)) return false;
      if (from || to) {
        const d = it?.createdAt ? new Date(it.createdAt) : null;
        if (!d || Number.isNaN(d.getTime())) return false;
        if (from && d < from) return false;
        if (to && d > to) return false;
      }
      return true;
    });
  }, [items, dateFrom, dateTo, filterCorp, filterProductId, filterCategory, productOptions, productCategoryById]);

  const filteredBatches = useMemo(() => {
    const from = dateFrom ? new Date(dateFrom) : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59.999`) : null;
    const corp = String(filterCorp || '').trim();
    const prodId = String(filterProductId || '').trim();
    const cat = String(filterCategory || '').trim().toLowerCase();

    return (Array.isArray(batches) ? batches : []).filter((b) => {
      if (corp && String(b?.corpPrefix || '').trim() !== corp) return false;
      if (prodId && String(b?.product?.id || '') !== prodId) return false;
      if (cat) {
        const rowProdId = String(b?.product?.id || '');
        const rowCat = productCategoryById.get(rowProdId) || '';
        if (rowCat !== cat) return false;
      }
      if (from || to) {
        const d = b?.createdAt ? new Date(b.createdAt) : null;
        if (!d || Number.isNaN(d.getTime())) return false;
        if (from && d < from) return false;
        if (to && d > to) return false;
      }
      return true;
    });
  }, [batches, dateFrom, dateTo, filterCorp, filterProductId, filterCategory, productCategoryById]);

  const displayedItems = tab === 'items' ? filteredItems : [];
  const displayedBatches = tab === 'batches' ? filteredBatches : [];

  const totalItemsPages = Math.max(1, Math.ceil((itemTotal || 0) / itemLimit));
  const totalBatchPages = Math.max(1, Math.ceil((batchTotal || 0) / batchLimit));

  const allChecked = useMemo(() => {
    const list = tab === 'items' ? displayedItems : displayedBatches;
    if (!list || list.length === 0) return false;
    for (const row of list) {
      if (!selectedIds.has(String(row.id))) return false;
    }
    return true;
  }, [displayedItems, displayedBatches, selectedIds, tab]);

  const canExport = useMemo(() => {
    if (tab === 'batches') return selectedIds.size === 1;
    if (tab === 'items') {
      if (selectedBatchId) return true;
      if (selectedIds.size !== 1) return false;
      const id = Array.from(selectedIds)[0];
      const it = displayedItems.find((x) => String(x.id) === id);
      return Boolean(it?.batch?.id);
    }
    return false;
  }, [tab, selectedIds, selectedBatchId, displayedItems]);

  const handleToggleAll = () => {
    const list = tab === 'items' ? displayedItems : displayedBatches;
    const next = new Set(selectedIds);
    if (allChecked) {
      for (const row of list) next.delete(String(row.id));
    } else {
      for (const row of list) next.add(String(row.id));
    }
    setSelectedIds(next);
  };

  const handleToggleOne = (id) => {
    const key = String(id);
    const next = new Set(selectedIds);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedIds(next);
  };

  const handleClearFilters = () => {
    setFilterCorp('');
    setFilterProductId('');
    setFilterCategory('');
    setDateFrom('');
    setDateTo('');
    setSelectedBatchId('');
    setSelectedIds(new Set());
    setBatchPage(1);
    setItemPage(1);
    void fetchBatches({ limit: batchLimit, offset: 0 });
    void fetchItems({ limit: itemLimit, offset: 0 });
  };

  const handleInquire = () => {
    setSelectedIds(new Set());
    if (tab === 'batches') {
      const offset = Math.max(batchPage - 1, 0) * batchLimit;
      void fetchBatches({ limit: batchLimit, offset });
      return;
    }
    if (tab === 'items') {
      const offset = Math.max(itemPage - 1, 0) * itemLimit;
      void fetchItems({ batchId: selectedBatchId ? Number(selectedBatchId) : undefined, limit: itemLimit, offset });
      return;
    }
  };

  return (
    <div className="px-5 py-4">
      <div className="mb-3 text-xs text-zinc-500">Stock / Product / EPC</div>

      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" className="border-b-2 border-blue-600 px-2 pb-2 text-sm font-semibold text-blue-700">
            EPC
          </button>
        </div>
        <button
          type="button"
          className="rounded border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
          onClick={() => {
            if (tab === 'batches') void fetchBatches({ limit: batchLimit, offset: (batchPage - 1) * batchLimit });
            if (tab === 'items') void fetchItems({ batchId: selectedBatchId ? Number(selectedBatchId) : undefined, limit: itemLimit, offset: (itemPage - 1) * itemLimit });
          }}
        >
          {t('refresh')}
        </button>
      </div>

      {error ? <div className="mb-4 rounded border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div> : null}

      <div className="mb-3 rounded border border-zinc-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <div className="mb-1 text-[11px] font-semibold text-zinc-500">Corp Code</div>
            <select value={filterCorp} onChange={(e) => setFilterCorp(e.target.value)} className="h-9 w-full rounded border border-zinc-200 bg-white px-3 text-sm">
              <option value="">All</option>
              {corpCodes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-3">
            <div className="mb-1 text-[11px] font-semibold text-zinc-500">SKU code</div>
            <select
              value={filterProductId}
              onChange={(e) => {
                setFilterProductId(e.target.value);
                setSelectedBatchId('');
              }}
              className="h-9 w-full rounded border border-zinc-200 bg-white px-3 text-sm"
            >
              <option value="">All</option>
              {productOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku || '-'}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-3">
            <div className="mb-1 text-[11px] font-semibold text-zinc-500">Category</div>
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="h-9 w-full rounded border border-zinc-200 bg-white px-3 text-sm">
              <option value="">Select</option>
              {categoryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-3">
            <div className="mb-1 text-[11px] font-semibold text-zinc-500">Date</div>
            <div className="flex items-center gap-2">
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-full rounded border border-zinc-200 bg-white px-3 text-sm" />
              <div className="text-xs text-zinc-500">to</div>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-full rounded border border-zinc-200 bg-white px-3 text-sm" />
            </div>
          </div>
          <div className="lg:col-span-12">
            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <button type="button" className="rounded bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700" onClick={handleInquire}>
                Inquire
              </button>
              <button type="button" className="rounded border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50" onClick={handleClearFilters}>
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" className="rounded bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700" onClick={() => navigate('/admin/records')}>
          Add New Product
        </button>
        <button type="button" className="rounded bg-amber-500 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-600" onClick={() => setShowGenerate(true)}>
          Generate EPC
        </button>
        <button
          type="button"
          className="rounded bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canExport || loading}
          onClick={() => {
            if (tab === 'batches') {
              const id = Number(Array.from(selectedIds)[0]);
              if (!id) return;
              void exportBatchXlsx(id);
              return;
            }
            if (tab === 'items') {
              if (selectedBatchId) {
                void exportBatchXlsx(Number(selectedBatchId));
                return;
              }
              const rowId = Array.from(selectedIds)[0];
              const it = displayedItems.find((x) => String(x.id) === String(rowId));
              const bid = it?.batch?.id;
              if (!bid) return;
              void exportBatchXlsx(bid);
            }
          }}
        >
          Export EPC List
        </button>
        <button type="button" className="rounded bg-zinc-400 px-3 py-2 text-xs font-semibold text-white opacity-60" disabled>
          Import Custom Field Values
        </button>
        <button type="button" className="rounded bg-zinc-400 px-3 py-2 text-xs font-semibold text-white opacity-60" disabled>
          Customize Field
        </button>
        <button type="button" className="rounded bg-rose-500 px-3 py-2 text-xs font-semibold text-white opacity-60" disabled>
          Delete
        </button>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className={`rounded border px-3 py-2 text-xs font-semibold ${tab === 'items' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'}`}
            onClick={() => setTab('items')}
          >
            EPC
          </button>
          <button
            type="button"
            className={`rounded border px-3 py-2 text-xs font-semibold ${tab === 'batches' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'}`}
            onClick={() => setTab('batches')}
          >
            Batch
          </button>
          <button
            type="button"
            className={`rounded border px-3 py-2 text-xs font-semibold ${tab === 'bulk' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'}`}
            onClick={() => setTab('bulk')}
          >
            Bulk
          </button>
        </div>
      </div>

      {tab === 'bulk' ? (
        <div className="rounded border border-zinc-200 bg-white p-4">
          <EpcBulkPanel t={t} />
        </div>
      ) : (
        <div className="rounded border border-zinc-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-[1400px] w-full border-collapse">
              <thead className="bg-zinc-50">
                {tab === 'items' ? (
                  <tr className="text-left text-xs font-semibold text-zinc-600">
                    <th className="w-10 border-b border-zinc-200 px-3 py-2">
                      <input type="checkbox" checked={allChecked} onChange={handleToggleAll} />
                    </th>
                    <th className="border-b border-zinc-200 px-3 py-2">EPC code</th>
                    <th className="border-b border-zinc-200 px-3 py-2">Corp code</th>
                    <th className="border-b border-zinc-200 px-3 py-2">SKU code</th>
                    <th className="border-b border-zinc-200 px-3 py-2">Serial number</th>
                    <th className="border-b border-zinc-200 px-3 py-2">Batch Number</th>
                    <th className="border-b border-zinc-200 px-3 py-2">Product Name</th>
                    <th className="border-b border-zinc-200 px-3 py-2">Net Weight</th>
                    <th className="border-b border-zinc-200 px-3 py-2">Date of Production</th>
                    <th className="border-b border-zinc-200 px-3 py-2">CAIQ Label</th>
                    <th className="border-b border-zinc-200 px-3 py-2">Country of Origin</th>
                  </tr>
                ) : (
                  <tr className="text-left text-xs font-semibold text-zinc-600">
                    <th className="w-10 border-b border-zinc-200 px-3 py-2">
                      <input type="checkbox" checked={allChecked} onChange={handleToggleAll} />
                    </th>
                    <th className="border-b border-zinc-200 px-3 py-2">Corp code</th>
                    <th className="border-b border-zinc-200 px-3 py-2">SKU code</th>
                    <th className="border-b border-zinc-200 px-3 py-2">Batch Number</th>
                    <th className="border-b border-zinc-200 px-3 py-2">Qty</th>
                    <th className="border-b border-zinc-200 px-3 py-2">Created At</th>
                    <th className="border-b border-zinc-200 px-3 py-2 text-right">Actions</th>
                  </tr>
                )}
              </thead>
              <tbody className="text-sm text-zinc-800">
                {tab === 'items'
                  ? displayedItems.map((it) => (
                      <tr key={it.id} className="hover:bg-zinc-50">
                        <td className="border-b border-zinc-100 px-3 py-2">
                          <input type="checkbox" checked={selectedIds.has(String(it.id))} onChange={() => handleToggleOne(it.id)} />
                        </td>
                        <td className="border-b border-zinc-100 px-3 py-2 font-mono text-xs text-blue-700">{it.epcCode}</td>
                        <td className="border-b border-zinc-100 px-3 py-2 font-mono text-xs">{it.batch?.corpPrefix || '-'}</td>
                        <td className="border-b border-zinc-100 px-3 py-2 font-mono text-xs">{it.batch?.sku || it.batch?.product?.sku || '-'}</td>
                        <td className="border-b border-zinc-100 px-3 py-2 font-mono text-xs">{it.runningNo?.toString ? it.runningNo.toString() : String(it.runningNo || '-')}</td>
                        <td className="border-b border-zinc-100 px-3 py-2">{it.batch?.batchName || '-'}</td>
                        <td className="border-b border-zinc-100 px-3 py-2">{it.batch?.product?.name || '-'}</td>
                        <td className="border-b border-zinc-100 px-3 py-2 text-zinc-500">--</td>
                        <td className="border-b border-zinc-100 px-3 py-2 text-zinc-500">--</td>
                        <td className="border-b border-zinc-100 px-3 py-2 text-zinc-500">--</td>
                        <td className="border-b border-zinc-100 px-3 py-2 text-zinc-500">--</td>
                      </tr>
                    ))
                  : displayedBatches.map((b) => (
                      <tr key={b.id} className="hover:bg-zinc-50">
                        <td className="border-b border-zinc-100 px-3 py-2">
                          <input type="checkbox" checked={selectedIds.has(String(b.id))} onChange={() => handleToggleOne(b.id)} />
                        </td>
                        <td className="border-b border-zinc-100 px-3 py-2 font-mono text-xs">{b.corpPrefix}</td>
                        <td className="border-b border-zinc-100 px-3 py-2 font-mono text-xs">{b.sku || b.product?.sku || '-'}</td>
                        <td className="border-b border-zinc-100 px-3 py-2">{b.batchName}</td>
                        <td className="border-b border-zinc-100 px-3 py-2">{b.batchQty}</td>
                        <td className="border-b border-zinc-100 px-3 py-2 text-xs text-zinc-600">{formatDate(b.createdAt)}</td>
                        <td className="border-b border-zinc-100 px-3 py-2 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              className="rounded border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
                              onClick={async () => {
                                setSelectedBatchId(String(b.id));
                                setTab('items');
                                setItemPage(1);
                                await fetchItems({ batchId: b.id, limit: itemLimit, offset: 0 });
                              }}
                            >
                              View EPC
                            </button>
                            <button
                              type="button"
                              className="rounded border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
                              onClick={() => void exportBatchXlsx(b.id)}
                            >
                              Export
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                {!loading && tab === 'items' && displayedItems.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-10 text-center text-sm text-zinc-600">
                      {t('noEpc')}
                    </td>
                  </tr>
                ) : null}
                {!loading && tab === 'batches' && displayedBatches.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-zinc-600">
                      {t('noBatches')}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 px-4 py-3 text-xs text-zinc-600">
            <div className="flex items-center gap-2">
              <div>Total {tab === 'items' ? itemTotal : batchTotal}</div>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={tab === 'items' ? itemLimit : batchLimit}
                onChange={(e) => {
                  const v = Number(e.target.value) || 10;
                  if (tab === 'items') {
                    setItemLimit(v);
                    setItemPage(1);
                    void fetchItems({ batchId: selectedBatchId ? Number(selectedBatchId) : undefined, limit: v, offset: 0 });
                  } else {
                    setBatchLimit(v);
                    setBatchPage(1);
                    void fetchBatches({ limit: v, offset: 0 });
                  }
                }}
                className="h-8 rounded border border-zinc-200 bg-white px-2"
              >
                <option value={10}>10/page</option>
                <option value={20}>20/page</option>
                <option value={50}>50/page</option>
              </select>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="rounded border border-zinc-200 bg-white px-2 py-1 font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                  disabled={tab === 'items' ? itemPage <= 1 : batchPage <= 1}
                  onClick={() => {
                    if (tab === 'items') {
                      const next = Math.max(itemPage - 1, 1);
                      setItemPage(next);
                      void fetchItems({ batchId: selectedBatchId ? Number(selectedBatchId) : undefined, limit: itemLimit, offset: (next - 1) * itemLimit });
                    } else {
                      const next = Math.max(batchPage - 1, 1);
                      setBatchPage(next);
                      void fetchBatches({ limit: batchLimit, offset: (next - 1) * batchLimit });
                    }
                  }}
                >
                  ‹
                </button>
                <div className="min-w-[70px] text-center">
                  {tab === 'items' ? itemPage : batchPage} / {tab === 'items' ? totalItemsPages : totalBatchPages}
                </div>
                <button
                  type="button"
                  className="rounded border border-zinc-200 bg-white px-2 py-1 font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                  disabled={tab === 'items' ? itemPage >= totalItemsPages : batchPage >= totalBatchPages}
                  onClick={() => {
                    if (tab === 'items') {
                      const next = Math.min(itemPage + 1, totalItemsPages);
                      setItemPage(next);
                      void fetchItems({ batchId: selectedBatchId ? Number(selectedBatchId) : undefined, limit: itemLimit, offset: (next - 1) * itemLimit });
                    } else {
                      const next = Math.min(batchPage + 1, totalBatchPages);
                      setBatchPage(next);
                      void fetchBatches({ limit: batchLimit, offset: (next - 1) * batchLimit });
                    }
                  }}
                >
                  ›
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showGenerate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded border border-zinc-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-zinc-900">{t('generateEpc')}</div>
              <button
                type="button"
                className="rounded border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                onClick={() => setShowGenerate(false)}
              >
                {t('close')}
              </button>
            </div>
            <EpcGeneratePanel
              t={t}
              corpCodes={corpCodes}
              corpPrefix={corpPrefix}
              setCorpPrefix={setCorpPrefix}
              products={products}
              productId={productId}
              setProductId={setProductId}
              batchName={batchName}
              setBatchName={setBatchName}
              batchQty={batchQty}
              setBatchQty={setBatchQty}
              remark={remark}
              setRemark={setRemark}
              loading={loading}
              lastGenerated={lastGenerated}
              onClear={() => {
                setBatchName('');
                setBatchQty(1);
                setRemark('');
                clearLastGenerated();
              }}
              onGenerate={async () => {
                const pid = Number(productId);
                if (!corpPrefix || !pid || !String(batchName || '').trim()) return;
                const created = await generateBatch({
                  corpPrefix,
                  productId: pid,
                  batchName: String(batchName || '').trim(),
                  batchQty,
                  remark: String(remark || '').trim() || undefined
                });
                const newBatchId = created?.batch?.id;
                await fetchBatches({ limit: batchLimit, offset: 0 });
                if (newBatchId) {
                  setSelectedBatchId(String(newBatchId));
                  setTab('items');
                  setItemPage(1);
                  await fetchItems({ batchId: newBatchId, limit: itemLimit, offset: 0 });
                } else {
                  await fetchItems({ limit: itemLimit, offset: 0 });
                }
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
