let nodemailer;
try {
  nodemailer = require('nodemailer');
} catch {
}

const crypto = require('crypto');
const jobQueue = require('./jobQueue.service');
const prisma = require('../config/prisma');
const { decryptText } = require('../utils/secretCrypto');

function isValidEmail(v) {
  const s = String(v || '').trim();
  if (!s) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function envSmtpConfig() {
  const host = String(process.env.SMTP_HOST || '').trim();
  if (!host) return null;
  const portRaw = process.env.SMTP_PORT;
  const port = portRaw == null ? 587 : Number(portRaw);
  const secureRaw = String(process.env.SMTP_SECURE || '').trim().toLowerCase();
  const secure = secureRaw ? secureRaw === '1' || secureRaw === 'true' || secureRaw === 'yes' : Number(port) === 465;
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '').trim();
  const from = String(process.env.SMTP_FROM || process.env.MAIL_FROM || '').trim();
  const replyTo = String(process.env.SMTP_REPLY_TO || '').trim();
  const connectionTimeout = Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 15_000);
  const socketTimeout = Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 30_000);

  return {
    host,
    port: Number.isFinite(port) ? port : 587,
    secure,
    auth: user && pass ? { user, pass } : null,
    from: from || user || null,
    replyTo: replyTo || null,
    connectionTimeout: Number.isFinite(connectionTimeout) ? connectionTimeout : 15_000,
    socketTimeout: Number.isFinite(socketTimeout) ? socketTimeout : 30_000
  };
}

function normalizeOrgSmtpRow(row) {
  if (!row) return null;
  const host = row.smtpHost ? String(row.smtpHost).trim() : '';
  if (!host) return null;
  const portRaw = row.smtpPort == null ? null : Number(row.smtpPort);
  const port = Number.isFinite(portRaw) && portRaw > 0 ? portRaw : 587;
  const secure = row.smtpSecure == null ? port === 465 : Boolean(row.smtpSecure);
  const user = row.smtpUser ? String(row.smtpUser).trim() : '';
  const pass = row.smtpPassEnc ? decryptText(String(row.smtpPassEnc)) : '';
  const fromName = row.smtpFromName ? String(row.smtpFromName).trim() : '';
  const fromEmail = row.smtpFromEmail ? String(row.smtpFromEmail).trim() : '';
  const replyTo = row.smtpReplyTo ? String(row.smtpReplyTo).trim() : '';

  const safeFromName = fromName.replace(/["\r\n<>]+/g, '').trim();
  const from =
    safeFromName && fromEmail ? `${safeFromName} <${fromEmail}>` : fromEmail ? fromEmail : user ? user : '';

  return {
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : null,
    from: from || null,
    replyTo: replyTo || null,
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 15_000) || 15_000,
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 30_000) || 30_000
  };
}

const orgCfgCache = new Map();

async function orgSmtpConfig(organizationId) {
  const orgId = Number(organizationId);
  if (!Number.isFinite(orgId) || orgId <= 0) return null;
  const cached = orgCfgCache.get(orgId);
  if (cached && Date.now() - cached.ts < 30_000) return cached.cfg;
  try {
    const rows = await prisma.$queryRaw`
      SELECT smtpHost, smtpPort, smtpSecure, smtpUser, smtpPassEnc, smtpFromName, smtpFromEmail, smtpReplyTo
      FROM OrganizationSettings
      WHERE organizationId = ${orgId}
      LIMIT 1
    `;
    const cfg = normalizeOrgSmtpRow(rows?.[0] || null);
    orgCfgCache.set(orgId, { ts: Date.now(), cfg });
    return cfg;
  } catch {
    orgCfgCache.set(orgId, { ts: Date.now(), cfg: null });
    return null;
  }
}

async function smtpConfig({ organizationId } = {}) {
  const orgCfg = await orgSmtpConfig(organizationId);
  if (orgCfg) return orgCfg;
  return envSmtpConfig();
}

function isEmailConfigured() {
  const cfg = envSmtpConfig();
  return !!cfg && !!cfg.host && !!cfg.from;
}

const cachedTransports = new Map();

function hashSecret(s) {
  const v = String(s || '');
  if (!v) return '';
  return crypto.createHash('sha256').update(v).digest('hex');
}

async function getTransport({ organizationId } = {}) {
  const cfg = await smtpConfig({ organizationId });
  if (!cfg) return null;
  if (!nodemailer) throw new Error('nodemailer_missing');
  const passHash = cfg.auth?.pass ? hashSecret(cfg.auth.pass) : '';
  const key = JSON.stringify({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    authUser: cfg.auth?.user || '',
    authPassHash: passHash,
    connectionTimeout: cfg.connectionTimeout,
    socketTimeout: cfg.socketTimeout
  });
  const existing = cachedTransports.get(key);
  if (existing) return { transport: existing, cfg };

  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.auth || undefined,
    connectionTimeout: cfg.connectionTimeout,
    greetingTimeout: cfg.connectionTimeout,
    socketTimeout: cfg.socketTimeout
  });
  cachedTransports.set(key, transport);
  return { transport, cfg };
}

function normalizeAddressList(list) {
  const arr = Array.isArray(list) ? list : typeof list === 'string' ? list.split(',') : [];
  const emails = arr.map((x) => String(x || '').trim()).filter((x) => isValidEmail(x));
  return Array.from(new Set(emails));
}

async function sendEmailNow({ organizationId, to, cc, bcc, subject, text, html, replyTo } = {}) {
  const t = await getTransport({ organizationId });
  if (!t) return { skipped: true, reason: 'smtp_not_configured' };
  const toList = normalizeAddressList(to);
  const ccList = normalizeAddressList(cc);
  const bccList = normalizeAddressList(bcc);
  if (toList.length === 0 && ccList.length === 0 && bccList.length === 0) return { skipped: true, reason: 'no_recipients' };

  const s = String(subject || '').trim();
  if (!s) throw new Error('Email subject is required');
  const hasText = String(text || '').trim();
  const hasHtml = String(html || '').trim();
  if (!hasText && !hasHtml) throw new Error('Email body is required');

  const from = t.cfg.from;
  if (!from) return { skipped: true, reason: 'smtp_from_missing' };

  const info = await t.transport.sendMail({
    from,
    to: toList.length ? toList.join(', ') : undefined,
    cc: ccList.length ? ccList.join(', ') : undefined,
    bcc: bccList.length ? bccList.join(', ') : undefined,
    subject: s,
    text: hasText ? String(text) : undefined,
    html: hasHtml ? String(html) : undefined,
    replyTo: String(replyTo || t.cfg.replyTo || '').trim() || undefined
  });
  return { ok: true, messageId: info?.messageId ? String(info.messageId) : null };
}

jobQueue.registerHandler('send_email', async (payload) => {
  return await sendEmailNow(payload);
});

async function sendEmail(payload) {
  try {
    await jobQueue.addJob('send_email', payload);
  } catch {
  }
}

module.exports = {
  isEmailConfigured,
  sendEmail,
  sendEmailNow
};
