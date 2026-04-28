const prisma = require('../config/prisma');

const MAX_IDENTITIES = 10000;
const identities = [];

async function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), ms))]);
}

function norm(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.toUpperCase();
}

function findActiveIdentityMem({ organizationId, nfcUid, epc }) {
  const orgId = Number(organizationId);
  const uid = norm(nfcUid);
  const e = norm(epc);
  return (
    identities.find(
      (x) =>
        x.organizationId === orgId &&
        !x.unassignedAt &&
        ((uid && x.nfcUid === uid) || (e && x.epc === e))
    ) || null
  );
}

async function resolveCertificateId({ organizationId, nfcUid, epc }) {
  const orgId = Number(organizationId);
  const uid = norm(nfcUid);
  const e = norm(epc);
  if (!uid && !e) return null;

  try {
    const found = await withTimeout(
      prisma.tagIdentity.findFirst({
        where: {
          organizationId: orgId,
          unassignedAt: null,
          OR: [uid ? { nfcUid: uid } : undefined, e ? { epc: e } : undefined].filter(Boolean)
        },
        select: { certificateId: true }
      }),
      80
    );
    return found?.certificateId || null;
  } catch {
    const mem = findActiveIdentityMem({ organizationId: orgId, nfcUid: uid, epc: e });
    return mem?.certificateId || null;
  }
}

async function listIdentitiesByCertificate({ organizationId, certificateId }) {
  const orgId = Number(organizationId);
  const certId = String(certificateId);
  try {
    const rows = await withTimeout(
      prisma.tagIdentity.findMany({
        where: { organizationId: orgId, certificateId: certId, unassignedAt: null },
        orderBy: { assignedAt: 'desc' }
      }),
      80
    );
    return rows;
  } catch {
    return identities
      .filter((x) => x.organizationId === orgId && x.certificateId === certId && !x.unassignedAt)
      .sort((a, b) => b.assignedAt.getTime() - a.assignedAt.getTime());
  }
}

async function assignIdentity({ organizationId, certificateId, nfcUid, epc }) {
  const orgId = Number(organizationId);
  const certId = String(certificateId);
  const uid = norm(nfcUid);
  const e = norm(epc);
  if (!uid && !e) throw new Error('Either nfcUid or epc is required');

  const existing = await resolveCertificateId({ organizationId: orgId, nfcUid: uid, epc: e });
  if (existing && existing !== certId) throw new Error('Identity is already assigned to another certificate');

  const now = new Date();
  try {
    const created = await withTimeout(
      prisma.tagIdentity.create({
        data: {
          organizationId: orgId,
          certificateId: certId,
          nfcUid: uid,
          epc: e,
          assignedAt: now
        }
      }),
      120
    );
    return created;
  } catch {
    const next = {
      id: Date.now(),
      organizationId: orgId,
      certificateId: certId,
      nfcUid: uid,
      epc: e,
      assignedAt: now,
      lastSeenAt: null,
      unassignedAt: null
    };
    identities.unshift(next);
    if (identities.length > MAX_IDENTITIES) identities.splice(MAX_IDENTITIES);
    return next;
  }
}

async function moveActiveIdentities({ organizationId, fromCertificateId, toCertificateId }) {
  const orgId = Number(organizationId);
  const fromId = String(fromCertificateId);
  const toId = String(toCertificateId);
  const now = new Date();

  try {
    const moved = await withTimeout(
      prisma.tagIdentity.updateMany({
        where: { organizationId: orgId, certificateId: fromId, unassignedAt: null },
        data: { certificateId: toId, assignedAt: now }
      }),
      120
    );
    return { moved: moved.count };
  } catch {
    let moved = 0;
    for (let i = 0; i < identities.length; i++) {
      const x = identities[i];
      if (x.organizationId !== orgId) continue;
      if (x.certificateId !== fromId) continue;
      if (x.unassignedAt) continue;
      identities[i] = { ...x, certificateId: toId, assignedAt: now };
      moved++;
    }
    return { moved };
  }
}

module.exports = {
  resolveCertificateId,
  listIdentitiesByCertificate,
  assignIdentity,
  moveActiveIdentities
};
