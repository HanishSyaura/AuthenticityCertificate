const express = require('express');
const router = express.Router();

const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs/promises');
const sharp = require('sharp');
const prisma = require('../../config/prisma');
const { verifyToken } = require('../../middleware/auth.middleware');
const { attachOrganization, requireOrganization } = require('../../middleware/org.middleware');
const { attachAccessContext, requireAccess } = require('../../middleware/access.middleware');
const { auditAction } = require('../../services/audit.service');
const { processUploadedVideo } = require('../../services/videoTranscode.service');

async function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), ms))]);
}

function getUploadsRoot() {
  return path.resolve(process.cwd(), 'uploads');
}

async function appendUploadDebug(payload) {
  const dir = path.resolve(process.cwd(), '.dbg');
  await fs.mkdir(dir, { recursive: true });
  const abs = path.join(dir, 'trae-debug-log-upload-timeout-cms.ndjson');
  await fs.appendFile(abs, `${JSON.stringify({ ts: Date.now(), ...payload })}\n`);
}

function makeFileName(originalName) {
  const ext = path.extname(String(originalName || '')).slice(0, 10);
  const rand = crypto.randomBytes(16).toString('hex');
  return `${Date.now()}-${rand}${ext}`;
}

function isProcessableImage(file) {
  const mime = String(file?.mimetype || '').toLowerCase();
  if (!mime.startsWith('image/')) return false;
  if (mime === 'image/svg+xml') return false;
  if (mime === 'image/gif') return false;
  return true;
}

async function generateWebpVariants({ filePath, destDir, baseName }) {
  const widths = [320, 640, 1024];
  const img = sharp(filePath).rotate();
  await Promise.all(
    widths.map(async (w) => {
      const outPath = path.join(destDir, `${baseName}-w${w}.webp`);
      await img
        .clone()
        .resize({ width: w, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(outPath);
    })
  );
}

function storage() {
  return multer.diskStorage({
    destination: async (req, file, cb) => {
      try {
        const orgId = String(req.organization.id);
        const dest = path.join(getUploadsRoot(), 'media', orgId);
        await fs.mkdir(dest, { recursive: true });
        cb(null, dest);
      } catch (e) {
        cb(e);
      }
    },
    filename: (req, file, cb) => {
      cb(null, makeFileName(file.originalname));
    }
  });
}

const DEFAULT_MAX_UPLOAD_MB = 500;
const MAX_UPLOAD_MB_RAW = process.env.MAX_UPLOAD_MB || process.env.UPLOAD_MAX_MB || '';
const MAX_UPLOAD_MB = Number.isFinite(Number.parseInt(MAX_UPLOAD_MB_RAW, 10))
  ? Math.max(1, Number.parseInt(MAX_UPLOAD_MB_RAW, 10))
  : DEFAULT_MAX_UPLOAD_MB;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

const upload = multer({
  storage: storage(),
  limits: { fileSize: MAX_UPLOAD_BYTES }
}).single('file');

async function listMedia(req, res) {
  try {
    const items = await withTimeout(
      prisma.mediaAsset.findMany({
        where: { organizationId: Number(req.organization.id) },
        orderBy: { createdAt: 'desc' }
      }),
      1200
    );
    res.success(items);
  } catch (e) {
    res.error(e.message);
  }
}

function uploadMedia(req, res) {
  upload(req, res, async (err) => {
    const startedAt = Date.now();
    if (err) {
      try {
        // #region debug-point A:upload-multer-error
        await appendUploadDebug({
          hypothesisId: 'A',
          stage: 'multer_error',
          orgId: req?.organization?.id || null,
          message: err?.message || 'upload_error',
          code: err?.code || null,
          elapsedMs: Date.now() - startedAt
        });
        // #endregion debug-point A:upload-multer-error
      } catch {}
      if (err?.code === 'LIMIT_FILE_SIZE') {
        return res.error(`File too large. Maximum file size is ${MAX_UPLOAD_MB}MB.`, 413);
      }
      return res.error(err.message, 400);
    }
    try {
      const file = req.file;
      if (!file) return res.error('File required', 400);
      const orgId = Number(req.organization.id);
      const destDir = path.join(getUploadsRoot(), 'media', String(orgId));
      const baseName = path.parse(String(file.filename || '')).name;
      try {
        // #region debug-point B:upload-start
        await appendUploadDebug({
          hypothesisId: 'B',
          stage: 'upload_received',
          orgId,
          fileName: file.filename,
          mimeType: file.mimetype,
          sizeBytes: Number(file.size) || 0,
          elapsedMs: Date.now() - startedAt
        });
        // #endregion debug-point B:upload-start
      } catch {}
      if (isProcessableImage(file) && file.path) {
        try {
          await generateWebpVariants({ filePath: file.path, destDir, baseName });
        } catch {}
      }
      let finalFileName = file.filename;
      let finalMimeType = file.mimetype;
      let finalSizeBytes = Number(file.size);
      let finalPosterFileName = null;
      if (file.path) {
        try {
          // #region debug-point C:transcode-start
          await appendUploadDebug({
            hypothesisId: 'C',
            stage: 'transcode_start',
            orgId,
            fileName: file.filename,
            elapsedMs: Date.now() - startedAt
          });
          // #endregion debug-point C:transcode-start
        } catch {}
        const processed = await processUploadedVideo({
          fileAbs: file.path,
          fileName: file.filename,
          mimeType: file.mimetype,
          destDir
        });
        try {
          // #region debug-point D:transcode-done
          await appendUploadDebug({
            hypothesisId: 'D',
            stage: 'transcode_done',
            orgId,
            inputFileName: file.filename,
            outputFileName: processed?.fileName || file.filename,
            skipped: Boolean(processed?.skipped),
            sizeBytes: Number(processed?.sizeBytes || finalSizeBytes || 0),
            elapsedMs: Date.now() - startedAt
          });
          // #endregion debug-point D:transcode-done
        } catch {}
        if (processed?.fileName) finalFileName = processed.fileName;
        if (processed?.mimeType) finalMimeType = processed.mimeType;
        if (processed?.sizeBytes != null) finalSizeBytes = Number(processed.sizeBytes);
        if (processed?.posterFileName) finalPosterFileName = processed.posterFileName;
      }
      const url = `/uploads/media/${orgId}/${finalFileName}`;
      const posterUrl = finalPosterFileName ? `/uploads/media/${orgId}/${finalPosterFileName}` : null;
      const created = await withTimeout(
        prisma.mediaAsset.create({
          data: {
            organizationId: orgId,
            originalName: file.originalname,
            fileName: finalFileName,
            mimeType: finalMimeType,
            sizeBytes: finalSizeBytes,
            url
          }
        }),
        1500
      );
      try {
        // #region debug-point E:upload-success
        await appendUploadDebug({
          hypothesisId: 'E',
          stage: 'upload_success',
          orgId,
          fileName: finalFileName,
          mediaAssetId: created?.id || null,
          url,
          elapsedMs: Date.now() - startedAt
        });
        // #endregion debug-point E:upload-success
      } catch {}
      res.success({ ...created, posterUrl }, 'Uploaded');
    } catch (e) {
      const filePath = req?.file?.path;
      if (filePath) {
        try {
          await fs.unlink(filePath);
        } catch {}
      }
      try {
        // #region debug-point F:upload-fail
        await appendUploadDebug({
          hypothesisId: 'F',
          stage: 'upload_fail',
          orgId: req?.organization?.id || null,
          fileName: req?.file?.filename || null,
          message: e?.message || 'upload_failed',
          elapsedMs: Date.now() - startedAt
        });
        // #endregion debug-point F:upload-fail
      } catch {}
      res.error(e.message, 400);
    }
  });
}

async function deleteMedia(req, res) {
  try {
    const { id } = req.params;
    const asset = await withTimeout(
      prisma.mediaAsset.findFirst({ where: { id: Number(id), organizationId: Number(req.organization.id) } }),
      1200
    );
    if (!asset) return res.error('Media not found', 404);

    await withTimeout(prisma.mediaAsset.delete({ where: { id: Number(id) } }), 1200);

    const orgId = String(Number(req.organization.id));
    const dir = path.join(getUploadsRoot(), 'media', orgId);
    const filePath = path.join(dir, asset.fileName);
    try {
      await fs.unlink(filePath);
    } catch {}
    const baseName = path.parse(String(asset.fileName || '')).name;
    for (const w of [320, 640, 1024]) {
      try {
        await fs.unlink(path.join(dir, `${baseName}-w${w}.webp`));
      } catch {}
    }
    if (String(asset.mimeType || '').toLowerCase().startsWith('video/')) {
      try {
        await fs.unlink(path.join(dir, `${baseName}.jpg`));
      } catch {}
    }

    res.success({ id: Number(id) }, 'Deleted');
  } catch (e) {
    res.error(e.message, 400);
  }
}

router.use(verifyToken);
router.use(attachAccessContext);
router.use(attachOrganization);
router.use(requireOrganization);
router.use(requireAccess({ read: 'uploads.write', write: 'uploads.write' }));

router.get('/media', listMedia);
router.post('/media', auditAction('UPLOAD_MEDIA', { targetType: 'media_asset' }), uploadMedia);
router.delete(
  '/media/:id',
  auditAction('DELETE_MEDIA', { targetType: 'media_asset', getTargetId: (req) => req.params.id }),
  deleteMedia
);

module.exports = router;
