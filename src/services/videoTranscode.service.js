const fs = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');

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

function parseBool(raw, fallback = false) {
  const v = String(raw ?? '').trim().toLowerCase();
  if (!v) return fallback;
  if (['1', 'true', 'yes', 'y', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(v)) return false;
  return fallback;
}

function isVideoMime(mimeType) {
  return String(mimeType || '').toLowerCase().startsWith('video/');
}

async function transcodeToMobileMp4({ inAbs, outAbs }) {
  const tmpOutAbs = `${outAbs}.tmp-${process.pid}-${randHex(8)}.mp4`;
  const cmd = ffmpegBin();

  await fs.mkdir(path.dirname(outAbs), { recursive: true });
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
    'baseline',
    '-level',
    '3.1',
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
    '-ac',
    '2',
    '-ar',
    '44100',
    '-movflags',
    '+faststart',
    '-f',
    'mp4',
    tmpOutAbs
  ]);

  await replaceFile(tmpOutAbs, outAbs);
  const outStat = await fileStatSafe(outAbs);
  return { ok: true, sizeBytes: outStat ? Number(outStat.size) : null };
}

async function generateVideoPoster({ videoAbs, posterAbs }) {
  const tmpPosterAbs = `${posterAbs}.tmp-${process.pid}-${randHex(8)}.jpg`;
  const cmd = ffmpegBin();

  await fs.mkdir(path.dirname(posterAbs), { recursive: true });
  await run(cmd, ['-y', '-ss', '00:00:01.000', '-i', videoAbs, '-frames:v', '1', '-q:v', '2', tmpPosterAbs]);
  await replaceFile(tmpPosterAbs, posterAbs);
  const posterStat = await fileStatSafe(posterAbs);
  return { ok: true, sizeBytes: posterStat ? Number(posterStat.size) : null };
}

async function processUploadedVideo({ fileAbs, fileName, mimeType, destDir }) {
  const enabled = !parseBool(process.env.DISABLE_VIDEO_TRANSCODE, false);
  if (!enabled) return { ok: true, skipped: true, fileAbs, fileName, mimeType };
  if (!isVideoMime(mimeType)) return { ok: true, skipped: true, fileAbs, fileName, mimeType };

  const nodeEnv = String(process.env.NODE_ENV || '').trim().toLowerCase();
  const strictDefault = nodeEnv !== 'development' && nodeEnv !== 'test';
  const strict = parseBool(process.env.VIDEO_TRANSCODE_STRICT, strictDefault);

  const baseName = path.parse(String(fileName || '')).name;
  const outFileName = `${baseName}.mp4`;
  const outAbs = path.join(destDir, outFileName);
  const posterFileName = `${baseName}.jpg`;
  const posterAbs = path.join(destDir, posterFileName);

  try {
    await transcodeToMobileMp4({ inAbs: fileAbs, outAbs });
    if (path.resolve(fileAbs) !== path.resolve(outAbs)) {
      try {
        await fs.unlink(fileAbs);
      } catch {}
    }
    try {
      await generateVideoPoster({ videoAbs: outAbs, posterAbs });
    } catch {}
    const posterStat = await fileStatSafe(posterAbs);
    const outStat = await fileStatSafe(outAbs);
    return {
      ok: true,
      skipped: false,
      fileAbs: outAbs,
      fileName: outFileName,
      mimeType: 'video/mp4',
      sizeBytes: outStat ? Number(outStat.size) : null,
      posterFileName: posterStat ? posterFileName : null
    };
  } catch (e) {
    if (strict) {
      const msg = String(e?.message || e || '').trim();
      throw new Error(msg ? `video_transcode_failed: ${msg}` : 'video_transcode_failed');
    }
    return { ok: true, skipped: true, fileAbs, fileName, mimeType };
  }
}

module.exports = {
  isVideoMime,
  processUploadedVideo
};
