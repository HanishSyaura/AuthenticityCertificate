import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useRecordsStore from '../../store/useRecordsStore';
import { useT } from '../../i18n/useT';
import { stripHtmlToText } from '../../utils/richText';
import DataTable from '../../components/ui/DataTable';
import RowActionsMenu from '../../components/ui/RowActionsMenu';
import useTourStore from '../../store/useTourStore';
import { getProductModuleTourSteps } from '../../tour/productModuleTour';

function formatDate(input) {
  if (!input) return '';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

export default function AdminRecords() {
  const { t } = useT();
  const navigate = useNavigate();
  const { openTour } = useTourStore((s) => ({ openTour: s.openTour }));
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
    deleteProduct,
    bulkDeleteProducts
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
    deleteProduct: s.deleteProduct,
    bulkDeleteProducts: s.bulkDeleteProducts
  }));

  const [activeTab, setActiveTab] = useState('products');
  const [query, setQuery] = useState('');
  const [productStatusFilter, setProductStatusFilter] = useState('all');
  const [productCategoryFilter, setProductCategoryFilter] = useState('all');
  const [categoryQuery, setCategoryQuery] = useState('');
  const [categoryStatusFilter, setCategoryStatusFilter] = useState('all');
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

  const [selectedProductIds, setSelectedProductIds] = useState(() => new Set());
  const [bulkNotice, setBulkNotice] = useState(null);
  const headerCheckboxRef = useRef(null);

  useEffect(() => {
    const onTourAction = (e) => {
      const a = e?.detail;
      if (!a || typeof a !== 'object') return;
      if (a.type === 'records.setTab') {
        const tab = String(a.tab || '').toLowerCase();
        if (tab === 'products' || tab === 'categories') setActiveTab(tab);
        return;
      }
      if (a.type === 'records.openCreateCategory') {
        setShowCreateCategory(true);
        return;
      }
      if (a.type === 'records.openCreateProduct') {
        setShowCreate(true);
        return;
      }
      if (a.type === 'records.closeModals') {
        setShowCreate(false);
        setShowEdit(false);
        setShowCreateCategory(false);
        setShowEditCategory(false);
        setEditing(null);
        setEditingCategory(null);
      }
    };
    window.addEventListener('ac_tour_action', onTourAction);
    return () => window.removeEventListener('ac_tour_action', onTourAction);
  }, []);

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

  const productById = useMemo(() => {
    const map = new Map();
    (Array.isArray(products) ? products : []).forEach((p) => {
      if (p?.id == null) return;
      map.set(String(p.id), p);
    });
    return map;
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = String(query || '').trim().toLowerCase();
    const categoryFilter = String(productCategoryFilter || '').trim();
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
      if (categoryFilter && categoryFilter !== 'all' && String(p?.category || '') !== categoryFilter) return false;
      if (productStatusFilter === 'all') return true;
      if (productStatusFilter === 'inactive') return isInactive(p);
      return !isInactive(p);
    });
  }, [products, query, categoryByCode, productStatusFilter, productCategoryFilter]);

  const visibleProductIds = useMemo(() => filteredProducts.map((p) => p.id).filter((v) => v != null), [filteredProducts]);
  const visibleSelectedCount = useMemo(
    () => visibleProductIds.filter((id) => selectedProductIds.has(id)).length,
    [visibleProductIds, selectedProductIds]
  );
  const allVisibleSelected = visibleProductIds.length > 0 && visibleSelectedCount === visibleProductIds.length;
  const someVisibleSelected = visibleSelectedCount > 0 && !allVisibleSelected;
  const selectedCount = selectedProductIds.size;

  useEffect(() => {
    if (!headerCheckboxRef.current) return;
    headerCheckboxRef.current.indeterminate = someVisibleSelected;
  }, [someVisibleSelected]);

  useEffect(() => {
    setSelectedProductIds((prev) => {
      if (!prev.size) return prev;
      const next = new Set();
      for (const id of prev) {
        if (productById.has(String(id))) next.add(id);
      }
      if (next.size === prev.size) return prev;
      return next;
    });
  }, [productById]);

  function toggleSelected(id) {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filteredCategories = useMemo(() => {
    const q = String(categoryQuery || '').trim().toLowerCase();
    const statusFilter = String(categoryStatusFilter || '').trim();
    return (Array.isArray(categories) ? categories : []).filter((c) => {
      const isInactive = c?.isActive === false;
      if (statusFilter === 'active' && isInactive) return false;
      if (statusFilter === 'inactive' && !isInactive) return false;
      if (!q) return true;
      const nameStr = String(c?.name || '').toLowerCase();
      const codeStr = String(c?.code || '').toLowerCase();
      return nameStr.includes(q) || codeStr.includes(q);
    });
  }, [categories, categoryQuery, categoryStatusFilter]);

  const categoryOptions = useMemo(() => {
    return (Array.isArray(categories) ? categories : [])
      .filter((c) => c && c.code)
      .slice()
      .sort((a, b) => String(a?.name || a?.code || '').localeCompare(String(b?.name || b?.code || '')));
  }, [categories]);

  const pageTitle = activeTab === 'products' ? t('productsTab') : t('categoriesTab');

  return (
    <div className="ac-page">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">{pageTitle}</h2>
          <p className="mt-1 text-sm text-zinc-600">{t('recordsSubtitle')}</p>
          <div className="mt-2 flex items-center gap-2 text-sm text-zinc-500">
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
          <button
            type="button"
            className="ac-btn ac-btn-soft px-3 py-2"
            onClick={() => openTour({ steps: getProductModuleTourSteps(), storageKey: 'ac_seen_product_module_tour_v1' })}
          >
            Guide
          </button>
          {activeTab === 'categories' ? (
            <button type="button" className="ac-btn px-3 py-2" data-tour="records-add-category" onClick={() => setShowCreateCategory(true)}>
              {t('addCategory')}
            </button>
          ) : (
            <button type="button" className="ac-btn px-3 py-2" data-tour="records-create-product" onClick={() => setShowCreate(true)}>
              {t('createProduct')}
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-xl border border-zinc-200 bg-white p-1" data-tour="records-tabs">
            <button
              type="button"
              className={activeTab === 'products' ? 'rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white' : 'rounded-lg px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50'}
              onClick={() => setActiveTab('products')}
              data-tour="records-tab-products"
            >
              {t('productsTab')}
            </button>
            <button
              type="button"
              className={activeTab === 'categories' ? 'rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white' : 'rounded-lg px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50'}
              onClick={() => setActiveTab('categories')}
              data-tour="records-tab-categories"
            >
              {t('categoriesTab')}
            </button>
          </div>
        </div>

        {activeTab === 'products' ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-[240px] flex-1">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('searchProducts')}
                  className="ac-input"
                  data-tour="records-search-products"
                />
              </div>
              <select value={productStatusFilter} onChange={(e) => setProductStatusFilter(e.target.value)} className="ac-input w-[170px]">
                <option value="all">{t('allStatuses')}</option>
                <option value="active">{t('active')}</option>
                <option value="inactive">{t('inactive')}</option>
              </select>
              <select value={productCategoryFilter} onChange={(e) => setProductCategoryFilter(e.target.value)} className="ac-input w-[260px]">
                <option value="all">{t('allCategories')}</option>
                {categoryOptions.map((c) => (
                  <option key={c.id} value={String(c.code)}>
                    {String(c?.name || c?.code)} ({String(c.code)}){c?.isActive === false ? ` — ${t('inactive')}` : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="ac-btn ac-btn-soft px-3 py-2"
                onClick={() => {
                  setQuery('');
                  setProductStatusFilter('all');
                  setProductCategoryFilter('all');
                }}
              >
                {t('clearFilters')}
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
              <div>{t('showingProducts', { shown: filteredProducts.length, total: Array.isArray(products) ? products.length : 0 })}</div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-200 bg-white p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-[240px] flex-1">
                <input
                  value={categoryQuery}
                  onChange={(e) => setCategoryQuery(e.target.value)}
                  placeholder={t('searchCategories')}
                  className="ac-input"
                  data-tour="records-search-categories"
                />
              </div>
              <select value={categoryStatusFilter} onChange={(e) => setCategoryStatusFilter(e.target.value)} className="ac-input w-[170px]">
                <option value="all">{t('allStatuses')}</option>
                <option value="active">{t('active')}</option>
                <option value="inactive">{t('inactive')}</option>
              </select>
              <button
                type="button"
                className="ac-btn ac-btn-soft px-3 py-2"
                onClick={() => {
                  setCategoryQuery('');
                  setCategoryStatusFilter('all');
                }}
              >
                {t('clearFilters')}
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
              <div>{t('showingCategories', { shown: filteredCategories.length, total: Array.isArray(categories) ? categories.length : 0 })}</div>
            </div>
          </div>
        )}
      </div>

      {error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}
      {bulkNotice ? (
        <div
          className={
            bulkNotice.type === 'warning'
              ? 'mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900'
              : 'mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900'
          }
        >
          <div className="flex items-start justify-between gap-3">
            <div>{bulkNotice.message}</div>
            <button type="button" className="underline" onClick={() => setBulkNotice(null)}>
              {t('dismiss')}
            </button>
          </div>
        </div>
      ) : null}

      {activeTab === 'products' ? (
        <DataTable
          minWidth={1300}
          rows={filteredProducts}
          rowKey={(p) => p.id}
          loading={loading}
          loadingContent={t('loading')}
          emptyContent={
            <div>
              <div className="text-sm font-semibold text-zinc-900">{t('noProducts')}</div>
              <div className="mt-1 text-sm text-zinc-600">{t('noProductsHint')}</div>
            </div>
          }
          top={
            selectedCount ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-semibold text-zinc-900">{t('selectedProducts', { value: selectedCount })}</div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className="ac-btn ac-btn-soft px-3 py-2" onClick={() => setSelectedProductIds(new Set())}>
                    {t('clearSelection')}
                  </button>
                  <button
                    type="button"
                    className="ac-btn ac-btn-soft px-3 py-2"
                    onClick={async () => {
                      const ids = Array.from(selectedProductIds);
                      const activeIds = ids.filter((id) => {
                        const p = productById.get(String(id));
                        return String(p?.status || '').toLowerCase() !== 'inactive';
                      });
                      if (!activeIds.length) return;
                      if (!window.confirm(t('confirmDeactivateSelectedProducts', { value: activeIds.length }))) return;
                      for (const id of activeIds) {
                        await deactivateProduct({ id });
                      }
                      void fetchProducts();
                    }}
                    disabled={Array.from(selectedProductIds).every((id) => String(productById.get(String(id))?.status || '').toLowerCase() === 'inactive')}
                  >
                    {t('deactivateSelected')}
                  </button>
                  <button
                    type="button"
                    className="ac-btn ac-btn-soft px-3 py-2"
                    onClick={async () => {
                      const ids = Array.from(selectedProductIds);
                      if (!ids.length) return;
                      if (!window.confirm(t('confirmDeleteSelectedProducts', { value: ids.length }))) return;
                      const result = await bulkDeleteProducts({ ids });
                      const deletedCount = Array.isArray(result?.deletedIds) ? result.deletedIds.length : 0;
                      const notInactiveCount = Array.isArray(result?.notInactiveIds) ? result.notInactiveIds.length : 0;
                      const notFoundCount = Array.isArray(result?.notFoundIds) ? result.notFoundIds.length : 0;

                      setSelectedProductIds((prev) => {
                        if (!prev.size) return prev;
                        const next = new Set(prev);
                        (Array.isArray(result?.deletedIds) ? result.deletedIds : []).forEach((id) => next.delete(id));
                        return next;
                      });
                      void fetchProducts();

                      if (notInactiveCount || notFoundCount) {
                        setBulkNotice({
                          type: 'warning',
                          message: t('bulkDeletePartial', { deleted: deletedCount, notInactive: notInactiveCount, notFound: notFoundCount })
                        });
                      } else {
                        setBulkNotice({ type: 'success', message: t('bulkDeleteSuccess', { value: deletedCount }) });
                      }
                    }}
                  >
                    {t('deleteSelected')}
                  </button>
                </div>
              </div>
            ) : null
          }
          onRowClick={(p) => navigate(`/admin/records/${p.id}`)}
          columns={[
            {
              id: 'select',
              header: (
                <div className="flex items-center justify-center">
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    className="h-4 w-4 rounded border-zinc-300 text-brand-600"
                    checked={allVisibleSelected}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => {
                      setSelectedProductIds((prev) => {
                        const next = new Set(prev);
                        if (allVisibleSelected) {
                          visibleProductIds.forEach((id) => next.delete(id));
                        } else {
                          visibleProductIds.forEach((id) => next.add(id));
                        }
                        return next;
                      });
                    }}
                    aria-label={t('selectAll')}
                  />
                </div>
              ),
              cell: (p) => (
                <div className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-zinc-300 text-brand-600"
                    checked={selectedProductIds.has(p.id)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggleSelected(p.id)}
                    aria-label={t('selectProduct')}
                  />
                </div>
              ),
              align: 'center',
              headerClassName: 'px-2',
              className: 'px-2'
            },
            {
              id: 'sku',
              header: t('sku'),
              cell: (p) => <span className="font-mono text-sm text-zinc-700">{p.sku}</span>
            },
            {
              id: 'product',
              header: t('product'),
              cell: (p) => <span className="font-medium text-zinc-900">{p.name}</span>
            },
            {
              id: 'productCode',
              header: t('productCode'),
              cell: (p) => <span className="font-mono text-sm text-zinc-700">{p.code}</span>
            },
            {
              id: 'category',
              header: t('category'),
              cell: (p) => <span className="text-sm text-zinc-700">{categoryByCode.get(String(p.category || ''))?.name || p.category || '-'}</span>
            },
            {
              id: 'status',
              header: t('status'),
              cell: (p) => {
                const isInactive = String(p?.status || '').toLowerCase() === 'inactive';
                const tone = isInactive ? 'border-zinc-200 bg-zinc-50 text-zinc-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700';
                return (
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${tone}`}>
                    {isInactive ? t('inactive') : t('active')}
                  </span>
                );
              }
            },
            {
              id: 'updated',
              header: t('updated'),
              cell: (p) => <span className="text-sm text-zinc-600">{formatDate(p.updatedAt || p.createdAt)}</span>
            },
            {
              id: 'remark',
              header: t('remark'),
              cell: (p) => {
                const plain = stripHtmlToText(p.remark);
                const text = String(plain || '').trim();
                return <div className="max-w-[360px] truncate text-sm text-zinc-600">{text ? plain : '-'}</div>;
              }
            },
            {
              id: 'actions',
              header: t('actions'),
              align: 'right',
              cell: (p) => {
                const isInactive = String(p?.status || '').toLowerCase() === 'inactive';
                const canDeactivate = !isInactive;
                return (
                  <RowActionsMenu
                    ariaLabel={t('actions')}
                    items={[
                      {
                        key: 'edit',
                        label: t('edit'),
                        onSelect: () => {
                          setEditing(p);
                          setSku(p.sku || '');
                          setName(p.name || '');
                          setProductCode(p.code || '');
                          setCategory(p.category || '');
                          setStatus(String(p.status || '').toLowerCase() === 'inactive' ? 'inactive' : 'active');
                          setRemark(stripHtmlToText(p.remark || ''));
                          setShowEdit(true);
                        }
                      },
                      canDeactivate
                        ? {
                            key: 'deactivate',
                            label: t('deactivate'),
                            onSelect: async () => {
                              if (!window.confirm(t('confirmDeactivateProduct'))) return;
                              await deactivateProduct({ id: p.id });
                              void fetchProducts();
                            }
                          }
                        : {
                            key: 'activate',
                            label: t('activate'),
                            onSelect: async () => {
                              if (!window.confirm(t('confirmActivateProduct'))) return;
                              await activateProduct({ id: p.id });
                              void fetchProducts();
                            }
                          },
                      !canDeactivate
                        ? {
                            key: 'delete',
                            label: t('delete'),
                            tone: 'danger',
                            onSelect: async () => {
                              if (!window.confirm(t('confirmDeleteProduct'))) return;
                              await deleteProduct({ id: p.id });
                              void fetchProducts();
                            }
                          }
                        : null
                    ].filter(Boolean)}
                  />
                );
              },
              headerClassName: 'pr-3',
              className: 'pr-3'
            }
          ]}
        />
      ) : (
        <DataTable
          minWidth={900}
          rows={filteredCategories}
          rowKey={(c) => c.id}
          loading={loading}
          loadingContent={t('loading')}
          emptyContent={
            <div>
              <div className="text-sm font-semibold text-zinc-900">{t('noCategories')}</div>
              <div className="mt-1 text-sm text-zinc-600">{t('noCategoriesHint')}</div>
            </div>
          }
          columns={[
            { id: 'name', header: t('name'), cell: (c) => <span className="font-medium text-zinc-900">{c.name}</span> },
            { id: 'code', header: t('code'), cell: (c) => <span className="font-mono text-sm text-zinc-700">{c.code}</span> },
            {
              id: 'status',
              header: t('status'),
              cell: (c) => {
                const isInactive = c.isActive === false;
                const tone = isInactive ? 'border-zinc-200 bg-zinc-50 text-zinc-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700';
                return (
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${tone}`}>
                    {isInactive ? t('inactive') : t('active')}
                  </span>
                );
              }
            },
            { id: 'updated', header: t('updated'), cell: (c) => <span className="text-sm text-zinc-600">{formatDate(c.updatedAt || c.createdAt)}</span> },
            {
              id: 'actions',
              header: t('actions'),
              align: 'right',
              cell: (c) => (
                <RowActionsMenu
                  ariaLabel={t('actions')}
                  items={[
                    {
                      key: 'edit',
                      label: t('edit'),
                      onSelect: () => {
                        setEditingCategory(c);
                        setCategoryNameEdit(c.name || '');
                        setCategoryCodeEdit(c.code || '');
                        setCategoryStatusEdit(c.isActive === false ? 'inactive' : 'active');
                        setShowEditCategory(true);
                      }
                    },
                    {
                      key: 'toggle',
                      label: c.isActive === false ? t('enable') : t('disable'),
                      onSelect: async () => {
                        const nextStatus = c.isActive === false ? 'active' : 'inactive';
                        await updateCategory({ id: c.id, patch: { status: nextStatus } });
                        void fetchCategories();
                      }
                    }
                  ]}
                />
              ),
              headerClassName: 'pr-3',
              className: 'pr-3'
            }
          ]}
        />
      )}

      {showCreate ? (
        <div className="ac-modal-backdrop">
          <div className="ac-modal" data-tour="records-product-modal">
            <div className="mb-4 text-sm font-semibold text-zinc-900">{t('createProduct')}</div>
            <div className="space-y-3">
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('sku')}</div>
                <input
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className="ac-input font-mono"
                  data-tour="records-product-sku"
                />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('name')}</div>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="ac-input"
                  data-tour="records-product-name"
                />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('productCode')}</div>
                <input
                  value={productCode}
                  onChange={(e) => setProductCode(e.target.value)}
                  className="ac-input font-mono"
                  data-tour="records-product-code"
                />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('category')}</div>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="ac-input" data-tour="records-product-category">
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
                <div className="flex items-center gap-4" data-tour="records-product-status">
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
                <textarea value={remark} onChange={(e) => setRemark(e.target.value)} className="ac-input h-24 resize-none" data-tour="records-product-remark" />
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
                data-tour="records-product-cancel"
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
                data-tour="records-product-create"
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
                <textarea value={remark} onChange={(e) => setRemark(e.target.value)} className="ac-input h-24 resize-none" />
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
          <div className="ac-modal" data-tour="records-category-modal">
            <div className="mb-4 text-sm font-semibold text-zinc-900">{t('createCategory')}</div>
            <div className="space-y-3">
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('categoryName')}</div>
                <input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} className="ac-input" data-tour="records-category-name" />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('categoryCode')}</div>
                <input value={categoryCode} onChange={(e) => setCategoryCode(e.target.value)} className="ac-input font-mono" data-tour="records-category-code" />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('status')}</div>
                <div className="flex items-center gap-4" data-tour="records-category-status">
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
                data-tour="records-category-cancel"
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
                data-tour="records-category-create"
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
