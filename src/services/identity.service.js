const prisma = require('../config/prisma');

const MAX_IDENTITIES = 10000;
const identities = [];

async function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), ms))]);
}

function norm(v) {
  if (!v) return null;
  const s = String(v)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '');
  if (!s) return null;
  return s;
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

async function resolveCertificateId({ organizationId, nfcUid, epc, requireEpcBatchMeta = false }) {
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
    if (found?.certificateId) {
      if (requireEpcBatchMeta && e) {
        const meta = await withTimeout(
          prisma.epcItem.findUnique({
            where: { organizationId_epcCode: { organizationId: orgId, epcCode: e } },
            select: { batchNumber: true, swiftletHouseNumber: true }
          }),
          80
        );
        const ok =
          String(meta?.batchNumber || '').trim().length > 0 && String(meta?.swiftletHouseNumber || '').trim().length > 0;
        if (!ok) throw new Error('epc_inactive_missing_batch_meta');
      }
      return found.certificateId;
    }

    if (e) {
      const epcItem = await withTimeout(
        prisma.epcItem.findUnique({
          where: { organizationId_epcCode: { organizationId: orgId, epcCode: e } },
          select: { batchNumber: true, swiftletHouseNumber: true, batch: { select: { certificateId: true } } }
        }),
        80
      );
      if (epcItem?.batch?.certificateId) {
        if (requireEpcBatchMeta) {
          const ok =
            String(epcItem?.batchNumber || '').trim().length > 0 &&
            String(epcItem?.swiftletHouseNumber || '').trim().length > 0;
          if (!ok) throw new Error('epc_inactive_missing_batch_meta');
        }
        return epcItem.batch.certificateId;
      }
    }

    return null;
  } catch (err) {
    if (err?.message === 'epc_inactive_missing_batch_meta') throw err;
    if (requireEpcBatchMeta && e) return null;
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

async function listIdentities({ organizationId, q, certificateId, nfcUid, epc, active = true, limit = 50, offset = 0 }) {
  const orgId = Number(organizationId);
  const l = Math.max(1, Math.min(200, Number(limit) || 50));
  const o = Math.max(0, Number(offset) || 0);

  const uid = norm(nfcUid);
  const e = norm(epc);
  const query = q ? String(q).trim().toUpperCase() : null;
  const certId = certificateId ? String(certificateId).trim() : null;

  const where = {
    organizationId: orgId,
    ...(active ? { unassignedAt: null } : {}),
    ...(certId ? { certificateId: certId } : {}),
    ...(uid ? { nfcUid: uid } : {}),
    ...(e ? { epc: e } : {})
  };

  if (query && !uid && !e && !certId) {
    where.OR = [
      { certificateId: { contains: query } },
      { nfcUid: { contains: query } },
      { epc: { contains: query } }
    ];
  }

  try {
    const [total, items] = await withTimeout(
      Promise.all([
        prisma.tagIdentity.count({ where }),
        prisma.tagIdentity.findMany({ where, orderBy: { assignedAt: 'desc' }, skip: o, take: l })
      ]),
      1200
    );
    return { total, items, limit: l, offset: o };
  } catch {
    const filtered = identities
      .filter((x) => {
        if (x.organizationId !== orgId) return false;
        if (active && x.unassignedAt) return false;
        if (certId && x.certificateId !== certId) return false;
        if (uid && x.nfcUid !== uid) return false;
        if (e && x.epc !== e) return false;
        if (query && !uid && !e && !certId) {
          const hay = `${x.certificateId || ''}|${x.nfcUid || ''}|${x.epc || ''}`.toUpperCase();
          if (!hay.includes(query)) return false;
        }
        return true;
      })
      .sort((a, b) => b.assignedAt.getTime() - a.assignedAt.getTime());

    return { total: filtered.length, items: filtered.slice(o, o + l), limit: l, offset: o };
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
    if (e) {
      return await withTimeout(
        prisma.$transaction(async (tx) => {
          const item = await tx.epcItem.findFirst({
            where: { organizationId: orgId, epcCode: e },
            select: { batchId: true, batch: { select: { certificateId: true } } }
          });

          const batchCert = item?.batch?.certificateId || null;
          if (batchCert && batchCert !== certId) {
            throw new Error(`EPC batch sudah assigned kepada certificate ${batchCert}`);
          }

          if (item?.batchId) {
            const res = await tx.epcBatch.updateMany({
              where: {
                id: item.batchId,
                organizationId: orgId,
                OR: [{ certificateId: null }, { certificateId: certId }]
              },
              data: { certificateId: certId }
            });
            if (!res.count) {
              const b = await tx.epcBatch.findFirst({
                where: { id: item.batchId, organizationId: orgId },
                select: { certificateId: true }
              });
              const current = b?.certificateId || null;
              if (current && current !== certId) {
                throw new Error(`EPC batch sudah assigned kepada certificate ${current}`);
              }
            }
          }

          const existingRow = await tx.tagIdentity.findFirst({
            where: {
              organizationId: orgId,
              OR: [uid ? { nfcUid: uid } : undefined, e ? { epc: e } : undefined].filter(Boolean)
            }
          });

          if (!existingRow) {
            return await tx.tagIdentity.create({
              data: {
                organizationId: orgId,
                certificateId: certId,
                nfcUid: uid,
                epc: e,
                assignedAt: now
              }
            });
          }

          if (existingRow.unassignedAt == null && existingRow.certificateId !== certId) {
            throw new Error('Identity is already assigned to another certificate');
          }

          return await tx.tagIdentity.update({
            where: { id: existingRow.id },
            data: {
              certificateId: certId,
              nfcUid: uid || existingRow.nfcUid,
              epc: e || existingRow.epc,
              assignedAt: now,
              unassignedAt: null
            }
          });
        }),
        2500
      );
    }

    const existingRow = await withTimeout(
      prisma.tagIdentity.findFirst({
        where: {
          organizationId: orgId,
          OR: [uid ? { nfcUid: uid } : undefined, e ? { epc: e } : undefined].filter(Boolean)
        }
      }),
      1200
    );

    if (!existingRow) {
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
        1200
      );
      return created;
    }

    if (existingRow.unassignedAt == null && existingRow.certificateId !== certId) {
      throw new Error('Identity is already assigned to another certificate');
    }

    const updated = await withTimeout(
      prisma.tagIdentity.update({
        where: { id: existingRow.id },
        data: {
          certificateId: certId,
          nfcUid: uid || existingRow.nfcUid,
          epc: e || existingRow.epc,
          assignedAt: now,
          unassignedAt: null
        }
      }),
      1200
    );
    return updated;
  } catch (err) {
    const msg = String(err?.message || '');
    if (msg.includes('already assigned') || msg.includes('EPC batch sudah assigned')) throw err;
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

async function unassignIdentity({ organizationId, id }) {
  const orgId = Number(organizationId);
  const identityId = Number(id);
  if (!Number.isFinite(identityId)) throw new Error('Invalid identity id');

  const now = new Date();
  try {
    const row = await withTimeout(
      prisma.tagIdentity.findFirst({ where: { id: identityId, organizationId: orgId, unassignedAt: null } }),
      1200
    );
    if (!row) throw new Error('Identity not found');

    const updated = await withTimeout(
      prisma.tagIdentity.update({ where: { id: identityId }, data: { unassignedAt: now } }),
      1200
    );
    return { id: updated.id, unassignedAt: updated.unassignedAt };
  } catch {
    const idx = identities.findIndex((x) => x.organizationId === orgId && x.id === identityId && !x.unassignedAt);
    if (idx === -1) throw new Error('Identity not found');
    identities[idx] = { ...identities[idx], unassignedAt: now };
    return { id: identityId, unassignedAt: now };
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
  listIdentities,
  listIdentitiesByCertificate,
  assignIdentity,
  unassignIdentity,
  moveActiveIdentities
};
