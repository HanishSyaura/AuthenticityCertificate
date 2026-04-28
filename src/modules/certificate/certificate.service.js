const prisma = require('../../config/prisma');
const { generateCertificateId } = require('../../utils/id-generator');
const identityService = require('../../services/identity.service');

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
  void batchId;
  
  if (type === 'batch') {
    // One certificate for the entire batch
    const certificateId = generateCertificateId();
    try {
      const cert = await withTimeout(
        prisma.certificate.create({
          data: {
            certificateId,
            organizationId: orgId,
            type: 'batch',
            batchId: parseInt(batchId),
            status: 'PENDING'
          }
        }),
        120
      );
      certificates.push(cert);
    } catch {
      const cert = { certificateId, organizationId: orgId, type: 'batch', batchId: parseInt(batchId), status: 'PENDING', createdAt: new Date() };
      memCerts.unshift(cert);
      certificates.push(cert);
    }
  } else {
    // Unique certificate for each unit
    for (let i = 0; i < quantity; i++) {
      const certificateId = generateCertificateId();
      try {
        const cert = await withTimeout(
          prisma.certificate.create({
            data: {
              certificateId,
              organizationId: orgId,
              type: 'unit',
              batchId: parseInt(batchId),
              status: 'PENDING'
            }
          }),
          120
        );
        certificates.push(cert);
      } catch {
        const cert = { certificateId, organizationId: orgId, type: 'unit', batchId: parseInt(batchId), status: 'PENDING', createdAt: new Date() };
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
    cert = await withTimeout(prisma.certificate.findUnique({ where: { certificateId } }), 80);
  } catch {
  }
  if (cert && cert.organizationId !== orgId) throw new Error('Certificate belongs to a different organization');

  try {
    return await withTimeout(
      prisma.certificate.update({
        where: { certificateId },
        data: { status: 'REVOKED', revokedAt: new Date() }
      }),
      120
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
    cert = await withTimeout(prisma.certificate.findUnique({ where: { certificateId: certId } }), 80);
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
      120
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
    from = await withTimeout(prisma.certificate.findUnique({ where: { certificateId: fromId } }), 80);
  } catch {
    from = memCerts.find((c) => c.certificateId === fromId && c.organizationId === orgId) || null;
  }
  if (!from) throw new Error('Certificate not found');
  if (from.organizationId && from.organizationId !== orgId) throw new Error('Certificate belongs to a different organization');

  const toId = generateCertificateId();
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
      120
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
      120
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

  return prisma.certificate.findUnique({
    where: { certificateId },
    include: {
      batch: {
        include: {
          product: {
            include: {
              cmsPage: {
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
}

async function getCertificateDetailsCached(certificateId, { ttlMs = 5000 } = {}) {
  const cached = getCache(certificateId);
  if (cached) return cached;
  const cert = await getCertificateDetails(certificateId);
  if (cert) setCache(certificateId, cert, ttlMs);
  return cert;
}

module.exports = {
  generateCertificates,
  revokeCertificate,
  activateCertificate,
  reissueCertificate,
  computeEffectiveStatus,
  getCertificateLite,
  getCertificateDetails,
  getCertificateDetailsCached
};
