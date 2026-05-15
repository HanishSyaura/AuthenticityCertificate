const path = require('path');
const fs = require('fs/promises');
const { spawn } = require('child_process');
const prisma = require('../config/prisma');
const jobQueue = require('./jobQueue.service');
const { pickWritableUploadRoot } = require('../utils/uploadsRoot');

function ffmpegBin() {
  const raw = String(process.env.FFMPEG_PATH || process.env.FFMPEG_BIN || '').trim();
  return raw || 'ffmpeg';
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
    const timeoutMsRaw = opts.timeoutMs ?? process.env.FFMPEG_TIMEOUT_MS;
    const timeoutMs =
      timeoutMsRaw === undefined || timeoutMsRaw === null || String(timeoutMsRaw).trim() === ''
        ? 30 * 60_000
        : Math.max(0, Number(timeoutMsRaw) || 0);
    const spawnOpts = { ...opts };
    delete spawnOpts.timeoutMs;
    const child = spawn(cmd, args, { windowsHide: true, ...spawnOpts });
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
    child.stderr?.on('data', (d) => {
      if (stderr.length > 20000) return;
      stderr += String(d);
    });
    child.on('error', (e) => reject(e));
    child.on('close', (code) => {
      if (t) clearTimeout(t);
      if (timedOut) return reject(new Error('ffmpeg_timeout'));
      if (code === 0) return resolve({ ok: true });
      reject(new Error(stderr.trim() || `ffmpeg_failed_${code}`));
    });
  });
}

function posterRelUrlForAsset(asset) {
  const fileName = String(asset?.fileName || '');
  if (path.extname(fileName).toLowerCase() !== '.mp4') return null;
  const base = path.parse(fileName).name;
  const orgId = String(asset?.organizationId || '').trim();
  if (!orgId || !base) return null;
  return `/uploads/media/${orgId}/${base}-poster.jpg`;
}

async function transcodeOne({ mediaAssetId }) {
  const id = Number(mediaAssetId);
  if (!Number.isFinite(id) || id <= 0) throw new Error('invalid_media_asset_id');

  const asset = await prisma.mediaAsset.findFirst({ where: { id } });
  if (!asset) throw new Error('media_asset_not_found');

  try {
    const mime = String(asset.mimeType || '').toLowerCase();
    if (!mime.startsWith('video/')) {
      await prisma.mediaAsset.update({
        where: { id },
        data: { processingStatus: 'ready', processingError: null, processedAt: new Date() }
      });
      return { ok: true, skipped: true };
    }

    const root = pickWritableUploadRoot();
    const orgId = String(asset.organizationId);
    const dirAbs = path.join(root, 'media', orgId);
    const inAbs = path.join(dirAbs, String(asset.fileName || ''));
    const inStat = await fileStatSafe(inAbs);
    if (!inStat) throw new Error('source_missing');

    const tmpOutAbs = `${inAbs}.tmp-${process.pid}-${randHex(8)}.mp4`;
    const cmd = ffmpegBin();

    await run(cmd, [
      '-y',
      '-i',
      inAbs,
      '-vf',
      'scale=-2:720',
      '-pix_fmt',
      'yuv420p',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '23',
      '-profile:v',
      'high',
      '-level',
      '4.1',
      '-g',
      '48',
      '-keyint_min',
      '48',
      '-sc_threshold',
      '0',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-movflags',
      '+faststart',
      '-f',
      'mp4',
      tmpOutAbs
    ]);

    await replaceFile(tmpOutAbs, inAbs);

    const posterRel = posterRelUrlForAsset(asset) || null;
    const posterAbs = posterRel ? path.join(root, posterRel.replace(/^\/uploads\//, '')) : null;
    if (posterAbs) {
      const posterTmp = `${posterAbs}.tmp-${process.pid}-${randHex(8)}.jpg`;
      try {
        await fs.mkdir(path.dirname(posterAbs), { recursive: true });
        await run(cmd, ['-y', '-i', inAbs, '-ss', '00:00:01.000', '-vframes', '1', '-q:v', '3', posterTmp]);
        await replaceFile(posterTmp, posterAbs);
      } catch {
        try {
          await fs.unlink(posterTmp);
        } catch {}
      }
    }

    const outStat = await fileStatSafe(inAbs);
    await prisma.mediaAsset.update({
      where: { id },
      data: {
        mimeType: 'video/mp4',
        sizeBytes: outStat ? Number(outStat.size) : asset.sizeBytes,
        processingStatus: 'ready',
        processingError: null,
        posterUrl: posterRel || asset.posterUrl || null,
        processedAt: new Date()
      }
    });

    return { ok: true, bytesBefore: Number(inStat.size), bytesAfter: outStat ? Number(outStat.size) : null };
  } catch (e) {
    try {
      await prisma.mediaAsset.update({
        where: { id },
        data: { processingStatus: 'failed', processingError: e?.message || String(e), processedAt: new Date() }
      });
    } catch {}
    throw e;
  }
}

jobQueue.registerHandler('transcode_video', async ({ mediaAssetId }) => {
  try {
    return await transcodeOne({ mediaAssetId });
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
  transcodeOne
};
