import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import useRecordsStore from '../../store/useRecordsStore';
import { useT } from '../../i18n/useT';

function formatDate(input) {
  if (!input) return '';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

export default function AdminRecords() {
  const { t } = useT();
  const { products, loading, error, lastSyncAt, fetchProducts, createProduct, updateProduct, deactivateProduct } = useRecordsStore((s) => ({
    products: s.products,
    loading: s.loading,
    error: s.error,
    lastSyncAt: s.lastSyncAt,
    fetchProducts: s.fetchProducts,
    createProduct: s.createProduct,
    updateProduct: s.updateProduct,
    deactivateProduct: s.deactivateProduct
  }));

  const [query, setQuery] = useState('');
  const [live, setLive] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editing, setEditing] = useState(null);
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [productCode, setProductCode] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [remark, setRemark] = useState('');

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => {
      void fetchProducts();
    }, 10_000);
    return () => clearInterval(id);
  }, [live, fetchProducts]);

  const filtered = useMemo(() => {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      const skuStr = String(p?.sku || '').toLowerCase();
      const nameStr = String(p?.name || '').toLowerCase();
      const codeStr = String(p?.code || '').toLowerCase();
      const categoryStr = String(p?.category || '').toLowerCase();
      return skuStr.includes(q) || nameStr.includes(q) || codeStr.includes(q) || categoryStr.includes(q);
    });
  }, [products, query]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">{t('records')}</h2>
          <p className="mt-1 text-sm text-zinc-600">{t('recordsSubtitle')}</p>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-500">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 ring-1 ring-inset ${
                live ? 'bg-emerald-50 text-emerald-700 ring-emerald-200/60' : 'bg-zinc-50 text-zinc-700 ring-zinc-200/70'
              }`}
            >
              {live ? t('live') : t('paused')}
            </span>
            <button type="button" className="underline" onClick={() => void fetchProducts()}>
              {t('refresh')}
            </button>
            {lastSyncAt ? <span>{t('lastUpdated', { value: formatDate(lastSyncAt) })}</span> : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="ac-btn ac-btn-soft px-3 py-2 text-xs" onClick={() => setLive((v) => !v)}>
            {live ? t('pauseLive') : t('resumeLive')}
          </button>
          <button type="button" className="ac-btn px-3 py-2 text-xs" onClick={() => setShowCreate(true)}>
            {t('createProduct')}
          </button>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('searchProducts')}
          className="ac-input"
        />
      </div>

      {error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div> : null}

      <div className="rounded-xl border border-zinc-200 bg-white">
        <div className="overflow-x-auto">
          <div className="min-w-[1100px]">
            <div className="grid grid-cols-[1fr_2fr_1fr_1fr_1fr_1fr_220px] gap-4 border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-semibold text-zinc-600">
              <div>{t('sku')}</div>
              <div>{t('product')}</div>
              <div>{t('productCode')}</div>
              <div>{t('category')}</div>
              <div>{t('status')}</div>
              <div>{t('updated')}</div>
              <div className="text-right">{t('actions')}</div>
            </div>
            {loading ? (
              <div className="p-4 text-sm text-zinc-600">{t('loading')}</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-sm font-semibold text-zinc-900">{t('noProducts')}</div>
                <div className="mt-1 text-xs text-zinc-600">{t('noProductsHint')}</div>
              </div>
            ) : (
              filtered.map((p) => (
                <div
                  key={p.id}
                  className="grid grid-cols-[1fr_2fr_1fr_1fr_1fr_1fr_220px] gap-4 border-b border-zinc-100 px-4 py-3 text-sm text-zinc-800 last:border-b-0"
                >
                  <div className="font-mono text-xs text-zinc-700">{p.sku}</div>
                  <div>
                    <div className="font-medium text-zinc-900">{p.name}</div>
                    <div className="mt-0.5 text-[11px] text-zinc-500">{p.remark || '-'}</div>
                  </div>
                  <div className="font-mono text-xs text-zinc-700">{p.code}</div>
                  <div className="text-xs text-zinc-700">{p.category || '-'}</div>
                  <div className="text-xs text-zinc-700">{p.status || '-'}</div>
                  <div className="text-xs text-zinc-600">{formatDate(p.updatedAt || p.createdAt)}</div>
                  <div className="flex justify-end">
                    <div className="flex items-center gap-2">
                      <Link className="ac-btn ac-btn-soft px-3 py-2 text-xs" to={`/admin/records/${p.id}`}>
                        {t('view')}
                      </Link>
                      <button
                        type="button"
                        className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                        onClick={() => {
                          setEditing(p);
                          setSku(p.sku || '');
                          setName(p.name || '');
                          setProductCode(p.code || '');
                          setCategory(p.category || '');
                          setStatus(p.status || '');
                          setRemark(p.remark || '');
                          setShowEdit(true);
                        }}
                      >
                        {t('edit')}
                      </button>
                      <button
                        type="button"
                        className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                        onClick={async () => {
                          if (!window.confirm(t('confirmDeactivateProduct'))) return;
                          await deactivateProduct({ id: p.id });
                        }}
                      >
                        {t('deactivate')}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {showCreate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5">
            <div className="mb-4 text-sm font-semibold text-zinc-900">{t('createProduct')}</div>
            <div className="space-y-3">
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('sku')}</div>
                <input
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className="ac-input font-mono"
                />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('name')}</div>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="ac-input"
                />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('productCode')}</div>
                <input
                  value={productCode}
                  onChange={(e) => setProductCode(e.target.value)}
                  className="ac-input font-mono"
                />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('category')}</div>
                <input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="ac-input"
                />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('status')}</div>
                <input
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="ac-input"
                />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('remark')}</div>
                <textarea
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  className="ac-input h-24 resize-none"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                onClick={() => {
                  setShowCreate(false);
                  setSku('');
                  setName('');
                  setProductCode('');
                  setCategory('');
                  setStatus('');
                  setRemark('');
                }}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                className="ac-btn px-3 py-2 text-xs"
                onClick={async () => {
                  const trimmedSku = String(sku || '').trim();
                  const trimmedName = String(name || '').trim();
                  const trimmedProductCode = String(productCode || '').trim();
                  const trimmedCategory = String(category || '').trim();
                  const trimmedStatus = String(status || '').trim();
                  if (!trimmedSku || !trimmedName || !trimmedProductCode || !trimmedCategory || !trimmedStatus) return;
                  await createProduct({
                    sku: trimmedSku,
                    name: trimmedName,
                    product_code: trimmedProductCode,
                    category: trimmedCategory,
                    status: trimmedStatus,
                    remark: String(remark || '').trim() || undefined
                  });
                  setShowCreate(false);
                  setSku('');
                  setName('');
                  setProductCode('');
                  setCategory('');
                  setStatus('');
                  setRemark('');
                }}
              >
                {t('create')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showEdit ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5">
            <div className="mb-4 text-sm font-semibold text-zinc-900">{t('editProduct')}</div>
            <div className="space-y-3">
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('sku')}</div>
                <input
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className="ac-input font-mono"
                />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('name')}</div>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="ac-input"
                />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('productCode')}</div>
                <input
                  value={productCode}
                  onChange={(e) => setProductCode(e.target.value)}
                  className="ac-input font-mono"
                />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('category')}</div>
                <input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="ac-input"
                />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('status')}</div>
                <input
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="ac-input"
                />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('remark')}</div>
                <textarea
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  className="ac-input h-24 resize-none"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                onClick={() => {
                  setShowEdit(false);
                  setEditing(null);
                }}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                className="ac-btn px-3 py-2 text-xs"
                disabled={!editing?.id}
                onClick={async () => {
                  if (!editing?.id) return;
                  await updateProduct({
                    id: editing.id,
                    patch: {
                      sku: String(sku || '').trim(),
                      name: String(name || '').trim(),
                      product_code: String(productCode || '').trim(),
                      category: String(category || '').trim(),
                      status: String(status || '').trim(),
                      remark: String(remark || '').trim() || null
                    }
                  });
                  setShowEdit(false);
                  setEditing(null);
                }}
              >
                {t('save')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
