const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
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
const { listUploadRootCandidates } = require('./utils/uploadsRoot');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const uploadRoots = listUploadRootCandidates();
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
      await sharp(inAbs)
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(outAbs);
      if (isProd) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.sendFile(outAbs);
    } catch {
      continue;
    }
  }
  return next();
}

const uploadStaticMiddlewares = uploadRoots.map((root) =>
  express.static(root, {
    etag: true,
    lastModified: true,
    immutable: isProd,
    maxAge: isProd ? '365d' : 0
  })
);

app.use(
  '/uploads',
  tryServeWebpVariant,
  ...uploadStaticMiddlewares
);

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

  const timeoutMs = Number(process.env.DB_PATCH_TIMEOUT_MS || 3000);
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
      new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), 500))
    ]);
    db = 'ok';
  } catch {
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
