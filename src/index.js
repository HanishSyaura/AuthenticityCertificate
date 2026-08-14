const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fsSync = require('fs');
const fs = require('fs/promises');
const sharp = require('sharp');
const authRoutes = require('./modules/auth/auth.routes');
const productRoutes = require('./modules/product/product.routes');
const categoriesRoutes = require('./modules/categories/categories.routes');
const epcRoutes = require('./modules/epc/epc.routes');
const certificateRoutes = require('./modules/certificate/certificate.routes');
const publicRoutes = require('./modules/public/public.routes');
const publicV1Routes = require('./modules/public/publicV1.routes');
const cmsRoutes = require('./modules/cms/cms.routes');
const usersRoutes = require('./modules/users/users.routes');
const templatesRoutes = require('./modules/templates/templates.routes');
const uploadsRoutes = require('./modules/uploads/uploads.routes');
const organizationsRoutes = require('./modules/organizations/organizations.routes');
const settingsRoutes = require('./modules/settings/settings.routes');
const accessRoutes = require('./modules/access/access.routes');
const { rateLimit } = require('./middleware/rateLimit.middleware');
const { applyDbPatches } = require('./config/dbPatches');
const { pickWritableUploadRoot } = require('./utils/uploadsRoot');

dotenv.config();

require('./services/videoProcessing.service');
require('./services/pdfPreview.service');
require('./services/webpVariants.service');
const jobQueue = require('./services/jobQueue.service');

{
  const rawConc = Number.parseInt(String(process.env.SHARP_CONCURRENCY || '').trim(), 10);
  const conc = Number.isFinite(rawConc) ? Math.min(4, Math.max(1, rawConc)) : 1;
  try {
    sharp.concurrency(conc);
  } catch {}
  const rawCacheMb = Number.parseInt(String(process.env.SHARP_CACHE_MB || '').trim(), 10);
  const cacheMb = Number.isFinite(rawCacheMb) ? Math.min(512, Math.max(16, rawCacheMb)) : 64;
  try {
    sharp.cache({ memory: cacheMb });
  } catch {}
}

const appMode = String(process.env.APP_MODE || 'web').trim().toLowerCase();

if (jobQueue.hasRedis()) jobQueue.initQueue();

if (appMode === 'worker') {
  applyDbPatches()
    .then(() => {
      console.log('Worker started');
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
  return;
}

const app = express();
const PORT = process.env.PORT || 5000;

// Standardized Response Format Middleware
app.use((req, res, next) => {
  const stringifySafe = (payload) =>
    JSON.stringify(payload, (_key, value) => (typeof value === 'bigint' ? value.toString() : value));
  res.success = (data, message = 'OK') => {
    res.set('Content-Type', 'application/json');
    res.send(stringifySafe({ success: true, data, message }));
  };
  res.error = (message, status = 500) => {
    res.status(status);
    res.set('Content-Type', 'application/json');
    res.send(stringifySafe({ success: false, message }));
  };
  next();
});

const uploadRoots = [pickWritableUploadRoot()];
const isProd = process.env.NODE_ENV === 'production';

async function fileExists(absPath) {
  try {
    await fs.access(absPath);
    return true;
  } catch {
    return false;
  }
}

function isSafeRelPath(relPath) {
  const raw = String(relPath || '');
  if (!raw) return false;
  if (raw.includes('\0')) return false;
  if (raw.includes('..')) return false;
  return true;
}

async function tryServeWebpVariant(req, res, next) {
  const m = String(req.path || '').match(/^\/(.+)\/([A-Za-z0-9_-]+)-w(\d+)\.webp$/);
  if (!m) return next();
  const dirRel = m[1];
  const base = m[2];
  const width = Number(m[3]);
  if (!Number.isFinite(width) || ![320, 640, 1024].includes(width)) return next();
  if (!isSafeRelPath(dirRel)) return next();
  if (!/^[A-Za-z0-9_-]+$/.test(base)) return next();

  const extCandidates = ['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff', '.avif'];
  for (const root of uploadRoots) {
    const dirAbs = path.resolve(root, dirRel);
    if (!dirAbs.startsWith(root)) continue;
    const outAbs = path.join(dirAbs, `${base}-w${width}.webp`);
    if (await fileExists(outAbs)) return next();

    let inAbs = null;
    for (const ext of extCandidates) {
      const p = path.join(dirAbs, `${base}${ext}`);
      if (await fileExists(p)) {
        inAbs = p;
        break;
      }
    }
    if (!inAbs) continue;

    try {
      const p = ensureWebpVariant({ inAbs, outAbs, width });
      await p;
      if (await fileExists(outAbs)) {
        if (isProd) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        return res.sendFile(outAbs, (err) => {
          if (err) return next();
        });
      }
      continue;
    } catch {
      continue;
    }
  }
  return next();
}

const inflightWebp = new Map();
function ensureWebpVariant({ inAbs, outAbs, width }) {
  const key = String(outAbs);
  const existing = inflightWebp.get(key);
  if (existing) return existing;
  const p = (async () => {
    const tmpAbs = `${outAbs}.tmp-${process.pid}-${cryptoRandomHex(8)}`;
    try {
      await sharp(inAbs)
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(tmpAbs);
      try {
        await fs.rename(tmpAbs, outAbs);
      } catch {
        try {
          await fs.unlink(tmpAbs);
        } catch {}
      }
    } finally {
      inflightWebp.delete(key);
    }
  })();
  inflightWebp.set(key, p);
  return p;
}

function cryptoRandomHex(bytes) {
  try {
    const crypto = require('crypto');
    return crypto.randomBytes(bytes).toString('hex');
  } catch {
    return String(Date.now());
  }
}

function wrapStaticErrorsAs404(mw) {
  return (req, res, next) => {
    mw(req, res, (err) => {
      if (!err) return next();
      const status = Number(err?.status || err?.statusCode || 0);
      const code = String(err?.code || '');
      if (status === 404 || code === 'ENOENT' || code === 'ENOTDIR') return res.status(404).end();
      if (code === 'EACCES' || code === 'EPERM') return res.status(404).end();
      return res.status(404).end();
    });
  };
}

function buildUploadStaticMiddlewares(overrides = {}) {
  return uploadRoots.map((root) =>
    express.static(root, {
      etag: true,
      lastModified: true,
      immutable: isProd,
      maxAge: isProd ? '365d' : 0,
      redirect: false,
      index: false,
      ...overrides
    })
  );
}

const uploadStaticMiddlewares = buildUploadStaticMiddlewares();
const uploadStaticMiddlewaresNoFallthrough = buildUploadStaticMiddlewares({ fallthrough: false }).map(wrapStaticErrorsAs404);

app.use(
  '/uploads',
  tryServeWebpVariant,
  ...uploadStaticMiddlewares
);

app.use(
  '/public/uploads',
  tryServeWebpVariant,
  ...uploadStaticMiddlewaresNoFallthrough
);
app.use(
  '/api/public/uploads',
  tryServeWebpVariant,
  ...uploadStaticMiddlewaresNoFallthrough
);
app.use(
  '/api/v1/public/uploads',
  tryServeWebpVariant,
  ...uploadStaticMiddlewaresNoFallthrough
);

app.use('/uploads', (req, res, next) => {
  const p = String(req.path || '');
  const isMediaFile = /^\/media\/\d+\/[^/]+\.[A-Za-z0-9]{1,10}$/i.test(p);
  const isMediaWebpVariant = /^\/media\/\d+\/[A-Za-z0-9_-]+-w(320|640|1024)\.webp$/i.test(p);
  if (isMediaFile || isMediaWebpVariant) return res.status(404).end();
  return next();
});

function parseAllowedOrigins() {
  const raw = process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || '';
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const configuredOrigins = parseAllowedOrigins();
const devOrigins = ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003', 'http://localhost:3004'];
const prodFallbackOrigins = process.env.APP_ORIGIN ? [String(process.env.APP_ORIGIN).trim()] : [];
const allowlist =
  configuredOrigins.length > 0
    ? configuredOrigins
    : process.env.NODE_ENV === 'production'
      ? prodFallbackOrigins
      : devOrigins;

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowlist.length === 0) return cb(null, true);
      return cb(null, allowlist.includes(origin));
    }
  })
);
app.use(express.json());

const dbInit = { ready: false, error: null, promise: null };
dbInit.promise = applyDbPatches()
  .then(() => {
    dbInit.ready = true;
  })
  .catch((err) => {
    dbInit.error = err;
    console.error(err);
  });

app.use(async (req, res, next) => {
  if (req.path === '/' || req.path === '/health') return next();
  if (dbInit.ready) return next();

  const timeoutMs = Number(process.env.DB_PATCH_TIMEOUT_MS || 10000);
  try {
    await Promise.race([
      dbInit.promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('db_patches_timeout')), timeoutMs))
    ]);
  } catch {}

  if (dbInit.ready) return next();
  if (dbInit.error) return res.error('Database belum siap (inisialisasi gagal). Sila semak log server.', 503);
  return res.error('Database sedang diinisialisasi. Sila cuba lagi.', 503);
});

// Routes
app.use('/auth', authRoutes);
app.use('/products', productRoutes);
app.use('/categories', categoriesRoutes);
app.use('/epc', epcRoutes);
app.use('/certificates', certificateRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/epc', epcRoutes);
app.use('/api/certificates', certificateRoutes);
app.use(
  '/public',
  rateLimit({
    windowMs: 60_000,
    max: 120,
    keyFn: (req) => `${req.headers['x-forwarded-for'] || req.ip}|${req.path}|${req.params?.id || ''}`,
    message: 'Too many verification requests'
  }),
  publicRoutes
);
app.use(
  '/api/public',
  rateLimit({
    windowMs: 60_000,
    max: 120,
    keyFn: (req) => `${req.headers['x-forwarded-for'] || req.ip}|${req.path}|${req.params?.id || ''}`,
    message: 'Too many verification requests'
  }),
  publicRoutes
);

app.use('/api/v1/public', publicV1Routes);
app.use('/cms', cmsRoutes);
app.use('/users', usersRoutes);
app.use('/templates', templatesRoutes);
app.use('/uploads', uploadsRoutes);
app.use('/api/cms', cmsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/organizations', organizationsRoutes);
app.use('/settings', settingsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/access', accessRoutes);
app.use('/api/access', accessRoutes);

app.get('/health', async (req, res) => {
  let db = 'unknown';
  try {
    const prisma = require('./config/prisma');
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), 2000))
    ]);
    db = 'ok';
  } catch (e) {
    console.error(`[health] DB check failed: ${e?.message || e}`);
    db = 'unavailable';
  }
  res.success({ status: 'ok', db }, 'OK');
});

// Root route
app.get('/', (req, res) => {
  res.success({ version: '1.0.0' }, 'Product Authenticity Verification System API');
});

// Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error(err.stack);
  const code = err?.code;
  if (code === 'P2021') return res.error('Database schema belum siap (table tiada). Sila jalankan patch/migrasi DB.', 503);
  if (err?.name === 'ZodError' || (err && (Array.isArray(err.issues) || Array.isArray(err.errors)))) {
    const firstMsg = err.issues?.[0]?.message || err.errors?.[0]?.message || 'Invalid input';
    return res.error(firstMsg, 400);
  }
  return res.error(err.message || 'Internal Server Error', 500);
});

async function start() {
  const server = app.listen(PORT);
  server.on('listening', () => {
    console.log(`Server is running on port ${PORT}`);
  });
  server.on('error', (err) => {
    console.error(err);
    process.exit(1);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
