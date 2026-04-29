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

async function resolveProductTableName() {
  const tableName = (await tableExists('Product')) ? 'Product' : (await tableExists('Products')) ? 'Products' : null;
  return tableName;
}

async function ensureColumn(tableName, columnName, addSql, fillSql, modifySql) {
  const exists = await columnExists(tableName, columnName);
  if (exists) return;
  await prisma.$executeRawUnsafe(addSql);
  if (fillSql) await prisma.$executeRawUnsafe(fillSql);
  if (modifySql) await prisma.$executeRawUnsafe(modifySql);
}

async function ensureProductSchemaCompat() {
  const tableName = await resolveProductTableName();
  if (!tableName) return;

  const hasId = await columnExists(tableName, 'id');
  const hasOrg = await columnExists(tableName, 'organizationId');
  const hasCode = await columnExists(tableName, 'code');

  await ensureColumn(
    tableName,
    'sku',
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`sku\` VARCHAR(191) NULL`,
    hasCode
      ? `UPDATE \`${tableName}\` SET \`sku\` = \`code\` WHERE \`sku\` IS NULL OR \`sku\` = ''`
      : hasId
        ? `UPDATE \`${tableName}\` SET \`sku\` = CONCAT('SKU-', \`id\`) WHERE \`sku\` IS NULL OR \`sku\` = ''`
        : null,
    `ALTER TABLE \`${tableName}\` MODIFY \`sku\` VARCHAR(191) NOT NULL`
  );

  await ensureColumn(
    tableName,
    'category',
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`category\` VARCHAR(191) NULL`,
    `UPDATE \`${tableName}\` SET \`category\` = 'general' WHERE \`category\` IS NULL OR \`category\` = ''`,
    `ALTER TABLE \`${tableName}\` MODIFY \`category\` VARCHAR(191) NOT NULL`
  );

  await ensureColumn(
    tableName,
    'status',
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`status\` VARCHAR(191) NULL`,
    `UPDATE \`${tableName}\` SET \`status\` = 'active' WHERE \`status\` IS NULL OR \`status\` = ''`,
    `ALTER TABLE \`${tableName}\` MODIFY \`status\` VARCHAR(191) NOT NULL`
  );

  await ensureColumn(
    tableName,
    'name',
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`name\` VARCHAR(191) NULL`,
    `UPDATE \`${tableName}\` SET \`name\` = 'Unnamed product' WHERE \`name\` IS NULL OR \`name\` = ''`,
    `ALTER TABLE \`${tableName}\` MODIFY \`name\` VARCHAR(191) NOT NULL`
  );

  await ensureColumn(
    tableName,
    'code',
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`code\` VARCHAR(191) NULL`,
    hasId ? `UPDATE \`${tableName}\` SET \`code\` = CONCAT('CODE-', \`id\`) WHERE \`code\` IS NULL OR \`code\` = ''` : null,
    `ALTER TABLE \`${tableName}\` MODIFY \`code\` VARCHAR(191) NOT NULL`
  );

  await ensureColumn(tableName, 'remark', `ALTER TABLE \`${tableName}\` ADD COLUMN \`remark\` VARCHAR(191) NULL`, null, null);
  await ensureColumn(tableName, 'origin', `ALTER TABLE \`${tableName}\` ADD COLUMN \`origin\` VARCHAR(191) NULL`, null, null);
  await ensureColumn(tableName, 'description', `ALTER TABLE \`${tableName}\` ADD COLUMN \`description\` TEXT NULL`, null, null);
  await ensureColumn(tableName, 'cmsPageId', `ALTER TABLE \`${tableName}\` ADD COLUMN \`cmsPageId\` INT NULL`, null, null);
  await ensureColumn(
    tableName,
    'cmsCertificatePageId',
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`cmsCertificatePageId\` INT NULL`,
    null,
    null
  );
  await ensureColumn(
    tableName,
    'certificateTemplateId',
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`certificateTemplateId\` INT NULL`,
    null,
    null
  );

  await ensureColumn(
    tableName,
    'versionNo',
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`versionNo\` INT NULL`,
    `UPDATE \`${tableName}\` SET \`versionNo\` = 1 WHERE \`versionNo\` IS NULL`,
    `ALTER TABLE \`${tableName}\` MODIFY \`versionNo\` INT NOT NULL DEFAULT 1`
  );

  await ensureColumn(
    tableName,
    'createdAt',
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`createdAt\` DATETIME NULL`,
    `UPDATE \`${tableName}\` SET \`createdAt\` = NOW() WHERE \`createdAt\` IS NULL`,
    `ALTER TABLE \`${tableName}\` MODIFY \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`
  );

  await ensureColumn(
    tableName,
    'updatedAt',
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`updatedAt\` DATETIME NULL`,
    `UPDATE \`${tableName}\` SET \`updatedAt\` = NOW() WHERE \`updatedAt\` IS NULL`,
    `ALTER TABLE \`${tableName}\` MODIFY \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`
  );

  await ensureColumn(tableName, 'deletedAt', `ALTER TABLE \`${tableName}\` ADD COLUMN \`deletedAt\` DATETIME NULL`, null, null);

  if (hasOrg) {
    const idxSku = `${tableName}_organizationId_sku_key`;
    const hasIdxSku = await indexExists(tableName, idxSku);
    if (!hasIdxSku) await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX \`${idxSku}\` ON \`${tableName}\` (\`organizationId\`, \`sku\`)`);

    const idxCode = `${tableName}_organizationId_code_key`;
    const hasIdxCode = await indexExists(tableName, idxCode);
    if (!hasIdxCode) await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX \`${idxCode}\` ON \`${tableName}\` (\`organizationId\`, \`code\`)`);

    const idxCategory = `${tableName}_organizationId_category_idx`;
    const hasIdxCategory = await indexExists(tableName, idxCategory);
    if (!hasIdxCategory) await prisma.$executeRawUnsafe(`CREATE INDEX \`${idxCategory}\` ON \`${tableName}\` (\`organizationId\`, \`category\`)`);

    const idxStatus = `${tableName}_organizationId_status_idx`;
    const hasIdxStatus = await indexExists(tableName, idxStatus);
    if (!hasIdxStatus) await prisma.$executeRawUnsafe(`CREATE INDEX \`${idxStatus}\` ON \`${tableName}\` (\`organizationId\`, \`status\`)`);
  }
}

async function applyDbPatches() {
  await ensureProductSchemaCompat();
}

module.exports = { applyDbPatches };
