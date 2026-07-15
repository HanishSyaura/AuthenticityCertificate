const express = require('express');
const path = require('path');
const fs = require('fs/promises');

const router = express.Router();

function normalizeSessionId(raw) {
  const v = String(raw || '').trim().toLowerCase();
  if (!v) return null;
  const safe = v.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return safe || null;
}

async function appendLog(sessionId, payload) {
  const dir = path.resolve(process.cwd(), '.dbg');
  await fs.mkdir(dir, { recursive: true });
  const abs = path.join(dir, `trae-debug-log-${sessionId}.ndjson`);
  await fs.appendFile(abs, `${JSON.stringify(payload)}\n`);
  return abs;
}

router.post('/video-event', async (req, res) => {
  const token = String(process.env.DEBUG_EVENT_TOKEN || '').trim();
  if (!token) return res.status(404).send('Not found');
  if (String(req.query.token || '') !== token) return res.status(403).send('Forbidden');

  const sessionId = normalizeSessionId(req.body?.sessionId) || 'mobile-video-no-play';
  const payload = {
    ...req.body,
    sessionId,
    ts: Number(req.body?.ts) || Date.now(),
    ip: req.headers['x-forwarded-for'] || req.ip
  };

  try {
    const file = await appendLog(sessionId, payload);
    res.json({ ok: true, file });
  } catch (e) {
    res.status(500).json({ ok: false, message: e?.message || 'write_failed' });
  }
});

module.exports = router;
