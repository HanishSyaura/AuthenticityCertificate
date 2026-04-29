const fs = require('fs');
const path = require('path');

const nodeMajor = Number(String(process.versions.node || '').split('.')[0] || 0);

if (!process.env.PRISMA_CLIENT_ENGINE_TYPE && nodeMajor >= 23) {
  process.env.PRISMA_CLIENT_ENGINE_TYPE = 'wasm';
}

if (process.env.PRISMA_CLIENT_ENGINE_TYPE !== 'wasm' && !process.env.PRISMA_QUERY_ENGINE_LIBRARY && process.platform === 'win32') {
  const enginesPath = path.resolve(process.cwd(), 'node_modules', '@prisma', 'engines', 'query_engine-windows.dll.node');
  if (fs.existsSync(enginesPath)) process.env.PRISMA_QUERY_ENGINE_LIBRARY = enginesPath;
}

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = prisma;
