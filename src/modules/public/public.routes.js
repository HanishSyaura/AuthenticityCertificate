const express = require('express');
const router = express.Router();

const certificateService = require('../certificate/certificate.service');
const scanlog = require('../../services/scanlog.service');
const identityService = require('../../services/identity.service');
const { attachOrganization } = require('../../middleware/org.middleware');
const prisma = require('../../config/prisma');
const fraudService = require('../../services/fraud.service');
const dbGate = require('../../services/dbGate.service');
const webhookService = require('../../services/webhook.service');

function normalizeLang(lang) {
  const l = String(lang || 'en').toLowerCase();
  if (l === 'ms' || l === 'bm') return 'ms';
  if (l === 'zh' || l === 'zh-cn' || l === 'cn') return 'zh';
  return 'en';
}

router.use(attachOrganization);

function chooseStatus({ effectiveStatus, overrideStatus }) {
  if (overrideStatus === 'REVOKED') return 'REVOKED';
  if (effectiveStatus === 'EXPIRED') return 'EXPIRED';
  return overrideStatus || effectiveStatus;
}

function getRect(block, mode) {
  const src = mode && block && typeof block === 'object' ? block[mode] || block : block;
  return {
    x: Number(src?.x ?? 0) || 0,
    y: Number(src?.y ?? 0) || 0,
    w: Number(src?.w ?? 0) || 0,
    h: Number(src?.h ?? 0) || 0
  };
}

function getLayoutHeight(layout) {
  if (!Array.isArray(layout)) return 0;
  let maxBottom = 0;
  for (const b of layout) {
    const rects = [getRect(b, null), getRect(b, 'desktop'), getRect(b, 'mobile')];
    for (const r of rects) {
      const bottom = (Number(r.y) || 0) + (Number(r.h) || 0);
      if (Number.isFinite(bottom)) maxBottom = Math.max(maxBottom, bottom);
    }
  }
  return maxBottom;
}

function shiftBlock(block, { yOffset, idPrefix }) {
  const next = { ...(block || {}) };
  if (next.id) next.id = `${idPrefix}${String(next.id)}`;
  if (next.x != null || next.y != null || next.w != null || next.h != null) {
    next.y = (Number(next.y) || 0) + yOffset;
  }
  if (next.desktop && typeof next.desktop === 'object') {
    next.desktop = { ...next.desktop, y: (Number(next.desktop.y) || 0) + yOffset };
  }
  if (next.mobile && typeof next.mobile === 'object') {
    next.mobile = { ...next.mobile, y: (Number(next.mobile.y) || 0) + yOffset };
  }
  return next;
}

function composeLayouts(pages) {
  const ordered = Array.isArray(pages) ? pages : [];
  let yOffset = 0;
  const out = [];
  for (const p of ordered) {
    const arr = Array.isArray(p?.effectiveLayout) ? p.effectiveLayout : [];
    const prefix = `p${String(p.id)}-`;
    for (const b of arr) out.push(shiftBlock(b, { yOffset, idPrefix: prefix }));
    yOffset += getLayoutHeight(arr);
  }
  return out;
}

async function respondByCertificateId({ req, res, certificateId, verifiedVia, identity }) {
  const ip = scanlog.normalizeIp(req);
  const userAgent = req.get('user-agent') || '';
  const deviceHash = typeof req.headers['x-device-hash'] === 'string' ? String(req.headers['x-device-hash']).trim() : null;
  const country = typeof req.headers['x-geo-country'] === 'string' ? String(req.headers['x-geo-country']).trim() : null;
  const latitude = req.headers['x-geo-lat'] != null ? Number(req.headers['x-geo-lat']) : null;
  const longitude = req.headers['x-geo-lng'] != null ? Number(req.headers['x-geo-lng']) : null;
  const scanEntry = await scanlog.addScan({
    certificateId,
    organizationId: typeof req.organization?.id === 'number' ? req.organization.id : null,
    nfcUid: identity?.nfcUid || null,
    epc: identity?.epc || null,
    deviceHash: deviceHash || null,
    country: country || null,
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    ip,
    userAgent,
    timestamp: Date.now()
  });

  void fraudService.autoFlagIfNeeded({
    organizationId: typeof req.organization?.id === 'number' ? req.organization.id : 1,
    certificateId,
    scanEntry
  });

  void webhookService.emitEvent({
    organizationId: typeof req.organization?.id === 'number' ? req.organization.id : 1,
    event: 'certificate_scanned',
    data: {
      certificateId,
      verifiedVia,
      ip,
      country: country || null,
      deviceHash: deviceHash || null,
      riskScore: scanEntry.riskScore,
      riskFlags: scanEntry.riskFlags
    }
  });

  const overrideStatus = scanlog.getCertificateStatusOverride(certificateId);

  const dbTimeoutMs = 350;
  try {
    const lang = normalizeLang(req.query?.lang || req.query?.language);
    if (!dbGate.shouldUseDb()) throw new Error('db_disabled');
    let cert = await Promise.race([
      certificateService.getCertificateDetailsCached(certificateId, { ttlMs: 5000 }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), dbTimeoutMs))
    ]);
    if (!cert) return res.error('Certificate not found', 404);
    dbGate.markDbSuccess();

    const resolvedOrgId = Number(req.organization?.id || cert.organizationId || 0) || null;
    const identityFromReq = identity || null;
    let resolvedEpc = identityFromReq?.epc || null;
    let resolvedNfcUid = identityFromReq?.nfcUid || null;
    if ((resolvedEpc == null && resolvedNfcUid == null) || resolvedOrgId == null) {
      try {
        if (!dbGate.shouldUseDb()) throw new Error('db_disabled');
        const idRow = await Promise.race([
          prisma.tagIdentity.findFirst({
            where: { organizationId: resolvedOrgId || Number(cert.organizationId || 0), certificateId: String(certificateId), unassignedAt: null },
            orderBy: { assignedAt: 'desc' }
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), 250))
        ]);
        if (idRow) {
          resolvedEpc = resolvedEpc || idRow.epc || null;
          resolvedNfcUid = resolvedNfcUid || idRow.nfcUid || null;
        }
      } catch {
        dbGate.markDbFailure({ cooldownMs: 10_000 });
      }
    }

    let epcItem = null;
    let epcBatchTemplate = null;
    let templateData = null;
    let epcBatchName = null;
    let epcProduct = null;
    if (resolvedOrgId && resolvedEpc) {
      try {
        if (!dbGate.shouldUseDb()) throw new Error('db_disabled');
        const row = await Promise.race([
          prisma.epcItem.findUnique({
            where: { organizationId_epcCode: { organizationId: resolvedOrgId, epcCode: String(resolvedEpc) } },
            select: {
              netWeight: true,
              productionDate: true,
              caiqNumber: true,
              batch: {
                select: {
                  batchName: true,
                  templateData: true,
                  certificateTemplate: true,
                  product: {
                    select: {
                      name: true,
                      code: true,
                      cmsPage: { select: { id: true } },
                      certificateTemplate: true
                    }
                  }
                }
              }
            }
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), 250))
        ]);
        epcItem = row ? { netWeight: row.netWeight, productionDate: row.productionDate, caiqNumber: row.caiqNumber } : null;
        epcBatchTemplate = row?.batch?.certificateTemplate || null;
        templateData = row?.batch?.templateData || null;
        epcBatchName = row?.batch?.batchName ? String(row.batch.batchName) : null;
        epcProduct = row?.batch?.product || null;
      } catch {
        dbGate.markDbFailure({ cooldownMs: 10_000 });
      }
    }

    if (resolvedOrgId && !resolvedEpc && (epcBatchTemplate == null || templateData == null || epcBatchName == null || epcProduct == null)) {
      try {
        if (!dbGate.shouldUseDb()) throw new Error('db_disabled');
        const row = await Promise.race([
          prisma.epcBatch.findFirst({
            where: { organizationId: resolvedOrgId, certificateId: String(certificateId) },
            orderBy: { createdAt: 'desc' },
            select: {
              batchName: true,
              templateData: true,
              certificateTemplate: true,
              product: {
                select: {
                  name: true,
                  code: true,
                  cmsPage: { select: { id: true } },
                  certificateTemplate: true
                }
              }
            }
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), 250))
        ]);
        if (row) {
          epcBatchTemplate = epcBatchTemplate || row.certificateTemplate || null;
          templateData = templateData || row.templateData || null;
          epcBatchName = epcBatchName || (row.batchName ? String(row.batchName) : null);
          epcProduct = epcProduct || row.product || null;
        }
      } catch {
        dbGate.markDbFailure({ cooldownMs: 10_000 });
      }
    }

    const resolvedProduct = epcProduct || cert.batch?.product || null;
    let layout = null;
    const pageId = resolvedProduct?.cmsPage?.id || null;
    const certificateLayout = null;
    const certificatePageId = null;

    const landingOrgId = resolvedOrgId || Number(req.organization?.id || cert.organizationId || 0) || null;
    if (landingOrgId) {
      try {
        if (!dbGate.shouldUseDb()) throw new Error('db_disabled');
        const pages = await Promise.race([
          prisma.cmsPage.findMany({
            where: { organizationId: landingOrgId, kind: 'landing' },
            orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
            include: { layout: true, publishedVersion: true }
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), 250))
        ]);

        const rootId = pageId != null ? Number(pageId) : null;
        const sorted = rootId
          ? [
              ...pages.filter((p) => Number(p.id) === rootId),
              ...pages.filter((p) => Number(p.id) !== rootId)
            ]
          : pages;

        const ids = sorted.map((p) => Number(p.id)).filter((n) => Number.isFinite(n));
        const translations = ids.length
          ? await Promise.race([
              prisma.cmsTranslation.findMany({ where: { organizationId: landingOrgId, language: lang, pageId: { in: ids } } }),
              new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), 250))
            ])
          : [];
        const tByPageId = new Map((translations || []).map((r) => [Number(r.pageId), r]));

        const effectivePages = sorted.map((p) => {
          const tRow = tByPageId.get(Number(p.id));
          const effectiveLayout = Array.isArray(tRow?.contentJson)
            ? tRow.contentJson
            : Array.isArray(p?.publishedVersion?.layoutJson)
              ? p.publishedVersion.layoutJson
              : Array.isArray(p?.layout?.layoutJson)
                ? p.layout.layoutJson
                : null;
          return { id: p.id, effectiveLayout };
        });

        const composed = composeLayouts(effectivePages);
        if (composed.length) {
          layout = composed;
        } else if (pageId) {
          const tRow = tByPageId.get(Number(pageId));
          if (Array.isArray(tRow?.contentJson)) layout = tRow.contentJson;
        }
      } catch {
        dbGate.markDbFailure({ cooldownMs: 10_000 });
      }
    }

    void certificatePageId;
    if (!layout) layout = resolvedProduct?.cmsPage?.layout?.layoutJson || null;
    void certificateLayout;
    let effectiveStatus = certificateService.computeEffectiveStatus(cert);
    if (effectiveStatus === 'PENDING' && (verifiedVia === 'epc' || verifiedVia === 'nfc_uid')) effectiveStatus = 'VALID';
    const status = chooseStatus({ effectiveStatus, overrideStatus });

    return res.success(
      {
        certificateId: cert.certificateId,
        type: cert.type,
        status,
        statusStored: cert.status,
        verifiedVia,
        identity: identityFromReq || null,
        issuedAt: cert.issuedAt || cert.createdAt,
        expiresAt: cert.expiresAt || null,
        revokedAt: cert.revokedAt || null,
        reissuedToId: cert.reissuedToId || null,
        product: resolvedProduct
          ? {
              name: resolvedProduct.name,
              code: resolvedProduct.code
            }
          : null,
        batch: epcBatchName ? { batchNo: epcBatchName } : cert.batch ? { batchNo: cert.batch.batchNo } : null,
        epcItem: epcItem
          ? {
              netWeight: epcItem.netWeight || null,
              productionDate: epcItem.productionDate || null,
              caiqNumber: epcItem.caiqNumber || null
            }
          : null,
        templateData: templateData || null,
        layout,
        certificateLayout: null,
        certificateTemplate: epcBatchTemplate || resolvedProduct?.certificateTemplate || null,
        risk: {
          score: scanEntry.riskScore,
          flags: scanEntry.riskFlags
        }
      },
      'Verification successful'
    );
  } catch (e) {
    dbGate.markDbFailure({ cooldownMs: 10_000 });
    const msg = e?.message === 'db_timeout' ? 'Service temporarily unavailable' : 'Service unavailable';
    return res.error(msg, 503);
  }
}

router.get('/cert/:id', async (req, res) => {
  const { id } = req.params;
  return respondByCertificateId({ req, res, certificateId: id, verifiedVia: 'qr', identity: null });
});

router.get('/resolve', async (req, res) => {
  const nfcUid = typeof req.query?.nfcUid === 'string' ? req.query.nfcUid : null;
  const epc = typeof req.query?.epc === 'string' ? req.query.epc : null;
  const orgId = typeof req.organization?.id === 'number' ? req.organization.id : null;
  if (!orgId) return res.error('Organization not found', 404);

  const certificateId = await identityService.resolveCertificateId({ organizationId: orgId, nfcUid, epc });
  if (!certificateId) return res.error('Identity not found. Use QR code fallback.', 404);

  const verifiedVia = nfcUid ? 'nfc_uid' : 'epc';
  return respondByCertificateId({
    req,
    res,
    certificateId,
    verifiedVia,
    identity: { nfcUid: nfcUid || null, epc: epc || null }
  });
});

module.exports = router;
