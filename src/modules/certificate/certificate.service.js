const prisma = require('../../config/prisma');
const { generateCertificateId } = require('../../utils/id-generator');
const identityService = require('../../services/identity.service');
const settingsService = require('../settings/settings.service');
const {
  resolveEffectiveCmsDesignIdFromEntities,
  resolveLegacySingleCmsPage
} = require('../../utils/cmsDesignResolver');

async function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), ms))]);
}

const memCerts = [];

const certDetailsCache = new Map();

function getCache(key) {
  const entry = certDetailsCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    certDetailsCache.delete(key);
    return null;
  }
  return entry.value;
}

function setCache(key, value, ttlMs) {
  const ttl = Math.max(250, Number(ttlMs) || 5000);
  certDetailsCache.set(key, { value, expiresAt: Date.now() + ttl });
}

function getCertificateLite({ organizationId, certificateId }) {
  const orgId = Number(organizationId);
  const certId = String(certificateId);
  return memCerts.find((c) => c.certificateId === certId && Number(c.organizationId) === orgId) || null;
}

async function generateCertificates(batchId, type, quantity = 1, organizationId) {
  const certificates = [];

  let orgId = Number(organizationId);
  let timeZone = null;
  try {
    const settings = await settingsService.ensureOrganizationSettings(orgId);
    timeZone = settings?.defaultTimezone || null;
  } catch {
  }

  const batchPk = Number(batchId);
  if (!Number.isFinite(batchPk)) throw new Error('Invalid batchId');

  try {
    const exists = await withTimeout(
      prisma.batch.findFirst({ where: { id: batchPk, organizationId: orgId }, select: { id: true } }),
      5000
    );
    if (!exists) throw new Error('Batch not found');
  } catch (e) {
    if (e?.message === 'db_timeout') throw e;
  }

  if (type === 'batch') {
    // One certificate for the entire batch
    let certificateId;
    try {
      certificateId = await generateCertificateId(prisma, { timeZone });
    } catch {
      certificateId = await generateCertificateId(null, { timeZone });
    }
    try {
      const cert = await withTimeout(
        prisma.certificate.create({
          data: {
            certificateId,
            organizationId: orgId,
            type: 'batch',
            batchId: batchPk,
            status: 'PENDING'
          }
        }),
        5000
      );
      certificates.push(cert);
    } catch {
      const cert = { certificateId, organizationId: orgId, type: 'batch', batchId: batchPk, status: 'PENDING', createdAt: new Date() };
      memCerts.unshift(cert);
      certificates.push(cert);
    }
  } else {
    // Unique certificate for each unit
    for (let i = 0; i < quantity; i++) {
      let certificateId;
      try {
        certificateId = await generateCertificateId(prisma, { timeZone });
      } catch {
        certificateId = await generateCertificateId(null, { timeZone });
      }
      try {
        const cert = await withTimeout(
          prisma.certificate.create({
            data: {
              certificateId,
              organizationId: orgId,
              type: 'unit',
              batchId: batchPk,
              status: 'PENDING'
            }
          }),
          5000
        );
        certificates.push(cert);
      } catch {
        const cert = { certificateId, organizationId: orgId, type: 'unit', batchId: batchPk, status: 'PENDING', createdAt: new Date() };
        memCerts.unshift(cert);
        certificates.push(cert);
      }
    }
  }

  return certificates;
}

async function revokeCertificate(certificateId, organizationId) {
  const orgId = Number(organizationId);
  let cert = null;
  try {
    cert = await withTimeout(prisma.certificate.findUnique({ where: { certificateId } }), 5000);
  } catch {
  }
  if (cert && cert.organizationId !== orgId) throw new Error('Certificate belongs to a different organization');

  try {
    return await withTimeout(
      prisma.certificate.update({
        where: { certificateId },
        data: { status: 'REVOKED', revokedAt: new Date() }
      }),
      5000
    );
  } catch {
    const idx = memCerts.findIndex((c) => c.certificateId === certificateId && c.organizationId === orgId);
    if (idx === -1) throw new Error('Certificate not found');
    memCerts[idx] = { ...memCerts[idx], status: 'REVOKED', revokedAt: new Date() };
    return memCerts[idx];
  }
}

function computeEffectiveStatus(cert) {
  if (!cert) return null;
  const s = String(cert.status || '').toUpperCase();
  if (s === 'REVOKED') return 'REVOKED';
  if (s === 'SUSPICIOUS') return 'SUSPICIOUS';
  if (s === 'PENDING') return 'PENDING';
  const exp = cert.expiresAt ? new Date(cert.expiresAt).getTime() : null;
  if (exp && Date.now() > exp) return 'EXPIRED';
  return 'VALID';
}

async function activateCertificate({ organizationId, certificateId, expiresAt, nfcUid, epc }) {
  const orgId = Number(organizationId);
  const certId = String(certificateId);
  const exp = expiresAt ? new Date(expiresAt) : null;

  let cert = null;
  try {
    cert = await withTimeout(prisma.certificate.findUnique({ where: { certificateId: certId } }), 5000);
  } catch {
  }
  if (!cert) {
    cert = memCerts.find((c) => c.certificateId === certId) || null;
  }
  if (!cert) throw new Error('Certificate not found');
  if (cert.organizationId && Number(cert.organizationId) !== orgId) throw new Error('Certificate belongs to a different organization');

  await identityService.assignIdentity({ organizationId: orgId, certificateId: certId, nfcUid, epc });

  try {
    const updated = await withTimeout(
      prisma.certificate.update({
        where: { certificateId: certId },
        data: {
          status: 'VALID',
          issuedAt: new Date(),
          expiresAt: exp
        }
      }),
      5000
    );
    return { certificate: updated, effectiveStatus: computeEffectiveStatus(updated) };
  } catch {
    const idx = memCerts.findIndex((c) => c.certificateId === certId && c.organizationId === orgId);
    if (idx === -1) throw new Error('Certificate not found');
    memCerts[idx] = { ...memCerts[idx], status: 'VALID', issuedAt: new Date(), expiresAt: exp || null };
    return { certificate: memCerts[idx], effectiveStatus: computeEffectiveStatus(memCerts[idx]) };
  }
}

async function reissueCertificate({ organizationId, certificateId, reason }) {
  const orgId = Number(organizationId);
  const fromId = String(certificateId);
  let from = null;
  try {
    from = await withTimeout(prisma.certificate.findUnique({ where: { certificateId: fromId } }), 5000);
  } catch {
    from = memCerts.find((c) => c.certificateId === fromId && c.organizationId === orgId) || null;
  }
  if (!from) throw new Error('Certificate not found');
  if (from.organizationId && from.organizationId !== orgId) throw new Error('Certificate belongs to a different organization');

  let toId;
  let timeZone = null;
  try {
    const targetOrgId = Number(from.organizationId || orgId);
    const settings = await settingsService.ensureOrganizationSettings(targetOrgId);
    timeZone = settings?.defaultTimezone || null;
  } catch {
  }
  try {
    toId = await generateCertificateId(prisma, { timeZone });
  } catch {
    toId = await generateCertificateId(null, { timeZone });
  }
  const now = new Date();
  const exp = from.expiresAt ? new Date(from.expiresAt) : null;


  try {
    await withTimeout(
      prisma.certificate.create({
        data: {
          certificateId: toId,
          organizationId: from.organizationId || orgId,
          type: from.type,
          batchId: from.batchId,
          status: 'VALID',
          issuedAt: now,
          expiresAt: exp,
          reissuedFromId: fromId
        }
      }),
      5000
    );
    await withTimeout(
      prisma.certificate.update({
        where: { certificateId: fromId },
        data: {
          status: 'REVOKED',
          revokedAt: now,
          reissuedToId: toId
        }
      }),
      5000
    );
  } catch {
    memCerts.unshift({
      certificateId: toId,
      organizationId: from.organizationId || orgId,
      type: from.type,
      batchId: from.batchId,
      status: 'VALID',
      issuedAt: now,
      expiresAt: exp,
      reissuedFromId: fromId,
      createdAt: now
    });
    const idx = memCerts.findIndex((c) => c.certificateId === fromId && c.organizationId === orgId);
    if (idx >= 0) memCerts[idx] = { ...memCerts[idx], status: 'REVOKED', revokedAt: now, reissuedToId: toId };
  }

  await identityService.moveActiveIdentities({ organizationId: orgId, fromCertificateId: fromId, toCertificateId: toId });
  return { fromCertificateId: fromId, toCertificateId: toId, reason: reason || null };
}

async function getCertificateDetails(certificateId) {
  const cached = getCache(certificateId);
  if (cached) return cached;

  // Step 1: Fetch certificate + product metadata (no CMS layouts yet, to keep this fast)
  const cert = await prisma.certificate.findUnique({
    where: { certificateId },
    include: {
      // LEGACY single-page includes, kept for backward compat
      cmsPage: {
        include: {
          layout: true,
          publishedVersion: true,
          draftVersion: true
        }
      },
      batch: {
        include: {
          product: {
            include: {
              certificateTemplate: true,
              // LEGACY single-page includes
              cmsPage: {
                include: {
                  layout: true,
                  publishedVersion: true,
                  draftVersion: true
                }
              },
              cmsCertificatePage: {
                include: {
                  layout: true,
                  publishedVersion: true,
                  draftVersion: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!cert) {
    return null;
  }

  // =========================================================================
  // Step 2: 3-TIER FALLBACK to resolve the ACTIVE CmsDesign bundle id (NEW)
  //   Tier 1  : Certificate.cmsDesignId           (per-cert override)
  //   Tier 2  : Product.cmsCertificateDesignId    (product cert-only design)
  //   Tier 3  : Product.cmsDesignId               (product main landing design)
  // Fallback: Single legacy CmsPage → bundle = null (we return 1-element pages)
  // =========================================================================
  const product = cert.batch?.product ?? null;
  const effectiveDesignId = resolveEffectiveCmsDesignIdFromEntities({ cert, product });

  // Try resolving a LEGACY single CmsPage pageId (used as last-resort 1-page bundle)
  const legacySinglePage =
    effectiveDesignId == null
      ? resolveLegacySingleCmsPage({
          certCmsPage: cert.cmsPage,
          productCmsCertificatePage: product?.cmsCertificatePage,
          productCmsPage: product?.cmsPage
        })
      : null;

  const orgId = Number(cert.organizationId);

  // Step 3: Fetch ALL inner CmsPages inside the resolved CmsDesign bundle (or legacy single)
  //         Each page comes with its publishedVersion.layoutJson so composeLayouts can stack them
  let cmsPages = [];
  try {
    if (effectiveDesignId != null) {
      cmsPages = await prisma.cmsPage.findMany({
        where: { organizationId: orgId, designId: Number(effectiveDesignId), deletedAt: null },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        include: {
          layout: true,
          publishedVersion: true,
          draftVersion: true
        }
      });
    } else if (legacySinglePage && legacySinglePage.id) {
      // Backward compat: If user links legacy single-page FK, wrap as 1-element bundle
      cmsPages = [legacySinglePage];
    } else {
      // Fallback: "default" group (designId IS NULL) — all existing ungrouped pages
      cmsPages = await prisma.cmsPage.findMany({
        where: { organizationId: orgId, designId: null, deletedAt: null },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        include: {
          layout: true,
          publishedVersion: true,
          draftVersion: true
        }
      });
    }
  } catch {
    cmsPages = legacySinglePage && legacySinglePage.id ? [legacySinglePage] : [];
  }

  // Attach NEW derived fields to the returned cert object.
  // composeLayouts({ pages: cmsPages }) in the public view can now stack every inner section.
  const enriched = {
    ...cert,
    cmsEffectiveDesignId: effectiveDesignId,
    cmsEffectiveSource:
      cert.cmsDesignId != null
        ? 'cert.cmsDesignId'
        : product?.cmsCertificateDesignId != null
          ? 'product.cmsCertificateDesignId'
          : product?.cmsDesignId != null
            ? 'product.cmsDesignId'
            : legacySinglePage
              ? 'legacy.cmsPageId'
              : 'default.designNull',
    cmsPages: Array.isArray(cmsPages) ? cmsPages : []
  };

  return enriched;
}

async function getCertificateDetailsCached(certificateId, { ttlMs = 30000 } = {}) {
  const cached = getCache(certificateId);
  if (cached) return cached;
  const cert = await getCertificateDetails(certificateId);
  if (cert) setCache(certificateId, cert, ttlMs);
  return cert;
}

async function getCertificateDetailsForAdmin({ organizationId, certificateId }) {
  const orgId = Number(organizationId);
  const certId = String(certificateId);
  const cert = await withTimeout(
    prisma.certificate.findFirst({
      where: { certificateId: certId, organizationId: orgId },
      include: {
        batch: { include: { product: true } },
        identities: { where: { unassignedAt: null }, orderBy: { assignedAt: 'desc' }, take: 5 }
      }
    }),
    5000
  );
  if (!cert) throw new Error('Certificate not found');
  return cert;
}

async function listCertificates({ organizationId, q, status, type, batchNo, productCode, from, to, limit = 50, offset = 0 }) {
  const orgId = Number(organizationId);
  const l = Math.max(1, Math.min(200, Number(limit) || 50));
  const o = Math.max(0, Number(offset) || 0);

  const query = q ? String(q).trim() : null;
  const where = {
    organizationId: orgId,
    ...(status ? { status: String(status).toUpperCase() } : {}),
    ...(type ? { type: String(type).toLowerCase() } : {})
  };

  if (from || to) {
    const createdAt = {};
    if (from) {
      const d = new Date(from);
      if (!Number.isNaN(d.getTime())) createdAt.gte = d;
    }
    if (to) {
      const d = new Date(to);
      if (!Number.isNaN(d.getTime())) createdAt.lte = d;
    }
    if (Object.keys(createdAt).length > 0) where.createdAt = createdAt;
  }

  if (query) {
    where.OR = [
      { certificateId: { contains: query } },
      { batch: { batchNo: { contains: query } } },
      { batch: { product: { code: { contains: query } } } }
    ];
  }

  if (batchNo) {
    where.batch = { ...(where.batch || {}), batchNo: { contains: String(batchNo) } };
  }
  if (productCode) {
    where.batch = {
      ...(where.batch || {}),
      product: { ...(where.batch?.product || {}), code: { contains: String(productCode) } }
    };
  }

  const [total, items] = await withTimeout(
    Promise.all([
      prisma.certificate.count({ where }),
      prisma.certificate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: o,
        take: l,
        include: {
          batch: { include: { product: true } },
          identities: { where: { unassignedAt: null }, orderBy: { assignedAt: 'desc' }, take: 5 }
        }
      })
    ]),
    5000
  );

  return { total, items, limit: l, offset: o };
}

async function patchCertificate({ organizationId, certificateId, patch }) {
  if (!certificateId) throw new Error('certificateId is required');
  if (!patch || typeof patch !== 'object') throw new Error('patch is required');

  const cert = await prisma.certificate.findUnique({
    where: { organizationId, certificateId }
  });
  if (!cert) throw new Error('Certificate not found');

  const data = {};

  if (Object.prototype.hasOwnProperty.call(patch, 'cmsDesignId')) {
    const designId = patch.cmsDesignId == null ? null : Number(patch.cmsDesignId);
    if (designId != null) {
      const design = await prisma.cmsDesign.findUnique({
        where: { id: designId, organizationId, deletedAt: null }
      });
      if (!design) throw new Error('CmsDesign not found');
    }
    data.cmsDesignId = designId;
  }

  if (Object.keys(data).length === 0) {
    return cert;
  }

  return prisma.certificate.update({
    where: { organizationId, certificateId },
    data,
    include: {
      batch: { include: { product: true } },
      identities: { where: { unassignedAt: null }, orderBy: { assignedAt: 'desc' }, take: 5 }
    }
  });
}

async function bulkPatchCertificates({ organizationId, certificateIds, certificateIdFilters, patch } = {}) {
  const orgId = Number(organizationId);
  const patchData = patch || {};
  if (!Number.isFinite(orgId) || orgId <= 0) throw new Error('Invalid organizationId');

  const ids = Array.isArray(certificateIds)
    ? certificateIds
        .map((v) => String(v || '').trim())
        .filter((s) => s.length > 0)
    : [];
  const idFilters = certificateIdFilters && typeof certificateIdFilters === 'object' ? certificateIdFilters : {};
  const hasExplicitIds = ids.length > 0;
  const hasFilters = Object.keys(idFilters).length > 0;
  if (!hasExplicitIds && !hasFilters) {
    const err = new Error('Sama ada certificateIds atau filters diperlukan');
    err.status = 400;
    throw err;
  }
  if (ids.length > 2000) {
    const err = new Error('Terlalu banyak certificateIds (maksimum 2000)');
    err.status = 400;
    throw err;
  }

  const data = {};
  if (Object.prototype.hasOwnProperty.call(patchData, 'cmsDesignId')) {
    const designId = patchData.cmsDesignId == null ? null : Number(patchData.cmsDesignId);
    if (designId != null) {
      if (!Number.isFinite(designId) || designId <= 0) throw new Error('Invalid cmsDesignId');
      const design = await withTimeout(
        prisma.cmsDesign.findUnique({ where: { id: designId, organizationId: orgId, deletedAt: null }, select: { id: true } }),
        1500
      );
      if (!design) throw new Error('Landing Page Design tidak wujud');
    }
    data.cmsDesignId = designId;
  }
  if (Object.keys(data).length === 0) {
    const err = new Error('Tiada field untuk dikemas kini');
    err.status = 400;
    throw err;
  }

  const where = { organizationId: orgId };
  if (hasExplicitIds) where.certificateId = { in: ids };
  if (idFilters.batchId != null) {
    const bid = Number(idFilters.batchId);
    if (!Number.isFinite(bid) || bid <= 0) throw new Error('Invalid batchId filter');
    where.batchId = bid;
  }
  if (idFilters.productId != null) {
    const pid = Number(idFilters.productId);
    if (!Number.isFinite(pid) || pid <= 0) throw new Error('Invalid productId filter');
    where.batch = { productId: pid };
  }

  const result = await prisma.$transaction(async (tx) => {
    const u = await withTimeout(tx.certificate.updateMany({ where, data }), 5000);
    const matched = await withTimeout(
      tx.certificate.findMany({
        where,
        select: { certificateId: true, cmsDesignId: true },
        take: 100
      }),
      1500
    );
    return {
      updatedCount: Number(u.count) || 0,
      sampleUpdated: matched
    };
  });
  return result;
}

module.exports = {
  generateCertificates,
  revokeCertificate,
  activateCertificate,
  reissueCertificate,
  computeEffectiveStatus,
  getCertificateLite,
  getCertificateDetails,
  getCertificateDetailsCached,
  getCertificateDetailsForAdmin,
  listCertificates,
  patchCertificate,
  bulkPatchCertificates
};
