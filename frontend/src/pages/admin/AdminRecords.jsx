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
  const {
    products,
    categories,
    loading,
    error,
    lastSyncAt,
    fetchProducts,
    fetchCategories,
    createCategory,
    createProduct,
    updateProduct,
    deactivateProduct
  } = useRecordsStore((s) => ({
    products: s.products,
    categories: s.categories,
    loading: s.loading,
    error: s.error,
    lastSyncAt: s.lastSyncAt,
    fetchProducts: s.fetchProducts,
    fetchCategories: s.fetchCategories,
    createCategory: s.createCategory,
    createProduct: s.createProduct,
    updateProduct: s.updateProduct,
    deactivateProduct: s.deactivateProduct
  }));

  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [editing, setEditing] = useState(null);
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [productCode, setProductCode] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('active');
  const [remark, setRemark] = useState('');

  const [categoryName, setCategoryName] = useState('');
  const [categoryCode, setCategoryCode] = useState('');
  const [categoryStatus, setCategoryStatus] = useState('active');

  useEffect(() => {
    void fetchProducts();
    void fetchCategories();
  }, [fetchProducts, fetchCategories]);

  useEffect(() => {
    const id = setInterval(() => {
      void fetchProducts();
    }, 10_000);
    return () => clearInterval(id);
  }, [fetchProducts]);

  const categoryByCode = useMemo(() => {
    const map = new Map();
    (Array.isArray(categories) ? categories : []).forEach((c) => {
      if (!c?.code) return;
      map.set(String(c.code), c);
    });
    return map;
  }, [categories]);

  const filtered = useMemo(() => {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      const skuStr = String(p?.sku || '').toLowerCase();
      const nameStr = String(p?.name || '').toLowerCase();
      const codeStr = String(p?.code || '').toLowerCase();
      const categoryCodeStr = String(p?.category || '').toLowerCase();
      const categoryNameStr = String(categoryByCode.get(String(p?.category || ''))?.name || '').toLowerCase();
      return (
        skuStr.includes(q) ||
        nameStr.includes(q) ||
        codeStr.includes(q) ||
        categoryCodeStr.includes(q) ||
        categoryNameStr.includes(q)
      );
    });
  }, [products, query, categoryByCode]);

  return (
    <div className="ac-page">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">{t('records')}</h2>
          <p className="mt-1 text-sm text-zinc-600">{t('recordsSubtitle')}</p>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-500">
            <button type="button" className="underline" onClick={() => void fetchProducts()}>
              {t('refresh')}
            </button>
            {lastSyncAt ? <span>{t('lastUpdated', { value: formatDate(lastSyncAt) })}</span> : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="ac-btn ac-btn-soft px-3 py-2 text-xs" onClick={() => setShowCreateCategory(true)}>
            {t('addCategory')}
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

      <div className="ac-table">
        <div className="overflow-x-auto">
          <div className="min-w-[1100px]">
            <div className="ac-table-head grid grid-cols-[1fr_2fr_1fr_1fr_1fr_1fr_220px] gap-4">
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
                  className="ac-table-row grid grid-cols-[1fr_2fr_1fr_1fr_1fr_1fr_220px] gap-4"
                >
                  <div className="font-mono text-xs text-zinc-700">{p.sku}</div>
                  <div>
                    <div className="font-medium text-zinc-900">{p.name}</div>
                    <div className="mt-0.5 text-[11px] text-zinc-500">{p.remark || '-'}</div>
                  </div>
                  <div className="font-mono text-xs text-zinc-700">{p.code}</div>
                <div className="text-xs text-zinc-700">{categoryByCode.get(String(p.category || ''))?.name || p.category || '-'}</div>
                <div className="text-xs text-zinc-700">
                  {String(p.status || '').toLowerCase() === 'inactive' ? t('inactive') : t('active')}
                </div>
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
                          setStatus(String(p.status || '').toLowerCase() === 'inactive' ? 'inactive' : 'active');
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
        <div className="ac-modal-backdrop">
          <div className="ac-modal">
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
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="ac-input">
                  <option value="">{t('selectCategory')}</option>
                  {(Array.isArray(categories) ? categories : [])
                    .filter((c) => Boolean(c?.code) && (c?.isActive !== false || String(c.code) === String(category)))
                    .map((c) => (
                      <option key={c.id} value={String(c.code)}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('status')}</div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs text-zinc-700">
                    <input type="radio" name="productStatusCreate" value="active" checked={status === 'active'} onChange={() => setStatus('active')} />
                    {t('active')}
                  </label>
                  <label className="flex items-center gap-2 text-xs text-zinc-700">
                    <input
                      type="radio"
                      name="productStatusCreate"
                      value="inactive"
                      checked={status === 'inactive'}
                      onChange={() => setStatus('inactive')}
                    />
                    {t('inactive')}
                  </label>
                </div>
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
                  setStatus('active');
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
                  const trimmedStatus = String(status || '').trim() || 'active';
                  if (!trimmedSku || !trimmedName || !trimmedProductCode || !trimmedCategory) return;
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
                  setStatus('active');
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
        <div className="ac-modal-backdrop">
          <div className="ac-modal">
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
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="ac-input">
                  <option value="">{t('selectCategory')}</option>
                  {(Array.isArray(categories) ? categories : [])
                    .filter((c) => Boolean(c?.code) && (c?.isActive !== false || String(c.code) === String(category)))
                    .map((c) => (
                      <option key={c.id} value={String(c.code)}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('status')}</div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs text-zinc-700">
                    <input type="radio" name="productStatusEdit" value="active" checked={status === 'active'} onChange={() => setStatus('active')} />
                    {t('active')}
                  </label>
                  <label className="flex items-center gap-2 text-xs text-zinc-700">
                    <input
                      type="radio"
                      name="productStatusEdit"
                      value="inactive"
                      checked={status === 'inactive'}
                      onChange={() => setStatus('inactive')}
                    />
                    {t('inactive')}
                  </label>
                </div>
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
                      status: String(status || '').trim() || 'active',
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

      {showCreateCategory ? (
        <div className="ac-modal-backdrop">
          <div className="ac-modal">
            <div className="mb-4 text-sm font-semibold text-zinc-900">{t('createCategory')}</div>
            <div className="space-y-3">
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('categoryName')}</div>
                <input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} className="ac-input" />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('categoryCode')}</div>
                <input value={categoryCode} onChange={(e) => setCategoryCode(e.target.value)} className="ac-input font-mono" />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('status')}</div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs text-zinc-700">
                    <input
                      type="radio"
                      name="categoryStatusCreate"
                      value="active"
                      checked={categoryStatus === 'active'}
                      onChange={() => setCategoryStatus('active')}
                    />
                    {t('active')}
                  </label>
                  <label className="flex items-center gap-2 text-xs text-zinc-700">
                    <input
                      type="radio"
                      name="categoryStatusCreate"
                      value="inactive"
                      checked={categoryStatus === 'inactive'}
                      onChange={() => setCategoryStatus('inactive')}
                    />
                    {t('inactive')}
                  </label>
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                onClick={() => {
                  setShowCreateCategory(false);
                  setCategoryName('');
                  setCategoryCode('');
                  setCategoryStatus('active');
                }}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                className="ac-btn px-3 py-2 text-xs"
                onClick={async () => {
                  const trimmedName = String(categoryName || '').trim();
                  const trimmedCode = String(categoryCode || '').trim();
                  if (!trimmedName || !trimmedCode) return;
                  await createCategory({ name: trimmedName, code: trimmedCode, status: categoryStatus });
                  void fetchCategories();
                  setShowCreateCategory(false);
                  setCategoryName('');
                  setCategoryCode('');
                  setCategoryStatus('active');
                }}
              >
                {t('create')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
