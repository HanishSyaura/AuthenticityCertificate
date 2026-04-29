import React, { useEffect, useState } from 'react';
import useRecordsStore from '../../store/useRecordsStore';
import useEpcStore from '../../store/useEpcStore';
import { useT } from '../../i18n/useT';
import EpcGeneratePanel from '../../components/admin/epc/EpcGeneratePanel';
import EpcBatchesPanel from '../../components/admin/epc/EpcBatchesPanel';
import EpcItemsPanel from '../../components/admin/epc/EpcItemsPanel';
import EpcBulkPanel from '../../components/admin/epc/EpcBulkPanel';

function formatDate(input) {
  if (!input) return '';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

export default function AdminEpc() {
  const { t } = useT();

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

  const [tab, setTab] = useState('batches');
  const [corpPrefix, setCorpPrefix] = useState('');
  const [productId, setProductId] = useState('');
  const [batchName, setBatchName] = useState('');
  const [batchQty, setBatchQty] = useState(1);
  const [remark, setRemark] = useState('');
  const [batchQuery, setBatchQuery] = useState('');
  const [itemQuery, setItemQuery] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');

  useEffect(() => {
    void fetchProducts();
    void fetchCorpCodes();
    void fetchBatches({ limit: 50, offset: 0 });
    void fetchItems({ limit: 50, offset: 0 });
  }, [fetchProducts, fetchCorpCodes, fetchBatches, fetchItems]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">{t('epc')}</h2>
          <p className="mt-1 text-sm text-zinc-600">{t('epcSubtitle')}</p>
        </div>
        <button
          type="button"
          className="ac-btn ac-btn-soft px-3 py-2 text-xs"
          onClick={() => {
            void fetchBatches({ q: batchQuery || undefined, limit: 50, offset: 0 });
            void fetchItems({ q: itemQuery || undefined, batchId: selectedBatchId ? Number(selectedBatchId) : undefined, limit: 50, offset: 0 });
          }}
        >
          {t('refresh')}
        </button>
      </div>

      {error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
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
            setSelectedBatchId('');
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
            await fetchBatches({ limit: 50, offset: 0 });
            if (newBatchId) {
              setSelectedBatchId(String(newBatchId));
              await fetchItems({ batchId: newBatchId, limit: 50, offset: 0 });
              setTab('items');
            } else {
              await fetchItems({ limit: 50, offset: 0 });
            }
          }}
        />

        <div className="ac-card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={`ac-btn px-3 py-2 text-xs ${tab === 'batches' ? 'ac-btn-primary' : 'ac-btn-soft'}`}
                onClick={() => setTab('batches')}
              >
                {t('epcBatches')}
              </button>
              <button
                type="button"
                className={`ac-btn px-3 py-2 text-xs ${tab === 'items' ? 'ac-btn-primary' : 'ac-btn-soft'}`}
                onClick={() => setTab('items')}
              >
                {t('epcItems')}
              </button>
              <button
                type="button"
                className={`ac-btn px-3 py-2 text-xs ${tab === 'bulk' ? 'ac-btn-primary' : 'ac-btn-soft'}`}
                onClick={() => setTab('bulk')}
              >
                {t('bulk')}
              </button>
            </div>
          </div>

          {tab === 'batches' ? (
            <EpcBatchesPanel
              t={t}
              batches={batches}
              batchTotal={batchTotal}
              loading={loading}
              batchQuery={batchQuery}
              setBatchQuery={setBatchQuery}
              formatDate={formatDate}
              onSearch={() => void fetchBatches({ q: batchQuery || undefined, limit: 50, offset: 0 })}
              onViewEpc={async (id) => {
                setSelectedBatchId(String(id));
                setTab('items');
                await fetchItems({ batchId: id, limit: 50, offset: 0 });
              }}
              onExport={(id) => void exportBatchXlsx(id)}
            />
          ) : tab === 'items' ? (
            <EpcItemsPanel
              t={t}
              items={items}
              itemTotal={itemTotal}
              loading={loading}
              itemQuery={itemQuery}
              setItemQuery={setItemQuery}
              selectedBatchId={selectedBatchId}
              setSelectedBatchId={setSelectedBatchId}
              batches={batches}
              formatDate={formatDate}
              onSearch={() =>
                void fetchItems({
                  q: itemQuery || undefined,
                  batchId: selectedBatchId ? Number(selectedBatchId) : undefined,
                  limit: 50,
                  offset: 0
                })
              }
            />
          ) : (
            <EpcBulkPanel t={t} />
          )}
        </div>
      </div>
    </div>
  );
}
