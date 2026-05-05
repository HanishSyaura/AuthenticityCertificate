const crypto = require('crypto');

function formatDdMmYy(d = new Date()) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear() % 100).padStart(2, '0');
  return `${dd}${mm}${yy}`;
}

function formatCertificateId({ dateKey, runningNo, prefix = 'CERT', pad = 3 }) {
  const run = String(runningNo).padStart(pad, '0');
  return `${prefix}${dateKey}${run}`;
}

function generateFallbackCertificateId({ date = new Date(), prefix = 'CERT', pad = 3 } = {}) {
  const dateKey = formatDdMmYy(date);
  const max = Math.max(10, 10 ** Math.min(6, Math.max(1, Number(pad) || 3)));
  const r = crypto.randomInt(1, max);
  return formatCertificateId({ dateKey, runningNo: r, prefix, pad });
}

async function generateCertificateId(db, { date = new Date(), prefix = 'CERT', pad = 3 } = {}) {
  if (!db) return generateFallbackCertificateId({ date, prefix, pad });
  const dateKey = formatDdMmYy(date);

  const allocateInTx = async (tx) => {
    await tx.certificateSequence.upsert({
      where: { dateKey },
      update: {},
      create: { dateKey, lastNo: 0n }
    });

    for (let attempt = 0; attempt < 50; attempt += 1) {
      const rows = await tx.$queryRaw`
        SELECT lastNo FROM \`CertificateSequence\`
        WHERE dateKey = ${dateKey}
        FOR UPDATE
      `;
      const current = rows && rows[0] && rows[0].lastNo !== undefined ? BigInt(rows[0].lastNo) : 0n;
      const next = current + 1n;

      await tx.certificateSequence.update({
        where: { dateKey },
        data: { lastNo: next }
      });

      const candidate = formatCertificateId({ dateKey, runningNo: next.toString(), prefix, pad });
      const exists = await tx.certificate.findUnique({ where: { certificateId: candidate }, select: { certificateId: true } });
      if (!exists) return candidate;
    }

    throw new Error('Failed to allocate certificate id');
  };

  if (typeof db.$transaction === 'function') {
    return db.$transaction((tx) => allocateInTx(tx), { timeout: 8_000, maxWait: 2_000 });
  }

  return allocateInTx(db);
}

module.exports = {
  generateCertificateId
};
