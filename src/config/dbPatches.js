const prisma = require('./prisma');

async function tableExists(tableName) {
  const rows = await prisma.$queryRaw`
    SELECT COUNT(*) AS c
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ${tableName}
  `;
  const c = Number(rows?.[0]?.c ?? rows?.[0]?.C ?? 0);
  return c > 0;
}

async function columnExists(tableName, columnName) {
  const rows = await prisma.$queryRaw`
    SELECT COUNT(*) AS c
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ${tableName}
      AND COLUMN_NAME = ${columnName}
  `;
  const c = Number(rows?.[0]?.c ?? rows?.[0]?.C ?? 0);
  return c > 0;
}

async function indexExists(tableName, indexName) {
  const rows = await prisma.$queryRaw`
    SELECT COUNT(*) AS c
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ${tableName}
      AND INDEX_NAME = ${indexName}
  `;
  const c = Number(rows?.[0]?.c ?? rows?.[0]?.C ?? 0);
  return c > 0;
}

async function ensureProductSkuColumn() {
  const tableName = (await tableExists('Product')) ? 'Product' : (await tableExists('Products')) ? 'Products' : null;
  if (!tableName) return;

  const hasSku = await columnExists(tableName, 'sku');
  if (!hasSku) {
    await prisma.$executeRawUnsafe(`ALTER TABLE \`${tableName}\` ADD COLUMN \`sku\` VARCHAR(191) NULL`);
    const hasCode = await columnExists(tableName, 'code');
    if (hasCode) {
      await prisma.$executeRawUnsafe(`UPDATE \`${tableName}\` SET \`sku\` = \`code\` WHERE \`sku\` IS NULL OR \`sku\` = ''`);
    } else {
      await prisma.$executeRawUnsafe(`UPDATE \`${tableName}\` SET \`sku\` = CONCAT('SKU-', \`id\`) WHERE \`sku\` IS NULL OR \`sku\` = ''`);
    }
    await prisma.$executeRawUnsafe(`ALTER TABLE \`${tableName}\` MODIFY \`sku\` VARCHAR(191) NOT NULL`);
  }

  const hasOrg = await columnExists(tableName, 'organizationId');
  if (hasOrg) {
    const idx = `${tableName}_organizationId_sku_key`;
    const exists = await indexExists(tableName, idx);
    if (!exists) {
      await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX \`${idx}\` ON \`${tableName}\` (\`organizationId\`, \`sku\`)`);
    }
  }
}

async function applyDbPatches() {
  await ensureProductSkuColumn();
}

module.exports = { applyDbPatches };
