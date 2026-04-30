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
    const cert = await Promise.race([
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
    if (resolvedOrgId && resolvedEpc) {
      try {
        if (!dbGate.shouldUseDb()) throw new Error('db_disabled');
        epcItem = await Promise.race([
          prisma.epcItem.findUnique({
            where: { organizationId_epcCode: { organizationId: resolvedOrgId, epcCode: String(resolvedEpc) } },
            select: { netWeight: true, productionDate: true, caiqNumber: true }
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), 250))
        ]);
      } catch {
        dbGate.markDbFailure({ cooldownMs: 10_000 });
      }
    }

    let layout = cert.batch?.product?.cmsPage?.publishedVersion?.layoutJson || null;
    const pageId = cert.batch?.product?.cmsPage?.id || null;
    let certificateLayout = cert.batch?.product?.cmsCertificatePage?.publishedVersion?.layoutJson || null;
    const certificatePageId = cert.batch?.product?.cmsCertificatePage?.id || null;
    if (pageId) {
      try {
        if (!dbGate.shouldUseDb()) throw new Error('db_disabled');
        const translation = await Promise.race([
          prisma.cmsTranslation.findFirst({
            where: {
              organizationId: resolvedOrgId || Number(req.organization?.id || cert.organizationId || 0),
              pageId: Number(pageId),
              language: lang
            }
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), 250))
        ]);
        if (translation?.contentJson) layout = translation.contentJson;
      } catch {
        dbGate.markDbFailure({ cooldownMs: 10_000 });
      }
    }
    if (certificatePageId) {
      try {
        if (!dbGate.shouldUseDb()) throw new Error('db_disabled');
        const translation = await Promise.race([
          prisma.cmsTranslation.findFirst({
            where: {
              organizationId: resolvedOrgId || Number(req.organization?.id || cert.organizationId || 0),
              pageId: Number(certificatePageId),
              language: lang
            }
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), 250))
        ]);
        if (translation?.contentJson) certificateLayout = translation.contentJson;
      } catch {
        dbGate.markDbFailure({ cooldownMs: 10_000 });
      }
    }
    if (!layout) layout = cert.batch?.product?.cmsPage?.layout?.layoutJson || null;
    if (!certificateLayout) certificateLayout = cert.batch?.product?.cmsCertificatePage?.layout?.layoutJson || null;
    const effectiveStatus = certificateService.computeEffectiveStatus(cert);
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
        product: cert.batch?.product
          ? {
              name: cert.batch.product.name,
              code: cert.batch.product.code
            }
          : null,
        batch: cert.batch ? { batchNo: cert.batch.batchNo } : null,
        epcItem: epcItem
          ? {
              netWeight: epcItem.netWeight || null,
              productionDate: epcItem.productionDate || null,
              caiqNumber: epcItem.caiqNumber || null
            }
          : null,
        layout,
        certificateLayout,
        certificateTemplate: cert.batch?.product?.certificateTemplate || null,
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
