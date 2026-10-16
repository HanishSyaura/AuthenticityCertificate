const path = require('path');
const fs = require('fs');

let safetyWarningLogged = false;

function isInsideGitRepo(absPath) {
  try {
    let cur = path.resolve(String(absPath || ''));
    while (true) {
      const gitDir = path.join(cur, '.git');
      if (fs.existsSync(gitDir) && fs.statSync(gitDir).isDirectory()) return { inGit: true, gitRoot: cur };
      const parent = path.dirname(cur);
      if (parent === cur) break;
      cur = parent;
    }
  } catch {}
  return { inGit: false, gitRoot: null };
}

function logUploadsSafetyWarning(absRoot) {
  if (safetyWarningLogged) return;
  try {
    safetyWarningLogged = true;
    const check = isInsideGitRepo(absRoot);
    const envOverride = !!process.env.UPLOADS_DIR || !!process.env.UPLOADS_ROOT;
    if (check.inGit) {
      console.warn();
      console.warn('================================ SAFETY WARNING ================================');
      console.warn('  UPLOADS FOLDER is INSIDE the git project directory.');
      console.warn(`  Uploads root: ${absRoot}`);
      console.warn(`  Git root    : ${check.gitRoot}`);
      console.warn('  RISK: git clean -fd/git reset --hard CAN DELETE user uploads!');
      console.warn('  FIX : Set UPLOADS_ROOT (or UPLOADS_DIR) in .env to a path OUTSIDE the project.');
      console.warn('  Example: UPLOADS_ROOT=/www/wwwroot/domain.com/shared-uploads');
      if (!envOverride) {
        console.warn('  Current uploads/ in .gitignore protects from git clean IF .gitignore is deployed.');
      }
      console.warn('=================================================================================');
      console.warn();
    }
  } catch {}
  try {
    fs.mkdirSync(String(absRoot || ''), { recursive: true });
    const mediaDir = path.join(String(absRoot || ''), 'media');
    fs.mkdirSync(mediaDir, { recursive: true });
  } catch {}
  try {
    const infoDir = path.join(String(absRoot || ''));
    console.log(`[uploads] Active uploads root: ${absRoot}`);
  } catch {}
}

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
  let chosen;
  if (envRoot) {
    chosen = envRoot;
  } else {
    chosen = candidates[0] || projectUploadsRoot();
    for (const abs of candidates) {
      try {
        if (fs.existsSync(abs)) {
          chosen = abs;
          break;
        }
      } catch {}
    }
  }
  logUploadsSafetyWarning(chosen);
  return chosen;
}

module.exports = {
  listUploadRootCandidates,
  pickWritableUploadRoot
};
