require('dotenv').config();

const path = require('path');
const fs = require('fs/promises');
const prisma = require('../src/config/prisma');
const { processUploadedVideo, isVideoMime } = require('../src/services/videoTranscode.service');

function getUploadsRoot() {
  return path.resolve(process.cwd(), 'uploads');
}

async function fileExists(absPath) {
  try {
    await fs.access(absPath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const orgFilter = process.argv[2] ? Number(process.argv[2]) : null;
  const onlyAssetId = process.argv[3] ? Number(process.argv[3]) : null;
  const uploadsRoot = getUploadsRoot();

  const where = {};
  if (Number.isFinite(orgFilter) && orgFilter > 0) where.organizationId = orgFilter;
  if (Number.isFinite(onlyAssetId) && onlyAssetId > 0) where.id = onlyAssetId;

  const assets = await prisma.mediaAsset.findMany({
    where,
    orderBy: { id: 'asc' }
  });

  let scanned = 0;
  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const asset of assets) {
    scanned += 1;
    const mimeType = String(asset?.mimeType || '');
    const fileName = String(asset?.fileName || '');
    const orgId = Number(asset?.organizationId || 0);
    const destDir = path.join(uploadsRoot, 'media', String(orgId));
    const fileAbs = path.join(destDir, fileName);

    if (!isVideoMime(mimeType)) {
      skipped += 1;
      process.stdout.write(`[skip] asset ${asset.id} is not video (${mimeType || 'unknown'})\n`);
      continue;
    }

    if (!(await fileExists(fileAbs))) {
      failed += 1;
      process.stderr.write(`[fail] asset ${asset.id} file missing: ${fileAbs}\n`);
      continue;
    }

    try {
      const result = await processUploadedVideo({
        fileAbs,
        fileName,
        mimeType,
        destDir
      });

      const nextFileName = String(result?.fileName || fileName);
      const nextMimeType = String(result?.mimeType || mimeType || 'video/mp4');
      const nextSizeBytes =
        result?.sizeBytes != null && Number.isFinite(Number(result.sizeBytes))
          ? Number(result.sizeBytes)
          : Number(asset.sizeBytes || 0);
      const nextUrl = `/uploads/media/${orgId}/${nextFileName}`;

      await prisma.mediaAsset.update({
        where: { id: asset.id },
        data: {
          fileName: nextFileName,
          mimeType: nextMimeType,
          sizeBytes: nextSizeBytes,
          url: nextUrl
        }
      });

      processed += 1;
      process.stdout.write(
        `[ok] asset ${asset.id} -> ${nextFileName} (${Math.round(nextSizeBytes / (1024 * 1024))} MB)\n`
      );
    } catch (err) {
      failed += 1;
      process.stderr.write(`[fail] asset ${asset.id}: ${err?.message || String(err)}\n`);
    }
  }

  process.stdout.write(
    `done scanned=${scanned} processed=${processed} skipped=${skipped} failed=${failed}\n`
  );
}

main()
  .catch((err) => {
    process.stderr.write(`${err?.message || String(err)}\n`);
    process.exit(1);
  })
  .finally(async () => {
    try {
      await prisma.$disconnect();
    } catch {}
  });

