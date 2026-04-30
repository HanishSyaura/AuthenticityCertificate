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
    updateCategory,
    createProduct,
    updateProduct,
    deactivateProduct,
    activateProduct,
    deleteProduct
  } = useRecordsStore((s) => ({
    products: s.products,
    categories: s.categories,
    loading: s.loading,
    error: s.error,
    lastSyncAt: s.lastSyncAt,
    fetchProducts: s.fetchProducts,
    fetchCategories: s.fetchCategories,
    createCategory: s.createCategory,
    updateCategory: s.updateCategory,
    createProduct: s.createProduct,
    updateProduct: s.updateProduct,
    deactivateProduct: s.deactivateProduct,
    activateProduct: s.activateProduct,
    deleteProduct: s.deleteProduct
  }));

  const [activeTab, setActiveTab] = useState('products');
  const [query, setQuery] = useState('');
  const [productStatusFilter, setProductStatusFilter] = useState('all');
  const [categoryQuery, setCategoryQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [showEditCategory, setShowEditCategory] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [productCode, setProductCode] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('active');
  const [remark, setRemark] = useState('');

  const [categoryName, setCategoryName] = useState('');
  const [categoryCode, setCategoryCode] = useState('');
  const [categoryStatus, setCategoryStatus] = useState('active');
  const [categoryNameEdit, setCategoryNameEdit] = useState('');
  const [categoryCodeEdit, setCategoryCodeEdit] = useState('');
  const [categoryStatusEdit, setCategoryStatusEdit] = useState('active');

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

  const filteredProducts = useMemo(() => {
    const q = String(query || '').trim().toLowerCase();
    const matchesQuery = (p) => {
      if (!q) return true;
      const skuStr = String(p?.sku || '').toLowerCase();
      const nameStr = String(p?.name || '').toLowerCase();
      const codeStr = String(p?.code || '').toLowerCase();
      const categoryCodeStr = String(p?.category || '').toLowerCase();
      const categoryNameStr = String(categoryByCode.get(String(p?.category || ''))?.name || '').toLowerCase();
      return skuStr.includes(q) || nameStr.includes(q) || codeStr.includes(q) || categoryCodeStr.includes(q) || categoryNameStr.includes(q);
    };

    const isInactive = (p) => String(p?.status || '').toLowerCase() === 'inactive';

    return products.filter((p) => {
      if (!matchesQuery(p)) return false;
      if (productStatusFilter === 'all') return true;
      if (productStatusFilter === 'inactive') return isInactive(p);
      return !isInactive(p);
    });
  }, [products, query, categoryByCode, productStatusFilter]);

  const filteredCategories = useMemo(() => {
    const q = String(categoryQuery || '').trim().toLowerCase();
    if (!q) return categories;
    return (Array.isArray(categories) ? categories : []).filter((c) => {
      const nameStr = String(c?.name || '').toLowerCase();
      const codeStr = String(c?.code || '').toLowerCase();
      return nameStr.includes(q) || codeStr.includes(q);
    });
  }, [categories, categoryQuery]);

  return (
    <div className="ac-page">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">{t('records')}</h2>
          <p className="mt-1 text-sm text-zinc-600">{t('recordsSubtitle')}</p>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-500">
            <button
              type="button"
              className="underline"
              onClick={() => {
                if (activeTab === 'categories') return void fetchCategories();
                return void fetchProducts();
              }}
            >
              {t('refresh')}
            </button>
            {lastSyncAt ? <span>{t('lastUpdated', { value: formatDate(lastSyncAt) })}</span> : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'categories' ? (
            <button type="button" className="ac-btn px-3 py-2 text-xs" onClick={() => setShowCreateCategory(true)}>
              {t('addCategory')}
            </button>
          ) : (
            <button type="button" className="ac-btn px-3 py-2 text-xs" onClick={() => setShowCreate(true)}>
              {t('createProduct')}
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-xl border border-zinc-200 bg-white p-1">
            <button
              type="button"
              className={activeTab === 'products' ? 'rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white' : 'rounded-lg px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50'}
              onClick={() => setActiveTab('products')}
            >
              {t('productsTab')}
            </button>
            <button
              type="button"
              className={activeTab === 'categories' ? 'rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white' : 'rounded-lg px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50'}
              onClick={() => setActiveTab('categories')}
            >
              {t('categoriesTab')}
            </button>
          </div>

          {activeTab === 'products' ? (
            <div className="inline-flex rounded-xl border border-zinc-200 bg-white p-1">
              <button
                type="button"
                className={productStatusFilter === 'active' ? 'rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white' : 'rounded-lg px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50'}
                onClick={() => setProductStatusFilter('active')}
              >
                {t('activeProducts')}
              </button>
              <button
                type="button"
                className={productStatusFilter === 'inactive' ? 'rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white' : 'rounded-lg px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50'}
                onClick={() => setProductStatusFilter('inactive')}
              >
                {t('inactiveProducts')}
              </button>
              <button
                type="button"
                className={productStatusFilter === 'all' ? 'rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white' : 'rounded-lg px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50'}
                onClick={() => setProductStatusFilter('all')}
              >
                {t('allProducts')}
              </button>
            </div>
          ) : null}
        </div>

        {activeTab === 'products' ? (
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('searchProducts')} className="ac-input" />
        ) : (
          <input value={categoryQuery} onChange={(e) => setCategoryQuery(e.target.value)} placeholder={t('searchCategories')} className="ac-input" />
        )}
      </div>

      {error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div> : null}

      {activeTab === 'products' ? (
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
              ) : filteredProducts.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="text-sm font-semibold text-zinc-900">{t('noProducts')}</div>
                  <div className="mt-1 text-xs text-zinc-600">{t('noProductsHint')}</div>
                </div>
              ) : (
                filteredProducts.map((p) => {
                  const isInactive = String(p?.status || '').toLowerCase() === 'inactive';
                  const canDeactivate = !isInactive;
                  const canActivate = isInactive;
                  const canDelete = isInactive;
                  return (
                    <div key={p.id} className="ac-table-row grid grid-cols-[1fr_2fr_1fr_1fr_1fr_1fr_220px] gap-4">
                      <div className="font-mono text-xs text-zinc-700">{p.sku}</div>
                      <div>
                        <div className="font-medium text-zinc-900">{p.name}</div>
                        <div className="mt-0.5 text-[11px] text-zinc-500">{p.remark || '-'}</div>
                      </div>
                      <div className="font-mono text-xs text-zinc-700">{p.code}</div>
                      <div className="text-xs text-zinc-700">{categoryByCode.get(String(p.category || ''))?.name || p.category || '-'}</div>
                      <div className="text-xs text-zinc-700">{isInactive ? t('inactive') : t('active')}</div>
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
                          {canDeactivate ? (
                            <button
                              type="button"
                              className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                              onClick={async () => {
                                if (!window.confirm(t('confirmDeactivateProduct'))) return;
                                await deactivateProduct({ id: p.id });
                                void fetchProducts();
                              }}
                            >
                              {t('deactivate')}
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                                onClick={async () => {
                                  if (!window.confirm(t('confirmActivateProduct'))) return;
                                  await activateProduct({ id: p.id });
                                  void fetchProducts();
                                }}
                              >
                                {t('activate')}
                              </button>
                              <button
                                type="button"
                                className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                                onClick={async () => {
                                  if (!window.confirm(t('confirmDeleteProduct'))) return;
                                  await deleteProduct({ id: p.id });
                                  void fetchProducts();
                                }}
                              >
                                {t('delete')}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="ac-table">
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              <div className="ac-table-head grid grid-cols-[2fr_1fr_1fr_1fr_180px] gap-4">
                <div>{t('name')}</div>
                <div>{t('code')}</div>
                <div>{t('status')}</div>
                <div>{t('updated')}</div>
                <div className="text-right">{t('actions')}</div>
              </div>
              {loading ? (
                <div className="p-4 text-sm text-zinc-600">{t('loading')}</div>
              ) : filteredCategories.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="text-sm font-semibold text-zinc-900">{t('noCategories')}</div>
                  <div className="mt-1 text-xs text-zinc-600">{t('noCategoriesHint')}</div>
                </div>
              ) : (
                filteredCategories.map((c) => (
                  <div key={c.id} className="ac-table-row grid grid-cols-[2fr_1fr_1fr_1fr_180px] gap-4">
                    <div className="font-medium text-zinc-900">{c.name}</div>
                    <div className="font-mono text-xs text-zinc-700">{c.code}</div>
                    <div className="text-xs text-zinc-700">{c.isActive === false ? t('inactive') : t('active')}</div>
                    <div className="text-xs text-zinc-600">{formatDate(c.updatedAt || c.createdAt)}</div>
                    <div className="flex justify-end">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                          onClick={() => {
                            setEditingCategory(c);
                            setCategoryNameEdit(c.name || '');
                            setCategoryCodeEdit(c.code || '');
                            setCategoryStatusEdit(c.isActive === false ? 'inactive' : 'active');
                            setShowEditCategory(true);
                          }}
                        >
                          {t('edit')}
                        </button>
                        <button
                          type="button"
                          className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                          onClick={async () => {
                            const nextStatus = c.isActive === false ? 'active' : 'inactive';
                            await updateCategory({ id: c.id, patch: { status: nextStatus } });
                            void fetchCategories();
                          }}
                        >
                          {c.isActive === false ? t('enable') : t('disable')}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

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
                  try {
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
                  } catch {
                    return;
                  }
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
                  try {
                    await createCategory({ name: trimmedName, code: trimmedCode, status: categoryStatus });
                    void fetchCategories();
                    setShowCreateCategory(false);
                    setCategoryName('');
                    setCategoryCode('');
                    setCategoryStatus('active');
                  } catch {
                    return;
                  }
                }}
              >
                {t('create')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showEditCategory ? (
        <div className="ac-modal-backdrop">
          <div className="ac-modal">
            <div className="mb-4 text-sm font-semibold text-zinc-900">{t('editCategory')}</div>
            <div className="space-y-3">
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('categoryName')}</div>
                <input value={categoryNameEdit} onChange={(e) => setCategoryNameEdit(e.target.value)} className="ac-input" />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('categoryCode')}</div>
                <input value={categoryCodeEdit} onChange={(e) => setCategoryCodeEdit(e.target.value)} className="ac-input font-mono" />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('status')}</div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs text-zinc-700">
                    <input
                      type="radio"
                      name="categoryStatusEdit"
                      value="active"
                      checked={categoryStatusEdit === 'active'}
                      onChange={() => setCategoryStatusEdit('active')}
                    />
                    {t('active')}
                  </label>
                  <label className="flex items-center gap-2 text-xs text-zinc-700">
                    <input
                      type="radio"
                      name="categoryStatusEdit"
                      value="inactive"
                      checked={categoryStatusEdit === 'inactive'}
                      onChange={() => setCategoryStatusEdit('inactive')}
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
                  setShowEditCategory(false);
                  setEditingCategory(null);
                }}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                className="ac-btn px-3 py-2 text-xs"
                disabled={!editingCategory?.id}
                onClick={async () => {
                  if (!editingCategory?.id) return;
                  const trimmedName = String(categoryNameEdit || '').trim();
                  const trimmedCode = String(categoryCodeEdit || '').trim();
                  if (!trimmedName || !trimmedCode) return;
                  try {
                    await updateCategory({
                      id: editingCategory.id,
                      patch: { name: trimmedName, code: trimmedCode, status: categoryStatusEdit }
                    });
                    void fetchCategories();
                    setShowEditCategory(false);
                    setEditingCategory(null);
                  } catch {
                    return;
                  }
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
