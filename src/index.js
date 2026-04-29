const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const authRoutes = require('./modules/auth/auth.routes');
const productRoutes = require('./modules/product/product.routes');
const epcRoutes = require('./modules/epc/epc.routes');
const certificateRoutes = require('./modules/certificate/certificate.routes');
const publicRoutes = require('./modules/public/public.routes');
const publicV1Routes = require('./modules/public/publicV1.routes');
const cmsRoutes = require('./modules/cms/cms.routes');
const analyticsRoutes = require('./modules/analytics/analytics.routes');
const usersRoutes = require('./modules/users/users.routes');
const auditRoutes = require('./modules/audit/audit.routes');
const bulkRoutes = require('./modules/bulk/bulk.routes');
const fraudRoutes = require('./modules/fraud/fraud.routes');
const integrationsRoutes = require('./modules/integrations/integrations.routes');
const templatesRoutes = require('./modules/templates/templates.routes');
const mediaRoutes = require('./modules/media/media.routes');
const identityRoutes = require('./modules/identity/identity.routes');
const organizationsRoutes = require('./modules/organizations/organizations.routes');
const { rateLimit } = require('./middleware/rateLimit.middleware');
const { applyDbPatches } = require('./config/dbPatches');

dotenv.config();

require('./modules/bulk/bulk.service').registerHandlers();

const app = express();
const PORT = process.env.PORT || 5000;

app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

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
  res.success = (data, message = 'OK') => {
    res.json({ success: true, data, message });
  };
  res.error = (message, status = 500) => {
    res.status(status).json({ success: false, message });
  };
  next();
});

// Routes
app.use('/auth', authRoutes);
app.use('/products', productRoutes);
app.use('/epc', epcRoutes);
app.use('/certificates', certificateRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
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
app.use('/analytics', analyticsRoutes);
app.use('/users', usersRoutes);
app.use('/audit', auditRoutes);
app.use('/bulk', bulkRoutes);
app.use('/fraud', fraudRoutes);
app.use('/integrations', integrationsRoutes);
app.use('/templates', templatesRoutes);
app.use('/media', mediaRoutes);
app.use('/identities', identityRoutes);
app.use('/organizations', organizationsRoutes);
app.use('/api/cms', cmsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/bulk', bulkRoutes);
app.use('/api/fraud', fraudRoutes);
app.use('/api/integrations', integrationsRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/identities', identityRoutes);
app.use('/api/organizations', organizationsRoutes);

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
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
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

  applyDbPatches().catch((err) => {
    console.error(err);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
