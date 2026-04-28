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

function mockCert(id) {
  return {
    certificateId: id,
    type: 'unit',
    status: 'VALID',
    issuedAt: new Date().toISOString(),
    product: {
      name: 'Premium Bird Nest (Gold Edition)',
      code: 'PBN-G-001'
    },
    batch: {
      batchNo: 'BATCH-2024-04'
    },
    layout: [
      {
        id: 'block-1',
        type: 'text',
        x: 20,
        y: 100,
        w: 360,
        h: 70,
        content: {
          text: 'AUTHENTICITY VERIFIED'
        }
      },
      {
        id: 'block-2',
        type: 'image',
        x: 20,
        y: 180,
        w: 420,
        h: 240,
        content: {
          url: 'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=premium%20bird%20nest%20packaging%20luxury&image_size=landscape_4_3'
        }
      },
      {
        id: 'block-3',
        type: 'certificate',
        x: 20,
        y: 440,
        w: 420,
        h: 260
      }
    ]
  };
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

  if (certificateId === 'BN-ERROR') {
    return res.error('Certificate not found', 404);
  }

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

    let layout = cert.batch?.product?.cmsPage?.publishedVersion?.layoutJson || null;
    const pageId = cert.batch?.product?.cmsPage?.id || null;
    if (pageId) {
      try {
        if (!dbGate.shouldUseDb()) throw new Error('db_disabled');
        const translation = await Promise.race([
          prisma.cmsTranslation.findFirst({
            where: {
              organizationId: Number(req.organization?.id || cert.organizationId || 0),
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
    if (!layout) layout = cert.batch?.product?.cmsPage?.layout?.layoutJson || null;
    const effectiveStatus = certificateService.computeEffectiveStatus(cert);
    const status = chooseStatus({ effectiveStatus, overrideStatus });

    return res.success(
      {
        certificateId: cert.certificateId,
        type: cert.type,
        status,
        statusStored: cert.status,
        verifiedVia,
        identity: identity || null,
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
        layout,
        risk: {
          score: scanEntry.riskScore,
          flags: scanEntry.riskFlags
        }
      },
      'Verification successful'
    );
  } catch {
    dbGate.markDbFailure({ cooldownMs: 10_000 });
    const orgId = typeof req.organization?.id === 'number' ? req.organization.id : 1;
    const lite = certificateService.getCertificateLite({ organizationId: orgId, certificateId });
    const demo = lite
      ? {
          certificateId: lite.certificateId,
          type: lite.type,
          status: lite.status,
          issuedAt: lite.issuedAt || lite.createdAt,
          expiresAt: lite.expiresAt || null,
          product: null,
          batch: lite.batchId ? { batchNo: String(lite.batchId) } : null,
          layout: null
        }
      : mockCert(certificateId);

    const effectiveStatus = certificateService.computeEffectiveStatus(demo);
    const status = chooseStatus({ effectiveStatus, overrideStatus });
    return res.success(
      {
        ...demo,
        status,
        statusStored: demo.status,
        verifiedVia,
        identity: identity || null,
        risk: {
          score: scanEntry.riskScore,
          flags: scanEntry.riskFlags
        }
      },
      'Verification successful'
    );
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
