const path = require('path');
const fs = require('fs');

function normalizeCandidate(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;
  return path.resolve(raw);
}

function uniquePaths(paths) {
  const seen = new Set();
  const out = [];
  for (const p of paths) {
    const key = String(p || '');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

function projectUploadsRoot() {
  return path.resolve(__dirname, '..', '..', 'uploads');
}

function listUploadRootCandidates() {
  const envRoot = normalizeCandidate(process.env.UPLOADS_DIR || process.env.UPLOADS_ROOT || '');
  const cwd = process.cwd();
  const candidates = [
    envRoot,
    projectUploadsRoot(),
    path.resolve(cwd, 'uploads'),
    path.resolve(cwd, '..', 'uploads'),
    path.resolve(cwd, '..', '..', 'uploads')
  ].filter(Boolean);
  return uniquePaths(candidates);
}

function pickWritableUploadRoot() {
  const candidates = listUploadRootCandidates();
  const envRoot = normalizeCandidate(process.env.UPLOADS_DIR || process.env.UPLOADS_ROOT || '');
  if (envRoot) return envRoot;
  for (const abs of candidates) {
    try {
      if (fs.existsSync(abs)) return abs;
    } catch {
    }
  }
  return candidates[0] || projectUploadsRoot();
}

module.exports = {
  listUploadRootCandidates,
  pickWritableUploadRoot
};
