let nodemailer;
try {
  nodemailer = require('nodemailer');
} catch {
}

const jobQueue = require('./jobQueue.service');

function isValidEmail(v) {
  const s = String(v || '').trim();
  if (!s) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function smtpConfig() {
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

function isEmailConfigured() {
  const cfg = smtpConfig();
  return !!cfg && !!cfg.host && !!cfg.from;
}

let cachedTransport = null;
let cachedKey = '';

function getTransport() {
  const cfg = smtpConfig();
  if (!cfg) return null;
  if (!nodemailer) throw new Error('nodemailer_missing');
  const key = JSON.stringify({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    authUser: cfg.auth?.user || '',
    connectionTimeout: cfg.connectionTimeout,
    socketTimeout: cfg.socketTimeout
  });
  if (cachedTransport && cachedKey === key) return { transport: cachedTransport, cfg };

  cachedTransport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.auth || undefined,
    connectionTimeout: cfg.connectionTimeout,
    greetingTimeout: cfg.connectionTimeout,
    socketTimeout: cfg.socketTimeout
  });
  cachedKey = key;
  return { transport: cachedTransport, cfg };
}

function normalizeAddressList(list) {
  const arr = Array.isArray(list) ? list : typeof list === 'string' ? list.split(',') : [];
  const emails = arr.map((x) => String(x || '').trim()).filter((x) => isValidEmail(x));
  return Array.from(new Set(emails));
}

async function sendEmailNow({ to, cc, bcc, subject, text, html, replyTo } = {}) {
  const t = getTransport();
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
