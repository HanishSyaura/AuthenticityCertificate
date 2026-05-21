const express = require('express');
const router = express.Router();

const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs/promises');
const sharp = require('sharp');
const prisma = require('../../config/prisma');
const jobQueue = require('../../services/jobQueue.service');
const { verifyToken } = require('../../middleware/auth.middleware');
const { attachOrganization, requireOrganization } = require('../../middleware/org.middleware');
const { attachAccessContext, requireAccess } = require('../../middleware/access.middleware');
const { auditAction } = require('../../services/audit.service');
const { pickWritableUploadRoot } = require('../../utils/uploadsRoot');

async function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), ms))]);
}

function getUploadsRoot() {
  return pickWritableUploadRoot();
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
  for (const w of widths) {
    const outPath = path.join(destDir, `${baseName}-w${w}.webp`);
    await img
      .clone()
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(outPath);
  }
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
    if (err) {
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
      const isImg = isProcessableImage(file);
      const isVideo = String(file.mimetype || '').toLowerCase().startsWith('video/');
      let fileName = String(file.filename || '');
      let filePath = String(file.path || '');
      req.__acUploadAbsPath = filePath;

      if (isVideo && path.extname(fileName).toLowerCase() !== '.mp4') {
        try {
          if (filePath) await fs.unlink(filePath);
        } catch {}
        return res.error('Unsupported video format. Please upload MP4.', 400);
      }

      let created = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const url = `/uploads/media/${orgId}/${fileName}`;
        try {
          created = await withTimeout(
            prisma.mediaAsset.create({
              data: {
                organizationId: orgId,
                originalName: file.originalname,
                fileName,
                mimeType: file.mimetype,
                sizeBytes: Number(file.size),
                url,
                processingStatus: isVideo ? 'processing' : 'ready'
              }
            }),
            5000
          );
          break;
        } catch (e) {
          if (e?.code === 'P2002' && attempt < 2) {
            const nextName = makeFileName(file.originalname);
            const nextPath = path.join(destDir, nextName);
            try {
              await fs.rename(filePath, nextPath);
              fileName = nextName;
              filePath = nextPath;
              req.__acUploadAbsPath = filePath;
              continue;
            } catch {
              throw e;
            }
          }
          throw e;
        }
      }

      if (!created) return res.error('Failed to upload', 400);

      if (isVideo) {
        const disabled = ['1', 'true', 'yes', 'on'].includes(String(process.env.DISABLE_VIDEO_TRANSCODE || '').toLowerCase());
        if (!disabled) {
          try {
            const job = await jobQueue.addJob(
              'transcode_video',
              { mediaAssetId: created.id },
              { jobId: `transcode_video__${created.id}`, attempts: 2, backoff: { type: 'exponential', delay: 5000 } }
            );
            created = await prisma.mediaAsset.update({
              where: { id: Number(created.id) },
              data: { processingJobId: String(job?.id || '') || null }
            });
          } catch (e) {
            try {
              created = await prisma.mediaAsset.update({
                where: { id: Number(created.id) },
                data: {
                  processingStatus: 'failed',
                  processingError: e?.message || String(e),
                  processedAt: new Date()
                }
              });
            } catch {}
          }
        } else {
          created = await prisma.mediaAsset.update({
            where: { id: Number(created.id) },
            data: { processingStatus: 'ready', processingError: null, processedAt: new Date() }
          });
        }
      }

      if (isImg && filePath) {
        try {
          const baseName = path.parse(String(fileName || '')).name;
          await generateWebpVariants({ filePath, destDir, baseName });
        } catch {}
      }
      res.success(created, 'Uploaded');
    } catch (e) {
      try {
        const filePath = String(req.__acUploadAbsPath || req.file?.path || '');
        if (filePath) await fs.unlink(filePath);
      } catch {}
      if (e?.code === 'P2002') return res.error('Duplicate upload. Please retry.', 409);
      if (e?.message === 'db_timeout') return res.error('Database timeout', 503);
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
    try {
      await fs.unlink(path.join(dir, `${baseName}-poster.jpg`));
    } catch {}
    for (const w of [320, 640, 1024]) {
      try {
        await fs.unlink(path.join(dir, `${baseName}-w${w}.webp`));
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
