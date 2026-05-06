import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import PublicRenderer from '../components/PublicRenderer';
import { useT } from '../i18n/useT';
import { getPublicApiBaseUrl } from '../utils/apiBase';
import { ADMIN_KEYS } from '../utils/adminKeys';
import { readJson } from '../utils/storage';
import { createAdminApi } from '../utils/adminApi';

function sampleCertificateLayout() {
  return [
    { id: 't1', type: 'text', x: 24, y: 24, w: 342, h: 40, content: { text: 'CERTIFICATE' } },
    { id: 't2', type: 'text', x: 24, y: 72, w: 342, h: 52, content: { text: 'Sample preview.\nAppend ?certId=CERT... (or BN-...) or ?epc=... to the URL to load real data.' } },
    { id: 'img1', type: 'image', x: 24, y: 150, w: 342, h: 220, content: { url: '' } },
    { id: 't3', type: 'text', x: 24, y: 388, w: 342, h: 120, content: { text: 'Certificate ID: CERTIFICATE_ID\nProduct: PRODUCT_NAME\nBatch: BATCH_NO' } }
  ];
}

function sampleCert(id = 'CERTIFICATE_ID') {
  return {
    certificateId: id,
    type: 'unit',
    status: 'VALID',
    issuedAt: new Date().toISOString(),
    product: { name: 'PRODUCT_NAME', code: 'PRODUCT_CODE' },
    batch: { batchNo: 'BATCH_NO' },
    certificateLayout: sampleCertificateLayout(),
    certificateTemplate: { canvasWidth: 390, canvasHeight: 844 }
  };
}

export default function CmsPreviewPage() {
  const location = useLocation();
  const { lang } = useT();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [targetW, setTargetW] = useState(null);

  const baseW = 390;
  const baseH = 844;
  const scale = useMemo(() => {
    const w = Number(targetW || 0);
    if (!Number.isFinite(w) || w <= 0) return 1;
    return Math.max(0.1, Math.min(1, w / baseW));
  }, [baseW, targetW]);

  const storedLayout = useMemo(() => {
    try {
      const raw = localStorage.getItem('ac_cms_preview');
      const parsed = raw ? JSON.parse(raw) : null;
      const layout = parsed?.layout;
      return Array.isArray(layout) ? layout : null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const measure = () => {
      const docW = Number(document.documentElement?.clientWidth || 0);
      const winW = Number(window.innerWidth || 0);
      const w = Math.min(...[docW, winW].filter((n) => Number.isFinite(n) && n > 0));
      const padded = Number.isFinite(w) && w > 0 ? Math.max(0, w - 32) : null;
      setTargetW(padded && padded > 0 ? padded : null);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    const sp = new URLSearchParams(location.search || '');
    const certId = sp.get('certId');
    const epc = sp.get('epc');
    const nfcUid = sp.get('nfcUid');
    if (!certId && !epc && !nfcUid) {
      let alive = true;
      setLoading(true);
      setError(null);
      const run = async () => {
        try {
          const token = readJson(ADMIN_KEYS.token, null);
          if (!token) {
            if (!alive) return;
            setData(sampleCert());
            return;
          }
          const api = createAdminApi({ token });
          const res = await api.get('/epc/items', { params: { limit: 1, offset: 0 } });
          const latestEpc = res?.data?.data?.items?.[0]?.epcCode ? String(res.data.data.items[0].epcCode) : '';
          if (!latestEpc) {
            if (!alive) return;
            setData(sampleCert());
            return;
          }
          const base = getPublicApiBaseUrl();
          const url = `${base}/resolve?${new URLSearchParams({ epc: latestEpc, ...(lang ? { lang } : {}) }).toString()}`;
          const out = await fetch(url).then((r) => r.json());
          if (!out?.success) throw new Error(out?.message || 'Failed to load');
          if (!alive) return;
          setData(out.data || null);
        } catch (e) {
          if (!alive) return;
          setData(null);
          setError(e?.message || 'Failed to load');
        } finally {
          if (alive) setLoading(false);
        }
      };
      run();
      return () => {
        alive = false;
      };
    }
    let alive = true;
    setLoading(true);
    setError(null);
    const base = getPublicApiBaseUrl();
    const url = certId ? `${base}/cert/${encodeURIComponent(certId)}` : `${base}/resolve`;
    fetch(url + (certId ? '' : `?${new URLSearchParams({ ...(epc ? { epc } : {}), ...(nfcUid ? { nfcUid } : {}), ...(lang ? { lang } : {}) }).toString()}`))
      .then((r) => r.json())
      .then((json) => {
        if (!alive) return;
        if (!json?.success) throw new Error(json?.message || 'Failed to load');
        setData(json.data || null);
      })
      .catch((e) => {
        if (!alive) return;
        setData(null);
        setError(e?.message || 'Failed to load');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [lang, location.search]);

  if (!storedLayout) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
          No preview layout found. Go back to the CMS builder and click Preview.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-zinc-50">
      <div className="w-full overflow-auto p-4">
        <div className="mx-auto" style={{ width: baseW * scale, height: baseH * scale }}>
          <div
            className="relative rounded-xl border border-zinc-200 bg-white shadow-sm"
            style={{ width: baseW, height: baseH, transform: `scale(${scale})`, transformOrigin: 'top left' }}
          >
            <div className="ac-scrollbar-inside">
              <PublicRenderer layout={storedLayout} data={data || sampleCert()} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
