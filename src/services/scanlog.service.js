const prisma = require('../config/prisma');

const MAX_SCANS = 5000;
const scans = [];
const certStatusOverrides = new Map();

function nowMs() {
  return Date.now();
}

function toIso(ts) {
  return new Date(ts).toISOString();
}

function normalizeIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function computeRisk({ certificateId, ip, userAgent, timestamp }) {
  const hourAgo = timestamp - 60 * 60 * 1000;
  const tenMinAgo = timestamp - 10 * 60 * 1000;
  const oneMinAgo = timestamp - 60 * 1000;

  let scansLast10m = 0;
  let scansSameIpLast1m = 0;
  const ipsLastHour = new Set();

  for (let i = scans.length - 1; i >= 0; i--) {
    const s = scans[i];
    if (s.timestamp < hourAgo) break;
    if (s.certificateId !== certificateId) continue;
    ipsLastHour.add(s.ip);
    if (s.timestamp >= tenMinAgo) scansLast10m++;
    if (s.ip === ip && s.timestamp >= oneMinAgo) scansSameIpLast1m++;
  }

  const flags = [];
  let score = 0;

  if (ipsLastHour.size >= 5) {
    score += 45;
    flags.push('many_ips_1h');
  }

  if (scansLast10m >= 10) {
    score += 35;
    flags.push('high_frequency_10m');
  }

  if (scansSameIpLast1m >= 5) {
    score += 25;
    flags.push('burst_same_ip_1m');
  }

  if (!userAgent) {
    score += 5;
    flags.push('missing_user_agent');
  }

  if (score > 100) score = 100;
  return { score, flags };
}

async function tryPersistToDb({ certificateId, organizationId, nfcUid, epc, deviceHash, country, latitude, longitude, ip, userAgent, timestamp }) {
  try {
    await prisma.scanLog.create({
      data: {
        certificateId,
        organizationId: typeof organizationId === 'number' ? organizationId : null,
        nfcUid: nfcUid || null,
        epc: epc || null,
        deviceHash: deviceHash || null,
        country: country || null,
        latitude: typeof latitude === 'number' ? latitude : null,
        longitude: typeof longitude === 'number' ? longitude : null,
        ip,
        userAgent,
        timestamp: new Date(timestamp)
      }
    });
  } catch {
  }
}

async function addScan({ certificateId, organizationId, nfcUid, epc, deviceHash, country, latitude, longitude, ip, userAgent, timestamp }) {
  const risk = computeRisk({ certificateId, ip, userAgent, timestamp });
  const suspicious = risk.score >= 50;

  const entry = {
    id: `${certificateId}-${Math.random().toString(16).slice(2)}-${timestamp}`,
    certificateId,
    organizationId: typeof organizationId === 'number' ? organizationId : null,
    nfcUid: nfcUid || null,
    epc: epc || null,
    deviceHash: deviceHash || null,
    country: country || null,
    latitude: typeof latitude === 'number' ? latitude : null,
    longitude: typeof longitude === 'number' ? longitude : null,
    ip,
    userAgent,
    timestamp,
    iso: toIso(timestamp),
    riskScore: risk.score,
    riskFlags: risk.flags,
    suspicious
  };

  scans.push(entry);
  if (scans.length > MAX_SCANS) scans.splice(0, scans.length - MAX_SCANS);
  void tryPersistToDb({ certificateId, organizationId, nfcUid, epc, deviceHash, country, latitude, longitude, ip, userAgent, timestamp });

  return entry;
}

function listScans({ limit = 200, offset = 0 } = {}) {
  const l = Math.max(1, Math.min(1000, Number(limit) || 200));
  const o = Math.max(0, Number(offset) || 0);
  const ordered = [...scans].sort((a, b) => b.timestamp - a.timestamp);
  return {
    total: ordered.length,
    items: ordered.slice(o, o + l)
  };
}

function overview() {
  const ts = nowMs();
  const dayAgo = ts - 24 * 60 * 60 * 1000;

  let last24h = 0;
  let suspicious24h = 0;
  const certs = new Set();
  const ipCounts = new Map();
  const certCounts = new Map();

  for (let i = scans.length - 1; i >= 0; i--) {
    const s = scans[i];
    if (s.timestamp < dayAgo) break;
    last24h++;
    if (s.suspicious) suspicious24h++;
    certs.add(s.certificateId);
    ipCounts.set(s.ip, (ipCounts.get(s.ip) || 0) + 1);
    certCounts.set(s.certificateId, (certCounts.get(s.certificateId) || 0) + 1);
  }

  const topIps = [...ipCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([ip, count]) => ({ ip, count }));

  const topCerts = [...certCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([certificateId, count]) => ({ certificateId, count }));

  return {
    totalScans: scans.length,
    last24h,
    uniqueCertificates24h: certs.size,
    suspicious24h,
    topIps,
    topCertificates: topCerts
  };
}

function getCertificateTimeline(certificateId) {
  const ordered = scans
    .filter((s) => s.certificateId === certificateId)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 200);

  const override = certStatusOverrides.get(certificateId) || null;
  return {
    certificateId,
    overrideStatus: override,
    scans: ordered
  };
}

function setCertificateStatusOverride(certificateId, status) {
  if (!status) {
    certStatusOverrides.delete(certificateId);
    return null;
  }
  certStatusOverrides.set(certificateId, status);
  return status;
}

function getCertificateStatusOverride(certificateId) {
  return certStatusOverrides.get(certificateId) || null;
}

module.exports = {
  normalizeIp,
  addScan,
  listScans,
  overview,
  getCertificateTimeline,
  setCertificateStatusOverride,
  getCertificateStatusOverride
};
