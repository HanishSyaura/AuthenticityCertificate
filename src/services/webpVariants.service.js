const path = require('path');
const fs = require('fs/promises');
const sharp = require('sharp');
const prisma = require('../config/prisma');
const jobQueue = require('./jobQueue.service');
const { pickWritableUploadRoot } = require('../utils/uploadsRoot');

function isProcessableImageMime(mimeType) {
  const mime = String(mimeType || '').toLowerCase();
  if (!mime.startsWith('image/')) return false;
  if (mime === 'image/svg+xml') return false;
  if (mime === 'image/gif') return false;
  return true;
}

async function fileExists(absPath) {
  try {
    await fs.access(absPath);
    return true;
  } catch {
    return false;
  }
}

async function generateWebpVariants({ filePath, destDir, baseName }) {
  const widths = [320, 640, 1024];
  const img = sharp(filePath).rotate();
  for (const w of widths) {
    const outPath = path.join(destDir, `${baseName}-w${w}.webp`);
    if (await fileExists(outPath)) continue;
    await img
      .clone()
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(outPath);
  }
}

async function generateOne({ mediaAssetId }) {
  const id = Number(mediaAssetId);
  if (!Number.isFinite(id) || id <= 0) return { ok: false, reason: 'invalid_id' };

  const asset = await prisma.mediaAsset.findUnique({
    where: { id },
    select: { id: true, organizationId: true, fileName: true, mimeType: true }
  });
  if (!asset) return { ok: false, reason: 'not_found' };
  if (!isProcessableImageMime(asset.mimeType)) return { ok: false, reason: 'not_image' };

  const orgId = String(asset.organizationId);
  const uploadsRoot = pickWritableUploadRoot();
  const destDir = path.join(uploadsRoot, 'media', orgId);
  const filePath = path.join(destDir, String(asset.fileName || ''));
  if (!(await fileExists(filePath))) return { ok: false, reason: 'file_missing' };

  const baseName = path.parse(String(asset.fileName || '')).name;
  if (!baseName) return { ok: false, reason: 'invalid_name' };

  await generateWebpVariants({ filePath, destDir, baseName });
  return { ok: true };
}

jobQueue.registerHandler('generate_webp_variants', async ({ mediaAssetId }) => {
  return await generateOne({ mediaAssetId });
});

module.exports = {
  generateOne
};
