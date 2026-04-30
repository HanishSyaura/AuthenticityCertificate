const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs/promises');
const mediaService = require('./media.service');

function makeFileName(originalName) {
  const ext = path.extname(String(originalName || '')).slice(0, 10);
  const rand = crypto.randomBytes(16).toString('hex');
  return `${Date.now()}-${rand}${ext}`;
}

function storage() {
  return multer.diskStorage({
    destination: async (req, file, cb) => {
      try {
        const orgId = String(req.organization.id);
        const dest = path.join(mediaService.getUploadsRoot(), 'media', orgId);
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

const upload = multer({
  storage: storage(),
  limits: { fileSize: 25 * 1024 * 1024 }
}).single('file');

async function list(req, res) {
  try {
    const items = await mediaService.listMedia({ organizationId: req.organization.id });
    res.success(items);
  } catch (e) {
    res.error(e.message);
  }
}

function uploadFile(req, res) {
  upload(req, res, async (err) => {
    if (err) return res.error(err.message, 400);
    try {
      const file = req.file;
      if (!file) return res.error('File required', 400);
      const created = await mediaService.createMedia({
        organizationId: req.organization.id,
        originalName: file.originalname,
        fileName: file.filename,
        mimeType: file.mimetype,
        sizeBytes: file.size
      });
      res.success(created, 'Uploaded');
    } catch (e) {
      res.error(e.message, 400);
    }
  });
}

async function remove(req, res) {
  try {
    const { id } = req.params;
    const result = await mediaService.deleteMedia({ organizationId: req.organization.id, id });
    res.success(result, 'Deleted');
  } catch (e) {
    res.error(e.message, 400);
  }
}

module.exports = {
  list,
  uploadFile,
  remove
};
