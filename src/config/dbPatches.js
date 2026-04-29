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

async function resolveTableName(candidates) {
  for (const name of candidates) {
    if (await tableExists(name)) return name;
  }
  return null;
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

async function ensureCmsPageSchemaCompat() {
  const tableName = await resolveTableName(['CmsPage', 'cmsPage', 'cms_pages']);
  if (!tableName) return;
  await ensureColumn(
    tableName,
    'kind',
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`kind\` VARCHAR(32) NULL`,
    `UPDATE \`${tableName}\` SET \`kind\` = 'landing' WHERE \`kind\` IS NULL OR \`kind\` = ''`,
    `ALTER TABLE \`${tableName}\` MODIFY \`kind\` VARCHAR(32) NOT NULL DEFAULT 'landing'`
  );
}

async function ensureCertificateTemplateSchemaCompat() {
  const tableName = await resolveTableName(['CertificateTemplate', 'certificateTemplate', 'certificate_templates']);
  if (!tableName) return;
  await ensureColumn(tableName, 'placeholders', `ALTER TABLE \`${tableName}\` ADD COLUMN \`placeholders\` JSON NULL`, null, null);
  await ensureColumn(
    tableName,
    'canvasWidth',
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`canvasWidth\` INT NULL`,
    `UPDATE \`${tableName}\` SET \`canvasWidth\` = 390 WHERE \`canvasWidth\` IS NULL`,
    `ALTER TABLE \`${tableName}\` MODIFY \`canvasWidth\` INT NOT NULL DEFAULT 390`
  );
  await ensureColumn(
    tableName,
    'canvasHeight',
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`canvasHeight\` INT NULL`,
    `UPDATE \`${tableName}\` SET \`canvasHeight\` = 844 WHERE \`canvasHeight\` IS NULL`,
    `ALTER TABLE \`${tableName}\` MODIFY \`canvasHeight\` INT NOT NULL DEFAULT 844`
  );
}

async function ensureEpcSchemaCompat() {
  const batchTable = await resolveTableName(['EpcBatch', 'epcBatch', 'epc_batches']);
  if (batchTable) {
    await ensureColumn(batchTable, 'certificateTemplateId', `ALTER TABLE \`${batchTable}\` ADD COLUMN \`certificateTemplateId\` INT NULL`, null, null);
    await ensureColumn(batchTable, 'templateData', `ALTER TABLE \`${batchTable}\` ADD COLUMN \`templateData\` JSON NULL`, null, null);
    await ensureColumn(batchTable, 'productionUploadedAt', `ALTER TABLE \`${batchTable}\` ADD COLUMN \`productionUploadedAt\` DATETIME NULL`, null, null);
    await ensureColumn(batchTable, 'productionDoneAt', `ALTER TABLE \`${batchTable}\` ADD COLUMN \`productionDoneAt\` DATETIME NULL`, null, null);
  }

  const itemTable = await resolveTableName(['EpcItem', 'epcItem', 'epc_items']);
  if (itemTable) {
    await ensureColumn(itemTable, 'netWeight', `ALTER TABLE \`${itemTable}\` ADD COLUMN \`netWeight\` VARCHAR(191) NULL`, null, null);
    await ensureColumn(itemTable, 'productionDate', `ALTER TABLE \`${itemTable}\` ADD COLUMN \`productionDate\` DATETIME NULL`, null, null);
    await ensureColumn(itemTable, 'caiqNumber', `ALTER TABLE \`${itemTable}\` ADD COLUMN \`caiqNumber\` VARCHAR(191) NULL`, null, null);
  }
}

async function applyDbPatches() {
  await ensureProductSchemaCompat();
  await ensureCmsPageSchemaCompat();
  await ensureCertificateTemplateSchemaCompat();
  await ensureEpcSchemaCompat();
}

module.exports = { applyDbPatches };
