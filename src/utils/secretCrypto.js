const crypto = require('crypto');

function keyMaterial() {
  const secret = String(process.env.JWT_SECRET || '').trim();
  if (!secret) throw new Error('jwt_secret_missing');
  return secret;
}

function deriveKey() {
  return crypto.scryptSync(keyMaterial(), 'ac_secret_v1', 32);
}

function encryptText(plain) {
  const text = String(plain ?? '');
  const key = deriveKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const out = Buffer.concat([iv, tag, ciphertext]).toString('base64');
  return `v1:${out}`;
}

function decryptText(enc) {
  const raw = String(enc || '').trim();
  if (!raw) return null;
  const m = raw.match(/^v1:([A-Za-z0-9+/=]+)$/);
  if (!m) return null;
  const buf = Buffer.from(m[1], 'base64');
  if (buf.length < 12 + 16 + 1) return null;
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  try {
    const key = deriveKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    return plain;
  } catch {
    return null;
  }
}

module.exports = {
  encryptText,
  decryptText
};

