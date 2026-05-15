const path = require('path');
const fs = require('fs/promises');
const { spawn } = require('child_process');
const prisma = require('../config/prisma');
const jobQueue = require('./jobQueue.service');
const { pickWritableUploadRoot } = require('../utils/uploadsRoot');

function clampInt(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.trunc(n);
  return Math.min(max, Math.max(min, i));
}

function randHex(n) {
  const chars = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < n; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function fileStatSafe(absPath) {
  try {
    return await fs.stat(absPath);
  } catch {
    return null;
  }
}

async function replaceFile(tmpAbs, finalAbs) {
  try {
    await fs.rename(tmpAbs, finalAbs);
    return;
  } catch {}
  try {
    await fs.unlink(finalAbs);
  } catch {}
  await fs.rename(tmpAbs, finalAbs);
}

async function run(cmd, args, opts = {}) {
  return await new Promise((resolve, reject) => {
    const timeoutMsRaw = opts.timeoutMs ?? process.env.PDF_PREVIEW_TIMEOUT_MS;
    const timeoutMs =
      timeoutMsRaw === undefined || timeoutMsRaw === null || String(timeoutMsRaw).trim() === ''
        ? 10 * 60_000
        : Math.max(0, Number(timeoutMsRaw) || 0);

    const spawnOpts = { ...opts };
    delete spawnOpts.timeoutMs;
    const child = spawn(cmd, args, { windowsHide: true, ...spawnOpts });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const t =
      timeoutMs > 0
        ? setTimeout(() => {
            timedOut = true;
            try {
              child.kill();
            } catch {}
          }, timeoutMs)
        : null;
    child.stdout?.on('data', (d) => {
      if (stdout.length > 20000) return;
      stdout += String(d);
    });
    child.stderr?.on('data', (d) => {
      if (stderr.length > 20000) return;
      stderr += String(d);
    });
    child.on('error', (e) => reject(e));
    child.on('close', (code) => {
      if (t) clearTimeout(t);
      if (timedOut) return reject(new Error('pdf_preview_timeout'));
      if (code === 0) return resolve({ ok: true, stdout, stderr });
      reject(new Error(stderr.trim() || stdout.trim() || `pdf_preview_failed_${code}`));
    });
  });
}

async function getPdfPageCount(inAbs) {
  const out = await run('pdfinfo', [inAbs]);
  const text = String(out?.stdout || '');
  const m = text.match(/^\s*Pages:\s*(\d+)\s*$/im);
  const n = m ? Number(m[1]) : 0;
  if (!Number.isFinite(n) || n <= 0) throw new Error('pdf_preview_pages_unknown');
  return n;
}

function toUploadRelUrl(absPath, uploadsRoot) {
  const root = path.resolve(String(uploadsRoot || ''));
  const abs = path.resolve(String(absPath || ''));
  if (!root || !abs || !abs.startsWith(root)) return '';
  const rel = abs.slice(root.length).replace(/\\/g, '/');
  return `/uploads${rel.startsWith('/') ? '' : '/'}${rel}`;
}

async function renderPdfPreviewOne({ mediaAssetId }) {
  const id = Number(mediaAssetId);
  if (!Number.isFinite(id) || id <= 0) throw new Error('invalid_media_asset_id');

  const asset = await prisma.mediaAsset.findFirst({ where: { id } });
  if (!asset) throw new Error('media_asset_not_found');

  const mime = String(asset.mimeType || '').toLowerCase();
  if (mime !== 'application/pdf') throw new Error('not_a_pdf');

  const orgId = String(asset.organizationId || '').trim();
  if (!orgId) throw new Error('invalid_org_id');

  const fileName = String(asset.fileName || '').trim();
  if (!fileName) throw new Error('invalid_file_name');

  const uploadsRoot = pickWritableUploadRoot();
  const inAbs = path.join(uploadsRoot, 'media', orgId, fileName);
  const inStat = await fileStatSafe(inAbs);
  if (!inStat) throw new Error('pdf_file_not_found');

  const base = path.parse(fileName).name;
  const outDir = path.join(uploadsRoot, 'media', orgId);
  await fs.mkdir(outDir, { recursive: true });

  const maxPages = clampInt(process.env.PDF_PREVIEW_MAX_PAGES, 1, 200, 40);
  const dpi = clampInt(process.env.PDF_PREVIEW_DPI, 72, 300, 144);
  const jpegQuality = clampInt(process.env.PDF_PREVIEW_JPEG_QUALITY, 40, 95, 80);

  const totalPages = await getPdfPageCount(inAbs);
  const pageCount = Math.min(totalPages, maxPages);

  const pages = [];
  for (let p = 1; p <= pageCount; p += 1) {
    const pad = String(p).padStart(3, '0');
    const finalBaseAbs = path.join(outDir, `${base}-p${pad}`);
    const finalAbs = `${finalBaseAbs}.jpg`;
    const tmpBaseAbs = path.join(outDir, `${base}-p${pad}.tmp-${process.pid}-${randHex(6)}`);
    const tmpAbs = `${tmpBaseAbs}.jpg`;

    try {
      await run('pdftoppm', [
        '-f',
        String(p),
        '-l',
        String(p),
        '-singlefile',
        '-jpeg',
        '-jpegopt',
        `quality=${jpegQuality}`,
        '-r',
        String(dpi),
        inAbs,
        tmpBaseAbs
      ]);
      await replaceFile(tmpAbs, finalAbs);
    } finally {
      try {
        await fs.unlink(tmpAbs);
      } catch {}
    }

    const url = toUploadRelUrl(finalAbs, uploadsRoot);
    if (url) pages.push(url);
  }

  const manifestAbs = path.join(outDir, `${base}.preview.json`);
  const manifest = {
    version: 1,
    type: 'pdf_preview',
    format: 'jpg',
    dpi,
    pageCount: pages.length,
    pages,
    generatedAt: new Date().toISOString()
  };
  await fs.writeFile(manifestAbs, JSON.stringify(manifest), 'utf8');

  await prisma.mediaAsset.update({
    where: { id },
    data: {
      processingStatus: 'ready',
      processingError: null,
      processedAt: new Date()
    }
  });

  return { ok: true, pages: pages.length, totalPages, manifestUrl: toUploadRelUrl(manifestAbs, uploadsRoot) };
}

jobQueue.registerHandler('render_pdf_preview', async ({ mediaAssetId }) => {
  try {
    return await renderPdfPreviewOne({ mediaAssetId });
  } catch (e) {
    const id = Number(mediaAssetId);
    if (Number.isFinite(id) && id > 0) {
      try {
        await prisma.mediaAsset.update({
          where: { id },
          data: { processingStatus: 'failed', processingError: e?.message || String(e), processedAt: new Date() }
        });
      } catch {}
    }
    throw e;
  }
});

module.exports = {
  renderPdfPreviewOne
};

