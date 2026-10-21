import React, { useEffect, useMemo, useRef, useState } from 'react';
import useRecordsStore from '../../store/useRecordsStore';
import useCmsStore from '../../store/useCmsStore';
import useAdminAuthStore from '../../store/useAdminAuthStore';
import { useT } from '../../i18n/useT';
import { stripHtmlToText } from '../../utils/richText';
import { sortRows } from '../../utils/tableSort';
import DataTable from '../../components/ui/DataTable';
import TablePager from '../../components/ui/TablePager';
import RowActionsMenu from '../../components/ui/RowActionsMenu';

function formatDate(input) {
  if (!input) return '';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function readLocalRows(key) {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalRows(key, rows) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(Array.isArray(rows) ? rows : []));
  } catch {
    void 0;
  }
}

function makeLocalId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function TabButton({ active, children, ...props }) {
  return (
    <button
      type="button"
      className={
        active
          ? 'rounded-xl px-3.5 py-2.5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(15,23,42,0.14)]'
          : 'rounded-xl border border-transparent px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-200 hover:bg-slate-50'
      }
      style={active ? { background: 'linear-gradient(135deg, var(--ac-brand) 0%, var(--ac-brand-deep) 100%)' } : undefined}
      {...props}
    >
      {children}
    </button>
  );
}

function SubTabSection({ title, hint, action, children }) {
  return (
    <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_16px_34px_rgba(15,23,42,0.05)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-xl font-semibold tracking-tight text-slate-950">{title}</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{hint}</p>
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function AdminRecords() {
  const { t } = useT();
  const user = useAdminAuthStore((s) => s.user);
  const {
    products,
    categories,
    customers,
    suppliers,
    loading,
    error,
    lastSyncAt,
    fetchProducts,
    fetchCategories,
    fetchCustomers,
    fetchSuppliers,
    createCategory,
    updateCategory,
    createProduct,
    updateProduct,
    createCustomer,
    updateCustomer,
    createSupplier,
    updateSupplier,
    deactivateProduct,
    activateProduct,
    deleteProduct,
    bulkDeleteProducts
  } = useRecordsStore((s) => ({
    products: s.products,
    categories: s.categories,
    customers: s.customers,
    suppliers: s.suppliers,
    loading: s.loading,
    error: s.error,
    lastSyncAt: s.lastSyncAt,
    fetchProducts: s.fetchProducts,
    fetchCategories: s.fetchCategories,
    fetchCustomers: s.fetchCustomers,
    fetchSuppliers: s.fetchSuppliers,
    createCategory: s.createCategory,
    updateCategory: s.updateCategory,
    createProduct: s.createProduct,
    updateProduct: s.updateProduct,
    createCustomer: s.createCustomer,
    updateCustomer: s.updateCustomer,
    createSupplier: s.createSupplier,
    updateSupplier: s.updateSupplier,
    deactivateProduct: s.deactivateProduct,
    activateProduct: s.activateProduct,
    deleteProduct: s.deleteProduct,
    bulkDeleteProducts: s.bulkDeleteProducts
  }));

  const { cmsDesigns, cmsDesignsLoading, cmsFetchDesigns } = useCmsStore((s) => ({
    cmsDesigns: s.designs,
    cmsDesignsLoading: s.loadingDesigns || s.loading,
    cmsFetchDesigns: s.fetchDesigns
  }));

  const [activeTab, setActiveTab] = useState('products');
  const [query, setQuery] = useState('');
  const [productStatusFilter, setProductStatusFilter] = useState('all');
  const [productCategoryFilter, setProductCategoryFilter] = useState('all');
  const [categoryQuery, setCategoryQuery] = useState('');
  const [categoryStatusFilter, setCategoryStatusFilter] = useState('all');
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerStatusFilter, setCustomerStatusFilter] = useState('all');
  const [supplierQuery, setSupplierQuery] = useState('');
  const [supplierStatusFilter, setSupplierStatusFilter] = useState('all');
  const [productSort, setProductSort] = useState(null);
  const [categorySort, setCategorySort] = useState(null);
  const [customerSort, setCustomerSort] = useState(null);
  const [supplierSort, setSupplierSort] = useState(null);
  const [productOffset, setProductOffset] = useState(0);
  const [productLimit, setProductLimit] = useState(50);
  const [categoryOffset, setCategoryOffset] = useState(0);
  const [categoryLimit, setCategoryLimit] = useState(50);
  const [customerOffset, setCustomerOffset] = useState(0);
  const [customerLimit, setCustomerLimit] = useState(50);
  const [supplierOffset, setSupplierOffset] = useState(0);
  const [supplierLimit, setSupplierLimit] = useState(50);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [showEditCategory, setShowEditCategory] = useState(false);
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [showEditCustomer, setShowEditCustomer] = useState(false);
  const [showCreateSupplier, setShowCreateSupplier] = useState(false);
  const [showEditSupplier, setShowEditSupplier] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [productCode, setProductCode] = useState('');
  const [category, setCategory] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [status, setStatus] = useState('active');
  const [remark, setRemark] = useState('');
  // NEW: design bundle FKs (each bundle = multiple inner pages/sections)
  const [selectedCmsDesignId, setSelectedCmsDesignId] = useState('');
  const [selectedCmsCertificateDesignId, setSelectedCmsCertificateDesignId] = useState('');

  const [categoryName, setCategoryName] = useState('');
  const [categoryCode, setCategoryCode] = useState('');
  const [categoryStatus, setCategoryStatus] = useState('active');
  const [categoryNameEdit, setCategoryNameEdit] = useState('');
  const [categoryCodeEdit, setCategoryCodeEdit] = useState('');
  const [categoryStatusEdit, setCategoryStatusEdit] = useState('active');
  const [customerRowsState, setCustomerRowsState] = useState(() => readLocalRows('ac_master_data_customers_rows_v1'));
  const [supplierRowsState, setSupplierRowsState] = useState(() => readLocalRows('ac_master_data_suppliers_rows_v1'));
  const [customerForm, setCustomerForm] = useState({
    customerCode: '',
    customerName: '',
    contactPerson: '',
    address: '',
    email: '',
    status: 'Active'
  });
  const [supplierForm, setSupplierForm] = useState({
    supplierCode: '',
    supplierName: '',
    contactPerson: '',
    address: '',
    email: '',
    phoneNumber: '',
    status: 'Active'
  });

  const [selectedProductIds, setSelectedProductIds] = useState(() => new Set());
  const [selectedCategoryIds, setSelectedCategoryIds] = useState(() => new Set());
  const [selectedCustomerIds, setSelectedCustomerIds] = useState(() => new Set());
  const [selectedSupplierIds, setSelectedSupplierIds] = useState(() => new Set());
  const [bulkNotice, setBulkNotice] = useState(null);
  const productHeaderCheckboxRef = useRef(null);
  const categoryHeaderCheckboxRef = useRef(null);
  const customerHeaderCheckboxRef = useRef(null);
  const supplierHeaderCheckboxRef = useRef(null);
  const columnPrefsUserKey = useMemo(() => {
    const raw = String(user?.id || user?.email || 'guest').trim().toLowerCase();
    return raw.replace(/[^a-z0-9_-]+/g, '_') || 'guest';
  }, [user?.email, user?.id]);

  function scopedColumnKey(base) {
    return `${base}_${columnPrefsUserKey}`;
  }
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
        setShowCreateCustomer(false);
        setShowEditCustomer(false);
        setShowCreateSupplier(false);
        setShowEditSupplier(false);
        setEditing(null);
        setEditingCategory(null);
        setEditingCustomer(null);
        setEditingSupplier(null);
      }
    };
    window.addEventListener('ac_tour_action', onTourAction);
    return () => window.removeEventListener('ac_tour_action', onTourAction);
  }, []);

  useEffect(() => {
    void fetchProducts();
    void fetchCategories();
    void fetchCustomers();
    void fetchSuppliers();
    void cmsFetchDesigns({ kind: 'landing' });
  }, [fetchProducts, fetchCategories, fetchCustomers, fetchSuppliers, cmsFetchDesigns]);

  useEffect(() => {
    const id = setInterval(() => {
      void fetchProducts();
    }, 10_000);
    return () => clearInterval(id);
  }, [fetchProducts]);

  useEffect(() => {
    writeLocalRows('ac_master_data_customers_rows_v1', customerRowsState);
  }, [customerRowsState]);

  useEffect(() => {
    writeLocalRows('ac_master_data_suppliers_rows_v1', supplierRowsState);
  }, [supplierRowsState]);

  useEffect(() => {
    setCustomerRowsState(Array.isArray(customers) ? customers : []);
  }, [customers]);

  useEffect(() => {
    setSupplierRowsState(Array.isArray(suppliers) ? suppliers : []);
  }, [suppliers]);

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

  useEffect(() => {
    setProductOffset(0);
  }, [query, productCategoryFilter, productStatusFilter, productSort]);

  const visibleProductIds = useMemo(() => filteredProducts.map((p) => p.id).filter((v) => v != null), [filteredProducts]);
  const visibleSelectedCount = useMemo(
    () => visibleProductIds.filter((id) => selectedProductIds.has(id)).length,
    [visibleProductIds, selectedProductIds]
  );
  const allVisibleSelected = visibleProductIds.length > 0 && visibleSelectedCount === visibleProductIds.length;
  const someVisibleSelected = visibleSelectedCount > 0 && !allVisibleSelected;
  const selectedCount = selectedProductIds.size;

  useEffect(() => {
    if (!productHeaderCheckboxRef.current) return;
    productHeaderCheckboxRef.current.indeterminate = someVisibleSelected;
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

  const visibleCategoryIds = useMemo(() => filteredCategories.map((c) => c.id).filter((v) => v != null), [filteredCategories]);
  const visibleSelectedCategoryCount = useMemo(
    () => visibleCategoryIds.filter((id) => selectedCategoryIds.has(id)).length,
    [visibleCategoryIds, selectedCategoryIds]
  );
  const allVisibleCategoriesSelected = visibleCategoryIds.length > 0 && visibleSelectedCategoryCount === visibleCategoryIds.length;
  const someVisibleCategoriesSelected = visibleSelectedCategoryCount > 0 && !allVisibleCategoriesSelected;

  useEffect(() => {
    if (!categoryHeaderCheckboxRef.current) return;
    categoryHeaderCheckboxRef.current.indeterminate = someVisibleCategoriesSelected;
  }, [someVisibleCategoriesSelected]);

  useEffect(() => {
    setSelectedCategoryIds((prev) => {
      if (!prev.size) return prev;
      const categoryIds = new Set((Array.isArray(categories) ? categories : []).map((item) => item?.id).filter((id) => id != null));
      const next = new Set();
      for (const id of prev) {
        if (categoryIds.has(id)) next.add(id);
      }
      if (next.size === prev.size) return prev;
      return next;
    });
  }, [categories]);

  function toggleSelectedCategory(id) {
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  useEffect(() => {
    setCategoryOffset(0);
  }, [categoryQuery, categoryStatusFilter, categorySort]);

  const categoryOptions = useMemo(() => {
    return (Array.isArray(categories) ? categories : [])
      .filter((c) => c && c.code)
      .slice()
      .sort((a, b) => String(a?.name || a?.code || '').localeCompare(String(b?.name || b?.code || '')));
  }, [categories]);

  const pageTitle = t('records');
  const customerRows = useMemo(
    () =>
      customerRowsState
        .slice()
        .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))),
    [customerRowsState]
  );
  const supplierRows = useMemo(
    () =>
      supplierRowsState
        .slice()
        .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))),
    [supplierRowsState]
  );

  const filteredCustomers = useMemo(() => {
    const q = String(customerQuery || '').trim().toLowerCase();
    const statusFilter = String(customerStatusFilter || '').trim();
    return customerRows.filter((row) => {
      const isInactive = String(row?.status || '').toLowerCase() === 'inactive';
      if (statusFilter === 'active' && isInactive) return false;
      if (statusFilter === 'inactive' && !isInactive) return false;
      if (!q) return true;
      return (
        String(row?.customerName || '').toLowerCase().includes(q) ||
        String(row?.customerCode || '').toLowerCase().includes(q) ||
        String(row?.contactPerson || '').toLowerCase().includes(q) ||
        String(row?.address || '').toLowerCase().includes(q) ||
        String(row?.email || '').toLowerCase().includes(q)
      );
    });
  }, [customerRows, customerQuery, customerStatusFilter]);

  const filteredSuppliers = useMemo(() => {
    const q = String(supplierQuery || '').trim().toLowerCase();
    const statusFilter = String(supplierStatusFilter || '').trim();
    return supplierRows.filter((row) => {
      const isInactive = String(row?.status || '').toLowerCase() === 'inactive';
      if (statusFilter === 'active' && isInactive) return false;
      if (statusFilter === 'inactive' && !isInactive) return false;
      if (!q) return true;
      return (
        String(row?.supplierName || '').toLowerCase().includes(q) ||
        String(row?.supplierCode || '').toLowerCase().includes(q) ||
        String(row?.contactPerson || '').toLowerCase().includes(q) ||
        String(row?.address || '').toLowerCase().includes(q) ||
        String(row?.email || '').toLowerCase().includes(q)
      );
    });
  }, [supplierRows, supplierQuery, supplierStatusFilter]);

  useEffect(() => {
    setCustomerOffset(0);
  }, [customerQuery, customerStatusFilter, customerSort]);

  useEffect(() => {
    setSupplierOffset(0);
  }, [supplierQuery, supplierStatusFilter, supplierSort]);

  const visibleCustomerIds = useMemo(() => filteredCustomers.map((row) => row.id).filter((v) => v != null), [filteredCustomers]);
  const visibleSelectedCustomerCount = useMemo(
    () => visibleCustomerIds.filter((id) => selectedCustomerIds.has(id)).length,
    [visibleCustomerIds, selectedCustomerIds]
  );
  const allVisibleCustomersSelected = visibleCustomerIds.length > 0 && visibleSelectedCustomerCount === visibleCustomerIds.length;
  const someVisibleCustomersSelected = visibleSelectedCustomerCount > 0 && !allVisibleCustomersSelected;

  useEffect(() => {
    if (!customerHeaderCheckboxRef.current) return;
    customerHeaderCheckboxRef.current.indeterminate = someVisibleCustomersSelected;
  }, [someVisibleCustomersSelected]);

  useEffect(() => {
    setSelectedCustomerIds((prev) => {
      if (!prev.size) return prev;
      const customerIds = new Set(customerRows.map((item) => item?.id).filter((id) => id != null));
      const next = new Set();
      for (const id of prev) {
        if (customerIds.has(id)) next.add(id);
      }
      if (next.size === prev.size) return prev;
      return next;
    });
  }, [customerRows]);

  function toggleSelectedCustomer(id) {
    setSelectedCustomerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const visibleSupplierIds = useMemo(() => filteredSuppliers.map((row) => row.id).filter((v) => v != null), [filteredSuppliers]);
  const visibleSelectedSupplierCount = useMemo(
    () => visibleSupplierIds.filter((id) => selectedSupplierIds.has(id)).length,
    [visibleSupplierIds, selectedSupplierIds]
  );
  const allVisibleSuppliersSelected = visibleSupplierIds.length > 0 && visibleSelectedSupplierCount === visibleSupplierIds.length;
  const someVisibleSuppliersSelected = visibleSelectedSupplierCount > 0 && !allVisibleSuppliersSelected;

  useEffect(() => {
    if (!supplierHeaderCheckboxRef.current) return;
    supplierHeaderCheckboxRef.current.indeterminate = someVisibleSuppliersSelected;
  }, [someVisibleSuppliersSelected]);

  useEffect(() => {
    setSelectedSupplierIds((prev) => {
      if (!prev.size) return prev;
      const supplierIds = new Set(supplierRows.map((item) => item?.id).filter((id) => id != null));
      const next = new Set();
      for (const id of prev) {
        if (supplierIds.has(id)) next.add(id);
      }
      if (next.size === prev.size) return prev;
      return next;
    });
  }, [supplierRows]);

  function toggleSelectedSupplier(id) {
    setSelectedSupplierIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function resetCustomerForm() {
    setCustomerForm({
      customerCode: '',
      customerName: '',
      contactPerson: '',
      address: '',
      email: '',
      status: 'Active'
    });
  }

  function resetSupplierForm() {
    setSupplierForm({
      supplierCode: '',
      supplierName: '',
      contactPerson: '',
      address: '',
      email: '',
      phoneNumber: '',
      status: 'Active'
    });
  }

  function handleRefreshActiveTab() {
    if (activeTab === 'categories') {
      setCategoryQuery('');
      setCategoryStatusFilter('all');
      setCategorySort(null);
      setCategoryOffset(0);
      setSelectedCategoryIds(new Set());
      void fetchCategories();
      return;
    }
    if (activeTab === 'products') {
      setQuery('');
      setProductStatusFilter('all');
      setProductCategoryFilter('all');
      setProductSort(null);
      setProductOffset(0);
      setSelectedProductIds(new Set());
      setBulkNotice(null);
      void fetchProducts();
      return;
    }
    if (activeTab === 'customers') {
      setCustomerQuery('');
      setCustomerStatusFilter('all');
      setCustomerSort(null);
      setCustomerOffset(0);
      setSelectedCustomerIds(new Set());
      setCustomerRowsState(readLocalRows('ac_master_data_customers_rows_v1'));
      return;
    }
    setSupplierQuery('');
    setSupplierStatusFilter('all');
    setSupplierSort(null);
    setSupplierOffset(0);
    setSelectedSupplierIds(new Set());
    setSupplierRowsState(readLocalRows('ac_master_data_suppliers_rows_v1'));
  }

  const productColumns = [
    {
      id: 'select',
      label: t('selectAll'),
      lockedPosition: 'left',
      width: 44,
      minWidth: 44,
      maxWidth: 44,
      pinnable: false,
      hideable: false,
      sortable: false,
      resizable: false,
      header: (
        <div className="flex items-center justify-center">
          <input
            ref={productHeaderCheckboxRef}
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-slate-900"
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
            className="h-4 w-4 rounded border-slate-300 text-slate-900"
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
      label: t('sku'),
      width: 108,
      minWidth: 96,
      header: t('sku'),
      sortValue: (p) => p.sku,
      cell: (p) => <span className="font-mono text-sm text-slate-700">{p.sku}</span>
    },
    {
      id: 'product',
      label: t('product'),
      width: 196,
      minWidth: 164,
      pinnable: true,
      header: t('product'),
      sortValue: (p) => p.name,
      cell: (p) => <span className="font-semibold text-slate-900">{p.name}</span>
    },
    {
      id: 'productCode',
      label: t('productCode'),
      width: 118,
      minWidth: 104,
      header: t('productCode'),
      sortValue: (p) => p.code,
      cell: (p) => <span className="font-mono text-sm text-slate-700">{p.code}</span>
    },
    {
      id: 'category',
      label: t('category'),
      width: 148,
      minWidth: 132,
      header: t('category'),
      sortValue: (p) => categoryByCode.get(String(p.category || ''))?.name || p.category || '',
      cell: (p) => <span className="text-sm text-slate-700">{categoryByCode.get(String(p.category || ''))?.name || p.category || '-'}</span>
    },
    {
      id: 'status',
      label: t('status'),
      width: 102,
      minWidth: 96,
      header: t('status'),
      sortValue: (p) => p.status,
      cell: (p) => {
        const isInactive = String(p?.status || '').toLowerCase() === 'inactive';
        const tone = isInactive ? 'border-slate-200 bg-slate-100 text-slate-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700';
        return (
          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>
            {isInactive ? t('inactive') : t('active')}
          </span>
        );
      }
    },
    {
      id: 'updated',
      label: t('updated'),
      width: 154,
      minWidth: 144,
      header: t('updated'),
      sortValue: (p) => p.updatedAt || p.createdAt,
      cell: (p) => <span className="text-sm text-slate-600">{formatDate(p.updatedAt || p.createdAt)}</span>
    },
    {
      id: 'remark',
      label: t('remark'),
      width: 220,
      minWidth: 180,
      header: t('remark'),
      sortValue: (p) => stripHtmlToText(p.remark) || '',
      cell: (p) => {
        const plain = stripHtmlToText(p.remark);
        const text = String(plain || '').trim();
        return <div className="max-w-[360px] truncate text-sm text-slate-600">{text ? plain : '-'}</div>;
      }
    },
    {
      id: 'actions',
      label: t('actions'),
      width: 74,
      minWidth: 74,
      maxWidth: 74,
      pinnable: false,
      hideable: false,
      sortable: false,
      resizable: false,
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
                  setSelectedCustomerId(p?.customerId != null ? String(p.customerId) : '');
                  setSelectedSupplierId(p?.supplierId != null ? String(p.supplierId) : '');
                  setStatus(String(p.status || '').toLowerCase() === 'inactive' ? 'inactive' : 'active');
                  setRemark(stripHtmlToText(p.remark || ''));
                  const desId = p?.cmsDesignId != null ? p.cmsDesignId : p?.cmsPageId != null ? p.cmsPageId : null;
                  const certDesId =
                    p?.cmsCertificateDesignId != null ? p.cmsCertificateDesignId : p?.cmsCertificatePageId != null ? p.cmsCertificatePageId : null;
                  setSelectedCmsDesignId(desId != null ? String(desId) : '');
                  setSelectedCmsCertificateDesignId(certDesId != null ? String(certDesId) : '');
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
  ];

  const categoryColumns = [
    {
      id: 'select',
      label: t('selectAll'),
      lockedPosition: 'left',
      width: 44,
      minWidth: 44,
      maxWidth: 44,
      pinnable: false,
      hideable: false,
      sortable: false,
      resizable: false,
      header: (
        <div className="flex items-center justify-center">
          <input
            ref={categoryHeaderCheckboxRef}
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-slate-900"
            checked={allVisibleCategoriesSelected}
            onClick={(e) => e.stopPropagation()}
            onChange={() => {
              setSelectedCategoryIds((prev) => {
                const next = new Set(prev);
                if (allVisibleCategoriesSelected) {
                  visibleCategoryIds.forEach((id) => next.delete(id));
                } else {
                  visibleCategoryIds.forEach((id) => next.add(id));
                }
                return next;
              });
            }}
            aria-label={t('selectAll')}
          />
        </div>
      ),
      cell: (c) => (
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-slate-900"
            checked={selectedCategoryIds.has(c.id)}
            onClick={(e) => e.stopPropagation()}
            onChange={() => toggleSelectedCategory(c.id)}
            aria-label={t('selectCategory')}
          />
        </div>
      ),
      align: 'center',
      headerClassName: 'px-2',
      className: 'px-2'
    },
    {
      id: 'name',
      label: t('name'),
      width: 188,
      minWidth: 156,
      pinnable: true,
      header: t('name'),
      sortValue: (c) => c.name,
      cell: (c) => <span className="font-semibold text-slate-900">{c.name}</span>
    },
    {
      id: 'code',
      label: t('code'),
      width: 112,
      minWidth: 96,
      header: t('code'),
      cell: (c) => <span className="font-mono text-sm text-slate-700">{c.code}</span>
    },
    {
      id: 'status',
      label: t('status'),
      width: 102,
      minWidth: 96,
      header: t('status'),
      sortValue: (c) => (c.isActive === false ? 'inactive' : 'active'),
      cell: (c) => {
        const isInactive = c.isActive === false;
        const tone = isInactive ? 'border-slate-200 bg-slate-100 text-slate-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700';
        return (
          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>
            {isInactive ? t('inactive') : t('active')}
          </span>
        );
      }
    },
    {
      id: 'updated',
      label: t('updated'),
      width: 154,
      minWidth: 144,
      header: t('updated'),
      sortValue: (c) => c.updatedAt || c.createdAt,
      cell: (c) => <span className="text-sm text-slate-600">{formatDate(c.updatedAt || c.createdAt)}</span>
    },
    {
      id: 'actions',
      label: t('actions'),
      width: 74,
      minWidth: 74,
      maxWidth: 74,
      pinnable: false,
      hideable: false,
      sortable: false,
      resizable: false,
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
  ];

  const customerColumns = [
    {
      id: 'select',
      label: t('selectAll'),
      lockedPosition: 'left',
      width: 44,
      minWidth: 44,
      maxWidth: 44,
      pinnable: false,
      hideable: false,
      sortable: false,
      resizable: false,
      header: (
        <div className="flex items-center justify-center">
          <input
            ref={customerHeaderCheckboxRef}
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-slate-900"
            checked={allVisibleCustomersSelected}
            onClick={(e) => e.stopPropagation()}
            onChange={() => {
              setSelectedCustomerIds((prev) => {
                const next = new Set(prev);
                if (allVisibleCustomersSelected) {
                  visibleCustomerIds.forEach((id) => next.delete(id));
                } else {
                  visibleCustomerIds.forEach((id) => next.add(id));
                }
                return next;
              });
            }}
            aria-label={t('selectAll')}
          />
        </div>
      ),
      cell: (row) => (
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-slate-900"
            checked={selectedCustomerIds.has(row.id)}
            onClick={(e) => e.stopPropagation()}
            onChange={() => toggleSelectedCustomer(row.id)}
            aria-label={t('selectCustomer')}
          />
        </div>
      ),
      align: 'center',
      headerClassName: 'px-2',
      className: 'px-2'
    },
    { id: 'customerCode', label: t('customerCode'), width: 118, minWidth: 104, pinnable: true, header: t('customerCode'), sortValue: (row) => row.customerCode, cell: (row) => <span className="font-mono text-sm text-slate-700">{row.customerCode}</span> },
    { id: 'customerName', label: t('customerName'), width: 190, minWidth: 160, header: t('customerName'), sortValue: (row) => row.customerName, cell: (row) => <span className="font-semibold text-slate-900">{row.customerName}</span> },
    { id: 'contactPerson', label: t('contactPerson'), width: 164, minWidth: 144, header: t('contactPerson'), sortValue: (row) => row.contactPerson, cell: (row) => <span className="text-sm text-slate-700">{row.contactPerson}</span> },
    { id: 'address', label: t('address'), width: 240, minWidth: 180, header: t('address'), sortValue: (row) => row.address, cell: (row) => <span className="text-sm text-slate-700">{row.address || '-'}</span> },
    { id: 'email', label: t('email'), width: 206, minWidth: 176, header: t('email'), sortValue: (row) => row.email, cell: (row) => <span className="text-sm text-slate-700">{row.email}</span> },
    {
      id: 'status',
      label: t('status'),
      width: 102,
      minWidth: 96,
      header: t('status'),
      sortValue: (row) => row.status,
      cell: (row) => (
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
            String(row.status || '').toLowerCase() === 'inactive'
              ? 'border-slate-200 bg-slate-100 text-slate-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {row.status}
        </span>
      )
    },
    { id: 'updatedAt', label: t('updated'), width: 154, minWidth: 144, header: t('updated'), sortValue: (row) => row.updatedAt, cell: (row) => <span className="text-sm text-slate-600">{formatDate(row.updatedAt)}</span> },
    {
      id: 'actions',
      label: t('actions'),
      width: 74,
      minWidth: 74,
      maxWidth: 74,
      pinnable: false,
      hideable: false,
      sortable: false,
      resizable: false,
      header: t('actions'),
      align: 'right',
      cell: (row) => (
        <RowActionsMenu
          ariaLabel={t('actions')}
          items={[
            {
              key: 'edit',
              label: t('edit'),
              onSelect: () => {
                setEditingCustomer(row);
                setCustomerForm({
                  customerCode: row.customerCode || '',
                  customerName: row.customerName || '',
                  contactPerson: row.contactPerson || '',
                  address: row.address || '',
                  email: row.email || '',
                  status: row.status || 'Active'
                });
                setShowEditCustomer(true);
              }
            },
            {
              key: 'delete',
              label: t('delete'),
              tone: 'danger',
              onSelect: async () => {
                if (!window.confirm(t('confirmDelete'))) return;
                setCustomerRowsState((prev) => prev.filter((item) => item.id !== row.id));
              }
            }
          ]}
        />
      )
    }
  ];

  const supplierColumns = [
    {
      id: 'select',
      label: t('selectAll'),
      lockedPosition: 'left',
      width: 44,
      minWidth: 44,
      maxWidth: 44,
      pinnable: false,
      hideable: false,
      sortable: false,
      resizable: false,
      header: (
        <div className="flex items-center justify-center">
          <input
            ref={supplierHeaderCheckboxRef}
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-slate-900"
            checked={allVisibleSuppliersSelected}
            onClick={(e) => e.stopPropagation()}
            onChange={() => {
              setSelectedSupplierIds((prev) => {
                const next = new Set(prev);
                if (allVisibleSuppliersSelected) {
                  visibleSupplierIds.forEach((id) => next.delete(id));
                } else {
                  visibleSupplierIds.forEach((id) => next.add(id));
                }
                return next;
              });
            }}
            aria-label={t('selectAll')}
          />
        </div>
      ),
      cell: (row) => (
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-slate-900"
            checked={selectedSupplierIds.has(row.id)}
            onClick={(e) => e.stopPropagation()}
            onChange={() => toggleSelectedSupplier(row.id)}
            aria-label={t('selectSupplier')}
          />
        </div>
      ),
      align: 'center',
      headerClassName: 'px-2',
      className: 'px-2'
    },
    { id: 'supplierCode', label: t('supplierCode'), width: 118, minWidth: 104, pinnable: true, header: t('supplierCode'), sortValue: (row) => row.supplierCode, cell: (row) => <span className="font-mono text-sm text-slate-700">{row.supplierCode}</span> },
    { id: 'supplierName', label: t('supplierName'), width: 190, minWidth: 160, header: t('supplierName'), sortValue: (row) => row.supplierName, cell: (row) => <span className="font-semibold text-slate-900">{row.supplierName}</span> },
    { id: 'contactPerson', label: t('contactPerson'), width: 164, minWidth: 144, header: t('contactPerson'), sortValue: (row) => row.contactPerson, cell: (row) => <span className="text-sm text-slate-700">{row.contactPerson}</span> },
    { id: 'address', label: t('address'), width: 240, minWidth: 180, header: t('address'), sortValue: (row) => row.address, cell: (row) => <span className="text-sm text-slate-700">{row.address || '-'}</span> },
    { id: 'email', label: t('email'), width: 206, minWidth: 176, header: t('email'), sortValue: (row) => row.email, cell: (row) => <span className="text-sm text-slate-700">{row.email || '-'}</span> },
    { id: 'phoneNumber', label: t('phoneNumber'), width: 142, minWidth: 126, header: t('phoneNumber'), sortValue: (row) => row.phoneNumber, cell: (row) => <span className="text-sm text-slate-700">{row.phoneNumber}</span> },
    {
      id: 'status',
      label: t('status'),
      width: 102,
      minWidth: 96,
      header: t('status'),
      sortValue: (row) => row.status,
      cell: (row) => (
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
            String(row.status || '').toLowerCase() === 'inactive'
              ? 'border-slate-200 bg-slate-100 text-slate-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {row.status}
        </span>
      )
    },
    { id: 'updatedAt', label: t('updated'), width: 154, minWidth: 144, header: t('updated'), sortValue: (row) => row.updatedAt, cell: (row) => <span className="text-sm text-slate-600">{formatDate(row.updatedAt)}</span> },
    {
      id: 'actions',
      label: t('actions'),
      width: 74,
      minWidth: 74,
      maxWidth: 74,
      pinnable: false,
      hideable: false,
      sortable: false,
      resizable: false,
      header: t('actions'),
      align: 'right',
      cell: (row) => (
        <RowActionsMenu
          ariaLabel={t('actions')}
          items={[
            {
              key: 'edit',
              label: t('edit'),
              onSelect: () => {
                setEditingSupplier(row);
                setSupplierForm({
                  supplierCode: row.supplierCode || '',
                  supplierName: row.supplierName || '',
                  contactPerson: row.contactPerson || '',
                  address: row.address || '',
                  email: row.email || '',
                  phoneNumber: row.phoneNumber || '',
                  status: row.status || 'Active'
                });
                setShowEditSupplier(true);
              }
            },
            {
              key: 'delete',
              label: t('delete'),
              tone: 'danger',
              onSelect: async () => {
                if (!window.confirm(t('confirmDelete'))) return;
                setSupplierRowsState((prev) => prev.filter((item) => item.id !== row.id));
              }
            }
          ]}
        />
      )
    }
  ];

  const sortedProducts = useMemo(
    () => sortRows(filteredProducts, productSort, productColumns),
    [filteredProducts, productSort, productColumns]
  );
  const sortedCategories = useMemo(
    () => sortRows(filteredCategories, categorySort, categoryColumns),
    [filteredCategories, categorySort, categoryColumns]
  );
  const sortedCustomers = useMemo(
    () => sortRows(filteredCustomers, customerSort, customerColumns),
    [filteredCustomers, customerSort, customerColumns]
  );
  const sortedSuppliers = useMemo(
    () => sortRows(filteredSuppliers, supplierSort, supplierColumns),
    [filteredSuppliers, supplierSort, supplierColumns]
  );

  const pagedProducts = useMemo(() => {
    const total = sortedProducts.length;
    const safeOffset = total === 0 ? 0 : Math.max(0, Math.min(productOffset, Math.max(0, total - 1)));
    return sortedProducts.slice(safeOffset, safeOffset + productLimit);
  }, [sortedProducts, productLimit, productOffset]);

  const pagedCategories = useMemo(() => {
    const total = sortedCategories.length;
    const safeOffset = total === 0 ? 0 : Math.max(0, Math.min(categoryOffset, Math.max(0, total - 1)));
    return sortedCategories.slice(safeOffset, safeOffset + categoryLimit);
  }, [sortedCategories, categoryLimit, categoryOffset]);

  const pagedCustomers = useMemo(() => {
    const total = sortedCustomers.length;
    const safeOffset = total === 0 ? 0 : Math.max(0, Math.min(customerOffset, Math.max(0, total - 1)));
    return sortedCustomers.slice(safeOffset, safeOffset + customerLimit);
  }, [sortedCustomers, customerLimit, customerOffset]);

  const pagedSuppliers = useMemo(() => {
    const total = sortedSuppliers.length;
    const safeOffset = total === 0 ? 0 : Math.max(0, Math.min(supplierOffset, Math.max(0, total - 1)));
    return sortedSuppliers.slice(safeOffset, safeOffset + supplierLimit);
  }, [sortedSuppliers, supplierLimit, supplierOffset]);

  return (
    <div className="space-y-4 p-4 sm:p-5 lg:p-6">
      <div className="mb-6 flex items-start justify-between gap-4 rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,var(--ac-bg-soft)_100%)] p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]" data-tour="records-header">
        <div>
          <h2 className="text-[1.5rem] font-semibold tracking-tight text-slate-950">{pageTitle}</h2>
        </div>
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
          onClick={handleRefreshActiveTab}
          aria-label={t('refresh')}
          title={t('refresh')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <path d="M21 3v6h-6" />
          </svg>
        </button>
      </div>

      <div className="mb-4 flex flex-col gap-4">
        <div className="inline-flex w-fit rounded-[20px] border border-slate-200 bg-white p-1.5 shadow-[0_12px_28px_rgba(15,23,42,0.04)]" data-tour="records-tabs">
          <TabButton active={activeTab === 'products'} onClick={() => setActiveTab('products')} data-tour="records-tab-products">
            {t('productsTab')}
          </TabButton>
          <TabButton active={activeTab === 'categories'} onClick={() => setActiveTab('categories')} data-tour="records-tab-categories">
            {t('categoriesTab')}
          </TabButton>
          <TabButton active={activeTab === 'customers'} onClick={() => setActiveTab('customers')}>
            {t('customersTab')}
          </TabButton>
          <TabButton active={activeTab === 'suppliers'} onClick={() => setActiveTab('suppliers')}>
            {t('suppliersTab')}
          </TabButton>
        </div>

        {activeTab === 'products' ? (
          <SubTabSection
            badge={t('productsTab')}
            title={t('productsTab')}
            hint={t('recordsSubtitle')}
            action={
              <button type="button" className="ac-btn ac-btn-primary px-3 py-2" data-tour="records-create-product" onClick={() => setShowCreate(true)}>
                {t('createProduct')}
              </button>
            }
          >
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
              <select value={productStatusFilter} onChange={(e) => setProductStatusFilter(e.target.value)} className="ac-input w-[170px] bg-white text-slate-800">
                <option value="all">{t('allStatuses')}</option>
                <option value="active">{t('active')}</option>
                <option value="inactive">{t('inactive')}</option>
              </select>
              <select value={productCategoryFilter} onChange={(e) => setProductCategoryFilter(e.target.value)} className="ac-input w-[260px] bg-white text-slate-800">
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
          </SubTabSection>
        ) : activeTab === 'categories' ? (
          <SubTabSection
            badge={t('categoriesTab')}
            title={t('categoriesTab')}
            hint={t('recordsSubtitle')}
            action={
              <button type="button" className="ac-btn ac-btn-primary px-3 py-2" data-tour="records-add-category" onClick={() => setShowCreateCategory(true)}>
                {t('addCategory')}
              </button>
            }
          >
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
              <select value={categoryStatusFilter} onChange={(e) => setCategoryStatusFilter(e.target.value)} className="ac-input w-[170px] bg-white text-slate-800">
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
          </SubTabSection>
        ) : (
          <SubTabSection
            badge={activeTab === 'customers' ? t('customersTab') : t('suppliersTab')}
            title={activeTab === 'customers' ? t('customersTab') : t('suppliersTab')}
            hint={activeTab === 'customers' ? t('customerRecordsHint') : t('supplierRecordsHint')}
            action={
              <button
                type="button"
                className="ac-btn ac-btn-primary px-3 py-2"
                onClick={() => {
                  if (activeTab === 'customers') setShowCreateCustomer(true);
                  else setShowCreateSupplier(true);
                }}
              >
                {activeTab === 'customers' ? t('addCustomer') : t('addSupplier')}
              </button>
            }
          >
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-[240px] flex-1">
                <input
                  value={activeTab === 'customers' ? customerQuery : supplierQuery}
                  onChange={(e) => {
                    if (activeTab === 'customers') setCustomerQuery(e.target.value);
                    else setSupplierQuery(e.target.value);
                  }}
                  placeholder={activeTab === 'customers' ? t('searchCustomers') : t('searchSuppliers')}
                  className="ac-input"
                />
              </div>
              <select
                value={activeTab === 'customers' ? customerStatusFilter : supplierStatusFilter}
                onChange={(e) => {
                  if (activeTab === 'customers') setCustomerStatusFilter(e.target.value);
                  else setSupplierStatusFilter(e.target.value);
                }}
                className="ac-input w-[170px] bg-white text-slate-800"
              >
                <option value="all">{t('allStatuses')}</option>
                <option value="active">{t('active')}</option>
                <option value="inactive">{t('inactive')}</option>
              </select>
              <button
                type="button"
                className="ac-btn ac-btn-soft px-3 py-2"
                onClick={() => {
                  if (activeTab === 'customers') {
                    setCustomerQuery('');
                    setCustomerStatusFilter('all');
                  } else {
                    setSupplierQuery('');
                    setSupplierStatusFilter('all');
                  }
                }}
              >
                {t('clearFilters')}
              </button>
            </div>
          </SubTabSection>
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
        <div data-tour="records-products-table">
          <DataTable
            rows={pagedProducts}
            rowKey={(p) => p.id}
            sortState={productSort}
            onSortChange={setProductSort}
            density="compact"
            loading={loading}
            loadingContent={t('loading')}
            emptyContent={
              <div>
                <div className="text-sm font-semibold text-zinc-900">{t('noProducts')}</div>
                <div className="mt-1 text-sm text-zinc-600">{t('noProductsHint')}</div>
              </div>
            }
            top={
              <div className="space-y-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{t('listOfProducts')}</div>
                </div>
                {selectedCount ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-slate-200 bg-slate-50/80 px-3 py-3">
                    <div className="text-sm font-semibold text-slate-900">{t('selectedProducts', { value: selectedCount })}</div>
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
                ) : null}
              </div>
            }
            bottom={
              <TablePager
                offset={productOffset}
                limit={productLimit}
                total={filteredProducts.length}
                loading={loading}
                onOffsetChange={(next) => setProductOffset(next)}
                onLimitChange={(next) => {
                  setProductLimit(next);
                  setProductOffset(0);
                }}
              />
            }
            columns={productColumns}
            columnTools={{
              enabled: true,
              storageKey: scopedColumnKey('ac_master_data_products_v2'),
              initialPinnedIds: ['select', 'sku'],
              defaultColumnWidth: 112
            }}
          />
        </div>
      ) : activeTab === 'categories' ? (
        <div data-tour="records-categories-table">
          <DataTable
            rows={pagedCategories}
            rowKey={(c) => c.id}
            sortState={categorySort}
            onSortChange={setCategorySort}
            density="compact"
            loading={loading}
            loadingContent={t('loading')}
            emptyContent={
              <div>
                <div className="text-sm font-semibold text-zinc-900">{t('noCategories')}</div>
                <div className="mt-1 text-sm text-zinc-600">{t('noCategoriesHint')}</div>
              </div>
            }
            top={
              <div className="space-y-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{t('listOfCategories')}</div>
                </div>
                {selectedCategoryIds.size ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-slate-200 bg-slate-50/80 px-3 py-3">
                    <div className="text-sm font-semibold text-slate-900">{t('selectedProducts', { value: selectedCategoryIds.size })}</div>
                    <button type="button" className="ac-btn ac-btn-soft px-3 py-2" onClick={() => setSelectedCategoryIds(new Set())}>
                      {t('clearSelection')}
                    </button>
                  </div>
                ) : null}
              </div>
            }
            bottom={
              <TablePager
                offset={categoryOffset}
                limit={categoryLimit}
                total={filteredCategories.length}
                loading={loading}
                onOffsetChange={(next) => setCategoryOffset(next)}
                onLimitChange={(next) => {
                  setCategoryLimit(next);
                  setCategoryOffset(0);
                }}
              />
            }
            columns={categoryColumns}
            columnTools={{
              enabled: true,
              storageKey: scopedColumnKey('ac_master_data_categories_v2'),
              initialPinnedIds: ['select', 'name'],
              defaultColumnWidth: 108
            }}
          />
        </div>
      ) : (
        <div data-tour={activeTab === 'customers' ? 'records-customers-table' : 'records-suppliers-table'}>
          <DataTable
            rows={activeTab === 'customers' ? pagedCustomers : pagedSuppliers}
            rowKey={(row) => row.id}
            sortState={activeTab === 'customers' ? customerSort : supplierSort}
            onSortChange={activeTab === 'customers' ? setCustomerSort : setSupplierSort}
            density="compact"
            loading={false}
            loadingContent={t('loading')}
            emptyContent={
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  {activeTab === 'customers' ? t('customerEmptyTitle') : t('supplierEmptyTitle')}
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  {activeTab === 'customers' ? t('customerEmptyHint') : t('supplierEmptyHint')}
                </div>
              </div>
            }
            top={
              <div className="space-y-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {activeTab === 'customers' ? t('listOfCustomers') : t('listOfSuppliers')}
                  </div>
                </div>
                {(activeTab === 'customers' ? selectedCustomerIds.size : selectedSupplierIds.size) ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-slate-200 bg-slate-50/80 px-3 py-3">
                    <div className="text-sm font-semibold text-slate-900">
                      {t('selectedProducts', { value: activeTab === 'customers' ? selectedCustomerIds.size : selectedSupplierIds.size })}
                    </div>
                    <button
                      type="button"
                      className="ac-btn ac-btn-soft px-3 py-2"
                      onClick={() => {
                        if (activeTab === 'customers') setSelectedCustomerIds(new Set());
                        else setSelectedSupplierIds(new Set());
                      }}
                    >
                      {t('clearSelection')}
                    </button>
                  </div>
                ) : null}
              </div>
            }
            bottom={
              <TablePager
                offset={activeTab === 'customers' ? customerOffset : supplierOffset}
                limit={activeTab === 'customers' ? customerLimit : supplierLimit}
                total={activeTab === 'customers' ? filteredCustomers.length : filteredSuppliers.length}
                loading={false}
                onOffsetChange={(next) => {
                  if (activeTab === 'customers') setCustomerOffset(next);
                  else setSupplierOffset(next);
                }}
                onLimitChange={(next) => {
                  if (activeTab === 'customers') {
                    setCustomerLimit(next);
                    setCustomerOffset(0);
                  } else {
                    setSupplierLimit(next);
                    setSupplierOffset(0);
                  }
                }}
              />
            }
            columns={activeTab === 'customers' ? customerColumns : supplierColumns}
            columnTools={{
              enabled: true,
              storageKey: scopedColumnKey(activeTab === 'customers' ? 'ac_master_data_customers_v2' : 'ac_master_data_suppliers_v2'),
              initialPinnedIds: activeTab === 'customers' ? ['select', 'customerCode'] : ['select', 'supplierCode'],
              defaultColumnWidth: 110
            }}
          />
        </div>
      )}

      {showCreate ? (
        <div className="ac-modal-backdrop">
          <div className="ac-modal max-w-4xl" data-tour="records-product-modal">
            <div className="mb-4 text-sm font-semibold text-zinc-900">{t('createProduct')}</div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('customersTab')}</div>
                <select value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)} className="ac-input">
                  <option value="">{t('selectCustomer')}</option>
                  {(Array.isArray(customerRowsState) ? customerRowsState : []).map((row) => (
                    <option key={row.id} value={String(row.id)}>
                      {row.customerName} ({row.customerCode})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('suppliersTab')}</div>
                <select value={selectedSupplierId} onChange={(e) => setSelectedSupplierId(e.target.value)} className="ac-input">
                  <option value="">{t('selectSupplier')}</option>
                  {(Array.isArray(supplierRowsState) ? supplierRowsState : []).map((row) => (
                    <option key={row.id} value={String(row.id)}>
                      {row.supplierName} ({row.supplierCode})
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
              <div className="md:col-span-2">
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('remark')}</div>
                <textarea value={remark} onChange={(e) => setRemark(e.target.value)} className="ac-input h-24 resize-none" data-tour="records-product-remark" />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('landingPageDesign')}</div>
                {cmsDesignsLoading ? (
                  <div className="ac-input text-xs text-zinc-400">Loading…</div>
                ) : (cmsDesigns?.length || 0) === 0 ? (
                  <div className="ac-input text-xs text-zinc-400">{t('noLandingPages')}</div>
                ) : (
                  <select
                    value={selectedCmsDesignId}
                    onChange={(e) => setSelectedCmsDesignId(e.target.value)}
                    className="ac-input"
                    data-tour="records-product-cms-page"
                  >
                    <option value="">{t('useDefaultLandingPage')}</option>
                    {cmsDesigns
                      .slice()
                      .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')))
                      .map((des) => {
                        const did = String(des?.id ?? '');
                        if (!did) return null;
                        const label = String(des?.name || '').trim() || `Design #${did}`;
                        const slug = String(des?.slug || '').trim();
                        const kindLabel = String(des?.kind || '').trim();
                        return (
                          <option key={did} value={did}>
                            {kindLabel && kindLabel !== 'landing' ? `[${kindLabel}] ` : ''}
                            {label}
                            {slug ? ` (${slug})` : ''}
                            {des.published ? ' · published' : ' · draft'}
                          </option>
                        );
                      })}
                  </select>
                )}
                <div className="mt-1 text-[11px] text-zinc-500">{t('selectLandingPage')}</div>
              </div>
              <div className="md:col-span-2">
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('certificatePageDesign')}</div>
                {cmsDesignsLoading ? (
                  <div className="ac-input text-xs text-zinc-400">Loading…</div>
                ) : (cmsDesigns?.length || 0) === 0 ? (
                  <div className="ac-input text-xs text-zinc-400">{t('noLandingPages')}</div>
                ) : (
                  <select
                    value={selectedCmsCertificateDesignId}
                    onChange={(e) => setSelectedCmsCertificateDesignId(e.target.value)}
                    className="ac-input"
                  >
                    <option value="">{t('useProductLandingDesign')}</option>
                    {cmsDesigns
                      .slice()
                      .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')))
                      .map((des) => {
                        const did = String(des?.id ?? '');
                        if (!did) return null;
                        const label = String(des?.name || '').trim() || `Design #${did}`;
                        const slug = String(des?.slug || '').trim();
                        const kindLabel = String(des?.kind || '').trim();
                        return (
                          <option key={did} value={did}>
                            {kindLabel && kindLabel !== 'landing' ? `[${kindLabel}] ` : ''}
                            {label}
                            {slug ? ` (${slug})` : ''}
                            {des.published ? ' · published' : ' · draft'}
                          </option>
                        );
                      })}
                  </select>
                )}
                <div className="mt-1 text-[11px] text-zinc-500">{t('certDesignOverrideHint')}</div>
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
                  setSelectedCustomerId('');
                  setSelectedSupplierId('');
                  setStatus('active');
                  setRemark('');
                  setSelectedCmsDesignId('');
                  setSelectedCmsCertificateDesignId('');
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
                  const designIdRaw = String(selectedCmsDesignId || '').trim();
                  const certDesignIdRaw = String(selectedCmsCertificateDesignId || '').trim();
                  const cmsDesignId = designIdRaw ? Number(designIdRaw) : null;
                  const cmsCertificateDesignId = certDesignIdRaw ? Number(certDesignIdRaw) : null;
                  try {
                    await createProduct({
                      sku: trimmedSku,
                      name: trimmedName,
                      product_code: trimmedProductCode,
                      category: trimmedCategory,
                      customerId: String(selectedCustomerId || '').trim() ? Number(selectedCustomerId) : undefined,
                      supplierId: String(selectedSupplierId || '').trim() ? Number(selectedSupplierId) : undefined,
                      status: trimmedStatus,
                      remark: String(remark || '').trim() || undefined,
                      cmsDesignId: cmsDesignId ?? undefined,
                      cmsCertificateDesignId: cmsCertificateDesignId ?? undefined
                    });
                    setShowCreate(false);
                    setSku('');
                    setName('');
                    setProductCode('');
                    setCategory('');
                    setSelectedCustomerId('');
                    setSelectedSupplierId('');
                    setStatus('active');
                    setRemark('');
                    setSelectedCmsDesignId('');
                    setSelectedCmsCertificateDesignId('');
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
          <div className="ac-modal max-w-4xl">
            <div className="mb-4 text-sm font-semibold text-zinc-900">{t('editProduct')}</div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('customersTab')}</div>
                <select value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)} className="ac-input">
                  <option value="">{t('selectCustomer')}</option>
                  {(Array.isArray(customerRowsState) ? customerRowsState : []).map((row) => (
                    <option key={row.id} value={String(row.id)}>
                      {row.customerName} ({row.customerCode})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('suppliersTab')}</div>
                <select value={selectedSupplierId} onChange={(e) => setSelectedSupplierId(e.target.value)} className="ac-input">
                  <option value="">{t('selectSupplier')}</option>
                  {(Array.isArray(supplierRowsState) ? supplierRowsState : []).map((row) => (
                    <option key={row.id} value={String(row.id)}>
                      {row.supplierName} ({row.supplierCode})
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
              <div className="md:col-span-2">
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('remark')}</div>
                <textarea value={remark} onChange={(e) => setRemark(e.target.value)} className="ac-input h-24 resize-none" />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('landingPageDesign')}</div>
                {cmsDesignsLoading ? (
                  <div className="ac-input text-xs text-zinc-400">Loading…</div>
                ) : (cmsDesigns?.length || 0) === 0 ? (
                  <div className="ac-input text-xs text-zinc-400">{t('noLandingPages')}</div>
                ) : (
                  <select
                    value={selectedCmsDesignId}
                    onChange={(e) => setSelectedCmsDesignId(e.target.value)}
                    className="ac-input"
                  >
                    <option value="">{t('useDefaultLandingPage')}</option>
                    {cmsDesigns
                      .slice()
                      .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')))
                      .map((des) => {
                        const did = String(des?.id ?? '');
                        if (!did) return null;
                        const label = String(des?.name || '').trim() || `Design #${did}`;
                        const slug = String(des?.slug || '').trim();
                        const kindLabel = String(des?.kind || '').trim();
                        return (
                          <option key={did} value={did}>
                            {kindLabel && kindLabel !== 'landing' ? `[${kindLabel}] ` : ''}
                            {label}
                            {slug ? ` (${slug})` : ''}
                            {des.published ? ' · published' : ' · draft'}
                          </option>
                        );
                      })}
                  </select>
                )}
                <div className="mt-1 text-[11px] text-zinc-500">{t('selectLandingPage')}</div>
              </div>
              <div className="md:col-span-2">
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('certificatePageDesign')}</div>
                {cmsDesignsLoading ? (
                  <div className="ac-input text-xs text-zinc-400">Loading…</div>
                ) : (cmsDesigns?.length || 0) === 0 ? (
                  <div className="ac-input text-xs text-zinc-400">{t('noLandingPages')}</div>
                ) : (
                  <select
                    value={selectedCmsCertificateDesignId}
                    onChange={(e) => setSelectedCmsCertificateDesignId(e.target.value)}
                    className="ac-input"
                  >
                    <option value="">{t('useProductLandingDesign')}</option>
                    {cmsDesigns
                      .slice()
                      .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')))
                      .map((des) => {
                        const did = String(des?.id ?? '');
                        if (!did) return null;
                        const label = String(des?.name || '').trim() || `Design #${did}`;
                        const slug = String(des?.slug || '').trim();
                        const kindLabel = String(des?.kind || '').trim();
                        return (
                          <option key={did} value={did}>
                            {kindLabel && kindLabel !== 'landing' ? `[${kindLabel}] ` : ''}
                            {label}
                            {slug ? ` (${slug})` : ''}
                            {des.published ? ' · published' : ' · draft'}
                          </option>
                        );
                      })}
                  </select>
                )}
                <div className="mt-1 text-[11px] text-zinc-500">{t('certDesignOverrideHint')}</div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                onClick={() => {
                  setShowEdit(false);
                  setEditing(null);
                  setSelectedCustomerId('');
                  setSelectedSupplierId('');
                  setSelectedCmsDesignId('');
                  setSelectedCmsCertificateDesignId('');
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
                  const designIdRaw = String(selectedCmsDesignId || '').trim();
                  const certDesignIdRaw = String(selectedCmsCertificateDesignId || '').trim();
                  const cmsDesignId = designIdRaw ? Number(designIdRaw) : null;
                  const cmsCertificateDesignId = certDesignIdRaw ? Number(certDesignIdRaw) : null;
                  await updateProduct({
                    id: editing.id,
                    patch: {
                      sku: String(sku || '').trim(),
                      name: String(name || '').trim(),
                      product_code: String(productCode || '').trim(),
                      category: String(category || '').trim(),
                      customerId: String(selectedCustomerId || '').trim() ? Number(selectedCustomerId) : null,
                      supplierId: String(selectedSupplierId || '').trim() ? Number(selectedSupplierId) : null,
                      status: String(status || '').trim() || 'active',
                      remark: String(remark || '').trim() || null,
                      cmsDesignId,
                      cmsCertificateDesignId
                    }
                  });
                  setShowEdit(false);
                  setEditing(null);
                  setSelectedCustomerId('');
                  setSelectedSupplierId('');
                  setSelectedCmsDesignId('');
                  setSelectedCmsCertificateDesignId('');
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

      {showCreateCustomer ? (
        <div className="ac-modal-backdrop">
          <div className="ac-modal max-w-3xl">
            <div className="mb-4 text-sm font-semibold text-zinc-900">{t('createCustomer')}</div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('customerCode')}</div>
                <input
                  value={customerForm.customerCode}
                  onChange={(e) => setCustomerForm((prev) => ({ ...prev, customerCode: e.target.value }))}
                  className="ac-input font-mono"
                />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('customerName')}</div>
                <input
                  value={customerForm.customerName}
                  onChange={(e) => setCustomerForm((prev) => ({ ...prev, customerName: e.target.value }))}
                  className="ac-input"
                />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('contactPerson')}</div>
                <input
                  value={customerForm.contactPerson}
                  onChange={(e) => setCustomerForm((prev) => ({ ...prev, contactPerson: e.target.value }))}
                  className="ac-input"
                />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('email')}</div>
                <input
                  value={customerForm.email}
                  onChange={(e) => setCustomerForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="ac-input"
                />
              </div>
              <div className="md:col-span-2">
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('address')}</div>
                <textarea
                  value={customerForm.address}
                  onChange={(e) => setCustomerForm((prev) => ({ ...prev, address: e.target.value }))}
                  className="ac-input min-h-[96px] resize-y"
                  rows={3}
                />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('status')}</div>
                <select
                  value={customerForm.status}
                  onChange={(e) => setCustomerForm((prev) => ({ ...prev, status: e.target.value }))}
                  className="ac-input"
                >
                  <option value="Active">{t('active')}</option>
                  <option value="Inactive">{t('inactive')}</option>
                </select>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                onClick={() => {
                  setShowCreateCustomer(false);
                  resetCustomerForm();
                }}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                className="ac-btn ac-btn-primary px-3 py-2 text-xs"
                onClick={async () => {
                  const payload = {
                    customerCode: String(customerForm.customerCode || '').trim(),
                    customerName: String(customerForm.customerName || '').trim(),
                    contactPerson: String(customerForm.contactPerson || '').trim(),
                    address: String(customerForm.address || '').trim(),
                    email: String(customerForm.email || '').trim(),
                    status: String(customerForm.status || 'Active').trim() || 'Active'
                  };
                  if (!payload.customerCode || !payload.customerName) return;
                  try {
                    await createCustomer(payload);
                    void fetchCustomers();
                    setShowCreateCustomer(false);
                    resetCustomerForm();
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

      {showEditCustomer ? (
        <div className="ac-modal-backdrop">
          <div className="ac-modal max-w-3xl">
            <div className="mb-4 text-sm font-semibold text-zinc-900">{t('editCustomer')}</div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('customerCode')}</div>
                <input
                  value={customerForm.customerCode}
                  onChange={(e) => setCustomerForm((prev) => ({ ...prev, customerCode: e.target.value }))}
                  className="ac-input font-mono"
                />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('customerName')}</div>
                <input
                  value={customerForm.customerName}
                  onChange={(e) => setCustomerForm((prev) => ({ ...prev, customerName: e.target.value }))}
                  className="ac-input"
                />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('contactPerson')}</div>
                <input
                  value={customerForm.contactPerson}
                  onChange={(e) => setCustomerForm((prev) => ({ ...prev, contactPerson: e.target.value }))}
                  className="ac-input"
                />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('email')}</div>
                <input
                  value={customerForm.email}
                  onChange={(e) => setCustomerForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="ac-input"
                />
              </div>
              <div className="md:col-span-2">
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('address')}</div>
                <textarea
                  value={customerForm.address}
                  onChange={(e) => setCustomerForm((prev) => ({ ...prev, address: e.target.value }))}
                  className="ac-input min-h-[96px] resize-y"
                  rows={3}
                />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('status')}</div>
                <select
                  value={customerForm.status}
                  onChange={(e) => setCustomerForm((prev) => ({ ...prev, status: e.target.value }))}
                  className="ac-input"
                >
                  <option value="Active">{t('active')}</option>
                  <option value="Inactive">{t('inactive')}</option>
                </select>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                onClick={() => {
                  setShowEditCustomer(false);
                  setEditingCustomer(null);
                  resetCustomerForm();
                }}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                className="ac-btn ac-btn-primary px-3 py-2 text-xs"
                disabled={!editingCustomer?.id}
                onClick={async () => {
                  if (!editingCustomer?.id) return;
                  const payload = {
                    customerCode: String(customerForm.customerCode || '').trim(),
                    customerName: String(customerForm.customerName || '').trim(),
                    contactPerson: String(customerForm.contactPerson || '').trim(),
                    address: String(customerForm.address || '').trim(),
                    email: String(customerForm.email || '').trim(),
                    status: String(customerForm.status || 'Active').trim() || 'Active'
                  };
                  if (!payload.customerCode || !payload.customerName) return;
                  try {
                    await updateCustomer({ id: editingCustomer.id, patch: payload });
                    void fetchCustomers();
                    setShowEditCustomer(false);
                    setEditingCustomer(null);
                    resetCustomerForm();
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

      {showCreateSupplier ? (
        <div className="ac-modal-backdrop">
          <div className="ac-modal max-w-3xl">
            <div className="mb-4 text-sm font-semibold text-zinc-900">{t('createSupplier')}</div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('supplierCode')}</div>
                <input
                  value={supplierForm.supplierCode}
                  onChange={(e) => setSupplierForm((prev) => ({ ...prev, supplierCode: e.target.value }))}
                  className="ac-input font-mono"
                />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('supplierName')}</div>
                <input
                  value={supplierForm.supplierName}
                  onChange={(e) => setSupplierForm((prev) => ({ ...prev, supplierName: e.target.value }))}
                  className="ac-input"
                />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('contactPerson')}</div>
                <input
                  value={supplierForm.contactPerson}
                  onChange={(e) => setSupplierForm((prev) => ({ ...prev, contactPerson: e.target.value }))}
                  className="ac-input"
                />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('email')}</div>
                <input
                  value={supplierForm.email}
                  onChange={(e) => setSupplierForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="ac-input"
                />
              </div>
              <div className="md:col-span-2">
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('address')}</div>
                <textarea
                  value={supplierForm.address}
                  onChange={(e) => setSupplierForm((prev) => ({ ...prev, address: e.target.value }))}
                  className="ac-input min-h-[96px] resize-y"
                  rows={3}
                />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('phoneNumber')}</div>
                <input
                  value={supplierForm.phoneNumber}
                  onChange={(e) => setSupplierForm((prev) => ({ ...prev, phoneNumber: e.target.value }))}
                  className="ac-input"
                />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('status')}</div>
                <select
                  value={supplierForm.status}
                  onChange={(e) => setSupplierForm((prev) => ({ ...prev, status: e.target.value }))}
                  className="ac-input"
                >
                  <option value="Active">{t('active')}</option>
                  <option value="Inactive">{t('inactive')}</option>
                </select>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                onClick={() => {
                  setShowCreateSupplier(false);
                  resetSupplierForm();
                }}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                className="ac-btn ac-btn-primary px-3 py-2 text-xs"
                onClick={async () => {
                  const payload = {
                    supplierCode: String(supplierForm.supplierCode || '').trim(),
                    supplierName: String(supplierForm.supplierName || '').trim(),
                    contactPerson: String(supplierForm.contactPerson || '').trim(),
                    address: String(supplierForm.address || '').trim(),
                    email: String(supplierForm.email || '').trim(),
                    phoneNumber: String(supplierForm.phoneNumber || '').trim(),
                    status: String(supplierForm.status || 'Active').trim() || 'Active'
                  };
                  if (!payload.supplierCode || !payload.supplierName) return;
                  try {
                    await createSupplier(payload);
                    void fetchSuppliers();
                    setShowCreateSupplier(false);
                    resetSupplierForm();
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

      {showEditSupplier ? (
        <div className="ac-modal-backdrop">
          <div className="ac-modal max-w-3xl">
            <div className="mb-4 text-sm font-semibold text-zinc-900">{t('editSupplier')}</div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('supplierCode')}</div>
                <input
                  value={supplierForm.supplierCode}
                  onChange={(e) => setSupplierForm((prev) => ({ ...prev, supplierCode: e.target.value }))}
                  className="ac-input font-mono"
                />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('supplierName')}</div>
                <input
                  value={supplierForm.supplierName}
                  onChange={(e) => setSupplierForm((prev) => ({ ...prev, supplierName: e.target.value }))}
                  className="ac-input"
                />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('contactPerson')}</div>
                <input
                  value={supplierForm.contactPerson}
                  onChange={(e) => setSupplierForm((prev) => ({ ...prev, contactPerson: e.target.value }))}
                  className="ac-input"
                />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('email')}</div>
                <input
                  value={supplierForm.email}
                  onChange={(e) => setSupplierForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="ac-input"
                />
              </div>
              <div className="md:col-span-2">
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('address')}</div>
                <textarea
                  value={supplierForm.address}
                  onChange={(e) => setSupplierForm((prev) => ({ ...prev, address: e.target.value }))}
                  className="ac-input min-h-[96px] resize-y"
                  rows={3}
                />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('phoneNumber')}</div>
                <input
                  value={supplierForm.phoneNumber}
                  onChange={(e) => setSupplierForm((prev) => ({ ...prev, phoneNumber: e.target.value }))}
                  className="ac-input"
                />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('status')}</div>
                <select
                  value={supplierForm.status}
                  onChange={(e) => setSupplierForm((prev) => ({ ...prev, status: e.target.value }))}
                  className="ac-input"
                >
                  <option value="Active">{t('active')}</option>
                  <option value="Inactive">{t('inactive')}</option>
                </select>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                onClick={() => {
                  setShowEditSupplier(false);
                  setEditingSupplier(null);
                  resetSupplierForm();
                }}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                className="ac-btn ac-btn-primary px-3 py-2 text-xs"
                disabled={!editingSupplier?.id}
                onClick={async () => {
                  if (!editingSupplier?.id) return;
                  const payload = {
                    supplierCode: String(supplierForm.supplierCode || '').trim(),
                    supplierName: String(supplierForm.supplierName || '').trim(),
                    contactPerson: String(supplierForm.contactPerson || '').trim(),
                    address: String(supplierForm.address || '').trim(),
                    email: String(supplierForm.email || '').trim(),
                    phoneNumber: String(supplierForm.phoneNumber || '').trim(),
                    status: String(supplierForm.status || 'Active').trim() || 'Active'
                  };
                  if (!payload.supplierCode || !payload.supplierName) return;
                  try {
                    await updateSupplier({ id: editingSupplier.id, patch: payload });
                    void fetchSuppliers();
                    setShowEditSupplier(false);
                    setEditingSupplier(null);
                    resetSupplierForm();
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
